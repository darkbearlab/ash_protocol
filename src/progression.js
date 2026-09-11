import {carryLevels,carryingSpent} from './ammunition.js';
import {ENDLESS_MAX_FLOOR} from './endless.js';
import {validCharacter} from './characters.js';
// Stable IDs for weapon-pool / character unlocks and permanent equipment upgrades.
export const PROTOCOL_REWARDS={floor:4,lore:3,warden:8,boss:12,extraction:16};
export const newRunId=()=>globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const weaponUnlocked=(weapon,ids=[])=>!weapon.unlockId||ids.includes(weapon.unlockId);
const integer=n=>Number.isSafeInteger(n)&&n>=0?n:0;
// Profile format. Backups accept every version from 2 up to this one; carrying levels exist from v4 on (3.44).
export const PROFILE_VERSION=5;
function endlessRecords(raw){
  const record=r=>r&&Number.isSafeInteger(r.floor)&&r.floor>=1&&r.floor<=ENDLESS_MAX_FLOOR&&Number.isSafeInteger(r.level)&&r.level>=1&&Number.isSafeInteger(r.kills)&&r.kills>=0?{floor:r.floor,level:r.level,kills:r.kills}:null;
  const best=record(raw?.best),entries=raw?.byCharacter&&typeof raw.byCharacter==='object'?Object.entries(raw.byCharacter):[];
  return {best,byCharacter:Object.fromEntries(entries.filter(([id,r])=>validCharacter(id)&&record(r)&&best&&r.floor<=best.floor).map(([id,r])=>[id,record(r)]))};
}
export function normalizeProfile(raw={}) {
  const p=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const balance=integer(p.protocol?.balance),earned=integer(p.protocol?.earned);
  const refund=p.version===3?Math.min(carryingSpent(p.upgrades?.carrying),Math.max(0,earned-balance)):0;
  return {...p,version:PROFILE_VERSION,upgrades:{carrying:carryLevels(p.version>=4&&typeof p.upgrades?.carrying==='object'?p.upgrades.carrying:0)},runs:integer(p.runs),wins:integer(p.wins),bestFloor:Math.min(6,Math.max(1,integer(p.bestFloor))),bestKills:integer(p.bestKills),
    endless:endlessRecords(p.version>=5?p.endless:null),history:Array.isArray(p.history)?p.history:[],protocol:{balance:balance+refund,earned},
    unlocks:{weapons:Array.isArray(p.unlocks?.weapons)?p.unlocks.weapons.filter(x=>typeof x==='string'):[],characters:Array.isArray(p.unlocks?.characters)?[...new Set(['operator',...p.unlocks.characters.filter(x=>typeof x==='string')])]:['operator']},
    protocolRuns:p.protocolRuns&&typeof p.protocolRuns==='object'&&!Array.isArray(p.protocolRuns)?p.protocolRuns:{}};
}
// Cumulative high-water marks survive history trimming and importing an older save.
// Keep this ledger: removing entries would allow the same run to be credited twice.
export function creditProtocol(p,game) {
  const id=game.runId;if(typeof id!=='string'||!id||['__proto__','constructor','prototype'].includes(id))return 0;
  const previous=(Object.hasOwn(p.protocolRuns,id)?p.protocolRuns[id]:null)||{};
  const earned=integer(game.protocol?.earned),delta=Math.max(0,earned-integer(previous.earned));
  p.protocol.balance+=delta;p.protocol.earned+=delta;
  p.protocolRuns[id]={earned:Math.max(earned,integer(previous.earned)),recorded:previous.recorded===true};
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
