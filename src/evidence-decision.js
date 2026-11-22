/**
 * Dictamen OPERATIVO de teledeteccion (GeoMiner 0.9).
 * Responde si HAY senales espectrales y en que sectores hay mas corroboracion
 * espacial/temporal. No modela ni predice presencia de mineralizacion.
 * Reglas transparentes: ninguna puntuacion equivale a probabilidad.
 */
import { statsFor } from './indices.js';

const round = (x, n=4) => Number.isFinite(x) ? Number(x.toFixed(n)) : null;
const validGrid = (a,b) => Boolean(a&&b&&a.width===b.width&&a.height===b.height&&a.iron?.length===b.iron?.length&&a.clay?.length===b.clay?.length);

function zonePixel(zone,bbox,width,height) {
  const [w,s,e,n]=bbox;
  if(!Number.isFinite(zone.lon)||!Number.isFinite(zone.lat))return null;
  const col=Math.floor((zone.lon-w)/(e-w)*width);
  const row=Math.floor((n-zone.lat)/(n-s)*height);
  return col>=0&&col<width&&row>=0&&row<height?{col,row}:null;
}

// Se comprueba vecindad de un maximo ±1 px para reducir sensibilidad al co-registro.
// Esto NO demuestra que la superficie sea un mineral o que el afloramiento sea natural.
function localAbove(values, threshold, center, width,height, radius=1) {
  if(!center || !values || !Number.isFinite(threshold)) return {state:'sin_datos',hits:0,valid:0};
  let valid=0,hits=0;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const y=center.row+dy,x=center.col+dx;
    if(x<0||y<0||x>=width||y>=height)continue;
    const v=values[y*width+x];
    if(!Number.isFinite(v))continue;
    valid++;
    if(v>=threshold)hits++;
  }
  return {state:valid===0?'sin_datos':hits>0?'si':'no',hits,valid};
}

export function buildEvidenceDecision({result,bbox,zones,secondResult=null,geologicalContext=null}) {
  if(!result || !Array.isArray(bbox) || bbox.length!==4 || !result.width || !result.height) return null;
  const quality=result.total?result.valid/result.total:0;
  const comparable=validGrid(result,secondResult);
  const totalZones=(zones?.iron?.length||0)+(zones?.clay?.length||0);
  const stats={iron:statsFor(result.iron),clay:statsFor(result.clay)};
  const secondStats=comparable?{iron:statsFor(secondResult.iron),clay:statsFor(secondResult.clay)}:null;
  const diagnostic=[];
  for(const kind of ['iron','clay']) {
    const other=kind==='iron'?'clay':'iron';
    for(const z of zones?.[kind]||[]) {
      const center=zonePixel(z,bbox,result.width,result.height);
      const otherIndex=localAbove(result[other],stats[other].p90,center,result.width,result.height,1);
      const repeated=comparable?localAbove(secondResult[kind],secondStats[kind].p90,center,result.width,result.height,2):{state:'no_evaluado',hits:0,valid:0};
      const support=(otherIndex.state==='si'?1:0)+(repeated.state==='si'?1:0);
      const enough=quality>=0.3;
      const priority=!enough?'Por verificar':support===2?'Alta':support===1?'Media':'Inicial';
      diagnostic.push({
        kind,number:z.number,lat:z.lat,lon:z.lon,pixels:z.pixels,
        peakRatio:z.peakRatio,priority,
        cooccurrence:otherIndex.state,
        temporal:repeated.state,
        evidenceCount:support,
        note:!enough?'Cobertura útil insuficiente para priorización sólida.':support===2?'Respuesta alta cercana en ambos índices y en otra fecha.':
          support===1?'Existe una corroboración espectral o temporal parcial.':'Solo respuesta relativa elevada en un índice.'
      });
    }
  }
  const level={Alta:0,Media:1,Inicial:2,'Por verificar':3};
  diagnostic.sort((a,b)=>level[a.priority]-level[b.priority]||b.evidenceCount-a.evidenceCount||b.pixels-a.pixels||a.number-b.number);
  const adequate=quality>=0.3;
  const spectralAnswer=adequate?(totalZones>0?'SÍ: hay grupos con respuesta alta relativa al terreno':'NO se detectaron grupos con los criterios aplicados'):'NO EVALUABLE: cobertura útil insuficiente';
  return {
    version:'0.9',spectralAnswer,
    reportedZones:totalZones,
    usablePct:round(quality*100,1),
    temporalAvailable:comparable,
    districtEvidence:geologicalContext?'SÍ: mineralización histórica documentada en el distrito (fuentes externas), no en cada sector':'No se incorporaron pruebas geológicas independientes para el terreno',
    mineralAnswer:'NO DETERMINADO: las bandas actuales no prueban minerales específicos en los sectores',
    economicAnswer:'NO EVALUABLE: sin ensayos, leyes, volúmenes, continuidad ni costos de extracción',
    priorityMethod:'Alta: vecindad P90 en ambos indices y en otra fecha; Media: una corroboracion; Inicial: un solo indice; Por verificar: menos del 30% de pixeles utiles. Prioridad de REVISION REMOTA, no probabilidad de mineral.',
    zones:diagnostic.slice(0,20)
  };
}
