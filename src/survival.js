// Survival (3.189.0, user design 2026-09-26; docs/SURVIVAL.md). One floor with a target point in every room. Waves arrive
// on a fixed schedule in groups: some go to hold a point, some come for you. A point held at the end of a round costs its
// own life and the facility's integrity one each; a point that falls costs the facility more. When the survival turns are
// up the exit opens and the points and integrity are locked; leaving wins, an integrity of 0 loses.
// 3.191.0 (user, after playing): the whole map is known from the start; a point counts as held only while an enemy stands
// on it, so you can stand on it yourself to stop the loss; every enemy walks around the points that are not its own; and
// each wave is announced (targets, entry markers) well before it arrives.
import {t} from './i18n.js';
import {distance,key,makeEnemy} from './world.js';
import {roomContains} from './map-geometry.js';
import {factionPool} from './faction-catalog.js';
import {rollEnemyAffixes,birthRandom} from './enemy-affixes.js';
import {rollEnemyElite} from './elite-enemies.js';
import {isNoncombatant} from './enemy-data.js';
import {WEAPONS} from './data.js';
import {AMMUNITION} from './ammunition.js';
import {levelCost} from './perks.js';

export const SURVIVAL_TUNING=Object.freeze({
 integrity:250,pointHp:15,pointLoss:20,   // user, to test with
 turns:240,                                // the exit opens at this turn (user: well over 150; docs/SURVIVAL.md 試跑)
 firstWave:30,waveInterval:35,             // when each wave arrives (3.194.0, user: room to lay traps; 3.192.0 had 15 and 30)
 lead:12,                                  // 3.191.0: turns between a wave's announcement and its arrival
 liveLimit:40,spawnDistance:8,spawnBand:8, // user: at most 40 at once, at least 8 turns' walk from the target
 pointSpawnDistance:14,pointSpawnBand:8,   // 3.196.0 (user): a strike on the points comes from further off
 pointClearance:3,                         // a point group never arrives closer than this to you (hunters: spawnDistance)
 groupsMax:4,groupGrowth:5,sizeBase:2,sizeGrowth:4,sizeMax:5,depthGrowth:3,depthMax:9,
 kitWeapons:3,startLevel:5,                // 3.194.0 (user): the starting kit
});
// The guns a kit draws from (every gun but the drop-only ones); a melee class gets one blade among them.
const KIT_GUNS=Object.freeze([0,1,2,3,4,5,6,8]);
const T=SURVIVAL_TUNING;
export const isSurvival=g=>g?.mission?.id==='survival';
export const pointLetter=i=>String.fromCharCode(65+i);
const pointIndex=pt=>Number(pt.id.slice(6));
export const pointName=pt=>t('survival.pointName',{letter:pointLetter(pointIndex(pt))});
const combatant=e=>e.hp>0&&!isNoncombatant(e);
// 3.191.0 (user): a point is held while an enemy stands on it; you (or an ally) standing there keeps it.
export const pressedBy=(g,pt)=>g.enemies.some(e=>combatant(e)&&e.x===pt.x&&e.y===pt.y);
// The run keeps its own length (set when it starts), so a later change to the tuning leaves a run in progress alone.
export const turnsLeft=g=>Math.max(0,(g.survival?.turns??T.turns)-g.turn);
const groupSize=n=>Math.min(T.sizeMax,T.sizeBase+Math.floor(n/T.sizeGrowth));
// A wave's groups in words: point groups one by one, the hunters together ("4 coming for you from 2 sides").
function describeGroups(groups){
 const hunters=groups.filter(x=>x.role==='hunter'),points=groups.filter(x=>x.role==='point').map(x=>t('survival.groupPoint',{n:x.n,point:x.point}));
 const total=hunters.reduce((sum,x)=>sum+x.n,0),hunt=!hunters.length?[]:[hunters.length>1?t('survival.groupHunters',{n:total,groups:hunters.length}):t('survival.groupHunter',{n:total})];
 return [...points,...hunt].join(t('common.listSeparator'));
}
// How a point shows (main map and floor map): fallen, held or quiet; 3.192.0 (user): a point a group is after (announced
// or on its way) wears a terminal-style frame instead of a colour, and the entries are not shown at all.
export function pointStatus(g,pt){if(pt.hp<=0)return 'fallen';if(g.survival.open)return 'quiet';return pt.pressed?'pressed':'quiet';}
export function pointTargeted(g,pt){
 const s=g.survival;if(pt.hp<=0||s.open)return false;
 return s.incoming.some(i=>i.target===pt.id)||g.enemies.some(e=>combatant(e)&&e.survival?.target===pt.id);
}
// 3.191.0 (user): enemies walk around the points, all but the one their group is sent to hold (src/game.js passable).
export function pointBlocks(g,actor,x,y){
 const s=g.survival;if(!s||s.open||!actor?.survival)return false;
 for(const pt of s.points)if(pt.x===x&&pt.y===y&&pt.hp>0)return !(actor.survival.role==='point'&&actor.survival.target===pt.id);
 return false;
}

// Walking distances from a tile over floor and passable edges (units ignored: they move).
function walk(g,from){
 const out=new Map([[key(from),0]]),queue=[from];
 for(let i=0;i<queue.length;i++){const q=queue[i],d=out.get(key(q));for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:q.x+dx,y:q.y+dy},k=key(n);if(out.has(k)||!g.passable(n.x,n.y)||!g.canRoute(q,n))continue;out.set(k,d+1);queue.push(n);}}
 return out;
}
const at=k=>{const [x,y]=k.split(',').map(Number);return {x,y};};
const free=(g,p)=>g.passable(p.x,p.y)&&!g.enemies.some(e=>e.hp>0&&key(e)===key(p))&&key(g.player)!==key(p)&&!g.activeAllies.some(a=>key(a)===key(p))&&!g.props.some(o=>key(o)===key(p))&&!g.hazards.some(h=>key(h)===key(p));
const standing=g=>g.survival.points.filter(pt=>pt.hp>0);

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
 g.survival={integrity:T.integrity,points,wave:0,nextWave:T.firstWave,open:false,turns:T.turns,incoming:[]};
 survivalKit(g,taken);
 return g;
}

// 3.194.0 (user): one floor means no later armouries, so the run starts with a basic build. Three weapons you do not carry
// lie beside you (by seed; affixes rolled like any drop), every ammunition reserve is full, and there is experience for
// level 5, so its picks come up at once. Placed and drawn by hash, never from the floor's own random stream.
function survivalKit(g,taken){
 const p=g.player,rng=birthRandom(g.seed,g.floor,'survival-kit','survival-v2'),carried=new Set(p.owned.map(slot=>p.weaponBases[slot]));
 const take=list=>list.splice(Math.floor(rng()*list.length),1)[0],guns=KIT_GUNS.filter(w=>!carried.has(w));
 const blades=WEAPONS.map((w,i)=>w.melee&&!w.locked&&!carried.has(i)&&!carried.has(WEAPONS.findIndex(o=>o.code===w.code))?i:-1).filter(i=>i>=0);
 const bases=p.owned.some(slot=>WEAPONS[p.weaponBases[slot]]?.melee)&&blades.length?[take(blades)]:[];
 while(bases.length<T.kitWeapons&&guns.length)bases.push(take(guns));
 const beside=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).filter(q=>g.passable(q.x,q.y)&&g.canCross(p,q)&&!taken.has(key(q)));
 bases.forEach((weapon,i)=>{const at=beside[i]||{x:p.x,y:p.y};g.items.push(g.registerWeapon({x:at.x,y:at.y,type:'weapon',weapon},true));});
 for(const [type,ammo] of Object.entries(AMMUNITION))if(type!=='grenade'&&ammo.key)p[ammo.key]=Math.max(p[ammo.key]||0,g.ammoCapacity(type));
 for(let level=p.level;level<T.startLevel;level++)p.xp+=levelCost(g,level);
 g.settleLevels();
}

// Where a group comes in: 8–16 turns' walk from its target (3.196.0: a point group 14–22, falling back to 8–16 on a
// cramped floor), outside the target's room, clear of you (hunters by spawnDistance, point groups by pointClearance)
// and of every standing point; out of sight if it can be.
const BANDS=Object.freeze({hunter:[[T.spawnDistance,T.spawnBand]],point:[[T.pointSpawnDistance,T.pointSpawnBand],[T.spawnDistance,T.spawnBand]]});
function entryRules(g,role,target,[near,band]=BANDS[role][0]){
 const home=role==='point'?g.rooms.find(r=>roomContains(r,target)):null,fromTarget=walk(g,target),fromPlayer=walk(g,g.player);
 const clearance=role==='hunter'?T.spawnDistance:T.pointClearance,points=standing(g);
 return {fromTarget,ok:p=>{const d=fromTarget.get(key(p));return d!==undefined&&d>=near&&d<=near+band&&!(home&&roomContains(home,p))&&(fromPlayer.get(key(p))??99)>=clearance&&points.every(q=>distance(q,p)>2);}};
}
function entrySpots(g,role,target){
 for(const band of BANDS[role]){
  const {fromTarget,ok}=entryRules(g,role,target,band),pick=unseen=>[...fromTarget.keys()].map(at).filter(p=>ok(p)&&free(g,p)&&(!unseen||!g.visible(p)));
  const hidden=pick(true),spots=hidden.length?hidden:pick(false);if(spots.length)return spots;
 }
 return [];
}
// An announced entry still stands at arrival while its distances hold; someone standing on it only moves the spawns aside.
const entryValid=(g,entry,target)=>BANDS[entry.role].some(band=>entryRules(g,entry.role,target,band).ok(entry));
// 3.196.0 (user): a hunt drives you into a corner. Its groups come in from the side of the standing points (nearer their
// middle than you are), so you give ground away from them, and the second group keeps apart from the first (a pincer).
function herdingSpots(g,spots,anchors){
 const pts=standing(g);if(!pts.length)return spots;
 const mid={x:pts.reduce((sum,pt)=>sum+pt.x,0)/pts.length,y:pts.reduce((sum,pt)=>sum+pt.y,0)/pts.length},gap=Math.hypot(g.player.x-mid.x,g.player.y-mid.y);
 const inside=spots.filter(q=>Math.hypot(q.x-mid.x,q.y-mid.y)<gap),pool=inside.length?inside:spots;
 const apart=pool.filter(q=>anchors.every(a=>distance(a,q)>=6));return apart.length?apart:pool;
}

// The announcement (lead turns ahead). 3.196.0 (user): the waves alternate instead of splitting in two: a hunt (every
// group comes for you, first at turn 30), then a strike on the points (every group goes for a different point where it
// can), each at the full size a whole wave used to have, so the force over time is as before. The groups and their
// size still grow with the wave number. Each group gets its entry now; its target point shows its frame until it is over.
export const waveKind=n=>n%2===0?'hunt':'strike';
function announceWave(g){
 const s=g.survival,n=s.wave,groups=Math.min(T.groupsMax,2+Math.floor(n/T.groupGrowth)),due=Math.max(s.nextWave,g.turn+T.lead),told=[],chosen=new Set(),anchors=[];
 for(let group=0;group<groups;group++){
  const rng=birthRandom(g.seed,g.floor,`wave-${n}-${group}`,'survival-v2'),left=standing(g),hunter=waveKind(n)==='hunt'||!left.length;
  const fresh=left.filter(pt=>!chosen.has(pt.id)),pool=fresh.length?fresh:left;
  const target=hunter?g.player:pool[Math.floor(rng()*pool.length)];
  let spots=entrySpots(g,hunter?'hunter':'point',target);if(hunter)spots=herdingSpots(g,spots,anchors);
  if(!spots.length)continue;
  const entry=spots[Math.floor(rng()*spots.length)];anchors.push(entry);if(!hunter)chosen.add(target.id);
  s.incoming.push({wave:n,group,due,role:hunter?'hunter':'point',target:hunter?null:target.id,x:entry.x,y:entry.y});
  told.push({role:hunter?'hunter':'point',n:groupSize(n),point:hunter?null:pointName(target)});
 }
 if(told.length)g.log(t('survival.warning',{wave:n+1,n:due-g.turn,groups:describeGroups(told)}),true);
 s.wave++;s.nextWave=due+T.waveInterval;
}

// The arrival: a group whose point fell meanwhile goes for the standing point nearest its entry (or hunts you when none is
// left); an entry you walked up to, or one that no longer suits, moves. Enemies are made at a depth that grows with the
// waves (cards, health, damage, affixes and elites follow this run's difficulty).
function arriveGroup(g,entry,room){
 const s=g.survival,n=entry.wave,depth=Math.min(T.depthMax,1+Math.floor(n/T.depthGrowth)),pool=factionPool(g.facilityFaction,depth).filter(type=>type);
 const rng=birthRandom(g.seed,g.floor,`arrive-${n}-${entry.group}`,'survival-v2'),left=standing(g);
 let role=entry.role,target=role==='hunter'?g.player:left.find(pt=>pt.id===entry.target);
 if(role==='point'&&!target){target=[...left].sort((a,b)=>distance(a,entry)-distance(b,entry)||a.id.localeCompare(b.id))[0];if(!target){role='hunter';target=g.player;}}
 let anchor={x:entry.x,y:entry.y};
 if(!entryValid(g,{...anchor,role},target)){const spots=entrySpots(g,role,target);if(!spots.length)return {made:0};anchor=spots[Math.floor(rng()*spots.length)];}
 // Every enemy of the group, not just the entry, keeps the entry's distances (user: never in the target's room, 8+ away).
 const {ok}=entryRules(g,role,target);
 const near=[...walk(g,anchor).entries()].filter(([,d])=>d<=3).map(([k])=>at(k)).filter(p=>free(g,p)&&ok(p)).sort((a,b)=>distance(a,anchor)-distance(b,anchor)||a.y-b.y||a.x-b.x);
 let made=0;
 for(const p of near){
  if(made>=groupSize(n)||made>=room)break;
  const type=pool[Math.floor(rng()*pool.length)],id=`survival-${n}-${entry.group}-${made}`;
  let e=makeEnemy(type,p.x,p.y,id,depth,g.difficultySpec,g.facilityFaction);e=rollEnemyElite(rollEnemyAffixes(e,g.seed,depth,g.difficultySpec),g.seed,depth,g.difficultySpec);
  Object.assign(e,{faction:g.facilityFaction,alert:true,lastKnown:{x:g.player.x,y:g.player.y},survival:role==='hunter'?{role:'hunter'}:{role:'point',target:target.id}});
  g.enemies.push(e);made++;
  g.effects.push({type:'portalSpawn',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0});   // 3.194.0: out of the rift portal
 }
 return {made,group:{role,n:made,point:role==='hunter'?null:pointName(target)}};
}

// End of each round (after the enemies have moved): count the held points, then announce and bring in the waves due,
// then keep the hunters on you.
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
 const arriving=s.incoming.filter(i=>i.due<=g.turn);
 if(arriving.length){
  s.incoming=s.incoming.filter(i=>i.due>g.turn);const byWave=new Map();
  for(const entry of arriving){const room=T.liveLimit-g.enemies.filter(combatant).length;if(room<=0)break;const r=arriveGroup(g,entry,room);if(r.made){if(!byWave.has(entry.wave))byWave.set(entry.wave,[]);byWave.get(entry.wave).push(r.group);}}
  for(const [wave,groups] of byWave)g.log(t('survival.wave',{wave:wave+1,groups:describeGroups(groups)}),true);
 }
 while(g.turn>=s.nextWave-T.lead)announceWave(g);
 for(const e of g.enemies)if(combatant(e)&&e.survival?.role==='hunter'){e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};}
 g.reveal();
}

// Enemy turns (src/enemy-behavior.js): a point group walks to its point, past you unless you stand in its way, and one of
// them stands on it while the rest guard it from beside it (holdsPoint keeps them from moving off). If you hold the point
// yourself, they fight you for it. A hunter far off still closes in: the tree otherwise idles past 16.
const targetPoint=(g,e)=>{const pts=standing(g);let pt=pts.find(p=>p.id===e.survival?.target);if(!pt&&pts.length){pt=[...pts].sort((a,b)=>distance(a,e)-distance(b,e)||a.id.localeCompare(b.id))[0];e.survival.target=pt.id;}return pt;};
const occupant=(g,pt)=>[g.player,...g.activeAllies,...g.enemies.filter(combatant)].find(u=>u.hp>0&&u.x===pt.x&&u.y===pt.y);
export const holdsPoint=(g,e)=>{
 if(!g.survival||g.survival.open||e.survival?.role!=='point')return false;
 const pt=targetPoint(g,e);if(!pt)return false;const d=distance(e,pt);
 return d===0||d===1&&Boolean(occupant(g,pt));
};
export function survivalAction(ctx,move){
 const {g,e,p,d,los}=ctx;if(!g.survival||!e.survival)return false;
 if(e.survival.role==='hunter'){if(d<=16)return false;const saved=e.lastKnown;e.lastKnown={x:p.x,y:p.y};move({...ctx,los:false,d});if(!e.moved)e.lastKnown=saved;return e.moved;}
 if(g.survival.open)return false;
 const pt=targetPoint(g,e);if(!pt||distance(e,pt)===0||distance(e,p)<=1)return false;
 if(key(p)===key(pt)&&los)return false;   // someone of yours holds it: fight them for it
 if(distance(e,pt)===1&&occupant(g,pt))return false;
 const saved=e.lastKnown;e.lastKnown={x:pt.x,y:pt.y};move({...ctx,los:false,d:distance(e,pt)});e.lastKnown=saved;return e.moved;
}

export function validSurvival(g){
 const s=g.survival,int=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 if(!isSurvival(g))return s===undefined&&!g.enemies.some(e=>e.survival!==undefined);
 if(!s||typeof s!=='object'||!int(s.integrity,0,T.integrity)||!int(s.wave,0,100000)||!int(s.nextWave,1,1e7)||!int(s.turns,1,1e6)||typeof s.open!=='boolean'||!Array.isArray(s.points)||s.points.length>20||!Array.isArray(s.incoming)||s.incoming.length>40)return false;
 const ids=new Set();
 for(const [i,pt] of s.points.entries()){if(!pt||pt.id!==`point-${i}`||Object.keys(pt).length!==5||!int(pt.hp,0,T.pointHp)||typeof pt.pressed!=='boolean'||g.grid[pt.y]?.[pt.x]!==1)return false;ids.add(pt.id);}
 for(const i of s.incoming)if(!i||Object.keys(i).length!==7||!int(i.wave,0,100000)||!int(i.group,0,T.groupsMax-1)||!int(i.due,1,1e7)||!(i.role==='hunter'&&i.target===null||i.role==='point'&&ids.has(i.target))||g.grid[i.y]?.[i.x]!==1)return false;
 return g.enemies.every(e=>e.survival===undefined||(e.survival.role==='hunter'&&Object.keys(e.survival).length===1)||(e.survival.role==='point'&&Object.keys(e.survival).length===2&&ids.has(e.survival.target)));
}
