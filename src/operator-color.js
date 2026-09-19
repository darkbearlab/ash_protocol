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
// 3.140.0 (user decisions 2026-09-19): besides a preset id, the choice can be any colour from the picker's wheel and
// brightness slider (src/color-picker.js), kept as a lower-case '#rrggbb'.
const CUSTOM=/^#[0-9a-f]{6}$/;
export const validOperatorColor=id=>OPERATOR_COLORS.some(c=>c.id===id)||typeof id==='string'&&CUSTOM.test(id);
export const operatorColor=id=>OPERATOR_COLORS.find(c=>c.id===id)||(typeof id==='string'&&CUSTOM.test(id)?{id,label:'自訂',hex:id,custom:true}:OPERATOR_COLORS.find(c=>c.id===DEFAULT_OPERATOR_COLOR));
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));

// HSV with hue in degrees and saturation and brightness in percent, whole numbers, as the picker shows them.
export function hsvToRgb(h,s,v){
  const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,k=Math.floor(((h%360)+360)%360/60);
  const [r,g,b]=[[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][k];
  return [r,g,b].map(n=>Math.round((n+m)*255));
}
export const hsvToHex=(h,s,v)=>'#'+hsvToRgb(h,s/100,v/100).map(n=>n.toString(16).padStart(2,'0')).join('');
export function hexToHsv(hex){
  const [r,g,b]=rgb(hex).map(n=>n/255),max=Math.max(r,g,b),d=max-Math.min(r,g,b);
  const h=d?(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60:0;
  return {h:Math.round(h)%360,s:Math.round(max?d/max*100:0),v:Math.round(max*100)};
}
// Brightness below 40% leaves the operator almost black in a dark room, so the slider stops there once (user: "在 40%
// 那邊加一個阻擋，但再拉一次還是拉得過去"): a gesture that started above the stop cannot go below it; the next one can.
export const BRIGHTNESS_STOP=40;
export const softStop=(start,value,stop=BRIGHTNESS_STOP)=>start>stop&&value<stop?stop:value;

// The class art uses nine greys, mostly dark (16–181). Map that range onto a gradient: deep shade → full colour → light
// tint, so outlines stay dark and the body reads as the chosen colour instead of a darkened multiply.
const LOW=16,HIGH=181,SHADE=.22,MID=.45,LIGHT=.55;
// strength (3.116.0, user request) mixes the tinted pixel back towards the original grey: 1 is the full colour, 0 none.
export function tintPixels(data,hex,strength=1){
  if(!hex||strength<=0)return data;
  const color=rgb(hex);
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const grey=(data[i]+data[i+1]+data[i+2])/3,t=Math.max(0,Math.min(1,(grey-LOW)/(HIGH-LOW)));
    for(let k=0;k<3;k++){const tinted=t<=MID?color[k]*(SHADE+(1-SHADE)*t/MID):color[k]+(255-color[k])*LIGHT*(t-MID)/(1-MID);data[i+k]=Math.round(data[i+k]+(tinted-data[i+k])*Math.min(1,strength));}
  }
  return data;
}
// One small canvas per sprite cell and colour; null when the colour is "none" or the browser refuses pixel access.
export function tintedSprite(image,rect,id,cache,strength=1){
  const hex=operatorColor(id).hex;if(!hex||strength<=0)return null;
  const key=`${rect.x},${rect.y},${id},${strength}`;if(cache?.has(key))return cache.get(key);
  let canvas=null;
  try{canvas=document.createElement('canvas');canvas.width=rect.w;canvas.height=rect.h;const c=canvas.getContext('2d');c.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);const pixels=c.getImageData(0,0,rect.w,rect.h);tintPixels(pixels.data,hex,strength);c.putImageData(pixels,0,0);}catch{canvas=null;}
  cache?.set(key,canvas);return canvas;
}
