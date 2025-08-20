from app.services.qr_service import decode_qr_from_image

def test_qr_stub_returns_none():
    assert decode_qr_from_image("any.png") is None
