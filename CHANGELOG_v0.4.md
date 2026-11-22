# GeoMiner v0.4 - Informes en PDF y asistente de OpenAI

## Funciones nuevas
- Nueva pestaña **Informe**, disponible tras procesar una escena multiespectral.
- Descarga de PDF local **sin costo de tokens** con escena, coordenadas, área, estadísticas B4/B2 y B11/B12, método y advertencias.
- Imagen PNG de la capa de anomalías relativa que esté seleccionada, sin incorporar mosaicos base de terceros.
- Solicitud de interpretación con OpenAI mediante **Responses API** protegida con `GEOMINER_ADMIN_CODE` (solo en servidor).
- Contador de tokens de entrada y salida indicado cuando lo devuelve la API.
- Modelo económico configurado inicialmente a `gpt-6-luna`, personalizable con `GEOMINER_OPENAI_MODEL`.
- `store:false` y sin enviar los archivos de imagen a la IA: solo coordenadas, escena y estadísticas.

## Precauciones de seguridad
- No colocar `OPENAI_API_KEY` ni `GEOMINER_ADMIN_CODE` en código público ni variables `VITE_*`.
- El código de acceso temporal protege la etapa de desarrollo, pero **no es autenticación para clientes**. Antes de vender informes, añadir Supabase Auth, cuotas por usuario, límites de solicitudes y registro de consumo.
- No presentar el texto de la IA como un dictamen geológico.
- La API no está activa hasta configurar las variables de Vercel.

## Pruebas
- 19 pruebas automatizadas en Node (`npm test`), incluyendo rechazo de claves incorrectas, ausencia de llamada facturable sin configuración y validación de estadísticas.
- Sintaxis JSX comprobada con TypeScript parser.
- Compilación Vite pendiente de verificar en la Mac: este entorno no pudo descargar paquetes npm.
