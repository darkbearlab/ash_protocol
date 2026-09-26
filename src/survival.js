// Survival (3.189.0, user design 2026-09-26; docs/SURVIVAL.md). One floor with a target point in every room. Waves arrive
// on a fixed schedule in groups: some go to hold a point, some come for you. A point held at the end of a round costs its
// own life and the facility's integrity one each; a point that falls costs the facility more. When the survival turns are
// up the exit opens and the points and integrity are locked; leaving wins, an integrity of 0 loses.
import {t} from './i18n.js';
import {distance,key,makeEnemy} from './world.js';
import {roomContains} from './map-geometry.js';
import {factionPool} from './faction-catalog.js';
import {rollEnemyAffixes,birthRandom} from './enemy-affixes.js';
import {rollEnemyElite} from './elite-enemies.js';
import {isNoncombatant} from './enemy-data.js';

export const SURVIVAL_TUNING=Object.freeze({
 integrity:250,pointHp:15,pointLoss:20,   // user, to test with
 turns:240,                                // the exit opens at this turn (user: well over 150; docs/SURVIVAL.md 試跑)
 firstWave:6,waveInterval:20,              // Claude's numbers, from the bot runs
 liveLimit:40,spawnDistance:8,spawnBand:8, // user: at most 40 at once, at least 8 turns' walk from the target
 groupsMax:4,groupGrowth:5,sizeBase:2,sizeGrowth:4,sizeMax:5,depthGrowth:3,depthMax:9,
});
const T=SURVIVAL_TUNING;
export const isSurvival=g=>g?.mission?.id==='survival';
export const pointLetter=i=>String.fromCharCode(65+i);
export const pointName=pt=>t('survival.pointName',{letter:pointLetter(Number(pt.id.slice(6)))});
const combatant=e=>e.hp>0&&!isNoncombatant(e);
export const pressedBy=(g,pt)=>g.enemies.some(e=>combatant(e)&&distance(e,pt)<=1);
// The run keeps its own length (set when it starts), so a later change to the tuning leaves a run in progress alone.
export const turnsLeft=g=>Math.max(0,(g.survival?.turns??T.turns)-g.turn);

// Walking distances from a tile over floor and passable edges (units ignored: they move).
function walk(g,from){
 const out=new Map([[key(from),0]]),queue=[from];
 for(let i=0;i<queue.length;i++){const q=queue[i],d=out.get(key(q));for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:q.x+dx,y:q.y+dy},k=key(n);if(out.has(k)||!g.passable(n.x,n.y)||!g.canRoute(q,n))continue;out.set(k,d+1);queue.push(n);}}
 return out;
}
const at=k=>{const [x,y]=k.split(',').map(Number);return {x,y};};
const free=(g,p)=>g.passable(p.x,p.y)&&!g.enemies.some(e=>e.hp>0&&key(e)===key(p))&&key(g.player)!==key(p)&&!g.activeAllies.some(a=>key(a)===key(p))&&!g.props.some(o=>key(o)===key(p))&&!g.hazards.some(h=>key(h)===key(p));

// Set the floor up for survival: no starting fighters, nests or swarm waves; a point in each room near its middle, on
// floor you can stand on, not on the start or the exit.
export function setupSurvival(g){
 g.enemies=g.enemies.filter(e=>isNoncombatant(e));g.props=g.props.filter(o=>o.type!=='nest');g.swarmWaves=undefined;
 const from=walk(g,g.start),taken=new Set([key(g.start),key(g.end),...g.props.map(key),...g.items.map(key)]),points=[];
 g.rooms.forEach(room=>{
  const middle={x:room.cx??Math.round(room.x+room.w/2),y:room.cy??Math.round(room.y+room.h/2)};
  const tiles=[...from.keys()].map(at).filter(p=>roomContains(room,p)&&!taken.has(key(p))&&g.grid[p.y][p.x]===1).sort((a,b)=>distance(a,middle)-distance(b,middle)||a.y-b.y||a.x-b.x);
  if(tiles.length){const p=tiles[0];points.push({id:`point-${points.length}`,x:p.x,y:p.y,hp:T.pointHp,pressed:false});taken.add(key(p));}
 });
 g.survival={integrity:T.integrity,points,wave:0,nextWave:T.firstWave,open:false,turns:T.turns};
 return g;
}

// A wave (never next to any standing point, so no point is held the moment it arrives): groups alternate between holding a point and hunting you; they grow with the waves, and the enemies are made
// at a depth that grows too (cards, health, damage, affixes and elites follow this run's difficulty).
function spawnWave(g){
 const s=g.survival,n=s.wave,groups=Math.min(T.groupsMax,2+Math.floor(n/T.groupGrowth)),size=Math.min(T.sizeMax,T.sizeBase+Math.floor(n/T.sizeGrowth));
 const depth=Math.min(T.depthMax,1+Math.floor(n/T.depthGrowth)),pool=factionPool(g.facilityFaction,depth).filter(type=>type),standing=s.points.filter(pt=>pt.hp>0);
 let room=T.liveLimit-g.enemies.filter(combatant).length,made=0,serial=0;const told=[];
 for(let group=0;group<groups&&room>0;group++){
  const rng=birthRandom(g.seed,g.floor,`wave-${n}-${group}`,'survival-v1'),hunter=group%2===1||!standing.length;
  const target=hunter?g.player:standing[Math.floor(rng()*standing.length)];
  const home=g.rooms.find(r=>roomContains(r,target)),fromTarget=walk(g,target),fromPlayer=walk(g,g.player);
  const pick=(unseen)=>[...fromTarget.entries()].filter(([k,d])=>{const p=at(k);return d>=T.spawnDistance&&d<=T.spawnDistance+T.spawnBand&&!(home&&roomContains(home,p))&&(fromPlayer.get(k)??99)>=T.spawnDistance&&standing.every(q=>distance(q,p)>2)&&free(g,p)&&(!unseen||!g.visible(p));}).map(([k])=>at(k));
  const spots=pick(true).length?pick(true):pick(false);if(!spots.length)continue;
  const anchor=spots[Math.floor(rng()*spots.length)],near=[...walk(g,anchor).entries()].filter(([,d])=>d<=3).map(([k])=>at(k)).filter(p=>free(g,p)&&(fromPlayer.get(key(p))??99)>=T.spawnDistance&&standing.every(q=>distance(q,p)>2)).sort((a,b)=>distance(a,anchor)-distance(b,anchor)||a.y-b.y||a.x-b.x);
  let count=0;
  for(const p of near){
   if(count>=size||room<=0)break;
   const type=pool[Math.floor(rng()*pool.length)],id=`survival-${n}-${serial++}`;
   let e=makeEnemy(type,p.x,p.y,id,depth,g.difficultySpec,g.facilityFaction);e=rollEnemyElite(rollEnemyAffixes(e,g.seed,depth,g.difficultySpec),g.seed,depth,g.difficultySpec);
   Object.assign(e,{faction:g.facilityFaction,alert:true,lastKnown:{x:g.player.x,y:g.player.y},survival:hunter?{role:'hunter'}:{role:'point',target:target.id}});
   g.enemies.push(e);count++;room--;made++;
  }
  if(count)told.push(hunter?t('survival.groupHunter',{n:count}):t('survival.groupPoint',{n:count,point:pointName(target)}));
 }
 if(made)g.log(t('survival.wave',{wave:n+1,groups:told.join(t('common.listSeparator'))}),true);
}

// End of each round (after the enemies have moved): count the held points, then the waves due, then keep the hunters on you.
export function tickSurvival(g){
 const s=g.survival;if(!s||g.status!=='playing')return;
 if(!s.open&&g.turn>=s.turns){s.open=true;for(const pt of s.points)pt.pressed=false;g.log(t('survival.open'),true);}
 if(!s.open){
  for(const pt of s.points){
   const was=pt.pressed;pt.pressed=pt.hp>0&&pressedBy(g,pt);if(!pt.pressed)continue;
   if(!was)g.log(t('survival.pointPressed',{point:pointName(pt)}),true);
   pt.hp--;s.integrity--;if(pt.hp<=0){pt.pressed=false;s.integrity-=T.pointLoss;g.log(t('survival.pointLost',{point:pointName(pt),loss:T.pointLoss}),true);}
  }
  // With every point fallen the facility is lost whatever its integrity (user's first rule; 7 points × 35 is under 250).
  if(s.points.length&&s.points.every(pt=>pt.hp<=0))s.integrity=0;
  s.integrity=Math.max(0,s.integrity);
  if(s.integrity<=0){g.status='failed';g.pendingPerks=0;g.log(t('survival.failed'),true);return;}
 }
 while(g.turn>=s.nextWave){spawnWave(g);s.wave++;s.nextWave+=T.waveInterval;}
 for(const e of g.enemies)if(combatant(e)&&e.survival?.role==='hunter'){e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};}
 g.reveal();
}

// Enemy turns (src/enemy-behavior.js): a point group walks to its point, past you unless you stand in its way, and once
// there holds it (holdsPoint keeps it from moving off). A hunter far off still closes in: the tree otherwise idles past 16.
const targetPoint=(g,e)=>{const s=g.survival,pts=s?.points.filter(p=>p.hp>0)||[];let pt=pts.find(p=>p.id===e.survival?.target);if(!pt&&pts.length){pt=[...pts].sort((a,b)=>distance(a,e)-distance(b,e)||a.id.localeCompare(b.id))[0];e.survival.target=pt.id;}return pt;};
export const holdsPoint=(g,e)=>{if(!g.survival||g.survival.open||e.survival?.role!=='point')return false;const pt=targetPoint(g,e);return Boolean(pt)&&distance(e,pt)<=1;};
export function survivalAction(ctx,move){
 const {g,e,p,d}=ctx;if(!g.survival||!e.survival)return false;
 if(e.survival.role==='hunter'){if(d<=16)return false;const saved=e.lastKnown;e.lastKnown={x:p.x,y:p.y};move({...ctx,los:false,d});if(!e.moved)e.lastKnown=saved;return e.moved;}
 if(g.survival.open)return false;
 const pt=targetPoint(g,e);if(!pt||distance(e,pt)<=1||distance(e,p)<=1)return false;
 const saved=e.lastKnown;e.lastKnown={x:pt.x,y:pt.y};move({...ctx,los:false,d:distance(e,pt)});e.lastKnown=saved;return e.moved;
}

export function validSurvival(g){
 const s=g.survival,int=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 if(!isSurvival(g))return s===undefined&&!g.enemies.some(e=>e.survival!==undefined);
 if(!s||typeof s!=='object'||!int(s.integrity,0,T.integrity)||!int(s.wave,0,100000)||!int(s.nextWave,1,1e7)||!int(s.turns,1,1e6)||typeof s.open!=='boolean'||!Array.isArray(s.points)||s.points.length>20)return false;
 const ids=new Set();
 for(const [i,pt] of s.points.entries()){if(!pt||pt.id!==`point-${i}`||Object.keys(pt).length!==5||!int(pt.hp,0,T.pointHp)||typeof pt.pressed!=='boolean'||g.grid[pt.y]?.[pt.x]!==1)return false;ids.add(pt.id);}
 return g.enemies.every(e=>e.survival===undefined||(e.survival.role==='hunter'&&Object.keys(e.survival).length===1)||(e.survival.role==='point'&&Object.keys(e.survival).length===2&&ids.has(e.survival.target)));
}
