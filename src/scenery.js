// Saved styles are append-only. Each vehicle cell owns independent cover/HP.
export const SCENERY_ATLAS=new URL('../assets/pixel/scenery-v1/atlas.png',import.meta.url).href;
export const SCENERY_FURNITURE={
  desk:{name:'辦公桌',hp:55,sprite:12},pallet:{name:'貨物堆棧',hp:75,sprite:13},
  ...Object.fromEntries(['rover','shuttle'].flatMap((type,t)=>Array.from({length:6},(_,i)=>[`${type}_${i}`,{name:`${t?'穿梭艇':'裝甲車'}${i===2||i===3?'座艙':'部件'}`,hp:i===2||i===3?75:55,sprite:Math.floor(i/2)*4+i%2+t*2,full:i===2||i===3}]))),
};
const vehicles=type=>Array.from({length:6},(_,i)=>({style:`${type}_${i}`,x:1+i%2,y:1+Math.floor(i/2)}));
export const LARGE_MODULE_TYPES={
  office:{name:'辦公隔間',code:'OFFICE',color:'#9ebfc1',size:[4,4],parts:[{style:'desk',x:0,y:1},{style:'desk',x:3,y:1}],edges:[['partition',1,0,2,0],['partition',1,1,2,1],['low_partition',0,1,0,2],['low_partition',3,1,3,2]]},
  warehouse:{name:'堆棧倉庫',code:'CARGO',color:'#c1b293',size:[4,4],parts:[{style:'pallet',x:0,y:0},{style:'pallet',x:3,y:0},{style:'pallet',x:0,y:3},{style:'pallet',x:3,y:3}],edges:[]},
  garage:{name:'裝甲車庫',code:'GARAGE',color:'#b8bf9e',size:[4,5],parts:vehicles('rover'),edges:[]},
  hangar:{name:'小型機庫',code:'HANGAR',color:'#a0b8cf',size:[4,5],parts:vehicles('shuttle'),edges:[]},
};
export const fullProp=p=>p?.type==='cover'&&p.hp>0&&SCENERY_FURNITURE[p.style]?.full===true;
const cache=new WeakMap();
// Cache the physical opaque grid; targeting a part must still see that surface.
// Endpoints are opened only for the current ray, never in the saved terrain.
export function objectSightGrid(game,a,b){
  const full=(game.props||[]).filter(fullProp);if(!full.length)return game.grid;
  const signature=full.map(p=>`${p.x},${p.y}`).join(';');let entry=cache.get(game);
  if(!entry||entry.grid!==game.grid||entry.signature!==signature||entry.rows.some((r,i)=>r!==game.grid[i])){
    // Row overlays inherit live terrain values, so an in-place terrain edit never
    // leaves a stale copied wall. Only opaque object cells override the base.
    const blocked=game.grid.map(r=>Object.create(r));for(const p of full)blocked[p.y][p.x]=0;entry={grid:game.grid,rows:[...game.grid],signature,blocked};cache.set(game,entry);
  }
  const ends=[a,b].filter(p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&game.grid[p.y]?.[p.x]===1&&entry.blocked[p.y][p.x]===0);
  if(!ends.length)return entry.blocked;
  const grid=entry.blocked.map(r=>[...r]);for(const p of ends)grid[p.y][p.x]=1;return grid;
}
