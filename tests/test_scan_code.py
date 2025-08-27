from io import BytesIO
from unittest.mock import patch
import numpy as np
from fastapi.testclient import TestClient

from app.vision_api.main import app

client = TestClient(app)

class FakeZBarResult:
    def __init__(self, data: bytes, typ: str = "QRCODE"):
        self.data = data
        self.type = typ

@patch("app.vision_api.main.cv2.imdecode")
@patch("app.vision_api.main.zbar_decode")
def test_scan_code_qr_success(mock_decode, mock_imdecode):
    mock_decode.return_value = [FakeZBarResult(b"A100", "QRCODE")]
    mock_imdecode.return_value = np.zeros((10,10,3), dtype=np.uint8)
    # tiny valid jpeg header to pass imdecode
    jpeg_bytes = b"\xff\xd8\xff\xd9"
    files = {"image": ("frame.jpg", BytesIO(jpeg_bytes), "image/jpeg")}
    r = client.post("/scan_code", files=files)
    assert r.status_code == 200
    data = r.json()
    assert "codes" in data and isinstance(data["codes"], list)
    assert data["codes"][0]["data"] == "A100"
    assert data["codes"][0]["type"] == "QRCODE"

@patch("app.vision_api.main.cv2.imdecode")
@patch("app.vision_api.main.zbar_decode")
def test_scan_code_barcode_success(mock_decode, mock_imdecode):
    mock_decode.return_value = [FakeZBarResult(b"B200", "CODE128")]
    mock_imdecode.return_value = np.zeros((10,10,3), dtype=np.uint8)
    jpeg_bytes = b"\xff\xd8\xff\xd9"
    files = {"image": ("frame.jpg", BytesIO(jpeg_bytes), "image/jpeg")}
    r = client.post("/scan_code", files=files)
    assert r.status_code == 200
    data = r.json()
    assert data["codes"][0]["data"] == "B200"
    assert data["codes"][0]["type"] == "CODE128"

@patch("app.vision_api.main.cv2.imdecode")
@patch("app.vision_api.main.zbar_decode")
def test_scan_code_not_found(mock_decode, mock_imdecode):
    mock_decode.return_value = []
    mock_imdecode.return_value = np.zeros((10,10,3), dtype=np.uint8)
    jpeg_bytes = b"\xff\xd8\xff\xd9"
    files = {"image": ("frame.jpg", BytesIO(jpeg_bytes), "image/jpeg")}
    r = client.post("/scan_code", files=files)
    assert r.status_code == 404
