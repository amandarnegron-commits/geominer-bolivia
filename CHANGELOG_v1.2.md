# Cambios GeoMiner v1.2

- Menú principal reducido a cuatro pestañas: Análisis / Estudio geológico / Sectores / Informe. GPS y delimitación quedan en barra lateral. Validación y área guardada disponibles como opciones secundarias.
- Un solo botón GPS; el campo de pegado de coordenadas WGS84 rellena latitud y longitud automáticamente. Un solo flujo de consulta Sentinel-2 en Análisis.
- Nuevo expediente geológico con seis categorías de láminas aportadas; metadatos de fuente, escala, interpretación y autorización explícita para revisión visual de IA.
- Estado documental verificable en pantalla y PDF. Los anexos JPG se incrustan en el PDF; el mapa vectorial de GeoJSON se dibuja automáticamente para la zona GPS, sin atribuir datos que no existan.
- GeoJSON vectorial importado se superpone al mapa. La intersección con sectores queda ligada al área GPS donde se importó para evitar contaminación de otros proyectos.
- Interfaz sin duplicaciones, tarjetas de próxima etapa obsoletas, filtros avanzados plegados.
- Servidor OpenAI permite dos JPEG de láminas como máximo, solo opt-in, control de contraseña y restricciones de tamaño; el texto estructurado se envía sin imágenes por defecto.
- Las fotografías aportadas como referencia no se cargan automáticamente para ningún terreno. Para utilizarlas en un área se deben importar expresamente en la propia página.
- Incluye pruebas automatizadas, sin nuevos paquetes npm obligatorios.

**Limitaciones:** no hay lectura automática de litologías a partir de foto escaneada, ni georreferenciación de escaneos, ni perfiles derivados de Sentinel-2. El PDF es un informe de gabinete estructurado; para equiparar un levantamiento geológico oficial se requiere campo y cartografía contrastada.
