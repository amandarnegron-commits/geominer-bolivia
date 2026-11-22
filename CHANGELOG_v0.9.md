# GeoMiner Bolivia v0.9 — Dictamen de evidencia y prioridad de revisión

## Qué cambia

- El informe deja de limitarse a textos genéricos: emite cuatro respuestas separadas y explícitas:
  1. **Sí / no se detectaron / no evaluable** para *agrupaciones de respuesta espectral alta relativa* según criterio P90.
  2. **Contexto histórico documentado** de mineralización en Cerro Rico si el rectángulo contiene el lugar de referencia; esto no prueba la mineralización de los marcadores.
  3. **No determinada** para mineralización específica en cada sector con bandas Sentinel-2 por sí solas.
  4. **No evaluable** para potencial económico sin ensayos de ley, tonelaje, continuidad y costos.
- **Prioridad para revisión remota, no probabilidad minera** por sector: Alta (ambos índices y repetición entre fechas), Media (una de las dos corroboraciones), Inicial (solo una respuesta espectral), Por verificar (menos del 30% de píxeles útiles).
- Se evalúa una vecindad limitada alrededor de cada píxel de máxima respuesta para no confundir precisión aparente con georreferenciación exacta.
- En el mapa, las prioridades Altas muestran un anillo de contraste; en el panel de Informe hay una tabla de sectores priorizados que lleva al mapa.
- Los diagnósticos se incluyen en el PDF **sin gastar tokens** de IA.
- La interpretación OpenAI se orienta a decisiones de revisión, indicando claramente el alcance de cada sí/no y evitando repetir mensajes vagos.
- El servidor restringe el dictamen recibido del navegador y no acepta texto arbitrario que afirme cantidades de mineral.
- Se conserva el uso de `openai_api_key`/`OPENAI_API_KEY`, `geominer_admin_code`/`GEOMINER_ADMIN_CODE`, `GEOMINER_OPENAI_MODEL`.

## Qué NO ha cambiado

- No existe clasificación mineral validada por geoquímica, petrografía ni campañas de campo.
- Los sectores relativos no son depósitos, reservas, ley minera, objetivos de perforación ni rutas seguras de acceso a Cerro Rico.
- La selección P90, por definición, identifica posiciones elevadas *respecto al terreno*, no un umbral físico de mineralización.
- Coocurrencia de índices y persistencia entre fechas no son pruebas independientes de mineral ni medidas de precisión; la geología, urbanización, escombreras, iluminación, sombras y humedad pueden alterar la señal.
- La miniatura de falso color de 128×128 no sustituye un laboratorio ni una imagen hiperespectral.
- No se añadieron sensores, costos mensuales ni cambios a Vercel/Supabase; no requiere nuevas claves.

## Validación

- 47 pruebas automáticas de Node.js (42 previas + 5 nuevas) aprobadas.
- Sintaxis JSX y JS validada mediante el parser TypeScript.
- El entorno de trabajo no puede conectarse al registro npm, por lo que `npm install` y el build de Vite de producción deben probarse en el equipo de destino.
- No se verificaron en vivo los servicios satelitales durante esta generación.

## Requisitos previos

Tener instalada v0.8. Descomprime el ZIP de actualización sobre la misma carpeta, ejecuta `npm install`, `npm test`, `npm run build`; después GitHub Desktop Commit/Push. También hay un ZIP completo opcional.
