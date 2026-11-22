/**
 * Intersección local del CENTRO APROXIMADO de sectores con polígonos GeoJSON EPSG:4326.
 * Los polígonos deben haber sido obtenidos/exportados con autorización. GeoMiner
 * no certifica su escala, precisión, autoría ni la mineralogía del sector.
 */
const getText=(p,names)=>{
  if(!p || typeof p!=='object')return null;
  const entries=Object.entries(p);
  for(const name of names){
    const found=entries.find(([k,v])=>k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')===name);
    const text=found?.[1];
    if((typeof text==='string'||typeof text==='number') && String(text).trim())return String(text).trim().slice(0,160);
  }
  return null;
};
function inRing(pt,ring){
  let inside=false;
  if(!Array.isArray(ring)||ring.length<4)return false;
  const [x,y]=pt;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)continue;
    const [xi,yi]=a,[xj,yj]=b;
    if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
function inPolygon(pt,polygon){
  if(!Array.isArray(polygon)||!polygon.length||!inRing(pt,polygon[0]))return false;
  for(let i=1;i<polygon.length;i++)if(inRing(pt,polygon[i]))return false;
  return true;
}
export function pointInGeologyGeometry(pt,geometry){
  if(geometry?.type==='Polygon')return inPolygon(pt,geometry.coordinates);
  if(geometry?.type==='MultiPolygon')return Array.isArray(geometry.coordinates)&&geometry.coordinates.some(poly=>inPolygon(pt,poly));
  return false;
}
export function validateGeologyGeoJSON(data){
  if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('El mapa debe ser un GeoJSON FeatureCollection.');
  if(data.features.length===0||data.features.length>5000)throw new Error('El mapa debe contener de 1 a 5.000 entidades.');
  const valid=data.features.filter(f=>f?.type==='Feature'&&['Polygon','MultiPolygon'].includes(f.geometry?.type));
  if(!valid.length)throw new Error('Se necesitan polígonos geológicos; no se admiten solo puntos ni líneas.');
  // Validación muestreada de la proyección (lon,lat). Rechaza coordenadas UTM en metros.
  for(const f of valid){
    const coords=f.geometry.type==='Polygon'?f.geometry.coordinates?.[0]?.[0]:f.geometry.coordinates?.[0]?.[0]?.[0];
    if(!Array.isArray(coords)||coords.length<2||!Number.isFinite(coords[0])||!Number.isFinite(coords[1])||Math.abs(coords[0])>180||Math.abs(coords[1])>90)throw new Error('Coordenadas inválidas. Exporta en WGS84 / EPSG:4326 (longitud, latitud).');
  }
  return {type:'FeatureCollection',features:valid};
}
export function matchGeologyToSectors(geojson,zones,source='Capa geológica importada'){
  if(!geojson?.features||!zones)return [];
  const matches=[];
  for(const kind of ['iron','clay'])for(const z of (zones[kind]||[]).slice(0,12)){
    if(!Number.isFinite(z.lon)||!Number.isFinite(z.lat))continue;
    for(const f of geojson.features){
      if(!pointInGeologyGeometry([z.lon,z.lat],f.geometry))continue;
      const p=f.properties||{};
      const unit=getText(p,['unidad','unit','nombre','name','formacion','formation','simbolo','codigo'])||'Unidad sin atributo identificable';
      const lithology=getText(p,['litologia','lithology','roca','rock','descripcion','description'])||'Litología no informada';
      matches.push({kind,number:z.number,lat:z.lat,lon:z.lon,unit,lithology,source:String(source).slice(0,170),status:'INTERSECCIÓN EN CAPA IMPORTADA NO AUDITADA'});
      break; // solo primera entidad en caso de solapamiento; NO equivale a validación
    }
  }
  return matches;
}
