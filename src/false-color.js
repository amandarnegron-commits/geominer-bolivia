/** Composición óptica de falso color SWIR1/NIR/Red; no son colores naturales ni mineralogía. */
export function falseColorRGBA(result){
 const {width,height,spectral}=result||{};
 const n=width*height;
 const a=spectral?.swir16,b=spectral?.nir,c=spectral?.red;
 if(!a||!b||!c||a.length!==n||b.length!==n||c.length!==n)throw new Error('Faltan bandas para falso color B11/B8/B4.');
 const channels=[a,b,c];
 const limits=channels.map(values=>{
  const sorted=Array.from(values).filter(Number.isFinite).filter(x=>x>0).sort((x,y)=>x-y);
  if(!sorted.length)return [0,1];
  const q=p=>sorted[Math.min(sorted.length-1,Math.max(0,Math.floor(p*(sorted.length-1))))];
  return [q(.02),Math.max(q(.98),q(.02)+.001)];
 });
 const rgba=new Uint8ClampedArray(n*4);
 for(let i=0;i<n;i++){
   if(!channels.every(ch=>Number.isFinite(ch[i])&&ch[i]>0))continue;
   for(let k=0;k<3;k++){
     const [low,high]=limits[k];const v=Math.max(0,Math.min(1,(channels[k][i]-low)/(high-low)));
     rgba[i*4+k]=Math.round(Math.pow(v,1/1.15)*255);
   }
   rgba[i*4+3]=255;
 }
 return rgba;
}
