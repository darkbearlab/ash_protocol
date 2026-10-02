import {t} from './i18n.js';
import {AFFIX_TUNING,affixChance} from './enemy-affixes.js';
// Endless-mode and level-cap display helpers (3.49.1, Claude). Pure reads, so tests reach them without the DOM.
import {DIFFICULTY_CURVES,MAX_LEVEL,ENDLESS_DISPLAY_FLOORS,ENDLESS_TUNING,capSupplyText,curveOf,frozenFloor,pastFreeze} from './endless.js';
import {floorInfo} from './data.js';

const pad=n=>String(n).padStart(2,'0');
// "07 / 666": the UI always shows 666 floors; the rule limit (ENDLESS_MAX_FLOOR) is separate.
export const depthLabel=floor=>`${pad(floor)} / ${ENDLESS_DISPLAY_FLOORS}`;
export const levelCapped=level=>level>=MAX_LEVEL;
// The rules stop counting at MAX_LEVEL; older saves may still carry a higher number, so the label clamps it too.
export const levelLabel=level=>`LV.${pad(Math.min(level,MAX_LEVEL))}${levelCapped(level)?' MAX':''}`;
// 3.138.0: `need` is what the next level costs in this run (levelCost in src/perks.js); past the cap it is the cap-supply step.
export const levelTitle=(level,xp,need=Math.min(level,MAX_LEVEL)+2)=>`${t('endless-ui.xpTitle',{xp,v:level>=MAX_LEVEL?MAX_LEVEL+2:need,v2:levelCapped(level)?`${t('endless-ui.capNote',{v:MAX_LEVEL+2})}`:''})}`;
// Mission modal and field manual text; every number comes from the tuning constants. The modal already shows the
// mission line, so it asks for the rules without the opening sentence.
export function endlessRules({intro=true}={}){
  const tune=ENDLESS_TUNING;
  const at=curve=>Math.round(affixChance(tune.freeze,{curve,offset:0})*100);
  return t('endless-ui.rules',{intro:intro?t('endless-ui.intro'):'',freeze:tune.freeze,thinFrom:tune.freeze+1,densityStart:tune.densityStart,floorPct:Math.round(tune.attritionFloor*100),picnic:at('standard'),standard:at('hard'),hard:at('brutal')});
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
// 3.222.0: frozen at ENDLESS_TUNING.freeze, half pace past it (src/endless.js scaleEnemy).
export const growthLabel=(floor,d)=>{const c=curveOf(d),deep=Math.max(0,frozenFloor(floor)-6),past=pastFreeze(floor),x=g=>((1+g)**deep*(1+g*ENDLESS_TUNING.pastGrowth)**past).toFixed(2);return floor<=6?'':t('endless-ui.growth',{hp:x(c.hpGrowth),attack:x(c.damageGrowth)});};
// Arrival text for an endless floor: the cycled floor note, except the tutorial line past floor 6 and the
// extraction wording on core floors (endless never extracts).
export function endlessFloorText(floor){
  const info=floorInfo(floor);
  if(info.cycleFloor===6)return t('endless-ui.bossFloor');
  if(info.cycleFloor===1&&floor>6)return t('endless-ui.deepCycle');
  return info.text;
}
export const isRecordRun=(records,floor,level,kills)=>{const b=records?.endless?.best;return Boolean(b&&b.floor===floor&&b.level===level&&b.kills===kills);};
