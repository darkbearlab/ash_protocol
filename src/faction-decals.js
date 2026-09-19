// Faction decals (3.139.0, user decisions 2026-09-19; docs/FACTION_DECALS.md): Codex's faction traces (art/faction-
// overlays-v1) scattered sparsely over a facility floor. Purely cosmetic. Placement is a fixed hash of seed, floor and tile
// over what the floor was generated with (the grid, props, start and exit), never the map or combat dice and never
// anything that changes in play (units, items, hazards), so a floor looks the same after a reload and rules and saves
// cannot notice.
//
// Atlas: six 4x4 sheets of 32x32 cells side by side, in DECAL_PACKS order. Row 0 floor traces, row 1 wall-face traces,
// row 2 wall-cap traces (the user found they read well on the ground, so they go on the floor), row 3 prop traces
// (unused: no decal sits on any prop).
// - floor: open floor with no prop, module, start or exit on it;
// - face: the half-height front of a wall with floor directly south of it.
// A decal gets its own size, mirror and place. The place may drift up to `spread` tiles past its tile, but only towards
// ground of the same kind: a floor decal onto open floor, a face decal along the row onto the next visible face. Anything
// still reaching another kind of tile (a wall, a prop, a module, the exit) is cut off at that tile's edge.
// The renderer draws each piece right after the tile it sits on (a floor before its darkness bands, fog, traces and props;
// a wall in the back-to-front wall pass), toned like that tile (src/art-tone.js): floor pieces with the floor tone and the
// brightness gain of the floor texture underneath, face pieces with the wall tone.
import {moduleCells} from './modules.js';
import {tonePixel,floorGain} from './art-tone.js';
import {resolveSprite,themeAt} from './themes.js';
import {wallGeometry} from './walls.js';

export const DECAL_ATLAS=new URL('../assets/pixel/faction-decals-v1/atlas.png',import.meta.url).href;
export const DECAL_PACKS=['loyalist-1','loyalist-2','rebel','rebel-2','swarm','swarm-2'];
export const FACTION_PACKS={loyalist:['loyalist-1','loyalist-2'],rebel:['rebel','rebel-2'],swarm:['swarm','swarm-2']};
// The user's preview settings (2026-09-19): density 0.5, clustering 0.5, sizes 40-100% of a tile, a random place drifting
// up to half a tile, decal brightness 60% before the tone. floor/face are the base chances per tile; near and nearBoost
// double the chance within 3 tiles of a nest. The preview also doubled it near enemies, which move and so cannot shape a
// fixed layout; the base chances are 1.6x the preview's (.07, .14) so a floor carries as many decals on average as the
// user saw (about 21 floor and 6 face decals over 360 floors).
export const DECAL_TUNING={floor:.115,face:.22,patch:5,patchMin:.15,patchMax:1.85,near:3,nearBoost:2,
 density:.5,patchiness:.5,minScale:.4,maxScale:1,spread:.5,boost:.6};
// Cells never drawn. Claude left out the ones covering more than half the cell or drawing a whole object; the user
// kicked out loyalist-1 #10 #11, rebel-2 #8 #9 #10 and swarm #10 in the preview (2026-09-19).
export const EXCLUDED_CELLS={'loyalist-1':[2,10,11,13],'loyalist-2':[5,9],'rebel':[12,14],'rebel-2':[8,9,10],'swarm':[10,12],'swarm-2':[12,15]};
// Loud decals (big red marks, large slime) are drawn a third as often as the quiet traces.
export const LOUD_CELLS={'loyalist-1':[0],'loyalist-2':[4],'rebel':[2,4,5],'rebel-2':[2],'swarm':[1,2],'swarm-2':[]};
export const LOUD_WEIGHT=1/3,REPEAT_RADIUS=3;
// The visible pixels of every cell, [x,y,w,h] in cell pixels (assets/pixel/faction-decals-v1/atlas.json, from the atlas).
export const CELL_BOUNDS={
 'loyalist-1':[[2,6,27,19],[3,2,25,28],[2,2,27,27],[2,3,28,26],[12,2,9,28],[4,2,24,28],[10,2,12,28],[4,2,23,27],[10,2,12,28],[10,2,12,28],[2,8,28,15],[2,2,28,28],[2,5,28,22],[3,2,25,28],[9,2,14,28],[2,2,28,27]],
 'loyalist-2':[[3,2,25,28],[2,2,28,28],[3,2,26,28],[8,3,14,27],[2,2,27,28],[2,2,27,27],[8,2,16,28],[3,2,26,28],[7,2,17,28],[5,2,22,28],[2,9,28,15],[10,2,12,28],[2,6,28,19],[6,2,19,28],[7,2,18,28],[8,2,16,28]],
 'rebel':[[3,2,26,28],[4,2,24,28],[3,2,25,28],[2,2,27,28],[4,2,24,26],[3,2,25,28],[3,2,25,27],[6,2,19,28],[2,4,28,23],[2,3,28,26],[2,4,28,24],[2,5,28,22],[2,2,28,27],[2,4,27,24],[4,2,24,27],[7,3,18,27]],
 'rebel-2':[[3,3,26,25],[4,2,23,28],[3,2,25,28],[2,4,28,24],[2,2,28,27],[9,2,13,28],[9,2,13,28],[5,2,21,28],[2,3,28,26],[2,3,28,26],[3,2,26,28],[4,2,23,28],[4,2,24,28],[8,2,15,28],[2,7,28,18],[2,5,28,23]],
 'swarm':[[2,2,28,27],[2,3,28,26],[2,2,28,28],[2,2,28,27],[6,2,20,28],[6,2,19,28],[7,2,17,28],[7,2,17,28],[4,2,23,28],[4,2,23,28],[5,2,22,28],[4,2,25,28],[3,2,26,28],[3,2,25,28],[4,3,26,24],[4,2,24,28]],
 'swarm-2':[[5,4,25,26],[3,2,26,28],[2,4,28,23],[3,2,26,28],[8,2,17,28],[11,2,10,28],[11,2,9,28],[6,2,19,28],[2,2,28,26],[3,2,25,28],[5,3,23,27],[8,2,16,28],[2,3,28,26],[2,2,28,28],[4,2,23,28],[2,2,28,28]],
};
const ROWS={floor:[0,2],face:[1]};
const TONE_ROLE={floor:'floor',face:'wall'};

export function hash01(...parts){let h=2166136261;for(const c of parts.join(':')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967296;}
const smooth=t=>t*t*(3-2*t);
// Value noise in [0,1]: a random knot every `size` tiles, smoothly blended in between.
export function patchNoise(seed,floor,x,y,size=DECAL_TUNING.patch){
 const gx=Math.floor(x/size),gy=Math.floor(y/size),fx=smooth(x/size-gx),fy=smooth(y/size-gy),k=(i,j)=>hash01(seed,floor,gx+i,gy+j,'overlay-patch');
 const top=k(0,0)+(k(1,0)-k(0,0))*fx,bottom=k(0,1)+(k(1,1)-k(0,1))*fx;return top+(bottom-top)*fy;
}
const floorAt=(g,x,y)=>g.grid[y]?.[x]===1;
// A wall whose front face shows: floor directly south of it (anything else south covers the face with its cap).
export const faceAt=(g,x,y)=>g.grid[y]?.[x]!==undefined&&!floorAt(g,x,y)&&floorAt(g,x,y+1);
const key=o=>`${o.x},${o.y}`;
// Floor no decal may reach, even in part: every prop (furniture, cover, barrels, nests, terminals, supply cases), the
// facility modules (their own floor art) and the exit.
export function closedGround(g){
 const cells=[...g.props,...g.props.filter(p=>p.type==='module').flatMap(moduleCells),g.exitPoint||{},g.end||{}];
 return new Set(cells.filter(o=>Number.isInteger(o?.x)).map(key));
}

// Every decal on the floor: {layer,x,y,pack,cell,flip,scale,u,v}. tuning and exclude are the preview's overrides.
export function decalPlan(g,{tuning=DECAL_TUNING,exclude=EXCLUDED_CELLS}={}){
 const packs=FACTION_PACKS[g.facilityFaction];if(!packs||!g.grid)return [];
 const T=tuning,seed=g.seed,floor=g.floor,size=g.grid.length;
 const nests=g.props.filter(p=>p.type==='nest');
 const near=(x,y)=>nests.some(h=>Math.abs(h.x-x)+Math.abs(h.y-y)<=T.near);
 const patch=(x,y)=>1+(T.patchMin+(T.patchMax-T.patchMin)*patchNoise(seed,floor,x,y,T.patch)-1)*T.patchiness;
 const chance=(base,x,y)=>base*T.density*patch(x,y)*(near(x,y)?T.nearBoost:1);
 const plan=[];
 const pick=(layer,x,y)=>{
  // Pack by hash; cell by a weighted hash among the row's usable cells (loud ones weigh less), never the same decal as
  // one already placed within REPEAT_RADIUS tiles in this layer.
  for(let attempt=0;attempt<6;attempt++){
   const pack=packs[hash01(seed,floor,x,y,layer,'pack',attempt)<.5?0:1];
   const cells=ROWS[layer].flatMap(row=>[0,1,2,3].map(c=>row*4+c)).filter(c=>!exclude[pack]?.includes(c)),weight=c=>LOUD_CELLS[pack].includes(c)?LOUD_WEIGHT:1;
   if(!cells.length)continue;
   let roll=hash01(seed,floor,x,y,layer,'cell',attempt)*cells.reduce((a,c)=>a+weight(c),0),cell=cells[cells.length-1];
   for(const c of cells){roll-=weight(c);if(roll<0){cell=c;break;}}
   if(plan.some(o=>o.layer===layer&&o.pack===pack&&o.cell===cell&&Math.max(Math.abs(o.x-x),Math.abs(o.y-y))<=REPEAT_RADIUS))continue;
   return {layer,x,y,pack,cell,flip:hash01(seed,floor,x,y,layer,'flip')<.5,
    scale:T.minScale+(T.maxScale-T.minScale)*hash01(seed,floor,x,y,layer,'size'),
    u:hash01(seed,floor,x,y,layer,'u'),v:hash01(seed,floor,x,y,layer,'v')};
  }
  return null;
 };
 const busy=new Set([...closedGround(g),g.start?key(g.start):'']);
 for(let y=0;y<size;y++)for(let x=0;x<g.grid[y].length;x++){
  const layer=floorAt(g,x,y)?(busy.has(`${x},${y}`)?null:'floor'):faceAt(g,x,y)?'face':null;
  if(layer&&hash01(seed,floor,x,y,layer)<chance(T[layer],x,y)){const o=pick(layer,x,y);if(o)plan.push(o);}
 }
 return plan;
}

// Where a decal lands, in units of its home rectangle (a floor tile, or a wall's half-height face) from that rectangle's
// top-left corner. Its visible pixels stay inside the home widened by `spread` towards each side whose neighbour is the
// same kind of ground; u and v pick the place within that range.
export function decalBox(g,o,closed,spread=DECAL_TUNING.spread){
 const [x0,y0,w,h]=CELL_BOUNDS[o.pack]?.[o.cell]||[0,0,32,32],bx=o.flip?32-x0-w:x0,s=o.scale;
 const open=(dx,dy)=>o.layer==='floor'?floorAt(g,o.x+dx,o.y+dy)&&!closed.has(`${o.x+dx},${o.y+dy}`):!dy&&faceAt(g,o.x+dx,o.y);
 const lo=[open(-1,0)?-spread:0,open(0,-1)?-spread:0],hi=[1+(open(1,0)?spread:0),1+(open(0,1)?spread:0)];
 const v0=[bx/32*s,y0/32*s],v1=[(bx+w)/32*s,(y0+h)/32*s],at=(i,t,a=lo[i],b=hi[i])=>{const min=a-v0[i],max=b-v1[i];return min+(max-min)*t;};
 let x=at(0,o.u),y=at(1,o.v);
 // Drifting both ways at once can leave the middle of a decal in a corner tile of another kind, where it would be cut
 // away almost whole; pull back whichever axis overshoots less.
 const cx=x+(v0[0]+v1[0])/2,cy=y+(v0[1]+v1[1])/2,sx=cx<0?-1:cx>1?1:0,sy=cy<0?-1:cy>1?1:0;
 if(sx&&sy&&!open(sx,sy)){if((sx<0?-cx:cx-1)<(sy<0?-cy:cy-1))x=at(0,o.u,0,1);else y=at(1,o.v,0,1);}
 return {x,y,size:s,vis:{x0:x+v0[0],y0:y+v0[1],x1:x+v1[0],y1:y+v1[1]}};
}

// The pieces each tile draws: {floor,face} arrays indexed y*width+x, each entry a list of {o,box,whole}. A decal reaching
// several tiles of its own kind is one piece per tile; tiles of another kind get nothing. `whole` marks a piece that is
// the entire decal inside its own tile, which needs no clipping.
export function decalPieces(g,plan,spread=DECAL_TUNING.spread){
 const width=g.grid[0]?.length||0,closed=closedGround(g),out={floor:[],face:[],boxes:[]};
 for(const o of plan){
  const box=decalBox(g,o,closed,spread),v=box.vis,whole=v.x0>=0&&v.y0>=0&&v.x1<=1&&v.y1<=1;let tiles=0,cut=false;
  for(let dy=Math.floor(v.y0);dy<Math.ceil(v.y1);dy++)for(let dx=Math.floor(v.x0);dx<Math.ceil(v.x1);dx++){
   const x=o.x+dx,y=o.y+dy,same=o.layer==='floor'?floorAt(g,x,y)&&!closed.has(`${x},${y}`):!dy&&faceAt(g,x,y);
   if(!same){cut=true;continue;}
   (out[o.layer][y*width+x]??=[]).push({o,box,whole});tiles++;
  }
  out.boxes.push({o,box,tiles,cut});
 }
 return out;
}

// Draws the decals for a Renderer. One instance per renderer; the plan is built once per floor (per grid) and reused.
export class FactionDecals{
 constructor(){this.tuning=DECAL_TUNING;this.exclude=EXCLUDED_CELLS;this.plans=new WeakMap();this.cells=new Map();this.gains=new Map();}
 // The preview (qa/faction-overlay-lab.html) tries other settings and cell lists here; the game never calls it.
 configure({tuning=this.tuning,exclude=this.exclude}={}){this.tuning=tuning;this.exclude=exclude;this.plans=new WeakMap();this.cells.clear();}
 pieces(g){
  if(!g?.grid||!FACTION_PACKS[g.facilityFaction])return null;
  let p=this.plans.get(g.grid);if(!p){p=decalPieces(g,decalPlan(g,{tuning:this.tuning,exclude:this.exclude}),this.tuning.spread);this.plans.set(g.grid,p);}
  return p;
 }
 // After a floor tile's texture: a is its centre, size the texture size the renderer drew.
 floor(r,x,y,a,size){this.draw(r,'floor',x,y,{x:Math.round(a.x)-Math.floor(size/2),y:Math.round(a.y)-Math.floor(size/2),w:size,h:size});}
 // After a wall: q is its geometry from drawWall.
 face(r,x,y,q){this.draw(r,'face',x,y,{x:q.left,y:q.groundTop,w:q.width,h:q.faceHeight});}
 home(r,o){
  const a=r.project(o.x,o.y);
  if(o.layer==='face'){const q=wallGeometry(r.game,o.x,o.y,r.tile,a);return {x:q.left,y:q.groundTop,w:q.width,h:q.faceHeight};}
  const size=Math.ceil(r.tile);return {x:Math.round(a.x)-Math.floor(size/2),y:Math.round(a.y)-Math.floor(size/2),w:size,h:size};
 }
 draw(r,layer,x,y,rect){
  const image=r.terrainImages?.get(DECAL_ATLAS);if(!image?.complete||!image.naturalWidth)return;
  const g=r.game,list=this.pieces(g)?.[layer][y*(g.grid[0]?.length||0)+x];if(!list)return;
  const c=r.ctx,gain=layer==='floor'?this.floorGain(r,image,{x,y}):1;
  for(const {o,box,whole} of list){
   const cell=this.cell(image,o,gain);if(!cell)continue;
   const home=whole?rect:this.home(r,o),dw=Math.max(1,Math.round(home.w*box.size)),dh=Math.max(1,Math.round(home.h*box.size));
   const px=Math.round(home.x+box.x*home.w),py=Math.round(home.y+box.y*home.h);
   c.save();c.imageSmoothingEnabled=false;
   if(!whole){c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();}
   if(o.flip){c.translate(px+dw,py);c.scale(-1,1);c.drawImage(cell,0,0,32,32,0,0,dw,dh);}else c.drawImage(cell,0,0,32,32,px,py,dw,dh);
   c.restore();
  }
 }
 // The brightness gain src/art-tone.js gives the floor texture at this tile, so a decal matches the floor it lies on.
 floorGain(r,atlas,point){
  const sprite=resolveSprite(themeAt(r.game,point),'floor',r.game),image=sprite&&r.terrainImages.get(sprite.url);
  if(!image?.complete||!image.naturalWidth)return 1;
  const id=`${sprite.url}:${sprite.x}:${sprite.y}:${sprite.size}`;if(this.gains.has(id))return this.gains.get(id);
  let gain=1;
  try{const canvas=document.createElement('canvas');canvas.width=canvas.height=sprite.size;const c=canvas.getContext('2d');c.drawImage(image,sprite.x,sprite.y,sprite.size,sprite.size,0,0,sprite.size,sprite.size);gain=floorGain(c.getImageData(0,0,sprite.size,sprite.size).data);}catch{gain=1;}
  this.gains.set(id,gain);return gain;
 }
 // One cell, brightened by `boost` and toned like its host, cached per cell and gain.
 cell(image,o,gain){
  const role=TONE_ROLE[o.layer],boost=this.tuning.boost,id=`${o.pack}:${o.cell}:${role}:${gain.toFixed(3)}:${boost}`;if(this.cells.has(id))return this.cells.get(id);
  let canvas=null;
  try{
   canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');
   c.drawImage(image,DECAL_PACKS.indexOf(o.pack)*128+(o.cell%4)*32,Math.floor(o.cell/4)*32,32,32,0,0,32,32);
   const pixels=c.getImageData(0,0,32,32),d=pixels.data;
   for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const rgb=tonePixel([d[i],d[i+1],d[i+2]],role,(role==='floor'?gain:1)*boost);d[i]=rgb[0];d[i+1]=rgb[1];d[i+2]=rgb[2];}
   c.putImageData(pixels,0,0);
  }catch{canvas=null;}
  this.cells.set(id,canvas);return canvas;
 }
}
