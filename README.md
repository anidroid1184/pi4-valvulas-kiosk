# Valve Finder (Raspberry Pi 4)

Aplicación Tkinter en modo kiosko para buscar válvulas por QR o manualmente. Offline, con SQLite.

## Estructura

- `app/`: código fuente (UI, servicios, DB)
- `data/`: base de datos e imágenes
- `scripts/`: utilidades CLI (inicializar DB, cargar CSV)
- `tests/`: pruebas unitarias

## Requisitos

- Python 3.11 (o el disponible en Raspberry Pi OS)
- Paquetes: `pip install -r requirements.txt`
- En Raspberry Pi, asegúrate de tener `zbar` instalado para `pyzbar`.
  - `sudo apt-get install libzbar0`

## Uso rápido (desarrollo)

1. Inicializa la base de datos:
   ```bash
   python -m scripts.init_db
   ```
2. Carga el CSV de prueba:
   ```bash
   python -m scripts.load_csv
   ```
3. Ejecuta la app:
   ```bash
   python -m app.main
   ```

## Próximos pasos
- Implementar pantallas: lista y detalle.
- Integrar escaneo QR real (`pyzbar/opencv`).
- Compresión de imágenes al importar.
- Modo kiosko (auto-start) en Raspberry Pi.

## Documentación
- Novedades AI (visión offline): `docs/AI_Novedades.md`
- Novedades Frontend (demo web): `docs/FRONTEND_Novedades.md`
