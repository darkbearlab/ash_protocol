import {ALLY_BASE_TYPES} from './enemy-data.js';
import {addAlly,allyName,currentAllies,defaultDroneCell,deployLimit,droneCells,lineLimit,reloadDrone} from './allies.js';

// Engineer workshop, phase 1 (docs/ENGINEER.md, Claude, 3.91.0). The class skill opens the production lines: an
// empty line builds a unit for scrap, a finished unit is deployed through the usual placement, and a deployed unit
// never comes back. Blueprint ids reuse the drone sourceIds, so combat, cover, swaps and saves of deployed units stay.
export const WORKSHOP_SKILL='workshop';
export const UNIT_BLUEPRINTS={
 drone_follow:{name:'追隨無人機',cost:30,text:'跟在你身邊，不用掩體，可以換位。'},
 drone_sentry:{name:'定點砲台',cost:30,text:'部署後不動，可利用掩體，裝甲 5。'},
};
const ALLY_CAP=32;
export const hasWorkshop=p=>Array.isArray(p?.skills)&&p.skills.includes(WORKSHOP_SKILL);
export const deployedUnits=g=>currentAllies(g).filter(a=>a.kind==='drone');
// A deploy point needs both coordinates: null means "use the default tile", false marks a half-given point to refuse.
export const workshopPoint=arg=>arg&&(arg.x!==undefined||arg.y!==undefined)?(Number.isInteger(arg.x)&&Number.isInteger(arg.y)?{x:arg.x,y:arg.y}:false):null;
const unavailable=g=>g.status!=='playing'||g.pendingPerks>0||Boolean(g.player.control.disabled);

export function buildReason(g,blueprint){
 const p=g.player,def=typeof blueprint==='string'&&Object.hasOwn(UNIT_BLUEPRINTS,blueprint)?UNIT_BLUEPRINTS[blueprint]:null;
 if(!hasWorkshop(p))return '沒有工坊技能。';
 if(!def)return '沒有這張藍圖。';
 if(unavailable(g))return '目前無法生產。';
 if(p.productionLines.length>=lineLimit(p))return '生產序列已滿。';
 if(p.scrap<def.cost)return `廢料不足，需要 ${def.cost}。`;
 return '';
}
// Re-checked at resolution: a faster enemy acting first can still cancel a committed build without charging scrap.
export function buildUnit(g,blueprint){
 const reason=buildReason(g,blueprint);if(reason)return g.fail(reason);
 const def=UNIT_BLUEPRINTS[blueprint];g.player.scrap-=def.cost;g.player.productionLines.push({blueprint});
 g.log(`消耗 ${def.cost} 廢料，${def.name}已放進生產序列。`);return true;
}

// Wrecks and units left on other floors may be dropped to make room in a full ally list; nothing else is.
const wreck=a=>a.kind==='drone'&&a.status==='destroyed';
const leftBehind=g=>a=>a.kind==='drone'&&a.floor!==g.floor;
const deployCell=(g,point)=>point===false?null:point?droneCells(g).find(q=>q.x===point.x&&q.y===point.y)||null:defaultDroneCell(g);
export function deployReason(g,line,point=null){
 const p=g.player;
 if(!hasWorkshop(p))return '沒有工坊技能。';
 if(!Number.isInteger(line)||!p.productionLines[line])return '這條序列沒有完成的機體。';
 if(unavailable(g))return '目前無法部署。';
 if(deployedUnits(g).length>=deployLimit(p))return `部署上限 ${deployLimit(p)} 台已滿。`;
 if(g.allies.length>=ALLY_CAP&&!g.allies.some(a=>wreck(a)||leftBehind(g)(a)))return '友軍名額已滿，無法部署。';
 if(point===false)return '部署位置需要完整的座標。';
 if(!deployCell(g,point))return point?'部署位置需在你 2 步內、走得到的空格。':'你身邊 2 步內沒有可以部署的空格。';
 return '';
}
// The oldest wrecks go first, then the oldest units left on other floors (which the player is told about).
function makeRoom(g){
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(wreck);if(i<0)break;g.allies.splice(i,1);}
 while(g.allies.length>=ALLY_CAP){const i=g.allies.findIndex(leftBehind(g));if(i<0)break;const [a]=g.allies.splice(i,1);g.log(`友軍名額已滿：留在第 ${a.floor} 層的${allyName(a)}已失去連線。`);}
}
// Re-checked at resolution: if a faster enemy took the chosen tile, the unit stays in its line and nothing is spent.
export function deployUnit(g,line,point=null){
 const reason=deployReason(g,line,point);if(reason)return g.fail(reason);
 makeRoom(g);const cell=deployCell(g,point),unit=g.player.productionLines[line];
 const a=addAlly(g,'drone',ALLY_BASE_TYPES.drone,{sourceId:unit.blueprint,point:cell});if(!a)return g.fail('友軍名額已滿，無法部署。');
 g.player.productionLines.splice(line,1);reloadDrone(g,a);g.log(`${allyName(a)}已部署。`);return true;
}

export function validWorkshop(g){
 const p=g.player,lines=p.productionLines;
 return Array.isArray(lines)&&lines.length<=lineLimit(p)&&(!lines.length||hasWorkshop(p))&&lines.every(u=>u&&typeof u==='object'&&!Array.isArray(u)&&Object.keys(u).length===1&&typeof u.blueprint==='string'&&Object.hasOwn(UNIT_BLUEPRINTS,u.blueprint));
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
