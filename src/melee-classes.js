import {activeTrait,healActor} from './traits.js';
import {DIRECTIONS,distance,lineOfSight} from './world.js';
import {WEAPONS,ENEMY_TYPES} from './data.js';
import {isDark} from './lighting.js';
import {presentStep} from './presentation.js';
export const MELEE_TUNING={bloodlust:.2,spiritMax:5,spiritReduction:.05,spiritDelay:5,spiritInterval:2,bladeDamage:.1,bladeReduction:.1,ambush:1.5,ambushCooldown:1,duelist:15,camoEvasion:30};
export const GRAPPLE_RANGE=5,GRAPPLE_COOLDOWN=4,CAMO_DURATION=5,CAMO_COOLDOWN=10;
export const freshSpirit=()=>({stacks:0,lastKill:null});
export const bladeCount=p=>activeTrait(p,'blade_stash')?p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]]?.melee).length:0;
export const bladeMultiplier=p=>1+bladeCount(p)*MELEE_TUNING.bladeDamage;
export function meleeDefense(p,damage){const spirit=activeTrait(p,'battle_spirit')?(p.battleSpirit?.stacks||0):0;return Math.max(1,Math.ceil(damage*Math.max(0,1-bladeCount(p)*MELEE_TUNING.bladeReduction)*(1-spirit*MELEE_TUNING.spiritReduction)));}
export function tickSpirit(g){const s=g.player.battleSpirit;if(!s?.stacks||s.lastKill===null)return;const elapsed=g.turn-s.lastKill;if(elapsed>=MELEE_TUNING.spiritDelay&&(elapsed-MELEE_TUNING.spiritDelay)%MELEE_TUNING.spiritInterval===0)s.stacks--;}
export function ambushReady(g,target){const p=g.player;return Boolean(target&&g.enemies.includes(target)&&activeTrait(p,'ambush')&&(target.control?.disabled>0||!g.sight(target,p)||isDark(g,p)));}
export function shortenCamo(p){const s=p.skillState?.camouflage;if(s&&!s.remaining)s.cooldown=Math.max(0,s.cooldown-MELEE_TUNING.ambushCooldown);}
export function meleeReward(g,target,before){const p=g.player,actual=Math.max(0,before-Math.max(0,target.hp));if(actual<=0)return;
 if(p.hp>0&&activeTrait(p,'bloodlust'))healActor(p,Math.floor(actual*MELEE_TUNING.bloodlust));
 if(target.hp<=0&&activeTrait(p,'battle_spirit'))p.battleSpirit={stacks:Math.min(MELEE_TUNING.spiritMax,p.battleSpirit.stacks+1),lastKill:g.turn};
}
export function defensiveEvasion(g,attacker,target){
 if(target!==g.player||!g.enemies.includes(attacker))return 0;
 const p=g.player;let bonus=p.skillState?.camouflage?.remaining>0?MELEE_TUNING.camoEvasion:0;
 if(activeTrait(p,'duelist')&&g.enemies.filter(e=>e.hp>0&&e.alert&&distance(e,p)<=Math.max(10,ENEMY_TYPES[e.type].range)&&g.sight(e,p)).length===1)bonus+=MELEE_TUNING.duelist;
 return bonus;
}
export function grapplePlan(g,id=g.target){
 const p=g.player,e=g.enemies.find(e=>e.id===id&&e.hp>0),slot=p.owned.find(i=>g.weaponAt(i).id==='axe');
 if(slot===undefined)return {reason:'需要綁定斧頭。'};
 if(!e||distance(p,e)>GRAPPLE_RANGE||!g.visible(e))return {reason:'鉤鎖需要視線內五格的存活敵人。'};
 const dash=activeTrait(e,'large')||['boss','warden'].includes(e.type),mover=dash?p:e,anchor=dash?e:p;
 // Straight swept path, with occupied/solid cells excluded; diagonal corner crossing must have an open side.
 const grid=g.grid.map(row=>row.slice());for(let y=0;y<grid.length;y++)for(let x=0;x<grid[y].length;x++)if(g.solid(x,y))grid[y][x]=0;
 for(const a of [p,...g.enemies.filter(a=>a.hp>0),...g.activeAllies])if(a!==mover)grid[a.y][a.x]=0;
 const choices=DIRECTIONS.map(([dx,dy])=>({x:anchor.x+dx,y:anchor.y+dy})).filter(q=>g.passable(q.x,q.y)&&grid[q.y]?.[q.x]===1&&g.canCross(q,anchor)&&lineOfSight(grid,mover,q,g.barriers,'move')).sort((a,b)=>distance(a,mover)-distance(b,mover));
 if(!choices.length)return {reason:'沒有可到達的近戰落點。'};
 return {enemy:e,mover,point:choices[0],dash,slot};
}
export function useGrapple(g,id){
 const plan=grapplePlan(g,id);if(plan.reason)return g.fail(plan.reason);
 const {enemy,mover,point,dash,slot}=plan,p=g.player;
 const state=p.skillState.grapple;if(!state||state.cooldown)return false;
 state.remaining=0;state.cooldown=GRAPPLE_COOLDOWN;
 presentStep(g,()=>{const from={x:mover.x,y:mover.y};Object.assign(mover,point);mover.moved=distance(from,point)>0;mover.moveDelta=[0,0];
  if(!dash&&mover.moved){mover.charge=false;mover.windup=0;mover.aim=null;mover.focusTarget=null;mover.fireChain=null;}
  g.effects.push({type:'pulse',from,to:{...point},radius:.5,color:'#d9bd7b',damage:0});g.reveal();
 });
 g.target=enemy.id;return g.strike({id:enemy.id,x:enemy.x,y:enemy.y},slot);
}
export function validMeleeState(p,turn){const s=p.battleSpirit;return s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).length===2&&Number.isInteger(s.stacks)&&s.stacks>=0&&s.stacks<=MELEE_TUNING.spiritMax&&(s.lastKill===null?s.stacks===0:Number.isSafeInteger(s.lastKill)&&s.lastKill>=1&&s.lastKill<=turn);}
