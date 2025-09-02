# Novedades – AI (Visión Offline)

Este documento registra avances, decisiones y roadmap del módulo de AI para identificación de válvulas en Raspberry Pi 4B.

## Novedades (changelog)
- [2025-08-31] Se define roadmap inicial, criterios de aceptación y arquitectura base (extractor + índice). Se planifica servicio offline `app/vision_api` con endpoint `/match`.

## Roadmap
- [ ] Definir arquitectura del módulo de AI (visión offline en RPi4, extracción de features + índice).
- [ ] Preparar dataset de referencia (hasta 80 válvulas): curar imágenes (<500KB), partición train/val/test.
- [ ] Implementar extractor de descriptores (SIFT/ORB con OpenCV; evaluar TFLite MobileNet-Embeddings).
- [ ] Construir índice de similitud (FLANN/Brute-Force para ORB; Annoy/FAISS si aplica offline).
- [ ] Servicio Python offline `app/vision_api`: endpoint `/match` con top-k válvulas.
- [ ] Integración UI: Cámara (Tkinter) -> si QR falla -> AI match -> detalle.
- [ ] Optimización RPi: resize/cuanti., threading, caché de índice.
- [ ] Pruebas unitarias: extractor, matcher, normalización de imágenes.
- [ ] Pruebas integración: cámara -> AI -> DB -> UI detalle (<2s).
- [ ] Métricas: precisión@1/@3, latencia P95 < 2s, RAM.
- [ ] Documentación técnica y manual de usuario (modo AI y fallbacks).

## Arquitectura propuesta
1. Captura/Entrada: imagen desde cámara o galería.
2. Preprocesado: resize fijo (p.ej., 640px), normalización color, recorte centrado.
3. Extracción de características:
   - Opción A: ORB (rápido, robusto, sin licencia restrictiva).
   - Opción B: Embeddings CNN (MobileNet/TFLite) si cabe en latencia.
4. Indexación y búsqueda:
   - ORB -> FLANN/Brute-Force Hamming.
   - Embeddings -> índice aproximado (Annoy). Todo offline.
5. Post-procesado: verificación geométrica (RANSAC) o score threshold.
6. Integración: devolver top-k con `id/ref` para enlazar a DB y UI.

## Criterios de aceptación
- Latencia de consulta: < 2s P95 en RPi4B.
- Precisión@1 >= 80% con dataset validado por cliente (hasta 80 válvulas).
- Memoria dentro de límites del dispositivo (4GB) y sin fugas.
- Operación 100% offline.

## Notas de implementación
- Guardar índice en `data/.cache/vision_index.pkl` (ya existe ruta).
- Scripts de construcción del índice en `scripts/build_static_index.py`.
- Alinear IDs del índice con `id/ref` de la DB e imágenes para trazabilidad.

## Pendientes del usuario
- [ ] Cambiar imagen (pendiente). Recordatorio activo hasta completar.
