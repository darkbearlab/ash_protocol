// Prefer physical screen orientation so a portrait software keyboard cannot lock the UI.
export function landscapeTouch({coarse,type,angle,width,height,editing=false}){
  if(!coarse)return false;
  if(typeof type==='string'&&/^(portrait|landscape)-/.test(type))return type.startsWith('landscape');
  if(typeof angle==='number')return Math.abs(angle)%180===90;
  return !editing&&width>height;
}
