// Ranked daily screens (3.224.0, docs/LEADERBOARD.md): the connection to the leaderboard, the board, and the report on
// the result screen, where the callsign is typed (3.225.0). Markup only; src/controller-deploy.js shows them and src/ranked-client.js talks to the
// server. What the server sends is escaped like any other outside text.
import {t} from './i18n.js';
import {CHARACTERS} from './characters.js';
import {MISSIONS} from './missions.js';
import {factionDef} from './faction-catalog.js';
import {difficultyLabel} from './deploy-ui.js';

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const footer=(back,next)=>`<div class="modal-footer">${back}${next||''}</div>`;
const button=(action,label,secondary=false,extra='')=>`<button class="modal-button${secondary?' secondary':''}" data-modal="${action}"${extra}>${label}</button>`;

// 3.225.0 (user): the offline daily is hidden while ranked daily is the daily; true brings it back to the menu.
export const OFFLINE_DAILY=false;
// The report: the callsign (the last one offered again) and the button that submits it. back: where the screen goes
// after submitting ('result', 'rankedBoard', or 'deployRanked' to carry on into a new run).
const callsignField=name=>`<label class="ranked-name"><span class="visually-hidden">${t('ranked.report.callsign')}</span><input id="ranked-name" value="${escape(name)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="send" placeholder="AAA"></label><p class="term-note">${t('ranked.report.privacy')}</p>`;
const reportButton=(runId,back)=>`<button class="modal-button" data-modal="rankedReport" data-run="${escape(runId)}" data-back="${back}">${t('ranked.report.submit')}</button>`;
const reportOutcome=e=>e.result?.status==='won'?t('ranked.board.won'):t('ranked.board.dead',{floor:e.result?.deepest??1});
// A report left unsent on an earlier run (when 排名每日 opens, or from the board).
export function rankedReportMarkup(entry,name='',back='rankedBoard'){
 const later=back==='rankedBoard'?button('rankedBoard',t('controller.back'),true):button('rankedLater',t('ranked.report.later'),true);
 return `<div class="eyebrow">RANKED DAILY / REPORT</div><h2>${t('ranked.report.title')}</h2>
<p>${t('ranked.report.pending',{day:escape(entry.day),character:escape(CHARACTERS[entry.character]?.label??entry.character),result:escape(reportOutcome(entry))})}</p>
${callsignField(name)}${footer(later,reportButton(entry.runId,back))}`;
}
export const rankedConnectingMarkup=()=>`<div class="eyebrow" id="ranked-wait">RANKED DAILY</div><h2>${t('ranked.connecting.title')}</h2><p>${t('ranked.connecting.body')}</p>${footer(button('deploy',t('controller.cancel'),true))}`;
// Why the server could not be reached (or the identity could not be saved, 'storage').
export function rankedErrorText(code){
 if(code==='storage')return t('ranked.storageFailed');
 if(code==='network')return t('ranked.error.network');
 if(code==='rate')return t('ranked.error.rate');
 if(code==='off')return t('ranked.error.off');
 return t('ranked.error.server',{code:escape(code)});
}
export const rankedFailedMarkup=code=>`<div class="eyebrow">RANKED DAILY / OFFLINE</div><h2>${t('ranked.failed.title')}</h2><p>${rankedErrorText(code)}</p>
${OFFLINE_DAILY?`<div class="modal-row"><button class="modal-button secondary" data-modal="deployDaily">${t('ranked.failed.offline')}</button></div>`:''}
${footer(button('deploy',t('controller.back'),true),button('deployRanked',t('ranked.failed.retry')))}`;
// The fixed conditions, above the operator list.
export function rankedSummary(spec){
 return t('ranked.summary',{day:spec.day,mission:MISSIONS[spec.mission]?.name??spec.mission,facility:factionDef(spec.facility)?.name??spec.facility,difficulty:difficultyLabel(spec.difficulty)});
}

const resultLine=v=>{
 if(v.state==='sent')return v.rank?t(v.newBest?'ranked.result.best':'ranked.result.kept',{rank:v.rank}):t('ranked.result.sent');
 if(v.state==='rejected')return t('ranked.result.rejected',{reason:escape(v.reason)});
 return t({settling:'ranked.result.settling',queued:'ranked.result.queued',expired:'ranked.result.expired',nolog:'ranked.result.nolog',abandoned:'ranked.result.abandoned',unsupported:'ranked.result.unsupported'}[v.state]||'ranked.result.settling');
};
// On the result screen of a ranked run: the report while it is unsent, then what became of it; replaced in place.
export function rankedResultMarkup(v,name=''){
 if(!v||v.state==='playing')return '';
 const report=v.state==='unsent'?`${callsignField(name)}<div class="modal-row">${reportButton(v.runId,'result')}</div>`:'';
 return `<div class="ranked-result" id="ranked-result" aria-live="polite"><p><b>RANKED DAILY</b> ${v.state==='unsent'?t('ranked.result.unsent'):resultLine(v)}</p>${report}<div class="modal-row"><button class="modal-button secondary" data-modal="rankedBoard">${t('ranked.result.view')}</button></div></div>`;
}

const outcome=r=>r.status==='won'?t('ranked.board.won'):t('ranked.board.dead',{floor:r.deepest});
function rowMarkup(r,mine){
 return `<li class="${mine?'mine':''}"><b>${escape(r.rank)}</b><span class="ranked-callsign">${escape(r.name)}<small>·${escape(r.tag)}</small></span><span>${escape(CHARACTERS[r.character]?.label??r.character)}</span><span>${escape(outcome(r))}</span><span>${escape(r.turns)}</span><span>${escape(r.kills)}</span></li>`;
}
// state: {day, back (0 today, 1 yesterday), version, versions, data (the server's board) | loading | error, unsent (reports)}
export function rankedBoardMarkup({day,back=0,version,versions=[],data=null,loading=false,error=null,unsent=0}){
 const tab=(n,label)=>`<button data-ranked-day="${n}" aria-pressed="${n===back}"${n===back?' class="active"':''}>${label}</button>`;
 const head=`<li class="ranked-head"><b>#</b><span>${t('ranked.board.callsign')}</span><span>${t('ranked.board.class')}</span><span>${t('ranked.board.result')}</span><span>${t('ranked.board.turns')}</span><span>${t('ranked.board.kills')}</span></li>`;
 const me=data?.me,mine=r=>Boolean(me)&&r.tag===me.tag&&r.rank===me.rank;
 const body=loading?`<p>${t('ranked.board.loading')}</p>`:error?`<p>${rankedErrorText(error)}</p>`:!data?.entries?.length?`<p>${t('ranked.board.empty')}</p>`
  :`<ol class="ranked-board">${head}${data.entries.map(r=>rowMarkup(r,mine(r))).join('')}${me&&!data.entries.some(mine)?rowMarkup(me,true):''}</ol>`;
 const standing=loading||error?'':`<p class="ranked-me">${me?t('ranked.board.me',{rank:escape(me.rank)}):t('ranked.board.notOn')}</p>`;
 const builds=versions.filter(v=>v.version!==version);
 return `<div class="eyebrow" id="ranked-board-view">RANKED DAILY / ${escape(day)} / BUILD ${escape(version)}</div><h2>${t('ranked.board.title')}</h2>
${unsent?`<p class="ranked-pending">${t('ranked.board.pending',{n:unsent})}</p><div class="modal-row"><button class="modal-button" data-modal="rankedPending">${t('ranked.report.submit')}</button></div>`:''}
<div class="journal-tabs">${tab(0,t('ranked.board.today'))}${tab(1,t('ranked.board.yesterday'))}</div>
${body}${standing}
${builds.length?`<p class="term-note">${t('ranked.board.otherBuilds')} ${builds.map(v=>`<button class="ranked-build" data-ranked-version="${escape(v.version)}" data-ranked-back="${back}">${escape(v.version)} (${escape(v.players)})</button>`).join(' ')}</p>`:''}
<div class="modal-row"><button class="modal-button secondary" data-modal="deployRanked">${t('ranked.board.play')}</button></div>
${footer(button('rankedBack',t('controller.back'),true))}`;
}
