import {t} from './i18n.js';
import {concealedSeen,knownEnemy} from './concealed.js';   // 3.217.0 埋伏
import {blindAim,silenced,forgetSeenAftermath} from './blind-fire.js';
import {initializeRunUnlocks} from './run-unlocks.js';
import {survivalAction,holdsPoint,pointBlocks} from './survival.js';
import './squad.js';   // load order only (3.206.3 split)
import {isEnforcer,soundAlarm} from './rebels.js';
import {scream} from './civilians.js';
import {pickFacilityFaction,factionDef,rollFacilityFaction} from './factions.js';
import {isBossClass,hasEnemyTag,isNoncombatant} from './enemy-data.js';
import {lockRealMode} from './real-mode.js';
import {enemyWeapon} from './enemy-behavior.js';
import {enemyCallout} from './enemy-intents.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {DIFFICULTY_TUNING,validDifficultyOffset,DEFAULT_CURVE,validCurve} from './endless.js';
import './suppressive-fire.js';   // load order only (3.206.3 split)
import './learning.js';   // load order only (3.206.3 split)
import {syncPetSenses,petScanContacts} from './pet-growth.js';
import {cornerRay,cornerStatus,recordExposure,clearMovedExposure} from './corner.js';
import {UNARMED_SLOT,UNARMED} from './unarmed.js';
import {SURE_BLADE,defensiveEvasion,grapplePlan,hookBladePlan} from './melee-classes.js';
import './lines.js';   // load order only (3.206.3 split)
import './melee-weapons.js';   // load order only (3.206.3 split)
import './prepared.js';   // load order only (3.206.3 split)
import {bossAccuracy} from './loyalist-bosses.js';
import {crashBonus} from './swarm-bosses.js';
import {burnFlank} from './rebel-bosses.js';
import {cloaked,outlined} from './delisted-operatives.js';
import {ensurePerks} from './perks.js';
import {currentAllies,localAllies,connected,allyWeapon,initializeAllies,carryCandidates} from './allies.js';
import './workshop.js';   // load order only (3.206.3 split)
import './retreat.js';   // load order only (3.206.3 split)
import {initialSkillState,skillActive} from './skills.js';
import {meleeChance} from './actor-stats.js';
import {hiddenInDark} from './lighting.js';
import {exitPoint,exitLabel,exitKind,deepestFloor,newMission,missionObjects,missionSummary,exitBlocked} from './missions.js';
import {isContainer} from './containers.js';
import {vaultable,isBarrier,barrierName,barrierBetween,blockedBetween,edgeBlocks,edgeAdjacent,edgeCells} from './barriers.js';
import {pickPortrait,validPortrait} from './portraits.js';
import {tacticalSight} from './throwables.js';
import {CHARACTERS,validCharacter,grantCharacterTraits,startingSupplies} from './characters.js';
import {lockedReason} from './vault.js';
import {decoyHides,knownMine} from './field-gear.js';
import {activeTrait} from './traits.js';
import {weaponStats} from './weapons.js';
import {carryLevels} from './ammunition.js';
import './purge-review.js';   // load order only (3.206.3 split)
import {SIZE,WEAPONS,ENEMY_TYPES,VOID} from './data.js';
import {newRunId} from './progression.js';
import {random,distance} from './world.js';
import {shotChance,adjacentWalls} from './combat.js';
import './terminal.js';   // load order only (3.206.3 split)
import {validDuty,DEFAULT_DUTY} from './duty.js';
// 3.206.3: the class is split by topic; each file holds one topic's methods, copied onto Game below (src/mixin.js).
import {mixin} from './mixin.js';
import {GameActions} from './game-actions.js';
export {launchReason,DEPLOY_COVER,deployCoverReason,itemUseReason} from './game-actions.js';
import {GameAttacks} from './game-attacks.js';
import {GameDamage} from './game-damage.js';
import {GameEnemyTurn} from './game-enemies.js';
export {LUNGE_TRAIT,LUNGE_TUNING} from './game-enemies.js';
import {GameItems} from './game-items.js';
import {GameFloors} from './game-floors.js';
import {GameSave,CATALOG,plateCapacityOf,freshPlayer} from './game-save.js';

// Consumables (3.106.0, user request): the spray matches the ground armour pickup, and adrenaline is priced in health.
export const SPRAY_PLATES=20,SURGE_COST=15,SURGE_STEPS=2;
// The supply terminal's stock, prices and trade-ins live in src/terminal.js (3.120.0 economy); re-exported for callers.
export {TERMINAL_ITEMS,terminalCost,terminalReason} from './terminal.js';
export const enemyName=enemyDisplayName;

export class Game {
  constructor(seed=Date.now()%1000000,unlocks=[],carrying=0,character='soldier',portrait=pickPortrait(),mission='extraction',options={}) {
    if(!validCharacter(character))throw new Error(t('game.unknownCharacter'));
    if(!validPortrait(portrait))throw new Error(t('game.unknownPortrait'));
    if(options.simulation)this.simulation=structuredClone(options.simulation);
    lockRealMode(this,options.realMode??false);
    this.difficultyOffset=options.difficultyOffset??DIFFICULTY_TUNING.defaultOffset;if(!validDifficultyOffset(this.difficultyOffset))throw new Error('Invalid difficulty offset');
    // 3.137.0 (docs/DIFFICULTY.md): the difficulty curve, easy or standard; 'classic' only for runs started earlier.
    this.difficulty=options.difficulty??DEFAULT_CURVE;if(!validCurve(this.difficulty))throw new Error('Invalid difficulty');
    // 3.138.0 (docs/PERK_GROWTH.md): the perk rules this run uses; runs started earlier restore as 1.
    this.perkRules=3;   // 3.148.0 升級 D (docs/PERK_GROWTH.md); 2 = 3.138.0-3.147.0, 1 = before 3.138.0
    // 3.169.0 (docs/STORY.md 8): who is on comms for this run, fixed at deployment (storage.startCampaign).
    this.duty=validDuty(options.duty)?options.duty:DEFAULT_DUTY;
    this.facilityFaction=options.facilityFaction==='random'?rollFacilityFaction(seed):factionDef(options.facilityFaction)?options.facilityFaction:pickFacilityFaction(seed,mission);this.mission=newMission(mission);this.carryLevel=carryLevels(0);this.seed=seed;this.rng=random(seed);this.floor=1;this.turn=1;this.player=freshPlayer();
    Object.assign(this.player,{hp:CHARACTERS[character].hp||100,maxHp:CHARACTERS[character].hp||100,armor:CHARACTERS[character].armor||0,plates:CHARACTERS[character].plates||0});
    this.player.skills=[...(CHARACTERS[character].skills||[])];this.player.skillState=initialSkillState(this.player.skills);
    Object.assign(this.player,startingSupplies(character));Object.assign(this.player.prepared,CHARACTERS[character].prepared||{});
    // 3.158.0 (user decision): the first ranged weapon is in hand at the start, so the berserker and the ninja need no
    // switch before their first shot; the bound blade stays first in the pack and is what a bump swings.
    this.player.portrait=portrait;this.player.character=character;grantCharacterTraits(this.player);this.player.owned=[...CHARACTERS[character].weapons];this.player.weapon=this.player.owned.find(i=>!WEAPONS[i].melee)??this.player.owned[0];this.player.ammo=CATALOG.map((w,i)=>this.player.owned.includes(i)?w.mag:0);
    this.runId=newRunId();this.protocol={earned:0,events:[]};this.unlockedWeapons=[...unlocks];
    this.allies=[];this.allySerial=0;this.floorStates={};this.reinforcements=[];this.purge={floors:{}};this.logs=[];this.status='playing';this.shadowSteps=0;this.pursuit=0;this.pendingPerks=0;this.perkPicks=0;this.classPerkMisses=0;this.legacyPerkPicks=0;this.perkDraft=null;this.effects=[];this.mineSerial=0;initializeRunUnlocks(this,options);this.loadFloor();initializeAllies(this);this.reveal();
    this.log(t('game.arrived'));
  }
  // Overridable by isolated simulation fixtures; live campaigns use the current recipe pool.
  // The difficulty the rules read: the curve and the knob's offset together.
  get difficultySpec(){return {curve:this.difficulty,offset:this.difficultyOffset};}
  get petSensorContacts(){return petScanContacts(this);}
  get activeAllies(){return currentAllies(this);}
  get localAllies(){return localAllies(this);}
  enemyCallout(actor,kind,detail){enemyCallout(this,actor,kind,detail);}
  actorWeapon(actor){return actor.kind?allyWeapon(actor,this.player):enemyWeapon(actor);}
  // 3.210.0: the ninja's own melee (穩刃 sure_blade) is a fixed SURE_BLADE percent, before and after every modifier.
  meleeAccuracy(a,b,base=97){if(a===this.player&&activeTrait(a,'sure_blade'))return SURE_BLADE;return meleeChance(a,b,base-this.defensiveEvasion(a,b)+bossAccuracy(this,a,b)+crashBonus(b)+burnFlank(this,a,b));}   // 3.204.0: a boss's mark on you, a set-up gun's flank; 3.205.0: a swarm boss dazed against a wall; 3.206.0: a set-up flamethrower's flank
  defensiveEvasion(a,b){return defensiveEvasion(this,a,b);}
  grapplePlan(id=this.target){return grapplePlan(this,id);}
  hookBladePlan(id=this.target){return hookBladePlan(this,id);}   // 3.210.0: the ninja's hook blade (src/melee-classes.js)
  get allyTravelSummary(){const near=carryCandidates(this).length,total=this.activeAllies.length;return total?t('game.allyCarry',{near,left:total-near}):'';}
  get weapon(){return this.weaponAt(this.player.weapon);}
  weaponAt(slot){if(slot===UNARMED_SLOT)return {...UNARMED};return weaponStats(this.player.weaponBases[slot],this.player.affixes[slot],this.player);}
  // 3.217.0 (src/concealed.js): a hidden unit is no enemy you see — a disguise is a case, a burrowed bug nothing until marked.
  get visibleEnemies(){return this.enemies.filter(e=>e.hp>0&&this.teamVisible(e)&&knownEnemy(e));}
  // A blind shot (src/blind-fire.js) aims at what stands on its tile, seen or not, only while it resolves.
  get targeted(){const blind=blindAim(this);if(blind)return blind.target||undefined;return [...this.enemies,...this.props,...this.barriers,...(this.lamps||[])].find(e=>e.id===this.target&&e.hp>0&&this.teamVisible(e));}   // lamps: 3.187.0
  get perkChoices(){return ensurePerks(this);}
  get exitPoint(){return exitPoint(this);}
  get exitLabel(){return exitLabel(this);}
  get exitKind(){return exitKind(this);}
  get deepestFloor(){return deepestFloor(this);}
  get exitBlocked(){return exitBlocked(this);}
  get missionSummary(){return missionSummary(this);}
  get nearbyObjectives(){return missionObjects(this).filter(t=>!t.done&&this.canTouch(t));}
  // 3.189.0 survival hooks for the enemy tree (src/enemy-behavior.js), which does not import src/survival.js itself.
  survivalAction(ctx,move){return survivalAction(ctx,move);}
  holdsPoint(e){return holdsPoint(this,e);}
  get bossAlive(){return this.enemies.some(e=>isBossClass(e)&&e.hp>0);}
  get nearbyTerminal(){return this.props.find(o=>o.type==='terminal'&&!o.used&&this.canTouch(o));}
  get groundWeapon(){return this.items.find(o=>o.type==='weapon'&&this.canTouch(o));}
  get cover(){if(activeTrait(this.player,'no_cover'))return [];return [...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,this.player)===1),...adjacentWalls(this.grid,this.player),...this.barriers.filter(b=>edgeAdjacent(b,this.player)&&edgeBlocks(b,'cover'))];}
  // Detection range (3.105.0, user request): a card may only be seen from close up, whatever the light or the line of
  // sight. It is per card so each unit can set its own — the loitering munition uses its own hook range, so it shows
  // itself exactly when it could reach you. Everything funnels through visible()/teamVisible(), so drawing, targeting,
  // the exposure count and the allies all obey the same number.
  // 3.207.0: a delisted ninja's optical camouflage hides it from whoever cannot see through it (src/delisted-operatives.js).
  revealed(watcher,e){const reach=ENEMY_TYPES[e?.type]?.revealRange;return (reach===undefined||distance(watcher,e)<=reach)&&!cloaked(this,watcher,e);}
  // Your units' own targeting (src/allies.js, src/workshop.js) asks this: they cannot pick out a cloaked ninja either.
  cloakedFrom(watcher,e){return cloaked(this,watcher,e);}
  // 3.207.0: a delisted ninja in the same thick cloud as the one looking shows its outline, though smoke blocks the view.
  visible(e){return this.revealed(this.player,e)&&distance(this.player,e)<=Math.max(10,this.weapon.range)&&(isBarrier(e)?edgeCells(e).some(p=>this.sight(this.player,p)):this.sight(this.player,e)||outlined(this,this.player,e));}
  teamVisible(e){return this.visible(e)||this.activeAllies.some(a=>connected(this,a)&&this.revealed(a,e)&&distance(a,e)<=8&&(this.sight(a,e)||outlined(this,a,e)));}
  // 3.217.0: only you see a hidden unit, and only as what it shows — a case where you see its tile (never hidden in the
  // black: a case is a thing on the floor), a burrowed bug once marked. Your units and the enemies never do.
  sight(a,b){syncPetSenses(this);if(b?.concealed)return a===this.player&&concealedSeen(b)&&tacticalSight(this,a,b);return !(b===this.player&&a!==this.player&&(skillActive(this.player)||decoyHides(this,a)))&&!(this.isActor(b)&&hiddenInDark(this,a,b))&&tacticalSight(this,a,b);}
  // 3.178.0 (docs/LIGHTING.md): the black hides people, not tiles, so sight still passes through it to what lies beyond.
  isActor(b){return b===this.player||Boolean(b&&typeof b.hp==='number'&&(this.enemies.includes(b)||this.allies.includes(b)));}
  shotClear(a,b){return cornerRay(this,a,b).clear;}
  attackStatus(a,b){return cornerStatus(this,a,b);}
  recordExposure(a,b){recordExposure(this,a,b);}
  canCross(a,b){return !blockedBetween(this.barriers,a,b);}
  canRoute(a,b){const edge=barrierBetween(this.barriers,a,b);return !edgeBlocks(edge)||edge.type==='door'&&!edge.locked||vaultable(edge);}
  canTouch(point){return distance(this.player,point)<=1&&this.canCross(this.player,point);}
  get nearbyContainers(){return this.props.filter(c=>isContainer(c)&&!c.opened&&this.canTouch(c));}
  canOperateDoor(b){
    if(b.type!=='door'||b.hp<=0)return false;
    const p=this.player;if(edgeAdjacent(b,p))return true;
    // Reach from either door-side cell's lateral neighbors, never through another edge or solid tile.
    return edgeCells(b).some(q=>(b.axis==='x'?p.x===q.x&&Math.abs(p.y-q.y)===1:p.y===q.y&&Math.abs(p.x-q.x)===1)&&this.passable(q.x,q.y)&&this.canCross(p,q));
  }
  get nearbyDoors(){return this.barriers.filter(b=>this.canOperateDoor(b));}
  doorLabel(b){const dx=b.x-this.player.x,dy=b.y-this.player.y;return t('game.doorLabel',{side:t(`dir.${(dx>0?'e':dx<0?'w':'')+(dy>0?'s':dy<0?'n':'')||'none'}`),action:t(b.locked?(lockedReason(this,b)?'game.doorLocked':'game.doorKeycard'):b.open?'game.doorClose':'game.doorOpen')});}
  setDoor(b,open){
    if(!b||b.type!=='door'||b.hp<=0||b.locked&&open)return false;   // 3.146.0: a locked vault door opens only with the keycard
    if(b.open===open)return true;b.open=open;
    this.effects.push({type:'gate',from:{x:b.x,y:b.y},to:{x:b.x,y:b.y},axis:b.axis,open});
    this.log(t(open?'game.barrierOpened':'game.barrierClosed',{barrier:barrierName(b)}));this.reveal();return true;
  }
  accuracy(attacker,target){return shotChance(this,attacker,target);}
  solid(x,y){return this.props.find(o=>o.x===x&&o.y===y&&o.hp>0&&(o.type==='cover'||o.type==='barrel'||o.type==='nest'));}
  // 3.164.0: a flyer may hover over a pit (src/pits.js); everyone else keeps to the floor.
  passable(x,y,actor){const v=this.grid[y]?.[x];return (v===1||v===VOID&&hasEnemyTag(actor,'flying'))&&(!this.solid(x,y)||hasEnemyTag(actor,'flying'))&&!knownMine(this,actor,x,y)&&!pointBlocks(this,actor,x,y);}   // 3.191.0: survival points
  // 3.191.0 (user): a survival floor's layout is known from the start. The renderer draws the floor, walls, doors, crates,
  // terminals and the exit where a tile is mapped; what lies loose (drops, bodies, traces) still needs `seen`.
  mapped(x,y){return Boolean(this.seen[y]?.[x]||this.survival&&this.grid[y]?.[x]!==undefined);}
  // `warnings:false` (restore only): a loaded save redraws what is seen but raises no new alarm; the next look in play does.
  // 3.207.0 (independent review): nor does it alert anyone or move what they last knew. The enemies are checked in one
  // pass, so one that turns its flashlight on can light you for another checked before it; a load's look used to be that
  // second pass, and a restored run then differed from the one that saved it. The save already holds what play left.
  reveal({warnings=true}={}) {
    syncPetSenses(this);
    clearMovedExposure(this);
    const radius=Math.max(10,this.weapon.range);
    this.visibleTiles=new Set();
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(distance(this.player,{x,y})<=radius&&this.sight(this.player,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const a of this.activeAllies.filter(a=>connected(this,a)))for(let y=Math.max(0,a.y-8);y<=Math.min(SIZE-1,a.y+8);y++)for(let x=Math.max(0,a.x-8);x<=Math.min(SIZE-1,a.x+8);x++)if(distance(a,{x,y})<=8&&this.sight(a,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    // 3.217.0: a hidden unit never spots you here (no alert, no call); it watches on its own turn (src/concealed.js).
    if(warnings)for(const e of this.enemies)if(e.hp>0&&!e.concealed){const target=this.enemyTarget(e);if(distance(e,target)<=Math.max(10,ENEMY_TYPES[e.type].range)&&this.sight(e,target)){if(!e.alert&&!isNoncombatant(e))this.enemyCallout(e,'state',{state:'spotted'});e.alert=true;e.lastKnown={x:target.x,y:target.y};if(warnings&&isNoncombatant(e))scream(this,e);else if(warnings&&isEnforcer(e))soundAlarm(this,e,target);}}
    forgetSeenAftermath(this);
    this.autoTarget();
  }
  autoTarget(){if(blindAim(this))return;if(!this.targeted)this.target=this.visibleEnemies.filter(e=>!isNoncombatant(e)).sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]?.id??null;}
  log(text,danger=false,realText=null){if(silenced(this))return;this.logs.unshift({turn:this.turn,text:this.realMode&&realText!==null?realText:text,danger});this.logs=this.logs.slice(0,50);}
  get weaponCapacity(){return CHARACTERS[this.player.character].weaponCapacity;}
  get plateCapacity(){return plateCapacityOf(this.player);}   // 加掛板架: 3.148.0
  // 3.163.0 (user decision): an invalid input the operator says out loud (src/callout-ui.js PLAYER_LINES) stays off the
  // combat log — nothing happened in the rules — and is handed to the interface as `refusal`. Others log as before.
  fail(text,cue=null,detail=null){if(cue){this.refusal={cue,text,...(detail||{})};return false;}this.log(text);return false;}
}
mixin(Game,GameActions,GameAttacks,GameDamage,GameEnemyTurn,GameItems,GameFloors,GameSave);
