import { createAiReport } from '../lib/report-api.js';

export default async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Solo se permite POST.'});}
  const raw=req.body;
  if(Number(req.headers['content-length']||0)>120000 || (typeof raw==='string'&&raw.length>120000))return res.status(413).json({error:'El estudio supera el tamaño permitido.'});
  let body;
  try{body=typeof raw==='string'?JSON.parse(raw):raw;}catch{return res.status(400).json({error:'JSON inválido.'});}
  const response=await createAiReport({data:body?.report,passcode:req.headers['x-geominer-admin-code'],preview:body?.preview});
  return res.status(response.status).json(response.body);
}
