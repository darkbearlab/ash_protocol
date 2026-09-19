import {initializeRunUnlocks,populateRunUnlocks,endlessFaction,collectStory,recoverOperator,validRunUnlocks} from './run-unlocks.js';
import {isSimulation,simulationDrops,simulationUpgrades} from './killhouse-policy.js';
import {tickSwarmWaves,validSwarmWaves} from './swarm-waves.js';
import {validSquad,postSquads} from './squad.js';
import {recruitConscripts,rebelMorale,witnessDeath,isEnforcer,validRebels,soundAlarm,tickAlarms} from './rebels.js';
import {clearPoison,addPoison,tickPoison,migratePoison} from './poison.js';
import {tickTongues,validSwarm,SWARM_TUNING} from './swarm.js';
import {scream,tickCivilianCooldowns,migrateCivilians,validCivilians} from './civilians.js';
import {rollEnemyElite,enemyKillXp,migrateElites,validElites} from './elite-enemies.js';
import {pickFacilityFaction,factionDef,rollFacilityFaction,migrateFactions,validFactions} from './factions.js';
import {isBossClass,hasEnemyTag,enemyDef,isNoncombatant} from './enemy-data.js';
import {unitTree} from './behavior-tree.js';
import {lockRealMode} from './real-mode.js';
import {injuryCallout} from './callouts.js';
import {enemyOpportunity,executeEnemyTree,enemyDeath,enemyWeapon} from './enemy-behavior.js';
import {enemyCallout,validEnemyIntent,validEnemyMarks} from './enemy-intents.js';
import {enemyDisplayName,rollEnemyAffixes,migrateEnemyAffixes,validEnemyAffixes} from './enemy-affixes.js';
import {migrateResistance,grantNativeResistance} from './suppression.js';
import {DIFFICULTY_TUNING,validDifficultyOffset,DEFAULT_CURVE,validCurve} from './endless.js';
import {shotDamageAllowed,pinned,tickSuppression,finishSuppression,migrateSuppression} from './suppression.js';
import {suppressiveReason,suppressiveFire} from './suppressive-fire.js';
import {learningReason,useLearning,validLearningInventory} from './learning.js';
import {validLearningId,LEARNING_ITEMS,LEARNING_SCRAP,RETIRED_LEARNING} from './learning-data.js';
function retireLearning(data){
 const retired=id=>RETIRED_LEARNING.includes(id),scrap=()=>({type:'scrap',amount:LEARNING_SCRAP});
 const p=data.player;
 if(p?.learningItems&&typeof p.learningItems==='object')for(const id of Object.keys(p.learningItems))if(retired(id)){p.scrap=(p.scrap||0)+LEARNING_SCRAP*(Number(p.learningItems[id])||0);delete p.learningItems[id];}
 const floors=[data,...Object.values(data.floorStates||{})];
 for(const f of floors){
  if(Array.isArray(f.items))f.items=f.items.map(i=>i?.type==='learning'&&retired(i.learningId)?{x:i.x,y:i.y,...scrap()}:i);
  for(const c of (f.props||[]))if(c?.type==='container'&&Array.isArray(c.contents))c.contents=c.contents.map(i=>i?.type==='learning'&&retired(i.learningId)?scrap():i);
 }
}
import {petHit,petDefense,petReactions,syncPetSenses,petScanContacts,migratePetNodes,petFeedQuote,feedPet,outputChoiceReason,tickPetBond,petCombat,petDeath,petSurvives,petRank,migratePetBond,validPetBond,PET_FEEDING_TUNING} from './pet-growth.js';
import {cornerRay,cornerStatus,recordExposure,clearMovedExposure,expireExposure,validCorner} from './corner.js';
import {combatStep,validTactics} from './tactics.js';
import {UNARMED_SLOT,UNARMED} from './unarmed.js';
import {enemyRoom,tickNests,validRuntime,collapseNest} from './runtime-enemies.js';
import {singleShotAt,volleyAt,volleyShots,roundCost,salvageValue} from './weapons.js';
import {objectSightGrid} from './scenery.js';
import {MAP_FIELDS,validMapMetadata,validGenerationHistory} from './map-geometry.js';
import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {MAX_LEVEL,perkLimit,floorLimit,isEndless,scaleEnemy,giveCapSupply,PROTOCOL_EVENT_LIMIT} from './endless.js';
import {freshSpirit,validMeleeState,tickSpirit,bladeMultiplier,meleeDefense,ambushReady,ambushMultiplier,shortenCamo,meleeReward,defensiveEvasion,grapplePlan,useGrapple,MELEE_TUNING} from './melee-classes.js';
import {healActor} from './traits.js';
import {DETOUR_TRAIT,DETOUR_TUNING,exposedFrom,watchPoint} from './detour.js';
import {orderHit,validOrders} from './orders.js';
import {LINE_ITEMS,lineReason,lineDrop,goggleDrop,isLineItem} from './lines.js';
import {attackSpeed,thrustTargets,MELEE_WEAPON_TUNING} from './melee-weapons.js';
import {CARRY_TUNING,CAPPED_ITEMS,itemGroundType,groundItemId,itemCapacity} from './prepared.js';
import {tickPounces,validPounce} from './pounce.js';
import {toxicShot,toxicPlayerTurn,toxicAllyTurn,inToxic,tickFields,validFields} from './swarm-fields.js';
import {sweptGrid,sweptClear} from './line-move.js';
export const LUNGE_TRAIT='lunge',LUNGE_TUNING=Object.freeze({reach:3});
import {ammoDropChance,recordPerkOffer,ensurePerks,eligiblePerks,applyPerk,migratePerks,validPerks,plateDrop,levelCost} from './perks.js';
import {ALLY_SKILLS,currentAllies,localAllies,connected,allyName,allyWeapon,occupied,addAlly,initializeAllies,canAllySkill,useAllySkill,commandPet,allyAct,carryCandidates,departAllies,arriveAllies,validAllies,swapReason,swapWithPlayer,tickSummons,petSkillReason,fitDrone,DRONE_HP} from './allies.js';
import {buildReason,buildUnit,deployReason,deployUnit,workshopPoint,migrateWorkshop,validWorkshop,isMunition,munitionAct,isBomber,bomberAct,unitDestroyed,salvageBlueprint,repairReason,repairUnit} from './workshop.js';
import {archiveFloor,resumedFloor,arrivalCell,scheduleRetreatWave,resolveRetreatWave,validRetreatState} from './retreat.js';
import {toggleAnchor,validAnchor,SKILLS,skillValues,initialSkillState,skillActive,canUseSkill,tickSkills,endSkillEffects,validSkillState} from './skills.js';
import {actorStat,meleeChance,validCombatModifiers} from './actor-stats.js';
import {fullLighting,validLighting,lightingEffects} from './lighting.js';
import {bestCover,coverEffects} from './cover.js';
import {addTrace,spentCase,validTraces} from './traces.js';
import {missionDefinition,missionDepth,returning,exitPoint,exitLabel,deepestFloor,newMission,prepareMission,validMission,missionObjects,missionTarget,missionSummary,exitBlocked} from './missions.js';
import {validModules} from './modules.js';
import {isContainer,containerName,validContainers,rigContainers,isRigged,RIG_TUNING,FIELD_ITEMS} from './containers.js';
import {BARRIER_TYPES,BARRIER_LIMIT,makeBarrier,vaultable,isBarrier,barrierName,barrierBetween,blockedBetween,edgeBlocks,edgeAdjacent,edgeCells,edgeCover,barrierFace,firstBarrierOnRay,validBarriers} from './barriers.js';
import {pickPortrait,portraitForLegacy,validPortrait} from './portraits.js';
import {SMOKE_DURATION,GRENADES,FRAG_DAMAGE,grenadeTotal,grenadeByItem,controlState,validControl,applyDisruption,skipDisabled,areaCells,tacticalSight} from './throwables.js';
import {CHARACTERS,validCharacter,grantCharacterTraits,startingSupplies,classCarryBonus} from './characters.js';
import {coneTargets,shotgunBand,pelletsAt,pelletChance} from './shotgun.js';
import {lancePath} from './lance.js';
import {EXO_TUNING,mineAct,decoyReason,throwDecoy,decoyHides,fooled,noticeAttack,damageDecoy,decoyAct,tickDecoy,validDecoy,mineReason,placeMine,detonateMine,checkMines,knownMine,validMines,exoAbsorb,breakExo,wearingExo,validExo,exoReason} from './field-gear.js';
import {PREPARED_CATALOG,defaultPrepared,validPrepared,canPrepare,preparedEntry,weaponSwitchTurns,isWearable,wornEntry,prepareCost,syncWearableTraits} from './prepared.js';
import {grantTrait,removeTraitSource,activeTrait,bodyKeyword,startingTraits,validTraits,tickTraits,initiativeQueue,recordShot,validCombatMemory,reduceDirectDamage} from './traits.js';
import {AFFIXES,weaponStats,rollAffix,affixAllowed} from './weapons.js';
import {AMMUNITION,AMMO_IDS,capacity,carryLevels,validCarryLevels,itemAmmo,splitLegacyRounds,TERMINAL_AMMO} from './ammunition.js';
import {presentStep} from './presentation.js';
import {registerPurgeFloor,notePurgeDeparture,validPurge} from './purge-review.js';
import {SIZE,SAVE_VERSION,LEGACY_SAVE_VERSIONS,RARE_ARMORY,WEAPONS,FLOORS,floorInfo,ENEMY_TYPES,PERKS} from './data.js';
import {PROTOCOL_REWARDS,newRunId,weaponUnlocked} from './progression.js';
import {random,distance,lineOfSight,generate,makeEnemy,DIRECTIONS,key} from './world.js';
import {combatSight,wallCover,adjacentWalls,shotChance,bracingBonus} from './combat.js';
import {terminalReason,useTerminal,validTerminalSpent} from './terminal.js';
import {FLARE_TUNING,flareLights,flareReason,validFlares} from './flares.js';

// Consumables (3.106.0, user request): the spray matches the ground armour pickup, and adrenaline is priced in health.
export const SPRAY_PLATES=20,SURGE_COST=15,SURGE_STEPS=2;
// The supply terminal's stock, prices and trade-ins live in src/terminal.js (3.120.0 economy); re-exported for callers.
export {TERMINAL_ITEMS,terminalCost,terminalReason} from './terminal.js';
// 3.109.0 (user request): carried cover goes on the edge between you and the side you pick, so any of the four
// sides is one action — no turning — and because a low partition can be vaulted it can never seal a corridor.
// 3.111.0 (user request): a point-target launcher is aimed like a thrown grenade — at a floor tile, not at an enemy's
// body — and always detonates where it lands. There is deliberately no minimum range (user: hitting yourself is on you).
export function launchReason(g,pos){
 const p=g.player,w=g.weapon;
 if(!w.pointTarget)return '這把武器不能對地發射';
 if(p.ammo[p.weapon]<=0)return '彈匣已空，請裝填';
 if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||g.grid[pos.y]?.[pos.x]!==1)return '先選擇視線內的地板作為落點';
 if(distance(p,pos)>w.range||!g.visible(pos))return `落點需在視線內 ${w.range} 格以內`;
 return '';
}
export const DEPLOY_COVER='low_partition';
export function deployCoverReason(g,arg){
 const p=g.player;
 if(!p.barricades)return '沒有摺疊掩體';
 if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return '先選一個方向';
 const spot={x:p.x+arg[0],y:p.y+arg[1]};
 if(g.grid[spot.y]?.[spot.x]!==1)return '那一側不是平地';
 const edge=barrierBetween(g.barriers,p,spot);
 if(edge&&edge.hp>0)return `那一側已經有${barrierName(edge)}`;
 if(!edge&&g.barriers.length>=BARRIER_LIMIT)return '這一層的障礙物已經太多';
 return '';
}
const ITEM_BY_ACTION=Object.fromEntries(Object.entries(PREPARED_CATALOG.item).map(([id,entry])=>[entry.action,id]));
// 3.107.0 (user request): consumables are usable straight from the pack, so the pack has to know why a button is
// dead before the modal closes. One helper answers both it and validateAction, so the two can never disagree.
// An empty string means the item can be used right now.
export function itemUseReason(g,id){
 const p=g.player,entry=PREPARED_CATALOG.item[id];
 if(!entry?.action)return '沒有這個道具';
 if(!p[entry.resource])return `沒有${entry.name}`;
 if(entry.action==='heal')return p.hp<p.maxHp||p.poison>0?'':'生命已滿且未中毒';
 if(entry.action==='plate')return (p.plates||0)<g.plateCapacity?'':'護甲板已滿';
 if(entry.action==='surge')return p.control.disabled?'失能中無法使用':g.shadowSteps?'免費移動還沒用完':p.hp>SURGE_COST?'':'生命不足以承受';
 return '';
}
const freshPlayer=()=>({decoys:0,mines:0,exoPlates:0,learningItems:{},petBond:null,battleSpirit:freshSpirit(),perks:{},perkWeaponBonus:0,character:'soldier',vaultExposed:false,smoke:0,emp:0,stun:0,control:controlState(),moveDelta:[0,0],fireChain:null,cornerExposure:null,tactics:null,prepared:defaultPrepared(),skills:[],skillState:{},productionLines:[],blueprints:[],usedBlueprints:[],traits:[],x:0,y:0,hp:100,maxHp:100,meds:2,sprays:0,adrenaline:0,barricades:0,flares:0,escapeLines:0,redeployLines:0,meleeSlot:null,recovery:0,wearables:[],grenades:2,armor:0,bonus:0,blastBonus:0,healBonus:0,hazmat:0,scavenger:0,scrap:0,level:1,xp:0,kills:0,weapon:0,owned:[0,1],weaponBases:WEAPONS.map((_,i)=>i),affixes:WEAPONS.map(()=>null),ammo:WEAPONS.map((w,i)=>i<2?w.mag:0),upgrades:WEAPONS.map(()=>0),reserve:48,pistol:24,shell:12,energy:18,ordnance:4,facing:[0,1],guard:false,focus:false,evasive:false,poison:0,lore:[],stats:{shots:0,damage:0,grenades:0,salvaged:0}});
export const enemyName=enemyDisplayName;

export class Game {
  constructor(seed=Date.now()%1000000,unlocks=[],carrying=0,character='soldier',portrait=pickPortrait(),mission='extraction',options={}) {
    if(!validCharacter(character))throw new Error('未知角色。');
    if(!validPortrait(portrait))throw new Error('未知頭像。');
    if(options.simulation)this.simulation=structuredClone(options.simulation);
    lockRealMode(this,options.realMode??false);
    this.difficultyOffset=options.difficultyOffset??DIFFICULTY_TUNING.defaultOffset;if(!validDifficultyOffset(this.difficultyOffset))throw new Error('Invalid difficulty offset');
    // 3.137.0 (docs/DIFFICULTY.md): the difficulty curve, easy or standard; 'classic' only for runs started earlier.
    this.difficulty=options.difficulty??DEFAULT_CURVE;if(!validCurve(this.difficulty))throw new Error('Invalid difficulty');
    // 3.138.0 (docs/PERK_GROWTH.md): the perk rules this run uses; runs started earlier restore as 1.
    this.perkRules=2;
    this.facilityFaction=options.facilityFaction==='random'?rollFacilityFaction(seed):factionDef(options.facilityFaction)?options.facilityFaction:pickFacilityFaction(seed,mission);this.mission=newMission(mission);this.carryLevel=carryLevels(0);this.seed=seed;this.rng=random(seed);this.floor=1;this.turn=1;this.player=freshPlayer();
    Object.assign(this.player,{hp:CHARACTERS[character].hp||100,maxHp:CHARACTERS[character].hp||100,armor:CHARACTERS[character].armor||0,plates:CHARACTERS[character].plates||0});
    this.player.skills=[...(CHARACTERS[character].skills||[])];this.player.skillState=initialSkillState(this.player.skills);
    Object.assign(this.player,startingSupplies(character));Object.assign(this.player.prepared,CHARACTERS[character].prepared||{});
    this.player.portrait=portrait;this.player.character=character;grantCharacterTraits(this.player);this.player.owned=[...CHARACTERS[character].weapons];this.player.weapon=this.player.owned[0];this.player.ammo=WEAPONS.map((w,i)=>this.player.owned.includes(i)?w.mag:0);
    this.runId=newRunId();this.protocol={earned:0,events:[]};this.unlockedWeapons=[...unlocks];
    this.allies=[];this.allySerial=0;this.floorStates={};this.reinforcements=[];this.purge={floors:{}};this.logs=[];this.status='playing';this.shadowSteps=0;this.pursuit=0;this.pendingPerks=0;this.perkPicks=0;this.classPerkMisses=0;this.legacyPerkPicks=0;this.perkDraft=null;this.effects=[];this.mineSerial=0;initializeRunUnlocks(this,options);this.loadFloor();initializeAllies(this);this.reveal();
    this.log('已抵達轉運站。上下左右移動，尋找綠色電梯。');
  }
  // Overridable by isolated simulation fixtures; live campaigns use the current recipe pool.
  // The difficulty the rules read: the curve and the knob's offset together.
  get difficultySpec(){return {curve:this.difficulty,offset:this.difficultyOffset};}
  generateFloor(){this.facilityFaction=endlessFaction(this);return generate(this.seed,this.floor,this.unlockedWeapons,this.difficultySpec,this.facilityFaction);}
  loadFloor() {
    endSkillEffects(this.player);this.sensorContacts=[];this.shadowSteps=0;this.pursuit=0;this.player.vaultExposed=false;
    Object.assign(this,{swarmWaves:undefined,mapStyle:undefined},Object.fromEntries(MAP_FIELDS.map(k=>[k,undefined])),this.generateFloor());for(const e of this.enemies)e.faction??=this.facilityFaction;this.mapGenerations=[...new Set([...(this.mapGenerations||[]),this.generation?.version||1])].sort((a,b)=>a-b);this.smoke=[];this.flares=[];this.decoy=null;this.mines=[];this.traces=[];this.reinforcements=[];this.player.control=controlState();
    for(const item of this.items)if(item.type==='weapon')this.registerWeapon(item,true);
    Object.assign(this.player,this.start);clearPoison(this.player);this.player.guard=false;this.player.moved=false;this.player.moveDelta=[0,0];this.player.fireChain=null;this.player.cornerExposure=null;this.player.tactics=null;this.player.focus=false;this.player.evasive=false;
    prepareMission(this);recruitConscripts(this);postSquads(this);rigContainers(this);populateRunUnlocks(this);registerPurgeFloor(this);
    this.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));this.target=null;this.reveal();
  }
  get petSensorContacts(){return petScanContacts(this);}
  get activeAllies(){return currentAllies(this);}
  get localAllies(){return localAllies(this);}
  enemyCallout(actor,kind,detail){enemyCallout(this,actor,kind,detail);}
  spawnEnemy(type,x,y,id){const d=this.difficultySpec;return rollEnemyElite(rollEnemyAffixes(makeEnemy(type,x,y,id,this.floor,d,this.facilityFaction),this.seed,this.floor,d),this.seed,this.floor,d);}
  actorWeapon(actor){return actor.kind?allyWeapon(actor,this.player):enemyWeapon(actor);}
  meleeAccuracy(a,b,base=97){return meleeChance(a,b,base-this.defensiveEvasion(a,b));}
  defensiveEvasion(a,b){return defensiveEvasion(this,a,b);}
  grapplePlan(id=this.target){return grapplePlan(this,id);}
  get allyTravelSummary(){const near=carryCandidates(this).length,total=this.activeAllies.length;return total?`帶${near} 留${total-near}`:'';}
  get weapon(){return this.weaponAt(this.player.weapon);}
  weaponAt(slot){if(slot===UNARMED_SLOT)return {...UNARMED};return weaponStats(this.player.weaponBases[slot],this.player.affixes[slot],this.player);}
  fireChance(target){if(this.weapon.melee)return this.meleeAccuracy(this.player,target,this.weapon.hitChance);return this.enemies.includes(target)?this.accuracy(this.player,target).chance:Math.max(10,Math.min(99,97+(this.weapon.closeRange&&distance(this.player,target)<=this.weapon.closeRange?this.weapon.closeAccuracy:0)+actorStat(this.player,'rangedAccuracy')+(this.player.focus?15:0)+this.weapon.accuracyBonus+bracingBonus(this,this.player,target)-lightingEffects(this,this.player,target).penalty));}
  get visibleEnemies(){return this.enemies.filter(e=>e.hp>0&&this.teamVisible(e));}
  get targeted(){return [...this.enemies,...this.props,...this.barriers].find(e=>e.id===this.target&&e.hp>0&&this.teamVisible(e));}
  get perkChoices(){return ensurePerks(this);}
  get exitPoint(){return exitPoint(this);}
  get exitLabel(){return exitLabel(this);}
  get deepestFloor(){return deepestFloor(this);}
  get exitBlocked(){return exitBlocked(this);}
  get missionSummary(){return missionSummary(this);}
  get nearbyObjectives(){return missionObjects(this).filter(t=>!t.done&&this.canTouch(t));}
  recoverObjective(id){
    const t=this.nearbyObjectives.find(t=>t.id===id);
    if(!t)return this.fail('附近沒有可回收的機密資料。');
    t.done=true;
    if(missionDefinition(this).returnTrip){this.mission.returning=true;scheduleRetreatWave(this);this.log('機密已取得：返回本層入口上樓，沿原路撤離。',true);}
    this.log('機密資料已回收；'+this.missionSummary+'。');return true;
  }
  get bossAlive(){return this.enemies.some(e=>isBossClass(e)&&e.hp>0);}
  get nearbyTerminal(){return this.props.find(o=>o.type==='terminal'&&!o.used&&this.canTouch(o));}
  get groundWeapon(){return this.items.find(o=>o.type==='weapon'&&this.canTouch(o));}
  get cover(){if(activeTrait(this.player,'no_cover'))return [];return [...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,this.player)===1),...adjacentWalls(this.grid,this.player),...this.barriers.filter(b=>edgeAdjacent(b,this.player)&&edgeBlocks(b,'cover'))];}
  // Detection range (3.105.0, user request): a card may only be seen from close up, whatever the light or the line of
  // sight. It is per card so each unit can set its own — the loitering munition uses its own hook range, so it shows
  // itself exactly when it could reach you. Everything funnels through visible()/teamVisible(), so drawing, targeting,
  // the exposure count and the allies all obey the same number.
  revealed(watcher,e){const reach=ENEMY_TYPES[e?.type]?.revealRange;return reach===undefined||distance(watcher,e)<=reach;}
  visible(e){return this.revealed(this.player,e)&&distance(this.player,e)<=Math.max(10,this.weapon.range)&&(isBarrier(e)?edgeCells(e).some(p=>this.sight(this.player,p)):this.sight(this.player,e));}
  teamVisible(e){return this.visible(e)||this.activeAllies.some(a=>connected(this,a)&&this.revealed(a,e)&&distance(a,e)<=8&&this.sight(a,e));}
  sight(a,b){syncPetSenses(this);return !(b===this.player&&a!==this.player&&(skillActive(this.player)||decoyHides(this,a)))&&tacticalSight(this,a,b);}
  shotClear(a,b){return cornerRay(this,a,b).clear;}
  attackStatus(a,b){return cornerStatus(this,a,b);}
  recordExposure(a,b){recordExposure(this,a,b);}
  canCross(a,b){return !blockedBetween(this.barriers,a,b);}
  canRoute(a,b){const edge=barrierBetween(this.barriers,a,b);return !edgeBlocks(edge)||edge.type==='door'||vaultable(edge);}
  canTouch(point){return distance(this.player,point)<=1&&this.canCross(this.player,point);}
  get nearbyContainers(){return this.props.filter(c=>isContainer(c)&&!c.opened&&this.canTouch(c));}
  containerLabel(c){const dx=c.x-this.player.x,dy=c.y-this.player.y;return `${dx>0?'東側':dx<0?'西側':dy>0?'南側':dy<0?'北側':'腳下'}${containerName(c)}`;}
  containerDrop(c){
    const p=this.player,steps=DIRECTIONS.map(([dx,dy])=>({x:c.x+dx,y:c.y+dy}));
    const facing={x:p.x+p.facing[0],y:p.y+p.facing[1]};
    const candidates=[...(distance(c,p)===0?[facing]:[]),{x:c.x,y:c.y},...steps];
    const safe=q=>this.grid[q.y]?.[q.x]===1&&(distance(c,q)===0||this.canCross(c,q))&&!this.solid(q.x,q.y)&&!this.enemies.some(e=>e.hp>0&&distance(e,q)===0)&&!this.props.some(o=>o!==c&&distance(o,q)===0)&&!this.hazards.some(h=>distance(h,q)===0)&&distance(p,q)>0;
    return candidates.find(q=>safe(q)&&!this.items.some(i=>distance(i,q)===0))||candidates.find(safe)||{x:p.x,y:p.y};
  }
  openContainer(id){
    const c=this.nearbyContainers.find(c=>c.id===id);if(!c)return this.fail('附近沒有可開啟的補給箱。');
    if(isRigged(c))return this.detonateCase(c,this.player);
    const pos=this.containerDrop(c),contents=c.contents;c.opened=true;c.contents=[];
    this.items.push(...contents.map(i=>i.type==='weapon'?this.registerWeapon({...i,...pos},true):({...i,...pos})));
    // container (3.118.0): tells the open-case sound apart from a pet's unpack, which uses the same visual.
    this.effects.push({type:'unpack',container:true,from:{x:c.x,y:c.y},to:pos,damage:0});
    if(!contents.length){this.log(`${containerName(c)}已開啟，裡面是空的。`);return true;}
    this.log(`${containerName(c)}已開啟，補給${distance(pos,this.player)===0?'留在腳下，移開再走回拾取':'落在地上，走上去拾取'}。`);return true;
  }
  canOperateDoor(b){
    if(b.type!=='door'||b.hp<=0)return false;
    const p=this.player;if(edgeAdjacent(b,p))return true;
    // Reach from either door-side cell's lateral neighbors, never through another edge or solid tile.
    return edgeCells(b).some(q=>(b.axis==='x'?p.x===q.x&&Math.abs(p.y-q.y)===1:p.y===q.y&&Math.abs(p.x-q.x)===1)&&this.passable(q.x,q.y)&&this.canCross(p,q));
  }
  get nearbyDoors(){return this.barriers.filter(b=>this.canOperateDoor(b));}
  doorLabel(b){const dx=b.x-this.player.x,dy=b.y-this.player.y;return `${dx>0?'東':dx<0?'西':''}${dy>0?'南':dy<0?'北':''}側${b.open?'關門':'開門'}`;}
  setDoor(b,open){
    if(!b||b.type!=='door'||b.hp<=0)return false;
    if(b.open===open)return true;b.open=open;
    this.effects.push({type:'gate',from:{x:b.x,y:b.y},to:{x:b.x,y:b.y},axis:b.axis,open});
    this.log(`${barrierName(b)}已${open?'開啟':'關閉'}。`);this.reveal();return true;
  }
  accuracy(attacker,target){return shotChance(this,attacker,target);}
  solid(x,y){return this.props.find(o=>o.x===x&&o.y===y&&o.hp>0&&(o.type==='cover'||o.type==='barrel'||o.type==='nest'));}
  passable(x,y,actor){return this.grid[y]?.[x]===1&&(!this.solid(x,y)||hasEnemyTag(actor,'flying'))&&!knownMine(this,actor,x,y);}
  // `warnings:false` (restore only): a loaded save redraws what is seen but raises no new alarm; the next look in play does.
  reveal({warnings=true}={}) {
    syncPetSenses(this);
    clearMovedExposure(this);
    const radius=Math.max(10,this.weapon.range);
    this.visibleTiles=new Set();
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(distance(this.player,{x,y})<=radius&&this.sight(this.player,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const a of this.activeAllies.filter(a=>connected(this,a)))for(let y=Math.max(0,a.y-8);y<=Math.min(SIZE-1,a.y+8);y++)for(let x=Math.max(0,a.x-8);x<=Math.min(SIZE-1,a.x+8);x++)if(distance(a,{x,y})<=8&&this.sight(a,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const e of this.enemies)if(e.hp>0){const target=this.enemyTarget(e);if(distance(e,target)<=Math.max(10,ENEMY_TYPES[e.type].range)&&this.sight(e,target)){if(!e.alert&&!isNoncombatant(e))this.enemyCallout(e,'state',{state:'spotted'});e.alert=true;e.lastKnown={x:target.x,y:target.y};if(warnings&&isNoncombatant(e))scream(this,e);else if(warnings&&isEnforcer(e))soundAlarm(this,e,target);}}
    this.autoTarget();
  }
  autoTarget(){if(!this.targeted)this.target=this.visibleEnemies.filter(e=>!isNoncombatant(e)).sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]?.id??null;}
  log(text,danger=false,realText=null){this.logs.unshift({turn:this.turn,text:this.realMode&&realText!==null?realText:text,danger});this.logs=this.logs.slice(0,50);}
  reserveKey(weapon=this.weapon){return AMMUNITION[weapon.ammoType]?.key??null;}
  get weaponCapacity(){return CHARACTERS[this.player.character].weaponCapacity;}
  get plateCapacity(){return CHARACTERS[this.player.character].plateCapacity;}
  ammoCapacity(type){const base=capacity(type,0)+classCarryBonus(this.player.character,type);return !activeTrait(this.player,'extended_carry')?base:type==='grenade'?base+CARRY_TUNING.throwBonus:Math.round(base*CARRY_TUNING.ammoBonus);}
  // 3.136.0 (user decision): carried items stop at five; what does not fit stays at your feet, like ammunition.
  itemCapacity(){return itemCapacity(this.player);}
  dropItem(id,amount,pos=this.player){
    if(amount<=0)return;
    const type=itemGroundType(id),existing=this.items.find(o=>o.type===type&&o.x===pos.x&&o.y===pos.y);
    if(existing)existing.amount=(existing.amount||1)+amount;else this.items.push({x:pos.x,y:pos.y,type,amount});
  }
  receiveItem(id,amount,{spill=true}={}){
    const entry=PREPARED_CATALOG.item[id],key=entry.resource,accepted=Math.min(amount,Math.max(0,this.itemCapacity()-(this.player[key]||0)));
    this.player[key]=(this.player[key]||0)+accepted;
    if(spill&&amount>accepted){this.dropItem(id,amount-accepted);this.log(`${entry.name}超出攜帶上限，${amount-accepted} 留在腳下。`);}
    return accepted;
  }
  dropAmmo(type,amount,pos=this.player){
    if(amount<=0)return;
    const item=AMMUNITION[type].item,existing=this.items.find(o=>o.type===item&&o.x===pos.x&&o.y===pos.y);
    if(existing)existing.amount=(existing.amount??AMMUNITION[type].pickup)+amount;
    else this.items.push({x:pos.x,y:pos.y,type:item,amount});
  }
  receiveAmmo(type,amount,{spill=true}={}){
    if(type==='grenade')return this.receiveGrenade('frag',amount,{spill});
    const key=AMMUNITION[type].key,accepted=Math.min(amount,Math.max(0,this.ammoCapacity(type)-this.player[key]));
    this.player[key]+=accepted;if(spill&&amount>accepted){this.dropAmmo(type,amount-accepted);this.log(`${AMMUNITION[type].name}超出容量，${amount-accepted} 留在腳下。`);}return accepted;
  }
  setCarryLevel(level){
    this.carryLevel=carryLevels(0);
    for(const [type,info]of Object.entries(AMMUNITION)){if(type==='grenade')continue;const excess=this.player[info.key]-this.ammoCapacity(type);if(excess>0){this.player[info.key]-=excess;this.dropAmmo(type,excess);}}
    this.trimGrenades();
    for(const id of CAPPED_ITEMS){const key=PREPARED_CATALOG.item[id].resource,excess=(this.player[key]||0)-this.itemCapacity();if(excess>0){this.player[key]-=excess;this.dropItem(id,excess);}}
  }
  receiveGrenade(id,amount,{spill=true}={}){
    const def=GRENADES[id],accepted=Math.min(amount,Math.max(0,this.ammoCapacity('grenade')-grenadeTotal(this.player)));
    this.player[def.resource]+=accepted;
    if(spill&&amount>accepted){this.dropGrenade(id,amount-accepted);this.log(`${def.name}超出共用容量，${amount-accepted} 留在腳下。`);}return accepted;
  }
  dropGrenade(id,amount){const def=GRENADES[id],p=this.player,item=this.items.find(o=>o.type===def.item&&distance(o,p)===0);if(item)item.amount=(item.amount??1)+amount;else this.items.push({x:p.x,y:p.y,type:def.item,amount});}
  trimGrenades(){let excess=grenadeTotal(this.player)-this.ammoCapacity('grenade');for(const [id,def]of Object.entries(GRENADES)){const n=Math.min(Math.max(0,excess),this.player[def.resource]);if(n){this.player[def.resource]-=n;this.dropGrenade(id,n);excess-=n;}}}
  supplyPack(amounts){for(const [type,amount]of Object.entries(amounts))this.receiveAmmo(type,amount);}
  // 3.141.0: the shotgun's pellets at this target's distance, each with an even share of the per-attack bonuses (upgrades,
  // the damage perk), rounded up like a burst's.
  pelletDamage(index,target){const w=this.weaponAt(index),count=pelletsAt(w,distance(this.player,target)),raw=this.player.bonus+Math.ceil(this.player.perkWeaponBonus/(w.burst||1))+(this.player.upgrades[index]||0)*5,bonus=count?Math.ceil(raw/count):0;return {count,min:w.pelletMin+bonus,max:w.pelletMax+bonus};}
  weaponDamage(index=this.player.weapon,target=null){const w=this.weaponAt(index);if(w.unarmed)return {min:w.min,max:w.max};const band=target?shotgunBand(w,distance(this.player,target)):{min:w.min,max:w.max},raw=this.player.bonus+Math.ceil(this.player.perkWeaponBonus/(w.burst||1))+(this.player.upgrades[index]||0)*5,bonus=w.hits?Math.ceil(raw/w.hits):raw;return {min:band.min+bonus,max:band.max+bonus};}
  fail(text){this.log(text);return false;}
  // The only place the prepared slot is written. Wearables hang their passives off it, so the two can never drift.
  setPrepared(category,id){this.player.prepared[category]=id;syncWearableTraits(this.player);return true;}
  recoverOperator(){return recoverOperator(this);}
  awardProtocol(type,id) {const event=`${type}:${id}`,amount=PROTOCOL_REWARDS[type];if(!amount||this.protocol.events.includes(event))return;this.protocol.events.push(event);this.protocol.earned+=amount;this.log(`協定點數 +${amount}，死亡仍保留。`);}

  // 3.136.0 (user decision): the melee weapon picked in the pack, else the first one in the pack, else bare hands. Before
  // 3.136.0 only weapons free to switch both ways counted, and every melee weapon was, so the fallback is the old rule.
  bumpMeleeSlot(){const p=this.player,picked=p.meleeSlot;if(Number.isInteger(picked)&&p.owned.includes(picked)&&this.weaponAt(picked).melee)return picked;return p.owned.find(slot=>this.weaponAt(slot).melee)??UNARMED_SLOT;}
  actionCost(type,arg){if(type==='skill'&&arg==='anchor'&&skillActive(this.player,'anchor')&&classPerkRank(this.player,'bulwark_anchor')===3)return 0;if(['commandPet','setPetOutput','learn','dismantleLearning','surge','meleeChoice'].includes(type))return 0;if(type==='rope'&&LINE_ITEMS[arg?.item]?.free)return 0;
    if(type==='prepare')return prepareCost(this.player,arg);return type==='skill'?(SKILLS[arg]?.cost??1):type==='reload'&&activeTrait(this.player,'quick_reload')&&this.weapon.ammoType==='pistol'?0:type==='weapon'?weaponSwitchTurns(this.weaponAt(Number(arg)),this.weapon):1;}
  // Validate the intent before any actor acts: rejected input cannot scout fast enemies.
  validateAction(type,arg){
    const p=this.player,w=this.weapon;
    if(type==='learn'||type==='dismantleLearning'){const reason=learningReason(this,arg,type==='dismantleLearning');return !reason||this.fail(reason);}
    if(type==='meleeChoice')return arg===null||Number.isInteger(arg)&&p.owned.includes(arg)&&this.weaponAt(arg).melee||this.fail('只能選背包裡的近戰武器。');
    if(type==='suppressiveFire'){const reason=suppressiveReason(this,arg);return !reason||this.fail(reason);}
    if(type==='feedPet'){const q=petFeedQuote(this,arg);return q.allowed||this.fail(q.reason);}
    if(type==='setPetOutput')return !outputChoiceReason(this,arg)||this.fail(outputChoiceReason(this,arg));
    if(type==='buildUnit'){const reason=buildReason(this,arg?.blueprint,arg?.payload,arg?.weapon);return !reason||this.fail(reason);}
    if(type==='commandPet')return Boolean(p.prepared.skill==='pet_command'&&this.activeAllies.some(a=>a.kind==='pet')&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&this.seen[arg.y]?.[arg.x]&&this.passable(arg.x,arg.y)&&distance(p,arg)<=6);
    // Workshop (docs/ENGINEER.md): deploy a finished unit from a production line onto a free tile within two route steps.
    if(type==='deployUnit'){const reason=deployReason(this,arg?.line,workshopPoint(arg));return !reason||this.fail(reason);}
    if(type==='repairUnit'){const reason=repairReason(this,arg);return !reason||this.fail(reason);}
    if(type==='skill'&&arg==='workshop')return this.fail('從工坊面板生產或部署機體。');
    if(type==='skill'&&arg==='suppressive_fire')return this.fail('壓制射擊需要區域落點。');
    if(type==='skill'&&arg==='grapple'&&canUseSkill(p,arg)){const plan=grapplePlan(this);return !plan.reason||this.fail(plan.reason);}
    if(type==='skill')return (ALLY_SKILLS.includes(arg)?canAllySkill(this,arg):canUseSkill(p,arg))||this.fail((arg==='pet_command'&&p.prepared.skill===arg&&petSkillReason(this))||(arg==='raise_dead'&&p.prepared.skill===arg&&!p.control.disabled&&'目前沒有召喚物可以集結。')||'技能無法啟動：請確認預備欄與冷卻狀態。');
    if(type==='prepare'&&arg?.id==='exo'&&exoReason(p))return this.fail(exoReason(p)+'。');
    if(type==='prepare')return Boolean(arg&&canPrepare(p,arg.category,arg.id)&&p.prepared[arg.category]!==arg.id);
    // 3.107.0 (user request): consumables no longer need the prepared slot — the pack uses them in place. The
    // grenade slot stays, because there it also chooses which grenade is thrown.
    if(type==='grenade'&&!preparedEntry(p,'grenade'))return this.fail('請先在背包預備手榴彈。');
    if(type==='move'){
      if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
      const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
      const edge=barrierBetween(this.barriers,p,{x,y});
      // Bumping a partition points it out so it can be shot, but it never steals a live enemy lock (3.54.1).
      if(edgeBlocks(edge)&&!vaultable(edge)){if(edge.type==='door')return true;
        if(this.enemies.some(e=>e.id===this.target&&e.hp>0))return this.fail('隔板阻擋通行。想破壞它，先點隔板鎖定。');
        this.target=edge.id;return this.fail('隔板阻擋通行，可開火破壞。');}
      if(!this.passable(x,y))return this.fail('前方有牆壁或障礙。');
      const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
      if(pinned(p)&&!this.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))return this.fail('壓制中無法移動。');
      if(ally){if(skillActive(p,'anchor'))return this.fail('下錨中無法移動，請先解除。');const reason=swapReason(this,ally);return !reason||this.fail(reason);}
      const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(e){this.target=e.id;if(!edgeBlocks(edge)&&this.bumpMeleeSlot()!==undefined&&this.visible(e)&&this.shotClear(p,e))return true;return this.fail('敵人擋住去路，先開火。');}return !skillActive(p,'anchor')||this.fail('下錨中無法移動，請先解除。');
    }
    if(type==='recoverObjective')return this.nearbyObjectives.some(t=>t.id===arg)||this.fail('附近沒有可回收的機密資料。');
    if(type==='openContainer')return this.nearbyContainers.some(c=>c.id===arg)||this.fail('附近沒有可開啟的補給箱。');
    if(type==='door')return Boolean(arg&&typeof arg.open==='boolean'&&this.nearbyDoors.some(b=>b.id===arg.id&&b.open!==arg.open));
    if(type==='fire'){const e=this.targeted;if(!e)return this.fail('射線內沒有目標。');if(distance(p,e)>w.range)return this.fail('目標超出射程。');if(!this.shotClear(p,e)||(w.melee&&!w.thrust&&!isBarrier(e)&&!this.canCross(p,e)))return this.fail(this.attackStatus(p,e).reason==='target_corner_hidden'?'目標藏在轉角後，換個射擊位置。':'射線或近戰路徑被障礙物擋住。');return w.melee||p.ammo[p.weapon]>=(w.shotCost||1)||this.fail(p.ammo[p.weapon]>0?`彈匣不足 ${w.shotCost} 發，請裝填。`:'彈匣已空，請裝填。');}
    if(type==='reload')return !w.melee&&(p.ammo[p.weapon]<w.mag&&p[this.reserveKey()]>0)||this.fail('彈匣已滿或沒有對應備彈。');
    // Consumables (3.106.0). Adrenaline is free to use but may never be the thing that kills you; the reasons
    // live in itemUseReason so the pack can grey the same buttons this would refuse.
    if(type==='deployCover'){const reason=deployCoverReason(this,arg);return !reason||this.fail(reason+'。');}
    if(type==='flare'){const reason=flareReason(this,arg);return !reason||this.fail(reason+'。');}
    // 3.144.0 (src/field-gear.js): the decoy is thrown like a flare, the mine laid within three tiles.
    if(type==='decoy'){const reason=decoyReason(this,arg);return !reason||this.fail(reason+'。');}
    if(type==='mine'){const reason=mineReason(this,arg);return !reason||this.fail(reason+'。');}
    if(type==='rope'){const reason=lineReason(this,arg);return !reason||this.fail(reason+'。');}
    if(type==='launch'){const reason=launchReason(this,arg);return !reason||this.fail(reason+'。');}
    if(ITEM_BY_ACTION[type]){const reason=itemUseReason(this,ITEM_BY_ACTION[type]);return !reason||this.fail(reason+'。');}
    if(type==='grenade')return (p[preparedEntry(p,'grenade').resource]>0&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&distance(p,arg)<=5&&this.grid[arg.y]?.[arg.x]===1&&this.visible(arg))||this.fail('需要手榴彈與視線內 5 格的有效落點。');
    if(type==='weapon')return (p.owned.includes(Number(arg))&&Number(arg)!==p.weapon)||this.fail('無法換裝此武器。');
    if(type==='salvage')return (p.owned.includes(Number(arg))&&p.owned.length>1&&!this.weaponAt(Number(arg)).locked)||this.fail('無法拆解此武器。');
    if(type==='takeWeapon')return (Boolean(this.nearbyWeapon(Number(arg)))&&p.owned.length<this.weaponCapacity)||this.fail('附近沒有這把武器或背包已滿。');
    if(type==='salvageGround')return (Boolean(this.nearbyWeapon(Number(arg)))&&!this.weaponAt(Number(arg)).locked)||this.fail('附近沒有這把武器，或它不能拆解。');
    if(type==='replaceWeapon')return (Boolean(this.nearbyWeapon(arg?.take))&&p.owned.includes(arg?.leave)&&!this.weaponAt(arg.leave).locked)||this.fail('要交換的武器已不在原處。');
    if(type==='upgrade')return this.fail('武器改裝只能在補給終端進行。');   // 3.120.0: bought at a terminal, for any weapon
    if(type==='terminal'){const reason=terminalReason(this,arg);return !reason||this.fail(reason);}
    if(type==='interact'&&pinned(p))return this.fail('壓制中無法換層。');
    if(type==='interact'&&skillActive(p,'anchor'))return this.fail('下錨中無法換層，請先解除。');
    if(type==='interact')return (this.canTouch(this.exitPoint)&&!this.exitBlocked)||this.fail(this.exitBlocked||'需要靠近綠色電梯。');
    return type==='wait';
  }
  action(type,arg){
    if(type==='guard')type='wait';
    if(this.status!=='playing'||this.pendingPerks)return false;
    this.effects=[];const p=this.player;this.pursuitPending=false;this.pursuitBlocked=Boolean(this.shadowSteps||this.shadowBonus);if(p.control.disabled)this.pursuit=0;
    if(type==='usePrepared'){
      const entry=preparedEntry(p,arg?.category);if(!entry?.action)return this.fail('請先在背包預備可用項目。');
      type=entry.action;arg=type==='skill'?p.prepared.skill:arg.target;
    }
    if(type==='weapon'&&arg===undefined)arg=p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length];
    if(type==='grenade'){const pos=arg||this.targeted;arg=pos?{x:pos.x,y:pos.y,grenade:p.prepared.grenade}:null;}
    if(type==='fire'&&this.weapon.pointTarget){const t=this.targeted,pos=arg||(isBarrier(t)?barrierFace(t,p):t);type='launch';arg=pos?{x:pos.x,y:pos.y}:null;}
    if(type==='move'&&this.shadowSteps>0)return p.control.disabled?this.fail('失能中無法使用影步。'):this.shadowMove(arg);
    // Tapping adrenaline while free moves are still running would silently charge the health twice, so refuse before
    // the forfeit rule below takes them away (3.106.0).
    if(type==='surge'&&this.shadowSteps>0)return this.fail('免費移動還沒用完。');
    if(this.shadowSteps>0){this.shadowSteps=0;this.pursuit=0;}
    if(!this.validateAction(type,arg))return false;
    if((p.control.disabled||p.recovery)&&type!=='prepare'&&type!=='meleeChoice'&&this.actionCost(type,arg)===0)return this.fail(p.recovery?'鏈鋸收勢中，按中央等待。':'失能中，按中央等待恢復。');
    if(type==='move'){
      const point={x:p.x+arg[0],y:p.y+arg[1]},edge=barrierBetween(this.barriers,p,point);
      if(edgeBlocks(edge)&&edge.type==='door'){type='door';arg={id:edge.id,open:true};}
      else {const enemy=this.enemies.find(e=>e.hp>0&&e.x===point.x&&e.y===point.y),slot=this.bumpMeleeSlot();
        if(enemy&&slot!==undefined){type='bumpMelee';arg={id:enemy.id,x:enemy.x,y:enemy.y,slot};}}
    }
    if(type==='skill'&&arg==='suppressive_fire')return this.fail('壓制射擊需要區域落點。');
    if(type==='skill'&&arg==='grapple'){type='grapple';arg={id:this.target};}
    // Free preparation/equipment commits outside the turn queue and preserves all timed state.
    if(this.actionCost(type,arg)===0){
      if(type==='prepare')this.setPrepared(arg.category,arg.id);
      else if(type==='weapon'){p.weapon=Number(arg);this.log(`切換至${this.weapon.name}，不耗回合。`);}
      else if(type==='reload')return this.reload();
      else if(type==='skill')return this.activateSkill(arg);
      else if(type==='commandPet')return commandPet(this,arg);
      else if(type==='learn'||type==='dismantleLearning')return useLearning(this,arg,type==='dismantleLearning');
      else if(type==='surge')return this.surge();
      else if(type==='rope')return presentStep(this,()=>this.fireLine(arg));
      else if(type==='setPetOutput'){p.petBond.outputChoice=arg.kind;return true;}
      else if(type==='meleeChoice'){p.meleeSlot=arg;this.log(arg===null?'撞擊時改用背包裡第一把近戰武器。':`撞擊時使用${this.weaponAt(arg).name}。`);return true;}
      return true;
    }
    if(this.pursuit&&!p.recovery&&['fire','launch','bumpMelee','grenade','grapple','suppressiveFire'].includes(type)){
      this.pursuit=0;const intent=type==='fire'?{id:this.target,x:this.targeted.x,y:this.targeted.y}:arg;
      const success=this.executePlayer(type,intent);p.guard=false;p.focus=false;p.evasive=false;p.moved=success&&type==='grapple'&&p.moved;
      this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';}this.finishPursuit();return success;
    }
    this.pursuit=0;
    const doubleAttack=skillActive(p,'anchor')&&['fire','bumpMelee','suppressiveFire'].includes(type),previousChain=p.fireChain?{...p.fireChain}:null;
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
    this.turn++;tickTongues(this);tickPounces(this);tickFields(this);
    // 3.145.0 (user decision): suppression halves when the unit's own turn is over, player and enemies alike, so the
    // stacks it took since its last turn are all felt on this one. The `finally` runs on every skip (`continue`) too:
    // a stunned unit's turn has still passed. A unit with two slots (an anchored double attack) halves after the last.
    const lastSlot=new Map(queue.map(({actor},slot)=>[actor,slot]));
    for(const [slot,{actor,speed,anchorExtra=false}] of queue.entries()){
      if(p.hp<=0||this.status!=='playing'||this.floor!==floor)break;
      try{
      if(actor.hp<=0||actor.kind&&(actor.status!=='active'||actor.floor!==this.floor))continue;
      if(actor===p&&playerStunned)continue;
      actor.vaultExposed=false;
      if(actor===p&&recovering){playerStunned=true;p.fireChain=null;this.log('鏈鋸收勢：本次行動跳過。',true);continue;}
      if(skipDisabled(actor)){if(actor===p){playerStunned=true;this.log('失能：本次行動跳過，未消耗彈藥或道具。',true);}continue;}
      const immunityBefore=actor.control?.immune||0;
      if(actor===p){
        if(doubleAttack&&!anchorExtra&&type==='fire')p.fireChain=previousChain?{...previousChain}:null;
        if(type==='fire')this.target=fireIntent.id; // Track identity, never switch to another enemy.
        const success=type==='move'?presentStep(this,()=>this.executePlayer(type,arg)):this.executePlayer(type,fireIntent||arg);
        if(!success)this.log('局勢已改變，行動未能完成；本回合已消耗。');
        p.guard=success&&type==='wait';p.moved=success&&(type==='move'||type==='grapple'&&p.moved);p.focus=success&&type==='wait';p.evasive=success&&type==='wait';
        petReactions(this);this.reveal();checkMines(this);
      }else if(actor.kind){const wasIn=inToxic(this,actor);presentStep(this,()=>{if(isMunition(actor))munitionAct(this,actor);else if(isBomber(actor))bomberAct(this,actor);else allyAct(this,actor);this.reveal();},actor);toxicAllyTurn(this,actor,wasIn);}
      else if(actor.hp>0&&actor.alert)presentStep(this,()=>{this.enemyAct(actor);checkMines(this);},speed!==0||playerSpeed!==0||phase!==null?actor:null);
      if(immunityBefore&&!anchorExtra)actor.control.immune=Math.max(0,actor.control.immune-1);
      }finally{if(lastSlot.get(actor)===slot)tickSuppression(actor);}
    }
    if(this.floor===floor&&this.status==='playing'&&p.hp>0){
      const due=this.marks.filter(m=>m.due<=this.turn);this.marks=this.marks.filter(m=>m.due>this.turn);
      for(const m of due){if(p.hp<=0)break;presentStep(this,()=>this.explode(m,m.radius??1,m.damage??scaleEnemy(38,this.floor,'damage',this.difficultySpec)));}
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>resolveRetreatWave(this));
      if(p.hp>0)presentStep(this,()=>this.environmentTurn());
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>tickNests(this));
      if(p.hp>0&&!isSimulation(this))presentStep(this,()=>tickSwarmWaves(this));
    }
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickPetBond(this))this.reveal();});
    // Summons rise before skills tick, so the interval counts the rising turn like the old cast did.
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickSummons(this))this.reveal();});
    tickSpirit(this);tickSkills(p);if(!skillActive(p,'early_warning'))this.sensorContacts=[];
    this.smoke=this.smoke.filter(s=>s.expires>this.turn);
    this.flares=(this.flares||[]).filter(f=>f.expires>this.turn);
    tickDecoy(this);
    expireExposure([p,...this.enemies,...this.allies],this.turn);
    for(const actor of [p,...this.enemies,...this.activeAllies])tickTraits(actor);
    // 3.127.0: rebels taunt their cowards before the player gets control, so the boosts show on the target cards.
    if(this.status==='playing'&&p.hp>0)rebelMorale(this);
    this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';this.log('生命訊號中斷。',true);}
    // 3.127.2 (user decision): warnings count down after everything else in the turn, so one raised at any point of a
    // turn — during your move, the enemy phase or the closing look — comes back exactly five turns later, not four.
    tickCivilianCooldowns(this);tickAlarms(this);
    this.finishPursuit();return true;
  }
  finishPursuit(){
    if(this.pursuitPending&&!this.pursuitBlocked&&!this.shadowSteps&&!this.player.control.disabled&&!this.player.recovery&&this.player.hp>0&&this.status==='playing'){this.pursuit=1;this.log('追擊就緒：下一次攻擊不耗回合。');}
    if(this.shadowSteps||this.player.control.disabled||this.player.recovery||this.player.hp<=0||this.status!=='playing')this.pursuit=0;
    this.pursuitPending=false;this.pursuitBlocked=false;
  }
  activateSkill(id){
    return presentStep(this,()=>{
      if(ALLY_SKILLS.includes(id))return useAllySkill(this,id);
      if(id==='anchor'){
        if(!toggleAnchor(this.player))return false;
        this.effects.push({type:'pulse',from:{x:this.player.x,y:this.player.y},to:{x:this.player.x,y:this.player.y},radius:.6,color:'#e6c281',damage:0});
        this.log(skillActive(this.player,'anchor')?'下錨完成：固定位置，攻擊於普通與緩速各一次。':'下錨已解除，可以移動。');return true;
      }
      const p=this.player,def=skillValues(p,id);p.skillState[id]={remaining:def.duration,cooldown:def.cooldownAfterEffect?0:def.cooldown};
      // 3.143.0 (user, 2026-09-19): the scan no longer alerts the enemies it finds or hands them your position.
      if(id==='early_warning'){this.sensorContacts=this.enemies.filter(e=>e.hp>0&&distance(p,e)<=def.radius).map(e=>{if(classPerkRank(p,'soldier_marked'))grantTrait(e,'exposed','skill:early_warning',2);return {x:e.x,y:e.y};});this.log(`預警取得 ${this.sensorContacts.length} 個位置。`,true);}
      this.effects.push({type:'pulse',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},radius:.6,color:'#8ae9da',damage:0});
      this.log(`${def.name}啟動：持續 ${def.duration} 回合，冷卻 ${def.cooldown} 回合。`);this.reveal();return true;
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
        this.log(on&&off?`脫下${off.name}，換上${on.name}。`:on?`戴上${on.name}。`:`脫下${off?.name||'裝備'}。`);
        success=true;break;
      }
      case 'feedPet': return presentStep(this,()=>feedPet(this,arg));
      case 'move': {
        if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
        if(pinned(p))return this.fail('壓制中無法移動。');
        if(skillActive(p,'anchor'))return this.fail('下錨中無法移動。');
        const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
        const edge=barrierBetween(this.barriers,p,{x,y});
        if(!this.canCross(p,{x,y})&&!vaultable(edge))return this.fail('前方障礙物已阻擋移動。');
        if(!this.passable(x,y))return this.fail(this.solid(x,y)?'掩體或油桶擋住去路。可以繞行或射擊破壞。':'前方是牆壁。');
        const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
        if(e){this.target=e.id;return this.fail('敵人擋住去路，先開火。');}
        // Re-check the swap at resolution; a faster enemy may have disabled the ally in the meantime.
        const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
        if(ally){if(swapReason(this,ally))return false;swapWithPlayer(this,ally);}
        p.vaultExposed=vaultable(edge);if(p.vaultExposed)this.log('翻越矮隔板：至下次自身行動前，被射擊命中 +20。',true,'翻越矮隔板，暫時暴露。');
        p.x=x;p.y=y;p.facing=[dx,dy];p.moveDelta=[dx,dy];this.pickup();success=true;break;
      }
      case 'buildUnit':success=presentStep(this,()=>buildUnit(this,arg.blueprint,arg.payload,arg.weapon));break;
      case 'skill':success=this.activateSkill(arg);break;
      case 'grapple':success=useGrapple(this,arg.id);break;
      case 'deployUnit':success=presentStep(this,()=>deployUnit(this,arg.line,workshopPoint(arg)));break;
      case 'repairUnit':success=presentStep(this,()=>repairUnit(this,arg));break;
      case 'recoverObjective':success=this.recoverObjective(arg);break;
      case 'openContainer':success=presentStep(this,()=>this.openContainer(arg));break;
      case 'door':success=presentStep(this,()=>{const b=this.nearbyDoors.find(b=>b.id===arg.id);return this.setDoor(b,arg.open);});break;
      case 'bumpMelee': this.target=arg.id;success=this.strike(arg,arg.slot);break;
      case 'fire': success=this.fire(arg);break;
      case 'suppressiveFire':success=suppressiveFire(this,arg);break;
      case 'reload': success=this.reload();break;
      case 'heal':
        if(p.meds<=0)return this.fail('醫療包已用盡。');
        if(p.hp===p.maxHp&&p.poison===0)return this.fail('生命值已滿。');
        p.meds--;const recovered=healActor(p,45,p.healBonus);clearPoison(p);
        this.log(`使用醫療包，回復 ${recovered} 生命並清除中毒。`);success=true;break;
      case 'plate': {
        if(p.sprays<=0)return this.fail('修復噴劑已用盡。');
        const room=this.plateCapacity-(p.plates||0);
        if(room<=0)return this.fail('護甲板已滿。');
        p.sprays--;const gained=Math.min(SPRAY_PLATES,room);p.plates=(p.plates||0)+gained;
        this.log(`使用修復噴劑，護甲板 +${gained}。`);success=true;break;
      }
      case 'launch': success=presentStep(this,()=>this.launch(arg));break;
      case 'deployCover': {
        const reason=deployCoverReason(this,arg);
        if(reason)return this.fail(reason+'。');
        const spot={x:p.x+arg[0],y:p.y+arg[1]},dead=barrierBetween(this.barriers,p,spot);
        const built=makeBarrier(DEPLOY_COVER,p,spot,dead?.id||`edge-deploy-${this.floor}-${spot.x}-${spot.y}-${p.x!==spot.x?'x':'y'}`);
        // Rebuilding over a wreck keeps its id and edge, so the barrier list can never grow a duplicate.
        if(dead)Object.assign(dead,built);else this.barriers.push(built);
        p.barricades--;p.facing=[arg[0],arg[1]];
        this.log('架起摺疊掩體。');success=true;break;
      }
      case 'grenade': success=presentStep(this,()=>this.throwGrenade(arg||this.targeted));break;
      case 'flare': success=presentStep(this,()=>this.throwFlare(arg));break;
      case 'decoy': success=presentStep(this,()=>throwDecoy(this,arg));break;
      case 'mine': success=presentStep(this,()=>placeMine(this,arg));break;
      case 'rope': success=presentStep(this,()=>this.fireLine(arg));break;
      case 'weapon': {
        const index=arg===undefined?p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length]:Number(arg);
        if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
        if(index===p.weapon)return this.fail('已裝備此武器。');
        p.weapon=index;this.log(`切換至${this.weapon.name}。`);success=true;break;
      }
      case 'salvage':success=this.salvage(Number(arg));break;
      case 'takeWeapon':success=this.takeWeapon(Number(arg));break;
      case 'salvageGround':success=this.salvageGround(Number(arg));break;
      case 'replaceWeapon':success=this.replaceWeapon(arg);break;
      case 'terminal':success=this.useTerminal(arg);break;   // the method, so a simulation can refuse it
      case 'wait':this.log('防禦待機：直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15。',false,'防禦待機，穩定瞄準。');success=true;break;
      case 'interact':success=this.descend(false);return success;
      default:return false;
    }
    return success;
  }
  // Adrenaline (3.106.0, user request): the ninja's free steps for everyone else, paid for in health. Movement only,
  // and any other action forfeits what is left — both rules come from 影步 and are what keep free actions honest.
  surge(){
    const p=this.player;
    if(p.adrenaline<=0)return this.fail('腎上腺素已用盡。');
    if(p.hp<=SURGE_COST)return this.fail('生命不足以承受腎上腺素。');
    p.adrenaline--;p.hp-=SURGE_COST;this.shadowSteps=SURGE_STEPS;this.pursuit=0;
    this.log(`腎上腺素：生命 −${SURGE_COST}，可免費移動 ${SURGE_STEPS} 格。`,true);
    return true;
  }
  reload(){
    if(this.weapon.melee)return this.fail('近戰武器無須裝填。');
    const p=this.player,need=this.weapon.mag-p.ammo[p.weapon],reserve=this.reserveKey();
    if(need<=0)return this.fail('彈匣已滿。');
    if(p[reserve]<=0)return this.fail('沒有對應備彈。探索補給箱或切換武器。');
    const amount=Math.min(need,p[reserve]);p.ammo[p.weapon]+=amount;p[reserve]-=amount;
    this.log(`裝填完成，補充 ${amount} 發${this.actionCost('reload')===0?'，不耗回合':''}。`);return true;
  }
  // No hit roll: the round lands on the chosen tile and the blast decides who is caught, which is what makes the launcher
  // a crowd weapon rather than a single-target one that loses its whole area effect on a miss.
  launch(pos){
    const reason=launchReason(this,pos);if(reason)return this.fail(reason+'。');
    const p=this.player,w=this.weapon;
    p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
    this.recordExposure(p,pos);p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
    const range=this.weaponDamage(p.weapon),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
    this.effects.push({type:'shot',weaponId:w.id,style:'grenade',from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    const before=this.enemies.map(o=>[o,o.hp]);
    this.explode(pos,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)),p);
    const hits=new Set(before.filter(([o,hp])=>o.hp<hp).map(([o])=>o));
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    p.fireChain=null;
    this.log(hits.size?`榴彈落地爆炸，波及 ${hits.size} 名敵人。`:'榴彈落地爆炸。');
    return true;
  }
  // 3.112.0 (user request): one shell, every enemy and ally the cone reaches. 3.141.0 (user decisions 2026-09-19): each
  // takes the pellets its distance allows, every pellet rolling a flat chance and its own damage (src/shotgun.js).
  fireCone(aim){
    const p=this.player,w=this.weapon;
    if(p.ammo[p.weapon]<=0)return this.fail('彈匣已空，請裝填。');
    p.facing=[Math.sign(aim.x-p.x),Math.sign(aim.y-p.y)];
    const targets=coneTargets(this,p,aim,w),hits=new Set();
    presentStep(this,()=>{
      this.recordExposure(p,aim);p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
      if(!targets.length){
        this.effects.push({type:'shot',weaponId:w.id,style:'bullet',from:{x:p.x,y:p.y},to:{x:aim.x,y:aim.y},damage:0,miss:true});
        this.log('霰彈沒有打中任何目標。',false,'霰彈落空。');return;
      }
      for(const o of targets){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const {count,min,max}=this.pelletDamage(p.weapon,o),chance=pelletChance(w,toxicShot(this,p,o,w)),landed=[];
        for(let i=0;i<count;i++)if(this.rng()*100<chance)landed.push(min+Math.floor(this.rng()*(max-min+1)));
        this.effects.push({type:'shot',weaponId:w.id,style:'bullet',from:{x:p.x,y:p.y},to:{x:o.x,y:o.y},damage:0,miss:!landed.length});
        const foe=this.enemies.includes(o),name=foe?enemyName(o):'友軍';
        this.log(landed.length?`${landed.length}/${count} 顆彈丸打中${name}。`:`彈丸全數落空（${count} 顆）。`,false,landed.length?`彈丸打中${name}。`:'彈丸落空。');
        if(!landed.length)continue;
        if(foe){const before=o.hp;this.hitTarget(o,landed.reduce((a,b)=>a+b,0),p,w.pierce||0,w,landed);if(o.hp<before)hits.add(o);}
        else this.damageAlly(o,landed.reduce((a,b)=>a+b,0),p);
      }
    });
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    const primary=this.targeted;
    if(primary&&this.enemies.includes(primary))recordShot(p,primary.id,this.turn);else p.fireChain=null;
    return true;
  }
  fire(intent=null) {
    const p=this.player,e=this.targeted,w=this.weapon;
    if(w.melee)return w.thrust?this.thrust(intent):this.strike(intent);
    // A committed shot still fires at the last confirmed tile if its target is lost.
    if(intent&&w.cone&&(!e||distance(p,e)>w.range||!this.shotClear(p,e)))return this.fireCone(intent);
    if(intent&&(!e||distance(p,e)>w.range||!this.shotClear(p,e))){
      p.facing=[Math.sign(intent.x-p.x),Math.sign(intent.y-p.y)];
      const cost=w.shotCost||1,singleShot=singleShotAt(w,distance(p,e||intent)),shots=volleyShots(w,distance(p,e||intent),p.ammo[p.weapon]);
      for(let i=0;i<shots;i++)presentStep(this,()=>{
        this.recordExposure(p,intent);p.ammo[p.weapon]-=roundCost(w,i);p.stats.shots++;spentCase(this,p,w.ammoType);
        this.effects.push({type:'shot',weaponId:w.id,singleShot,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:intent.x,y:intent.y},damage:0,miss:true,color:w.ammoType==='energy'?'#8ae9da':null});
      });
      if(this.enemies.some(e=>e.id===intent.id))recordShot(p,intent.id,this.turn);else p.fireChain=null;
      this.log(`原目標已失去有效射線，向最後確認位置開火落空，消耗 ${w.volleyCost?w.volleyCost:shots*cost} 發。`);
      return true;
    }
    if(!e)return this.fail('射線內沒有目標。');
    if(distance(p,e)>w.range)return this.fail('目標超出射程，靠近再開火。');
    if(p.ammo[p.weapon]<=0)return this.fail('彈匣已空，請裝填。');
    if(p.ammo[p.weapon]<(w.shotCost||1))return this.fail(`彈匣不足 ${w.shotCost} 發，請裝填。`);
    if(this.enemies.includes(e))noticeAttack(this,e);
    // Doors, cover and barrels are still breached one at a time; an enemy gets the cone.
    if(w.cone&&this.enemies.includes(e))return this.fireCone(e);
    if(w.lance&&this.enemies.includes(e))return this.fireLance(e);
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    const singleShot=singleShotAt(w,distance(p,e||intent)),shots=volleyShots(w,distance(p,e||intent),p.ammo[p.weapon]);
    let rounds=0;const hits=new Set();
    for(let i=0;i<shots;i++) {
      if(e.hp<=0||p.hp<=0)break;
      presentStep(this,()=>{
        const round=rounds;this.recordExposure(p,e);p.ammo[p.weapon]-=roundCost(w,round);p.stats.shots++;rounds++;spentCase(this,p,w.ammoType);
        const range=this.weaponDamage(p.weapon,e),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
        const chance=this.fireChance(e);
        const hit=this.rng()*100<chance;
        this.effects.push({type:'shot',weaponId:w.id,singleShot,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:w.ammoType==='energy'?'#8ae9da':null});
        if(!hit){this.log(`射擊未命中（命中率 ${chance}%）。`,false,'射擊未命中。');if(w.explosive)this.log('榴彈偏離目標，未在戰場內爆炸。');return;}
        hits.add(e);const before=this.enemies.map(o=>[o,o.hp]);
        if(w.explosive)this.explode(isBarrier(e)?barrierFace(e,p):e,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)),p);
        else this.hitTarget(e,damage,p,w.pierce||0);
        if(w.splash)for(const other of this.enemies.filter(o=>o.hp>0&&o!==e&&distance(o,e)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*.45),p,w.pierce||0);
        // 3.141.0 爆裂 (drop-only plasma affix): the hit bursts where it lands. The target already took the hit; everything
        // one tile away, you and your allies too, takes half of it (an explosion loses 10 a tile), plus 爆破專家.
        if(w.blast){this.log('電漿在命中處爆裂。');this.explode(isBarrier(e)?barrierFace(e,p):e,1,Math.round(damage*w.blast)+10+p.blastBonus,p,this.enemies.filter(o=>o!==e));}
        for(const [other,hp] of before)if(other.hp<hp)hits.add(other);
      });
    }
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),rounds,0,this);
    if(this.enemies.includes(e))recordShot(p,e.id,this.turn);else p.fireChain=null;
    return true;
  }
  // 3.141.0 貫穿 (drop-only plasma affix, src/lance.js): one beam, and every visible unit on it rolls its own hit;
  // whatever stopped the beam past it takes the hit. 3.142.1 (user, after the playtest): every unit rolls against the
  // chance of the shot the player aimed, the locked target's, so darkness or cover further down the beam cannot turn the
  // line into misses.
  fireLance(e){
    const p=this.player,w=this.weapon,cost=w.shotCost||1,{units,stop,end}=lancePath(this,p,e,w.range),hits=new Set();
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    presentStep(this,()=>{
      this.recordExposure(p,e);p.ammo[p.weapon]-=cost;p.stats.shots++;spentCase(this,p,w.ammoType);
      this.effects.push({type:'shot',weaponId:w.id,singleShot:true,style:'plasma',from:{x:p.x,y:p.y},to:{x:end.x,y:end.y},damage:0,miss:false,color:'#8ae9da'});
      const roll=o=>{const range=this.weaponDamage(p.weapon,o);return range.min+Math.floor(this.rng()*(range.max-range.min+1));};
      let friends=0;const chance=this.fireChance(e);
      for(const [n,o] of units.entries()){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const damage=roll(o),hit=this.rng()*100<chance;
        if(!hit){this.log(`光束沒打中第 ${n+1} 個：${this.enemies.includes(o)?enemyName(o):'友軍'}（命中率 ${chance}%）。`,false,'光束沒有打中。');continue;}
        if(this.activeAllies.includes(o)){this.damageAlly(o,damage,p);friends++;continue;}
        const before=o.hp;this.hitTarget(o,damage,p,w.pierce||0);if(o.hp<before)hits.add(o);
      }
      if(stop)this.hitTarget(stop,roll(stop),p,w.pierce||0);
      this.log(`貫穿光束打中直線上 ${hits.size} 名敵人${friends?`、${friends} 名友軍`:''}。`,false,'貫穿光束射出。');
    });
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    if(this.enemies.includes(e))recordShot(p,e.id,this.turn);else p.fireChain=null;
    return true;
  }
  strike(intent=null,slot=this.player.weapon) {
    const p=this.player,w=this.weaponAt(slot),target=this.targeted;
    if(!w.melee)return false;
    if(!intent&&(!target||distance(p,target)>1))return this.fail('近戰需要相鄰一格的目標。');
    const valid=target&&distance(p,target)<=1&&this.shotClear(p,target)&&(isBarrier(target)||this.canCross(p,target)),to=valid?target:intent;
    p.fireChain=null;p.facing=[Math.sign(to.x-p.x),Math.sign(to.y-p.y)];if(valid&&this.enemies.includes(target))noticeAttack(this,target);
    let landed=false,ambush=false;
    presentStep(this,()=>{
      ambush=!w.unarmed&&Boolean(valid)&&ambushReady(this,target);if(ambush&&!this.shadowBonus)shortenCamo(p);
      const chance=this.meleeAccuracy(p,target,w.hitChance),hit=Boolean(valid)&&this.rng()*100<chance;
      this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:to.x,y:to.y},damage:0,miss:!hit});
      if(!hit){this.log(valid?`近戰揮擊未命中（${chance}%）。`:'原目標已離開近戰範圍，揮擊落空。',false,valid?'近戰揮擊未命中。':'原目標已離開近戰範圍，揮擊落空。');return;}
      landed=true;
      // 3.136.0 (src/melee-weapons.js): claws bite harder on an unarmoured enemy; the sabre's blow splashes onto the
      // target's visible neighbours; the chainsaw costs your next action once it bites.
      const foe=this.enemies.includes(target),bare=w.bareBonus&&foe&&!(ENEMY_TYPES[target.type]?.armor>0)?1+w.bareBonus:1;
      const d=this.weaponDamage(slot),damage=Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1)*bare);this.hitTarget(target,damage,p,w.pierce||0,w);
      if(w.splash&&foe)for(const other of this.enemies.filter(o=>o.hp>0&&o!==target&&distance(o,target)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*w.splash),p,w.pierce||0,w);
      if(w.recovery){p.recovery=1;this.log(`${w.name}咬進目標：你會跳過下一次行動。`);}
      const shadow=classPerkRank(p,'ninja_shadowstep');if(ambush&&shadow&&!this.shadowBonus){this.shadowSteps=shadow>=2?2:1;this.log(`影步就緒：可免費移動 ${this.shadowSteps} 格。`);}
    });
    // 3.136.0 chainsaw: the rest of its cuts, each in a presentation step of its own so every number shows.
    if(landed&&w.hits>1&&this.enemies.includes(target))for(let i=1;i<w.hits&&target.hp>0&&p.hp>0;i++)presentStep(this,()=>{
      const d=this.weaponDamage(slot);this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:target.x,y:target.y},damage:0,miss:false});
      this.hitTarget(target,Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1)),p,w.pierce||0,w);
    });
    return true;
  }
  // 3.136.0: the spear in hand (src/melee-weapons.js). One thrust along a straight line out to two tiles; every unit on
  // it, friend or foe, rolls its own hit, like the shotgun's pellets. A locked door, cover or barrel is struck as well.
  thrust(intent=null){
    const p=this.player,w=this.weapon,e=this.targeted,aim=e&&distance(p,e)<=w.range&&this.shotClear(p,e)?e:intent;
    if(!aim)return this.fail('射線內沒有目標。');
    p.fireChain=null;p.facing=[Math.sign(aim.x-p.x),Math.sign(aim.y-p.y)];
    const units=thrustTargets(this,p,aim),objects=aim===e&&!this.enemies.includes(e)&&!this.activeAllies.includes(e)?[e]:[];
    presentStep(this,()=>{
      if(!units.length&&!objects.length){this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:aim.x,y:aim.y},damage:0,miss:true});this.log(`${w.name}刺空了。`,false,`${w.name}刺空。`);return;}
      for(const o of [...units,...objects]){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const foe=this.enemies.includes(o),ambush=foe&&ambushReady(this,o),chance=this.meleeAccuracy(p,o,w.hitChance),hit=this.rng()*100<chance;
        if(ambush&&!this.shadowBonus)shortenCamo(p);
        this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:o.x,y:o.y},damage:0,miss:!hit});
        if(!hit){this.log(`${w.name}刺擊未命中（${chance}%）。`,false,`${w.name}刺擊未命中。`);continue;}
        const d=this.weaponDamage(p.weapon),damage=Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1));
        if(this.activeAllies.includes(o))this.damageAlly(o,damage,p);else this.hitTarget(o,damage,p,w.pierce||0,w);
      }
    });
    return true;
  }
  shadowMove(delta){
    if(pinned(this.player))return this.fail('壓制中無法移動。');
    const p=this.player;if(!Array.isArray(delta)||delta.length!==2||!delta.every(Number.isInteger)||Math.abs(delta[0])+Math.abs(delta[1])!==1)return this.fail('影步需要選擇相鄰方向。');
    const point={x:p.x+delta[0],y:p.y+delta[1]},edge=barrierBetween(this.barriers,p,point);
    if(!this.passable(point.x,point.y)||!this.canCross(p,point)||vaultable(edge)||occupied(this,point))return this.fail('影步落點必須是沒有障礙與單位的平地。');
    presentStep(this,()=>{Object.assign(p,{x:point.x,y:point.y,facing:[...delta],moved:true,moveDelta:[...delta]});this.shadowSteps--;this.pickup();this.reveal();this.log(this.shadowSteps?`尚可免費移動 ${this.shadowSteps} 格。`:'免費移動結束。');});
    if(this.shadowSteps===0&&classPerkRank(p,'ninja_shadowstep')>=3){const target=[this.targeted,...this.enemies].find((e,i,a)=>e&&e.hp>0&&distance(p,e)<=1&&this.canCross(p,e)&&a.indexOf(e)===i);if(target){const slot=this.bumpMeleeSlot();if(slot!==undefined){const before=target.hp;this.target=target.id;this.shadowBonus=true;this.strike({id:target.id,x:target.x,y:target.y},slot);this.shadowBonus=false;if(before>0&&target.hp<=0){const cam=p.skillState?.camouflage;if(cam?.remaining)cam.remaining=Math.min(skillValues(p,'camouflage').duration,cam.remaining+CLASS_PERK_TUNING.shadowDuration);else if(cam)cam.cooldown=Math.max(0,cam.cooldown-CLASS_PERK_TUNING.shadowCooldown);}}}}
    return true;
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
    if(this.props.includes(target)||isBarrier(target)){if(weapon.ammoType==='energy')addTrace(this,target,'scorch');this.damageProp(target,raw,attacker);return;}
    const cover=weapon.melee?null:this.protectingCover(target,attacker),armor=ENEMY_TYPES[target.type]?.armor||0;
    let parts=pellets?pellets.map(d=>blade?Math.round(d*bladeMultiplier(attacker)):d):[raw];const scale=f=>{parts=parts.map(d=>d*f);};
    if(attacker===this.player&&!weapon.melee&&!this.sight(target,attacker))scale(1+classPerkRank(attacker,'recon_unseen')*CLASS_PERK_TUNING.unseen);if(attacker===this.player&&activeTrait(target,'exposed'))scale(1+classPerkRank(attacker,'soldier_marked')*CLASS_PERK_TUNING.markedDamage);
    // 3.142.0: the absorption line only when cover took something off; a fully piercing plasma shot goes straight through.
    if(cover){const effect=coverEffects(cover,target,attacker),cut=(pellets?weapon.pelletCover*effect.efficiency:effect.reduction)*(1-pierce);scale(1-cut);if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);if(cut>0)this.log('敵方掩體吸收了部分傷害。');}
    if(toxicShot(this,attacker,target,attacker===this.player||!attacker?.type?weapon:this.actorWeapon(attacker)))scale(.5);   // 3.134.0 mist
    let damage=parts.reduce((sum,d)=>sum+Math.max(1,Math.round(d-armor*(1-pierce))),0);
    if(weapon.ammoType==='energy'&&activeTrait(target,'mechanical'))damage=Math.round(damage*1.2);
    if(weapon.ammoType==='energy')addTrace(this,target,'scorch');
    const before=target.hp;this.hurt(target,reduceDirectDamage(target,damage),attacker);
    if(before>0&&target.hp<=0&&attacker?.kind==='pet')healActor(this.player,classPerkRank(this.player,'druid_symbiosis')*CLASS_PERK_TUNING.symbiosisHeal);
    petHit(this,attacker,target,Math.max(0,before-Math.max(0,target.hp)),weapon);
    if(attacker===this.player&&weapon.melee&&!weapon.unarmed)meleeReward(this,target,before);
  }
  // cause (3.142.1): damage nobody dealt (a hazard underfoot) says what it was instead of 命中, which reads as a shot.
  hurt(e,damage,attacker=null,cause=null) {
    if(e.hp<=0||!shotDamageAllowed(this,e))return;
    if(attacker===this.player)noticeAttack(this,e);
    const beforeHp=e.hp;e.hp-=damage;injuryCallout(this,e,beforeHp);if(damage>0)orderHit(this,e);this.player.stats.damage+=damage;if(damage>0)addTrace(this,e,activeTrait(e,'mechanical')?'oil':'blood');
    this.effects.push({type:'impact',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},damage,mechanical:ENEMY_TYPES[e.type]?.mechanical});
    if(cause)this.log(`${enemyName(e)}${cause}，受到 ${damage} 傷害。`,false,`${enemyName(e)}${cause}。`);else this.log(`命中${enemyName(e)}，造成 ${damage} 傷害。`,false,`命中${enemyName(e)}。`);
    if(e.hp>0)return;
    if(isNoncombatant(e)){this.log(enemyName(e)+'已倒下。');enemyDeath(this,e);return;}
    if(e.expendable&&attacker===this.player&&!this.shadowSteps&&!this.shadowBonus)this.pursuitPending=true;
    // 3.127.0: an enforcer's execution is not the player's kill, and a conscript pays out nothing.
    const executed=isEnforcer(attacker);
    if(!executed)this.player.kills++;if(!e.expendable&&!executed&&simulationUpgrades(this))this.player.xp+=enemyKillXp(e);
    if(!e.expendable&&!e.conscript&&!executed&&simulationDrops(this))this.player.scrap+=Math.round((isBossClass(e)?35:3)*(1+this.player.scavenger*.5))+classPerkRank(this.player,'engineer_salvage')*CLASS_PERK_TUNING.salvage;
    this.log(`${enemyName(e)}已消滅。`);if(missionTarget(this,e))this.log(this.missionSummary+'。');salvageBlueprint(this,e,attacker);
    // The number stops at MAX_LEVEL (3.52.0, user call). Past it the threshold stays at the level-20 cost and each
    // one hands over supplies instead of a pick, so the HUD can simply read MAX.
    const p=this.player;
    while(p.level<MAX_LEVEL&&p.xp>=levelCost(this,p.level)){p.xp-=levelCost(this,p.level);p.level++;if(activeTrait(p,'tactical_supply')){this.log('戰術配給：煙霧彈 +1。');this.receiveGrenade('smoke',1);}if(this.perkPicks+this.pendingPerks<perkLimit(p.level))this.pendingPerks++;}
    while(p.level>=MAX_LEVEL&&p.xp>=MAX_LEVEL+2){p.xp-=MAX_LEVEL+2;giveCapSupply(this);}
    enemyDeath(this,e);
    // A comrade gunned down in sight breaks the rebels who saw it; executions and self-destruction never do.
    if(attacker&&!this.enemies.includes(attacker))witnessDeath(this,e);
    if(isBossClass(e))this.awardProtocol(e.type,`${this.floor}:${e.id}`);
    if(e.reinforcement||e.expendable||e.conscript||!simulationDrops(this))return; // Retreat waves add pressure, not replacement supplies.
    const loot=enemyDef(e)?.loot;
    if(loot?.weapon!==undefined&&weaponUnlocked(WEAPONS[loot.weapon],this.unlockedWeapons)&&this.rng()<(loot.chance||0))this.dropEnemyWeapon(e,loot.weapon);
    if(this.floor>=RARE_ARMORY.minFloor&&loot?.rareWeapon!==undefined&&this.rng()<loot.rareChance)this.dropEnemyWeapon(e,loot.rareWeapon);
    if(this.rng()<ammoDropChance(this.player)){const type=loot?.ammo||'ammo';this.items.push({...this.enemyDropPoint(e),type,amount:type==='energy'?9:type==='ordnance'?2:type==='pistol'?18:type==='shell'?8:10});}
    if(this.rng()<.06)this.items.push({...this.enemyDropPoint(e),type:'med'});
    const plate=plateDrop(this.player,(ENEMY_TYPES[e.type]?.armor||0)>0);
    if(plate.chance>0&&this.rng()<plate.chance)this.items.push({...this.enemyDropPoint(e),type:'armor',amount:plate.amount});
    // 3.135.0 (user decisions): lines from any armed enemy and goggles from snipers, on fixed rolls of their own.
    const line=hasEnemyTag(e,'armed')?lineDrop(this.seed,this.floor,e.id):null;if(line)this.items.push({...this.enemyDropPoint(e),...line});
    if(enemyDef(e)?.dropsGoggles&&goggleDrop(this.seed,this.floor,e.id))this.items.push({...this.enemyDropPoint(e),type:'nvg'});
  }
  enemyDropPoint(e){
    // 3.127.2: a flyer killed above a cover prop must not leave its loot on a tile the player can never step on.
    const here={x:e.x,y:e.y};if(this.passable(here.x,here.y)&&!this.items.some(i=>distance(i,here)===0))return here;
    return DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(q=>this.passable(q.x,q.y)&&this.canCross(here,q)&&!occupied(this,q)&&!this.items.some(i=>distance(i,q)===0))||here;
  }
  dropEnemyWeapon(e,weapon){const item=this.registerWeapon({...this.enemyDropPoint(e),type:'weapon',weapon},true);this.items.push(item);this.log(`戰利品：${this.weaponAt(item.slot).name}留在屍體旁，靠近後可拾取。`);}
  damageProp(prop,damage,attacker=null) {
    if(prop.indestructible)return;
    if(prop.hp>0&&damage>0)addTrace(this,prop,'chip');
    if(isBarrier(prop)){
      if(prop.hp<=0||!BARRIER_TYPES[prop.type].destructible)return;prop.hp=Math.max(0,prop.hp-Math.ceil(damage));if(!prop.hp)addTrace(this,prop,'debris');
      this.effects.push({type:'impact',from:{x:prop.x,y:prop.y},to:{x:prop.x,y:prop.y},damage:Math.ceil(damage),mechanical:true});
      this.log(`${barrierName(prop)}${prop.hp?`耐久剩 ${prop.hp}。`:'已摧毀，通道打開。'}`,false,`${barrierName(prop)}${prop.hp?'受損。':'已摧毀，通道打開。'}`);this.reveal();return;
    }
    if(prop.hp<=0)return;
    prop.hp-=damage;
    if(prop.hp>0)return;
    if(prop.type==='nest'){collapseNest(this,prop);return;}
    addTrace(this,prop,'debris');
    if(isRigged(prop)){this.detonateCase(prop,attacker);return;}
    this.log(prop.type==='barrel'?'油桶被引爆！':prop.type==='nest'?'巢穴已摧毀，停止產出。':'掩體已摧毀。');
    if(prop.type==='barrel')this.explode(prop,2,45,attacker);
    if(prop.style)this.reveal();
  }
  // A rigged case goes off where it stands, with a player frag's numbers; whatever was inside is destroyed either way,
  // so shooting it from range costs the supplies but not your health (3.100.0, user request).
  detonateCase(c,attacker=null){
    const lost=c.contents.length;c.contents=[];c.opened=true;c.hp=0;
    this.log(`${containerName(c)}裝了引信——爆炸！${lost?'裡面的補給全毀。':''}`);
    this.explode(c,RIG_TUNING.radius,FRAG_DAMAGE,attacker);
    return true;
  }
  // 3.123.0: see src/flares.js. The light is judged live from the flare's tile, so only the tile and its end are kept.
  throwFlare(pos){
    const reason=flareReason(this,pos);if(reason)return this.fail(reason+'。');
    const p=this.player;p.flares--;p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
    this.effects.push({type:'shot',style:'grenade',color:'#ffd27a',from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    this.flares=[...(this.flares||[]),{x:pos.x,y:pos.y,expires:this.turn+FLARE_TUNING.duration-1}].slice(-FLARE_TUNING.maxActive);
    this.log(`照明彈點亮，持續 ${FLARE_TUNING.duration} 輪：範圍內的暗處失去命中懲罰，敵我皆同。`);return true;
  }
  // 3.135.0 grapple lines (src/lines.js): one straight pull to the chosen tile, then whatever lies there is picked up.
  fireLine(arg){
    const reason=lineReason(this,arg);if(reason)return this.fail(reason+'。');
    const p=this.player,item=LINE_ITEMS[arg.item],from={x:p.x,y:p.y},to={x:arg.x,y:arg.y};
    p[item.resource]--;Object.assign(p,to);p.moved=true;p.moveDelta=[Math.sign(to.x-from.x),Math.sign(to.y-from.y)];p.facing=[...p.moveDelta];
    p.cornerExposure=null;p.fireChain=null;p.guard=false;p.focus=false;p.evasive=false;
    this.effects.push({type:'tonguePull',sourceId:'player',from,to:{...to},origin:{...to},damage:0});
    this.log(`${PREPARED_CATALOG.item[arg.item].name}把你拉了過去。`);this.pickup();this.reveal();return true;
  }
  flareLit(point){return Boolean(this.flares?.length)&&this.flares.some(flare=>flareLights(this,flare,point));}
  throwGrenade(pos) {
    const p=this.player,id=pos?.grenade??p.prepared.grenade,def=GRENADES[id];
    if(!def||p[def.resource]<=0)return this.fail('預備的投擲物已用盡。');
    if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||this.grid[pos.y]?.[pos.x]!==1)return this.fail('先選擇可見地板或敵人作為投擲位置。');
    if(distance(p,pos)>5||!this.visible(pos))return this.fail('投擲位置需在視線內 5 格以內。');
    p[def.resource]--;p.stats.grenades++;this.log(`投擲${def.name}。`);
    this.effects.push({type:'shot',style:'grenade',color:def.color,from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    this.applyThrowable(id,pos,Math.round((FRAG_DAMAGE+p.blastBonus)*bladeMultiplier(p)),p);
    return true;
  }
  // Resolves a throwable at pos: thrown grenades and, since 3.92.0, loitering munitions (docs/ENGINEER.md 4.1).
  applyThrowable(id,pos,fragDamage,attacker){
    const p=this.player,def=GRENADES[id];
    if(id==='frag')this.explode(pos,2,fragDamage,attacker);
    else {
      const cells=areaCells(this.grid,pos,2,this.barriers,this),affected=new Set(cells.map(key));
      this.effects.push({type:'pulse',radius:2,color:def.color,from:{x:pos.x,y:pos.y},to:{x:pos.x,y:pos.y}});
      if(id==='smoke'){this.smoke=[...this.smoke,{cells,expires:this.turn+SMOKE_DURATION-1}];this.log('煙霧展開：阻斷無紅外線者的視線，爆炸仍可傷害。');}
      else for(const actor of [p,...this.enemies,...this.activeAllies])if(affected.has(key(actor))&&applyDisruption(actor,def.keyword)){
        if(actor!==p)actor.alert=true;
        this.log(`${actor===p?'你':actor.kind?allyName(actor):enemyName(actor)}失能：跳過 ${actor.control.disabled} 次行動。`,actor===p,`${actor===p?'你':actor.kind?allyName(actor):enemyName(actor)}陷入失能。`);
      }
      this.reveal();
    }
  }
  explode(center,radius,damage,attacker=null,eligible=null) {
    const origin={x:center.x,y:center.y};
    this.effects.push({type:'blast',from:origin,to:origin,damage:0,radius});
    const affected=p=>distance(origin,p)<=radius&&lineOfSight(objectSightGrid(this,origin,p),origin,p,this.barriers,'blast');
    // Freeze shielding for this blast before destroying any of its barriers.
    for(const cell of areaCells(this.grid,origin,radius,this.barriers,this))addTrace(this,cell,'scorch');
    const hitProps=this.props.filter(o=>o.hp>0&&affected(o)),hitEnemies=this.enemies.filter(e=>e.hp>0&&affected(e)&&(!eligible||eligible.includes(e))),hitPlayer=affected(this.player),hitAllies=this.activeAllies.filter(affected);
    const hitEdges=this.barriers.filter(b=>b.hp>0&&distance(origin,b)<=radius&&lineOfSight(objectSightGrid(this,origin,b),origin,b,this.barriers.filter(e=>e!==b),'blast'));
    for(const b of hitEdges)this.damageProp(b,damage,attacker);
    // Mark barrels as destroyed before recursion, so chain reactions terminate.
    for(const prop of hitProps)this.damageProp(prop,damage,attacker);
    for(const e of hitEnemies)this.hurt(e,reduceDirectDamage(e,Math.max(1,damage-distance(origin,e)*10)),attacker);
    for(const a of hitAllies)this.damageAlly(a,Math.max(1,damage-distance(origin,a)*10),null,true);
    if(hitPlayer)this.damagePlayer(Math.max(1,damage-distance(origin,this.player)*10),'爆炸衝擊',null,true);
    // 3.144.0: a blast damages the decoy and sets off every mine it reaches (each is removed before it goes off).
    if(this.decoy&&affected(this.decoy))damageDecoy(this,Math.max(1,damage-distance(origin,this.decoy)*10));
    for(const m of (this.mines||[]).filter(affected))detonateMine(this,m);
  }
  damagePlayer(raw,label,attacker=null,blast=false) {
    const p=this.player,cover=!blast&&attacker?this.protectingCover(p,attacker):null;
    let damage=raw;
    if(cover){damage*=1-coverEffects(cover,p,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);}
    if(!blast&&attacker&&toxicShot(this,attacker,p,this.actorWeapon(attacker)))damage*=.5;   // 3.134.0 mist
    damage=reduceDirectDamage(p,meleeDefense(p,Math.max(1,Math.round(damage-p.armor))));if(p.guard)damage=Math.max(1,Math.ceil(damage*.5));
    // 3.144.0: a worn exoskeleton's plates take their share of the hit (half of it) before your own plates do.
    const half=Math.floor(damage/2),frame=exoAbsorb(this,half),absorbed=Math.min(p.plates||0,half-frame);p.plates=(p.plates||0)-absorbed;damage-=frame+absorbed;
    p.hp-=damage;if(damage>0)addTrace(this,p,activeTrait(p,'mechanical')?'oil':'blood');this.log(`${label}${cover?'（掩體減傷）':''}${frame?`（外骨骼吸收 ${frame}）`:''}${absorbed?`（護甲板吸收 ${absorbed}）`:''}，生命 −${damage}。`,true,`${label}${cover?'（掩體減傷）':''}${frame||absorbed?'（護甲吸收）':''}，你受傷了。`);
    if(frame&&p.exoPlates<=0)breakExo(this);
    if(attacker&&ENEMY_TYPES[attacker.type]?.mechanical&&ENEMY_TYPES[attacker.type].range>1)addTrace(this,p,'scorch');
    if(attacker)this.effects.push({type:'enemyShot',attackerType:attacker.type,style:enemyDef(attacker)?.attackStyle||(ENEMY_TYPES[attacker.type]?.mechanical?'plasma':'bullet'),from:{x:attacker.x,y:attacker.y},to:{x:p.x,y:p.y},damage});
    else this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage});
    petReactions(this);syncPetSenses(this);
  }
  damageAlly(a,raw,attacker=null,blast=false,environment=false){
    if(a.hp<=0||a.status!=='active')return;const cover=!blast&&attacker?this.protectingCover(a,attacker):null;let damage=raw;
    if(cover){damage*=1-coverEffects(cover,a,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35),attacker);}
    if(!blast&&attacker&&toxicShot(this,attacker,a,this.actorWeapon(attacker)))damage*=.5;   // 3.134.0 mist
    if(!environment)petCombat(this,a);damage=reduceDirectDamage(a,Math.max(1,Math.round(damage-a.armor)));
    if(!environment)damage=petDefense(this,a,damage);a.hp=Math.max(0,a.hp-damage);
    addTrace(this,a,activeTrait(a,'mechanical')?'oil':'blood');this.effects.push({type:'impact',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},damage});this.log(`${allyName(a)}受傷 −${damage}。`,true,`${allyName(a)}受傷。`);
    if(!a.hp&&a.kind==='pet'){if(!petSurvives(this,a))petDeath(this,a);petReactions(this);this.reveal();return;}
    petReactions(this);
    if(!a.hp){a.status='destroyed';a.order=null;this.log(`${allyName(a)}已被摧毀。`,true);unitDestroyed(this,a);this.reveal();}
  }
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
    if(decoyAct(this,e))return;   // 3.144.0
    if(mineAct(this,e))return;    // 3.145.0: shoot a mine it watched go down
    return this.enemyOpportunity(e);
  }
  enemyOpportunity(e){return enemyOpportunity(this,e);}
  executeEnemy(e){return executeEnemyTree(this,e);}
  nextStep(e,target) {
    // 3.129.0 迂迴: a unit with the trait walks the covered route to any destination but you (docs/DETOUR.md).
    // 3.132.0 突進: along its route it covers up to three tiles in one straight sweep (src/line-move.js).
    if(activeTrait(e,LUNGE_TRAIT)){const leap=this.lungeStep(e,target);if(leap)return leap;}
    if(activeTrait(e,DETOUR_TRAIT)&&distance(target,this.player)>0){const step=this.coveredStep(e,target);if(step!==undefined)return step;}
    const queue=[{x:e.x,y:e.y,first:null}],visited=new Set([key(e)]);
    const occupied=new Set([...this.enemies.filter(o=>o!==e&&o.hp>0),...this.activeAllies].filter(a=>a!==target).map(key));
    for(let i=0;i<queue.length&&i<SIZE*SIZE;i++)for(const [dx,dy]of DIRECTIONS) {
      const q=queue[i],x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
      if(visited.has(k)||!this.passable(x,y,e))continue;
      const edge=barrierBetween(this.barriers,q,{x,y});if(edgeBlocks(edge)&&edge.type!=='door'&&!vaultable(edge))continue;
      if(skillActive(this.player)&&distance(target,this.player)>0&&x===this.player.x&&y===this.player.y)continue;
      if(x===target.x&&y===target.y)return q.first||(distance(target,this.player)>0||edgeBlocks(edge)?{x,y}:null);
      if(occupied.has(k))continue;
      visited.add(k);queue.push({x,y,first:q.first||{x,y}});
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
        const next=cost+1+(exposed?.has(k)?extra:0);if(best.has(k)&&best.get(k)<=next)continue;
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
    const p=this.player,hpBefore=p.hp,hazard=this.hazards.find(h=>h.x===p.x&&h.y===p.y);
    if(hazard){const damage=Math.max(0,(hazard.type==='acid'?8:12)-p.hazmat);p.hp-=damage;if(hazard.type==='acid'&&p.hazmat<8)addPoison(p,SWARM_TUNING.acidStacks);this.log(`${hazard.type==='acid'?'污染液':'高熱地板'}傷害 −${damage}。`,true,`${hazard.type==='acid'?'污染液':'高熱地板'}造成傷害。`);}
    toxicPlayerTurn(this,addPoison);   // 3.134.0 mist: poisoned for a turn ended in it
    tickPoison(this);
    if(p.hp<hpBefore)this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:hpBefore-p.hp});
    for(const a of this.activeAllies.filter(a=>!hasEnemyTag(a,'flying')))if(this.hazards.some(h=>h.x===a.x&&h.y===a.y))this.damageAlly(a,6,null,true,true);
    petReactions(this);
    for(const e of this.enemies.filter(e=>e.hp>0&&!hasEnemyTag(e,'flying'))){const hazard=this.hazards.find(h=>h.x===e.x&&h.y===e.y);if(hazard)this.hurt(e,6,null,hazard.type==='acid'?'踩到污染液':'踩到高熱地板');}
  }
  pickup() {
    // 3.118.0: a presentation-only 'pickup' effect when anything was collected, including part of a pile left behind by a
    // full pouch, so the pickup sound plays. Effects are never saved and never read by the rules.
    const p=this.player,before=this.items.length;let partial=false;
    this.items=this.items.filter(item=>{
      if(distance(item,p)!==0)return true;
      if(item.type==='learning'){if(!validLearningId(item.learningId))return true;p.learningItems[item.learningId]=(p.learningItems[item.learningId]||0)+1;this.log(`拾取${LEARNING_ITEMS[item.learningId].name}。`);return false;}
      if(item.type==='weapon') {
        this.registerWeapon(item);
        if(p.owned.length>=this.weaponCapacity){this.log('武器欄已滿。打開背包比較並交換，原武器會留在地上。');return true;}
        this.collectWeapon(item);return false;
      }
      const utility=grenadeByItem(item.type);
      if(utility){const amount=item.amount??1,accepted=this.receiveGrenade(utility,amount,{spill:false});if(accepted){partial=true;this.log(`拾取${GRENADES[utility].name} +${accepted}。`);}if(accepted<amount){item.amount=amount-accepted;this.log('投擲物共用容量已滿，剩餘留在原地。');return true;}return false;}
      const ammo=itemAmmo(item.type);
      if(ammo){const amount=item.amount??AMMUNITION[ammo].pickup,accepted=this.receiveAmmo(ammo,amount,{spill:false});
        if(accepted){partial=true;this.log(`拾取${AMMUNITION[ammo].name} +${accepted}。`);}
        if(accepted<amount){item.amount=amount-accepted;this.log(`${AMMUNITION[ammo].name}容量已滿，剩餘 ${item.amount} 留在原地。`);return true;}
      }
      // 3.136.0: medkits and field kit stop at the carry cap; the rest of a pile stays where it lies.
      else if(item.type==='med'||FIELD_ITEMS.includes(item.type)){
        const id=groundItemId(item.type),entry=PREPARED_CATALOG.item[id],amount=item.amount||1,accepted=this.receiveItem(id,amount,{spill:false});
        if(accepted){partial=true;this.log(`拾取${entry.name} +${accepted}。`);}
        if(accepted<amount){item.amount=amount-accepted;this.log(`${entry.name}已達攜帶上限，剩餘 ${item.amount} 留在原地。`);return true;}
      }
      // 3.135.0: grapple lines, dropped only (src/lines.js).
      else if(isLineItem(item.type)){const entry=PREPARED_CATALOG.item[item.type],amount=item.amount||1;p[entry.resource]+=amount;this.log(`拾取${entry.name} +${amount}。`);}
      // 3.135.0: goggles are found, not bought; one pair is all anyone carries.
      else if(item.type==='nvg'){if(p.wearables.includes('nvg')){this.log('已經有一副夜視鏡，這副留在原地。');return true;}p.wearables.push('nvg');this.log('取得夜視鏡。在背包裡預備就能戴上。');}
      else if(item.type==='armor'){const amount=Math.min(item.amount||20,this.plateCapacity-(p.plates||0));if(amount<=0){this.log('護甲板已滿，補給留在原地。');return true;}p.plates=(p.plates||0)+amount;this.log(`修復護甲板 +${amount}（${p.plates}/${this.plateCapacity}）。`);}
      else if(item.type==='scrap'){const amount=Math.round((item.amount||15)*(1+p.scavenger*.5));p.scrap+=amount;this.log(`回收廢料 +${amount}。`);}
      else if(item.type==='lore'){if(!p.lore.includes(item.floor)){p.lore.push(item.floor);this.awardProtocol('lore',item.floor);}p.scrap+=10;const story=collectStory(this,item);this.log(story?`資料已解密：${story.body}`:`資料已回收。`);}
      return false;
    });
    if(partial||this.items.length<before)this.effects.push({type:'pickup',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0});
  }
  registerWeapon(item,roll=false) {
    if(item.slot!==undefined)return item;
    const p=this.player,slot=p.weaponBases.length;
    const affix=roll?rollAffix(item.weapon,`${this.seed}:${this.floor}:${slot}:${item.x}:${item.y}`):null;
    p.weaponBases.push(item.weapon);p.affixes.push(affix);p.ammo.push(weaponStats(item.weapon,affix).mag);p.upgrades.push(0);
    item.slot=slot;return item;
  }
  collectWeapon(item){const p=this.player;p.owned.push(item.slot);this.log(`取得武器：${this.weaponAt(item.slot).name}。在背包中裝備。`);}
  addWeapon(base){
    if(!WEAPONS[base]||this.player.owned.length>=this.weaponCapacity)return false;
    const item=this.registerWeapon({weapon:base});this.collectWeapon(item);return item.slot;
  }
  nearbyWeapon(slot){return this.items.find(o=>o.type==='weapon'&&o.slot===slot&&this.canTouch(o));}
  takeWeapon(slot) {
    const item=this.nearbyWeapon(slot);
    if(!item)return this.fail('附近沒有這把武器。');
    if(this.player.owned.length>=this.weaponCapacity)return this.fail(`武器欄已滿（${this.weaponCapacity} 格）。可比較並交換武器。`);
    this.collectWeapon(item);this.items=this.items.filter(o=>o!==item);return true;
  }
  replaceWeapon(arg) {
    const p=this.player,item=this.nearbyWeapon(arg?.take),old=arg?.leave;
    if(!item||!p.owned.includes(old)||this.weaponAt(old).locked)return this.fail('要交換的武器已不在原處。');
    p.owned[p.owned.indexOf(old)]=item.slot;if(p.weapon===old)p.weapon=item.slot;
    this.items=this.items.filter(o=>o!==item);
    this.items.push({x:p.x,y:p.y,type:'weapon',weapon:p.weaponBases[old],slot:old});
    this.log(`換入${this.weaponAt(item.slot).name}；${this.weaponAt(old).name}連同彈匣與改裝留在腳下。`);return true;
  }
  salvage(index) {
    const p=this.player;
    if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
    if(this.weaponAt(index).locked)return this.fail('固定武器不能拆解或交換，只能升級。');
    if(p.owned.length<=1)return this.fail('至少保留一把武器。');
    if(!this.weaponAt(index).melee)this.receiveAmmo(this.weaponAt(index).ammoType,p.ammo[index]);p.ammo[index]=0;p.owned=p.owned.filter(i=>i!==index);
    p.scrap+=salvageValue(p,index);p.upgrades[index]=0;p.stats.salvaged++;
    if(p.weapon===index)p.weapon=p.owned[0];this.log(`拆解${this.weaponAt(index).name}，回收彈匣與廢料。`);return true;
  }
  // Salvage a dropped weapon without picking it up (3.50.0, user request): same yield as the pack version,
  // so a full pack can still turn loot into scrap and magazine ammunition.
  salvageGround(slot) {
    const p=this.player,item=this.nearbyWeapon(slot);
    if(!item)return this.fail('附近沒有這把武器。');
    const w=this.weaponAt(slot);
    if(w.locked)return this.fail('固定武器不能拆解。');
    if(!w.melee)this.receiveAmmo(w.ammoType,p.ammo[slot]);p.ammo[slot]=0;
    const scrap=salvageValue(p,slot);p.scrap+=scrap;p.upgrades[slot]=0;p.stats.salvaged++;
    this.items=this.items.filter(o=>o!==item);
    this.log(`就地拆解${w.name}，回收彈匣與 ${scrap} 廢料。`);return true;
  }
  useTerminal(arg){return useTerminal(this,arg);}
  descend(advanceTurn=true) {
    if(skillActive(this.player,'anchor'))return this.fail('下錨中無法換層，請先解除。');
    const p=this.player;
    if(!this.canTouch(this.exitPoint))return this.fail('需要靠近綠色電梯。');
    if(this.exitBlocked)return this.fail(this.exitBlocked);
    const next=this.floor-1,frame=returning(this)&&this.floor>1?this.floorStates[next]:null,arrival=frame&&arrivalCell(frame,this.allies.filter(a=>a.floor===next&&a.status==='active'));
    if(returning(this)&&this.floor>1&&!arrival)return this.fail('上一層入口暫無安全落腳處。');
    this.awardProtocol('floor',this.floor);
    if((returning(this)&&this.floor===1)||(!isEndless(this)&&!missionDefinition(this).returnTrip&&this.floor===missionDepth(this))){this.awardProtocol('extraction','win');this.status='won';this.log(this.missionSummary+'。撤離成功。');return true;}
    notePurgeDeparture(this);this.shadowSteps=0;this.pursuit=0;this.decoy=null;this.mines=[];for(const e of this.enemies)removeTraitSource(e,'skill:early_warning');const companions=departAllies(this);
    if(returning(this)){
      if(advanceTurn)this.turn++;
      Object.assign(this,resumedFloor(frame,this.turn));delete this.floorStates[next];this.floor=next;
      Object.assign(p,arrival,{guard:false,focus:false,evasive:false,moved:false,moveDelta:[0,0],fireChain:null,cornerExposure:null,tactics:null});
      endSkillEffects(p);this.sensorContacts=[];p.vaultExposed=false;this.target=null;arriveAllies(this,companions);scheduleRetreatWave(this);this.reveal();
      this.log(`返回${floorInfo(this.floor).name}：物資與戰場保持原狀，沒有換層補給。`);return true;
    }
    if(missionDefinition(this).returnTrip)this.floorStates[this.floor]=archiveFloor(this);
    this.floor++;if(advanceTurn)this.turn++;const recovered=healActor(p,25);
    this.loadFloor();arriveAllies(this,companions);this.reveal();this.supplyPack({rifle:20,pistol:24,shell:12,energy:15,ordnance:2});this.log(`進入${floorInfo(this.floor).name}。生命 +${recovered}，補充各類備彈。`);return true;
  }
  choosePerk(id) {
    if(this.status!=='playing'||!this.pendingPerks||this.perkPicks>=perkLimit(this.player.level)||this.perkPicks+this.pendingPerks>perkLimit(this.player.level))return false;
    const offer=this.perkChoices.find(o=>o.id===id);
    if(!offer||!eligiblePerks(this).some(o=>o.id===id))return false;
    recordPerkOffer(this);applyPerk(this,offer);this.pendingPerks--;this.perkPicks++;this.perkDraft=null;ensurePerks(this);
    this.log(`模組已安裝：${offer.name}。`);return true;
  }
  serialize(){ensurePerks(this);const {rng,effects,visibleTiles,onEnemyCallout,pursuitPending,pursuitBlocked,shadowBonus,...data}=this;return JSON.stringify({version:SAVE_VERSION,data,rngState:rng.state()});}
  static restore(raw) {
    try {
      const {version,data,rngState}=JSON.parse(raw);
      if(data?.simulation!==undefined)return null;
      if(![...LEGACY_SAVE_VERSIONS,SAVE_VERSION].includes(version)||data?.status!=='playing'||!data.player||!Number.isInteger(data.floor)||data.floor<1||data.floor>floorLimit(data))return null;
      if(!Number.isInteger(data.seed)||data.seed<0||!Number.isInteger(data.turn)||data.turn<1)return null;
      if(!Array.isArray(data.grid)||data.grid.length!==SIZE||data.grid.some(row=>!Array.isArray(row)||row.length!==SIZE))return null;
      if(!Array.isArray(data.enemies)||data.enemies.some(e=>!ENEMY_TYPES[e.type]||!Number.isFinite(e.hp)||(e.raised!==undefined&&typeof e.raised!=='boolean')||(e.expendable!==undefined&&typeof e.expendable!=='boolean')))return null;
      if(!Array.isArray(data.props)||!Array.isArray(data.items)||!validMapMetadata(data))return null;
      if(version<45){initializeRunUnlocks(data);if(data.mission?.id==='endless')data.items=data.items.filter(i=>i.type!=='lore');}
      if(!validRunUnlocks(data))return null;
      if(version<40)migrateFactions(data);
      if(!validFactions(data))return null;
      if(version<41)migrateElites(data);
      if(!validElites(data))return null;
      if(version<42)migrateCivilians(data);
      if(!validCivilians(data))return null;
      if(version<37)migrateSuppression(data);
      if(version<39)data.realMode=false;
      if(typeof data.realMode!=='boolean')return null;
      if(version<38){data.marks??=[];migrateEnemyAffixes(data);migrateResistance(data);}
      if(!validDifficultyOffset(data.difficultyOffset))return null;
      // 3.137.0: a run started before the difficulty curves keeps the curve it began on.
      if(version<64)data.difficulty='classic';
      if(!validCurve(data.difficulty))return null;
      // 3.138.0: a run started before the slower perks keeps the classic perk rules.
      if(version<65)data.perkRules=1;
      if(![1,2].includes(data.perkRules))return null;
      // 3.113.0: class skills are no longer learnable. Anything still holding one of the retired data items becomes
      // the scrap it would have dismantled for, wherever it is: in the pack, on the ground, or in an unopened case,
      // on this floor and on every archived one. Skills already learned from them are kept.
      if(version<55)retireLearning(data);
      if(!validLearningInventory(data.player)||data.items.some(i=>i.type==='learning'&&!validLearningId(i.learningId)))return null;
      if(data.mapGenerations===undefined)data.mapGenerations=[...new Set([data.generation?.version||1,...Object.values(data.floorStates||{}).map(f=>f.generation?.version||1)])].sort((a,b)=>a-b);
      if(!validGenerationHistory(data.mapGenerations)||!data.mapGenerations.includes(data.generation?.version||1))return null;
      if(version<13)data.barriers=[];
      if(!validBarriers(data.barriers,data.grid,[...data.enemies,...data.props].map(o=>o.id)))return null;
      if(!validContainers(data.props,data.grid,[...data.enemies,...data.barriers,...data.props.filter(p=>!isContainer(p))].map(o=>o.id)))return null;
      if(!validModules(data.props,data.grid,[...data.enemies,...data.barriers,...data.props.filter(p=>p.type!=='module')].map(o=>o.id)))return null;
      if(!data.props.every(o=>o?.type!=='terminal'||validTerminalSpent(o.spent)))return null;
      if(version<18)data.lighting=fullLighting(data.grid);
      if(!validLighting(data.lighting,data.grid))return null;
      if(version<17)data.traces=[];
      if(!validTraces(data.traces,data.grid))return null;
      if(version<16)data.mission=newMission();
      if(version<21){data.floorStates={};data.reinforcements=[];}
      if(!validMission(data.mission,data))return null;
      // The purge ledger is narrative only: a run saved before it existed, or with a damaged one, keeps playing without a verdict.
      if(data.purge===undefined||!validPurge(data.purge,data))data.purge=null;
      if(version<23){data.allies=[];data.allySerial=0;}
      const workshopRefund=version<46?migrateWorkshop(data,version):null;
      const defaults=freshPlayer(),p={...defaults,...data.player};
      if(version<44&&!migratePoison(p))return null;
      if(![p,...data.enemies].every(a=>validCombatModifiers(a.combatModifiers)))return null;
      if(version<12){
        p.smoke=0;p.emp=0;p.stun=0;p.control=controlState();data.smoke=[];
        for(const actor of [p,...data.enemies]){
          actor.control=controlState();if(actor!==p)actor.lastKnown=null;
          const id=bodyKeyword(actor.type);
          if(Array.isArray(actor.traits)&&!actor.traits.some(t=>t.id===id))actor.traits=[...actor.traits,{id,source:'body:migration'}];
        }
      }
      if(![version>=12?data.player:p,...data.enemies].every(a=>validControl(a.control)))return null;
      const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&data.grid[q.y]?.[q.x]===1;
      if(data.enemies.some(e=>e.lastKnown!==null&&!point(e.lastKnown)))return null;
      if(!Array.isArray(data.smoke)||data.smoke.length>32||data.smoke.some(s=>!Number.isInteger(s.expires)||s.expires<=data.turn||s.expires>data.turn+SMOKE_DURATION-1||!Array.isArray(s.cells)||s.cells.length<1||s.cells.length>13||s.cells.some(q=>!point(q))))return null;
      if(version>=12&&!['smoke','emp','stun'].every(k=>Number.isSafeInteger(data.player[k])&&data.player[k]>=0&&data.player[k]<=10000000))return null;
      if(version<10)p.portrait=portraitForLegacy(data.runId??data.seed);
      if(!validPortrait(p.portrait))return null;
      if(version<8){p.prepared=defaultPrepared();p.skills=[];}
      // Wearables are owned (3.108.0) and validPrepared reads the raw player, so the default has to land before it.
      // An absent list simply means none owned, whatever the version claims; a malformed one is still rejected below.
      if(data.player)data.player.wearables??=[];
      if(!validPrepared(version>=8?data.player:p))return null;
      if(version<7){p.traits=[];for(const e of data.enemies)e.traits=startingTraits(e.type,data.floor);}
      if((version>=7&&!validTraits(data.player.traits))||!validTraits(p.traits)||data.enemies.some(e=>!validTraits(e.traits)))return null;
      const tacticalActors=[p,...data.enemies,...(data.allies||[])];
      if(version<34){for(const a of tacticalActors){if(a===p){a.cornerExposure=null;a.tactics=null;}else{delete a.cornerExposure;delete a.tactics;}}for(const frame of Object.values(data.floorStates||{}))for(const a of frame.enemies||[]){delete a.cornerExposure;delete a.tactics;}}
      if(!tacticalActors.every(a=>(a===p||validEnemyAffixes(a))&&validEnemyIntent(a,point))||!validEnemyMarks(data.marks,point,data.turn))return null;
      if(!tacticalActors.every(a=>validCorner(a,data.turn)&&validTactics(a,data.turn)))return null;
      // 3.131.0 (SAVE 60): a hiding rebel's cover spot moved from cowerAt into its retreat order.
      // 3.132.0 (SAVE 61): a squad member's spot, arrival and role moved from e.squad into its duty order.
      if(version<61)for(const e of [...data.enemies,...Object.values(data.floorStates||{}).flatMap(f=>f.enemies||[])]){
        const s=e.squad;if(!s||typeof s!=='object'||s.goal===undefined)continue;
        if(!e.order)e.order={kind:s.role==='move'?'bound':'post',by:s.leader,at:s.goal,set:s.set,since:Number.isSafeInteger(data.turn)?data.turn:0,patience:null,breakOn:[]};
        delete s.goal;delete s.set;delete s.role;
      }
      if(version<60)for(const e of [...data.enemies,...Object.values(data.floorStates||{}).flatMap(f=>f.enemies||[])])if(e.cowerAt&&!e.order){e.order={kind:'retreat',by:'self',at:e.cowerAt,since:Number.isSafeInteger(data.turn)?data.turn:0,patience:null,breakOn:[]};delete e.cowerAt;}
      if(version<9){p.character='soldier';p.moveDelta=[0,0];p.fireChain=null;grantCharacterTraits(p);for(const e of data.enemies){e.moveDelta=[0,0];e.fireChain=null;}}
      if(!validCharacter(version>=9?data.player.character:p.character)||!validCombatMemory(version>=9?data.player:p,data.turn)||data.enemies.some(e=>!validCombatMemory(e,data.turn)))return null;
      if(version<18&&p.character==='recon')for(const id of ['night_vision','infrared'])if(!p.traits.some(t=>t.id===id&&t.source==='character:recon'))grantTrait(p,id,'character:recon');
      if(version<20){
        if(p.character==='recon'){
          if(!p.skills.includes('signal_break'))p.skills=[...p.skills,'signal_break'];
          p.prepared={...p.prepared,skill:p.prepared.skill||'signal_break'};
        }
        p.skillState=initialSkillState(p.skills);
      }
      if(version<22){
        if(p.character==='soldier'){if(!p.skills.includes('early_warning'))p.skills=[...p.skills,'early_warning'];p.prepared={...p.prepared,skill:p.prepared.skill||'early_warning'};p.skillState={...p.skillState,early_warning:{remaining:0,cooldown:0}};}
        data.sensorContacts=[];p.vaultExposed=false;for(const e of data.enemies)e.vaultExposed=false;
        for(const frame of Object.values(data.floorStates||{}))for(const e of frame.enemies||[])e.vaultExposed=false;
      }
      if(version<25&&p.character==='bulwark'){
        if(!p.skills.includes('anchor'))p.skills=[...p.skills,'anchor'];
        p.prepared={...p.prepared,skill:p.prepared.skill||'anchor'};
        p.skillState={...p.skillState,anchor:{remaining:0,cooldown:0}};
      }
      // Existing trait schema: retrofit the class passive without changing resources or RNG.
      if(p.character==='recon'&&!p.traits.some(t=>t.id==='extended_burst'&&t.source==='character:recon'))grantTrait(p,'extended_burst','character:recon');
      if(p.character==='recon'&&!p.traits.some(t=>t.id==='tactical_supply'&&t.source==='character:recon'))grantTrait(p,'tactical_supply','character:recon');
      // Balance-only passive: existing trait schema, preserve HP/resources and avoid duplicate sources.
      if(['bulwark','necromancer'].includes(p.character)&&!p.traits.some(t=>t.id==='difficult_healing'&&t.source===`character:${p.character}`))grantTrait(p,'difficult_healing',`character:${p.character}`);
      if(version<29)p.battleSpirit=freshSpirit();
      if(!validMeleeState(version>=29?data.player:p,data.turn))return null;
      if(!validAnchor(p))return null;
      if(!validSkillState(p)||![version>=22?data.player:p,...data.enemies].every(a=>typeof a.vaultExposed==='boolean'))return null;
      if(!Array.isArray(data.sensorContacts)||data.sensorContacts.length>256||data.sensorContacts.some(q=>!point(q))||(!skillActive(p,'early_warning')&&data.sensorContacts.length))return null;
      p.plates=data.player.plates??0;if(!Number.isInteger(p.plates)||p.plates<0||p.plates>CHARACTERS[p.character].plateCapacity)return null;
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||data.grid[p.y]?.[p.x]!==1||!Number.isFinite(p.hp)||p.hp<=0)return null;
      if(version<5){
        p.weaponBases=WEAPONS.map((_,i)=>i);p.affixes=WEAPONS.map(()=>null);
        p.ammo=WEAPONS.map((_,i)=>data.player.ammo?.[i]??defaults.ammo[i]);
        p.upgrades=WEAPONS.map((_,i)=>data.player.upgrades?.[i]??0);
      }
      if(version>=5&&!'weaponBases affixes ammo upgrades'.split(' ').every(k=>Array.isArray(data.player[k])))return null;
      p.stats={...defaults.stats,...p.stats};
      if(!Array.isArray(p.weaponBases)||p.weaponBases.length<1||p.weaponBases.length>10000||p.weaponBases.some(i=>!Number.isInteger(i)||!WEAPONS[i]))return null;
      if(!Array.isArray(p.affixes)||p.affixes.length!==p.weaponBases.length||p.affixes.some((a,i)=>a!==null&&(!Object.hasOwn(AFFIXES,a)||!affixAllowed(p.weaponBases[i],a)||(a==='piercing'&&WEAPONS[p.weaponBases[i]].explosive)||WEAPONS[p.weaponBases[i]].locked)))return null;
      if(!Array.isArray(p.owned)||!p.owned.length||p.owned.length>CHARACTERS[p.character].weaponCapacity||new Set(p.owned).size!==p.owned.length||!p.owned.includes(p.weapon)||p.owned.some(i=>!Number.isInteger(i)||p.weaponBases[i]===undefined))return null;
      if(!Array.isArray(p.ammo)||!Array.isArray(p.upgrades)||p.ammo.length!==p.weaponBases.length||p.upgrades.length!==p.weaponBases.length)return null;
      if(p.ammo.some(n=>!Number.isSafeInteger(n)||n<0||n>10000000)||p.upgrades.some(n=>!Number.isInteger(n)||n<0||n>3))return null;
      if(p.weaponBases.some((base,slot)=>WEAPONS[base].melee&&p.ammo[slot]!==0))return null;
      if(p.character==='bulwark'&&p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]].id==='powerfist').length!==1)return null;
      for(const w of WEAPONS.filter(w=>w.boundCharacter)){const slots=p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]].id===w.id);if(p.character===w.boundCharacter?slots.length!==1:slots.length!==0)return null;}
      if(!Array.isArray(p.lore)||p.lore.some(n=>!Number.isInteger(n)||n<1||n>FLOORS.length))return null;
      const g=Object.assign(Object.create(Game.prototype),data,{player:p,effects:[],hazards:data.hazards||[],marks:data.marks||[]});
      g.runId=typeof data.runId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(data.runId)?data.runId:`legacy-${data.seed}`;
      if(['__proto__','constructor','prototype'].includes(g.runId))return null;
      g.protocol=data.protocol??{earned:0,events:[]};g.unlockedWeapons=Array.isArray(data.unlockedWeapons)?data.unlockedWeapons.filter(x=>typeof x==='string'):[];
      if(!Number.isSafeInteger(g.protocol.earned)||g.protocol.earned<0||g.protocol.earned>1000000||!Array.isArray(g.protocol.events)||g.protocol.events.length>PROTOCOL_EVENT_LIMIT||g.protocol.events.some(x=>typeof x!=='string'))return null;
      g.rng=random(rngState??g.seed+g.turn*13);
      // Historical v1 IDs are intentionally literal; this migration describes the old roster.
      if(version===1){g.props=g.props.map((o,i)=>({...o,id:o.id||`legacy-${i}`,type:o.type==='crate'?'cover':o.type,...(o.type==='crate'?{hp:65,maxHp:65}:{})}));for(const e of g.enemies)if(e.type==='boss'&&g.floor===3)e.type='warden';g.log('存檔已升級：六層設施、背包與手榴彈現已可用。');}
      if(version<3){p.moved=false;for(const e of g.enemies)e.moved=false;g.log('戰術更新：牆角探身、移動閃避與命中率已啟用。新地圖從下一層開始。');}
      const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
      if(!['reserve','energy','ordnance','grenades'].every(k=>validCount(p[k])))return null;
      if(g.items.some(item=>(itemAmmo(item.type)||grenadeByItem(item.type))&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      if(version<4){
        const split=amount=>splitLegacyRounds(amount,p.owned.map(i=>WEAPONS[i]),WEAPONS[p.weapon].ammoType);
        const rounds=split(p.reserve);p.reserve=rounds.rifle;p.pistol=rounds.pistol;p.shell=rounds.shell;
        g.items=g.items.flatMap(item=>item.type==='ammo'?Object.entries(split(item.amount??16)).filter(([,n])=>n>0).map(([id,amount])=>({...item,type:AMMUNITION[id].item,amount})):item);
        g.carryLevel=0;g.log('備彈已分類為手槍彈、步槍彈與霰彈；超出上限的補給留在腳下。');
      }else if(!Object.values(AMMUNITION).every(info=>validCount(data.player[info.key]))||(version<6?(!Number.isInteger(g.carryLevel)||g.carryLevel<0||g.carryLevel>3):!validCarryLevels(g.carryLevel)))return null;
      if(g.items.some(item=>(itemAmmo(item.type)||grenadeByItem(item.type))&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      const locations=new Set(p.owned);
      for(const item of g.items){
        if(item.type!=='weapon')continue;
        if(!Number.isInteger(item.weapon)||!WEAPONS[item.weapon]||WEAPONS[item.weapon].locked)return null;
        if(version<5){delete item.slot;g.registerWeapon(item);}
        if(!Number.isInteger(item.slot)||p.weaponBases[item.slot]!==item.weapon||locations.has(item.slot))return null;
        locations.add(item.slot);
      }
      // Weapons mounted on workshop units (3.93.0) still belong to the run: one location per slot, ranged and unlocked only.
      for(const slot of [...(Array.isArray(p.productionLines)?p.productionLines.map(u=>u?.weapon):[]),...(Array.isArray(g.allies)?g.allies.map(a=>a?.weapon):[])]){
        if(slot===undefined)continue;
        const base=Number.isInteger(slot)?WEAPONS[p.weaponBases[slot]]:null;
        if(!base||base.melee||base.locked||locations.has(slot))return null;locations.add(slot);
      }
      if(version>=28&&(!Object.hasOwn(data.player,'perks')||!Object.hasOwn(data.player,'perkWeaponBonus')))return null;
      if(version<28)migratePerks(g);
      if(version<30){if(![g.pendingPerks,g.perkPicks].every(n=>Number.isSafeInteger(n)&&n>=0))return null;g.legacyPerkPicks=g.perkPicks>perkLimit(p.level)?g.perkPicks:0;const kept=Math.max(0,Math.min(g.pendingPerks,perkLimit(p.level)-g.perkPicks));if(kept!==g.pendingPerks)g.perkDraft=null;g.pendingPerks=kept;}
      if(version<31)g.classPerkMisses=0;
      // 3.106.0: two new consumables; older saves simply have none of either.
      if(version<52){g.player.sprays??=0;g.player.adrenaline??=0;}
      // 3.109.0: carried cover; older saves have none.
      if(version<54)g.player.barricades??=0;
      // 3.123.0: flares; older saves carry none and have none burning.
      if(version<56){g.player.flares??=0;g.flares??=[];}
      // 3.135.0: grapple lines; older saves carry none.
      if(version<62){g.player.escapeLines??=0;g.player.redeployLines??=0;}
      // 3.136.0: the picked bump weapon and the chainsaw's lost action; older saves have neither.
      if(version<63){g.player.meleeSlot??=null;g.player.recovery??=0;}
      // 3.144.0: decoys, mines and the exoskeleton; older saves carry none and have none out.
      if(version<66){g.player.decoys??=0;g.player.mines??=0;g.player.exoPlates??=0;g.decoy??=null;g.mines??=[];g.mineSerial??=0;}
      if(![0,1].includes(g.player.recovery)||!(g.player.meleeSlot===null||Number.isInteger(g.player.meleeSlot)&&WEAPONS[g.player.weaponBases[g.player.meleeSlot]]?.melee))return null;
      if(!['escapeLines','redeployLines'].every(k=>Number.isSafeInteger(g.player[k])&&g.player[k]>=0&&g.player[k]<=10000000))return null;
      if(!Number.isSafeInteger(g.player.flares)||g.player.flares<0||g.player.flares>10000000||!validFlares(g.flares,g.grid,g.turn))return null;
      // 3.108.0: the worn item's passives are derived from the slot, never trusted from the file.
      g.player.wearables??=[];syncWearableTraits(g.player);
      if(!['decoys','mines'].every(k=>Number.isSafeInteger(g.player[k])&&g.player[k]>=0&&g.player[k]<=10000000)||!validExo(g.player)||!validDecoy(g)||!validMines(g))return null;
      if(version<33)g.pursuit=0;
      if(!Number.isInteger(g.pursuit)||g.pursuit<0||g.pursuit>1||g.pursuit&&(g.shadowSteps>0||p.control.disabled))return null;
      if(!validRuntime(g)||!validSwarm(g)||!validSwarmWaves(g)||!validSquad(g)||!validRebels(g)||!validOrders(g)||!validPounce(g)||!validFields(g))return null;
      if(version<32)g.shadowSteps=0;
      // Free moves used to come only from 影步, so the loader tied them to the ninja perk. Adrenaline (3.106.0) gives
      // them to every class, and that clause was rejecting any save taken between the shot and the steps — the run
      // was simply lost. The bound still matches the largest grant either source can make.
      if(!Number.isInteger(g.shadowSteps)||g.shadowSteps<0||g.shadowSteps>Math.max(SURGE_STEPS,2))return null;
      if(!validPerks(g))return null;
      if(version<35&&!migratePetBond(g))return null;
      if(version<36&&!migratePetNodes(g,version===35))return null;
      if(!validAllies(g)||!validPetBond(g)||!validWorkshop(g))return null;
      if(!validRetreatState(g,(floor,frame)=>Boolean(Game.restore(JSON.stringify({version:SAVE_VERSION,rngState:g.rng.state(),data:{...data,swarmWaves:undefined,mapStyle:undefined,classPerkMisses:g.classPerkMisses,legacyPerkPicks:g.legacyPerkPicks,pendingPerks:g.pendingPerks,perkPicks:g.perkPicks,perkDraft:g.perkDraft,...Object.fromEntries(MAP_FIELDS.map(k=>[k,undefined])),...frame,pursuit:0,turn:frame.savedTurn,floor,floorStates:{},allies:[],sensorContacts:[],mission:newMission(),player:{...p,petBond:null,traits:p.traits.filter(t=>t.source!=='pet:vision'),battleSpirit:{...p.battleSpirit,lastKill:p.battleSpirit.lastKill===null?null:Math.min(p.battleSpirit.lastKill,frame.savedTurn)},x:frame.start.x,y:frame.start.y,cornerExposure:null,tactics:null,fireChain:null}}})))))return null;
      // Weapon slots belong to the run, including weapons left on archived floors.
      for(const frame of Object.values(g.floorStates))for(const item of frame.items)if(item.type==='weapon'){
        if(locations.has(item.slot))return null;locations.add(item.slot);
      }
      if(version<5)g.log('武器已升級為獨立個體。既有彈匣與改裝保留，新掉落可能帶有詞條。');
      // v27: the follow drone now fires rifle rounds. Hand back pistol rounds still in an old follow magazine (overflow
      // lands at the player's feet), widen the chassis to the new hit points without healing, and refit to its mode.
      if(version<27){
        let refund=0;for(const a of g.allies)if(a.kind==='drone'){if(a.sourceId==='drone_follow'&&a.ammo>0){refund+=a.ammo;a.ammo=0;}if(a.maxHp===45)a.maxHp=DRONE_HP;fitDrone(a);}
        if(refund){g.receiveAmmo('pistol',refund);g.log(`存檔已升級：追隨無人機改用步槍彈，原彈匣 ${refund} 發手槍彈已退回。`);}
      }
      if(workshopRefund){const rounds=workshopRefund.pistol+workshopRefund.rifle;for(const type of ['pistol','rifle'])if(workshopRefund[type])g.receiveAmmo(type,workshopRefund[type]);g.log(`存檔已升級：工程師改用工坊${workshopRefund.lined?'，收納中的機體放進生產序列':''}${rounds?`，機體彈匣裡的 ${rounds} 發子彈已退回`:''}。`);}
      lockRealMode(g,data.realMode);g.setCarryLevel(g.carryLevel);g.reveal({warnings:false});return g;
    }catch{return null;}
  }
}
