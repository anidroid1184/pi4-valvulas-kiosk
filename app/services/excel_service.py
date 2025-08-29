from __future__ import annotations
from io import BytesIO
from typing import Iterable, List, Tuple

import pandas as pd

REQUIRED_COLUMNS = ["id", "nombre", "uso", "ubicacion", "qr_code", "foto"]


def parse_excel_to_rows(data: bytes) -> List[Tuple]:
    """Parse Excel bytes and return list of tuples matching DB schema.

    Expected columns (case-insensitive accepted):
      - id, nombre, uso, ubicacion, qr_code, foto

    Returns list of tuples: (id:int, nombre:str, uso:str, ubicacion:str, qr_code:str, foto:str)
    """
    bio = BytesIO(data)
    # Let pandas pick engine; requires openpyxl installed
    df = pd.read_excel(bio, dtype=str)

    # Normalize columns to lowercase without spaces
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Validate required columns exist
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Excel missing required columns: {', '.join(missing)}")

    # Keep only required and ensure order
    df = df[REQUIRED_COLUMNS].copy()

    # Clean values and cast id to int where possible
    def norm(s):
        if pd.isna(s):
            return ""
        return str(s).strip()

    df = df.applymap(norm)

    # id must be integer; try to cast safely
    def to_int(x: str) -> int:
        try:
            return int(float(x)) if x else 0
        except Exception:
            raise ValueError(f"Invalid id value: {x}")

    rows: List[Tuple] = []
    for _, r in df.iterrows():
        id_val = to_int(r["id"])  # raises if invalid
        nombre = r["nombre"]
        uso = r["uso"]
        ubicacion = r["ubicacion"]
        qr_code = r["qr_code"]
        foto = r["foto"]
        rows.append((id_val, nombre, uso, ubicacion, qr_code, foto))

    return rows
