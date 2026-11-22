import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { searchSentinel } from './lib/catalog.js';

// En localhost la misma consulta STAC funciona sin instalar otro servidor.
function localApi() {
  return {
    name: 'geominer-local-copernicus-api',
    configureServer(server) {
      server.middlewares.use('/api/sentinel', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const requestUrl = new URL(req.url, 'http://localhost');
          const data = await searchSentinel(requestUrl.searchParams.get('bbox'));
          res.statusCode = 200;
          res.end(JSON.stringify(data));
        } catch (error) {
          const message = error?.message || 'Error de servicio';
          res.statusCode = /Selecciona|límite|terreno|superar|pequeño|válidos/.test(message) ? 400 : 503;
          res.end(JSON.stringify({ error: message }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: { port: 5173 }
});
