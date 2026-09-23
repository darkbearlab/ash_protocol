import {t} from './i18n.js';
import {purgeReview} from './purge-review.js';
import {isEndless} from './endless.js';
import {missionDepth} from './missions.js';
import {rollFacilityFaction} from './faction-catalog.js';
// Result screen wording (3.114.0, user decision). The institution files a report, it does not console anyone: a loss is
// graded by how far the unit got, and a unit whose purge record was excellent is reported as a threat that has been
// used up. The purge verdict below the heading still decides what happens to a unit that came back, so the win copy
// never promises its fate.
export const RESULT_EYEBROWS=Object.freeze({abandoned:'MISSION ABANDONED',won:'PURGE COMPLETE',dead:'UNIT EXPENDED'});
export const WIN_COPY=Object.freeze({title:t('winCopy.title'),body:t('winCopy.body')});
export const ABANDON_COPY=Object.freeze({title:t('abandonCopy.title'),body:t('abandonCopy.body')});
// Endless depth bands, and the share of a finite mission's depth that counts as "partly complete".
export const RESULT_TUNING=Object.freeze({endlessDeep:13,endlessMid:7,partialShare:2/3});

export function lossCopy(g){
  // An empty ledger reads as a perfect rate, so a unit that never met its quota is not graded as a threat.
  const review=purgeReview(g),excellent=Boolean(review&&review.quota>0&&review.tier==='excellent');
  if(isEndless(g)){
    const n=g.floor;
    if(n>=RESULT_TUNING.endlessDeep||excellent)return {title:`\u9ad8\u5a01\u8105\u500b\u9ad4\u5df2\u65bc\u7b2c ${n} \u5c64\u6d88\u8017\u3002`,body:'\u6df1\u5ea6\u7d00\u9304\u5df2\u66f4\u65b0\u3002\u7d50\u679c\u7b26\u5408\u5354\u5b9a\u3002'};
    if(n>=RESULT_TUNING.endlessMid)return {title:`\u8ffd\u8e64\u65bc\u7b2c ${n} \u5c64\u7d42\u6b62\u3002`,body:'\u706b\u7a2e\u8a0a\u865f\u4ecd\u5728\u66f4\u6df1\u8655\u3002\u5df2\u767b\u9304\u5230\u9054\u6df1\u5ea6\u3002'};
    return {title:`\u8a0a\u865f\u65bc\u7b2c ${n} \u5c64\u4e2d\u65b7\u3002`,body:'\u5df2\u767b\u9304\u5230\u9054\u6df1\u5ea6\u3002'};
  }
  if(excellent)return {title:'\u9ad8\u5a01\u8105\u500b\u9ad4\u5df2\u6d88\u8017\u3002',body:'\u8a72\u55ae\u4f4d\u6230\u9b25\u8868\u73fe\u8d85\u51fa\u9810\u671f\uff0c\u65bc\u5931\u63a7\u524d\u5b8c\u6210\u6d88\u8017\u3002\u7d50\u679c\u7b26\u5408\u5354\u5b9a\u3002'};
  // Measured against the mission's own depth, so a three-floor round trip is graded like a six-floor descent.
  const deepest=g.deepestFloor||g.floor,depth=missionDepth(g);
  if(deepest>=Math.max(2,Math.ceil(depth*RESULT_TUNING.partialShare)))return {title:'\u4efb\u52d9\u90e8\u5206\u5b8c\u6210\u3002',body:'\u8a2d\u65bd\u9632\u79a6\u5df2\u88ab\u524a\u5f31\uff0c\u6230\u679c\u5df2\u767b\u9304\u3002'};
  if(deepest>=2)return {title:'\u63a8\u9032\u4e2d\u65b7\u3002',body:'\u8a2d\u65bd\u5916\u570d\u5df2\u53d7\u640d\uff0c\u5269\u9918\u5340\u57df\u79fb\u4ea4\u5f8c\u7e8c\u55ae\u4f4d\u3002'};
  return {title:'\u640d\u8017\u5728\u9810\u671f\u7bc4\u570d\u5167\u3002',body:'\u672a\u53d6\u5f97\u6709\u6548\u6230\u679c\u3002'};
}

export function resultCopy(g){
  const status=g.status==='abandoned'?'abandoned':g.status==='won'?'won':'dead';
  const copy=status==='abandoned'?ABANDON_COPY:status==='won'?WIN_COPY:lossCopy(g);
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
