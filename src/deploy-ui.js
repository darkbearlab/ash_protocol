// Deployment step 3 (3.76.2, Claude): the difficulty knob's reserved slot and the real-mode switch.
// Only runOptions() reaches the rules layer; numbers come from DIFFICULTY_TUNING, DIFFICULTY_CURVES and REAL_MODE_TUNING.
import {t} from './i18n.js';
import {DIFFICULTY_TUNING,DIFFICULTY_CURVES,validDifficultyOffset} from './endless.js';
import {REAL_MODE_TUNING} from './real-mode.js';
import {FACTIONS,factionDef} from './factions.js';

// 3.137.0 (user decisions, docs/DIFFICULTY.md): the step renders whatever is listed; an option is a curve plus the knob's
// offset. 3.222.0 (user 2026-10-02): the ladder moves up a step, every id keeping its strength (「照實際強度對應」): the
// curve that was 標準 is now 野餐, the one that was 困難 is 普通, and a new 困難 doubles its affix chances (the `brutal`
// curve). The numbers-only 簡單 left the list; a profile that chose it plays 野餐, and a run already on it still loads
// under its old name (difficultyLabel). 普通 is the default for a new profile.
export const DIFFICULTY_OPTIONS=Object.freeze([
 Object.freeze({id:'standard',name:t('deploy-ui.standard'),curve:'standard',offset:DIFFICULTY_TUNING.defaultOffset}),
 Object.freeze({id:'hard',name:t('deploy-ui.hard'),curve:'hard',offset:DIFFICULTY_TUNING.defaultOffset}),   // 3.188.0
 Object.freeze({id:'brutal',name:t('deploy-ui.brutal'),curve:'brutal',offset:DIFFICULTY_TUNING.defaultOffset}),   // 3.222.0
]);
export const DEFAULT_DIFFICULTY='hard';
const RETIRED={easy:'standard'};
export const difficultyOption=id=>DIFFICULTY_OPTIONS.find(d=>d.id===(RETIRED[id]??id))||DIFFICULTY_OPTIONS.find(d=>d.id===DEFAULT_DIFFICULTY);
// The name a run's own curve goes by: a run begun on the retired 簡單 keeps that name.
export const difficultyLabel=curve=>curve==='easy'?t('deploy-ui.easy'):curve==='classic'?t('deploy-ui.classic'):difficultyOption(curve).name;
// 3.188.0: elites are named too when they start within a campaign's six floors (hard).
export const difficultyMeta=d=>{const c=DIFFICULTY_CURVES[d.curve],elite=Math.max(1,c.eliteStart-d.offset);return t(c.preview?'deploy-ui.affixFromPreview':'deploy-ui.affixFrom',{floor:Math.max(1,c.affixStart-d.offset)})+(elite<=6?t('deploy-ui.eliteFrom',{floor:elite}):'')+((c.affixScale??1)>1?t('deploy-ui.affixDouble'):'');};   // affixDouble: 3.222.0
export const realModeMeta=()=>`${t('deploy-ui.realBonus',{protocolPercent:REAL_MODE_TUNING.protocolPercent})}`;
export const REAL_MODE_NOTE=t('deploy-ui.realNote');

// Facility choice (3.80.0, development only): the released game rolls the faction by seed and the player learns it
// inside the facility. Pickable factions come first; other catalog entries are marked as test mixes.
export const FACILITY_OPTIONS=Object.freeze([
 Object.freeze({id:'random',name:t('deploy-ui.randomFacility'),meta:t('deploy-ui.randomMeta')}),
 ...Object.entries(FACTIONS).sort(([,a],[,b])=>Number(Boolean(b.pickable))-Number(Boolean(a.pickable))).map(([id,d])=>Object.freeze({id,name:d.pickable?d.name:t('deploy-ui.testFaction',{name:d.name}),meta:t('deploy-ui.devOnly')})),
]);
export const facilityOption=id=>FACILITY_OPTIONS.find(o=>o.id===id)||FACILITY_OPTIONS[0];

export function runOptions({difficulty,realMode,facility}={}){
 const chosen=difficultyOption(difficulty),offset=chosen.offset;
 return {realMode:realMode===true,difficulty:chosen.curve,difficultyOffset:validDifficultyOffset(offset)?offset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:factionDef(facility)?facility:'random'};
}
