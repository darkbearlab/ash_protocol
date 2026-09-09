import {FLOORS} from './data.js';
import {reachable,key,distance} from './world.js';

// Stable contract IDs are persisted. Mission placement never consumes combat RNG.
export const MISSIONS={
  extraction:{name:'核心撤離',kind:'extraction',count:0,text:'深入六層，擊敗第 3 層封鎖官與第 6 層核心守衛，再從電梯撤離。'},
  hunt:{name:'定點清除',kind:'hunt',count:1,text:'第 6 層殲滅 1 名指定敵人，再從電梯撤離；核心守衛不是必要目標。'},
  sweep:{name:'獵殺名單',kind:'hunt',count:3,text:'第 6 層殲滅分布在不同房間的 3 名指定敵人，再從電梯撤離。'},
  retrieval:{name:'機密回收',kind:'recover',count:1,text:'第 6 層找到 1 份機密資料，靠近後互動回收，再從電梯撤離。'},
  archive:{name:'分散檔案',kind:'recover',count:3,text:'第 6 層從不同房間回收 3 份機密資料，再從電梯撤離。'}
};
export const validMissionId=id=>typeof id==='string'&&Object.hasOwn(MISSIONS,id);
export function newMission(id='extraction'){
  if(!validMissionId(id))throw new Error('未知任務。');
  return {id,targets:[]};
}
export function prepareMission(g){
  const m=g.mission,def=MISSIONS[m.id];
  if(g.floor!==FLOORS.length||def.kind==='extraction')return;
  const accessible=reachable(g,g.start),rooms=g.rooms.map((r,i)=>({...r,index:i})).filter(r=>r.index!==g.startRoom);
  // Seeded room rotation is independent of all loot and battle random rolls.
  const offset=g.seed%rooms.length,ordered=[...rooms.slice(offset),...rooms.slice(0,offset)];
  const inside=(p,r)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
  m.targets=[];
  for(const r of ordered){
    if(m.targets.length===def.count)break;
    if(def.kind==='hunt'){
      const e=g.enemies.find(e=>e.hp>0&&e.type!=='boss'&&e.type!=='warden'&&inside(e,r)&&accessible.has(key(e)));
      if(e)m.targets.push({id:e.id});
    }else{
      const cells=[];
      for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)cells.push({x,y});
      const p=cells.sort((a,b)=>distance(a,{x:r.cx,y:r.cy})-distance(b,{x:r.cx,y:r.cy})).find(p=>accessible.has(key(p))&&distance(p,g.end)>1&&![...g.props,...g.items,...g.enemies,...g.hazards].some(o=>key(o)===key(p)));
      if(p)m.targets.push({id:`objective-${m.targets.length+1}`,...p,done:false});
    }
  }
  if(m.targets.length!==def.count)throw new Error('無法配置任務目標。');
}
export const missionDefinition=g=>MISSIONS[g.mission.id];
export const missionTarget=(g,e)=>g.floor===FLOORS.length&&missionDefinition(g).kind==='hunt'&&g.mission.targets.some(t=>t.id===e.id);
export const missionObjects=g=>g.floor===FLOORS.length&&missionDefinition(g).kind==='recover'?g.mission.targets:[];
export function missionProgress(g){
  const def=missionDefinition(g);
  if(def.kind==='extraction')return {done:g.floor===FLOORS.length&&!g.bossAlive?1:0,total:1};
  return {done:g.mission.targets.filter(t=>def.kind==='recover'?t.done:g.enemies.some(e=>e.id===t.id&&e.hp<=0)).length,total:def.count};
}
export function exitBlocked(g){
  if(g.floor!==FLOORS.length)return g.bossAlive?'本層頭目仍存活，電梯鎖定。':'';
  const {done,total}=missionProgress(g);
  return done<total?missionDefinition(g).kind==='extraction'?'核心守衛仍存活，撤離鎖定。':`任務目標 ${done}/${total}，完成後才能撤離。`:'';
}
export function missionSummary(g){
  const def=missionDefinition(g),{done,total}=missionProgress(g);
  return `${def.name} · ${g.floor<FLOORS.length?'目標位於第 6 層':`${done}/${total} · ${done===total?'前往撤離電梯':def.kind==='recover'?'尋找青色資料匣':def.kind==='hunt'?'殲滅標記目標':'摧毀核心守衛'}`}`;
}
export function validMission(m,g){
  if(!m||!validMissionId(m.id)||!Array.isArray(m.targets))return false;
  const def=MISSIONS[m.id],expected=g.floor===FLOORS.length?def.count:0;
  if(m.targets.length!==expected||new Set(m.targets.map(t=>t?.id)).size!==expected)return false;
  return m.targets.every((t,i)=>{
    if(!t||typeof t.id!=='string')return false;
    if(def.kind==='hunt')return Object.keys(t).length===1&&g.enemies.filter(e=>e.id===t.id).length===1;
    return t.id===`objective-${i+1}`&&typeof t.done==='boolean'&&Number.isInteger(t.x)&&Number.isInteger(t.y)&&g.grid[t.y]?.[t.x]===1&&!m.targets.slice(0,i).some(p=>key(p)===key(t));
  });
}
