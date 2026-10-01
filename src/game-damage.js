// Hits and damage (3.206.3 split): cover, hitting and hurting any body, what an enemy drops, props and rigged cases,
// throwables and explosions, and damage to the player and allies.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {revealConcealed} from './concealed.js';   // 3.217.0 埋伏
import {sentence,t} from './i18n.js';
import {simulationDrops,simulationUpgrades} from './killhouse-policy.js';
import {isEnforcer,witnessDeath} from './rebels.js';
import {activeTrait,healActor,reduceDirectDamage} from './traits.js';
import {enemyKillXp} from './elite-enemies.js';
import {enemyDef,hasEnemyTag,isBossClass,isNoncombatant} from './enemy-data.js';
import {injuryCallout} from './callouts.js';
import {enemyDeath} from './enemy-behavior.js';
import {enemyArmor,isFlamer} from './enemy-affixes.js';
import {shotDamageAllowed} from './suppression.js';
import {followUpRound} from './pursuit.js';
import {petCombat,petDeath,petDefense,petHit,petRank,petReactions,petSurvives,syncPetSenses} from './pet-growth.js';
import {collapseNest} from './runtime-enemies.js';
import {objectSightGrid} from './scenery.js';
import {CLASS_PERK_TUNING,classPerkRank,markValues} from './class-perks.js';
import {bladeMultiplier,meleeDefense,meleeReward} from './melee-classes.js';
import {orderHit} from './orders.js';
import {LINE_ITEMS,goggleDrop,infraredDrop,lineDrop,lineReason} from './lines.js';
import {PREPARED_CATALOG} from './prepared.js';
import {toxicShot} from './swarm-fields.js';
import {FLAMETHROWER,flamerTank} from './fire.js';
import {markDamage} from './loyalist-bosses.js';
import {scanDamage} from './delisted-operatives.js';
import {ammoDropChance,plateDrop} from './perks.js';
import {allyName,occupied} from './allies.js';
import {salvageBlueprint,unitDestroyed} from './workshop.js';
import {breakLamp,isLamp} from './lighting.js';
import {bestCover,coverEffects} from './cover.js';
import {addTrace} from './traces.js';
import {missionTarget} from './missions.js';
import {RIG_TUNING,containerName,isRigged} from './containers.js';
import {BARRIER_TYPES,barrierName,edgeCover,isBarrier} from './barriers.js';
import {FRAG_DAMAGE,GRENADES,SMOKE_DURATION,applyDisruption,areaCells,squareCells} from './throwables.js';
import {dropKeycard} from './vault.js';
import {EXO_TUNING,breakExo,damageDecoy,detonateMine,exoAbsorb,noticeAttack,wearingExo} from './field-gear.js';
import {PROJECTILE_AMMO,ammoMultiplier} from './ammunition.js';
import {ENEMY_TYPES,RARE_ARMORY,SIZE,VOID,WEAPONS} from './data.js';
import {weaponUnlocked} from './progression.js';
import {DIRECTIONS,distance,key,lineOfSight} from './world.js';
import {wallCover} from './combat.js';
import {FLARE_TUNING,flareLights,flareReason} from './flares.js';
import {enemyName} from './game.js';
import {skillActive} from './skills.js';
import {radioHit} from './squad.js';
// 3.209.0 (user decisions 2026-09-30, docs/CORE_RULES.md 受到攻擊): an enemy hurt by your side learns where the attack came
// from, whether or not it can see you, and the enemies that see it hit go alert toward it. Kept per game and never saved
// (Game.serialize writes the game's own fields):
// - `origin`, `ours`: while a blast resolves, the tile it came from (its centre, or the shooter's tile when a gun's own
//   round bursts) and whether it is your side's even with no attacker (a converted core guard's bombardment);
// - `pending`: what the enemies learn, held until the step of whoever attacked is over (Game.settleAttackNotes; review of
//   3.209.0), so the rest of the same attack — the next rounds of a burst, the second body of a thrust — resolves against
//   the world as it was: no flashlight switched on and no ambush lost halfway through;
// - `firstHand`: the enemies that learned an origin themselves during this action; what a witness saw never replaces it.
const attackNotes=new WeakMap();
const notesOf=g=>{let n=attackNotes.get(g);if(!n)attackNotes.set(g,n={origin:null,ours:false,pending:[],firstHand:new Set()});return n;};
export const ATTACK_ORIGIN_TUNING=Object.freeze({witnessRadius:8});
export class GameDamage {
  // 3.209.0: attacks that tell an enemy where they came from are yours and your units' (pets, drones, summons, survivors),
  // a unit being anything with a `kind`, on the ally list or not: a munition or a primed bot leaves it before it goes off.
  // Only what the enemies learn reads this; kills, salvage and witnessed deaths keep reading `attacker` as before.
  ownSide(attacker){return Boolean(attacker)&&(attacker===this.player||Boolean(attacker.kind)&&!this.enemies.includes(attacker));}
  // docs/SKILLS.md 訊號斷層: while it runs, nothing you do moves what an enemy knows of you (it still goes alert).
  jammedBy(attacker){return attacker===this.player&&skillActive(this.player,'signal_break');}
  // Game.action starts every action with no first-hand knowledge on record (anything a direct call left is settled first).
  newAttackNotes(){this.settleAttackNotes();notesOf(this).firstHand.clear();}
  // Where the attack being resolved came from: a blast's own origin while it resolves, otherwise the attacker's tile.
  attackOrigin(attacker){const o=notesOf(this).origin||attacker;return {x:o.x,y:o.y};}
  // `e` learns first-hand that it is under attack from `origin`: alert, and lastKnown on that tile (not while jammed).
  // Held until the attacker's step is over; `radio`: a squad member hit also reports it (src/squad.js radioHit).
  learnAttack(e,origin,attacker,radio=false){notesOf(this).pending.push({learn:e,origin:{x:origin.x,y:origin.y},jammed:this.jammedBy(attacker),radio});}
  // Any damage your side deals (hurt): the victim learns the origin, unless a decoy still holds it (fooled enemies fight
  // your units and keep going for the decoy, docs/ITEMS.md). Every other combatant within 8 tiles that sees the victim hit
  // (as the hit lands) goes alert toward the victim's tile, unless it learns an origin itself this action or a decoy holds it.
  noticeHit(e,attacker){
    const {pending}=notesOf(this),jammed=this.jammedBy(attacker);
    if(!this.isFooled(e))this.learnAttack(e,this.attackOrigin(attacker),attacker,true);
    for(const o of this.enemies)if(o!==e&&o.hp>0&&!isNoncombatant(o)&&!this.isFooled(o)&&distance(o,e)<=ATTACK_ORIGIN_TUNING.witnessRadius&&this.sight(o,e))pending.push({witness:o,at:{x:e.x,y:e.y},jammed});
  }
  // Game.action calls it once the step of whoever attacked is over, and at the end of the round, so nothing is pending at
  // a save: first-hand knowledge first, then what the witnesses saw, where nobody learned first-hand this action.
  settleAttackNotes(){
    const n=notesOf(this);if(!n.pending.length)return;const list=n.pending;n.pending=[];
    for(const q of list)if(q.learn){q.learn.alert=true;if(q.jammed)continue;q.learn.lastKnown={...q.origin};n.firstHand.add(q.learn);if(q.radio)radioHit(this,q.learn,q.origin);}
    for(const q of list)if(q.witness&&q.witness.hp>0){q.witness.alert=true;if(!q.jammed&&!n.firstHand.has(q.witness))q.witness.lastKnown={...q.at};}
  }
  protectingCover(target,attacker) {
    if(activeTrait(target,'no_cover'))return null;
    const cover=bestCover([edgeCover(this.barriers,target,attacker),wallCover(this.grid,target,attacker),...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,target)===1)],target,attacker);
    return attacker?.kind==='pet'&&petRank(this.player,'turret')>=4&&coverEffects(cover,target,attacker).efficiency===.5?null:cover;
  }
  // pellets (3.141.0, the player's shotgun cone): the damage of each pellet that landed, raw their sum. Every factor
  // applies to each pellet in the same order as to a single hit, armour is taken from each, and cover cuts the weapon's
  // pelletCover instead of the usual reduction.
  hitTarget(target,raw,attacker,pierce=0,weapon=this.weapon,pellets=null) {
    const blade=attacker===this.player&&!weapon.unarmed;
    if(blade)raw=Math.round(raw*bladeMultiplier(attacker));
    if(attacker===this.player&&weapon.melee&&wearingExo(attacker))raw=Math.round(raw*EXO_TUNING.melee);   // 3.144.0 外骨骼
    if(isLamp(target)){breakLamp(this,target);return;}   // 3.187.0: any hit puts a wall lamp out
    if(this.props.includes(target)||isBarrier(target)){if(weapon.ammoType==='energy')addTrace(this,target,'scorch');this.damageProp(target,raw,attacker);return;}
    // 3.203.0: fire washes over cover (src/fire.js), and a flamer's armour is its own (enemyArmor).
    const cover=weapon.melee||weapon.flame?null:this.protectingCover(target,attacker),armor=enemyArmor(target);
    let parts=pellets?pellets.map(d=>blade?Math.round(d*bladeMultiplier(attacker)):d):[raw];const scale=f=>{parts=parts.map(d=>d*f);};
    if(attacker===this.player&&!weapon.melee&&!this.sight(target,attacker))scale(1+classPerkRank(attacker,'recon_unseen')*CLASS_PERK_TUNING.unseen);if(attacker===this.player&&activeTrait(target,'exposed'))scale(1+markValues(attacker).damage);
    // 3.142.0: the absorption line only when cover took something off; a fully piercing plasma shot goes straight through.
    if(cover){const effect=coverEffects(cover,target,attacker),cut=(pellets?weapon.pelletCover*effect.efficiency:effect.reduction)*(1-pierce);scale(1-cut);if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);if(cut>0)this.log(t('game.enemyCoverAbsorbs'));}
    if(toxicShot(this,attacker,target,attacker===this.player||!attacker?.type?weapon:this.actorWeapon(attacker)))scale(.5);   // 3.134.0 mist
    // 3.185.0 (plan C): a gun's round meets armor by its ammunition's curve (src/ammunition.js); blades and blasts subtract.
    const mult=weapon.melee||weapon.explosive?null:ammoMultiplier(weapon.ammoType,armor,pierce);
    let damage=parts.reduce((sum,d)=>sum+Math.max(1,Math.round(mult===null?d-armor*(1-pierce):d*mult)),0);
    if(weapon.ammoType==='energy'&&activeTrait(target,'mechanical'))damage=Math.round(damage*1.2);
    if(weapon.ammoType==='energy')addTrace(this,target,'scorch');
    const before=target.hp;this.hurt(target,reduceDirectDamage(target,damage),attacker);
    if(before>0&&target.hp<=0&&attacker?.kind==='pet')healActor(this.player,classPerkRank(this.player,'druid_symbiosis')*CLASS_PERK_TUNING.symbiosisHeal);
    petHit(this,attacker,target,Math.max(0,before-Math.max(0,target.hp)),weapon);
    if(attacker===this.player&&weapon.melee&&!weapon.unarmed)meleeReward(this,target,before);
  }
  // cause (3.142.1): damage nobody dealt (a hazard underfoot) says what it was instead of 命中, which reads as a shot.
  // 3.166.0: cause is the hazard id ('acid' or 'heat'); the sentence lives in the language table.
  hurt(e,damage,attacker=null,cause=null) {
    if(e.hp<=0||!shotDamageAllowed(this,e))return;
    if(e.concealed)revealConcealed(this,e);   // 3.217.0: any damage (a shot, a blast, burning floor) shows a hidden unit
    if(attacker===this.player)noticeAttack(this,e,this.attackOrigin(attacker));
    if(damage>0&&(this.ownSide(attacker)||notesOf(this).ours)&&this.enemies.includes(e))this.noticeHit(e,attacker);   // 3.209.0
    // 3.205.0: a swarm boss's bite or charge on one of its own (src/swarm-bosses.js, 敵我不分) is not yours: not in your
    // damage count (review), not your kill, xp or scrap (below), and the log says who did it.
    // 3.206.0: nor any enemy boss's (a rebel boss's fire burns whoever stands in it, src/rebel-bosses.js).
    // 3.213.0 (docs/CHECKLIST.md 2, 打到自己人): nor any other enemy's — an enemy flamer's spray (src/fire.js burnUnits) used
    // to pay you the kill, xp and scrap; the enforcer's execution (its own line in src/rebels.js) used to count in your damage
    // and log as your hit. Blasts with no attacker (an enemy grenade, a bomber, a tank) are not covered yet.
    const ownKind=Boolean(attacker&&attacker!==e&&this.enemies.includes(attacker));
    const beforeHp=e.hp;e.hp-=damage;injuryCallout(this,e,beforeHp);if(damage>0)orderHit(this,e);if(!ownKind)this.player.stats.damage+=damage;if(damage>0)addTrace(this,e,activeTrait(e,'mechanical')?'oil':'blood');
    this.effects.push({type:'impact',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},damage,mechanical:ENEMY_TYPES[e.type]?.mechanical});
    // 3.202.0: a hazard's damage is logged only for an enemy you can see; the floor does not report on the ones you cannot.
    if(cause){if(this.teamVisible(e))this.log(t(`game.stepped.${cause}`,{target:enemyName(e),damage}),false,t(`game.stepped.${cause}Real`,{target:enemyName(e)}));}else if(ownKind)this.log(t('swarmBosses.hitOwn',{enemy:enemyName(attacker),target:enemyName(e),damage}),false,t('swarmBosses.hitOwnReal',{enemy:enemyName(attacker),target:enemyName(e)}));else this.log(t('game.hit',{target:enemyName(e),damage}),false,t('game.hitReal',{target:enemyName(e)}));
    if(e.hp>0)return;
    if(isNoncombatant(e)){this.log(t('game.civilianDown',{target:enemyName(e)}));enemyDeath(this,e);return;}
    // 3.208.0 (src/pursuit.js): only a kill on the first round of the attack earns it.
    if(e.expendable&&attacker===this.player&&!this.shadowSteps&&!this.shadowBonus&&!followUpRound(this))this.pursuitPending=true;
    // 3.127.0: an enforcer's execution is not the player's kill, and a conscript pays out nothing.
    // 3.205.0: nor is a swarm boss's bite or charge on one of its own (`ownKind` above): no kill, xp or scrap.
    const executed=isEnforcer(attacker)||ownKind;
    if(!executed)this.player.kills++;if(!e.expendable&&!executed&&simulationUpgrades(this))this.player.xp+=enemyKillXp(e);
    if(!e.expendable&&!e.conscript&&!executed&&simulationDrops(this))this.player.scrap+=Math.round((isBossClass(e)?35:3)*(1+this.player.scavenger*.5))+classPerkRank(this.player,'engineer_salvage')*CLASS_PERK_TUNING.salvage;
    this.log(t('game.killed',{target:enemyName(e)}));if(missionTarget(this,e))this.log(sentence(this.missionSummary));salvageBlueprint(this,e,attacker);
    // The number stops at MAX_LEVEL (3.52.0, user call). Past it the threshold stays at the level-20 cost and each
    // one hands over supplies instead of a pick, so the HUD can simply read MAX.
    this.settleLevels();
    enemyDeath(this,e);dropKeycard(this,e);   // 3.146.0
    const tank=flamerTank(this,e);   // 3.203.0: a fallen flamer's tank goes up (30%) or it leaves its flamethrower below
    // A comrade gunned down in sight breaks the rebels who saw it; executions and self-destruction never do.
    if(attacker&&!this.enemies.includes(attacker))witnessDeath(this,e);
    if(isBossClass(e))this.awardProtocol(e.type,`${this.floor}:${e.id}`);
    if(e.reinforcement||e.expendable||e.conscript||!simulationDrops(this))return; // Retreat waves add pressure, not replacement supplies.
    const loot=enemyDef(e)?.loot;
    // 3.203.0: a flamer carries no gun of its card's; its flamethrower drops whenever the tank did not go up.
    if(isFlamer(e)){if(!tank)this.dropEnemyWeapon(e,FLAMETHROWER);}
    else if(loot?.weapon!==undefined&&weaponUnlocked(WEAPONS[loot.weapon],this.unlockedWeapons)&&this.rng()<(loot.chance||0))this.dropEnemyWeapon(e,loot.weapon);
    if(this.floor>=RARE_ARMORY.minFloor&&loot?.rareWeapon!==undefined&&this.rng()<loot.rareChance)this.dropEnemyWeapon(e,loot.rareWeapon);
    if(this.rng()<ammoDropChance(this.player)){const type=loot?.ammo||'ammo';this.items.push({...this.enemyDropPoint(e),type,amount:type==='energy'?9:type==='ordnance'?2:type==='pistol'?36:type==='shell'?8:30});}
    if(this.rng()<.06)this.items.push({...this.enemyDropPoint(e),type:'med'});
    const plate=plateDrop(this.player,enemyArmor(e)>0);
    if(plate.chance>0&&this.rng()<plate.chance)this.items.push({...this.enemyDropPoint(e),type:'armor',amount:plate.amount});
    // 3.135.0 (user decisions): lines from any armed enemy and goggles from snipers, on fixed rolls of their own.
    const line=hasEnemyTag(e,'armed')?lineDrop(this.seed,this.floor,e.id):null;if(line)this.items.push({...this.enemyDropPoint(e),...line});
    if(enemyDef(e)?.dropsGoggles&&goggleDrop(this.seed,this.floor,e.id))this.items.push({...this.enemyDropPoint(e),type:'nvg'});
    // 3.148.0: infrared goggles from squad leaders, the same kind of fixed roll.
    if(enemyDef(e)?.dropsInfrared&&infraredDrop(this.seed,this.floor,e.id))this.items.push({...this.enemyDropPoint(e),type:'irg'});
  }
  enemyDropPoint(e){
    // 3.127.2: a flyer killed above a cover prop must not leave its loot on a tile the player can never step on.
    const here={x:e.x,y:e.y};if(this.passable(here.x,here.y)&&!this.items.some(i=>distance(i,here)===0))return here;
    const near=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(q=>this.passable(q.x,q.y)&&this.canCross(here,q)&&!occupied(this,q)&&!this.items.some(i=>distance(i,q)===0));if(near)return near;
    // 3.164.0: shot down over the middle of a pit, it drops on the nearest floor at the rim.
    if(this.grid[here.y]?.[here.x]===VOID){let best=null;for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const q={x,y};if(this.passable(x,y)&&!occupied(this,q)&&!this.items.some(i=>distance(i,q)===0)&&(!best||distance(here,q)<distance(here,best)))best=q;}if(best)return best;}
    return here;
  }
  dropEnemyWeapon(e,weapon){const item=this.registerWeapon({...this.enemyDropPoint(e),type:'weapon',weapon},true);this.items.push(item);this.log(t('game.lootDropped',{weapon:this.weaponAt(item.slot).name}));}
  damageProp(prop,damage,attacker=null) {
    if(prop.indestructible)return;
    if(prop.hp>0&&damage>0)addTrace(this,prop,'chip');
    if(isBarrier(prop)){
      if(prop.hp<=0||!BARRIER_TYPES[prop.type].destructible)return;prop.hp=Math.max(0,prop.hp-Math.ceil(damage));if(!prop.hp)addTrace(this,prop,'debris');
      this.effects.push({type:'impact',from:{x:prop.x,y:prop.y},to:{x:prop.x,y:prop.y},damage:Math.ceil(damage),mechanical:true});
      this.log(t(prop.hp?'game.barrierDamaged':'game.barrierDestroyed',{barrier:barrierName(prop),hp:prop.hp}),false,t(prop.hp?'game.barrierDamagedReal':'game.barrierDestroyed',{barrier:barrierName(prop)}));this.reveal();return;
    }
    if(prop.hp<=0)return;
    prop.hp-=damage;
    if(prop.hp>0)return;
    if(prop.type==='nest'){collapseNest(this,prop);return;}
    addTrace(this,prop,'debris');
    if(isRigged(prop)){this.detonateCase(prop,attacker);return;}
    this.log(prop.type==='barrel'?t('game.barrelExploded'):prop.type==='nest'?t('game.nestDestroyed'):t('game.coverDestroyed'));
    if(prop.type==='barrel')this.explode(prop,2,45,attacker);
    if(prop.style)this.reveal();
  }
  // A rigged case goes off where it stands, with a player frag's numbers; whatever was inside is destroyed either way,
  // so shooting it from range costs the supplies but not your health (3.100.0, user request).
  detonateCase(c,attacker=null){
    const lost=c.contents.length;c.contents=[];c.opened=true;c.hp=0;
    this.log(t(lost?'game.rigLost':'game.rig',{container:containerName(c)}));
    this.explode(c,RIG_TUNING.radius,FRAG_DAMAGE,attacker);
    return true;
  }
  // 3.123.0: see src/flares.js. The light is judged live from the flare's tile, so only the tile and its end are kept.
  throwFlare(pos){
    const reason=flareReason(this,pos);if(reason)return this.fail(sentence(reason));
    const p=this.player;p.flares--;p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
    this.effects.push({type:'shot',style:'grenade',color:'#ffd27a',from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    this.flares=[...(this.flares||[]),{x:pos.x,y:pos.y,expires:this.turn+FLARE_TUNING.duration-1}].slice(-FLARE_TUNING.maxActive);
    this.log(`${t('game.flareLit',{duration:FLARE_TUNING.duration})}`);return true;
  }
  // 3.135.0 grapple lines (src/lines.js): one straight pull to the chosen tile, then whatever lies there is picked up.
  fireLine(arg){
    const reason=lineReason(this,arg);if(reason)return this.fail(sentence(reason));
    const p=this.player,item=LINE_ITEMS[arg.item],from={x:p.x,y:p.y},to={x:arg.x,y:arg.y};
    p[item.resource]--;Object.assign(p,to);p.moved=true;p.moveDelta=[Math.sign(to.x-from.x),Math.sign(to.y-from.y)];p.facing=[...p.moveDelta];
    p.cornerExposure=null;p.fireChain=null;p.guard=false;p.focus=false;p.evasive=false;
    this.effects.push({type:'tonguePull',sourceId:'player',from,to:{...to},origin:{...to},damage:0});
    this.log(t('game.linePull',{item:PREPARED_CATALOG.item[arg.item].name}));this.pickup();this.reveal();return true;
  }
  // 3.210.0 (docs/BULWARK.md 改版): fire, steam and acid floor damage, after hazmat. The bulwark's plates (plate_life) take it
  // first and only the rest reaches the body; everyone else takes it all. Returns both parts for the log.
  floorDamage(damage){const p=this.player,plates=activeTrait(p,'plate_life')?Math.min(p.plates||0,damage):0;if(plates)p.plates-=plates;p.hp-=damage-plates;return {damage:damage-plates,plates};}
  flareLit(point){return Boolean(this.flares?.length)&&this.flares.some(flare=>flareLights(this,flare,point));}
  throwGrenade(pos) {
    const p=this.player,id=pos?.grenade??p.prepared.grenade,def=GRENADES[id];
    if(!def||p[def.resource]<=0)return this.fail(t('game.throwablesOut'),'empty',{item:def?.name||t('game.throwableName')});
    if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||this.grid[pos.y]?.[pos.x]!==1)return this.fail(t('game.throwPickSpot'));
    if(distance(p,pos)>5||!this.visible(pos))return this.fail(t('game.throwRange'));
    p[def.resource]--;p.stats.grenades++;this.log(t('game.throw',{grenade:def.name}));
    this.effects.push({type:'shot',style:'grenade',color:def.color,from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    this.applyThrowable(id,pos,Math.round((FRAG_DAMAGE+p.blastBonus)*bladeMultiplier(p)),p);
    return true;
  }
  // 3.188.0 (user): a grenadier's stun grenade. No damage; everything living its 3×3 reaches is disabled, enemies and
  // allies too. If you waited this round (braced), you are disabled half as long; the log says so only afterwards.
  enemyStun(m){
    // Read before the disable, which drops your guard.
    const p=this.player,def=GRENADES.stun,reached=new Set(squareCells(this,m).map(key)),braced=p.guard;
    this.effects.push({type:'pulse',radius:1,color:def.color,from:{x:m.x,y:m.y},to:{x:m.x,y:m.y}});
    for(const actor of [p,...this.enemies,...this.activeAllies])if(actor.hp>0&&reached.has(key(actor))&&applyDisruption(actor,def.keyword)){
      if(actor===p&&braced){p.control.disabled=Math.ceil(p.control.disabled/2);this.log(t('game.stunBraced',{n:p.control.disabled}),true,t('game.disabledYouReal'));continue;}
      if(actor!==p)actor.alert=true;
      if(actor.concealed)revealConcealed(this,actor,{call:false});   // 3.217.0: stunned, it shows
      const name=actor===p?null:actor.kind?allyName(actor):enemyName(actor),n=actor.control.disabled;
      this.log(name===null?t('game.disabledYou',{n}):t('game.disabled',{name,n}),actor===p,name===null?t('game.disabledYouReal'):t('game.disabledReal',{name}));
    }
    this.reveal();
  }
  // Resolves a throwable at pos: thrown grenades and, since 3.92.0, loitering munitions (docs/ENGINEER.md 4.1).
  applyThrowable(id,pos,fragDamage,attacker){
    const p=this.player,def=GRENADES[id];
    if(id==='frag')this.explode(pos,2,fragDamage,attacker);
    else {
      // 3.164.0: sight crosses a pit, so the area can reach over one; the grenade still disrupts a flyer there, but its smoke
      // lies only on the floor.
      const cells=areaCells(this.grid,pos,2,this.barriers,this),affected=new Set(cells.map(key)),floorCells=cells.filter(q=>this.grid[q.y]?.[q.x]===1);
      this.effects.push({type:'pulse',radius:2,color:def.color,from:{x:pos.x,y:pos.y},to:{x:pos.x,y:pos.y}});
      if(id==='smoke'){this.smoke=[...this.smoke,{cells:floorCells,expires:this.turn+SMOKE_DURATION-1}];this.log(t('game.smokeDeployed'));}
      // 3.177.9: close throw (the ninja) is not caught by its own stun grenade or EMP.
      else for(const actor of [p,...this.enemies,...this.activeAllies])if(affected.has(key(actor))&&!(actor===attacker&&activeTrait(actor,'close_throw'))&&applyDisruption(actor,def.keyword)){
        if(actor!==p)actor.alert=true;
        if(actor.concealed)revealConcealed(this,actor,{call:false});   // 3.217.0: stunned or jammed, it shows
        // 3.209.0 (user 2026-09-30): stunned or jammed by yours, an enemy knows where the grenade came down (the blast's centre).
        // A decoy still holds the one it fooled (as for a hit, Game.noticeHit).
        if(this.enemies.includes(actor)&&this.ownSide(attacker)&&!this.isFooled(actor))this.learnAttack(actor,pos,attacker);
        const name=actor===p?null:actor.kind?allyName(actor):enemyName(actor),n=actor.control.disabled;
        this.log(name===null?t('game.disabledYou',{n}):t('game.disabled',{name,n}),actor===p,name===null?t('game.disabledYouReal'):t('game.disabledReal',{name}));
      }
      this.reveal();
    }
  }
  // 3.209.0: whoever the blast hurts learns it came from its centre, or from `from`, the shooter's tile, when a gun's own
  // round bursts (the launcher, the burst grenade rifle, a plasma burst, a unit's explosive gun). A blast it sets off (a
  // barrel, a rigged case, a mine) has its own centre and is your side's when this one is. `ours`: your side's with no
  // attacker (a converted core guard's bombardment); the attacker, and so kills and salvage, stay as they were.
  explode(center,radius,damage,attacker=null,eligible=null,{from=null,ours=false}={}) {
    const origin={x:center.x,y:center.y},notes=notesOf(this),outer={origin:notes.origin,ours:notes.ours};
    notes.origin=from?{x:from.x,y:from.y}:{...origin};notes.ours=ours||outer.ours;
    try{
    this.effects.push({type:'blast',from:origin,to:origin,damage:0,radius});
    const affected=p=>distance(origin,p)<=radius&&lineOfSight(objectSightGrid(this,origin,p),origin,p,this.barriers,'blast');
    // Freeze shielding for this blast before destroying any of its barriers.
    for(const cell of areaCells(this.grid,origin,radius,this.barriers,this))addTrace(this,cell,'scorch');
    const hitProps=this.props.filter(o=>o.hp>0&&affected(o)),hitEnemies=this.enemies.filter(e=>e.hp>0&&affected(e)&&(!eligible||eligible.includes(e))),hitPlayer=affected(this.player),hitAllies=this.activeAllies.filter(affected);
    const hitEdges=this.barriers.filter(b=>b.hp>0&&distance(origin,b)<=radius&&lineOfSight(objectSightGrid(this,origin,b),origin,b,this.barriers.filter(e=>e!==b),'blast'));
    for(const b of hitEdges)this.damageProp(b,damage,attacker);
    // Mark barrels as destroyed before recursion, so chain reactions terminate.
    for(const prop of hitProps)this.damageProp(prop,damage,attacker);
    for(const lamp of this.lamps||[])if(lamp.hp>0&&affected(lamp))breakLamp(this,lamp);   // 3.187.0
    for(const e of hitEnemies)this.hurt(e,reduceDirectDamage(e,Math.max(1,damage-distance(origin,e)*10)),attacker);
    for(const a of hitAllies)this.damageAlly(a,Math.max(1,damage-distance(origin,a)*10),null,true);
    if(hitPlayer)this.damagePlayer(Math.max(1,damage-distance(origin,this.player)*10),t('game.blastSource'),null,true);
    // 3.144.0: a blast damages the decoy and sets off every mine it reaches (each is removed before it goes off).
    if(this.decoy&&affected(this.decoy))damageDecoy(this,Math.max(1,damage-distance(origin,this.decoy)*10));
    for(const m of (this.mines||[]).filter(affected))detonateMine(this,m);
    }finally{notes.origin=outer.origin;notes.ours=outer.ours;}
  }
  // `projectile` (3.207.0): the blow's own, when it is not the card's (a delisted ninja's knife on a card with an SMG).
  damagePlayer(raw,label,attacker=null,blast=false,projectile=undefined) {
    const p=this.player,cover=!blast&&attacker?this.protectingCover(p,attacker):null;
    let damage=blast?raw:raw*markDamage(this,attacker)*scanDamage(this,attacker,p);   // 3.204.0: +20% from any enemy while a boss's mark is on you; 3.207.0: +10% from a delisted soldier that scanned you
    if(cover){damage*=1-coverEffects(cover,p,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);}
    if(!blast&&attacker&&toxicShot(this,attacker,p,this.actorWeapon(attacker)))damage*=.5;   // 3.134.0 mist
    // 3.185.0 (plan C): an enemy's gun meets your armor by its ammunition's curve too; claws, blades and blasts subtract.
    const ammo=attacker&&!blast?PROJECTILE_AMMO[projectile??ENEMY_TYPES[attacker.type]?.projectile]:null,mult=ammo?ammoMultiplier(ammo,p.armor):null;
    damage=reduceDirectDamage(p,meleeDefense(p,Math.max(1,Math.round(mult===null?damage-p.armor:damage*mult))));if(p.guard)damage=Math.max(1,Math.ceil(damage*.5));
    // 3.144.0: a worn exoskeleton's plates take their share of the hit (half of it) before your own plates do.
    // 3.210.0 (docs/BULWARK.md 改版): the bulwark's plates (plate_life) take all of what is left, not half.
    const half=Math.floor(damage/2),frame=exoAbsorb(this,half),absorbed=Math.min(p.plates||0,(activeTrait(p,'plate_life')?damage:half)-frame);p.plates=(p.plates||0)-absorbed;damage-=frame+absorbed;
    p.hp-=damage;if(damage>0)addTrace(this,p,activeTrait(p,'mechanical')?'oil':'blood');const coverNote=cover?t('game.noteCover'):'';
    const notes=coverNote+(frame?t('game.noteExo',{n:frame}):'')+(absorbed?t('game.notePlates',{n:absorbed}):''),real=t('game.playerHurtReal',{source:label,notes:coverNote+(frame||absorbed?t('game.noteArmor'):'')});
    // 3.210.0: a hit the plates took whole says so, instead of 「生命 −0」.
    this.log(damage>0||!absorbed?t('game.playerHurt',{source:label,notes,damage}):t('game.playerHurtPlates',{source:label,notes:coverNote+(frame?t('game.noteExo',{n:frame}):''),n:absorbed}),true,real);
    if(frame&&p.exoPlates<=0)breakExo(this);
    if(attacker&&ENEMY_TYPES[attacker.type]?.mechanical&&ENEMY_TYPES[attacker.type].range>1)addTrace(this,p,'scorch');
    // plates (3.210.0): what the plates took, shown when nothing reached the body (src/renderer-effects.js).
    if(attacker)this.effects.push({type:'enemyShot',attackerType:attacker.type,style:enemyDef(attacker)?.attackStyle||(ENEMY_TYPES[attacker.type]?.mechanical?'plasma':'bullet'),from:{x:attacker.x,y:attacker.y},to:{x:p.x,y:p.y},damage,...(absorbed?{plates:absorbed}:{})});
    else this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage,player:true,...(absorbed?{plates:absorbed}:{})});   // player: the screen shake (3.147.0)
    petReactions(this);syncPetSenses(this);
  }
  damageAlly(a,raw,attacker=null,blast=false,environment=false){
    if(a.hp<=0||a.status!=='active')return;const cover=!blast&&attacker?this.protectingCover(a,attacker):null;let damage=blast?raw:raw*scanDamage(this,attacker,a);   // 3.207.0: a delisted soldier's scan
    if(cover){damage*=1-coverEffects(cover,a,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);}
    if(!blast&&attacker&&toxicShot(this,attacker,a,this.actorWeapon(attacker)))damage*=.5;   // 3.134.0 mist
    if(!environment)petCombat(this,a);damage=reduceDirectDamage(a,Math.max(1,Math.round(damage-a.armor)));
    if(!environment)damage=petDefense(this,a,damage);a.hp=Math.max(0,a.hp-damage);
    addTrace(this,a,activeTrait(a,'mechanical')?'oil':'blood');this.effects.push({type:'impact',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},damage});this.log(t('game.allyHurt',{ally:allyName(a),damage}),true,t('game.allyHurtReal',{ally:allyName(a)}));
    if(!a.hp&&a.kind==='pet'){if(!petSurvives(this,a))petDeath(this,a);petReactions(this);this.reveal();return;}
    petReactions(this);
    if(!a.hp){a.status='destroyed';a.order=null;this.log(t('game.allyDestroyed',{ally:allyName(a)}),true);unitDestroyed(this,a);this.reveal();}
  }
}
