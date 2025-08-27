import os
from pathlib import Path
from fastapi.testclient import TestClient

from app.vision_api.main import app
from app.config import IMAGES_DIR

client = TestClient(app)

def setup_module(module):
    # create temporary structure under data/images/
    base = Path(IMAGES_DIR)
    (base / "A100").mkdir(parents=True, exist_ok=True)
    (base / "A100" / "img1.jpg").write_bytes(b"fakejpg")
    (base / "B200").mkdir(parents=True, exist_ok=True)
    (base / "B200" / "img2.png").write_bytes(b"fakepng")

def teardown_module(module):
    # cleanup test files
    base = Path(IMAGES_DIR)
    for child in base.glob("**/*"):
        try:
            if child.is_file():
                child.unlink()
        except Exception:
            pass
    for child in sorted(base.glob("**/*"), reverse=True):
        try:
            if child.is_dir():
                child.rmdir()
        except Exception:
            pass

def test_images_index_lists_one_per_folder():
    r = client.get("/images_index")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and isinstance(data["items"], list)
    ids = {it["id"] for it in data["items"]}
    assert {"A100", "B200"}.issubset(ids)
    # image path should start with /images/
    for it in data["items"]:
        assert it["image"].startswith("/images/")
        assert it["count"] >= 1
