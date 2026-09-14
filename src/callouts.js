import {presentAnnouncement} from './presentation.js';
import {enemyDisplayName} from './enemy-affixes.js';
export const CALLOUT_TUNING=Object.freeze({hearingRadius:8,injuryHalf:.5,injuryCritical:.25});
// Stable, number-free semantic cues. Text variants and lifetime belong to presentation.
const groups={danger:['grenade','bombard','aim','attack'],affix:['affix_fast','affix_infrared','affix_night_vision','affix_suppressor','affix_grenadier'],tactical:['move','cover','hold','reload','flank'],injury:['hit','wounded','critical','suppressed','pinned'],perception:['spotted','lost','search']};
export const CALLOUT_CUES=Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([category,cues])=>cues.map(cue=>[cue,Object.freeze({category,priority:['danger','affix'].includes(category)?'high':category==='perception'?'low':'medium'})]))));
const labels={grenade:'投彈預告',bombard:'轟炸預告',aim:'瞄準中',attack:'準備攻擊',affix_fast:'快速行動',affix_infrared:'紅外線啟用',affix_night_vision:'夜視啟用',affix_suppressor:'連射',affix_grenadier:'投彈手',move:'推進',cover:'尋找掩護',hold:'堅守',reload:'換彈',flank:'包抄',hit:'中彈',wounded:'傷勢加重',critical:'重傷',suppressed:'受到壓制',pinned:'無法移動',spotted:'發現目標',lost:'失去目標',search:'搜索'};
const directions=['east','southeast','south','southwest','west','northwest','north','northeast'];
const directionNames={east:'東側',southeast:'東南側',south:'南側',southwest:'西南側',west:'西側',northwest:'西北側',north:'北側',northeast:'東北側'};
const direction=(a,b)=>directions[(Math.round(Math.atan2(b.y-a.y,b.x-a.x)/(Math.PI/4))+8)%8];
export function calloutCue(kind,detail={}){const cue=kind==='telegraph'?detail.action:kind==='affix_revealed'?`affix_${detail.affixId}`:kind==='state'?detail.state:kind==='injury'?detail.cue:null;const category=typeof cue==='string'&&Object.hasOwn(CALLOUT_CUES,cue)?CALLOUT_CUES[cue].category:null;return (kind==='telegraph'&&category==='danger'||kind==='affix_revealed'&&category==='affix'||kind==='injury'&&category==='injury'||kind==='state'&&['tactical','perception'].includes(category))?cue:null;}
export const calloutLogText=event=>`${event.visibility==='visible'?event.name:`${directionNames[event.direction]}傳來喊聲`}：${labels[event.cue]}。`;
// Only observer memory, never serialized. UI throttling is separate; state transitions emit once.
const states=new WeakMap();
export function receiveCallout(g,actor,kind,detail={}){
 const cue=calloutCue(kind,detail);if(!cue||actor===g.player||actor.kind||!g.enemies.includes(actor)||actor.hp<=0)return null;
 if(kind==='state'){const memory=states.get(actor)||{};const category=CALLOUT_CUES[cue].category;if(memory[category]===cue)return null;memory[category]=cue;states.set(actor,memory);}
 if(Math.abs(actor.x-g.player.x)+Math.abs(actor.y-g.player.y)>CALLOUT_TUNING.hearingRadius)return null;
 const visible=g.teamVisible(actor),event={type:'callout',cue,...CALLOUT_CUES[cue],visibility:visible?'visible':'heard',...(visible?{actorId:actor.id,enemyType:actor.type,name:enemyDisplayName(actor),position:{x:actor.x,y:actor.y}}:{direction:direction(g.player,actor)})};
 return presentAnnouncement(g,()=>{g.effects.push(event);g.log(calloutLogText(event),event.priority==='high');g.onEnemyCallout?.(structuredClone(event));return event;});
}
export function injuryCallout(g,e,before){if(e.hp<=0||e.hp>=before)return;const cue=before>e.maxHp*CALLOUT_TUNING.injuryCritical&&e.hp<=e.maxHp*CALLOUT_TUNING.injuryCritical?'critical':before>e.maxHp*CALLOUT_TUNING.injuryHalf&&e.hp<=e.maxHp*CALLOUT_TUNING.injuryHalf?'wounded':before>=e.maxHp?'hit':null;if(cue)receiveCallout(g,e,'injury',{cue});}

const perception=new WeakMap();
export function observeEnemy(g,e,visible){const previous=perception.get(e);perception.set(e,visible);if(visible&&previous===false)receiveCallout(g,e,'state',{state:'spotted'});else if(!visible&&previous===true)receiveCallout(g,e,'state',{state:'lost'});else if(!visible&&e.lastKnown)receiveCallout(g,e,'state',{state:'search'});}
