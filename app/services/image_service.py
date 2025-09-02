from pathlib import Path
from typing import Optional
from PIL import Image
from io import BytesIO
from app.config import MAX_IMAGE_SIZE_KB, VISION_MAX_WIDTH
import numpy as np
import cv2


def compress_image(input_path: Path, output_path: Optional[Path] = None, quality: int = 85) -> Path:
    output = output_path or input_path
    output.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(input_path) as img:
        img_rgb = img.convert("RGB")
        img_rgb.save(output, format="JPEG", quality=quality, optimize=True)

    # Ensure size under target by reducing quality iteratively (basic loop)
    q = quality
    while output.stat().st_size > MAX_IMAGE_SIZE_KB * 1024 and q > 40:
        q -= 5
        with Image.open(input_path) as img:
            img_rgb = img.convert("RGB")
            img_rgb.save(output, format="JPEG", quality=q, optimize=True)
    return output


def save_optimized_image_bytes(image_bytes: bytes, dest_path: Path, *, max_width: int = VISION_MAX_WIDTH,
                               initial_quality: int = 85) -> Path:
    """Save uploaded image bytes as optimized JPEG using OpenCV.

    Steps:
    - Decode with cv2.imdecode
    - Resize keeping aspect ratio if width > max_width
    - JPEG-encode with iterative quality reduction until under MAX_IMAGE_SIZE_KB
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        # Fallback via PIL if decode fails
        pil_img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]
    if max_width and w > max_width:
        scale = max_width / float(w)
        new_w = max_width
        new_h = max(1, int(h * scale))
        img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)

    q = int(initial_quality)
    q = min(max(q, 40), 95)
    encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), q]
    success, buf = cv2.imencode('.jpg', img, encode_params)
    if not success:
        raise RuntimeError("Failed to encode JPEG")
    # Iteratively reduce quality to fit size
    while buf.size > MAX_IMAGE_SIZE_KB * 1024 and q > 40:
        q -= 5
        encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), q]
        success, buf = cv2.imencode('.jpg', img, encode_params)
        if not success:
            raise RuntimeError("Failed to encode JPEG during iteration")

    with dest_path.open('wb') as f:
        f.write(buf.tobytes())
    return dest_path
