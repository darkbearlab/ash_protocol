// Ranked daily (leaderboard, user decisions 2026-10-13): the day's operation for every ranked player. The browser and the
// leaderboard server (workers/ash-scores) build it with the same function, so the server can rebuild a submitted run's
// start from the day's spec, play the whole log back and rank what the playback says, never what the client reports.
// - Same conditions for everyone: the server's seed, mission and facility, difficulty 普通 ('hard'), real mode on, and
//   none of the profile's progress (the run unlocks what a fresh profile has; weapons have no unlocks today).
// - The player picks the operative. The portrait, the officer on duty and the run id change nothing in play; they come
//   from the player's own start save.
// - The battle log is part of the state hash, and the text tables resolve when these modules load, so the server loads
//   a separate copy of the engine for each language (workers/ash-scores/scripts/engines.mjs) and plays a log back in
//   the copy of the language it was recorded in.
import {Game} from './game.js';
import {validMissionId} from './missions.js';
import {FACTIONS} from './faction-catalog.js';
import {validCharacter} from './characters.js';
import {shelvedCharacter} from './unlock-catalog.js';
import {validPortrait} from './portraits.js';
import {validDuty,DEFAULT_DUTY} from './duty.js';
import {validCurve} from './endless.js';
import {language} from './i18n.js';
import {applyOp,startReplay,stateHash,validReplay} from './replay.js';
import {VERSION} from './version.js';

export const RANKED_DAILY_FORMAT=1;
export const RANKED_LANGUAGES=Object.freeze(['zh-TW','en']);
export const RANKED_MAX_OPS=20000;

const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const word=v=>typeof v==='string'&&/^[a-z0-9-]{1,24}$/.test(v);
const runIdOk=v=>typeof v==='string'&&/^[\w-]{1,64}$/.test(v);
// The spec the server hands out for one day and one variant. Endless is not a daily.
export function rankedSpecProblem(s){
 if(!s||typeof s!=='object')return 'spec';
 if(s.format!==RANKED_DAILY_FORMAT)return 'format';
 if(!day(s.day))return 'day';
 if(!word(s.variant))return 'variant';
 if(!Number.isSafeInteger(s.seed)||s.seed<0||s.seed>999999999)return 'seed';
 if(!validMissionId(s.mission)||s.mission==='endless')return 'mission';
 if(!FACTIONS[s.facility]?.pickable)return 'facility';
 if(!validCurve(s.difficulty))return 'difficulty';
 if(s.realMode!==true)return 'realMode';
 return '';
}
// The run's own choices, read from a start save (a string, as in a replay log).
export function rankedChoices(start){
 const d=JSON.parse(start)?.data;
 return {character:d?.player?.character,portrait:d?.player?.portrait,duty:d?.duty,runId:d?.runId};
}
export function createRankedDailyGame(spec,{character,portrait,duty,runId}={}){
 const problem=rankedSpecProblem(spec);if(problem)throw new Error(`ranked daily: bad spec (${problem})`);
 if(!validCharacter(character)||shelvedCharacter(character))throw new Error('ranked daily: bad operative');
 if(!validPortrait(portrait))throw new Error('ranked daily: bad portrait');
 const g=new Game(spec.seed,[],0,character,portrait,spec.mission,{facilityFaction:spec.facility,difficulty:spec.difficulty,realMode:true,
  duty:validDuty(duty)?duty:DEFAULT_DUTY,profile:{unlocks:{characters:[character],stories:[],weapons:[]}}});
 if(runId!==undefined){if(!runIdOk(runId))throw new Error('ranked daily: bad run id');g.runId=runId;}
 return g;
}
// The replay log's params for a ranked run (the server checks them against the day's spec).
export const rankedParams=(spec,g)=>({seed:spec.seed,mission:spec.mission,character:g.player.character,difficulty:spec.difficulty,realMode:true,faction:spec.facility,ranked:{day:spec.day,variant:spec.variant,format:RANKED_DAILY_FORMAT}});
// What a finished run is ranked by (workers/ash-scores orders by extraction, deepest floor, fewer turns, more kills).
export const rankedResult=g=>({status:g.status,deepest:g.deepestFloor||g.floor,floor:g.floor,turns:g.turn,kills:g.player.kills||0,character:g.player.character,level:g.player.level||1});

// The server's check of one submitted log. Plays the run back from a start rebuilt from the spec; returns
// {ok:true,result} or {ok:false,reason}. Synchronous: one full six-floor run takes several seconds of CPU. This copy
// of the engine must have loaded in the run's language.
export function verifyRankedRun(spec,log,{language:lang='zh-TW',maxOps=RANKED_MAX_OPS}={}){
 const problem=rankedSpecProblem(spec);if(problem)return {ok:false,reason:`spec:${problem}`};
 if(!RANKED_LANGUAGES.includes(lang))return {ok:false,reason:'language'};
 if(language()!==lang)return {ok:false,reason:'engine-language'};
 if(validReplay(log))return {ok:false,reason:'log'};
 if(log.build!==VERSION)return {ok:false,reason:'version'};
 if(log.partial)return {ok:false,reason:'partial'};
 if(log.ops.length>maxOps)return {ok:false,reason:'too-long'};
 const p=log.params||{};
 if(p.seed!==spec.seed||p.mission!==spec.mission||p.faction!==spec.facility||p.difficulty!==spec.difficulty||p.realMode!==true||p.ranked?.day!==spec.day||p.ranked?.variant!==spec.variant)return {ok:false,reason:'params'};
 try{
  let choices;try{choices=rankedChoices(log.start);}catch{return {ok:false,reason:'start'};}
  if(choices.character!==p.character)return {ok:false,reason:'params'};
  let expected;try{expected=stateHash(startReplay(createRankedDailyGame(spec,choices).serialize()));}catch{return {ok:false,reason:'start'};}
  if(log.startHash!==expected)return {ok:false,reason:'start'};
  const g=startReplay(log.start);
  if(stateHash(g)!==expected)return {ok:false,reason:'start'};
  for(const op of log.ops)applyOp(g,op);
  const last=log.ops.length?log.ops.at(-1).h:log.startHash;
  if(stateHash(g)!==last)return {ok:false,reason:'replay'};
  if(g.status!=='won'&&g.status!=='dead')return {ok:false,reason:'unfinished'};
  return {ok:true,result:rankedResult(g)};
 }catch{return {ok:false,reason:'replay'};}
}
