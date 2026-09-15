import {SIZE} from './data.js';
import {isBossClass} from './enemy-data.js';
import {missionDefinition,missionDepth,missionTarget} from './missions.js';

// Purge review (docs/PURGE_REVIEW.md, user decision 2026-09-15). Each visited floor's generated population is the
// quota: threat-budget spawns plus non-combatants, without bosses, hunt targets, fodder, or anything that arrives
// later. The ledger is narrative only. It never reads RNG and never changes rewards or rules.
export const PURGE_TUNING={excellent:90,adequate:60};
const LETTERS='ABCDEFGHJKLMNPRSTUVWXYZ';
const object=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const living=(g,ids)=>{const set=new Set(ids);return g.enemies.filter(e=>e.hp>0&&set.has(e.id)).length;};

export const purgeQuotaEnemy=(g,e)=>e.hp>0&&!e.expendable&&!e.reinforcement&&!e.horde&&!isBossClass(e)&&!missionTarget(g,e);

// After a fresh floor is generated and its mission targets are placed. Resumed return-trip floors keep their record.
export function registerPurgeFloor(g){
  if(!g.purge)return;
  const ids=g.enemies.filter(e=>purgeQuotaEnemy(g,e)).map(e=>e.id);
  g.purge.floors[String(g.floor)]={quota:ids.length,alive:null,ids};
}

// On every floor change. Only return-trip floors can be entered again, so only they keep their IDs.
export function notePurgeDeparture(g){
  const rec=g.purge?.floors[String(g.floor)];
  if(!rec?.ids)return;
  rec.alive=living(g,rec.ids);
  if(!missionDefinition(g).returnTrip)delete rec.ids;
}

// Rate and turns are both kept so a later score can weight them; the tier uses the rate alone for now.
export function purgeReview(g){
  if(!g.purge)return null;
  let quota=0,alive=0;
  for(const [floor,rec] of Object.entries(g.purge.floors)){
    quota+=rec.quota;
    alive+=Number(floor)===g.floor&&rec.ids?living(g,rec.ids):rec.alive??rec.quota;
  }
  const purged=quota-alive,percent=n=>purged*100>=quota*n;
  return {quota,purged,rate:quota?purged/quota:1,turns:g.turn,tier:percent(PURGE_TUNING.excellent)?'excellent':percent(PURGE_TUNING.adequate)?'adequate':'deficient'};
}

// A throwaway serial per run. Nothing stores or accumulates it.
export function cloneDesignation(runId){
  let h=0x811c9dc5;
  for(const c of String(runId))h=Math.imul(h^c.codePointAt(0),0x01000193)>>>0;
  return `${LETTERS[h%LETTERS.length]}-${String(Math.floor(h/LETTERS.length)%10000).padStart(4,'0')}`;
}

// null marks a run without a usable ledger (saved before it existed, or damaged); such runs end without a verdict.
// A floor without a record is simply not reviewed, so fixtures that move floors directly stay valid.
export function validPurge(purge,g){
  if(purge===null)return true;
  if(!object(purge)||Object.keys(purge).length!==1||!object(purge.floors))return false;
  const depth=missionDepth(g);
  return Object.entries(purge.floors).every(([floor,rec])=>/^[1-9]\d*$/.test(floor)&&Number(floor)<=depth&&object(rec)&&
    Object.keys(rec).every(k=>['quota','alive','ids'].includes(k))&&Number.isInteger(rec.quota)&&rec.quota>=0&&rec.quota<=SIZE*SIZE&&
    (rec.alive===null||Number.isInteger(rec.alive)&&rec.alive>=0&&rec.alive<=rec.quota)&&
    (rec.ids===undefined||Array.isArray(rec.ids)&&rec.ids.length===rec.quota&&rec.ids.every(id=>typeof id==='string'&&id.length<=100)&&new Set(rec.ids).size===rec.quota));
}
