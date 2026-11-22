# GeoMiner Bolivia · v0.5

Plataforma **experimental de prospección espectral superficial** con Sentinel-2 y generación opcional de informes con OpenAI. **No certifica depósitos, minerales, reservas, leyes ni derechos mineros.**

## Cambios v0.5

Consulta `CHANGELOG_v0.5.md` para detalles. Esta versión añade agrupación de zonas P90+ contiguas, marcadores GPS aproximados, panel **Sectores**, GeoJSON de puntos de inspección y mapas con sectores numerados en el informe PDF.

## Actualizar sobre v0.4

Abre la Terminal de tu Mac:

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v0.5_actualizacion.zip -d .
npm install
npm test
npm run build
```

Si la compilación termina correctamente, abre GitHub Desktop, crea el commit `GeoMiner v0.5 - Sectores espectrales y coordenadas` y presiona `Push origin`. Vercel publicará automáticamente la nueva versión si la integración está activa.

## Probar

1. En https://geominer-bolivia.vercel.app selecciona un área de hasta 25 km².
2. En **Análisis**, consulta y procesa una escena Sentinel-2 (fechas del estudio y del satélite histórico pueden ser diferentes).
3. Abre **Sectores**, elige B4/B2 (respuesta férrica) o B11/B12 (respuesta SWIR).
4. Selecciona un sector numerado en la lista o sobre el mapa. Consulta sus coordenadas aproximadas y exporta GeoJSON.
5. Abre **Informe** y descarga el PDF; contiene listado de sectores y números ubicados sobre la imagen de índices.
6. Si generas interpretación de IA, usa el código privado configurado en Vercel, nunca la clave API.

## Entorno OpenAI

El backend reconoce `OPENAI_API_KEY` **o** `openai_api_key`, y `GEOMINER_ADMIN_CODE` **o** `geominer_admin_code`, así como `GEOMINER_OPENAI_MODEL` o `geominer_openai_model`. No debes cambiar ni revelar esas claves. La selección de modelo puede mantenerse como está configurada si la API ya responde en tu proyecto.

## Precauciones técnicas

- Las zonas se calculan por encima del percentil 90 de cada índice **dentro del área escogida**, agrupando componentes de al menos 3 celdas conectadas en diagonal u horizontal/vertical.
- Cada marcador apunta aproximadamente al **centro de un píxel de índice máximo** del grupo, no a una muestra real tomada sobre el terreno.
- El muestreo es 96 × 96 y no equivale a la resolución nativa Sentinel-2 ni a ubicación topográfica de precisión.
- Al elegir otra fecha, terreno o indicador, se recalculan los sectores: no son los mismos lugares garantizados.
- Las interpretaciones de OpenAI describen indicadores y recomiendan contrastar con mapas geológicos y muestreo; no sustituyen a un geólogo.
- El visor de calles OSM se usa como base experimental. Para uso comercial y altos volúmenes conviene contratar un proveedor con términos adecuados.
- Esta actualización NO requiere aún Supabase ni permisos nuevos en Vercel.

## Tecnología

React + Vite, MapLibre, lectura COG GeoTIFF con `geotiff`, reproyección `proj4`, percentiles y análisis de componentes conexas en JavaScript, `jsPDF` y Responses API de OpenAI mediante función de Vercel.
