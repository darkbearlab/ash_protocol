// Old unfinished runs (3.210.0, user rule 2026-10-01; docs/CHECKLIST.md section 3). While the game changes fast, a run
// saved by a version below RUN_SAVE_FLOOR is not migrated or continued: on load it is settled exactly like 放棄任務
// (status 'abandoned', settleRun below — the same settlement src/storage.js abandonRun records), the player is told it
// was the update, and the raw save is kept in a backup key (src/storage.js). The profile itself is never touched beyond
// that settlement. A save that cannot be read at all is still settled, as abandoned with nothing credited.
// Settling needs no storage, so a full backup (src/backup.js) settles its own campaign the same way.
import {grantUnlock as prepareUnlock} from './unlock-catalog.js';
import {deepestFloor} from './missions.js';
import {creditProtocol,recordEndless} from './progression.js';
import {Game} from './game.js';
import {RUN_SAVE_FLOOR} from './data.js';

const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
// The run a raw save holds, when it is one this version no longer continues: {version, runId} (runId null when unreadable).
export function staleRunOf(raw){
 let save;try{save=typeof raw==='string'?JSON.parse(raw):raw;}catch{return null;}
 if(!save||typeof save!=='object'||!Number.isInteger(save.version)||save.version>=RUN_SAVE_FLOOR||save.data?.status!=='playing')return null;
 return {version:save.version,runId:safeId(save.data?.runId)?save.data.runId:null};
}
// The result of a finished (won, dead, abandoned) run written into profile `p`, once per run (the runId ledger). Moved
// here unchanged from src/storage.js resultProfile so a backup can settle a run too.
export function settleRun(p,game){
 creditProtocol(p,game);const id=game.runId;
 if(!Object.hasOwn(p.protocolRuns,id))return p;
 if(p.protocolRuns[id].recorded)return p;
 if(game.status==='won'&&game.mission.id!=='endless')for(const story of game.pendingStories||[]){const next=prepareUnlock(p,story,'extraction');if(next)Object.assign(p,next);}
 p.protocolRuns[id].recorded=true;p.runs++;p.wins+=Number(game.status==='won');
 if(game.mission.id!=='endless')p.bestFloor=Math.min(6,Math.max(p.bestFloor,deepestFloor(game)));recordEndless(p,game);p.bestKills=Math.max(p.bestKills,game.player.kills);
 p.history.unshift({id,mapGenerations:[...(game.mapGenerations||[game.generation?.version||1])],mission:game.mission.id,portrait:game.player.portrait,character:game.player.character,seed:game.seed,floor:deepestFloor(game),level:game.player.level,kills:game.player.kills,turn:game.turn,won:game.status==='won',outcome:game.status,realMode:game.realMode===true,protocol:game.protocol.earned+(p.protocolRuns[id].realBonus||0),protocolBonus:p.protocolRuns[id].realBonus||0,date:new Date().toISOString()});
 p.history=p.history.slice(0,10);return p;
}
// Settles a stale run into `p` as abandoned. The old save is read with the old rules' loader (Game.restore keeps every
// earlier version) only to count it; when that fails the run is closed in the ledger with no credit and no history line.
// Returns {profile, rewarded}; settling twice changes nothing (the ledger's `recorded`).
// Review fixes (3.210.0): the run never earns more than its ledger line already holds — play credits every point as it
// is earned, and a full backup's campaign could claim anything (src/backup.js checks a current campaign the same way);
// a save from before run ids (data.runId missing) is settled under the id the loader gives it (`legacy-<seed>`).
export function settleStaleRun(p,raw){
 const stale=staleRunOf(raw);if(!stale)return {profile:p,rewarded:false};
 let game=null;try{game=Game.restore(typeof raw==='string'?raw:JSON.stringify(raw));}catch{game=null;}
 if(game&&(stale.runId===null||game.runId===stale.runId)&&safeId(game.runId)){
  const credited=Number.isSafeInteger(p.protocolRuns[game.runId]?.earned)?p.protocolRuns[game.runId].earned:0;
  game.protocol={...game.protocol,earned:Math.min(Number.isSafeInteger(game.protocol?.earned)?game.protocol.earned:0,credited)};
  return {profile:settleRun(p,{...game,status:'abandoned'}),rewarded:true};
 }
 const id=stale.runId;
 if(id&&!p.protocolRuns[id]?.recorded){p.protocolRuns[id]={earned:Number.isSafeInteger(p.protocolRuns[id]?.earned)?p.protocolRuns[id].earned:0,recorded:true};p.runs++;}
 return {profile:p,rewarded:false};
}
