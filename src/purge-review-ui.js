import {purgeReview,cloneDesignation} from './purge-review.js';

// Result screen verdict (user wording, 2026-09-15). No counts or rates are shown; the institution only files the verdict.
export const PURGE_VERDICTS={
  excellent:{status:'列為資產封存',reason:'肅清績效優異',note:'交戰紀錄納入後續訓練教材'},
  adequate:{status:'記憶校正後重新部署',reason:'肅清績效合格'},
  deficient:{status:'已處決',reason:'肅清績效不足'}
};

export function purgeRows(g){
  const unit=cloneDesignation(g.runId);
  if(g.status==='dead')return [['單位',`${unit} 訊號中斷`],['狀態','列入損耗']];
  if(g.status==='abandoned')return [['單位',`${unit} 任務中止`],['狀態','列入損耗']];
  if(g.status!=='won')return [];
  const rows=[['單位',`${unit} 已撤離`],['目標狀態','達成']],review=purgeReview(g);
  if(!review)return rows;
  const v=PURGE_VERDICTS[review.tier];
  return [...rows,['狀態',v.status],['原因',v.reason],...(v.note?[['備註',v.note]]:[])];
}

export function purgeReportMarkup(g){
  const rows=purgeRows(g),verdict=g.status==='won'?purgeReview(g)?.tier||'filed':'loss';
  return rows.length?`<dl class="purge-report" data-verdict="${verdict}">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`:'';
}
