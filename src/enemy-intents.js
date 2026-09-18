import {SWARM_TUNING} from './swarm-tuning.js';
import {receiveCallout} from './callouts.js';
// Uncommitted tells cancel on death, disruption, forced movement, or loss of a tracked shot.
// Fixed-tile sniper shots retain their tile through loss of sight. Committed marks never cancel.
export const INTERRUPT_REASONS=['death','disabled','displaced','target_lost','suppressed'];
export function interruptEnemyIntent(actor,reason){if(!INTERRUPT_REASONS.includes(reason))return false;actor.charge=false;actor.aim=null;actor.windup=0;actor.fireChain=null;delete actor.grenadeIntent;if(actor.tongueIntent){delete actor.tongueIntent;actor.tongueCooldown=SWARM_TUNING.tongueCooldown;}if(actor.pounceIntent){delete actor.pounceIntent;actor.pounceCooldown=SWARM_TUNING.pounceCooldown;}if(actor.lobIntent){delete actor.lobIntent;actor.lobCooldown=10;}return true;}
export const CALLOUT_KINDS=Object.freeze(['state','telegraph','injury','affix_revealed']);
// The receiver emits only visibility-filtered semantic data.
export function enemyCallout(g,actor,kind,detail={}){if(!CALLOUT_KINDS.includes(kind))return;return receiveCallout(g,actor,kind,detail);}
export const validEnemyIntent=(e,point)=>e.grenadeIntent===undefined||(e.hp>0&&!e.control.disabled&&e.affixes?.some(a=>a.id==='grenadier'&&a.revealed)&&e.grenadeIntent.stage==='prepare'&&(e.grenadeIntent.targetId===undefined||typeof e.grenadeIntent.targetId==='string'&&e.grenadeIntent.targetId.length<=100)&&point(e.grenadeIntent)&&point(e.grenadeIntent.origin));
// Allied bombardment marks (3.95.0, the engineer's core guard) carry the unit id and their own radius and damage.
export function validEnemyMarks(marks,point,turn){return Array.isArray(marks)&&marks.length<=256&&marks.every(m=>point(m)&&Number.isInteger(m.due)&&m.due>turn&&m.due<=turn+2&&(m.kind===undefined||m.kind==='ally'&&typeof m.sourceId==='string'&&/^ally-[1-9][0-9]*$/.test(m.sourceId)&&m.radius===1&&Number.isFinite(m.damage)&&m.damage>0&&m.damage<=1e6||m.kind==='grenade'&&m.phase==='flight'&&typeof m.sourceId==='string'&&m.sourceId.length<=100&&point(m.origin)&&m.radius===1&&Number.isFinite(m.damage)&&m.damage>0&&m.damage<=1e20));}
export const grenadeTelegraphs=g=>[...g.enemies.filter(e=>e.grenadeIntent).map(e=>({kind:'grenade',phase:'prepare',sourceId:e.id,x:e.grenadeIntent.x,y:e.grenadeIntent.y,origin:{...e.grenadeIntent.origin},radius:0,interruptible:true})),...g.marks.filter(m=>m.kind==='grenade').map(m=>({...m,origin:{...m.origin},interruptible:false,countdown:Math.max(0,m.due-g.turn)}))];
