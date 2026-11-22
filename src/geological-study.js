/** Expediente de gabinete. Los anexos escaneados son material declarado, no georreferenciado. */
export const GEO_PLATE_TYPES=Object.freeze([
  {id:'mapa',label:'Mapa geológico'},
  {id:'levantamiento',label:'Levantamientos / travesías'},
  {id:'ocurrencias',label:'Ocurrencias minerales'},
  {id:'perfiles',label:'Perfiles geológicos'},
  {id:'estratigrafia',label:'Columna estratigráfica'},
  {id:'simbolos',label:'Simbología / leyenda'},
  {id:'fotografia',label:'Fotografía / otra evidencia'}
]);
const names=new Set(GEO_PLATE_TYPES.map(x=>x.id));
const clean=(x,n=160)=>typeof x==='string'?x.replace(/[\x00-\x1F\x7F]/g,' ').trim().slice(0,n):'';
export function sanitizePlates(rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(0,8).filter(row=>row&&names.has(row.kind)).map(row=>({
  kind:row.kind,title:clean(row.title,130)||GEO_PLATE_TYPES.find(x=>x.id===row.kind).label,
  source:clean(row.source,180),scale:clean(row.scale,50),notes:clean(row.notes,450),
  imagePresent:Boolean(row.imageData)
 }));
}
export function studySections({plates=[],geoMatches=[],evidence=[],fieldNotes=[],result=null}={}){
 const safe=sanitizePlates(plates);
 const evidenceTypes=new Set((Array.isArray(evidence)?evidence:[]).map(x=>x.type));
 const features=Array.isArray(geoMatches)?geoMatches:[];
 const notes=Array.isArray(fieldNotes)?fieldNotes:[];
 const definitions=[
  {kind:'mapa',title:'Mapa geológico y unidades',related:features.length,extra:features.length?`${features.length} intersecciones de sectores con polígonos GeoJSON declarados por el operador.`:''},
  {kind:'levantamiento',title:'Levantamientos y travesías',related:notes.length,extra:notes.length?`${notes.length} observaciones registradas; ubicación por GPS del sector, no recorrido trazado.`:''},
  {kind:'ocurrencias',title:'Ocurrencias minerales y muestras',related:evidenceTypes.has('registro_muestra')?1:0,extra:evidenceTypes.has('registro_muestra')?'Hay registros declarados de muestra o laboratorio; revisar su fuente y trazabilidad.':''},
  {kind:'perfiles',title:'Perfiles y estructuras geológicas',related:0,extra:''},
  {kind:'estratigrafia',title:'Columna cronoestratigráfica',related:0,extra:''},
  {kind:'simbolos',title:'Simbología y convenciones',related:0,extra:''}
 ];
 return definitions.map(row=>{
  const matches=safe.filter(p=>p.kind===row.kind);
  const sources=matches.map(p=>p.source).filter(Boolean);
  const hasEvidence=matches.length>0||row.related>0;
  return {id:row.kind,title:row.title,status:hasEvidence?'Documentación aportada':'Pendiente de documentación',
   count:matches.length,related:row.related,sources,
   description:hasEvidence?[`${matches.length} lámina(s) aportada(s).`,row.extra].filter(Boolean).join(' '):
     'Sin carta, perfil, recorrido o registro geológico georreferenciado suficiente para elaborar esta sección automáticamente.'};
 });
}
export function reportPlateManifest({plates=[],geoMatches=[],evidence=[],fieldNotes=[]}={}){
 const safe=sanitizePlates(plates);
 return {method:'Fuentes cargadas en navegador por el usuario; fotografías NO georreferenciadas automáticamente.',
   plates:safe,sections:studySections({plates,geoMatches,evidence,fieldNotes})};
}
