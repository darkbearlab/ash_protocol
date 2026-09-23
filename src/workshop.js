import {t} from './i18n.js';
import {isNoncombatant} from './enemy-data.js';
import {ENEMY_TYPES} from './data.js';
import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {addAlly,allyName,allyWeapon,currentAllies,defaultDroneCell,deployLimit,droneCells,lineLimit,oneShot,reloadDrone,routeCells,ENEMY_UNIT_TUNING,MUNITION_TUNING,ONE_SHOT_UNITS,REPAIR_TUNING,UNIT_SOURCES} from './allies.js';
import {AMMUNITION} from './ammunition.js';
import {GRENADES,FRAG_DAMAGE} from './throwables.js';
import {pullLanding} from './melee-classes.js';
import {barrierBetween,vaultable} from './barriers.js';
import {distance} from './world.js';

// Engineer workshop (docs/ENGINEER.md; phase 1 in 3.91.0, munitions 3.92.0, enemy blueprints 3.94.0). The class skill opens the
// production lines: an empty line builds a unit, a finished unit is deployed through the usual placement, and a
// deployed unit never comes back. Blueprint ids reuse the drone sourceIds, so deployed units keep the ally rules.
export const WORKSHOP_SKILL='workshop';
export const UNIT_BLUEPRINTS={
 // mount: can carry one ranged weapon from the pack instead of the built-in gun (3.93.0).
 drone_follow:{name:t('unit.drone_follow.name'),cost:30,mount:true,text:t('unit.drone_follow.text')},
 drone_sentry:{name:t('unit.drone_sentry.name'),cost:30,mount:true,text:t('unit.drone_sentry.text')},
 // payload: built with one throwable, which decides what the munition detonates.
 drone_munition:{name:t('unit.drone_munition.name'),cost:15,payload:true,text:t('unit.drone_munition.text')},
 // enemy: gained by destroying that enemy type, once per run (docs/ENGINEER.md 4.2, 3.94.0). Built-in weapons only.
 unit_drone:{name:t('unit.unit_drone.name'),cost:35,enemy:'drone',text:t('unit.unit_drone.text')},
 unit_bomber:{name:t('unit.unit_bomber.name'),cost:25,enemy:'bomber_bot',text:t('unit.unit_bomber.text')},
 // once: a boss blueprint, scrap only and built at most once per run (docs/ENGINEER.md 4.2, 3.95.0).
 unit_warden:{name:t('unit.unit_warden.name'),cost:200,enemy:'warden',once:true,text:t('unit.unit_warden.text')},
 unit_boss:{name:t('unit.unit_boss.name'),cost:300,enemy:'boss',once:true,text:t('unit.unit_boss.text')},
};
const ALLY_CAP=32;
export const hasWorkshop=p=>Array.isArray(p?.skills)&&p.skills.includes(WORKSHOP_SKILL);
export const isMunition=a=>a?.kind==='drone'&&a.sourceId==='drone_munition';
export const isBomber=a=>a?.kind==='drone'&&a.sourceId==='unit_bomber';
// Enemy type -> the blueprint its wreck gives (drone -> unit_drone, bomber_bot -> unit_bomber).
export const ENEMY_BLUEPRINTS=Object.fromEntries(Object.entries(UNIT_BLUEPRINTS).filter(([,def])=>def.enemy).map(([id,def])=>[def.enemy,id]));
// One-shot units (munitions and suicide bots) never count toward the deploy limit.
export const deployedUnits=g=>currentAllies(g).filter(a=>a.kind==='drone'&&!oneShot(a));
// A deploy point needs both coordinates: null means "use the default tile", false marks a half-given point to refuse.
export const workshopPoint=arg=>arg&&(arg.x!==undefined||arg.y!==undefined)?(Number.isInteger(arg.x)&&Number.isInteger(arg.y)?{x:arg.x,y:arg.y}:false):null;
const unavailable=g=>g.status!=='playing'||g.pendingPerks>0||Boolean(g.player.control.disabled);
const validPayload=payload=>typeof payload==='string'&&Object.hasOwn(GRENADES,payload);
// Weapons that can go on a unit: ranged, not locked, and never the last weapon in the pack.
export const mountableSlots=g=>g.player.owned.length>1?g.player.owned.filter(slot=>{const w=g.weaponAt(slot);return !w.melee&&!w.locked&&!w.unarmed;}):[];

export function buildReason(g,blueprint,payload,weapon){
 const p=g.player,def=typeof blueprint==='string'&&Object.hasOwn(UNIT_BLUEPRINTS,blueprint)?UNIT_BLUEPRINTS[blueprint]:null;
 if(!hasWorkshop(p))return t('workshop.noWorkshop');
 if(!def)return t('workshop.noBlueprint');
 if(def.enemy&&!p.blueprints.includes(blueprint))return t('workshop.blueprintMissing',{enemy:ENEMY_TYPES[def.enemy].name});
 if(def.once&&p.usedBlueprints.includes(blueprint))return t('workshop.bossOnce');
 if(def.payload&&!validPayload(payload))return t('workshop.pickPayload');
 if(!def.payload&&payload!==undefined&&payload!==null)return t('workshop.noPayloadSlot');
 if(weapon!==undefined&&weapon!==null){
  if(!def.mount)return t('workshop.noWeaponMount');
  if(!Number.isInteger(weapon)||!p.owned.includes(weapon))return t('workshop.weaponNotInPack');
  if(!mountableSlots(g).includes(weapon))return p.owned.length<=1?t('workshop.keepOneWeapon'):t('workshop.mountRanged');
 }
 if(unavailable(g))return t('workshop.cannotBuild');
 if(p.productionLines.length>=lineLimit(p))return t('workshop.linesFull');
 if(p.scrap<def.cost)return t('workshop.scrapShort',{n:def.cost});
 if(def.payload&&p[GRENADES[payload].resource]<1)return t('workshop.noPayload',{item:GRENADES[payload].name});
 return '';
}
// Re-checked at resolution: a faster enemy acting first can still cancel a committed build without charging anything.
// A mounted weapon leaves the pack with its magazine, which is topped up from the player's rounds of that type.
export function buildUnit(g,blueprint,payload,weapon){
 const reason=buildReason(g,blueprint,payload,weapon);if(reason)return g.fail(reason);
 const p=g.player,def=UNIT_BLUEPRINTS[blueprint],mounted=Number.isInteger(weapon);p.scrap-=def.cost;if(def.once)p.usedBlueprints.push(blueprint);
 if(def.payload){p[GRENADES[payload].resource]--;p.productionLines.push({blueprint,payload});}
 else if(mounted){
  const w=g.weaponAt(weapon),key=AMMUNITION[w.ammoType].key,n=Math.min(w.mag-p.ammo[weapon],p[key]);
  p.owned=p.owned.filter(slot=>slot!==weapon);if(p.weapon===weapon)p.weapon=p.owned[0];
  p.ammo[weapon]+=n;p[key]-=n;p.productionLines.push({blueprint,weapon});
 }else p.productionLines.push({blueprint});
 g.log(t('workshop.queued',{cost:def.cost,payload:def.payload?t('workshop.queuedPayload',{grenade:GRENADES[payload].name}):'',unit:def.name,weapon:mounted?t('workshop.queuedWeapon',{weapon:g.weaponAt(weapon).name}):''}));return true;
}

// Wrecks and units left on other floors may be dropped to make room in a full ally list; nothing else is.
const wreck=a=>a.kind==='drone'&&a.status==='destroyed';
const leftBehind=g=>a=>a.kind==='drone'&&a.floor!==g.floor;
const deployCell=(g,point)=>point===false?null:point?droneCells(g).find(q=>q.x===point.x&&q.y===point.y)||null:defaultDroneCell(g);
export function deployReason(g,line,point=null){
 const p=g.player,unit=Number.isInteger(line)?p.productionLines[line]:null;
 if(!hasWorkshop(p))return t('workshop.noWorkshop');
 if(!unit)return t('workshop.lineNotReady');
 if(unavailable(g))return t('workshop.cannotDeploy');
 if(!ONE_SHOT_UNITS.includes(unit.blueprint)&&deployedUnits(g).length>=deployLimit(p))return t('workshop.deployCap',{n:deployLimit(p)});
 if(g.allies.length>=ALLY_CAP&&!g.allies.some(a=>wreck(a)||leftBehind(g)(a)))return t('workshop.alliesFull');
 if(point===false)return t('workshop.deployNeedsSpot');
 if(!deployCell(g,point))return point?t('workshop.deployRange'):t('workshop.deployNoRoom');
 return '';
}
// The oldest wrecks go first, then the oldest units left on other floors (which the player is told about). A lost
// unit's mounted weapon goes to that floor's saved items when the floor is archived (return trips); a floor that is
// never revisited has no saved state, so the weapon is simply gone with the unit.
function makeRoom(g){
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(wreck);if(i<0)break;g.allies.splice(i,1);}
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(leftBehind(g));if(i<0)break;const [a]=g.allies.splice(i,1);dropUnitWeapon(g,a,g.floorStates?.[a.floor]?.items);g.log(t('workshop.allyCapLost',{floor:a.floor,ally:allyName(a)}));}
}
// A unit that is destroyed or lost drops its mounted weapon, with the rest of its magazine, where it was.
export function dropUnitWeapon(g,a,items=g.items){
 if(!Number.isInteger(a.weapon)||!items)return;const p=g.player;
 items.push({x:a.x,y:a.y,type:'weapon',weapon:p.weaponBases[a.weapon],slot:a.weapon});p.ammo[a.weapon]=a.ammo;a.ammo=0;
 if(items===g.items)g.log(t('workshop.weaponDropped',{weapon:g.weaponAt(a.weapon).name,ally:allyName(a)}));delete a.weapon;
}
// Re-checked at resolution: if a faster enemy took the chosen tile, the unit stays in its line and nothing is spent.
export function deployUnit(g,line,point=null){
 const reason=deployReason(g,line,point);if(reason)return g.fail(reason);
 makeRoom(g);const cell=deployCell(g,point),unit=g.player.productionLines[line];
 const a=addAlly(g,'drone',UNIT_SOURCES[unit.blueprint],{sourceId:unit.blueprint,point:cell});if(!a)return g.fail(t('workshop.alliesFull'));
 g.player.productionLines.splice(line,1);
 if(unit.payload)a.payload=unit.payload;
 else{if(Number.isInteger(unit.weapon)){a.weapon=unit.weapon;a.ammo=Math.min(allyWeapon(a,g.player).mag,g.player.ammo[unit.weapon]);g.player.ammo[unit.weapon]=0;}reloadDrone(g,a);}
 g.log(t('workshop.deployed',{ally:allyName(a),payload:unit.payload?t('workshop.deployedPayload',{grenade:GRENADES[unit.payload].short}):''}));return true;
}

// Field repair (docs/ENGINEER.md sections 9 and 16, 3.96.0; no dismantling, user decision): standing beside a damaged
// workshop unit, one turn and REPAIR_TUNING.cost scrap restore half its maximum HP, frame upgrades included.
export const repairTargets=g=>hasWorkshop(g.player)?currentAllies(g).filter(a=>a.kind==='drone'&&a.hp<a.maxHp&&distance(a,g.player)===1&&g.canCross(g.player,a)):[];
export function repairReason(g,id){
 const p=g.player,a=typeof id==='string'?currentAllies(g).find(x=>x.id===id&&x.kind==='drone'):null;
 if(!hasWorkshop(p))return t('workshop.noWorkshop');
 if(!a)return t('workshop.unitNotNear');
 if(distance(a,p)!==1||!g.canCross(p,a))return t('workshop.repairAdjacent');
 if(a.hp>=a.maxHp)return t('workshop.undamaged',{ally:allyName(a)});
 if(unavailable(g))return t('workshop.cannotRepair');
 if(p.scrap<REPAIR_TUNING.cost)return t('workshop.scrapShort',{n:REPAIR_TUNING.cost});
 return '';
}
// Re-checked at resolution: if a faster enemy destroyed or moved the unit first, the turn is spent but not the scrap.
export function repairUnit(g,id){
 const reason=repairReason(g,id);if(reason)return g.fail(reason);
 const a=currentAllies(g).find(x=>x.id===id),before=a.hp;g.player.scrap-=REPAIR_TUNING.cost;a.hp=Math.min(a.maxHp,a.hp+Math.ceil(a.maxHp*REPAIR_TUNING.share));
 g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.5,color:'#89e8c8',damage:0});
 g.log(t('workshop.repaired',{cost:REPAIR_TUNING.cost,ally:allyName(a),n:a.hp-before,hp:a.hp,max:a.maxHp}));return true;
}

// Loitering munition, phase 2 (docs/ENGINEER.md 4.1). On its own action: beside a seen enemy it detonates; within dive
// range it dives beside the nearest one along a clear straight path (the grapple landing) and detonates in the same
// action; farther away it flies one tile closer; with nothing in sight it hovers. No windup. The player is not protected
// from the blast: staying clear is the player's skill (user decision, 3.92.1). It does not open doors or follow the
// player between floors, and it has no tether: it hunts whatever it sees within its own sight.
export function munitionAct(g,a){
 if(a.status!=='active'||a.floor!==g.floor||a.hp<=0)return false;
 a.moved=false;a.moveDelta=[0,0];if(a.bornTurn===g.turn||a.restTurn===g.turn)return false;
 const targets=g.enemies.filter(e=>e.hp>0&&!isNoncombatant(e)&&distance(a,e)<=MUNITION_TUNING.sight&&g.sight(a,e)).sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id));
 if(!targets.length)return false;
 for(const e of targets){
  if(distance(a,e)>MUNITION_TUNING.dive||!g.shotClear(a,e))continue;
  const point=distance(a,e)===1&&g.canCross(a,e)?{x:a.x,y:a.y}:pullLanding(g,a,e);
  if(point)return detonate(g,a,point);
 }
 return stepCloser(g,a,targets[0]);
}
// One step toward goal through open ways (never opening a door), onto the route that ends closest. Units are mechanical,
// so suppression never pins them.
function stepCloser(g,a,goal){
 const next=routeCells(g,a,{actor:a,limit:12,openDoors:false}).filter(q=>q.first&&distance(q,goal)<distance(a,goal)).sort((b,c)=>distance(b,goal)-distance(c,goal)||b.d-c.d)[0]?.first;
 if(!next)return false;
 const edge=barrierBetween(g.barriers,a,next),from={x:a.x,y:a.y};
 Object.assign(a,next);a.moveDelta=[a.x-from.x,a.y-from.y];a.moved=true;a.vaultExposed=vaultable(edge);return true;
}
// The munition leaves the ally list before the blast, so it neither hurts nor disables itself. Frag uses the thrown
// grenade's damage with the player's blast bonus; the other payloads resolve exactly like a thrown grenade.
function detonate(g,a,point){
 const def=GRENADES[a.payload],from={x:a.x,y:a.y};
 g.allies=g.allies.filter(x=>x!==a);Object.assign(a,{x:point.x,y:point.y,status:'destroyed',hp:0});
 if(from.x!==point.x||from.y!==point.y)g.effects.push({type:'pulse',from,to:{...point},radius:.5,color:def.color,damage:0});
 g.log(t('workshop.munitionDive',{grenade:def.name}));
 g.applyThrowable(a.payload,point,FRAG_DAMAGE+g.player.blastBonus,a);
 return true;
}

// Modified suicide bot (docs/ENGINEER.md 4.2, 3.94.0). On its own action a primed bot explodes where it stands; beside
// a seen enemy it primes instead (one action of warning); otherwise it walks one tile toward the nearest enemy it sees
// within sight, or back toward the player when it sees none. A primed bot explodes even if the enemy has stepped away.
// It does not open doors, never swaps and stays behind on floor changes; as with the munition, the player is not protected.
export function bomberAct(g,a){
 if(a.status!=='active'||a.floor!==g.floor||a.hp<=0)return false;
 a.moved=false;a.moveDelta=[0,0];if(a.bornTurn===g.turn||a.restTurn===g.turn)return false;
 if(a.primed){g.allies=g.allies.filter(x=>x!==a);Object.assign(a,{status:'destroyed',hp:0});delete a.primed;bomberBlast(g,a);return true;}
 const tune=ENEMY_UNIT_TUNING.bomber,targets=g.enemies.filter(e=>e.hp>0&&!isNoncombatant(e)&&distance(a,e)<=tune.sight&&g.sight(a,e)).sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id));
 if(targets[0]&&distance(a,targets[0])===1){
  a.primed=true;g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.6,color:'#ffc789',damage:0});
  g.log(t('workshop.bomberWindup'));return true;
 }
 const goal=targets[0]||(distance(a,g.player)>2?g.player:null);
 return goal?stepCloser(g,a,goal):false;
}
// The blast resolves like the enemy bot's (radius 1, 10 less per tile out); fire control adds its damage bonus.
function bomberBlast(g,a){
 const tune=ENEMY_UNIT_TUNING.bomber;g.log(t('workshop.bomberBlows'));
 g.explode({x:a.x,y:a.y},tune.radius,tune.damage+classPerkRank(g.player,'engineer_firecontrol')*CLASS_PERK_TUNING.fireDamage,a);
}
// A unit destroyed by damage: its mounted weapon drops, a charge or pending bombardment is lost, and a suicide bot
// explodes where it fell (its wreck stays).
export function unitDestroyed(g,a){
 dropUnitWeapon(g,a);delete a.primed;delete a.bombard;
 if(isBomber(a))bomberBlast(g,a);
}
// Enemy blueprints (docs/ENGINEER.md 4.2, 3.94.0): destroying a drone or a suicide bot gives the workshop that blueprint,
// once per run. Any killer counts (you, your units, a blast, the environment); a suicide bot blowing itself up does not.
// 3.166.0: the controller asks this instead of testing the log's first characters.
export const isBlueprintLog=text=>Object.values(UNIT_BLUEPRINTS).some(b=>text===t('workshop.blueprint',{unit:b.name}));
export function salvageBlueprint(g,e,attacker){
 const id=Object.hasOwn(ENEMY_BLUEPRINTS,e.type)?ENEMY_BLUEPRINTS[e.type]:null,p=g.player;
 if(!id||attacker===e||!hasWorkshop(p)||p.blueprints.includes(id))return false;
 p.blueprints.push(id);g.log(t('workshop.blueprint',{unit:UNIT_BLUEPRINTS[id].name}));return true;
}

const validLine=u=>{
 if(!u||typeof u!=='object'||Array.isArray(u)||typeof u.blueprint!=='string'||!Object.hasOwn(UNIT_BLUEPRINTS,u.blueprint))return false;
 const keys=Object.keys(u).sort().join();
 if(UNIT_BLUEPRINTS[u.blueprint].payload)return keys==='blueprint,payload'&&validPayload(u.payload);
 return keys==='blueprint'||keys==='blueprint,weapon'&&UNIT_BLUEPRINTS[u.blueprint].mount&&Number.isInteger(u.weapon);
};
// Acquired enemy blueprints are unique and belong to the workshop; every line or unit built from one needs it. A boss
// blueprint that was built is listed once in usedBlueprints and has at most one unit (its wreck may already be gone).
export function validWorkshop(g){
 const p=g.player,lines=p.productionLines,known=p.blueprints,used=p.usedBlueprints;
 if(!Array.isArray(known)||new Set(known).size!==known.length||!known.every(id=>typeof id==='string'&&Object.hasOwn(UNIT_BLUEPRINTS,id)&&Boolean(UNIT_BLUEPRINTS[id].enemy))||known.length&&!hasWorkshop(p))return false;
 if(!Array.isArray(used)||new Set(used).size!==used.length||!used.every(id=>known.includes(id)&&UNIT_BLUEPRINTS[id].once))return false;
 const usable=id=>!UNIT_BLUEPRINTS[id].enemy||known.includes(id);
 if(!(Array.isArray(lines)&&lines.length<=lineLimit(p)&&(!lines.length||hasWorkshop(p))&&lines.every(u=>validLine(u)&&usable(u.blueprint))&&g.allies.every(a=>a.kind!=='drone'||usable(a.sourceId))))return false;
 const built=[...lines.map(u=>u.blueprint),...g.allies.filter(a=>a.kind==='drone').map(a=>a.sourceId)].filter(id=>UNIT_BLUEPRINTS[id].once);
 return new Set(built).size===built.length&&built.every(id=>used.includes(id));
}
// v46: the old single chassis becomes workshop state. The two drone skills become the workshop skill; a packed unit
// moves into the first production line, a wreck is dropped and an active unit stays deployed. Rounds left in a
// magazine are handed back in the ammunition they were loaded with (pistol for follow drones before v27, rifle
// after), because units now fire pistol rounds. Returns {pistol, rifle, lined} for the upgrade note, or null when
// the save had nothing to convert.
export function migrateWorkshop(data,version){
 const p=data.player,old=['drone_follow','drone_sentry'],refund={pistol:0,rifle:0};let changed=false,lined=false;
 if(p&&typeof p==='object'){
  p.productionLines=[];
  if(Array.isArray(p.skills)&&p.skills.some(id=>old.includes(id))){
   changed=true;p.skills=[...new Set(p.skills.map(id=>old.includes(id)?WORKSHOP_SKILL:id))];
   if(p.skillState&&typeof p.skillState==='object'){for(const id of old)delete p.skillState[id];p.skillState[WORKSHOP_SKILL]={remaining:0,cooldown:0};}
   if(p.prepared&&old.includes(p.prepared.skill))p.prepared.skill=WORKSHOP_SKILL;
  }
 }
 if(Array.isArray(data.allies))data.allies=data.allies.filter(a=>{
  if(a?.kind!=='drone')return true;
  changed=true;
  if(Number.isSafeInteger(a.ammo)&&a.ammo>0){refund[version<27&&a.sourceId==='drone_follow'?'pistol':'rifle']+=a.ammo;a.ammo=0;}
  if(a.status==='packed'){if(p&&!p.productionLines.length&&old.includes(a.sourceId)){p.productionLines.push({blueprint:a.sourceId});lined=true;}return false;}
  return a.status!=='destroyed';
 });
 return changed?{...refund,lined}:null;
}
