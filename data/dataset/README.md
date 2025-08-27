# Dataset etiquetado para reconocimiento por imágenes

Estructura propuesta (una carpeta por clase/válvula):

```
data/dataset/
  VALVULA_001/
    img_001.jpg
    img_002.jpg
  VALVULA_002/
    2024-05-01-obra-A.jpg
    2024-05-01-obra-B.jpg
  ...
```

Reglas:
- El nombre de la carpeta es la etiqueta/clase. Idealmente coincide con `valve_id` en la base de datos (ej.: `V-012`).
- Imágenes en `.jpg` o `.jpeg`. Resolución sugerida <= 1024px lado mayor. Tamaño objetivo < 500 KB.
- Al menos 2–3 imágenes por válvula (ángulos/condiciones distintas). Más datos → mejor robustez.
- Evitar fotos borrosas. Buena iluminación.

Opcional (si quieres separar):
```
VALVULA_001/
  train/
    ...
  val/
    ...
```

Integración con el microservicio:
- Un indexador recorrerá `data/dataset/` para construir descriptores por clase.
- El endpoint `/index` reconstruirá la caché si agregas/eliminás imágenes.
- El endpoint `/recognize` devolverá `{ valve_id, name, confidence }` según la mejor coincidencia.

Próximos pasos previstos:
1) Implementar `app/services/vision_service.py` (index + match por ORB/BRISK).
2) Crear `app/vision_api/` con FastAPI y endpoints `/health`, `/index`, `/recognize`.
3) En `landing/js/camera.js`, reemplazar el stub de reconocimiento por la llamada real al endpoint.
