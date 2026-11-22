import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSpectralResults,noteKey,normalizeFieldNote,exportValidationBundle } from '../src/pilot-validation.js';

test('la coincidencia de dos fechas solo considera píxeles válidos compartidos',()=>{
  const a={width:5,height:5,iron:Float32Array.from(Array.from({length:25},(_,i)=>i===24?NaN:i+1)),clay:Float32Array.from(Array.from({length:25},(_,i)=>i===24?NaN:i+2))};
  const b={width:5,height:5,iron:Float32Array.from(Array.from({length:25},(_,i)=>i===24?NaN:i+1)),clay:Float32Array.from(Array.from({length:25},(_,i)=>i===24?NaN:i+2))};
  const out=compareSpectralResults(a,b);
  assert.equal(out.grid.sharedValid,24);
  assert.equal(out.metrics.iron.jaccard,1);
  assert.equal(out.metrics.clay.jaccard,1);
  assert.match(out.warning,/no verificación de minerales/i);
});
test('no da resultados falsos cuando no hay muestra compartida',()=>{
 const a={width:4,height:4,iron:new Float32Array(16).fill(NaN),clay:new Float32Array(16).fill(NaN)};
 const b={width:4,height:4,iron:new Float32Array(16).fill(1),clay:new Float32Array(16).fill(1)};
 const out=compareSpectralResults(a,b);
 assert.equal(out.grid.sharedValid,0);assert.equal(out.metrics.iron.jaccard,null);
});
test('no mezcla diferentes tamaños de cuadrícula',()=>{
 assert.throws(()=>compareSpectralResults({width:1,height:1},{width:2,height:2}),/idéntica/);
});
test('registro de sector queda referenciado por escena, indicador y área',()=>{
 const zone={id:'iron-42',lat:-19.619,lon:-65.75,peakRatio:1.92,number:1};
 const base={bbox:[-65.8,-19.65,-65.7,-19.6],sceneId:'sentinel-id-01',indicator:'iron',zone,status:'revisado_remotamente',notes:'Revisar presencia de escombreras, sin evidencia geológica concluyente.'};
 const note=normalizeFieldNote(base);
 assert.equal(note.key,noteKey({bbox:base.bbox,sceneId:base.sceneId,indicator:'iron',zoneId:'iron-42'}));
 assert.equal(note.status,'revisado_remotamente');
 assert.throws(()=>normalizeFieldNote({...base,status:'depósito_confirmado'}),/Estado/);
 const bundle=exportValidationBundle({bbox:base.bbox,sceneId:base.sceneId,comparison:null,notes:[note]});
 assert.equal(bundle.fieldNotes.length,1);assert.match(bundle.disclaimer,/no confirma mineralización/i);
});

test('una señal uniforme en el terreno no se interpreta como persistencia de hotspots',()=>{
 const a={width:5,height:5,iron:new Float32Array(25).fill(1),clay:new Float32Array(25).fill(1)};
 const result=compareSpectralResults(a,a);
 assert.equal(result.metrics.iron.jaccard,null);
 assert.equal(result.metrics.iron.firstThreshold,null);
});

import { createAiReport } from '../lib/report-api.js';
import {squareFromCenter} from '../src/geo.js';
import { prepareReport } from '../src/report-data.js';
test('la IA recibe validación numérica sin anotaciones privadas',async()=>{
 const bbox=squareFromCenter(-63.18,-17.78,1);
 const sample={width:3,height:4,valid:12,total:12,iron:Float32Array.from(Array.from({length:12},(_,i)=>1+i/10)),clay:Float32Array.from(Array.from({length:12},(_,i)=>1+i/20))};
 const scene={id:'scene-primary-2026',date:'2026-11-18T10:00:00Z',platform:'sentinel-2',cloud:2};
 const report=prepareReport({bbox,region:'Área GPS',scene,result:sample,temporal:{secondSceneId:'scene-secondary-2026',secondDate:'2026-10-21T10:00:00Z',grid:{total:12,sharedValid:10,sharedPct:83.3},metrics:{iron:{jaccard:0.5,overlapPixels:2,unionPixels:4},clay:{jaccard:0.25,overlapPixels:1,unionPixels:4}}}});
 report.fieldNotes=[{name:'privado',notes:'NO COMPARTIR'}];
 let sent;
 const res=await createAiReport({data:report,passcode:'private-pass',env:{openai_api_key:'test',geominer_admin_code:'private-pass'},transport:async(_url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Informe preliminar'}]}]})}}});
 assert.equal(res.status,200);
 assert.ok(!sent.input.includes('geologicalDossier'));
 assert.ok(sent.input.includes('0.5'));
 assert.ok(!sent.input.includes('NO COMPARTIR'));
});
