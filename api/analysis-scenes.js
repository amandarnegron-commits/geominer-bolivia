import { searchAnalysisScenes } from '../lib/analysis-catalog.js';

export default async function handler(req,res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  if(req.method!=='GET') {
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Método no permitido'});
  }
  try {
    return res.status(200).json(await searchAnalysisScenes(req.query?.bbox));
  } catch(err) {
    const message = err?.message || 'No fue posible consultar imágenes espectrales';
    return res.status(/selecciona|terreno|esquinas|límite|válidos|pequeño|hasta 25/i.test(message)?400:503).json({error:message});
  }
}
