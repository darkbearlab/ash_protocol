// The player's turn (3.206.3 split): what an action costs, whether it is allowed (validateAction and the reasons
// the controller shows before it tries), `action` — the one entry point of every turn — and the player's own action.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {sentence,t} from './i18n.js';
import {blindFire,blindReason} from './blind-fire.js';
import {isSimulation} from './killhouse-policy.js';
import {tickSwarmWaves} from './swarm-waves.js';
import {isSurvival,tickSurvival} from './survival.js';
import {rebelMorale,tickAlarms} from './rebels.js';
import {clearPoison} from './poison.js';
import {activeTrait,grantTrait,healActor,initiativeQueue,tickTraits} from './traits.js';
import {tickCivilianCooldowns} from './civilians.js';
import {playerCallout} from './callouts.js';
import {tickSpecials} from './enemy-intents.js';
import {pinned,tickSuppression} from './suppression.js';
import {scaleEnemy} from './endless.js';
import {suppressiveFire,suppressiveReason} from './suppressive-fire.js';
import {learningReason,useLearning} from './learning.js';
import {feedPet,outputChoiceReason,petFeedQuote,petReactions,tickPetBond} from './pet-growth.js';
import {expireExposure} from './corner.js';
import {UNARMED_SLOT} from './unarmed.js';
import {tickNests} from './runtime-enemies.js';
import {classPerkRank,markValues} from './class-perks.js';
import {grapplePlan,tickSpirit,useGrapple} from './melee-classes.js';
import {LINE_ITEMS,lineReason} from './lines.js';
import {attackSpeed} from './melee-weapons.js';
import {PREPARED_CATALOG,canPrepare,isWearable,prepareCost,preparedEntry,weaponSwitchTurns,wornEntry} from './prepared.js';
import {inToxic,toxicAllyTurn} from './swarm-fields.js';
import {tickVents} from './vents.js';
import {tickFires} from './fire.js';
import {ALLY_SKILLS,allyAct,canAllySkill,commandPet,petSkillReason,swapReason,swapWithPlayer,tickSummons,useAllySkill} from './allies.js';
import {bomberAct,buildReason,buildUnit,deployReason,deployUnit,isBomber,isMunition,munitionAct,repairReason,repairUnit,workshopPoint} from './workshop.js';
import {resolveRetreatWave} from './retreat.js';
import {SKILLS,canUseSkill,skillActive,skillValues,tickSkills,toggleAnchor} from './skills.js';
import {recordGunFlashes} from './lighting.js';
import {BARRIER_LIMIT,barrierBetween,barrierFace,barrierName,edgeBlocks,isBarrier,makeBarrier,vaultable} from './barriers.js';
import {skipDisabled} from './throwables.js';
import {lockedReason,unlockVault} from './vault.js';
import {checkMines,decoyReason,exoReason,glowstickReason,mineReason,placeMine,throwDecoy,throwGlowstick,tickDecoy} from './field-gear.js';
import {presentStep} from './presentation.js';
import {distance} from './world.js';
import {terminalReason} from './terminal.js';
import {flareReason} from './flares.js';
import {SPRAY_PLATES,SURGE_COST,SURGE_STEPS} from './game.js';
// 3.109.0 (user request): carried cover goes on the edge between you and the side you pick, so any of the four
// sides is one action — no turning — and because a low partition can be vaulted it can never seal a corridor.
// 3.111.0 (user request): a point-target launcher is aimed like a thrown grenade — at a floor tile, not at an enemy's
// body — and always detonates where it lands. There is deliberately no minimum range (user: hitting yourself is on you).
export function launchReason(g,pos){
 const p=g.player,w=g.weapon;
 if(!w.pointTarget)return t('game.launchNoGround');
 if(p.ammo[p.weapon]<=0)return t(w.tank?'game.tankEmpty':'game.launchEmpty');   // 3.203.0: a flamethrower's tank is never refilled
 if(w.flame&&pos&&pos.x===p.x&&pos.y===p.y)return t('game.flameOwnTile');   // 3.203.0 review: a spray needs a direction
 if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||g.grid[pos.y]?.[pos.x]!==1)return t('game.launchPickFloor');
 if(distance(p,pos)>w.range||!g.visible(pos))return t('common.landingRange',{range:w.range});
 return '';
}
export const DEPLOY_COVER='low_partition';
export function deployCoverReason(g,arg){
 const p=g.player;
 if(!p.barricades)return t('game.noBarricade');
 if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return t('game.pickDirection');
 const spot={x:p.x+arg[0],y:p.y+arg[1]};
 if(g.grid[spot.y]?.[spot.x]!==1)return t('game.sideNotFloor');
 const edge=barrierBetween(g.barriers,p,spot);
 if(edge&&edge.hp>0)return t('game.sideTaken',{barrier:barrierName(edge)});
 if(!edge&&g.barriers.length>=BARRIER_LIMIT)return t('game.tooManyBarriers');
 return '';
}
const ITEM_BY_ACTION=Object.fromEntries(Object.entries(PREPARED_CATALOG.item).map(([id,entry])=>[entry.action,id]));
// 3.107.0 (user request): consumables are usable straight from the pack, so the pack has to know why a button is
// dead before the modal closes. One helper answers both it and validateAction, so the two can never disagree.
// An empty string means the item can be used right now.
// 3.163.0: which item refusals the operator says out loud (src/callout-ui.js PLAYER_LINES); the rest stay in the log.
// 3.166.0: compared with the table's own sentences, so the mapping holds in any language.
const itemRefusal=(reason,entry)=>reason===t('common.noItem',{item:entry.name})?['empty',{item:entry.name}]:reason===t('game.healNotNeeded')||reason===t('game.platesFull')?['not_needed']:reason===t('game.surgeFatal')?['fatal']:[];
export function itemUseReason(g,id){
 const p=g.player,entry=PREPARED_CATALOG.item[id];
 if(!entry?.action)return t('game.noSuchItem');
 if(!p[entry.resource])return t('common.noItem',{item:entry.name});
 if(entry.action==='heal')return p.hp<p.maxHp||p.poison>0?'':t('game.healNotNeeded');
 if(entry.action==='plate')return (p.plates||0)<g.plateCapacity?'':t('game.platesFull');
 if(entry.action==='surge')return p.control.disabled?t('game.disabledCannotUse'):g.shadowSteps?t('game.freeMovesLeft'):p.hp>SURGE_COST?'':t('game.surgeFatal');
 return '';
}
export class GameActions {

  // 3.136.0 (user decision): the melee weapon picked in the pack, else the first one in the pack, else bare hands. Before
  // 3.136.0 only weapons free to switch both ways counted, and every melee weapon was, so the fallback is the old rule.
  bumpMeleeSlot(){const p=this.player,picked=p.meleeSlot;if(Number.isInteger(picked)&&p.owned.includes(picked)&&this.weaponAt(picked).melee)return picked;return p.owned.find(slot=>this.weaponAt(slot).melee)??UNARMED_SLOT;}
  actionCost(type,arg){if(type==='skill'&&arg==='anchor'&&skillActive(this.player,'anchor')&&classPerkRank(this.player,'bulwark_anchor')===3)return 0;if(['commandPet','setPetOutput','learn','dismantleLearning','surge','meleeChoice','flashlight'].includes(type))return 0;if(type==='rope'&&LINE_ITEMS[arg?.item]?.free)return 0;
    if(type==='prepare')return prepareCost(this.player,arg);return type==='skill'?(SKILLS[arg]?.cost??1):type==='reload'&&activeTrait(this.player,'quick_reload')&&this.weapon.ammoType==='pistol'?0:type==='weapon'?weaponSwitchTurns(this.weaponAt(Number(arg)),this.weapon):1;}
  // Validate the intent before any actor acts: rejected input cannot scout fast enemies.
  validateAction(type,arg){
    const p=this.player,w=this.weapon;
    if(type==='learn'||type==='dismantleLearning'){const reason=learningReason(this,arg,type==='dismantleLearning');return !reason||this.fail(reason);}
    if(type==='meleeChoice')return arg===null||Number.isInteger(arg)&&p.owned.includes(arg)&&this.weaponAt(arg).melee||this.fail(t('game.meleeFromPack'));
    if(type==='suppressiveFire'){const reason=suppressiveReason(this,arg);return !reason||this.fail(reason);}
    if(type==='blindFire'){const reason=blindReason(this,arg);return !reason||this.fail(sentence(reason),reason===t('blind-fire.outOfRange')?'out_of_range':reason===t('blind-fire.magShort')?this.emptyCue():null);}
    if(type==='feedPet'){const q=petFeedQuote(this,arg);return q.allowed||this.fail(q.reason);}
    if(type==='setPetOutput')return !outputChoiceReason(this,arg)||this.fail(outputChoiceReason(this,arg));
    if(type==='buildUnit'){const reason=buildReason(this,arg?.blueprint,arg?.payload,arg?.weapon);return !reason||this.fail(reason);}
    if(type==='commandPet')return Boolean(p.prepared.skill==='pet_command'&&this.activeAllies.some(a=>a.kind==='pet')&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&this.seen[arg.y]?.[arg.x]&&this.passable(arg.x,arg.y)&&distance(p,arg)<=6);
    // Workshop (docs/ENGINEER.md): deploy a finished unit from a production line onto a free tile within two route steps.
    if(type==='deployUnit'){const reason=deployReason(this,arg?.line,workshopPoint(arg));return !reason||this.fail(reason);}
    if(type==='repairUnit'){const reason=repairReason(this,arg);return !reason||this.fail(reason);}
    if(type==='skill'&&arg==='workshop')return this.fail(t('game.workshopPanel'));
    if(type==='skill'&&arg==='suppressive_fire')return this.fail(t('game.suppressNeedsArea'));
    if(type==='skill'&&arg==='grapple'&&canUseSkill(p,arg)){const plan=grapplePlan(this);return !plan.reason||this.fail(plan.reason);}
    if(type==='skill')return (ALLY_SKILLS.includes(arg)?canAllySkill(this,arg):canUseSkill(p,arg))||this.fail((arg==='pet_command'&&p.prepared.skill===arg&&petSkillReason(this))||(arg==='raise_dead'&&p.prepared.skill===arg&&!p.control.disabled&&t('game.noSummons'))||t('game.skillUnavailable'));
    if(type==='prepare'&&arg?.id==='exo'&&exoReason(p))return this.fail(sentence(exoReason(p)));
    if(type==='prepare')return Boolean(arg&&canPrepare(p,arg.category,arg.id)&&p.prepared[arg.category]!==arg.id);
    // 3.107.0 (user request): consumables no longer need the prepared slot — the pack uses them in place. The
    // grenade slot stays, because there it also chooses which grenade is thrown.
    if(type==='grenade'&&!preparedEntry(p,'grenade'))return this.fail(t('game.readyGrenadeFirst'));
    if(type==='move'){
      if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
      const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
      const edge=barrierBetween(this.barriers,p,{x,y});
      // Bumping a partition points it out so it can be shot, but it never steals a live enemy lock (3.54.1).
      if(edgeBlocks(edge)&&!vaultable(edge)){if(edge.type==='door'){const locked=lockedReason(this,edge);return !locked||this.fail(sentence(locked),'locked');}
        if(this.enemies.some(e=>e.id===this.target&&e.hp>0))return this.fail(t('game.partitionBlocksTarget'),'blocked');
        this.target=edge.id;return this.fail(t('game.partitionBlocksFire'),'blocked');}
      if(!this.passable(x,y))return this.fail(t('game.wallAhead'),'blocked');
      const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
      if(pinned(p)&&!this.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))return this.fail(t('game.pinnedCannotMove'),'pinned');
      if(ally){if(skillActive(p,'anchor'))return this.fail(t('game.anchoredRelease'),'anchored');const reason=swapReason(this,ally);return !reason||this.fail(reason,'blocked');}
      // 3.180.0 (user): walking into an enemy you cannot see (the black) swings at it all the same, at a blind −40 (strike).
      const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(e){this.target=e.id;if(!edgeBlocks(edge)&&this.bumpMeleeSlot()!==undefined&&this.shotClear(p,e))return true;return this.fail(t('game.enemyBlocks'),'blocked');}return !skillActive(p,'anchor')||this.fail(t('game.anchoredRelease'),'anchored');
    }
    if(type==='recoverObjective')return this.nearbyObjectives.some(t=>t.id===arg)||this.fail(t('game.noObjectiveNear'));
    if(type==='openContainer')return this.nearbyContainers.some(c=>c.id===arg)||this.fail(t('game.noContainerNear'));
    if(type==='door'){const b=arg&&typeof arg.open==='boolean'&&this.nearbyDoors.find(b=>b.id===arg.id&&b.open!==arg.open);if(!b)return false;const locked=arg.open&&lockedReason(this,b);return !locked||this.fail(sentence(locked),'locked');}
    if(type==='fire'){const e=this.targeted;if(!e)return this.fail(t('game.noTarget'),'no_target');if(distance(p,e)>w.range)return this.fail(t('game.targetOutOfRange'),'out_of_range');if(!this.shotClear(p,e)||(w.melee&&!w.thrust&&!isBarrier(e)&&!this.canCross(p,e)))return this.fail(this.attackStatus(p,e).reason==='target_corner_hidden'?t('game.targetBehindCorner'):t('game.lineBlocked'));return w.melee||p.ammo[p.weapon]>=(w.shotCost||1)||this.fail(p.ammo[p.weapon]>0?t('common.magShort',{n:w.shotCost}):t('game.magEmpty'),this.emptyCue());}
    if(type==='reload')return !w.melee&&(p.ammo[p.weapon]<w.mag&&p[this.reserveKey()]>0)||this.fail(t('game.magFullOrNoAmmo'),w.melee?'not_needed':p.ammo[p.weapon]>=w.mag?'chambered':'no_ammo');
    // Consumables (3.106.0). Adrenaline is free to use but may never be the thing that kills you; the reasons
    // live in itemUseReason so the pack can grey the same buttons this would refuse.
    if(type==='deployCover'){const reason=deployCoverReason(this,arg);return !reason||this.fail(sentence(reason));}
    if(type==='flare'){const reason=flareReason(this,arg);return !reason||this.fail(sentence(reason));}
    // 3.144.0 (src/field-gear.js): the decoy is thrown like a flare, the mine laid within three tiles.
    if(type==='decoy'){const reason=decoyReason(this,arg);return !reason||this.fail(sentence(reason));}
    if(type==='glowstick'){const reason=glowstickReason(this,arg);return !reason||this.fail(sentence(reason));}
    if(type==='mine'){const reason=mineReason(this,arg);return !reason||this.fail(sentence(reason));}
    if(type==='rope'){const reason=lineReason(this,arg);return !reason||this.fail(sentence(reason));}
    if(type==='launch'){const reason=launchReason(this,arg);return !reason||this.fail(sentence(reason),[t('game.launchEmpty'),t('game.tankEmpty')].includes(reason)?this.emptyCue():null);}
    if(ITEM_BY_ACTION[type]){const id=ITEM_BY_ACTION[type],reason=itemUseReason(this,id);return !reason||this.fail(sentence(reason),...itemRefusal(reason,PREPARED_CATALOG.item[id]));}
    if(type==='grenade')return (p[preparedEntry(p,'grenade').resource]>0&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&distance(p,arg)<=5&&this.grid[arg.y]?.[arg.x]===1&&this.visible(arg))||this.fail(t('game.throwNeedsTarget'));
    if(type==='weapon')return (p.owned.includes(Number(arg))&&Number(arg)!==p.weapon)||this.fail(t('game.cannotEquip'),Number(arg)===p.weapon?'not_needed':null);
    if(type==='salvage')return (p.owned.includes(Number(arg))&&p.owned.length>1&&!this.weaponAt(Number(arg)).locked)||this.fail(t('game.cannotSalvage'));
    if(type==='takeWeapon')return (Boolean(this.nearbyWeapon(Number(arg)))&&p.owned.length<this.weaponCapacity)||this.fail(t('game.weaponNotNearOrFull'));
    if(type==='salvageGround')return (Boolean(this.nearbyWeapon(Number(arg)))&&!this.weaponAt(Number(arg)).locked)||this.fail(t('game.weaponNotNearOrBound'));
    if(type==='replaceWeapon')return (Boolean(this.nearbyWeapon(arg?.take))&&p.owned.includes(arg?.leave)&&!this.weaponAt(arg.leave).locked)||this.fail(t('game.swapGone'));
    if(type==='upgrade')return this.fail(t('game.upgradeAtTerminal'));   // 3.120.0: bought at a terminal, for any weapon
    if(type==='terminal'){const reason=terminalReason(this,arg);return !reason||this.fail(reason);}
    if(type==='interact'&&pinned(p))return this.fail(t('game.pinnedNoElevator'),'pinned');
    if(type==='interact'&&skillActive(p,'anchor'))return this.fail(t('game.anchoredNoElevator'),'anchored');
    if(type==='interact')return (this.canTouch(this.exitPoint)&&!this.exitBlocked)||this.fail(this.exitBlocked||t('game.needElevator'));
    if(type==='flashlight')return arg===undefined;   // 3.178.0: a free switch, always allowed
    return type==='wait';
  }
  action(type,arg){
    this.refusal=null;
    if(type==='guard')type='wait';
    if(this.status!=='playing'||this.pendingPerks)return false;
    this.effects=[];this.newAttackNotes();const p=this.player;this.pursuitPending=false;this.pursuitBlocked=Boolean(this.shadowSteps||this.shadowBonus);if(p.control.disabled)this.pursuit=0;
    if(type==='usePrepared'){
      const entry=preparedEntry(p,arg?.category);if(!entry?.action)return this.fail(t('game.readySomething'));
      type=entry.action;arg=type==='skill'?p.prepared.skill:arg.target;
    }
    if(type==='weapon'&&arg===undefined)arg=p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length];
    if(type==='grenade'){const pos=arg||this.targeted;arg=pos?{x:pos.x,y:pos.y,grenade:p.prepared.grenade}:null;}
    if(type==='fire'&&this.weapon.pointTarget){const t=this.targeted,pos=arg||(isBarrier(t)?barrierFace(t,p):t);type='launch';arg=pos?{x:pos.x,y:pos.y}:null;}
    // 3.157.0 (user report): a bump into an enemy is an attack, not a free step. It falls through to the forfeit rule
    // below and pays the ordinary melee turn, as CLASS_PERKS.md 影步 says of any other action; an impossible bump keeps
    // the credit, like an invalid direction. Before this every bump was refused as「落點有單位」, so the ninja could not
    // strike again until the free moves were spent or thrown away.
    if(type==='move'&&this.shadowSteps>0){
      const foe=Array.isArray(arg)&&this.enemies.find(e=>e.hp>0&&e.x===p.x+arg[0]&&e.y===p.y+arg[1]);
      if(!foe)return p.control.disabled?this.fail(t('game.disabledNoShadow')):this.shadowMove(arg);
      if(!this.validateAction(type,arg))return false;
    }
    // Tapping adrenaline while free moves are still running would silently charge the health twice, so refuse before
    // the forfeit rule below takes them away (3.106.0).
    if(type==='surge'&&this.shadowSteps>0)return this.fail(t('game.freeMovesLeftStop'));
    if(this.shadowSteps>0){this.shadowSteps=0;this.pursuit=0;}
    if(!this.validateAction(type,arg))return false;
    if((p.control.disabled||p.recovery)&&type!=='prepare'&&type!=='meleeChoice'&&this.actionCost(type,arg)===0)return this.fail(p.recovery?t('game.chainsawRecovering'):t('game.disabledWait'));
    if(type==='move'){
      const point={x:p.x+arg[0],y:p.y+arg[1]},edge=barrierBetween(this.barriers,p,point);
      if(edgeBlocks(edge)&&edge.type==='door'){type='door';arg={id:edge.id,open:true};}
      else {const enemy=this.enemies.find(e=>e.hp>0&&e.x===point.x&&e.y===point.y),slot=this.bumpMeleeSlot();
        if(enemy&&slot!==undefined){type='bumpMelee';arg={id:enemy.id,x:enemy.x,y:enemy.y,slot};}}
    }
    if(type==='skill'&&arg==='suppressive_fire')return this.fail(t('game.suppressNeedsArea'));
    if(type==='skill'&&arg==='grapple'){type='grapple';arg={id:this.target};}
    // Free preparation/equipment commits outside the turn queue and preserves all timed state.
    if(this.actionCost(type,arg)===0){
      if(type==='prepare')this.setPrepared(arg.category,arg.id);
      else if(type==='weapon'){p.weapon=Number(arg);this.log(t('game.switchWeaponFree',{weapon:this.weapon.name}));}
      else if(type==='reload')return this.reload();
      else if(type==='skill')return this.activateSkill(arg);
      else if(type==='commandPet')return commandPet(this,arg);
      else if(type==='learn'||type==='dismantleLearning')return useLearning(this,arg,type==='dismantleLearning');
      else if(type==='surge')return this.surge();
      else if(type==='rope')return presentStep(this,()=>this.fireLine(arg));
      // 3.178.0: the flashlight is free to switch; enemies who can now see you notice at once (reveal).
      // 3.182.0 (user): switching on is instant; switching off lets it burn to the end of this round (src/lighting.js).
      else if(type==='flashlight'){p.lightLingers=p.flashlight;p.flashlight=!p.flashlight;this.log(t(p.flashlight?'game.flashlightOn':'game.flashlightOff'));this.reveal();return true;}
      else if(type==='setPetOutput'){p.petBond.outputChoice=arg.kind;return true;}
      else if(type==='meleeChoice'){p.meleeSlot=arg;this.log(arg===null?t('game.meleeChoiceDefault'):t('game.meleeChoice',{weapon:this.weaponAt(arg).name}));return true;}
      return true;
    }
    if(this.pursuit&&!p.recovery&&['fire','blindFire','launch','bumpMelee','grenade','grapple','suppressiveFire'].includes(type)){
      this.pursuit=0;const intent=type==='fire'?{id:this.target,x:this.targeted.x,y:this.targeted.y}:arg;
      const success=this.executePlayer(type,intent);p.guard=false;p.focus=false;p.evasive=false;p.moved=success&&type==='grapple'&&p.moved;
      this.settleAttackNotes();this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';}this.finishPursuit();return success;   // 3.209.0: what your attack taught
    }
    this.pursuit=0;
    const doubleAttack=skillActive(p,'anchor')&&['fire','blindFire','bumpMelee','suppressiveFire'].includes(type),previousChain=p.fireChain?{...p.fireChain}:null;
    const fireIntent=type==='fire'?{id:this.target,x:this.targeted.x,y:this.targeted.y}:null,floor=this.floor,queue=initiativeQueue(p,this.enemies,this.activeAllies),playerSpeed=queue.find(q=>q.actor===p).speed;
    if(doubleAttack){
      queue.find(q=>q.actor===p).speed=1;
      queue.push({actor:p,index:0,speed:0,anchorExtra:true});queue.sort((a,b)=>a.speed-b.speed||a.index-b.index);
    }
    // 3.136.0: claws strike in the fast phase and the chainsaw in the slow one (src/melee-weapons.js). A chainsaw that bit
    // last turn costs this one, read once so an anchored double attack cannot spend it in the turn it was earned.
    const phase=doubleAttack?null:attackSpeed(type==='bumpMelee'?this.weaponAt(arg.slot):type==='fire'&&this.weapon.melee?this.weapon:null);
    if(phase!==null){queue.find(q=>q.actor===p).speed=phase;queue.sort((a,b)=>a.speed-b.speed||a.index-b.index);}
    const recovering=p.recovery>0;if(recovering)p.recovery=0;
    let playerStunned=false;
    this.turn++;tickSpecials(this);tickVents(this);tickFires(this);   // vents: 3.202.0; burning floor: 3.203.0; the specials' cooldowns and drops: src/enemy-specials.js ORDER.tick (3.206.1)
    // 3.145.0 (user decision): suppression wears off (src/suppression.js decayedStacks) when the unit's own turn is over, player and
    // enemies alike, so the stacks it took since its last turn are all felt on this one. The `finally` runs on every skip
    // (`continue`) too: a stunned unit's turn has still passed. A unit with two slots (an anchored double attack) ticks
    // after the last.
    const lastSlot=new Map(queue.map(({actor},slot)=>[actor,slot]));
    for(const [slot,{actor,speed,anchorExtra=false}] of queue.entries()){
      if(p.hp<=0||this.status!=='playing'||this.floor!==floor)break;
      try{
      if(actor.hp<=0||actor.kind&&(actor.status!=='active'||actor.floor!==this.floor))continue;
      if(actor===p&&playerStunned)continue;
      actor.vaultExposed=false;delete actor.crashed;   // crashed: 3.205.0, a swarm boss's +20 lasts until its own next turn, as the vault's does
      if(actor===p&&recovering){playerStunned=true;p.fireChain=null;this.log(t('game.chainsawSkip'),true);continue;}
      if(skipDisabled(actor)){if(actor===p){playerStunned=true;this.log(t('game.disabledSkip'),true);}continue;}
      const immunityBefore=actor.control?.immune||0;
      if(actor===p){
        if(doubleAttack&&!anchorExtra&&type==='fire')p.fireChain=previousChain?{...previousChain}:null;
        if(type==='fire')this.target=fireIntent.id; // Track identity, never switch to another enemy.
        const ammoBefore=p.ammo[p.weapon],slotWeapon=p.weapon;
        const success=type==='move'?presentStep(this,()=>this.executePlayer(type,arg)):this.executePlayer(type,fireIntent||arg);
        // 3.163.0: the shot that empties the magazine warns before the next press would be refused.
        if(success&&p.weapon===slotWeapon&&this.weapon.ammoType&&!this.weapon.melee&&ammoBefore>0&&p.ammo[p.weapon]<=0)playerCallout(this,this.emptyCue());
        if(!success)this.log(t('game.situationChanged'));
        p.guard=success&&type==='wait';p.moved=success&&(type==='move'||type==='grapple'&&p.moved);p.focus=success&&type==='wait';p.evasive=success&&type==='wait';
        // 3.209.0 (src/game-damage.js settleAttackNotes): what your step taught the enemies, once it is over.
        this.settleAttackNotes();petReactions(this);this.reveal();checkMines(this);this.settleAttackNotes();
      }else if(actor.kind){const wasIn=inToxic(this,actor);presentStep(this,()=>{if(isMunition(actor))munitionAct(this,actor);else if(isBomber(actor))bomberAct(this,actor);else allyAct(this,actor);this.settleAttackNotes();this.reveal();},actor);toxicAllyTurn(this,actor,wasIn);}
      else if(actor.hp>0&&actor.alert)presentStep(this,()=>{this.enemyAct(actor);checkMines(this);this.settleAttackNotes();},speed!==0||playerSpeed!==0||phase!==null?actor:null);
      if(immunityBefore&&!anchorExtra)actor.control.immune=Math.max(0,actor.control.immune-1);
      }finally{if(lastSlot.get(actor)===slot)tickSuppression(actor);}
    }
    if(this.floor===floor&&this.status==='playing'&&p.hp>0){
      const due=this.marks.filter(m=>m.due<=this.turn);this.marks=this.marks.filter(m=>m.due>this.turn);
      for(const m of due){if(p.hp<=0)break;presentStep(this,()=>{if(m.stun)this.enemyStun(m);else this.explode(m,m.radius??1,m.damage??scaleEnemy(38,this.floor,'damage',this.difficultySpec),null,null,{ours:m.kind==='ally'});this.settleAttackNotes();});}   // ours: 3.209.0, a converted core guard's bombardment
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>resolveRetreatWave(this));
      if(p.hp>0)presentStep(this,()=>this.environmentTurn());
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>tickNests(this));
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>tickSwarmWaves(this));
      if(p.hp>0&&isSurvival(this))presentStep(this,()=>tickSurvival(this));   // 3.189.0
    }
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickPetBond(this))this.reveal();});
    // Summons rise before skills tick, so the interval counts the rising turn like the old cast did.
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickSummons(this))this.reveal();});
    tickSpirit(this);tickSkills(p);if(!skillActive(p,'early_warning'))this.sensorContacts=[];
    this.smoke=this.smoke.filter(s=>s.expires>this.turn);
    this.flares=(this.flares||[]).filter(f=>f.expires>this.turn);
    recordGunFlashes(this);   // 3.178.0: this round's muzzle flashes stay lit through the next (src/lighting.js)
    p.lightLingers=false;   // 3.182.0: a flashlight switched off this round goes dark now
    tickDecoy(this);
    expireExposure([p,...this.enemies,...this.allies],this.turn);
    for(const actor of [p,...this.enemies,...this.activeAllies])tickTraits(actor);
    // 3.127.0: rebels taunt their cowards before the player gets control, so the boosts show on the target cards.
    if(this.status==='playing'&&p.hp>0)rebelMorale(this);
    this.settleAttackNotes();this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';this.log(t('game.signalLost'),true);}
    // 3.127.2 (user decision): warnings count down after everything else in the turn, so one raised at any point of a
    // turn — during your move, the enemy phase or the closing look — comes back exactly five turns later, not four.
    tickCivilianCooldowns(this);tickAlarms(this);
    this.finishPursuit();return true;
  }
  finishPursuit(){
    if(this.pursuitPending&&!this.pursuitBlocked&&!this.shadowSteps&&!this.player.control.disabled&&!this.player.recovery&&this.player.hp>0&&this.status==='playing'){this.pursuit=1;this.log(t('game.pursuitReady'));}
    if(this.shadowSteps||this.player.control.disabled||this.player.recovery||this.player.hp<=0||this.status!=='playing')this.pursuit=0;
    this.pursuitPending=false;this.pursuitBlocked=false;
  }
  activateSkill(id){
    return presentStep(this,()=>{
      if(ALLY_SKILLS.includes(id))return useAllySkill(this,id);
      if(id==='anchor'){
        if(!toggleAnchor(this.player))return false;
        this.effects.push({type:'pulse',from:{x:this.player.x,y:this.player.y},to:{x:this.player.x,y:this.player.y},radius:.6,color:'#e6c281',damage:0});playerCallout(this,skillActive(this.player,'anchor')?'anchor_on':'anchor_off');
        this.log(skillActive(this.player,'anchor')?t('game.anchored'):t('game.anchorReleased'));return true;
      }
      const p=this.player,def=skillValues(p,id);p.skillState[id]={remaining:def.duration,cooldown:def.cooldownAfterEffect?0:def.cooldown};
      // 3.143.0 (user, 2026-09-19): the scan no longer alerts the enemies it finds or hands them your position.
      if(id==='early_warning'){this.sensorContacts=this.enemies.filter(e=>e.hp>0&&distance(p,e)<=def.radius).map(e=>{grantTrait(e,'exposed','skill:early_warning',markValues(p).duration);return {x:e.x,y:e.y};});this.log(t('game.warningContacts',{n:this.sensorContacts.length}),true);}
      this.effects.push({type:'pulse',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},radius:.6,color:'#8ae9da',damage:0,skill:id});   // skill: the signal interference (3.149.0)
      this.log(t('game.skillOn',{skill:def.name,turns:def.duration,cooldown:def.cooldown}));this.reveal();return true;
    });
  }
  executePlayer(type,arg){
    const p=this.player;
    let success=false;
    p.guard=false;p.moved=false;p.moveDelta=[0,0];if(type!=='fire')p.fireChain=null;
    switch(type) {
      // Only wearables reach here; a free prepare commits in action()'s zero-cost branch.
      case 'prepare': {
        const off=wornEntry(p),on=isWearable(arg.id)?PREPARED_CATALOG.item[arg.id]:null;
        this.setPrepared(arg.category,arg.id);
        this.log(on&&off?t('game.gearSwap',{off:off.name,on:on.name}):on?t('game.gearOn',{gear:on.name}):t('game.gearOff',{gear:off?.name||t('common.gear')}));
        success=true;break;
      }
      case 'feedPet': return presentStep(this,()=>feedPet(this,arg));
      case 'move': {
        if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
        if(pinned(p))return this.fail(t('game.pinnedCannotMove'),'pinned');
        if(skillActive(p,'anchor'))return this.fail(t('game.anchoredCannotMove'),'anchored');
        const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
        const edge=barrierBetween(this.barriers,p,{x,y});
        if(!this.canCross(p,{x,y})&&!vaultable(edge))return this.fail(t('game.obstacleBlocks'),'blocked');
        if(!this.passable(x,y))return this.fail(this.solid(x,y)?t('game.propBlocks'):t('game.wall'),'blocked');
        const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
        if(e){this.target=e.id;return this.fail(t('game.enemyBlocks'),'blocked');}
        // Re-check the swap at resolution; a faster enemy may have disabled the ally in the meantime.
        const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
        if(ally){if(swapReason(this,ally))return false;swapWithPlayer(this,ally);}
        p.vaultExposed=vaultable(edge);if(p.vaultExposed)this.log(t('game.vault'),true,t('game.vaultReal'));
        p.x=x;p.y=y;p.facing=[dx,dy];p.moveDelta=[dx,dy];this.pickup();success=true;break;
      }
      case 'buildUnit':success=presentStep(this,()=>buildUnit(this,arg.blueprint,arg.payload,arg.weapon));break;
      case 'skill':success=this.activateSkill(arg);break;
      case 'grapple':success=useGrapple(this,arg.id);break;
      case 'deployUnit':success=presentStep(this,()=>deployUnit(this,arg.line,workshopPoint(arg)));break;
      case 'repairUnit':success=presentStep(this,()=>repairUnit(this,arg));break;
      case 'recoverObjective':success=this.recoverObjective(arg);break;
      case 'openContainer':success=presentStep(this,()=>this.openContainer(arg));break;
      case 'door':success=presentStep(this,()=>{const b=this.nearbyDoors.find(b=>b.id===arg.id);if(b?.locked&&arg.open)unlockVault(this,b);return this.setDoor(b,arg.open);});break;
      case 'bumpMelee': this.target=arg.id;success=this.strike(arg,arg.slot);break;
      case 'fire': success=this.fire(arg);break;
      case 'blindFire': success=blindFire(this,arg);break;
      case 'suppressiveFire':success=suppressiveFire(this,arg);break;
      case 'reload': success=this.reload();break;
      case 'heal':
        if(p.meds<=0)return this.fail(t('game.medkitsOut'),'empty',{item:t('game.medkitName')});
        if(p.hp===p.maxHp&&p.poison===0)return this.fail(t('game.healthFull'),'not_needed');
        p.meds--;const recovered=healActor(p,45,p.healBonus);clearPoison(p);
        this.log(`${t('game.medkitUsed',{recovered})}`);success=true;break;
      case 'plate': {
        if(p.sprays<=0)return this.fail(t('game.sprayOut'),'empty',{item:t('game.sprayName')});
        const room=this.plateCapacity-(p.plates||0);
        if(room<=0)return this.fail(t('game.platesFullStop'),'not_needed');
        p.sprays--;const gained=Math.min(SPRAY_PLATES,room);p.plates=(p.plates||0)+gained;
        this.log(t('game.sprayUsed',{n:gained}));success=true;break;
      }
      case 'launch': success=presentStep(this,()=>this.launch(arg));break;
      case 'deployCover': {
        const reason=deployCoverReason(this,arg);
        if(reason)return this.fail(sentence(reason));
        const spot={x:p.x+arg[0],y:p.y+arg[1]},dead=barrierBetween(this.barriers,p,spot);
        const built=makeBarrier(DEPLOY_COVER,p,spot,dead?.id||`edge-deploy-${this.floor}-${spot.x}-${spot.y}-${p.x!==spot.x?'x':'y'}`);
        // Rebuilding over a wreck keeps its id and edge, so the barrier list can never grow a duplicate.
        if(dead)Object.assign(dead,built);else this.barriers.push(built);
        p.barricades--;p.facing=[arg[0],arg[1]];
        this.log(t('game.barricadeUp'));success=true;break;
      }
      case 'grenade': success=presentStep(this,()=>this.throwGrenade(arg||this.targeted));break;
      case 'flare': success=presentStep(this,()=>this.throwFlare(arg));break;
      case 'decoy': success=presentStep(this,()=>throwDecoy(this,arg));break;
      case 'glowstick': success=presentStep(this,()=>throwGlowstick(this,arg));break;
      case 'mine': success=presentStep(this,()=>placeMine(this,arg));break;
      case 'rope': success=presentStep(this,()=>this.fireLine(arg));break;
      case 'weapon': {
        const index=arg===undefined?p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length]:Number(arg);
        if(!p.owned.includes(index))return this.fail(t('game.weaponNotInPack'));
        if(index===p.weapon)return this.fail(t('game.alreadyEquipped'),'not_needed');
        p.weapon=index;this.log(t('game.switchWeapon',{weapon:this.weapon.name}));success=true;break;
      }
      case 'salvage':success=this.salvage(Number(arg));break;
      case 'takeWeapon':success=this.takeWeapon(Number(arg));break;
      case 'salvageGround':success=this.salvageGround(Number(arg));break;
      case 'replaceWeapon':success=this.replaceWeapon(arg);break;
      case 'terminal':success=this.useTerminal(arg);break;   // the method, so a simulation can refuse it
      case 'wait':this.log(t('game.guard'),false,t('game.guardReal'));success=true;break;
      case 'interact':success=this.descend(false);return success;
      default:return false;
    }
    return success;
  }
  // Adrenaline (3.106.0, user request): the ninja's free steps for everyone else, paid for in health. Movement only,
  // and any other action forfeits what is left — both rules come from 影步 and are what keep free actions honest.
  surge(){
    const p=this.player;
    if(p.adrenaline<=0)return this.fail(t('game.adrenalineOut'),'empty',{item:t('game.adrenalineName')});
    if(p.hp<=SURGE_COST)return this.fail(t('game.adrenalineFatal'),'fatal');
    p.adrenaline--;p.hp-=SURGE_COST;this.shadowSteps=SURGE_STEPS;this.pursuit=0;
    this.log(t('game.surge',{hp:SURGE_COST,steps:SURGE_STEPS}),true);
    return true;
  }
  reload(){
    if(this.weapon.melee)return this.fail(t('game.meleeNoReload'),'not_needed');
    if(this.weapon.tank)return this.fail(t('game.tankNoReload'),'not_needed');   // 3.203.0: 8 sprays a tank, never refilled
    const p=this.player,need=this.weapon.mag-p.ammo[p.weapon],reserve=this.reserveKey();
    if(need<=0)return this.fail(t('game.magFull'),'chambered');
    if(p[reserve]<=0)return this.fail(t('game.noReserve'),'no_ammo');
    const amount=Math.min(need,p[reserve]);p.ammo[p.weapon]+=amount;p[reserve]-=amount;
    this.log(t(this.actionCost('reload')===0?'game.reloadedFree':'game.reloaded',{n:amount}));
    if(p[reserve]<=0)playerCallout(this,'last_magazine');   // 3.163.0: the warning before 沒彈藥了
    return true;
  }
}
