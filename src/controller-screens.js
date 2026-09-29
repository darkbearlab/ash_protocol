// Menus and records: the log, mission, briefing and map, unlocks, level-up and perks, the journal and bestiary, the
// field manual, run results and the kill house's prompts and results.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {sentences,t} from './i18n.js';
import {STORIES} from './story-data.js';
import {GLITCH_TUNING} from './signal-glitch.js';
import {availableCharacters,unlockEntry} from './unlock-catalog.js';
import {grantUnlock,profile,saveArcadeResult,saveTutorialOutcome,storage} from './storage.js';
import {UNLOCK_HELP,purchaseConfirmMarkup,purchaseReason,resultStoriesMarkup,storyReaderMarkup,unlockPageMarkup} from './unlock-ui.js';
import {TRAITS,healingAmount,startingTraits,traitLabels} from './traits.js';
import {CARRY_DISTANCE} from './allies.js';
import {suppressionHelp,traitRuleLines} from './suppression-ui.js';
import {TINY_TEXT,drawTinyText} from './pixel-text.js';
import {combatStatSummary} from './actor-stats.js';
import {MISSIONS,missionDefinition,missionDepth} from './missions.js';
import {TERMINAL_TUNING} from './terminal.js';
import {portraitMarkup} from './portraits.js';
import {CHARACTERS,characterName,startingSupplies} from './characters.js';
import {PREPARED_CATALOG} from './prepared.js';
import {resultCopy} from './result-copy.js';
import {GRAPPLE_RANGE,MELEE_TUNING} from './melee-classes.js';
import {meleeSummary} from './melee-ui.js';
import {isEndless} from './endless.js';
import {endlessRecordRows,endlessRules,isRecordRun,levelCapRules} from './endless-ui.js';
import {purgeReportMarkup} from './purge-review-ui.js';
import {ENEMY_TYPES,PERKS,enemyName,floorInfo,isSimulation,protocolSettlement} from './engine.js';
import {KILLHOUSE_SCORE,arcadeResultMarkup,bestRecord,disposedMarkup,killhouseScore,nextPrompt,roomPromptMarkup,simulationBrief,simulationLabel,tutorialResultMarkup} from './killhouse-ui.js';
import {PACK_LIMIT} from './data.js';
import {VERSION} from './version.js';
import {DIFFICULTY_OPTIONS,difficultyOption} from './deploy-ui.js';
import {armComms,commsLine,commsMarkup,dutySpeaker} from './comms.js';
import {courseActive} from './course.js';
import {COURSE_RESULT_LINE} from './course-script.js';
import {factionDef} from './faction-catalog.js';
import {LINE_TUNING} from './lines.js';
import {enemyGlyph,floorTraitNote} from './enemy-visuals.js';
import {runLogFor} from './run-log.js';
import {$,audio,escapeHTML,exitSimulation,game,modal,pad,renderer,setTitleFlow,simulationResults,titleFlow,transmissionKey,transmissionSeen} from './controller.js';
import {endOutro} from './controller-comms.js';
import {MISSION_NOTES,drawOperatorSprites,runIsLive,showIntro} from './controller-deploy.js';
import {notify} from './controller-hud.js';
// Every line of the run (latest 50), newest first; a new turn starts a new block.
export function showLog(){
  const rows=game.logs.map((l,i)=>`<li class="${[l.danger?'danger':'',i&&game.logs[i-1].turn!==l.turn?'new-turn':''].join(' ').trim()}"><b>${String(l.turn).padStart(3,'0')}</b><span>${escapeHTML(l.text)}</span></li>`).join('');
  modal(`<div class="eyebrow">${t('controller.log.eyebrow')}</div><h2>${t('controller.log.title',{logsLength:game.logs.length})}</h2><ol class="combat-log">${rows||t('controller.log.empty')}</ol><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`);
}
function missionDetails(){
  if(isSimulation(game))return `<p><strong>${simulationLabel(game)}</strong><br>${simulationBrief(game)}</p>`;
  const def=missionDefinition(game);
  const targets=game.floor===missionDepth(game)?game.mission.targets.map((target,i)=>{
    const e=game.enemies.find(e=>e.id===target.id),done=def.kind==='recover'?target.done:e?.hp<=0;
    const known=def.kind==='recover'?game.seen[target.y]?.[target.x]:e&&game.visible(e);
    return `<p>${done?'✓':'◇'} ${i+1}. ${done?t('controller.mission.done'):known?def.kind==='recover'?t('controller.mission.dataFound'):enemyName(e):t('controller.mission.notLocated')}${!done&&known?t('controller.mission.seeMap'):''}</p>`;
  }).join(''):'';
  return `<p><strong>${game.missionSummary}</strong><br>${def.text}</p>${targets}`;
}
export function showMission(){if(isSimulation(game)){modal(`<div class="eyebrow">SIMULATION / KILL HOUSE</div><h2>${simulationLabel(game)}</h2>${missionDetails()}<button class="modal-button" data-modal="close">${t('controller.backToSim')}</button>`);return;}modal(`<div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2>${floorInfo(game.floor).name}</h2>${missionDetails()}<p>${isEndless(game)?endlessRules({intro:false}):t('controller.mission.help')}</p><button class="modal-button" data-modal="close">${t('controller.backToFieldPlain')}</button>`);}
// Mission briefing (3.168.0, user request): a near full-screen card when a new mission starts, with the controller's
// channel above it. Resuming a run, the kill house and replays go straight to the field; the mission title still opens
// the shorter briefing (showMission) at any time.
export function showBriefing(){
  const def=missionDefinition(game),difficulty=difficultyOption(game.difficulty).name;
  const rows=[['briefing.objective',sentences(def.text,MISSION_NOTES[game.mission.id])],['briefing.facility',factionDef(game.facilityFaction)?.name||''],['briefing.difficulty',game.realMode?`${difficulty} · ${t('controller.deploy.realMode')}`:difficulty]].filter(([,v])=>v);
  modal(`<div class="briefing">${commsMarkup(commsLine(dutySpeaker({game}),'briefing')||{line:'comms.briefing'},{context:{game}})}<section class="briefing-card" aria-labelledby="briefing-title"><div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2 id="briefing-title">${def.name}</h2><p class="briefing-sector">${floorInfo(game.floor).name}</p><dl class="briefing-rows">${rows.map(([k,v])=>`<dt>${t(k)}</dt><dd>${v}</dd>`).join('')}</dl></section></div><div class="modal-footer"><button class="modal-button" data-modal="close">${t('briefing.start')}</button></div>`);
  armComms($('#modal-content .comms'));
}
export function showMap(){modal(`<div class="eyebrow">SECTOR ${pad(game.floor)} / ${isSimulation(game)?'KILL HOUSE':floorInfo(game.floor).name}</div><h2>${t('controller.map.title')}</h2>${missionDetails()}<canvas id="overview" width="324" height="324" aria-label="${t('controller.map.aria')}"></canvas><p>${t('controller.map.legend1')}<br>${t('controller.map.legend2')}${game.survival?`<br>${t('controller.map.survivalLegend')}`:''}</p><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`);renderer.drawMap($('#overview'));}
// Unlock page and corpse recovery (docs/UNLOCKS.md section 8, Claude 3.90.1). Writes go through storage.grantUnlock and Game.recoverOperator only.
let unlockTab='characters';
const unlockStorageReady=()=>storage.available&&!storage.recoveryPending;
export function showUnlocks(tab=unlockTab,message=''){unlockTab=tab==='stories'?'stories':'characters';modal(unlockPageMarkup(profile(),{tab:unlockTab,message,available:unlockStorageReady()}),true);drawOperatorSprites();}
function unlockRefusal(id){const entry=unlockEntry(id),reason=entry&&purchaseReason(profile(),entry,{available:unlockStorageReady()});if(entry&&!reason)return false;showUnlocks(unlockTab,reason?reason+t('controller.period'):'');return true;}
export function confirmUnlock(id){if(!unlockRefusal(id))modal(purchaseConfirmMarkup(profile(),id),true);}
export function buyUnlock(id){if(unlockRefusal(id))return;const entry=unlockEntry(id);
  if(!grantUnlock(game,id)){showUnlocks(unlockTab,t('controller.unlock.writeFailed'));return;}
  showUnlocks(entry.kind==='story'?'stories':'characters',entry.kind==='story'?`${t('controller.unlock.story',{title:entry.title})}`:`${t('controller.unlock.class',{label:CHARACTERS[id].label})}`);}
function perkPips(player,perk,preview=false){
  const n=player.perks?.[perk.id]||0;
  if(perk.cap===null)return `<span class="perk-pips" role="img" aria-label="${t(preview?'controller.perkTakenPreview':'controller.perkTaken',{n,next:n+1})}"><span aria-hidden="true">×${n}</span></span>`;
  const total=Math.max(perk.cap,n+(preview?1:0)),shown=Math.min(total,32);
  const dots=Array.from({length:shown},(_,i)=>i<n?'●':preview&&i===n?'<span class="perk-next">◉</span>':'○').join('');
  return `<span class="perk-pips" role="img" aria-label="${t(preview?'controller.perkRankPreview':'controller.perkRank',{n,cap:perk.cap,next:n+1})}"><span aria-hidden="true">${dots}${total>shown?' ×'+total:''}</span></span>`;
}
export function runPerks(){
  const acquired=PERKS.filter(o=>(game.player.perks?.[o.id]||0)>0);
  return acquired.length?`<section class="run-perks" aria-label="${t('controller.perks.runTitle')}"><h3>${t('controller.perks.runTitle')}</h3><ul>${acquired.map(o=>`<li><span>${o.name}</span>${perkPips(game.player,o)}</li>`).join('')}</ul></section>`:'';
}
// Level-up (3.115.0, user request): the award first lands as an incoming transmission over the battlefield, and the three
// choices open only once it is confirmed. Once per level of a run, so a second pending choice goes straight to the list.
export function showLevelUp(){
  if(transmissionSeen===transmissionKey()){showPerks();return;}
  if($('#modal').open&&$('#modal-content .transmission'))return;   // already on screen; do not restart its animation
  modal(`<div class="transmission" role="alert"><div class="eyebrow">PRIORITY SIGNAL / LV. ${game.player.level}</div><p class="transmission-title"><canvas class="transmission-pixels" aria-hidden="true"></canvas><span class="visually-hidden">INCOMING TRANSMISSION</span></p><p class="transmission-note">${t('controller.perks.pending')}</p></div><div class="modal-footer"><button class="modal-button" data-modal="transmission">${t('controller.confirm')}</button></div>`);
  // 3.116.0 (user request): the heading is drawn as pixel letters (src/pixel-text.js) instead of a smooth font.
  // 3.117.0 (user correction): tiny real text with hard pixels, redrawn once the webfont has loaded.
  const draw=()=>{const heading=$('#modal .transmission-pixels');if(heading)drawTinyText(heading,'INCOMING TRANSMISSION',{color:'#f0c27a',shadow:'#3a2412'});};
  draw();document.fonts?.load?.(`${TINY_TEXT.weight} ${TINY_TEXT.px}px ${TINY_TEXT.font}`).then(draw,()=>{});
  audio.play('transmission');
  // 3.149.0: the transmission comes in through interference, on the battlefield and on the message itself.
  if(renderer.glitchEnabled){
    const T=GLITCH_TUNING.transmission,box=$('#modal-content'),flash=(burst,ms)=>{renderer.glitchBurst(burst);box?.classList.remove('ui-glitch');void box?.offsetWidth;box?.classList.add('ui-glitch');setTimeout(()=>box?.classList.remove('ui-glitch'),ms);};
    flash(T,T.ms);setTimeout(()=>{if(renderer.glitchEnabled&&$('#modal-content .transmission'))flash(T.again,T.again.ms);},T.again.at);   // 3.150.0 (user): one more flash
  }
}
export function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>${t('controller.perks.granted')}</h2><p>${t('controller.perks.untilEnd',{v:game.pendingPerks>1?`${t('controller.perks.morePicks',{pendingPerks:game.pendingPerks})}`:''})}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>${t('controller.perks.option',{pName:p.name,v:perkPips(game.player,p,true)})}</strong><span>${p.text}${p.effect==='health'?`${t('controller.perks.classHeal',{v:healingAmount(game.player,p.heal)})}`:''}</span></button>`).join('')}${runPerks()}`);}
// Journal and result: endless records (3.49.1), class names from the character labels.
const classLabels=()=>Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,c.label]));
function endlessJournal(records){const rows=endlessRecordRows(records,classLabels());
  return `<h3>${t('controller.endless.title')}</h3><p>${rows.best?`${t('controller.endless.best',{best:rows.best,v:rows.classes.length?`<br>${t('controller.endless.classBest',{v:rows.classes.join(' · ')})}`:''})}`:t('controller.endless.none')}</p>`;}
function endlessResult(p,abandoned){if(abandoned)return t('controller.endless.abandoned');const records=profile(),rows=endlessRecordRows(records,classLabels());
  return rows.best?`<p>${t('controller.endless.bestLine',{v:isRecordRun(records,game.floor,p.level,p.kills)?t('controller.endless.newRecord'):'',best:rows.best})}</p>`:'';}
// Operator stats, run upgrades and passive rules moved here from the compact backpack (3.97.0).
function operatorStatus(){const p=game.player;return `<h3>${t('controller.status.title')}</h3><p>${t('controller.status.armor',{v:characterName(p.character),armor:p.armor})}<br>${combatStatSummary(p)}${meleeSummary(p).map(line=>'<br>'+line).join('')}</p>${runPerks()}<h3>${t('controller.status.passives')}</h3><p>${t('controller.status.passivesLine',{v:traitLabels(p).join(' · ')||t('controller.none')})}<br>${traitRuleLines(p).join('<br>')}<br>${t('controller.status.passivesNote')}</p>`;}
export function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>${t('controller.journal.title')}</h2><div class="journal-tabs"><button data-modal="journal">${t('controller.journal.missions')}</button><button data-modal="bestiary">${t('controller.journal.bestiary')}</button><button data-modal="help">${t('controller.journal.manual')}</button></div><p>${game.missionSummary}</p>${runIsLive()?operatorStatus():''}<div class="result-stats"><div><b>${records.runs}</b>${t('controller.journal.runs')}</div><div><b>${records.wins}</b>${t('controller.journal.wins')}</div><div><b>${records.bestFloor}/6</b>${t('controller.journal.deepest')}</div></div><h3>${t('controller.journal.protocol',{balance:records.protocol.balance})}</h3><p>${t('controller.journal.protocolNote',{earned:game.protocol.earned,v:availableCharacters(records).length})}</p>${endlessJournal(records)}<h3>${t('controller.journal.pending',{v:(game.pendingStories||[]).length})}</h3>${(game.pendingStories||[]).map(id=>{const story=STORIES.find(s=>s.id===id);return story?storyReaderMarkup(story,''):`<p class="lore-entry"><strong>${t('controller.journal.archived')}</strong></p>`;}).join('')}<h3>${t('controller.journal.recent')}</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>${t('controller.journal.row',{v:MISSIONS[r.mission]?.name||MISSIONS.extraction.name,v2:characterName(r.character),seed:r.seed,v3:r.outcome==='abandoned'?t('controller.journal.abandoned'):r.won?t('controller.journal.extracted'):t('controller.journal.died'),v4:r.realMode?t('controller.journal.real'):'',floor:r.floor,v5:Number.isInteger(r.level)?` · LV.${pad(r.level)}`:'',kills:r.kills,turn:r.turn,v6:Array.isArray(r.mapGenerations)&&r.mapGenerations.length?` ${t('controller.journal.mapVersion',{v:r.mapGenerations.join('/')})}`:''})}</p>`).join(''):t('controller.journal.noRuns')}<button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);}
// The codex names cards the way the current facility does (3.103.1, user request), so 步槍兵 in play is 步槍兵 here.
// A variant still hides behind its parent when either the base or the facing name matches, which is what kept the
// armoured and elite cards out of the list before the factions had their own names.
export function bestiary(){const codexName=id=>enemyName({type:id,faction:game.facilityFaction});
 modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>${t('controller.bestiary.title')}</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).filter(([id,e])=>!e.variantOf||(e.name!==ENEMY_TYPES[e.variantOf].name&&codexName(id)!==codexName(e.variantOf))).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${enemyGlyph(id)}</span><div><h3>${codexName(id)}</h3><small>${t('controller.bestiary.stats',{hp:e.hp,range:e.range,armor:e.armor})}</small><p>${e.role}</p><p>${traitLabels({traits:startingTraits(id,game.floor)}).join(' · ')||t('controller.bestiary.noPassives')}${floorTraitNote(id,TRAITS)}</p></div></article>`).join('')}</div><h3>${t('controller.status.passives')}</h3>${Object.values(TRAITS).map(tr=>`<p><strong>${tr.name}</strong>${t('controller.bestiary.traitText',{trText:tr.text})}</p>`).join('')}<p>${t('controller.bestiary.rulesNote')}</p><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);}
// 3.157.0: gear a class starts with beyond medkits and throwables (the ninja's decoys, mines and lines), for the operator list.
export const startingKit=id=>{const s=startingSupplies(id),kit=Object.values(PREPARED_CATALOG.item).filter(e=>e.resource&&e.resource!=='meds'&&s[e.resource]>0);return kit.length?' · '+kit.map(e=>`${e.short} ×${s[e.resource]}`).join(t('controller.slash')):'';};
export function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD ${VERSION}</div><h2>${t('manual.title')}</h2><p>${t('manual.intro')}</p><div class="help-grid"><b>${t('manual.directionsTitle')}</b><span>${t('manual.directions')}</span><b>${t('manual.fireTitle')}</b><span>${t('manual.fire')}</span><b>${t('manual.classesTitle')}</b><span>${t('manual.classes')}</span>${['soldier','recon','engineer','bulwark','berserker','ninja'].map(id=>`<b>${CHARACTERS[id].label}</b><span>${t(`manual.class.${id}`,{allies:t('manual.alliesTitle'),range:GRAPPLE_RANGE,ambush:MELEE_TUNING.ambush})}</span>`).join('')}<b>${t('manual.alliesTitle')}</b><span>${t('manual.allies',{carry:CARRY_DISTANCE})}</span><b>${t('manual.doorsTitle')}</b><span>${t('manual.doors')}</span><b>${t('manual.coverTitle')}</b><span>${t('manual.cover')}</span><b>${t('manual.orderTitle')}</b><span>${t('manual.order')}</span><b>${t('manual.endlessTitle')}</b><span>${endlessRules()} ${levelCapRules()}</span><b>${t('manual.unlockTitle')}</b><span>${UNLOCK_HELP}</span><b>${t('manual.lightTitle')}</b><span>${t('manual.light')}</span><b>${t('manual.hitTitle')}</b><span>${t('manual.hit')}</span><b>${t('manual.grenadeTitle')}</b><span>${t('manual.grenade')}</span><b>${t('manual.bagTitle')}</b><span>${t('manual.bag',{packLimit:PACK_LIMIT})}</span><b>${t('manual.supplyTitle')}</b><span>${t('manual.supply',{credit:TERMINAL_TUNING.credit,lineRange:LINE_TUNING.range})}</span><b>${t('manual.pursuitTitle')}</b><span>${t('manual.pursuit')}</span><b>${t('manual.suppressTitle')}</b><span>${suppressionHelp()}</span><b>${t('manual.dangerTitle')}</b><span>${t('manual.danger')}</span><b>${t('manual.exitTitle')}</b><span>${t('manual.exit')}</span><b>${t('manual.saveTitle')}</b><span>${t('manual.save')}</span></div><button class="modal-button" data-modal="close">${t('manual.close')}</button>`,true);}
// The result sheet reports on a run that is over, so it belongs to the title flow as well (3.98.1, user request):
// full screen and back up at the top, not a bottom sheet with the finished battle showing above it. 查看最後戰場
// is still how you look at the map.
// The results are the last part of a run's end (3.177.0, src/outro.js): the officer has already spoken, on the field and
// on the dark screen. Opening them stops whatever of that is still playing; reopening them later is just the report.
// 3.186.0 (user request): the mode, the seed and the run's operation log (src/run-log.js), so the run can be replayed.
function runRecordMarkup(g){
  const log=runLogFor(g),difficulty=DIFFICULTY_OPTIONS.find(o=>o.curve===g.difficulty)?.name??g.difficulty;
  const line=t('controller.result.record',{mission:MISSIONS[g.mission.id]?.name??g.mission.id,difficulty,real:g.realMode?t('controller.result.recordReal'):'',faction:factionDef(g.facilityFaction)?.name??g.facilityFaction,seed:g.seed,build:VERSION});
  const note=!log?t('controller.runLog.none'):log.partial?t('controller.runLog.partial',{turn:log.partial}):'';
  return `<p class="result-record">${escapeHTML(line)}${note?`<br>${escapeHTML(note)}`:''}</p>${log?`<div class="modal-row"><button class="modal-button secondary" data-modal="runLog">${t('controller.runLog.download')}</button></div>`:''}`;
}
export function showResult(){endOutro();setTitleFlow(true);if(isSimulation(game)){showSimulationResult();return;}const won=game.status==='won',abandoned=game.status==='abandoned',p=game.player,copy=resultCopy(game);modal(`<div class="eyebrow">${copy.eyebrow} / RUN ${game.seed}${game.realMode?' / REAL':''}</div><h2>${copy.title}</h2><p>${copy.body}</p><p>${game.missionSummary}</p><div class="operator-identity result-identity">${portraitMarkup(p.portrait,game.status)}<p>${characterName(p.character)}<br>${t('controller.result.stats',{damage:p.stats.damage,grenades:p.stats.grenades,loreLength:p.lore.length})}</p></div>${purgeReportMarkup(game)}${resultStoriesMarkup(game,profile())}${isEndless(game)?`<div class="result-stats"><div><b>${pad(game.floor)}</b>${t('controller.result.depth')}</div><div><b>${pad(p.level)}</b>${t('controller.result.level')}</div><div><b>${p.kills}</b>${t('controller.result.kills')}</div></div>${endlessResult(p,abandoned)}<p>${t('controller.result.turns',{turn:game.turn})}</p>`:`<div class="result-stats"><div><b>${pad(game.deepestFloor)}</b>${t('controller.result.deepest')}</div><div><b>${p.kills}</b>${t('controller.result.kills')}</div><div><b>${game.turn}</b>${t('controller.result.turnCount')}</div></div>`}<p>${t('controller.result.protocolTotal',{v:game.realMode?`${t('controller.result.realProtocol',{v:protocolSettlement(game).base,v2:protocolSettlement(game).bonus})}`:`${t('controller.result.protocol',{earned:game.protocol.earned})}`,v2:profile().protocol.balance})}</p>${runRecordMarkup(game)}<div class="modal-footer"><button class="modal-button secondary" data-modal="lastBattle">${t('controller.result.lastBattle')}</button>${game.status==='dead'?t('controller.result.deadButtons'):t('controller.result.redeploy')}</div>`);}
// Cards already shown in this session; tutorial cards fire on the tile before a door, before the room's own entry event.
export const promptLogs=new WeakMap(),promptLog=g=>{if(!promptLogs.has(g))promptLogs.set(g,new Set());return promptLogs.get(g);};
export function showRoomPrompt(){const prompt=nextPrompt(game,game.takeRoomEvents(),promptLog(game));if(!prompt)return;if(prompt.modal)modal(roomPromptMarkup(prompt));else notify(prompt.text);}
// Records are written once per finished session; reopening the result reuses the same screen.
function simulationResultMarkup(){
  const r=game.simulationResult;
  if(r.outcome==='dead')return disposedMarkup(r);
  if(r.outcome!=='won')return null;
  if(r.mode==='tutorial'){const html=tutorialResultMarkup(game,{saved:saveTutorialOutcome('completed')});return courseActive(game)?`<div class="course-result">${commsMarkup(COURSE_RESULT_LINE,{timer:false,context:{game}})}</div>${html}`:html;}
  const score=killhouseScore(r),before=bestRecord(profile(),r)?.score??null;let saved=false;
  try{saved=saveArcadeResult(game,score,KILLHOUSE_SCORE.formula);}catch{saved=false;}
  const best=bestRecord(profile(),r)?.score??null;
  return arcadeResultMarkup(game,{score,best,newRecord:saved&&best===score&&(before===null||score>before),saved});
}
function showSimulationResult(){
  if(!simulationResults.has(game))simulationResults.set(game,simulationResultMarkup());
  const html=simulationResults.get(game);if(!html){exitSimulation();showIntro();return;}modal(html);
}
