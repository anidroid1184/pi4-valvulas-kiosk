import sqlite3
from pathlib import Path
from typing import Iterable, Optional
from app.config import DB_PATH

SCHEMA_SQL = (
    """
    -- Target schema for valves
    CREATE TABLE IF NOT EXISTS valves (
        id INTEGER PRIMARY KEY,
        valvula TEXT NOT NULL,
        cantidad INTEGER,
        ubicacion TEXT,
        numero_serie TEXT,
        ficha_tecnica TEXT,
        simbolo TEXT
    );

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
        _run_migrations(conn)
        _ensure_indexes(conn)
        conn.commit()
    finally:
        if close_after:
            conn.close()


def _run_migrations(conn: sqlite3.Connection) -> None:
    """Migrate older schemas to the final compact schema.

    Final columns: id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo
    Supports previous layouts that used: nombre, serie, uso, qr_code, foto.
    """
    cur = conn.execute("PRAGMA table_info(valves)")
    cols = {r[1] for r in cur.fetchall()}

    if not cols:
        # Table didn't exist; SCHEMA_SQL already created it in target shape.
        return

    if 'valvula' in cols and 'numero_serie' in cols and 'uso' not in cols and 'qr_code' not in cols and 'foto' not in cols:
        # Already in target shape
        return

    # Create a new table with target schema and copy data mapping old -> new
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS valves_new (
            id INTEGER PRIMARY KEY,
            valvula TEXT NOT NULL,
            cantidad INTEGER,
            ubicacion TEXT,
            numero_serie TEXT,
            ficha_tecnica TEXT,
            simbolo TEXT
        );
        """
    )

    # Build insert-select mapping depending on existing cols
    has = cols
    sel_valvula = "nombre" if 'nombre' in has else "valvula"
    sel_cantidad = "cantidad" if 'cantidad' in has else "NULL"
    sel_ubicacion = "ubicacion" if 'ubicacion' in has else "NULL"
    sel_numero_serie = "serie" if 'serie' in has else ("numero_serie" if 'numero_serie' in has else "NULL")
    sel_ficha = "ficha_tecnica" if 'ficha_tecnica' in has else "NULL"
    sel_simbolo = "simbolo" if 'simbolo' in has else "NULL"

    conn.execute(
        f"""
        INSERT INTO valves_new (id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo)
        SELECT id, COALESCE({sel_valvula}, ''), {sel_cantidad}, {sel_ubicacion}, {sel_numero_serie}, {sel_ficha}, {sel_simbolo}
        FROM valves
        """
    )

    conn.execute("DROP TABLE valves")
    conn.execute("ALTER TABLE valves_new RENAME TO valves")


def _ensure_indexes(conn: sqlite3.Connection) -> None:
    """Create indexes that depend on optional columns if they exist."""
    cur = conn.execute("PRAGMA table_info(valves)")
    cols = {r[1] for r in cur.fetchall()}
    if 'valvula' in cols:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_valves_valvula ON valves(valvula)")
    if 'numero_serie' in cols:
        conn.execute("CREATE INDEX IF NOT EXISTS idx_valves_numero_serie ON valves(numero_serie)")


def bulk_insert_valves(rows: Iterable[tuple]) -> int:
    conn = get_connection()
    try:
        cur = conn.executemany(
            """
            INSERT OR REPLACE INTO valves
            (id, valvula, cantidad, ubicacion, numero_serie, ficha_tecnica, simbolo)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
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
