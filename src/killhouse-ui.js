import {cloneDesignation} from './purge-review.js';
import {CHARACTERS} from './characters.js';

// Kill house interface copy and arcade scoring (docs/KILLHOUSE.md section 10, Claude, 3.88.0).
// Rules and records live in killhouse*.js; this module only words, weighs and lays them out.

// One prompt per tutorial room, in recipe order (room 4 holds the researcher).
export const TUTORIAL_PROMPTS=[
  {title:'移動與掩體',text:'用方向鈕、WASD 或點相鄰格移動。掩體只擋從它那一側射來的攻擊：讓掩體夾在你和敵人之間才有效。'},
  {title:'射擊',text:'點敵人鎖定，浮卡會顯示命中率，再按開火。距離、目標的掩體與暗處都會壓低命中。'},
  {title:'蓄勢預告',text:'敵人頭上出現「!」，代表下一次行動會射向鎖定的位置。離開那一格，或按等待進入防禦待機，直接傷害減半。'},
  {title:'門與投擲物',text:'朝關著的門移動，會花 1 回合把門打開。門後有 2 個目標：預備手榴彈後按投擲選落點，爆炸不吃掩體減傷。'},
  {title:'非戰鬥人員',text:'本區有研究員。非戰鬥人員同樣列入肅清評估，不要手下留情。'},
  {title:'綜合交戰',text:'清除剩餘目標後走進電梯。模擬程式會在出口提交肅清評估。'}
];
export const ARCADE_PROMPTS={
  armory:'整備區：挑選武器與彈藥，走進電梯開始計分。整備期間不計回合。',
  combat:'訓練場：計分開始。肅清率與使用回合數列入成績，走進撤離點結算。'
};
const PHASE_LABELS={tutorial:'模擬訓練',armory:'整備區',combat:'訓練場'};
export const simulationLabel=g=>`KILL HOUSE · ${PHASE_LABELS[g.simulation.phase]||'模擬'}`;
export const simulationBrief=g=>g.simulation.phase==='tutorial'?'六個區域依序訓練。清除目標後走進電梯，模擬程式會提交肅清評估。':ARCADE_PROMPTS[g.simulation.phase]||'';

// Tutorial rooms open a card the player dismisses; arcade phases only toast on their first room.
export function roomPrompt(event){
  if(event?.type!=='roomEntered')return null;
  if(event.phase==='tutorial'){const p=TUTORIAL_PROMPTS[event.roomId];return p?{modal:true,eyebrow:`SIMULATION / 第 ${event.roomId+1} 區`,...p}:null;}
  const text=(event.firstRoom??event.roomId===0)?ARCADE_PROMPTS[event.phase]:null;
  return text?{modal:false,text}:null;
}
export const roomPromptMarkup=p=>`<div class="eyebrow">${p.eyebrow}</div><h2>${p.title}</h2><p>${p.text}</p><button class="modal-button" data-modal="close">繼續 →</button>`;

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

// Score v2 (3.89.2): purge rate is worth 10000 and speed up to 3000. The speed bonus stays full within par (two turns
// per purge target) and then loses 30 per extra turn, so a perfect run is reachable and scores exactly 13000.
export const KILLHOUSE_SCORE={formula:'v2',rate:10000,turnBonus:3000,turnCost:30,parPerTarget:2};
export const KILLHOUSE_MAX_SCORE=KILLHOUSE_SCORE.rate+KILLHOUSE_SCORE.turnBonus;
export const parTurns=quota=>KILLHOUSE_SCORE.parPerTarget*Math.max(0,quota||0);
export const killhouseScore=({rate,turns,quota=0})=>Math.round(Math.max(0,Math.min(1,rate))*KILLHOUSE_SCORE.rate)+Math.max(0,KILLHOUSE_SCORE.turnBonus-Math.max(0,turns-parTurns(quota))*KILLHOUSE_SCORE.turnCost);
export const bestRecord=(profile,result)=>(result.scoreScope==='character'?profile.killhouse?.byCharacter?.[result.character]:profile.killhouse?.best)??null;

const button=(action,label,secondary=false)=>`<button class="modal-button${secondary?' secondary':''}" data-modal="${action}">${label}</button>`;
const entry=(action,label,note,extra='')=>`<button class="title-entry" data-modal="${action}"${extra}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
const characterLabel=id=>CHARACTERS[id]?.label||id;

export const tutorialGateMarkup=()=>`<div class="eyebrow">SIMULATION / NEW INVENTORY</div><h2>進入模擬訓練？</h2>
<p>新庫存部署前，須先完成 KILL HOUSE 模擬訓練：六個區域、固定士兵配給，不影響戰役與協定點數。</p>
<p>可以跳過；跳過後不再詢問，之後隨時能從主選單的 KILL HOUSE 重新訓練。</p>
${button('khTutorial','進入模擬訓練 →')}${button('khSkip','跳過，直接部署',true)}${button('intro','← 返回主選單',true)}`;

export function killhouseMenuMarkup(profile,characters){
  const k=profile.killhouse,best=k?.best;
  return `<div class="eyebrow">KILL HOUSE / SIMULATION</div><h2>模擬訓練</h2>
<p>${best?`最高分 ${best.score}（${characterLabel(best.character)}）`:'尚無街機紀錄。'}街機模式：整備後進入單層訓練場，沒有升級、掉落與頭目，只記最高分。</p>
<nav class="title-menu deploy-menu">${entry('khTutorial','TRAINING','教學 · 固定士兵')}${characters.map(id=>entry('khArcade',`ARCADE · ${characterLabel(id)}`,k?.byCharacter?.[id]?`最高分 ${k.byCharacter[id].score}`:CHARACTERS[id].name.toUpperCase(),` data-character="${id}"`)).join('')}</nav>
${button('intro','← 返回主選單',true)}`;
}

export function disposedMarkup(result){
  const tutorial=result.mode==='tutorial',restart=tutorial&&result.deathDestination==='restart';
  return `<div class="eyebrow">SIMULATION / INVENTORY DISPOSED</div><h2>銷毀此庫存</h2><p>模擬中陣亡。此庫存判定不合格，已銷毀；${tutorial?'訓練紀錄不保存。':'本次成績不列入紀錄。'}</p>
${restart?button('khTutorial','重新開始訓練 →'):''}${tutorial?'':button('khRetry','再次模擬 →')+button('killhouse','更換職業',true)}${button('khMenu','返回主選單',!tutorial||restart)}`;
}

// The tutorial never grades the purge: every graduate is screened in and judged later (user decision, 3.88.2).
export const TUTORIAL_VERDICT={status:'篩選合格',note:'後續績效尚待評估'};
export const tutorialResultMarkup=(g,{saved})=>`<div class="eyebrow">SIMULATION COMPLETE / KILL HOUSE</div><h2>模擬訓練結束。</h2><p>訓練紀錄已提交。</p><dl class="purge-report" data-verdict="screened"><dt>單位</dt><dd>${cloneDesignation(g.runId)} 模擬結束</dd><dt>狀態</dt><dd>${TUTORIAL_VERDICT.status}</dd><dt>備註</dt><dd>${TUTORIAL_VERDICT.note}</dd></dl>
${saved?'':'<p class="deploy-warning">! 無法寫入訓練紀錄，下次部署仍會詢問是否訓練。</p>'}${button('deploy','前往部署 →')}${button('khMenu','返回主選單',true)}`;

// Arcade verdicts follow the score, not the campaign purge tiers (user decisions, 3.89.2). A perfect 13000 — every
// target purged within par — earns its own warning.
export const ARCADE_VERDICTS=[{min:KILLHOUSE_MAX_SCORE,verdict:'overpowered',status:'受驗者過於強大，建議及早投入最危險的任務或就地銷毀'},{min:10000,verdict:'deploy',status:'建議直接投入實戰'},{min:6000,verdict:'pending',status:'尚待評估'},{min:0,verdict:'dispose',status:'建議銷毀'}];
export const arcadeVerdict=score=>ARCADE_VERDICTS.find(v=>score>=v.min)||ARCADE_VERDICTS.at(-1);

export function arcadeResultMarkup(g,{score,best,newRecord,saved}){
  const r=g.simulationResult,scope=r.scoreScope==='character'?'本職業':'全職業',v=arcadeVerdict(score);
  return `<div class="eyebrow">KILL HOUSE / ARCADE · ${characterLabel(r.character)}</div><h2>${newRecord?'新紀錄。':'模擬結束。'}</h2>
<div class="result-stats"><div><b>${score}</b>分數</div><div><b>${Math.round(r.rate*100)}%</b>肅清率</div><div><b>${r.turns}</b>使用回合</div></div>
<p>${best===null?'尚無紀錄':`${scope}最高分 ${best}`}${saved?'':' · 無法寫入紀錄'}</p><dl class="purge-report" data-verdict="${v.verdict}"><dt>單位</dt><dd>${cloneDesignation(g.runId)} 模擬結束</dd><dt>狀態</dt><dd>${v.status}</dd></dl>
${button('khRetry','再次模擬 →')}${button('killhouse','更換職業',true)}${button('khMenu','返回主選單',true)}`;
}
