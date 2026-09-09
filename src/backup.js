import {Game} from './game.js';
import {normalizeProfile,creditProtocol} from './progression.js';
import {SIZE,SUPPLY_NAMES} from './data.js';

export const BACKUP_LIMIT=5_000_000;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const requireValue=(ok,message)=>{if(!ok)throw new Error(message);};

export function validateProfile(raw){
  requireValue(object(raw)&&raw.version===2,'全局紀錄版本不相容。');
  requireValue(['runs','wins','bestKills','bestFloor'].every(k=>count(raw[k]))&&raw.wins<=raw.runs&&raw.bestFloor>=1&&raw.bestFloor<=6,'任務紀錄數值無效。');
  requireValue(object(raw.protocol)&&count(raw.protocol.balance)&&count(raw.protocol.earned)&&raw.protocol.balance<=raw.protocol.earned,'協定點數數值無效。');
  requireValue(object(raw.unlocks)&&['weapons','characters'].every(k=>Array.isArray(raw.unlocks[k])&&raw.unlocks[k].every(id)),'解鎖紀錄無效。');
  requireValue(object(raw.protocolRuns),'點數發放紀錄缺漏。');
  let total=0;
  for(const [key,value]of Object.entries(raw.protocolRuns)){
    requireValue(id(key)&&object(value)&&count(value.earned)&&typeof value.recorded==='boolean','點數發放紀錄無效。');total+=value.earned;
  }
  requireValue(Number.isSafeInteger(total)&&total<=raw.protocol.earned,'點數發放紀錄與累計不符。');
  requireValue(Array.isArray(raw.history)&&raw.history.length<=10&&raw.history.every(r=>object(r)&&id(r.id)&&['seed','floor','kills','turn'].every(k=>count(r[k]))&&r.floor>=1&&r.floor<=6&&r.turn>=1&&typeof r.won==='boolean'&&typeof r.date==='string'&&Number.isFinite(Date.parse(r.date))&&(r.protocol===undefined||count(r.protocol))),'最近任務紀錄無效。');
  return normalizeProfile(JSON.parse(JSON.stringify(raw)));
}

export function makeBackup(game,records,namespace){
  const p=normalizeProfile(JSON.parse(JSON.stringify(records)));if(game)creditProtocol(p,game);
  const backup={format:'ash-protocol-backup',version:1,namespace,createdAt:new Date().toISOString(),profile:p,campaign:game?.status==='playing'?JSON.parse(game.serialize()):null};
  // Validate exports too: never present an unusable snapshot as a successful backup.
  return decodeBackup(JSON.stringify(backup),namespace).snapshot;
}

export function decodeBackup(raw,namespace){
  requireValue(typeof raw==='string'&&raw.length<=BACKUP_LIMIT,'備份檔案超過大小限制。');
  let b;try{b=JSON.parse(raw);}catch{throw new Error('無法讀取 JSON 備份。');}
  requireValue(object(b)&&b.format==='ash-protocol-backup'&&b.version===1,'請選擇完整備份；舊單局檔案請使用「匯入任務」。');
  requireValue(b.namespace===namespace,'測試與正式備份分開使用，請在對應頁面還原。');
  requireValue(typeof b.createdAt==='string'&&Number.isFinite(Date.parse(b.createdAt)),'備份日期無效。');
  const p=validateProfile(b.profile);let game=null;
  if(b.campaign!==null){
    requireValue(object(b.campaign),'任務資料無效。');game=Game.restore(JSON.stringify(b.campaign));
    requireValue(game,'任務存檔損壞或版本不相容。');
    const player=game.player;
    requireValue(['hp','maxHp','meds','grenades','armor','bonus','blastBonus','healBonus','hazmat','scavenger','scrap','level','xp','kills','reserve','energy','ordnance','poison'].every(k=>count(player[k]))&&Object.values(player.stats).every(count)&&count(game.pendingPerks),'任務角色數值無效。');
    const position=o=>object(o)&&Number.isInteger(o.x)&&Number.isInteger(o.y)&&o.x>=0&&o.y>=0&&o.x<SIZE&&o.y<SIZE;
    requireValue(position(game.end)&&Array.isArray(game.rooms)&&game.items.every(o=>position(o)&&Object.hasOwn(SUPPLY_NAMES,o.type)&&(o.type!=='weapon'||game.player.ammo[o.weapon]!==undefined))&&game.props.every(o=>position(o)&&['cover','barrel','terminal'].includes(o.type))&&game.enemies.every(position),'任務地圖或物品資料無效。');
    requireValue((p.protocolRuns[game.runId]?.earned||0)>=game.protocol.earned,'備份缺少這次任務的點數發放紀錄。');
  }
  return {snapshot:{format:b.format,version:1,namespace,createdAt:b.createdAt,profile:p,campaign:game?JSON.parse(game.serialize()):null},game};
}
