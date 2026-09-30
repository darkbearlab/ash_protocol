import {t} from './i18n.js';
import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {validSuppression} from './suppression.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {enemyStartingTraitIds} from './enemy-data.js';
import {factionTraits,factionTraitRank} from './faction-catalog.js';
// Independent passive rules. Sources persist even when opposite effects cancel.
export const POINT_BLANK=Object.freeze({range:3,accuracy:10});
export const TRAITS={
 suppression_resistance:{name:t('traits.suppression_resistance.name'),text:t('traits.suppression_resistance.text')},
 rapid_fire:{name:t('traits.rapid_fire.name'),text:t('traits.rapid_fire.text')},
  disruption_resistant:{name:t('traits.disruption_resistant.name'),text:t('traits.disruption_resistant.text')},
  // 3.158.0 (user decision, NetHack's barbarian): the berserker never poisons. Direct acid and heat damage still land.
  poison_immunity:{name:t('traits.poison_immunity.name'),text:t('traits.poison_immunity.text')},
  // 3.160.0 (user decision): the berserker keeps one rank of resistance instead of immunity; 毒無效 stays defined so a
  // 3.158.0 save still loads (the class sync then drops it).
  poison_resistance:{name:t('traits.poison_resistance.name'),text:t('traits.poison_resistance.text')},
  tactical_supply:{name:t('traits.tactical_supply.name'),text:t('traits.tactical_supply.text')},
  extended_burst:{name:t('traits.extended_burst.name'),text:t('traits.extended_burst.text')},
 difficult_healing:{name:t('traits.difficult_healing.name'),text:t('traits.difficult_healing.text')},
  // 3.136.0 (user decision): learning data that widens every pouch.
  extended_carry:{name:t('traits.extended_carry.name'),text:t('traits.extended_carry.text')},
  night_vision:{name:t('traits.night_vision.name'),text:t('traits.night_vision.text')},
  exoskeleton:{name:t('traits.exoskeleton.name'),text:t('traits.exoskeleton.text')},
  infrared:{name:t('traits.infrared.name'),text:t('traits.infrared.text')},
  biological:{name:t('traits.biological.name'),text:t('traits.biological.text')},
  mechanical:{name:t('traits.mechanical.name'),text:t('traits.mechanical.text')},
  heavy_armor:{name:t('traits.heavy_armor.name'),text:t('traits.heavy_armor.text')},
  cowering:{name:t('traits.cowering.name'),text:t('traits.cowering.text')},
 payload_toxic:{name:t('traits.payload_toxic.name'),text:t('traits.payload_toxic.text')},
 payload_acid:{name:t('traits.payload_acid.name'),text:t('traits.payload_acid.text')},
 payload_spore:{name:t('traits.payload_spore.name'),text:t('traits.payload_spore.text')},
 underfoot:{name:t('traits.underfoot.name'),text:t('traits.underfoot.text')},
 lunge:{name:t('traits.lunge.name'),text:t('traits.lunge.text')},
 detour:{name:t('traits.detour.name'),text:t('traits.detour.text')},
 ready:{name:t('traits.ready.name'),text:t('traits.ready.text')},
 braced:{name:t('traits.braced.name'),text:t('traits.braced.text')},
  correction:{name:t('traits.correction.name'),short:t('traits.correction.short'),text:t('traits.correction.text')},
  // 3.155.0 (user decision 2026-09-20): the ninja trades the precision rifle for a submachine gun that barely misses up
 // close. Inside POINT_BLANK.range cover and the target's movement stop counting and the aim steadies.
 point_blank:{name:t('traits.point_blank.name'),text:t('traits.point_blank.text')},
 // 3.177.9 (user): the ninja's own stun grenades and EMPs pass it by, so one at its feet clears the swarm off it.
 close_throw:{name:t('traits.close_throw.name'),text:t('traits.close_throw.text')},
 sidestep:{name:t('traits.sidestep.name'),text:t('traits.sidestep.text')},
  quick_reload:{name:t('traits.quick_reload.name'),short:t('traits.quick_reload.short'),text:t('traits.quick_reload.text')},
  large:{name:t('traits.large.name'),opposite:'small',text:t('traits.large.text')},
  small:{name:t('traits.small.name'),opposite:'large',text:t('traits.small.text')},
  agile:{name:t('traits.agile.name'),opposite:'clumsy',text:t('traits.agile.text')},
  clumsy:{name:t('traits.clumsy.name'),opposite:'agile',text:t('traits.clumsy.text')},
  no_cover:{name:t('traits.no_cover.name'),short:t('traits.no_cover.short'),text:t('traits.no_cover.text')},
  fast:{name:t('traits.fast.name'),opposite:'slow',text:t('traits.fast.text')},
  slow:{name:t('traits.slow.name'),opposite:'fast',text:t('traits.slow.text')},
 bloodlust:{name:t('traits.bloodlust.name'),text:t('traits.bloodlust.text')},
 battle_spirit:{name:t('traits.battle_spirit.name'),text:t('traits.battle_spirit.text')},
 blade_stash:{name:t('traits.blade_stash.name'),text:t('traits.blade_stash.text')},
 ambush:{name:t('traits.ambush.name'),text:t('traits.ambush.text')},
  duelist:{name:t('traits.duelist.name'),text:t('traits.duelist.text')},
  exposed:{name:t('traits.exposed.name'),text:t('traits.exposed.text')},
  // 3.204.0: a loyalist boss's mark, on you (src/loyalist-bosses.js); the reverse of 預警's 標定 above.
  designated:{name:t('traits.designated.name'),text:t('traits.designated.text')},
  // 3.207.0: a delisted soldier's early warning, on you or your units (src/delisted-operatives.js).
  scanned:{name:t('traits.scanned.name'),text:t('traits.scanned.text')},
  // 3.208.0 (user decisions 2026-09-30, docs/SUPPRESSION.md section 13): a melee hit that lands gives the unit it hit as
  // many suppression stacks as the rank (src/suppression.js meleeSuppression). Only the swarm's biters carry it, through
  // their faction's override (src/faction-catalog.js), which also holds the rank.
  melee_suppression:{name:t('traits.melee_suppression.name'),text:t('traits.melee_suppression.text')},
};
export function hasTrait(actor,id){return (actor?.traits||[]).some(t=>t.id===id);}
export function activeTrait(actor,id){return hasTrait(actor,id)&&!hasTrait(actor,TRAITS[id]?.opposite);}
export const initiative=actor=>activeTrait(actor,'fast')?-1:activeTrait(actor,'slow')?1:0;
export const sizeModifier=actor=>activeTrait(actor,'large')?15:activeTrait(actor,'small')?-15:0;
export const movementModifier=actor=>activeTrait(actor,'agile')?13:activeTrait(actor,'clumsy')?-13:0;
// Suppression resistance stacks by source, so its label carries the rank (3.75.1); a trait a faction gives with a rank
// (近戰壓制, 3.208.0) carries the table's (factionTraitRank).
const labelRank=(actor,shown,id)=>id==='suppression_resistance'?Math.min(3,new Set(shown.filter(s=>s.id===id).map(s=>s.source)).size):factionTraitRank({type:actor?.type,traits:shown},id);
export function traitLabels(actor){const shown=(actor?.traits||[]).filter(t=>!t.source.startsWith('affix:')||actor.affixes?.some(a=>a.revealed&&t.source===`affix:${a.id}`));return [...new Set(shown.map(t=>t.id))].map(id=>{const n=labelRank(actor,shown,id);return t('traits.label',{name:TRAITS[id].short||TRAITS[id].name,rank:n?t('traits.rank',{n}):'',cancelled:activeTrait(actor,id)?'':t('traits.cancelled')});});}
export function tickTraits(actor){actor.traits=(actor.traits||[]).flatMap(t=>t.turns===undefined?[t]:t.turns>1?[{...t,turns:t.turns-1}]:[]);}
// The most traits a save may carry (66 legacy entries plus the two senses the v17 migration adds).
export const TRAIT_CAP=68;
export function validTraits(traits){return Array.isArray(traits)&&traits.length<=TRAIT_CAP&&traits.filter(t=>t?.id==='suppression_resistance').length<=3&&new Set(traits.filter(t=>t?.id==='suppression_resistance').map(t=>t.source)).size===traits.filter(t=>t?.id==='suppression_resistance').length&&traits.every(t=>t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.id==='string'&&Object.hasOwn(TRAITS,t.id)&&typeof t.source==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(t.source)&&(t.turns===undefined||(Number.isInteger(t.turns)&&t.turns>0&&t.turns<=999)));}
export const bodyKeyword=type=>ENEMY_TYPES[type]?.mechanical?'mechanical':'biological';
// 3.208.0: with its faction, the traits that faction's override adds to the card too (src/faction-catalog.js).
export function startingTraits(type,floor=1,faction=null){
  const ids=enemyStartingTraitIds(type,floor);
  return [...ids.map(id=>({id,source:`enemy:${type}`})),...(faction?factionTraits(faction,type):[])];
}
// A card as the units of a faction carry it (3.208.0): the hostile database and the text tool list a card with the
// traits its facility's units get, ranks included (蟲群幼體 · 敏捷 · 近戰壓制 1 階).
export const cardTraitLabels=(type,floor,faction)=>traitLabels({type,traits:startingTraits(type,floor,faction)});
// Every load (SAVE 86, 3.208.0; review): a unit's faction-given traits follow the table as it is now — the ones it no
// longer lists for the unit are dropped (a removed trait never shows as a rankless label or keeps working), missing ones
// are appended (a save from before 3.208.0, or a trait added later). Nothing else moves: with the table unchanged the
// list is left exactly as it was, so a load changes nothing and a replay stays identical. This floor, your units and
// every kept floor. Never past the cap.
function syncUnitFactionTraits(e){
  if(!e||!Array.isArray(e.traits))return;
  const want=factionTraits(e.faction,e.type),same=(a,b)=>a.id===b.id&&a.source===b.source;
  const kept=e.traits.filter(t=>!(typeof t?.source==='string'&&t.source.startsWith('faction:'))||want.some(w=>same(w,t)));
  const missing=want.filter(w=>!kept.some(t=>same(w,t))).slice(0,Math.max(0,TRAIT_CAP-kept.length));
  if(kept.length===e.traits.length&&!missing.length)return;
  e.traits=[...kept,...missing];
}
export function syncFactionTraits(data){
  for(const e of [...(data.enemies||[]),...(data.allies||[]),...Object.values(data.floorStates||{}).flatMap(f=>f?.enemies||[])])syncUnitFactionTraits(e);
}
export function initiativeQueue(player,enemies,allies=[]){return [player,...allies.filter(a=>a.hp>0),...enemies.filter(e=>e.hp>0)].map((actor,index)=>({actor,index,speed:initiative(actor)})).sort((a,b)=>a.speed-b.speed||a.index-b.index);}

export function grantTrait(actor,id,source,turns){
  const trait={id,source,...(turns===undefined?{}:{turns})};if(!validTraits([trait]))return false;
  const traits=(actor.traits||[]).filter(t=>t.id!==id||t.source!==source);if(traits.length>=68)return false;
  actor.traits=[...traits,trait];return true;
}
export function removeTraitSource(actor,source){actor.traits=(actor.traits||[]).filter(t=>t.source!==source);}

export function correctionBonus(actor,targetId,turn){
  const c=actor.fireChain;
  return activeTrait(actor,'correction')&&c&&c.targetId===targetId&&(c.turn===turn||c.turn===turn-1)?Math.min(c.count*8,24):0;
}
export const correctionLimit=()=>3;   // 3.159.0: 架槍精通 is gone, the chain caps at three again
export function recordShot(actor,targetId,turn){
  if(!activeTrait(actor,'correction')){actor.fireChain=null;return;}
  const c=actor.fireChain;
  actor.fireChain={targetId,turn,count:c?.targetId===targetId&&c.turn===turn-1?Math.min(correctionLimit(actor),c.count+1):1};
}
export function sidestepPenalty(attacker,target){
  if(!target.moved||!activeTrait(target,'sidestep')||!target.moveDelta)return 0;
  const [mx,my]=target.moveDelta,dx=attacker.x-target.x,dy=attacker.y-target.y;
  return Math.abs(mx*dy-my*dx)>Math.abs(mx*dx+my*dy)?20+classPerkRank(target,'recon_sidestep')*CLASS_PERK_TUNING.sidestep:0;
}
// 3.124.0: a move is not always one step. The swarm tongue pull records the whole displacement (up to five tiles, and
// diagonal), and the old one-step bound rejected every save taken right after a pull, which lost the run on reload.
// Sidestep only reads the direction, so any in-board displacement is valid.
export function validCombatMemory(actor,turn){
  const d=actor.moveDelta,c=actor.fireChain;
  return validSuppression(actor)&&Array.isArray(d)&&d.length===2&&d.every(n=>Number.isInteger(n)&&Math.abs(n)<SIZE)&&
    (c===null||(c&&typeof c==='object'&&!Array.isArray(c)&&typeof c.targetId==='string'&&c.targetId.length>0&&c.targetId.length<=100&&Number.isInteger(c.turn)&&c.turn>=1&&c.turn<=turn&&Number.isInteger(c.count)&&c.count>=1&&c.count<=correctionLimit(actor)));
}

export function reduceDirectDamage(actor,damage){
 const ready=activeTrait(actor,'ready')?.5:1;
 const heavy=activeTrait(actor,'heavy_armor'),plate=actor.plates>0?classPerkRank(actor,'bulwark_plating'):0,anchor=actor.skillState?.anchor?.remaining>0?classPerkRank(actor,'bulwark_anchor'):0;
 if(!heavy&&!plate&&!anchor&&ready===1)return damage;
 return Math.max(1,Math.ceil(damage*ready*(heavy ? .75 : 1)*(1-plate*CLASS_PERK_TUNING.plating)*(1-anchor*CLASS_PERK_TUNING.anchor)));
}

export const healingAmount=(actor,amount)=>activeTrait(actor,'difficult_healing')?Math.floor(amount/2):amount;
// 3.136.0 (user decision): difficult healing halves the base amount only; a bonus (the medic perk's) is added in full.
export function healActor(actor,amount,bonus=0){const before=actor.hp;actor.hp=Math.min(actor.maxHp,actor.hp+healingAmount(actor,amount)+bonus);return actor.hp-before;}
