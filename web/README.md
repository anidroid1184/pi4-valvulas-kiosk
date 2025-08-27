# Landing de Demo - Sistema de Identificación de Válvulas

Carpeta: `landing/`

Esta landing es estática (HTML/CSS/JS) y no usa librerías externas.
Toda la información generada automáticamente en la UI inicia con el prefijo obligatorio `[No verificado]`.

## Estructura
- `index.html`: markup accesible del grid y del modal.
- `css/styles.css`: estilos responsive y alto contraste.
- `js/app.js`: lógica de descubrimiento, render y accesibilidad.
- `STATIC/IMG/`: coloca aquí tus imágenes (por ejemplo `valvula1.png`).
- (Opcional) `valvulas.json`: metadatos de válvulas en arreglo JSON.
- (Opcional) `STATIC/IMG/index.json`: listado de archivos de imagen `{ "images": ["valvula1.png", ...] }`.

## Funcionamiento
1. Al cargar, `app.js` intenta leer `valvulas.json`.
2. Si no existe, intenta `STATIC/IMG/index.json` para obtener la lista de imágenes.
3. Si tampoco existe, usa una lista ficticia: `valvula1.png`, `valvula2.png`, `valvula3.png`.
4. Se renderiza un grid con tarjetas. Click/Enter/Space abren el panel.
5. El panel muestra fichas con el prefijo `[No verificado]`. Esc o "Cerrar" cierra el panel.

## Formato sugerido de `valvulas.json`
Cada elemento:
```json
{
  "id": "valvula1",
  "nombre": "Válvula de Presión Principal",
  "tipo": "Presión",
  "ubicacion": "Línea A - Tramo 3",
  "estado": "Operativa",
  "ultima_revision": "2025-07-10",
  "presion_operacion_bar": 6.2,
  "caudal_l_min": 120,
  "notas": "[No verificado] Operación estable en horario diurno.",
  "imagen": "STATIC/IMG/valvula1.png",
  "etiquetas": ["principal", "presion", "linea-a"]
}
```
Los campos numéricos son opcionales; si no existen, no se muestran.

## Accesibilidad y seguridad
- Tarjetas con `role="button"`, `tabindex="0"` y `aria-label`.
- Teclas: Enter/Space abren; Esc cierra.
- Imágenes `alt` descriptivos y `loading="lazy"`.
- Cadenas de datos sanitizadas antes de insertarse; no se usa `innerHTML` con datos externos.

## Notas de despliegue
- Sirve la carpeta `landing/` con cualquier servidor estático (o abre `index.html` en el navegador). 
- Para una lista de imágenes real sin `index.json`, deberás generar `STATIC/IMG/index.json` durante tu build o backoffice.
- Si una imagen falla, se mantiene la tarjeta y se muestra un placeholder.
