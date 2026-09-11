// Operator colour (3.48.2, Claude): a cosmetic tint laid over the grey class sprites. Picked on the deploy screen,
// kept as a local preference like the other display settings; never part of the run save or the combat RNG.
export const OPERATOR_COLORS=[
  {id:'amber',label:'琥珀',hex:'#e8a15c'},
  {id:'red',label:'赤紅',hex:'#e2584a'},
  {id:'blue',label:'鈷藍',hex:'#5c8fe8'},
  {id:'cyan',label:'青碧',hex:'#48c6cf'},
  {id:'green',label:'軍綠',hex:'#8cc257'},
  {id:'violet',label:'紫羅蘭',hex:'#a97de6'},
  {id:'white',label:'雪白',hex:'#e4e7e2'},
  {id:'none',label:'原色',hex:null},
];
export const DEFAULT_OPERATOR_COLOR='amber';
export const validOperatorColor=id=>OPERATOR_COLORS.some(c=>c.id===id);
export const operatorColor=id=>OPERATOR_COLORS.find(c=>c.id===id)||OPERATOR_COLORS.find(c=>c.id===DEFAULT_OPERATOR_COLOR);
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// The class art uses nine greys, mostly dark (16–181). Map that range onto a gradient: deep shade → full colour → light
// tint, so outlines stay dark and the body reads as the chosen colour instead of a darkened multiply.
const LOW=16,HIGH=181,SHADE=.22,MID=.45,LIGHT=.55;
export function tintPixels(data,hex){
  if(!hex)return data;
  const color=rgb(hex);
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const grey=(data[i]+data[i+1]+data[i+2])/3,t=Math.max(0,Math.min(1,(grey-LOW)/(HIGH-LOW)));
    for(let k=0;k<3;k++)data[i+k]=Math.round(t<=MID?color[k]*(SHADE+(1-SHADE)*t/MID):color[k]+(255-color[k])*LIGHT*(t-MID)/(1-MID));
  }
  return data;
}
// One small canvas per sprite cell and colour; null when the colour is "none" or the browser refuses pixel access.
export function tintedSprite(image,rect,id,cache){
  const hex=operatorColor(id).hex;if(!hex)return null;
  const key=`${rect.x},${rect.y},${id}`;if(cache?.has(key))return cache.get(key);
  let canvas=null;
  try{canvas=document.createElement('canvas');canvas.width=rect.w;canvas.height=rect.h;const c=canvas.getContext('2d');c.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);const pixels=c.getImageData(0,0,rect.w,rect.h);tintPixels(pixels.data,hex);c.putImageData(pixels,0,0);}catch{canvas=null;}
  cache?.set(key,canvas);return canvas;
}
