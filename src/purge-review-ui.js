import {t} from './i18n.js';
import {purgeReview,cloneDesignation} from './purge-review.js';

// Result screen verdict (user wording, 2026-09-15). No counts or rates are shown; the institution only files the verdict.
export const PURGE_VERDICTS={
  excellent:{status:t('purge-review-ui.assetArchive'),reason:t('purge-review-ui.purgeExcellent'),note:t('purge-review-ui.trainingMaterial')},
  adequate:{status:t('purge-review-ui.redeployed'),reason:t('purge-review-ui.purgePass')},
  deficient:{status:t('purge-review-ui.executed'),reason:t('purge-review-ui.purgeFail')}
};

export function purgeRows(g){
  const unit=cloneDesignation(g.runId);
  if(g.status==='dead')return [[t('purge-review-ui.unit'),`${t('purge-review-ui.signalLost',{unit})}`],[t('purge-review-ui.status'),t('purge-review-ui.attrition')]];
  if(g.status==='abandoned')return [[t('purge-review-ui.unit'),`${t('purge-review-ui.aborted',{unit})}`],[t('purge-review-ui.status'),t('purge-review-ui.attrition')]];
  if(g.status==='failed')return [[t('purge-review-ui.unit'),`${t('purge-review-ui.facilityLost',{unit})}`],[t('purge-review-ui.status'),t('purge-review-ui.attrition')]];   // 3.189.0
  if(g.status!=='won')return [];
  const rows=[[t('purge-review-ui.unit'),`${t('purge-review-ui.extracted',{unit})}`],[t('purge-review-ui.objectiveStatus'),t('purge-review-ui.achieved')]],review=purgeReview(g);
  if(!review)return rows;
  const v=PURGE_VERDICTS[review.tier];
  return [...rows,[t('purge-review-ui.status'),v.status],[t('purge-review-ui.reason'),v.reason],...(v.note?[[t('purge-review-ui.remarks'),v.note]]:[])];
}

export function purgeReportMarkup(g){
  const rows=purgeRows(g),verdict=g.status==='won'?purgeReview(g)?.tier||'filed':'loss';
  return rows.length?`<dl class="purge-report" data-verdict="${verdict}">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`:'';
}
