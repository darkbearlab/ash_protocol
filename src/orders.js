// Orders (3.130.0, user design 2026-09-18, docs/ORDERS.md): a unit keeps one order at a time — what it does, where,
// for how long and what makes it give up — given by itself or by someone else. That is what lets an enemy commit to
// a plan instead of re-choosing the best move every turn.
// Rules the user decided:
// - One order per unit; the way it walks (迂迴) is a trait and goes with any order.
// - An order given by someone else outranks one the unit would pick for itself.
// - A unit drops its order only when a break condition fires or its patience runs out — that is the commitment.
// - When an order ends the unit is back to normal, free to take or give a new one.
import {SIZE} from './data.js';

export const ORDER_TUNING=Object.freeze({patience:6,maxPatience:99});
// patience:null is an order with no time limit (a rebel's retreat, a civilian's flight): only its breaks end it.
export const ORDER_BREAKS=Object.freeze(['spotted','hit','passed']);
const ORDERS={};
// def: {start(g,e,order), act(ctx,order) → true (acted) | 'fire' (fall through to the attack) | false, end(g,e,order,why)}
export function registerOrder(kind,def){ORDERS[kind]=Object.freeze(def);}
export const orderKinds=()=>Object.keys(ORDERS);

export function giveOrder(g,e,order){
 if(!ORDERS[order.kind])return false;
 if(e.order)endOrder(g,e,'replaced');
 e.order={patience:ORDER_TUNING.patience,breakOn:[...ORDER_BREAKS],...order,since:g.turn};
 ORDERS[order.kind].start?.(g,e,e.order);
 return true;
}
export function endOrder(g,e,why){
 const order=e.order;if(!order)return;
 delete e.order;ORDERS[order.kind]?.end?.(g,e,order,why);
}
// Runs before the affix branches. Patience is checked here for every kind; the rest is the order's own business.
export function runOrder(ctx){
 const {g,e}=ctx,order=e.order;if(!order)return false;
 if(!ORDERS[order.kind]){delete e.order;return false;}
 if(order.patience!==null&&g.turn-order.since>=order.patience){endOrder(g,e,'patience');return false;}
 return ORDERS[order.kind].act(ctx,order);
}
// Called from hurt(): being hit breaks an order that lists it.
export function orderHit(g,e){if(e.hp>0&&e.order?.breakOn?.includes('hit'))endOrder(g,e,'hit');}

const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&q.x>=0&&q.y>=0&&q.x<SIZE&&q.y<SIZE;
const ORDER_KEYS=new Set(['kind','by','at','watch','from','since','patience','breakOn']);
export function validOrders(g){
 const actors=[...(g.enemies||[]),...Object.values(g.floorStates||{}).flatMap(f=>f.enemies||[])];
 return actors.every(e=>{
  const o=e.order;if(o===undefined)return true;
  if(!o||typeof o!=='object'||Array.isArray(o)||!Object.keys(o).every(k=>ORDER_KEYS.has(k)))return false;
  return Boolean(ORDERS[o.kind])&&typeof o.by==='string'&&o.by.length>0&&o.by.length<=100&&
   ['at','watch','from'].every(k=>o[k]===undefined||point(o[k]))&&
   Number.isSafeInteger(o.since)&&o.since>=0&&o.since<=(g.turn??o.since)&&
   (o.patience===null||Number.isSafeInteger(o.patience)&&o.patience>=1&&o.patience<=ORDER_TUNING.maxPatience)&&
   Array.isArray(o.breakOn)&&o.breakOn.every(b=>ORDER_BREAKS.includes(b))&&new Set(o.breakOn).size===o.breakOn.length;
 });
}
