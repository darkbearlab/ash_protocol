import {AFFIX_TUNING} from './enemy-affixes.js';
// Endless-mode and level-cap display helpers (3.49.1, Claude). Pure reads, so tests reach them without the DOM.
import {MAX_LEVEL,ENDLESS_DISPLAY_FLOORS,ENDLESS_TUNING,capSupplyText,curveOf} from './endless.js';
import {floorInfo} from './data.js';

const pad=n=>String(n).padStart(2,'0');
// "07 / 666": the UI always shows 666 floors; the rule limit (ENDLESS_MAX_FLOOR) is separate.
export const depthLabel=floor=>`${pad(floor)} / ${ENDLESS_DISPLAY_FLOORS}`;
export const levelCapped=level=>level>=MAX_LEVEL;
// The rules stop counting at MAX_LEVEL; older saves may still carry a higher number, so the label clamps it too.
export const levelLabel=level=>`LV.${pad(Math.min(level,MAX_LEVEL))}${levelCapped(level)?' MAX':''}`;
// 3.138.0: `need` is what the next level costs in this run (levelCost in src/perks.js); past the cap it is the cap-supply step.
export const levelTitle=(level,xp,need=Math.min(level,MAX_LEVEL)+2)=>`經驗 ${xp} / ${level>=MAX_LEVEL?MAX_LEVEL+2:need}${levelCapped(level)?`；已達等級上限，之後每 ${MAX_LEVEL+2} 點經驗自動發一份補給`:''}`;
// Mission modal and field manual text; every number comes from the tuning constants. The modal already shows the
// mission line, so it asks for the rules without the opening sentence.
export function endlessRules({intro=true}={}){
  const t=ENDLESS_TUNING;
  return `${intro?'沒有任務目標與撤離，每層電梯都通往更深處，直到陣亡。':''}樓層每六層循環：第 3、9、15… 層與第 6、12、18… 層都有頭目擋住電梯。第 7 層起敵人的生命與攻擊逐層按比例成長，每六層每房多一名敵人（最多 +${t.densityMax}），破壞者、狙擊手、自爆體更多，敵人最高有 ${Math.round(AFFIX_TUNING.chanceCap*100)}% 開始抽取詞條，後續詞條機率逐次減半，效果發動後顯現。死亡時記錄到達深度，全體與各職業各一筆；放棄不列入。`;
}
export function levelCapRules(){
  return `等級 ${MAX_LEVEL} 封頂：2～${MAX_LEVEL} 級各一次三選一，整局最多 ${MAX_LEVEL-1} 次。之後等級不再上升，畫面顯示 MAX；經驗照樣累積，每滿 ${MAX_LEVEL+2} 點自動發一份封頂補給（${capSupplyText()}），不開選單、不花回合，超量彈藥留在腳下。一般任務通常到不了 ${MAX_LEVEL} 級。`;
}
// Record rows for the journal and result screen. byCharacter is keyed by character id; unknown ids are skipped.
export function endlessRecordRows(records,names){
  const e=records?.endless;if(!e?.best)return {best:null,classes:[]};
  return {best:`第 ${depthLabel(e.best.floor)} 層 · LV.${pad(e.best.level)} · ${e.best.kills} 擊殺`,
    classes:Object.entries(e.byCharacter||{}).filter(([id])=>names[id]).sort((a,b)=>b[1].floor-a[1].floor).map(([id,r])=>`${names[id]} ${r.floor}`)};
}
// Deep-floor growth for the arrival toast, e.g. "敵人生命 ×1.50、攻擊 ×1.27"; empty on floors 1–6. 3.137.0: the rates
// belong to the run's difficulty curve.
export const growthLabel=(floor,d)=>{const c=curveOf(d);return floor<=6?'':`敵人生命 ×${((1+c.hpGrowth)**(floor-6)).toFixed(2)}、攻擊 ×${((1+c.damageGrowth)**(floor-6)).toFixed(2)}`;};
// Arrival text for an endless floor: the cycled floor note, except the tutorial line past floor 6 and the
// extraction wording on core floors (endless never extracts).
export function endlessFloorText(floor){
  const info=floorInfo(floor);
  if(info.cycleFloor===6)return '電梯由頭目鎖定。留意預告標記。';
  if(info.cycleFloor===1&&floor>6)return '深層重新循環：敵人更多、更強，精英可能帶快速、紅外線或夜視。';
  return info.text;
}
export const isRecordRun=(records,floor,level,kills)=>{const b=records?.endless?.best;return Boolean(b&&b.floor===floor&&b.level===level&&b.kills===kills);};
