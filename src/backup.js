import {t} from './i18n.js';
import {CHARACTER_IDS,STARTING_CHARACTERS,validStoryId} from './unlock-catalog.js';
import {isSimulation} from './killhouse-policy.js';
import {validKillhouseProfile} from './killhouse-profile.js';
import {validGenerationHistory} from './map-geometry.js';
import {ENDLESS_MAX_FLOOR} from './endless.js';
import {validMissionId} from './missions.js';
import {validPortrait} from './portraits.js';
import {validCharacter} from './characters.js';
import {CARRY_COSTS,validCarryLevels,carryingSpent} from './ammunition.js';
import {Game} from './game.js';
import {normalizeProfile,creditProtocol,PROFILE_VERSION} from './progression.js';
import {SIZE,SUPPLY_NAMES} from './data.js';

export const BACKUP_LIMIT=5_000_000;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};

export function validateProfile(raw){
  requireValue(object(raw)&&Number.isInteger(raw.version)&&raw.version>=2&&raw.version<=PROFILE_VERSION,t('backup.profileVersion'));
  requireValue(['runs','wins','bestKills','bestFloor'].every(k=>count(raw[k]))&&raw.wins<=raw.runs&&raw.bestFloor>=1&&raw.bestFloor<=6,t('backup.missionCount'));
  requireValue(object(raw.protocol)&&count(raw.protocol.balance)&&count(raw.protocol.earned)&&raw.protocol.balance<=raw.protocol.earned,t('backup.protocolValue'));
  if(raw.version===3){requireValue(object(raw.upgrades)&&count(raw.upgrades.carrying)&&raw.upgrades.carrying<=CARRY_COSTS.length,t('backup.carryData'));requireValue(raw.protocol.earned-raw.protocol.balance>=CARRY_COSTS.slice(0,raw.upgrades.carrying).reduce((a,b)=>a+b,0),t('backup.carrySpend'));}
  if(raw.version>=4&&raw.version<7){requireValue(object(raw.upgrades)&&validCarryLevels(raw.upgrades.carrying),t('backup.carryAmmo'));requireValue(raw.protocol.earned-raw.protocol.balance>=Object.values(raw.upgrades.carrying).reduce((sum,n)=>sum+carryingSpent(n),0),t('backup.carrySpend'));}
  requireValue(object(raw.unlocks)&&['weapons','characters'].every(k=>Array.isArray(raw.unlocks[k])&&raw.unlocks[k].every(id)),t('backup.unlocks'));
  if(raw.version>=7)requireValue(STARTING_CHARACTERS.every(id=>raw.unlocks.characters.includes(id))&&raw.unlocks.characters.every(id=>CHARACTER_IDS.includes(id))&&new Set(raw.unlocks.characters).size===raw.unlocks.characters.length&&Array.isArray(raw.unlocks.stories)&&raw.unlocks.stories.every(validStoryId)&&new Set(raw.unlocks.stories).size===raw.unlocks.stories.length&&validCarryLevels(raw.upgrades?.carrying)&&Object.values(raw.upgrades.carrying).every(n=>n===0),t('backup.retiredCarry'));
  if(raw.unlockLedger!==undefined)requireValue(object(raw.unlockLedger)&&['characters','stories'].every(k=>Array.isArray(raw.unlockLedger[k])&&raw.unlockLedger[k].every(id)),t('backup.unlocks'));
  requireValue(object(raw.protocolRuns),t('backup.grantsMissing'));
  let total=0;
  // The real-mode bonus is only bounded by the base it came from, so retuning the percentage never invalidates old backups (3.76.1).
  for(const [key,value]of Object.entries(raw.protocolRuns)){
    requireValue(id(key)&&object(value)&&count(value.earned)&&typeof value.recorded==='boolean'&&(value.realBonus===undefined||count(value.realBonus)&&value.realBonus<=value.earned),t('backup.grantsInvalid'));total+=value.earned+(value.realBonus||0);
  }
  requireValue(Number.isSafeInteger(total)&&total<=raw.protocol.earned,t('backup.grantsMismatch'));
  requireValue(Array.isArray(raw.history)&&raw.history.length<=10&&raw.history.every(r=>object(r)&&id(r.id)&&['seed','floor','kills','turn'].every(k=>count(r[k]))&&(r.mapGenerations===undefined||validGenerationHistory(r.mapGenerations))&&r.floor>=1&&r.floor<=(r.mission==='endless'?ENDLESS_MAX_FLOOR:6)&&(r.level===undefined||count(r.level)&&r.level>=1)&&(r.mission!=='endless'||r.won===false)&&r.turn>=1&&typeof r.won==='boolean'&&(r.outcome===undefined||['won','dead','abandoned'].includes(r.outcome))&&(r.mission===undefined||validMissionId(r.mission))&&(r.character===undefined||validCharacter(r.character))&&(r.portrait===undefined||validPortrait(r.portrait))&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))&&(r.protocol===undefined||count(r.protocol))&&(r.realMode===undefined||typeof r.realMode==='boolean')&&(r.protocolBonus===undefined||count(r.protocolBonus)&&r.protocolBonus<=(r.protocol||0)&&(!r.protocolBonus||r.realMode===true))),t('backup.recent'));
  if(raw.version>=5){
    const record=r=>r===null||object(r)&&Object.keys(r).length===3&&count(r.floor)&&r.floor>=1&&r.floor<=ENDLESS_MAX_FLOOR&&count(r.level)&&r.level>=1&&count(r.kills);
    requireValue(object(raw.endless)&&record(raw.endless.best)&&object(raw.endless.byCharacter)&&Object.entries(raw.endless.byCharacter).every(([id,r])=>validCharacter(id)&&r!==null&&record(r)),t('backup.endless'));
    requireValue(Object.values(raw.endless.byCharacter).every(r=>raw.endless.best&&r.floor<=raw.endless.best.floor),t('backup.endlessMismatch'));
  }
  if(raw.version>=6)requireValue(validKillhouseProfile(raw.killhouse),t('backup.killhouse'));
  return normalizeProfile(JSON.parse(JSON.stringify(raw)));
}

export function makeBackup(game,records,namespace){
  if(isSimulation(game))throw Error(t('backup.useExport'));
  const p=normalizeProfile(JSON.parse(JSON.stringify(records)));if(game)creditProtocol(p,game);
  const backup={format:'ash-protocol-backup',version:1,namespace,createdAt:new Date().toISOString(),profile:p,campaign:game?.status==='playing'?JSON.parse(game.serialize()):null};
  // Validate exports too: never present an unusable snapshot as a successful backup.
  return decodeBackup(JSON.stringify(backup),namespace).snapshot;
}

export function decodeBackup(raw,namespace){
  requireValue(typeof raw==='string'&&raw.length<=BACKUP_LIMIT,t('backup.tooLarge'));
  let b;try{b=JSON.parse(raw);}catch{throw new Error(t('backup.notJson'));}
  requireValue(object(b)&&b.format==='ash-protocol-backup'&&b.version===1,t('backup.notFull'));
  requireValue(b.namespace===namespace,t('backup.wrongMode'));
  requireValue(typeof b.createdAt==='string'&&Number.isFinite(Date.parse(b.createdAt)),t('backup.badDate'));
  const p=validateProfile(b.profile);let game=null;
  if(b.campaign!==null){
    requireValue(object(b.campaign),t('backup.missionData'));game=Game.restore(JSON.stringify(b.campaign));
    requireValue(game,t('backup.missionSave'));
    game.setCarryLevel(p.upgrades.carrying);
    const player=game.player;
    requireValue(['hp','maxHp','meds','sprays','adrenaline','barricades','flares','grenades','smoke','emp','stun','armor','bonus','blastBonus','healBonus','hazmat','scavenger','scrap','level','xp','kills','reserve','pistol','shell','energy','ordnance','poison'].every(k=>count(player[k]))&&Object.values(player.stats).every(count)&&count(game.pendingPerks),t('backup.missionCharacter'));
    const position=o=>object(o)&&Number.isInteger(o.x)&&Number.isInteger(o.y)&&o.x>=0&&o.y>=0&&o.x<SIZE&&o.y<SIZE;
    requireValue(position(game.end)&&Array.isArray(game.rooms)&&game.items.every(o=>position(o)&&Object.hasOwn(SUPPLY_NAMES,o.type)&&(o.type!=='weapon'||game.player.weaponBases[o.slot]===o.weapon))&&game.props.every(o=>position(o)&&['cover','barrel','terminal','container','module','nest'].includes(o.type))&&game.enemies.every(position),t('backup.missionMap'));
    requireValue((p.protocolRuns[game.runId]?.earned||0)>=game.protocol.earned,t('backup.missionGrants'));
  }
  return {snapshot:{format:b.format,version:1,namespace,createdAt:b.createdAt,profile:p,campaign:game?JSON.parse(game.serialize()):null},game};
}
