# GeoMiner Bolivia 1.1

**GeoMiner es un explorador espectral que trabaja exclusivamente sobre las coordenadas WGS84 escogidas por el usuario.** No asigna bibliografía, minerales, unidades geológicas ni advertencias de un distrito por su posición.

## Actualizar sobre v1.0

Descomprimir `GeoMiner_Bolivia_v1.1_actualizacion_desde_v1.0.zip` sobre `~/Downloads/geominer-bolivia` y ejecutar el script de limpieza incluido:

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v1.1_actualizacion_desde_v1.0.zip -d .
bash ./limpiar_archivos_anteriores.sh
npm test
npm run build
```

Publicar vía GitHub Desktop → Commit to main → Push origin. Vercel realiza el despliegue si la integración está activa.

## Flujo

1. Escribe latitud, longitud y tamaño del área, o delimita el terreno en el mapa.
2. En **Análisis**, consulta una escena Sentinel-2 L2A, selecciona 20 m o 10 m, procesa bandas.
3. En **Sectores**, consulta el índice, coordenadas y prioridad de revisión. No equivale a probabilidad de yacimiento.
4. En **Validar**, contrasta otra escena y, si procede, un cuadro vecino.
5. En **Geología GPS**, incorpora un mapa GeoJSON WGS84 (EPSG:4326) o antecedentes con fuente.
6. En **Informe**, revisa el diagnóstico, descarga PDF y consulta a OpenAI con el código privado.

Las variables en Vercel no cambian: `OPENAI_API_KEY` o `openai_api_key`, `GEOMINER_ADMIN_CODE` o `geominer_admin_code`; `GEOMINER_OPENAI_MODEL` permanece opcional.

## Notas

- Al cambiar el terreno, los análisis y la pregunta previa a IA se limpian.
- La visualización satelital histórica de referencia es distinta de la escena procesada.
- Las notas locales y áreas previamente guardadas permanecen en el navegador; no se borran datos propios silenciosamente.
- Las conclusiones se basan en resultados medidos por el código; sin carta o muestras, no atribuyen minerales concretos a los puntos.
- PDF local no consume tokens. OpenAI es opcional y requiere una clave API privada en el servidor.
