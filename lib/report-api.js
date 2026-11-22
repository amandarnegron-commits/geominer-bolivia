import { timingSafeEqual } from 'node:crypto';
import { coversCerroRico } from '../src/cerro-rico.js';

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
  if(!numberOk(data.grid?.validPixels,1,300000)||!numberOk(data.grid?.totalPixels,1,300000)||data.grid.validPixels>data.grid.totalPixels)throw new Error('Datos de cuadrícula inválidos.');
  for(const kind of ['iron','clay']){
    const row=data.indices?.[kind];
    if(!row||!numberOk(row.p50,0,20)||!numberOk(row.p75,0,20)||!numberOk(row.p90,0,20)||row.p90<row.p75||row.p75<row.p50)throw new Error('Estadísticas espectrales inválidas.');
  }
  const safeZones = {};
  for(const kind of ['iron','clay']){
    const rawZones = Array.isArray(data.zones?.[kind]) ? data.zones[kind].slice(0,6) : [];
    safeZones[kind] = rawZones.filter(z =>
      z && Number.isInteger(z.number) && z.number>=1 && z.number<=25 &&
      numberOk(z.lat,b[1],b[3]) && numberOk(z.lon,b[0],b[2]) &&
      numberOk(z.peakRatio,0,20) && Number.isInteger(z.pixels) &&
      z.pixels>=3 && z.pixels<=data.grid.totalPixels
    ).map(z=>({number:z.number,lat:z.lat,lon:z.lon,peakRatio:z.peakRatio,pixels:z.pixels}));
  }
  const additional={};
  for(const k of ['ferrous','rededge']){const val=data.indices?.[k];
    if(val&&numberOk(val.p50,0,20)&&numberOk(val.p90,0,20)&&val.p90>=val.p50){
      additional[k]={formula:k==='ferrous'?'B11/B8A':'B7/B5',p50:val.p50,p90:val.p90};
    }
  }
  let control=null;
  const rawControl=data.control;
  if(rawControl&&['W','E','N','S'].includes(rawControl.direction)&&Array.isArray(rawControl.bbox)&&rawControl.bbox.length===4&&
     rawControl.bbox.every((v,i)=>numberOk(v,i%2===0?-180:-90,i%2===0?180:90))){
    const ci={};let valid=true;
    for(const k of ['iron','clay']){const v=rawControl.indices?.[k];
      if(!v||!numberOk(v.mainP50,0,20)||!numberOk(v.controlP50,0,20)||!numberOk(v.mainP90,0,20)||!numberOk(v.controlP90,0,20)){valid=false;break;}
      ci[k]={mainP50:v.mainP50,controlP50:v.controlP50,mainP90:v.mainP90,controlP90:v.controlP90};
    }
    if(valid)control={direction:rawControl.direction,bbox:rawControl.bbox,indices:ci,
      meaning:'Comparacion DESCRIPTIVA con terreno adyacente no emparejado, NO discriminacion de mineral.'};
  }
  let temporal=null;
  const rt=data.temporal;
  if(rt && typeof rt==='object' && !Array.isArray(rt)) {
    const g=rt.grid;
    const metrics={};
    const validGrid=g && Number.isInteger(g.sharedValid)&&g.sharedValid>=0&&g.sharedValid<=data.grid.totalPixels && g.total===data.grid.totalPixels;
    const validScene=typeof rt.secondSceneId==='string'&&rt.secondSceneId.length>=3&&rt.secondSceneId.length<=240&&rt.secondSceneId!==data.scene.id &&
      typeof rt.secondDate==='string'&&Number.isFinite(Date.parse(rt.secondDate));
    if(validGrid&&validScene){
      let valid=true;
      for(const k of ['iron','clay']){
        const m=rt.metrics?.[k];
        if(!m || !(m.jaccard===null || numberOk(m.jaccard,0,1)) ||
           !Number.isInteger(m.overlapPixels)||!Number.isInteger(m.unionPixels)||
           m.overlapPixels<0||m.unionPixels<m.overlapPixels||m.unionPixels>g.sharedValid){valid=false;break;}
        metrics[k]={jaccard:m.jaccard,overlapPixels:m.overlapPixels,unionPixels:m.unionPixels};
      }
      if(valid)temporal={secondDate:rt.secondDate.slice(0,36),secondSceneId:rt.secondSceneId,sharedValid:g.sharedValid,total:g.total,metrics,
        meaning:'Coincidencia de celdas P90 entre escenas; NO verifica depósitos minerales.'};
    }
  }
  const context = coversCerroRico(b) ? {
    location:'Distrito Cerro Rico de Potosí: referencia geográfica de cumbre contenida en el rectángulo.',
    historical:'USGS 1996 documenta mineralización histórica de plata y estaño asociada a un sistema magmático-hidrotermal.',
    source:'https://www.usgs.gov/publications/age-and-thermal-history-cerro-rico-de-potosi-bolivia',
    limitation:'Este contexto describe el distrito, NO prueba correspondencia entre píxeles P90, vetas, escombreras ni minerales; el área presenta protección patrimonial e inestabilidad.'
  } : null;
  // El dictamen declarado por el navegador es informativo; no sustituye validacion independiente.
  // Ignorar campos ajenos y mantener invariables los limites sobre mineral y economia.
  const rawDecision=data.decision;
  let decision=null;
  if(rawDecision && typeof rawDecision==='object' && !Array.isArray(rawDecision)){
    const acceptable=['Alta','Media','Inicial','Por verificar'];
    const dz=(Array.isArray(rawDecision.zones)?rawDecision.zones:[]).slice(0,12).filter(z=>
      z&&['iron','clay'].includes(z.kind)&&Number.isInteger(z.number)&&z.number>=1&&z.number<=25&&
      acceptable.includes(z.priority)&&numberOk(z.lon,b[0],b[2])&&numberOk(z.lat,b[1],b[3])&&
      ['si','no','sin_datos'].includes(z.cooccurrence)&&['si','no','sin_datos','no_evaluado'].includes(z.temporal)
    ).map(z=>({kind:z.kind,number:z.number,lat:z.lat,lon:z.lon,priority:z.priority,cooccurrence:z.cooccurrence,temporal:z.temporal}));
    const count=safeZones.iron.length+safeZones.clay.length;
    decision={spectralAnswer:data.grid.validPixels/data.grid.totalPixels<0.3?'NO EVALUABLE: cobertura util insuficiente':count>0?'SI: se observaron grupos P90 de respuesta elevada':'No se recibieron sectores P90 para el dictamen',
      districtEvidence:context?'SI: mineralizacion historica documentada en Cerro Rico (distrito), no demostrada en los puntos':'Sin prueba geologica independiente del distrito',
      mineralAnswer:'NO CONFIRMADO por los indices espectrales',
      economicAnswer:'NO EVALUADO; faltan leyes y tonelajes',zones:dz};
  }
  return {
    decision,
    geologicalContext:context,
    temporal,control,additional,
    resolution:{gridWidth:data.grid.width??null,gridHeight:data.grid.height??null,
      cellWidthMeters:numberOk(data.grid.cellWidthMeters,1,200)?data.grid.cellWidthMeters:null,
      cellHeightMeters:numberOk(data.grid.cellHeightMeters,1,200)?data.grid.cellHeightMeters:null,
      resampled20m:Boolean(data.grid.upsampled20mBands)},
    region:String(data.region||'Bolivia').slice(0,80),
    bbox:b,
    areaKm2:Number(area.toFixed(2)),
    scene:{id:data.scene.id,date:data.scene.date.slice(0,36),platform:String(data.scene.platform||'Sentinel-2').slice(0,60),cloudPct:numberOk(data.scene.cloudPct,0,100)?data.scene.cloudPct:null},
    grid:{validPixels:data.grid.validPixels,totalPixels:data.grid.totalPixels},
    zones:safeZones,
    indices:{iron:{p50:data.indices.iron.p50,p75:data.indices.iron.p75,p90:data.indices.iron.p90},clay:{p50:data.indices.clay.p50,p75:data.indices.clay.p75,p90:data.indices.clay.p90}}
  };
}
export function extractAnswer(response){
  if(typeof response?.output_text==='string' && response.output_text.trim())return response.output_text.trim();
  const parts=(response?.output||[]).flatMap(item=>(item.content||[]).map(part=>part.type==='output_text'?part.text:'')).filter(Boolean);
  return parts.join('\n').trim();
}
const INSTRUCTIONS = `Actúas como analista técnico de GeoMiner Bolivia. Redacta EN ESPAÑOL un DICTAMEN OPERATIVO concreto, sin publicidad y sin conclusiones infundadas. Usa exactamente estas secciones en este orden: 1. Dictamen en tres respuestas; 2. Sectores a revisar primero; 3. Evidencia a favor y posibles falsas señales; 4. Próximo paso técnico; 5. Alcance de la conclusión. En el primer apartado responde explícitamente y en pocas palabras: A) ¿Hay sectores de respuesta espectral elevada? Reproduce decision.spectralAnswer. B) ¿Hay mineralización históricamente documentada EN EL DISTRITO? Reproduce decision.districtEvidence; no infieras que hay mineral en cada marcador. C) ¿Se confirmó plata, estaño u otra mena en los sectores? NO, no hay prueba suficiente con estos índices. D) ¿Se evaluó potencial económico? NO, faltan leyes, tonelaje, continuidad, profundidad, recuperación y costos. No uses la expresión engañosa 'no hay minerales': ausencia de evidencia NO es evidencia de ausencia.
En sectores, utiliza SOLO los datos enumerados en decision.zones: enuncia prioridad de REVISION, coordenadas y por qué es Alta/Media/Inicial/Por verificar; si existen dos índices elevados y coincidencia entre fechas, dilo con precisión y sin llamarlo probabilidad de mineral. La prioridad es una REGLA DE CRIBADO EXPLORATORIO, no una predicción calibrada ni una recomendación de ingresar o perforar. No confundas un lugar minero conocido con una anomalía mineral validada. Advierte explícitamente las escombreras, labores mineras, polvo, sombra, relieve, humedad y mezcla de pixeles, relevantes en Cerro Rico. Si tienes datos de comparación temporal o área vecina, explica lo que aportan y lo que NO aportan; Jaccard no es precisión de detección. B4/B2 es respuesta superficial férrica no específica y B11/B12 respuesta SWIR no específica; bandas nativas SWIR de 20 m, aunque remuestreadas a 10 m. La miniatura de falso color opcional tampoco confirma minerales. Usa solamente contexto geológico explícito entregado por el servidor; no inventes geología ni reconocimiento independiente. Propón una siguiente acción VIABLE: superponer datos geológicos detallados, verificar antecedentes y muestras autorizadas con profesional; Cerro Rico es patrimonio protegido e inestable, no recomendar ingreso libre. Mantén una sola advertencia concisa al final, no repitas limitaciones en cada párrafo. Máximo 420 palabras. No uses tablas ni cifras de probabilidad de mineral.`;

export async function createAiReport({data,passcode,preview=null,env=process.env,transport=fetch}) {
  const apiKey=env.OPENAI_API_KEY || env.openai_api_key;
  const adminSecret=env.GEOMINER_ADMIN_CODE || env.geominer_admin_code;
  if(!apiKey || !adminSecret) return {status:503,body:{error:'La IA no está configurada. Puedes descargar el informe técnico sin IA.'}};
  if(!validSecret(passcode,adminSecret)) return {status:401,body:{error:'Código de acceso incorrecto.'}};
  let safe;
  try {safe=validate(data);} catch(e){return {status:400,body:{error:e.message}};}
  const model=env.GEOMINER_OPENAI_MODEL||env.geominer_openai_model||'gpt-6-luna';
  // Solo un data URI JPEG de miniatura acotada; nunca se aceptan URLs remotas del cliente.
  const imageOk=typeof preview==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(preview)&&preview.length<80000;
  if(preview!=null&&!imageOk)return {status:400,body:{error:'Miniatura inválida; activa la IA sin imagen.'}};
  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    let reply;
    try {
      const evidence='EVIDENCIA NUMÉRICA NO VERIFICADA INDEPENDIENTEMENTE:\n'+JSON.stringify(safe);
      const input=imageOk?[{role:'user',content:[{type:'input_text',text:evidence},{type:'input_image',image_url:preview,detail:'low'}]}]:evidence;
      reply=await transport('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body:JSON.stringify({model,store:false,reasoning:{effort:'none'},max_output_tokens:1800,instructions:INSTRUCTIONS,input}),
        signal:controller.signal
      });
    } finally {clearTimeout(timer);}
    if(!reply.ok){
      if(reply.status===401 || reply.status===403)return {status:502,body:{error:'La clave API de OpenAI no tiene acceso. Verifica la configuración en Vercel.'}};
      if((reply.status===400||reply.status===422)&&imageOk)return {status:502,body:{error:'OpenAI no aceptó la miniatura con este modelo. Desactiva la casilla de imagen y vuelve a generar.'}};
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
