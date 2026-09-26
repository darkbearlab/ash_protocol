// Run logs (3.186.0, user request): every campaign run is recorded as an operation log (src/replay.js, docs/TEXT_PLAY.md)
// and kept beside the save, so the results screen can hand over the mode, the seed and every step, and the run can be
// played back exactly.
// - One log per run and per game version. A run resumed on another version, or whose save no longer matches the log's
//   last step (a save imported or restored, a test-mode replay taken over), starts a new log from where it stands and
//   says from which turn (`partial`).
// - The log never decides whether saving works: a write that fails drops the log and leaves the save alone.
// - The controller does not record simulations or test-mode replays; the log of a finished run stays until the next run.
import {createReplay,recordReplay,stateHash,validReplay} from './replay.js';
import {readExtra,writeExtra,removeExtra} from './storage.js';
import {VERSION} from './version.js';

export const RUN_LOG_KEY='ash-run-log';
let current=null,lost=null;   // current: {game,log,flush}; lost: the runId whose log could not be kept

const lastHash=log=>log.ops.length?log.ops.at(-1).h:log.startHash;
export const runParams=g=>({seed:g.seed,mission:g.mission.id,character:g.player.character,difficulty:g.difficulty,realMode:g.realMode===true,faction:g.facilityFaction});
export function storedRunLog(){try{const log=JSON.parse(readExtra(RUN_LOG_KEY)||'null');return log&&!validReplay(log)?log:null;}catch{return null;}}
const continues=(log,g)=>Boolean(log)&&log.runId===g.runId&&log.build===VERSION&&!log.result&&lastHash(log)===stateHash(g);

function keep(){
 if(writeExtra(RUN_LOG_KEY,JSON.stringify(current.log)))return true;
 lost=current.game.runId;removeExtra(RUN_LOG_KEY);current=null;return false;
}
// Start recording this game, or pick its stored log up again. Calling it again for the same game does nothing.
export function trackRun(g){
 if(current?.game===g)return current.log;
 if(lost===g.runId)return null;
 const stored=storedRunLog(),log=continues(stored,g)?stored:{...createReplay(g,runParams(g)).log,runId:g.runId,partial:g.turn>1?g.turn:false};
 current={game:g,log,...recordReplay(g,log)};keep();return current?.log??null;
}
// After each save: the target change the log has not seen yet, and the result once the run is over.
export function persistRunLog(g){
 if(current?.game!==g)return false;
 current.flush();
 if(g.status!=='playing')current.log.result={status:g.status,floor:g.floor,deepest:g.deepestFloor||g.floor,turn:g.turn};
 return keep();
}
// The log for this run, recorded now or kept from earlier (the results screen, and settings after the run).
export function runLogFor(g){
 if(current?.game===g){current.flush();return current.log;}
 const stored=storedRunLog();return g?.runId&&stored?.runId===g.runId?stored:null;
}
export const lastRunLog=g=>runLogFor(g)||storedRunLog();
// 3.197.0 (freeze audit): an unexpected error is noted in the log being recorded (the last few, cut short), so a tester's
// report carries it. Replay ignores the field.
export function noteRunError(message){
 if(!current)return false;
 current.log.errors=[...(current.log.errors||[]).slice(-4),{turn:current.game.turn,message:String(message).slice(0,400)}];return keep();
}
export const runLogName=log=>`ash-run-${log.params?.seed??'x'}-${log.result?.status||'playing'}-${log.build}.json`;
