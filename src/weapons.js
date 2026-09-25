import {t} from './i18n.js';
import {rapidFireModifiers} from './suppression.js';
import {AMMUNITION} from './ammunition.js';
import {WEAPONS,PERK_D} from './data.js';
import {WEAPON_BANDS,shiftedBand} from './range-band.js';
import {activeTrait} from './traits.js';

// Stable IDs are stored in saves. Affixes affect the base gun; +1 tuning stays +5 damage.
export const AFFIXES={
  stable:{name:t('affixes.stable.name'),text:t('affixes.stable.text'),accuracy:10,damage:.9},
  piercing:{name:t('affixes.piercing.name'),text:t('affixes.piercing.text'),pierce:.25,mag:.75},
  extended:{name:t('affixes.extended.name'),text:t('affixes.extended.text'),mag:1.5,accuracy:-8},
  powerful:{name:t('affixes.powerful.name'),text:t('affixes.powerful.text'),damage:1.15,mag:.75},
  longbarrel:{name:t('affixes.longbarrel.name'),text:t('affixes.longbarrel.text'),range:2,damage:.9},
  // 3.155.0 (user proposal 2026-09-20): the mirror of the long barrel. A stubby gun trades reach for a band that starts
  // at your feet, and it comes up as fast as a sidearm — switching to it costs no turn, like a pistol.
  shortbarrel:{name:t('affixes.shortbarrel.name'),text:t('affixes.shortbarrel.text'),range:-2,nearEdge:-2,quickSwap:true,damage:.9},
  // 3.141.1 (user, 2026-09-19): no longer rolled on the shotgun, whose pellets ignore movement anyway (rollAffix).
  tracking:{name:t('affixes.tracking.name'),text:t('affixes.tracking.text'),tracking:12,damage:.9,notOn:['shotgun']},
  // 3.179.0 (user request 2026-09-25): a flash hider. Its shots make no muzzle flash, so firing from the black does not
  // light your tile (docs/LIGHTING.md); weaker for it. Not on the shotgun or the plasma rifle (user).
  flashhider:{name:t('affixes.flashhider.name'),text:t('affixes.flashhider.text'),damage:.85,noFlash:true,notOn:['shotgun','plasma']},
  // 3.141.0 (user decisions 2026-09-19, docs/WEAPONS.md): drop-only affixes, plasma rifles for now. Never sold, never
  // installed: they come only with a plasma rifle found on a floor, in a case or on a body (rollAffix below).
  lance:{name:t('affixes.lance.name'),text:t('affixes.lance.text'),damage:.85,shotCost:2,lance:true,dropOnly:['plasma']},
  burst:{name:t('affixes.burst.name'),text:t('affixes.burst.text'),damage:.85,shotCost:2,blast:.5,dropOnly:['plasma']},
  // 3.142.0 (user proposal 2026-09-19): one battery fires a three-round volley of ordinary rounds at half piercing; a volley
  // of three that lands suppresses (src/suppression.js), as the light machine gun's does.
  // suppressive (3.185.0): its three rounds suppress on a hit, though the threshold is now five (src/suppression.js).
  rapid:{name:t('affixes.rapid.name'),text:t('affixes.rapid.text'),suppressive:true,damage:.34,pierce:-.5,burst:3,volleyCost:1,dropOnly:['plasma']},
};
// How often a dropped weapon that can carry a drop-only affix gets each one. Its own hash, so every other roll is as before.
export const DROP_ONLY_CHANCE=.15;
export const dropOnlyAffixes=base=>Object.keys(AFFIXES).filter(id=>AFFIXES[id].dropOnly?.includes(WEAPONS[base]?.id));
export const affixAllowed=(base,affix)=>affix===null||Object.hasOwn(AFFIXES,affix)&&(!AFFIXES[affix].dropOnly||AFFIXES[affix].dropOnly.includes(WEAPONS[base]?.id));
// 3.148.0 改裝精通 (升級 D, docs/PERK_GROWTH.md): each rank adds a quarter of a regular affix's upside again; its downside
// stays, and the drop-only affixes are untouched. Accuracy, range and tracking round down.
export const masteryRank=actor=>actor?.perks?.mod_mastery||0;
export function masteredAffix(a,rank){
  if(!rank||a.dropOnly)return a;const k=1+PERK_D.mastery*rank,up={...a};
  if(a.accuracy>0)up.accuracy=Math.floor(a.accuracy*k);
  if(a.damage>1)up.damage=1+(a.damage-1)*k;
  if(a.mag>1)up.mag=1+(a.mag-1)*k;
  if(a.pierce>0)up.pierce=a.pierce*k;
  if(a.range>0)up.range=Math.floor(a.range*k);
  if(a.tracking>0)up.tracking=Math.floor(a.tracking*k);
  return up;
}
export function weaponStats(base,affix=null,actor=null){
  const w=WEAPONS[base];if(w.melee)return {...w,affix:null,affixText:w.desc,accuracyBonus:0,tracking:0};
  const rank=AFFIXES[affix]&&!AFFIXES[affix].dropOnly?masteryRank(actor):0,a=masteredAffix(AFFIXES[affix]||{},rank);
  const burstRange=w.range+(a.range||0),extended=w.weaponClass==='smg'&&activeTrait(actor,'extended_burst');
  return {...w,name:a.name?t('weapons.affixedName',{affix:a.name,weapon:w.name}):w.name,affix,affixText:(a.text||t('weapons.noAffix'))+(rank?t('weapons.mastery',{n:Math.round(PERK_D.mastery*rank*100)}):'')+(w.lootOnly?` · ${w.desc}`:'')+(extended?t('weapons.extendedBurst',{range:burstRange,from:burstRange+1,to:burstRange+2}):''),
    min:Math.round(w.min*(a.damage||1)),max:Math.round(w.max*(a.damage||1)),
    ...(w.closeRange?{closeMin:Math.round(w.closeMin*(a.damage||1)),closeMax:Math.round(w.closeMax*(a.damage||1))}:{}),
    ...(w.farFrom?{farMin:Math.round(w.farMin*(a.damage||1)),farMax:Math.round(w.farMax*(a.damage||1))}:{}),
    ...(w.pellets?{pelletMin:Math.round(w.pelletMin*(a.damage||1)),pelletMax:Math.round(w.pelletMax*(a.damage||1))}:{}),
    shotCost:a.shotCost||1,affixAccuracy:a.accuracy||0,...(a.burst?{burst:a.burst}:{}),...(a.volleyCost?{volleyCost:a.volleyCost}:{}),...(a.lance?{lance:true}:{}),...(a.blast?{blast:a.blast}:{}),
    mag:Math.max(1,Math.floor(w.mag*(a.mag||1))),range:Math.max(1,burstRange+(extended?2:0)),...(extended?{burstRange}:{}),
    // 3.152.0 有效距離: the long barrel and the extended burst push the far edge out; the near edge never moves.
    band:shiftedBand(WEAPON_BANDS[w.id],(a.range||0)+(extended?2:0),a.nearEdge||0),...(a.quickSwap?{quickSwap:true}:{}),...(a.suppressive?{suppressive:true}:{}),...(a.noFlash?{noFlash:true}:{}),
    pierce:Math.max(0,Math.min(1,(w.pierce||0)+(a.pierce||0))),extraRounds:rapidFireModifiers(actor).extraRounds,accuracyBonus:(a.accuracy||0)+rapidFireModifiers(actor).accuracyBonus,tracking:a.tracking||0};
}
// Do not change weapon.burst: it also divides per-volley perk damage bonuses.
export const singleShotAt=(weapon,range)=>weapon.burstRange!==undefined&&range>weapon.burstRange;
export const volleyAt=(weapon,range)=>(singleShotAt(weapon,range)?1:(weapon.burst||1))+(weapon.extraRounds||0);
// 3.142.0: rounds a volley fires with this much in the magazine, and what each round costs. A volleyCost weapon (速射)
// spends it once, on the first round; every other weapon spends shotCost a round (2 for 貫穿 and 爆裂).
export const volleyShots=(w,range,ammo)=>w.volleyCost?(ammo>=w.volleyCost?volleyAt(w,range):0):Math.min(volleyAt(w,range),Math.floor(ammo/(w.shotCost||1)));
export const roundCost=(w,round)=>w.volleyCost?(round===0?w.volleyCost:0):(w.shotCost||1);
// Separate from combat RNG: inspecting, collecting or restoring loot never rerolls it.
const fnv=seed=>{let hash=2166136261;for(const c of String(seed)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return hash>>>0;};
export function rollAffix(base,seed){
  if(WEAPONS[base]?.melee)return null;
  const special=dropOnlyAffixes(base),pick=Math.floor(fnv(`${seed}:drop-only`)/4294967296/DROP_ONLY_CHANCE);
  if(pick<special.length)return special[pick];
  const hash=fnv(seed);if(hash%100>=65)return null;
  const ids=Object.keys(AFFIXES).filter(id=>!AFFIXES[id].dropOnly&&(id!=='piercing'||!WEAPONS[base].explosive)),id=ids[Math.floor(hash/100)%ids.length];
  // An affix that means nothing on this weapon re-picks among the rest from its own hash, so every other roll, and how
  // often the weapon carries an affix at all, stay as they were.
  if(!AFFIXES[id].notOn?.includes(WEAPONS[base].id))return id;
  const rest=ids.filter(other=>!AFFIXES[other].notOn?.includes(WEAPONS[base].id));
  return rest[fnv(`${seed}:repick`)%rest.length];
}

export const ammoName=w=>w.melee?t('weapons.unlimited'):AMMUNITION[w.ammoType].name;
export const magazineLabel=(w,rounds)=>w.melee?'∞':`${rounds}/${w.mag}`;

// Shared dismantling/feeding/trade-in value; magazine ammunition is handled separately. The engineer's own passive
// (3.120.0, user decision) raises it by half: the workshop spends scrap all the time, and terminals now take it too.
export const SALVAGE_TUNING=Object.freeze({base:20,perLevel:10,engineer:1.5});
export const salvageValue=(p,slot)=>{const value=SALVAGE_TUNING.base+(p.upgrades[slot]||0)*SALVAGE_TUNING.perLevel;return p.character==='engineer'?Math.round(value*SALVAGE_TUNING.engineer):value;};
export const canSalvageOwned=(g,slot)=>Number.isInteger(slot)&&g.player.owned.includes(slot)&&g.player.owned.length>1&&!g.weaponAt(slot).locked;
