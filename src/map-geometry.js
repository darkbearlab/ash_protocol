import {validateRecipe,recipeGroups} from './map-recipes.js';
// Room identity is independent of lattice position. No RNG or game imports.
export const MAP_GENERATION=7;
export const MAP_FIELDS=['cells','openings','annexes','generation','slots'];
const key=p=>`${p.x},${p.y}`;
const point=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y);
export function roomTiles(room){
  if(Array.isArray(room.footprint))return room.footprint;
  return Array.from({length:room.w*room.h},(_,i)=>({x:room.x+i%room.w,y:room.y+Math.floor(i/room.w)}));
}
export function roomContains(room,p){return Array.isArray(room.footprint)?room.footprint.some(q=>q.x===p.x&&q.y===p.y):p.x>=room.x&&p.x<room.x+room.w&&p.y>=room.y&&p.y<room.y+room.h;}
export const roomAt=(rooms,p)=>rooms?.findIndex(r=>roomContains(r,p))??-1;
export function latticeCells(rows=3,columns=3){return Array.from({length:rows*columns},(_,id)=>({id,row:Math.floor(id/columns),col:id%columns,roomId:id}));}
export function cellNeighbors(cells,id){
  const a=cells.find(c=>c.id===id);if(!a)return [];
  // Preserve the legacy left/right/up/down draw order.
  return [[0,-1],[0,1],[-1,0],[1,0]].flatMap(([dr,dc])=>cells.filter(b=>b.row===a.row+dr&&b.col===a.col+dc).map(b=>b.id));
}
export function collapseCellLinks(cells,edges){
  const owners=new Map(cells.map(c=>[c.id,c.roomId])),seen=new Set(),links=[];
  for(const [a,b]of edges){const x=owners.get(a),y=owners.get(b);if(x===undefined||y===undefined)throw new Error('Unknown lattice cell');if(x===y)continue;const k=[x,y].sort((a,b)=>a-b).join(':');if(!seen.has(k)){seen.add(k);links.push([x,y]);}}
  return links;
}
export function describeRooms(rooms,cells){return rooms.map((r,id)=>({...r,id,cellIds:cells.filter(c=>c.roomId===id).map(c=>c.id),footprint:roomTiles(r)}));}

export const ANNEX_TYPES=['platform','dock','balcony'];
export const ANNEX_SIDES=['north','east','south','west'];
export function annexBounds(map,roomId,side){
  const r=map.rooms[roomId],height=map.grid.length,width=map.grid[0]?.length;
  if(!r||!ANNEX_SIDES.includes(side))return null;
  const edge={north:c=>c.row===0,east:c=>c.col===2,south:c=>c.row===2,west:c=>c.col===0}[side];
  if(!map.cells.some(c=>c.roomId===roomId&&edge(c)))return null;
  const rect={north:{x:r.x,y:0,w:r.w,h:r.y},east:{x:r.x+r.w,y:r.y,w:width-r.x-r.w,h:r.h},south:{x:r.x,y:r.y+r.h,w:r.w,h:height-r.y-r.h},west:{x:0,y:r.y,w:r.x,h:r.h}}[side];
  return rect.w>0&&rect.h>0?rect:null;
}
export function annexBorder(map,roomId,side){
  const r=map.rooms[roomId];if(!annexBounds(map,roomId,side))return [];
  const horizontal=side==='north'||side==='south';
  return Array.from({length:horizontal?r.w:r.h},(_,i)=>{
    const inside=horizontal?{x:r.x+i,y:side==='north'?r.y:r.y+r.h-1}:{x:side==='west'?r.x:r.x+r.w-1,y:r.y+i};
    const [dx,dy]={north:[0,-1],east:[1,0],south:[0,1],west:[-1,0]}[side];
    return {inside,outside:{x:inside.x+dx,y:inside.y+dy}};
  });
}

function validAnnexes(map){
  if(!Array.isArray(map.annexes)||map.annexes.length<1||map.annexes.length>2)return false;
  const ids=new Set(),rooms=new Set(),occupied=new Set(map.rooms.flatMap(roomTiles).map(key)),rails=new Set();
  for(const a of map.annexes){
    if(typeof a.id!=='string'||!/^annex-[a-zA-Z0-9_-]{1,80}$/.test(a.id)||ids.has(a.id)||!ANNEX_TYPES.includes(a.type)||!Number.isInteger(a.roomId)||rooms.has(a.roomId))return false;
    const bounds=annexBounds(map,a.roomId,a.side);if(!bounds)return false;
    const expected=new Set(roomTiles(bounds).map(key)),border=annexBorder(map,a.roomId,a.side);
    if(!Array.isArray(a.footprint)||a.footprint.length!==expected.size||!Array.isArray(a.openings)||a.openings.length!==2||!Array.isArray(a.barrierIds)||a.barrierIds.length!==border.length-2)return false;
    for(const p of a.footprint){if(!point(p)||!expected.delete(key(p))||occupied.has(key(p)))return false;occupied.add(key(p));}
    const gates=new Set();for(const g of a.openings){if(!point(g?.inside)||!point(g?.outside)||!border.some(b=>key(b.inside)===key(g.inside)&&key(b.outside)===key(g.outside))||gates.has(key(g.inside)))return false;gates.add(key(g.inside));}
    if(Math.abs(a.openings[0].inside.x-a.openings[1].inside.x)+Math.abs(a.openings[0].inside.y-a.openings[1].inside.y)<3)return false;
    for(const id of a.barrierIds){if(typeof id!=='string'||!/^edge-annex-[a-zA-Z0-9_-]{1,80}$/.test(id)||rails.has(id))return false;rails.add(id);}
    ids.add(a.id);rooms.add(a.roomId);
  }
  return true;
}

// Optional extensions: old v32 floors have none. Terrain can change during play,
// so footprints describe ownership, not the current set of walkable floor tiles.
export function validMapMetadata(map,custom=false){
  if(MAP_FIELDS.every(k=>map[k]===undefined))return true;
  if(map.generation?.version===7){
    try{validateRecipe(map.generation.recipe);}catch{return false;}
    if(map.generation.recipeId!==map.generation.recipe.id||!Array.isArray(map.annexes))return false;
    const groups=recipeGroups(map.generation.recipe);
    if(!Array.isArray(map.rooms)||map.rooms.length!==groups.length||groups.some(([,ids],i)=>JSON.stringify(ids)!==JSON.stringify(map.rooms[i]?.cellIds))||map.rooms[map.startRoom]?.cellIds.length!==1||map.rooms[map.endRoom]?.cellIds.length!==1)return false;
    if(map.rooms.some(r=>!Array.isArray(r.footprint)||r.footprint.length!==r.w*r.h||r.footprint.some(p=>p.x<r.x||p.x>=r.x+r.w||p.y<r.y||p.y>=r.y+r.h)))return false;
    return validMapMetadata({...map,slots:undefined,annexes:[],generation:{version:4,recipeId:'warehouse-v4',skeleton:'custom-v7'}},true)&&(!map.annexes?.length||validAnnexes(map))&&validSlots(map);
  }
  if(map.generation?.version===6){
    if(map.generation.recipeId!=='furnished-v6'||![2,3,4,5].includes(map.generation.base?.version))return false;
    return validMapMetadata({...map,slots:undefined,generation:map.generation.base})&&validSlots(map);
  }
  if(map.slots!==undefined)return false;
  if(map.generation?.version===5){
    // Validate the unchanged underlying skeleton/openings with its original
    // schema. No recursive v5 descriptors: an annex pass can only wrap v2–v4.
    if(map.generation.recipeId!=='edge-annexes-v5'||![2,3,4].includes(map.generation.base?.version))return false;
    return validMapMetadata({...map,annexes:[],generation:map.generation.base})&&validAnnexes(map);
  }
  if(!map.generation||!Number.isInteger(map.generation.version)||!({2:['grid-v2'],3:['long-halls-v3','hangar-v3'],4:['warehouse-v4','laboratory-v4']}[map.generation.version]?.includes(map.generation.recipeId)))return false;
  const skeleton=map.generation.version===4?map.generation.skeleton:map.generation.recipeId;
  if(!(custom&&skeleton==='custom-v7')&&!['grid-v2','long-halls-v3','hangar-v3'].includes(skeleton))return false;
  if(!Array.isArray(map.rooms)||!map.rooms.length||!Array.isArray(map.cells)||map.cells.length!==9||!Array.isArray(map.openings)||!Array.isArray(map.annexes)||map.annexes.length)return false;
  const inBounds=p=>point(p)&&p.x>=0&&p.y>=0&&p.y<map.grid.length&&p.x<map.grid[p.y].length;
  const owned=new Set(),lattice=new Set();
  for(const [i,r]of map.rooms.entries()){
    if(r.id!==i||!['x','y','w','h','cx','cy'].every(k=>Number.isInteger(r[k]))||r.w<1||r.h<1||!inBounds({x:r.x,y:r.y})||!inBounds({x:r.x+r.w-1,y:r.y+r.h-1})||!Array.isArray(r.cellIds)||!r.cellIds.length||new Set(r.cellIds).size!==r.cellIds.length||!Array.isArray(r.footprint)||!r.footprint.length||r.footprint.length>map.grid.length**2)return false;
    for(const p of r.footprint){if(!inBounds(p)||owned.has(key(p)))return false;owned.add(key(p));}
    if(r.cellIds.some(id=>!Number.isInteger(id)||map.cells[id]?.roomId!==i))return false;
  }
  for(const [id,c]of map.cells.entries()){
    if(c.id!==id||!Number.isInteger(c.row)||!Number.isInteger(c.col)||c.row<0||c.row>2||c.col<0||c.col>2||lattice.has(`${c.row},${c.col}`)||!map.rooms[c.roomId]?.cellIds.includes(id))return false;
    lattice.add(`${c.row},${c.col}`);
  }
  if(!custom&&map.generation.version>=3&&skeleton!=='grid-v2'){
    const merged=map.rooms.filter(r=>r.cellIds.length>1);
    if(merged.length!==1||map.rooms[map.startRoom]?.cellIds.length!==1||map.rooms[map.endRoom]?.cellIds.length!==1)return false;
    const r=merged[0],cells=r.cellIds.map(id=>map.cells[id]);
    const rows=new Set(cells.map(c=>c.row)),cols=new Set(cells.map(c=>c.col));
    if(r.footprint.length!==r.w*r.h||r.footprint.some(p=>p.x<r.x||p.x>=r.x+r.w||p.y<r.y||p.y>=r.y+r.h))return false;
    if(skeleton==='long-halls-v3'?(cells.length!==2||Math.abs(cells[0].row-cells[1].row)+Math.abs(cells[0].col-cells[1].col)!==1):(cells.length!==4||rows.size!==2||cols.size!==2||Math.max(...rows)-Math.min(...rows)!==1||Math.max(...cols)-Math.min(...cols)!==1))return false;
  }
  if(map.generation.version===4&&skeleton==='grid-v2'&&map.rooms.some(r=>r.cellIds.length!==1))return false;
  const ids=new Set();
  for(const o of map.openings){
    if(typeof o.id!=='string'||ids.has(o.id)||!Array.isArray(o.rooms)||o.rooms.length!==2||o.rooms[0]===o.rooms[1]||!o.rooms.every(id=>Number.isInteger(id)&&map.rooms[id])||!Array.isArray(o.cells)||!o.cells.length||o.cells.length>map.grid.length**2||!o.cells.every(inBounds)||!Array.isArray(o.barrierIds)||!o.barrierIds.every(id=>typeof id==='string'&&id.length<=100))return false;
    ids.add(o.id);
    if(map.generation.version===4&&(!Array.isArray(o.mouths)||o.mouths.length!==2||!o.mouths.every((p,i)=>inBounds(p)&&roomContains(map.rooms[o.rooms[i]],p))||!Array.isArray(o.path)||o.path.length<2||o.path.length>o.cells.length||!o.path.every(p=>inBounds(p)&&o.cells.some(q=>key(p)===key(q)))||key(o.mouths[0])!==key(o.path[0])||key(o.mouths[1])!==key(o.path.at(-1))||o.path.some((p,i)=>i&&Math.abs(p.x-o.path[i-1].x)+Math.abs(p.y-o.path[i-1].y)!==1)))return false;
  }
  if(map.generation.version===4){
    const pair=ids=>[...ids].sort((a,b)=>a-b).join('-');
    if(!Array.isArray(map.links)||!map.links.length||!map.links.every(e=>Array.isArray(e)&&e.length===2&&e[0]!==e[1]&&e.every(id=>Number.isInteger(id)&&map.rooms[id])))return false;
    const links=new Set(map.links.map(pair));if(links.size!==map.links.length||map.openings.some(o=>!links.has(pair(o.rooms))))return false;
    for(const link of map.links){
      const group=map.openings.filter(o=>pair(o.rooms)===pair(link));
      if(!group.length||group.length>3||!group.some(o=>o.barrierIds.length===0))return false;
      for(let i=0;i<group.length;i++)for(let j=0;j<i;j++)for(const roomId of link){
        const a=group[i].mouths[group[i].rooms.indexOf(roomId)],b=group[j].mouths[group[j].rooms.indexOf(roomId)];
        if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<3)return false;
      }
    }
    if(map.rooms.some(r=>!map.openings.some(o=>o.rooms.includes(r.id))))return false;
  }
  return true;
}
export const validGenerationHistory=value=>Array.isArray(value)&&value.length>0&&value.length<=MAP_GENERATION&&new Set(value).size===value.length&&value.every(n=>Number.isInteger(n)&&n>=1&&n<=MAP_GENERATION);

function validSlots(map){
  if(!Array.isArray(map.slots)||map.slots.length>729)return false;
  const ids=new Set(),cells=new Set();
  for(const s of map.slots){
    if(!s||typeof s.id!=='string'||!/^slot-[a-zA-Z0-9_-]{1,90}$/.test(s.id)||ids.has(s.id)||!['terminal','objective','weapon','supply','barrel','module','cache'].includes(s.kind)||!Number.isInteger(s.roomId)||!map.rooms[s.roomId]||!point(s)||!roomContains(map.rooms[s.roomId],s)||map.grid[s.y]?.[s.x]!==1||cells.has(key(s))||s.refId!==undefined&&(typeof s.refId!=='string'||s.refId.length>100))return false;
    ids.add(s.id);cells.add(key(s));
  }
  return new Set(map.slots.filter(s=>s.kind==='objective').map(s=>s.roomId)).size>=3;
}
