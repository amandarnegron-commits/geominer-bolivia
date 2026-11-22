import { normalizeBbox } from './catalog.js';

// Consulta una colección complementaria con bandas COG públicas y reflectancia L2A.
// NO se confunde con el catálogo Copernicus usado en /api/sentinel.
const SEARCH_URL = 'https://earth-search.aws.element84.com/v1/search';
const REQUIRED = ['blue', 'red', 'nir', 'swir16', 'swir22', 'scl'];
const COG_HOSTS = new Set([
  'e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com',
  'sentinel-cogs.s3.us-west-2.amazonaws.com'
]);
export const MAX_ANALYSIS_AREA_KM2 = 25;

export function safeCogUrl(href) {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && COG_HOSTS.has(url.hostname) && url.pathname.endsWith('.tif') ? url.href : null;
  } catch { return null; }
}
export function normaliseItem(feature) {
  if (!feature || !feature.assets || !feature.properties) return null;
  const assets = {};
  for (const name of REQUIRED) {
    const item = feature.assets[name];
    const url = safeCogUrl(item?.href);
    if (!url) return null;
    const info = item?.['raster:bands']?.[0] || {};
    assets[name] = {
      url,
      scale: Number.isFinite(Number(info.scale)) ? Number(info.scale) : (name === 'scl' ? 1 : 0.0001),
      offset: Number.isFinite(Number(info.offset)) ? Number(info.offset) : 0,
      nodata: typeof info.nodata === 'number' ? info.nodata : null
    };
  }
  const cloud = feature.properties['eo:cloud_cover'];
  const date = feature.properties.datetime;
  if (!date || cloud == null || !Number.isFinite(Number(cloud))) return null;
  return {
    id: feature.id,
    date, cloud: Math.round(Number(cloud)*10)/10,
    platform: feature.properties.platform || 'Sentinel-2',
    epsg: feature.properties['proj:epsg'] || feature.properties['proj:code'] || null,
    assets
  };
}
export function checkArea(rawBbox) {
  const result = normalizeBbox(rawBbox);
  if (result.areaKm2 > MAX_ANALYSIS_AREA_KM2)
    throw new Error('Para el análisis gratuito selecciona un terreno de hasta 25 km² (5 × 5 km).');
  return result;
}
export async function searchAnalysisScenes(rawBbox, transport = globalThis.fetch) {
  const {bbox,areaKm2} = checkArea(rawBbox);
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 86400000);
  const url = new URL(SEARCH_URL);
  url.searchParams.set('collections', 'sentinel-2-c1-l2a');
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('datetime', `${start.toISOString()}/${end.toISOString()}`);
  url.searchParams.set('limit', '100');
  const response = await transport(url.toString(), {
    headers: {Accept:'application/geo+json, application/json'},
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`El catálogo Earth Search no respondió (HTTP ${response.status}).`);
  const data = await response.json();
  const scenes = (data.features || []).map(normaliseItem).filter(Boolean)
    .sort((a,b) => a.cloud - b.cloud || b.date.localeCompare(a.date))
    .slice(0,8);
  return {
    scenes, areaKm2,
    source: 'Element 84 Earth Search v1 · Sentinel-2 Collection 1 L2A (COGs públicos)',
    note: 'Los datos multiespectrales se descargan desde archivos COG públicos. La nubosidad se reporta para la escena completa, no para el terreno.',
    examined: Array.isArray(data.features)?data.features.length:0
  };
}
