import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { searchSentinel } from './lib/catalog.js';
import { searchAnalysisScenes } from './lib/analysis-catalog.js';
import { createAiReport } from './lib/report-api.js';

// APIs con el mismo endpoint en localhost y en funciones Vercel.
function localApi(){
  return {name:'geominer-local-api',configureServer(server){
    for(const [path,fn] of [['/api/sentinel',searchSentinel],['/api/analysis-scenes',searchAnalysisScenes]]){
      server.middlewares.use(path,async(req,res,next)=>{
        if(req.method!=='GET')return next();
        res.setHeader('Content-Type','application/json; charset=utf-8');
        try{const url=new URL(req.url,'http://localhost');const data=await fn(url.searchParams.get('bbox'));res.statusCode=200;res.end(JSON.stringify(data));}
        catch(err){const msg=err?.message||'Servicio no disponible';res.statusCode=/selecciona|terreno|esquinas|límite|válidos|pequeño|hasta 25/i.test(msg)?400:503;res.end(JSON.stringify({error:msg}));}
      });
    }
    server.middlewares.use('/api/ai-report',async(req,res,next)=>{
      if(req.method!=='POST')return next();
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      let raw='';
      try {
        for await (const chunk of req) {raw+=chunk.toString();if(raw.length>20000){res.statusCode=413;res.end(JSON.stringify({error:'Solicitud demasiado grande.'}));return;}}
        const body=JSON.parse(raw);
        const result=await createAiReport({data:body.report,passcode:req.headers['x-geominer-admin-code']});
        res.statusCode=result.status;res.end(JSON.stringify(result.body));
      }catch {res.statusCode=400;res.end(JSON.stringify({error:'Datos JSON inválidos.'}));}
    });
  }};
}
export default defineConfig({plugins:[react(),localApi()],server:{port:5173}});
