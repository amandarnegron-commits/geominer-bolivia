# GeoMiner Bolivia v0.4

Aplicación de prospección satelital **preliminar**. NO certifica minerales, leyes, reservas, profundidad, derechos ni éxito de exploración.

## Instalación rápida sobre la versión 0.3 de tu Mac

Descarga el ZIP **de actualización v0.4**, que contiene únicamente archivos modificados/nuevos, y descomprímelo dentro de `~/Downloads/geominer-bolivia`:

```bash
cd ~/Downloads/geominer-bolivia
unzip -o ~/Downloads/GeoMiner_Bolivia_v0.4_actualizacion.zip -d .
npm install
npm test
npm run build
npm run dev
```

Abre `http://localhost:5173`. Si npm está bloqueado por PowerShell en Windows usa `npm.cmd install` y `npm.cmd run dev`.

## Flujo de uso

1. Selecciona una zona de hasta 5 × 5 km en Potosí u otra región, preferiblemente con suelo descubierto.
2. En **Análisis**, consulta una escena y **procesa sus bandas**. Si la escena falla, selecciona otra.
3. En **Informe**, pulsa **Descargar informe PDF gratuito**. El archivo contiene datos calculados, límites geográficos, método y advertencias.
4. Opcional: configura OpenAI (ver abajo) para generar texto interpretativo. Después puedes descargar un PDF con ese texto.

## Configurar OpenAI SIN exponer claves

1. En `https://platform.openai.com/api-keys` genera una clave de proyecto que usarás solo en el servidor.
2. En Vercel abre **Project Settings → Environment Variables** del proyecto `geominer-bolivia` de Amanda.
3. Agrega:

| Variable | Valor | Alcance |
|---|---|---|
| `OPENAI_API_KEY` | Clave privada de API | Servidor (Production) |
| `GEOMINER_ADMIN_CODE` | Una contraseña aleatoria LARGA creada por ti | Servidor (Production) |
| `GEOMINER_OPENAI_MODEL` | `gpt-6-luna` | Servidor (Production) |

4. Guarda las variables y haz **Redeploy** para que se carguen en funciones Vercel.
5. En GeoMiner, pestaña **Informe**, introduce **el código de acceso**, no la clave API, y pulsa *Generar interpretación con IA*. El código se mantiene solo en memoria hasta terminar la petición y se borra del formulario.
6. Para probar OpenAI en localhost, crea un `.env` **únicamente en tu Mac** y carga las variables en la sesión que ejecuta Vite (por ejemplo, `set -a; source .env; set +a; npm run dev`). El `.env` está excluido por `.gitignore`.

**No envíes las claves ni los códigos por chat, capturas ni GitHub.** La API de OpenAI se cobra por tokens y tiene facturación separada de ChatGPT.

**Importante:** no habilites esto como servicio público de pago todavía. Para producción hace falta autenticación (Supabase Auth), cuentas de cliente, límites de uso en servidor, monitor de gasto, términos comerciales de la cartografía y revisión geológica.

## Contenido y calidad de los resultados

- Los índices son B4/B2 y B11/B12 sobre reflectancia Sentinel-2 L2A; **no son pruebas de minerales concretos**.
- La máscara usa SCL y NDVI para limitar el análisis a suelo aparentemente descubierto; SCL 7 es «sin clasificar», por lo que incluye incertidumbre.
- El cálculo del navegador reescala una zona a cuadrícula 96x96; no corresponde a resolución espacial nativa.
- Los percentiles son valores **relativos dentro del terreno elegido**, no concentraciones ni potencial comercial.
- Los datos enviados al modelo provienen del navegador; no están auditados independientemente.
- `store:false` evita guardar la respuesta en el almacenamiento de Responses API de manera predeterminada, sujeto a las políticas de tratamiento de datos aplicables.
- PDF se genera localmente sin subir a Supabase ni utilizar servicios externos.

## Fuente de documentación

- OpenAI Responses API: https://developers.openai.com/api/reference/resources/responses/methods/create
- Modelos: https://developers.openai.com/api/docs/models
- Element84 Earth Search: https://earth-search.aws.element84.com/v1
- Copernicus Data Space: https://dataspace.copernicus.eu/

## Archivos clave

- `src/report-data.js`: ensamblado objetivo del informe.
- `src/report-pdf.js`: descarga PDF usando `jspdf` 4.2.1 o posterior, con correcciones de seguridad.
- `api/ai-report.js`: handler de Vercel.
- `lib/report-api.js`: validación, control de acceso e integración Responses API.
- `tests/report.test.mjs`: pruebas sin llamadas reales ni costos.

## Versiones

- 0.1: mapa y catálogo Copernicus
- 0.2: GPS, GeoJSON/KML y vistas base
- 0.3: índices espectrales iniciales
- **0.4: informes PDF y conexión privada a OpenAI**
