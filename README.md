# GeoMiner Bolivia v1.3 — motor de gabinete por coordenadas

La plataforma sigue usando Sentinel-2 para calcular índices espectrales y sectores; además consulta **fuentes geológicas y catálogos hiperespectrales independientes** desde el backend, sin pedir que el usuario pegue páginas de un informe antiguo.

## Inicio rápido

1. Descarga el ZIP de actualización **desde v1.2** y descomprímelo sobre el proyecto local. Para un proyecto nuevo usa el ZIP completo.
2. `npm install && npm test && npm run build && npm run dev`.
3. Selecciona la zona con latitud y longitud, hasta **25 km²**.
4. Abre **Estudio geológico**, introduce el mismo código privado de GeoMiner que ya usas para OpenAI y pulsa **Investigar esta zona automáticamente**.
5. Examina las unidades, estructuras, perfil de relieve y el inventario de escenas EnMAP y EMIT que hayan respondido. En el mapa se mostrarán las capas WFS disponibles.
6. Para PDF con estadísticas Sentinel-2 procesa además una escena en **Análisis**; luego abre **Informe** y descarga el PDF con resultados automáticos añadidos.

## Fuentes y alcances

- GeoBolivia/SERGEOTECMIN: mapa nacional 2000, fallas y pliegues. **Escala regional**.
- EnMAP DLR L2A: inventario **solo metadatos**, aún sin descarga y procesamiento hiperespectral.
- EMIT NASA L2BMIN: inventario **solo metadatos**.
- Open Topo Data SRTM90m: perfil topográfico aproximado, **API pública de prueba**, no licencia comercial asegurada.
- Sentinel-2 L2A (Element84): índices de superficie B4/B2, B11/B12 y auxiliares; no identifica leyes ni reservas minerales.

Nunca interpreta un *servidor no disponible* como *cero depósitos*. Una carta geológica, una firma de alteración y una estimación de depósito son afirmaciones de naturaleza distinta.

## Infraestructura

- `api/auto-research.js`: API de Vercel, autenticada con `GEOMINER_ADMIN_CODE` o `geominer_admin_code`.
- `lib/auto-research.js`: motor de consulta con timeout y sanitización de respuesta.
- `src/App.jsx`: único botón principal de investigación, mapa y perfil.
- `src/report-pdf.js`: carta vectorial, perfil y referencias documentales.
- `lib/report-api.js`: envía resúmenes de las fuentes consultadas a OpenAI con limitaciones explícitas.

Consulta `CHANGELOG_v1.3.md` para límites comerciales y fuentes. **No está listo aún como informe geológico certificable o plataforma comercial autónoma.**
