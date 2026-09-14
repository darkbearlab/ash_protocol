// Deployment step 3 (3.76.2, Claude): the difficulty knob's reserved slot and the real-mode switch.
// Only runOptions() reaches the rules layer; numbers come from DIFFICULTY_TUNING, AFFIX_TUNING and REAL_MODE_TUNING.
import {DIFFICULTY_TUNING,validDifficultyOffset} from './endless.js';
import {AFFIX_TUNING} from './enemy-affixes.js';
import {REAL_MODE_TUNING} from './real-mode.js';

// The future knob adds rows here; the step renders whatever is listed. Today only standard exists.
export const DIFFICULTY_OPTIONS=Object.freeze([Object.freeze({id:'standard',name:'標準',offset:DIFFICULTY_TUNING.defaultOffset})]);
export const difficultyOption=id=>DIFFICULTY_OPTIONS.find(d=>d.id===id)||DIFFICULTY_OPTIONS[0];
export const difficultyMeta=d=>`詞條自第 ${Math.max(1,AFFIX_TUNING.startDepth-d.offset)} 層`;
export const realModeMeta=()=>`協定點數 +${REAL_MODE_TUNING.protocolPercent}%`;
export const REAL_MODE_NOTE='瞄準只顯示名稱與距離，隱藏生命、耐久、命中率、壓制層數與傷害數字；預告與喊話照常。部署後整局不能切換。';

export function runOptions({difficulty,realMode}={}){
 const offset=difficultyOption(difficulty).offset;
 return {realMode:realMode===true,difficultyOffset:validDifficultyOffset(offset)?offset:DIFFICULTY_TUNING.defaultOffset};
}
