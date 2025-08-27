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
from app.db.database import init_db, insert_scan

from app.services.vision_service import index_dataset, recognize_image

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
