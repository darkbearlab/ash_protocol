// Deployment step 3 (3.76.2, Claude): the difficulty knob's reserved slot and the real-mode switch.
// Only runOptions() reaches the rules layer; numbers come from DIFFICULTY_TUNING, AFFIX_TUNING and REAL_MODE_TUNING.
import {DIFFICULTY_TUNING,validDifficultyOffset} from './endless.js';
import {AFFIX_TUNING} from './enemy-affixes.js';
import {REAL_MODE_TUNING} from './real-mode.js';
import {FACTIONS,factionDef} from './factions.js';

// The future knob adds rows here; the step renders whatever is listed. Today only standard exists.
export const DIFFICULTY_OPTIONS=Object.freeze([Object.freeze({id:'standard',name:'標準',offset:DIFFICULTY_TUNING.defaultOffset})]);
export const difficultyOption=id=>DIFFICULTY_OPTIONS.find(d=>d.id===id)||DIFFICULTY_OPTIONS[0];
export const difficultyMeta=d=>`詞條自第 ${Math.max(1,AFFIX_TUNING.startDepth-d.offset)} 層`;
export const realModeMeta=()=>`協定點數 +${REAL_MODE_TUNING.protocolPercent}%`;
export const REAL_MODE_NOTE='瞄準只顯示名稱與距離，隱藏生命、耐久、命中率、壓制層數與傷害數字；預告與喊話照常。部署後整局不能切換。';

// Facility choice (3.80.0, development only): the released game rolls the faction by seed and the player learns it
// inside the facility. Pickable factions come first; other catalog entries are marked as test mixes.
export const FACILITY_OPTIONS=Object.freeze([
 Object.freeze({id:'random',name:'依種子隨機',meta:'正式版進入設施才知道'}),
 ...Object.entries(FACTIONS).sort(([,a],[,b])=>Number(Boolean(b.pickable))-Number(Boolean(a.pickable))).map(([id,d])=>Object.freeze({id,name:d.pickable?d.name:`${d.name}（測試）`,meta:'開發用'})),
]);
export const facilityOption=id=>FACILITY_OPTIONS.find(o=>o.id===id)||FACILITY_OPTIONS[0];

export function runOptions({difficulty,realMode,facility}={}){
 const offset=difficultyOption(difficulty).offset;
 return {realMode:realMode===true,difficultyOffset:validDifficultyOffset(offset)?offset:DIFFICULTY_TUNING.defaultOffset,facilityFaction:factionDef(facility)?facility:'random'};
}
