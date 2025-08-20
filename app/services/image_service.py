from pathlib import Path
from typing import Optional
from PIL import Image
from app.config import MAX_IMAGE_SIZE_KB


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
