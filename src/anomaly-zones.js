/**
 * GeoMiner v0.5 — agrupación REPRODUCIBLE de anomalías espectrales relativas.
 * Los componentes contiguos son zonas para inspección, NO depósitos ni hallazgos.
 * Emplea vecindad de ocho celdas y el P90 de cada índice dentro del polígono.
 */
import { statsFor, INDICATORS } from './indices.js';

const round = (n, digits=6) => Number(n.toFixed(digits));
const validBbox = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] < b[2] && b[1] < b[3];
const inBounds = (r,c,h,w) => r>=0 && r<h && c>=0 && c<w;
const areaKm2 = b => Math.abs((b[3]-b[1])*111.32*(b[2]-b[0])*111.32*Math.cos((b[3]+b[1])*Math.PI/360));

export function detectAnomalyZones(result, bbox, kind='iron', options={}) {
  const {minPixels=3, limit=12} = options;
  if (!result || !validBbox(bbox) || !Object.hasOwn(INDICATORS,kind)) return [];
  const {width:w,height:h} = result;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w<1 || h<1 || w*h>300000) return [];
  const values=result[kind];
  if (!values || values.length!==w*h) return [];
  const stats=statsFor(values);
  // Sin suficiente muestra o variación espectral no es correcto declarar sectores.
  if (stats.count<10 || stats.p90===null || stats.p50===null || (stats.p90-stats.p50)<1e-5) return [];

  const selected=new Uint8Array(values.length);
  for(let i=0;i<values.length;i++) if(Number.isFinite(values[i]) && values[i]>=stats.p90) selected[i]=1;
  const visited=new Uint8Array(values.length);
  const zones=[];
  const [west,south,east,north]=bbox;
  const coord=(i)=>{
    const row=Math.floor(i/w), col=i%w;
    return {lon:west+(col+.5)*(east-west)/w, lat:north-(row+.5)*(north-south)/h};
  };
  const MIN=Math.max(2,Math.min(100,Math.trunc(minPixels)||3));
  for(let i=0;i<values.length;i++) {
    if(!selected[i] || visited[i])continue;
    const stack=[i]; visited[i]=1;
    let count=0, sum=0, max=-Infinity, peakIndex=i;
    while(stack.length) {
      const at=stack.pop(), row=Math.floor(at/w),col=at%w;
      count++;sum+=values[at];
      if(values[at]>max){max=values[at];peakIndex=at;}
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const rr=row+dr,cc=col+dc;
        if(!inBounds(rr,cc,h,w))continue;
        const next=rr*w+cc;
        if(selected[next] && !visited[next]){visited[next]=1;stack.push(next);}
      }
    }
    if(count<MIN)continue;
    const peak=coord(peakIndex);
    const zoneArea=areaKm2(bbox)*count/(w*h);
    zones.push({
      id:kind+'-'+i,kind,
      lat:round(peak.lat),lon:round(peak.lon),
      peakRatio:round(max,4),meanRatio:round(sum/count,4),
      threshold:round(stats.p90,4),pixels:count,
      approxAreaKm2:round(zoneArea,4),
      locationMethod:'Centro del píxel con el mayor índice del grupo (georreferenciación aproximada)'
    });
  }
  // Orden = magnitud relativa de respuesta; NO prioridad minera ni probabilidad.
  zones.sort((a,b)=>b.peakRatio-a.peakRatio || b.pixels-a.pixels || a.id.localeCompare(b.id));
  return zones.slice(0,Math.max(1,Math.min(25,Math.trunc(limit)||12)))
    .map((zone,index)=>({...zone,number:index+1}));
}

export function zonesToGeoJSON(zones,{sceneId='',kind='iron'}={}) {
  return {
    type:'FeatureCollection',
    name:'GeoMiner Bolivia — sectores de respuesta espectral relativa',
    features:(zones||[]).map(zone=>({
      type:'Feature',
      geometry:{type:'Point',coordinates:[zone.lon,zone.lat]},
      properties:{
        zone:zone.number,id:zone.id,index:kind,sceneId,
        peakRatio:zone.peakRatio,meanRatio:zone.meanRatio,
        p90Threshold:zone.threshold,connectedPixels:zone.pixels,
        approxAreaKm2:zone.approxAreaKm2,
        locationMethod:zone.locationMethod,
        disclaimer:'NO es mineral, yacimiento, ley ni objetivo de perforación confirmado.'
      }
    }))
  };
}
