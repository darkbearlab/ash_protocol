// Corpses on a layer of their own (3.211.0, user decisions 2026-10-01, docs/KILL_GORE.md 屍體圖層). Presentation only:
// the dead enemy's record stays in the game state, on its tile, where the rules read it (the necromancer's pool, rebel
// witnesses, the endless recovery), and nothing here is saved. At a kill the body is thrown along the blow — a light hit
// only slumps it, heavy melee, a point-blank shotgun and blasts throw it further — stops short of walls, closed edges,
// pits and solid props, and comes to rest off its tile's centre with a turn; the loot stays at the centre. After a
// reload, a new floor or a new run, a body is laid down in a fixed pose from its id instead (where it flew is gone, as
// the blood on the floor is). When a floor holds many bodies the oldest fade out, for phones (docs/KILL_GORE.md 效能).
// No DOM and no game state: its one import is src/gore.js (for the blow's force scale), which reads card and weapon
// data but never a game; the renderer hands in the floor through `world` ({open(x,y), edge(a,b)}).
import {goreForceScale} from './gore.js';

export const CORPSE_TUNING=Object.freeze({
  // How far a blow throws a body of size 1 at force 1, in tiles, by its kind (src/gore.js goreForce): a bullet only
  // slumps it; a melee blow by its heft; a shotgun by how close it was fired (1, 2, 3 tiles; farther, `pellet`).
  throw:Object.freeze({bullet:.16,pellet:.28,precision:.42,plasma:.26,blast:1.05,slash:.36,thrust:.5,saw:.1}),
  pointBlank:Object.freeze([1.1,.72,.42]),
  max:1.6,          // the farthest a body flies, in tiles
  slump:.25,        // under this a body only slumps where it fell: no flight, no hop, no trail
  side:.55,         // a slash also shoves the body this much sideways, across the blow
  radius:.28,       // half a body's width in tiles: how close it may come to a wall or a closed edge
  step:.04,         // the march along the throw, in tiles
  flight:Object.freeze({base:120,perTile:260}),   // ms: base + perTile × √distance
  hop:.14,          // how high a thrown body arcs, in tiles, per tile flown (at most .25)
  spin:1.3,         // radians of turn per tile flown
  pose:.65,         // the largest resting turn either way, in radians
  rest:Object.freeze([.04,.2]),   // how far a body rests off its centre when its fall is not known, in tiles
  keep:40,          // bodies drawn on one floor before the oldest start to fade
  fadeMs:1500,
});

// FNV-1a over the text, then a small generator: a fixed stream of numbers in [0,1) for a body.
function stream(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h=Math.imul(h^h>>>15,2246822507)>>>0;h=Math.imul(h^h>>>13,3266489909)>>>0;h^=h>>>16;return (h>>>0)/4294967296;};}

// The pose of a body whose fall is not known (a reload, an older kill): a short way off its centre in a direction and
// with a turn fixed by its id.
export function restingPose(id){
  const r=stream(`corpse:${id}`),a=r()*Math.PI*2,[lo,hi]=CORPSE_TUNING.rest,d=lo+(hi-lo)*r();
  return {dx:Math.cos(a)*d,dy:Math.sin(a)*d,angle:(r()*2-1)*CORPSE_TUNING.pose};
}

// How far, in tiles, the blow of a `fall` effect (src/presentation.js) throws the body: its kind and force, scaled down
// for big bodies (by √size) and held to `max`.
export function throwReach(fall){
  const f=fall?.force||{},T=CORPSE_TUNING.throw,style=f.style||'bullet';
  if(!fall?.blow)return 0;
  const base=style==='melee'?(T[f.cut]??T.slash)*(f.cut==='saw'?1:f.heft||1):style==='pellet'&&f.range>=1&&f.range<=CORPSE_TUNING.pointBlank.length?CORPSE_TUNING.pointBlank[f.range-1]:T[style]??T.bullet;
  return Math.min(CORPSE_TUNING.max,base*goreForceScale(f.damage)/Math.sqrt(Math.max(.36,fall.size||1)));
}

// How far along unit direction `dir` a body lying at tile `at` can go, up to `reach`: it may cross into other tiles only
// where world.open says a body can lie and no edge stops it (world.edge, between two side-by-side tiles), and its
// `radius` must stay off every wall or closed edge around it. A diagonal corner needs one open side, as a line of
// sight does.
export function corpseRest(at,dir,reach,world,radius=CORPSE_TUNING.radius){
  const step=CORPSE_TUNING.step;let best=0,tile={x:at.x,y:at.y};
  const pass=(a,b)=>{if(!world.open(b.x,b.y))return false;if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===1)return !world.edge(a,b);const h={x:b.x,y:a.y},v={x:a.x,y:b.y};return world.open(h.x,h.y)&&!world.edge(a,h)&&!world.edge(h,b)||world.open(v.x,v.y)&&!world.edge(a,v)&&!world.edge(v,b);};
  for(let i=1;reach>0;i++){
    const d=Math.min(reach,i*step),p={x:at.x+dir.x*d,y:at.y+dir.y*d},c={x:Math.round(p.x),y:Math.round(p.y)};
    if((c.x!==tile.x||c.y!==tile.y)&&!pass(tile,c))break;
    // The body's edges: a side it leans over must be open and not closed off from its tile.
    const ox=p.x-c.x,oy=p.y-c.y,sx=ox>.5-radius?1:ox<radius-.5?-1:0,sy=oy>.5-radius?1:oy<radius-.5?-1:0;
    if(sx&&!pass(c,{x:c.x+sx,y:c.y})||sy&&!pass(c,{x:c.x,y:c.y+sy})||sx&&sy&&!world.open(c.x+sx,c.y+sy))break;
    tile=c;best=d;if(d>=reach)break;
  }
  return best;
}

// The throw of one fall: where the body comes to rest (offset from its tile, in tiles), its turn, the path for the
// renderer's flight and trail. `side` (±1) is the kill's; a slash shoves the body that way too.
export function corpseThrow(fall,world,{side=1,id=fall?.actorId}={}){
  const pose=restingPose(id),at=fall.to,b=fall.blow;
  const reach=throwReach(fall);
  if(!b||reach<CORPSE_TUNING.slump){
    // A slump: the resting pose, a little along the blow when there is one, kept off the walls.
    const lean=b?{x:b.dx*reach+pose.dx*.5,y:b.dy*reach+pose.dy*.5}:{x:pose.dx,y:pose.dy},len=Math.hypot(lean.x,lean.y),dir=len?{x:lean.x/len,y:lean.y/len}:{x:1,y:0},d=corpseRest(at,dir,len,world);
    return {dx:dir.x*d,dy:dir.y*d,angle:pose.angle,dist:0,dir,duration:0,spin:0,hop:0};
  }
  const slash=fall.force?.style==='melee'&&(fall.force.cut||'slash')==='slash',raw={x:b.dx+(slash?-b.dy*side*CORPSE_TUNING.side:0),y:b.dy+(slash?b.dx*side*CORPSE_TUNING.side:0)};
  const turn=(stream(`throw:${id}`)()-.5)*.3,cos=Math.cos(turn),sin=Math.sin(turn),len=Math.hypot(raw.x,raw.y),dir={x:(raw.x*cos-raw.y*sin)/len,y:(raw.x*sin+raw.y*cos)/len};
  const dist=corpseRest(at,dir,reach,world),spin=(pose.angle>=0?1:-1)*CORPSE_TUNING.spin*dist;
  return {dx:dir.x*dist,dy:dir.y*dist,angle:pose.angle,dist,dir,duration:Math.round(CORPSE_TUNING.flight.base+CORPSE_TUNING.flight.perTile*Math.sqrt(dist)),spin,hop:Math.min(.25,CORPSE_TUNING.hop*dist)};
}

const ease=u=>1-Math.pow(1-u,3);
// One floor's bodies, by enemy id. `use(key, flat)` empties it when the run or the floor changes, and when the gore
// setting turns to or from off (`flat`: bodies on their tile's centre, as before 3.211.0); `fall` records a kill's throw
// as it plays; `pose` says where to draw a body at `time` (building a resting pose for one it never saw fall) and marks it
// drawn; `settle` keeps the count of drawn bodies at `keep`.
// Review (3.211.0): only bodies that have been drawn count toward the cap, in the order they were first drawn — a fall
// out of sight waits until it is seen. A body that is already past the cap the moment it is first drawn (the oldest ones
// rebuilt after a reload on a crowded floor) is hidden at once instead of fading in front of you.
export class CorpseLayer{
  constructor(tuning=CORPSE_TUNING){this.tuning=tuning;this.reset();}
  reset(){this.key=null;this.flat=false;this.bodies=new Map();this.order=0;this.fading=new Map();}
  use(key,flat=false){if(key!==this.key||flat!==this.flat){this.reset();this.key=key;this.flat=flat;}}
  // A body thrown by `fall` (an enemy's fall effect) starting at world `time`. `flat` (the gore setting is off) keeps the
  // old fall: no throw, the body on its tile's centre; `still` (reduced motion) puts it straight at rest. Not drawn yet.
  fall(fall,time,world,{side=1,flat=false,still=false}={}){
    const id=fall.actorId;if(id==null)return null;
    const t=flat?{dx:0,dy:0,angle:0,dist:0,dir:{x:1,y:0},duration:0,spin:0,hop:0}:corpseThrow(fall,world,{side,id});
    const body={...t,at:{x:fall.to.x,y:fall.to.y},start:time,duration:still?0:t.duration,order:null,shown:null};
    this.bodies.set(id,body);this.fading.delete(id);return body;
  }
  // Where `dead` lies at `time`: {x, y} offset from its tile in tiles, `lift` (the hop, in tiles), `angle`, `alpha`. The
  // first call for a body marks it drawn (its place in the cap's order and the time it first showed).
  pose(dead,time,world,{flat=false}={}){
    let body=this.bodies.get(dead.id);
    // A body that moved tiles since its fall (a record rewritten by the rules) starts over from its resting pose.
    if(body&&(body.at.x!==dead.x||body.at.y!==dead.y)){body=null;this.fading.delete(dead.id);}
    if(!body){const p=flat?{dx:0,dy:0,angle:0}:restingPose(dead.id),dir={x:p.dx,y:p.dy},len=Math.hypot(dir.x,dir.y),d=len?corpseRest(dead,{x:dir.x/len,y:dir.y/len},len,world):0;
      body={dx:len?dir.x/len*d:0,dy:len?dir.y/len*d:0,angle:p.angle,dist:0,duration:0,spin:0,hop:0,at:{x:dead.x,y:dead.y},start:-Infinity,order:null,shown:null};this.bodies.set(dead.id,body);}
    if(body.order===null){body.order=this.order++;body.shown=time;}
    const u=body.duration>0?Math.max(0,Math.min(1,(time-body.start)/body.duration)):1,k=ease(u);
    return {x:body.dx*k,y:body.dy*k,lift:u<1?body.hop*Math.sin(Math.PI*u):0,angle:body.angle-body.spin*(1-k),alpha:this.alpha(dead.id,time)};
  }
  // Forget the bodies that are no longer bodies (raised by the necromancer, or alive again); past `keep` drawn bodies,
  // the oldest fade from now, or go at once if they were first drawn just now. `dead` is the floor's current bodies.
  settle(dead,time){
    const ids=new Set(dead.map(e=>e.id));for(const id of [...this.bodies.keys()])if(!ids.has(id)){this.bodies.delete(id);this.fading.delete(id);}
    const drawn=[...this.bodies.entries()].filter(([,b])=>b.order!==null),extra=drawn.length-this.tuning.keep;if(extra<=0)return;
    for(const [id,b] of drawn.sort((a,b)=>a[1].order-b[1].order).slice(0,extra))if(!this.fading.has(id))this.fading.set(id,b.shown>=time?-Infinity:time);
  }
  alpha(id,time){const since=this.fading.get(id);return since===undefined?1:Math.max(0,1-(time-since)/this.tuning.fadeMs);}
}
