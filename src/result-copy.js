import {t} from './i18n.js';
import {purgeReview} from './purge-review.js';
import {isEndless} from './endless.js';
import {missionDepth} from './missions.js';
import {rollFacilityFaction} from './faction-catalog.js';
// Result screen wording (3.114.0, user decision). The institution files a report, it does not console anyone: a loss is
// graded by how far the unit got, and a unit whose purge record was excellent is reported as a threat that has been
// used up. The purge verdict below the heading still decides what happens to a unit that came back, so the win copy
// never promises its fate.
export const RESULT_EYEBROWS=Object.freeze({abandoned:'MISSION ABANDONED',won:'PURGE COMPLETE',dead:'UNIT EXPENDED',failed:'FACILITY LOST'});
export const WIN_COPY=Object.freeze({title:t('winCopy.title'),body:t('winCopy.body')});
export const ABANDON_COPY=Object.freeze({title:t('abandonCopy.title'),body:t('abandonCopy.body')});
// 3.189.0: a survival run whose facility integrity ran out (docs/SURVIVAL.md).
export const FAIL_COPY=Object.freeze({title:t('failCopy.title'),body:t('failCopy.body')});
// Endless depth bands, and the share of a finite mission's depth that counts as "partly complete".
export const RESULT_TUNING=Object.freeze({endlessDeep:13,endlessMid:7,partialShare:2/3});

export function lossCopy(g){
  // An empty ledger reads as a perfect rate, so a unit that never met its quota is not graded as a threat.
  const review=purgeReview(g),excellent=Boolean(review&&review.quota>0&&review.tier==='excellent');
  if(isEndless(g)){
    const n=g.floor;
    if(n>=RESULT_TUNING.endlessDeep||excellent)return {title:t('resultCopy.endlessDeep.title',{n}),body:t('resultCopy.endlessDeep.body')};
    if(n>=RESULT_TUNING.endlessMid)return {title:t('resultCopy.endlessMid.title',{n}),body:t('resultCopy.endlessMid.body')};
    return {title:t('resultCopy.endlessShallow.title',{n}),body:t('resultCopy.endlessShallow.body')};
  }
  if(excellent)return {title:t('resultCopy.excellent.title'),body:t('resultCopy.excellent.body')};
  // Measured against the mission's own depth, so a three-floor round trip is graded like a six-floor descent.
  const deepest=g.deepestFloor||g.floor,depth=missionDepth(g);
  if(deepest>=Math.max(2,Math.ceil(depth*RESULT_TUNING.partialShare)))return {title:t('resultCopy.partial.title'),body:t('resultCopy.partial.body')};
  if(deepest>=2)return {title:t('resultCopy.advance.title'),body:t('resultCopy.advance.body')};
  return {title:t('resultCopy.none.title'),body:t('resultCopy.none.body')};
}

export function resultCopy(g){
  const status=g.status==='abandoned'?'abandoned':g.status==='won'?'won':g.status==='failed'?'failed':'dead';
  const copy=status==='abandoned'?ABANDON_COPY:status==='won'?WIN_COPY:status==='failed'?FAIL_COPY:lossCopy(g);
  return {eyebrow:RESULT_EYEBROWS[status],...copy};
}

// "繼續投入幹員" (3.114.0, user request): the same mission on the same seed and with the same options, with only the
// operative chosen again. A facility that was rolled from the seed is passed back as 'random' so it rolls identically.
export function retryPlan(g){
  return {
    mission:g.mission.id,seed:g.seed,character:g.player.character,
    options:{realMode:g.realMode===true,difficulty:g.difficulty,difficultyOffset:g.difficultyOffset,facilityFaction:g.facilityFaction===rollFacilityFaction(g.seed)?'random':g.facilityFaction},
  };
}
