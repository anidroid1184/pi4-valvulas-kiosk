import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_IMAGES = ROOT / 'data' / 'images'
WEB_STATIC_IMG = ROOT / 'web' / 'STATIC' / 'IMG'
INDEX_JSON = WEB_STATIC_IMG / 'index.json'

VALID_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def pick_image_in_folder(folder: Path) -> Path | None:
    """Return one representative image path in the folder, preferring common formats."""
    if not folder.is_dir():
        return None
    # prefer by extension order
    candidates = sorted([p for p in folder.iterdir() if p.suffix.lower() in VALID_EXTS])
    return candidates[0] if candidates else None


def main():
    WEB_STATIC_IMG.mkdir(parents=True, exist_ok=True)

    if not DATA_IMAGES.exists():
        print(f"No existe {DATA_IMAGES}. Nada que hacer.")
        return

    copied = []
    for sub in sorted(DATA_IMAGES.iterdir()):
        if not sub.is_dir():
            continue
        valve_id = sub.name.strip()
        img = pick_image_in_folder(sub)
        if not img:
            continue
        # keep original extension
        out_name = f"{valve_id}{img.suffix.lower()}"
        out_path = WEB_STATIC_IMG / out_name
        try:
            shutil.copyfile(img, out_path)
            copied.append(out_name)
        except Exception as e:
            print(f"Error copiando {img} -> {out_path}: {e}")
            continue

    payload = {"images": copied}
    try:
        with INDEX_JSON.open('w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error escribiendo {INDEX_JSON}: {e}")
        return

    print(f"Listo. Copiadas {len(copied)} imágenes de muestra y creado {INDEX_JSON}.")


if __name__ == '__main__':
    main()
