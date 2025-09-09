from typing import Optional

# Placeholder for QR scanning logic. On Raspberry Pi use pyzbar or OpenCV.
# For now, provide a stub that can decode from a known string or image path later.

def decode_qr_from_image(image_path: str) -> Optional[str]:
    """Stub: return None to indicate no decoding implemented yet."""
    return None

def decode_codes_from_image(image_path: str):
    """
    Decode QR codes and barcodes (EAN-13, Code128, Code39, etc.) from an image path.
    Returns a list of { 'type': symbology, 'data': decoded_text }.

    Notes:
    - Uses pyzbar, which relies on zbar (ensure libzbar is installed on Raspberry Pi OS).
    - Non-throwing: returns [] on failure.
    """
    try:
        from PIL import Image
        from pyzbar.pyzbar import decode
        img = Image.open(image_path)
        results = decode(img)
        out = []
        for r in results:
            try:
                data = r.data.decode('utf-8', errors='ignore')
            except Exception:
                data = ''
            out.append({
                'type': getattr(r, 'type', 'UNKNOWN'),
                'data': data
            })
        return out
    except Exception:
        return []
