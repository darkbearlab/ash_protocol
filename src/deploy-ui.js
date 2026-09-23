// Deployment step 3 (3.76.2, Claude): the difficulty knob's reserved slot and the real-mode switch.
// Only runOptions() reaches the rules layer; numbers come from DIFFICULTY_TUNING, DIFFICULTY_CURVES and REAL_MODE_TUNING.
import {t} from './i18n.js';
import {DIFFICULTY_TUNING,DIFFICULTY_CURVES,validDifficultyOffset} from './endless.js';
import {REAL_MODE_TUNING} from './real-mode.js';
import {FACTIONS,factionDef} from './factions.js';

// 3.137.0 (user decisions, docs/DIFFICULTY.md): easy and standard curves; standard is the default. The step renders
// whatever is listed; an option is a curve plus the knob's offset.
export const DIFFICULTY_OPTIONS=Object.freeze([
 Object.freeze({id:'easy',name:'簡單',curve:'easy',offset:DIFFICULTY_TUNING.defaultOffset}),
 Object.freeze({id:'standard',name:'標準',curve:'standard',offset:DIFFICULTY_TUNING.defaultOffset}),
]);
export const DEFAULT_DIFFICULTY='standard';
export const difficultyOption=id=>DIFFICULTY_OPTIONS.find(d=>d.id===id)||DIFFICULTY_OPTIONS.find(d=>d.id===DEFAULT_DIFFICULTY);
export const difficultyMeta=d=>{const c=DIFFICULTY_CURVES[d.curve];return t(c.preview?'deploy-ui.affixFromPreview':'deploy-ui.affixFrom',{floor:Math.max(1,c.affixStart-d.offset)});};
export const realModeMeta=()=>`協定點數 +${REAL_MODE_TUNING.protocolPercent}%`;
export const REAL_MODE_NOTE='瞄準只顯示名稱與距離，隱藏生命、耐久、命中率、壓制層數與傷害數字；預告與喊話照常。部署後整局不能切換。';

// Facility choice (3.80.0, development only): the released game rolls the faction by seed and the player learns it
// inside the facility. Pickable factions come first; other catalog entries are marked as test mixes.
export const FACILITY_OPTIONS=Object.freeze([
 Object.freeze({id:'random',name:'依種子隨機',meta:'正式版進入設施才知道'}),
 ...Object.entries(FACTIONS).sort(([,a],[,b])=>Number(Boolean(b.pickable))-Number(Boolean(a.pickable))).map(([id,d])=>Object.freeze({id,name:d.pickable?d.name:t('deploy-ui.testFaction',{name:d.name}),meta:'開發用'})),
]);
export const facilityOption=id=>FACILITY_OPTIONS.find(o=>o.id===id)||FACILITY_OPTIONS[0];

export function runOptions({difficulty,realMode,facility}={}){
 const chosen=difficultyOption(difficulty),offset=chosen.offset;
 return {realMode:realMode===true,difficulty:chosen.curve,difficultyOffset:validDifficultyOffset(offset)?offset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:factionDef(facility)?facility:'random'};
}
