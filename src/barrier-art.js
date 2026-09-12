import {SCENERY_ATLAS} from './scenery.js';
export const PARTITION_HEIGHT=.5;
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
