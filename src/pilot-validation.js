import { statsFor, INDICATORS } from './indices.js';

/** Comparación temporal de respuestas P90 en cuadrículas co-registradas del mismo terreno.
 * No permite estimar precisión, probabilidad de depósito, ni validar minerales.
 */
export function compareSpectralResults(a,b) {
  if(!a||!b||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width!==b.width||a.height!==b.height)
    throw new Error('Las escenas deben tener una cuadrícula idéntica y un terreno común.');
  const length=a.width*a.height;
  if(length>300000||!['iron','clay'].every(k=>a[k]?.length===length&&b[k]?.length===length))throw new Error('Índices no comparables.');
  const shared=new Uint8Array(length);
  let n=0;
  for(let i=0;i<length;i++) {
    if(['iron','clay'].every(k=>Number.isFinite(a[k][i])&&Number.isFinite(b[k][i]))) {shared[i]=1;n++;}
  }
  const output={grid:{width:a.width,height:a.height,sharedValid:n,total:length,sharedPct:Number((100*n/length).toFixed(1))},metrics:{}};
  for(const kind of ['iron','clay']) {
    // Umbrales relativos a los píxeles válidos compartidos, para evitar comparar máscaras de distinta extensión.
    const va=[],vb=[];
    for(let i=0;i<length;i++) if(shared[i]){va.push(a[kind][i]);vb.push(b[kind][i]);}
    const aStats=statsFor(va),bStats=statsFor(vb);
    const t1=aStats.p90,t2=bStats.p90;
    const hasContrast=n>=10 && Number.isFinite(t1)&&Number.isFinite(t2) && (t1-aStats.p50)>1e-5 && (t2-bStats.p50)>1e-5;
    let intersect=0,union=0,first=0,second=0;
    if(hasContrast)for(let i=0;i<length;i++){
      if(!shared[i])continue;
      const x=a[kind][i]>=t1,y=b[kind][i]>=t2;
      if(x)first++; if(y)second++; if(x||y)union++; if(x&&y)intersect++;
    }
    output.metrics[kind]={
      firstThreshold: hasContrast?Number(t1.toFixed(4)):null,
      secondThreshold:hasContrast?Number(t2.toFixed(4)):null,
      firstHigh:first,secondHigh:second,
      overlapPixels:intersect,unionPixels:union,
      jaccard:union>0?Number((intersect/union).toFixed(3)):null
    };
  }
  output.warning='Coincidencia P90 entre fechas, no verificación de minerales; cambios pueden deberse a suelo removido, iluminación, humedad, atmósfera y registro espacial.';
  return output;
}

export const FIELD_STATUSES=Object.freeze([
  {value:'sin_verificar',label:'Sin verificación de campo'},
  {value:'revisado_remotamente',label:'Revisión remota de imágenes / mapas'},
  {value:'observacion_reportada',label:'Observación declarada por colaborador'},
  {value:'no_concluyente',label:'Sin evidencia concluyente / acceso no disponible'}
]);

export function noteKey({bbox,sceneId,indicator,zoneId}) {
  if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||typeof sceneId!=='string'||!sceneId||!Object.hasOwn(INDICATORS,indicator)||!zoneId)
    throw new Error('Se requiere escena, terreno e identificador de sector.');
  return JSON.stringify([bbox.map(v=>Number(v.toFixed(5))),sceneId,indicator,zoneId]);
}
export function normalizeFieldNote({bbox,sceneId,indicator,zone,status,notes=''}) {
  if(!FIELD_STATUSES.some(x=>x.value===status))throw new Error('Estado de revisión no válido.');
  if(!zone||!Number.isFinite(zone.lat)||!Number.isFinite(zone.lon)||!Number.isFinite(zone.peakRatio))throw new Error('Selecciona un sector calculado.');
  const key=noteKey({bbox,sceneId,indicator,zoneId:zone.id});
  return {
    key,sceneId,indicator,zoneId:zone.id,number:zone.number,lat:zone.lat,lon:zone.lon,
    status,notes:String(notes).trim().slice(0,500),
    method:'Declaración manual no auditada. Las coordenadas son aproximadas.',
    timestamp:new Date().toISOString()
  };
}
export function exportValidationBundle({bbox,sceneId,comparison,notes=[]}){
  return {
    schemaVersion:'GeoMiner-validation-v0.7',
    generatedAt:new Date().toISOString(),
    bbox: Array.isArray(bbox)?bbox.map(n=>Number(n.toFixed(6))):null,
    firstScene:sceneId,comparison:comparison||null,
    fieldNotes:notes.filter(n=>n&&typeof n.key==='string'),
    disclaimer:'Notas del operador sin auditoría independiente. Un contraste temporal no confirma mineralización ni sustituye permisos y verificación en terreno.'
  };
}
