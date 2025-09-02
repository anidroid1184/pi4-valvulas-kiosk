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
