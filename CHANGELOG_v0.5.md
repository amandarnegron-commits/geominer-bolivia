# GeoMiner Bolivia v0.5 — sectores de respuesta espectral (22/11/2026)

## Implementado

- Nueva pestaña **Sectores**: agrupación reproducible de píxeles por encima del percentil 90 (P90) de B4/B2 o B11/B12 dentro del área de interés.
- **Grupos contiguos**: vecindad de 8 celdas, mínimo 3 píxeles, hasta 12 grupos destacados por índice. No se muestran zonas artificiales si los datos son homogéneos, inválidos o demasiado escasos.
- Marcadores interactivos numerados sobre el mapa. Al pulsarlos, muestra latitud, longitud, índice máximo, índice medio y tamaño aproximado.
- Control de visualización de marcadores y opacidad del mapa de índices, para contrastarlo con la cartografía y el mosaico histórico.
- GeoJSON exportable con puntos de referencia y advertencias metodológicas.
- PDF ahora incluye, por índice, los sectores y coordenadas, además de marcadores numerados sobre el mapa de índices seleccionado.
- La interpretación OpenAI recibe hasta seis sectores validados por índice, para describir verificaciones de campo prudentes.
- Encabezados de OpenAI renderizados sin mostrar caracteres Markdown `###` en la web.
- Se conserva compatibilidad con `openai_api_key` y `geominer_admin_code` de Vercel, además de los nombres en mayúsculas.

## Advertencias

**Los valores P90 son relativos al terreno elegido, no concentraciones de minerales ni probabilidades de yacimiento.** Las coordenadas se derivan de centros de píxel sobre una cuadrícula reproyectada y muestreada a 96 × 96: no constituyen observaciones GPS ni precisión de levantamiento topográfico. El mosaico Sentinel-2 histórico 2016 es solo un fondo cartográfico de referencia; el estudio espectral se hace con la escena de la fecha indicada. No hay cruce de estructuras geológicas oficiales ni auditoría externa por un geólogo.

## Verificación

24 pruebas automáticas Node.js aprobadas y validación sintáctica JSX mediante TypeScript. No se pudo realizar aquí la compilación completa de Vite ni una prueba del servicio satelital en vivo por las restricciones de acceso de red en este entorno; ejecutarlas en tu Mac antes de subir los cambios.
