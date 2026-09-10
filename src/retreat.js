import {SIZE} from './data.js';
import {distance,key,reachable,makeEnemy} from './world.js';
import {missionDefinition,missionObjects,returning} from './missions.js';

// Only floor-owned state is archived. Player, mission, rewards and RNG stay global.
export const FLOOR_FIELDS=['grid','lighting','rooms','start','end','startRoom','endRoom','links','mainRoute','rewardRooms','enemies','items','props','hazards','marks','barriers','seen','smoke','traces','reinforcements'];
export function archiveFloor(g){
  const frame=structuredClone(Object.fromEntries([['savedTurn',g.turn],...FLOOR_FIELDS.map(k=>[k,g[k]])]));
  // The departure action has already advanced the global clock. Expired smoke
  // cannot be resurrected when this floor is resumed later.
  frame.smoke=frame.smoke.filter(s=>s.expires>g.turn);
  // A bombardment due on departure resumes on the first action back.
  for(const mark of frame.marks)mark.due=Math.max(mark.due,g.turn+1);
  return frame;
}
export function resumedFloor(frame,turn){
  const state=structuredClone(frame),elapsed=turn-state.savedTurn;delete state.savedTurn;
  for(const cloud of state.smoke)cloud.expires+=elapsed;
  for(const mark of state.marks)mark.due+=elapsed;
  for(const spawn of state.reinforcements)spawn.due+=elapsed;
  return state;
}
export function arrivalCell(frame,allies=[]){
  const cells=reachable(frame,frame.end);
  return [...cells].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};})
    .filter(p=>![...frame.enemies,...allies].some(e=>e.hp>0&&key(e)===key(p))&&!frame.hazards.some(h=>key(h)===key(p)))
    .sort((a,b)=>distance(a,frame.end)-distance(b,frame.end)||a.y-b.y||a.x-b.x)[0]||null;
}
export function scheduleRetreatWave(g){
  if(!returning(g)||g.mission.reinforced.includes(g.floor))return;
  g.mission.reinforced.push(g.floor);
  const blocked=[g.start,g.end,g.player,...g.activeAllies,...g.props,...g.items,...g.hazards,...g.enemies.filter(e=>e.hp>0),...missionObjects(g)];
  const cells=[...reachable(g,g.player)].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};})
    .filter(p=>distance(p,g.player)>=5&&!blocked.some(o=>key(o)===key(p)))
    .sort((a,b)=>Math.abs(distance(a,g.player)-7)-Math.abs(distance(b,g.player)-7)||a.y-b.y||a.x-b.x);
  const chosen=[];
  for(const point of cells){if(chosen.every(p=>distance(p,point)>=3))chosen.push(point);if(chosen.length===2)break;}
  g.reinforcements=chosen.map((point,i)=>({...point,id:`retreat-${g.floor}-${i}`,type:i?'raider':'rifleman',due:g.turn+2}));
  g.log(`撤退增援：本層 ${chosen.length} 個傳送訊號，兩次行動後抵達；不再追加。`,true);
}
export function resolveRetreatWave(g){
  const pending=[];
  for(const spawn of g.reinforcements){
    if(spawn.due>g.turn){pending.push(spawn);continue;}
    if(!g.passable(spawn.x,spawn.y)||key(g.player)===key(spawn)||g.activeAllies.some(a=>key(a)===key(spawn))||g.enemies.some(e=>e.hp>0&&key(e)===key(spawn))){pending.push({...spawn,due:g.turn+1});continue;}
    const e=makeEnemy(spawn.type,spawn.x,spawn.y,spawn.id,g.floor);e.reinforcement=true;g.enemies.push(e);
    // Perception is established by reveal, including smoke and signal break.
    g.effects.push({type:'pulse',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},radius:.7,color:'#83e4e9',damage:0});
    g.log('敵方增援傳送抵達。',true);
  }
  g.reinforcements=pending;
}
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const point=(p,grid)=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&grid[p.y]?.[p.x]===1;
export function validRetreatState(g,checkFloor){
  if(!object(g.floorStates)||!Array.isArray(g.reinforcements))return false;
  const trip=missionDefinition(g).returnTrip,expected=trip?Array.from({length:g.floor-1},(_,i)=>String(i+1)):[];
  if(JSON.stringify(Object.keys(g.floorStates).sort())!==JSON.stringify(expected))return false;
  if(g.reinforcements.length>2||(!returning(g)&&g.reinforcements.length))return false;
  const ids=new Set(g.enemies.map(e=>e.id));
  for(const spawn of g.reinforcements){
    if(!object(spawn)||!['rifleman','raider'].includes(spawn.type)||!point(spawn,g.grid)||!Number.isInteger(spawn.due)||spawn.due<=g.turn||spawn.due>g.turn+2||
      ![0,1].some(i=>spawn.id===`retreat-${g.floor}-${i}`)||ids.has(spawn.id))return false;
    ids.add(spawn.id);
  }
  for(const [floor,frame]of Object.entries(g.floorStates)){
    if(!object(frame)||Object.keys(frame).length!==FLOOR_FIELDS.length+1||!FLOOR_FIELDS.every(k=>Object.hasOwn(frame,k))||!Number.isInteger(frame.savedTurn)||frame.savedTurn<1||frame.savedTurn>g.turn)return false;
    if(!Array.isArray(frame.grid)||frame.grid.length!==SIZE||frame.grid.some(row=>!Array.isArray(row)||row.length!==SIZE||row.some(v=>v!==0&&v!==1)))return false;
    if(!Array.isArray(frame.rooms)||!frame.rooms.length||frame.rooms.length>SIZE*SIZE||frame.rooms.some(r=>!object(r)||!['x','y','w','h','cx','cy'].every(k=>Number.isInteger(r[k]))||r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>SIZE||r.y+r.h>SIZE))return false;
    const roomIndex=i=>Number.isInteger(i)&&i>=0&&i<frame.rooms.length;
    if(!roomIndex(frame.startRoom)||!roomIndex(frame.endRoom)||!Array.isArray(frame.links)||frame.links.some(link=>!Array.isArray(link)||link.length!==2||!link.every(roomIndex))||!['mainRoute','rewardRooms'].every(k=>Array.isArray(frame[k])&&frame[k].every(roomIndex)))return false;
    if(!Array.isArray(frame.seen)||frame.seen.length!==SIZE||frame.seen.some(row=>!Array.isArray(row)||row.length!==SIZE||row.some(v=>typeof v!=='boolean'))||!point(frame.start,frame.grid)||!point(frame.end,frame.grid))return false;
    if(!Array.isArray(frame.marks)||frame.marks.some(m=>!point(m,frame.grid)||!Number.isInteger(m.due)||m.due<=frame.savedTurn||m.due>frame.savedTurn+2))return false;
    if(!Array.isArray(frame.enemies)||frame.enemies.some(e=>!point(e,frame.grid))||!Array.isArray(frame.hazards)||frame.hazards.some(h=>!point(h,frame.grid)||!['fire','acid'].includes(h.type)))return false;
    if(!checkFloor(Number(floor),frame))return false;
  }
  return true;
}
