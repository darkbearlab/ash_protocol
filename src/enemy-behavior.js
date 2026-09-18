import {poisonHit,tongueAction,infectedDeath} from './swarm.js';
import {civilianAction} from './civilians.js';
import {hasEnemyTag,enemyDef} from './enemy-data.js';
import {observeEnemy} from './callouts.js';
import {ENEMY_TYPES} from './data.js';
import {DIRECTIONS,distance,key} from './world.js';
import {activeTrait,recordShot} from './traits.js';
import {pinned,finishSuppression,rapidFireModifiers} from './suppression.js';
import {scaleEnemy} from './endless.js';
import {AFFIX_TUNING,ENEMY_AFFIXES,revealEnemyAffix,enemyDisplayName as enemyName} from './enemy-affixes.js';
import {interruptEnemyIntent,enemyCallout} from './enemy-intents.js';
import {UNIT_TREES,unitTree,registerUnitTree,registerAffixBranch,runAffixBranches} from './behavior-tree.js';
import {occupied} from './allies.js';
import {enemyRoom} from './runtime-enemies.js';
import {pullLanding} from './melee-classes.js';
import {combatStep} from './tactics.js';
import {barrierBetween,vaultable,edgeBlocks,firstBarrierOnRay} from './barriers.js';
import {petCombat} from './pet-growth.js';
import {squadLeaderAct,useSquadAttack} from './squad.js';
import {enforcerAct,selfRetreat,useRebelHooks} from './rebels.js';
import {runOrder} from './orders.js';
import {selfAmbush,selfHold} from './ambush.js';
import {selfFlank} from './flank.js';
import {pounceAction,usePounceHooks} from './pounce.js';
import {lobAction,releasePayload} from './swarm-fields.js';
import {personalityOf} from './personality.js';
import {spentCase} from './traces.js';
import {lightingEffects} from './lighting.js';
import {tacticalSight} from './throwables.js';
export const ENEMY_WEAPONS=Object.freeze(Object.fromEntries(Object.entries(ENEMY_TYPES).filter(([id])=>hasEnemyTag(id,'armed')).map(([id,def])=>[id,Object.freeze({rounds:def.rounds||1})])));
export function enemyWeapon(e){const rapid=rapidFireModifiers(e);return {range:ENEMY_TYPES[e.type]?.range||1,...rapid,rounds:(enemyDef(e)?.rounds||1)+rapid.extraRounds};}
function revealSenses(g,e,p){if(!g.sight(e,p))return;if(e.affixes?.some(a=>a.id==='infrared'&&!a.revealed)&&!tacticalSight(g,{...e,traits:e.traits.filter(t=>t.id!=='infrared')},p))revealEnemyAffix(g,e,'infrared');}
function seekCover({g,e,p,def,los}){
      if(!pinned(e)&&def.seekCover&&los&&!e.charge&&!g.protectingCover(e,p)){
        const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>g.passable(n.x,n.y,e)&&g.canCross(e,n)&&distance(n,p)>1&&!occupied(g,n,e)&&!g.hazards.some(h=>distance(h,n)===0)&&distance(n,p)<=def.range&&g.sight({...e,...n},p)&&g.shotClear({...e,...n},p)&&g.protectingCover({...e,...n},p));
        if(spot){e.x=spot.x;e.y=spot.y;e.moved=true;enemyCallout(g,e,'state',{state:'cover'});return true;}
      }

return false;
}
function move({g,e,p,def,los,d}){
        const destination=los?p:e.lastKnown;
        const plan=los&&!(def.range===1&&d<=1)?combatStep(g,e,p,{range:def.range,melee:def.range===1,peers:g.enemies.filter(b=>b.hp>0&&b.alert),hold:true}):null;
        const step=pinned(e)||plan?.hold?null:plan?.step||(destination&&distance(e,destination)>0?g.nextStep(e,destination):null);if(step){const edge=barrierBetween(g.barriers,e,step);if(vaultable(edge)){if(distance(step,p)>0&&!occupied(g,step,e)){e.x=step.x;e.y=step.y;e.moved=true;e.vaultExposed=true;}else if(distance(step,p)===0)g.damageProp(edge,scaleEnemy(Math.max(15,def.damage),g.floor,'damage',g.difficultyOffset));}else if(edgeBlocks(edge)){if(hasEnemyTag(e,'breaker'))g.damageProp(edge,scaleEnemy(Math.max(15,def.damage),g.floor,'damage',g.difficultyOffset));else g.setDoor(edge,true);}else if(!occupied(g,step,e)){e.x=step.x;e.y=step.y;e.moved=true;}}

}
function reinforce({g,e,p}){
      if(e.hp<e.maxHp*.5&&!e.reinforced&&enemyRoom(g)>0) {
        e.reinforced=true;
        for(const [dx,dy]of DIRECTIONS.slice(0,2)){const x=e.x+dx,y=e.y+dy;if(enemyRoom(g)>0&&g.passable(x,y)&&g.canCross(e,{x,y})&&distance(p,{x,y})>0&&!occupied(g,{x,y})){const drone=g.spawnEnemy(enemyDef(e).reinforcement,x,y,`${e.id}-reinforce-${dx}-${dy}`);drone.alert=true;drone.lastKnown=e.lastKnown?{...e.lastKnown}:null;g.enemies.push(drone);}}
        g.log(`${enemyName(e)}呼叫了無人機增援！`,true);
      }

}
function attack(ctx){const {g,e,p,def}=ctx;enemyCallout(g,e,'state',{state:'hold'});const fired=def.range>1,rapid=fired&&activeTrait(e,'rapid_fire'),weapon=enemyWeapon(e),rounds=fired?weapon.rounds:1,hits=new Set();let firedRounds=0,poisonApplied=false;
 const totalDamage=def.expendable?def.damage:scaleEnemy(def.damage+g.floor*2,g.floor,'damage',g.difficultyOffset),baseRounds=fired?(enemyDef(e)?.rounds||1):1;
 for(let n=0;n<rounds&&p.hp>0;n++){const before=p.hp,roundDamage=Math.max(1,Math.floor(totalDamage/baseRounds)+(n%baseRounds<totalDamage%baseRounds?1:0));firedRounds++;if(rapid&&n>=baseRounds)revealEnemyAffix(g,e,'suppressor');
        if(fired)g.recordExposure(e,unitTree(e).fixedTile&&e.aim?e.aim:p);if(fired)spentCase(g,e,enemyDef(e)?.casing);
        if(unitTree(e).fixedTile&&e.aim&&!g.shotClear(e,e.aim)){const edge=firstBarrierOnRay(g.barriers,e,e.aim);g.log('狙擊彈被門或隔板阻擋。');g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:edge?{x:edge.x,y:edge.y}:{...e.aim},damage:0});if(edge)g.damageProp(edge,roundDamage);}
        else if(unitTree(e).fixedTile&&distance(p,e.aim||p)>0){g.log('狙擊彈擊中你原本的位置。');g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{...e.aim},damage:0,miss:true,...(def.venom?{style:'venom'}:{})});}
        else {
          petCombat(g,p);if(fired&&lightingEffects(g,{...e,traits:(e.traits||[]).filter(t=>t.id!=='night_vision')},p).penalty>0)revealEnemyAffix(g,e,'night_vision');const chance=def.range>1?g.accuracy(e,p).chance:g.meleeAccuracy(e,p);
          if(g.rng()*100<chance){if(def.venom){g.effects.push({type:'enemyShot',attackerType:e.type,style:'venom',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});poisonHit(g,e,p);}else{if(!poisonApplied)poisonApplied=poisonHit(g,e,p);if(p===g.player)g.damagePlayer(roundDamage,`${enemyName(e)}攻擊`,e);else{g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});g.damageAlly(p,roundDamage,e);}}}
          else {g.log(`${enemyName(e)}未命中（${chance}%）。`,false,`${enemyName(e)}未命中。`);g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0,miss:true,...(def.venom?{style:'venom'}:{})});}
        }
if(p.hp<before)hits.add(p);
 }
 if(fired)finishSuppression([],hits,firedRounds,0,g);
 return fired;
}
function grenade(ctx){const {g,e,p,los}=ctx,intent=e.grenadeIntent;
 if(intent){if((intent.targetId&&![g.player,...g.activeAllies].some(a=>(a.id||'player')===intent.targetId&&a.hp>0))||!los||distance(e,intent.origin)>0||distance(e,p)>AFFIX_TUNING.grenadeRange){interruptEnemyIntent(e,'target_lost');return true;}
 g.marks.push({kind:'grenade',phase:'flight',sourceId:e.id,x:intent.x,y:intent.y,origin:{...intent.origin},radius:AFFIX_TUNING.grenadeRadius,damage:scaleEnemy(AFFIX_TUNING.grenadeDamage,g.floor,'damage',g.difficultyOffset),due:g.turn+1});delete e.grenadeIntent;
 g.effects.push({type:'enemyTelegraph',phase:'flight',from:{...intent.origin},to:{x:intent.x,y:intent.y},damage:0});g.recordExposure(e,intent);g.log(`${enemyName(e)}已投出榴彈！`,true);return true;}
 e.grenadeIntent={stage:'prepare',targetId:p.id||'player',x:p.x,y:p.y,origin:{x:e.x,y:e.y}};revealEnemyAffix(g,e,'grenadier');g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});enemyCallout(g,e,'telegraph',{action:'grenade'});g.log(`${enemyName(e)}準備投彈！`,true);return true;
}
registerAffixBranch({id:'grenadier',reveal:'effect',applies:({e})=>e.affixes?.some(a=>a.id==='grenadier'),trigger:({g,e,p,los})=>Boolean(e.grenadeIntent)||(!e.charge&&los&&distance(e,p)<=AFFIX_TUNING.grenadeRange),get chance(){return AFFIX_TUNING.grenadeChance;},pending:({e})=>Boolean(e.grenadeIntent),steps:['prepare','flight','explode'],run:grenade});
// Loitering munition (3.103.0, user request). The launch puts it exactly at its own strike range from the player and
// where the player can see it, so the turn it appears is a real choice: step out of reach, or shoot it down. On its next
// turn it takes the berserker's hook route to a tile beside the player and detonates, which is why it needs no speed.
const munitionRange=()=>ENEMY_TYPES.munition.range;
const MUNITION_RADIUS=1;
function munitionSpot(g,e,p){
 const range=munitionRange(),spots=[];
 for(let y=p.y-range;y<=p.y+range;y++)for(let x=p.x-range;x<=p.x+range;x++){
  const spot={x,y};
  if(distance(spot,p)!==range||!g.passable(x,y)||occupied(g,spot))continue;
  // Seen by the player and with a clear line to them: an unseen launch would spend the warning turn for nothing.
  if(!g.visible(spot)||!g.sight(spot,p))continue;
  spots.push(spot);
 }
 return spots.sort((a,b)=>distance(e,a)-distance(e,b)||key(a).localeCompare(key(b)))[0]||null;
}
function deployMunition(ctx){
 const {g,e,p}=ctx,spot=munitionSpot(g,e,p);
 if(!spot)return false;
 e.munitionSpent=true;revealEnemyAffix(g,e,'deployer');
 const munition=g.spawnEnemy(ENEMY_AFFIXES.find(a=>a.id==='deployer').spawns,spot.x,spot.y,`${e.id}-munition`);
 munition.alert=true;munition.spawnTurn=g.turn;munition.lastKnown={x:p.x,y:p.y};
 g.enemies.push(munition);
 g.effects.push({type:'enemyTelegraph',phase:'flight',from:{x:e.x,y:e.y},to:{x:spot.x,y:spot.y},damage:0});
 g.log(`${enemyName(e)}\u653e\u51fa\u4e86\u6d6e\u6e38\u5f48\u85e5\uff01`,true);
 return true;
}
registerAffixBranch({id:'deployer',reveal:'effect',applies:({e})=>e.affixes?.some(a=>a.id==='deployer'),
 // Launching replaces this turn's shot, so an enemy already lining one up may still do it; only a pending grenade
 // blocks it, to keep one enemy from carrying two intents at once.
 trigger:({e,p,los})=>!e.munitionSpent&&!e.grenadeIntent&&los&&distance(e,p)<=AFFIX_TUNING.deployerRange&&distance(e,p)>munitionRange(),
 get chance(){return AFFIX_TUNING.deployerFire;},run:deployMunition});
function munitionAct(ctx){
 const {g,e,p}=ctx;
 // The turn it arrives it only hovers, so the player always gets exactly one action before it strikes.
 if(e.spawnTurn===g.turn)return true;
 if(distance(e,p)>munitionRange()||!g.sight(e,p))return false;
 const point=pullLanding(g,e,p);
 if(point){e.x=point.x;e.y=point.y;e.moved=true;g.effects.push({type:'enemyTelegraph',phase:'flight',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});}
 g.log(`${enemyName(e)}\u9264\u7d22\u8cbc\u8fd1\uff0c\u5f15\u7206\uff01`,true);
 g.hurt(e,e.hp,e);
 return true;
}
// Shooting it down sets it off where it stands, exactly like a barrel or a rigged case; at its strike range the blast
// cannot reach the player, which is what makes shooting it the safe answer.
registerUnitTree('munition',{before:munitionAct,death:({g,e})=>g.explode(e,MUNITION_RADIUS,scaleEnemy(ENEMY_TYPES.munition.damage,g.floor,'damage',g.difficultyOffset))});
registerUnitTree('civilian',{before:civilianAction});
registerUnitTree('sniper',{windup:2,fixedTile:true});
registerUnitTree('boss',{beforeAttack:({g,e,p})=>{if((e.attackCount||0)%2!==1||e.charge)return false;g.marks.push({x:p.x,y:p.y,due:g.turn+2});e.attackCount++;enemyCallout(g,e,'telegraph',{action:'bombard'});g.log('核心守衛標記轟炸區：兩次行動內離開紅色格與鄰格！',true);return true;},after:reinforce});
registerUnitTree('warden',{after:reinforce});
// 3.125.0: the squad leader spends its turn commanding; its soldiers answer on a branch that runs before they would
// charge, so deployment and suppression replace the shot without touching any other card's behaviour.
registerUnitTree('squad_leader',{before:squadLeaderAct});
useSquadAttack(attack);
// 3.127.0 rebels (docs/REBELS.md): the enforcer commands through fear; a rebel that breaks hides before it would charge.
registerUnitTree('enforcer',{before:enforcerAct});
// 3.131.0: a rebel's hiding is its retreat order now (src/rebels.js), run with the other orders before the affixes.
useRebelHooks({attack,grenade});
usePounceHooks({attack});
// 3.133.0 personality (docs/ORDERS.md §8.1): a unit with no order checks the kinds its personality accepts, in that
// order, and takes the first whose moment has come. Units of a faction without a table keep the old checks.
const SELF={retreat:selfRetreat,ambush:selfAmbush,hold:selfHold,flank:selfFlank};
function selfOrders(ctx){
 const p=personalityOf(ctx.e);
 if(!p){selfRetreat(ctx);selfAmbush(ctx);return;}
 for(const kind of p.accepts){if(ctx.e.order)return;SELF[kind]?.(ctx);}
}
// 3.132.0: a member's part is the post or bound order its leader gives it (src/squad.js), run with the other orders.
// The bot is its own attacker when it blows itself up, so a self-destruct never gives the workshop a blueprint (3.94.0).
// 3.134.0: a swarm bomber leaves what its sac held (mist, acid or spore smoke) where it bursts; others just burst.
registerUnitTree('bomber',{attack:({g,e})=>{g.hurt(e,e.hp,e);return false;},death:({g,e})=>{g.explode(e,1,scaleEnemy(30,g.floor,'damage',g.difficultyOffset));releasePayload(g,e);}});
registerUnitTree('fodder',{before:({e})=>{if(e.actionDelay>0){e.actionDelay--;e.moved=false;e.moveDelta=[0,0];return true;}e.actionDelay=1;return false;}});
registerUnitTree('brood',{});
export function enemyDeath(g,e){interruptEnemyIntent(e,'death');unitTree(e).death?.({g,e});infectedDeath(g,e);}
export function executeEnemyTree(g,e){const locked=e.grenadeIntent?.targetId,p=(locked?[g.player,...g.activeAllies].find(a=>(a.id||'player')===locked&&a.hp>0):null)||g.enemyTarget(e),def=ENEMY_TYPES[e.type],tree=unitTree(e);e.moved=false;e.moveDelta=[0,0];if(e.hp<=0||!e.alert||p.hp<=0)return;if(e.control?.disabled){interruptEnemyIntent(e,'disabled');return;}
 const los=g.sight(e,p),known=los?p:e.lastKnown||e.aim,d=los?distance(e,p):(known?distance(e,known):Infinity),ctx={g,e,p,def,los,d};
 if(tongueAction(ctx)||pounceAction(ctx)||lobAction(ctx)||tree.before?.(ctx))return;observeEnemy(g,e,los);revealSenses(g,e,p);if(los)e.lastKnown={x:p.x,y:p.y};if(d>16)return;
 // 3.130.0 orders (docs/ORDERS.md): a committed order acts before the affix branches; 'fire' goes straight to the attack.
 selfOrders(ctx);const order=runOrder(ctx);if(order===true)return;
 if(order!=='fire'&&(runAffixBranches(ctx)||seekCover(ctx)))return;
 let fired=false;
 if((los&&g.shotClear(e,p)&&d<=def.range&&(def.range>1||g.canCross(e,p)))||(tree.fixedTile&&e.charge&&e.aim)){
 e.tactics=null;if(tree.beforeAttack?.(ctx))return;
 if(!e.charge){e.charge=true;e.focusTarget=p.id||'player';e.windup=tree.windup||1;e.aim={x:p.x,y:p.y};enemyCallout(g,e,'telegraph',{action:tree.fixedTile?'aim':'attack'});return;}
 e.windup=(e.windup||1)-1;if(e.windup>0)return;
 if(tree.attack)return tree.attack(ctx);fired=attack(ctx);e.charge=Boolean(def.rapid);e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
 }else{interruptEnemyIntent(e,'target_lost');move(ctx);if(e.moved)enemyCallout(g,e,'state',{state:e.tactics?.mode==='flank'?'flank':'move'});else if(e.tactics)enemyCallout(g,e,'state',{state:'hold'});}
 // An allied suicide bot's blast can kill the attacker mid-attack (3.94.0); a dead enemy takes no follow-up step.
 if(e.hp>0)tree.after?.(ctx);return fired;
}
export function enemyOpportunity(g,e){const x=e.x,y=e.y;if(e.hp>0&&e.alert&&!e.control?.disabled&&activeTrait(e,'fast'))revealEnemyAffix(g,e,'fast');const fired=g.executeEnemy(e);if(e.x!==x||e.y!==y)e.cornerExposure=null;e.moveDelta=e.moved?[e.x-x,e.y-y]:[0,0];if(fired)recordShot(e,e.focusTarget||'player',g.turn);else e.fireChain=null;}
