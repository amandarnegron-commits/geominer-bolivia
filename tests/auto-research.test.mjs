import test from 'node:test';
import assert from 'node:assert/strict';
import {researchArea,profileLocations,profileFromResponse,researchAccess} from '../lib/auto-research.js';
const bbox='-68.11,-16.52,-68.10,-16.51';
const fakeWfs={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',coordinates:[[[-68.11,-16.52],[-68.1,-16.52],[-68.1,-16.51],[-68.11,-16.52]]]},properties:{UNIDAD:'Roca ficticia para test'}}]};
function mock(url){
 if(url.includes('/sergeotecmin/wfs'))return Promise.resolve({ok:true,text:async()=>JSON.stringify(fakeWfs)});
 if(url.includes('ogc/stac'))return Promise.resolve({ok:true,text:async()=>JSON.stringify({features:[{id:'ENMAP-01',properties:{datetime:'2026-01-01', 'eo:cloud_cover':4.2}}]})});
 if(url.includes('cmr.earthdata'))return Promise.resolve({ok:true,text:async()=>JSON.stringify({feed:{entry:[{id:'EMIT-01',title:'EMIT',time_start:'2026-05-01'}]}})});
 if(url.includes('opentopodata'))return Promise.resolve({ok:true,text:async()=>JSON.stringify({results:Array.from({length:23},(_,i)=>({elevation:4000+i}))})});
 throw Error('URL desconocida');
}
test('investigación real se arma con fuentes y no datos simulados',async()=>{
 const r=await researchArea(bbox,{transport:mock});
 assert.equal(r.services.geology.features.features[0].properties.UNIDAD,'Roca ficticia para test');
 assert.equal(r.services.enmap.items[0].id,'ENMAP-01');
 assert.equal(r.services.emit.items[0].id,'EMIT-01');
 assert.equal(r.services.relief.maxMeters,4022);
});
test('un servidor caído no se transforma en geología inventada',async()=>{
 const r=await researchArea(bbox,{transport:(url)=>url.includes('sergeotecmin')?Promise.reject(Error('servidor inaccesible')):mock(url)});
 assert.equal(r.services.geology.status,'unavailable');
 assert.equal(r.services.faults.status,'unavailable');
 assert.equal(r.services.enmap.status,'ok');
});
test('rechaza áreas fuera del límite',async()=>{await assert.rejects(()=>researchArea('-68,-17,-67,-16',{transport:mock}),/25 km|2\.500 km/)});
test('perfil con cotas inexistentes conserva nulos',()=>{const pts=profileLocations([-68,-17,-67.99,-16.99],3);const p=profileFromResponse(pts,{results:[{elevation:4000},{elevation:4040},{elevation:4030}]});assert.equal(p.minMeters,4000);assert.equal(p.points.length,3);});
test('todas las consultas están fijadas a servidores permitidos',async()=>{const urls=[];await researchArea(bbox,{transport:(url)=>{urls.push(url);return mock(url);}});assert.equal(urls.length,7);assert.ok(urls.every(x=>/^https:\/\/(geo\.gob\.bo|geoservice\.dlr\.de|cmr\.earthdata\.nasa\.gov|api\.opentopodata\.org)\//.test(x)));});

test('API protegida por el código privado de GeoMiner',()=>{assert.equal(researchAccess('incorrecto',{geominer_admin_code:'secreto'}).status,401);assert.equal(researchAccess('secreto',{geominer_admin_code:'secreto'}),null);assert.equal(researchAccess('',{}).status,503);});
