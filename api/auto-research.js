import { researchArea, researchAccess } from '../lib/auto-research.js';
export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Solo GET'});
  const denied=researchAccess(req.headers?.['x-geominer-admin-code']);
  if(denied)return res.status(denied.status).json({error:denied.error});
  try{return res.status(200).json(await researchArea(req.query?.bbox));}
  catch(error){return res.status(400).json({error:error?.message||'Coordenadas inválidas'});}
}
