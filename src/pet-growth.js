import {AMMO_IDS,AMMUNITION,TERMINAL_AMMO} from './ammunition.js';
import {GRENADES} from './throwables.js';
import {distance,DIRECTIONS,key} from './world.js';
import {healActor} from './traits.js';
import {classPerkRank} from './class-perks.js';
import {salvageValue,canSalvageOwned} from './weapons.js';

// Fuel is integer ticks: 72 ticks = one scrap's terminal buying power.
export const PET_FEEDING_TUNING={fuelScale:72,capacity:30,capacityPerRank:10,discountPerRank:10,
 thresholds:{vitality:[20,50,90],armor:[10,25,50],turret:[20,60,120],extrusion:[1,3,6]},
 baseHp:90,extraHp:60,regen:3,combatWindow:2,baseArmor:1,extraArmor:3,reduction:.2,
 shotCost:2,outputCost:12,outputIntervals:[12,8,8],reviveTurns:8,reviveFraction:.25,medkitFraction:.5,
 lifePortion:5,lifeFloor:25,lifeFloorFraction:.4,platePortion:5,hungerPerRank:.25,
 ammoPortions:{pistol:18,rifle:12,shell:4,energy:6,ordnance:1},
 turret:[{range:5,min:14,max:18},{range:7,min:20,max:24},{range:7,min:20,max:24}],accuracy:-22};
const T=PET_FEEDING_TUNING;
export const petActor=g=>g.allies.find(a=>a.kind==='pet');
export const petRank=(p,line)=>T.thresholds[line].filter(n=>(p?.petBond?.growth?.[line]||0)>=n).length;
export const petCapacity=p=>(T.capacity+classPerkRank(p,'druid_beast')*T.capacityPerRank)*T.fuelScale;
export const petFuelCost=(p,kind)=>Math.ceil(T[kind==='shot'?'shotCost':'outputCost']*T.fuelScale*(100-classPerkRank(p,'druid_beast')*T.discountPerRank)/100);
export const petMaximum=p=>T.baseHp+(petRank(p,'vitality')>=1?T.extraHp:0);
export const petOutputInterval=p=>T.outputIntervals[Math.max(0,petRank(p,'extrusion')-1)];
export const ammoFuel=id=>TERMINAL_AMMO[id].cost*T.fuelScale/TERMINAL_AMMO[id].amount;
export function newPetBond(actorId){return {actorId,growth:{vitality:0,armor:0,turret:0,extrusion:0},fuel:0,
 fedThrowables:Object.fromEntries(Object.keys(GRENADES).map(id=>[id,0])),outputChoice:null,outputRemaining:T.outputIntervals[0],
 reviveRemaining:0,diedTurn:null,lastCombatTurn:null,tenacityUsedFloors:[]};}
export function fitPet(g,a){
 a.maxHp=petMaximum(g.player);a.hp=Math.min(a.hp,a.maxHp);a.armor=T.baseArmor+(petRank(g.player,'armor')>=1?T.extraArmor:0);
 a.traits=a.traits.filter(t=>!(t.source==='ally:pet'&&t.id==='no_cover'));
 if(petRank(g.player,'armor')<2)a.traits.push({id:'no_cover',source:'ally:pet'});
}
export function petWeapon(p,melee=false){
 const rank=petRank(p,'turret');
 if(!melee&&rank&&p.petBond.fuel>=petFuelCost(p,'shot'))return {id:'pet_turret',...T.turret[rank-1],melee:false,accuracyBonus:T.accuracy,ammoType:null,mag:0,shots:rank===3?2:1};
 const gain=1+(p?.petBond?.fuel===0?classPerkRank(p,'druid_claws')*T.hungerPerRank:0);
 return {id:'melee',range:1,min:Math.round(24*gain),max:Math.round(28*gain),melee:true,hitChance:90,accuracyBonus:T.accuracy,ammoType:null,mag:0};
}
export function petCombat(g,a){if(a?.kind==='pet'&&g.player.petBond)g.player.petBond.lastCombatTurn=g.turn;}
export function petDeath(g,a){
 const b=g.player.petBond;b.fuel=0;b.reviveRemaining=T.reviveTurns;b.diedTurn=g.turn;b.lastCombatTurn=null;b.outputRemaining=petOutputInterval(g.player);
 Object.assign(a,{hp:0,status:'reforming',order:null,cornerExposure:null,tactics:null,fireChain:null,control:{disabled:0,immune:0}});
 g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.4,color:'#9dcc82'});g.log('伴生獵獸消散，羈絆開始重生倒數。',true);
}
export function petSurvives(g,a){
 const b=g.player.petBond;if(a.kind!=='pet'||!b||petRank(g.player,'vitality')<3||b.tenacityUsedFloors.includes(g.floor))return false;
 b.tenacityUsedFloors.push(g.floor);a.hp=1;g.log('羈絆保住獵獸最後一息。',true);return true;
}
export function placePet(g,a,revive=false){
 const point=DIRECTIONS.map(([dx,dy])=>({x:g.player.x+dx,y:g.player.y+dy})).find(q=>g.passable(q.x,q.y)&&g.canCross(g.player,q)&&![...g.enemies,...g.allies.filter(e=>e.floor===g.floor&&e.status==='active')].some(e=>e!==a&&e.hp>0&&key(e)===key(q)));
 a.floor=g.floor;if(!point)return false;
 Object.assign(a,{...point,status:'active',order:null,bornTurn:g.turn,moved:false,moveDelta:[0,0],vaultExposed:false,restTurn:undefined,cornerExposure:null,tactics:null,fireChain:null});
 if(revive){a.hp=Math.max(1,Math.min(a.maxHp-1,Math.floor(a.maxHp*T.reviveFraction)));g.player.petBond.diedTurn=null;}
 return true;
}
export function transportPet(g,a){
 a.floor=g.floor;a.x=g.player.x;a.y=g.player.y;a.order=null;a.cornerExposure=null;a.tactics=null;
 if(a.status!=='reforming'){a.status='arriving';placePet(g,a);}
}
export function petOutputKind(p){const b=p.petBond;if(petRank(p,'extrusion')===3&&b.outputChoice)return b.outputChoice;
 return Object.keys(GRENADES).sort((a,c)=>b.fedThrowables[c]-b.fedThrowables[a])[0];}
export function tickPetBond(g){
 const a=petActor(g),p=g.player,b=p.petBond;if(!a||!b)return false;
 if(a.status==='reforming'){
  if(b.diedTurn===g.turn)return false;
  if(b.reviveRemaining>0)b.reviveRemaining--;
  if(b.reviveRemaining===0&&placePet(g,a,true)){g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.5,color:'#9dcc82'});g.log('伴生獵獸在你身邊重新凝聚。');return true;}return false;
 }
 if(a.status==='arriving')return placePet(g,a);
 if(a.status!=='active'||a.bornTurn===g.turn)return false;
 if(petRank(p,'vitality')>=2&&b.lastCombatTurn!==null&&g.turn-b.lastCombatTurn<=T.combatWindow){const healed=healActor(a,T.regen);if(healed)g.effects.push({type:'pulse',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},radius:.3,color:'#9dcc82'});}
 if(petRank(p,'extrusion')>0){
  if(b.outputRemaining>0)b.outputRemaining--;
  const cost=petFuelCost(p,'output');
  if(b.outputRemaining===0&&b.fuel>=cost){const id=petOutputKind(p),type=GRENADES[id].item;b.fuel-=cost;b.outputRemaining=petOutputInterval(p);
   const item=g.items.find(o=>o.type===type&&o.x===a.x&&o.y===a.y&&Number.isInteger(o.amount));
   if(item&&item.amount<10000000)item.amount++;else g.items.push({x:a.x,y:a.y,type,amount:1});
   g.effects.push({type:'unpack',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y}});g.log(`獵獸排出${GRENADES[id].name}，留在腳下。`);
  }
 }return false;
}
const feedGate=g=>g.status!=='playing'||g.pendingPerks?'目前不能餵食':!g.player.skills.includes('pet_command')?'沒有伴生羈絆':!petActor(g)||!g.player.petBond?'沒有伴生獵獸':petActor(g).status!=='active'?'獵獸尚未歸隊':g.player.control.disabled?'失能中不能餵食':petActor(g).floor!==g.floor||distance(g.player,petActor(g))!==1||!g.canCross(g.player,petActor(g))?'需要相鄰且沒有阻隔':'';
export function petFeedQuote(g,arg){
 const p=g.player,a=petActor(g),b=p.petBond,id=arg?.optionId,quote={id,resource:null,amount:0,cost:0,gain:0,overflow:0,allowed:false,reason:feedGate(g)};
 if(!b||!a)return quote;
 const deny=reason=>{quote.reason ||=reason;return quote;};
 if(typeof id!=='string')return deny('未知飼料');
 let line=null,available=0,gain=0;
 if(id.startsWith('ammo:')){
  const kind=id.slice(5);if(!AMMO_IDS.includes(kind))return deny('未知彈種');
  const value=ammoFuel(kind),amount=Math.min(T.ammoPortions[kind],p[AMMUNITION[kind].key],Math.floor((petCapacity(p)-b.fuel)/value));
  Object.assign(quote,{resource:AMMUNITION[kind].key,amount,cost:amount,gain:amount*value});
  if(amount<=0)return deny(b.fuel+value>petCapacity(p)?'胃容量不足':'備彈不足');
 }else if(id==='medkit'){
  Object.assign(quote,{resource:'meds',amount:1,cost:1,gain:Math.ceil(a.maxHp*T.medkitFraction)});
  if(!p.meds||a.hp>=a.maxHp)return deny(!p.meds?'醫療包不足':'獵獸生命已滿');
 }else{
  if(id==='life'){line='vitality';available=p.hp;gain=T.lifePortion;quote.resource='hp';if(p.hp-gain<Math.max(T.lifeFloor,Math.ceil(p.maxHp*T.lifeFloorFraction)))return deny('餵食後生命會低於安全下限');}
  else if(id==='plates'){line='armor';available=p.plates;gain=Math.min(T.platePortion,available);quote.resource='plates';}
  else if(id==='weapon'){line='turret';if(!canSalvageOwned(g,arg.weaponSlot))return deny('這把武器不能拆解或餵食');available=1;gain=salvageValue(p,arg.weaponSlot);quote.resource='weapon';quote.weaponSlot=arg.weaponSlot;}
  else if(id.startsWith('grenade:')){const kind=id.slice(8);if(!Object.hasOwn(GRENADES,kind))return deny('未知投擲物');line='extrusion';available=p[GRENADES[kind].resource];gain=1;quote.resource=GRENADES[kind].resource;quote.grenade=kind;}
  else return deny('未知飼料');
  if(petRank(p,line)===3)return deny('成長已達三階');if(!available||gain<=0)return deny('飼料不足');
  const room=T.thresholds[line][2]-b.growth[line];Object.assign(quote,{line,amount:id==='weapon'||line==='extrusion'?1:gain,cost:id==='weapon'?1:gain,gain:Math.min(room,gain),overflow:Math.max(0,gain-room)});
 }
 quote.allowed=!quote.reason;return quote;
}
export function feedPet(g,arg){
 const q=petFeedQuote(g,arg);if(!q.allowed)return g.fail(q.reason);
 const p=g.player,a=petActor(g),b=p.petBond;
 if(q.resource==='weapon'){
  const slot=q.weaponSlot;g.receiveAmmo(g.weaponAt(slot).ammoType,p.ammo[slot]);p.ammo[slot]=0;p.upgrades[slot]=0;p.owned=p.owned.filter(i=>i!==slot);if(p.weapon===slot)p.weapon=p.owned[0];
 }else p[q.resource]-=q.amount;
 if(q.line){const prior=petRank(p,'extrusion');b.growth[q.line]+=q.gain;if(q.grenade)b.fedThrowables[q.grenade]++;
  if(petRank(p,'extrusion')>prior)b.outputRemaining=Math.min(b.outputRemaining,petOutputInterval(p));fitPet(g,a);
 }else if(q.resource==='meds')healActor(a,q.gain);else b.fuel+=q.gain;
 g.effects.push({type:'unpack',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y}});g.log('餵食完成。');return true;
}
export function outputChoiceReason(g,arg){return !g.player.petBond||petRank(g.player,'extrusion')<3?'排出尚未達三階':!Object.hasOwn(GRENADES,arg?.kind)?'未知投擲物':g.player.petBond.outputChoice===arg.kind?'已選擇此種類':'';}
export function petFeedingState(g){
 const p=g.player,b=p.petBond,a=petActor(g);if(!b||!a)return null;
 const inputs=[...AMMO_IDS.map(id=>({optionId:'ammo:'+id})),{optionId:'life'},{optionId:'plates'},...p.owned.map(weaponSlot=>({optionId:'weapon',weaponSlot})),...Object.keys(GRENADES).map(id=>({optionId:'grenade:'+id})),{optionId:'medkit'}];
 return {actorId:a.id,status:a.status,hp:a.hp,maxHp:a.maxHp,fuel:{stored:b.fuel,capacity:petCapacity(p),scale:T.fuelScale,displayValue:b.fuel/T.fuelScale},
  growth:Object.fromEntries(Object.keys(T.thresholds).map(line=>{const rank=petRank(p,line);return [line,{progress:b.growth[line],rank,nextThreshold:T.thresholds[line][rank]??null,capped:rank===3}];})),
  reviveRemaining:b.reviveRemaining,output:{kind:petOutputKind(p),remaining:b.outputRemaining,ready:petRank(p,'extrusion')>0&&b.outputRemaining===0,fuelCost:petFuelCost(p,'output'),selectableKinds:petRank(p,'extrusion')===3?Object.keys(GRENADES):[]},
  options:inputs.map(input=>({...petFeedQuote(g,input),action:input}))};
}
export function migratePetBond(g){
 const pets=g.allies.filter(a=>a.kind==='pet');if(pets.length>1)return false;
 const a=pets[0];g.player.petBond=a?newPetBond(a.id):null;if(!a)return true;
 if(!['active','packed','down','destroyed'].includes(a.status)||!Number.isInteger(a.hp)||a.hp<0||a.hp>a.maxHp||['down','destroyed'].includes(a.status)&&a.hp!==0)return false;
 fitPet(g,a);
 if(a.hp===0){a.status='reforming';g.player.petBond.reviveRemaining=T.reviveTurns;g.player.petBond.diedTurn=g.turn;transportPet(g,a);}
 else if(a.status==='packed'||a.floor!==g.floor)transportPet(g,a);
 return true;
}
export function validPetBond(g){
 const b=g.player.petBond,a=petActor(g),int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 if(!a)return b===null;
 if(!b||b.actorId!==a.id||a.floor!==g.floor||!['active','reforming','arriving'].includes(a.status)||a.status==='reforming'&&a.hp!==0||a.status!=='reforming'&&a.hp<=0)return false;
 if(!b.growth||Object.keys(b.growth).length!==4||!Object.keys(T.thresholds).every(k=>int(b.growth[k],T.thresholds[k][2]))||!int(b.fuel,petCapacity(g.player)))return false;
 if(!b.fedThrowables||Object.keys(b.fedThrowables).length!==Object.keys(GRENADES).length||!Object.keys(GRENADES).every(k=>int(b.fedThrowables[k],T.thresholds.extrusion[2]))||Object.values(b.fedThrowables).reduce((a,b)=>a+b,0)!==b.growth.extrusion)return false;
 if(b.outputChoice!==null&&(!Object.hasOwn(GRENADES,b.outputChoice)||petRank(g.player,'extrusion')<3)||!int(b.outputRemaining,T.outputIntervals[0])||!int(b.reviveRemaining,T.reviveTurns))return false;
 if(![b.diedTurn,b.lastCombatTurn].every(v=>v===null||Number.isInteger(v)&&v>=1&&v<=g.turn)||a.status!=='reforming'&&(b.reviveRemaining||b.diedTurn!==null)||a.status==='reforming'&&(b.fuel!==0||b.diedTurn===null))return false;
 if(!Array.isArray(b.tenacityUsedFloors)||b.tenacityUsedFloors.length>999||new Set(b.tenacityUsedFloors).size!==b.tenacityUsedFloors.length||!b.tenacityUsedFloors.every(f=>Number.isInteger(f)&&f>=1&&f<=999)||petRank(g.player,'vitality')<3&&b.tenacityUsedFloors.length)return false;
 if(a.traits.some(t=>t.source==='ally:pet'&&t.id==='no_cover')!==(petRank(g.player,'armor')<2))return false;
 return a.maxHp===petMaximum(g.player)&&a.armor===T.baseArmor+(petRank(g.player,'armor')>=1?T.extraArmor:0);
}
