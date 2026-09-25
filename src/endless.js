import {t} from './i18n.js';
import {DEFAULT_FACTION,factionDef,expandRoster} from './faction-catalog.js';
// Shared rules/tuning. Catalog-only dependency; no RNG.
export const MAX_LEVEL=20;
export const ENDLESS_MAX_FLOOR=999;
// Display only (user call, 3.49.1): the UI shows endless runs as "of 666 floors". Not a rule; ENDLESS_MAX_FLOOR is the limit.
export const ENDLESS_DISPLAY_FLOORS=666;
export const PROTOCOL_EVENT_LIMIT=4096;
export const CAP_SUPPLY={meds:2,grenade:2,rifle:72,pistol:48,shell:12};   // rifle x3, pistol x2: 3.185.0
// Player-facing contents of one cap supply (3.49.1, Claude); names kept local so this module stays import-free.
const SUPPLY_NAMES={meds:t('supplyNames.med'),grenade:t('ammunition.grenade.name'),rifle:t('supplyNames.ammo'),pistol:t('supplyNames.pistol'),shell:t('supplyNames.shell'),energy:t('supplyNames.energy'),ordnance:t('ammunition.ordnance.name')};
export const capSupplyText=(times=1)=>Object.entries(CAP_SUPPLY).map(([id,n])=>`${SUPPLY_NAMES[id]||id} +${n*times}`).join(t('common.listSeparator'));
export const ENDLESS_TUNING={densityEvery:6,densityMax:3,get heavyExtra(){return expandRoster(factionDef(DEFAULT_FACTION).roster.deepExtra);}};
export const isEndless=g=>g.mission?.id==='endless';
export const floorLimit=g=>isEndless(g)?ENDLESS_MAX_FLOOR:6;
export const perkLimit=level=>Math.max(0,Math.min(level,MAX_LEVEL)-1);
export const extraEnemies=floor=>Math.min(ENDLESS_TUNING.densityMax,Math.max(0,Math.ceil((floor-6)/ENDLESS_TUNING.densityEvery)));
export const DIFFICULTY_TUNING={defaultOffset:0,minOffset:-6,maxOffset:60};
export const validDifficultyOffset=n=>Number.isInteger(n)&&n>=DIFFICULTY_TUNING.minOffset&&n<=DIFFICULTY_TUNING.maxOffset;
// 3.137.0 (user decisions 2026-09-19, docs/DIFFICULTY.md): a difficulty is a curve plus the knob's offset.
// - 簡單 (easy): enemy numbers grow slowly — hit points +2 a floor from floor 3, damage +1 a floor, and past floor 6
//   ×1.04 / ×1.03 a floor — and nothing else changes.
// - 標準 (standard): the same slow numbers, but ordinary affixes from floor 3 (5% a floor), elites and deployers from
//   depth 7, and one special enemy previewed on floor 2.
// - classic: the curve before 3.137.0 (+4 / +2 a floor, ×1.07 / ×1.04, affixes from depth 7, elites 9, deployers 8).
//   Runs started earlier keep it, so nothing changes mid-run; it is never offered.
export const DIFFICULTY_CURVES=Object.freeze({
 easy:Object.freeze({hpStep:2,damageStep:1,hpGrowth:.04,damageGrowth:.03,affixStart:7,affixPerDepth:.04,eliteStart:9,deployerStart:8,preview:false}),
 standard:Object.freeze({hpStep:2,damageStep:1,hpGrowth:.04,damageGrowth:.03,affixStart:3,affixPerDepth:.05,eliteStart:7,deployerStart:7,preview:true}),
 classic:Object.freeze({hpStep:4,damageStep:2,hpGrowth:.07,damageGrowth:.04,affixStart:7,affixPerDepth:.04,eliteStart:9,deployerStart:8,preview:false}),
});
export const DEFAULT_CURVE='standard';
export const validCurve=id=>typeof id==='string'&&Object.hasOwn(DIFFICULTY_CURVES,id);
// Rules take a {curve,offset} difficulty; a bare number is an offset on the default curve.
export const difficultyOf=d=>d&&typeof d==='object'?{curve:validCurve(d.curve)?d.curve:DEFAULT_CURVE,offset:Number.isInteger(d.offset)?d.offset:DIFFICULTY_TUNING.defaultOffset}:{curve:DEFAULT_CURVE,offset:Number.isInteger(d)?d:DIFFICULTY_TUNING.defaultOffset};
export const curveOf=d=>DIFFICULTY_CURVES[difficultyOf(d).curve];
export const effectiveDepth=(floor,d)=>Math.max(1,floor+difficultyOf(d).offset);
export const scaleEnemy=(base,floor,kind,d)=>Math.round(base*(1+curveOf(d)[kind==='hp'?'hpGrowth':'damageGrowth'])**Math.max(0,effectiveDepth(floor,d)-6));
// The per-floor part added before the deep growth: hit points from floor 3 (half for fragile cards), damage from floor 1.
export const floorHpBonus=(floor,d,fragile=false)=>Math.max(0,floor-2)*curveOf(d).hpStep/(fragile?2:1);
export const floorDamageBonus=(floor,d)=>floor*curveOf(d).damageStep;
export function giveCapSupply(g){
  const beforeSupply={resources:Object.fromEntries(['meds','grenades','reserve','pistol','shell','energy','ordnance'].map(k=>[k,g.player[k]])),items:structuredClone(g.items),logs:structuredClone(g.logs)};
  const {meds,...ammo}=CAP_SUPPLY;
  g.receiveItem('medkit',meds);g.supplyPack(ammo);
  g.log(t('endless.capSupply',{supply:capSupplyText()}));
  g.effects.push({type:'capSupply',beforeSupply,level:g.player.level,from:{x:g.player.x,y:g.player.y},to:{x:g.player.x,y:g.player.y},damage:0});
}
