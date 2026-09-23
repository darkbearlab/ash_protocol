import {t} from './i18n.js';
import {isBossClass} from './enemy-data.js';
import {interruptEnemyIntent} from './enemy-intents.js';
import {objectSightGrid} from './scenery.js';
import {activeTrait} from './traits.js';
import {distance,lineOfSight,key} from './world.js';
import {combatSight} from './combat.js';

export const SMOKE_DURATION=5;
// Disruption length in the target's own opportunities (3.42: 2→4, bosses 1→2). A target that has not acted yet
// in the throw turn spends its first skip there, answering nothing, so the thrower gets DISRUPT_TURNS-1 unanswered
// follow-ups; at the old length of 2 that was a single one, and a boss's single skip only cancelled the reply.
export const DISRUPT_TURNS=4,BOSS_DISRUPT_TURNS=2,DISRUPT_IMMUNITY=2;
// Frag blast base damage before blast bonuses; shared by thrown grenades and loitering munitions (3.92.0).
export const FRAG_DAMAGE=55;

// Keywords select reactions; they do not imply armor, size, or allegiance.
export const GRENADES={
  // 3.150.0 (user decision 2026-09-19): priced like the other throwables, one for 12 (it was two for 12).
  frag:{name:t('grenades.frag.name'),short:t('grenades.frag.short'),icon:'◉',resource:'grenades',item:'grenade',cost:12,amount:1,color:'#c8d692',action:'grenade',text:t('grenades.frag.text')},
  smoke:{name:t('grenades.smoke.name'),short:t('grenades.smoke.short'),icon:'≋',resource:'smoke',item:'smoke',cost:12,amount:1,color:'#a9bbcb',action:'grenade',text:t('grenades.smoke.text',{turns:SMOKE_DURATION})},
  emp:{name:t('grenades.emp.name'),short:'EMP',icon:'ϟ',resource:'emp',item:'emp',keyword:'mechanical',cost:15,amount:1,color:'#81dce9',action:'grenade',text:t('throwables.emp',{turns:DISRUPT_TURNS,bossTurns:BOSS_DISRUPT_TURNS,immunity:DISRUPT_IMMUNITY})},
  stun:{name:t('grenades.stun.name'),short:t('grenades.stun.short'),icon:'✦',resource:'stun',item:'stun',keyword:'biological',cost:15,amount:1,color:'#eee0a0',action:'grenade',text:t('throwables.stun',{turns:DISRUPT_TURNS,bossTurns:BOSS_DISRUPT_TURNS,immunity:DISRUPT_IMMUNITY})},
};
export const grenadeTotal=p=>Object.values(GRENADES).reduce((n,g)=>n+(p[g.resource]||0),0);
export const grenadeByItem=type=>Object.keys(GRENADES).find(id=>GRENADES[id].item===type);
export const controlState=()=>({disabled:0,immune:0});
export const validControl=c=>c&&typeof c==='object'&&!Array.isArray(c)&&Object.keys(c).length===2&&['disabled','immune'].every(k=>Number.isInteger(c[k])&&c[k]>=0&&c[k]<=(k==='disabled'?DISRUPT_TURNS:DISRUPT_IMMUNITY))&&!(c.disabled&&c.immune);
export const disruptionEligible=(actor,keyword)=>activeTrait(actor,keyword)||(keyword==='biological'&&(activeTrait(actor,'night_vision')||activeTrait(actor,'infrared')));
export function applyDisruption(actor,keyword){
  if(!disruptionEligible(actor,keyword)||actor.hp<=0||actor.control.disabled||actor.control.immune)return false;
  actor.control.disabled=isBossClass(actor)?BOSS_DISRUPT_TURNS:DISRUPT_TURNS;
  if(activeTrait(actor,'disruption_resistant'))actor.control.disabled=Math.ceil(actor.control.disabled/2);
  interruptEnemyIntent(actor,'disabled');
  // An allied suicide bot loses its windup the same way (3.94.0).
  delete actor.primed;
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
  // 3.134.0 (docs/SWARM_FIELDS.md): toxic mist never blocks sight; spore smoke blinds everyone but the swarm.
  const swarmEyes=a.faction==='swarm'&&typeof a.type==='string'&&!a.kind,view=swarmEyes?'swarm':'all';
  let cache=sightCache.get(game);
  if(!cache||cache.grid!==grid||cache.clouds!==game.smoke){cache={grid,clouds:game.smoke,views:{}};sightCache.set(game,cache);}
  let v=cache.views[view];
  if(!v){
    const cells=new Set(game.smoke.filter(s=>s.kind!=='toxic'&&!(swarmEyes&&s.kind==='spore')).flatMap(s=>s.cells.map(key)));
    v=cache.views[view]={cells,blocked:grid.map((row,y)=>row.map((val,x)=>cells.has(`${x},${y}`)?0:val))};
  }
  if(!v.cells.size)return combatSight(grid,a,b,game.barriers);
  if(v.cells.has(key(a))||v.cells.has(key(b)))return false;
  return combatSight(v.blocked,a,b,game.barriers);
}
