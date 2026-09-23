// Callout bubbles (3.76.4, Claude): line table, throttling and placement for REAL_MODE callout events.
// The rules layer decides what is heard and hides identity; this only words and paces it. Line picks hash the
// event and a board counter, never the combat RNG.
import {t,language} from './i18n.js';
import {ENEMY_TYPES} from './engine.js';
import {factionDef} from './factions.js';

export const CALLOUT_UI_TUNING=Object.freeze({generalMs:2500,dangerMs:4000,playerMs:1500,heardFactor:.7,cooldownMs:1500,maxOnScreen:4,fadeMs:400,edgeMargin:30});

// 3.167.0: the voice lines live in one table per language (src/voices-zh-tw.js, src/voices-en.js), chosen at load.
import {VOICES as ZH_VOICES,CREATURE as ZH_CREATURE} from './voices-zh-tw.js';
import {VOICES as EN_VOICES,CREATURE as EN_CREATURE} from './voices-en.js';
const english=language()==='en';
export const VOICE_LINES=english?EN_VOICES:ZH_VOICES;
const HUMAN=VOICE_LINES.human,CREATURE=english?EN_CREATURE:ZH_CREATURE;
// A unit that speaks for itself sends its voice with the event, seen or heard (civilians, 3.82.0 rules). Otherwise
// machines and creatures keep their card voice and the rest use the faction voice, falling back to the neutral human
// voice. Heard callouts carry no unit type, so they can only use the faction voice (user decision, 2026-09-14).
export function calloutVoice(event){
 if(typeof event.voice==='string'&&Object.hasOwn(VOICE_LINES,event.voice))return event.voice;
 // A faction may speak as creatures (swarm, 3.83.0): heard lines then follow the category like any creature noise.
 const faction=factionDef(event.faction)?.voice,factionVoice=faction&&(Object.hasOwn(VOICE_LINES,faction)||faction==='creature')?faction:'human';
 if(event.visibility!=='visible')return factionVoice;
 const def=ENEMY_TYPES[event.enemyType];
 return def?.mechanical?'machine':def?.voice==='creature'?'creature':typeof def?.voice==='string'&&Object.hasOwn(VOICE_LINES,def.voice)?def.voice:factionVoice;
}
const hash=text=>{let h=2166136261;for(const c of text){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// 3.163.0 (user decision 2026-09-23): the operator speaks only about an invalid input or the next one. The user wrote
// these; never a number.
export const PLAYER_LINES=Object.freeze({blocked:t('callout-ui.player.blocked'),locked:t('callout-ui.player.locked'),pinned:t('callout-ui.player.pinned'),anchor_on:t('callout-ui.player.anchor_on'),anchor_off:t('callout-ui.player.anchor_off'),anchored:t('callout-ui.player.anchored'),reload_needed:t('callout-ui.player.reload_needed'),last_magazine:t('callout-ui.player.last_magazine'),no_ammo:t('callout-ui.player.no_ammo'),out_of_range:t('callout-ui.player.out_of_range'),no_target:t('callout-ui.player.no_target'),chambered:t('callout-ui.player.chambered'),not_needed:t('callout-ui.player.not_needed'),fatal:t('callout-ui.player.fatal')});
export const playerLine=event=>event.cue==='empty'?t('callout-ui.empty',{item:event.item||t('callout-ui.itemFallback')}):PLAYER_LINES[event.cue]||'';
export function calloutLine(event,variant=0){
 if(event.speaker==='player')return playerLine(event);
 const voice=calloutVoice(event),lines=voice==='creature'?CREATURE[event.category]:(VOICE_LINES[voice]||HUMAN)[event.cue];
 return lines?.length?lines[hash(`${event.actorId||event.direction||''}:${event.cue}:${variant}`)%lines.length]:'';
}

const RANK={high:3,medium:2,low:1};
// One bubble per unit (or per direction when only heard). Lines never stack as "×N" (user decision, 3.76.5):
// a repeat on the same unit only extends its bubble, and the same quieter cue from another unit inside cooldownMs
// is not shown. Danger lines ignore the cooldown. A screen cap drops the quietest, oldest bubble.
export class CalloutBoard{
 constructor(tuning=CALLOUT_UI_TUNING){this.tuning=tuning;this.items=[];this.sequence=0;}
 clear(){this.items=[];}
 duration(event){const t=this.tuning;if(event.speaker==='player')return t.playerMs;const base=event.priority==='high'?t.dangerMs:t.generalMs;return Math.round(event.visibility==='visible'?base:base*t.heardFactor);}
 add(event,now){
  if(event?.type!=='callout'||!event.cue)return null;
  this.prune(now);
  const key=event.visibility==='visible'?`actor:${event.actorId}`:`dir:${event.direction}`,expires=now+this.duration(event);
  const same=this.items.find(i=>i.key===key);
  if(same&&same.event.cue===event.cue&&(same.event.item||'')===(event.item||'')){same.expires=Math.max(same.expires,expires);return same;}
  if(same&&RANK[same.event.priority]>RANK[event.priority])return null;
  if(event.priority!=='high'&&this.items.some(i=>i.event.cue===event.cue&&i.event.visibility===event.visibility&&now-i.started<=this.tuning.cooldownMs))return null;
  if(same)this.items.splice(this.items.indexOf(same),1);
  const item={key,event,text:calloutLine(event,this.sequence++),started:now,expires};
  this.items.push(item);
  // The operator's own bubble (3.163.0) neither counts toward the cap nor is ever the one dropped.
  const others=()=>this.items.filter(i=>i.event.speaker!=='player');
  while(others().length>this.tuning.maxOnScreen){const drop=others().sort((a,b)=>RANK[a.event.priority]-RANK[b.event.priority]||a.started-b.started)[0];this.items.splice(this.items.indexOf(drop),1);}
  return this.items.includes(item)?item:null;
 }
 // A fallen speaker's line fades out within fadeMs, whatever it said (user decision, 3.84.3). Only the first call counts,
 // so a bubble that is already fading keeps its pace. Heard lines have no known speaker and are never silenced.
 silence(item,now){if(item.silencedAt===undefined){item.silencedAt=now;item.expires=Math.min(item.expires,now+this.tuning.fadeMs);}return item;}
 prune(now){this.items=this.items.filter(i=>now<i.expires);}
 active(now){this.prune(now);return this.items;}
}

export const bubbleText=item=>item.text;
export const bubbleAlpha=(item,now,tuning=CALLOUT_UI_TUNING)=>(item.event.visibility==='visible'?1:.6)*Math.max(0,Math.min(1,(item.expires-now)/tuning.fadeMs));

const VECTORS={east:[1,0],southeast:[1,1],south:[0,1],southwest:[-1,1],west:[-1,0],northwest:[-1,-1],north:[0,-1],northeast:[1,-1]};
export const DIRECTION_ARROWS=Object.freeze({east:'→',southeast:'↘',south:'↓',southwest:'↙',west:'←',northwest:'↖',north:'↑',northeast:'↗'});
// A heard callout only knows its direction, so it sits where that direction meets the screen edge.
export function edgePoint(direction,width,height,margin=CALLOUT_UI_TUNING.edgeMargin){
 const [dx,dy]=VECTORS[direction]||VECTORS.north,cx=width/2,cy=height/2;
 const scale=Math.min(dx?(cx-margin)/Math.abs(dx):Infinity,dy?(cy-margin)/Math.abs(dy):Infinity);
 return {x:cx+dx*scale,y:cy+dy*scale};
}
