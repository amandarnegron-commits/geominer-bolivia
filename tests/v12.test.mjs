import test from 'node:test';
import assert from 'node:assert/strict';
import { GEO_PLATE_TYPES,sanitizePlates,studySections,reportPlateManifest } from '../src/geological-study.js';
import { geologyPalette } from '../src/geological-map.js';
import { createAiReport } from '../lib/report-api.js';
import { prepareReport } from '../src/report-data.js';

const data=prepareReport({bbox:[-68.25,-16.4,-68.24,-16.39],region:'Área GPS',scene:{id:'S2A-GPS-2026-11-18',date:'2026-11-18T12:00:00Z',platform:'Sentinel-2A',cloud:0},result:{width:8,height:8,valid:64,total:64,iron:Float32Array.from({length:64},(_,i)=>1+i/100),clay:Float32Array.from({length:64},(_,i)=>1+i/200)}});
const env={openai_api_key:'test',geominer_admin_code:'pass'};
const ok=()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Informe técnico de gabinete.'}]}]})});
const plate={kind:'mapa',title:'Hoja ejemplo',source:'Archivo documental citado',scale:'1:100.000',notes:'Fuente existente y delimitación pendiente de revisión.',imageData:'data:image/jpeg;base64,AA=='};
test('la taxonomía contempla las seis láminas geológicas del ejemplo',()=>{
 assert.deepEqual(GEO_PLATE_TYPES.slice(0,6).map(x=>x.id),['mapa','levantamiento','ocurrencias','perfiles','estratigrafia','simbolos']);
});
test('manifest solo cuenta documentos aportados, no inventa perfiles',()=>{
 const m=reportPlateManifest({plates:[plate],geoMatches:[]});
 assert.equal(m.plates.length,1);assert.equal(m.sections[0].count,1);
 assert.equal(m.sections.find(x=>x.id==='estratigrafia').status,'Pendiente de documentación');
 assert.match(m.method,/NO georreferenciadas/);
});
test('limita y limpia los metadatos de láminas de operador',()=>{
 const x=sanitizePlates([{...plate,title:'test\nmal',notes:'ok'},{kind:'invento',title:'oro seguro'},...Array(20).fill(plate)]);
 assert.equal(x.length,7);assert.equal(x[0].title,'test mal');
 assert.ok(!x.some(p=>p.kind==='invento'));
});
test('secciones documentales incorporan antecedentes sin certificar mineral',()=>{
 const x=studySections({evidence:[{type:'registro_muestra'}],fieldNotes:[{note:1}],geoMatches:[{lon:-68.2}]});
 assert.equal(x[2].related,1);assert.equal(x[1].related,1);assert.equal(x[0].related,1);
});
test('la leyenda de mapa vectorial usa unidades declaradas, sin inferir mineral',()=>{
 const x=geologyPalette([{properties:{UNIDAD:'A'}},{properties:{UNIDAD:'B'}},{properties:{UNIDAD:'A'}}]);
 assert.deepEqual(x.map(p=>p.name),['A','B']);
});
test('sin seleccionar imágenes, la IA recibe el catálogo pero ninguna imagen',async()=>{
 let body;
 const r=await createAiReport({data,passcode:'pass',env,geologyPlates:[plate],transport:async(_,o)=>{body=JSON.parse(o.body);return ok();}});
 assert.equal(r.status,200);assert.equal(typeof body.input,'string');
 assert.match(body.input,/Archivo documental citado/);assert.match(body.instructions,/ESTUDIO GEOLOGICO INTEGRADO/);
});
test('con autorización visual, la IA recibe imagen solo si está registrada',async()=>{
 let body;
 const r=await createAiReport({data,passcode:'pass',env,geologyPlates:[plate],geologyImages:[{kind:'mapa',title:'Hoja ejemplo',image:'data:image/jpeg;base64,AA=='}],transport:async(_,o)=>{body=JSON.parse(o.body);return ok();}});
 assert.equal(r.status,200);assert.equal(body.input[0].content[1].type,'input_image');
 assert.equal(body.input[0].content[1].detail,'high');
});
test('imagen no registrada rechazada antes de hacer llamadas facturables',async()=>{
 const r=await createAiReport({data,passcode:'pass',env,geologyImages:[{kind:'mapa',title:'Invento',image:'data:image/jpeg;base64,AA=='}],transport:()=>{throw new Error('no debe llamar');}});
 assert.equal(r.status,400);
});
test('se rechazan más de dos imágenes de gabinete',async()=>{
 const r=await createAiReport({data,passcode:'pass',env,geologyPlates:[plate],geologyImages:[0,1,2].map(()=>({kind:'mapa',title:'Hoja ejemplo',image:'data:image/jpeg;base64,AA=='})),transport:()=>{throw new Error('no debe llamar');}});
 assert.equal(r.status,400);
});
test('pantalla principal muestra solo cuatro etapas, sin navegador duplicado',async()=>{
 const {readFile}=await import('node:fs/promises');
 const text=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
 const main=text.split('<div className="inspector-tabs">')[1].split('</div>')[0];
 assert.equal((main.match(/<button /g)||[]).length,4);
 assert.match(main,/Estudio geológico/);
 assert.ok(!text.includes('<div className="section-cap">PLATAFORMA</div>'));
 assert.ok(!text.includes('geologist-quickquestions'));
});
