import sqlite3
from pathlib import Path
from typing import Iterable, Optional
from app.config import DB_PATH

SCHEMA_SQL = (
    """
    CREATE TABLE IF NOT EXISTS valves (
        id INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL,
        uso TEXT,
        ubicacion TEXT,
        qr_code TEXT UNIQUE,
        foto TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_valves_nombre ON valves(nombre);
    CREATE INDEX IF NOT EXISTS idx_valves_qr ON valves(qr_code);

    CREATE TABLE IF NOT EXISTS scans (
        scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_text TEXT NOT NULL,
        code_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scans_code ON scans(code_text);
    """
)


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path else Path(DB_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: Optional[sqlite3.Connection] = None) -> None:
    close_after = False
    if conn is None:
        conn = get_connection()
        close_after = True
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        if close_after:
            conn.close()


def bulk_insert_valves(rows: Iterable[tuple]) -> int:
    conn = get_connection()
    try:
        cur = conn.executemany(
            "INSERT OR REPLACE INTO valves (id, nombre, uso, ubicacion, qr_code, foto) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        return cur.rowcount or 0
    finally:
        conn.close()


def insert_scan(code_text: str, code_type: str) -> int:
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO scans (code_text, code_type) VALUES (?, ?)",
            (code_text, code_type),
        )
        conn.commit()
        return cur.lastrowid or 0
    finally:
        conn.close()
