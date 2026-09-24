import {t} from './i18n.js';
import {STORIES} from './story-data.js';
import {DEFAULT_FACTION,factionBoss} from './faction-catalog.js';
// Content and balance live here. IDs are persisted in saves: append, never reorder.
export const SIZE = 27;
// Grid cells: 0 wall, 1 floor, VOID a pit (3.164.0, src/pits.js) — nobody walks on it but flyers; sight, shots and
// blasts cross it. seeThrough is what a line of sight may pass over or end on.
export const VOID = 2;
export const seeThrough = v => v === 1 || v === VOID;
export const SAVE_VERSION = 72;   // 72 (3.177.2): a vault closet's walls are sealed (src/vault.js); 71 (3.169.0): the run keeps its comms duty officer (src/duty.js)
// Every earlier save version stays loadable (and is backed up before migrating). Derived, so bumping SAVE_VERSION
// can never silently drop the previous one from the list (3.44).
export const LEGACY_SAVE_VERSIONS = Array.from({length: SAVE_VERSION - 1}, (_, i) => i + 1);
export const PACK_LIMIT = 3;
export const PLATE_CAPACITY = 30;
// Floor stencils (3.165.2, user decision 2026-09-23): zone labels painted on the floor are English in every language,
// like the living-module codes (WC, ACCESS, OFFICE…). They never go into a language table.
export const SUPPLY_ROOMS={ammo:{code:'AMMO',color:'#d9bd7b'},medical:{code:'MEDICAL',color:'#a9d9ac'},armor:{code:'ARMOR',color:'#92c4df'}};
export const RARE_ARMORY={weapon:8,minFloor:3,chance:.2};
export const WEAPONS = [
  { id:'rifle', weaponClass:'rifle', name:t('weapons.rifle.name'), type:'ASSAULT RIFLE', code:'AR–09', min:22, max:28, range:7, mag:8, file:'rifle', ammoType:'rifle', desc:t('weapons.rifle.desc') },
  // 3.112.0 (user request): range 6 and a 60 degree cone. Close and middle bands keep their numbers; 5-6 tiles is new and weak.
  // splash stays for the paths that still fire it at one target: mounted drones and suppressive fire.
  // 3.141.0 (user decisions 2026-09-19, docs/WEAPONS.md): the player's cone fires pellets. pellets[d-1] land-rolls at d
  // tiles, each pelletMin-pelletMax and a flat pelletHit%; armour counts against every pellet and cover cuts pelletCover.
  // The bands above stay for doors, cover, barrels, mounted drones and suppressive fire.
  { id:'shotgun', weaponClass:'shotgun', name:t('weapons.shotgun.name'), type:'COMBAT SHOTGUN', code:'SG–12', min:42, max:54, closeRange:2, closeMin:60, closeMax:72, closeAccuracy:15, farFrom:5, farMin:21, farMax:27, cone:30, range:6, mag:4, file:'shotgun', ammoType:'shell', splash:1,
    pellets:[6,6,5,4,3,2], pelletMin:10, pelletMax:12, pelletHit:95, pelletCover:.6,
    desc:t('weapons.shotgun.desc') },
  { id:'smg', weaponClass:'smg', name:t('weapons.smg.name'), type:'SUBMACHINE GUN', code:'SM–24', min:13, max:17, range:5, mag:18, file:'smg', ammoType:'pistol', burst:2, desc:t('weapons.smg.desc') },
  { id:'sniper', weaponClass:'sniper', name:t('weapons.sniper.name'), type:'PRECISION RIFLE', code:'SR–07', min:52, max:66, range:10, mag:3, file:'sniper', ammoType:'rifle', pierce:0.7, aimPenalty:40, desc:t('weapons.sniper.desc') },
  // 3.141.0 (user decisions 2026-09-19): a precision rifle's hit without the aiming, full piercing, the rifle's range. It is
  // strong because batteries are short: a reserve for the big fights that still takes a weapon slot.
  { id:'plasma', weaponClass:'plasma', name:t('weapons.plasma.name'), type:'PLASMA CARBINE', code:'PL–08', min:52, max:66, range:7, mag:6, file:'plasma', ammoType:'energy', pierce:1, desc:t('weapons.plasma.desc') },
  { id:'launcher', weaponClass:'launcher', name:t('weapons.launcher.name'), type:'GRENADE LAUNCHER', code:'GL–03', min:54, max:64, range:6, mag:2, file:'launcher', ammoType:'ordnance', explosive:true, pointTarget:true, desc:t('weapons.launcher.desc') },
  {id:'lmg',weaponClass:'lmg',name:t('weapons.lmg.name'),type:'LIGHT MACHINE GUN',code:'LM–30',min:18,max:22,range:7,mag:30,file:'lmg',ammoType:'rifle',burst:3,desc:t('weapons.lmg.desc')},
  {id:'powerfist',weaponClass:'melee',name:t('weapons.powerfist.name'),type:'POWER GAUNTLET',code:'PF–01',min:70,max:90,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,hitChance:99,pierce:.5,desc:t('weapons.powerfist.desc')},
  {id:'thunder',weaponClass:'burst_launcher',name:t('weapons.thunder.name'),type:'BURST GRENADE RIFLE',code:'TB–09',min:24,max:30,range:6,mag:9,file:'thunder',ammoType:'ordnance',burst:3,explosive:true,lootOnly:true,desc:t('weapons.thunder.desc')},
  {id:'axe',weaponClass:'melee',name:t('weapons.axe.name'),type:'BOUND AXE',code:'AX–01',min:44,max:54,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,boundCharacter:'berserker',hitChance:92,pierce:.3,desc:t('weapons.axe.desc')},
  {id:'katana',weaponClass:'melee',name:t('weapons.katana.name'),type:'BOUND BLADE',code:'KT–01',min:30,max:36,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,boundCharacter:'ninja',hitChance:95,desc:t('weapons.katana.desc')},
];
// Unbound loot variants append IDs; class-bound originals remain untouched.
for(const [base,id] of [[9,'loot_axe'],[10,'loot_katana']]){const {locked,boundCharacter,...weapon}=WEAPONS[base];WEAPONS.push({...weapon,id,lootOnly:true,type:'MELEE WEAPON',desc:t('weapons.lootMelee.desc')});}
// 3.136.0 (user decisions 2026-09-19, docs/MELEE_WEAPONS.md): melee weapons anyone may carry, found in unidentified
// crates. A bump attack uses the one picked in the pack. Switching to one to hold it costs a turn like any gun.
WEAPONS.push(
  {id:'knife',weaponClass:'melee',name:t('weapons.knife.name'),type:'SURVIVAL KNIFE',code:'KN–02',min:16,max:20,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,lootOnly:true,hitChance:97,desc:t('weapons.knife.desc')},
  {id:'claws',weaponClass:'melee',name:t('weapons.claws.name'),type:'CLAW GAUNTLET',code:'CL–03',min:14,max:18,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,lootOnly:true,hitChance:95,phase:'fast',bareBonus:.5,desc:t('weapons.claws.desc')},
  {id:'sabre',weaponClass:'melee',name:t('weapons.sabre.name'),type:'SABRE',code:'SB–04',min:26,max:32,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,lootOnly:true,hitChance:90,splash:.45,desc:t('weapons.sabre.desc')},
  {id:'spear',weaponClass:'melee',name:t('weapons.spear.name'),type:'SPEAR',code:'SP–05',min:20,max:26,range:2,mag:0,file:'powerfist',ammoType:null,melee:true,lootOnly:true,hitChance:92,thrust:true,desc:t('weapons.spear.desc')},
  {id:'chainsaw',weaponClass:'melee',name:t('weapons.chainsaw.name'),type:'CHAINSAW',code:'CS–06',min:3,max:10,hits:10,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,lootOnly:true,hitChance:88,pierce:1,phase:'slow',recovery:true,desc:t('weapons.chainsaw.desc')},
);
export const FLOORS = [t('floors.0'),t('floors.1'),t('floors.2'),t('floors.3'),t('floors.4'),t('floors.5')];
export const FLOOR_INFO = [
  { color:'#a4b484', subtitle:'TRANSIT HUB', text:t('floorInfo.0.text'), hazard:null },
  { color:'#73b8a0', subtitle:'COOLANT WORKS', text:t('floorInfo.1.text'), hazard:'acid' },
  { color:'#cead71', subtitle:'ARMORY LOCKDOWN', text:t('floorInfo.2.text'), hazard:null, get boss(){return factionBoss(DEFAULT_FACTION,3);} },
  { color:'#bc89b6', subtitle:'BIO CULTURE', text:t('floorInfo.3.text'), hazard:'acid' },
  { color:'#de885a', subtitle:'THERMAL FORGE', text:t('floorInfo.4.text'), hazard:'fire' },
  { color:'#d56e60', subtitle:'ABYSS CORE', text:t('floorInfo.5.text'), hazard:'fire', get boss(){return factionBoss(DEFAULT_FACTION,6);} },
];
export function floorInfo(floor){const index=((floor-1)%FLOORS.length+FLOORS.length)%FLOORS.length;return {...FLOOR_INFO[index],name:FLOORS[index],cycleFloor:index+1,weapon:[2,3,4,5,3,4][index]};}
export const ENEMY_TYPES = {
  fodder:{sprite:{key:'rifleman',size:.8},projectile:'melee',voice:'creature',tags:[],traits:['slow','no_cover'],behavior:'fodder',rounds:1,attackStyle:'bullet',name:t('enemyTypes.fodder.name'),hp:6,damage:2,range:1,armor:0,color:'#a0a184',xp:0,expendable:true,role:t('enemyTypes.fodder.role')},
  brood:{sprite:{key:'crawler',size:.65},projectile:'melee',voice:'creature',tags:[],traits:['fast','no_cover','underfoot'],behavior:'brood',rounds:1,attackStyle:'bullet',name:t('enemyTypes.brood.name'),hp:6,damage:4,range:1,armor:0,color:'#cfac7c',xp:0,expendable:true,role:t('enemyTypes.brood.role')},
  rifleman:{projectile:'rifle',casing:'rifle',tags:['armed'],traits:[],rounds:1,attackStyle:'bullet',loot:{weapon:0,chance:.20,ammo:'ammo'},name:t('enemyTypes.rifleman.name'),hp:22,damage:17,range:7,armor:0,color:'#9fba81',xp:1,fragile:true,rapid:true,seekCover:true,role:t('enemyTypes.rifleman.role')},
  raider:{projectile:'smg',casing:'pistol',tags:['armed'],traits:[],rounds:2,attackStyle:'bullet',loot:{weapon:2,chance:.18,ammo:'pistol'},name:t('enemyTypes.raider.name'),hp:18,damage:21,range:5,armor:0,color:'#d4b185',xp:1,fragile:true,rapid:true,seekCover:true,role:t('enemyTypes.raider.role')},
  crawler:{drawing:{shape:'critter',color:'#ba966d'},projectile:'melee',voice:'creature',tags:['breaker'],traits:[],floorTraits:[{id:'fast',minFloor:4}],rounds:1,attackStyle:'claw', name:t('enemyTypes.crawler.name'), hp:32, damage:9, range:1, armor:0, color:'#bd9667', xp:1, role:t('enemyTypes.crawler.role') },
  gunner:{sprite:{key:'rifleman'},projectile:'shotgun',casing:'shell',tags:['armed'],traits:[],rounds:1,attackStyle:'bullet',loot:{weapon:1,chance:.14,ammo:'shell'}, name:t('enemyTypes.gunner.name'), hp:42, damage:11, range:6, armor:0, color:'#92a480', xp:1, role:t('enemyTypes.gunner.role') },
  drone:{drawing:{shape:'drone'},projectile:'plasma',glyph:'◇',tags:['flying'],traits:['no_cover'],rounds:1,attackStyle:'plasma',loot:{ammo:'energy'}, name:t('enemyTypes.drone.name'), hp:28, damage:9, range:5, armor:0, color:'#85c4c0', xp:1, mechanical:true, role:t('enemyTypes.drone.role') },
  brute:{drawing:{heavy:true},projectile:'melee',tags:['breaker'],traits:['large','suppression_resistance'],rounds:1,attackStyle:'slash',loot:{rareWeapon:8,rareChance:.1}, name:t('enemyTypes.brute.name'), hp:90, damage:20, range:1, armor:7, color:'#b99573', xp:2, role:t('enemyTypes.brute.role') },
  sniper:{drawing:{longBarrel:true},projectile:'sniper',casing:'rifle',tags:['armed'],traits:['night_vision'],behavior:'sniper',accepts:['ambush'],dropsGoggles:true,rounds:1,attackStyle:'bullet',loot:{weapon:3,chance:.2,ammo:'ammo'}, name:t('enemyTypes.sniper.name'), hp:45, damage:23, range:10, armor:1, color:'#b3adcb', xp:2, role:t('enemyTypes.sniper.role') },
  bomber:{drawing:{shape:'critter',color:'#aabb71',glow:'#e9d24c33'},voice:'creature',tags:['breaker'],traits:[],behavior:'bomber',sacs:true,rounds:1,attackStyle:'bullet', name:t('enemyTypes.bomber.name'), hp:30, damage:30, range:1, armor:0, color:'#b8bc67', xp:1, role:t('enemyTypes.bomber.role') },
  warden:{sprite:{scale:1.15},drawing:{heavy:true},projectile:'plasma',tags:['boss'],traits:['infrared','suppression_resistance'],behavior:'warden',rounds:1,attackStyle:'plasma',reinforcement:'drone',loot:{weapon:4,chance:1,ammo:'energy',rareWeapon:8,rareChance:.15}, name:t('enemyTypes.warden.name'), hp:180, damage:19, range:6, armor:5, color:'#d9aa70', xp:4, mechanical:true, role:t('enemyTypes.warden.role') },
  boss:{sprite:{scale:1.15},drawing:{heavy:true},projectile:'plasma',glyph:'Ω',tags:['boss','breaker'],traits:['suppression_resistance'],behavior:'boss',rounds:1,attackStyle:'plasma',reinforcement:'drone',loot:{ammo:'ordnance'}, name:t('enemyTypes.boss.name'), hp:280, damage:22, range:7, armor:7, color:'#df785f', xp:6, mechanical:true, role:t('enemyTypes.boss.role') },
  // Rebel suicide robot (3.80.0): the bomber behaviour on a mechanical body, borrowing the drone sprite with a rust tint.
  bomber_bot:{sprite:{key:'drone',tint:'#d9894a'},drawing:{shape:'drone'},tags:['breaker'],traits:[],behavior:'bomber',rounds:1,attackStyle:'plasma',name:t('enemyTypes.bomber_bot.name'),hp:30,damage:30,range:1,armor:0,color:'#c98f55',xp:1,mechanical:true,role:t('enemyTypes.bomber_bot.role')},
};
// Compatibility view keeps the historical key order; loot has one authoritative home.
export const ENEMY_LOOT=Object.freeze(Object.fromEntries(['rifleman','raider','gunner','sniper','drone','brute','warden','boss'].map(id=>[id,Object.freeze(ENEMY_TYPES[id].loot)])));
// Variant cards: a copy of the base card with the same name, loot and art plus a patch; variantOf keeps the base id so
// the bestiary lists only base cards. Rebel heroes are always born elite (3.80.0, docs/ELITE_ENEMIES.md 9); loyalist
// troops wear armour 1 (3.81.0, docs/FACTION_DATA.md 15).
const variantCard=(base,patch)=>({...ENEMY_TYPES[base],sprite:{...ENEMY_TYPES[base].sprite,key:ENEMY_TYPES[base].sprite?.key||base},variantOf:base,...patch});
for(const base of ['raider','gunner'])ENEMY_TYPES[`${base}_elite`]=variantCard(base,{elite:true});
for(const base of ['rifleman','raider'])ENEMY_TYPES[`${base}_armored`]=variantCard(base,{armor:1});
// Swarm (3.83.0, docs/FACTION_DATA.md 16): a giant bug with huge HP and no armour, oversized bug bosses on the crawler
// art, and infected soldiers that fire more rounds with far worse aim (card combat becomes the unit's combatModifiers).
ENEMY_TYPES.giant_bug={sprite:{key:'crawler',size:1.3,scale:1.3,tint:'#9a7a52'},drawing:{shape:'critter',color:'#9a7a52'},projectile:'melee',voice:'creature',tags:['breaker'],traits:['large','suppression_resistance'],rounds:1,attackStyle:'claw',name:t('enemyTypes.giant_bug.name'),hp:150,damage:22,range:1,armor:0,color:'#9a7a52',xp:3,role:t('enemyTypes.giant_bug.role')};
ENEMY_TYPES.hive_beast={...ENEMY_TYPES.giant_bug,sprite:{key:'crawler',size:1.55,scale:1.55,tint:'#80603f'},drawing:{shape:'critter',color:'#80603f'},tags:['boss','breaker'],name:t('enemyTypes.hive_beast.name'),hp:420,damage:26,xp:4,role:t('enemyTypes.hive_beast.role')};
ENEMY_TYPES.hive_matriarch={...ENEMY_TYPES.hive_beast,sprite:{key:'crawler',size:1.7,scale:1.7,tint:'#6e4a5a'},drawing:{shape:'critter',color:'#6e4a5a'},name:t('enemyTypes.hive_matriarch.name'),hp:600,damage:30,xp:5,role:t('enemyTypes.hive_matriarch.role')};
for(const [base,rounds,ammo,tint,name] of [['rifleman',3,'ammo','#8fa06a',t('enemyTypes.rifleman_infected.name')],['raider',4,'pistol','#a0925e',t('enemyTypes.raider_infected.name')]])
 ENEMY_TYPES[`${base}_infected`]=variantCard(base,{name,rounds,combat:{rangedAccuracy:-35},loot:{ammo},voice:'infected',sprite:{key:base,tint},role:t('enemyTypes.infected.role')});
// Squad leader (3.125.0, user design): support first, rifle second. It identifies the player's weapon, sends the squad
// to positions that answer it, and spends its own action keeping them 已就緒, so it is the unit to shoot first.
ENEMY_TYPES.squad_leader={sprite:{key:'rifleman',tint:'#c7b06a'},drawing:{shape:'humanoid',color:'#c7b06a'},projectile:'rifle',casing:'rifle',tags:['armed'],traits:['suppression_resistance','night_vision','infrared'],dropsInfrared:true,rounds:1,attackStyle:'bullet',behavior:'squad_leader',loot:{weapon:0,chance:.2,ammo:'ammo'},name:t('enemyTypes.squad_leader.name'),hp:34,damage:12,range:6,armor:1,color:'#c7b06a',xp:2,role:t('enemyTypes.squad_leader.role')};
// Enforcer (3.127.0, user design, docs/REBELS.md): slow, with a long and hopeless gun; its real work is executing the
// rebels who hide, which throws the whole unit back into the fight. Two a floor, three from floor 7.
ENEMY_TYPES.enforcer={sprite:{key:'rifleman',tint:'#8a3a34'},drawing:{shape:'humanoid',color:'#8a3a34'},projectile:'rifle',casing:'pistol',tags:['armed'],traits:['slow'],rounds:1,attackStyle:'bullet',behavior:'enforcer',speaksAs:'enforcer',maxPerFloor:2,maxPerFloorDeep:3,combat:{rangedAccuracy:-40},loot:{weapon:2,chance:.18,ammo:'pistol'},name:t('enemyTypes.enforcer.name'),hp:40,damage:10,range:10,armor:1,color:'#8a3a34',xp:2,role:t('enemyTypes.enforcer.role')};
// Stable IDs; append content without changing saved offers. null cap means consumable reward.
// 3.138.0 (user decisions 2026-09-19, docs/PERK_GROWTH.md): the direct-number perks give less per rank. `classic` holds the
// values a run started before 3.138.0 keeps (src/perks.js perkDef); the utility perks are unchanged.
// 3.148.0 升級 D (docs/PERK_GROWTH.md): per rank, the wait's aim bonus, the moving penalty you give enemies, how much of
// a regular affix's upside is added again, and the plate capacity.
export const PERK_D=Object.freeze({steady:8,skirmish:6,mastery:.25,rack:10});
export const PERKS = [
  {id:'damage',rules:[1,2],name:t('perks.damage.name'),cap:3,effect:'weapon',amount:4,text:t('perks.damage.text'),classic:{amount:6,text:t('perks.damage.classic.text')}},
  {id:'health',name:t('perks.health.name'),cap:3,effect:'health',amount:20,heal:30,text:t('perks.health.text'),classic:{amount:25,heal:40,text:t('perks.health.classic.text')}},
  {id:'armor',rules:[1,2],name:t('perks.armor.name'),cap:3,effect:'stat',stat:'armor',amount:2,text:t('perks.armor.text'),classic:{amount:3,text:t('perks.armor.classic.text')}},
  {id:'med',name:t('perks.med.name'),cap:null,effect:'supply',text:t('perks.med.text')},
  {id:'blast',name:t('perks.blast.name'),cap:3,effect:'stat',stat:'blastBonus',amount:12,text:t('perks.blast.text'),classic:{amount:18,text:t('perks.blast.classic.text')}},
  {id:'scavenger',name:t('perks.scavenger.name'),cap:3,effect:'scavenger',amount:1,text:t('perks.scavenger.text')},
  {id:'medic',name:t('perks.medic.name'),cap:3,effect:'medic',amount:20,text:t('perks.medic.text')},
  {id:'hazmat',name:t('perks.hazmat.name'),cap:3,effect:'hazmat',amount:5,text:t('perks.hazmat.text')},
  {id:'accuracy',rules:[1,2],name:t('perks.accuracy.name'),cap:3,effect:'combat',stats:['rangedAccuracy'],amount:5,text:t('perks.accuracy.text'),classic:{amount:8,text:t('perks.accuracy.classic.text')}},
  {id:'evasion',rules:[1,2],name:t('perks.evasion.name'),cap:3,effect:'combat',stats:['rangedEvasion'],amount:5,text:t('perks.evasion.text'),classic:{amount:8,text:t('perks.evasion.classic.text')}},
  {id:'melee',name:t('perks.melee.name'),cap:3,effect:'combat',stats:['meleeAccuracy','meleeEvasion'],amount:8,text:t('perks.melee.text')},
  {id:'plating',name:t('perks.plating.name'),cap:3,effect:'plating',amount:10,text:t('perks.plating.text')},
  // 3.148.0 (user decisions 2026-09-19, docs/PERK_GROWTH.md 升級 D): runs started from 3.148.0 (perkRules 3) get these four
  // in place of 武器增幅, 複合裝甲, 精準射擊 and 戰術閃避, which stay with older runs. Numbers in PERK_D.
  {id:'steady',rules:[3],name:t('perks.steady.name'),cap:3,effect:'passive',text:t('perks.steady.text')},
  {id:'skirmish',rules:[3],name:t('perks.skirmish.name'),cap:3,effect:'passive',text:t('perks.skirmish.text')},
  {id:'mod_mastery',rules:[3],name:t('perks.mod_mastery.name'),cap:3,effect:'passive',text:t('perks.mod_mastery.text')},
  {id:'plate_rack',rules:[3],name:t('perks.plate_rack.name'),cap:3,effect:'rack',amount:10,text:t('perks.plate_rack.text')},
  {id:'bulwark_plating',name:t('perks.bulwark_plating.name'),characters:['bulwark'],cap:3,effect:'passive',text:t('perks.bulwark_plating.text')},
  {id:'bulwark_recovery',name:t('perks.bulwark_recovery.name'),characters:['bulwark'],cap:3,effect:'passive',text:t('perks.bulwark_recovery.text')},
  {id:'bulwark_anchor',name:t('perks.bulwark_anchor.name'),characters:['bulwark'],cap:3,effect:'passive',text:t('perks.bulwark_anchor.text')},
  {id:'berserker_fury',name:t('perks.berserker_fury.name'),characters:['berserker'],cap:3,effect:'passive',text:t('perks.berserker_fury.text')},
  {id:'berserker_endure',name:t('perks.berserker_endure.name'),characters:['berserker'],cap:3,effect:'passive',text:t('perks.berserker_endure.text')},
  {id:'berserker_thirst',name:t('perks.berserker_thirst.name'),characters:['berserker'],cap:3,effect:'passive',text:t('perks.berserker_thirst.text')},
  {id:'necro_horde',name:'群葬',characters:['necromancer'],cap:3,effect:'passive',text:'同時存在的召喚物上限 +1（基礎 3）。'},
  {id:'necro_haste',name:'速葬',characters:['necromancer'],cap:3,effect:'passive',text:'自動起身間隔 −1 次付費行動（基礎 4，下限 1）；目前倒數同步縮短。'},
  {id:'necro_blades',name:'亡者利刃',characters:['necromancer'],cap:3,effect:'passive',text:'所有召喚物的近戰與射擊傷害 +4；不增加耐久。'},
  {id:'engineer_salvage',name:t('perks.engineer_salvage.name'),characters:['engineer'],cap:3,effect:'passive',text:t('perks.engineer_salvage.text')},
  {id:'engineer_frame',name:t('perks.engineer_frame.name'),characters:['engineer'],cap:3,effect:'passive',text:t('perks.engineer_frame.text')},
  {id:'engineer_firecontrol',name:t('perks.engineer_firecontrol.name'),characters:['engineer'],cap:3,effect:'passive',text:t('perks.engineer_firecontrol.text')},
  {id:'engineer_lines',name:t('perks.engineer_lines.name'),characters:['engineer'],cap:3,effect:'passive',text:t('perks.engineer_lines.text')},
  {id:'engineer_deploy',name:t('perks.engineer_deploy.name'),characters:['engineer'],cap:3,effect:'passive',text:t('perks.engineer_deploy.text')},
  {id:'druid_beast',name:'飽食',characters:['druid'],cap:3,effect:'passive',text:'胃容量 +10 燃料，射擊與排出消耗減少 10%。'},
  {id:'druid_claws',name:'飢餓',characters:['druid'],cap:3,effect:'passive',text:'胃空時獵獸近戰傷害 +25%。'},
  {id:'druid_symbiosis',name:'共生',characters:['druid'],cap:3,effect:'passive',text:'寵物每次擊殺敵人，你回復 4 生命；每階累加。'},
  {id:'soldier_overwatch',name:t('perks.soldier_overwatch.name'),characters:['soldier'],cap:3,effect:'passive',text:t('perks.soldier_overwatch.text')},
  {id:'soldier_marked',name:t('perks.soldier_marked.name'),characters:['soldier'],cap:3,effect:'passive',text:t('perks.soldier_marked.text')},
  // 3.159.0 (user decision): 架槍精通 gave way to the second mark line; saves carry its ranks over.
  {id:'soldier_hunter',name:t('perks.soldier_hunter.name'),characters:['soldier'],cap:3,effect:'passive',text:t('perks.soldier_hunter.text')},
  {id:'recon_unseen',name:t('perks.recon_unseen.name'),characters:['recon'],cap:3,effect:'passive',text:t('perks.recon_unseen.text')},
  {id:'recon_blackout',name:t('perks.recon_blackout.name'),characters:['recon'],cap:3,effect:'passive',text:t('perks.recon_blackout.text')},
  {id:'recon_sidestep',name:t('perks.recon_sidestep.name'),characters:['recon'],cap:3,effect:'passive',text:t('perks.recon_sidestep.text')},
  {id:'ninja_shadowstep',name:t('perks.ninja_shadowstep.name'),characters:['ninja'],cap:3,effect:'passive',text:t('perks.ninja_shadowstep.text')},
  {id:'ninja_ambush',name:t('perks.ninja_ambush.name'),characters:['ninja'],cap:3,effect:'passive',text:t('perks.ninja_ambush.text')},
  {id:'ninja_overload',name:t('perks.ninja_overload.name'),characters:['ninja'],cap:3,effect:'passive',text:t('perks.ninja_overload.text')},
];
export const SUPPLY_NAMES = {ammo:t('supplyNames.ammo'),pistol:t('supplyNames.pistol'),shell:t('supplyNames.shell'),energy:t('supplyNames.energy'),ordnance:t('supplyNames.ordnance'),med:t('supplyNames.med'),armor:t('supplyNames.armor'),grenade:t('supplyNames.grenade'),smoke:t('supplyNames.smoke'),emp:t('supplyNames.emp'),stun:t('supplyNames.stun'),scrap:t('supplyNames.scrap'),weapon:t('supplyNames.weapon'),lore:t('supplyNames.lore'),spray:t('supplyNames.spray'),adrenaline:t('supplyNames.adrenaline'),barricade:t('supplyNames.barricade'),flare:t('supplyNames.flare'),nvg:t('supplyNames.nvg'),escape_line:t('supplyNames.escape_line'),redeploy_line:t('supplyNames.redeploy_line'),decoy:t('supplyNames.decoy'),mine:t('supplyNames.mine'),exo:t('supplyNames.exo'),key:t('supplyNames.key'),irg:t('supplyNames.irg')};
PERKS.push({id:'ammo_recovery',name:t('perks.ammo_recovery.name'),cap:3,effect:'passive',text:t('perks.ammo_recovery.text')});
export const LORE = STORIES.map(s=>s.body);

// Loitering munition (3.103.0, user request): launched by a 投放 enemy, it appears exactly at its strike range so one
// step back escapes it, and on its next turn it hooks itself to the player's side and detonates. Low hp on purpose —
// shooting it down has to be reliable, or the one turn of warning is not really a choice.
ENEMY_TYPES.munition={sprite:{key:'drone'},drawing:{shape:'drone',color:'#e0a65c',glow:'#f0b06a44'},glyph:'◈',tags:['flying'],traits:['no_cover'],behavior:'munition',rounds:1,attackStyle:'plasma',projectile:'plasma',
 // revealRange matches range on purpose: you see it exactly when it is close enough to hook you (3.105.0, user request).
 name:t('enemyTypes.munition.name'),hp:10,damage:34,range:3,revealRange:3,armor:0,color:'#e0a65c',xp:1,mechanical:true,expendable:true,
 role:t('enemyTypes.munition.role')};
ENEMY_TYPES.civilian={tags:['noncombatant'],traits:[],behavior:'civilian',voice:'civilian',name:t('enemyTypes.civilian.name'),hp:12,damage:0,range:0,rounds:0,armor:0,xp:0,color:'#d9ddd2',sprite:{key:'civilian'},drawing:{color:'#d9ddd2',unarmed:true},role:t('enemyTypes.civilian.role')};

ENEMY_TYPES.spitter={lobs:true,name:t('enemyTypes.spitter.name'),hp:34,damage:0,range:6,armor:0,xp:1,tags:[],traits:[],rounds:1,attackStyle:"venom",projectile:"venom",voice:"creature",venom:true,sprite:{key:"spitter"},drawing:{shape:"critter",color:"#9aab55"},color:"#9aab55",role:t('enemyTypes.spitter.role')};
for(const type of ["hive_beast","hive_matriarch"])ENEMY_TYPES[type].tongue=true;
for(const type of ["rifleman_infected","raider_infected","fodder"])ENEMY_TYPES[type].tags=[...ENEMY_TYPES[type].tags,"infected"];
