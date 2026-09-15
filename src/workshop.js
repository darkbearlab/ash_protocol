import {ALLY_BASE_TYPES,isNoncombatant} from './enemy-data.js';
import {addAlly,allyName,allyWeapon,currentAllies,defaultDroneCell,deployLimit,droneCells,lineLimit,reloadDrone,routeCells,MUNITION_TUNING} from './allies.js';
import {AMMUNITION} from './ammunition.js';
import {GRENADES,FRAG_DAMAGE} from './throwables.js';
import {pullLanding} from './melee-classes.js';
import {barrierBetween,vaultable} from './barriers.js';
import {distance} from './world.js';

// Engineer workshop (docs/ENGINEER.md; phase 1 in 3.91.0, loitering munitions in 3.92.0). The class skill opens the
// production lines: an empty line builds a unit, a finished unit is deployed through the usual placement, and a
// deployed unit never comes back. Blueprint ids reuse the drone sourceIds, so deployed units keep the ally rules.
export const WORKSHOP_SKILL='workshop';
export const UNIT_BLUEPRINTS={
 // mount: can carry one ranged weapon from the pack instead of the built-in gun (3.93.0).
 drone_follow:{name:'追隨無人機',cost:30,mount:true,text:'跟在你身邊，不用掩體，可以換位。'},
 drone_sentry:{name:'定點砲台',cost:30,mount:true,text:'部署後不動，可利用掩體，裝甲 5。'},
 // payload: built with one throwable, which decides what the munition detonates.
 drone_munition:{name:'浮游彈藥',cost:15,payload:true,text:'不算部署上限。接近敵人後俯衝，同一次行動引爆裝入的投擲物，不預告。'},
};
const ALLY_CAP=32;
export const hasWorkshop=p=>Array.isArray(p?.skills)&&p.skills.includes(WORKSHOP_SKILL);
export const isMunition=a=>a?.kind==='drone'&&a.sourceId==='drone_munition';
// Loitering munitions never count toward the deploy limit.
export const deployedUnits=g=>currentAllies(g).filter(a=>a.kind==='drone'&&!isMunition(a));
// A deploy point needs both coordinates: null means "use the default tile", false marks a half-given point to refuse.
export const workshopPoint=arg=>arg&&(arg.x!==undefined||arg.y!==undefined)?(Number.isInteger(arg.x)&&Number.isInteger(arg.y)?{x:arg.x,y:arg.y}:false):null;
const unavailable=g=>g.status!=='playing'||g.pendingPerks>0||Boolean(g.player.control.disabled);
const validPayload=payload=>typeof payload==='string'&&Object.hasOwn(GRENADES,payload);
// Weapons that can go on a unit: ranged, not locked, and never the last weapon in the pack.
export const mountableSlots=g=>g.player.owned.length>1?g.player.owned.filter(slot=>{const w=g.weaponAt(slot);return !w.melee&&!w.locked&&!w.unarmed;}):[];

export function buildReason(g,blueprint,payload,weapon){
 const p=g.player,def=typeof blueprint==='string'&&Object.hasOwn(UNIT_BLUEPRINTS,blueprint)?UNIT_BLUEPRINTS[blueprint]:null;
 if(!hasWorkshop(p))return '沒有工坊技能。';
 if(!def)return '沒有這張藍圖。';
 if(def.payload&&!validPayload(payload))return '請選擇要裝入的投擲物。';
 if(!def.payload&&payload!==undefined&&payload!==null)return '這張藍圖不裝投擲物。';
 if(weapon!==undefined&&weapon!==null){
  if(!def.mount)return '這張藍圖不能裝武器。';
  if(!Number.isInteger(weapon)||!p.owned.includes(weapon))return '背包裡沒有這把武器。';
  if(!mountableSlots(g).includes(weapon))return p.owned.length<=1?'至少保留一把武器。':'近戰或固定武器不能裝上機體。';
 }
 if(unavailable(g))return '目前無法生產。';
 if(p.productionLines.length>=lineLimit(p))return '生產序列已滿。';
 if(p.scrap<def.cost)return `廢料不足，需要 ${def.cost}。`;
 if(def.payload&&p[GRENADES[payload].resource]<1)return `沒有${GRENADES[payload].name}。`;
 return '';
}
// Re-checked at resolution: a faster enemy acting first can still cancel a committed build without charging anything.
// A mounted weapon leaves the pack with its magazine, which is topped up from the player's rounds of that type.
export function buildUnit(g,blueprint,payload,weapon){
 const reason=buildReason(g,blueprint,payload,weapon);if(reason)return g.fail(reason);
 const p=g.player,def=UNIT_BLUEPRINTS[blueprint],mounted=Number.isInteger(weapon);p.scrap-=def.cost;
 if(def.payload){p[GRENADES[payload].resource]--;p.productionLines.push({blueprint,payload});}
 else if(mounted){
  const w=g.weaponAt(weapon),key=AMMUNITION[w.ammoType].key,n=Math.min(w.mag-p.ammo[weapon],p[key]);
  p.owned=p.owned.filter(slot=>slot!==weapon);if(p.weapon===weapon)p.weapon=p.owned[0];
  p.ammo[weapon]+=n;p[key]-=n;p.productionLines.push({blueprint,weapon});
 }else p.productionLines.push({blueprint});
 g.log(`消耗 ${def.cost} 廢料${def.payload?`與 1 顆${GRENADES[payload].name}`:''}，${def.name}${mounted?`（${g.weaponAt(weapon).name}）`:''}已放進生產序列。`);return true;
}

// Wrecks and units left on other floors may be dropped to make room in a full ally list; nothing else is.
const wreck=a=>a.kind==='drone'&&a.status==='destroyed';
const leftBehind=g=>a=>a.kind==='drone'&&a.floor!==g.floor;
const deployCell=(g,point)=>point===false?null:point?droneCells(g).find(q=>q.x===point.x&&q.y===point.y)||null:defaultDroneCell(g);
export function deployReason(g,line,point=null){
 const p=g.player,unit=Number.isInteger(line)?p.productionLines[line]:null;
 if(!hasWorkshop(p))return '沒有工坊技能。';
 if(!unit)return '這條序列沒有完成的機體。';
 if(unavailable(g))return '目前無法部署。';
 if(!UNIT_BLUEPRINTS[unit.blueprint].payload&&deployedUnits(g).length>=deployLimit(p))return `部署上限 ${deployLimit(p)} 台已滿。`;
 if(g.allies.length>=ALLY_CAP&&!g.allies.some(a=>wreck(a)||leftBehind(g)(a)))return '友軍名額已滿，無法部署。';
 if(point===false)return '部署位置需要完整的座標。';
 if(!deployCell(g,point))return point?'部署位置需在你 2 步內、走得到的空格。':'你身邊 2 步內沒有可以部署的空格。';
 return '';
}
// The oldest wrecks go first, then the oldest units left on other floors (which the player is told about). A lost
// unit's mounted weapon goes to that floor's saved items when the floor is archived (return trips); a floor that is
// never revisited has no saved state, so the weapon is simply gone with the unit.
function makeRoom(g){
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(wreck);if(i<0)break;g.allies.splice(i,1);}
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(leftBehind(g));if(i<0)break;const [a]=g.allies.splice(i,1);dropUnitWeapon(g,a,g.floorStates?.[a.floor]?.items);g.log(`友軍名額已滿：留在第 ${a.floor} 層的${allyName(a)}已失去連線。`);}
}
// A unit that is destroyed or lost drops its mounted weapon, with the rest of its magazine, where it was.
export function dropUnitWeapon(g,a,items=g.items){
 if(!Number.isInteger(a.weapon)||!items)return;const p=g.player;
 items.push({x:a.x,y:a.y,type:'weapon',weapon:p.weaponBases[a.weapon],slot:a.weapon});p.ammo[a.weapon]=a.ammo;a.ammo=0;
 if(items===g.items)g.log(`${g.weaponAt(a.weapon).name}掉在${allyName(a)}的位置。`);delete a.weapon;
}
// Re-checked at resolution: if a faster enemy took the chosen tile, the unit stays in its line and nothing is spent.
export function deployUnit(g,line,point=null){
 const reason=deployReason(g,line,point);if(reason)return g.fail(reason);
 makeRoom(g);const cell=deployCell(g,point),unit=g.player.productionLines[line];
 const a=addAlly(g,'drone',ALLY_BASE_TYPES.drone,{sourceId:unit.blueprint,point:cell});if(!a)return g.fail('友軍名額已滿，無法部署。');
 g.player.productionLines.splice(line,1);
 if(unit.payload)a.payload=unit.payload;
 else{if(Number.isInteger(unit.weapon)){a.weapon=unit.weapon;a.ammo=Math.min(allyWeapon(a,g.player).mag,g.player.ammo[unit.weapon]);g.player.ammo[unit.weapon]=0;}reloadDrone(g,a);}
 g.log(`${allyName(a)}${unit.payload?`（${GRENADES[unit.payload].short}）`:''}已部署。`);return true;
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
 // Units are mechanical, so suppression never pins them.
 const goal=targets[0],next=routeCells(g,a,{actor:a,limit:12,openDoors:false}).filter(q=>q.first&&distance(q,goal)<distance(a,goal)).sort((b,c)=>distance(b,goal)-distance(c,goal)||b.d-c.d)[0]?.first;
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
 g.log(`浮游彈藥俯衝引爆${def.name}。`);
 g.applyThrowable(a.payload,point,FRAG_DAMAGE+g.player.blastBonus,a);
 return true;
}

const validLine=u=>{
 if(!u||typeof u!=='object'||Array.isArray(u)||typeof u.blueprint!=='string'||!Object.hasOwn(UNIT_BLUEPRINTS,u.blueprint))return false;
 const keys=Object.keys(u).sort().join();
 if(UNIT_BLUEPRINTS[u.blueprint].payload)return keys==='blueprint,payload'&&validPayload(u.payload);
 return keys==='blueprint'||keys==='blueprint,weapon'&&UNIT_BLUEPRINTS[u.blueprint].mount&&Number.isInteger(u.weapon);
};
export function validWorkshop(g){
 const p=g.player,lines=p.productionLines;
 return Array.isArray(lines)&&lines.length<=lineLimit(p)&&(!lines.length||hasWorkshop(p))&&lines.every(validLine);
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
