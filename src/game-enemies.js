// The enemy turn (3.206.3 split): spawning, whom an enemy goes for, its action (src/enemy-behavior.js decides), its
// steps and routes, and the environment's turn.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {t} from './i18n.js';
import {addPoison,tickPoison} from './poison.js';
import {activeTrait} from './traits.js';
import {SWARM_TUNING} from './swarm.js';
import {rollEnemyElite} from './elite-enemies.js';
import {fireproof,hasEnemyTag,isNoncombatant} from './enemy-data.js';
import {unitTree} from './behavior-tree.js';
import {enemyOpportunity,executeEnemyTree} from './enemy-behavior.js';
import {startSpecials,endSpecials} from './enemy-specials.js';
import {rollEnemyAffixes} from './enemy-affixes.js';
import {pinned} from './suppression.js';
import {petReactions} from './pet-growth.js';
import {DETOUR_TRAIT,DETOUR_TUNING,exposedFrom,watchPoint} from './detour.js';
import {toxicPlayerTurn} from './swarm-fields.js';
import {inCloud,scalding} from './vents.js';
import {hazardCost,stepOffHazard} from './hazard-paths.js';
import {VENT_TUNING} from './vent-map.js';
import {FIRE_TUNING,burningAt} from './fire.js';
import {sweptClear,sweptGrid} from './line-move.js';
import {occupied} from './allies.js';
import {skillActive} from './skills.js';
import {barrierBetween,edgeBlocks,vaultable} from './barriers.js';
import {decoyAct,fooled,mineAct,noticeAttack} from './field-gear.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {DIRECTIONS,distance,key,makeEnemy} from './world.js';
export const LUNGE_TRAIT='lunge',LUNGE_TUNING=Object.freeze({reach:3});
export class GameEnemyTurn {
  // 3.212.0 review: `marks` (expendable, reinforcement) go on before the rolls, so a deployed unit never rolls elite.
  spawnEnemy(type,x,y,id,marks=null){const d=this.difficultySpec;return rollEnemyElite(rollEnemyAffixes(Object.assign(makeEnemy(type,x,y,id,this.floor,d,this.facilityFaction),marks),this.seed,this.floor,d),this.seed,this.floor,d);}
  enemyTarget(e){
    if(isNoncombatant(e))return this.player;
    const options=[this.player,...this.activeAllies].filter(a=>a.hp>0&&distance(e,a)<=Math.max(10,ENEMY_TYPES[e.type].range)&&this.sight(e,a));
    if(unitTree(e).fixedTile&&e.charge&&e.aim){const occupant=[this.player,...this.activeAllies].find(a=>key(a)===key(e.aim));if(occupant)return occupant;}
    if(e.charge&&e.focusTarget){const old=[this.player,...this.activeAllies].find(a=>(a.id||'player')===e.focusTarget);if(old)return old;}
    const ready=a=>distance(e,a)<=ENEMY_TYPES[e.type].range&&this.shotClear(e,a);
    return options.sort((a,b)=>Number(ready(b))-Number(ready(a))||distance(e,a)-distance(e,b))[0]||this.player;
  }
  // 3.144.0 (src/field-gear.js), as methods so modules the decoy module imports can ask without a cycle.
  isFooled(e){return fooled(this,e);}
  noticeAttack(e){noticeAttack(this,e);}
  enemyAct(e){
    // As the turn begins (src/enemy-specials.js ORDER.start), before a decoy or a mine can take it: a boss's paint lands
    // wherever you are (3.204.0), then the matriarch's egg sac hatches (3.205.0; not her action).
    startSpecials(this,e);
    // 3.207.0 (ORDER.end): after the turn, whatever took it, a delisted engineer's drone (not its action).
    try{
    if(decoyAct(this,e))return;   // 3.144.0
    if(mineAct(this,e))return;    // 3.145.0: shoot a mine it watched go down
    return this.enemyOpportunity(e);
    }finally{endSpecials(this,e);}
  }
  enemyOpportunity(e){return enemyOpportunity(this,e);}
  executeEnemy(e){return executeEnemyTree(this,e);}
  nextStep(e,target) {
    // 3.129.0 迂迴: a unit with the trait walks the covered route to any destination but you (docs/DETOUR.md).
    // 3.132.0 突進: along its route it covers up to three tiles in one straight sweep (src/line-move.js).
    if(activeTrait(e,LUNGE_TRAIT)){const leap=this.lungeStep(e,target);if(leap)return leap;}
    if(activeTrait(e,DETOUR_TRAIT)&&distance(target,this.player)>0){const step=this.coveredStep(e,target);if(step!==undefined)return step;}
    // 3.201.0: a uniform-cost search, so a hazard tile costs HAZARD_TUNING.stepCost extra (src/hazard-paths.js). With no
    // hazard on the way every step costs 1 and it expands in exactly the order the old breadth-first search did.
    const buckets=[[{x:e.x,y:e.y,first:null}]],best=new Map([[key(e),0]]);let expanded=0;
    const occupied=new Set([...this.enemies.filter(o=>o!==e&&o.hp>0),...this.activeAllies].filter(a=>a!==target).map(key));
    for(let cost=0;cost<buckets.length;cost++)for(const q of buckets[cost]||[]){
      if(best.get(key(q))<cost)continue;
      if(expanded++>=SIZE*SIZE)return null;
      for(const [dx,dy]of DIRECTIONS){
        const x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
        if(best.has(k)&&best.get(k)<=cost+1||!this.passable(x,y,e))continue;
        const edge=barrierBetween(this.barriers,q,{x,y});if(edgeBlocks(edge)&&edge.type!=='door'&&!vaultable(edge))continue;
        if(skillActive(this.player)&&distance(target,this.player)>0&&x===this.player.x&&y===this.player.y)continue;
        if(x===target.x&&y===target.y)return q.first||(distance(target,this.player)>0||edgeBlocks(edge)?{x,y}:null);
        if(occupied.has(k))continue;
        const next=cost+1+hazardCost(this,e,x,y);if(best.has(k)&&best.get(k)<=next)continue;
        best.set(k,next);(buckets[next]||=[]).push({x,y,first:q.first||{x,y}});
      }
    }return null;
  }
  // Uniform-cost search under nextStep's walking rules. `exposed` tiles cost extra; undefined means "use nextStep".
  routeSearch(e,target,exposed){
    const occupied=new Set([...this.enemies.filter(o=>o!==e&&o.hp>0),...this.activeAllies].filter(a=>a!==target).map(key));
    const extra=DETOUR_TUNING.exposedCost,buckets=[[{x:e.x,y:e.y,first:null,steps:0,prev:null}]],best=new Map([[key(e),0]]);
    for(let cost=0;cost<buckets.length;cost++)for(const q of buckets[cost]||[]){
      if(best.get(key(q))<cost)continue;
      if(q.x===target.x&&q.y===target.y){const path=[];for(let c=q;c;c=c.prev)path.unshift({x:c.x,y:c.y});return {first:q.first,steps:q.steps,path};}
      for(const [dx,dy] of DIRECTIONS){
        const x=q.x+dx,y=q.y+dy,k=`${x},${y}`,isTarget=x===target.x&&y===target.y;
        if(!this.passable(x,y,e))continue;
        const edge=barrierBetween(this.barriers,q,{x,y});if(edgeBlocks(edge)&&edge.type!=='door'&&!vaultable(edge))continue;
        if(skillActive(this.player)&&x===this.player.x&&y===this.player.y)continue;
        if(!isTarget&&occupied.has(k))continue;
        const next=cost+1+(exposed?.has(k)?extra:0)+hazardCost(this,e,x,y);if(best.has(k)&&best.get(k)<=next)continue;
        best.set(k,next);(buckets[next]||=[]).push({x,y,first:q.first||{x,y},steps:q.steps+1,prev:q});
      }
    }
    return null;
  }
  // The farthest tile, within the lunge's reach along the route it would walk anyway (the covered one if it also
  // detours), that one straight sweep reaches. Null when that is no further than a single step.
  lungeStep(e,target){
    const from=activeTrait(e,DETOUR_TRAIT)&&distance(target,this.player)>0?watchPoint(e):null;
    const route=this.routeSearch(e,target,from?exposedFrom(this,from):null);if(!route)return null;
    const grid=sweptGrid(this,e),path=route.path;
    for(let i=Math.min(LUNGE_TUNING.reach,path.length-1);i>=2;i--){
      const q=path[i];if(distance(q,this.player)===0||!this.passable(q.x,q.y,e))continue;
      if(sweptClear(this,e,q,grid))return {x:q.x,y:q.y};
    }
    return null;
  }
  coveredStep(e,target){
    const from=watchPoint(e);if(!from)return undefined;
    const plain=this.routeSearch(e,target,null);if(!plain)return undefined;
    const covered=this.routeSearch(e,target,exposedFrom(this,from));
    if(!covered||covered.steps>plain.steps+DETOUR_TUNING.extraSteps)return undefined;
    return covered.first;
  }
  environmentTurn() {
    const p=this.player,hpBefore=p.hp,platesBefore=p.plates,hazard=this.hazards.find(h=>h.x===p.x&&h.y===p.y);
    // 3.210.0 (docs/BULWARK.md 改版): floorDamage lets the bulwark's plates take the floor's damage first; the log says so.
    const floorLog=([hurt,plated,source,real],{damage,plates})=>this.log(!plates?t(hurt,{damage}):damage?t(plated,{damage,n:plates}):t('game.floorPlatesOnly',{source:t(source),n:plates}),true,t(real));
    const ACID=['game.acidHurt','game.acidHurtPlates','game.floorSource.acid','game.acidHurtReal'],HEAT=['game.heatHurt','game.heatHurtPlates','game.floorSource.heat','game.heatHurtReal'];
    if(hazard){floorLog(hazard.type==='acid'?ACID:HEAT,this.floorDamage(Math.max(0,(hazard.type==='acid'?8:12)-p.hazmat)));if(hazard.type==='acid'&&p.hazmat<8)addPoison(p,SWARM_TUNING.acidStacks);}
    toxicPlayerTurn(this,addPoison);   // 3.134.0 mist: poisoned for a turn ended in it
    // 3.202.0: steam from a vent scalds whoever ends the round in it, flyers aside (docs/HAZARDS.md section 3).
    if(p.hp>0&&scalding(this,p))floorLog(['game.steamHurt','game.steamHurtPlates','game.floorSource.steam','game.steamHurtReal'],this.floorDamage(Math.max(0,VENT_TUNING.damage-p.hazmat)));
    // 3.203.0 (docs/HAZARDS.md section 2): a burning tile burns whoever ends the round on it, both sides alike; flyers aside.
    if(p.hp>0&&burningAt(this,p))floorLog(['game.fireHurt','game.fireHurtPlates','game.floorSource.fire','game.fireHurtReal'],this.floorDamage(Math.max(0,FIRE_TUNING.damage-p.hazmat)));
    tickPoison(this);
    if(p.hp<hpBefore||p.plates<platesBefore)this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:hpBefore-p.hp,player:true,...(p.plates<platesBefore?{plates:platesBefore-p.plates}:{})});
    for(const a of this.activeAllies.filter(a=>!hasEnemyTag(a,'flying'))){if(this.hazards.some(h=>h.x===a.x&&h.y===a.y))this.damageAlly(a,6,null,true,true);if(a.hp>0&&scalding(this,a))this.damageAlly(a,VENT_TUNING.damage,null,true,true);if(a.hp>0&&burningAt(this,a))this.damageAlly(a,FIRE_TUNING.damage,null,true,true);}
    petReactions(this);
    // 3.206.0: a fireproof card (the rebel bosses) takes nothing from fire, the fixed fire of floors 5-6 included.
    for(const e of this.enemies.filter(e=>e.hp>0&&!hasEnemyTag(e,'flying'))){const proof=fireproof(e),hazard=this.hazards.find(h=>h.x===e.x&&h.y===e.y&&!(proof&&h.type==='fire'));if(hazard)this.hurt(e,6,null,hazard.type==='acid'?'acid':'heat');if(e.hp>0&&!e.alert&&(inCloud(this,'steam',e)||burningAt(this,e)))stepOffHazard(this,e,null,{pinned,occupied});if(e.hp>0&&scalding(this,e))this.hurt(e,VENT_TUNING.damage,null,'steam');if(e.hp>0&&!proof&&burningAt(this,e))this.hurt(e,FIRE_TUNING.damage,null,'fire');}   // 3.202.0: an idle one flinches out of the steam; 3.203.0: and off a burning tile
  }
}
