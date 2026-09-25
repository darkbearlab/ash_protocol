import {roomTiles,roomContains,roomAt} from './map-geometry.js';
import {activeTrait} from './traits.js';
import {distance,lineOfSight} from './world.js';
import {objectSightGrid} from './scenery.js';
import {barrierBetween,edgeBlocks} from './barriers.js';
import {enemyDef} from './enemy-data.js';
import {ENEMY_TYPES,VOID} from './data.js';
import {FLARE_TUNING,flareLights} from './flares.js';

export const DARK_PENALTY=40;
export const fullLighting=grid=>grid.map(row=>row.map(()=>1));
// Separate deterministic stream: lighting never rerolls enemies, loot or combat RNG.
export function createLighting(grid,rooms,start,seed,floor,corridors=[]){
  const light=fullLighting(grid);
  const hash=i=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(i+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};
  const dark=rooms.map((room,i)=>({room,i,rank:hash(i)})).filter(({room:r})=>!roomContains(r,start)).sort((a,b)=>a.rank-b.rank||a.i-b.i).slice(0,3);
  for(const {room:r}of dark)for(const {x,y}of roomTiles(r))if(grid[y]?.[x]===1)light[y][x]=0;
  const assigned=new Set();
  for(const [i,path]of corridors.entries()){
    const endpoints=path.rooms.map(index=>rooms[index]),chosen=endpoints[hash(i+rooms.length)%2];
    const value=light[chosen.cy??chosen.y][chosen.cx??chosen.x];
    for(const p of path.cells){const k=p.x+','+p.y;if(grid[p.y]?.[p.x]===1&&roomAt(rooms,p)<0&&!assigned.has(k)){light[p.y][p.x]=value;assigned.add(k);}}
  }
  return light;
}
export const validLighting=(light,grid)=>Array.isArray(light)&&light.length===grid.length&&light.every((row,y)=>Array.isArray(row)&&row.length===grid[y].length&&row.every(n=>n===0||n===1));
// Missing lighting is lit for read-only previews and legacy callers; restore validates saves.

// ---- real lighting (3.178.0, user decisions 2026-09-25; docs/LIGHTING.md) -------------------------------------------
// `lighting` stays the power map the floor was generated with (1 powered, 0 not). A tile's brightness now comes from
// it and from the light sources: three levels, lit 2, dim 1, black 0. A tile takes the brightest source (no stacking);
// each source is lit within its core and one level darker per tile beyond it; walls and closed doors stop light (low
// partitions do not). Floors generated before 3.178.0 keep the old rule, where an unpowered tile is simply dim and
// nothing is black (`lightModel` absent).
export const LIGHT=Object.freeze({black:0,dim:1,lit:2});
export const LIGHT_MODEL=2;
export const LIGHT_TUNING=Object.freeze({
 lampCore:2,lampFade:1,        // a wall lamp: lit within 2, dim at 3
 lampTiles:20,maxLamps:48,     // about one lamp per 20 unpowered floor tiles of a room, at least one per room
 spill:1,                      // light from a powered area reaches 1 tile into an unpowered one, one level down
 flareFade:2,                  // beyond a flare's lit radius, 2 more tiles are dim
 glowstickRadius:3,glowstickRange:5,maxGlowsticks:400,
 flashlightCore:3,flashlightFade:1,flashlightHalfAngle:45   // a cone toward the locked target, else the facing
});
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const fnv=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const newLighting=game=>game?.lightModel===LIGHT_MODEL;

// Wall lamps (D1, user: every unpowered room has at least one, by its main walls, pillars and pits). Placed last, from
// hashes of their own, so nothing else on the floor moves; farthest-point spreading keeps a room's lamps apart.
export function placeLamps(map,seed,floor){
 if(!map?.lighting||!Array.isArray(map.rooms))return map;
 const lamps=[],key=p=>p.x+','+p.y;
 map.rooms.forEach((room,i)=>{
  const tiles=roomTiles(room).filter(p=>map.grid[p.y]?.[p.x]===1&&map.lighting[p.y]?.[p.x]===0);
  if(!tiles.length)return;
  const byWall=tiles.filter(p=>DIRS.some(([dx,dy])=>{const v=map.grid[p.y+dy]?.[p.x+dx];return v===0||v===VOID;}));
  const pool=byWall.length?byWall:tiles,count=Math.min(pool.length,Math.max(1,Math.round(tiles.length/LIGHT_TUNING.lampTiles)));
  const rank=p=>fnv(`${seed}:${floor}:lamp:${i}:${key(p)}`),picked=[pool.reduce((a,b)=>rank(b)<rank(a)?b:a)];
  while(picked.length<count){
   let best=null,bestD=-1;
   for(const p of pool){if(picked.some(q=>key(q)===key(p)))continue;const d=Math.min(...picked.map(q=>distance(p,q)));if(d>bestD||d===bestD&&rank(p)<rank(best)){best=p;bestD=d;}}
   if(!best)break;picked.push(best);
  }
  for(const p of picked)if(lamps.length<LIGHT_TUNING.maxLamps)lamps.push({id:`lamp-${floor}-${lamps.length}`,x:p.x,y:p.y});
 });
 map.lamps=lamps;map.lightModel=LIGHT_MODEL;return map;
}
export const validLamps=(lamps,grid)=>Array.isArray(lamps)&&lamps.length<=LIGHT_TUNING.maxLamps&&new Set(lamps.map(l=>l?.id)).size===lamps.length&&lamps.every(l=>l&&typeof l.id==='string'&&/^lamp-\d+-\d+$/.test(l.id)&&Object.keys(l).length===3&&grid[l.y]?.[l.x]===1);
export const validGlowsticks=(sticks,grid)=>Array.isArray(sticks)&&sticks.length<=LIGHT_TUNING.maxGlowsticks&&sticks.every(s=>s&&Object.keys(s).length===2&&Number.isInteger(s.x)&&Number.isInteger(s.y)&&grid[s.y]?.[s.x]===1);

// Where the flashlight points: at the locked enemy if there is one, else the way the operator last faced.
export function flashlightDirection(game){
 const p=game.player,e=game.target&&(game.enemies||[]).find(x=>x.id===game.target&&x.hp>0);
 if(e&&(e.x!==p.x||e.y!==p.y))return [e.x-p.x,e.y-p.y];
 return Array.isArray(p.facing)&&(p.facing[0]||p.facing[1])?p.facing:[0,1];
}
// Muzzle flashes (B8): a gun fired lights the tile it was fired from to dim, for the rest of that round and all of the
// next, so the other side can answer it: this action's shot effects, plus the last round's kept in `gunFlashes`
// (recordGunFlashes). Melee, claws, spit, thrown grenades and a gun with the flash hider (3.179.0) make none.
const GUN_STYLES=new Set(['bullet','plasma','grenade']);
export const MAX_GUN_FLASHES=64;
const gunFlash=e=>(e.type==='shot'&&e.weaponId!==undefined&&!e.suppressed&&GUN_STYLES.has(e.style||'bullet')||e.type==='enemyShot'&&['bullet','plasma'].includes(e.style||'bullet')&&(ENEMY_TYPES[e.attackerType]?.range??1)>1)&&Number.isInteger(e.from?.x)&&Number.isInteger(e.from?.y)?e.from:null;
export function muzzleFlashes(game){
 const out=[...(game.gunFlashes||[])];
 // A shot already kept in gunFlashes is skipped, so a live game and one restored from its save agree.
 for(const e of game.effects||[]){const from=!e.flashKept&&gunFlash(e);if(from)out.push(from);}
 return out;
}
// At the end of a round its shots replace the last round's: each flash is kept exactly one round beyond its own.
export function recordGunFlashes(game){
 const seen=new Set(),kept=[];
 for(const e of game.effects||[]){
  const from=gunFlash(e);if(!from||seen.has(from.x+','+from.y))continue;
  e.flashKept=true;seen.add(from.x+','+from.y);kept.push({x:from.x,y:from.y});
 }
 game.gunFlashes=kept.slice(-MAX_GUN_FLASHES);
}
export const validGunFlashes=(flashes,grid)=>Array.isArray(flashes)&&flashes.length<=MAX_GUN_FLASHES&&flashes.every(f=>f&&Object.keys(f).length===2&&Number.isInteger(f.x)&&Number.isInteger(f.y)&&grid[f.y]?.[f.x]!==undefined);
// Only floors on the new model come here (lightAt answers the old rule itself).
function lightKey(game){
 const p=game.player||{};let b=0,f=0,m=0,c=0;
 for(const [i,x] of (game.barriers||[]).entries())b=(Math.imul(b,31)+(x.hp>0?1:0)+(x.open?2:0)+i)|0;
 // Cover standing or not changes both a flare's shadows and what blocks the other lights (an enemy can blow a crate apart
 // in the middle of a round). The terrain itself never changes in place during play.
 for(const x of game.props||[])if(x.type==='cover'&&x.hp>0)c=(Math.imul(c,31)+x.x*97+x.y)|0;
 for(const x of game.flares||[])f=(Math.imul(f,31)+x.x*97+x.y*13+x.expires)|0;
 const flashes=muzzleFlashes(game);for(const x of flashes)m=(Math.imul(m,31)+x.x*97+x.y)|0;
 const stick=(game.glowsticks||[]).at(-1);   // the list is capped, so its length alone can stay the same
 const dir=p.flashlight?flashlightDirection(game).join():'';
 return `${game.lightModel}|${game.turn}|${game.floor}|${p.x},${p.y}|${dir}|${b}|${c}|${f}|${(game.flares||[]).length}|${(game.glowsticks||[]).length},${stick?.x},${stick?.y}|${(game.lamps||[]).length}|${m}|${flashes.length}`;
}
const CACHE=new WeakMap();
// How far the light sources reach and how bright, recomputed only when something that casts or blocks light changes.
// The power map and the spill from it are read live on top (lightAt), so they can never go stale.
function sourceLight(game){
 const key=lightKey(game),hit=CACHE.get(game);
 if(hit&&hit.key===key&&hit.grid===game.grid)return hit.levels;
 const levels=computeSources(game);CACHE.set(game,{key,levels,grid:game.grid});return levels;
}
const reaches=(game,src,pt)=>game.grid[pt.y]?.[pt.x]!==undefined&&game.grid[pt.y][pt.x]!==0&&lineOfSight(objectSightGrid(game,src,pt),src,pt,game.barriers||[],'blast');
// A source's cells: lit within `core`, one level darker per tile past it up to `reach`, never brighter than `cap`. Walls
// and closed doors stop it. `floor` (the grid so far) skips tiles already at least that bright, which saves the sight
// checks; the aim previews leave it out.
export function sourceCells(game,src,{core,reach,accept,cap=LIGHT.lit,floor}={}){
 const out=[];
 for(let y=src.y-reach;y<=src.y+reach;y++)for(let x=src.x-reach;x<=src.x+reach;x++){
  const pt={x,y},d=distance(src,pt);if(d>reach||accept&&!accept(pt))continue;
  const level=Math.min(cap,d<=core?LIGHT.lit:LIGHT.lit-(d-core));if(level<=LIGHT.black||floor&&!(level>floor[y]?.[x]))continue;
  if(reaches(game,src,pt))out.push({x,y,level});
 }
 return out;
}
// A flare, both models: the lit radius as judged before (walls, doors and full cover cast shadows); the new model adds a
// dim ring beyond it.
export function flareLightCells(game,fl,legacy=!newLighting(game)){
 const out=[],r=FLARE_TUNING.radius+(legacy?0:LIGHT_TUNING.flareFade);
 for(let y=fl.y-r;y<=fl.y+r;y++)for(let x=fl.x-r;x<=fl.x+r;x++){
  const pt={x,y},d=distance(fl,pt);if(d>r||game.grid[y]?.[x]===undefined)continue;
  if(d<=FLARE_TUNING.radius){if(flareLights(game,fl,pt))out.push({x,y,level:LIGHT.lit});}
  else if(reaches(game,fl,pt))out.push({x,y,level:LIGHT.dim});
 }
 return out;
}
export const glowstickCells=(game,pos)=>sourceCells(game,pos,{core:LIGHT_TUNING.glowstickRadius,reach:LIGHT_TUNING.glowstickRadius,cap:LIGHT.dim});
function computeSources(game){
 const L=game.grid.map(row=>row.map(()=>LIGHT.black));
 const raise=(x,y,v)=>{if(L[y]?.[x]!==undefined&&L[y][x]<v)L[y][x]=v;};
 const shine=(src,core,reach,accept,cap)=>{for(const c of sourceCells(game,src,{core,reach,accept,cap,floor:L}))raise(c.x,c.y,c.level);};
 for(const fl of game.flares||[])for(const c of flareLightCells(game,fl,false))raise(c.x,c.y,c.level);
 for(const lamp of game.lamps||[])shine(lamp,LIGHT_TUNING.lampCore,LIGHT_TUNING.lampCore+LIGHT_TUNING.lampFade);
 for(const stick of game.glowsticks||[])shine(stick,LIGHT_TUNING.glowstickRadius,LIGHT_TUNING.glowstickRadius,undefined,LIGHT.dim);   // dim within its radius, never lit
 const p=game.player;
 if(p?.flashlight){
  const [dx,dy]=flashlightDirection(game),len=Math.hypot(dx,dy)||1,cos=Math.cos(LIGHT_TUNING.flashlightHalfAngle*Math.PI/180)-1e-9;
  shine(p,LIGHT_TUNING.flashlightCore,LIGHT_TUNING.flashlightCore+LIGHT_TUNING.flashlightFade,pt=>{const vx=pt.x-p.x,vy=pt.y-p.y,n=Math.hypot(vx,vy);return n>0&&(vx*dx+vy*dy)/(n*len)>=cos;});
  raise(p.x,p.y,LIGHT.dim);   // B7: a lit flashlight gives its holder away
 }
 for(const f of muzzleFlashes(game))raise(f.x,f.y,LIGHT.dim);
 return L;
}
// Light spilling from a powered area through an opening or an open door (D2: one tile, one level down).
const spills=(game,x,y)=>game.grid[y]?.[x]===1&&DIRS.some(([dx,dy])=>{const q={x:x+dx,y:y+dy};return game.lighting[q.y]?.[q.x]===1&&game.grid[q.y]?.[q.x]===1&&!edgeBlocks(barrierBetween(game.barriers||[],{x,y},q),'blast');});
export function lightAt(game,point){
 const x=point?.x,y=point?.y;
 if(game?.lighting?.[y]?.[x]!==0)return LIGHT.lit;   // powered, off the map, or no power map at all
 // Floors from before 3.178.0 keep the old rule exactly: unpowered is dim unless a flare lights it, judged live.
 if(!newLighting(game))return game.flareLit?.({x,y})?LIGHT.lit:LIGHT.dim;
 const src=sourceLight(game)[y]?.[x]??LIGHT.black;
 return src===LIGHT.lit?src:Math.max(src,spills(game,x,y)?LIGHT.lit-LIGHT_TUNING.spill:LIGHT.black);
}
// Every tile's brightness at once, for tests and tools.
export const lightGrid=game=>game?.grid?game.grid.map((row,y)=>row.map((_,x)=>lightAt(game,{x,y}))):null;
// The one place that decides darkness: hit chances, ambush, the floor shading and the dark-actor drawing follow it.
// `isDark` is anything below lit (dim or black), as before; `isBlack` is the new third level.
export const isDark=(game,point)=>lightAt(game,point)<LIGHT.lit;
export const isBlack=(game,point)=>lightAt(game,point)===LIGHT.black;
// Who sees in the dark (B4, B6): night vision, and on the new lighting every swarm creature.
const swarmEyes=a=>a?.faction==='swarm'&&typeof a.type==='string'&&!a.kind;
export const seesInDark=(game,a)=>Boolean(activeTrait(a,'night_vision')||(newLighting(game)&&swarmEyes(a)));
const mechanical=b=>Boolean(activeTrait(b,'mechanical')||enemyDef(b)?.mechanical);
// B1, B5: someone standing in the black is hidden, even next to you, from an observer without night vision; infrared
// still finds anything warm (not machines). Tiles themselves never hide: sight passes through the black.
// 3.180.0 (user): an enemy the soldier's 預警 has marked counts one level brighter for the player — lockable in the black,
// dim as lit.
const markedFor=(game,observer,target)=>observer===game.player&&Boolean(activeTrait(target,'exposed'));
export function hiddenInDark(game,observer,target){
 if(!newLighting(game)||!observer||!target||observer===target)return false;
 if(!isBlack(game,target)||seesInDark(game,observer)||markedFor(game,observer,target))return false;
 return !(activeTrait(observer,'infrared')&&!mechanical(target));
}
export function lightingEffects(game,attacker,target){
  const level=Math.min(LIGHT.lit,lightAt(game,target)+(newLighting(game)&&markedFor(game,attacker,target)?1:0)),dark=level<LIGHT.lit,nightVision=seesInDark(game,attacker);
  return {dark,black:level===LIGHT.black,nightVision,penalty:dark&&!nightVision?DARK_PENALTY:0};
}

// Three small pixel bands inside known tiles; never paint hidden terrain.
export function floorShading(game,x,y){
  if(!game.seen[y]?.[x])return [];
  const directions=[[0,-1],[1,0],[0,1],[-1,0]],bands=[];
  // 3.178.0: the black is nearly black, keeping only the remembered outline, unless you see in the dark.
  if(isBlack(game,{x,y})&&!seesInDark(game,game.player)){
    const edges=directions.map(([dx,dy])=>game.seen[y+dy]?.[x+dx]&&game.grid[y+dy]?.[x+dx]===1&&!isBlack(game,{x:x+dx,y:y+dy}));
    bands.push({x:0,y:0,w:1,h:1,color:'#020409c8'});
    if(!edges.some(Boolean))bands.push({x:0,y:0,w:1,h:1,color:'#02040966'});
    else for(let i=0;i<3;i++){const n=(i+1)*.1,l=edges[3]?n:0,r=edges[1]?n:0,u=edges[0]?n:0,d=edges[2]?n:0;bands.push({x:l,y:u,w:1-l-r,h:1-u-d,color:'#02040938'});}
  }else if(isDark(game,{x,y})){
    const edges=directions.map(([dx,dy])=>game.seen[y+dy]?.[x+dx]&&game.grid[y+dy]?.[x+dx]===1&&!isDark(game,{x:x+dx,y:y+dy}));
    if(!edges.some(Boolean))bands.push({x:0,y:0,w:1,h:1,color:'#060c22a6'});
    else for(let i=0;i<4;i++){const n=i*.06,l=edges[3]?n:0,r=edges[1]?n:0,u=edges[0]?n:0,d=edges[2]?n:0;bands.push({x:l,y:u,w:1-l-r,h:1-u-d,color:i?'#060c222e':'#060c225c'});}
  }
  if(game.visibleTiles?.has(x+','+y))for(const [dx,dy]of directions){
    if(game.visibleTiles.has((x+dx)+','+(y+dy)))continue;
    for(let i=0;i<3;i++){const width=(3-i)*.06;bands.push({x:dx>0?1-width:0,y:dy>0?1-width:0,w:dx?width:1,h:dy?width:1,color:'#07111920'});}
  }
  return bands;
}
