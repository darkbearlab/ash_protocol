import {deepestFloor} from './missions.js';
import {AMMUNITION,CARRY_COSTS,carryLevels,carryingSpent} from './ammunition.js';
import {Game} from './engine.js';
import {normalizeProfile,creditProtocol} from './progression.js';
import {makeBackup,decodeBackup} from './backup.js';
export const storage={available:true,recoveryPending:false};
// Browser QA uses a separate namespace, never the user's campaign.
export const TEST_MODE=typeof location!=='undefined'&&new URLSearchParams(location.search).get('test')==='1';
const storageKey=key=>TEST_MODE?`qa-${key}`:key;
export const backupNamespace=TEST_MODE?'qa':'live';
export function read(key){try{return localStorage.getItem(storageKey(key));}catch{storage.available=false;return null;}}
export function write(key,value){try{localStorage.setItem(storageKey(key),value);return true;}catch{storage.available=false;return false;}}
export function loadGame(){
  if(!recoverRestore()){try{return decodeBackup(read('ash-restore-journal'),backupNamespace).game;}catch{return null;}}
  const raw=read('ash-save');if(raw){try{const version=JSON.parse(raw).version;if([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24].includes(version)&&!read(`ash-save-v${version}-backup`))write(`ash-save-v${version}-backup`,raw);}catch{}}const game=Game.restore(raw);if(game)game.setCarryLevel(profile().upgrades.carrying);return game;
}
export function saveGame(game){
  if(storage.recoveryPending)return;
  if(game.status==='playing'){
    write('ash-save',game.serialize());
    const p=profile();if(creditProtocol(p,game)>0)write('ash-profile',JSON.stringify(p));
  }else{
    // Commit rewards and result together before discarding the last playable save.
    recordResult(game);
    if(storage.available)try{localStorage.removeItem(storageKey('ash-save'));}catch{storage.available=false;}
  }
}
export function profile(){try{
  if(storage.recoveryPending)return decodeBackup(read('ash-restore-journal'),backupNamespace).snapshot.profile;
  const raw=read('ash-profile'),previous=JSON.parse(raw),p=normalizeProfile(previous);
  if(previous?.version===3){
    if((read('ash-profile-v3-backup')||write('ash-profile-v3-backup',raw))&&write('ash-profile',JSON.stringify(p)))return p;
    storage.available=false;
  }
  return p;
}catch{return normalizeProfile();}}
function resultProfile(game,p=profile()){if(game.status==='playing'||storage.recoveryPending)return p;
  creditProtocol(p,game);const id=game.runId;
  if(!Object.hasOwn(p.protocolRuns,id))return p;
  if(p.protocolRuns[id].recorded)return p;
  p.protocolRuns[id].recorded=true;p.runs++;p.wins+=Number(game.status==='won');
  p.bestFloor=Math.max(p.bestFloor,deepestFloor(game));p.bestKills=Math.max(p.bestKills,game.player.kills);
  p.history.unshift({id,mission:game.mission.id,portrait:game.player.portrait,character:game.player.character,seed:game.seed,floor:deepestFloor(game),kills:game.player.kills,turn:game.turn,won:game.status==='won',outcome:game.status,protocol:game.protocol.earned,date:new Date().toISOString()});
  p.history=p.history.slice(0,10);return p;
}

export function recordResult(game){const p=resultProfile(game);if(game.status!=='playing'&&!storage.recoveryPending)write('ash-profile',JSON.stringify(p));return p;}

export function purchaseCarrying(game,type,expectedLevel){
  if(storage.recoveryPending||!storage.available)throw new Error('本機儲存尚未就緒，請先備份資料後重試。');
  if(!Object.hasOwn(AMMUNITION,type))throw new Error('請選擇有效的彈種。');
  const p=profile(),level=p.upgrades.carrying[type],cost=CARRY_COSTS[level];
  if(!storage.available)throw new Error('無法讀取協定點數，尚未購買。');
  if(expectedLevel!==level)throw new Error('升級資料已更新，請查看最新價格。');
  if(cost===undefined)throw new Error('攜行裝備已達最高等級。');
  if(p.protocol.balance<cost)throw new Error('協定點數不足。');
  p.protocol.balance-=cost;p.upgrades.carrying[type]++;
  // One atomic localStorage write commits both cost and permanent level.
  if(!write('ash-profile',JSON.stringify(p)))throw new Error('無法儲存升級，尚未扣除點數。');
  if(game)game.setCarryLevel(p.upgrades.carrying);
  return p;
}

// Free placeholder reset: refund exactly what was spent, then re-apply the
// existing capacity path so overflow drops to the ground instead of vanishing.
export function resetCarrying(game){
  if(storage.recoveryPending||!storage.available)throw new Error('本機儲存尚未就緒，請先備份資料後重試。');
  const p=profile(),refund=Object.keys(AMMUNITION).reduce((sum,type)=>sum+carryingSpent(p.upgrades.carrying[type]),0);
  if(!refund)throw new Error('目前沒有可重置的攜行升級。');
  p.protocol.balance+=refund;p.upgrades.carrying=carryLevels(0);
  // One atomic write commits both the refund and the cleared levels.
  if(!write('ash-profile',JSON.stringify(p)))throw new Error('無法儲存重置，尚未退還點數。');
  if(game)game.setCarryLevel(p.upgrades.carrying);
  return refund;
}

export function exportBackup(game){return JSON.stringify(makeBackup(game,profile(),backupNamespace),null,2);}
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
  return restoreBackup(JSON.stringify(makeBackup(null,normalizeProfile(),backupNamespace)),game);
}
export function abandonRun(game){
  if(game.status!=='playing')return false;
  if(storage.recoveryPending||!storage.available)throw new Error('本機儲存尚未就緒，尚未放棄任務。');
  const next=resultProfile({...game,status:'abandoned'});
  restoreBackup(JSON.stringify(makeBackup(null,next,backupNamespace)),game);
  game.status='abandoned';game.pendingPerks=0;game.log('任務已放棄，已賺點數與永久升級保留。');return true;
}
