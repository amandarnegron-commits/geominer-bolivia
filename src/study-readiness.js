/** Auditoría de los DATOS obtenidos. Un catálogo de imágenes NO equivale a mineralogía procesada. */
export const SOURCE_LABELS = Object.freeze({
  geology:'Unidades geológicas (WFS)', faults:'Fallas cartografiadas (WFS)',
  anticlines:'Anticlinales (WFS)', synclines:'Sinclinales (WFS)',
  relief:'Perfil de elevaciones (SRTM)', enmap:'EnMAP (solo catálogo)', emit:'EMIT (solo catálogo)'
});

function n(entry){return Number.isInteger(entry?.count)&&entry.count>=0?entry.count:0;}
function hasFeatures(entry){return entry?.status==='ok' && n(entry)>0 && Array.isArray(entry.features?.features) && entry.features.features.length>0;}

export function evidenceAudit({report=null,research=null,matches=[]}={}){
  const s=research?.services||{};
  const hasSpectral=Boolean(report?.scene?.id && report?.grid?.validPixels>0);
  const hasGeology=hasFeatures(s.geology);
  const structures=['faults','anticlines','synclines'].reduce((total,key)=>total+(hasFeatures(s[key])?n(s[key]):0),0);
  const hasProfile=s.relief?.status==='ok' && Array.isArray(s.relief?.points) && s.relief.points.filter(p=>Number.isFinite(p?.elevation)).length>=3;
  const matchesCount=Array.isArray(matches)?matches.length:0;
  const enmapCount=s.enmap?.status==='ok'?n(s.enmap):0;
  const emitCount=s.emit?.status==='ok'?n(s.emit):0;
  const facts=[
    {id:'sentinel',title:'Índices Sentinel-2',status:hasSpectral?'processed':'missing',count:hasSpectral?report.grid.validPixels:0,detail:hasSpectral?'Bandas descargadas y cocientes procesados en el navegador':'Falta analizar la escena Sentinel-2'},
    {id:'geology',title:SOURCE_LABELS.geology,status:s.geology?.status==='unavailable'?'unavailable':hasGeology?'downloaded':s.geology?.status==='ok'?'empty':'not_queried',count:hasGeology?n(s.geology):0,detail:hasGeology?'Polígonos públicos obtenidos: escala regional, NO muestra de campo':s.geology?.status==='ok'?'Consulta válida sin polígonos devueltos':'No se han obtenido polígonos'},
    {id:'structures',title:'Fallas y pliegues',status:structures?'downloaded':['faults','anticlines','synclines'].some(k=>s[k]?.status==='ok')?'empty':'not_queried',count:structures,detail:structures?'Estructuras públicas obtenidas; escala y precisión por verificar':'No se obtuvieron estructuras cartográficas en el cuadro'},
    {id:'relief',title:SOURCE_LABELS.relief,status:hasProfile?'downloaded':s.relief?.status==='unavailable'?'unavailable':s.relief?.status==='ok'?'empty':'not_queried',count:hasProfile?s.relief.points.length:0,detail:hasProfile?'Perfil topográfico; no mide el subsuelo':'No se obtuvo perfil topográfico'},
    {id:'enmap',title:SOURCE_LABELS.enmap,status:s.enmap?.status==='unavailable'?'unavailable':s.enmap?.status==='ok'?(enmapCount?'catalogued':'empty'):'not_queried',count:enmapCount,detail:'Una ficha STAC no implica lectura ni identificación mineral'},
    {id:'emit',title:SOURCE_LABELS.emit,status:s.emit?.status==='unavailable'?'unavailable':s.emit?.status==='ok'?(emitCount?'catalogued':'empty'):'not_queried',count:emitCount,detail:'Una escena CMR no implica que se hayan leído sus productos mineralógicos'}
  ];
  const actions=[];
  if(!hasSpectral)actions.push('Procesar una escena Sentinel-2 del terreno seleccionado.');
  if(!research)actions.push('Ejecutar la investigación automática para consultar geología, estructuras y relieve.');
  else if(!hasGeology)actions.push('Obtener una carta geológica georreferenciada que cubra las coordenadas; la fuente pública no devolvió unidades.');
  if(hasGeology && matchesCount===0 && hasSpectral)actions.push('Contrastar los polígonos cartografiados con los sectores y la escala de la carta.');
  if(!hasProfile)actions.push('Obtener un modelo digital de elevación para producir el perfil topográfico.');
  if(enmapCount>0||emitCount>0)actions.push('Descargar y procesar los productos EnMAP/EMIT disponibles, incluyendo máscaras e incertidumbre; el catálogo no contiene todavía resultados mineralógicos.');
  else actions.push('Comprobar cobertura hiperespectral en otros periodos o continuar con observaciones ópticas y geología documentada.');
  const level=!hasSpectral?'Pendiente de análisis satelital':hasGeology?'Estudio de gabinete con geología regional':'Estudio espectral sin cartografía geológica descargada';
  return {version:'1.4',level,hasSpectral,hasGeology,hasProfile,structures,matchesCount,enmapCount,emitCount,mineralogyProcessed:false,facts,actions:actions.slice(0,5),
    mineralogyNote:'No se ha procesado identificación mineral EnMAP/EMIT. No atribuir minerales a estos sectores por aparición de escenas en un catálogo.'};
}

export function prepareEvidenceBundle({report=null,research=null,matches=[]}={}){
  if(!research?.services)throw new Error('Primero ejecuta la investigación geológica automática.');
  const bbox=Array.isArray(research.area)?research.area:report?.bbox;
  const audit=evidenceAudit({report,research,matches});
  const layers={};
  for(const k of ['geology','faults','anticlines','synclines']){
    const e=research.services[k];
    if(e?.status==='ok'&&Array.isArray(e.features?.features))layers[k]={source:'GeoBolivia / SERGEOTECMIN WFS',count:e.features.features.length,truncated:Boolean(e.truncated),geojson:e.features};
  }
  const summaries={};
  for(const k of ['enmap','emit']){const e=research.services[k];summaries[k]={status:e?.status||'not_queried',count:n(e),scenes:(e?.items||[]).slice(0,8),processed:false};}
  const relief=research.services.relief?.status==='ok'?research.services.relief:null;
  return {type:'GeoMinerResearchBundle',version:'1.4',bbox,queriedAt:research.queriedAt,audit,
    layers,relief,sceneCatalogues:summaries,sourceDescriptions:research.sources||{},
    disclaimer:'Información geológica y topográfica externa no auditada. Catálogos hiperespectrales sin procesar; no identifica ley ni reservas.'};
}
