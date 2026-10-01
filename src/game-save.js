// Saves (3.206.3 split): serialize, and Game.restore — migrations from every older SAVE_VERSION and the strict checks
// that refuse only broken data (docs/CHECKLIST.md 3). Also the new pack's catalog and a fresh player's fields, which the
// constructor uses too.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {initializeRunUnlocks,validRunUnlocks} from './run-unlocks.js';
import {validSwarmWaves} from './swarm-waves.js';
import {validSurvival} from './survival.js';
import {validSquad} from './squad.js';
import {validRebels} from './rebels.js';
import {dropStaleOperatives,validOperatives} from './delisted-operatives.js';
import {migratePoison} from './poison.js';
import {TRAIT_CAP,bodyKeyword,grantTrait,startingTraits,syncFactionTraits,validCombatMemory,validTraits} from './traits.js';
import {validSwarmState} from './swarm.js';
import {migrateCivilians,validCivilians} from './civilians.js';
import {migrateElites,validElites} from './elite-enemies.js';
import {migrateFactions,validFactions} from './factions.js';
import {lockRealMode} from './real-mode.js';
import {validEnemyMarks} from './enemy-intents.js';
import {dropStaleSpecials,validActorSpecials,validSpecials} from './enemy-specials.js';
import {migrateEnemyAffixes,validEnemyAffixes,deploys} from './enemy-affixes.js';
import {migrateResistance,migrateSuppression} from './suppression.js';
import {PROTOCOL_EVENT_LIMIT,floorLimit,perkLimit,validCurve,validDifficultyOffset} from './endless.js';
import {validLearningInventory} from './learning.js';
import {LEARNING_SCRAP,RETIRED_LEARNING,validLearningId} from './learning-data.js';
import {migratePetBond,migratePetNodes,validPetBond} from './pet-growth.js';
import {validCorner} from './corner.js';
import {validTactics} from './tactics.js';
import {validRuntime} from './runtime-enemies.js';
import {AFFIXES,affixAllowed} from './weapons.js';
import {MAP_FIELDS,validGenerationHistory,validMapMetadata} from './map-geometry.js';
import {freshSpirit,validMeleeState} from './melee-classes.js';
import {validOrders} from './orders.js';
import {defaultPrepared,syncWearableTraits,validPrepared} from './prepared.js';
import {validFieldSmoke} from './swarm-fields.js';
import {validVents} from './vents.js';
import {validFireTiles} from './fire.js';
import {ensurePerks,migratePerks,validPerks} from './perks.js';
import {DRONE_HP,fitDrone,validAllies} from './allies.js';
import {migrateWorkshop,validWorkshop} from './workshop.js';
import {validRetreatState} from './retreat.js';
import {initialSkillState,skillActive,validAnchor,validSkillState} from './skills.js';
import {validCombatModifiers} from './actor-stats.js';
import {LIGHT_MODEL,fullLighting,validGlowsticks,validGunFlashes,validLamps,validLighting} from './lighting.js';
import {validTraces} from './traces.js';
import {newMission,validMission} from './missions.js';
import {validModules} from './modules.js';
import {isContainer,validContainers} from './containers.js';
import {validBarriers} from './barriers.js';
import {portraitForLegacy,validPortrait} from './portraits.js';
import {SMOKE_DURATION,controlState,grenadeByItem,validControl} from './throwables.js';
import {CHARACTERS,grantCharacterTraits,validCharacter} from './characters.js';
import {sealVaultWalls,validKeycards,validVaultState} from './vault.js';
import {validDecoy,validExo,validMines} from './field-gear.js';
import {AMMUNITION,itemAmmo,splitLegacyRounds,validCarryLevels} from './ammunition.js';
import {validPurge} from './purge-review.js';
import {ENEMY_TYPES,FLOORS,LEGACY_SAVE_VERSIONS,PERK_D,SAVE_VERSION,SIZE,WEAPONS,seeThrough} from './data.js';
import {random} from './world.js';
import {validTerminalSpent} from './terminal.js';
import {validFlares} from './flares.js';
import {DEFAULT_DUTY,validDuty} from './duty.js';
import {Game,SURGE_STEPS} from './game.js';
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
// A new run's pack holds a slot for each weapon of the catalog up to the chainsaw (weapon 17), slot = weapon, as it
// always has. 3.203.0: weapons added from then on (the flamethrower, 18) take a slot only when one is found, so the slots
// of everything found on a floor, and the weapon affixes rolled by slot, stay where they were.
export const CATALOG=WEAPONS.slice(0,18);
// The plates you can carry: your class's, and 加掛板架's ranks (3.148.0). Filling and loading use the same number.
export const plateCapacityOf=p=>(CHARACTERS[p.character]?.plateCapacity??0)+PERK_D.rack*(p.perks?.plate_rack||0);
export const freshPlayer=()=>({flashlight:false,lightLingers:false,glowsticks:0,keycards:[],decoys:0,mines:0,exoPlates:0,learningItems:{},petBond:null,battleSpirit:freshSpirit(),perks:{},perkWeaponBonus:0,character:'soldier',vaultExposed:false,smoke:0,emp:0,stun:0,control:controlState(),moveDelta:[0,0],fireChain:null,cornerExposure:null,tactics:null,prepared:defaultPrepared(),skills:[],skillState:{},productionLines:[],blueprints:[],usedBlueprints:[],traits:[],x:0,y:0,hp:100,maxHp:100,meds:2,sprays:0,adrenaline:0,barricades:0,flares:0,escapeLines:0,redeployLines:0,meleeSlot:null,recovery:0,wearables:[],grenades:2,armor:0,bonus:0,blastBonus:0,healBonus:0,hazmat:0,scavenger:0,scrap:0,level:1,xp:0,kills:0,weapon:0,owned:[0,1],weaponBases:CATALOG.map((_,i)=>i),affixes:CATALOG.map(()=>null),ammo:CATALOG.map((w,i)=>i<2?w.mag:0),upgrades:CATALOG.map(()=>0),reserve:48,pistol:24,shell:12,energy:18,ordnance:4,facing:[0,1],guard:false,focus:false,evasive:false,poison:0,lore:[],stats:{shots:0,damage:0,grenades:0,salvaged:0}});
export class GameSave {
  serialize(){ensurePerks(this);const {rng,effects,visibleTiles,onEnemyCallout,pursuitPending,pursuitBlocked,shadowBonus,blindAftermath,refusal,...data}=this;return JSON.stringify({version:SAVE_VERSION,data,rngState:rng.state()});}
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
      if(![1,2,3].includes(data.perkRules))return null;
      // 3.169.0: runs started before the duty rota were Egret's; the officer only picks lines, so a damaged value is not
      // worth losing a run over.
      if(version<71||!validDuty(data.duty))data.duty=DEFAULT_DUTY;
      // 3.177.2: a vault closet's partitions could be shot open; seal them on this floor and on every archived one.
      if(version<72)for(const f of [data,...Object.values(data.floorStates||{})])sealVaultWalls(f);
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
      const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&seeThrough(data.grid[q.y]?.[q.x]);   // 3.164.0: a scanned flyer may hover over a pit
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
      // 3.159.0: 架槍精通 became 標定壓制 in the same slot, so its ranks carry over (and a pending draft offering it); a
      // fire chain longer than the flat limit is clamped.
      if(version<69){for(const q of new Set([p,data.player])){if(q?.perks&&Object.hasOwn(q.perks,'soldier_braced')){q.perks.soldier_hunter=(q.perks.soldier_hunter||0)+q.perks.soldier_braced;delete q.perks.soldier_braced;}if(q?.fireChain&&Number.isInteger(q.fireChain.count)&&q.fireChain.count>3)q.fireChain.count=3;}
       if(Array.isArray(data.perkDraft?.ids))data.perkDraft.ids=data.perkDraft.ids.map(id=>id==='soldier_braced'?'soldier_hunter':id);}
      // SAVE 86 (3.208.0, src/faction-catalog.js): faction-given traits (the swarm's agile larvae and 近戰壓制) follow the
      // table on every load, whatever the version — this floor, your units and every kept floor, which the archive check
      // below then reads: missing ones are added (a save from before 3.208.0), ones the table dropped are removed, and an
      // unchanged table changes nothing (review). The rank is the table's, never saved.
      syncFactionTraits(data);
      if((version>=7&&!validTraits(data.player.traits))||!validTraits(p.traits)||data.enemies.some(e=>!validTraits(e.traits)))return null;
      const tacticalActors=[p,...data.enemies,...(data.allies||[])];
      if(version<34){for(const a of tacticalActors){if(a===p){a.cornerExposure=null;a.tactics=null;}else{delete a.cornerExposure;delete a.tactics;}}for(const frame of Object.values(data.floorStates||{}))for(const a of frame.enemies||[]){delete a.cornerExposure;delete a.tactics;}}
      if(!tacticalActors.every(a=>(a===p||validEnemyAffixes(a))&&validActorSpecials(a,point))||!validEnemyMarks(data.marks,point,data.turn))return null;
      if(!tacticalActors.every(a=>validCorner(a,data.turn)&&validTactics(a,data.turn)))return null;
      // 3.131.0 (SAVE 60): a hiding rebel's cover spot moved from cowerAt into its retreat order.
      // 3.132.0 (SAVE 61): a squad member's spot, arrival and role moved from e.squad into its duty order.
      if(version<61)for(const e of [...data.enemies,...Object.values(data.floorStates||{}).flatMap(f=>f.enemies||[])]){
        const s=e.squad;if(!s||typeof s!=='object'||s.goal===undefined)continue;
        if(!e.order)e.order={kind:s.role==='move'?'bound':'post',by:s.leader,at:s.goal,set:s.set,since:Number.isSafeInteger(data.turn)?data.turn:0,patience:null,breakOn:[]};
        delete s.goal;delete s.set;delete s.role;
      }
      // 3.212.0 (SAVE 88): a deployer carries its kind and charges. An older run is only read to be settled as abandoned
      // (src/stale-runs.js), so its deployers keep what they had: one loitering munition, spent or not.
      if(version<88)for(const e of [...data.enemies,...Object.values(data.floorStates||{}).flatMap(f=>f.enemies||[])])if(deploys(e)&&e.deployKind===undefined){e.deployKind='munition';e.deployCharges=e.munitionSpent?0:1;}
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
      // 3.177.9 (user): the ninja sees through smoke like the recon and is not caught by its own stun grenade or EMP.
      if(p.character==='ninja')for(const id of ['infrared','close_throw'])if(!p.traits.some(t=>t.id===id&&t.source==='character:ninja'))grantTrait(p,id,'character:ninja');
      // Balance-only passive: existing trait schema, preserve HP/resources and avoid duplicate sources.
      // 3.210.0: the bulwark no longer has it (docs/BULWARK.md 改版); the class sync at the end drops a stale copy.
      if(p.character==='necromancer'&&!p.traits.some(t=>t.id==='difficult_healing'&&t.source===`character:${p.character}`))grantTrait(p,'difficult_healing',`character:${p.character}`);
      if(version<29)p.battleSpirit=freshSpirit();
      if(!validMeleeState(version>=29?data.player:p,data.turn))return null;
      if(!validAnchor(p))return null;
      if(!validSkillState(p)||![version>=22?data.player:p,...data.enemies].every(a=>typeof a.vaultExposed==='boolean'))return null;
      if(!Array.isArray(data.sensorContacts)||data.sensorContacts.length>256||data.sensorContacts.some(q=>!point(q))||(!skillActive(p,'early_warning')&&data.sensorContacts.length))return null;
      // 3.203.0 (a fix for a 3.148.0 slip): the cap is the one the game fills to, 加掛板架 included; a run with the rack
      // and more plates than the bare class cap was refused on load.
      // 3.210.0: the cap is a tuning number (the bulwark's 120 is the knob the user will turn), so a save above it is cut
      // to it rather than refused (docs/CHECKLIST.md section 3).
      p.plates=data.player.plates??0;if(!Number.isInteger(p.plates)||p.plates<0)return null;p.plates=Math.min(p.plates,plateCapacityOf(p));
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||data.grid[p.y]?.[p.x]!==1||!Number.isFinite(p.hp)||p.hp<=0)return null;
      if(version<5){
        p.weaponBases=CATALOG.map((_,i)=>i);p.affixes=CATALOG.map(()=>null);   // CATALOG: the fresh pack's slots (3.203.0)
        p.ammo=CATALOG.map((_,i)=>data.player.ammo?.[i]??defaults.ammo[i]);
        p.upgrades=CATALOG.map((_,i)=>data.player.upgrades?.[i]??0);
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
        if(!base||base.melee||base.flame||base.locked||locations.has(slot))return null;locations.add(slot);   // flame: 3.203.0, never mounted
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
      // 3.146.0: keycards; older saves hold none (and their floors have no vaults).
      if(version<67)g.player.keycards??=[];
      // 3.178.0 (docs/LIGHTING.md): real lighting. Saves from before carry no glowsticks and the flashlight off; their floors
      // (this one and any kept for the way back) have no light model, so they keep the old rule until the next floor.
      if(version<73){g.player.glowsticks??=0;g.player.flashlight??=false;}
      if(version<74)g.player.lightLingers??=false;   // 3.182.0
      // 3.185.0 (plan C): rifle rounds x3 and pistol rounds x2 wherever the run holds them — your reserves and every amount
      // lying on a floor or in a case, this one and any kept for the way back — so the triggers you can pull stay the same.
      if(version<75){
        const scale=o=>{if(!Number.isSafeInteger(o?.amount))return;if(o.type==='ammo')o.amount*=3;else if(o.type==='pistol')o.amount*=2;};
        g.player.reserve*=3;g.player.pistol*=2;
        for(const f of [g,...Object.values(g.floorStates||{})]){for(const i of f.items||[])scale(i);for(const o of f.props||[])for(const i of o.contents||[])scale(i);}
      }
      // 3.187.0: wall lamps can be shot out; every lamp in an older save is still lit.
      if(version<76)for(const f of [g,...Object.values(g.floorStates||{})])for(const lamp of f.lamps||[])lamp.hp??=1;
      // 3.191.0: survival waves are announced ahead; a run from 3.189–3.190 has none waiting yet.
      if(version<79&&g.survival&&!Array.isArray(g.survival.incoming))g.survival.incoming=[];
      // 3.203.0 (SAVE 81): a save from before has nothing burning, no marked cone and no flamers, so it needs nothing
      // converted; `fires` and `flameIntent` are checked the same whatever the version (below).
      g.glowsticks??=[];g.gunFlashes??=[];
      if(!Number.isSafeInteger(g.player.glowsticks)||g.player.glowsticks<0||g.player.glowsticks>10000000||typeof g.player.flashlight!=='boolean'||typeof g.player.lightLingers!=='boolean'||!validGlowsticks(g.glowsticks,g.grid)||!validGunFlashes(g.gunFlashes,g.grid)||!(g.lightModel===undefined?g.lamps===undefined:g.lightModel===LIGHT_MODEL&&validLamps(g.lamps,g.grid)))return null;
      if(version<66){g.player.decoys??=0;g.player.mines??=0;g.player.exoPlates??=0;g.decoy??=null;g.mines??=[];g.mineSerial??=0;}
      if(![0,1].includes(g.player.recovery)||!(g.player.meleeSlot===null||Number.isInteger(g.player.meleeSlot)&&WEAPONS[g.player.weaponBases[g.player.meleeSlot]]?.melee))return null;
      if(!['escapeLines','redeployLines'].every(k=>Number.isSafeInteger(g.player[k])&&g.player[k]>=0&&g.player[k]<=10000000))return null;
      if(!Number.isSafeInteger(g.player.flares)||g.player.flares<0||g.player.flares>10000000||!validFlares(g.flares,g.grid,g.turn))return null;
      // 3.108.0: the worn item's passives are derived from the slot, never trusted from the file.
      g.player.wearables??=[];syncWearableTraits(g.player);
      if(!['decoys','mines'].every(k=>Number.isSafeInteger(g.player[k])&&g.player[k]>=0&&g.player[k]<=10000000)||!validExo(g.player)||!validDecoy(g)||!validMines(g)||!validKeycards(g.player)||!validVaultState(g.barriers,g.enemies))return null;
      if(version<33)g.pursuit=0;
      if(!Number.isInteger(g.pursuit)||g.pursuit<0||g.pursuit>1||g.pursuit&&(g.shadowSteps>0||p.control.disabled))return null;
      // The enemy specials (src/enemy-specials.js, 3.206.1), on this floor and every kept one: numbers longer than today's
      // tuning are cut to it, and a warning its unit could no longer give (fallen, stunned, pinned or moved outside its own
      // turn) is dropped, not refused (3.203.0-3.206.0 reviews); then each is checked as its declaration says.
      // SAVE 81-84 (3.203.0-3.206.0) needed nothing converted: a save from before has no marked cone, paint, gun, charge,
      // egg sac, laid nest, wall, ring or set-up flamethrower (a floor already generated keeps its warden or core guard).
      // SAVE 85 (3.207.0, src/delisted-operatives.js) needs nothing converted either: a save from before has no delisted
      // operative (a floor already generated keeps its own boss), so no serial, scan, grenade or smoke cooldown, warned
      // smoke, drone clock or unveiled ninja; a scan on you is cut to today's tuning like the rest.
      dropStaleSpecials(g);dropStaleOperatives(g);
      if(!validRuntime(g)||!validVents(g)||!validFireTiles(g)||!validSpecials(g)||!validOperatives(g)||!validSwarmState(g)||!validSwarmWaves(g)||!validSurvival(g)||!validSquad(g)||!validRebels(g)||!validOrders(g)||!validFieldSmoke(g))return null;
      if(version<32)g.shadowSteps=0;
      // Free moves used to come only from 影步, so the loader tied them to the ninja perk. Adrenaline (3.106.0) gives
      // them to every class, and that clause was rejecting any save taken between the shot and the steps — the run
      // was simply lost. The bound still matches the largest grant either source can make.
      if(!Number.isInteger(g.shadowSteps)||g.shadowSteps<0||g.shadowSteps>Math.max(SURGE_STEPS,2))return null;
      if(!validPerks(g))return null;
      if(version<35&&!migratePetBond(g))return null;
      if(version<36&&!migratePetNodes(g,version===35))return null;
      if(!validAllies(g)||!validPetBond(g)||!validWorkshop(g))return null;
      // 3.178.0: a kept floor from before real lighting has no lamps, light model or glowsticks; it must not borrow this floor's.
      // 3.203.0: nor this floor's fire (SAVE 81): a floor kept without `fires` is checked without them.
      if(!validRetreatState(g,(floor,frame)=>Boolean(Game.restore(JSON.stringify({version:SAVE_VERSION,rngState:g.rng.state(),data:{...data,swarmWaves:undefined,mapStyle:undefined,flares:[],glowsticks:[],gunFlashes:[],lamps:undefined,lightModel:undefined,vents:undefined,fires:undefined,classPerkMisses:g.classPerkMisses,legacyPerkPicks:g.legacyPerkPicks,pendingPerks:g.pendingPerks,perkPicks:g.perkPicks,perkDraft:g.perkDraft,...Object.fromEntries(MAP_FIELDS.map(k=>[k,undefined])),...frame,pursuit:0,turn:frame.savedTurn,floor,floorStates:{},allies:[],sensorContacts:[],mission:newMission(),player:{...p,petBond:null,traits:p.traits.filter(t=>t.source!=='pet:vision'),battleSpirit:{...p.battleSpirit,lastKill:p.battleSpirit.lastKill===null?null:Math.min(p.battleSpirit.lastKill,frame.savedTurn)},x:frame.start.x,y:frame.start.y,cornerExposure:null,tactics:null,fireChain:null}}})))))return null;
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
      // 3.158.0: a class can gain a native passive after a run began (the berserker's), so the class list is re-derived
      // after every migration; grantTrait skips what the save already carries and the cap is never exceeded.
      grantCharacterTraits(g.player,TRAIT_CAP);
      lockRealMode(g,data.realMode);g.setCarryLevel(g.carryLevel);g.reveal({warnings:false});return g;
    }catch{return null;}
  }
}
