import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidenceDecision} from '../src/evidence-decision.js';
import {prepareReport} from '../src/report-data.js';
import {createAiReport} from '../lib/report-api.js';

const bbox=[-65.79,-19.63,-65.77,-19.61];
const scene={id:'S2A_v09_CerroRico_20261121',date:'2026-11-21T10:00:00Z',cloud:2,platform:'sentinel-2a'};
function sample({both=true,changed=false,valid=100}={}){
 const width=10,height=10;
 const iron=Float32Array.from({length:100},(_,i)=>1+i/1000);
 const clay=Float32Array.from({length:100},(_,i)=>1+i/2000);
 for(const i of [22,23,24,32,33]){
   iron[i]=changed?1.1:2.5;
   if(both)clay[i]=changed?1.05:1.8;
 }
 return {width,height,iron,clay,valid,total:100,pixelAreaM2:400};
}
test('hay SI a grupos espectrales cuando los datos muestran sectores, sin decir SI a minerales',()=>{
 const report=prepareReport({bbox,scene,region:'Potosí',result:sample()});
 assert.match(report.decision.spectralAnswer,/SÍ/);
 assert.match(report.decision.mineralAnswer,/NO DETERMINADO/);
 assert.match(report.decision.economicAnswer,/NO EVALUABLE/);
 assert.ok(report.decision.zones.length>0);
});
test('evidencia temporal y dual justifica prioridad de revision ALTA pero no probabilidad minera',()=>{
 const report=prepareReport({bbox,scene,result:sample(),secondResult:sample()});
 assert.equal(report.decision.temporalAvailable,true);
 assert.ok(report.decision.zones.some(z=>z.priority==='Alta'&&z.cooccurrence==='si'&&z.temporal==='si'));
 assert.ok(report.decision.priorityMethod.includes('no probabilidad'));
});
test('sin segunda fecha no se inventa confirmación temporal',()=>{
 const report=prepareReport({bbox,scene,result:sample()});
 assert.equal(report.decision.temporalAvailable,false);
 assert.ok(report.decision.zones.every(z=>z.temporal==='no_evaluado'));
 assert.ok(report.decision.zones.every(z=>z.priority!=='Alta'));
});
test('la baja cobertura impide clasificar como SI sustentado',()=>{
 const result=sample({valid:10});
 const report=prepareReport({bbox,scene,result});
 assert.match(report.decision.spectralAnswer,/NO EVALUABLE/);
 assert.ok(report.decision.zones.every(z=>z.priority==='Por verificar'));
});
test('el servidor pasa un dictamen seguro y no acepta frases inventadas por el navegador',async()=>{
 const report=prepareReport({bbox,scene,result:sample()});
 report.decision.mineralAnswer='HAY 10 TONELADAS DE ORO';
 let sent;
 const response=await createAiReport({data:report,passcode:'secreto',env:{openai_api_key:'falsa',geominer_admin_code:'secreto'},transport:async(_url,opts)=>{
   sent=JSON.parse(opts.body);
   return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Dictamen de pruebas.'}]}]})};
 }});
 assert.equal(response.status,200);
 assert.ok(sent.input.includes('decision'));
 assert.ok(!sent.input.includes('10 TONELADAS DE ORO'));
 assert.ok(sent.input.includes('NO CONFIRMADO'));
});
