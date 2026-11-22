import { statsFor, exportTopPoints } from './indices.js';

const fixed = (n, digits = 4) => Number.isFinite(n) ? Number(n.toFixed(digits)) : null;

/** Solo hechos reproducibles: el texto interpretativo lo genera el servidor (opcionalmente). */
export function prepareReport({ bbox, region, scene, result }) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !scene?.id || !result?.width || !result?.height)
    throw new Error('Primero delimita un terreno y procesa una escena satelital.');
  const [w,s,e,n] = bbox;
  const area = Math.abs((n-s)*111.32*(e-w)*111.32*Math.cos((n+s)*Math.PI/360));
  const iron = statsFor(result.iron), clay = statsFor(result.clay);
  const fraction = result.total ? result.valid / result.total : 0;
  return {
    version: '0.4',
    generatedAt: new Date().toISOString(),
    region: String(region || 'Bolivia').slice(0,80),
    bbox: bbox.map(x => fixed(x,6)),
    areaKm2: fixed(area,2),
    scene: {
      id: String(scene.id).slice(0,240),
      date: String(scene.date || '').slice(0,36),
      platform: String(scene.platform || 'Sentinel-2').slice(0,80),
      cloudPct: Number.isFinite(Number(scene.cloud)) ? fixed(Number(scene.cloud),1) : null,
      source: 'Element 84 Earth Search STAC - Sentinel-2 Collection 1 L2A'
    },
    grid: {width: result.width,height: result.height,validPixels: result.valid,totalPixels: result.total,usablePct: fixed(fraction*100,1)},
    indices: {
      iron: {formula:'B4/B2',p50:fixed(iron.p50),p75:fixed(iron.p75),p90:fixed(iron.p90),count:iron.count},
      clay: {formula:'B11/B12',p50:fixed(clay.p50),p75:fixed(clay.p75),p90:fixed(clay.p90),count:clay.count}
    },
    points: {
      iron: exportTopPoints(result,bbox,'iron',5).features.map(x=>({lat:x.geometry.coordinates[1],lon:x.geometry.coordinates[0],ratio:x.properties.ratio})),
      clay: exportTopPoints(result,bbox,'clay',5).features.map(x=>({lat:x.geometry.coordinates[1],lon:x.geometry.coordinates[0],ratio:x.properties.ratio}))
    },
    methods: [
      'B4/B2 es un cociente de reflectancias de superficie, indicador exploratorio de respuesta férrica.',
      'B11/B12 es un cociente SWIR que puede responder a varios materiales y condiciones; NO identifica por sí solo minerales de arcilla.',
      'Se enmascararon clases SCL diferentes de suelo descubierto o sin clasificación y píxeles con NDVI >= 0,2.',
      'Muestreo reescalado a una cuadrícula de 96 x 96: no equivale a resolución espacial original del satélite.',
      'El percentil 90 es relativo únicamente a esta cuadrícula; no representa ley, reserva ni probabilidad de mineralización.'
    ],
    disclaimer: 'Estudio orientativo sin validación de campo. No demuestra presencia, tipo, ley, cantidad, profundidad, valor económico ni derechos mineros.'
  };
}
