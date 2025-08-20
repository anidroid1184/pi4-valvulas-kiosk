from typing import List
import sqlite3
from app.db.database import get_connection
from app.db.models import Valve


def search_by_text(query: str, limit: int = 50) -> List[Valve]:
    q = f"%{query.strip()}%"
    conn = get_connection()
    try:
        cur = conn.execute(
            "SELECT id, nombre, uso, ubicacion, qr_code, foto FROM valves WHERE nombre LIKE ? OR uso LIKE ? LIMIT ?",
            (q, q, limit),
        )
        return [Valve(**dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()


def search_by_qr(qr_value: str) -> List[Valve]:
    conn = get_connection()
    try:
        cur = conn.execute(
            "SELECT id, nombre, uso, ubicacion, qr_code, foto FROM valves WHERE qr_code = ?",
            (qr_value,),
        )
        return [Valve(**dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()
