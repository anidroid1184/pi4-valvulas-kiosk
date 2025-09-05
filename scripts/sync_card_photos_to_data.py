import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARD_PHOTOS_DIR = ROOT / 'web' / 'STATIC' / 'IMG' / 'card-photos'
BACKEND_IMAGES_DIR = ROOT / 'data' / 'images'

VALID_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def load_index_json(folder: Path) -> set[str]:
    idx = folder / 'index.json'
    refs: set[str] = set()
    if not idx.exists():
        return refs
    try:
        data = json.loads(idx.read_text(encoding='utf-8'))
        # soportar tanto { images: ["152860.jpg", ...] } como { "152860": ["img1.jpg", ...] }
        if isinstance(data, dict) and 'images' in data and isinstance(data['images'], list):
            for item in data['images']:
                if isinstance(item, str):
                    ref = Path(item).stem
                    refs.add(ref)
        elif isinstance(data, dict):
            for ref, files in data.items():
                if not isinstance(ref, str):
                    continue
                refs.add(ref)
    except Exception:
        pass
    return refs


def discover_card_photos(folder: Path) -> dict[str, list[Path]]:
    """
    Descubre imágenes en card-photos.
    - Si existen archivos <ref>.<ext> (p. ej. 152860.jpg), los asigna a esa ref.
    - Ignora archivos no gráficos o PDFs.
    - Usa index.json si existe, para incluir refs aunque no haya archivos simples <ref>.<ext>.
    """
    mapping: dict[str, list[Path]] = {}
    folder.mkdir(parents=True, exist_ok=True)

    # 1) Basado en nombres de archivo <ref>.<ext>
    for p in folder.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in VALID_EXTS:
            continue
        ref = p.stem
        mapping.setdefault(ref, []).append(p)

    # 2) Ampliar con index.json (si hubiera refs sin archivos <ref>.<ext>)
    indexed_refs = load_index_json(folder)
    for ref in indexed_refs:
        mapping.setdefault(ref, [])

    return mapping


def sync_to_backend(card_map: dict[str, list[Path]], dest_root: Path) -> tuple[int, int]:
    """Copia imágenes de card-photos a data/images/<ref>/.
    Devuelve (carpetas_afectadas, archivos_copiados).
    No borra nada del destino; solo agrega.
    """
    dest_root.mkdir(parents=True, exist_ok=True)
    folders = 0
    files = 0
    for ref, paths in sorted(card_map.items()):
        dest_dir = dest_root / ref
        dest_dir.mkdir(parents=True, exist_ok=True)
        folders += 1
        for src in paths:
            dest = dest_dir / src.name
            try:
                # Si ya existe, no duplicar
                if dest.exists():
                    continue
                shutil.copy2(src, dest)
                files += 1
            except Exception as e:
                print(f"[WARN] No se pudo copiar {src} -> {dest}: {e}")
    return folders, files


def main():
    print(f"[SYNC] Origen (card-photos): {CARD_PHOTOS_DIR}")
    print(f"[SYNC] Destino (data/images): {BACKEND_IMAGES_DIR}")
    card_map = discover_card_photos(CARD_PHOTOS_DIR)
    if not card_map:
        print("[SYNC] No se encontraron imágenes en card-photos. Nada que sincronizar.")
        return
    folders, files = sync_to_backend(card_map, BACKEND_IMAGES_DIR)
    print(f"[SYNC] Carpetas afectadas: {folders}")
    print(f"[SYNC] Archivos copiados: {files}")
    print("[SYNC] Listo. Ahora ejecute el reindexado del backend (POST /index).")


if __name__ == '__main__':
    main()
