/** GeoMiner: consultas de GABINETE a fuentes identificables. No fabrica unidades ni muestras. */
import { normalizeBbox } from './catalog.js';
import { timingSafeEqual } from 'node:crypto';

export const SOURCES={
  geology:'GeoBolivia / SERGEOTECMIN WFS, Mapa Geológico de Bolivia 2000',
  enmap:'DLR EOC STAC · ENMAP_HSI_L2A',
  emit:'NASA Earthdata CMR · EMITL2BMIN',
  relief:'Open Topo Data API pública de prueba · SRTM 90 m'
};
const WFS='https://geo.gob.bo/geoserver/sergeotecmin/wfs';
const ENMAP='https://geoservice.dlr.de/eoc/ogc/stac/v1/search';
const NASA='https://cmr.earthdata.nasa.gov/search/granules.json';
const TOPO='https://api.opentopodata.org/v1/srtm90m';
const WFS_TYPES={geology:'Geologia',faults:'Fallas',anticlines:'Anticlinales',synclines:'Sinclinales'};

function inputArea(raw){
  const result=normalizeBbox(raw);
  if(result.areaKm2>25.02)throw new Error('Esta consulta inicial admite hasta 25 km².');
  return result.bbox;
}
function cleanText(s,max=160){return String(s??'').slice(0,max).replace(/[\x00-\x1F]/g,' ');}
function safeFeature(item){
  if(!item||item.type!=='Feature'||!item.geometry||!['Polygon','MultiPolygon','LineString','MultiLineString','Point','MultiPoint'].includes(item.geometry.type))return null;
  if(!Array.isArray(item.geometry.coordinates))return null;
  const props={};
  Object.entries(item.properties||{}).slice(0,25).forEach(([key,val])=>{
    if(/^[\w áéíóúñÁÉÍÓÚÑ-]{1,45}$/.test(key)&&(typeof val==='string'||typeof val==='number'||typeof val==='boolean'))props[cleanText(key,45)]=typeof val==='string'?cleanText(val,180):val;
  });
  return {type:'Feature',geometry:item.geometry,properties:props};
}
function fc(features=[]){return {type:'FeatureCollection',features};}
async function getJson(url,transport,timeoutMs=7000,maxBytes=1000000){
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await transport(String(url),{signal:controller.signal,headers:{Accept:'application/json, application/geo+json'}});
    if(!response.ok)throw new Error('HTTP '+response.status);
    if(typeof response.text==='function'){
      const body=await response.text();
      if(body.length>maxBytes)throw new Error('Respuesta cartográfica supera el límite seguro');
      try{return JSON.parse(body);}catch{throw new Error('El servicio no devolvió GeoJSON/JSON');}
    }
    if(typeof response.json==='function')return response.json();
    throw new Error('Respuesta sin JSON');
  }finally{clearTimeout(timer);}
}
async function queryWfs(kind,bbox,transport){
  const url=new URL(WFS);
  Object.entries({service:'WFS',version:'1.0.0',request:'GetFeature',typeName:'sergeotecmin:'+WFS_TYPES[kind],
    outputFormat:'application/json',srsName:'EPSG:4326',bbox:bbox.join(','),maxFeatures:'75'}).forEach(([k,v])=>url.searchParams.set(k,v));
  const data=await getJson(url,transport,7500,750000);
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('WFS no devolvió FeatureCollection');
  const features=data.features.slice(0,75).map(safeFeature).filter(Boolean);
  if(kind==='geology'){
    const palette=['#b9a2d1','#e2bb7b','#91bba6','#dd9990','#b9b9d7','#d9d18b','#a5c2d6','#c9aaac'];
    for(const f of features){
      const p=f.properties;
      const matches=Object.entries(p).find(([k,v])=>/unidad|nombre|formacion|codigo|simbolo|geolog|litolog/i.test(k) && (typeof v==='string'||typeof v==='number'));
      const label=cleanText(matches?.[1]||'Unidad cartografica sin atributo',75);
      let h=0;for(const c of label)h=(h*31+c.charCodeAt(0))>>>0;
      p.geominerUnidad=label;p.geominerColor=palette[h%palette.length];
    }
  }
  return {status:'ok',count:features.length,truncated:data.features.length>=75,features:fc(features)};
}
async function queryEnmap(bbox,transport){
  const url=new URL(ENMAP);url.searchParams.set('collections','ENMAP_HSI_L2A');url.searchParams.set('bbox',bbox.join(','));url.searchParams.set('limit','8');
  const data=await getJson(url,transport,7500,850000);
  if(!Array.isArray(data.features))throw new Error('STAC no devolvió escenas');
  return {status:'ok',count:data.features.length,items:data.features.slice(0,8).map(x=>({id:cleanText(x.id,160),date:cleanText(x.properties?.datetime||x.properties?.start_datetime,35),cloud:Number.isFinite(Number(x.properties?.['eo:cloud_cover']))?Number(x.properties['eo:cloud_cover']):null})),note:'Inventario de metadatos; no descarga ni procesa cubos hiperespectrales.'};
}
async function queryEmit(bbox,transport){
  const url=new URL(NASA);url.searchParams.set('short_name','EMITL2BMIN');url.searchParams.set('bounding_box',bbox.join(','));url.searchParams.set('page_size','8');
  const data=await getJson(url,transport,7500,800000);
  if(!Array.isArray(data.feed?.entry))throw new Error('CMR no devolvió inventario');
  return {status:'ok',count:data.feed.entry.length,items:data.feed.entry.map(x=>({id:cleanText(x.id,150),title:cleanText(x.title,160),date:cleanText(x.time_start,35)})),note:'Inventario NASA; descarga y georreferenciación L2B requieren proceso separado y cuenta Earthdata.'};
}
export function profileLocations(bbox,count=23){
  const [w,s,e,n]=bbox;const lat=(s+n)/2;
  return Array.from({length:count},(_,i)=>({lat:Number(lat.toFixed(6)),lon:Number((w+(e-w)*i/(count-1)).toFixed(6))}));
}
export function profileFromResponse(points,data){
  if(!Array.isArray(data?.results)||data.results.length!==points.length)throw new Error('Perfil incompleto');
  const values=data.results.map((r,i)=>({lat:points[i].lat,lon:points[i].lon,elevation:Number.isFinite(Number(r.elevation))&&r.elevation!==null?Number(r.elevation):null,position:i/(points.length-1)}));
  const nums=values.map(p=>p.elevation).filter(Number.isFinite);
  if(nums.length<3)throw new Error('No hay altitudes suficientes para el perfil');
  return {status:'ok',dataset:'SRTM90m',points:values,minMeters:Math.min(...nums),maxMeters:Math.max(...nums),note:'Perfil topográfico aproximado, NO sección geológica de subsuelo.'};
}
async function queryRelief(bbox,transport){
  const points=profileLocations(bbox);
  const url=new URL(TOPO);url.searchParams.set('locations',points.map(p=>p.lat+','+p.lon).join('|'));
  const data=await getJson(url,transport,7500,220000);
  return profileFromResponse(points,data);
}
function unavailable(error){return {status:'unavailable',error:cleanText(error?.message||'Servicio externo no disponible',180)};}
export async function researchArea(rawBbox,{transport=globalThis.fetch}={}){
  const bbox=inputArea(rawBbox);
  const keys=['geology','faults','anticlines','synclines','enmap','emit','relief'];
  const jobs=[...['geology','faults','anticlines','synclines'].map(k=>queryWfs(k,bbox,transport)),queryEnmap(bbox,transport),queryEmit(bbox,transport),queryRelief(bbox,transport)];
  const results=await Promise.allSettled(jobs);
  const services=Object.fromEntries(results.map((r,i)=>[keys[i],r.status==='fulfilled'?r.value:unavailable(r.reason)]));
  return {version:'1.3',area:bbox,queriedAt:new Date().toISOString(),services,sources:{...SOURCES},
    caveat:'Inventario y cartografía de gabinete; la escala, exactitud, cobertura y permisos comerciales deben verificarse. No se generaron columnas estratigráficas ni perfiles subterráneos ficticios.'};
}

/** Control temporal para el prototipo publico. La version comercial requiere usuarios y cuotas persistentes. */
export function researchAccess(code,env=process.env){
  const expected=env.GEOMINER_ADMIN_CODE||env.geominer_admin_code;
  if(!expected)return {status:503,error:'Configura el código privado GeoMiner en Vercel.'};
  if(typeof code!=='string')return {status:401,error:'Introduce el código privado de acceso.'};
  const a=Buffer.from(code),b=Buffer.from(expected);
  if(!a.length||a.length!==b.length||!timingSafeEqual(a,b))return {status:401,error:'Código privado incorrecto.'};
  return null;
}
