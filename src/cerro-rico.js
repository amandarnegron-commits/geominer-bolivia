import { squareFromCenter } from './geo.js';

/**
 * FUENTE: CONAE Argentina para coordenadas de referencia del cerro.
 * CONTEXTO: USGS 1996, NASA 2022, SERGEOMIN (visor), UNESCO.
 * No son polígonos geológicos ni catastro y NO contienen anomalías medidas.
 */
export const CERRO_RICO = Object.freeze({
  id: 'cerro-rico-potosi',
  label: 'Cerro Rico de Potosí',
  center: [-65.7497, -19.6189], // [lon, lat], aproximación de la cumbre
  sideKm: 5,
  objective: 'Comparar respuestas espectrales sobre un distrito Ag-Sn conocido; no detectar plata/estaño mediante Sentinel-2',
  bibliography: [
    {
      title: 'CONAE — Cerro Potosí (coordenadas de referencia)',
      agency: 'Comisión Nacional de Actividades Espaciales (Argentina)',
      url: 'https://www.argentina.gob.ar/ciencia/conae/educacion-y-formacion-masiva/materiales-educativos/cerro-potosi-landsat-5-tm-7-de-septiembre-de-2011',
      claim: 'Ubicación de referencia del Cerro Rico; no define límites mineros.'
    },
    {
      title: 'USGS — Edad e historia térmica de Cerro Rico',
      agency: 'United States Geological Survey, Cunningham et al., 1996',
      url: 'https://www.usgs.gov/publications/age-and-thermal-history-cerro-rico-de-potosi-bolivia',
      claim: 'Distrito histórico de plata y estaño con actividad magmática e hidrotermal documentada.'
    },
    {
      title: 'NASA — Potosí y Cerro Rico desde Landsat 8',
      agency: 'NASA Earth Observatory, imagen del 24/11/2022',
      url: 'https://ciencia.nasa.gov/ciencias-terrestres/potosi-y-cerro-rico/',
      claim: 'Vista satelital histórica y evidencia visual de áreas intervenidas; NO representa Sentinel-2 actual.'
    },
    {
      title: 'SERGEOMIN — Geoportal y cartografía oficial',
      agency: 'Servicio Geológico Minero de Bolivia',
      url: 'https://ide.sergeomin.gob.bo/',
      claim: 'Portal oficial y capas WMS regionales disponibles como referencia visual. No se intersectan automáticamente con las anomalías.'
    },
    {
      title: 'UNESCO — Ciudad de Potosí, patrimonio en peligro',
      agency: 'Centro del Patrimonio Mundial UNESCO',
      url: 'https://whc.unesco.org/en/list/420',
      claim: 'Patrimonio protegido y problemas conocidos de estabilidad estructural y riesgos de intervención.'
    }
  ]
});

export function cerroRicoBbox() {
  return squareFromCenter(CERRO_RICO.center[0],CERRO_RICO.center[1],CERRO_RICO.sideKm);
}
export function coversCerroRico(bbox) {
  if(!Array.isArray(bbox)||bbox.length!==4||bbox.some(v=>typeof v!=='number'||!Number.isFinite(v)))return false;
  const [west,south,east,north]=bbox;
  const [lon,lat]=CERRO_RICO.center;
  return west<=lon&&lon<=east&&south<=lat&&lat<=north;
}
export function geologyContextFor(bbox) {
  if(!coversCerroRico(bbox))return null;
  return {
    title: CERRO_RICO.label,
    evidenceType: 'Contexto bibliográfico del distrito; NO intersección con mapas vectoriales locales',
    observedMetals: 'La actividad histórica Ag-Sn está documentada por USGS; no se observa directamente con B4/B2 o B11/B12.',
    caution: 'Las superficies expuestas, escombreras y labores mineras alteran respuestas espectrales y pueden generar falsos positivos.',
    sources:CERRO_RICO.bibliography.map(({title,url,agency})=>({title,url,agency}))
  };
}
