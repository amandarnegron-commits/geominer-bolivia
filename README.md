# GeoMiner Bolivia · v0.2

**Plataforma de investigación geológica preliminar**, no un detector de oro ni un sistema de evaluación de reservas.

## Novedades v0.2
- Selector entre mapa CARTO y mosaico satelital Sentinel-2 **de 2016** (EOX, CC BY 4.0): histórico y NO una escena actual.
- Búsqueda de terreno mediante centro GPS (latitud y longitud) con lado cuadrado de 1, 5, 10, 20 o 40 km.
- Exportación del rectángulo seleccionado como GeoJSON o KML para GIS y GPS.
- Filtro de nubosidad para las escenas candidatas devueltas por STAC.
- Las imágenes más recientes consultadas en STAC siguen siendo solamente metadatos; visualizarlas exige integrar proceso de imágenes multibanda.

## Lo que YA funciona
- Mapa interactivo (cartografía base de OpenStreetMap/CARTO).
- Selección de terrenos con dos clics y estimación de área geográfica.
- Búsqueda REAL de metadatos Sentinel-2 L2A de los últimos 12 meses mediante catálogo STAC de Copernicus.
- Visualización de fecha, satélite y nubosidad de escenas encontradas.
- Guardar y volver a abrir áreas en el navegador (localStorage).

## Lo que TODAVÍA NO funciona
- No muestra bandas multiespectrales reales sobre el mapa.
- No calcula índices minerales ni detecta anomalías; esto es para la siguiente fase.
- No tiene cuentas de usuario, guardado en Supabase, IA, ni generación de informes.
- No usa ni necesita claves de Copernicus para consultar el catálogo abierto. Descargar y procesar los datos requerirá una integración adicional.
- Solo la vista **Satélite 2016** es un mosaico satelital real, pero antiguo; no es una escena contemporánea ni un análisis espectral de la parcela. La vista Mapa es cartográfica.

## Ejecutar en Mac o Windows

Requisitos: Node.js >=20 y conexión a internet.

```bash
npm install
npm run dev
```
Abrir `http://localhost:5173`.

En PowerShell si `npm` queda bloqueado por Execution Policy, usar `npm.cmd install` y `npm.cmd run dev`. No cambiar la política de seguridad del sistema.

## GitHub de Amanda
1. Amanda entra a https://github.com/new en su propia sesión.
2. Crear repositorio `geominer-bolivia`, preferiblemente **privado**.
3. No añadir README ni `.gitignore` al crear (ya están aquí).
4. Desde la terminal en esta carpeta:
```bash
git init
git add .
git commit -m "GeoMiner Bolivia v0.1: mapa y catálogo Copernicus"
git branch -M main
git remote add origin https://github.com/USUARIO_DE_AMANDA/geominer-bolivia.git
git push -u origin main
```
Sustituir USUARIO_DE_AMANDA por su nombre de usuario real; autenticar con GitHub oficial sin compartir contraseñas ni tokens por chat. Invitar al colaborador desde Settings > Collaborators, si hace falta.

## Vercel — entorno personal de prueba
1. Amanda entra en https://vercel.com/new.
2. Importar el repositorio `geominer-bolivia` de su GitHub.
3. Framework: Vite. Build: `npm run build`. Output: `dist`.
4. Desplegar. El servidor API se publica como `api/sentinel.js`.

**Atención:** Vercel Hobby es para uso personal/no comercial. Al comenzar a cobrar informes, migrar a un plan/hosting permitido para uso comercial.

## Supabase — siguiente etapa
1. Amanda abre https://supabase.com/dashboard y crea el proyecto `geominer-bolivia`, si tiene cupo gratuito.
2. La primera versión NO requiere Supabase para funcionar.
3. Cuando agreguemos autenticación, revisaremos y ejecutaremos `supabase/schema.sql`, activaremos Auth y conectaremos la app.
4. No revelar contraseñas, claves `service_role` ni clave de OpenAI en el navegador; tampoco subir `.env`.

## OpenAI — siguiente etapa
Utilizaremos **Responses API** desde backend seguro. Nunca poner `OPENAI_API_KEY` en variables con prefijo `VITE_`. El asistente interpretará resultados calculados por el motor geoespacial; no afirmará presencia de minerales sin verificación.

## Licencias y limitaciones
- Mosaico EOX Sentinel-2 cloudless 2016 © EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), **CC BY 4.0**. Fuente: https://cloudless.eox.at/documentation/license
- No sustituir por mosaicos 2018–2025 de EOX en un producto comercial sin licencia, pues se distribuyen bajo CC BY-NC-SA 4.0.
- La disponibilidad del servicio público EOX puede variar y está sujeta a sus condiciones de servicio; revisar al crecer el tráfico.

## Fuentes oficiales
- https://documentation.dataspace.copernicus.eu/APIs/STAC.html
- https://dataspace.copernicus.eu/
- https://supabase.com/docs/
- https://vercel.com/docs/

## Advertencias
Los resultados preliminares no sustituyen muestreos, laboratorio, estudios de campo ni comprobación de derechos mineros. El mapa CARTO/OSM se usa para pruebas; revisar términos y proveedor adecuados antes de lanzamiento comercial. El catálogo oficial puede aplicar cuotas y cambiar su endpoint; la llamada está aislada en `lib/catalog.js` para poder actualizarlo.
