import {startingTraits} from './traits.js';
import {SIZE,ENEMY_TYPES,FLOOR_INFO,WEAPONS,RARE_ARMORY} from './data.js';
import {weaponUnlocked} from './progression.js';
export function random(seed) {
  let a=seed>>>0;
  const next=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
  next.state=()=>a; return next;
}
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const key=(p)=>`${p.x},${p.y}`;
export const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
export function lineOfSight(grid,a,b) {
  let x=Math.floor(a.x+.5),y=Math.floor(a.y+.5);
  const endX=Math.floor(b.x+.5),endY=Math.floor(b.y+.5),dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy);
  if(grid[y]?.[x]!==1||grid[endY]?.[endX]!==1)return false;
  const stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
  let tx=dx?(x+(sx>0?.5:-.5)-a.x)/dx:Infinity,ty=dy?(y+(sy>0?.5:-.5)-a.y)/dy:Infinity;
  for(let i=0;i<SIZE*3;i++){
    if(x===endX&&y===endY)return true;
    if(Math.abs(tx-ty)<1e-9){if(grid[y]?.[x+sx]!==1&&grid[y+sy]?.[x]!==1)return false;x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
    else if(tx<ty){x+=sx;tx+=stepX;}else{y+=sy;ty+=stepY;}
    if(grid[y]?.[x]!==1)return false;
  }return false;
}
export function makeEnemy(type,x,y,id,floor=1) {
  const def=ENEMY_TYPES[type],hp=def.hp+(type==='boss'||type==='warden'?0:Math.max(0,floor-2)*(def.fragile?2:4));
  return {id,type,x,y,hp,maxHp:hp,traits:startingTraits(type,floor),moveDelta:[0,0],fireChain:null,control:{disabled:0,immune:0},lastKnown:null,alert:false,charge:false,windup:0,aim:null,attackCount:0,moved:false};
}
export function generate(seed,floor=1,unlocks=[]) {
  const rng=random(seed+floor*7919),grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0)),rooms=[];
  for(let ry=0;ry<3;ry++)for(let rx=0;rx<3;rx++) {
    const w=6+Math.floor(rng()*2),h=6+Math.floor(rng()*2),x=rx*8+2,y=ry*8+2;
    const r={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)}; rooms.push(r);
    for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;
  }
  const shuffled=list=>{const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
  const neighbors=i=>[i%3>0?i-1:-1,i%3<2?i+1:-1,i>=3?i-3:-1,i<6?i+3:-1].filter(n=>n>=0);
  const startRoom=[0,2,6,8][Math.floor(rng()*4)],links=[],visited=new Set([startRoom]),stack=[startRoom];
  // Random spanning tree, then up to two loops. Retain a leaf for optional exploration.
  while(stack.length){const a=stack.at(-1),options=neighbors(a).filter(n=>!visited.has(n));if(!options.length){stack.pop();continue;}const b=options[Math.floor(rng()*options.length)];links.push([a,b]);visited.add(b);stack.push(b);}
  const degree=i=>links.filter(edge=>edge.includes(i)).length;
  const candidates=shuffled(rooms.flatMap((_,a)=>neighbors(a).filter(b=>b>a&&!links.some(e=>e.includes(a)&&e.includes(b))).map(b=>[a,b])));
  for(const [a,b]of candidates){if(links.length>=10)break;const leaves=rooms.filter((_,i)=>i!==startRoom&&degree(i)+(i===a||i===b?1:0)===1);if(leaves.length)links.push([a,b]);}
  const parents=new Map([[startRoom,null]]),queue=[startRoom];
  for(let i=0;i<queue.length;i++)for(const edge of links.filter(e=>e.includes(queue[i]))){const b=edge.find(n=>n!==queue[i]);if(!parents.has(b)){parents.set(b,queue[i]);queue.push(b);}}
  const endRoom=queue.at(-1),mainRoute=[];for(let i=endRoom;i!==null;i=parents.get(i))mainRoute.unshift(i);
  const rewardRooms=shuffled(rooms.map((_,i)=>i).filter(i=>!mainRoute.includes(i))).slice(0,3);
  for(const i of shuffled(rooms.map((_,i)=>i).filter(i=>i!==startRoom&&i!==endRoom&&!rewardRooms.includes(i))))if(rewardRooms.length<3)rewardRooms.push(i);
  rewardRooms.forEach((i,n)=>rooms[i].supply=['ammo','medical','armor'][n]);
  const corridors=new Set();
  const carve=(a,b)=>{let x=a.x,y=a.y;grid[y][x]=1;corridors.add(`${x},${y}`);while(x!==b.x){x+=Math.sign(b.x-x);grid[y][x]=1;corridors.add(`${x},${y}`);}while(y!==b.y){y+=Math.sign(b.y-y);grid[y][x]=1;corridors.add(`${x},${y}`);}};
  for(const [ai,bi]of links){const a=rooms[ai],b=rooms[bi];
    // Offset entrances break long straight firing lanes; only cardinal neighboring rooms connect.
    if(Math.floor(ai/3)===Math.floor(bi/3)){const left=a.x<b.x?a:b,doorX=left.x+left.w,ay=a.cy+Math.floor(rng()*3)-1,by=b.cy+Math.floor(rng()*3)-1;carve({x:a.cx,y:ay},{x:doorX,y:ay});carve({x:doorX,y:ay},{x:doorX,y:by});carve({x:doorX,y:by},{x:b.cx,y:by});}
    else{const top=a.y<b.y?a:b,doorY=top.y+top.h,ax=a.cx+Math.floor(rng()*3)-1,bx=b.cx+Math.floor(rng()*3)-1;carve({x:ax,y:a.cy},{x:ax,y:doorY});carve({x:ax,y:doorY},{x:bx,y:doorY});carve({x:bx,y:doorY},{x:bx,y:b.cy});}
  }
  const start={x:rooms[startRoom].cx,y:rooms[startRoom].cy},end={x:rooms[endRoom].cx,y:rooms[endRoom].cy};
  const enemies=[],items=[],props=[],hazards=[],info=FLOOR_INFO[floor-1];
  const pool=floor<=2?['rifleman','rifleman','raider','gunner','drone','crawler']:['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber'];
  rooms.forEach((r,i)=>{
    const posts=[[r.x+1,r.y+1],[r.x+r.w-2,r.y+1],[r.x+r.w-2,r.y+r.h-2],[r.x+1,r.y+r.h-2]];
    if(i!==startRoom)for(let j=0;j<(3+(floor>=3&&rng()<.45?1:0));j++) {
      const type=i===endRoom&&j===0&&info.boss?info.boss:pool[Math.floor(rng()*pool.length)];
      enemies.push(makeEnemy(type,...posts[j],`${floor}-${i}-${j}`,floor));
    }
    props.push({id:`${floor}-cover-${i}`,x:r.x+1,y:r.y+2,type:'cover',hp:65,maxHp:65});
    if(i%3===1)props.push({id:`${floor}-barrel-${i}`,x:r.x+r.w-1,y:r.y+r.h-2,type:'barrel',hp:18,maxHp:18});
    props.push({id:`${floor}-console-${i}`,x:r.x+r.w-1,y:r.y,type:'terminal',used:false});
    if(i===startRoom||i%2===0)items.push({x:r.x+1,y:r.y+r.h-2,type:i===startRoom?'med':['ammo','pistol','shell'][Math.floor(i/2)%3]});
    if(i===1||i===6)items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'grenade',amount:1});
    if(i===2||i===7)items.push({x:r.x+2,y:r.y+r.h-2,type:'scrap',amount:18});
    if(i===rewardRooms[0])items.push({x:r.cx,y:r.cy-1,type:'lore',floor});
    if(info.hazard&&i!==startRoom&&i%2===1)hazards.push({x:r.x+r.w-2,y:r.y+2,type:info.hazard});
    if(r.supply==='ammo'){items.push({x:r.cx-1,y:r.cy,type:'ammo',amount:20,cache:true},{x:r.cx,y:r.cy,type:'energy',amount:12,cache:true},{x:r.cx+1,y:r.cy,type:'ordnance',amount:3,cache:true},{x:r.cx-1,y:r.cy+1,type:'pistol',amount:24,cache:true},{x:r.cx+1,y:r.cy+1,type:'shell',amount:6,cache:true});}
    if(r.supply)items.push({x:r.cx,y:r.cy+1,type:{ammo:'emp',medical:'stun',armor:'smoke'}[r.supply],amount:1,cache:true});
    if(r.supply==='medical')items.push({x:r.cx,y:r.cy,type:'med',amount:1,cache:true});
    if(r.supply==='armor')items.push({x:r.cx,y:r.cy,type:'armor',amount:20,cache:true});
  });
  // Guaranteed weapon discoveries, placed off the critical path so full packs never block progress.
  const preferred=floor===1?2:floor===2?3:floor===3?4:floor===4?5:floor===5?3:4;
  const unlocked=WEAPONS.map((w,i)=>({w,i})).filter(({w})=>w.unlockId&&weaponUnlocked(w,unlocks));
  const weapon=unlocked.length&&rng()<.25?unlocked[Math.floor(rng()*unlocked.length)].i:preferred;
  const armory=rooms[rewardRooms[0]];items.push({x:armory.cx,y:armory.cy+1,type:'weapon',weapon});
  if(floor>=RARE_ARMORY.minFloor&&rng()<RARE_ARMORY.chance)items.push({x:armory.cx,y:armory.cy+1,type:'weapon',weapon:RARE_ARMORY.weapon});
  if(floor>=3){const r=rooms[startRoom];items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'energy',amount:18});items.push({x:r.x+r.w-2,y:r.y+1,type:'ordnance',amount:4});}
  const spawn=rooms[startRoom];enemies.unshift(makeEnemy('rifleman',spawn.x+spawn.w-1,spawn.y+1,`${floor}-scout`,floor));
  // Doorways can now enter from any side. Never place a solid prop or hazard on a connecting lane.
  for(let i=props.length-1;i>=0;i--)if(props[i].hp>0&&corridors.has(key(props[i])))props.splice(i,1);
  for(let i=hazards.length-1;i>=0;i--)if(corridors.has(key(hazards[i])))hazards.splice(i,1);
  const map={grid,rooms,start,end,startRoom,endRoom,links,mainRoute,rewardRooms,enemies,items,props,hazards,marks:[]};
  // Door-side shelters, internal wall corners and offset firing positions.
  // Keep both center lanes open, and verify occupied destinations after each room edit.
  const destinations=[start,end,...enemies,...items];
  const reserved=new Set([...corridors,...[...destinations,...props,...hazards].map(key)]);
  rooms.forEach((r,i)=>{
    r.kind=['貨架倉庫','環形機房','錯列檢查點'][Math.floor(rng()*3)];
    const added=[],walls=[],previousProps=props.length;
    for(const spot of [{x:r.x+r.w-2,y:r.y+2},{x:r.x+2,y:r.y+r.h-2}])if(!reserved.has(key(spot))){const prop={...spot,type:'cover',id:`${floor}-lane-${i}-${added.length}`,hp:80,maxHp:80};props.push(prop);added.push(prop);}
    const shapes={'貨架倉庫':[[0,-2],[1,-2],[-1,2],[0,2]],'環形機房':[[0,0],[1,0],[0,1],[1,1]],'錯列檢查點':[[1,-1],[1,-2],[-1,1],[-1,2]]};
    if(i!==startRoom)for(const [dx,dy]of shapes[r.kind]){const spot={x:r.cx+dx,y:r.cy+dy};if(!reserved.has(key(spot))&&!props.some(o=>key(o)===key(spot))){grid[spot.y][spot.x]=0;walls.push(spot);}}
    const seen=reachable(map,start);
    const floors=reachable({...map,props:[]},start);
    if(destinations.some(p=>!seen.has(key(p)))||floors.size!==grid.flat().filter(n=>n===1).length){for(const p of walls)grid[p.y][p.x]=1;props.splice(previousProps);}
  });
  return map;
}
export function reachable(map,start) {
  const queue=[start],seen=new Set([key(start)]);
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of DIRECTIONS){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(map.grid[p.y]?.[p.x]===1&&!seen.has(key(p))&&!map.props.some(o=>o.hp>0&&(o.type==='cover'||o.type==='barrel')&&o.x===p.x&&o.y===p.y)){seen.add(key(p));queue.push(p);}}
  return seen;
}
