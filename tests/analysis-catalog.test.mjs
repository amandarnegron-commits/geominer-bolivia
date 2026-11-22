import test from 'node:test';
import assert from 'node:assert/strict';
import {checkArea,normaliseItem,safeCogUrl,searchAnalysisScenes} from '../lib/analysis-catalog.js';
const url='https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/19/K/A/file.tif';
const assets=Object.fromEntries(['blue','red','nir','swir16','swir22','scl'].map(name=>[name,{href:url,'raster:bands':[{scale:name==='scl'?1:.0001,offset:0}]}]));
test('rechaza enlaces externos y áreas mayores a 25 km²',()=>{
  assert.equal(safeCogUrl('https://evil.example.com/file.tif'),null);
  assert.equal(safeCogUrl('http://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/file.tif'),null);
  assert.equal(safeCogUrl(url),url);
  assert.throws(()=>checkArea('-65.8,-19.6,-65.7,-19.5'),/hasta 25/);
});
test('normaliza escenas completas y conserva escalado espectral',()=>{
  const feature={id:'s1',properties:{datetime:'2026-11-01T00:00:00Z','eo:cloud_cover':3,'proj:epsg':32719},assets};
  const scene=normaliseItem(feature);
  assert.equal(scene.epsg,32719);
  assert.equal(scene.assets.blue.scale,.0001);
  assert.equal(scene.assets.scl.scale,1);
  assert.equal(normaliseItem({...feature,assets:{...assets,red:{href:'https://evil.invalid/file.tif'}}}),null);
});
test('consulta STAC Earth Search, selecciona escenas y no inventa mineral',async()=>{
  const scene={id:'s1',properties:{datetime:'2026-11-01T00:00:00Z','eo:cloud_cover':3,platform:'sentinel-2a','proj:epsg':32719},assets};
  const transport=async (urlArg)=>{
    const req=new URL(urlArg);
    assert.equal(req.searchParams.get('collections'),'sentinel-2-c1-l2a');
    return {ok:true,json:async()=>({features:[scene]})};
  };
  const result=await searchAnalysisScenes('-65.762,-19.58,-65.749,-19.565',transport);
  assert.equal(result.scenes.length,1);
  assert.match(result.note,/escena completa/i);
});
