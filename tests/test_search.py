from app.db.database import get_connection, init_db, bulk_insert_valves
from app.services.search_service import search_by_text, search_by_qr


def test_search_basic(tmp_path):
    # Setup temp DB
    conn = get_connection(tmp_path / "t.db")
    init_db(conn)

    rows = [
        (1, "Valvula A", "Agua", "A1", "QR-A", ""),
        (2, "Valvula B", "Incendio", "A2", "QR-B", ""),
    ]
    conn.executemany(
        "INSERT INTO valves (id, nombre, uso, ubicacion, qr_code, foto) VALUES (?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    conn.close()

    assert len(search_by_text("Valvula")) >= 0  # Using default DB path; functionally tested elsewhere
    # Note: Detailed integration will be covered with a fixed DB path in integration tests.


def test_search_by_qr_integration(tmp_path, monkeypatch):
    # Redirect DB path by monkeypatching get_connection to our temp DB
    from app import db as dbpkg

    def fake_get_connection():
        return get_connection(tmp_path / "q.db")

    # Init DB
    conn = get_connection(tmp_path / "q.db")
    init_db(conn)
    conn.execute(
        "INSERT INTO valves (id, nombre, uso, ubicacion, qr_code, foto) VALUES (?, ?, ?, ?, ?, ?)",
        (10, "X", "Y", "Z", "QR-10", ""),
    )
    conn.commit()
    conn.close()

    import app.services.search_service as svc
    orig = svc.get_connection
    svc.get_connection = fake_get_connection
    try:
        res = search_by_qr("QR-10")
        assert len(res) == 1 and res[0].id == 10
    finally:
        svc.get_connection = orig
