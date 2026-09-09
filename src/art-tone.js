// Report F: semantic tone in a cached pixel copy, never mutating source PNGs.
// Avoid per-frame Canvas filters so mobile browsers share exactly the same transform.
export const ART_TONES={floor:{contrast:.72,brightness:.95,saturation:1},prop:{contrast:1,brightness:.8,saturation:.9},wall:{contrast:1,brightness:.72,saturation:.6},unit:{contrast:1,brightness:1.3,saturation:1.5}};
const clamp=n=>Math.max(0,Math.min(255,n));
export function tonePixel(rgb,role,gain=1){
  const t=ART_TONES[role]||ART_TONES.prop;
  const values=rgb.map(v=>clamp(((clamp(v*gain)-127.5)*t.contrast+127.5)*t.brightness));
  const luma=values[0]*.2126+values[1]*.7152+values[2]*.0722;
  return values.map(v=>Math.round(clamp(luma+(v-luma)*t.saturation)));
}
export function tonePixels(data,role){
  let sum=0,count=0;
  if(role==='floor')for(let i=0;i<data.length;i+=4)if(data[i+3]){sum+=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;count++;}
  // Equalize each floor swatch before reducing contrast: no bright restroom island.
  const gain=role==='floor'&&sum>0?52.4/(sum/count):1;
  for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const rgb=tonePixel([data[i],data[i+1],data[i+2]],role,gain);data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];}
  return data;
}
export class ArtToneCache{
  constructor(){this.images=new WeakMap();}
  get(image,sprite,role){
    if(!image?.complete||!image.naturalWidth)return null;
    let cells=this.images.get(image);if(!cells){cells=new Map();this.images.set(image,cells);}
    const key=[sprite.x,sprite.y,sprite.size,role].join(':');if(cells.has(key))return cells.get(key);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=sprite.size;const c=canvas.getContext('2d');c.drawImage(image,sprite.x,sprite.y,sprite.size,sprite.size,0,0,sprite.size,sprite.size);
    const pixels=c.getImageData(0,0,sprite.size,sprite.size);tonePixels(pixels.data,role);c.putImageData(pixels,0,0);cells.set(key,canvas);return canvas;
  }
}
