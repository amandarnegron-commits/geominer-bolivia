# GeoMiner Bolivia v0.3

**Nuevo:** módulo de análisis espectral de Sentinel-2 L2A.

- Imágenes de 6 bandas COG públicas, indexadas en Earth Search.
- Índices: B4/B2 para respuesta relacionada con hierro, B11/B12 para SWIR.
- Máscara aproximada de nubosidad, agua, sombra y vegetación (SCL y NDVI).
- Capa de mapa georreferenciada coloreada por percentiles propios del área.
- Exportación de puntos de valores altos (percentil 90) a GeoJSON.
- El mosaico 2016 es sólo referencia visual; los índices se calculan de la fecha elegida.
- Restricción de análisis por navegador a 25 km², 96×96 píxeles de muestreo.

No utiliza claves privadas ni procesa datos con IA todavía. No estima reservas ni identifica yacimientos.
