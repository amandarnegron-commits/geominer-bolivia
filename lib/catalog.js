// Motor compartido por el API de Vercel y por el servidor Vite en desarrollo.
// Esta primera etapa consulta solo METADATOS de escenas: no calcula minerales.
const COPERNICUS_STAC = 'https://stac.dataspace.copernicus.eu/v1/search';

export function normalizeBbox(value) {
  const bbox = String(value || '').split(',').map(Number);
  if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) {
    throw new Error('Selecciona primero dos esquinas de un terreno.');
  }
  const [west, south, east, north] = bbox;
  if (west >= east || south >= north || west < -180 || east > 180 || south < -90 || north > 90) {
    throw new Error('Los límites geográficos de la selección no son válidos.');
  }
  const areaKm2 = Math.abs((north - south) * 111.32 * (east - west) * 111.32 * Math.cos(((north + south) / 2) * Math.PI / 180));
  if (areaKm2 > 2500) {
    throw new Error('Para esta versión el terreno no puede superar 2.500 km². Acerca el mapa.');
  }
  if (areaKm2 < 0.01) {
    throw new Error('El terreno es demasiado pequeño. Selecciona una superficie mayor.');
  }
  return { bbox, areaKm2: Math.round(areaKm2 * 100) / 100 };
}

export async function searchSentinel(rawBbox) {
  const { bbox, areaKm2 } = normalizeBbox(rawBbox);
  const end = new Date();
  const start = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const url = new URL(COPERNICUS_STAC);
  url.searchParams.set('collections', 'sentinel-2-l2a');
  url.searchParams.set('bbox', bbox.join(','));
  url.searchParams.set('datetime', start.toISOString() + '/' + end.toISOString());
  url.searchParams.set('limit', '60');

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/geo+json, application/json' },
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) {
    throw new Error('Copernicus no respondió correctamente (HTTP ' + response.status + '). Intenta de nuevo.');
  }
  const json = await response.json();
  const scenes = (json.features || []).map(item => ({
    id: item.id,
    date: item.properties?.datetime || item.properties?.start_datetime || null,
    cloud: Number.isFinite(Number(item.properties?.['eo:cloud_cover']))
      && item.properties?.['eo:cloud_cover'] != null
      ? Math.round(Number(item.properties['eo:cloud_cover']) * 10) / 10 : null,
    platform: item.properties?.platform || 'Sentinel-2',
    collection: item.collection || 'sentinel-2-l2a'
  })).filter(scene => scene.date).sort((a,b) => a.cloud === null ? 1 : b.cloud === null ? -1 : (a.cloud-b.cloud) || (new Date(b.date)-new Date(a.date))).slice(0,12);
  return {
    scenes, areaKm2, examined: Array.isArray(json.features) ? json.features.length : 0,
    source: 'Copernicus Data Space Ecosystem — catálogo STAC Sentinel-2 L2A',
    note: 'Estas escenas son metadatos oficiales. No se ha realizado un análisis espectral ni una detección mineral.',
    updatedAt: new Date().toISOString()
  };
}
