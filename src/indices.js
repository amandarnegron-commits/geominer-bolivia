/** Índices EXPLORATORIOS: no identifican leyes, reservas ni yacimientos. */
export const INDICATORS = {
  iron: {label:'Óxidos de hierro (respuesta superficial)', formula:'B4 / B2',bands:['red','blue'],color:'#ed7139'},
  clay: {label:'Alteración SWIR (arcillas/hidroxilos)',formula:'B11 / B12',bands:['swir16','swir22'],color:'#8750bd'}
};
export function percentile(sorted, p) {
  if(!sorted.length) return null;
  const n=Math.max(0,Math.min(1,p))*(sorted.length-1);
  const low=Math.floor(n), high=Math.ceil(n);
  return sorted[low]+(sorted[high]-sorted[low])*(n-low);
}
export function computeIndices(raw, width, height) {
  const count=width*height;
  for(const band of ['blue','red','nir','swir16','swir22','scl']) {
    if (!raw[band] || raw[band].length!==count) throw new Error('Falta la banda '+band+' o su cuadrícula no coincide.');
  }
  const iron=new Float32Array(count).fill(NaN);
  const clay=new Float32Array(count).fill(NaN);
  let barePixels=0;
  for(let i=0;i<count;i++) {
    const red=raw.red[i], blue=raw.blue[i],nir=raw.nir[i],sw1=raw.swir16[i],sw2=raw.swir22[i];
    const scl=Math.round(raw.scl[i]);
    // Clase SCL 5: suelo descubierto, 7: sin clasificación. Enmascaramos vegetación,
    // agua, sombra, nube, cirros y nieve. Complemento NDVI <0,2.
    if (!([5,7].includes(scl)) || ![red,blue,nir,sw1,sw2].every(Number.isFinite)) continue;
    if ([red,blue,nir,sw1,sw2].some(v=>v<=0.015 || v>1.5))continue;
    const ndvi=(nir-red)/(nir+red);
    if(!Number.isFinite(ndvi) || ndvi>=0.2) continue;
    const ir=red/blue, cl=sw1/sw2;
    if(!Number.isFinite(ir)||!Number.isFinite(cl)||ir<=0||cl<=0||ir>20||cl>20) continue;
    barePixels++;
    iron[i]=ir;
    clay[i]=cl;
  }
  return {width,height,iron,clay,valid:barePixels,total:count};
}
export function statsFor(values) {
  const valid=Array.from(values).filter(Number.isFinite).sort((a,b)=>a-b);
  const p50=percentile(valid,.5),p75=percentile(valid,.75),p90=percentile(valid,.9);
  return {count:valid.length,p50,p75,p90,min:valid[0]??null,max:valid[valid.length-1]??null};
}
export function rasterRGBA(values,stats,kind='iron') {
  const rgba=new Uint8ClampedArray(values.length*4);
  const shade=kind==='iron'?[235,91,46]:[149,72,204];
  if(!stats.count || stats.p75===null)return rgba;
  const denom=Math.max(0.0001,(stats.p90||stats.p75)-stats.p75);
  for(let i=0;i<values.length;i++){
    const v=values[i];
    if(!Number.isFinite(v)||v<stats.p75)continue;
    const f=Math.max(0,Math.min(1,(v-stats.p75)/denom));
    rgba[i*4]=shade[0];rgba[i*4+1]=Math.round(shade[1]*(1-f*.40));rgba[i*4+2]=Math.round(shade[2]*(1-f*.50));
    rgba[i*4+3]=Math.round(80+130*f);
  }
  return rgba;
}
export function exportTopPoints(result,bbox,kind='iron',maxPoints=300) {
  const values=result[kind], stat=statsFor(values);
  if(!bbox||!stat.count)return {type:'FeatureCollection',features:[]};
  const [w,s,e,n]=bbox;
  const candidates=[];
  for(let i=0;i<values.length;i++){
    const value=values[i];
    if(Number.isFinite(value)&&value>=stat.p90){
      const row=Math.floor(i/result.width), col=i%result.width;
      candidates.push({value,lon:w+(col+.5)*(e-w)/result.width,lat:n-(row+.5)*(n-s)/result.height});
    }
  }
  return {type:'FeatureCollection',features:candidates.sort((a,b)=>b.value-a.value).slice(0,maxPoints).map(p=>({
    type:'Feature',geometry:{type:'Point',coordinates:[Number(p.lon.toFixed(6)),Number(p.lat.toFixed(6))]},
    properties:{index:kind,ratio:Number(p.value.toFixed(4)),classification:'percentil 90+ del terreno',source:'Sentinel-2 L2A COG',note:'Respuesta espectral, NO mineral confirmado'}
  }))};
}
