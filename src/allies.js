import {ENEMY_TYPES,SIZE} from './data.js';
import {distance,key,DIRECTIONS,makeEnemy} from './world.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {activeTrait,validTraits,validCombatMemory} from './traits.js';
import {validControl} from './throwables.js';
import {validCombatModifiers} from './actor-stats.js';

export const ALLY_SKILLS=['drone_follow','drone_sentry','pet_command','raise_dead'];
export const TETHER=6,CARRY_DISTANCE=3,SUMMON_LIMIT=3;
// Necromancer (3.40, user decision): summons rise on their own every SUMMON_INTERVAL paid turns from anyone who
// fell on this floor (weighted by how many fell, never used up), hunt within SUMMON_TETHER, and the skill rallies them.
export const SUMMON_INTERVAL=4,SUMMON_TETHER=9,RALLY_TURNS=3;
// Idle leash: with no fight to hold, allies drift back once farther than this. Engaged allies use the tether instead.
export const FOLLOW_RANGE={drone:2,other:3};
// Druid pet (3.37, user decision): a longer leash to reach real fights, and a downed pet is recovered
// instead of revived; it heals while packed and steps back out once whole if the skill stays prepared.
export const PET_TETHER=9,PET_REGEN=5,PET_MEDKIT_FRACTION=.5;
export const leash=a=>a.kind==='pet'?PET_TETHER:a.kind==='summon'?SUMMON_TETHER:TETHER;
// Placeholder economy: keep price and healing shared by rules and inventory UI.
export const DRONE_REPAIR_COST=10,DRONE_REPAIR_FRACTION=.5;
// Engineer drone (3.39, user decision): one 90 HP chassis; a destroyed or abandoned one is replaced by building
// a new one for scrap instead of recovering the wreck. It reloads itself from the player's rifle rounds nearby.
export const DRONE_HP=90,DRONE_BUILD_COST=30,SENTRY_ARMOR=5;
export function droneRepairReason(g,id){
 const a=g.allies.find(a=>a.id===id&&a.kind==='drone');
 if(g.status!=='playing'||g.pendingPerks)return '目前無法維修';
 if(!g.player.skills.some(id=>['drone_follow','drone_sentry'].includes(id))||!a)return '沒有可維修機體';
 if(a.status==='destroyed')return `機體已毀，按僚機技能花 ${DRONE_BUILD_COST} 廢料生產新機`;
 if(a.status!=='packed')return '先回收機體';
 if(a.hp===a.maxHp)return '狀態完好';
 if(g.player.control.disabled)return '失能中無法維修';
 if(g.player.scrap<DRONE_REPAIR_COST)return '廢料不足';
 return '';
}
export function repairDrone(g,id){
 if(droneRepairReason(g,id))return false;
 const a=g.allies.find(a=>a.id===id),before=a.hp;
 g.player.scrap-=DRONE_REPAIR_COST;a.hp=Math.min(a.maxHp,a.hp+Math.ceil(a.maxHp*DRONE_REPAIR_FRACTION));
 g.log(`消耗 ${DRONE_REPAIR_COST} 廢料，機體修復 +${a.hp-before} 生命；仍收納中。`);return true;
}
// A body on the floor can be picked up from the same or an adjacent tile with a clear edge, unless someone stands on it.
const reachableBody=(g,a)=>a.floor===g.floor&&distance(g.player,a)<=1&&g.canCross(g.player,a)&&!g.enemies.some(e=>e.hp>0&&key(e)===key(a))&&!currentAllies(g).some(e=>key(e)===key(a));
export const canRecoverPet=(g,a)=>a.kind==='pet'&&a.status==='down'&&reachableBody(g,a);
export const currentAllies=g=>(g.allies||[]).filter(a=>a.floor===g.floor&&a.status==='active'&&a.hp>0);
export const localAllies=g=>(g.allies||[]).filter(a=>a.floor===g.floor&&['active','down','destroyed'].includes(a.status));
export const connected=(g,a)=>a.status==='active'&&a.hp>0&&a.floor===g.floor&&distance(a,g.player)<=leash(a);
export const allyName=a=>a.kind==='pet'?'伴生獵獸':a.kind==='drone'?(a.sourceId==='drone_sentry'?'哨兵無人機':'追隨無人機'):a.kind==='survivor'?'倖存友軍':`復生${ENEMY_TYPES[a.type].name}`;
export function allyWeapon(a){
 if(a.kind==='drone')return a.sourceId==='drone_sentry'?{id:'rifle',range:7,min:14,max:14,mag:8,ammoType:'rifle',accuracyBonus:-37}:{id:'rifle',range:7,min:12,max:12,mag:12,ammoType:'rifle',accuracyBonus:-30};
 const def=ENEMY_TYPES[a.type],melee=a.kind==='pet'||def.range===1;
 return {id:melee?'melee':a.type==='drone'?'plasma':'rifle',range:a.kind==='pet'?1:def.range,min:a.kind==='pet'?24:Math.max(8,def.damage),max:a.kind==='pet'?28:Math.max(8,def.damage),melee,hitChance:90,accuracyBonus:-22,ammoType:null,mag:0};
}
// Survivors use the same actor contract; missionId/sourceId can attach rescue objectives later.
export function addAlly(g,kind,type,{sourceId=null,missionId=null,point=g.player,status='active'}={}){
 if(!['drone','pet','summon','survivor'].includes(kind)||!ENEMY_TYPES[type]||g.allies.length>=32)return null;
 if(!['active','packed'].includes(status)||status==='packed'&&kind!=='drone'||kind==='summon'&&['boss','warden'].includes(type)||kind==='drone'&&type!=='drone')return null;
 if(['pet','drone'].includes(kind)&&g.allies.some(a=>a.kind===kind)||kind==='summon'&&g.allies.filter(a=>a.kind==='summon'&&a.status==='active').length>=SUMMON_LIMIT)return null;
 if(status==='active'&&(!g.passable(point.x,point.y)||occupied(g,point)))return null;
 const a={...makeEnemy(type,point.x,point.y,`ally-${++g.allySerial}`,g.floor),kind,sourceId,missionId,floor:g.floor,status,order:null,ammo:0,bornTurn:g.turn};
 a.maxHp=a.hp=kind==='drone'?DRONE_HP:kind==='pet'?90:Math.max(32,Math.min(150,a.hp));a.armor=kind==='pet'?1:0;
 if(kind==='pet')a.traits=[{id:'biological',source:'ally:pet'},{id:'no_cover',source:'ally:pet'}];
 if(kind==='drone'){a.traits=[{id:'mechanical',source:'ally:drone'}];fitDrone(a);}
 g.allies.push(a);return a;
}
// Mode-dependent chassis fit. The hovering follow drone ignores cover; the placed sentry uses cover and plating.
// Art note (3.39): the sentry still draws the hovering drone sprite; it should later read as a ground turret.
export function fitDrone(a){
 const sentry=a.sourceId==='drone_sentry';
 a.armor=sentry?SENTRY_ARMOR:0;
 a.traits=a.traits.filter(t=>!(t.id==='no_cover'&&t.source==='ally:drone'));if(!sentry)a.traits.push({id:'no_cover',source:'ally:drone'});
}
export const occupied=(g,p,except=null)=>[g.player,...g.enemies.filter(e=>e.hp>0),...currentAllies(g)].some(a=>a!==except&&key(a)===key(p));
export function routeCells(g,start,{limit=SIZE*SIZE,actor=null,ignoreActors=false,openDoors=true,maxPlayerDistance=Infinity}={}){
 const queue=[{x:start.x,y:start.y,d:0,first:null}],seen=new Set([key(start)]);
 for(let i=0;i<queue.length;i++){
  const q=queue[i];if(q.d>=limit)continue;
  for(const [dx,dy]of DIRECTIONS){const n={x:q.x+dx,y:q.y+dy},k=key(n),edge=barrierBetween(g.barriers,q,n);
   if(distance(n,g.player)>maxPlayerDistance||seen.has(k)||!g.passable(n.x,n.y,actor)||(edgeBlocks(edge)&&!vaultable(edge)&&!(openDoors&&edge.type==='door'))||(!ignoreActors&&occupied(g,n,actor)))continue;
   seen.add(k);queue.push({...n,d:q.d+1,first:q.first||n});
  }
 }return queue;
}
export const carryCandidates=g=>{const cells=new Set(routeCells(g,g.player,{limit:CARRY_DISTANCE,ignoreActors:true,openDoors:false}).map(key));return currentAllies(g).filter(a=>cells.has(key(a)));};
export function departAllies(g){
 const ids=carryCandidates(g).map(a=>a.id);for(const a of g.allies)if(a.status==='packed')ids.push(a.id);
 g.allies=g.allies.filter(a=>a.floor!==g.floor||a.kind!=='summon'||ids.includes(a.id));return ids;
}
export function arriveAllies(g,ids){
 for(const a of g.allies.filter(a=>ids.includes(a.id))){
  if(a.status==='packed'){a.floor=g.floor;continue;}
  const cell=routeCells(g,g.player,{limit:6,openDoors:false}).find(q=>q.d>0);
  if(!cell){g.log(`${allyName(a)}無落腳空格，留在原層。`,true);if(a.kind==='summon'){a.status='destroyed';a.hp=0;}continue;}
  Object.assign(a,{x:cell.x,y:cell.y,floor:g.floor,order:null,moved:false,moveDelta:[0,0],vaultExposed:false});
 }
}
export function initializeAllies(g){
 if(g.player.character==='engineer')addAlly(g,'drone','drone',{sourceId:'drone_follow',status:'packed'});
 if(g.player.character==='druid'){const cell=routeCells(g,g.player,{limit:3,openDoors:false}).find(p=>p.d>0);if(cell)addAlly(g,'pet','crawler',{sourceId:'pet_command',point:cell});}
}
// Everyone who fell on this floor, bosses excluded. One entry per death, so common enemies rise more often;
// nothing is consumed (corpses marked raised by older versions still count).
export const summonPool=g=>g.enemies.filter(e=>e.hp<=0&&!['boss','warden'].includes(e.type));
const summonCount=g=>currentAllies(g).filter(a=>a.kind==='summon').length;
// No working chassis to hand: none, destroyed, or left active on another floor. Building a new one replaces it.
const droneLost=(g,a)=>!a||a.status==='destroyed'||a.floor!==g.floor&&a.status!=='packed';
export function allySkillState(g,id){
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');
 if(id==='raise_dead'){const n=summonCount(g),cd=g.player.skillState.raise_dead?.cooldown||0;return `召喚 ${n}/${SUMMON_LIMIT}${n>=SUMMON_LIMIT?'':!summonPool(g).length?' · 本層尚無倒下者':cd?` · ${cd} 回合後再起`:' · 回合結束再起'}`;}
 if(id!=='pet_command'&&droneLost(g,a))return `生產 · ${DRONE_BUILD_COST} 廢料`;
 if(!a)return '沒有夥伴';if(a.floor!==g.floor&&a.status!=='packed')return `留在 ${a.floor} 層`;
 if(a.status==='down')return '回收 · 相鄰 1 回合';
 if(a.kind==='pet'&&a.status==='packed')return a.hp<a.maxHp?`回血 ${a.hp}/${a.maxHp}${g.player.meds?' · 可用醫療包':''}`:'待歸隊 · 等空位';
 if(a.status==='packed')return a.hp?'部署 · 1 回合':'待修復 · 背包技能';
 return a.kind==='pet'?'指揮／召回':a.sourceId!==id?'先回收原機型':`回收 ${a.ammo}/${allyWeapon(a).mag}`;
}
export function petSkillReason(g){
 const a=g.allies.find(a=>a.kind==='pet');if(!a)return '';
 if(a.status==='down')return a.floor!==g.floor?`伴生獵獸倒在第 ${a.floor} 層。`:'伴生獵獸倒地：走到同格或相鄰格、中間沒有阻隔時才能回收。';
 if(a.status==='packed')return a.hp>=a.maxHp?'伴生獵獸已滿血，身邊有空位就會歸隊。':'伴生獵獸收納回血中；沒有醫療包可以加速。';
 return '';
}
export function canAllySkill(g,id){
 // raise_dead's cooldown now times the automatic rising, so it never blocks the free rally.
 const p=g.player;if(!p.skills.includes(id)||p.prepared.skill!==id||id!=='raise_dead'&&p.skillState[id]?.cooldown||p.control.disabled)return false;
 if(id==='raise_dead')return summonCount(g)>0;
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');
 if(id!=='pet_command'&&droneLost(g,a))return p.scrap>=DRONE_BUILD_COST&&routeCells(g,p,{limit:2,openDoors:false}).some(q=>q.d>0);
 if(!a)return false;
 // Pet: recover when down, spend a medkit to speed healing while packed, command while active.
 if(id==='pet_command')return a.status==='down'?canRecoverPet(g,a):a.status==='packed'?a.hp<a.maxHp&&p.meds>0:a.status==='active'&&a.floor===g.floor;
 if(a.status==='packed')return a.hp>0&&routeCells(g,p,{limit:2,openDoors:false}).some(q=>q.d>0);
 return a.sourceId===id&&carryCandidates(g).includes(a);
}
export function useAllySkill(g,id){
 if(!canAllySkill(g,id))return false;
 const p=g.player;
 // Rally is a free order: for the next RALLY_TURNS paid turns summons stop hunting and come back beside the player.
 if(id==='raise_dead'){for(const a of currentAllies(g))if(a.kind==='summon')a.rallyTurn=g.turn+RALLY_TURNS;g.log(`召喚物集結：${RALLY_TURNS} 回合內停止追擊、回到你身邊。`);return true;}
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');
 if(id==='pet_command'){
  if(a.status==='down'){Object.assign(a,{status:'packed',order:null,control:{disabled:0,immune:0}});g.log(`伴生獵獸已收納：每回合回復 ${PET_REGEN} 生命，回滿且本技能預備中會自行歸隊。`);}
  else if(a.status==='packed'){const before=a.hp;p.meds--;a.hp=Math.min(a.maxHp,a.hp+Math.ceil(a.maxHp*PET_MEDKIT_FRACTION));g.log(`消耗醫療包，伴生獵獸回復 ${a.hp-before} 生命。`);}
  else a.order=null;
 }else if(droneLost(g,a)){
  const cell=routeCells(g,p,{limit:2,openDoors:false}).find(q=>q.d>0);g.allies=g.allies.filter(x=>x!==a);p.scrap-=DRONE_BUILD_COST;
  const fresh=addAlly(g,'drone','drone',{sourceId:id,point:cell});reloadDrone(g,fresh);g.log(`消耗 ${DRONE_BUILD_COST} 廢料生產新機，${allyName(fresh)}已部署。`);
 }else if(a.status==='packed'){
  const cell=routeCells(g,p,{limit:2,openDoors:false}).find(q=>q.d>0);if(a.sourceId!==id&&a.ammo){g.receiveAmmo(allyWeapon(a).ammoType,a.ammo);a.ammo=0;}Object.assign(a,{x:cell.x,y:cell.y,sourceId:id,floor:g.floor,status:'active',order:null,bornTurn:g.turn});
  fitDrone(a);reloadDrone(g,a);g.log(`${allyName(a)}已部署。`);
 }else{a.status='packed';reloadDrone(g,a);g.log('機體已回收，使用備彈補充彈匣；傷勢保留。');}
 return true;
}
function reloadDrone(g,a){const w=allyWeapon(a),k=w.ammoType==='rifle'?'reserve':'pistol',n=Math.min(w.mag-a.ammo,g.player[k]);a.ammo+=n;g.player[k]-=n;}
export function commandPet(g,point){
 const a=currentAllies(g).find(a=>a.kind==='pet');if(!a||g.player.prepared.skill!=='pet_command'||g.player.control.disabled||!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||!g.seen[point.y]?.[point.x]||!g.passable(point.x,point.y)||distance(point,g.player)>TETHER)return false;
 a.order=distance(point,g.player)===0?null:{x:point.x,y:point.y};g.log(a.order?'寵物收到留守指令，下次自身行動執行。':'寵物返回跟隨。');return true;
}
// The world turn in which each ally last reached its queue slot, so a displaced ally gives up exactly one
// opportunity: this turn's if it is still to come, otherwise the next. Session-only; turns never span a reload.
const slotTurn=new WeakMap();
const restFor=(g,a)=>slotTurn.get(a)===g.turn?g.turn+1:g.turn;
export function allyAct(g,a){
 if(a.status!=='active'||a.floor!==g.floor||a.hp<=0)return;
 slotTurn.set(a,g.turn);a.moved=false;a.moveDelta=[0,0];if(a.bornTurn===g.turn||a.restTurn===g.turn)return;
 const w=allyWeapon(a),linked=connected(g,a),targets=g.enemies.filter(e=>e.hp>0&&distance(a,e)<=Math.max(8,w.range)&&g.sight(a,e)).sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id));
 const shot=linked&&(a.kind!=='drone'||a.ammo>0)?targets.find(e=>distance(a,e)<=w.range&&g.shotClear(a,e)&&(!w.melee||g.canCross(a,e))):null;
 const attack=e=>{
  if(a.kind==='drone')a.ammo--;
  const chance=w.melee?g.meleeAccuracy(a,e,w.hitChance):g.accuracy(a,e).chance,hit=g.rng()*100<chance;
  g.effects.push({type:'shot',weaponId:w.id,style:w.melee?'claw':'bullet',from:{x:a.x,y:a.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:'#89e8c8'});
  if(hit)g.hitTarget(e,w.min+Math.floor(g.rng()*(w.max-w.min+1)),a,0,w);else g.log(`${allyName(a)}射擊／攻擊落空。`);
 };
 const beside=goal=>q=>distance(q,goal)<=1;
 // Drones reload themselves from the player's rounds within carry range (3.39, user decision): when empty, or when
 // idle at half a magazine or less. It spends the drone's own action, never the player's.
 const reserve=w.ammoType==='rifle'?'reserve':'pistol';
 const topUp=a.kind==='drone'&&a.ammo<w.mag&&(a.ammo===0||!shot&&a.ammo<=w.mag/2)&&g.player[reserve]>0&&carryCandidates(g).includes(a);
 const reload=()=>{const before=a.ammo;reloadDrone(g,a);g.log(`${allyName(a)}自動換彈 +${a.ammo-before}。`);};
 if(a.kind==='drone'&&a.sourceId==='drone_sentry'){if(shot)attack(shot);else if(topUp)reload();return;}
 // Swapping past another ally is for real errands (rejoining, a commanded tile, a fight); idle following just queues.
 if(!linked){stepToward(g,a,g.player,beside(g.player),linked,true);return;}
 // Rallied summons come back first and only fight once they are beside the player again.
 if(a.kind==='summon'&&a.rallyTurn>=g.turn){if(distance(a,g.player)>2)stepToward(g,a,g.player,beside(g.player),linked,true);else if(shot)attack(shot);return;}
 // A hold order walks first; if the way is shut, fight from here rather than idle.
 if(a.order&&distance(a,a.order)>0){if(!stepToward(g,a,a.order,q=>key(q)===key(a.order),linked,true)&&shot)attack(shot);return;}
 // Engaged allies keep the fight inside the tether; the short leash would make melee pets pace back and forth.
 if(shot){attack(shot);return;}
 if(topUp){reload();return;}
 const chase=a.kind!=='drone'&&!a.order?targets.find(e=>distance(e,g.player)<=leash(a)):null;
 // Walk to the nearest tile that can actually attack, not to the target's side: ranged allies stop at range.
 if(chase){stepToward(g,a,chase,q=>distance(q,chase)<=w.range&&g.shotClear(q,chase)&&(!w.melee||g.canCross(q,chase)),linked,true);return;}
 if((a.kind==='drone'||!a.order)&&distance(a,g.player)>FOLLOW_RANGE[a.kind==='drone'?'drone':'other'])stepToward(g,a,g.player,beside(g.player),linked);
}
// One step toward a tile that satisfies reached. When none is reachable (taken, or behind another ally),
// close in on goal by walking distance instead of freezing; never step to a tile that is no closer.
function stepToward(g,a,goal,reached,linked,swap=false){
 const cells=routeCells(g,a,{actor:a,limit:18,maxPlayerDistance:Math.max(leash(a),distance(a,g.player))}).filter(q=>q.first&&(distance(q,g.player)<=leash(a)||!linked));
 let dest=cells.filter(reached).sort((b,c)=>b.d-c.d)[0];
 if(!dest){
  const walk=new Map(routeCells(g,goal,{actor:a,ignoreActors:true}).map(q=>[key(q),q.d])),far=q=>walk.get(key(q))??Infinity,here=far(a);
  dest=cells.filter(q=>far(q)<here).sort((b,c)=>far(b)-far(c)||b.d-c.d)[0];
  // Still no progress: the way on is another ally's tile. Trade places when that costs the other ally nothing it is doing.
  if(!dest)return swap&&swapPast(g,a,far,here,linked);
 }
 const next=dest.first,edge=barrierBetween(g.barriers,a,next);
 if(edgeBlocks(edge)&&!vaultable(edge)){g.setDoor(edge,true);return true;}
 const old={x:a.x,y:a.y};Object.assign(a,next);a.moveDelta=[a.x-old.x,a.y-old.y];a.moved=true;a.vaultExposed=vaultable(edge);return true;
}
// The enemy an ally would attack from a tile: the nearest it could hit from there, or only the given one.
function attackFrom(g,b,from,only=null){
 const w=allyWeapon(b),at={...b,x:from.x,y:from.y};
 if(!connected(g,at)||b.kind==='drone'&&b.ammo<=0)return null;
 return (only?[only]:g.enemies).filter(e=>e.hp>0&&distance(at,e)<=w.range&&g.sight(at,e)&&g.shotClear(at,e)&&(!w.melee||g.canCross(at,e))).sort((x,y)=>distance(at,x)-distance(at,y)||x.id.localeCompare(y.id))[0]||null;
}
// Another ally may take b's tile only if b is free to move, is not holding a commanded spot, and can still
// attack whatever it is attacking now from a's tile. That last rule also keeps two allies from swapping back.
function canTrade(g,b,a){
 if(b.kind==='drone'&&b.sourceId==='drone_sentry'||b.control?.disabled||b.order||b.restTurn===g.turn)return false;
 if(!g.passable(a.x,a.y,b)||!g.passable(b.x,b.y,a)||distance(a,g.player)>leash(b))return false;
 const now=attackFrom(g,b,b);return !now||Boolean(attackFrom(g,b,a,now));
}
function swapPast(g,a,far,here,linked){
 const b=currentAllies(g).find(b=>b!==a&&distance(a,b)===1&&far(b)<here&&g.canCross(a,b)&&(distance(b,g.player)<=leash(a)||!linked)&&canTrade(g,b,a));
 if(!b)return false;
 const from={x:a.x,y:a.y},to={x:b.x,y:b.y};
 Object.assign(a,{...to,moveDelta:[to.x-from.x,to.y-from.y],moved:true,vaultExposed:false});
 Object.assign(b,{...from,moveDelta:[from.x-to.x,from.y-to.y],moved:true,vaultExposed:false,restTurn:restFor(g,b)});
 g.log(`${allyName(a)}與${allyName(b)}交換位置。`);return true;
}
// Walking into an ally trades places with it (NetHack-style). The ally lands on the tile the player is leaving,
// which is always free, so allies can never box the player in. Refused for fixed sentries, disabled allies and
// across rails; the ally gives up one action.
export function swapReason(g,a){
 if(a.kind==='drone'&&a.sourceId==='drone_sentry')return '哨兵無人機固定原地，請繞行或回收。';
 if(a.control?.disabled)return `${allyName(a)}失能中，無法換位。`;
 if(!g.canCross(g.player,a))return '隔著矮隔板無法與友軍換位。';
 if(!g.passable(g.player.x,g.player.y,a))return `${allyName(a)}無法站到你的位置。`;
 return '';
}
export function swapWithPlayer(g,a){
 const p=g.player,from={x:a.x,y:a.y};
 Object.assign(a,{x:p.x,y:p.y,moveDelta:[p.x-from.x,p.y-from.y],moved:true,vaultExposed:false,restTurn:restFor(g,a)});
 g.log(`${allyName(a)}與你交換位置，放棄一次行動。`);
}
// Runs once per paid world turn, before skills tick. When the rising timer is ready, the necromancer has room for
// another summon and someone has fallen on this floor, one rises beside the player and acts from the next turn.
export function tickSummons(g){
 const p=g.player,state=p.skillState?.raise_dead;
 if(!p.skills.includes('raise_dead')||!state||state.cooldown||p.control.disabled||summonCount(g)>=SUMMON_LIMIT)return false;
 const pool=summonPool(g),cell=routeCells(g,p,{limit:2,openDoors:false}).find(q=>q.d>0);if(!pool.length||!cell)return false;
 g.allies=g.allies.filter(a=>a.kind!=='summon'||a.status==='active');if(g.allies.length>=32)return false;
 const a=addAlly(g,'summon',pool[Math.floor(g.rng()*pool.length)].type,{sourceId:'raise_dead',point:cell});if(!a)return false;
 state.cooldown=SUMMON_INTERVAL;
 g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.6,color:'#8ae9da',damage:0});
 g.log(`${allyName(a)}自亡者中起身。`);return true;
}
// Runs once per paid world turn. A packed pet heals; once whole, and only while its skill is prepared,
// it steps out beside the player like a deployment and waits for the next turn to act.
export function tickPackedPet(g){
 const a=g.allies.find(a=>a.kind==='pet'&&a.status==='packed');if(!a)return false;
 a.hp=Math.min(a.maxHp,a.hp+PET_REGEN);
 if(a.hp<a.maxHp||g.player.prepared.skill!=='pet_command')return false;
 const cell=routeCells(g,g.player,{limit:2,openDoors:false}).find(q=>q.d>0);if(!cell)return false;
 Object.assign(a,{x:cell.x,y:cell.y,floor:g.floor,status:'active',order:null,bornTurn:g.turn,moved:false,moveDelta:[0,0],vaultExposed:false});
 g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.6,color:'#8ae9da',damage:0});
 g.log('伴生獵獸生命已滿，自行歸隊。');return true;
}
export function validAllies(g){
 if(!Array.isArray(g.allies)||g.allies.length>32||!Number.isSafeInteger(g.allySerial)||g.allySerial<0)return false;
 const ids=new Set([...g.enemies,...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])].map(e=>e.id)),occupiedCells=new Set();
 for(const a of g.allies){
  if(!a||!['drone','pet','summon','survivor'].includes(a.kind)||!ENEMY_TYPES[a.type]||!/^ally-[1-9][0-9]*$/.test(a.id)||Number(a.id.slice(5))>g.allySerial||ids.has(a.id)||!['active','packed','down','destroyed'].includes(a.status))return false;ids.add(a.id);
  if(!Number.isInteger(a.floor)||a.floor<1||a.floor>6||![a.x,a.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)||!Number.isInteger(a.hp)||!Number.isInteger(a.maxHp)||a.maxHp<1||a.maxHp>500||a.hp<0||a.hp>a.maxHp||!Number.isInteger(a.ammo)||a.ammo<0||a.ammo>allyWeapon(a).mag)return false;
  if(a.kind==='summon'&&['boss','warden'].includes(a.type)||a.kind==='drone'&&a.type!=='drone')return false;
  if((a.status==='down'&&a.kind!=='pet')||(a.status==='packed'&&!['drone','pet'].includes(a.kind))||(a.status==='active'&&a.hp===0)||(['down','destroyed'].includes(a.status)&&a.hp!==0))return false;
  if(!Number.isInteger(a.armor)||a.armor<0||a.armor>20||!Number.isInteger(a.bornTurn)||a.bornTurn<1||a.bornTurn>g.turn||!validTraits(a.traits)||!validControl(a.control)||!validCombatMemory(a,g.turn)||!validCombatModifiers(a.combatModifiers)||typeof a.vaultExposed!=='boolean')return false;
  if(a.restTurn!==undefined&&(!Number.isInteger(a.restTurn)||a.restTurn<1||a.restTurn>g.turn+1))return false;
  if(a.rallyTurn!==undefined&&(a.kind!=='summon'||!Number.isInteger(a.rallyTurn)||a.rallyTurn<1||a.rallyTurn>g.turn+RALLY_TURNS))return false;
  if(a.missionId!==null&&(typeof a.missionId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(a.missionId)))return false;
  if(a.kind==='drone'&&!['drone_follow','drone_sentry'].includes(a.sourceId)||a.kind==='pet'&&a.sourceId!=='pet_command'||a.kind==='summon'&&a.sourceId!=='raise_dead'||a.kind==='survivor'&&a.sourceId!==null&&typeof a.sourceId!=='string')return false;
  if(a.order!==null&&(!a.order||![a.order.x,a.order.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)))return false;
  if(a.status==='active'){if(a.floor===g.floor&&(key(a)===key(g.player)||g.enemies.some(e=>e.hp>0&&key(e)===key(a))))return false;const k=a.floor+':'+key(a);if(occupiedCells.has(k))return false;occupiedCells.add(k);const grid=a.floor===g.floor?g.grid:g.floorStates?.[a.floor]?.grid;if(grid&&grid[a.y]?.[a.x]!==1)return false;}
 }
 return g.allies.filter(a=>a.kind==='pet').length<=1&&g.allies.filter(a=>a.kind==='drone').length<=1&&g.allies.filter(a=>a.kind==='summon'&&a.status==='active').length<=SUMMON_LIMIT;
}
