# Novedades – Frontend (Web demo)

Registro de requerimientos del cliente, cambios y backlog para la demo web (filtros/imágenes/QR UI).

## Novedades (changelog)
- [2025-08-31] Chips de banco A/B/C/D siempre seleccionables; combinación con búsqueda de texto. Enriquecimiento por `id/ref` desde backend y soporte a `banks.json` local. Imágenes sin cambios.
- [2025-08-31] Mejoras de responsive y accesibilidad básica (chips con `aria-pressed`, navegación teclado en tarjetas).

## Requerimientos del cliente
- Filtrado por bancos A/B/C/D combinado con búsqueda por texto.
- Mantener carga de imágenes estable (legacy index.json o backend), sin romper rutas.
- UI clara, rápida, y usable en pantalla táctil.
- Opción para “Cambiar imagen” (pendiente del usuario) y recordatorio activo.

## Backlog UI
- [ ] Botón “Limpiar filtros” que reinicie búsqueda y chips.
- [ ] Accesibilidad: focus visible en chips y tarjetas, roles ARIA consistentes.
- [ ] Mensajes de estado más claros (sin resultados, error de backend, etc.).
- [ ] Indicador visual cuando el filtro de bancos no aplica por falta de datos.
- [ ] Integración con AI: si QR falla, sugerir coincidencias (top-k) del módulo de visión.

## Pendientes del usuario
- [ ] Cambiar imagen (pendiente). Recordatorio activo hasta completar.

## Notas técnicas
- Código principal: `web/js/app.js` (funciones: `applyFilters`, `setupBankFilters`, `normalizeCardPhotoUrl`, etc.).
- Imágenes: `web/STATIC/IMG/card-photos/` con `index.json` legacy; opcional `banks.json` para bancos locales.
- Backend previsto: `http://localhost:8000` (`/valves`, `/valves/{id}`) solo para enriquecimiento.
