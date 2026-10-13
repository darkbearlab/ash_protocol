// Ranked daily, the browser side (3.224.0, docs/LEADERBOARD.md): the leaderboard server, the day's ticket, the run in
// play and the queue of finished runs waiting to be sent.
// - A ticket (with the day's spec) is fetched when the player opens 排名每日 and spent when the run starts; the run in
//   play is kept under RANKED_RUN_KEY (src/storage.js) until it ends.
// - A finished run's log is compressed into the queue at once, so a new run (which starts a new log) or a closed tab
//   loses nothing. The queue is sent when a run ends, when the game loads and when the browser comes back online.
// - What the server said about each run (the last few) is kept for the result screen.
import {language,t} from './i18n.js';
import {VERSION} from './version.js';
import {RANKED_RUN_KEY,TEST_MODE,profile,rankedRun,readExtra,removeExtra,storage,write,writeExtra} from './storage.js';
import {availableCharacters} from './unlock-catalog.js';
import {createRankedDailyGame,rankedSpecProblem} from './ranked-daily.js';
import {nextDuty,validDuty} from './duty.js';
import {storedRunLog} from './run-log.js';
import {newRankedKey,validRankedKey,validRankedProfile} from './ranked-profile.js';

export const SCORES_URL='https://ash-scores.darkbearlab.workers.dev';
export const LOCAL_SCORES_URL='http://localhost:8787';
export const RANKED_VARIANT='standard';
export const RANKED_QUEUE_KEY='ash-ranked-queue',RANKED_VERDICTS_KEY='ash-ranked-verdicts';
const QUEUE_LIMIT=5,VERDICT_LIMIT=8,TIMEOUT=20000,DAY=86400000,TAIPEI=8*3600000;
// Test mode (?test=1) talks to a local server (workers/ash-scores: npm run dev) unless ?scores=live; ?scores=off turns
// the leaderboard off anywhere.
export function scoresBase(search=globalThis.location?.search||'',test=TEST_MODE){
 const choice=new URLSearchParams(search).get('scores');
 if(choice==='off')return '';if(choice==='local')return LOCAL_SCORES_URL;if(choice==='live')return SCORES_URL;
 return test?LOCAL_SCORES_URL:SCORES_URL;
}
// Which build sent a run (shown on the board): the itch.io page, GitHub Pages, or anything else.
export const channelOf=(host='')=>/(^|\.)itch\.(zone|io)$/.test(host)?'itch':/(^|\.)github\.io$/.test(host)?'web':'dev';
// The board's day: Taipei time, which the server uses too (user decision 2026-10-13).
export const taipeiDay=(now=Date.now(),back=0)=>new Date(now+TAIPEI-back*DAY).toISOString().slice(0,10);
export async function playerIdOf(key){
 const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(`ash-player|${key}`));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
}
// A log travels gzipped and in base64.
export async function packLog(log){
 const stream=new Blob([JSON.stringify(log)]).stream().pipeThrough(new CompressionStream('gzip'));
 const bytes=new Uint8Array(await new Response(stream).arrayBuffer());let text='';
 for(let i=0;i<bytes.length;i+=0x8000)text+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(text);
}

const rankedError=(code,extra={})=>Object.assign(new Error(code),{code,...extra});
// One request; a failure throws {code, status, reason}: the server's error, or 'network' / 'off'.
async function call(path,{method='GET',body}={}){
 const base=scoresBase();if(!base)throw rankedError('off');
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),TIMEOUT);let response;
 try{response=await fetch(base+path,{method,headers:body?{'content-type':'application/json'}:{},body:body&&JSON.stringify(body),signal:abort.signal,cache:'no-store'});}
 catch{throw rankedError('network');}finally{clearTimeout(timer);}
 let data=null;try{data=await response.json();}catch{}
 if(!response.ok||!data?.ok)throw rankedError(data?.error||'server',{status:response.status,reason:data?.reason});
 return data;
}
export async function fetchTicket(key){
 const d=await call('/v1/daily/tickets',{method:'POST',body:{playerKey:key,variant:RANKED_VARIANT}});
 if(typeof d.ticket!=='string'||rankedSpecProblem(d.spec)||!Number.isFinite(d.submitBy))throw rankedError('server');
 return {ticket:d.ticket,spec:d.spec,endsAt:d.endsAt,submitBy:d.submitBy};
}
export async function fetchBoard({day,version=VERSION,limit=50}={}){
 const key=profile().ranked?.key,player=validRankedKey(key)?await playerIdOf(key).catch(()=>null):null;
 const query=new URLSearchParams({variant:RANKED_VARIANT,version,limit:String(limit),...(day?{day}:{}),...(player?{player}:{})});
 return call(`/v1/daily/leaderboard?${query}`);
}
export const fetchBoards=day=>call(`/v1/daily/boards?${new URLSearchParams({variant:RANKED_VARIANT,...(day?{day}:{})})}`);

// The leaderboard identity: the key is made once and kept; the name can change.
export function saveRankedName(name){
 if(storage.recoveryPending)return false;
 const p=profile(),ranked={key:validRankedKey(p.ranked?.key)?p.ranked.key:newRankedKey(),name};
 if(!validRankedProfile(ranked))return false;
 p.ranked=ranked;return write('ash-profile',JSON.stringify(p))?ranked:false;
}
// The ranked run starts like any campaign (the officer on duty rotates) but from the ticket's spec; the controller
// records its log with rankedParams.
export function startRankedCampaign({ticket,spec,submitBy},{character,portrait,duty}={}){
 const p=profile();if(!availableCharacters(p).includes(character))throw Error(t('storage.classLocked'));
 const rota=nextDuty(p.duty),game=createRankedDailyGame(spec,{character,portrait,duty:validDuty(duty)?duty:rota.duty});
 if(!writeExtra(RANKED_RUN_KEY,JSON.stringify({runId:game.runId,ticket,spec,submitBy,language:language(),startedAt:Date.now()})))throw Error(t('ranked.storageFailed'));
 storage.droppedRun=null;
 if(!storage.recoveryPending){p.duty=rota.record;write('ash-profile',JSON.stringify(p));}
 return game;
}

const readList=(key,fallback)=>{try{const v=JSON.parse(readExtra(key)||'null');return v&&typeof v==='object'?v:fallback;}catch{return fallback;}};
export const rankedQueue=()=>{const q=readList(RANKED_QUEUE_KEY,[]);return Array.isArray(q)?q:[];};
const saveQueue=q=>q.length?writeExtra(RANKED_QUEUE_KEY,JSON.stringify(q)):(removeExtra(RANKED_QUEUE_KEY),true);
export const rankedVerdicts=()=>readList(RANKED_VERDICTS_KEY,{});
function noteVerdict(runId,verdict){
 const kept=Object.entries(rankedVerdicts()).filter(([id])=>id!==runId).sort((a,b)=>(a[1].at||0)-(b[1].at||0)).slice(-(VERDICT_LIMIT-1));
 writeExtra(RANKED_VERDICTS_KEY,JSON.stringify(Object.fromEntries([...kept,[runId,{...verdict,at:Date.now()}]])));
}
// What the result screen says about a run: null when it was not a ranked run.
export function rankedStatus(g){
 if(!g?.runId)return null;
 const v=rankedVerdicts()[g.runId];if(v)return v;
 return rankedRun()?.runId===g.runId?{state:g.status==='playing'?'playing':'settling'}:null;
}

// The ranked run has ended: its log goes into the queue, or the reason it cannot is noted. Returns whether anything
// changed; calling it again is safe.
let settling=false;
export async function settleRankedRun(game){
 const run=rankedRun();if(!run||settling)return false;
 const log=storedRunLog(),mine=log?.runId===run.runId;
 if(mine&&!log.result)return false;                                                  // still being played
 if(!mine&&game?.runId===run.runId&&game.status==='playing')return false;            // its log was lost; it ends unranked
 settling=true;
 try{
  let verdict;
  if(!mine||log.partial||!log.params?.ranked)verdict={state:'nolog'};
  else if(log.result.status!=='won'&&log.result.status!=='dead')verdict={state:'abandoned'};
  else{
   let packed=null;try{packed=await packLog(log);}catch{}
   const entry=packed&&{runId:run.runId,ticket:run.ticket,day:run.spec?.day,submitBy:run.submitBy,language:run.language,version:log.build,log:packed};
   verdict=!entry?{state:'unsupported'}:saveQueue([...rankedQueue().filter(e=>e.runId!==run.runId),entry].slice(-QUEUE_LIMIT))?{state:'queued'}:{state:'nolog'};
  }
  noteVerdict(run.runId,{...verdict,day:run.spec?.day});removeExtra(RANKED_RUN_KEY);return true;
 }finally{settling=false;}
}
// Sends the queue, oldest first. Resolves to {sent, retryIn}: retryIn (ms) when the server asked to wait.
let flushing=null;
export function flushRanked(host=globalThis.location?.hostname){if(!flushing)flushing=sendQueue(host).finally(()=>{flushing=null;});return flushing;}
async function sendQueue(host){
 const me=profile().ranked;let sent=0;
 if(!validRankedProfile(me))return {sent,retryIn:0};
 for(const entry of rankedQueue()){
  const drop=verdict=>{saveQueue(rankedQueue().filter(e=>e.runId!==entry.runId));noteVerdict(entry.runId,{...verdict,day:entry.day});sent++;};
  if(Date.now()>entry.submitBy){drop({state:'expired'});continue;}
  try{
   const d=await call('/v1/daily/runs',{method:'POST',body:{ticket:entry.ticket,playerKey:me.key,name:me.name,version:entry.version,channel:channelOf(host),language:entry.language,log:entry.log}});
   drop({state:'sent',rank:d.best?.rank??null,newBest:Boolean(d.newBest),version:d.board?.version,result:d.result});
  }catch(error){
   if(error.code==='rate')return {sent,retryIn:31000};
   // Kept for later: no connection, a server fault, or a server not yet updated for this version (until submitBy).
   if(['network','off','server','not-configured','version'].includes(error.code)||error.status>=500)return {sent,retryIn:0};
   // ticket-used: an earlier send got through and its answer was lost.
   drop(error.code==='ticket-used'?{state:'sent',rank:null}:error.code==='closed'?{state:'expired'}:{state:'rejected',reason:error.reason||error.code});
  }
 }
 return {sent,retryIn:0};
}
