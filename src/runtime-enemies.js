import {makeEnemy,random,key,distance,DIRECTIONS,reachable} from './world.js';
import {roomTiles} from './map-geometry.js';
// Initial conservative values. Existing normal enemy budgets and rewards are unchanged.
export const RUNTIME_TUNING={liveLimit:64,expendableLimit:6,fodderCount:2,nestMinFloor:2,nestCount:1,nestHp:45,triggerRadius:6,interval:2,totalSpawn:6};
export const enemyRoom=g=>Math.max(0,RUNTIME_TUNING.liveLimit-g.enemies.filter(e=>e.hp>0).length);
export const expendableRoom=g=>Math.max(0,RUNTIME_TUNING.expendableLimit-g.enemies.filter(e=>e.hp>0&&e.expendable).length);
export function addRuntimePopulation(base,seed,floor,check){
 if(!base.generation)return base; // An empty recipe pool retains the exact v1 baseline.
 const safe=m=>{if(!check(m))return false;const seen=reachable(m,m.start),solid=new Set(m.props.filter(p=>p.hp>0&&['cover','barrel','nest'].includes(p.type)).map(key));return m.grid.every((row,y)=>row.every((v,x)=>v!==1||solid.has(`${x},${y}`)||seen.has(`${x},${y}`)));};
 const map=structuredClone(base),rng=random(seed^Math.imul(floor,19349663)^0x3a951d),seen=reachable(map,map.start);
 const forbidden=new Set([...map.props,...map.items,...map.enemies,...map.hazards,map.start,map.end,...(map.slots||[]),...map.openings.flatMap(o=>o.cells)].map(key));
 const rooms=map.rooms.filter(r=>r.id!==map.startRoom&&r.id!==map.endRoom).sort((a,b)=>b.footprint.length-a.footprint.length||a.id-b.id);
 const points=rooms.flatMap(r=>roomTiles(r).filter(p=>map.grid[p.y]?.[p.x]===1&&seen.has(key(p))&&!forbidden.has(key(p))).map(p=>({...p,roomId:r.id,order:rng()}))).sort((a,b)=>a.order-b.order);
 let count=0;
 for(const p of points){if(count>=RUNTIME_TUNING.fodderCount||!enemyRoom(map))break;map.enemies.push(makeEnemy('fodder',p.x,p.y,`fodder-${floor}-${count++}`,floor));forbidden.add(key(p));}
 if(floor>=RUNTIME_TUNING.nestMinFloor)for(const p of points){
  if(forbidden.has(key(p))||map.props.filter(p=>p.type==='nest').length>=RUNTIME_TUNING.nestCount)continue;
  const prop={id:`nest-${floor}-0`,type:'nest',x:p.x,y:p.y,hp:RUNTIME_TUNING.nestHp,maxHp:RUNTIME_TUNING.nestHp,nest:{active:false,total:RUNTIME_TUNING.totalSpawn,interval:RUNTIME_TUNING.interval,remaining:RUNTIME_TUNING.totalSpawn,cooldown:0,serial:0}};
  map.props.push(prop);if(!safe(map)){map.props.pop();continue;}break;
 }
 if(!safe(map))return base;
 map.generation={version:8,recipeId:'runtime-v8',base:base.generation};return map;
}
export function tickNests(g){
 for(const nest of g.props.filter(p=>p.type==='nest'&&p.hp>0)){
  const s=nest.nest;if(!s.active&&distance(g.player,nest)<=RUNTIME_TUNING.triggerRadius){s.active=true;g.log('巢穴甦醒，開始釋出蟲群。',true);}
  if(!s.active||s.remaining===0)continue;
  if(s.cooldown>0&&--s.cooldown>0)continue;
  if(!enemyRoom(g)||!expendableRoom(g))continue;
  const p=DIRECTIONS.map(([dx,dy])=>({x:nest.x+dx,y:nest.y+dy})).find(p=>g.passable(p.x,p.y)&&g.canCross(nest,p)&&distance(g.player,p)>0&&!g.enemies.some(e=>e.hp>0&&key(e)===key(p))&&!g.activeAllies.some(a=>key(a)===key(p))&&!g.props.some(o=>key(o)===key(p))&&!g.hazards.some(o=>key(o)===key(p))&&!g.items.some(o=>key(o)===key(p)));
  if(!p)continue;
  const e=makeEnemy('brood',p.x,p.y,`${nest.id}-child-${++s.serial}`,g.floor);e.nestId=nest.id;e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);s.remaining--;s.cooldown=s.interval;
  g.effects.push({type:'pulse',from:p,to:p,radius:.5,color:'#c7a17a',damage:0});g.log('巢穴中鑽出一隻裂隙幼蟲。');
 }
}
export function validRuntime(g){
 const ids=new Set();for(const e of g.enemies){if(ids.has(e.id))return false;ids.add(e.id);if(['fodder','brood'].includes(e.type)&&(!e.expendable||!e.reinforcement||!Number.isInteger(e.actionDelay)||e.actionDelay<0||e.actionDelay>1))return false;}
 const nests=g.props.filter(p=>p.type==='nest');if(nests.length>RUNTIME_TUNING.nestCount)return false;
 for(const p of nests){const s=p.nest;if(!/^nest-\d+-\d+$/.test(p.id)||ids.has(p.id)||!Number.isFinite(p.hp)||!Number.isFinite(p.maxHp)||p.maxHp<=0||p.hp>p.maxHp||!s||typeof s.active!=='boolean'||!Number.isInteger(s.remaining)||s.remaining<0||!Number.isInteger(s.serial)||s.serial<0||!Number.isInteger(s.total)||s.total<1||s.total>100||s.serial+s.remaining!==s.total||!Number.isInteger(s.interval)||s.interval<1||s.interval>100||!Number.isInteger(s.cooldown)||s.cooldown<0||s.cooldown>s.interval||!s.active&&(s.serial||s.cooldown))return false;ids.add(p.id);}
 for(const e of g.enemies.filter(e=>e.type==='brood')){const p=nests.find(p=>p.id===e.nestId);if(!p||!Array.from({length:p.nest.serial},(_,i)=>`${p.id}-child-${i+1}`).includes(e.id))return false;}
 return true;
}
