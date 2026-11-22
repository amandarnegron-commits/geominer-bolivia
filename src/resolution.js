/** Plano UTM de muestreo. Una celda objetivo NO mejora la resolución nativa de bandas 20 m. */
export const RESOLUTION_OPTIONS = Object.freeze([20,10]);
export function gridForProjectedBounds(box, targetMeters=20) {
  if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite)||box[0]>=box[2]||box[1]>=box[3])
    throw new Error('Extensión UTM no válida.');
  if(!RESOLUTION_OPTIONS.includes(targetMeters))throw new Error('Selecciona resolución de 10 o 20 metros.');
  const x=box[2]-box[0], y=box[3]-box[1];
  const width=Math.max(4,Math.min(512,Math.ceil(x/targetMeters)));
  const height=Math.max(4,Math.min(512,Math.ceil(y/targetMeters)));
  if(width*height>262144)throw new Error('Cuadrícula demasiado grande.');
  return {width,height,requestedMeters:targetMeters,cellWidthMeters:Number((x/width).toFixed(2)),cellHeightMeters:Number((y/height).toFixed(2)),
    swirNativeMeters:20,upsampled20mBands:targetMeters===10};
}
export function minimumGroupPixels(result, minAreaM2=1200) {
 const area=Number(result?.pixelAreaM2)||Number(result?.cellWidthMeters)*Number(result?.cellHeightMeters)||400;
 return Math.max(3,Math.min(100,Math.ceil(minAreaM2/area)));
}
