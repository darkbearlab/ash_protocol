import {t} from './i18n.js';
import {cloneDesignation} from './purge-review.js';
import {CHARACTERS} from './characters.js';

// Kill house interface copy and arcade scoring (docs/KILLHOUSE.md section 10, Claude, 3.88.0).
// Rules and records live in killhouse*.js; this module only words, weighs and lays them out.

// One prompt per tutorial room, in recipe order (room 4 holds the researcher).
export const TUTORIAL_PROMPTS=[
  {title:t('tutorial.moveTitle'),text:t('tutorial.move')},
  {title:t('tutorial.fireTitle'),text:t('tutorial.fire')},
  {title:t('tutorial.windupTitle'),text:t('tutorial.windup')},
  {title:t('tutorial.doorsTitle'),text:t('tutorial.doors')},
  {title:t('tutorial.civiliansTitle'),text:t('tutorial.civilians')},
  {title:t('tutorial.finalTitle'),text:t('tutorial.final')}
];
export const ARCADE_PROMPTS={
  armory:t('arcade.armory'),
  combat:t('arcade.range')
};
const PHASE_LABELS={tutorial:t('label.training'),armory:t('label.armory'),combat:t('label.range')};
export const simulationLabel=g=>`KILL HOUSE · ${PHASE_LABELS[g.simulation.phase]||t('label.sim')}`;
export const simulationBrief=g=>g.simulation.phase==='tutorial'?t('brief.tutorial'):ARCADE_PROMPTS[g.simulation.phase]||'';

// Tutorial rooms open a card the player dismisses; arcade phases only toast on their first room.
export function roomPrompt(event){
  if(event?.type!=='roomEntered')return null;
  if(event.phase==='tutorial'){const p=TUTORIAL_PROMPTS[event.roomId];return p?{modal:true,eyebrow:`${t('killhouse-ui.zone',{v:event.roomId+1})}`,...p}:null;}
  const text=(event.firstRoom??event.roomId===0)?ARCADE_PROMPTS[event.phase]:null;
  return text?{modal:false,text}:null;
}
export const roomPromptMarkup=p=>`<div class="eyebrow">${p.eyebrow}</div><h2>${p.title}</h2><p>${p.text}</p><button class="modal-button" data-modal="close">${t('killhouse-ui.continue')}</button>`;

// Tutorial cards fire on the tile before each room's door, before anyone inside can see the player (3.88.1, user
// report). Prefer explicit entrances; legacy maps can fall back to edge-kh-i-j and an open corridor.
const insideRoom=(r,p)=>p.x>=r.x&&p.x<r.x+r.w&&p.y>=r.y&&p.y<r.y+r.h;
const touches=(r,p)=>[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>insideRoom(r,{x:p.x+dx,y:p.y+dy}));
export function tutorialCue(g){
  if(g.simulation?.phase!=='tutorial')return null;
  const p=g.player,entry=g.tutorialEntrances?.find(e=>e.approach.x===p.x&&e.approach.y===p.y);if(entry)return entry.toRoom;
  const doors=new Set();
  for(const b of g.barriers||[]){
    const m=/^edge-kh-(\d+)-(\d+)$/.exec(b.id||''),room=m&&g.rooms[Number(m[2])];if(!room)continue;doors.add(`${m[1]}-${m[2]}`);
    const cells=b.axis==='x'?[{x:Math.floor(b.x),y:b.y},{x:Math.ceil(b.x),y:b.y}]:[{x:b.x,y:Math.floor(b.y)},{x:b.x,y:Math.ceil(b.y)}];
    const from=cells.sort((a,c)=>Math.abs(c.x-room.cx)+Math.abs(c.y-room.cy)-Math.abs(a.x-room.cx)-Math.abs(a.y-room.cy))[0];
    if(from.x===p.x&&from.y===p.y)return Number(m[2]);
  }
  if(g.rooms.some(r=>insideRoom(r,p)))return null;
  const link=(g.links||[]).find(([i,j])=>!doors.has(`${i}-${j}`)&&g.rooms[i]&&touches(g.rooms[i],p));
  return link?link[1]:null;
}
const promptKeys=(g,events)=>[...events.filter(e=>e?.type==='roomEntered').map(e=>e.phase==='tutorial'?`tutorial:${e.roomId}`:(e.firstRoom??e.roomId===0)?`${e.phase}:0`:null),...(tutorialCue(g)===null?[]:[`tutorial:${tutorialCue(g)}`])].filter(Boolean);
// shown is the session's set of keys; each card or toast appears once.
export const promptDue=(g,shown)=>promptKeys(g,g.simulation?.roomEvents||[]).some(key=>!shown.has(key));
export function nextPrompt(g,events,shown){
  let prompt=null;
  for(const key of promptKeys(g,events)){
    if(shown.has(key))continue;shown.add(key);
    const [phase,id]=key.split(':');prompt=roomPrompt({type:'roomEntered',phase,roomId:Number(id)})||prompt;
  }
  return prompt;
}

// Kill house exits only trigger on the elevator tile itself, so the exit button steps onto it; interacting from beside
// it spends a turn without leaving (3.89.1, browser QA). Diagonal neighbours have no single step.
export const exitStep=g=>{const dx=g.exitPoint.x-g.player.x,dy=g.exitPoint.y-g.player.y;return Math.abs(dx)+Math.abs(dy)===1?[dx,dy]:null;};

// Score v3 (3.89.3, user decision): purge rate is worth 10000 and speed up to 3000. The speed bonus stays full through
// 130 turns and then loses 30 per extra turn. An invincible one-shot bot needed a median of 140 turns to clear an arcade
// floor (qa/killhouse-par-study.mjs), so a perfect 13000 asks for better than that.
export const KILLHOUSE_SCORE={formula:'v3',rate:10000,turnBonus:3000,turnCost:30,parTurns:130};
export const KILLHOUSE_MAX_SCORE=KILLHOUSE_SCORE.rate+KILLHOUSE_SCORE.turnBonus;
export const killhouseScore=({rate,turns})=>Math.round(Math.max(0,Math.min(1,rate))*KILLHOUSE_SCORE.rate)+Math.max(0,KILLHOUSE_SCORE.turnBonus-Math.max(0,turns-KILLHOUSE_SCORE.parTurns)*KILLHOUSE_SCORE.turnCost);
export const bestRecord=(profile,result)=>(result.scoreScope==='character'?profile.killhouse?.byCharacter?.[result.character]:profile.killhouse?.best)??null;

const button=(action,label,secondary=false)=>`<button class="modal-button${secondary?' secondary':''}" data-modal="${action}">${label}</button>`;
const entry=(action,label,note,extra='')=>`<button class="title-entry" data-modal="${action}"${extra}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
const characterLabel=id=>CHARACTERS[id]?.label||id;

export const tutorialGateMarkup=()=>`<div class="eyebrow">SIMULATION / NEW INVENTORY</div><h2>${t('gate.title')}</h2>
<p>${t('gate.body')}</p>
<p>${t('gate.skipNote')}</p>
${button('khTutorial',t('gate.enter'))}${button('khSkip',t('gate.skip'),true)}${button('intro',t('controller.backToTitle'),true)}`;

export function killhouseMenuMarkup(profile,characters,locked=[]){
  const k=profile.killhouse,best=k?.best;
  return `<div class="eyebrow">KILL HOUSE / SIMULATION</div><h2>${t('label.training')}</h2>
<p>${t('killhouse-ui.arcadeLine',{record:best?t('killhouse-ui.best',{score:best.score,character:characterLabel(best.character)}):t('killhouse-ui.noArcade'),intro:t('killhouse-ui.arcadeIntro')})}</p>
<nav class="title-menu deploy-menu">${entry('khTutorial','TRAINING',t('menu.tutorial'))}${characters.map(id=>entry('khArcade',`ARCADE · ${characterLabel(id)}`,k?.byCharacter?.[id]?t('killhouse-ui.score',{score:k.byCharacter[id].score}):t('killhouse-ui.noScore',{code:CHARACTERS[id].name.toUpperCase()}),` data-character="${id}"`)).join('')}${locked.map(id=>entry('khArcade',`ARCADE · ${characterLabel(id)}`,t('menu.locked'),' disabled')).join('')}</nav>
${button('intro',t('controller.backToTitle'),true)}`;
}

export function disposedMarkup(result){
  const tutorial=result.mode==='tutorial',restart=tutorial&&result.deathDestination==='restart';
  return `<div class="eyebrow">SIMULATION / INVENTORY DISPOSED</div><h2>${t('disposed.title')}</h2><p>${t(tutorial?'killhouse-ui.disposedTutorial':'killhouse-ui.disposedArcade')}</p>
${restart?button('khTutorial',t('disposed.restart')):''}${tutorial?'':button('khRetry',t('disposed.retry'))+button('killhouse',t('disposed.changeClass'),true)}${button('khMenu',t('killhouse-ui.menuPlain'),!tutorial||restart)}`;
}

// The tutorial never grades the purge: every graduate is screened in and judged later (user decision, 3.88.2).
export const TUTORIAL_VERDICT={status:t('verdict.pass'),note:t('verdict.pending')};
export const tutorialResultMarkup=(g,{saved})=>`<div class="eyebrow">SIMULATION COMPLETE / KILL HOUSE</div><h2>${t('result.trainingOver')}</h2><p>${t('result.submitted')}</p><dl class="purge-report" data-verdict="screened"><dt>${t('result.unit')}</dt><dd>${t('result.unitEnded',{v:cloneDesignation(g.runId)})}</dd><dt>${t('result.status')}</dt><dd>${TUTORIAL_VERDICT.status}</dd><dt>${t('result.remarks')}</dt><dd>${TUTORIAL_VERDICT.note}</dd></dl>
${saved?'':t('result.notSaved')}${button('deploy',t('result.toDeploy'))}${button('khMenu',t('killhouse-ui.menuPlain'),true)}`;

// Arcade verdicts follow the score, not the campaign purge tiers (user decisions, 3.89.2). A perfect 13000 — every
// target purged within par — earns its own warning.
export const ARCADE_VERDICTS=[{min:KILLHOUSE_MAX_SCORE,verdict:'overpowered',status:t('verdict.tooStrong')},{min:10000,verdict:'deploy',status:t('verdict.deploy')},{min:6000,verdict:'pending',status:t('verdict.review')},{min:0,verdict:'dispose',status:t('verdict.destroy')}];
export const arcadeVerdict=score=>ARCADE_VERDICTS.find(v=>score>=v.min)||ARCADE_VERDICTS.at(-1);

export function arcadeResultMarkup(g,{score,best,newRecord,saved}){
  const r=g.simulationResult,scope=r.scoreScope==='character'?t('scope.class'):t('scope.all'),v=arcadeVerdict(score);
  return `<div class="eyebrow">KILL HOUSE / ARCADE · ${characterLabel(r.character)}</div><h2>${newRecord?t('arcade.newRecord'):t('arcade.over')}</h2>
<div class="result-stats"><div><b>${score}</b>${t('arcade.score')}</div><div><b>${Math.round(r.rate*100)}%</b>${t('arcade.purge')}</div><div><b>${r.turns}</b>${t('arcade.turns')}</div></div>
<p>${best===null?t('arcade.noRecord'):`${t('arcade.best',{scope,best})}`}${saved?'':t('arcade.notSaved')}</p><dl class="purge-report" data-verdict="${v.verdict}"><dt>${t('result.unit')}</dt><dd>${t('result.unitEnded',{v:cloneDesignation(g.runId)})}</dd><dt>${t('result.status')}</dt><dd>${v.status}</dd></dl>
${button('khRetry',t('disposed.retry'))}${button('killhouse',t('disposed.changeClass'),true)}${button('khMenu',t('killhouse-ui.menuPlain'),true)}`;
}
