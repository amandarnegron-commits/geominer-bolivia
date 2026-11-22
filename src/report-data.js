import { statsFor, exportTopPoints } from './indices.js';
import {minimumGroupPixels} from './resolution.js';
import { detectAnomalyZones } from './anomaly-zones.js';
import { geologyContextFor } from './cerro-rico.js';
import { buildEvidenceDecision } from './evidence-decision.js';

const fixed = (n, digits = 4) => Number.isFinite(n) ? Number(n.toFixed(digits)) : null;

/** Solo hechos reproducibles: el texto interpretativo lo genera el servidor (opcionalmente). */
export function prepareReport({ bbox, region, scene, result, temporal=null, control=null, secondResult=null }) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !scene?.id || !result?.width || !result?.height)
    throw new Error('Primero delimita un terreno y procesa una escena satelital.');
  const [w,s,e,n] = bbox;
  const area = Math.abs((n-s)*111.32*(e-w)*111.32*Math.cos((n+s)*Math.PI/360));
  const iron = statsFor(result.iron), clay = statsFor(result.clay);
  const fraction = result.total ? result.valid / result.total : 0;
  const geologicalContext=geologyContextFor(bbox);
  const zones={
    iron:detectAnomalyZones(result,bbox,'iron',{minPixels:minimumGroupPixels(result),limit:10}),
    clay:detectAnomalyZones(result,bbox,'clay',{minPixels:minimumGroupPixels(result),limit:10})
  };
  const decision=buildEvidenceDecision({result,bbox,zones,secondResult,geologicalContext});
  return {
    version: '0.9',
    decision,
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
    grid: {width: result.width,height: result.height,validPixels: result.valid,totalPixels: result.total,usablePct: fixed(fraction*100,1),
      requestedMeters:result.requestedMeters||null,cellWidthMeters:result.cellWidthMeters||null,cellHeightMeters:result.cellHeightMeters||null,
      upsampled20mBands:Boolean(result.upsampled20mBands),utmEpsg:result.utmEpsg||null,bandsRead:result.bandsRead||[]},
    indices: {
      iron: {formula:'B4/B2',p50:fixed(iron.p50),p75:fixed(iron.p75),p90:fixed(iron.p90),count:iron.count},
      clay: {formula:'B11/B12',p50:fixed(clay.p50),p75:fixed(clay.p75),p90:fixed(clay.p90),count:clay.count},
      ferrous: result.ferrous?{formula:'B11/B8A',...Object.fromEntries(['p50','p75','p90'].map(k=>[k,fixed(statsFor(result.ferrous)[k])]))}:null,
      rededge: result.rededge?{formula:'B7/B5',...Object.fromEntries(['p50','p75','p90'].map(k=>[k,fixed(statsFor(result.rededge)[k])]))}:null
    },
    geologicalContext,
    temporal,
    control,
    points: {
      iron: exportTopPoints(result,bbox,'iron',5).features.map(x=>({lat:x.geometry.coordinates[1],lon:x.geometry.coordinates[0],ratio:x.properties.ratio})),
      clay: exportTopPoints(result,bbox,'clay',5).features.map(x=>({lat:x.geometry.coordinates[1],lon:x.geometry.coordinates[0],ratio:x.properties.ratio}))
    },
    zones,
    methods: [
      'B4/B2 es un cociente de reflectancias de superficie, indicador exploratorio de respuesta férrica.',
      'B11/B12 es un cociente SWIR que puede responder a varios materiales y condiciones; NO identifica por sí solo minerales de arcilla.',
      'Se enmascararon clases SCL diferentes de suelo descubierto o sin clasificación y píxeles con NDVI >= 0,2.',
      `Cuadrícula UTM ${result.width} x ${result.height}, celda aproximada ${result.cellWidthMeters||'s/d'} x ${result.cellHeightMeters||'s/d'} m; la precisión geográfica depende de reproyección y fuentes.`,
      result.upsampled20mBands?'B11/B12, red-edge y SCL con resolución nativa 20 m fueron remuestreados a la cuadrícula de 10 m. NO aumenta su detalle original.':'Bandas de 10 m fueron remuestreadas a una cuadrícula aproximada de 20 m para comparabilidad.',
      'Composición de falso color B11/B8/B4 y capas WMS regionales son ayudas visuales, no interpretación mineralógica automática.',
      'El percentil 90 es relativo únicamente a esta cuadrícula; no representa ley, reserva ni probabilidad de mineralización.',
      `Sectores = agrupaciones de al menos ${minimumGroupPixels(result)} píxeles vecinos (8 conexiones) con índice >= P90; criterio de área mínima exploratoria ~1200 m2.`,
      'Los sectores son coordenadas indicativas calculadas con proyección UTM y remuestreo; no puntos GPS medidos ni zonas comprobadas.',
      'Comparación de un área vecina NO es ensayo controlado: relieve, escombreras, humedad, vegetación y geología pueden diferir.',
      'Las capas SERGEOMIN/GeoBolivia son regionales y están sujetas a disponibilidad externa; NO se hizo intersección espacial automatizada.'
    ],
    disclaimer: 'Estudio orientativo sin validación de campo. No demuestra presencia, tipo, ley, cantidad, profundidad, valor económico ni derechos mineros.'
  };
}
