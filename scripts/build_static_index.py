import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_STATIC_IMG = ROOT / 'web' / 'STATIC' / 'IMG'
INDEX_JSON = WEB_STATIC_IMG / 'index.json'

VALID_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
PORTADA_KEYS = ("cover", "portada")


def list_images(folder: Path) -> list[str]:
    files = [p.name for p in folder.iterdir() if p.is_file() and p.suffix.lower() in VALID_EXTS]
    files.sort(key=lambda x: x.lower())
    # portada primero si existe
    portada = [f for f in files if any(k in f.lower() for k in PORTADA_KEYS)]
    others = [f for f in files if f not in portada]
    return portada + others


def main():
    WEB_STATIC_IMG.mkdir(parents=True, exist_ok=True)

    mapping: dict[str, list[str]] = {}
    for sub in sorted(WEB_STATIC_IMG.iterdir()):
        if not sub.is_dir():
            continue
        ref = sub.name.strip()
        imgs = list_images(sub)
        if imgs:
            mapping[ref] = imgs

    try:
        with INDEX_JSON.open('w', encoding='utf-8') as f:
            json.dump(mapping, f, ensure_ascii=False, indent=2)
        print(f"Generado {INDEX_JSON} con {len(mapping)} referencias.")
    except Exception as e:
        print(f"Error escribiendo {INDEX_JSON}: {e}")
        return


if __name__ == '__main__':
    main()
