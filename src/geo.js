// Geometría WGS84. La selección es un rectángulo indicativo, no un catastro minero.
export function squareFromCenter(lon, lat, sideKm) {
  const x = Number(lon), y = Number(lat), s = Number(sideKm);
  if (![x,y,s].every(Number.isFinite) || x < -180 || x > 180 || y < -85 || y > 85 || s < .1 || s > 50) {
    throw new Error('Ingresa longitud, latitud y un lado de 0,1 a 50 km.');
  }
  const latHalf = s / 2 / 111.32;
  const lonHalf = s / 2 / (111.32 * Math.cos(y * Math.PI / 180));
  return [x-lonHalf,y-latHalf,x+lonHalf,y+latHalf].map(v => Number(v.toFixed(6)));
}
export function bboxGeoJSON(bbox) {
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) throw new Error('Área no válida');
  const [w,s,e,n] = bbox;
  if (w>=e || s>=n) throw new Error('Área no válida');
  return {
    type:'FeatureCollection',
    features:[{
      type:'Feature',
      properties:{source:'GeoMiner Bolivia',status:'Delimitación preliminar',mineral_detected:false},
      geometry:{type:'Polygon',coordinates:[[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
    }]
  };
}
export function bboxKml(bbox) {
  const [[w,s],[e,n]] = [[bbox[0],bbox[1]],[bbox[2],bbox[3]]];
  if (![w,s,e,n].every(Number.isFinite) || w>=e || s>=n) throw new Error('Área no válida');
  const ring = `${w},${s},0 ${e},${s},0 ${e},${n},0 ${w},${n},0 ${w},${s},0`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>GeoMiner Bolivia - selección preliminar</name><Placemark><name>Área de interés</name><description>Polígono orientativo. No acredita mineralización ni derechos mineros.</description><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
}
