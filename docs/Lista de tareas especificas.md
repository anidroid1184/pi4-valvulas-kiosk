# Lista de Tareas Provisionales (Desarrollador)

## 🔹 Base de datos y backend
- [X] Definir esquema de **SQLite/CSV** para las 80 válvulas:
  - `id, nombre, uso, ubicación, qr_code, foto`
- [X] Implementar script de carga desde CSV a SQLite.
- [X] Crear funciones CRUD (C y R).
- [X] Implementar compresión de imágenes antes de guardar.

## 🔹 Lógica de búsqueda
- [X] Implementar búsqueda por nombre/uso en SQLite.
- [X] Implementar búsqueda por QR (dummy con string).
- [X] Pruebas unitarias con dataset ficticio (5 válvulas).

## 🔹 Prototipo de interfaz (dummy)
- [ ] Crear prototipo con Tkinter:
  - Ventana principal.
  - Lista de válvulas con scroll.
  - Vista detalle con foto y datos.
- [ ] Implementar navegación básica entre pantallas.
- [ ] Implementar carga de dataset desde CSV.

## 🔹 Escaneo QR (simulación)
- [X] Implementar módulo con `pyzbar`/`opencv`.
- [X] Usar imágenes QR de prueba.
- [X] Validar que devuelva el ID y consulte la DB.

---

## 🔹 AI (Visión por computadora)
- [X] Servicio ORB básico en `app/services/vision_service.py` con caché en disco.
- [X] Endpoint FastAPI `POST /match` (top‑k) y `POST /recognize` (1‑best) en `app/vision_api/main.py`.
- [ ] Pruebas unitarias de `recognize_topk()` con imágenes controladas (2–3 clases).
- [ ] Calibración de umbrales `VISION_MIN_GOOD_MATCHES` y `VISION_SCORE_THRESHOLD` en `app/config.py` (objetivo <2s RPi).
- [ ] Script/cron de indexado al arranque (`scripts/run_vision_api.py` o `scripts/build_static_index.py` + `/index`).
- [ ] Integración UI: subir imagen a `/match`, mostrar top‑k y abrir detalle.
- [ ] Fallback UI: si QR no reconoce, llamar `/match` automáticamente.
- [ ] Reporte de métricas (latencia, precisión@k) para pruebas de aceptación.
