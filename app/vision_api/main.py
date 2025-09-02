from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

import numpy as np
import cv2
from pyzbar.pyzbar import decode as zbar_decode
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import IMAGES_DIR
from app.db.database import init_db, insert_scan, bulk_insert_valves, get_connection
from app.services.excel_service import parse_excel_to_rows

from app.services.vision_service import index_dataset, recognize_image, recognize_topk

app = FastAPI(title="Valve Vision API", version="0.1.0")

# CORS para desarrollo local (landing en otro puerto)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # si quieres restringir: ["http://localhost", "http://127.0.0.1"]
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
