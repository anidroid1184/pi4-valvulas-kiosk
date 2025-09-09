from typing import List
import sqlite3
from app.db.database import get_connection
from app.db.models import Valve


def search_by_text(query: str, limit: int = 50) -> List[Valve]:
    """Search valves by text across valvula, ubicacion and numero_serie."""
    q = f"%{query.strip()}%"
    conn = get_connection()
    try:
        cur = conn.execute(
            (
                "SELECT id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo "
                "FROM valves WHERE valvula LIKE ? OR ubicacion LIKE ? OR numero_serie LIKE ? LIMIT ?"
            ),
            (q, q, q, limit),
        )
        return [Valve(**dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()


def search_by_qr(qr_value: str) -> List[Valve]:
    """Deprecated: kept for compatibility. Now matches against numero_serie."""
    conn = get_connection()
    try:
        cur = conn.execute(
            (
                "SELECT id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo "
                "FROM valves WHERE numero_serie = ?"
            ),
            (qr_value,),
        )
        return [Valve(**dict(row)) for row in cur.fetchall()]
    finally:
        conn.close()
