// Comms channel (3.168.0, user request; docs/STORY.md 8): the 管制員 and whoever stands in for her speak through one
// box wherever they appear — the mission briefing first, the field and the main menu later. The left plate is the
// speaker's portrait; until the art exists it reads SOUND ONLY and, like the floor stencils, stays English.
import {t,language} from './i18n.js';

// 3.168.1 (user request): a hairline under the box closes in from both sides; when it meets in the middle, the box
// goes. Longer lines stay longer.
export const COMMS_TUNING=Object.freeze({baseMs:2600,perCharMs:90,minMs:3500,maxMs:10000,closeMs:220});
export const commsDuration=text=>{
 const chars=[...String(text).replace(/<[^>]*>/g,'')].length;
 return Math.round(Math.min(COMMS_TUNING.maxMs,Math.max(COMMS_TUNING.minMs,COMMS_TUNING.baseMs+COMMS_TUNING.perCharMs*chars)));
};

// Speakers (3.168.2, user request): each has a name and a portrait per expression. A missing portrait shows the SOUND
// ONLY plate, so a speaker can talk before the art exists. Only the controller is written yet; the classmate and the
// supervisor who take a mission while she is in memory correction wait for the user's writing.
export const COMMS_SPEAKERS=Object.freeze({
 controller:Object.freeze({name:t('comms.speaker.controller'),portraits:Object.freeze({})}),   // {expression: image path}
});
export const DEFAULT_EXPRESSION='neutral';
// Who is on duty for a mission: the speaker a message reaches when it names none. Always the controller for now; the
// rule for her stand-ins (which missions, how it is decided) goes here once it is written.
export const dutySpeaker=(context={})=>'controller';

// A message is {speaker, expression, line, vars} or {speaker, expression, text}:
//   speaker     a key of the speakers table, or 'duty' / left out for whoever is on duty
//   expression  which portrait; left out means neutral
//   line, vars  a language-table id and its slots (the flag form); text is ready-made text instead
// A plain string is ready-made text from whoever is on duty.
export function resolveComms(message,context={},speakers=COMMS_SPEAKERS){
 const m=typeof message==='string'?{text:message}:message||{};
 const asked=m.speaker&&m.speaker!=='duty'?m.speaker:dutySpeaker(context);
 const id=Object.hasOwn(speakers,asked)?asked:dutySpeaker(context);
 const speaker=speakers[id]||{name:'',portraits:{}},expression=m.expression||DEFAULT_EXPRESSION;
 return {speaker:id,name:m.name??speaker.name,expression,portrait:speaker.portraits?.[expression]||null,text:m.text??(m.line?t(m.line,m.vars):'')};
}

export function commsMarkup(message,{timer=true,context={},speakers=COMMS_SPEAKERS}={}){
 const c=resolveComms(message,context,speakers);
 const face=c.portrait?`<img class="comms-portrait" src="${c.portrait}" width="44" height="44" alt="" draggable="false">`:'<span>SOUND</span><span>ONLY</span>';
 return `<div class="comms" role="group" aria-label="${t('comms.aria')}" data-speaker="${c.speaker}" data-expression="${c.expression}"><div class="comms-face" aria-hidden="true">${face}</div><div class="comms-body"><p class="comms-name">${c.name}</p><p class="comms-line">${c.text}</p></div>${timer?'<span class="comms-timer" aria-hidden="true"></span>':''}</div>`;
}

// Starts the hairline of a box already on the page; `done` runs once the box has closed. A timer closes it, not the
// animation's end event, which a page that is not drawing (a background tab) never delivers; the line only shows it.
export function armComms(box,done=()=>{}){
 const timer=box?.querySelector('.comms-timer');
 if(!timer){done();return;}
 const ms=commsDuration(box.querySelector('.comms-line')?.textContent||'');
 timer.style.animationDuration=`${ms}ms`;
 setTimeout(()=>{box.classList.add('closed');setTimeout(done,COMMS_TUNING.closeMs);},ms);
}

// Log hooks (3.168.1, user request): someone speaks when a given log line appears. Each hook names a language-table
// sentence by its id; the rest is a message (speaker, expression, line) whose vars are the log's slots, or `say`, a
// function of the slots and the log entry that returns a message. Which lines, who and what is still to be decided
// (user, 2026-09-24): the list stays empty until then.
export const COMMS_HOOKS=Object.freeze([]);   // entries: {log: sentence id, speaker?, expression?, line} or {log, say}

// A sentence in the current language as a pattern: text around the slots must match exactly, each {slot} captures its
// value and a {n|one|other} choice accepts either word. Built per language on first use.
const patterns=new Map();
const escapeRegExp=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function sentencePattern(id){
 const key=`${language()}:${id}`;
 if(patterns.has(key))return patterns.get(key);
 const source=t(id);let pattern=null;
 if(source!==id){
  const seen=new Set();let body='',last=0;
  for(const m of source.matchAll(/\{(\w+)(?:\|([^{}|]*)\|([^{}|]*))?\}/g)){
   body+=escapeRegExp(source.slice(last,m.index));last=m.index+m[0].length;
   const name=m[1];
   if(m[2]!==undefined)body+=`(?:${escapeRegExp(m[2])}|${escapeRegExp(m[3])})`;
   else if(seen.has(name))body+=`\\k<${name}>`;
   else{seen.add(name);body+=`(?<${name}>.+?)`;}
  }
  body+=escapeRegExp(source.slice(last));
  try{pattern=new RegExp(`^${body}$`,'s');}catch{pattern=null;}
 }
 patterns.set(key,pattern);return pattern;
}
// The slot values when `text` is that sentence, otherwise null.
export function logSlots(text,id){
 const m=sentencePattern(id)?.exec(String(text));
 return m?{...(m.groups||{})}:null;
}
// The messages for a batch of new log entries (the game keeps them newest first), oldest first.
export function commsForLogs(entries,hooks=COMMS_HOOKS){
 const messages=[];
 for(const entry of [...entries].reverse())for(const hook of hooks){
  const slots=logSlots(entry?.text,hook.log);if(!slots)continue;
  const {log,say,...message}=hook;
  messages.push(say?say(slots,entry):{...message,vars:{...slots,...message.vars}});
 }
 return messages;
}
