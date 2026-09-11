// Endless-mode and level-cap display helpers (3.49.1, Claude). Pure reads, so tests reach them without the DOM.
import {MAX_LEVEL,ENDLESS_DISPLAY_FLOORS,ENDLESS_TUNING,capSupplyText} from './endless.js';
import {floorInfo} from './data.js';

const pad=n=>String(n).padStart(2,'0');
// "07 / 666": the UI always shows 666 floors; the rule limit (ENDLESS_MAX_FLOOR) is separate.
export const depthLabel=floor=>`${pad(floor)} / ${ENDLESS_DISPLAY_FLOORS}`;
export const levelCapped=level=>level>=MAX_LEVEL;
export const levelLabel=level=>`LV.${pad(level)}${levelCapped(level)?' 封頂':''}`;
export const levelTitle=(level,xp)=>`經驗 ${xp} / ${level+2}${levelCapped(level)?`；${MAX_LEVEL} 級已封頂，之後每升一級自動發一份補給`:''}`;
// Mission modal and field manual text; every number comes from the tuning constants. The modal already shows the
// mission line, so it asks for the rules without the opening sentence.
export function endlessRules({intro=true}={}){
  const t=ENDLESS_TUNING;
  return `${intro?'沒有任務目標與撤離，每層電梯都通往更深處，直到陣亡。':''}樓層每六層循環：第 3、9、15… 層的封鎖官擋住電梯，第 6、12、18… 層要擊敗核心守衛才開電梯。第 7 層起敵人的生命與攻擊逐層按比例成長，每六層每房多一名敵人（最多 +${t.densityMax}），破壞者、狙擊手、自爆體更多，一般敵人最高有 ${Math.round(t.eliteMax*100)}% 帶一項精英特性（快速、紅外線或夜視）。死亡時記錄到達深度，全體與各職業各一筆；放棄不列入。`;
}
export function levelCapRules(){
  return `等級 ${MAX_LEVEL} 封頂：2～${MAX_LEVEL} 級各一次三選一，整局最多 ${MAX_LEVEL-1} 次；之後經驗照給，每升一級自動發一份封頂補給（${capSupplyText()}），不開選單、不花回合，超量彈藥留在腳下。一般任務通常到不了 ${MAX_LEVEL} 級。`;
}
// Record rows for the journal and result screen. byCharacter is keyed by character id; unknown ids are skipped.
export function endlessRecordRows(records,names){
  const e=records?.endless;if(!e?.best)return {best:null,classes:[]};
  return {best:`第 ${depthLabel(e.best.floor)} 層 · LV.${pad(e.best.level)} · ${e.best.kills} 擊殺`,
    classes:Object.entries(e.byCharacter||{}).filter(([id])=>names[id]).sort((a,b)=>b[1].floor-a[1].floor).map(([id,r])=>`${names[id]} ${r.floor}`)};
}
// Deep-floor growth for the arrival toast, e.g. "敵人生命 ×1.50、攻擊 ×1.27"; empty on floors 1–6.
export const growthLabel=floor=>floor<=6?'':`敵人生命 ×${((1+ENDLESS_TUNING.hpGrowth)**(floor-6)).toFixed(2)}、攻擊 ×${((1+ENDLESS_TUNING.damageGrowth)**(floor-6)).toFixed(2)}`;
// Arrival text for an endless floor: the cycled floor note, except the tutorial line past floor 6 and the
// extraction wording on core floors (endless never extracts).
export function endlessFloorText(floor){
  const info=floorInfo(floor);
  if(info.cycleFloor===6)return '擊敗核心守衛才能開電梯；避開紅色轟炸標記與鄰格。';
  if(info.cycleFloor===1&&floor>6)return '深層重新循環：敵人更多、更強，精英可能帶快速、紅外線或夜視。';
  return info.text;
}
export const isRecordRun=(records,floor,level,kills)=>{const b=records?.endless?.best;return Boolean(b&&b.floor===floor&&b.level===level&&b.kills===kills);};
