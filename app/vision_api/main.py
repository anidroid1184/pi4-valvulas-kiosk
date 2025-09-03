from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

import numpy as np
import cv2
from pyzbar.pyzbar import decode as zbar_decode
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime
import threading
import time

from app.config import IMAGES_DIR
from app.db.database import init_db, insert_scan, bulk_insert_valves, get_connection
from app.services.excel_service import parse_excel_to_rows

from app.services.vision_service import index_dataset, recognize_image, recognize_topk
from app.services.image_service import save_optimized_image_bytes

app = FastAPI(title="Valve Vision API", version="0.1.0")

# CORS: permitir explícitamente el origen del servidor estático local
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Ensure DB schema exists and mount static images
from app.db.database import init_db  # already imported above for insert_scan
init_db()

images_path = Path(IMAGES_DIR)
images_path.mkdir(parents=True, exist_ok=True)
app.mount("/images", StaticFiles(directory=str(images_path), html=False), name="images")


@app.get("/images_index")
def images_index():
    """Return one representative image per folder under data/images.
    Response: { items: [ { id: str, image: str, count: int } ] }
    """
    items: List[dict] = []
    if not images_path.exists():
        return {"items": items}
    for cls_dir in images_path.iterdir():
        if not cls_dir.is_dir():
            continue
        imgs = [p for p in cls_dir.iterdir() if p.suffix.lower() in {".jpg",".jpeg",".png"}]
        if not imgs:
            continue
        rep = imgs[0].name
        items.append({
            "id": cls_dir.name,
            "image": f"/images/{cls_dir.name}/{rep}",
            "count": len(imgs),
        })
    items.sort(key=lambda x: x["id"])  # stable order
    return {"items": items}


@app.get("/health")
def health():
    size = index_dataset(index_only=True)  # no reconstruye, solo reporta si hay índice
    return {"status": "ok", "index_size": size}


@app.post("/index")
def index_endpoint():
    count = index_dataset()
    return {"indexed": count}


# --- cv2 Live bridge (stream + training capture) ---
_cap_lock = threading.Lock()
_cap: Optional[cv2.VideoCapture] = None
_runner_thread: Optional[threading.Thread] = None
_runner_stop = threading.Event()
_last_jpeg: Optional[bytes] = None
_training_ref: Optional[str] = None
_training_active = False
_train_sent = 0
_train_failed = 0
_train_total = 0
_train_start_ts = 0.0

_overlay_color = (250, 165, 96)  # BGR for light blue (#60A5FA)
_overlay_thickness = 2


def _ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)


def _save_frame_for_ref(ref: str, frame: 'np.ndarray') -> bool:
    try:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        dest_dir = Path(IMAGES_DIR) / ref
        _ensure_dir(dest_dir)
        dest_path = dest_dir / f"{ts}.jpg"
        # usar image_service para optimizar
        from app.services.image_service import save_optimized_image_bytes
        # encode a JPEG in-memory then optimize-save (consistente con train_upload)
        ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if not ok:
            return False
        save_optimized_image_bytes(buf.tobytes(), dest_path)
        return True
    except Exception:
        return False


def _runner():
    global _cap, _last_jpeg, _training_active, _train_sent, _train_failed, _train_total
    try:
        while not _runner_stop.is_set():
            with _cap_lock:
                cap = _cap
            if cap is None or not cap.isOpened():
                time.sleep(0.05)
                continue
            ok, frame = cap.read()
            if not ok or frame is None:
                time.sleep(0.01)
                continue

            # dibujar marco centrado (rectángulo)
            h, w = frame.shape[:2]
            box_w = int(w * 0.6)
            box_h = int(h * 0.6)
            x1 = (w - box_w) // 2
            y1 = (h - box_h) // 2
            x2 = x1 + box_w
            y2 = y1 + box_h
            cv2.rectangle(frame, (x1, y1), (x2, y2), _overlay_color, _overlay_thickness)

            # entrenamiento activo: guardar ~2 fps
            if _training_active and _training_ref:
                # throttling a 2 fps
                now = time.time()
                # usar total como objetivo fijo (60) si arranca entreno
                if _train_total <= 0:
                    _train_total = 60
                # rate-limit por tiempo
                if (_train_sent + _train_failed) < _train_total:
                    # Guardar 1 cada ~0.5s
                    if (now - _runner.last_save) >= 0.5:
                        ok_save = _save_frame_for_ref(_training_ref, frame)
                        if ok_save:
                            _train_sent += 1
                        else:
                            _train_failed += 1
                        _runner.last_save = now
                else:
                    # alcanzamos total
                    _training_active = False

            # encode a JPEG para stream
            ok2, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if ok2:
                _last_jpeg = buf.tobytes()
            time.sleep(0.01)
    finally:
        pass


_runner.last_save = 0.0  # type: ignore[attr-defined]


def _open_camera_if_needed(index: int = 0):
    global _cap
    with _cap_lock:
        if _cap is None or not _cap.isOpened():
            _cap = cv2.VideoCapture(index)
            if not _cap.isOpened():
                _cap.release()
                raise HTTPException(status_code=500, detail="No se pudo abrir la cámara cv2")


def _start_runner_if_needed():
    global _runner_thread
    if _runner_thread is None or not _runner_thread.is_alive():
        _runner_stop.clear()
        _runner_thread = threading.Thread(target=_runner, daemon=True)
        _runner_thread.start()


@app.post("/cv/start")
def cv_start(ref: Optional[str] = None, train: int = 0, index: int = 0):
    """Abre la cámara cv2 y, opcionalmente, inicia modo entrenamiento.
    - ref: referencia para guardar imágenes (si no viene, solo stream)
    - train: 1 para activar entrenamiento (guardar), 0 solo stream
    - index: índice de cámara
    """
    global _training_ref, _training_active, _train_sent, _train_failed, _train_total, _train_start_ts
    _open_camera_if_needed(index=index)
    _start_runner_if_needed()
    if train:
        _training_ref = (ref or '').strip()
        if not _training_ref:
            raise HTTPException(status_code=400, detail="Falta ref para entrenar")
        _training_active = True
        _train_sent = 0
        _train_failed = 0
        _train_total = 60
        _train_start_ts = time.time()
        _runner.last_save = 0.0  # reset
    return {"running": True, "training": bool(train), "ref": _training_ref}


@app.post("/cv/stop")
def cv_stop():
    """Detiene entrenamiento y/o cierra cámara si nadie la usa."""
    global _training_active, _training_ref
    _training_active = False
    _training_ref = None
    # no cerramos cap para permitir stream persistente; si quieres cerrar forzado:
    return {"stopped": True}


@app.get("/cv/status")
def cv_status():
    running = False
    with _cap_lock:
        running = _cap.isOpened() if _cap is not None else False
    elapsed = int(time.time() - _train_start_ts) if _training_active else 0
    return {
        "running": running,
        "training": _training_active,
        "ref": _training_ref or "",
        "sent": _train_sent,
        "failed": _train_failed,
        "total": _train_total,
        "elapsed": elapsed,
    }


def _mjpeg_generator():
    boundary = b"--frame"
    while True:
        frame = _last_jpeg
        if frame is None:
            time.sleep(0.05)
            continue
        yield boundary + b"\r\n" + b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
        time.sleep(0.03)


@app.get("/cv/stream")
def cv_stream():
    # asegurar cámara/runner activos para servir frames
    try:
        _open_camera_if_needed()
        _start_runner_if_needed()
    except HTTPException:
        # si no hay cámara, retornar 503
        return Response(status_code=503)
    return StreamingResponse(_mjpeg_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/cv/snapshot")
def cv_snapshot():
    """Return the latest single JPEG frame from the live cv2 stream.
    Responds 503 if no frame is available yet.
    """
    # Ensure camera/runner are up so we can have frames
    try:
        _open_camera_if_needed()
        _start_runner_if_needed()
    except HTTPException:
        return Response(status_code=503)
    frame = _last_jpeg
    if frame is None:
        return Response(status_code=503)
    return Response(content=frame, media_type="image/jpeg")


@app.post("/recognize")
async def recognize(image: UploadFile = File(...)):
    data = await image.read()
    result: Optional[dict] = recognize_image(data)
    if result is None:
        raise HTTPException(status_code=404, detail="No match found")
    return JSONResponse(result)


@app.post("/match")
async def match(image: UploadFile = File(...), k: int = 3):
    """Return top-k visual matches for a given image.
    Response format: { items: [ { valve_id, name, confidence } ] }
    """
    data = await image.read()
    try:
        k = int(k)
    except Exception:
        k = 3
    items = recognize_topk(data, k=max(1, min(k, 10)))
    if not items:
        # keep 200 with empty list to allow clients to handle gracefully
        return JSONResponse({"items": []})
    return JSONResponse({"items": items})


@app.post("/scan_code")
async def scan_code(image: UploadFile = File(...)):
    """Decode QR/Barcode from uploaded image. Returns list of codes.
    Response format: {"codes": [{"type": str, "data": str}]}.
    On no codes found, returns 404 to mirror /recognize behavior.
    """
    data = await image.read()
    # Decode to cv2 image
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    # pyzbar works on grayscale or color
    try:
        results = zbar_decode(img)
    except Exception as e:
        # If zbar backend is missing at OS level, pyzbar will usually raise
        raise HTTPException(status_code=501, detail=f"QR/Barcode decoding not available: {e}")

    out: List[dict] = []
    for r in results:
        try:
            text = r.data.decode("utf-8", errors="ignore")
        except Exception:
            text = ""
        entry = {"type": str(r.type), "data": text}
        out.append(entry)
        try:
            if text:
                insert_scan(text, entry["type"])  # log scan in DB
        except Exception:
            # Do not fail request if logging fails
            pass

    if not out:
        raise HTTPException(status_code=404, detail="No code found")

    return JSONResponse({"codes": out})


@app.post("/train/upload")
async def train_upload(ref: str = Form(...), image: UploadFile = File(...)):
    """Upload a training frame for a given reference and store optimized JPEG under data/images/<ref>/.
    Returns: { saved: bool, ref: str, filename: str, size: int }
    """
    ref_raw = (ref or "").strip()
    if not ref_raw:
        raise HTTPException(status_code=400, detail="Missing ref")
    # sanitize ref to avoid path traversal and odd chars
    import re
    safe_ref = re.sub(r"[^A-Za-z0-9_-]", "-", ref_raw)
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image payload")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{ts}.jpg"
    dest_dir = Path(IMAGES_DIR) / safe_ref
    dest_path = dest_dir / filename
    try:
        saved = save_optimized_image_bytes(data, dest_path)
        size = saved.stat().st_size if saved.exists() else 0
        return JSONResponse({
            "saved": True,
            "ref": safe_ref,
            "filename": filename,
            "size": size,
            "path": f"/images/{safe_ref}/{filename}",
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save training image: {e}")


@app.post("/train/finalize")
def train_finalize():
    """Rebuild the visual index after a training session."""
    count = index_dataset()
    return {"indexed": count}


@app.post("/valves/upload_excel")
async def upload_excel(file: UploadFile = File(...)):
    """Upload an Excel file with valve data and store into SQLite.

    Expected columns (case-insensitive): Valvula, Cantidad, Ubicación, # de serie, Ficha tecnica, Simbolo
    Returns: { inserted: int }
    """
    try:
        data = await file.read()
        rows = parse_excel_to_rows(data)
        count = bulk_insert_valves(rows)
        return JSONResponse({"inserted": count})
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process Excel: {e}")


@app.get("/valves")
def list_valves():
    conn = get_connection()
    try:
        cur = conn.execute(
            "SELECT id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo FROM valves ORDER BY id ASC"
        )
        rows = [dict(r) for r in cur.fetchall()]
        return JSONResponse({"items": rows})
    finally:
        conn.close()


@app.get("/valves/{key}")
def get_valve(key: str):
    """Get valve by numeric id or by reference text.

    Accepts:
    - id numérico exacto (e.g., 12)
    - nombre exacto (e.g., "152865")
    - serie exacta (e.g., "152865")
    """
    conn = get_connection()
    try:
        row = None
        # 1) Si es número, intentar por id
        try:
            vid = int(key)
        except ValueError:
            vid = None
        if vid is not None:
            cur = conn.execute(
                "SELECT id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo FROM valves WHERE id = ?",
                (vid,),
            )
            row = cur.fetchone()

        # 2) Si no hubo match, intentar por nombre o serie
        if not row:
            cur = conn.execute(
                "SELECT id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo FROM valves WHERE valvula = ? OR numero_serie = ?",
                (key, key),
            )
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Valve not found")
        return JSONResponse(dict(row))
    finally:
        conn.close()
