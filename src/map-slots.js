import {roomTiles,roomContains,roomAt} from './map-geometry.js';
import {MODULE_TYPES,FURNITURE,moduleCells,moduleParts,modulePoint} from './modules.js';
import {LARGE_MODULE_TYPES} from './scenery.js';
import {makeBarrier,edgeCells,barrierBetween} from './barriers.js';

export const SLOT_RECIPES=Object.freeze([Object.freeze({id:'furnished-v6'})]);
export const SLOT_KINDS=['terminal','objective','weapon','supply','barrel','module','cache'];
const key=p=>`${p.x},${p.y}`,dirs=[[0,-1],[1,0],[0,1],[-1,0]];
const hash=(seed,floor,salt)=>{let n=(seed^Math.imul(floor,2654435761)^Math.imul(salt+1,2246822519))>>>0;n=Math.imul(n^(n>>>16),2246822519);return (n^(n>>>13))>>>0;};

export class SlotBook{
  constructor(map,seed,floor){this.map=map;this.seed=seed;this.floor=floor;this.slots=[];this.claimed=new Set();}
  reserve(kind,p,refId){
    const roomId=roomAt(this.map.rooms,p);if(roomId<0||this.claimed.has(key(p)))return null;
    const slot={id:`slot-${this.floor}-${this.slots.length}`,kind,roomId,x:p.x,y:p.y,...(refId?{refId}:{})};
    this.slots.push(slot);this.claimed.add(key(p));return slot;
  }
  candidates(rooms=this.map.rooms,salt=0){
    const m=this.map,blocked=new Set([...m.props,...m.items,...m.enemies,...m.hazards,m.start,m.end,...m.props.filter(p=>p.type==='module').flatMap(moduleCells),...m.barriers.flatMap(edgeCells),...m.openings.flatMap(o=>o.cells)].map(key));
    return rooms.flatMap(roomTiles).filter(p=>m.grid[p.y]?.[p.x]===1&&!blocked.has(key(p))&&!this.claimed.has(key(p)))
      .sort((a,b)=>hash(this.seed,this.floor,a.x+a.y*27+salt)-hash(this.seed,this.floor,b.x+b.y*27+salt));
  }
}

export function buildModule(theme,origin,floor,index){
  const marker={id:`module-${floor}-slot-${index}`,type:'module',theme,...origin,rotation:0,indestructible:true};
  const parts=moduleParts(marker).map((part,n)=>({...modulePoint(marker,part.x,part.y),id:`${marker.id}-${n}`,moduleId:marker.id,type:'cover',style:part.style,hp:FURNITURE[part.style].hp,maxHp:FURNITURE[part.style].hp}));
  const barriers=(MODULE_TYPES[theme].edges||[]).map(([type,ax,ay,bx,by],i)=>makeBarrier(type,modulePoint(marker,ax,ay),modulePoint(marker,bx,by),`edge-${marker.id}-${i}`));
  return {marker,parts,barriers};
}

export function slotSafety(map,reachable,generationSafe){
  if(!generationSafe(map))return false;
  const seen=reachable(map,map.start),solid=new Set(map.props.filter(p=>p.hp>0&&(p.type==='cover'||p.type==='barrel')).map(key));
  return map.grid.every((row,y)=>row.every((v,x)=>v!==1||solid.has(`${x},${y}`)||seen.has(`${x},${y}`)))&&map.slots.filter(s=>s.kind==='objective'||s.kind==='cache').every(p=>seen.has(key(p))&&!solid.has(key(p)));
}

function insertModule(book,theme,rooms,index,checks){
  const map=book.map,def=MODULE_TYPES[theme],[w,h]=def.size||[2,2];
  const forbidden=new Set([...map.props,...map.items,...map.hazards,map.start,map.end,...map.props.filter(p=>p.type==='module').flatMap(moduleCells),...map.openings.flatMap(o=>o.cells),...map.barriers.flatMap(edgeCells),...book.slots].map(key));
  const origins=rooms.flatMap(r=>roomTiles(r).filter(p=>p.x+w<=r.x+r.w&&p.y+h<=r.y+r.h).map(p=>({...p,room:r})))
    .sort((a,b)=>hash(book.seed,book.floor,a.x+a.y*27+index*1000)-hash(book.seed,book.floor,b.x+b.y*27+index*1000));
  for(const origin of origins){
    const {marker,parts,barriers}=buildModule(theme,{x:origin.x,y:origin.y},book.floor,index),cells=moduleCells(marker);
    if(cells.some(p=>!roomContains(origin.room,p)||map.grid[p.y]?.[p.x]!==1||forbidden.has(key(p)))||parts.some(p=>map.enemies.some(e=>key(e)===key(p))))continue;
    if(theme==='restroom'){
      const perimeter=cells.flatMap(a=>dirs.map(([dx,dy])=>[a,{x:a.x+dx,y:a.y+dy}]).filter(([,b])=>map.grid[b.y]?.[b.x]===1&&!cells.some(p=>key(p)===key(b))));
      if(perimeter.some(([a,b])=>barrierBetween(map.barriers,a,b)))continue;
      const entry=perimeter.find(([a,b])=>!parts.some(p=>key(p)===key(a))&&!map.props.some(p=>p.hp>0&&key(p)===key(b)));if(!entry)continue;
      perimeter.forEach(([a,b],i)=>barriers.push(makeBarrier(key(a)===key(entry[0])&&key(b)===key(entry[1])?'door':'partition',a,b,`edge-${marker.id}-${i}`)));
    }
    const oldProps=map.props,oldEdges=map.barriers;map.props=[...oldProps,marker,...parts];map.barriers=[...oldEdges,...barriers];
    if(!slotSafety(map,checks.reachable,checks.generationSafe)){map.props=oldProps;map.barriers=oldEdges;continue;}
    book.reserve('module',marker,marker.id);return true;
  }
  return false;
}

export function furnishMap(base,seed,floor,checks){
  const map=structuredClone(base),barrels=map.props.filter(p=>p.type==='barrel');map.props=map.props.filter(p=>p.type!=='barrel');
  const book=new SlotBook(map,seed,floor);map.slots=book.slots;
  // Existing required content gets first claim. No resource is rerolled or added.
  for(const p of map.props.filter(p=>p.type==='terminal'))book.reserve('terminal',p,p.id);
  for(const p of map.items.filter(p=>p.type==='weapon'))book.reserve('weapon',p);
  for(const p of map.props.filter(p=>p.type==='container'))book.reserve('supply',p,p.id);
  for(const p of map.props.filter(p=>p.type==='module'))book.reserve('module',p,p.id);
  const eligible=map.rooms.filter(r=>r.id!==map.startRoom&&r.id!==map.endRoom);
  for(const r of eligible){const p=book.candidates([r],9)[0];if(p)book.reserve('objective',p);}
  if(book.slots.filter(s=>s.kind==='objective').length<3)return null;
  const safe=()=>slotSafety(map,checks.reachable,checks.generationSafe);
  for(const barrel of barrels){
    let placed=false;for(const p of book.candidates(map.rooms.filter(r=>r.id!==map.startRoom),17)){
      map.props.push({...barrel,...p});if(safe()){book.reserve('barrel',p,barrel.id);placed=true;break;}map.props.pop();
    }
    if(!placed)return null;
  }
  const themes=Object.keys(LARGE_MODULE_TYPES),offset=hash(seed,floor,92)%themes.length;
  const halls=map.rooms.filter(r=>r.cellIds.length>1);
  for(let i=0;i<themes.length;i++)if(insertModule(book,themes[(offset+i)%themes.length],halls,0,checks))break;
  const small=['restroom','checkpoint','guardpost'];
  for(let i=0;i<small.length;i++)if(insertModule(book,small[(hash(seed,floor,93)+i)%3],eligible,1,checks))break;
  // Reserved physical containers: empty until a future item/skill table is supplied.
  const degree=id=>map.links.filter(l=>l.includes(id)).length;
  const preferred=eligible.filter(r=>degree(r.id)===1&&!map.rewardRooms.includes(r.id)&&!map.mainRoute.includes(r.id));
  const count=hash(seed,floor,94)%3;
  for(let i=0;i<count;i++){
    const p=book.candidates(preferred,40+i)[0]||book.candidates(eligible.filter(r=>!map.mainRoute.includes(r.id)),40+i)[0]||book.candidates(eligible,40+i)[0];if(!p)break;
    const c={id:`case-${floor}-unknown-${i}`,type:'container',kind:'unknown',...p,opened:false,indestructible:true,contents:[]};map.props.push(c);book.reserve('cache',p,c.id);
  }
  if(!safe())return null;
  map.generation={version:6,recipeId:'furnished-v6',base:structuredClone(base.generation)};return map;
}
