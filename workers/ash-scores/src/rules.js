// The leaderboard's rules: days, the daily spec, names, the ordering key and the request limits.
import {hmac} from './crypto.js';

// A day runs from 00:00 to 24:00 in Taipei (user, 2026-10-13). Taiwan keeps no daylight saving.
const TAIPEI=8*3600*1000,DAY=86400000;
export const dayKey=(now=Date.now())=>new Date(now+TAIPEI).toISOString().slice(0,10);
export const dayStart=day=>Date.parse(`${day}T00:00:00+08:00`);
export const dayEnd=day=>dayStart(day)+DAY;
export const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(dayStart(day))&&dayKey(dayStart(day))===day;

// Daily variants. 'standard' (user decisions 2026-10-13): the extraction mission, difficulty 普通 ('hard'), real mode,
// a facility and seed drawn from the secret. A new variant is a new entry here; its runs land on their own boards.
export const VARIANTS=Object.freeze({
 standard:Object.freeze({mission:'extraction',difficulty:'hard',facilities:['loyalist','rebel','swarm']}),
});
export const SPEC_FORMAT=1;
// The day's spec, from the secret: nobody can work out tomorrow's seed from today's. The first request of a day stores
// it (src/db.js), so a later change here never rewrites a day that has already been played.
export async function deriveSpec(secret,day,variant){
 const def=VARIANTS[variant];if(!def)throw new Error('variant');
 const b=await hmac(secret,`ash-daily|${SPEC_FORMAT}|${day}|${variant}`);
 const seed=(((b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3])>>>0)%1000000000;
 return {format:SPEC_FORMAT,day,variant,seed,mission:def.mission,facility:def.facilities[b[4]%def.facilities.length],difficulty:def.difficulty,realMode:true};
}

// Three characters, like an arcade high-score table (user, 2026-10-13).
export const normalName=name=>typeof name==='string'?name.trim().toUpperCase():'';
export const validName=name=>/^[A-Z0-9]{3}$/.test(name);
// The player's secret key, made by the game once and kept in its profile; the server keeps only its hash.
export const validPlayerKey=key=>typeof key==='string'&&/^[A-Za-z0-9_-]{22,128}$/.test(key);
export const validPlayerId=id=>typeof id==='string'&&/^[0-9a-f]{32}$/.test(id);
export const validVersion=v=>typeof v==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,4}$/.test(v);
export const CHANNELS=Object.freeze(['itch','web','dev']);
export const LANGUAGES=Object.freeze(['zh-TW','en']);

// Board order (user, 2026-10-13): extracted first, then the deeper floor, then fewer turns, then more kills; an equal
// key goes to the earlier run. One integer keeps the SQL simple; it stays below 2^53.
export function scoreKey({status,deepest,turns,kills}){
 const clamp=(v,max)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));
 return ((((status==='won'?1:0)*100+clamp(deepest,99))*100000+(99999-clamp(turns,99999)))*100000)+clamp(kills,99999);
}

// Request limits: [counter, window seconds, most requests in a window].
export const LIMITS=Object.freeze({
 ipMinute:['ip',60,60],
 ticketsPerDay:['tickets',DAY/1000,30],
 submitBurst:['submit',30,1],
 submitsPerDay:['submits',DAY/1000,20],
});
// Uploads: the gzip'd log and the log once inflated.
export const MAX_LOG_GZ=512*1024,MAX_LOG_JSON=4*1024*1024,MAX_BODY=800*1024;
