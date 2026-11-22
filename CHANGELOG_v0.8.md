# GeoMiner Bolivia v0.8 — Resolución, bandas, controles y cartografía

Actualización sobre v0.7, sin necesidad de cambiar claves Vercel.

## Implementado

- Muestreo de escenas Sentinel-2 L2A por bandas COG públicas en cuadrículas UTM de **20 m** (recomendado) y **10 m** (más pesado); límite de 512 x 512 celdas.
- En el modo 10 m **las bandas B11, B12, B5, B6, B7, B8A y SCL originales de 20 m son remuestreadas**: no ganan resolución nativa ni permiten ver minerales más pequeños.
- Agrega banda B3 (verde), además de B2, B4, B8, B11, B12 y SCL; intenta cargar B5, B6, B7 y B8A cuando se encuentren disponibles (si una opcional falla, continúa con los índices básicos).
- Conserva B4/B2 y B11/B12; agrega indicadores auxiliares **B11/B8A** y **B7/B5** condicionados a disponibilidad de bandas, sin etiquetarlos como minerales detectados.
- Visualización de **falso color B11/B8/B4**, generada a partir del procesamiento de la escena real (no es fotografía de color natural). La capa histórica de 2016 sigue siendo distinta.
- Capas cartográficas **opcionales**: relieve Mapzen/AWS Open Data, geología nacional y fallas regionales WMS GeoBolivia/SERGEOMIN. Son referencias **visuales de escala regional** y su disponibilidad depende de servidores externos. No existe cruce automático píxel-veta-unidad geológica.
- Pestaña **Validar**: comparación descriptiva de P50/P90 con un cuadro vecino no superpuesto de igual tamaño, **sobre la misma escena y resolución**, siempre que el COG cubra la zona. No es una prueba positiva/negativa de mineral.
- El mínimo de píxeles para detectar sectores escala según el área de celda, con un umbral orientativo de ~1.200 m² por grupo.
- PDF ampliado: tamaño de cuadrícula, tamaño de celdas, indicadores auxiliares, contraste de control y limitaciones cartográficas.
- OpenAI recibe las nuevas estadísticas validadas y, con consentimiento explícito, puede recibir una **miniatura de falso color 128x128 JPEG** (desactivado por defecto). Puede requerir un modelo compatible con visión y consumir más tokens. Las anotaciones privadas locales no se envían.
- Conserva compatibilidad con `openai_api_key`, `geominer_admin_code` en minúscula o mayúscula.

## Limitaciones y validación pendiente

- No se realizaron pruebas reales de las peticiones externas a COGs ni del estado actual de los servidores WMS en este entorno sin salida a internet.
- Las coordenadas de sectores son orientativas: el mapa reubica aproximadamente una grilla UTM sobre la caja latitud/longitud, sin ortorrectificación de precisión topográfica.
- El relieve mostrado no se utiliza para corrección topográfica de reflectancia; la iluminación, la humedad, la variación del terreno y superficies mineras removidas pueden producir señales elevadas.
- El área vecina no tiene necesariamente litología ni uso del suelo comparables al Cerro Rico.
- Sentinel-2 no identifica plata, estaño, oro, leyes, reservas, profundidad ni viabilidad económica. Los índices son ratios exploratorios, no clasificación mineral certificada.
- Los WMS regionales son de escala general y NO permiten confirmar una veta o depósito de metros a decenas de metros.
- La plataforma aún no está lista como producto minero profesional automatizado: faltan validación geológica externa, autenticación y controles de producción.

## Fuentes técnicas

- Copernicus Sentinel-2 MSI 10/20/60 m: https://s2.pages.eopf.copernicus.eu/msi/s2msi/1.1.0/context.html
- Element84 Earth Search Sentinel-2 C1 L2A: https://earth-search.aws.element84.com/v1
- Infraestructura de Datos Espaciales SERGEOMIN: https://ide.sergeomin.gob.bo/
- GeoBolivia geoserver SERGEOTECMIN: https://geo.gob.bo/geoserver/sergeotecmin/wms
- Mapzen / AWS Terrarium tiles: https://registry.opendata.aws/terrain-tiles/
