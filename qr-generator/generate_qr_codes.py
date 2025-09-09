"""
Generate QR images for each reference number defined in index.json.

- Reads: web/STATIC/IMG/card-photos/index.json (key: "images")
- Extracts base names without extension as the QR payload (e.g., 152860)
- Writes: qr-generator/qr-images/<reference>.png

Usage:
  python -m qr_generator.generate_qr_codes
  or
  python qr-generator/generate_qr_codes.py

Requirements:
  - qrcode
  - Pillow
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import qrcode


ROOT = Path(__file__).resolve().parents[1]
INDEX_JSON = ROOT / "web" / "STATIC" / "IMG" / "card-photos" / "index.json"
OUTPUT_DIR = ROOT / "qr-generator" / "qr-images"


def load_references(index_path: Path) -> list[str]:
    """Load references from index.json, stripping image extensions.

    The file is expected to contain an object with key "images" listing filenames.
    """
    if not index_path.exists():
        raise FileNotFoundError(f"index.json not found at: {index_path}")

    with index_path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    images = data.get("images", [])
    refs: list[str] = []
    for name in images:
        # Accept strings like "152860.jpg" or any extension; take stem only
        p = Path(name)
        ref = p.stem.strip()
        if ref:
            refs.append(ref)
    # Deduplicate while preserving order
    seen = set()
    unique_refs = []
    for r in refs:
        if r not in seen:
            unique_refs.append(r)
            seen.add(r)
    return unique_refs


def make_qr(payload: str) -> qrcode.image.base.BaseImage:
    """Create a QR code image for the given payload."""
    qr = qrcode.QRCode(
        version=None,  # auto-fit
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return img


def generate_all(payload_format: str = "{id}"):
    """Generate all QR images using the provided payload format.

    payload_format supports the token {id} which is substituted by the reference.
    Examples:
      - "{id}" -> 152860
      - "valve:{id}" -> valve:152860
      - "https://example/valve/{id}" -> https://example/valve/152860
    """
    refs = load_references(INDEX_JSON)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    if not refs:
        print("No references found to generate.")
        return 0

    count = 0
    for ref in refs:
        payload = str(payload_format).replace("{id}", ref)
        img = make_qr(payload)
        out_path = OUTPUT_DIR / f"{ref}.png"
        img.save(out_path)
        count += 1
        print(f"Generated: {out_path.relative_to(ROOT)}  (payload=\"{payload}\")")

    print(f"Done. Generated {count} QR images in {OUTPUT_DIR.relative_to(ROOT)}")
    return count


def main(argv: list[str] | None = None) -> int:
    try:
        parser = argparse.ArgumentParser(description="Generate QR codes from index.json")
        parser.add_argument(
            "--payload-format",
            dest="payload_format",
            default="{id}",
            help="Format of QR payload. Use {id} placeholder, e.g., '{id}', 'valve:{id}', 'https://host/valve/{id}'",
        )
        args = parser.parse_args(argv)

        _ = generate_all(payload_format=args.payload_format)
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
