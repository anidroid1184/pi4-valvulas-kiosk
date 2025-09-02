from pathlib import Path
from typing import Optional
from PIL import Image
from io import BytesIO
from app.config import MAX_IMAGE_SIZE_KB, VISION_MAX_WIDTH


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
    """Save an uploaded image (bytes) as optimized JPEG to dest_path.

    - Resizes maintaining aspect ratio if width > max_width.
    - Saves as JPEG, iteratively reducing quality until under MAX_IMAGE_SIZE_KB.
    """
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(BytesIO(image_bytes))
    img = img.convert("RGB")
    # Resize if needed
    w, h = img.size
    if max_width and w > max_width:
        ratio = max_width / float(w)
        new_size = (max_width, max(1, int(h * ratio)))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    # Save with iterative compression
    q = int(initial_quality)
    q = min(max(q, 40), 95)
    tmp = BytesIO()
    img.save(tmp, format="JPEG", quality=q, optimize=True)
    while len(tmp.getvalue()) > MAX_IMAGE_SIZE_KB * 1024 and q > 40:
        q -= 5
        tmp = BytesIO()
        img.save(tmp, format="JPEG", quality=q, optimize=True)

    with dest_path.open('wb') as f:
        f.write(tmp.getvalue())
    return dest_path
