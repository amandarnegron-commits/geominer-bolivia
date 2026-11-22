import test from 'node:test';
import assert from 'node:assert/strict';
import {evidenceAudit,prepareEvidenceBundle} from '../src/study-readiness.js';
const report={scene:{id:'S2'},grid:{validPixels:123,totalPixels:140},bbox:[-68.2,-16.6,-68.1,-16.5]};
const polygon={type:'FeatureCollection',features:[{type:'Feature',properties:{unit:'TEST'},geometry:{type:'Polygon',coordinates:[]}}]};
const research={area:report.bbox,queriedAt:'2026-11-22T12:00:00Z',sources:{geology:'GeoBolivia'},services:{
 geology:{status:'ok',count:1,truncated:false,features:polygon},
 faults:{status:'ok',count:0,features:{type:'FeatureCollection',features:[]}},
 enmap:{status:'unavailable',error:'timeout'},emit:{status:'ok',count:2,items:[{id:'EMIT-1'},{id:'EMIT-2'}]},
 relief:{status:'ok',points:[{elevation:100},{elevation:120},{elevation:130}]}
}};
test('separa escenas en inventario de mineralogia realmente procesada',()=>{
 const a=evidenceAudit({report,research});
 assert.equal(a.level,'Estudio de gabinete con geología regional');
 assert.equal(a.emitCount,2);assert.equal(a.mineralogyProcessed,false);
 assert.equal(a.facts.find(f=>f.id==='emit').status,'catalogued');
 assert.equal(a.facts.find(f=>f.id==='enmap').status,'unavailable');
});
test('WFS vacio no se llama geologia descargada',()=>{
 const r=structuredClone(research);r.services.geology={status:'ok',count:0,features:{type:'FeatureCollection',features:[]}};
 const a=evidenceAudit({report,research:r});assert.equal(a.hasGeology,false);assert.equal(a.facts.find(f=>f.id==='geology').status,'empty');
});
test('no atribuye mineral ni inventa geologia sin consultas',()=>{
 const a=evidenceAudit({report});assert.equal(a.hasGeology,false);assert.equal(a.mineralogyProcessed,false);assert.equal(a.facts.find(f=>f.id==='geology').status,'not_queried');
});
test('exporta rasgos GeoJSON reales, metadatos, relieve y su procedencia',()=>{
 const b=prepareEvidenceBundle({report,research});assert.equal(b.layers.geology.geojson.features[0].properties.unit,'TEST');
 assert.equal(b.sceneCatalogues.emit.scenes.length,2);assert.equal(b.sceneCatalogues.emit.processed,false);
 assert.equal(b.relief.points.length,3);
});
test('no permite exportacion sin datos consultados',()=>assert.throws(()=>prepareEvidenceBundle({report}),/investigación geológica/));
