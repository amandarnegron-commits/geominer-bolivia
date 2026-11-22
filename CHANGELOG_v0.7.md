# GeoMiner Bolivia v0.7 — Validación Cerro Rico

- Pestaña **Validar**: procesa una segunda escena Sentinel-2 sobre el MISMO terreno, cuadrícula y bandas.
- Calcula coincidencia Jaccard de celdas P90 en ambas fechas, excluyendo celdas sin datos en cualquiera de las escenas. Aclara que no es precisión de detección ni confirmación mineral.
- Permite registrar una nota y estado de revisión declarado para cada sector. Se conserva localmente, sin enviar al servidor ni a OpenAI.
- Exporta un expediente JSON del piloto con comparación numérica y anotaciones.
- PDF: incluye fechas, coincidencia temporal y anotaciones etiquetadas como no auditadas.
- Conserva el caso piloto Cerro Rico y las fuentes bibliográficas incorporadas en v0.6.
- **No** integra aún capas WMS reales, certificados de laboratorio, derechos mineros ni usuarios autenticados.

- El servidor OpenAI recibe, además de percentiles y sectores, la coincidencia numérica temporal validada y un resumen bibliográfico fijo de USGS para el cuadro que contiene Cerro Rico. **No se transmiten las notas locales del operador**.
