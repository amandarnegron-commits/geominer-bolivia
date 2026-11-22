import test from 'node:test';
import assert from 'node:assert/strict';
import { squareFromCenter } from '../src/geo.js';
import { sanitizeUserEvidence, USER_EVIDENCE_TYPES } from '../src/geological-evidence.js';
import { prepareReport } from '../src/report-data.js';
import { createAiReport } from '../lib/report-api.js';
import { aiBlocks, aiPlainText } from '../src/ai-text.js';
import { pointInGeologyGeometry,validateGeologyGeoJSON,matchGeologyToSectors } from '../src/geology-overlay.js';

const bbox=squareFromCenter(-63.18,-17.78,1);
const scene={id:'S2A_GENERIC_20261120',date:'2026-11-20T10:00:00Z',platform:'sentinel-2a',cloud:1};
const result={width:10,height:10,iron:Float32Array.from({length:100},(_,i)=>1+i/100),clay:Float32Array.from({length:100},(_,i)=>1+i/200),valid:100,total:100,cellWidthMeters:20,cellHeightMeters:20};
const report=prepareReport({bbox,scene,region:'Área GPS',result});
const env={openai_api_key:'token',geominer_admin_code:'secreto'};
const response=async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Se observaron sectores de respuesta alta.'}]}]})});

test('informe es general para cualquier GPS, sin contexto geológico automático',()=>{
 assert.equal(report.version,'1.1');
 assert.ok(!Object.hasOwn(report,'geologicalDossier'));
 assert.ok(!Object.hasOwn(report,'geologicalContext'));
 assert.ok(!Object.hasOwn(report.decision,'districtEvidence'));
 assert.deepEqual(USER_EVIDENCE_TYPES,['mapa_geologico','registro_muestra','observacion','informe_tercero']);
});
test('servidor no adjunta geología de terceros ni acepta un dossier inventado por cliente',async()=>{
 let sent;
 const fake=structuredClone(report); fake.geologicalDossier={facts:[{text:'SE DESCUBRIO ORO SIN PRUEBAS'}]};
 const r=await createAiReport({data:fake,question:'¿Qué sectores revisar primero?',passcode:'secreto',env,transport:async(_,options)=>{sent=JSON.parse(options.body);return response();}});
 assert.equal(r.status,200);
 assert.ok(!sent.input.includes('SE DESCUBRIO ORO SIN PRUEBAS'));
 assert.ok(!sent.input.includes('geologicalDossier'));
 assert.match(sent.input,/¿Qué sectores revisar primero/);
 assert.ok(sent.instructions.includes('exclusivamente para el terreno GPS'));
 assert.equal(sent.store,false);
});
test('coordenadas que antes activaban un contexto local ya no generan bibliografía automática',async()=>{
 const sample=prepareReport({bbox:squareFromCenter(-65.7497,-19.6189,5),scene,region:'Área GPS',result});
 let sent;
 const r=await createAiReport({data:sample,passcode:'secreto',env,transport:async(_,options)=>{sent=JSON.parse(options.body);return response();}});
 assert.equal(r.status,200);
 assert.equal(JSON.parse(sent.input.slice(sent.input.indexOf('{'))).geologicalContext,undefined);
 assert.ok(!sent.input.includes('geologicalDossier'));
 assert.ok(!sent.input.includes('patrimonio protegido'));
});
test('preguntas demasiado largas se rechazan sin consumir API',async()=>{
 const r=await createAiReport({data:report,question:'z'.repeat(701),passcode:'secreto',env,transport:()=>{throw Error('NO');}});
 assert.equal(r.status,400);
});
test('datos documentales solo se trasladan como declarados y no auditados',async()=>{
 let sent;
 const r=await createAiReport({data:report,passcode:'secreto',env,userEvidence:[{type:'observacion',source:'Informe superficial A',description:'Observación roja en afloramiento sin ensayo.',sector:2}],transport:async(_,options)=>{sent=JSON.parse(options.body).input;return response();}});
 assert.equal(r.status,200);assert.match(sent,/Informe superficial A/);assert.match(sent,/NO AUDITADO/);
});
test('sanitización de referencias descarta fuentes vacías y categorías no permitidas',()=>{
 const x=sanitizeUserEvidence([
  {type:'registro_muestra',source:'Laboratorio citado en informe 14',description:'Resultado declarado pendiente de verificar.',sector:3},
  {type:'otra_clase',source:'Inválido',description:'Invento no aceptado'},
  {type:'mapa_geologico',source:'',description:'Sin fuente'}]);
 assert.equal(x.length,1);assert.equal(x[0].sector,3);
});
test('marcado de texto y encabezados se presentan limpios',()=>{
 const blocks=aiBlocks('\\### Resultado del análisis\n\\**Sí, hay señales.\\**\n\n### Sectores recomendados');
 assert.equal(blocks[0].kind,'heading');assert.equal(blocks[0].text,'Resultado del análisis');
 assert.match(aiPlainText('\\**Sí.\\**'),/^Sí\.$/);
});
test('GeoJSON local se cruza geográficamente, sin declarar certeza de roca',()=>{
 const poly={type:'Feature',properties:{UNIDAD:'A',LITOLOGIA:'Atributo de prueba'},geometry:{type:'Polygon',coordinates:[[[ -63.2,-17.8],[-63.15,-17.8],[-63.15,-17.75],[-63.2,-17.75],[-63.2,-17.8]]]}};
 const geo=validateGeologyGeoJSON({type:'FeatureCollection',features:[poly]});
 assert.equal(pointInGeologyGeometry([-63.18,-17.78],poly.geometry),true);
 const matches=matchGeologyToSectors(geo,{iron:[{number:1,lat:-17.78,lon:-63.18},{number:2,lat:-19,lon:-60}],clay:[]},'mi-carta.geojson');
 assert.equal(matches.length,1);assert.equal(matches[0].unit,'A');
});
