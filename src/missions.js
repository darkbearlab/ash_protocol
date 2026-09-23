import {t} from './i18n.js';
import {roomContains,roomTiles} from './map-geometry.js';
import {REQUIRED_TARGET_ROOMS,eligibleMissionEnemy} from './map-population.js';
import {isEndless,ENDLESS_MAX_FLOOR,ENDLESS_DISPLAY_FLOORS,MAX_LEVEL} from './endless.js';
import {FLOORS,SIZE} from './data.js';
import {reachable,key,distance} from './world.js';

// Stable contract IDs are persisted. Mission placement never consumes combat RNG.
export const MISSIONS={
  extraction:{name:'核心撤離',kind:'extraction',count:0,text:'深入六層，擊敗第 3 層與第 6 層的頭目，再從電梯撤離。'},
  hunt:{name:'定點清除',kind:'hunt',count:1,text:'第 6 層殲滅 1 名指定敵人，再從電梯撤離；第 6 層頭目不是必要目標。'},
  sweep:{name:'獵殺名單',kind:'hunt',count:REQUIRED_TARGET_ROOMS,text:'第 6 層殲滅分布在不同房間的 3 名指定敵人，再從電梯撤離。'},
  retrieval:{name:'機密回收',kind:'recover',count:1,text:'第 6 層找到 1 份機密資料，靠近後互動回收，再從電梯撤離。'},
  roundtrip:{name:'原路回收',kind:'recover',count:1,depth:3,returnTrip:true,text:'深入三層，回收機密並擊敗第 3 層頭目，沿原路返回第 1 層入口撤離。回程各層一次傳送增援，不補發物資、回血或彈藥。'},
  archive:{name:'分散檔案',kind:'recover',count:REQUIRED_TARGET_ROOMS,text:'第 6 層從不同房間回收 3 份機密資料，再從電梯撤離。'},
  endless:{name:'無盡深入',kind:'endless',count:0,depth:ENDLESS_MAX_FLOOR,text:`沒有撤離：每層電梯都通往更深處，直到陣亡。第 7 層起敵人更多、更強，還可能帶精英特性；等級 ${MAX_LEVEL} 封頂後，升級改發補給。`}
};
export const RANDOM_MISSION_IDS=Object.keys(MISSIONS).filter(id=>id!=='endless');
export const validMissionId=id=>typeof id==='string'&&Object.hasOwn(MISSIONS,id);
export function newMission(id='extraction'){
  if(!validMissionId(id))throw new Error('未知任務。');
  return {id,targets:[],...(MISSIONS[id].returnTrip?{returning:false,reinforced:[]}: {})};
}
export function prepareMission(g){
  const m=g.mission,def=MISSIONS[m.id];
  if(g.floor!==missionDepth(g)||['extraction','endless'].includes(def.kind))return;
  const accessible=reachable(g,g.start),rooms=g.rooms.map((r,i)=>({...r,index:i})).filter(r=>r.index!==g.startRoom);
  // Seeded room rotation is independent of all loot and battle random rolls.
  const offset=g.seed%rooms.length,ordered=[...rooms.slice(offset),...rooms.slice(0,offset)];
  const inside=(p,r)=>roomContains(r,p);
  m.targets=[];
  for(const r of ordered){
    if(m.targets.length===def.count)break;
    if(def.kind==='hunt'){
      const e=g.enemies.find(e=>e.hp>0&&eligibleMissionEnemy(e)&&inside(e,r)&&accessible.has(key(e)));
      if(e)m.targets.push({id:e.id});
    }else{
      const reserved=g.slots?.filter(s=>s.kind==='objective'&&s.roomId===r.index);
      const cells=g.slots?reserved.map(({x,y})=>({x,y})):[...roomTiles(r)];
      const p=cells.sort((a,b)=>distance(a,{x:r.cx,y:r.cy})-distance(b,{x:r.cx,y:r.cy})).find(p=>accessible.has(key(p))&&distance(p,g.end)>1&&![...g.props,...g.items,...g.enemies,...g.hazards].some(o=>key(o)===key(p)));
      if(p)m.targets.push({id:`objective-${m.targets.length+1}`,...p,done:false});
    }
  }
  if(m.targets.length!==def.count)throw new Error('無法配置任務目標。');
}
export const missionDefinition=g=>MISSIONS[g.mission.id];
export const missionDepth=g=>missionDefinition(g).depth||FLOORS.length;
export const returning=g=>Boolean(missionDefinition(g).returnTrip&&g.mission.returning);
export const exitPoint=g=>returning(g)?g.start:g.end;
// 3.166.0: what the exit does, as a code. The button label reads it from the language table, the floor stencil maps it.
export const exitKind=g=>isEndless(g)?'down':returning(g)?g.floor===1?'extract':'up':g.floor===missionDepth(g)?'extract':'down';
export const exitLabel=g=>t(`missions.exit.${exitKind(g)}`);
export const deepestFloor=g=>returning(g)?missionDepth(g):g.floor;
export const missionTarget=(g,e)=>g.floor===missionDepth(g)&&missionDefinition(g).kind==='hunt'&&g.mission.targets.some(t=>t.id===e.id);
export const missionObjects=g=>g.floor===missionDepth(g)&&missionDefinition(g).kind==='recover'?g.mission.targets:[];
export function missionProgress(g){
  const def=missionDefinition(g);
  if(def.kind==='extraction')return {done:g.floor===missionDepth(g)&&!g.bossAlive?1:0,total:1};
  return {done:g.mission.targets.filter(t=>def.kind==='recover'?t.done:g.enemies.some(e=>e.id===t.id&&e.hp<=0)).length,total:def.count};
}
export function exitBlocked(g){
  if(isEndless(g))return g.bossAlive?'本層頭目仍存活，電梯鎖定。':g.floor>=ENDLESS_MAX_FLOOR?'已達目前支援的最深層，仍可繼續戰鬥。':'';
  if(missionDefinition(g).returnTrip){
    if(g.bossAlive)return '本層頭目仍存活，電梯鎖定。';
    return !returning(g)&&g.floor===missionDepth(g)?'回收機密後，從本層入口上樓。':'';
  }
  if(g.floor!==missionDepth(g))return g.bossAlive?'本層頭目仍存活，電梯鎖定。':'';
  const {done,total}=missionProgress(g);
  return done<total?missionDefinition(g).kind==='extraction'?'頭目仍存活，撤離鎖定。':t('missions.objectivesLeft',{done,total}):'';
}
export function missionSummary(g){
  const def=missionDefinition(g),{done,total}=missionProgress(g);
  if(isEndless(g))return t('missions.summaryEndless',{mission:def.name,floor:g.floor,total:ENDLESS_DISPLAY_FLOORS});
  if(returning(g))return t(g.floor===1?'missions.summaryReturnExit':'missions.summaryReturnUp',{mission:def.name,floor:g.floor});
  if(g.floor<missionDepth(g))return t('missions.summaryDepth',{mission:def.name,depth:missionDepth(g)});
  return t('missions.summaryProgress',{mission:def.name,done,total,goal:t(done===total?'missions.goalExit':def.kind==='recover'?'missions.goalRecover':def.kind==='hunt'?'missions.goalHunt':'missions.goalBoss')});
}
export function validMission(m,g){
  if(!m||!validMissionId(m.id)||!Array.isArray(m.targets))return false;
  const def=MISSIONS[m.id],depth=def.depth||FLOORS.length;
  if(g.floor>depth)return false;
  if(def.returnTrip){
    if(typeof m.returning!=='boolean'||!Array.isArray(m.reinforced))return false;
    const expected=m.returning?Array.from({length:depth-g.floor+1},(_,i)=>depth-i):[];
    if(JSON.stringify(m.reinforced)!==JSON.stringify(expected))return false;
  }else if(m.returning!==undefined||m.reinforced!==undefined)return false;
  const expected=g.floor===depth||m.returning?def.count:0;
  if(m.targets.length!==expected||new Set(m.targets.map(t=>t?.id)).size!==expected)return false;
  return m.targets.every((t,i)=>{
    if(!t||typeof t.id!=='string')return false;
    if(def.kind==='hunt')return Object.keys(t).length===1&&g.enemies.filter(e=>e.id===t.id).length===1;
    return t.id===`objective-${i+1}`&&typeof t.done==='boolean'&&Number.isInteger(t.x)&&Number.isInteger(t.y)&&t.x>=0&&t.x<SIZE&&t.y>=0&&t.y<SIZE&&(m.returning&&g.floor<depth||g.grid[t.y]?.[t.x]===1)&&(!m.returning||t.done)&&!m.targets.slice(0,i).some(p=>key(p)===key(t));
  });
}
