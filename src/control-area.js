import {statsFor} from './indices.js';
/** Área adyacente NO superpuesta. Misma extensión, diferente suelo; NO control científico emparejado. */
export function neighbouringBbox(bbox,direction='W'){
 if(!Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||bbox[0]>=bbox[2]||bbox[1]>=bbox[3])throw new Error('Selecciona primero un terreno válido.');
 if(!['W','E','N','S'].includes(direction))throw new Error('Dirección no válida.');
 const [w,s,e,n]=bbox, dx=(e-w)*1.25,dy=(n-s)*1.25;
 const sx=direction==='E'?dx:direction==='W'?-dx:0;
 const sy=direction==='N'?dy:direction==='S'?-dy:0;
 const out=[w+sx,s+sy,e+sx,n+sy].map(x=>Number(x.toFixed(7)));
 if(out[0]<-180||out[2]>180||out[1]<-90||out[3]>90)throw new Error('Área de control fuera de límites geográficos.');
 return out;
}
export function controlAreaComparison(main, control, direction='W'){
 if(!main||!control||!['iron','clay'].every(k=>main[k]&&control[k]))throw new Error('Faltan los dos análisis comparables.');
 const indices={};
 for(const kind of ['iron','clay']){
   const a=statsFor(main[kind]),b=statsFor(control[kind]);
   indices[kind]={mainP50:a.p50,controlP50:b.p50,mainP90:a.p90,controlP90:b.p90,
     deltaP50:a.p50!==null&&b.p50!==null?Number((a.p50-b.p50).toFixed(4)):null,
     validMain:a.count,validControl:b.count};
 }
 return {direction,indices,comparisonType:'Contraste descriptivo con área vecina no emparejada',
 warning:'Diferencias pueden proceder de litología, vegetación, humedad, topografía, usos del suelo y escombreras. NO miden precisión ni potencial económico.'};
}
