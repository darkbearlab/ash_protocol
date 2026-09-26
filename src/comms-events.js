// Comms events (3.169.0, user decision 2026-09-24; docs/STORY.md 8): what the officer on duty can remark on after an
// action. It reads the run after the action, the enemies that were visible before it and the new log lines, and keeps a
// per-run memory so each hint keeps its own frequency:
//   squadDeploy, squadReady  a few turns apart (the squad leader's order and "squad ready" log lines)
//   grenade, flank           every time (the grenade warning log line; a new enemy more than 90 degrees away from the
//                            one you were fighting)
//   boss                     once per boss, the first time it is seen
//   researcher               once per floor
//   contact                  once per floor, the first enemy seen (the overseer's cue)
//   survivalWave             3.191.0: a survival wave announced, naming the points it goes for; survivalHunt (3.196.0)
//                            when the whole wave comes for you
//   survivalPressed          an enemy stands on a point (at most every few turns); survivalLost: a point falls
// Which speaker says what is src/comms.js COMMS_LINES; an event nobody has a line for passes silently.
import {logSlots} from './comms.js';
import {isBossClass,isNoncombatant} from './enemy-data.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {t} from './i18n.js';
import {pointName} from './survival.js';

export const COMMS_EVENT_TUNING=Object.freeze({squadDeploy:Object.freeze({cooldown:6}),squadReady:Object.freeze({cooldown:6}),survivalPressed:Object.freeze({cooldown:4})});
// The points the newest announced survival wave goes for, and how soon it arrives.
function waveVars(game){
 const s=game.survival,last=s?Math.max(-1,...s.incoming.map(i=>i.wave)):-1,groups=s?s.incoming.filter(i=>i.wave===last):[];
 const points=[...new Set(groups.map(i=>i.target).filter(Boolean))].map(id=>s.points.find(p=>p.id===id)).filter(Boolean);
 return {points:points.map(pointName).join(t('common.listSeparator')),n:groups.length?Math.max(0,groups[0].due-game.turn):0};
}
// [event, log sentence, vars from the log's slots and the game]
const LOG_EVENTS=Object.freeze([['squadDeploy','squad.identified'],['squadReady','squad.ready'],['grenade','enemy-behavior.grenadeReady'],
 ['survivalWave','survival.warning',(slots,game)=>waveVars(game)],['survivalPressed','survival.pointPressed',slots=>({point:slots.point})],['survivalLost','survival.pointLost',slots=>({point:slots.point})]]);

export const newCommsMemory=runId=>({runId,until:{},bosses:[],researcherFloors:[],contactFloors:[]});
// What the caller notes just before an action: the ids of the enemies in sight and the locked target.
export const commsSnapshot=game=>({visible:new Set((game?.visibleEnemies||[]).map(e=>e.id)),target:game?.target??null});

// True when `other` lies more than 90 degrees away from `ref`, seen from the player.
function flanking(player,ref,other){
 const ax=ref.x-player.x,ay=ref.y-player.y,bx=other.x-player.x,by=other.y-player.y;
 return (ax||ay)&&(bx||by)?ax*bx+ay*by<0:false;
}

export function commsEvents({game,before=null,logs=[],memory}){
 const events=[];if(!game||!memory)return events;
 const turn=game.turn,floor=game.floor,ready=type=>!(memory.until[type]>turn);
 const push=(type,vars={})=>{events.push({type,vars});const cooldown=COMMS_EVENT_TUNING[type]?.cooldown;if(cooldown)memory.until[type]=turn+cooldown;};
 const seen=new Set();
 for(const entry of [...logs].reverse())for(const [type,sentence,vars] of LOG_EVENTS){
  const slots=seen.has(type)||!ready(type)?null:logSlots(entry?.text,sentence);if(!slots)continue;
  const values=vars?vars(slots,game):{},kind=type==='survivalWave'&&!values.points?'survivalHunt':type;   // 3.196.0: a hunt names no point
  seen.add(type);push(kind,values);
 }
 const visible=(game.visibleEnemies||[]).filter(e=>e.hp>0),hostile=visible.filter(e=>!isNoncombatant(e));
 if(hostile.length&&!memory.contactFloors.includes(floor)){memory.contactFloors.push(floor);push('contact');}
 for(const e of hostile)if(isBossClass(e)&&!memory.bosses.includes(e.id)){memory.bosses.push(e.id);push('boss',{name:enemyDisplayName(e)});}
 if(visible.some(e=>isNoncombatant(e))&&!memory.researcherFloors.includes(floor)){memory.researcherFloors.push(floor);push('researcher');}
 const earlier=before?.visible||new Set(),engaged=hostile.filter(e=>earlier.has(e.id)),fresh=hostile.filter(e=>!earlier.has(e.id));
 if(engaged.length&&fresh.length){
  const p=game.player,far=e=>Math.abs(e.x-p.x)+Math.abs(e.y-p.y);
  const ref=engaged.find(e=>e.id===before.target)||engaged.reduce((a,b)=>far(a)<=far(b)?a:b);
  if(fresh.some(e=>flanking(p,ref,e)))push('flank');
 }
 return events;
}
