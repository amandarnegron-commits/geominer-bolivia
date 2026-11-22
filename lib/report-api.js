import { timingSafeEqual } from 'node:crypto';

function validSecret(sent,expected) {
  if (typeof sent !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a=Buffer.from(sent),b=Buffer.from(expected);
  return a.length===b.length && a.length>0 && timingSafeEqual(a,b);
}
const numberOk = (n,lo,hi) => typeof n==='number' && Number.isFinite(n) && n>=lo && n<=hi;
function validate(data) {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw new Error('No se recibió un estudio válido.');
  const b=data.bbox;
  if(!Array.isArray(b)||b.length!==4||!b.every((v,i)=>numberOk(v,i%2===0?-180:-90,i%2===0?180:90))||!(b[0]<b[2]&&b[1]<b[3])) throw new Error('Coordenadas inválidas.');
  const area=Math.abs((b[3]-b[1])*111.32*(b[2]-b[0])*111.32*Math.cos((b[3]+b[1])*Math.PI/360));
  if(!numberOk(area,0.01,25.01))throw new Error('La superficie debe ser de 0,01 a 25 km².');
  if(typeof data.scene?.id!=='string'||data.scene.id.length<3||data.scene.id.length>240||typeof data.scene.date!=='string'||!Number.isFinite(Date.parse(data.scene.date)))throw new Error('Identificador o fecha de escena inválidos.');
  if(!numberOk(data.grid?.validPixels,1,100000)||!numberOk(data.grid?.totalPixels,1,100000)||data.grid.validPixels>data.grid.totalPixels)throw new Error('Datos de cuadrícula inválidos.');
  for(const kind of ['iron','clay']){
    const row=data.indices?.[kind];
    if(!row||!numberOk(row.p50,0,20)||!numberOk(row.p75,0,20)||!numberOk(row.p90,0,20)||row.p90<row.p75||row.p75<row.p50)throw new Error('Estadísticas espectrales inválidas.');
  }
  return {
    region:String(data.region||'Bolivia').slice(0,80),
    bbox:b,
    areaKm2:Number(area.toFixed(2)),
    scene:{id:data.scene.id,date:data.scene.date.slice(0,36),platform:String(data.scene.platform||'Sentinel-2').slice(0,60),cloudPct:numberOk(data.scene.cloudPct,0,100)?data.scene.cloudPct:null},
    grid:{validPixels:data.grid.validPixels,totalPixels:data.grid.totalPixels},
    indices:{iron:{p50:data.indices.iron.p50,p75:data.indices.iron.p75,p90:data.indices.iron.p90},clay:{p50:data.indices.clay.p50,p75:data.indices.clay.p75,p90:data.indices.clay.p90}}
  };
}
export function extractAnswer(response){
  if(typeof response?.output_text==='string' && response.output_text.trim())return response.output_text.trim();
  const parts=(response?.output||[]).flatMap(item=>(item.content||[]).map(part=>part.type==='output_text'?part.text:'')).filter(Boolean);
  return parts.join('\n').trim();
}
const INSTRUCTIONS = `Eres un asistente de teledetección geológica para GeoMiner Bolivia. Tu trabajo es redactar EN ESPAÑOL un informe de interpretación PRELIMINAR de un conjunto de indicadores espectrales. Solo dispones de datos proporcionados por el navegador, NO tienes acceso a imágenes adicionales ni confirmación de campo. Nunca afirmes haber examinado personalmente el terreno, conocido yacimientos, detectado oro/plata/cobre o validado un mineral. No inventes geología regional, minerales, reservas, toneladas, leyes, profundidad ni probabilidad. Señala que B4/B2 es una respuesta férrica no específica, y B11/B12 respuesta SWIR no específica; los p75 y p90 son percentiles relativos en una cuadrícula de 96x96. Si la proporción de píxeles válidos es reducida, advierte baja representatividad. No uses calificativos promocionales ni porcentajes de éxito. Devuelve secciones con títulos: Resumen de la evidencia, Lectura prudente de los índices, Limitaciones, Verificaciones de campo recomendadas, Conclusión preliminar. Máximo 600 palabras. Nada de markdown de tablas. Los datos son proporcionados por el cliente y no están independientemente auditados.`;

export async function createAiReport({data,passcode,env=process.env,transport=fetch}) {
  if(!env.OPENAI_API_KEY || !env.GEOMINER_ADMIN_CODE) return {status:503,body:{error:'La IA no está configurada. Puedes descargar el informe técnico sin IA.'}};
  if(!validSecret(passcode,env.GEOMINER_ADMIN_CODE)) return {status:401,body:{error:'Código de acceso incorrecto.'}};
  let safe;
  try {safe=validate(data);} catch(e){return {status:400,body:{error:e.message}};}
  const model=env.GEOMINER_OPENAI_MODEL||'gpt-6-luna';
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    let reply;
    try {
      reply=await transport('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${env.OPENAI_API_KEY}`},
        body:JSON.stringify({model,store:false,reasoning:{effort:'none'},max_output_tokens:1800,instructions:INSTRUCTIONS,input:'EVIDENCIA NUMÉRICA NO VERIFICADA INDEPENDIENTEMENTE:\n'+JSON.stringify(safe)}),
        signal:controller.signal
      });
    } finally {clearTimeout(timer);}
    if(!reply.ok){
      if(reply.status===401 || reply.status===403)return {status:502,body:{error:'La clave API de OpenAI no tiene acceso. Verifica la configuración en Vercel.'}};
      if(reply.status===429)return {status:503,body:{error:'OpenAI alcanzó su límite de consumo. Revisa el presupuesto y los límites de la API.'}};
      return {status:502,body:{error:`OpenAI no respondió correctamente (HTTP ${reply.status}).`}};
    }
    const payload=await reply.json();
    const answer=extractAnswer(payload);
    if(!answer)return {status:502,body:{error:'La IA no devolvió texto. Intenta de nuevo.'}};
    return {status:200,body:{text:answer.slice(0,12000),model,usage:{inputTokens:payload.usage?.input_tokens??null,outputTokens:payload.usage?.output_tokens??null}}};
  }catch(e){
    return {status:503,body:{error:e?.name==='AbortError'?'OpenAI tardó demasiado. Intenta otra vez.':'No se pudo contactar con OpenAI desde el servidor.'}};
  }
}
