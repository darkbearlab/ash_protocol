// The pack: weapons, prepared slots, items, learning and pet feeding, weapon comparison, the workshop and its
// blueprints, and the supply terminal's deals.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {sentences,t} from './i18n.js';
import {activeTrait,healingAmount} from './traits.js';
import {SURE_BLADE} from './melee-classes.js';
import {UNIT_BLUEPRINTS,buildReason,deployReason,deployedUnits,mountableSlots,repairReason,repairTargets} from './workshop.js';
import {ALLY_SKILLS,ENEMY_UNIT_TUNING,REPAIR_TUNING,allyName,allySkillState,allyWeapon,bombardDamage,defaultDroneCell,deployLimit,lineLimit} from './allies.js';
import {petFeedingState} from './pet-growth.js';
import {PET_LINE_NAMES,PET_LINE_TINTS,abilityChips,feedingView,fuelLabel,fuelPercent,lineProgress,nextNode,nodeSymbol,petOutputLine,petStatusLine,unlockedMajors} from './pet-ui.js';
import {learningInventory} from './learning.js';
import {LEARNING_SCRAP} from './learning-data.js';
import {learningEntries} from './suppression-ui.js';
import {skillStatus,skillText} from './skills.js';
import {bandLabel,weaponBand} from './range-band.js';
import {actorStat,clampHit} from './actor-stats.js';
import {ammoName,magazineLabel,salvageValue} from './weapons.js';
import {pelletChance} from './shotgun.js';
import {TERMINAL_PACK,TERMINAL_TUNING,offerReason,terminalCost,terminalDeal,terminalName,terminalRemaining,terminalSells,tradeHoldings} from './terminal.js';
import {CAPPED_ITEMS,PREPARED_CATALOG,PREPARED_CATEGORIES,preparedOptions} from './prepared.js';
import {GRENADES,grenadeTotal} from './throwables.js';
import {TERMINAL_ITEMS,distance,itemUseReason} from './engine.js';
import {AMMO_IDS,AMMUNITION,MELEE_TINT,TERMINAL_AMMO,ammoInfo} from './ammunition.js';
import {$,close,escapeHTML,game,modal,renderer} from './controller.js';
import {updateAim} from './controller-aim.js';
import {notify} from './controller-hud.js';
export let inventoryTab='weapon';
export const INVENTORY_TABS={weapon:t('controller.tab.weapon'),...PREPARED_CATEGORIES};
// Engineer workshop panel (docs/ENGINEER.md phase 1): the class skill opens the production lines; building and
// deploying are separate one-turn actions, and a deployed unit never comes back.
export let deployLine=0;
export function showWorkshop(message=''){
  const p=game.player,lines=lineLimit(p);
  const row=i=>{const unit=p.productionLines[i];
    if(!unit)return `<div class="ground-loot"><strong>${t('controller.ws.lineEmpty',{v:i+1})}</strong><small>${t('controller.ws.lineEmptyHint')}</small><button data-workshop-build>${t('controller.ws.build')}</button></div>`;
    const def=UNIT_BLUEPRINTS[unit.blueprint],reason=deployReason(game,i);
    return `<div class="ground-loot"><strong>${t('controller.ws.lineUnit',{v:i+1,defName:def.name,v2:unit.payload?` · ${GRENADES[unit.payload].name}`:'',v3:Number.isInteger(unit.weapon)?` · ${game.weaponAt(unit.weapon).name}`:''})}</strong><small>${sentences(def.text,unit.payload||['unit_bomber','unit_warden','unit_boss'].includes(unit.blueprint)?'':Number.isInteger(unit.weapon)?`${t('controller.ws.magFromYou',{v:p.ammo[unit.weapon],v2:game.weaponAt(unit.weapon).mag})}`:unit.blueprint==='unit_drone'?t('controller.ws.energyFromYou'):t('controller.ws.pistolFromYou'))}</small><button data-workshop-deploy="${i}" ${reason?'disabled':''}>${reason||t('controller.ws.deploy')}</button></div>`;};
  // Field repair (3.96.0) lives in this panel, not on the interact button, which the adjacent follow drone would take over.
  const repairs=repairTargets(game).map(a=>{const reason=repairReason(game,a.id),gain=Math.min(a.maxHp-a.hp,Math.ceil(a.maxHp*REPAIR_TUNING.share));return `<div class="ground-loot"><strong>${t('controller.ws.repairTitle',{v:allyName(a),hp:a.hp,maxHp:a.maxHp})}</strong><small>${t('controller.ws.repairHint',{gain})}</small><button data-workshop-repair="${a.id}" ${reason?'disabled':''}>${reason||`${t('controller.ws.repair',{cost:REPAIR_TUNING.cost})}`}</button></div>`;}).join('');
  modal(`<div class="eyebrow">WORKSHOP / ${p.productionLines.length} OF ${lines}</div><h2>${t('controller.ws.title')}</h2><p>${t('controller.ws.summary',{v:deployedUnits(game).length,v2:deployLimit(p),scrap:p.scrap})}<br>${t('controller.ws.enemyBlueprints',{v:p.blueprints.map(id=>UNIT_BLUEPRINTS[id].name+(p.usedBlueprints.includes(id)?t('controller.ws.built'):'')).join(t('common.listSeparator'))||t('controller.ws.noneYet')})}<br>${t('controller.ws.help',{cost:REPAIR_TUNING.cost})}</p>${message?`<p role="status">${escapeHTML(message)}</p>`:''}${repairs}${Array.from({length:lines},(_,i)=>row(i)).join('')}<button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);
}
function blueprintOption(id,def,payload=null,weapon=null){
  const p=game.player,reason=buildReason(game,id,payload??undefined,weapon??undefined),throwable=payload&&GRENADES[payload],gun=weapon!==null?game.weaponAt(weapon):null;
  const detail=throwable?`${t('controller.ws.throwableDetail',{v:p[throwable.resource]})}`
    :gun?`${t('controller.ws.gunDetail',{gunName:gun.name,v:p.upgrades[weapon]||0,v2:ammoName(gun),v3:p.ammo[weapon],mag:gun.mag,v4:p[AMMUNITION[gun.ammoType].key]})}<br>${t('controller.ws.gunMove',{v:p.weapon===weapon?t('controller.ws.handGun'):''})}`
    :id==='unit_warden'?`${t('controller.ws.hpArmor',{hp:ENEMY_UNIT_TUNING.warden.hp,armor:ENEMY_UNIT_TUNING.warden.armor})}<br>${t('controller.ws.wardenGun',{v:allyWeapon({kind:'drone',sourceId:id},p).min,range:ENEMY_UNIT_TUNING.warden.range})}`
    :id==='unit_boss'?`${t('controller.ws.hpArmor',{hp:ENEMY_UNIT_TUNING.boss.hp,armor:ENEMY_UNIT_TUNING.boss.armor})}<br>${t('controller.ws.bossGun',{v:allyWeapon({kind:'drone',sourceId:id},p).min,range:ENEMY_UNIT_TUNING.boss.range,v2:bombardDamage(p)})}`
    :id==='unit_bomber'?t('controller.ws.bomberNote')
    :id==='unit_drone'?`${t('controller.ws.droneGun',{range:ENEMY_UNIT_TUNING.drone.range})}<br>${t('controller.ws.droneAmmo',{energy:p.energy})}`
    :`${t('controller.ws.lmg',{v:def.mount?t('controller.ws.mountOption'):''})}<br>${t('controller.ws.pistolAmmo')}`;
  return `<button class="perk" data-workshop-blueprint="${id}"${payload?` data-payload="${payload}"`:''}${gun?` data-weapon="${weapon}"`:''} ${reason?'disabled':''}><strong>${t('controller.ws.blueprintButton',{defName:def.name,v:throwable?` · ${throwable.name}`:gun?` · ${gun.name}`:'',cost:def.cost,v2:throwable?t('controller.ws.plusOne'):'',v3:def.once?t('controller.ws.scrapOnly'):''})}</strong><span>${def.text}<br>${detail}${reason?`<br>${reason}`:''}</span></button>`;
}
export function showBlueprints(){
  const p=game.player;
  modal(`<div class="eyebrow">WORKSHOP / BLUEPRINTS</div><h2>${t('controller.ws.pickBlueprint')}</h2><p>${t('controller.ws.pickSummary',{scrap:p.scrap,productionLinesLength:p.productionLines.length,v:lineLimit(p)})}</p>${Object.entries(UNIT_BLUEPRINTS).flatMap(([id,def])=>def.payload?Object.keys(GRENADES).map(payload=>blueprintOption(id,def,payload)):[blueprintOption(id,def),...(def.mount?mountableSlots(game).map(slot=>blueprintOption(id,def,null,slot)):[])]).join('')}<button class="modal-button secondary" data-workshop>${t('controller.ws.back')}</button>`,true);
}
export function startDeployAim(line){
  const reason=deployReason(game,line),cell=defaultDroneCell(game);if(reason||!cell){showWorkshop(reason||t('controller.ws.noDeployTile'));return;}
  close();deployLine=line;renderer.mode='drone';renderer.aim=cell;notify(t('controller.ws.deployHint'));updateAim();
}
// Learning data in the item tab (3.74.1). Reasons and counts come from learningInventory; both actions are free.
function learningSection(){
  const entries=learningEntries(learningInventory(game));
  return `<h3 class="pack-subhead">${t('controller.pack.learningTitle')}</h3>${entries.length?`<div class="pack-rows learning-list">${entries.map(e=>`<div class="pack-row learning-row"><div class="pack-pick"><span class="pack-icon" aria-hidden="true">${e.icon}</span><span class="pack-name">${e.title}</span><small>×${e.count}</small></div>${packInfo(`learn-${e.id}`,e.detail)}${e.useReason?`<p class="pack-reason">${e.useReason}</p>`:''}<div class="pack-actions"><button data-learn="${e.id}" ${e.useReason?'disabled':''}>${t('controller.pack.useFree')}</button></div></div>`).join('')}</div>`:t('controller.pack.learningEmpty')}${entries.length?`<p class="pack-reason">${t('controller.pack.learningTrade',{LEARNING_SCRAP})}</p>`:''}`;
}
// Druid feeding panel (3.72.1). Every number and legality check comes from petFeedingState quotes.
function petFeedingSection(){
  const state=petFeedingState(game);if(!state)return '';
  const {gate,groups}=feedingView(state,{weaponName:slot=>game.weaponAt(slot).name}),output=petOutputLine(state);
  const abilities=abilityChips(state),chips=abilities.length?`<div class="pet-abilities">${abilities.map(chip=>`<span>${chip.text}</span>`).join('')}</div>`:'';
  const lines=Object.entries(state.growth).map(([line,g])=>`<div style="--tint:${PET_LINE_TINTS[line]}"><strong>${PET_LINE_NAMES[line]}<b>${g.rank} / 6</b></strong><span class="pet-nodes" aria-label="${g.rank} / 6 個節點">${g.nodes.map(n=>`<i class="${n.major?'major':''}${n.unlocked?' on':''}">${nodeSymbol(n)}</i>`).join('')}</span><small>${lineProgress(line,g)}</small><small>◆ ${unlockedMajors(g).join('、')||'尚無'}</small>${nextNode(g)?`<small>下一個：${nextNode(g).major?'◆ ':''}${nextNode(g).name}（${nextNode(g).text}）</small>`:''}</div>`).join('');
  const kinds=state.output.selectableKinds.length?`<div class="pet-output-kinds">${state.output.selectableKinds.map(k=>`<button data-pet-output="${k}" aria-pressed="${state.output.kind===k}">${GRENADES[k].short}</button>`).join('')}</div>`:'';
  const feed=groups.map(group=>`<p class="pet-feed-group">${group.label}</p><div class="pet-feed">${group.options.map(o=>`<button ${o.allowed?'':'disabled'} ${o.id==='weapon'?`data-feed-weapon="${o.weaponSlot}"`:`data-feed-option="${o.id}"`}><span>${o.title}</span>${o.detail?`<small>${o.detail}</small>`:''}</button>`).join('')}</div>`).join('');
  return `<section class="pet-feeding"><h3>伴生餵養</h3><p class="pet-status">${petStatusLine(state)}</p><p class="pet-status">${fuelLabel(state)}</p><div class="pet-fuel"><i style="width:${fuelPercent(state)}%"></i></div>${output?`<p class="pet-status">${output}</p>`:''}${chips}${kinds}<div class="pet-lines">${lines}</div>${gate?`<p class="pet-gate">${gate}</p>`:'<p class="pet-status">相鄰時每次餵一份、花 1 回合。</p>'}${feed}</section>`;
}
// Field pack, compact for phones (3.97.0, user request): no portrait or rules text, one row per entry with its
// description behind "?", and the main button in the pinned footer. Operator stats and passive rules live in the journal,
// reached from the settings menu (3.97.1, user report: a journal button in the pack was noise).
const packInfo=(id,text)=>text?`<button class="pack-info" data-pack-info="${id}" aria-expanded="false" aria-controls="pack-desc-${id}" aria-label="${t('controller.pack.describe')}">?</button><p class="pack-desc" id="pack-desc-${id}" hidden>${text}</p>`:'';
const allyStatus=a=>`${t('controller.ally.row',{v:a.status==='reforming'?t('controller.ally.reforming'):a.status==='arriving'?t('controller.ally.arriving'):a.status==='destroyed'?t('controller.ally.destroyed'):t('controller.ally.active'),floor:a.floor,hp:a.hp,maxHp:a.maxHp,v2:a.kind==='drone'?(a.payload?` ${t('controller.ally.loaded',{short:GRENADES[a.payload].short})}`:['unit_bomber','unit_warden','unit_boss'].includes(a.sourceId)?(a.primed?(a.sourceId==='unit_warden'?t('controller.ally.charging'):t('controller.ally.windingUp')):a.bombard?t('controller.ally.bombardNext'):''):(allyWeapon(a,game.player).builtIn?t('controller.ally.selfAmmo'):` ${t('controller.ally.ammo',{v:Number.isInteger(a.weapon)?game.weaponAt(a.weapon).name+' ':'',ammo:a.ammo,v2:allyWeapon(a,game.player).mag})}`)):''})}`;
export function showInventory(tab=inventoryTab,message='') {
  inventoryTab=Object.hasOwn(INVENTORY_TABS,tab)?tab:'weapon';
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1),category=inventoryTab;
  let content='';
  if(category==='weapon')content=`    <div class="pack-ammo">${AMMO_IDS.map(id=>`<span style="--tint:${AMMUNITION[id].tint};--tint-bg:${AMMUNITION[id].tint}26" title="${AMMUNITION[id].name}"><i>${AMMUNITION[id].short}</i><b>${p[AMMUNITION[id].key]}<small>/${game.ammoCapacity(id)}</small></b></span>`).join('')}</div>
    <div class="pack-weapons">${p.owned.map(index=>{const w=game.weaponAt(index),d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index];const tint=ammoInfo(w.ammoType)?.tint??MELEE_TINT;return `<article class="pack-weapon ${active?'equipped':''}" style="--tint:${tint};--tint-bg:${tint}1f"><div><div class="pack-weapon-head"><h3>${w.name}${level?` +${level}`:''}</h3><small>${active?t('controller.pack.equipped'):t('controller.pack.spare')}${w.melee&&game.bumpMeleeSlot()===index?t('controller.pack.bumpUse'):''} · ${w.code}</small></div><span>${t('controller.pack.weaponStats',{v:w.pellets?pelletSummary(index):`${d.min}–${d.max}`,v2:w.closeRange&&!w.pellets?` ${t('controller.pack.closeBandShort',{v:game.weaponDamage(index,{x:p.x+1,y:p.y}).min,v2:game.weaponDamage(index,{x:p.x+1,y:p.y}).max})}`:'',v3:w.shotCost>1?` ${t('controller.pack.perShot',{shotCost:w.shotCost})}`:'',v4:w.volleyCost?` ${t('controller.pack.perVolley',{volleyCost:w.volleyCost})}`:'',v5:w.burst?` ×${w.burst}${w.burstRange!==undefined?t('controller.pack.farSingle'):''}`:'',v6:w.hits?` ×${w.hits}`:'',range:w.range,v7:weaponBand(w)?` ${t('controller.pack.effective',{v:bandLabel(weaponBand(w))})}`:'',v8:ammoName(w),v9:magazineLabel(w,p.ammo[index]),v10:w.locked?t('controller.pack.boundTag'):''})}</span>${p.affixes[index]?`<p>${w.affixText}</p>`:''}<div class="pack-actions">${w.melee?`<button data-bump="${index}" aria-pressed="${game.bumpMeleeSlot()===index}" ${game.bumpMeleeSlot()===index?'disabled':''}>${game.bumpMeleeSlot()===index?t('controller.pack.bumpActive'):t('controller.pack.bumpSet')}</button>`:''}<button data-equip="${index}" ${active?'disabled':''}>${t('controller.pack.equip',{v:game.actionCost('weapon',index)})}</button><button data-salvage="${index}" ${p.owned.length<=1||w.locked?'disabled':''}>${w.locked?t('controller.pack.bound'):`${t('controller.pack.salvage',{v:salvageValue(p,index)})}`}</button></div></div></article>`;}).join('')}</div>
    ${ground.map(item=>{const w=game.weaponAt(item.slot),level=p.upgrades[item.slot]||0;const tint=ammoInfo(w.ammoType)?.tint??MELEE_TINT;return `<div class="ground-loot" style="--tint:${tint};--tint-bg:${tint}1f"><strong>${t('controller.pack.nearby',{wName:w.name,v:level?` +${level}`:''})}</strong><small>${t('controller.pack.affixMag',{affixText:w.affixText,v:p.ammo[item.slot],mag:w.mag})}</small><button data-compare="${item.slot}">${t('controller.pack.compare')}</button><button data-salvage-ground="${item.slot}" ${w.locked?'disabled':''}>${t('controller.pack.salvageHere',{v:salvageValue(p,item.slot)})}</button></div>`;}).join('')}
`;
  else {
    const options=preparedOptions(p,category);
    const status=(id,entry)=>entry.wear?(p.prepared[category]===id?t('controller.pack.takeOff'):t('controller.pack.putOn')):entry.resource?`×${p[entry.resource]}${CAPPED_ITEMS.includes(id)?`/${game.itemCapacity()}`:''}`:category==='skill'?(ALLY_SKILLS.includes(id)?allySkillState(game,id):`${skillStatus(p,id)}${p.skillState[id]?.cooldown?` ${t('controller.pack.cooldown',{cooldown:p.skillState[id].cooldown})}`:''}`):t('controller.pack.learned');
    // 3.107.0 (user request): a consumable is usable from the pack itself, so it needs no prepared slot. The slot
    // is on its way to becoming a 生效欄 for wearables, and a quick-use slot that also has to hold a medkit
    // cannot be both. The refusal comes from the rules layer, so a greyed button always matches what the turn
    // would have said.
    const useCell=(id,entry)=>{
      if(category!=='item'||!entry.action)return '';
      const reason=itemUseReason(game,id),cost=game.actionCost(entry.action);
      return `<button class="pack-use" data-use-item="${id}"${reason?' disabled':''} title="${reason||t(cost?'controller.useItemPaid':'controller.useItemFree',{item:entry.name})}">${t('controller.pack.use')}</button>`;
    };
    const useReason=(id,entry)=>category==='item'&&entry.action&&p[entry.resource]?itemUseReason(game,id):'';
    const row=([id,entry])=>{const on=p.prepared[category]===id,reason=useReason(id,entry);return `<div class="pack-row${on?' equipped':''}${category==='item'&&entry.action?' pack-row-usable':''}"><button class="pack-pick" data-prepare-category="${category}" data-prepare-id="${on?'':id}" aria-pressed="${on}"><span class="pack-icon" aria-hidden="true">${entry.icon}</span><span class="pack-name">${entry.name}</span><small>${on?entry.wear?t('controller.pack.wearing'):t('controller.pack.readied'):''}${status(id,entry)}</small></button>${useCell(id,entry)}${packInfo(`${category}-${id}`,(category==='skill'?skillText(p,id):entry.text)+(id==='medkit'?` ${t('controller.pack.medkitHeal',{v:healingAmount(p,45)+p.healBonus})}`:''))}${reason?`<p class="pack-reason">${t('controller.pack.reason',{reason})}</p>`:''}</div>`;};
    const allies=category==='skill'&&(game.allies.length||p.skills.includes('workshop'))?`<h3 class="pack-subhead">${t('controller.pack.alliesTitle')}</h3>${game.allies.length?`<ul class="pack-allies">${game.allies.map(a=>`<li><span>${allyName(a)}</span><small>${allyStatus(a)}</small></li>`).join('')}</ul>`:t('controller.pack.none')}${p.skills.includes('workshop')?`<p class="pack-hint">${t('controller.pack.workshopHint',{v:allySkillState(game,'workshop')})}</p>`:''}`:'';
    content=`<p class="pack-hint">${category==='grenade'?`${t('controller.pack.sharedCap',{v:grenadeTotal(p),v2:game.ammoCapacity('grenade')})} `:''}${category==='item'?t('controller.pack.itemHint'):t('controller.pack.readyHint')}</p>${options.length?`<div class="pack-rows">${options.map(row).join('')}</div>`:`<p class="pack-empty">${category==='skill'?t('controller.pack.noSkills'):t('controller.pack.nothing')}</p>`}${category==='item'?learningSection():''}${category==='skill'?petFeedingSection():''}${allies}`;
  }
  modal(`<h2 class="visually-hidden">${t('controller.pack.title')}</h2><div class="pack-resources"><span>${t('controller.pack.scrap')} <b>${p.scrap}</b></span><span>${t('controller.pack.plates')} <b>${p.plates}/${game.plateCapacity}</b></span><span>${t('controller.pack.weapons')} <b>${p.owned.length}/${game.weaponCapacity}</b></span></div>
    <div class="inventory-tabs" role="tablist" aria-label="${t('controller.pack.tabs')}">${Object.entries(INVENTORY_TABS).map(([id,label])=>`<button id="pack-tab-${id}" role="tab" aria-controls="pack-panel" aria-selected="${id===category}" tabindex="${id===category?0:-1}" data-inventory-tab="${id}">${label}</button>`).join('')}</div>
    ${message?`<p class="pack-message" role="status">${escapeHTML(message)}</p>`:''}
    <section id="pack-panel" role="tabpanel" aria-labelledby="pack-tab-${category}" tabindex="0">${content}</section>
    <div class="modal-footer"><button class="modal-button" data-modal="close">${t('controller.backToField')}</button></div>`,true);
}
// 3.141.0 (docs/WEAPONS.md): a shotgun is read by its pellets: each pellet's damage, how many reach at 1-6 tiles, the
// flat chance of each.
function pelletSummary(slot){const w=game.weaponAt(slot),d=game.pelletDamage(slot,{x:game.player.x+1,y:game.player.y});return `${t('controller.pack.pelletLine',{min:d.min,max:d.max,v:w.pellets.join(t('controller.slash')),pelletsLength:w.pellets.length,v2:pelletChance(w)})}`;}
export function showWeaponComparison(take,against=game.player.weapon){
  const p=game.player,item=game.nearbyWeapon(take);if(!item||!p.owned.includes(against)){showInventory();return;}
  const old=game.weaponAt(against),next=game.weaponAt(take),a=game.weaponDamage(against),b=game.weaponDamage(take);
  const shot=w=>w.melee&&activeTrait(p,'sure_blade')?SURE_BLADE:clampHit(w.melee?w.hitChance+actorStat(p,'meleeAccuracy'):97+w.accuracyBonus+actorStat(p,'rangedAccuracy')),pierce=w=>`${Math.round(w.pierce*100)}%`;   // 3.210.0: 穩刃
  const close=slot=>{const w=game.weaponAt(slot),d=w.pellets?game.pelletDamage(slot,{x:p.x+1,y:p.y}):game.weaponDamage(slot,{x:p.x+1,y:p.y});return w.pellets?`${t('controller.pack.pellets',{count:d.count,min:d.min,max:d.max})}`:w.closeRange?`${t('controller.pack.closeBand',{min:d.min,max:d.max,closeAccuracy:w.closeAccuracy})}`:t('controller.pack.sameDamage');};
  const single=(slot,d)=>{const w=game.weaponAt(slot);return w.pellets?`${t('controller.pack.perPellet',{v:game.pelletDamage(slot,{x:p.x+1,y:p.y}).min,v2:game.pelletDamage(slot,{x:p.x+1,y:p.y}).max})}`:`${d.min}–${d.max}`;};
  const aimed=(w,moving)=>w.pellets?`${t('controller.pack.perPelletHit',{v:pelletChance(w)})}`:`${shot(moving?{...w,accuracyBonus:w.accuracyBonus-22+w.tracking}:w)}%`;
  const rows=[[t('controller.cmp.close'),close(against),close(take)],[t('controller.cmp.single'),single(against,a),single(take,b)],[t('controller.cmp.rounds'),old.burstRange!==undefined?t('controller.cmp.burstBands'):old.burst||1,next.burstRange!==undefined?t('controller.cmp.burstBands'):next.burst||1],[t('controller.cmp.hitStill'),aimed(old,false),aimed(next,false)],[t('controller.cmp.hitMoving'),aimed(old,true),aimed(next,true)],[t('controller.cmp.ammoPerShot'),old.shotCost||1,next.shotCost||1],[t('controller.cmp.range'),old.range,next.range],[t('controller.cmp.magazine'),magazineLabel(old,p.ammo[against]),magazineLabel(next,p.ammo[take])],[t('controller.cmp.ammoType'),ammoName(old),ammoName(next)],[t('controller.cmp.pierce'),pierce(old),pierce(next)],[t('controller.cmp.upgrade'),`+${p.upgrades[against]}`,`+${p.upgrades[take]}`]];
  modal(`<div class="eyebrow">WEAPON COMPARISON</div><h2>${next.name}</h2><p>${next.affixText}<br>${next.desc}</p><p>${t('controller.cmp.against',{oldName:old.name,v:against===p.weapon?t('controller.cmp.equipped'):t('controller.cmp.spare')})}<br>${old.affixText}</p><div class="pack-actions">${p.owned.map(slot=>`<button data-compare="${take}" data-against="${slot}" ${slot===against?'disabled':''}>${game.weaponAt(slot).name} +${p.upgrades[slot]} · ${magazineLabel(game.weaponAt(slot),p.ammo[slot])}</button>`).join('')}<button data-salvage-ground="${take}">${t('controller.pack.salvageHere',{v:20+(p.upgrades[take]||0)*10})}</button>${p.owned.length<game.weaponCapacity?`<button class="primary" data-take="${take}">${t('controller.cmp.take')}</button>`:''}</div><table class="weapon-comparison"><thead><tr><th>${t('controller.cmp.stat')}</th><th>${t('controller.cmp.held')}</th><th>${t('controller.cmp.ground')}</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th>${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}</tbody></table><p>${t('controller.cmp.note')}</p>${old.locked?t('controller.cmp.boundNote'):`<p>${t('controller.cmp.swapNote',{oldName:old.name,v:against===p.weapon?t('controller.cmp.equipNew'):t('controller.cmp.keepCurrent')})}</p><button class="modal-button" data-replace="${take}" data-leave="${against}">${t('controller.cmp.swap')}</button>`}<button class="modal-button secondary" data-modal="bag">${t('controller.backToPack')}</button>`,true);
}
// Supply terminal (3.120.0 economy, src/terminal.js): a list of offers, then a payment step where the player picks what
// goes into the value pool; scrap covers the rest. Every price, reason and value comes from the rules module.
export let terminalDraft=null;
const TRADE_GROUPS={ammo:t('controller.trade.ammo'),throw:t('controller.trade.throw'),item:t('controller.trade.item'),wear:t('controller.trade.wear'),weapon:t('controller.trade.weapon'),learning:t('controller.trade.learning')};
function terminalOfferGroups(){
  const p=game.player;
  return [
    {name:t('controller.shop.medical'),rows:[{id:'heal',title:t('controller.shop.heal'),detail:`${t('controller.shop.healDetail',{v:healingAmount(p,TERMINAL_TUNING.healAmount)})}`},{id:'med',title:t('controller.shop.medkit'),detail:`${t('controller.shop.medsHeld',{meds:p.meds,itemCapacity:game.itemCapacity()})}`},{id:'spray',title:PREPARED_CATALOG.item.spray.name,detail:`${t('controller.shop.spraysHeld',{sprays:p.sprays,itemCapacity:game.itemCapacity()})}`}]},
    {name:t('controller.shop.ammo'),rows:[{id:'ammo',title:t('controller.shop.ammoPack'),detail:Object.entries(TERMINAL_PACK).map(([id,n])=>`${AMMUNITION[id].name} ${n}`).join(t('common.listSeparator'))+t('controller.period')},...AMMO_IDS.map(id=>({id,title:`${AMMUNITION[id].name} +${TERMINAL_AMMO[id].amount}`,detail:`${t('controller.shop.current',{v:p[AMMUNITION[id].key],v2:game.ammoCapacity(id)})}`}))]},
    {name:t('controller.shop.throwables'),rows:Object.values(GRENADES).map(entry=>({id:entry.item,title:`${entry.name} +${entry.amount}`,detail:`${t('controller.shop.throwHeld',{v:p[entry.resource],v2:grenadeTotal(p),v3:game.ammoCapacity('grenade')})}`}))},
    {name:t('controller.shop.items'),rows:Object.entries(TERMINAL_ITEMS).filter(([id,offer])=>offer.sold!==false&&id!=='spray').map(([id,offer])=>{const entry=PREPARED_CATALOG.item[id],held=offer.wear?p.wearables.includes(offer.wear):p[offer.resource];return {id,title:entry.name,detail:offer.wear?(held?t('controller.shop.haveOne'):t('controller.shop.wearable')):`${t('controller.shop.itemHeld',{held,itemCapacity:game.itemCapacity()})}`};})},
    {name:t('controller.shop.upgrades'),rows:p.owned.map(slot=>{const w=game.weaponAt(slot),level=p.upgrades[slot]||0;return {id:`upgrade:${slot}`,title:`${w.name} +${Math.min(level+1,TERMINAL_TUNING.upgradeMax)}`,detail:`${t('controller.shop.upgradeDetail',{level,v:slot===p.weapon?t('controller.shop.inHand'):''})}`};})},
  ].map(group=>({...group,rows:group.rows.filter(row=>terminalSells(game.nearbyTerminal,row.id))})).filter(group=>group.rows.length);   // 3.135.0: this kind's offers only
}
function terminalAffordable(id){
  const deal=terminalDeal(game,id,{});if(!deal.reason)return '';
  const most=tradeHoldings(game).reduce((sum,row)=>sum+row.max*row.value,0);
  return game.player.scrap+most<deal.price?t('controller.shop.cannotAfford'):'';
}
export function showTerminal(){
  const p=game.player,terminal=game.nearbyTerminal;terminalDraft=null;
  if(!terminal){notify(t('controller.shop.noTerminal'));return;}
  modal(`<div class="eyebrow">SUPPLY TERMINAL</div><h2>${t('controller.shop.title',{v:terminalName(terminal)})}</h2><p>${t('controller.shop.creditLeft')} <strong>${terminalRemaining(terminal)} / ${TERMINAL_TUNING.credit}</strong> ${t('controller.shop.intro',{scrap:p.scrap})}</p>${terminalOfferGroups().map(group=>`<h3 class="pack-subhead">${group.name}</h3>${group.rows.map(row=>{const reason=offerReason(game,row.id)||terminalAffordable(row.id);return `<button class="perk" data-terminal-pick="${row.id}" ${reason?'disabled':''}><strong>${row.title} · ${terminalCost(row.id,game)}</strong><span>${reason||row.detail}</span></button>`;}).join('')}`).join('')}<button class="modal-button secondary" data-modal="close">${t('controller.backToFieldPlain')}</button>`);
}
export function showTerminalDeal(buy){
  const terminal=game.nearbyTerminal;if(!terminal||offerReason(game,buy)){showTerminal();return;}
  terminalDraft={buy,trade:{}};
  const title=terminalOfferGroups().flatMap(group=>group.rows).find(row=>row.id===buy)?.title||buy,price=terminalCost(buy,game),rows=tradeHoldings(game).filter(row=>row.held>0);
  const groups=Object.entries(TRADE_GROUPS).map(([group,name])=>[name,rows.filter(row=>row.group===group)]).filter(([,list])=>list.length);
  modal(`<div class="eyebrow">SUPPLY TERMINAL / PAYMENT</div><h2>${title} · ${price}</h2><p>${t('controller.pay.intro',{v:terminalRemaining(terminal),v2:terminalRemaining(terminal)-price})}</p>${groups.length?groups.map(([name,list])=>`<h3 class="pack-subhead">${name}</h3><div class="terminal-trades">${list.map(row=>`<div class="terminal-trade"><span><strong>${row.name}</strong><small>${t('controller.trade.row',{unit:row.unit,rowValue:row.value,held:row.held,v:row.reason?` · ${row.reason}`:''})}</small></span><span class="terminal-stepper"><button data-trade-step="${row.id}" data-step="-1" aria-label="${t('controller.trade.less',{rowName:row.name})}" disabled>−</button><b data-trade-count="${row.id}">0</b><button data-trade-step="${row.id}" data-step="1" aria-label="${t('controller.trade.more',{rowName:row.name})}" ${row.max?'':'disabled'}>${t('controller.trade.plus')}</button></span></div>`).join('')}</div>`).join(''):t('controller.pay.nothing')}<p class="terminal-total" id="terminal-total" aria-live="polite"></p><button class="modal-button" id="terminal-confirm" data-terminal-confirm>${t('controller.pay.confirm')}</button><button class="modal-button secondary" data-terminal-back>${t('controller.pay.back')}</button>`);
  refreshTerminalDeal();
}
export function refreshTerminalDeal(){
  if(!terminalDraft)return;
  const {buy,trade}=terminalDraft,deal=terminalDeal(game,buy,trade),p=game.player,rows=new Map(tradeHoldings(game).map(row=>[row.id,row]));
  for(const node of document.querySelectorAll('[data-trade-count]'))node.textContent=String(trade[node.dataset.tradeCount]||0);
  for(const button of document.querySelectorAll('[data-trade-step]')){const id=button.dataset.tradeStep,count=trade[id]||0;button.disabled=button.dataset.step==='-1'?count<=0:count>=(rows.get(id)?.max||0);}
  const total=$('#terminal-total'),confirm=$('#terminal-confirm');
  if(total)total.textContent=`${t('controller.pay.total',{pool:deal.pool,v:deal.waste?`${t('controller.pay.wasted',{waste:deal.waste})}`:'',scrap:deal.scrap,scrap2:p.scrap,v2:Math.min(deal.pool,deal.price)+deal.scrap,price:deal.price})}`;
  if(confirm){confirm.disabled=Boolean(deal.reason);confirm.textContent=deal.reason||t('controller.pay.confirm');}
}
// Setters for the other controller modules (an imported binding is read-only).
export function setTerminalDraft(value){terminalDraft=value;}
