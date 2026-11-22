import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReport } from '../src/report-data.js';
import { createAiReport,extractAnswer } from '../lib/report-api.js';

const sampleResult={width:2,height:2,valid:4,total:4,iron:Float32Array.from([1,1.5,2,2.5]),clay:Float32Array.from([1,1.1,1.2,1.3])};
const data=prepareReport({bbox:[-65.78,-19.60,-65.76,-19.58],region:'Área GPS',scene:{id:'sentinel-2-2026-11-18',date:'2026-11-18T12:00:00Z',platform:'sentinel-2b',cloud:2},result:sampleResult});
test('informe numérico conserva datos observados, coordenadas y limitaciones',()=>{assert.equal(data.scene.cloudPct,2);assert.equal(data.grid.validPixels,4);assert.ok(data.indices.iron.p90>=data.indices.iron.p75);assert.equal(data.points.iron.length,1);assert.match(data.disclaimer,/No demuestra/i);});
test('sin configuración API no se hacen llamadas facturables',async()=>{const r=await createAiReport({data,passcode:'demo',env:{},transport:()=>{throw Error('no llamar')}});assert.equal(r.status,503);});
test('clave incorrecta bloquea llamadas externas',async()=>{let calls=0;const r=await createAiReport({data,passcode:'wrong',env:{OPENAI_API_KEY:'test',GEOMINER_ADMIN_CODE:'admin-secret'},transport:()=>{calls++;}});assert.equal(r.status,401);assert.equal(calls,0);});
test('envía estadísticas limitadas y store false en Responses API',async()=>{
  let request;
  const r=await createAiReport({data,passcode:'admin-secret',env:{OPENAI_API_KEY:'test',GEOMINER_ADMIN_CODE:'admin-secret'},transport:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Informe con cautelas.'}]}],usage:{input_tokens:123,output_tokens:34}})};}});
  assert.equal(r.status,200);assert.match(r.body.text,/cautelas/);assert.equal(request.url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(request.options.body).store,false);assert.equal(JSON.parse(request.options.body).model,'gpt-6-luna');assert.equal(r.body.usage.inputTokens,123);
});
test('no acepta estudios numéricos falsos fuera de rango',async()=>{const bad=structuredClone(data);bad.indices.iron.p90=999;const r=await createAiReport({data:bad,passcode:'admin-secret',env:{OPENAI_API_KEY:'test',GEOMINER_ADMIN_CODE:'admin-secret'},transport:()=>{throw Error('no') }});assert.equal(r.status,400);});
test('extrae texto de Responses API',()=>assert.equal(extractAnswer({output:[{content:[{type:'output_text',text:'Hola'}]}]}),'Hola'));
