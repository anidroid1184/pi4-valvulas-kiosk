# Novedades – Frontend (Web demo)

Registro de requerimientos del cliente, cambios y backlog para la demo web (filtros/imágenes/QR UI).

## Novedades (changelog)
- [2025-08-31] Chips de banco A/B/C/D siempre seleccionables; combinación con búsqueda de texto. Enriquecimiento por `id/ref` desde backend y soporte a `banks.json` local. Imágenes sin cambios.
- [2025-08-31] Mejoras de responsive y accesibilidad básica (chips con `aria-pressed`, navegación teclado en tarjetas).
 - [2025-09-06] Tarjetas horizontales en Imágenes: imagen grande a la izquierda y metadatos a la derecha (Cantidad, Ubicación con chips A/B/C/D, Número de serie).
 - [2025-09-06] Paleta aplicada (teal/naranja) y mejoras de contraste: tabs activos en naranja, hover naranja en tarjetas con subrayado completo, títulos con mayor contraste.
 - [2025-09-06] Sidebar fijo (sticky) y desplazable de forma independiente, con pista de scroll horizontal en móviles y paneo lateral del layout para no apilar columnas.
 - [2025-09-06] Limpieza del panel lateral: se elimina la sección “Ficha” (se conservan Válvula, Número de guía, Símbolo y Ficha técnica).
 - [2025-09-06] Imágenes en tarjetas ajustadas a `object-fit: contain` y centradas con fondo blanco para evitar recortes.

## Requerimientos del cliente
- Filtrado por bancos A/B/C/D combinado con búsqueda por texto.
- Mantener carga de imágenes estable (legacy index.json o backend), sin romper rutas.
- UI clara, rápida, y usable en pantalla táctil.
- Opción para “Cambiar imagen” (pendiente del usuario) y recordatorio activo.

## Backlog UI
### Hecho (2025-09-06)
- [x] Tarjetas horizontales con imagen grande y metadatos (Cantidad, Ubicación, Número de serie).
- [x] Paleta y contrastes: tabs activos en naranja, hover naranja de tarjetas con subrayado completo.
- [x] Sidebar sticky con scroll independiente y pistas de scroll horizontal en móviles.
- [x] Eliminar sección “Ficha” del sidebar.
- [x] Ajuste visual de imágenes en tarjetas (`object-fit: contain`, fondo blanco).

### Pendiente
- [ ] Botón “Limpiar filtros” que reinicie búsqueda y chips.
- [ ] Accesibilidad: focus visible unificado en chips/tabs/inputs y ARIA consistente.
- [ ] Mensajes de estado más claros (sin resultados, error de backend, etc.).
- [ ] Indicador visual cuando el filtro de bancos no aplica por falta de datos.
- [ ] Integración con AI: si QR falla, sugerir coincidencias (top-k) del módulo de visión.

## Pendientes del usuario
- [ ] Cambiar imagen (pendiente). Recordatorio activo hasta completar.

## Notas técnicas
- Código principal: `web/js/app.js` (funciones: `applyFilters`, `setupBankFilters`, `normalizeCardPhotoUrl`, etc.).
- Imágenes: `web/STATIC/IMG/card-photos/` con `index.json` legacy; opcional `banks.json` para bancos locales.
- Backend previsto: `http://localhost:8000` (`/valves`, `/valves/{id}`) solo para enriquecimiento.
