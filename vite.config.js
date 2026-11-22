import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { searchSentinel } from './lib/catalog.js';
import { searchAnalysisScenes } from './lib/analysis-catalog.js';

// Misma API en localhost que se despliega como funciones Vercel.
function localApi() {
  return {
    name: 'geominer-local-satellite-api',
    configureServer(server) {
      for(const [path, fn] of [
        ['/api/sentinel',searchSentinel],
        ['/api/analysis-scenes',searchAnalysisScenes]
      ]){
        server.middlewares.use(path,async(req,res,next)=>{
          if(req.method!=='GET')return next();
          res.setHeader('Content-Type','application/json; charset=utf-8');
          try {
            const url=new URL(req.url,'http://localhost');
            const data=await fn(url.searchParams.get('bbox'));
            res.statusCode=200;res.end(JSON.stringify(data));
          }catch(err){
            const message=err?.message||'Servicio no disponible';
            res.statusCode=/selecciona|terreno|esquinas|límite|válidos|pequeño|hasta 25/i.test(message)?400:503;
            res.end(JSON.stringify({error:message}));
          }
        });
      }
    }
  };
}
export default defineConfig({ plugins:[react(),localApi()], server:{port:5173} });
