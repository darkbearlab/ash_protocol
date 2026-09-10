// Raised walls are cosmetic: ground-grid movement, visibility and cover stay unchanged.
import {WALL_ATLAS,approved,materialSprite,MATERIAL_SELECTION} from './materials.js';
export {WALL_ATLAS};
export const WALL_FACES=['armored','reinforced','concrete','ribbed','conduit','vent','hazard','access'];
export const WALL_CAPS=['steel','olive','concrete','grille','cables','grid','hazard','bolted'];
export const WALL_HEIGHT=.5;
const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const defaults={industrial:[0,0],sanitary:[2,2],security:[1,1],utility:[3,3]};
const solid=(g,x,y)=>g.grid[y]?.[x]!==undefined&&g.grid[y][x]!==1;
function hash(value){let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}

export function wallStyle(g,x,y,theme='industrial',selection=MATERIAL_SELECTION){
  // Pick the first adjacent room in saved order. Panels in one room share a cap.
  const room=g.rooms?.find(r=>x>=r.x-1&&x<=r.x+r.w&&y>=r.y-1&&y<=r.y+r.h);
  const seed=hash(`${g.seed}:${g.floor}:${room?.x??0}:${room?.y??0}`),pair=defaults[theme]||defaults.industrial;
  const explicit=room?.wallStyle,face=WALL_FACES.indexOf(explicit?.face),cap=WALL_CAPS.indexOf(explicit?.cap);
  const fi=face>=0?face:((x+y*3)%5===0?4+(seed%4):pair[0]),ci=cap>=0?cap:(seed%3===0?4+((seed>>>4)%4):pair[1]);
  return {face:approved('face',/^([TW]\d{2})$/.test(explicit?.face)?explicit.face:'W'+String(fi+1).padStart(2,'0'),selection),cap:approved('cap',/^([TW]\d{2})$/.test(explicit?.cap)?explicit.cap:'W'+String(ci+9).padStart(2,'0'),selection)};
}

export function wallGeometry(g,x,y,tile,center){
  const left=Math.round(center.x-tile/2),bottom=Math.round(center.y+tile/2),width=Math.round(center.x+tile/2)-left;
  const neighbors=DIRS.map(([dx,dy])=>solid(g,x+dx,y+dy));
  const groundTop=Math.round(center.y+tile/2-tile*WALL_HEIGHT),capTop=Math.round(center.y+tile/2-tile*(WALL_HEIGHT+1));
  // Every brick has the same half-tile face and full-tile cap, regardless of neighbors.
  const height=groundTop-capTop,faceHeight=bottom-groundTop;
  return {left,width,height,faceHeight,bottom,groundTop,capTop,neighbors};

}

export function drawWall(ctx,g,x,y,tile,center,images,theme='industrial',tones=null,selection=MATERIAL_SELECTION){
  const q=wallGeometry(g,x,y,tile,center),style=wallStyle(g,x,y,theme,selection);
  const texture=(id,top,height,fallback)=>{
    const sprite=materialSprite(id),image=images instanceof Map?images.get(sprite?.url):images;
    if(image?.complete&&image.naturalWidth>0&&sprite){
      const toned=tones?.get(image,sprite,'wall');
      ctx.drawImage(toned||image,toned?0:sprite.x,toned?0:sprite.y,32,32,q.left,top,q.width,height);
    }else{ctx.fillStyle=fallback;ctx.fillRect(q.left,top,q.width,height);}
  };
  ctx.save();ctx.imageSmoothingEnabled=false;
  // Fog dims the wall texture over an opaque backing, never reveals content underneath.
  const opacity=ctx.globalAlpha;ctx.globalAlpha=1;ctx.fillStyle='#142020';ctx.fillRect(q.left,q.capTop,q.width,q.bottom-q.capTop);ctx.globalAlpha=opacity;
  // Draw every complete brick; the normal back-to-front pass handles physical overlap.
  texture(style.face,q.groundTop,q.faceHeight,'#35433f');ctx.fillStyle='#111e22';ctx.fillRect(q.left,q.bottom-2,q.width,2);
  ctx.save();
  texture(style.cap,q.capTop,q.height,'#52615b');
  // No edge stroke between adjoining wall cells: corners/T/cross joints remain continuous.
  ctx.fillStyle='#54645d';if(!q.neighbors[0])ctx.fillRect(q.left,q.capTop,q.width,1);
  ctx.fillStyle='#1c2b2b';if(!q.neighbors[1])ctx.fillRect(q.left+q.width-1,q.capTop,1,q.height);
  if(!q.neighbors[3])ctx.fillRect(q.left,q.capTop,1,q.height);
  if(!q.neighbors[2])ctx.fillRect(q.left,q.groundTop-2,q.width,2);
  ctx.restore();ctx.restore();
  return q;
}
