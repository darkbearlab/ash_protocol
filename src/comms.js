// Controller channel (3.168.0, user request; docs/STORY.md 8): the 管制員 speaks through one box wherever she appears —
// the mission briefing first, the field and the main menu later. The left plate stands in for her portrait and reads
// SOUND ONLY until the art exists; like the floor stencils it stays English in every language.
import {t,language} from './i18n.js';

// 3.168.1 (user request): a hairline under the box closes in from both sides; when it meets in the middle, the box
// goes. Longer lines stay longer.
export const COMMS_TUNING=Object.freeze({baseMs:2600,perCharMs:90,minMs:3500,maxMs:10000,closeMs:220});
export const commsDuration=line=>{
 const chars=[...String(line).replace(/<[^>]*>/g,'')].length;
 return Math.round(Math.min(COMMS_TUNING.maxMs,Math.max(COMMS_TUNING.minMs,COMMS_TUNING.baseMs+COMMS_TUNING.perCharMs*chars)));
};

export function commsMarkup(line,{timer=true}={}){
 return `<div class="comms" role="group" aria-label="${t('comms.aria')}"><div class="comms-face" aria-hidden="true"><span>SOUND</span><span>ONLY</span></div><div class="comms-body"><p class="comms-name">${t('comms.name')}</p><p class="comms-line">${line}</p></div>${timer?'<span class="comms-timer" aria-hidden="true"></span>':''}</div>`;
}

// Starts the hairline of a box already on the page; `done` runs once the box has closed. A timer closes it, not the
// animation's end event, which a page that is not drawing (a background tab) never delivers; the line only shows it.
export function armComms(box,line,done=()=>{}){
 const timer=box?.querySelector('.comms-timer');
 if(!timer){done();return;}
 const ms=commsDuration(line);
 timer.style.animationDuration=`${ms}ms`;
 setTimeout(()=>{box.classList.add('closed');setTimeout(done,COMMS_TUNING.closeMs);},ms);
}

// Log hooks (3.168.1, user request): she speaks when a given log line appears. Each hook names a language-table
// sentence by its id and what she says, either a table id (filled with the log's slots) or a function of the slots.
// Which lines, and what she says, is still to be decided (user, 2026-09-24): the list stays empty until then.
export const COMMS_HOOKS=Object.freeze([]);   // entries: {log: sentence id, line: table id or (slots,entry)=>text}

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
// What she says for a batch of new log entries (oldest first), in order.
export function commsForLogs(entries,hooks=COMMS_HOOKS){
 const lines=[];
 for(const entry of [...entries].reverse())for(const hook of hooks){
  const slots=logSlots(entry?.text,hook.log);
  if(slots)lines.push(typeof hook.line==='function'?hook.line(slots,entry):t(hook.line,slots));
 }
 return lines;
}
