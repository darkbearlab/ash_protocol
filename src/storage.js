import {grantUnlock as prepareUnlock,availableCharacters} from './unlock-catalog.js';
import {bindUnlocks} from './run-unlocks.js';
import {isSimulation} from './killhouse-policy.js';
import {recordTutorial,recordArcade} from './killhouse-profile.js';
import {deepestFloor} from './missions.js';
import {AMMUNITION,CARRY_COSTS,carryLevels,carryingSpent} from './ammunition.js';
import {Game,createKillhouse} from './engine.js';
import {normalizeProfile,creditProtocol,recordEndless,PROFILE_VERSION} from './progression.js';
import {makeBackup,decodeBackup} from './backup.js';
import {LEGACY_SAVE_VERSIONS} from './data.js';
export const storage={available:true,recoveryPending:false};
// Browser QA uses a separate namespace, never the user's campaign.
export const TEST_MODE=typeof location!=='undefined'&&new URLSearchParams(location.search).get('test')==='1';
const storageKey=key=>TEST_MODE?`qa-${key}`:key;
export const backupNamespace=TEST_MODE?'qa':'live';
export function read(key){try{return localStorage.getItem(storageKey(key));}catch{storage.available=false;return null;}}
// A later successful write clears an earlier failure (e.g. space was freed), unless a restore is still pending.
export function write(key,value){try{localStorage.setItem(storageKey(key),value);if(!storage.recoveryPending)storage.available=true;return true;}catch{storage.available=false;return false;}}
export function loadGame(){
  if(!recoverRestore()){try{return decodeBackup(read('ash-restore-journal'),backupNamespace).game;}catch{return null;}}
  const raw=read('ash-save');if(raw){try{const version=JSON.parse(raw).version;if(LEGACY_SAVE_VERSIONS.includes(version)&&!read(`ash-save-v${version}-backup`))write(`ash-save-v${version}-backup`,raw);}catch{}}const game=Game.restore(raw);if(game){game.setCarryLevel(0);connectUnlocks(game);}return game;
}
// Returns whether everything was written, so the UI can warn when progress is not being kept (3.44).
export function saveGame(game){
  if(isSimulation(game))return true; // Volatile session: never touch campaign or protocol ledger.
  if(storage.recoveryPending)return false;
  if(game.status==='playing'){
    let ok=write('ash-save',game.serialize());
    const p=profile();if(creditProtocol(p,game)>0)ok=write('ash-profile',JSON.stringify(p))&&ok;
    return ok;
  }
  // Commit rewards and result together before discarding the last playable save; a failed write keeps the save.
  recordResult(game);
  if(storage.available)try{localStorage.removeItem(storageKey('ash-save'));}catch{storage.available=false;}
  return storage.available;
}
export function profile(){try{
  if(storage.recoveryPending)return decodeBackup(read('ash-restore-journal'),backupNamespace).snapshot.profile;
  const raw=read('ash-profile'),previous=JSON.parse(raw),p=normalizeProfile(previous);
  if(Number.isInteger(previous?.version)&&previous.version<PROFILE_VERSION){
    const backup=`ash-profile-v${previous.version}-backup`;
    if((read(backup)||write(backup,raw))&&write('ash-profile',JSON.stringify(p)))return p;
    storage.available=false;
  }
  return p;
}catch{return normalizeProfile();}}
function resultProfile(game,p=profile()){if(isSimulation(game)||game.status==='playing'||storage.recoveryPending)return p;
  creditProtocol(p,game);const id=game.runId;
  if(!Object.hasOwn(p.protocolRuns,id))return p;
  if(p.protocolRuns[id].recorded)return p;
  if(game.status==='won'&&game.mission.id!=='endless')for(const story of game.pendingStories||[]){const next=prepareUnlock(p,story,'extraction');if(next)Object.assign(p,next);}
  p.protocolRuns[id].recorded=true;p.runs++;p.wins+=Number(game.status==='won');
  if(game.mission.id!=='endless')p.bestFloor=Math.min(6,Math.max(p.bestFloor,deepestFloor(game)));recordEndless(p,game);p.bestKills=Math.max(p.bestKills,game.player.kills);
  p.history.unshift({id,mapGenerations:[...(game.mapGenerations||[game.generation?.version||1])],mission:game.mission.id,portrait:game.player.portrait,character:game.player.character,seed:game.seed,floor:deepestFloor(game),level:game.player.level,kills:game.player.kills,turn:game.turn,won:game.status==='won',outcome:game.status,realMode:game.realMode===true,protocol:game.protocol.earned+(p.protocolRuns[id].realBonus||0),protocolBonus:p.protocolRuns[id].realBonus||0,date:new Date().toISOString()});
  p.history=p.history.slice(0,10);return p;
}

export function recordResult(game){const p=resultProfile(game);if(!isSimulation(game)&&game.status!=='playing'&&!storage.recoveryPending)write('ash-profile',JSON.stringify(p));return p;}

export function grantUnlock(game,id,source='purchase'){
  if(isSimulation(game)||storage.recoveryPending||!storage.available)return false;
  const p=profile();if(!storage.available)return false;
  const next=prepareUnlock(p,id,source);if(!next)return false;
  return write('ash-profile',JSON.stringify(next))?next:false;
}
export function connectUnlocks(game){return bindUnlocks(game,{profile,grant:(id,source)=>grantUnlock(game,id,source)});}
// Removed public operations remain inert for older tools; no purchase/reset path exists.
export function purchaseCarrying(){throw Error('攜行升級已取消。');}
export function resetCarrying(){throw Error('攜行升級已取消。');}

export function exportBackup(game){return JSON.stringify(makeBackup(isSimulation(game)?loadGame():game,profile(),backupNamespace),null,2);}
export function previewBackup(raw){return decodeBackup(raw,backupNamespace);}
function storeSnapshot(snapshot){
  localStorage.setItem(storageKey('ash-profile'),JSON.stringify(snapshot.profile));
  if(snapshot.campaign)localStorage.setItem(storageKey('ash-save'),JSON.stringify(snapshot.campaign));
  else localStorage.removeItem(storageKey('ash-save'));
}
export function recoverRestore(){
  const journal=read('ash-restore-journal');if(!journal){storage.recoveryPending=false;return true;}
  try{const {snapshot}=decodeBackup(journal,backupNamespace);storeSnapshot(snapshot);localStorage.removeItem(storageKey('ash-restore-journal'));storage.recoveryPending=false;return true;}
  catch{storage.available=false;storage.recoveryPending=true;return false;}
}
export function restoreBackup(raw,currentGame){
  if(isSimulation(currentGame))throw Error('請先離開模擬再還原戰役備份。');
  const next=previewBackup(raw); // Validate everything before touching local data.
  if(!recoverRestore())throw new Error('上次還原尚未復原，請先匯出目前資料再重試。');
  const previous=exportBackup(currentGame);
  // A recovery snapshot and journal must both persist before either live key changes.
  if(!write('ash-backup-before-restore',previous)||!write('ash-restore-journal',previous))throw new Error('無法保存還原前備份，原資料尚未變更。');
  try{storeSnapshot(next.snapshot);localStorage.removeItem(storageKey('ash-restore-journal'));storage.available=true;return next;}
  catch{storage.available=false;const recovered=recoverRestore();throw new Error(recovered?'還原寫入失敗，已復原原資料。':'還原中斷；復原紀錄已保留，請重新開啟頁面後重試。');}
}

// Use the same rollback journal as full restore; no localStorage.clear(), no other apps' keys.
export function resetProgress(game){
  if(isSimulation(game))throw Error('模擬中不變更永久進度。');
  return restoreBackup(JSON.stringify(makeBackup(null,normalizeProfile(),backupNamespace)),game);
}
export function abandonRun(game){
  if(isSimulation(game)){if(game.status!=='playing')return false;game.status='abandoned';game.pendingPerks=0;return true;}
  if(game.status!=='playing')return false;
  if(storage.recoveryPending||!storage.available)throw new Error('本機儲存尚未就緒，尚未放棄任務。');
  const next=resultProfile({...game,status:'abandoned'});
  restoreBackup(JSON.stringify(makeBackup(null,next,backupNamespace)),game);
  game.status='abandoned';game.pendingPerks=0;game.log('任務已放棄，已賺點數與永久升級保留。');return true;
}

// UI calls these explicitly after the tutorial choice / arcade score calculation.
export function saveTutorialOutcome(outcome){if(storage.recoveryPending)return false;const p=profile();recordTutorial(p,outcome);return write('ash-profile',JSON.stringify(p));}
export function saveArcadeResult(game,score,formula='v1'){if(!isSimulation(game)||storage.recoveryPending)return false;const p=profile();recordArcade(p,game.simulationResult,score,{scope:game.simulation.options.scoreScope,formula});return write('ash-profile',JSON.stringify(p));}

// User-facing creation gates. Bare Game/createKillhouse remain fixture/engine constructors.
export function startCampaign({seed,character='soldier',portrait='onyx',mission='extraction',options={}}={}){
 const p=profile();if(!availableCharacters(p).includes(character))throw Error('職業尚未解鎖。');
 return connectUnlocks(new Game(seed,p.unlocks.weapons,0,character,portrait,mission,{...options,profile:p}));
}
export function startKillhouse(options={}){
 if(options.mode==='arcade'&&!availableCharacters(profile()).includes(options.character||'soldier'))throw Error('職業尚未解鎖。');
 return createKillhouse(options);
}
