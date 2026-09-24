import {CHARACTER_IDS,validStoryId,STARTING_CHARACTERS} from './unlock-catalog.js';
import {isSimulation} from './killhouse-policy.js';
import {normalizeKillhouse} from './killhouse-profile.js';
import {protocolSettlement,terminalRun} from './real-mode.js';
import {carryLevels,carryingSpent} from './ammunition.js';
import {ENDLESS_MAX_FLOOR} from './endless.js';
import {validCharacter} from './characters.js';
import {validDutyRecord} from './duty.js';
// Stable IDs for weapon-pool / character unlocks and permanent equipment upgrades.
export const PROTOCOL_REWARDS={floor:4,lore:3,warden:8,boss:12,hive_beast:8,hive_matriarch:12,extraction:16};
export const newRunId=()=>globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const weaponUnlocked=(weapon,ids=[])=>!weapon.unlockId||ids.includes(weapon.unlockId);
const integer=n=>Number.isSafeInteger(n)&&n>=0?n:0;
// Profile format. Backups accept every version from 2 up to this one; carrying levels exist from v4 on (3.44).
export const PROFILE_VERSION=7;
function endlessRecords(raw){
  const record=r=>r&&Number.isSafeInteger(r.floor)&&r.floor>=1&&r.floor<=ENDLESS_MAX_FLOOR&&Number.isSafeInteger(r.level)&&r.level>=1&&Number.isSafeInteger(r.kills)&&r.kills>=0?{floor:r.floor,level:r.level,kills:r.kills}:null;
  const best=record(raw?.best),entries=raw?.byCharacter&&typeof raw.byCharacter==='object'?Object.entries(raw.byCharacter):[];
  return {best,byCharacter:Object.fromEntries(entries.filter(([id,r])=>validCharacter(id)&&record(r)&&best&&r.floor<=best.floor).map(([id,r])=>[id,record(r)]))};
}
export function normalizeProfile(raw={}) {
  const p=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const balance=integer(p.protocol?.balance),earned=integer(p.protocol?.earned);
  // Refund at most what the wallet shows was spent, so a damaged profile never ends with balance above earned.
  const spent=p.version===3?carryingSpent(p.upgrades?.carrying):p.version>=4&&p.version<7?Object.values(carryLevels(p.upgrades?.carrying)).reduce((n,v)=>n+carryingSpent(v),0):0,refund=Math.min(spent,Math.max(0,earned-balance));
  // unlockLedger mirrors unlocks at the top level. A 3.89 tab still open after the update rewrites the profile as v6 and
  // rebuilds unlocks without stories, but keeps unknown top-level fields, so the ledger tells that downgrade from a real v6.
  const ledger=p.version<7&&p.unlockLedger&&typeof p.unlockLedger==='object'&&!Array.isArray(p.unlockLedger)?p.unlockLedger:null,owned=p.version>=7?p.unlocks:ledger;
  const characters=[...new Set([...STARTING_CHARACTERS,...(Array.isArray(owned?.characters)?owned.characters:[]).filter(id=>CHARACTER_IDS.includes(id))])],stories=[...new Set((Array.isArray(owned?.stories)?owned.stories:[]).filter(validStoryId))];
  return {...p,version:PROFILE_VERSION,killhouse:normalizeKillhouse(p.version>=6?p.killhouse:null),upgrades:{carrying:carryLevels(0)},runs:integer(p.runs),wins:integer(p.wins),bestFloor:Math.min(6,Math.max(1,integer(p.bestFloor))),bestKills:integer(p.bestKills),
    endless:endlessRecords(p.version>=5?p.endless:null),history:Array.isArray(p.history)?p.history:[],protocol:{balance:balance+refund,earned},
    unlocks:{weapons:Array.isArray(p.unlocks?.weapons)?p.unlocks.weapons.filter(id=>typeof id==='string'):[],characters,stories},unlockLedger:{characters:[...characters],stories:[...stories]},
    protocolRuns:p.protocolRuns&&typeof p.protocolRuns==='object'&&!Array.isArray(p.protocolRuns)?p.protocolRuns:{},
    // 3.169.0: the day and the missions deployed on it, for the comms rota; a damaged record starts the day over.
    duty:validDutyRecord(p.duty)?{date:p.duty.date,count:p.duty.count}:undefined};
}
// Cumulative high-water marks survive history trimming and importing an older save.
// Keep this ledger: removing entries would allow the same run to be credited twice.
export function creditProtocol(p,game) {
  if(isSimulation(game))return 0;
  const id=game.runId;if(typeof id!=='string'||!id||['__proto__','constructor','prototype'].includes(id))return 0;
  const previous=(Object.hasOwn(p.protocolRuns,id)?p.protocolRuns[id]:null)||{};
  const earned=integer(game.protocol?.earned),settled=previous.recorded===true||previous.realBonus!==undefined,bonus=!settled&&terminalRun(game)?protocolSettlement(game).bonus:0,delta=Math.max(0,earned-integer(previous.earned))+bonus;
  p.protocol.balance+=delta;p.protocol.earned+=delta;
  p.protocolRuns[id]={earned:Math.max(earned,integer(previous.earned)),recorded:previous.recorded===true,...(previous.realBonus!==undefined?{realBonus:previous.realBonus}:terminalRun(game)&&game.realMode?{realBonus:bonus}:{})};
  return delta;
}

// Depth wins; level then kills break ties. Abandoning never sets an endless record.
export function recordEndless(p,game){
  if(game.mission?.id!=='endless'||game.status!=='dead')return;
  const record={floor:game.floor,level:game.player.level,kills:game.player.kills};
  const better=old=>!old||record.floor>old.floor||record.floor===old.floor&&(record.level>old.level||record.level===old.level&&record.kills>old.kills);
  if(better(p.endless.best))p.endless.best={...record};
  const id=game.player.character;
  if(better(p.endless.byCharacter[id]))p.endless.byCharacter[id]={...record};
}
