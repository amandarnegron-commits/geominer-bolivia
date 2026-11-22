import test from 'node:test';
import assert from 'node:assert/strict';
import {gridForProjectedBounds,minimumGroupPixels} from '../src/resolution.js';
import {neighbouringBbox,controlAreaComparison} from '../src/control-area.js';
import {falseColorRGBA} from '../src/false-color.js';
import {computeIndices,statsFor} from '../src/indices.js';
import {prepareReport} from '../src/report-data.js';
import {createAiReport} from '../lib/report-api.js';
import {normaliseItem} from '../lib/analysis-catalog.js';

const eq = (v,n) => Float32Array.from({length:n},()=>v);
function makeResult(){
  const n=16;
  return computeIndices({
    blue:eq(.12,n),green:eq(.13,n),red:eq(.18,n),nir:eq(.21,n),
    swir16:eq(.27,n),swir22:eq(.19,n),scl:eq(5,n),
    nir08:eq(.24,n),rededge1:eq(.16,n),rededge3:eq(.23,n)
  },4,4);
}
const bbox=[-65.79,-19.64,-65.75,-19.60];
const scene={id:'S2A_potosi_20261101_L2A',date:'2026-11-01T12:00:00Z',cloud:2,platform:'sentinel-2a'};
test('grilla UTM 5x5 km tiene tamaño real a ~20m y ~10m, sin inventar detalle SWIR',()=>{
 const a=gridForProjectedBounds([0,0,5000,5000],20);
 const b=gridForProjectedBounds([0,0,5000,5000],10);
 assert.equal(a.width,250);assert.equal(a.height,250);assert.equal(a.cellWidthMeters,20);
 assert.equal(b.width,500);assert.equal(b.height,500);assert.equal(b.upsampled20mBands,true);
 assert.throws(()=>gridForProjectedBounds([0,0,5000,5000],5),/10 o 20/);
 assert.equal(minimumGroupPixels({pixelAreaM2:100}),12);
});
test('el control vecino es adyacente y no superpuesto en las cuatro direcciones',()=>{
 for(const d of ['E','W','N','S']){
  const next=neighbouringBbox(bbox,d);
  assert.equal(Number((next[2]-next[0]).toFixed(7)),Number((bbox[2]-bbox[0]).toFixed(7)));
  assert.ok(next[2]<bbox[0]||next[0]>bbox[2]||next[3]<bbox[1]||next[1]>bbox[3]);
 }
 assert.throws(()=>neighbouringBbox(bbox,'XX'),/Dirección/);
});
test('bandas opcionales producen índices auxiliares, sin inventar clasificación mineral',()=>{
 const data=makeResult();
 assert.equal(data.valid,16);
 assert.ok(statsFor(data.ferrous).p50>1);
 assert.ok(statsFor(data.rededge).p50>1);
 assert.equal(data.iron.length,16);
 const noOptional=computeIndices({blue:eq(.12,16),red:eq(.18,16),nir:eq(.21,16),swir16:eq(.27,16),swir22:eq(.19,16),scl:eq(5,16)},4,4);
 assert.equal(statsFor(noOptional.ferrous).count,0);
});
test('falso color usa tres canales SWIR-NIR-rojo y no envía información de minerales',()=>{
 const pixels=falseColorRGBA({width:2,height:2,spectral:{swir16:Float32Array.of(.2,.3,.4,.5),nir:Float32Array.of(.1,.2,.3,.4),red:Float32Array.of(.05,.2,.3,.5)}});
 assert.equal(pixels.length,16);
 assert.equal(pixels[3],255);
 assert.throws(()=>falseColorRGBA({width:1,height:1,spectral:{red:[.2]}}),/Faltan bandas/);
});
test('catálogo acepta red-edge y descarta asset opcional no seguro',()=>{
 const url='https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/x.tif';
 const names=['blue','green','red','nir','swir16','swir22','scl'];
 const assets=Object.fromEntries(names.map(name=>[name,{href:url,'raster:bands':[{scale:name==='scl'?1:.0001}]}]));
 assets.rededge1={href:url};assets.rededge3={href:'https://evil.example.com/x.tif'};assets.nir08={href:url};
 const item=normaliseItem({id:'s',properties:{datetime:'2026-11-12T00:00:00Z','eo:cloud_cover':1,'proj:epsg':32719},assets});
 assert.ok(item.assets.green);assert.ok(item.assets.rededge1);assert.ok(item.assets.nir08);
 assert.equal(item.assets.rededge3,undefined);
});
test('informe guarda resolución, control y auxiliares sin llamarlos reserva mineral',()=>{
 const result={...makeResult(),requestedMeters:20,cellWidthMeters:20,cellHeightMeters:20,bandsRead:['blue','green','red','nir','swir16','swir22','scl','rededge1','rededge3','nir08']};
 const control=controlAreaComparison(result,result,'W');
 const report=prepareReport({bbox,scene,region:'Área GPS',result,control:{...control,bbox:neighbouringBbox(bbox,'W'),sceneId:scene.id}});
 assert.equal(report.version,'1.2');assert.equal(report.grid.cellWidthMeters,20);assert.equal(report.control.direction,'W');
 assert.ok(report.indices.ferrous.p50>1);
 assert.match(report.disclaimer,/No demuestra/i);
 assert.match(report.methods.join(' '),/Cuadrícula UTM/);
});
test('servidor rechaza miniaturas remotas y acepta metadatos numéricos del área vecina',async()=>{
 const r=makeResult();const report=prepareReport({bbox,scene,result:r,control:{...controlAreaComparison(r,r,'E'),bbox:neighbouringBbox(bbox,'E'),sceneId:scene.id}});
 let input;
 const transport=async(_url,options)=>{input=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Interpretación cautelosa.'}]}]})};};
 let resp=await createAiReport({data:report,passcode:'long-secret',preview:'https://evil.example.org/x.jpeg',env:{openai_api_key:'fake',geominer_admin_code:'long-secret'},transport});
 assert.equal(resp.status,400);assert.equal(input,undefined);
 resp=await createAiReport({data:report,passcode:'long-secret',env:{openai_api_key:'fake',geominer_admin_code:'long-secret'},transport});
 assert.equal(resp.status,200);
 assert.ok(input.input.includes('control'));
 assert.equal(input.store,false);
});
test('servidor envía miniatura JPEG embebida cuando se selecciona opción visual',async()=>{
 const r=makeResult();const report=prepareReport({bbox,scene,result:r});
 const jpeg='data:image/jpeg;base64,'+'A'.repeat(1024);
 let input;
 const resp=await createAiReport({data:report,preview:jpeg,passcode:'secret',env:{OPENAI_API_KEY:'fake',GEOMINER_ADMIN_CODE:'secret'},transport:async(_url,opts)=>{input=JSON.parse(opts.body).input;return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Respuesta'}]}]})};}});
 assert.equal(resp.status,200);
 assert.equal(input[0].content[1].type,'input_image');
 assert.equal(input[0].content[1].image_url,jpeg);
});

test('API acepta cuadrícula de 10 m (~500x500) con 250000 píxeles',async()=>{
 const report=prepareReport({bbox,scene,result:makeResult()});
 report.grid={...report.grid,width:500,height:500,validPixels:200000,totalPixels:250000,requestedMeters:10,cellWidthMeters:10,cellHeightMeters:10,upsampled20mBands:true};
 const resp=await createAiReport({data:report,passcode:'secret',env:{OPENAI_API_KEY:'fake',GEOMINER_ADMIN_CODE:'secret'},transport:async()=>({ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'Grilla aceptada.'}]}]})})});
 assert.equal(resp.status,200);
});
