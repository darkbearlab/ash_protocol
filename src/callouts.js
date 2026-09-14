import {presentAnnouncement} from './presentation.js';
import {enemyDisplayName} from './enemy-affixes.js';
export const CALLOUT_TUNING=Object.freeze({hearingRadius:8,injuryHalf:.5,injuryCritical:.25});
// Stable, number-free semantic cues. Text variants and lifetime belong to presentation.
const groups={danger:['grenade','bombard','aim','attack'],affix:['affix_fast','affix_infrared','affix_night_vision','affix_suppressor','affix_grenadier'],tactical:['move','cover','hold','reload','flank'],injury:['hit','wounded','critical','suppressed','pinned'],perception:['spotted','lost','search']};
export const CALLOUT_CUES=Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([category,cues])=>cues.map(cue=>[cue,Object.freeze({category,priority:['danger','affix'].includes(category)?'high':category==='perception'?'low':'medium'})]))));
const directions=['east','southeast','south','southwest','west','northwest','north','northeast'];
const direction=(a,b)=>directions[(Math.round(Math.atan2(b.y-a.y,b.x-a.x)/(Math.PI/4))+8)%8];
export function calloutCue(kind,detail={}){const cue=kind==='telegraph'?detail.action:kind==='affix_revealed'?`affix_${detail.affixId}`:kind==='state'?detail.state:kind==='injury'?detail.cue:null;const category=typeof cue==='string'&&Object.hasOwn(CALLOUT_CUES,cue)?CALLOUT_CUES[cue].category:null;return (kind==='telegraph'&&category==='danger'||kind==='affix_revealed'&&category==='affix'||kind==='injury'&&category==='injury'||kind==='state'&&['tactical','perception'].includes(category))?cue:null;}
// Only observer memory, never serialized. UI throttling is separate; state transitions emit once.
const states=new WeakMap();
// Callouts are presentation only (user decision, 3.76.1): the combat log keeps rules results, so nothing is logged here.
export function receiveCallout(g,actor,kind,detail={}){
 const cue=calloutCue(kind,detail);if(!cue||actor===g.player||actor.kind||!g.enemies.includes(actor)||actor.hp<=0)return null;
 if(kind==='state'){const memory=states.get(actor)||{};const category=CALLOUT_CUES[cue].category;if(memory[category]===cue)return null;memory[category]=cue;states.set(actor,memory);}
 if(Math.abs(actor.x-g.player.x)+Math.abs(actor.y-g.player.y)>CALLOUT_TUNING.hearingRadius)return null;
 const visible=g.teamVisible(actor),event={type:'callout',cue,...CALLOUT_CUES[cue],visibility:visible?'visible':'heard',...(visible?{actorId:actor.id,enemyType:actor.type,name:enemyDisplayName(actor),position:{x:actor.x,y:actor.y}}:{direction:direction(g.player,actor)})};
 return presentAnnouncement(g,()=>{g.effects.push(event);g.onEnemyCallout?.(structuredClone(event));return event;});
}
export function injuryCallout(g,e,before){if(e.hp<=0||e.hp>=before)return;const cue=before>e.maxHp*CALLOUT_TUNING.injuryCritical&&e.hp<=e.maxHp*CALLOUT_TUNING.injuryCritical?'critical':before>e.maxHp*CALLOUT_TUNING.injuryHalf&&e.hp<=e.maxHp*CALLOUT_TUNING.injuryHalf?'wounded':before>=e.maxHp?'hit':null;if(cue)receiveCallout(g,e,'injury',{cue});}

const perception=new WeakMap();
export function observeEnemy(g,e,visible){const previous=perception.get(e);perception.set(e,visible);if(visible&&previous===false)receiveCallout(g,e,'state',{state:'spotted'});else if(!visible&&previous===true)receiveCallout(g,e,'state',{state:'lost'});else if(!visible&&e.lastKnown)receiveCallout(g,e,'state',{state:'search'});}
