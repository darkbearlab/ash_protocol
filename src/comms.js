// Comms channel (3.168.0, user request; docs/STORY.md 8): the 管制員 and whoever stands in for her speak through one
// box wherever they appear — the mission briefing first, the field and the main menu later. The left plate is the
// speaker's portrait; until the art exists it reads SOUND ONLY and, like the floor stencils, stays English.
import {t,language} from './i18n.js';
import {validDuty,DEFAULT_DUTY} from './duty.js';

// 3.168.1 (user request): a hairline under the box closes in from both sides; when it meets in the middle, the box
// goes. Longer lines stay longer. 3.172.0 (user request, after a playtest): faster, a tap closes it early, and a message
// may set its own time (`seconds`, up to maxSeconds).
export const COMMS_TUNING=Object.freeze({baseMs:1500,perCharMs:60,minMs:2500,maxMs:7000,closeMs:220,maxSeconds:60});
export const commsDuration=text=>{
 const chars=[...String(text).replace(/<[^>]*>/g,'')].length;
 return Math.round(Math.min(COMMS_TUNING.maxMs,Math.max(COMMS_TUNING.minMs,COMMS_TUNING.baseMs+COMMS_TUNING.perCharMs*chars)));
};

// Speakers (3.168.2, user request; names 3.169.0, user's tentative choice; faces 3.170.0): each has a name and, when
// drawn, a 4x4 sheet of 64x64 faces (art/comms-v1, installed to assets/pixel/comms-v1) with the cell of each
// expression. No sheet means the SOUND ONLY plate; the overseer never has one. An expression a speaker was not drawn
// with shows her neutral face. 3.173.0: `short` is the name the slim field box starts the line with, and `face` the
// top-left corner of the 43x43 window on the face that box shows (unscaled, so the pixels stay square).
const SHEET=id=>`./assets/pixel/comms-v1/${id}.png`;
const cells=names=>Object.freeze(Object.fromEntries(names.map((name,i)=>[name,i])));
export const COMMS_SPEAKERS=Object.freeze({
 egret:Object.freeze({name:t('comms.speaker.egret'),short:t('comms.short.egret'),sheet:SHEET('egret'),face:[11,11],expressions:cells(['neutral','smile','speaking','listening','serious','concerned','worried','alarmed','surprised','sad','relieved','thinking','closed','determined','flustered','gentle'])}),   // 白鷺
 wren:Object.freeze({name:t('comms.speaker.wren'),short:t('comms.short.wren'),sheet:SHEET('wren'),face:[11,10],expressions:cells(['neutral','grin','speaking','wink','bored','annoyed','serious','alarmed','surprised','sheepish','worried','smug','laughing','sigh','determined','sad'])}),   // 鷦鷯
 overseer:Object.freeze({name:t('comms.speaker.overseer'),short:t('comms.short.overseer')}),   // 監視官, no face, no name
});
export const DEFAULT_EXPRESSION='neutral';
// Who is on duty: the officer saved with the run (src/duty.js picks it at deployment), Egret when there is none.
export const dutySpeaker=(context={})=>validDuty(context.game?.duty)?context.game.duty:DEFAULT_DUTY;

// What each speaker says, by event (3.169.0; docs/STORY.md 8). One line is picked at random each time. Egret's lines
// (3.169.0) and Wren's (3.171.0) are the user's picks from their review pages; the overseer is a hook with no lines
// yet, so on his days the field stays quiet and the briefing uses the neutral placeholder.
export const COMMS_LINES=Object.freeze({
 egret:Object.freeze({
  briefing:['comms.egret.briefing.1','comms.egret.briefing.2','comms.egret.briefing.3'],
  squadDeploy:['comms.egret.squadDeploy.1','comms.egret.squadDeploy.2'],
  squadReady:['comms.egret.squadReady.1','comms.egret.squadReady.2'],
  grenade:['comms.egret.grenade.1','comms.egret.grenade.2'],
  boss:['comms.egret.boss.1',{id:'comms.egret.boss.2',expression:'worried'}],
  flank:['comms.egret.flank.1'],
  researcher:['comms.egret.researcher.1','comms.egret.researcher.2'],
  kia:['comms.egret.kia.1',{id:'comms.egret.kia.2',expression:'concerned'}],   // 3.174.0: calling the fallen operative (field)
  lossReport:['comms.egret.lossReport.1',{id:'comms.egret.lossReport.2',expression:'sad'},{id:'comms.egret.lossReport.3',expression:'serious'}],   // 3.174.0: the loss report (results)
 }),
 wren:Object.freeze({
  briefing:['comms.wren.briefing.1',{id:'comms.wren.briefing.2',expression:'grin'},{id:'comms.wren.briefing.3',expression:'wink'}],
  squadDeploy:['comms.wren.squadDeploy.1','comms.wren.squadDeploy.2'],
  squadReady:['comms.wren.squadReady.1',{id:'comms.wren.squadReady.2',expression:'sigh'}],
  grenade:['comms.wren.grenade.1','comms.wren.grenade.2'],
  boss:['comms.wren.boss.1',{id:'comms.wren.boss.2',expression:'determined'}],
  flank:['comms.wren.flank.1','comms.wren.flank.2'],
  researcher:['comms.wren.researcher.1',{id:'comms.wren.researcher.2',expression:'sigh'}],
  kia:['comms.wren.kia.1',{id:'comms.wren.kia.2',expression:'worried'},{id:'comms.wren.kia.3',expression:'surprised'}],
  lossReport:['comms.wren.lossReport.1','comms.wren.lossReport.2'],
 }),
 // contact (first enemy on a floor: kill them all) and researcher (kill them), once written; for a death he says
 // nothing but an ellipsis (user, 2026-09-24).
 overseer:Object.freeze({kia:['comms.overseer.kia.1'],lossReport:['comms.overseer.lossReport.1']}),
});
// The face each speaker makes for an event (3.170.0); a line may carry its own ({id, expression}).
export const COMMS_EXPRESSIONS=Object.freeze({
 egret:Object.freeze({briefing:'speaking',squadDeploy:'serious',squadReady:'concerned',grenade:'alarmed',boss:'serious',flank:'alarmed',researcher:'concerned',kia:'alarmed',lossReport:'closed'}),
 wren:Object.freeze({briefing:'speaking',squadDeploy:'serious',squadReady:'worried',grenade:'alarmed',boss:'surprised',flank:'alarmed',researcher:'neutral',kia:'alarmed',lossReport:'sad'}),
});
// A message from `speaker` for `event`, or null when that speaker has nothing to say about it.
export function commsLine(speaker,event,vars={},{random=Math.random,lines=COMMS_LINES,expressions=COMMS_EXPRESSIONS}={}){
 const ids=lines[speaker]?.[event];
 if(!ids?.length)return null;
 const pick=ids[Math.min(ids.length-1,Math.floor(random()*ids.length))],entry=typeof pick==='string'?{id:pick}:pick;
 const expression=entry.expression||expressions[speaker]?.[event];
 return {speaker,line:entry.id,vars,...(expression?{expression}:{})};
}

// A message is {speaker, expression, line, vars} or {speaker, expression, text}:
//   speaker     a key of the speakers table, or 'duty' / left out for whoever is on duty
//   expression  which portrait; left out means neutral
//   line, vars  a language-table id and its slots (the flag form); text is ready-made text instead
//   seconds     how long the box stays (3.172.0); left out, the length of the line decides (commsDuration)
// A plain string is ready-made text from whoever is on duty.
export function resolveComms(message,context={},speakers=COMMS_SPEAKERS){
 const m=typeof message==='string'?{text:message}:message||{};
 const asked=m.speaker&&m.speaker!=='duty'?m.speaker:dutySpeaker(context);
 const id=Object.hasOwn(speakers,asked)?asked:dutySpeaker(context);
 const speaker=speakers[id]||{name:''},expression=m.expression||DEFAULT_EXPRESSION;
 const cell=speaker.expressions?.[expression]??speaker.expressions?.[DEFAULT_EXPRESSION]??0;
 const ms=Number.isFinite(m.seconds)&&m.seconds>0?Math.round(Math.min(COMMS_TUNING.maxSeconds,m.seconds)*1000):null;
 return {speaker:id,name:m.name??speaker.name,short:m.short??m.name??speaker.short??speaker.name,expression,portrait:speaker.sheet?{sheet:speaker.sheet,cell,face:speaker.face||[0,0]}:null,text:m.text??(m.line?t(m.line,m.vars):''),ms};
}

// `compact` (3.173.0, user's pick from the mockups): the slim box over the battle header, as tall as the header and
// growing down only for a long line: the window on the face, then the short name and the line. The briefing keeps
// the full box.
export function commsMarkup(message,{timer=true,context={},speakers=COMMS_SPEAKERS,compact=false}={}){
 const c=resolveComms(message,context,speakers);
 // The face is one cell of a 4x4 sheet, shown as a background so the whole sheet loads once per speaker.
 const [fx,fy]=compact&&c.portrait?c.portrait.face:[0,0];
 const face=c.portrait?`<span class="comms-portrait" style="background-image:url('${c.portrait.sheet}');background-position:-${c.portrait.cell%4*64+fx}px -${Math.floor(c.portrait.cell/4)*64+fy}px"></span>`:'<span>SOUND</span><span>ONLY</span>';
 if(compact)return `<div class="comms compact" role="group" aria-label="${t('comms.aria')}" data-speaker="${c.speaker}" data-expression="${c.expression}" data-ms="${c.ms??commsDuration(c.text)}"><div class="comms-face" aria-hidden="true">${face}</div><p class="comms-line"><span class="comms-who">${c.short}</span>${c.text}</p>${timer?'<span class="comms-timer" aria-hidden="true"></span>':''}</div>`;
 return `<div class="comms" role="group" aria-label="${t('comms.aria')}" data-speaker="${c.speaker}" data-expression="${c.expression}"${c.ms?` data-ms="${c.ms}"`:''}><div class="comms-face" aria-hidden="true">${face}</div><div class="comms-body"><p class="comms-name">${c.name}</p><p class="comms-line">${c.text}</p></div>${timer?'<span class="comms-timer" aria-hidden="true"></span>':''}</div>`;
}

// Starts the hairline of a box already on the page; `done` runs once the box has closed. A timer closes it, not the
// animation's end event, which a page that is not drawing (a background tab) never delivers; the line only shows it.
// A tap on the box closes it at once (3.172.0), unless `tap` is false (3.174.0: the call for a fallen operative plays
// out). Returns the close function.
export function armComms(box,done=()=>{},{tap=true}={}){
 const timer=box?.querySelector('.comms-timer');
 if(!timer){done();return ()=>{};}
 const ms=Number(box.dataset?.ms)||commsDuration(box.querySelector('.comms-line')?.textContent||'');
 timer.style.animationDuration=`${ms}ms`;
 let open=true,clock=null;
 const close=()=>{if(!open)return;open=false;clearTimeout(clock);box.classList.add('closed');setTimeout(done,COMMS_TUNING.closeMs);};
 clock=setTimeout(close,ms);
 if(tap)box.addEventListener('click',close);else box.classList.add('held');
 return close;
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
