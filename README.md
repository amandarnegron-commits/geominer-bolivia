# GeoMiner Bolivia · v0.9 — Cerro Rico de Potosí

Prototipo de análisis satelital **preliminar**. El programa procesa datos públicos Sentinel-2 L2A (COGs Element84), mapas y bibliografía del Cerro Rico. **No demuestra** minerales específicos, leyes, reservas, rentabilidad ni derechos mineros. No usar mapas como permisos o rutas de ingreso al Cerro Rico.

## Actualizar tu v0.7 en Mac

1. Descarga `GeoMiner_Bolivia_v0.8_actualizacion_desde_v0.7.zip` en Descargas.
2. Terminal:

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v0.8_actualizacion_desde_v0.7.zip -d .
npm install
npm test
npm run build
npm run dev
```

3. Revisa `http://localhost:5173`. Si todo funciona: GitHub Desktop → **Commit to main** → **Push origin**. Vercel publica automáticamente el commit si está integrada la rama main.
4. No cambies ni compartas `OPENAI_API_KEY` / `openai_api_key`, `GEOMINER_ADMIN_CODE` / `geominer_admin_code` ni `GEOMINER_OPENAI_MODEL` ya configuradas en Vercel.

**No reemplaces el proyecto con el ZIP de código completo si ya tienes cambios locales no guardados.** La actualización ZIP está diseñada para superponerse a la versión 0.7.

## Prueba recomendada en Cerro Rico

1. Pulsa **Abrir Cerro Rico**; se configura un terreno de aprox. 5×5 km.
2. En **Análisis**, consulta escenas y selecciona una que tenga baja nubosidad **en el propio terreno** (el porcentaje del catálogo suele ser de toda la escena).
3. Comienza con **20 m (recomendado)**, ejecuta procesamiento y visualiza B4/B2, B11/B12, y, si están disponibles, B11/B8A y B7/B5.
4. Activa **Falso color B11/B8/B4**. En el mapa, puedes activar **Relieve DEM**, **Geología WMS** y **Fallas regionales** por separado. Si falla una capa externa, desactívala; no afecta al análisis espectral.
5. En **Validar**, procesa una segunda fecha y prueba el **área vecina de control** (Oeste/Este/Norte/Sur) sobre la misma escena original.
6. Consulta **Sectores** y descarga el **Informe PDF**. La interpretación IA funciona solo con tu código privado; por defecto no envía imágenes. Puedes activar una miniatura visual de 128×128 como prueba opcional de consumo.

## Diferencias entre 10 y 20 metros

- La fuente dispone de bandas de 10 m (B2, B3, B4, B8) y de 20 m (B5, B6, B7, B8A, B11, B12 y SCL).
- En 20 m todas las bandas utilizadas se armonizan sobre celdas de aproximadamente 20 metros.
- En 10 m se utiliza una grilla de aproximadamente 10 metros para bandas de 10 m y se **interpolan las de 20 m** a la misma grilla. Ese remuestreo **NO añade detalle real** a las bandas SWIR ni red-edge.
- Un terreno de 5×5 km puede ocupar aproximadamente 250×250 celdas a 20 m o 500×500 a 10 m. El código limita cada dimensión a 512 para memoria de equipos modestos.
- El valor P90 se calcula dentro del terreno estudiado; no es un umbral universal ni determina mineralización.

## Datos, fuentes y cautelas

- **Catálogo de consulta Copernicus**: `api/sentinel.js` (metadatos).
- **Análisis real Sentinel-2 L2A**: `api/analysis-scenes.js`, `lib/analysis-catalog.js`, `src/cog-analysis.js` usando COGs públicos de Earth Search/Element84. No confundir con el **mosaico de fondo EOX 2016** del mapa.
- **Referencias geológicas**: visor de SERGEOMIN y WMS GeoBolivia (capas nacionales, escala general, disponibilidad variable). Las unidades geológicas no están intersectadas automáticamente con los polígonos de sectores.
- **Relieve**: Mapzen/AWS Terrarium. Es una capa de apoyo visual, no corrección atmosférica/topográfica de reflectancia.
- **Área de control**: es un cuadro de igual tamaño desplazado, no un lugar geológicamente homologado. Diferencias entre medianas no equivalen a precisión ni probabilidad de hallazgo.
- **Miniatura a OpenAI**: si el operador activa la opción, se envía la imagen de **falso color de la escena** de tamaño 128×128 junto con estadísticas. Puede haber error si el modelo contratado no admite entrada visual; desactiva la casilla para volver a análisis numérico. Puede aumentar costos.
- Las **notas privadas** que registras en el navegador NO se envían a OpenAI. No guardamos resultados en una base de datos todavía.
- Uso público/comercial requiere licencias, un proveedor de mapas apropiado, autenticación de usuarios, límites de gasto y revisión profesional de informes.

Fuentes oficiales y documentos: https://s2.pages.eopf.copernicus.eu/msi/s2msi/1.1.0/context.html · https://earth-search.aws.element84.com/v1 · https://ide.sergeomin.gob.bo/ · https://geo.gob.bo/geoserver/sergeotecmin/wms · https://registry.opendata.aws/terrain-tiles/

## Calidad técnica

`npm test` incluye las pruebas de v0.1–v0.7 y pruebas de v0.8 de resolución, bandas opcionales, composición de falso color, áreas vecinas, protección de acceso y envío opcional de miniaturas. Las pruebas automatizadas no equivalen a verificación geológica de las escenas.

## GeoMiner v0.9 — Dictamen claro por sector

Esta actualización incorpora un **dictamen operacional reproducible** antes de llamar a OpenAI. En **Informe** ahora aparece si se detectaron grupos relativos P90, contexto histórico del distrito, qué falta para confirmar mineralización y qué información sería necesaria para estimar potencial económico. La plataforma separa esas cuatro preguntas para impedir que una conclusión vaga o inventada sustituya los datos.

Cada sector obtiene prioridad de revisión **Alta / Media / Inicial / Por verificar** usando: proximidad de respuestas elevadas B4/B2 y B11/B12; repetición local de respuesta P90 en una segunda fecha del mismo terreno; y cobertura válida. **No es porcentaje de éxito, probabilidad de presencia de mineral ni recomendación de invertir, excavar o ingresar al Cerro Rico.** La clasificación se recalcula con las escenas y el terreno; puede cambiar al seleccionar otras fechas.

Se incluye automáticamente en PDF, sin tokens ni clave API. OpenAI, si se activa, recibe una versión saneada del dictamen y redacta respuestas más concretas sin inventar hallazgos.

### Instalación de v0.9 sobre v0.8

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v0.9_actualizacion_desde_v0.8.zip -d .
npm install
npm test
npm run build
```

Publicar después mediante GitHub Desktop: Commit to main → Push origin. Vercel despliega la actualización y mantiene las variables ya configuradas.

### Próxima etapa de validación de potencial minero

Para acercarnos a predicciones de prospectividad mineral con respaldo necesitamos: separar superficies urbanas/escombreras; una base espacial de ocurrencias minerales contrastadas y controles de no ocurrencia; mapas geológicos y alteración de escala adecuada; corrección de topografía/atmósfera; datos hiperespectrales si cubren el área (por ejemplo EMIT/PRISMA); controles de validación de área distinta a las zonas de entrenamiento; ensayos geoquímicos y revisión profesional. Una etiqueta binaria de mineral en puntos concretos requiere estas evidencias adicionales y métricas de error conocidas.
