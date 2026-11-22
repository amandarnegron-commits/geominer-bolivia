import { computeIndices } from './indices.js';

const BAND_NAMES = ['blue','red','nir','swir16','swir22','scl'];
const SIZE = 96; // Muestreo general de 96x96; no equivale a resolución original de 10/20 m.

function asUtmProjection(epsg) {
  const code = Number(String(epsg||'').replace('EPSG:', ''));
  const north = code>=32601 && code<=32660;
  const south = code>=32701 && code<=32760;
  if(!north&&!south) throw new Error('Esta escena no tiene referencia UTM EPSG compatible con el procesador inicial.');
  return `+proj=utm +zone=${code%100} ${south?'+south ':''}+datum=WGS84 +units=m +no_defs +type=crs`;
}
function normalizeValues(values,asset) {
  const scale = Number.isFinite(asset.scale) ? asset.scale : 0.0001;
  const offset = Number.isFinite(asset.offset) ? asset.offset : 0;
  const out = new Float32Array(values.length);
  for(let i=0;i<values.length;i++) {
    const v=values[i];
    out[i] = !Number.isFinite(v) || (asset.nodata != null && v===asset.nodata) || v===0
      ? NaN : v*scale+offset;
  }
  return out;
}
export async function analyseScene(scene,bbox,{onProgress=()=>{},signal}={}) {
  const [{fromUrl}, {default:proj4}] = await Promise.all([import('geotiff'),import('proj4')]);
  const [w,s,e,n] = bbox;
  const projected = asUtmProjection(scene.epsg || (s<0 ? 32700:32600) + Math.floor((w+180)/6)+1);
  // Proyectar las 4 esquinas evita el error que causa tratar grados como metros.
  const corners=[[w,s],[w,n],[e,s],[e,n]].map(p=>proj4('EPSG:4326',projected,p));
  const nativeBox=[Math.min(...corners.map(x=>x[0])),Math.min(...corners.map(x=>x[1])),
    Math.max(...corners.map(x=>x[0])),Math.max(...corners.map(x=>x[1]))];
  const sampled={};
  let completed=0;
  // Secuencial para no saturar la memoria o la red de equipos modestos.
  for(const name of BAND_NAMES) {
    if(signal?.aborted) throw new Error('Análisis cancelado.');
    onProgress(`Leyendo banda ${name.toUpperCase()} (${completed+1}/${BAND_NAMES.length})`);
    const asset=scene.assets[name];
    if(!asset) throw new Error('La escena no contiene la banda '+name);
    try {
      const tiff=await fromUrl(asset.url,{cacheSize:4*1024*1024});
      const rasters=await tiff.readRasters({
        bbox:nativeBox,width:SIZE,height:SIZE,
        resampleMethod:name==='scl'?'nearest':'bilinear',
        samples:[0],interleave:false,fillValue:0,signal
      });
      sampled[name]=normalizeValues(rasters[0],asset);
    } catch(err){
      throw new Error('No se pudo leer '+name.toUpperCase()+' desde COG público ('+(err?.message||'red o CORS')+'). Prueba otra escena.');
    }
    completed++;
  }
  onProgress('Calculando índices y excluyendo nubes, agua y vegetación…');
  return computeIndices(sampled,SIZE,SIZE);
}
