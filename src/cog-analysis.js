import {computeIndices} from './indices.js';
import {gridForProjectedBounds} from './resolution.js';

const REQUIRED=['blue','green','red','nir','swir16','swir22','scl'];
const OPTIONAL=['rededge1','rededge2','rededge3','nir08'];
function utmProjection(epsg){
 const code=Number(String(epsg||'').replace('EPSG:',''));
 if(!((code>=32601&&code<=32660)||(code>=32701&&code<=32760)))throw new Error('La escena no tiene UTM EPSG reconocido.');
 return `+proj=utm +zone=${code%100} ${code>=32701?'+south ':''}+datum=WGS84 +units=m +no_defs +type=crs`;
}
function normalizeValues(values,asset,isScl=false){
 const scale=isScl?1:(Number.isFinite(asset.scale)?asset.scale:0.0001);
 const offset=isScl?0:(Number.isFinite(asset.offset)?asset.offset:0);
 const out=new Float32Array(values.length);
 for(let i=0;i<values.length;i++){
   const v=values[i];out[i]=!Number.isFinite(v)||(asset.nodata!=null&&v===asset.nodata)||v===0 ? NaN : v*scale+offset;
 }
 return out;
}
/** Lee COGs públicos en grilla UTM de 20m o de 10m. SWIR/red-edge y SCL originales son 20m. */
export async function analyseScene(scene,bbox,{resolutionMeters=20,onProgress=()=>{},signal}={}){
 const [{fromUrl},{default:proj4}]=await Promise.all([import('geotiff'),import('proj4')]);
 if(!scene?.assets||!Array.isArray(bbox)||bbox.length!==4)throw new Error('Faltan escena o coordenadas.');
 const [w,s,e,n]=bbox;
 const epsg=scene.epsg||((s<0?32700:32600)+Math.floor((w+180)/6)+1);
 const projection=utmProjection(epsg);
 const corners=[[w,s],[w,n],[e,s],[e,n]].map(p=>proj4('EPSG:4326',projection,p));
 const nativeBox=[Math.min(...corners.map(x=>x[0])),Math.min(...corners.map(x=>x[1])),Math.max(...corners.map(x=>x[0])),Math.max(...corners.map(x=>x[1]))];
 const grid=gridForProjectedBounds(nativeBox,resolutionMeters);
 const sampled={};let completed=0;
 const names=[...REQUIRED,...OPTIONAL.filter(k=>scene.assets[k])];
 for(const name of names){
  if(signal?.aborted)throw new Error('Análisis cancelado.');
  onProgress(`Procesando ${name.toUpperCase()} (${++completed}/${names.length}) · ${grid.width}×${grid.height} px`);
  const asset=scene.assets[name];
  if(!asset)throw new Error('La escena no contiene '+name);
  try{
   const tif=await fromUrl(asset.url,{cacheSize:4*1024*1024});
   const rasters=await tif.readRasters({bbox:nativeBox,width:grid.width,height:grid.height,
      resampleMethod:name==='scl'?'nearest':'bilinear',samples:[0],interleave:false,fillValue:0,signal});
   sampled[name]=normalizeValues(rasters[0],asset,name==='scl');
  }catch(err){
   if(OPTIONAL.includes(name)){onProgress(`Banda opcional ${name} no disponible: se omite.`);continue;}
   throw new Error('No se pudo leer '+name+' (COG público): '+(err?.message||'red, cobertura o CORS')+'. Prueba otra escena o baja a 20 m.');
  }
 }
 onProgress('Combinando bandas y calculando índices multiespectrales…');
 const result=computeIndices(sampled,grid.width,grid.height);
 return {...result,...grid,pixelAreaM2:Number((grid.cellWidthMeters*grid.cellHeightMeters).toFixed(2)),
  resolutionLabel:resolutionMeters===10?'10 m grilla (SWIR/red-edge remuestreadas desde 20 m)':'20 m grilla multibanda',
  spectral:{red:sampled.red,nir:sampled.nir,swir16:sampled.swir16},
  bandsRead:Object.keys(sampled),utmEpsg:epsg};
}
