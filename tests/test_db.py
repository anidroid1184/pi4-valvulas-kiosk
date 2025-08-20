from app.db.database import get_connection, init_db

def test_init_db(tmp_path):
    db_file = tmp_path / "test.db"
    conn = get_connection(db_file)
    init_db(conn)
    cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='valves'")
    assert cur.fetchone() is not None
    conn.close()
