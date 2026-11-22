# GeoMiner Bolivia v1.3 — Investigación automática por coordenadas

Módulo nuevo de **investigación documental y satelital verificable**. Construido sobre la versión 1.2, conserva las cuatro etapas principales y añade un único botón en **Estudio geológico**.

## Disponible en esta versión

- Consulta WFS por bbox de **GeoBolivia/SERGEOTECMIN**: `Geologia`, `Fallas`, `Anticlinales` y `Sinclinales` (capas históricas regionales, no mapas nuevos del satélite).
- Dibujo en el mapa de polígonos geológicos con colores por unidad y superposición de fallas/pliegues. Los atributos dependen del proveedor.
- Cruce geométrico básico de sectores P90 con polígonos de la carta pública. Un cruce no prueba un mineral.
- Búsqueda real del inventario de **DLR EnMAP L2A** a través de la API STAC. Por ahora se consultan metadatos; **no se han descargado ni clasificado cubos EnMAP**.
- Búsqueda real del inventario **NASA EMIT L2BMIN** por bbox en NASA CMR. La descarga de productos requiere un paso posterior y habitualmente cuenta Earthdata.
- Perfil topográfico del centro oeste-este mediante SRTM90m sobre Open Topo Data (API pública de **pruebas**).
- PDF con carta vectorial dibujada a partir de WFS, inventarios de fuentes, atributos cartográficos y perfil topográfico si responden los servidores.
- OpenAI recibe resúmenes de fuentes y metadatos consultados, **con indicación explícita de origen y sin confundir disponibilidad de escenas con análisis mineralógico**.
- Todas las consultas se realizan desde Vercel o el middleware local hacia **dominios fijos**; cada servicio tiene timeout y un fallo no inventa resultados ni detiene los demás.
- `GEOMINER_ADMIN_CODE` (también `geominer_admin_code`) protege el endpoint público en Vercel. En localhost, si no hay código de entorno, se permite prueba local.

## Limitaciones para la comercialización

1. **Servicios vivos**: el entorno de desarrollo no pudo verificar HTTP contra proveedores (no tiene acceso a Internet). La existencia de servicios y sus endpoints se comprobó documentalmente, pero sus respuestas al desplegar deben probarse. Si uno no responde se mostrará *Servicio no disponible*.
2. **Escala**: cartografía geológica regional pública; las unidades en un sector de decenas de metros pueden no ser fiables. Es necesaria cartografía más detallada y su permiso de uso.
3. **Hiperespectral**: disponer de escenas EnMAP/EMIT no significa poder identificar minerales sin procesamiento de cubos, corrección radiométrica, clasificación espectral, georreferenciación y validación.
4. **Relieve**: el perfil usa el servicio público Open Topo Data solo como prototipo, no está autorizado como infraestructura comercial ilimitada. Para venta se necesita fuente y alojamiento propios o licencia.
5. **Subsuelo**: ningún satélite óptico reconstruye directamente columna estratigráfica, leyes o reservas. Hay que incorporar mapas de unidades/edades, registros de campo, análisis de muestras y geofísica cuando existan.
6. **Seguridad**: el código compartido es una protección provisional. Antes de operar a escala comercial se necesita Supabase Auth, roles, cuotas, persistencia de estudios, pago y auditoría de fuentes.

## Instalación

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v1.3_actualizacion_desde_v1.2.zip -d .
npm install
npm test
npm run build
```

Después: GitHub Desktop → Commit → Push origin. Vercel desplegará.

## Fuentes

- GeoBolivia WFS: `https://geo.gob.bo/geoserver/sergeotecmin/wfs` (capas `Geologia`, `Fallas`, `Anticlinales`, `Sinclinales`).
- DLR STAC: `https://geoservice.dlr.de/eoc/ogc/stac/v1/search`, colección `ENMAP_HSI_L2A`.
- NASA CMR: `https://cmr.earthdata.nasa.gov/search/granules.json`, producto `EMITL2BMIN`.
- Open Topo Data: `https://api.opentopodata.org/v1/srtm90m` (API de prueba; evaluar términos).
