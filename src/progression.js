import {carryLevels,carryingSpent} from './ammunition.js';
// Stable IDs for weapon-pool / character unlocks and permanent equipment upgrades.
export const PROTOCOL_REWARDS={floor:4,lore:3,warden:8,boss:12,extraction:16};
export const newRunId=()=>globalThis.crypto?.randomUUID?.()||`run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const weaponUnlocked=(weapon,ids=[])=>!weapon.unlockId||ids.includes(weapon.unlockId);
const integer=n=>Number.isSafeInteger(n)&&n>=0?n:0;
export function normalizeProfile(raw={}) {
  const p=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const balance=integer(p.protocol?.balance),earned=integer(p.protocol?.earned);
  const refund=p.version===3?Math.min(carryingSpent(p.upgrades?.carrying),Math.max(0,earned-balance)):0;
  return {...p,version:4,upgrades:{carrying:carryLevels(p.version===4&&typeof p.upgrades?.carrying==='object'?p.upgrades.carrying:0)},runs:integer(p.runs),wins:integer(p.wins),bestFloor:Math.max(1,integer(p.bestFloor)),bestKills:integer(p.bestKills),
    history:Array.isArray(p.history)?p.history:[],protocol:{balance:balance+refund,earned},
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
