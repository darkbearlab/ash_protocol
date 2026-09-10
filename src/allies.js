import {ENEMY_TYPES,SIZE} from './data.js';
import {distance,key,DIRECTIONS,makeEnemy} from './world.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {activeTrait,validTraits,validCombatMemory,initiative} from './traits.js';
import {validControl} from './throwables.js';
import {validCombatModifiers} from './actor-stats.js';

export const ALLY_SKILLS=['drone_follow','drone_sentry','pet_command','raise_dead'];
export const TETHER=6,CARRY_DISTANCE=3,SUMMON_LIMIT=2;
// Idle leash: with no fight to hold, allies drift back once farther than this. Engaged allies use the tether instead.
export const FOLLOW_RANGE={drone:2,other:3};
// Placeholder economy: keep price and healing shared by rules and inventory UI.
export const DRONE_REPAIR_COST=10,DRONE_REPAIR_FRACTION=.5;
export function droneRepairReason(g,id){
 const a=g.allies.find(a=>a.id===id&&a.kind==='drone');
 if(g.status!=='playing'||g.pendingPerks)return '目前無法維修';
 if(!g.player.skills.some(id=>['drone_follow','drone_sentry'].includes(id))||!a)return '沒有可維修機體';
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
export const canRecoverWreck=(g,a)=>a.kind==='drone'&&a.status==='destroyed'&&a.floor===g.floor&&distance(g.player,a)<=1&&g.canCross(g.player,a)&&!g.enemies.some(e=>e.hp>0&&key(e)===key(a))&&!currentAllies(g).some(e=>key(e)===key(a));
export const currentAllies=g=>(g.allies||[]).filter(a=>a.floor===g.floor&&a.status==='active'&&a.hp>0);
export const localAllies=g=>(g.allies||[]).filter(a=>a.floor===g.floor&&['active','down','destroyed'].includes(a.status));
export const connected=(g,a)=>a.status==='active'&&a.hp>0&&a.floor===g.floor&&distance(a,g.player)<=TETHER;
export const allyName=a=>a.kind==='pet'?'伴生獵獸':a.kind==='drone'?(a.sourceId==='drone_sentry'?'哨兵無人機':'追隨無人機'):a.kind==='survivor'?'倖存友軍':`復生${ENEMY_TYPES[a.type].name}`;
export function allyWeapon(a){
 if(a.kind==='drone')return a.sourceId==='drone_sentry'?{id:'rifle',range:7,min:14,max:14,mag:8,ammoType:'rifle',accuracyBonus:-37}:{id:'smg',range:5,min:10,max:10,mag:12,ammoType:'pistol',accuracyBonus:-42};
 const def=ENEMY_TYPES[a.type],melee=a.kind==='pet'||def.range===1;
 return {id:melee?'melee':a.type==='drone'?'plasma':'rifle',range:a.kind==='pet'?1:def.range,min:a.kind==='pet'?24:Math.max(8,Math.round(def.damage*.7)),max:a.kind==='pet'?28:Math.max(8,Math.round(def.damage*.7)),melee,hitChance:90,accuracyBonus:-22,ammoType:null,mag:0};
}
// Survivors use the same actor contract; missionId/sourceId can attach rescue objectives later.
export function addAlly(g,kind,type,{sourceId=null,missionId=null,point=g.player,status='active'}={}){
 if(!['drone','pet','summon','survivor'].includes(kind)||!ENEMY_TYPES[type]||g.allies.length>=32)return null;
 if(!['active','packed'].includes(status)||status==='packed'&&kind!=='drone'||kind==='summon'&&['boss','warden'].includes(type)||kind==='drone'&&type!=='drone')return null;
 if(['pet','drone'].includes(kind)&&g.allies.some(a=>a.kind===kind)||kind==='summon'&&g.allies.filter(a=>a.kind==='summon'&&a.status==='active').length>=SUMMON_LIMIT)return null;
 if(status==='active'&&(!g.passable(point.x,point.y)||occupied(g,point)))return null;
 const a={...makeEnemy(type,point.x,point.y,`ally-${++g.allySerial}`,g.floor),kind,sourceId,missionId,floor:g.floor,status,order:null,ammo:0,bornTurn:g.turn};
 a.maxHp=a.hp=kind==='drone'?45:kind==='pet'?90:Math.max(32,Math.min(90,Math.round(a.hp*.75)));a.armor=kind==='pet'?1:0;
 if(kind==='pet')a.traits=[{id:'biological',source:'ally:pet'},{id:'no_cover',source:'ally:pet'}];
 if(kind==='drone')a.traits=[{id:'mechanical',source:'ally:drone'},{id:'no_cover',source:'ally:drone'}];
 g.allies.push(a);return a;
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
export const corpsePool=g=>g.enemies.filter(e=>e.hp<=0&&!e.raised&&!['boss','warden'].includes(e.type));
export function allySkillState(g,id){
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');
 if(id==='raise_dead')return `召喚 ${currentAllies(g).filter(a=>a.kind==='summon').length}/${SUMMON_LIMIT} · 素材 ${corpsePool(g).length}`;
 if(!a)return '沒有夥伴';if(a.floor!==g.floor&&a.status!=='packed')return `留在 ${a.floor} 層`;if(a.status==='destroyed')return '回收殘骸 · 相鄰';
 if(a.status==='down')return '救援 · 醫療包 1';if(a.status==='packed')return a.hp?'部署 · 1 回合':'待修復 · 背包技能';
 return a.kind==='pet'?'指揮／召回':a.sourceId!==id?'先回收原機型':`回收 ${a.ammo}/${allyWeapon(a).mag}`;
}
export function rescueCell(g,a){if(!occupied(g,a))return a;if(key(a)===key(g.player))return routeCells(g,g.player,{limit:1,openDoors:false}).find(q=>q.d>0)||null;return null;}
export function canAllySkill(g,id){
 const p=g.player;if(!p.skills.includes(id)||p.prepared.skill!==id||p.skillState[id]?.cooldown||p.control.disabled)return false;
 if(id==='raise_dead')return g.allies.filter(a=>a.status!=='destroyed').length<32&&currentAllies(g).filter(a=>a.kind==='summon').length<SUMMON_LIMIT&&corpsePool(g).length>0&&routeCells(g,p,{limit:2,openDoors:false}).some(q=>q.d>0);
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');if(!a)return false;
 if(a.status==='destroyed')return canRecoverWreck(g,a);
 if(a.status==='packed')return a.hp>0&&routeCells(g,p,{limit:2,openDoors:false}).some(q=>q.d>0);
 if(a.floor!==g.floor)return false;
 if(id==='pet_command')return a.status==='active'||a.status==='down'&&p.meds>0&&distance(p,a)<=1&&g.canCross(p,a)&&Boolean(rescueCell(g,a));
 return a.sourceId===id&&carryCandidates(g).includes(a);
}
export function useAllySkill(g,id){
 if(!canAllySkill(g,id))return false;
 const p=g.player;
 if(id==='raise_dead'){
  g.allies=g.allies.filter(a=>a.kind!=='summon'||a.status==='active');
  const count=SUMMON_LIMIT-currentAllies(g).filter(a=>a.kind==='summon').length;
  for(let i=0;i<count;i++){const pool=corpsePool(g),point=routeCells(g,p,{limit:2,openDoors:false}).find(q=>q.d>0);if(!pool.length||!point)break;
   const corpse=pool[Math.floor(g.rng()*pool.length)],a=addAlly(g,'summon',corpse.type,{sourceId:id,point});if(!a)break;corpse.raised=true;g.log(`${allyName(a)}加入戰鬥。`);
  }p.skillState[id].cooldown=4;return true;
 }
 const a=g.allies.find(a=>id==='pet_command'?a.kind==='pet':a.kind==='drone');
 if(id==='pet_command'){
  if(a.status==='down'){const cell=rescueCell(g,a);a.x=cell.x;a.y=cell.y;p.meds--;a.hp=Math.ceil(a.maxHp*.5);a.status='active';a.control={disabled:0,immune:0};a.bornTurn=g.turn;g.log('消耗醫療包，寵物恢復一半生命。');}
  else a.order=null;
 }else if(a.status==='destroyed'){
  a.status='packed';a.order=null;g.log('殘骸已收納；到背包技能分頁消耗廢料修復。');
 }else if(a.status==='packed'){
  const cell=routeCells(g,p,{limit:2,openDoors:false}).find(q=>q.d>0);if(a.sourceId!==id&&a.ammo){g.receiveAmmo(allyWeapon(a).ammoType,a.ammo);a.ammo=0;}Object.assign(a,{x:cell.x,y:cell.y,sourceId:id,floor:g.floor,status:'active',order:null,bornTurn:g.turn});
  reloadDrone(g,a);g.log(`${allyName(a)}已部署。`);
 }else{a.status='packed';reloadDrone(g,a);g.log('機體已回收，使用備彈補充彈匣；傷勢保留。');}
 return true;
}
function reloadDrone(g,a){const w=allyWeapon(a),k=w.ammoType==='rifle'?'reserve':'pistol',n=Math.min(w.mag-a.ammo,g.player[k]);a.ammo+=n;g.player[k]-=n;}
export function commandPet(g,point){
 const a=currentAllies(g).find(a=>a.kind==='pet');if(!a||g.player.prepared.skill!=='pet_command'||g.player.control.disabled||!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||!g.seen[point.y]?.[point.x]||!g.passable(point.x,point.y)||distance(point,g.player)>TETHER)return false;
 a.order=distance(point,g.player)===0?null:{x:point.x,y:point.y};g.log(a.order?'寵物收到留守指令，下次自身行動執行。':'寵物返回跟隨。');return true;
}
export function allyAct(g,a){
 if(a.status!=='active'||a.floor!==g.floor||a.hp<=0)return;
 a.moved=false;a.moveDelta=[0,0];if(a.bornTurn===g.turn||a.restTurn===g.turn)return;
 const w=allyWeapon(a),linked=connected(g,a),targets=g.enemies.filter(e=>e.hp>0&&distance(a,e)<=Math.max(8,w.range)&&g.sight(a,e)).sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id));
 const shot=linked&&(a.kind!=='drone'||a.ammo>0)?targets.find(e=>distance(a,e)<=w.range&&g.shotClear(a,e)&&(!w.melee||g.canCross(a,e))):null;
 const attack=e=>{
  if(a.kind==='drone')a.ammo--;
  const chance=w.melee?g.meleeAccuracy(a,e,w.hitChance):g.accuracy(a,e).chance,hit=g.rng()*100<chance;
  g.effects.push({type:'shot',weaponId:w.id,style:w.melee?'claw':'bullet',from:{x:a.x,y:a.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:'#89e8c8'});
  if(hit)g.hitTarget(e,w.min+Math.floor(g.rng()*(w.max-w.min+1)),a,0,w);else g.log(`${allyName(a)}射擊／攻擊落空。`);
 };
 const beside=goal=>q=>distance(q,goal)<=1;
 if(a.kind==='drone'&&a.sourceId==='drone_sentry'){if(shot)attack(shot);return;}
 if(!linked){stepToward(g,a,g.player,beside(g.player),linked);return;}
 // A hold order walks first; if the way is shut, fight from here rather than idle.
 if(a.order&&distance(a,a.order)>0){if(!stepToward(g,a,a.order,q=>key(q)===key(a.order),linked)&&shot)attack(shot);return;}
 // Engaged allies keep the fight inside the tether; the short leash would make melee pets pace back and forth.
 if(shot){attack(shot);return;}
 const chase=a.kind!=='drone'&&!a.order?targets.find(e=>distance(e,g.player)<=TETHER):null;
 // Walk to the nearest tile that can actually attack, not to the target's side: ranged allies stop at range.
 if(chase){stepToward(g,a,chase,q=>distance(q,chase)<=w.range&&g.shotClear(q,chase)&&(!w.melee||g.canCross(q,chase)),linked);return;}
 if((a.kind==='drone'||!a.order)&&distance(a,g.player)>FOLLOW_RANGE[a.kind==='drone'?'drone':'other'])stepToward(g,a,g.player,beside(g.player),linked);
}
// One step toward a tile that satisfies reached. When none is reachable (taken, or behind another ally),
// close in on goal by walking distance instead of freezing; never step to a tile that is no closer.
function stepToward(g,a,goal,reached,linked){
 const cells=routeCells(g,a,{actor:a,limit:18,maxPlayerDistance:Math.max(TETHER,distance(a,g.player))}).filter(q=>q.first&&(distance(q,g.player)<=TETHER||!linked));
 let dest=cells.filter(reached).sort((b,c)=>b.d-c.d)[0];
 if(!dest){
  const walk=new Map(routeCells(g,goal,{actor:a,ignoreActors:true}).map(q=>[key(q),q.d])),far=q=>walk.get(key(q))??Infinity,here=far(a);
  dest=cells.filter(q=>far(q)<here).sort((b,c)=>far(b)-far(c)||b.d-c.d)[0];
 }
 if(!dest)return false;
 const next=dest.first,edge=barrierBetween(g.barriers,a,next);
 if(edgeBlocks(edge)&&!vaultable(edge)){g.setDoor(edge,true);return true;}
 const old={x:a.x,y:a.y};Object.assign(a,next);a.moveDelta=[a.x-old.x,a.y-old.y];a.moved=true;a.vaultExposed=vaultable(edge);return true;
}
// Walking into an ally pushes it one tile along the move, else to a free side tile; never back onto the player,
// never across a closed door or rail. The shove replaces the ally's own action for one world turn.
export function pushCell(g,a,[dx,dy]){
 const cells=[[dx,dy],...DIRECTIONS.filter(([x,y])=>x*dx+y*dy===0)].map(([x,y])=>({x:a.x+x,y:a.y+y})).filter(n=>g.passable(n.x,n.y,a)&&g.canCross(a,n)&&!occupied(g,n,a));
 return cells.find(n=>!g.hazards.some(h=>key(h)===key(n)))||cells[0]||null;
}
export function pushReason(g,a,dir){
 if(a.kind==='drone'&&a.sourceId==='drone_sentry')return '哨兵無人機固定原地，請繞行或回收。';
 if(a.control?.disabled)return `${allyName(a)}失能中，無法推開。`;
 if(!g.canCross(g.player,a))return '隔著矮隔板無法推開友軍。';
 return pushCell(g,a,dir)?'':`${allyName(a)}沒有空位可以讓開。`;
}
export function pushAlly(g,a,cell){
 // An ally that already acted this world turn (faster than the player) gives up its next action instead.
 const rest=initiative(a)<initiative(g.player)?g.turn+1:g.turn;
 Object.assign(a,{moveDelta:[cell.x-a.x,cell.y-a.y],x:cell.x,y:cell.y,moved:true,vaultExposed:false,restTurn:rest});
 g.log(`${allyName(a)}被推開讓路，放棄一次行動。`);
}
export function validAllies(g){
 if(!Array.isArray(g.allies)||g.allies.length>32||!Number.isSafeInteger(g.allySerial)||g.allySerial<0)return false;
 const ids=new Set([...g.enemies,...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])].map(e=>e.id)),occupiedCells=new Set();
 for(const a of g.allies){
  if(!a||!['drone','pet','summon','survivor'].includes(a.kind)||!ENEMY_TYPES[a.type]||!/^ally-[1-9][0-9]*$/.test(a.id)||Number(a.id.slice(5))>g.allySerial||ids.has(a.id)||!['active','packed','down','destroyed'].includes(a.status))return false;ids.add(a.id);
  if(!Number.isInteger(a.floor)||a.floor<1||a.floor>6||![a.x,a.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)||!Number.isInteger(a.hp)||!Number.isInteger(a.maxHp)||a.maxHp<1||a.maxHp>500||a.hp<0||a.hp>a.maxHp||!Number.isInteger(a.ammo)||a.ammo<0||a.ammo>allyWeapon(a).mag)return false;
  if(a.kind==='summon'&&['boss','warden'].includes(a.type)||a.kind==='drone'&&a.type!=='drone')return false;
  if((a.status==='down'&&a.kind!=='pet')||(a.status==='packed'&&a.kind!=='drone')||(a.status==='active'&&a.hp===0)||(['down','destroyed'].includes(a.status)&&a.hp!==0))return false;
  if(!Number.isInteger(a.armor)||a.armor<0||a.armor>20||!Number.isInteger(a.bornTurn)||a.bornTurn<1||a.bornTurn>g.turn||!validTraits(a.traits)||!validControl(a.control)||!validCombatMemory(a,g.turn)||!validCombatModifiers(a.combatModifiers)||typeof a.vaultExposed!=='boolean')return false;
  if(a.restTurn!==undefined&&(!Number.isInteger(a.restTurn)||a.restTurn<1||a.restTurn>g.turn+1))return false;
  if(a.missionId!==null&&(typeof a.missionId!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(a.missionId)))return false;
  if(a.kind==='drone'&&!['drone_follow','drone_sentry'].includes(a.sourceId)||a.kind==='pet'&&a.sourceId!=='pet_command'||a.kind==='summon'&&a.sourceId!=='raise_dead'||a.kind==='survivor'&&a.sourceId!==null&&typeof a.sourceId!=='string')return false;
  if(a.order!==null&&(!a.order||![a.order.x,a.order.y].every(n=>Number.isInteger(n)&&n>=0&&n<SIZE)))return false;
  if(a.status==='active'){if(a.floor===g.floor&&(key(a)===key(g.player)||g.enemies.some(e=>e.hp>0&&key(e)===key(a))))return false;const k=a.floor+':'+key(a);if(occupiedCells.has(k))return false;occupiedCells.add(k);const grid=a.floor===g.floor?g.grid:g.floorStates?.[a.floor]?.grid;if(grid&&grid[a.y]?.[a.x]!==1)return false;}
 }
 return g.allies.filter(a=>a.kind==='pet').length<=1&&g.allies.filter(a=>a.kind==='drone').length<=1&&g.allies.filter(a=>a.kind==='summon'&&a.status==='active').length<=SUMMON_LIMIT;
}
