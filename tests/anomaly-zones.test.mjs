import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAnomalyZones,zonesToGeoJSON } from '../src/anomaly-zones.js';
import { prepareReport } from '../src/report-data.js';
import { createAiReport } from '../lib/report-api.js';

const bbox=[-65.78,-19.60,-65.76,-19.58];
function grid(){
 const width=10,height=10;
 const iron=Float32Array.from({length:100},(_,i)=>1+i/1000);
 const clay=Float32Array.from({length:100},(_,i)=>1.0+i/2000);
 // Una zona de 5 celdas en torno a fila 2/3; 8-vecinos conectados.
 for(const i of [22,23,24,32,33])iron[i]=2.4+(i%10)/100;
 return {width,height,iron,clay,valid:100,total:100};
}
test('agrupa píxeles P90 contiguos y ubica su punto de máxima respuesta dentro del polígono',()=>{
 const zones=detectAnomalyZones(grid(),bbox,'iron');
 assert.ok(zones.length>0);
 const first=zones[0];
 assert.equal(first.pixels,5);
 assert.ok(first.lat>=bbox[1] && first.lat<=bbox[3]);
 assert.ok(first.lon>=bbox[0] && first.lon<=bbox[2]);
 assert.ok(first.peakRatio>2.4);
 assert.ok(first.approxAreaKm2>0);
 assert.equal(first.number,1);
});
test('no inventa sectores con índices homogéneos, cuadrículas incompletas o pocos píxeles válidos',()=>{
 const base=grid();
 const flat={...base,iron:Float32Array.from({length:100},()=>1.3)};
 assert.equal(detectAnomalyZones(flat,bbox,'iron').length,0);
 assert.equal(detectAnomalyZones({...base,clay:new Float32Array(8)},bbox,'clay').length,0);
 const invalid={...base,iron:Float32Array.from({length:100},()=>NaN)};
 assert.equal(detectAnomalyZones(invalid,bbox,'iron').length,0);
});
test('GeoJSON conserva el índice, el punto GPS y la advertencia',()=>{
 const zones=detectAnomalyZones(grid(),bbox,'iron');
 const exported=zonesToGeoJSON(zones,{kind:'iron',sceneId:'escena-prueba'});
 assert.equal(exported.type,'FeatureCollection');
 assert.deepEqual(exported.features[0].geometry.coordinates,[zones[0].lon,zones[0].lat]);
 assert.equal(exported.features[0].properties.sceneId,'escena-prueba');
 assert.match(exported.features[0].properties.disclaimer,/NO es mineral/);
});
test('el PDF obtiene sectores de ambas bandas desde datos numéricos, sin API',()=>{
 const report=prepareReport({bbox,region:'Potosí',scene:{id:'sentinel-2-l2a-2026-10-18',date:'2026-10-18T10:00:00Z',platform:'sentinel-2a',cloud:0},result:grid()});
 assert.equal(report.version,'0.7');
 assert.ok(report.zones.iron.length>0);
 assert.equal(report.zones.iron[0].lat,detectAnomalyZones(grid(),bbox,'iron')[0].lat);
 assert.match(report.methods.join(' '),/al menos 3 píxeles/);
});
test('la IA acepta variables de Amanda en minúsculas y recibe solo sectores validados',async()=>{
 const report=prepareReport({bbox,region:'Potosí',scene:{id:'sentinel-2-l2a-2026-10-18',date:'2026-10-18T10:00:00Z',platform:'sentinel-2a',cloud:0},result:grid()});
 let sent;
 const answer=await createAiReport({data:report,passcode:'clave-larga',env:{openai_api_key:'token-ficticio',geominer_admin_code:'clave-larga',GEOMINER_OPENAI_MODEL:'modelo-prueba'},transport:async(url,options)=>{
   sent=JSON.parse(options.body);
   assert.match(options.headers.Authorization,/token-ficticio/);
   return {ok:true,json:async()=>({output_text:'Análisis orientativo de sectores.',usage:{input_tokens:100,output_tokens:40}})};
 }});
 assert.equal(answer.status,200);
 assert.equal(sent.model,'modelo-prueba');
 assert.equal(sent.store,false);
 assert.ok(sent.input.includes('zones'));
 assert.ok(!sent.input.includes('token-ficticio'));
});
