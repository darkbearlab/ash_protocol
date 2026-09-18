// Personality (3.133.0, user decision 2026-09-18, docs/ORDERS.md §8.1): which orders a unit is willing to take on its
// own, and how hard it commits to them. It belongs to faction + card, never the card alone — the same `crawler` is a
// loyalist hound and a swarm hunter. A faction with no table (the legacy mix) keeps the card's own `accepts`, so its
// behaviour and the bot baseline do not move.
import {factionDef,enemyFaction} from './factions.js';
import {enemyDef} from './enemy-data.js';

export const PERSONALITIES=Object.freeze({
 // Order of `accepts` is the order the unit checks them in; the first whose moment has come is the one it takes.
 disciplined:Object.freeze({name:'紀律',accepts:['hold','flank'],patience:1.5,hitBreaks:false}),
 cunning:Object.freeze({name:'狡猾',accepts:['ambush','flank'],patience:1,hitBreaks:true}),
 cowardly:Object.freeze({name:'怕死',accepts:['retreat'],patience:1,hitBreaks:true}),
 feral:Object.freeze({name:'兇猛',accepts:[],pounce:true}),
 mindless:Object.freeze({name:'無心',accepts:[]}),
 commander:Object.freeze({name:'指揮',accepts:[]}),
 fleeing:Object.freeze({name:'逃命',accepts:['flee']}),
});
export function personalityOf(e){
 const table=factionDef(enemyFaction(e))?.personality;if(!table)return null;
 const id=table[e.type];return id?PERSONALITIES[id]:null;
}
export const hasPersonalityTable=e=>Boolean(factionDef(enemyFaction(e))?.personality);
// Would this unit take an order of this kind on its own? A faction table decides; without one, the card's `accepts`.
export function accepts(e,kind){
 if(hasPersonalityTable(e))return Boolean(personalityOf(e)?.accepts.includes(kind));
 return Boolean(enemyDef(e)?.accepts?.includes(kind));
}
// A self-given order is shaped by the unit's commitment: patience scaled, and a unit that is not shaken by being hit
// drops 'hit' from what breaks it. Orders from someone else keep the giver's terms.
export function selfTerms(e,order){
 const p=personalityOf(e);if(!p)return order;
 const patience=order.patience==null?order.patience:Math.round(order.patience*(p.patience||1));
 const breakOn=p.hitBreaks===false?order.breakOn.filter(b=>b!=='hit'):order.breakOn;
 return {...order,patience,breakOn};
}
