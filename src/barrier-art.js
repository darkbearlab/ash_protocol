import {SCENERY_ATLAS} from './scenery.js';
export const PARTITION_HEIGHT=.5;
export const DOOR_ATLAS=new URL('../assets/pixel/doors-v1/atlas.png',import.meta.url).href;
export function barrierEndpoints(b){return b.axis==='x'?[{x:b.x,y:b.y-.5},{x:b.x,y:b.y+.5}]:[{x:b.x-.5,y:b.y},{x:b.x+.5,y:b.y}];}
// Shared steel connector posts close the physical cap/face gap at L/T/cross
// vertices. Collinear panels need no post. Open doors retain only their jambs.
export function barrierJunctions(barriers){
  const vertices=new Map();
  for(const b of barriers)if(b.hp>0&&['partition','low_partition','door'].includes(b.type))for(const p of barrierEndpoints(b)){
    const key=`${p.x},${p.y}`;if(!vertices.has(key))vertices.set(key,{...p,edges:[]});vertices.get(key).edges.push(b);
  }
  return [...vertices.values()].filter(v=>v.edges.length>=2&&new Set(v.edges.map(b=>b.axis)).size>1);
}
function texturedBox(ctx,q,images,url,columns,face,cap){
  const image=images?.get(url),ready=image?.complete&&image.naturalWidth;
  for(const [index,y,h,fallback]of [[face,q.faceTop,q.height,'#485661'],[cap,q.top,q.depth,'#7a8b92']]){
    if(ready)ctx.drawImage(image,index%columns*32,Math.floor(index/columns)*32,32,32,q.left,y,q.width,h);
    else{ctx.fillStyle=fallback;ctx.fillRect(q.left,y,q.width,h);}
  }
}
export function drawJunction(ctx,j,center,tile,images){
  const t=Math.max(2,Math.round(tile*.16)),bottom=Math.round(center.y+t/2),faceTop=bottom-Math.round(tile*.5);
  const q={left:Math.round(center.x-t/2),width:t,bottom,faceTop,top:faceTop-t,depth:t,height:bottom-faceTop};
  ctx.save();ctx.imageSmoothingEnabled=false;texturedBox(ctx,q,images,SCENERY_ATLAS,4,14,15);
  ctx.fillStyle=j.edges.every(b=>b.type==='low_partition')?'#c2b276':'#93b4c2';ctx.fillRect(q.left,q.top,q.width,1);ctx.restore();return q;
}
export function doorGeometry(b,center,tile){
  if(!b.open)return [partitionGeometry(b,center,tile)];
  return [-1,1].map(sign=>{
    const length=tile*.16,offset=sign*(tile-length)/2,p={x:center.x+(b.axis==='y'?offset:0),y:center.y+(b.axis==='x'?offset:0)};
    const q=partitionGeometry(b,p,tile),width=b.axis==='y'?length:q.width,depth=b.axis==='x'?length:q.depth;
    const bottom=Math.round(p.y+depth/2),faceTop=bottom-q.height;
    return {...q,left:Math.round(p.x-width/2),width:Math.round(width),bottom,faceTop,top:Math.round(faceTop-depth),depth:Math.round(depth)};
  });
}
export function drawDoor(ctx,b,center,tile,images){
  const boxes=doorGeometry(b,center,tile);ctx.save();ctx.imageSmoothingEnabled=false;
  for(const q of boxes)texturedBox(ctx,q,images,DOOR_ATLAS,2,b.open?2:0,1);
  ctx.restore();return boxes;
}
export function partitionGeometry(b,center,tile){
  const thickness=tile*.16,height=tile*PARTITION_HEIGHT;
  const width=b.axis==='x'?thickness:tile,depth=b.axis==='x'?tile:thickness;
  const left=Math.round(center.x-width/2),bottom=Math.round(center.y+depth/2),top=Math.round(center.y-depth/2-height),faceTop=Math.round(bottom-height);
  return {left,top,bottom,faceTop,width:Math.round(width),depth:faceTop-top,height:bottom-faceTop};
}
export function drawPartition(ctx,b,center,tile,images){
  const q=partitionGeometry(b,center,tile),image=images?.get(SCENERY_ATLAS),ready=image?.complete&&image.naturalWidth;
  const texture=(index,y,h,fallback)=>{
    if(ready)ctx.drawImage(image,index%4*32,Math.floor(index/4)*32,32,32,q.left,y,q.width,h);
    else{ctx.fillStyle=fallback;ctx.fillRect(q.left,y,q.width,h);}
  };
  ctx.save();ctx.imageSmoothingEnabled=false;
  texture(14,q.faceTop,q.height,b.type==='low_partition'?'#656453':'#4a555f');
  texture(15,q.top,q.depth,b.type==='low_partition'?'#85836b':'#74818d');
  // Same physical height, distinct top trim: low rails can be vaulted/shot over.
  ctx.fillStyle=b.type==='low_partition'?'#c2b276':'#93b4c2';ctx.fillRect(q.left,q.top,q.width,Math.max(1,tile*.04));
  ctx.fillStyle='#1c292d';ctx.fillRect(q.left,q.bottom-1,q.width,1);ctx.restore();return q;
}
