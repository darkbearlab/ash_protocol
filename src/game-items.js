// The pack (3.206.3 split): ammunition and item capacity, dropping and receiving supplies, pickups, weapons found,
// taken and salvaged, containers, objectives, the terminal and prepared slots.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {t} from './i18n.js';
import {collectStory} from './run-unlocks.js';
import {UNLOCK_SETTINGS} from './unlock-catalog.js';
import {activeTrait} from './traits.js';
import {LEARNING_ITEMS,validLearningId} from './learning-data.js';
import {affixAllowed,rollAffix,salvageValue,weaponStats} from './weapons.js';
import {isLineItem} from './lines.js';
import {CAPPED_ITEMS,CARRY_TUNING,PREPARED_CATALOG,groundItemId,itemCapacity,itemGroundType,syncWearableTraits} from './prepared.js';
import {scheduleRetreatWave} from './retreat.js';
import {missionDefinition} from './missions.js';
import {FIELD_ITEMS,containerName,isRigged} from './containers.js';
import {GRENADES,grenadeByItem,grenadeTotal} from './throwables.js';
import {classCarryBonus} from './characters.js';
import {pickKeycard,vaultContents} from './vault.js';
import {EXO_TUNING} from './field-gear.js';
import {AMMUNITION,capacity,carryLevels,itemAmmo} from './ammunition.js';
import {WEAPONS} from './data.js';
import {DIRECTIONS,distance} from './world.js';
import {useTerminal} from './terminal.js';
import {storyText} from './story-text.js';
export class GameItems {
  recoverObjective(id){
    const objective=this.nearbyObjectives.find(o=>o.id===id);
    if(!objective)return this.fail(t('game.noObjectiveNear'));
    objective.done=true;
    if(missionDefinition(this).returnTrip){this.mission.returning=true;scheduleRetreatWave(this);this.log(t('game.objectiveReturn'),true);}
    this.log(t('game.objectiveRecovered',{summary:this.missionSummary}));return true;
  }
  containerLabel(c){const dx=c.x-this.player.x,dy=c.y-this.player.y;return t('game.containerLabel',{side:t(dx>0?'game.sideEast':dx<0?'game.sideWest':dy>0?'game.sideSouth':dy<0?'game.sideNorth':'game.sideHere'),container:containerName(c)});}
  containerDrop(c){
    const p=this.player,steps=DIRECTIONS.map(([dx,dy])=>({x:c.x+dx,y:c.y+dy}));
    const facing={x:p.x+p.facing[0],y:p.y+p.facing[1]};
    const candidates=[...(distance(c,p)===0?[facing]:[]),{x:c.x,y:c.y},...steps];
    const safe=q=>this.grid[q.y]?.[q.x]===1&&(distance(c,q)===0||this.canCross(c,q))&&!this.solid(q.x,q.y)&&!this.enemies.some(e=>e.hp>0&&distance(e,q)===0)&&!this.props.some(o=>o!==c&&distance(o,q)===0)&&!this.hazards.some(h=>distance(h,q)===0)&&distance(p,q)>0;
    return candidates.find(q=>safe(q)&&!this.items.some(i=>distance(i,q)===0))||candidates.find(safe)||{x:p.x,y:p.y};
  }
  openContainer(id){
    const c=this.nearbyContainers.find(c=>c.id===id);if(!c)return this.fail(t('game.noContainerNear'));
    if(isRigged(c))return this.detonateCase(c,this.player);
    const pos=this.containerDrop(c),contents=c.kind==='vault'?c.contents.map(i=>vaultContents(this,i)):c.contents;c.opened=true;c.contents=[];
    this.items.push(...contents.map(i=>i.type==='weapon'?this.registerWeapon({...i,...pos},true):({...i,...pos})));
    // container (3.118.0): tells the open-case sound apart from a pet's unpack, which uses the same visual.
    this.effects.push({type:'unpack',container:true,from:{x:c.x,y:c.y},to:pos,damage:0});
    if(!contents.length){this.log(t('game.containerEmpty',{container:containerName(c)}));return true;}
    this.log(t(distance(pos,this.player)===0?'game.containerUnderfoot':'game.containerSpilled',{container:containerName(c)}));return true;
  }
  reserveKey(weapon=this.weapon){return AMMUNITION[weapon.ammoType]?.key??null;}
  // 3.177.5 (user): what the operator says about an empty or short magazine. With no reserve left there is nothing to
  // reload, so firing says 沒彈藥了, the same as reloading does; 需要裝填 only while a reload would work.
  emptyCue(weapon=this.weapon){if(weapon.tank)return 'no_ammo';const key=this.reserveKey(weapon);return key&&!(this.player[key]>0)?'no_ammo':'reload_needed';}
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
    if(spill&&amount>accepted){this.dropItem(id,amount-accepted);this.log(t('game.itemOverflow',{item:entry.name,n:amount-accepted}));}
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
    if(!AMMUNITION[type])return 0;   // 3.203.0: what is left in a flamethrower's tank has no reserve to go back to
    const key=AMMUNITION[type].key,accepted=Math.min(amount,Math.max(0,this.ammoCapacity(type)-this.player[key]));
    this.player[key]+=accepted;if(spill&&amount>accepted){this.dropAmmo(type,amount-accepted);this.log(t('game.ammoOverflow',{ammo:AMMUNITION[type].name,n:amount-accepted}));}return accepted;
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
    if(spill&&amount>accepted){this.dropGrenade(id,amount-accepted);this.log(t('game.grenadeOverflow',{grenade:def.name,n:amount-accepted}));}return accepted;
  }
  dropGrenade(id,amount){const def=GRENADES[id],p=this.player,item=this.items.find(o=>o.type===def.item&&distance(o,p)===0);if(item)item.amount=(item.amount??1)+amount;else this.items.push({x:p.x,y:p.y,type:def.item,amount});}
  trimGrenades(){let excess=grenadeTotal(this.player)-this.ammoCapacity('grenade');for(const [id,def]of Object.entries(GRENADES)){const n=Math.min(Math.max(0,excess),this.player[def.resource]);if(n){this.player[def.resource]-=n;this.dropGrenade(id,n);excess-=n;}}}
  supplyPack(amounts){for(const [type,amount]of Object.entries(amounts))this.receiveAmmo(type,amount);}
  // The only place the prepared slot is written. Wearables hang their passives off it, so the two can never drift.
  setPrepared(category,id){this.player.prepared[category]=id;syncWearableTraits(this.player);return true;}
  pickup() {
    // 3.118.0: a presentation-only 'pickup' effect when anything was collected, including part of a pile left behind by a
    // full pouch, so the pickup sound plays. Effects are never saved and never read by the rules.
    const p=this.player,before=this.items.length;let partial=false;
    this.items=this.items.filter(item=>{
      if(distance(item,p)!==0)return true;
      if(item.type==='learning'){if(!validLearningId(item.learningId))return true;p.learningItems[item.learningId]=(p.learningItems[item.learningId]||0)+1;this.log(t('common.pickup',{item:LEARNING_ITEMS[item.learningId].name}));return false;}
      if(item.type==='weapon') {
        this.registerWeapon(item);
        if(p.owned.length>=this.weaponCapacity){this.log(t('game.weaponsFullSwap'));return true;}
        this.collectWeapon(item);return false;
      }
      const utility=grenadeByItem(item.type);
      if(utility){const amount=item.amount??1,accepted=this.receiveGrenade(utility,amount,{spill:false});if(accepted){partial=true;this.log(t('common.pickupAmount',{item:GRENADES[utility].name,n:accepted}));}if(accepted<amount){item.amount=amount-accepted;this.log(t('game.throwablesFull'));return true;}return false;}
      const ammo=itemAmmo(item.type);
      if(ammo){const amount=item.amount??AMMUNITION[ammo].pickup,accepted=this.receiveAmmo(ammo,amount,{spill:false});
        if(accepted){partial=true;this.log(t('common.pickupAmount',{item:AMMUNITION[ammo].name,n:accepted}));}
        if(accepted<amount){item.amount=amount-accepted;this.log(t('game.ammoFull',{ammo:AMMUNITION[ammo].name,n:item.amount}));return true;}
      }
      // 3.136.0: medkits and field kit stop at the carry cap; the rest of a pile stays where it lies.
      else if(item.type==='med'||FIELD_ITEMS.includes(item.type)){
        const id=groundItemId(item.type),entry=PREPARED_CATALOG.item[id],amount=item.amount||1,accepted=this.receiveItem(id,amount,{spill:false});
        if(accepted){partial=true;this.log(t('common.pickupAmount',{item:entry.name,n:accepted}));}
        if(accepted<amount){item.amount=amount-accepted;this.log(t('game.itemFull',{item:entry.name,n:item.amount}));return true;}
      }
      // 3.135.0: grapple lines, dropped only (src/lines.js).
      else if(isLineItem(item.type)){const entry=PREPARED_CATALOG.item[item.type],amount=item.amount||1;p[entry.resource]+=amount;this.log(t('common.pickupAmount',{item:entry.name,n:amount}));}
      // 3.135.0: goggles are found, not bought; one pair is all anyone carries.
      // 3.146.0: the keycard opens this floor's vault; a vault's exoskeleton comes with its full plates.
      else if(item.type==='key')pickKeycard(this);
      else if(item.type==='exo'){if(p.wearables.includes('exo')||activeTrait(p,'large')){this.log(t('game.exoUnusable'));return true;}p.wearables.push('exo');p.exoPlates=EXO_TUNING.plates;this.log(t('game.exoFound'));}
      else if(item.type==='irg'){if(p.wearables.includes('irg')){this.log(t('game.irgHave'));return true;}p.wearables.push('irg');this.log(t('game.irgFound'));}
      else if(item.type==='nvg'){if(p.wearables.includes('nvg')){this.log(t('game.nvgHave'));return true;}p.wearables.push('nvg');this.log(t('game.nvgFound'));}
      else if(item.type==='armor'){const amount=Math.min(item.amount||20,this.plateCapacity-(p.plates||0));if(amount<=0){this.log(t('game.platesFullLeft'));return true;}p.plates=(p.plates||0)+amount;this.log(t('game.platesRepaired',{n:amount,plates:p.plates,cap:this.plateCapacity}));}
      else if(item.type==='scrap'){const amount=Math.round((item.amount||15)*(1+p.scavenger*.5));p.scrap+=amount;this.log(t('game.scrapGained',{n:amount}));}
      else if(item.type==='lore'){if(!p.lore.includes(item.floor)){p.lore.push(item.floor);this.awardProtocol('lore',item.floor);}p.scrap+=10;const story=collectStory(this,item);this.log(story?(UNLOCK_SETTINGS.storiesWip?t('game.storyEncrypted'):t('game.storyDecrypted',{title:storyText(story).title})):t('game.dataRecovered'));}
      return false;
    });
    if(partial||this.items.length<before)this.effects.push({type:'pickup',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:0});
  }
  // 3.177.6 (user): whether stepping onto this ground item would take any of it right now, the way pickup() decides:
  // a full weapon pack, ammo or throwable pouch, item cap or plate carrier, or a wearable already worn takes nothing.
  // Read by the renderer only, which dims what you could not take.
  canTake(item){
    const p=this.player,full=(cap,have)=>cap<=(have||0);
    if(item.type==='weapon')return p.owned.length<this.weaponCapacity;
    const utility=grenadeByItem(item.type),ammo=itemAmmo(item.type);
    if(utility||ammo==='grenade')return !full(this.ammoCapacity('grenade'),grenadeTotal(p));
    if(ammo)return !full(this.ammoCapacity(ammo),p[AMMUNITION[ammo].key]);
    if(item.type==='med'||FIELD_ITEMS.includes(item.type))return !full(this.itemCapacity(),p[PREPARED_CATALOG.item[groundItemId(item.type)].resource]);
    if(item.type==='exo')return !p.wearables.includes('exo')&&!activeTrait(p,'large');
    if(item.type==='irg'||item.type==='nvg')return !p.wearables.includes(item.type);
    if(item.type==='armor')return !full(this.plateCapacity,p.plates);
    return true;
  }
  registerWeapon(item,roll=false) {
    if(item.slot!==undefined)return item;
    const p=this.player,slot=p.weaponBases.length;
    const stocked=item.affix!==undefined&&affixAllowed(item.weapon,item.affix)?item.affix:undefined;delete item.affix;   // 3.146.0: a vault's weapon
    const affix=stocked!==undefined?stocked:roll?rollAffix(item.weapon,`${this.seed}:${this.floor}:${slot}:${item.x}:${item.y}`):null;
    p.weaponBases.push(item.weapon);p.affixes.push(affix);p.ammo.push(weaponStats(item.weapon,affix).mag);p.upgrades.push(0);
    item.slot=slot;return item;
  }
  collectWeapon(item){const p=this.player;p.owned.push(item.slot);this.log(t('game.weaponCollected',{weapon:this.weaponAt(item.slot).name}));}
  addWeapon(base){
    if(!WEAPONS[base]||this.player.owned.length>=this.weaponCapacity)return false;
    const item=this.registerWeapon({weapon:base});this.collectWeapon(item);return item.slot;
  }
  nearbyWeapon(slot){return this.items.find(o=>o.type==='weapon'&&o.slot===slot&&this.canTouch(o));}
  takeWeapon(slot) {
    const item=this.nearbyWeapon(slot);
    if(!item)return this.fail(t('game.weaponNotNear'));
    if(this.player.owned.length>=this.weaponCapacity)return this.fail(t('game.weaponsFull',{n:this.weaponCapacity}));
    this.collectWeapon(item);this.items=this.items.filter(o=>o!==item);return true;
  }
  replaceWeapon(arg) {
    const p=this.player,item=this.nearbyWeapon(arg?.take),old=arg?.leave;
    if(!item||!p.owned.includes(old)||this.weaponAt(old).locked)return this.fail(t('game.swapGone'));
    p.owned[p.owned.indexOf(old)]=item.slot;if(p.weapon===old)p.weapon=item.slot;
    this.items=this.items.filter(o=>o!==item);
    this.items.push({x:p.x,y:p.y,type:'weapon',weapon:p.weaponBases[old],slot:old});
    this.log(t('game.weaponSwap',{weapon:this.weaponAt(item.slot).name,old:this.weaponAt(old).name}));return true;
  }
  salvage(index) {
    const p=this.player;
    if(!p.owned.includes(index))return this.fail(t('game.weaponNotInPack'));
    if(this.weaponAt(index).locked)return this.fail(t('game.boundCannotSalvage'));
    if(p.owned.length<=1)return this.fail(t('game.keepOneWeapon'));
    if(!this.weaponAt(index).melee)this.receiveAmmo(this.weaponAt(index).ammoType,p.ammo[index]);p.ammo[index]=0;p.owned=p.owned.filter(i=>i!==index);
    p.scrap+=salvageValue(p,index);p.upgrades[index]=0;p.stats.salvaged++;
    if(p.weapon===index)p.weapon=p.owned[0];this.log(t('game.salvage',{weapon:this.weaponAt(index).name}));return true;
  }
  // Salvage a dropped weapon without picking it up (3.50.0, user request): same yield as the pack version,
  // so a full pack can still turn loot into scrap and magazine ammunition.
  salvageGround(slot) {
    const p=this.player,item=this.nearbyWeapon(slot);
    if(!item)return this.fail(t('game.weaponNotNear'));
    const w=this.weaponAt(slot);
    if(w.locked)return this.fail(t('game.boundNoSalvage'));
    if(!w.melee)this.receiveAmmo(w.ammoType,p.ammo[slot]);p.ammo[slot]=0;
    const scrap=salvageValue(p,slot);p.scrap+=scrap;p.upgrades[slot]=0;p.stats.salvaged++;
    this.items=this.items.filter(o=>o!==item);
    this.log(t('game.salvageFloor',{weapon:w.name,scrap}));return true;
  }
  useTerminal(arg){return useTerminal(this,arg);}
}
