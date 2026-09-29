import {receiveCallout} from './callouts.js';
import {INTERRUPT_REASONS,ORDER,pick,countMax,registerSpecial,validActorSpecials} from './enemy-specials.js';
// Uncommitted tells cancel on death, disruption, forced movement, or loss of a tracked shot: the wound-up shot here, and
// every special as its declaration says (src/enemy-specials.js `interrupt`, in ORDER.ids) — which reasons drop it, and
// which cooldown restarts. A flamer's marked cone (3.203.0) drops for any of them; a loyalist boss's paint and machine
// gun (3.204.0) and a rebel boss's wall, ring and set-up flamethrower (3.206.0) never for losing sight or suppression; a
// swarm boss's charge (3.205.0) never for losing sight (it charges the lane whoever stands there), her egg sac only when
// she falls or is stunned. Fixed-tile sniper shots retain their tile through loss of sight. Committed marks never cancel.
export {INTERRUPT_REASONS};
export function interruptEnemyIntent(actor,reason){if(!INTERRUPT_REASONS.includes(reason))return false;actor.charge=false;actor.aim=null;actor.windup=0;actor.fireChain=null;
 for(const s of pick()){const i=s.interrupt;if(!i?.on.includes(reason))continue;if(i.run)i.run(actor,reason);else if(!i.cooldown)delete actor[s.intent];else if(actor[s.intent]){delete actor[s.intent];actor[i.cooldown]=i.to?i.to():countMax(s,i.cooldown);}}
 return true;}
// The round start (Game.action): per group of ORDER.tick, one pass over the enemies — each declared cooldown counts down,
// then a warning its unit can no longer give (its `tick.drop` reason: fallen, stunned, pinned) is interrupted.
export function tickSpecials(g,groups=ORDER.tick){for(const ids of groups){const list=pick(ids);for(const e of g.enemies){for(const s of list){const k=s.tick.cooldown;if(e[k]>0)e[k]--;}for(const s of list){const why=e[s.intent]&&s.tick.drop(e);if(why)interruptEnemyIntent(e,why);}}}}
export const CALLOUT_KINDS=Object.freeze(['state','telegraph','injury','affix_revealed']);
// The receiver emits only visibility-filtered semantic data.
export function enemyCallout(g,actor,kind,detail={}){if(!CALLOUT_KINDS.includes(kind))return;return receiveCallout(g,actor,kind,detail);}
// 3.206.1 (src/enemy-specials.js): the grenadier's throw as the shared rules see it. Getting ready, it cannot shoot a mine
// or step off a hazard; any interruption drops it (no cooldown); it holds the thrower to the target it chose (the lock,
// src/enemy-behavior.js) and goes off early at the enforcer's rally (src/rebels.js). It resolves in the affix branches,
// after the orders (src/enemy-behavior.js). Saves: checked early, on this floor's player, enemies and allies (only a
// revealed grenadier may hold one), with the loader's own point check (Game.restore); never trimmed.
registerSpecial({id:'grenade',intent:'grenadeIntent',carries:e=>Boolean(e.affixes?.some(a=>a.id==='grenadier')),
 fields:{grenadeIntent:{scope:'actor',valid:(v,e,point)=>e.hp>0&&!e.control.disabled&&e.affixes?.some(a=>a.id==='grenadier'&&a.revealed)&&v.stage==='prepare'&&(v.stun===undefined||v.stun===true)&&(v.targetId===undefined||typeof v.targetId==='string'&&v.targetId.length<=100)&&point(v)&&point(v.origin)}},
 interrupt:{on:INTERRUPT_REASONS},
 blocks:{mine:true,stepOff:true},
 lock:e=>e.grenadeIntent?.targetId,
});
export const validEnemyIntent=(e,point)=>validActorSpecials(e,point);
// Allied bombardment marks (3.95.0, the engineer's core guard) carry the unit id and their own radius and damage.
export function validEnemyMarks(marks,point,turn){return Array.isArray(marks)&&marks.length<=256&&marks.every(m=>point(m)&&Number.isInteger(m.due)&&m.due>turn&&m.due<=turn+2&&(m.kind===undefined||m.kind==='ally'&&typeof m.sourceId==='string'&&/^ally-[1-9][0-9]*$/.test(m.sourceId)&&m.radius===1&&Number.isFinite(m.damage)&&m.damage>0&&m.damage<=1e6||m.kind==='grenade'&&m.phase==='flight'&&typeof m.sourceId==='string'&&m.sourceId.length<=100&&point(m.origin)&&m.radius===1&&(m.stun===true?m.damage===0:m.stun===undefined&&Number.isFinite(m.damage)&&m.damage>0&&m.damage<=1e20)));}   // stun: 3.188.0
export const grenadeTelegraphs=g=>[...g.enemies.filter(e=>e.grenadeIntent).map(e=>({kind:'grenade',phase:'prepare',sourceId:e.id,x:e.grenadeIntent.x,y:e.grenadeIntent.y,origin:{...e.grenadeIntent.origin},radius:0,...(e.grenadeIntent.stun?{stun:true}:{}),interruptible:true})),...g.marks.filter(m=>m.kind==='grenade').map(m=>({...m,origin:{...m.origin},interruptible:false,countdown:Math.max(0,m.due-g.turn)}))];
