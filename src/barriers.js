import {bestCover} from './cover.js';
// An edge belongs to both adjacent floor cells. axis is its normal, not its tangent.
export const BARRIER_TYPES={
  door:{name:'隔離門',maxHp:60,openable:true,destructible:true,move:true,sight:true,shot:true,blast:true,cover:true},
  low_partition:{name:'矮隔板',maxHp:60,openable:false,destructible:true,vaultable:true,move:true,sight:false,shot:false,blast:false,cover:true},
  partition:{name:'隔板',maxHp:90,openable:false,destructible:true,move:true,sight:true,shot:true,blast:true,cover:true},
};
export const isBarrier=b=>Boolean(b&&Object.hasOwn(BARRIER_TYPES,b.type));
export const vaultable=b=>Boolean(b&&b.hp>0&&BARRIER_TYPES[b.type]?.vaultable);
export const barrierName=b=>BARRIER_TYPES[b.type]?.name||'障礙物';
export const edgeKey=b=>`${b.axis}:${b.x},${b.y}`;
export function edgeCells(b){return b.axis==='x'?[{x:b.x-.5,y:b.y},{x:b.x+.5,y:b.y}]:[{x:b.x,y:b.y-.5},{x:b.x,y:b.y+.5}];}
export const edgeAdjacent=(b,p)=>edgeCells(b).some(q=>q.x===p.x&&q.y===p.y);
export const edgeBlocks=(b,channel='move')=>Boolean(b&&b.hp>0&&!b.open&&BARRIER_TYPES[b.type]?.[channel]);
export function makeBarrier(type,a,b,id){const axis=a.x!==b.x?'x':'y',def=BARRIER_TYPES[type];return {id,type,axis,x:(a.x+b.x)/2,y:(a.y+b.y)/2,hp:def.maxHp,maxHp:def.maxHp,open:false};}
const indices=new WeakMap();
export function barrierBetween(barriers,a,b){
  if(!barriers?.length||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return null;
  let entry=indices.get(barriers);if(!entry||entry.length!==barriers.length){entry={length:barriers.length,map:new Map(barriers.map(e=>[edgeKey(e),e]))};indices.set(barriers,entry);}
  return entry.map.get(`${a.x!==b.x?'x':'y'}:${(a.x+b.x)/2},${(a.y+b.y)/2}`)||null;
}
export const blockedBetween=(edges,a,b,channel='move')=>edgeBlocks(barrierBetween(edges,a,b),channel);
export function edgeCover(edges,target,attacker){
  return bestCover((edges||[]).filter(b=>edgeBlocks(b,'cover')&&edgeAdjacent(b,target)),target,attacker)||null;
}
export function barrierFace(b,from){return edgeCells(b).sort((a,c)=>(Math.abs(a.x-from.x)+Math.abs(a.y-from.y))-(Math.abs(c.x-from.x)+Math.abs(c.y-from.y)))[0];}
export function firstBarrierOnRay(edges,from,to,channel='shot'){
  const hits=[];
  for(const b of edges){
    if(!edgeBlocks(b,channel))continue;
    const horizontal=b.axis==='x',delta=horizontal?to.x-from.x:to.y-from.y;if(!delta)continue;
    const t=((horizontal?b.x:b.y)-(horizontal?from.x:from.y))/delta;
    const along=horizontal?from.y+(to.y-from.y)*t:from.x+(to.x-from.x)*t,center=horizontal?b.y:b.x;
    if(t>0&&t<=1&&Math.abs(along-center)<=.500001)hits.push({b,t});
  }return hits.sort((a,b)=>a.t-b.t)[0]?.b||null;
}
export function validBarriers(edges,grid,ids=[]){
  if(!Array.isArray(edges)||edges.length>256)return false;
  const keys=new Set(),names=new Set(ids);
  for(const b of edges){
    if(!b||!Object.hasOwn(BARRIER_TYPES,b.type)||!['x','y'].includes(b.axis)||typeof b.id!=='string'||!/^edge-[a-zA-Z0-9_-]{1,90}$/.test(b.id)||names.has(b.id))return false;
    if(!Number.isFinite(b.x)||!Number.isFinite(b.y)||!edgeCells(b).every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&grid[p.y]?.[p.x]===1)||keys.has(edgeKey(b)))return false;
    if(!Number.isInteger(b.maxHp)||b.maxHp!==BARRIER_TYPES[b.type].maxHp||!Number.isInteger(b.hp)||b.hp<0||b.hp>b.maxHp||typeof b.open!=='boolean'||(b.open&&!BARRIER_TYPES[b.type].openable))return false;
    keys.add(edgeKey(b));names.add(b.id);
  }return true;
}
