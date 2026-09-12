import {objectSightGrid} from './scenery.js';
import {activeTrait} from './traits.js';
import {distance,lineOfSight,key} from './world.js';
import {combatSight} from './combat.js';

export const SMOKE_DURATION=5;
// Disruption length in the target's own opportunities (3.42: 2→4, bosses 1→2). A target that has not acted yet
// in the throw turn spends its first skip there, answering nothing, so the thrower gets DISRUPT_TURNS-1 unanswered
// follow-ups; at the old length of 2 that was a single one, and a boss's single skip only cancelled the reply.
export const DISRUPT_TURNS=4,BOSS_DISRUPT_TURNS=2,DISRUPT_IMMUNITY=2;

// Keywords select reactions; they do not imply armor, size, or allegiance.
export const GRENADES={
  frag:{name:'破片手榴彈',short:'破片彈',icon:'◉',resource:'grenades',item:'grenade',cost:12,amount:2,color:'#c8d692',action:'grenade',text:'射程 5、半徑 2。造成爆炸傷害，會自傷及引爆油桶。'},
  smoke:{name:'煙霧彈',short:'煙霧彈',icon:'≋',resource:'smoke',item:'smoke',cost:12,amount:1,color:'#a9bbcb',action:'grenade',text:`射程 5、半徑 2，持續 ${SMOKE_DURATION} 輪（含投擲當輪）。阻斷無紅外線者的視線，煙內僅見相鄰格；紅外線可穿煙，不減傷。`},
  emp:{name:'EMP 彈',short:'EMP',icon:'ϟ',resource:'emp',item:'emp',keyword:'mechanical',cost:15,amount:1,color:'#81dce9',action:'grenade',text:`射程 5、半徑 2。機械中斷蓄勢並跳過 ${DISRUPT_TURNS} 次行動（通常含投擲當回合），頭目 ${BOSS_DISRUPT_TURNS} 次；恢復後免疫 ${DISRUPT_IMMUNITY} 次行動。不扣生命。`},
  stun:{name:'震撼彈',short:'震撼彈',icon:'✦',resource:'stun',item:'stun',keyword:'biological',cost:15,amount:1,color:'#eee0a0',action:'grenade',text:`射程 5、半徑 2。生物或有夜視／紅外線者中斷蓄勢並跳過 ${DISRUPT_TURNS} 次行動（通常含投擲當回合），頭目 ${BOSS_DISRUPT_TURNS} 次；恢復後免疫 ${DISRUPT_IMMUNITY} 次行動。會震暈自己，同樣 ${DISRUPT_TURNS} 次。`},
};
export const grenadeTotal=p=>Object.values(GRENADES).reduce((n,g)=>n+(p[g.resource]||0),0);
export const grenadeByItem=type=>Object.keys(GRENADES).find(id=>GRENADES[id].item===type);
export const controlState=()=>({disabled:0,immune:0});
export const validControl=c=>c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).length===2&&['disabled','immune'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=(k==='disabled'?DISRUPT_TURNS:DISRUPT_IMMUNITY))&&!(c.disabled&&c.immune);
export const disruptionEligible=(actor,keyword)=>activeTrait(actor,keyword)||(keyword==='biological'&&(activeTrait(actor,'night_vision')||activeTrait(actor,'infrared')));
export function applyDisruption(actor,keyword){
  if(!disruptionEligible(actor,keyword)||actor.hp<=0||actor.control.disabled||actor.control.immune)return false;
  actor.control.disabled=['boss','warden'].includes(actor.type)?BOSS_DISRUPT_TURNS:DISRUPT_TURNS;
  actor.charge=false;actor.aim=null;actor.windup=0;actor.fireChain=null;
  actor.guard=false;actor.focus=false;actor.evasive=false;actor.moved=false;actor.moveDelta=[0,0];
  return true;
}
// Count the actor's own opportunities, so fast/slow order cannot shorten a stun.
export function skipDisabled(actor){
  if(!actor.control?.disabled)return false;
  if(--actor.control.disabled===0)actor.control.immune=DISRUPT_IMMUNITY;
  actor.fireChain=null;actor.moved=false;actor.moveDelta=[0,0];
  return true;
}
export function areaCells(grid,pos,radius=2,barriers=[],game=null){
  const cells=[];
  for(let y=pos.y-radius;y<=pos.y+radius;y++)for(let x=pos.x-radius;x<=pos.x+radius;x++)if(distance(pos,{x,y})<=radius&&lineOfSight(game?objectSightGrid(game,pos,{x,y}):grid,pos,{x,y},barriers,'blast'))cells.push({x,y});
  return cells;
}
const sightCache=new WeakMap();
export function tacticalSight(game,a,b){
  const grid=objectSightGrid(game,a,b);
  if(activeTrait(a,'infrared')||!game.smoke?.length||distance(a,b)<=1)return combatSight(grid,a,b,game.barriers);
  let cache=sightCache.get(game);
  if(!cache||cache.grid!==grid||cache.clouds!==game.smoke){
    const cells=new Set(game.smoke.flatMap(s=>s.cells.map(key))),blocked=grid.map((row,y)=>row.map((v,x)=>cells.has(`${x},${y}`)?0:v));
    cache={grid,clouds:game.smoke,cells,blocked};sightCache.set(game,cache);
  }
  if(cache.cells.has(key(a))||cache.cells.has(key(b)))return false;
  return combatSight(cache.blocked,a,b,game.barriers);
}
