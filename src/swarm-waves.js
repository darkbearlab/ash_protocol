import {SWARM_TUNING as T} from './swarm-tuning.js';
import {factionDef} from './factions.js';
import {birthRandom} from './enemy-affixes.js';
import {distance,key,reachable} from './world.js';
import {roomTiles} from './map-geometry.js';
import {occupied} from './allies.js';

export const hordeCount=g=>g.enemies.filter(e=>e.hp>0&&e.horde===true).length;
export function addSwarmWaves(map,seed,floor,faction){
 if(!factionDef(faction)?.hordeType||floor<T.hordeMinFloor)return map;
 const seen=reachable(map,map.start),blocked=new Set([...map.enemies,...map.props,...map.items,...map.hazards,...(map.slots||[]),...(map.openings||[]).flatMap(o=>o.cells)].map(key));
 const rng=birthRandom(seed,floor,'invasion','horde-origin-v1');
 const points=map.rooms.flatMap((r,i)=>i===map.startRoom?[]:roomTiles(r).filter(p=>seen.has(key(p))&&!blocked.has(key(p))&&distance(p,map.start)>2&&distance(p,map.end)>2)).map(p=>({...p,order:rng()})).sort((a,b)=>a.order-b.order);
 if(points.length){const {x,y}=points[0];map.swarmWaves={origin:{x,y},active:false,remaining:T.hordeWaves*T.hordeWaveSize,serial:0,wave:0,cooldown:0,pending:[]};}
 return map;
}
const free=(g,p)=>g.passable(p.x,p.y)&&!occupied(g,p)&&!g.props.some(q=>key(q)===key(p))&&!g.items.some(q=>key(q)===key(p))&&!g.hazards.some(q=>key(q)===key(p))&&distance(p,g.start)>1&&distance(p,g.end)>1;
export function tickSwarmWaves(g){
 const s=g.swarmWaves;if(!s)return;
 if(!s.active){if(distance(g.player,s.origin)>T.hordeTriggerRadius)return;s.active=true;g.log('地底傳來密集震動：蟲潮正在接近！',true);}
 if(s.cooldown>0)s.cooldown--;
 const pending=[];
 for(const p of s.pending){
  if(p.due>g.turn){pending.push(p);continue;}
  if(hordeCount(g)>=T.hordeLiveLimit||!free(g,p)){pending.push({...p,due:g.turn+1});continue;}
  const e=g.spawnEnemy(factionDef(g.facilityFaction).hordeType,p.x,p.y,p.id);e.horde=true;e.expendable=true;e.reinforcement=true;e.affixes=[];e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);s.serial++;s.remaining--;
  g.effects.push({type:'nestSpawn',nestStyle:'burrow',from:{...s.origin},to:{x:e.x,y:e.y},damage:0});
 }
 s.pending=pending;
 if(s.pending.length||s.cooldown||s.wave>=T.hordeWaves||T.hordeLiveLimit-hordeCount(g)<T.hordeWaveSize)return;
 const candidates=[...reachable(g,s.origin)].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};}).filter(p=>distance(p,s.origin)<=T.hordeSpawnRadius&&free(g,p)&&!g.reinforcements.some(q=>key(q)===key(p))).sort((a,b)=>distance(a,s.origin)-distance(b,s.origin)||a.y-b.y||a.x-b.x);
 if(candidates.length<T.hordeWaveSize)return;
 s.pending=candidates.slice(0,T.hordeWaveSize).map((p,i)=>({...p,id:`horde-${g.floor}-${s.wave*T.hordeWaveSize+i}`,due:g.turn+T.hordeWarningTurns}));s.wave++;s.cooldown=T.hordeInterval;
 g.log('蟲潮增援已標記，兩次行動後破土。',true);
}
export const reinforcementTelegraphs=g=>[...(g.reinforcements||[]),...(g.swarmWaves?.pending||[])];
export function validSwarmWaves(g){
 const total=T.hordeWaves*T.hordeWaveSize,s=g.swarmWaves,children=g.enemies.filter(e=>e.horde!==undefined);
 if(!s)return s===undefined&&!children.length;
 const int=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi,point=p=>p&&int(p.x,0,g.grid.length-1)&&int(p.y,0,g.grid.length-1)&&g.grid[p.y][p.x]===1;
 if(!factionDef(g.facilityFaction)?.hordeType||g.floor<T.hordeMinFloor||!point(s.origin)||typeof s.active!=='boolean'||!int(s.remaining,0,total)||!int(s.serial,0,total)||s.serial+s.remaining!==total||!int(s.wave,0,T.hordeWaves)||!int(s.cooldown,0,T.hordeInterval)||!Array.isArray(s.pending)||s.pending.length>T.hordeWaveSize||s.serial+s.pending.length!==s.wave*T.hordeWaveSize)return false;
 if(!s.active&&(s.wave||s.serial||s.cooldown)||children.length!==s.serial||hordeCount(g)>T.hordeLiveLimit)return false;
 const ids=new Set(),points=new Set(),expected=new Set(Array.from({length:s.wave*T.hordeWaveSize},(_,i)=>`horde-${g.floor}-${i}`));
 for(const e of children){if(e.horde!==true||e.faction!==g.facilityFaction||e.type!==factionDef(g.facilityFaction).hordeType||!e.expendable||!e.reinforcement||e.broodParent!==undefined||e.nestId!==undefined||e.affixes?.length||e.broodReleased!==undefined||!expected.has(e.id)||ids.has(e.id))return false;ids.add(e.id);}
 for(const p of s.pending){if(!point(p)||distance(p,s.origin)>T.hordeSpawnRadius||!int(p.due,g.turn+1,g.turn+T.hordeWarningTurns)||!expected.has(p.id)||ids.has(p.id)||points.has(key(p))||g.enemies.some(e=>e.id===p.id))return false;ids.add(p.id);points.add(key(p));}
 return ids.size===expected.size;
}
