import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_SYMBOLS = ROOT / 'web' / 'STATIC' / 'IMG' / 'simbology'
INDEX_JSON = WEB_SYMBOLS / 'index.json'

VALID_EXTS = {'.png', '.jpg', '.jpeg', '.webp', '.svg'}


def build_index() -> list[str]:
    if not WEB_SYMBOLS.exists():
        print(f"[build_symbols_index] Carpeta no encontrada: {WEB_SYMBOLS}")
        return []

    files = [p.name for p in WEB_SYMBOLS.iterdir() if p.is_file() and p.suffix.lower() in VALID_EXTS]
    files.sort(key=str.lower)
    return files


def main() -> None:
    files = build_index()
    WEB_SYMBOLS.mkdir(parents=True, exist_ok=True)
    INDEX_JSON.write_text(json.dumps(files, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[build_symbols_index] Escrito {INDEX_JSON} con {len(files)} símbolos")


if __name__ == '__main__':
    main()
