import {t} from './i18n.js';
import {activeTrait} from './traits.js';
import {EXO_TUNING} from './field-gear.js';
import {AMMO_IDS,AMMUNITION,TERMINAL_AMMO} from './ammunition.js';
import {GRENADES,grenadeByItem,grenadeTotal} from './throwables.js';
import {salvageValue} from './weapons.js';
import {LEARNING_ITEMS,LEARNING_SCRAP} from './learning-data.js';
import {healActor} from './traits.js';
import {clearPoison} from './poison.js';
import {PREPARED_CATALOG} from './prepared.js';

// Supply terminal economy (3.120.0; user decisions of 2026-09-17, docs/ITEMS.md "終端經濟改版").
// - Priced in scrap. A purchase is paid with scrap and/or things the player chooses to trade in; scrap covers what the
//   trade-ins do not, and trade-in value beyond the price is lost (never change, never scrap).
// - A terminal is no longer single use: it has a credit, spent by the price of what it hands out however that was paid.
// - One transaction is one item and one turn.
// - Trade-in values: what can be dismantled is worth its dismantle value (weapons, learning data); a medkit is worth 10,
//   low on purpose because medkits pile up; armour plates cannot be traded; everything else is worth 60% of its price.
// - Weapon modifications are bought here, for any weapon in the pack, and nowhere else.
export const TERMINAL_TUNING=Object.freeze({credit:60,tradeRate:.6,healPrice:15,healAmount:60,packPrice:15,medPrice:20,medTradeIn:10,upgradeBase:25,upgradeStep:15,upgradeMax:3});
const T=TERMINAL_TUNING;
// One table for the item stock (3.108.0). 3.106.0 taught the lesson: the rules accepted 'spray' and 'adrenaline' while
// the terminal screen had no buttons for them, so neither could be bought.
export const TERMINAL_ITEMS={
 spray:{cost:15,resource:'sprays'},
 adrenaline:{cost:20,resource:'adrenaline'},
 // 3.135.0 (user decision, docs/ITEMS.md): night-vision goggles are no longer sold — snipers drop them and they turn up
 // in unidentified crates. The price stays only as the base of their trade-in value.
 nvg:{cost:40,wear:'nvg',sold:false},
 irg:{cost:40,wear:'irg',sold:false},   // 3.148.0: found on squad leaders, never sold; traded in like the goggles
 barricade:{cost:25,resource:'barricades'},
 flare:{cost:15,resource:'flares'},
 glowstick:{cost:5,resource:'glowsticks'},   // 3.178.0 (user): cheap, and a floor's worth is never enough to light everything
 // 3.144.0 (src/field-gear.js): the decoy and mine; the exoskeleton, which like armour plates cannot be traded back in
 // (it cannot be repaired either, so a worn-down one would otherwise sell for new).
 decoy:{cost:15,resource:'decoys'},
 mine:{cost:15,resource:'mines'},
 exo:{cost:45,wear:'exo',noTrade:true},
};
export const TERMINAL_PACK=Object.freeze({rifle:24,pistol:24,shell:12,energy:18,ordnance:3});
export const upgradeCost=level=>T.upgradeBase+level*T.upgradeStep;
const upgradeSlot=option=>typeof option==='string'&&/^upgrade:\d+$/.test(option)?Number(option.slice(8)):null;

// The price of an offer. Weapon modifications depend on the weapon's level, so they need the game.
export function terminalCost(option,g=null){
 const slot=upgradeSlot(option);
 if(slot!==null)return upgradeCost(g?.player?.upgrades?.[slot]||0);
 if(option==='heal')return T.healPrice;
 if(option==='ammo')return T.packPrice;
 if(option==='med')return T.medPrice;
 if(option==='grenade')return GRENADES.frag.cost;
 return TERMINAL_ITEMS[option]?.cost??TERMINAL_AMMO[option]?.cost??GRENADES[option]?.cost??null;
}
export const TERMINAL_MIN_PRICE=Math.min(T.healPrice,T.packPrice,T.medPrice,T.upgradeBase,...Object.values(TERMINAL_ITEMS).map(o=>o.cost),...Object.values(TERMINAL_AMMO).map(o=>o.cost),...Object.values(GRENADES).map(o=>o.cost));
// What a terminal can still hand out. Saves from before 3.120.0 only know `used`: a used terminal has nothing left.
export const terminalRemaining=terminal=>!terminal||terminal.used?0:Math.max(0,T.credit-(terminal.spent||0));
export const validTerminalSpent=spent=>spent===undefined||(Number.isSafeInteger(spent)&&spent>=0&&spent<=T.credit);

const OPTIONS=['heal','med','ammo',...AMMO_IDS,'grenade','smoke','emp','stun',...Object.entries(TERMINAL_ITEMS).filter(([,o])=>o.sold!==false).map(([id])=>id)];
// 3.135.0 (user decision, docs/ITEMS.md): three kinds of terminal, each in the supply room of its theme — arms and
// ammunition in the ammo room (where the armory weapon lies), medical in the medical room, gear in the armour room.
// Every floor has two of the three, so a floor may lack the one you want. A terminal from an older save has no kind
// and still sells everything.
export {TERMINAL_KINDS,KIND_ROOMS,floorTerminalKinds} from './terminal-kinds.js';
import {TERMINAL_KINDS} from './terminal-kinds.js';
export function offerKind(option){
 if(upgradeSlot(option)!==null||option==='ammo'||AMMO_IDS.includes(option))return 'arms';
 if(option==='heal'||option==='med'||option==='spray')return 'medical';
 return 'gear';
}
export const terminalSells=(terminal,option)=>!terminal?.kind||offerKind(option)===terminal.kind;
export const terminalName=terminal=>TERMINAL_KINDS[terminal?.kind]||t('terminal.name');
// Whether an offer can be bought here at all, before looking at how it is paid.
export function offerReason(g,option){
 const p=g.player,terminal=g.nearbyTerminal;
 if(!terminal)return t('terminal.noneNear');
 const slot=upgradeSlot(option);
 if(slot===null&&!OPTIONS.includes(option))return t('terminal.noSuchOffer');
 if(!terminalSells(terminal,option))return t('terminal.notSold',{terminal:terminalName(terminal)});
 if(slot!==null){
  if(!p.owned.includes(slot))return t('terminal.weaponNotInPack');
  if((p.upgrades[slot]||0)>=T.upgradeMax)return t('terminal.maxUpgrade');
 }
 const price=terminalCost(option,g),left=terminalRemaining(terminal);
 if(price>left)return t('terminal.creditShort',{left,price});
 if(slot!==null)return '';
 const item=TERMINAL_ITEMS[option];
 if(option==='heal'&&p.hp===p.maxHp&&!p.poison)return t('terminal.healthFull');
 if(item?.wear&&p.wearables.includes(item.wear))return t('terminal.haveOne');
 if(item?.wear==='exo'&&activeTrait(p,'large'))return t('terminal.tooLargeExo');
 const kind=grenadeByItem(option)?'grenade':TERMINAL_AMMO[option]?option:null;
 if(kind&&(kind==='grenade'?grenadeTotal(p):p[AMMUNITION[kind].key])>=g.ammoCapacity(kind))return t('terminal.ammoCapped');
 if(option==='ammo'&&AMMO_IDS.every(id=>p[AMMUNITION[id].key]>=g.ammoCapacity(id)))return t('terminal.allAmmoFull');
 return '';
}

// Ammunition is traded in lots worth a whole number of scrap at exactly 60% of its price (rifle 4 rounds = 1).
const gcd=(a,b)=>b?gcd(b,a%b):a;
export function ammoLot(id){
 const {cost,amount}=TERMINAL_AMMO[id],numerator=cost*3,denominator=amount*5,d=gcd(numerator,denominator);
 return {lot:denominator/d,value:numerator/d};
}
export const tradeValue=cost=>Math.round(cost*T.tradeRate);

// Everything the player could put into the value pool, with what one unit is worth and how many units they have.
// `max` 0 with a `reason` is shown but cannot be chosen.
export function tradeHoldings(g){
 const p=g.player,rows=[];
 for(const id of AMMO_IDS){
  const {lot,value}=ammoLot(id),held=p[AMMUNITION[id].key]||0;
  rows.push({id:`ammo:${id}`,group:'ammo',name:AMMUNITION[id].name,unit:t('terminal.rounds',{n:lot}),lot,value,held,max:Math.floor(held/lot),reason:held&&held<lot?t('terminal.roundsShort',{n:lot}):''});
 }
 for(const [id,entry] of Object.entries(GRENADES)){
  const held=p[entry.resource]||0;
  rows.push({id:`throw:${id}`,group:'throw',name:entry.name,unit:t('terminal.unitItem'),lot:1,value:tradeValue(entry.cost/entry.amount),held,max:held,reason:''});
 }
 rows.push({id:'med',group:'item',name:t('game.medkitName'),unit:t('terminal.unitItem'),lot:1,value:T.medTradeIn,held:p.meds||0,max:p.meds||0,reason:''});
 for(const [id,offer] of Object.entries(TERMINAL_ITEMS)){
  if(offer.resource){const held=p[offer.resource]||0;rows.push({id:`item:${id}`,group:'item',name:itemName(id),unit:t('terminal.unitItem'),lot:1,value:tradeValue(offer.cost),held,max:held,reason:''});}
  else if(offer.wear&&!offer.noTrade){
   const held=p.wearables.includes(offer.wear)?1:0,worn=p.prepared?.item===offer.wear;
   rows.push({id:`wear:${id}`,group:'wear',name:itemName(id),unit:t('terminal.unitWear'),lot:1,value:tradeValue(offer.cost),held,max:held&&!worn?1:0,reason:worn?t('terminal.takeOffFirst'):''});
  }
 }
 for(const slot of p.owned){
  const w=g.weaponAt(slot),level=p.upgrades[slot]||0;
  const reason=w.locked?t('terminal.bound'):p.owned.length<=1?t('terminal.keepOne'):'';
  rows.push({id:`weapon:${slot}`,group:'weapon',name:`${w.name}${level?` +${level}`:''}`,unit:t('terminal.unitWeapon'),lot:1,value:salvageValue(p,slot),held:1,max:reason?0:1,reason,slot});
 }
 for(const [id,count] of Object.entries(p.learningItems||{}))if(LEARNING_ITEMS[id])rows.push({id:`learning:${id}`,group:'learning',name:LEARNING_ITEMS[id].name,unit:t('terminal.unitData'),lot:1,value:LEARNING_SCRAP,held:count,max:count,reason:''});
 return rows;
}
const itemName=id=>PREPARED_CATALOG.item[id]?.name||id;

// The whole deal for one purchase: price, value of the chosen trade-ins, scrap still needed, value lost to overpaying.
export function terminalDeal(g,buy,trade={}){
 const price=terminalCost(buy,g),reason=offerReason(g,buy),empty={price,pool:0,scrap:price??0,waste:0};
 if(reason)return {...empty,reason};
 if(!trade||typeof trade!=='object'||Array.isArray(trade))return {...empty,reason:t('terminal.tradeInvalid')};
 const rows=new Map(tradeHoldings(g).map(row=>[row.id,row]));
 let pool=0,weapons=0;
 for(const [id,count] of Object.entries(trade)){
  const row=rows.get(id);
  if(!row||!Number.isSafeInteger(count)||count<0)return {...empty,reason:t('terminal.tradeInvalid')};
  if(!count)continue;
  if(count>row.max)return {...empty,reason:row.reason?t('terminal.rowReason',{item:row.name,reason:row.reason}):t('terminal.rowShort',{item:row.name})};
  if(row.group==='weapon'){weapons++;if(buy===`upgrade:${row.slot}`)return {...empty,reason:t('terminal.tradeUpgrading')};}
  pool+=count*row.value;
 }
 if(weapons&&g.player.owned.length-weapons<1)return {...empty,reason:t('terminal.keepOneWeapon')};
 const scrap=Math.max(0,price-pool),waste=Math.max(0,pool-price);
 if(g.player.scrap<scrap)return {price,pool,scrap,waste,reason:pool?`${t('terminal.scrapShort',{v:scrap-g.player.scrap})}`:`${t('terminal.needScrap',{price})}`};
 return {price,pool,scrap,waste,reason:''};
}
// Accepts the pre-3.120.0 form too: a bare option id is a purchase paid in scrap alone.
export const terminalRequest=arg=>typeof arg==='string'?{buy:arg,trade:{}}:{buy:arg?.buy,trade:arg?.trade??{}};
export const terminalReason=(g,arg)=>{const {buy,trade}=terminalRequest(arg);return terminalDeal(g,buy,trade).reason;};

function payWith(g,id,count){
 const p=g.player,[kind,key]=id.includes(':')?id.split(':'):[id,null];
 if(kind==='ammo')p[AMMUNITION[key].key]-=count*ammoLot(key).lot;
 else if(kind==='throw')p[GRENADES[key].resource]-=count;
 else if(kind==='med')p.meds-=count;
 else if(kind==='item')p[TERMINAL_ITEMS[key].resource]-=count;
 else if(kind==='wear')p.wearables=p.wearables.filter(w=>w!==TERMINAL_ITEMS[key].wear);
 else if(kind==='learning'){p.learningItems[key]-=count;if(p.learningItems[key]<=0)delete p.learningItems[key];}
 else if(kind==='weapon'){
  // The same as dismantling: the magazine's rounds go back to the reserve and the modifications are gone.
  const slot=Number(key),w=g.weaponAt(slot);
  if(!w.melee)g.receiveAmmo(w.ammoType,p.ammo[slot]);p.ammo[slot]=0;p.owned=p.owned.filter(i=>i!==slot);p.upgrades[slot]=0;p.stats.salvaged++;
  if(p.weapon===slot)p.weapon=p.owned[0];
 }
}
function deliver(g,buy){
 const p=g.player,slot=upgradeSlot(buy),item=TERMINAL_ITEMS[buy];
 if(slot!==null){p.upgrades[slot]=(p.upgrades[slot]||0)+1;return t('terminal.upgraded',{weapon:g.weaponAt(slot).name,n:p.upgrades[slot]});}
 if(buy==='heal'){healActor(p,T.healAmount);clearPoison(p);return t('terminal.healed');}
 // 3.136.0: items stop at the carry cap; one bought past it waits at your feet.
 if(buy==='med'){g.receiveItem('medkit',1);return t('terminal.medkitBought');}
 if(item?.resource){g.receiveItem(buy,1);return `${itemName(buy)} +1`;}
 if(item?.wear){p.wearables.push(item.wear);if(item.wear==='exo')p.exoPlates=EXO_TUNING.plates;return itemName(buy);}
 if(buy==='ammo'){g.supplyPack(TERMINAL_PACK);return t('terminal.ammoPack');}
 if(TERMINAL_AMMO[buy]){g.receiveAmmo(buy,TERMINAL_AMMO[buy].amount);return `${AMMUNITION[buy].name} +${TERMINAL_AMMO[buy].amount}`;}
 const grenade=grenadeByItem(buy);g.receiveGrenade(grenade,GRENADES[grenade].amount);return `${GRENADES[grenade].name} +${GRENADES[grenade].amount}`;
}
export function useTerminal(g,arg){
 const {buy,trade}=terminalRequest(arg),terminal=g.nearbyTerminal,deal=terminalDeal(g,buy,trade);
 if(deal.reason)return g.fail(deal.reason);
 const p=g.player;
 // Weapons last, so a traded weapon's magazine lands after any ammunition that was traded away.
 const entries=Object.entries(trade).filter(([,count])=>count>0).sort(([a],[b])=>Number(a.startsWith('weapon:'))-Number(b.startsWith('weapon:')));
 for(const [id,count] of entries)payWith(g,id,count);
 p.scrap-=deal.scrap;
 terminal.spent=(terminal.spent||0)+deal.price;
 const left=terminalRemaining(terminal);if(left<TERMINAL_MIN_PRICE)terminal.used=true;
 const got=deliver(g,buy);
 const paid=[deal.pool?`${t('terminal.tradeIn',{pool:deal.pool,v:deal.waste?`${t('terminal.wasted',{waste:deal.waste})}`:''})}`:'',deal.scrap?`${t('terminal.paidScrap',{scrap:deal.scrap})}`:''].filter(Boolean).join(t('common.listSeparator'))||t('terminal.free');
 g.log(t(terminal.used?'terminal.dealSpent':'terminal.deal',{got,paid,left:terminalRemaining(terminal)}));
 return true;
}
