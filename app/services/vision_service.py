"""
Visión por computadora (implementación ORB ligera para RPi):
 - index_dataset(): indexa `data/images/` (carpeta por válvula) extrayendo descriptores ORB
 - recognize_image(image_bytes): extrae descriptores y hace matching con BFMatcher + ratio test
 - Caché en disco para arranques rápidos en Raspberry Pi
"""
from __future__ import annotations

import io
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from app.config import (
    IMAGES_DIR,
    VISION_CACHE_DIR,
    VISION_MAX_WIDTH,
    VISION_ORB_FEATURES,
    VISION_RATIO_TEST,
    VISION_MIN_GOOD_MATCHES,
    VISION_SCORE_THRESHOLD,
)


# Estructura del índice en memoria
# {
#   class_id: {
#       'descs': [np.ndarray, ...],  # lista de descriptores por imagen
#       'images': [str, ...],        # rutas de imágenes indexadas
#   }, ...
# }
_INDEX: Dict[str, Dict[str, List]] = {}
_CACHE_FILE = VISION_CACHE_DIR / "vision_index.pkl"


def _ensure_cache_dir():
    VISION_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _resize_keep_aspect(img: np.ndarray, max_w: int) -> np.ndarray:
    h, w = img.shape[:2]
    if w <= max_w:
        return img
    scale = max_w / float(w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _extract_orb(img_bgr: np.ndarray) -> Tuple[List[cv2.KeyPoint], Optional[np.ndarray]]:
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = _resize_keep_aspect(gray, VISION_MAX_WIDTH)
    orb = cv2.ORB_create(nfeatures=VISION_ORB_FEATURES, fastThreshold=10)
    kps, desc = orb.detectAndCompute(gray, None)
    return kps, desc


def _load_cache() -> bool:
    global _INDEX
    try:
        if _CACHE_FILE.exists():
            with open(_CACHE_FILE, "rb") as f:
                data = pickle.load(f)
            # Convertir listas a np.ndarray si fuera necesario
            for cls, item in data.items():
                item["descs"] = [np.asarray(d, dtype=np.uint8) if d is not None else None for d in item.get("descs", [])]
            _INDEX = data
            return True
    except Exception:
        pass
    return False


def _save_cache():
    _ensure_cache_dir()
    data = {}
    for cls, item in _INDEX.items():
        # Convertir a listas para pickle más liviano
        serial_descs = [d if d is None else np.asarray(d, dtype=np.uint8) for d in item.get("descs", [])]
        data[cls] = {"descs": serial_descs, "images": item.get("images", [])}
    with open(_CACHE_FILE, "wb") as f:
        pickle.dump(data, f)


def index_dataset(index_only: bool = False) -> int:
    """
    Indexa imágenes en `data/images/<VALVULA_ID>/*.jpg|png`.
    - index_only=True: intenta cargar caché y reporta tamaño.
    Devuelve: número de clases indexadas.
    """
    global _INDEX

    if index_only:
        if not _INDEX:
            _load_cache()
        return len(_INDEX)

    _INDEX = {}
    if not IMAGES_DIR.exists():
        return 0

    # Recorre carpetas por clase
    for cls_dir in IMAGES_DIR.iterdir():
        if not cls_dir.is_dir():
            continue
        cls = cls_dir.name
        img_paths = [p for p in cls_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
        descs: List[np.ndarray] = []
        used_paths: List[str] = []
        for p in img_paths:
            try:
                data = np.fromfile(str(p), dtype=np.uint8)
                img = cv2.imdecode(data, cv2.IMREAD_COLOR)
                if img is None:
                    continue
                _, d = _extract_orb(img)
                if d is not None and len(d) > 0:
                    descs.append(d)
                    used_paths.append(str(p))
            except Exception:
                continue
        if descs:
            _INDEX[cls] = {"descs": descs, "images": used_paths}

    _save_cache()
    return len(_INDEX)


def _count_good_matches(q_desc: np.ndarray, t_desc: np.ndarray) -> int:
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
    try:
        matches = bf.knnMatch(q_desc, t_desc, k=2)
    except cv2.error:
        return 0
    good = 0
    for m_n in matches:
        if len(m_n) < 2:
            continue
        m, n = m_n
        if m.distance < VISION_RATIO_TEST * n.distance:
            good += 1
    return good


def recognize_image(image_bytes: bytes) -> Optional[dict]:
    """
    Reconoce una válvula a partir de bytes de imagen.
    Devuelve dict con {valve_id, name, confidence} o None si no hay match.
    """
    # Cargar índice en memoria si vacío
    if not _INDEX:
        _load_cache()
        if not _INDEX:
            # Intentar indexar en caliente si no hay caché
            index_dataset(index_only=False)
            if not _INDEX:
                return None

    # Decodificar imagen
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return None
    q_kp, q_desc = _extract_orb(img)
    if q_desc is None or len(q_desc) == 0:
        return None

    best_cls = None
    best_good = -1
    best_ratio = 0.0

    for cls, item in _INDEX.items():
        total_good = 0
        descs = item.get("descs", [])
        for d in descs:
            if d is None or len(d) == 0:
                continue
            total_good += _count_good_matches(q_desc, d)

        # Normalizar por cantidad de imágenes de la clase para evitar sesgos
        if descs:
            avg_good = total_good / float(len(descs))
        else:
            avg_good = 0.0

        ratio = avg_good / max(len(q_kp), 1)
        if avg_good > best_good or (avg_good == best_good and ratio > best_ratio):
            best_good = avg_good
            best_ratio = float(ratio)
            best_cls = cls

    if best_cls is None:
        return None

    # Criterios de aceptación
    if best_good < VISION_MIN_GOOD_MATCHES or best_ratio < VISION_SCORE_THRESHOLD:
        return None

    confidence = max(0.0, min(1.0, best_ratio))
    return {
        "valve_id": best_cls,
        "name": f"[No verificado] {best_cls}",
        "confidence": confidence,
    }
