// Presentation only: world coordinates and saves always remain on integer tiles.
export const MOVE_MS=120;
export const DARK_ACTOR_BRIGHTNESS=.55;
const actors=g=>[g.player,...g.enemies,...(g.allies||[]).filter(a=>a.status==='active'&&a.floor===g.floor)];
const id=(g,a)=>a===g.player?'player':a.id;
const visible=(g,a)=>a===g.player||g.visibleTiles?.has(`${a.x},${a.y}`);
export function actorMoves(before,after){
  if(before.floor!==after.floor)return [];
  const next=new Map(actors(after).map(a=>[id(after,a),a]));
  return actors(before).flatMap(a=>{const b=next.get(id(before,a));
    if(!b||a.hp<=0||b.hp<=0||(a.x===b.x&&a.y===b.y)||!visible(before,a)||!visible(after,b))return [];
    return [{type:'move',actorId:id(before,a),floor:before.floor,from:{x:a.x,y:a.y},to:{x:b.x,y:b.y},travel:MOVE_MS,delay:0}];
  });
}
export function actorPosition(actor,actorId,floor,effects,time,reduceMotion=false){
  if(reduceMotion)return {x:actor.x,y:actor.y};
  const move=effects.findLast(e=>e.type==='move'&&e.actorId===actorId&&e.floor===floor&&time>=e.time&&time-e.time<e.travel&&(actor.x===e.from.x&&actor.y===e.from.y));
  if(!move)return {x:actor.x,y:actor.y};
  const t=Math.max(0,Math.min(1,(time-move.time)/move.travel)),u=t*t*(3-2*t);
  return {x:move.from.x+(move.to.x-move.from.x)*u,y:move.from.y+(move.to.y-move.from.y)*u};
}
export function shadeActorPixels(data){for(let i=0;i<data.length;i+=4)for(let k=0;k<3;k++)data[i+k]=Math.round(data[i+k]*DARK_ACTOR_BRIGHTNESS);return data;}
export class DarkActorCache{
  constructor(){this.cache=new WeakMap();}
  get(image){
    if(this.cache.has(image))return this.cache.get(image);
    let result=image;
    try{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;const c=canvas.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,canvas.width,canvas.height);shadeActorPixels(pixels.data);c.putImageData(pixels,0,0);result=canvas;}catch{/* Unavailable canvas pixel access: preserve the original image. */}
    this.cache.set(image,result);return result;
  }
}
