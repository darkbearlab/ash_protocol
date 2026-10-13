// Ranked daily screens (3.224.0, docs/LEADERBOARD.md): the callsign, the connection to the leaderboard, the board and
// the line on the result screen. Markup only; src/controller-deploy.js shows them and src/ranked-client.js talks to the
// server. What the server sends is escaped like any other outside text.
import {t} from './i18n.js';
import {CHARACTERS} from './characters.js';
import {MISSIONS} from './missions.js';
import {factionDef} from './faction-catalog.js';
import {difficultyLabel} from './deploy-ui.js';

const escape=v=>String(v??'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
const footer=(back,next)=>`<div class="modal-footer">${back}${next||''}</div>`;
const button=(action,label,secondary=false,extra='')=>`<button class="modal-button${secondary?' secondary':''}" data-modal="${action}"${extra}>${label}</button>`;

export function rankedNameMarkup(name='',back='deploy'){
 return `<div class="eyebrow">RANKED DAILY / CALLSIGN</div><h2>${t('ranked.name.title')}</h2><p>${t('ranked.name.body')}</p>
<label class="ranked-name"><span class="visually-hidden">${t('ranked.name.title')}</span><input id="ranked-name" value="${escape(name)}" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="AAA"></label>
<p class="term-note">${back==='rankedBoard'?`${t('ranked.name.later')} `:''}${t('ranked.name.privacy')}</p>
${footer(button(back,t('controller.back'),true),button('rankedName',t('ranked.name.save'),false,` data-back="${back}"`))}`;
}
export const rankedConnectingMarkup=()=>`<div class="eyebrow" id="ranked-wait">RANKED DAILY</div><h2>${t('ranked.connecting.title')}</h2><p>${t('ranked.connecting.body')}</p>${footer(button('deploy',t('controller.cancel'),true))}`;
// Why the server could not be reached; `offline` offers the unranked daily instead.
export function rankedErrorText(code){
 if(code==='network')return t('ranked.error.network');
 if(code==='rate')return t('ranked.error.rate');
 if(code==='off')return t('ranked.error.off');
 return t('ranked.error.server',{code:escape(code)});
}
export const rankedFailedMarkup=code=>`<div class="eyebrow">RANKED DAILY / OFFLINE</div><h2>${t('ranked.failed.title')}</h2><p>${rankedErrorText(code)}</p>
<div class="modal-row"><button class="modal-button secondary" data-modal="deployDaily">${t('ranked.failed.offline')}</button></div>
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
// On the result screen of a ranked run; replaced in place when the server answers.
export function rankedResultMarkup(v){
 if(!v||v.state==='playing')return '';
 return `<div class="ranked-result" id="ranked-result" aria-live="polite"><p><b>RANKED DAILY</b> ${resultLine(v)}</p><div class="modal-row"><button class="modal-button secondary" data-modal="rankedBoard">${t('ranked.result.view')}</button></div></div>`;
}

const outcome=r=>r.status==='won'?t('ranked.board.won'):t('ranked.board.dead',{floor:r.deepest});
function rowMarkup(r,mine){
 return `<li class="${mine?'mine':''}"><b>${escape(r.rank)}</b><span class="ranked-callsign">${escape(r.name)}<small>·${escape(r.tag)}</small></span><span>${escape(CHARACTERS[r.character]?.label??r.character)}</span><span>${escape(outcome(r))}</span><span>${escape(r.turns)}</span><span>${escape(r.kills)}</span></li>`;
}
// state: {day, back (0 today, 1 yesterday), version, versions, data (the server's board) | loading | error, name}
export function rankedBoardMarkup({day,back=0,version,versions=[],data=null,loading=false,error=null,name=''}){
 const tab=(n,label)=>`<button data-ranked-day="${n}" aria-pressed="${n===back}"${n===back?' class="active"':''}>${label}</button>`;
 const head=`<li class="ranked-head"><b>#</b><span>${t('ranked.board.callsign')}</span><span>${t('ranked.board.class')}</span><span>${t('ranked.board.result')}</span><span>${t('ranked.board.turns')}</span><span>${t('ranked.board.kills')}</span></li>`;
 const me=data?.me,mine=r=>Boolean(me)&&r.tag===me.tag&&r.rank===me.rank;
 const body=loading?`<p>${t('ranked.board.loading')}</p>`:error?`<p>${rankedErrorText(error)}</p>`:!data?.entries?.length?`<p>${t('ranked.board.empty')}</p>`
  :`<ol class="ranked-board">${head}${data.entries.map(r=>rowMarkup(r,mine(r))).join('')}${me&&!data.entries.some(mine)?rowMarkup(me,true):''}</ol>`;
 const standing=loading||error?'':`<p class="ranked-me">${me?t('ranked.board.me',{rank:escape(me.rank)}):t('ranked.board.notOn')}</p>`;
 const builds=versions.filter(v=>v.version!==version);
 return `<div class="eyebrow">RANKED DAILY / ${escape(day)} / BUILD ${escape(version)}</div><h2>${t('ranked.board.title')}</h2>
<div class="journal-tabs">${tab(0,t('ranked.board.today'))}${tab(1,t('ranked.board.yesterday'))}</div>
${body}${standing}
${builds.length?`<p class="term-note">${t('ranked.board.otherBuilds')} ${builds.map(v=>`<button class="ranked-build" data-ranked-version="${escape(v.version)}" data-ranked-back="${back}">${escape(v.version)} (${escape(v.players)})</button>`).join(' ')}</p>`:''}
<div class="modal-row"><button class="modal-button secondary" data-modal="rankedRename">${t('ranked.board.rename')}${name?` · ${escape(name)}`:''}</button><button class="modal-button secondary" data-modal="deployRanked">${t('ranked.board.play')}</button></div>
${footer(button('rankedBack',t('controller.back'),true))}`;
}
