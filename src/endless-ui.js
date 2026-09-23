import {t} from './i18n.js';
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
  const tune=ENDLESS_TUNING;
  return t('endless-ui.rules',{intro:intro?t('endless-ui.intro'):'',density:tune.densityMax,affixCap:Math.round(AFFIX_TUNING.chanceCap*100)});
}
export function levelCapRules(){
  return t('endless-ui.levelCap',{max:MAX_LEVEL,picks:MAX_LEVEL-1,every:MAX_LEVEL+2,supply:capSupplyText()});
}
// Record rows for the journal and result screen. byCharacter is keyed by character id; unknown ids are skipped.
export function endlessRecordRows(records,names){
  const e=records?.endless;if(!e?.best)return {best:null,classes:[]};
  return {best:t('endless-ui.bestRecord',{floor:depthLabel(e.best.floor),level:pad(e.best.level),kills:e.best.kills}),
    classes:Object.entries(e.byCharacter||{}).filter(([id])=>names[id]).sort((a,b)=>b[1].floor-a[1].floor).map(([id,r])=>`${names[id]} ${r.floor}`)};
}
// Deep-floor growth for the arrival toast, e.g. "敵人生命 ×1.50、攻擊 ×1.27"; empty on floors 1–6. 3.137.0: the rates
// belong to the run's difficulty curve.
export const growthLabel=(floor,d)=>{const c=curveOf(d);return floor<=6?'':t('endless-ui.growth',{hp:((1+c.hpGrowth)**(floor-6)).toFixed(2),attack:((1+c.damageGrowth)**(floor-6)).toFixed(2)});};
// Arrival text for an endless floor: the cycled floor note, except the tutorial line past floor 6 and the
// extraction wording on core floors (endless never extracts).
export function endlessFloorText(floor){
  const info=floorInfo(floor);
  if(info.cycleFloor===6)return '電梯由頭目鎖定。留意預告標記。';
  if(info.cycleFloor===1&&floor>6)return '深層重新循環：敵人更多、更強，精英可能帶快速、紅外線或夜視。';
  return info.text;
}
export const isRecordRun=(records,floor,level,kills)=>{const b=records?.endless?.best;return Boolean(b&&b.floor===floor&&b.level===level&&b.kills===kills);};
