import {SIZE,ENEMY_TYPES,FLOOR_INFO,FLOORS} from './data.js';
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
  return {id,type,x,y,hp,maxHp:hp,alert:false,charge:false,windup:0,aim:null,attackCount:0,moved:false};
}
export function generate(seed,floor=1) {
  const rng=random(seed+floor*7919),grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0)),rooms=[];
  for(let ry=0;ry<3;ry++)for(let rx=0;rx<3;rx++) {
    const w=6+Math.floor(rng()*2),h=6+Math.floor(rng()*2),x=rx*8+2,y=ry*8+2;
    const r={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)}; rooms.push(r);
    for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;
  }
  const connect=(a,b)=>{let x=a.cx,y=a.cy;while(x!==b.cx){grid[y][x]=1;x+=Math.sign(b.cx-x);}while(y!==b.cy){grid[y][x]=1;y+=Math.sign(b.cy-y);}grid[y][x]=1;};
  for(let i=1;i<rooms.length;i++)connect(rooms[i-1],rooms[i]);
  for(const [a,b]of[[0,3],[3,6],[1,4],[4,7]])connect(rooms[a],rooms[b]);
  const start={x:rooms[0].cx,y:rooms[0].cy},end={x:rooms[8].cx,y:rooms[8].cy};
  const enemies=[],items=[],props=[],hazards=[],info=FLOOR_INFO[floor-1];
  const pool=floor<=2?['rifleman','rifleman','raider','gunner','drone','crawler']:['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber'];
  rooms.forEach((r,i)=>{
    const posts=[[r.x+1,r.y+1],[r.x+r.w-2,r.y+1],[r.x+r.w-2,r.y+r.h-2],[r.x+1,r.y+r.h-2]];
    if(i>0)for(let j=0;j<(3+(floor>=3&&rng()<.45?1:0));j++) {
      const type=i===8&&j===0&&info.boss?info.boss:pool[Math.floor(rng()*pool.length)];
      enemies.push(makeEnemy(type,...posts[j],`${floor}-${i}-${j}`,floor));
    }
    props.push({id:`${floor}-cover-${i}`,x:r.x+1,y:r.y+2,type:'cover',hp:65,maxHp:65});
    if(i%3===1)props.push({id:`${floor}-barrel-${i}`,x:r.x+r.w-1,y:r.y+r.h-2,type:'barrel',hp:18,maxHp:18});
    props.push({id:`${floor}-console-${i}`,x:r.x+r.w-1,y:r.y,type:'terminal',used:false});
    if(i===0||i%2===0)items.push({x:r.x+1,y:r.y+r.h-2,type:i%3===0?'med':'ammo'});
    if(i===1||i===6)items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'grenade',amount:1});
    if(i===2||i===7)items.push({x:r.x+2,y:r.y+r.h-2,type:'scrap',amount:18});
    if(i===4)items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'lore',floor});
    if(info.hazard&&i>0&&i%2===1)hazards.push({x:r.x+r.w-2,y:r.y+2,type:info.hazard});
  });
  // Guaranteed weapon discoveries, placed off the critical path so full packs never block progress.
  const weapon=floor===1?2:floor===2?3:floor===3?4:floor===4?5:floor===5?3:4;
  const armory=rooms[2];items.push({x:armory.cx,y:armory.cy+1,type:'weapon',weapon});
  if(floor>=3){const r=rooms[0];items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'energy',amount:18});items.push({x:r.x+r.w-2,y:r.y+1,type:'ordnance',amount:4});}
  enemies.unshift(makeEnemy('rifleman',rooms[0].x+rooms[0].w-1,rooms[0].y+1,`${floor}-scout`,floor));
  const map={grid,rooms,start,end,enemies,items,props,hazards,marks:[]};
  // Door-side shelters, internal wall corners and offset firing positions.
  // Keep both center lanes open, and verify occupied destinations after each room edit.
  const destinations=[start,end,...enemies,...items];
  const reserved=new Set([...destinations,...props,...hazards].map(key));
  rooms.forEach((r,i)=>{
    r.kind=['交叉火力區','封鎖檢查點','長廊伏擊區'][i%3];
    const added=[],walls=[],previousProps=props.length;
    for(const spot of [{x:r.x+r.w-2,y:r.y+2},{x:r.x+2,y:r.y+r.h-2}])if(!reserved.has(key(spot))){const prop={...spot,type:'cover',id:`${floor}-lane-${i}-${added.length}`,hp:80,maxHp:80};props.push(prop);added.push(prop);}
    if(i>0)for(const spot of [{x:r.cx+1,y:r.cy-1},{x:r.cx+1,y:r.cy-2}])if(!reserved.has(key(spot))&&!props.some(o=>key(o)===key(spot))){grid[spot.y][spot.x]=0;walls.push(spot);}
    const seen=reachable(map,start);
    if(destinations.some(p=>!seen.has(key(p)))){for(const p of walls)grid[p.y][p.x]=1;props.splice(previousProps);}
  });
  return map;
}
export function reachable(map,start) {
  const queue=[start],seen=new Set([key(start)]);
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of DIRECTIONS){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(map.grid[p.y]?.[p.x]===1&&!seen.has(key(p))&&!map.props.some(o=>o.hp>0&&(o.type==='cover'||o.type==='barrel')&&o.x===p.x&&o.y===p.y)){seen.add(key(p));queue.push(p);}}
  return seen;
}
