# GeoMiner Bolivia v0.3 — Análisis espectral exploratorio

Prototipo web para selección GPS, consulta de escenas Sentinel-2 y visualización de **índices espectrales reales, no mineralización comprobada**.

## Qué incorpora v0.3

- Mantiene mapa base OpenStreetMap y mosaico satelital histórico EOX, ya corregidos en v0.2.1.
- Mantiene consulta de escenas **Copernicus Data Space** (`/api/sentinel`).
- Añade **Earth Search** v1 (Element 84) para buscar escenas públicas Sentinel-2 Collection 1 L2A con archivos COG por banda (`/api/analysis-scenes`). El catálogo complementario se usa porque entrega archivos COG, no porque sea otro satélite.
- Analiza realmente bandas de reflectancia **B2 (azul), B4 (rojo), B8 (NIR), B11 y B12 (SWIR)** y banda de clasificación **SCL**.
- Calcula respuesta asociada a óxidos de hierro **B4/B2** y respuesta SWIR de arcillas/hidroxilos **B11/B12** en una cuadrícula **96 x 96** para terrenos de hasta **25 km²**.
- Rechaza muestras etiquetadas SCL como nube, agua, sombra, nieve y vegetación. Filtro NDVI adicional para terreno expuesto. La banda SCL no es perfecta; sigue existiendo incertidumbre.
- Colorea **el cuartil superior (percentil 75+) del propio terreno**, resalta la intensidad relativa y exporta puntos de percentil 90+ en GeoJSON, con advertencias científicas.
- Identifica la fecha de la escena analizada, distinta del mosaico de fondo histórico de 2016.

## Limitaciones importantes

- **No es detección directa de oro, plata, cobre ni reservas**. Hay muchas causas posibles para los mismos índices.
- Los percentiles son **relativos a la selección** y no son porcentajes de mineral ni probabilidades de yacimiento.
- Una imagen puede cubrir parcialmente un área o contener nubes pese a la nubosidad reportada a nivel escena.
- La cuadrícula 96 x 96 es un muestreo: NO equivale a resolución uniforme original de 10/20 metros ni sustituye un análisis SIG profesional.
- Descarga fragmentos de GeoTIFF COG directamente en el navegador: requiere acceso web y servidor de imágenes con HTTP Range + CORS. La aplicación muestra un error si esas condiciones fallan.
- El raster SCL es una clasificación automática que puede fallar. Los resultados deben validarse con campo y geólogo.
- OpenAI, informes PDF y Supabase todavía NO están conectados.
- No probado de extremo a extremo contra servicios externos desde este entorno sin red: se han ejecutado pruebas unitarias y verificación sintáctica. Hay que verificar una escena en Mac después de instalar dependencias.
- No incluir API keys en el repositorio o en `VITE_`.

## Actualizar desde la versión 0.2.1 en la Mac

Descarga y descomprime el **parche** sobre la carpeta del repo existente, conservando `.git`.

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v0.3_actualizacion.zip -d .
npm install
npm test
npm run build
npm run dev
```

Probar `http://localhost:5173` antes de publicar. Seleccionar **Potosí**, GPS 5 km, **Aplicar**, elegir **Análisis**, **Consultar escenas gratuitas**, elegir escena con nubosidad baja y **Procesar bandas**. Si la carga tarda, esperar al resultado del navegador; se van leyendo 6 archivos COG.

Al funcionar, abrir GitHub Desktop, `Commit to main` y `Push origin`. Vercel publica `main` si está vinculado. No hace falta configurar ninguna clave para esta fase.

## Arquitectura

- `src/cog-analysis.js`: lectura remota de COG y reproyección UTM mediante `geotiff` + `proj4`.
- `src/indices.js`: cálculos, máscara de superficie, cuantiles, imagen RGBA y exportación a GeoJSON.
- `lib/analysis-catalog.js`: validación de áreas, filtrado de URLs COG, búsqueda STAC.
- `api/analysis-scenes.js`: API de Vercel.
- `vite.config.js`: la misma API cuando se ejecuta en localhost.
- `src/App.jsx`: interfaz y capa georreferenciada MapLibre.

## Fuentes y lectura adicional

- https://github.com/Element84/earth-search/blob/main/docs/collections/sentinel-2-l2a.md
- https://registry.opendata.aws/sentinel-2-l2a-cogs/
- https://geotiffjs.github.io/geotiff.js/
- https://www.mdpi.com/2076-3417/15/24/13251
- https://www.openstreetmap.org/copyright
