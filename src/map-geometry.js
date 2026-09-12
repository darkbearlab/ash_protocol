// Room identity is independent of lattice position. No RNG or game imports.
export const MAP_GENERATION=4;
export const MAP_FIELDS=['cells','openings','annexes','generation'];
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

// Optional extensions: old v32 floors have none. Terrain can change during play,
// so footprints describe ownership, not the current set of walkable floor tiles.
export function validMapMetadata(map){
  if(MAP_FIELDS.every(k=>map[k]===undefined))return true;
  if(!map.generation||!Number.isInteger(map.generation.version)||!({2:['grid-v2'],3:['long-halls-v3','hangar-v3'],4:['warehouse-v4','laboratory-v4']}[map.generation.version]?.includes(map.generation.recipeId)))return false;
  const skeleton=map.generation.version===4?map.generation.skeleton:map.generation.recipeId;
  if(!['grid-v2','long-halls-v3','hangar-v3'].includes(skeleton))return false;
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
  if(map.generation.version>=3&&skeleton!=='grid-v2'){
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
