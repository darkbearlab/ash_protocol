// Raised walls are cosmetic: ground-grid movement, visibility and cover stay unchanged.
export const WALL_ATLAS=new URL('../assets/pixel/walls-v1/atlas.png',import.meta.url).href;
export const WALL_FACES=['armored','reinforced','concrete','ribbed','conduit','vent','hazard','access'];
export const WALL_CAPS=['steel','olive','concrete','grille','cables','grid','hazard','bolted'];
export const WALL_HEIGHT=1;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const defaults={industrial:[0,0],sanitary:[2,2],security:[1,1],utility:[3,3]};
const solid=(g,x,y)=>g.grid[y]?.[x]!==undefined&&g.grid[y][x]!==1;
function hash(value){let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}

export function wallStyle(g,x,y,theme='industrial'){
  // Pick the first adjacent room in saved order. Panels in one room share a cap.
  const room=g.rooms?.find(r=>x>=r.x-1&&x<=r.x+r.w&&y>=r.y-1&&y<=r.y+r.h);
  const seed=hash(`${g.seed}:${g.floor}:${room?.x??0}:${room?.y??0}`),pair=defaults[theme]||defaults.industrial;
  const explicit=room?.wallStyle,face=WALL_FACES.indexOf(explicit?.face),cap=WALL_CAPS.indexOf(explicit?.cap);
  return {face:face>=0?face:((x+y*3)%5===0?4+(seed%4):pair[0]),cap:cap>=0?cap:(seed%3===0?4+((seed>>>4)%4):pair[1])};
}

export function wallGeometry(g,x,y,tile,center){
  const left=Math.round(center.x-tile/2),bottom=Math.round(center.y+tile/2),width=Math.round(center.x+tile/2)-left;
  const groundTop=Math.round(center.y-tile/2),capTop=Math.round(center.y-tile/2-tile*WALL_HEIGHT),height=groundTop-capTop,faceHeight=bottom-groundTop;
  const neighbors=DIRS.map(([dx,dy])=>solid(g,x+dx,y+dy));
  return {left,width,height,faceHeight,bottom,groundTop,capTop,neighbors,
    front:!neighbors[2],
    // Only known walkable space gets a cutaway; unknown rooms are never exposed by it.
    cutaway:g.grid[y-1]?.[x]===1&&Boolean(g.seen[y-1]?.[x])};
}

export function drawWall(ctx,g,x,y,tile,center,image,theme='industrial'){
  const q=wallGeometry(g,x,y,tile,center),style=wallStyle(g,x,y,theme);
  const ready=image?.complete&&image.naturalWidth>0;
  const texture=(index,top,height,fallback)=>{
    if(ready)ctx.drawImage(image,index%4*32,Math.floor(index/4)*32,32,32,q.left,top,q.width,height);
    else{ctx.fillStyle=fallback;ctx.fillRect(q.left,top,q.width,height);}
  };
  ctx.save();ctx.imageSmoothingEnabled=false;
  // South faces are exposed; connected walls share the raised top instead of stacked faces.
  if(q.front){texture(style.face,q.groundTop,q.faceHeight,'#35433f');ctx.fillStyle='#111e22';ctx.fillRect(q.left,q.bottom-2,q.width,2);}
  ctx.save();if(q.cutaway)ctx.globalAlpha*=.12;
  texture(8+style.cap,q.capTop,q.height,'#52615b');
  // No edge stroke between adjoining wall cells: corners/T/cross joints remain continuous.
  ctx.fillStyle='#99a89b';if(!q.neighbors[0])ctx.fillRect(q.left,q.capTop,q.width,1);
  ctx.fillStyle='#1c2b2b';if(!q.neighbors[1])ctx.fillRect(q.left+q.width-1,q.capTop,1,q.height);
  if(!q.neighbors[3])ctx.fillRect(q.left,q.capTop,1,q.height);
  if(!q.neighbors[2])ctx.fillRect(q.left,q.groundTop-2,q.width,2);
  ctx.restore();ctx.restore();
  return q;
}
