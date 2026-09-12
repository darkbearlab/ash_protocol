import {roomContains} from './map-geometry.js';
import {makeBarrier,barrierBetween,edgeCells} from './barriers.js';

export const FURNITURE={toilet:{name:'衛浴設備',hp:35},sink:{name:'洗手台',hp:40},counter:{name:'門禁櫃檯',hp:70},scanner:{name:'檢查設備',hp:45},locker:{name:'置物櫃',hp:75},bench:{name:'值勤桌',hp:55}};
export const MODULE_TYPES={
  restroom:{name:'衛浴間',code:'WC',color:'#9ccbc8',furniture:['toilet','sink']},
  checkpoint:{name:'門禁櫃檯',code:'ACCESS',color:'#d1bc85',furniture:['counter','scanner']},
  guardpost:{name:'值勤哨站',code:'POST',color:'#a7b797',furniture:['locker','bench']},
};
const dirs=[[0,-1],[1,0],[0,1],[-1,0]],key=p=>`${p.x},${p.y}`;
export const modulePoint=(m,x,y)=>{for(let i=0;i<m.rotation;i++)[x,y]=[1-y,x];return {x:m.x+x,y:m.y+y};};
export const moduleCells=m=>[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>modulePoint(m,x,y));
export function selectSupplyStations(map,floor){
  const main=map.mainRoute[Math.floor(map.mainRoute.length/2)];
  const side=map.rewardRooms.find(i=>!map.mainRoute.includes(i))??map.rooms.findIndex((_,i)=>!map.mainRoute.includes(i));
  const keep=new Set([main,side].map(i=>`${floor}-console-${i}`));
  // Retain their original coordinates; geometry generation has already reserved those cells.
  map.props=map.props.filter(p=>p.type!=='terminal'||keep.has(p.id));
  return {main,side};
}
export function addLivingModules(map,seed,floor,{corridors,reachable,roomFilter=()=>true}){
  const occupied=p=>[...map.props,...map.items,...map.enemies,...map.hazards,map.start,map.end].some(o=>key(o)===key(p));
  const clear=(m)=>moduleCells(m).every(p=>map.grid[p.y]?.[p.x]===1&&!occupied(p));
  const connected=()=>{
    const seen=reachable(map,map.start),solid=new Set(map.props.filter(p=>p.type==='cover'&&p.hp>0||p.type==='barrel'&&p.hp>0).map(key));
    for(let y=0;y<map.grid.length;y++)for(let x=0;x<map.grid[y].length;x++)if(map.grid[y][x]===1&&!solid.has(`${x},${y}`)&&!seen.has(`${x},${y}`))return false;
    return [...map.items,...map.enemies,map.end,...map.props.filter(p=>p.type==='container'||p.type==='terminal')].every(p=>seen.has(key(p)));
  };
  const themes=Object.keys(MODULE_TYPES),offset=(seed+floor)%themes.length,used=new Set();let count=0;
  // Try a closed restroom first when selected. Other modules are open alcoves.
  for(let slot=0;slot<2;slot++){
    const theme=themes[(offset+slot)%themes.length],def=MODULE_TYPES[theme];let placed=false;
    const order=map.rooms.map((r,i)=>({r,i})).filter(({r,i})=>i!==map.startRoom&&!used.has(i)&&roomFilter(r));
    order.sort((a,b)=>((a.i+seed+floor)%map.rooms.length)-((b.i+seed+floor)%map.rooms.length));
    for(const {r,i}of order){
      if(placed)break;
      for(let y=r.y;y<r.y+r.h-1&&!placed;y++)for(let x=r.x;x<r.x+r.w-1&&!placed;x++)for(let rotation=0;rotation<4&&!placed;rotation++){
        const marker={id:`module-${floor}-${slot}`,type:'module',theme,x,y,rotation,indestructible:true};
        if(!moduleCells(marker).every(p=>roomContains(r,p))||!clear(marker))continue;
        const furniture=def.furniture.map((style,n)=>({...modulePoint(marker,n,0),id:`${marker.id}-${n}`,type:'cover',style,moduleId:marker.id,hp:FURNITURE[style].hp,maxHp:FURNITURE[style].hp}));
        if(furniture.some(p=>corridors.has(key(p))||map.barriers.some(b=>edgeCells(b).some(q=>key(q)===key(p)))))continue;
        const cells=moduleCells(marker),priorProps=map.props,priorEdges=map.barriers,edges=[];
        if(theme==='restroom'){
          const perimeter=[];for(const a of cells)for(const [dx,dy]of dirs){const b={x:a.x+dx,y:a.y+dy};if(!cells.some(p=>key(p)===key(b))&&map.grid[b.y]?.[b.x]===1)perimeter.push([a,b]);}
          if(perimeter.some(([a,b])=>barrierBetween(map.barriers,a,b)))continue;
          const entry=perimeter.find(([a,b])=>!furniture.some(p=>key(p)===key(a))&&!occupied(b));if(!entry)continue;
          for(const [n,[a,b]]of perimeter.entries())edges.push(makeBarrier(key(a)===key(entry[0])&&key(b)===key(entry[1])?'door':'partition',a,b,`edge-${marker.id}-${n}`));
        }
        map.props=[...priorProps,marker,...furniture];map.barriers=[...priorEdges,...edges];
        if(!connected()){map.props=priorProps;map.barriers=priorEdges;continue;}
        used.add(i);count++;placed=true;
      }
    }
  }
  return count;
}
export function validModules(props,grid,otherIds=[]){
  const modules=props.filter(p=>p.type==='module'),ids=new Set(otherIds),cells=new Set();if(modules.length>2)return false;
  for(const m of modules){
    if(typeof m.id!=='string'||!/^module-[a-zA-Z0-9_-]{1,80}$/.test(m.id)||ids.has(m.id)||!Object.hasOwn(MODULE_TYPES,m.theme)||!Number.isInteger(m.x)||!Number.isInteger(m.y)||!Number.isInteger(m.rotation)||m.rotation<0||m.rotation>3||m.indestructible!==true||m.hp!==undefined)return false;
    for(const p of moduleCells(m)){if(grid[p.y]?.[p.x]!==1||cells.has(key(p)))return false;cells.add(key(p));}ids.add(m.id);
    for(const [n,style]of MODULE_TYPES[m.theme].furniture.entries()){
      const p=props.find(p=>p.id===`${m.id}-${n}`),pos=modulePoint(m,n,0);
      if(!p||p.moduleId!==m.id||p.style!==style||p.type!=='cover'||p.x!==pos.x||p.y!==pos.y||p.maxHp!==FURNITURE[style].hp||!Number.isFinite(p.hp)||p.hp>p.maxHp||p.indestructible)return false;
    }
  }
  const furnishings=props.filter(p=>p.style!==undefined||p.moduleId!==undefined),names=new Set();
  return furnishings.every(p=>{if(names.has(p.id))return false;names.add(p.id);return modules.some(m=>m.id===p.moduleId&&MODULE_TYPES[m.theme].furniture.some((style,n)=>style===p.style&&p.id===`${m.id}-${n}`));});
}
