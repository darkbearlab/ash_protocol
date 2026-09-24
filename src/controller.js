import {t,sentences,language,languageChoice,LANGUAGES,LANGUAGE_NAMES,LANGUAGE_STATUS} from './i18n.js';
import {localizeDocument} from './localize-dom.js';
import {STORIES} from './story-data.js';
import {playerCalloutEvent} from './callouts.js';
import {GLITCH_TUNING} from './signal-glitch.js';
import {availableCharacters,unlockEntry,CHARACTER_IDS,shelvedCharacter} from './unlock-catalog.js';
import {connectUnlocks,startCampaign,startKillhouse,grantUnlock} from './storage.js';
import {unlockPageMarkup,purchaseReason,purchaseConfirmMarkup,operatorRecoveredMarkup,resultStoriesMarkup,lockedOperatorRow,operatorSignal,UNLOCK_HELP} from './unlock-ui.js';
import {isNoncombatant} from './enemy-data.js';
import {healingAmount} from './traits.js';
import {UNIT_BLUEPRINTS,isBlueprintLog,buildReason,deployReason,deployedUnits,mountableSlots,repairReason,repairTargets} from './workshop.js';
import {ALLY_SKILLS,allySkillState,canAllySkill,allyName,allyWeapon,droneCells,defaultDroneCell,deployLimit,lineLimit,CARRY_DISTANCE,ENEMY_UNIT_TUNING,bombardDamage,REPAIR_TUNING} from './allies.js';
import {petFeedingState,petFeedQuote,outputChoiceReason} from './pet-growth.js';
import {feedingView,petStatusLine,petOutputLine,fuelLabel,fuelPercent,lineProgress,nodeSymbol,nextNode,unlockedMajors,abilityChips,PET_LINE_NAMES,PET_LINE_TINTS} from './pet-ui.js';
import {learningInventory} from './learning.js';
import {LEARNING_ITEMS,LEARNING_SCRAP} from './learning-data.js';
import {suppressivePreview} from './suppressive-fire.js';
import {suppressionStatus,learningEntries,suppressionHelp,traitRuleLines} from './suppression-ui.js';
import {SKILLS,skillActive,skillStatus,canUseSkill,skillText} from './skills.js';
import {timedStatuses} from './status-timers.js';
import {blindReason,BLIND_TUNING} from './blind-fire.js';
import {weaponBand,bandLabel} from './range-band.js';
import {boundaryOpacityPercent} from './movement-boundaries.js';
import {SCREEN_BRIGHTNESS,screenBrightnessPercent} from './screen-tone.js';
import {drawTinyText,TINY_TEXT} from './pixel-text.js';
import {actorStat,clampHit,combatStatSummary} from './actor-stats.js';
import {isDark} from './lighting.js';
import {missionDepth,returning,MISSIONS,RANDOM_MISSION_IDS,validMissionId,missionDefinition,missionProgress} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {ammoName,magazineLabel,salvageValue} from './weapons.js';
import {pelletChance} from './shotgun.js';
import {TERMINAL_TUNING,TERMINAL_PACK,terminalCost,terminalDeal,terminalRemaining,tradeHoldings,offerReason,terminalSells,terminalName} from './terminal.js';
import {deploymentPortraits,portraitMarkup,validPortrait} from './portraits.js';
import {CHARACTERS,validCharacter,characterName,startingSupplies,classCarryBonus} from './characters.js';
import {PREPARED_CATEGORIES,PREPARED_CATALOG,preparedOptions,preparedEntry,CAPPED_ITEMS} from './prepared.js';
import {levelCost} from './perks.js';
import {resultCopy,retryPlan} from './result-copy.js';
import {isBarrier,barrierFace} from './barriers.js';
import {GRENADES,grenadeTotal} from './throwables.js';
import {MELEE_TUNING,GRAPPLE_RANGE} from './melee-classes.js';
import {grappleLabel,meleeSummary,meleeStatus} from './melee-ui.js';
import {DEFAULT_OPERATOR_COLOR,validOperatorColor,tintedSprite} from './operator-color.js';
import {colorPickerMarkup,mountColorPicker} from './color-picker.js';
import {classSpriteRect} from './class-art.js';
import {ENDLESS_DISPLAY_FLOORS,isEndless} from './endless.js';
import {depthLabel,levelLabel,levelTitle,endlessRules,levelCapRules,endlessRecordRows,isRecordRun,growthLabel,endlessFloorText} from './endless-ui.js';
import {purgeReportMarkup} from './purge-review-ui.js';
import {isSimulation,tutorialGate} from './engine.js';
import {saveTutorialOutcome,saveArcadeResult} from './storage.js';
import {exitStep,nextPrompt,promptDue,roomPromptMarkup,tutorialGateMarkup,killhouseMenuMarkup,disposedMarkup,tutorialResultMarkup,arcadeResultMarkup,killhouseScore,bestRecord,KILLHOUSE_SCORE,simulationLabel,simulationBrief} from './killhouse-ui.js';
import {PACK_LIMIT} from './data.js';
import {dailySeed,dailyMission} from './daily.js';
import {VERSION} from './version.js';
import {TRAITS,traitLabels,startingTraits,initiative} from './traits.js';
import {AMMUNITION,AMMO_IDS,MELEE_TINT,capacity,TERMINAL_AMMO} from './ammunition.js';
import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,WEAPONS,floorInfo,PERKS,ENEMY_TYPES,enemyName,distance,protocolSettlement,itemUseReason,deployCoverReason,TERMINAL_ITEMS} from './engine.js';
import {DIFFICULTY_OPTIONS,difficultyOption,difficultyMeta,realModeMeta,REAL_MODE_NOTE,runOptions,FACILITY_OPTIONS,facilityOption} from './deploy-ui.js';
import {commsMarkup,armComms,commsForLogs,commsLine,dutySpeaker} from './comms.js';
import {KIA_TUNING,kiaTimes,kiaTimeScale,kiaZoom,kiaSeconds,kiaBurst} from './kia.js';
import {OUTRO_TUNING,outroPlan} from './outro.js';
import {GORE_SETTINGS,validGoreSetting,goreLevel} from './gore.js';
import {commsEvents,commsSnapshot,newCommsMemory} from './comms-events.js';
import {validDuty} from './duty.js';
import {factionDef} from './faction-catalog.js';
import {Renderer} from './render.js';
import {AudioEngine,AUDIO_TUNING,volumePercent} from './audio.js';
import {GRIT_LEVELS,gritLevel} from './audio-grit.js';
import {frameRate,nextFrameRate} from './frame-rate.js';
import {FLARE_TUNING,flareReason} from './flares.js';
import {DECOY_TUNING,MINE_TUNING,EXO_TUNING,placeStart} from './field-gear.js';
import {LINE_TUNING} from './lines.js';
import {HOTKEY_ACTIONS,HOTKEY_SLOTS,HOTKEY_BUTTONS,normalizeKey,keyLabel,parseBindings,defaultBindings,bindKey,clearKey,keyLookup,actionLabel,primaryKey} from './hotkeys.js';
import {eventSounds,actionSound} from './sound-cues.js';
import {engagementHeard,freshCombat,stepCombat,musicTrack} from './music-state.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {targetDetails} from './target-card.js';
import {enemyGlyph,floorTraitNote} from './enemy-visuals.js';
import {unitTree} from './behavior-tree.js';
import {read,write,loadGame,saveGame,storage,profile,recordResult,TEST_MODE,exportBackup,previewBackup,restoreBackup,abandonRun,resetProgress,TAB_ID,claimTab,tabKey} from './storage.js';
import {DECK_COLUMNS,DECK_LABELS,DECK_GLYPHS,deckPlacement,mirrorDeck,swapSlots,parseDeckLayout,DECK_GRID} from './deck-layout.js';
import {createReplay,replayLog,stateHash,validReplay,recordReplay} from './replay.js';

const $=s=>document.querySelector(s),audio=new AudioEngine();
const savedGame=loadGame();
let inventoryTab='weapon',deploymentFaces={};
// Title flow (3.98.1, user report): the title screen and every menu reached from it take the full-screen terminal
// treatment. A bottom sheet left the finished run showing above it; closing the dialog always reveals the battle.
let titleFlow=false;
let playback=null,entered=false,orientationBlocked=false,orientationOverride=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor,noticeTimer,kia=null;
renderer.targetingEnabled=read('ash-targeting')!=='off';
renderer.movementBoundaries=read('ash-movement-boundaries')==='on';
// 3.114.0 (user request): a command pressed while the last turn is still animating ends that animation and runs. On by
// default; the settings menu turns it off.
let skipPresentation=read('ash-skip-presentation')!=='off';
// 3.165.0 (user request): with this on, a locked enemy out of range hands the lock to the nearest enemy in range. Off by default.
let autoRetarget=read('ash-auto-retarget')==='on';
// 3.115.0 (user request): a VHS filter over the whole screen, a display preference that is off by default. It is CSS only
// (expansion.css): the class on <html> shows the layer after the app and the one inside the dialog.
let vhsFilter=read('ash-vhs')==='on';document.documentElement.classList.toggle('vhs',vhsFilter);
// 3.147.0 (src/screen-shake.js): on unless turned off, or unless the system asks for reduced motion and it was never set.
const shakeSetting=read('ash-shake');renderer.shakeEnabled=shakeSetting?shakeSetting==='on':!renderer.reduceMotion;
// 3.149.0 (src/signal-glitch.js): the signal interference has its own switch, with the same default.
const glitchSetting=read('ash-glitch');renderer.glitchEnabled=glitchSetting?glitchSetting==='on':!renderer.reduceMotion;
// 3.175.0 kill gore (docs/KILL_GORE.md): full by default; reduced motion keeps it at simple.
let goreChoice=validGoreSetting(read('ash-gore'))?read('ash-gore'):'full';renderer.goreLevel=goreLevel(goreChoice,renderer.reduceMotion);
const GORE_LABELS={full:()=>t('settings.gore.full'),simple:()=>t('settings.gore.simple'),off:()=>t('settings.gore.off')};
// A hit on you makes the controls glitch for a moment, a beat after the shot, when the round lands.
const glitchUI=(ms=280)=>{for(const el of document.querySelectorAll('.tactical-panel,.mobile-status,#mobile-hp,#mobile-plates')){el.classList.remove('ui-glitch');void el.offsetWidth;el.classList.add('ui-glitch');setTimeout(()=>el.classList.remove('ui-glitch'),ms);}};
renderer.onPlayerHit=()=>setTimeout(()=>glitchUI(),90);
// Keyboard bindings and the key hints on the buttons (3.121.0, src/hotkeys.js).
let hotkeys=parseBindings(read('ash-hotkeys')),hotkeyMap=keyLookup(hotkeys),hotkeyHints=read('ash-hotkey-hints')==='on',hotkeyCapture=null;
// 3.116.0 (user request): whole-screen brightness. A root filter would miss the dialog (it sits in the top layer), so two
// backdrop-filter layers do it, the same way as the VHS layers; at 100% they are not drawn at all.
let screenBrightness=screenBrightnessPercent(read('ash-brightness'));
function applyBrightness(){document.documentElement.style.setProperty('--screen-brightness',String(screenBrightness/100));document.documentElement.classList.toggle('toned',screenBrightness!==SCREEN_BRIGHTNESS.initial);}
applyBrightness();
// The level-up transmission (showLevelUp) is shown once per level of a run.
let transmissionSeen=null;
const transmissionKey=()=>`${game.runId}:${game.player.level}`;
// Control deck (3.98.0, user request): pad size and layout are display preferences, kept local like the boundary lines.
const PAD_SIZES=[44,52,60,68],PAD_LABELS={44:t('controller.pad.standard'),52:t('controller.pad.large'),60:t('controller.pad.xlarge'),68:t('controller.pad.huge')};
// 3.101.0 (user request): 格狀 drops the split entirely - one five-by-three field of identical cells, so the pad
// size setting has nothing to say there, because the cell size is the deck width divided by five.
const DECK_LAYOUTS=['classic','corner','grid'],DECK_LAYOUT_LABELS={classic:t('controller.layout.classic'),corner:t('controller.layout.corner'),grid:t('controller.layout.grid')},GRID_CELL_MAX=76;
let padLayout=DECK_LAYOUTS.includes(read('ash-pad-layout'))?read('ash-pad-layout'):'classic';
let deckLayout=parseDeckLayout(read('ash-deck-layout'))||[...DECK_GRID];
let deckPick=null;
let padCell=PAD_SIZES.includes(Number(read('ash-pad-cell')))?Number(read('ash-pad-cell')):PAD_SIZES[0];
renderer.boundaryOpacity=boundaryOpacityPercent(read('ash-boundary-opacity'));
{const color=read('ash-operator-color');renderer.operatorColor=validOperatorColor(color)?color:DEFAULT_OPERATOR_COLOR;}
// 3.116.0 added a strength slider for the operator colour; 3.139.1 took it out of the settings (user, 2026-09-19) while
// the colour picker is redesigned, so the colour is drawn at full strength. The saved 'ash-operator-tint' is left alone.
renderer.operatorTint=1;
renderer.targetUI={card:$('#target-card'),link:$('#target-link'),path:$('#target-link path'),dirty:true};
document.fonts?.ready.then(()=>{renderer.targetUI.dirty=true;});
audio.enabled=read('ash-sound')!=='off';
// 3.117.0 (user request): music and effects each have a volume; the old on/off switch stays as the master.
audio.setVolumes({music:volumePercent(read('ash-music-volume'),AUDIO_TUNING.musicDefault)/100,sfx:volumePercent(read('ash-sfx-volume'),AUDIO_TUNING.sfxDefault)/100});
audio.setGrit(gritLevel(read('ash-audio-grit')));
const GRIT_LABELS={off:t('controller.grit.off'),light:t('controller.grit.light'),heavy:t('controller.grit.heavy')};
// Browsers only allow sound after a gesture; the first press anywhere starts it, and a hidden page goes quiet.
for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>{audio.unlock();syncMusic();},{capture:true});
document.addEventListener('visibilitychange',()=>audio.background(document.hidden));
// Test mode only (?test=1): lets a browser check read the music state and decoded buffers; it cannot listen.
if(TEST_MODE)globalThis.__ashAudio={engine:audio,get combat(){return combatMusic;}};
// Music follows the screen and, in a facility, the combat state (src/music-state.js). The state is per floor of a run.
// A title-flow menu counts only while the dialog is actually open: the close event that clears titleFlow arrives later.
let combatMusic=freshCombat(),combatScene=null;
function syncMusic(){
  const scene=`${game.runId}:${game.floor}:${isSimulation(game)}`;if(scene!==combatScene){combatScene=scene;combatMusic=freshCombat();}
  audio.setMusic(musicTrack({menu:!entered||(titleFlow&&$('#modal').open),playing:game.status==='playing',simulation:isSimulation(game),faction:game.facilityFaction,combat:combatMusic.combat}));
}
function noteCombat(engaged){
  syncMusic();
  combatMusic=stepCombat(combatMusic,engaged?{engaged:true}:{turn:game.turn,enemiesInView:game.visibleEnemies.filter(e=>!isNoncombatant(e)).length});
  syncMusic();
}
// 3.167.0: the static page text follows the chosen language before the first frame.
localizeDocument();
const notice=document.createElement('div');notice.className='battle-notice';notice.setAttribute('role','status');$('#field-messages').append(notice);
// The message bar shows one line; the button opens the whole combat log and counts the extra lines of the last action (3.44).
// 3.104.0 (user request): the message bar sits in the header, one line with an ellipsis, and the extra-line counter
// is a bare +N chip — the old ≡ looked like the ☰ menu two buttons away.
const logButton=document.createElement('button');logButton.className='log-button';logButton.dataset.modal='log';logButton.setAttribute('aria-label',t('controller.openLog'));$('#field-messages').append(logButton);
// 3.104.0 (user request): the bar is not empty when quiet — it falls back to the floor and mission line that used to
// live in this row, so a message only borrows the space for a couple of seconds.
const missionLine=view=>isSimulation(view)?simulationLabel(view):isEndless(view)?`${depthLabel(view.floor)} · ${missionDefinition(view).name}`
 :`${pad(view.floor)} / ${returning(view)?t('controller.returnPrefix'):''}${missionDefinition(view).name}${view.floor===missionDepth(view)?` ${missionProgress(view).done}/${missionProgress(view).total}`:''}`;
function restNotice(){const view=renderer.game;if(!view)return;notice.textContent=missionLine(view);notice.classList.remove('danger');notice.classList.add('resting','show');logButton.textContent='';logButton.classList.remove('more');}
let lastActionLogs=1;
const freshLogs=old=>{const i=old?game.logs.indexOf(old):-1;return old&&i>=0?i:game.logs.length;};
// Saving can fail quietly (storage full or blocked). Keep a header warning up until a save succeeds (3.44).
let saveWarned=false,saveWarningDue=false;
// 3.150.0: the tab opened last owns the save; one that has been overtaken stops saving and says so.
let tabLost=false;claimTab();
addEventListener('storage',e=>{if(e.key!==tabKey()||!e.newValue||e.newValue===TAB_ID||tabLost)return;tabLost=true;modal(t('controller.otherTab'));});
function persist(){if(tabLost)return false;const ok=saveGame(game);$('#save-warning').hidden=ok;if(!ok&&!saveWarned){saveWarned=true;saveWarningDue=true;}return ok;}
function showSaveWarning(){saveWarningDue=false;modal(t('controller.saveFailed'));}
// Every line of the run (latest 50), newest first; a new turn starts a new block.
function showLog(){
  const rows=game.logs.map((l,i)=>`<li class="${[l.danger?'danger':'',i&&game.logs[i-1].turn!==l.turn?'new-turn':''].join(' ').trim()}"><b>${String(l.turn).padStart(3,'0')}</b><span>${escapeHTML(l.text)}</span></li>`).join('');
  modal(`<div class="eyebrow">${t('controller.log.eyebrow')}</div><h2>${t('controller.log.title',{logsLength:game.logs.length})}</h2><ol class="combat-log">${rows||t('controller.log.empty')}</ol><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`);
}
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text,{extra=0,danger=false}={}){notice.textContent=text;notice.classList.remove('resting');notice.classList.add('show');notice.classList.toggle('danger',danger);logButton.textContent=extra>0?`+${extra}`:'';logButton.classList.toggle('more',extra>0);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.classList.remove('show');noticeTimer=setTimeout(restNotice,600);},2700);}
// A new blueprint is announced with the action's latest line even when later logs would cover it (docs/ENGINEER.md
// section 7); the latest line keeps its danger colour.
const notifyLatest=()=>{sayCommsEvents(game.logs.slice(0,lastActionLogs));const latest=game.logs[0],blueprint=game.logs.slice(0,Math.max(1,lastActionLogs)).find(l=>isBlueprintLog(l.text));if(latest)notify(blueprint&&blueprint!==latest?`${blueprint.text} ${latest.text}`:latest.text,{extra:lastActionLogs-1,danger:latest.danger});};
// Comms over the field (3.168.1, user request): new log lines that a hook names make someone speak; the hooks wait
// for the writing (src/comms.js COMMS_HOOKS). A message names its speaker, expression and line (3.168.2). One box at a
// time, the rest wait their turn.
// 3.173.0 (user's pick from the mockups): the slim box covers the battle header, not the field.
const commsLayer=document.createElement('div');commsLayer.className='comms-layer';commsLayer.setAttribute('aria-live','polite');$('.battle-header').append(commsLayer);
const commsQueue=[];let commsRound=0;
function sayComms(message){commsQueue.push(message);if(commsQueue.length===1)showNextComms();}
function showNextComms(){
  const message=commsQueue[0],round=commsRound;if(message===undefined)return;
  commsLayer.innerHTML=commsMarkup(message,{context:{game},compact:true});
  armComms(commsLayer.querySelector('.comms'),()=>{if(round!==commsRound)return;commsLayer.innerHTML='';commsQueue.shift();message?.then?.();showNextComms();},{tap:message?.tap!==false});
}
// A message's `then` runs when its box has closed (3.177.0, the end of a run).
// Drops whatever is showing or waiting; a box already closing finishes quietly (3.174.0).
function clearComms(){commsRound++;commsQueue.length=0;commsLayer.innerHTML='';}
function sayCommsFor(entries){for(const message of commsForLogs(entries))sayComms(message);}
// 3.169.0 (docs/STORY.md 8): the officer on duty remarks on what the last action showed; the kill house has no comms.
let commsBefore=null,commsMemory=null,dutyOverride=null;
function sayCommsEvents(entries){
  if(game.status!=='playing')return;   // 3.174.0: a death has its own scene; the last turn's alerts stay quiet
  sayCommsFor(entries);
  if(!entered||isSimulation(game))return;
  if(commsMemory?.runId!==game.runId)commsMemory=newCommsMemory(game.runId);
  const speaker=dutySpeaker({game});
  for(const event of commsEvents({game,before:commsBefore,logs:entries,memory:commsMemory})){const message=commsLine(speaker,event.type,event.vars);if(message)sayComms(message);}
}
// Half health or less: the battlefield edges pulse red, deeper and faster as health falls (3.43).
function lowHealth(p){
  const glow=$('#low-health'),ratio=Math.max(0,p.hp)/p.maxHp,on=ratio<=.5;glow.classList.toggle('on',on);if(!on)return;
  const danger=Math.min(1,(.5-ratio)/.5); // 0 at half health, 1 at zero; the glow's depth scales with the board in CSS.
  glow.style.setProperty('--danger',danger.toFixed(2));glow.style.setProperty('--edge',(.45+.35*danger).toFixed(2));glow.style.setProperty('--pulse',`${(1.6-.7*danger).toFixed(2)}s`);
}
// Skill button text. Grapple shows what it would do to the locked target (3.47.1); others keep their state text.
function skillLabel(view,id){
  if(ALLY_SKILLS.includes(id))return allySkillState(view,id);
  if(id==='grapple'&&!view.player.skillState.grapple?.cooldown)return grappleLabel(view);
  return skillStatus(view.player,id);
}
function update(view=renderer.game) {
  syncMusic();
  const p=view.player,w=view.weapon,reserve=p[view.reserveKey()]??0;
  const sectorLabel=isSimulation(view)?t('controller.hud.simulation'):isEndless(view)?depthLabel(view.floor):`${t('controller.hud.floors',{v:pad(view.floor)})}`;
  if(notice.classList.contains('resting'))restNotice();
  // The mission summary moved into the ☰ menu (3.104.0, user request): most runs just push deeper, and the row
  // it used to occupy is worth more as the message bar.
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#mobile-plates-bar').style.width=`${(p.plates||0)/view.plateCapacity*100}%`;$('#mobile-plates').textContent=`${p.plates||0} / ${view.plateCapacity}`;lowHealth(p);
  $('#level').textContent=`${sectorLabel} · ${levelLabel(p.level)}`;$('#level').title=`${t('controller.hud.levelTitle',{sectorLabel,v:levelTitle(p.level,p.xp,levelCost(game,p.level))})}`;
  // One spelling of a prepared slot's label, so a mode that borrows the button can put it back exactly (3.109.0).
  // 3.161.0 (user report): the three prepared-slot buttons act on the live game — a tap skips the presentation first —
  // so their readiness, labels and counts come from it, not from the snapshot being animated. Skill cooldowns tick
  // after the enemy phase, so during the animation the snapshots still read 冷卻 1 (dim) while the live game read 就緒.
  const lp=game?.player||p,lv=game||view;
  for(const category of Object.keys(PREPARED_CATEGORIES)){
    const entry=preparedEntry(lp,category),button=$(`[data-action="${category}"]`),count=entry?.resource?lp[entry.resource]:null;
    button.querySelector('.action-icon').textContent=entry?.icon||'◇';
    if(category!=='grenade')button.querySelector('strong').textContent=slotLabel(lv,category);
    button.title=entry?`${t('controller.prep.title',{entryName:entry.name,v:category==='skill'?skillText(lp,lp.prepared.skill):entry.text,v2:category==='skill'?(ALLY_SKILLS.includes(lp.prepared.skill)?t('controller.prep.now')+allySkillState(lv,lp.prepared.skill)+t('controller.period'):t('controller.prep.now')+skillStatus(lp,lp.prepared.skill)+t('controller.prep.cooldownLeft')+(lp.skillState[lp.prepared.skill]?.cooldown||0)+t('controller.period')):''})}`:`${t('controller.prep.readyInPack',{v:PREPARED_CATEGORIES[category]})}`;
    if(category==='skill'){if(entry?.toggle)button.setAttribute('aria-pressed',String(skillActive(lp,lp.prepared.skill)));else button.removeAttribute('aria-pressed');}
    button.setAttribute('aria-label',entry?`${t('controller.prep.aria',{v:PREPARED_CATEGORIES[category],entryName:entry.name,v2:category==='skill'?t('controller.prep.comma')+skillLabel(lv,lp.prepared.skill):'',v3:count===null?'':`${t('controller.prep.remaining',{count})}`})}`:`${t('controller.prep.notReady',{v:PREPARED_CATEGORIES[category]})}`);
  }
  $('[data-action="reload"] strong').textContent=w.melee?t('controller.reload.melee'):`${view.actionCost('reload')===0?t('controller.reload.quick'):t('controller.reload.label')} ${p.ammo[p.weapon]}/${w.mag}`;
  $('[data-action="reload"]').title=w.melee?`${t('controller.reload.meleeTitle',{wName:w.name})}`:`${t('controller.reload.title',{v:view.actionCost('reload')})}`;
  $('#quick-weapon').textContent=w.melee?`${w.code} · ∞`:`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;$('#quick-weapon').title=w.melee?w.desc:`${t('controller.weaponTitle',{v:ammoName(w),reserve,v2:view.ammoCapacity(w.ammoType)})}`;
  const threats=view.visibleEnemies.filter(e=>!isNoncombatant(e)&&ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range&&(view.sight(e,p)||(unitTree(e).fixedTile&&e.charge&&e.aim&&distance(e.aim,p)===0)));
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  $('#status-effects').textContent=[view.pursuit?t('controller.status.pursuit'):'',p.wearables?.includes('exo')?`${t('controller.status.exo',{exoPlates:p.exoPlates,plates:EXO_TUNING.plates})}`:'',view.decoy?`${t('controller.status.decoy',{hp:view.decoy.hp,v:Math.max(1,view.decoy.expires-view.turn)})}`:'',...timedStatuses(view),view.weapon?.aimPenalty&&!p.focus?`${t('controller.status.unaimed',{aimPenalty:view.weapon.aimPenalty})}`:'',suppressionStatus(p),...meleeStatus(view),p.recovery?t('controller.status.chainsaw'):'',skillActive(p,'anchor')?t('controller.status.anchor'):'',p.vaultExposed?t('controller.status.vault'):'',skillActive(p,'early_warning')?t('controller.status.warning'):'',isDark(view,p)?t('controller.status.dark'):'',exposed?`${t('controller.status.exposed',{exposed})}`:threats.length?(threats.some(e=>view.accuracy(e,p).coverEfficiency===.5)?t('controller.status.halfCover'):t('controller.status.cover')):view.cover.length?t('controller.status.byWall'):'',p.moved?t('controller.status.moved'):'',threats.some(e=>view.accuracy(e,p).sidePenalty)?`${t('controller.status.sidestep',{v:threats.filter(e=>view.accuracy(e,p).sidePenalty).length})}`:'',p.guard?t('controller.status.guard'):'',p.plates?`${t('controller.status.plates',{plates:p.plates})}`:'',p.focus?t('controller.status.focus'):'',p.evasive?t('controller.status.evasive'):'',initiative(p)<0?t('controller.status.fast'):initiative(p)>0?t('controller.status.slow'):''].filter(Boolean).join(' · ');
  $('#status-effects').style.color=exposed?'#f3a182':'#b6d5b0';$('#status-effects').title=exposed?`${t('controller.status.exposedTitle',{exposed})}`:t('controller.status.coverTitle');
  // Grapple preview: only while the hook is ready and the locked target is a legal pull or dash.
  renderer.grapplePreview=null;
  if(p.prepared.skill==='grapple'&&!p.skillState.grapple?.cooldown&&!p.control.disabled&&view.status==='playing'){const plan=view.grapplePlan();if(!plan.reason)renderer.grapplePreview={from:{x:plan.mover.x,y:plan.mover.y},point:plan.point,dash:plan.dash};}
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?t('controller.aim.off'):t('controller.aim.on'));
  aimingButton.textContent=renderer.targetingEnabled?t('controller.aim.labelOn'):t('controller.aim.labelOff');
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-name').setAttribute('aria-label',details.fullName||details.name);$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;$('#target-traits').textContent=details.traits;$('#target-order').textContent=details.order;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  // The grenade, item and skill buttons stay pressable when unusable (3.97.0): with nothing prepared a tap opens that
  // backpack tab, and a long press always does. They only look unavailable.
  for(const b of document.querySelectorAll('.control-deck button')){
    const slot=Object.hasOwn(PREPARED_CATEGORIES,b.dataset.action);
    const unusable=(b.dataset.action==='skill'&&(!(ALLY_SKILLS.includes(lp.prepared.skill)?canAllySkill(lv,lp.prepared.skill):canUseSkill(lp,lp.prepared.skill))||lp.control.disabled))||(b.dataset.action==='reload'&&w.melee)||(slot&&(!preparedEntry(lp,b.dataset.action)||!preparedEntry(lp,b.dataset.action).action||(preparedEntry(lp,b.dataset.action).resource&&lp[preparedEntry(lp,b.dataset.action).resource]<=0)));
    b.disabled=(Boolean(playback)&&!skipEnabled())||view.status!=='playing'||(!slot&&unusable);
    // 3.161.0: a skill has no `resource`, so for it `unusable` came out undefined rather than false — and toggle() with
    // no second argument flips the class on every redraw. That was the dim-but-working skill button.
    b.classList.toggle('unavailable',Boolean(slot&&unusable));
  }
  $('[data-action="fire"] strong').textContent=w.melee?t('controller.fire.punch'):t('controller.fire.label');
  updateAim(view);
  if(playback)return;
  if(view.floor!==previousFloor){previousFloor=view.floor;floorToast();}
  if(entered)persist();
  if(game.status!=='playing'&&lastStatus==='playing'){lastStatus=game.status;if(!replay)recordResult(game);if(kia)kia.resultPending=true;else endRun();}
  else if(entered&&isSimulation(game)&&game.status==='playing'&&!$('#modal').open&&promptDue(game,promptLog(game)))showRoomPrompt();
  else if(entered&&game.pendingPerks&&game.status==='playing')showLevelUp();
  else if(entered&&saveWarningDue&&!$('#modal').open)showSaveWarning();
}
renderer.isPaused=()=>orientationBlocked;
renderer.frameRate=frameRate(read('ash-frame-rate'));
// The title and every menu opened from it sit on an opaque backdrop, so the battlefield behind them is not drawn.
renderer.isCovered=()=>$('#modal').open&&$('#modal').matches('.title,.standalone,.outro');
// Rules are resolved before a presentation starts, so skipping only drops frames. A turn that ended the run always plays
// out, so a death is never covered by the result screen mid-fall; the 120ms double-input lock still applies.
function skipEnabled(){return skipPresentation&&game.status==='playing';}
function endPlayback(){playback=null;renderer.game=game;update();notifyLatest();}
function skipPlayback(){
  if(!playback||!skipEnabled()||orientationBlocked||!entered||performance.now()<lockUntil)return false;
  playback.finish();endPlayback();return true;
}
// Killed in action (3.174.0, user design; docs/STORY.md 8; timing and burst in src/kia.js). It starts when the
// operative's fall plays: the world freezes and slows (renderer.pace), the camera pushes in, blood and light burst
// away from the killing blow. Once the body is down the officer on duty calls for the operative on the header bar —
// the call cannot be tapped away — and only when it ends does the run's end go on (src/outro.js: the dark screen, the
// loss report, then the results). The kill house and replays play
// the scene without voices. The result itself was recorded when the operative died. (`kia` is declared with the
// game state at the top.)
function startKia(fall){
  clearComms();
  const quiet=Boolean(replay)||isSimulation(game),seed=(Number(game.seed)||0)*31+game.turn;
  kia={start:performance.now(),times:kiaTimes(),quiet,voiced:false,resultAt:Infinity,resultPending:false,shown:false};
  renderer.kia={start:renderer.time,at:{x:fall.to.x,y:fall.to.y},blow:fall.blow||null,burst:kiaBurst(seed,fall.blow||null),frozen:true};
  renderer.pace=()=>{if(!kia)return null;const since=performance.now()-kia.start;renderer.kia.frozen=since<KIA_TUNING.freezeMs;return {scale:kiaTimeScale(since),zoom:kiaZoom(since,kia.times.voiceAt)};};
}
function kiaTick(){
  if(!kia||kia.shown)return;
  const since=performance.now()-kia.start;
  if(!kia.voiced&&since>=kia.times.voiceAt){
    kia.voiced=true;
    const message=kia.quiet?null:commsLine(dutySpeaker({game}),'kia');
    if(message){const seconds=kiaSeconds(t(message.line,message.vars));sayComms({...message,seconds,tap:false});kia.resultAt=since+seconds*1000+KIA_TUNING.closeMs;}
    else kia.resultAt=since;
  }
  if(since>=kia.resultAt&&kia.resultPending&&!playback){kia.shown=true;renderer.pace=null;renderer.kia.frozen=false;endRun();}
}
// A new run, a loaded save or a replay clears the scene; the fallen body and the blood stay until then, so the last
// battlefield still shows them.
function resetKia(){kia=null;renderer.kia=null;renderer.pace=null;renderer.gore=[];renderer.splatter.reset();endOutro();}
// The end of a run in three parts (3.177.0, user design; src/outro.js, docs/STORY.md 8): the officer approves the
// extraction on the header bar (for a death the scene above has played instead), the field fades to dark, she speaks
// in the middle of the screen — and when the purge review finds the unit deficient the overseer cuts in with a silence
// — then the results. The result was recorded when the run ended; each part checks that this run's end is still the
// one playing, so a new run or the results opened another way stop it.
let outro=null;
const outroShade=document.createElement('div');outroShade.className='outro-shade';outroShade.setAttribute('aria-hidden','true');outroShade.style.transitionDuration=`${OUTRO_TUNING.darkMs}ms`;document.body.append(outroShade);
function endOutro(){outro=null;outroShade.classList.remove('on');}
const ending=()=>Boolean(outro)||Boolean(kia&&!kia.shown);
function endRun(){
  if(isSimulation(game)){showResult();return;}
  const round={plan:outroPlan(game,{voiced:!replay})};outro=round;
  const darken=()=>{if(outro!==round)return;outroShade.classList.add('on');setTimeout(()=>outroChannel(round,0),OUTRO_TUNING.darkMs);};
  clearComms();
  if(round.plan.field)sayComms({...round.plan.field,then:darken});else darken();
}
function outroChannel(round,i){
  if(outro!==round)return;
  const message=round.plan.channel[i];
  if(!message){showResult();return;}
  const speak=()=>{
    if(outro!==round)return;
    modal(`<div class="outro-channel">${commsMarkup(message,{context:{game}})}</div>`);
    const box=$('#modal-content .comms');
    // The overseer comes in through interference (the level-up transmission's flash, src/signal-glitch.js).
    if(message.cutIn&&renderer.glitchEnabled&&box){box.classList.add('ui-glitch');setTimeout(()=>box.classList.remove('ui-glitch'),GLITCH_TUNING.transmission.ms);}
    armComms(box,()=>outroChannel(round,i+1),{tap:message.tap!==false});
  };
  if(message.cutIn)setTimeout(speak,OUTRO_TUNING.cutInMs);else speak();
}
renderer.onFrame=dt=>{
  kiaTick();
  if(!playback)return;
  playback.advance(dt);
  if(playback.done)endPlayback();
};
// 3.163.0 (user decision): the operator's own line over their head — an invalid input, or a warning of the next one.
const sayLine=(cue,detail={})=>renderer.addEffects([playerCalloutEvent(cue,detail)]);
function act(type,arg) {
  skipPlayback();
  if(playback||orientationBlocked||!entered||$('#modal').open||performance.now()<lockUntil)return false;
  pointerStart=null;
  commsBefore=commsSnapshot(game);
  const oldLog=game.logs[0],{success,steps}=captureAction(game,()=>game.action(type,arg));
  if(!success&&game.refusal)sayLine(game.refusal.cue,game.refusal.item?{item:game.refusal.item}:{});
  if(!success&&game.refusal?.cue==='out_of_range'){renderer.flashRange();retarget();}   // 3.165.0: where you could shoot from here
  if(success)retarget();
  if(success){
    // Persist the fully resolved turn before presenting any of its snapshots.
    lastActionLogs=freshLogs(oldLog);persist();lockUntil=performance.now()+120;const cue=actionSound(type==='usePrepared'?preparedEntry(game.player,arg.category)?.action:type);if(cue)audio.play(cue);noteCombat(false);
    if(steps.length){
      renderer.effects=[];
      playback=new Playback(planPresentation(steps,{reduceMotion:renderer.reduceMotion}),event=>{
        renderer.game=event.state;renderer.addEffects(event.effects,playback.elapsed-event.time);
        const fall=event.effects.find(e=>e.type==='fall'&&e.actorType==='player');if(fall&&!kia)startKia(fall);
        // An engagement line counts even when the animation is skipped; only the sounds are dropped.
        if(engagementHeard(event.effects))noteCombat(true);
        if(playback.skipping)return;update();
        for(const cue of eventSounds(event.effects,event.state))audio.play(cue);
        if(navigator.vibrate&&event.effects.some(e=>e.type==='impact'||e.type==='blast'))navigator.vibrate(25);
      });
      playback.advance(0);
    }
  }
  if(!playback&&game.logs[0]!==oldLog){lastActionLogs=freshLogs(oldLog);notifyLatest();}
  if(success||(type!=='grenade'&&type!=='launch'&&type!=='blindFire'&&type!=='deployCover'&&type!=='flare'&&type!=='rope'&&type!=='decoy'&&type!=='mine'&&!(type==='usePrepared'&&arg?.category==='grenade')))cancelAim();update();return success;
}
function move(dx,dy){if(renderer.mode==='deploy'){act('deployCover',[dx,dy]);return;}if(renderer.mode==='launch'||renderer.mode==='rope'){const from=renderer.aim||game.player;setAim({x:from.x+dx,y:from.y+dy});return;}if(renderer.mode==='blind'){const from=renderer.aim||game.player;setBlindAim({x:from.x+dx,y:from.y+dy});return;}if(renderer.mode==='pet'){setPetAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='drone'){setDroneAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='grenade'||renderer.mode==='flare'||renderer.mode==='place'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else if(renderer.mode==='suppress'){setSuppressAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});}else act('move',[dx,dy]);}
function floorToast(){if(isSimulation(game))return;if(isEndless(game)){const growth=growthLabel(game.floor,game.difficultySpec);notify(`${t('controller.floorNoticeFull',{v:depthLabel(game.floor),v2:floorInfo(game.floor).name,v3:growth?growth+t('controller.period'):'',v4:endlessFloorText(game.floor),v5:operatorSignal(game)})}`);return;}notify(`${t('controller.floorNotice',{floor:game.floor,v:floorInfo(game.floor).name,v2:returning(game)?game.missionSummary:game.floor===missionDepth(game)?missionDefinition(game).text:floorInfo(game.floor).text})}`);}
const slotLabel=(view,category)=>{const p=view.player,entry=preparedEntry(p,category),count=entry?.resource?p[entry.resource]:null;
  return entry?`${entry.short}${category==='skill'?' '+skillLabel(view,p.prepared.skill):count===null?'':` ${count}`}`:`${t('controller.prep.notReady',{v:PREPARED_CATEGORIES[category]})}`;};
function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
// 3.151.0 blind fire (src/blind-fire.js): tapping a tile you cannot see into, in range with a clear shot, aims a blind
// shot like the launcher — 互動 fires, 開火 cancels, the pad moves the aim.
const BLIND_HINT=`${t('controller.blindHint',{penalty:BLIND_TUNING.penalty})}`;
function startBlindAim(pos){renderer.mode='blind';renderer.aim={x:pos.x,y:pos.y};updateAim();notify(BLIND_HINT);}
function setBlindAim(pos){const reason=blindReason(game,pos);if(reason){notify(reason+t('controller.period'));return;}renderer.aim={x:pos.x,y:pos.y};updateAim();}
// Suppressive fire aims an area like a grenade, but range comes from the weapon and validity from suppressivePreview (3.74.1).
function startSuppressAim(){const p=game.player,reason=suppressivePreview(game,{x:p.x,y:p.y}).reason;if(reason){notify(reason);return;}const pick=[game.targeted,...game.visibleEnemies].find(e=>e&&game.enemies.includes(e)&&!suppressivePreview(game,{x:e.x,y:e.y}).reason);renderer.mode='suppress';renderer.aim=pick?{x:pick.x,y:pick.y}:{x:p.x,y:p.y};notify(`${t('controller.suppressHint',{range:game.weapon.range})}`);updateAim();}
function setSuppressAim(pos){const reason=suppressivePreview(game,pos).reason;if(reason){notify(reason);return;}renderer.aim=pos;updateAim();}
function setAim(pos){const launch=renderer.mode==='launch'||renderer.mode==='rope',placing=renderer.mode==='place',range=renderer.mode==='rope'?LINE_TUNING.range:launch?game.weapon.range:placing?placeRange():5;if(distance(pos,game.player)<=range&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify(launch||placing?`${t('controller.landingRange',{range})}`:t('controller.throwRange'));}
const placeRange=()=>renderer.placeItem==='mine'?MINE_TUNING.range:DECOY_TUNING.range;
// 3.111.0 (user request): a point-target launcher is aimed like a thrown grenade — pick a tile, confirm with 互動 —
// so the fire key opens that mode instead of shooting the locked enemy. Pressing fire again cancels.
function fireWeapon(){
  if(renderer.mode==='launch'||renderer.mode==='blind'){cancelAim();return;}
  if(!game.weapon.pointTarget){act('fire');return;}
  if(game.player.ammo[game.player.weapon]<=0){sayLine('reload_needed');return;}
  const p=game.player,locked=game.targeted,face=isBarrier(locked)?barrierFace(locked,p):locked;
  const start=[face,...game.visibleEnemies].find(o=>o&&distance(o,p)<=game.weapon.range&&game.visible(o));
  renderer.mode='launch';renderer.aim=start?{x:start.x,y:start.y}:null;updateAim();
  notify(start?t('controller.launchHintPad'):t('controller.launchHint'));
}
const operatorReady=view=>!isSimulation(view)&&view.status==='playing'&&!!view.operatorCorpse&&!view.operatorCorpse.recovered&&view.canTouch(view.operatorCorpse);
function interactions(view=renderer.game){return [...view.nearbyObjectives.map(o=>({label:t('controller.act.recover'),action:`objective:${o.id}`})),...view.nearbyContainers.map(c=>({label:`${t('controller.act.open',{v:view.containerLabel(c)})}`,action:`case:${c.id}`})),...view.nearbyDoors.map(b=>({label:view.doorLabel(b),action:`door:${b.id}`})),...(view.groundWeapon?[{label:t('controller.act.pickup'),action:'bag'}]:[]),...(view.nearbyTerminal?[{label:`${t('controller.act.terminal',{v:terminalRemaining(view.nearbyTerminal)})}`,action:'terminal'}]:[]),...(operatorReady(view)?[{label:t('controller.act.recoverId'),action:'operator'}]:[]),...(view.canTouch(view.exitPoint)&&(!isSimulation(view)||exitStep(view))?[{label:view.exitBlocked?t('controller.act.elevatorLocked'):view.exitLabel+(view.allyTravelSummary?' · '+view.allyTravelSummary:''),action:isSimulation(view)?'exitStep':'descend'}]:[])];}
function updateAim(view=renderer.game){const blinding=renderer.mode==='blind',launching=renderer.mode==='launch'||blinding,deploying=renderer.mode==='deploy',commanding=renderer.mode==='pet'||renderer.mode==='drone',aiming=renderer.mode==='grenade',roping=renderer.mode==='rope',placing=renderer.mode==='place',flaring=renderer.mode==='flare'||roping||placing,suppressing=renderer.mode==='suppress',preview=suppressing&&renderer.aim?suppressivePreview(view,renderer.aim):null,b=$('#interact'),options=interactions(view);
  const entry=preparedEntry(view.player,'grenade');
  $('#grenade-label').textContent=aiming?t('controller.grenade.cancel'):entry?`${entry.short} ${(game?.player||view.player)[entry.resource]}`:t('controller.grenade.notReady');
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=(Boolean(playback)&&!skipEnabled())||(view.status==='playing'&&!aiming&&!flaring&&!launching&&!commanding&&!suppressing&&!deploying&&!options.length)||Boolean(preview?.reason);
  b.querySelector('strong').textContent=view.status!=='playing'?t('controller.interact.result'):blinding?t('controller.interact.confirmBlind'):launching?t('controller.interact.confirmLaunch'):deploying?t('controller.interact.cancelSetup'):commanding?(renderer.mode==='drone'?t('controller.interact.confirmDeploy'):t('controller.interact.confirmCommand')):aiming?t('controller.interact.confirmThrow'):roping?t('controller.interact.confirmLine'):placing?(renderer.placeItem==='mine'?t('controller.interact.confirmMine'):t('controller.interact.confirmThrow')):flaring?t('controller.interact.confirmFlare'):suppressing?`${t('controller.interact.confirmSuppress',{v:preview?.rounds??0})}`:options.length>1?t('controller.interact.label'):options[0]?.label||t('controller.interact.label');
  b.classList.toggle('aiming',aiming||flaring||launching||commanding||suppressing||deploying);
  const fire=$('[data-action="fire"]');
  if(fire){fire.classList.toggle('aiming',launching);fire.querySelector('strong').textContent=blinding?t('controller.fire.cancelBlind'):launching?t('controller.fire.cancelLaunch'):view.weapon?.melee?t('controller.fire.punch'):t('controller.fire.label');}$('[data-action="skill"]')?.classList.toggle('aiming',suppressing);b.title=view.allyTravelSummary||'';
  const item=$('[data-action="item"]');
  if(item){item.classList.toggle('aiming',deploying||flaring);item.querySelector('strong').textContent=deploying?t('controller.interact.cancelSetup'):roping?t('controller.item.cancelLine'):placing?t('controller.item.cancel'):flaring?t('controller.item.cancelFlare'):slotLabel(view,'item');}
  for(const key of ['0,-1','0,1','-1,0','1,0'])$(`[data-move="${key}"]`)?.classList.toggle('aiming',deploying);
}
function interact(){if(renderer.mode==='deploy'){cancelAim();return;}if(renderer.mode==='blind'){const reason=blindReason(game,renderer.aim);if(reason){notify(reason+t('controller.period'));return;}act('blindFire',renderer.aim);return;}if(renderer.mode==='launch'){if(renderer.aim)act('launch',renderer.aim);else notify(t('controller.pickSpotFirst'));return;}if(renderer.mode==='pet'){act('commandPet',renderer.aim);return;}if(renderer.mode==='drone'){act('deployUnit',{line:deployLine,x:renderer.aim.x,y:renderer.aim.y});return;}if(game.status!=='playing'){if(!ending())showResult();return;}if(renderer.mode==='grenade'){act('usePrepared',{category:'grenade',target:renderer.aim});return;}if(renderer.mode==='flare'){act('flare',renderer.aim);return;}if(renderer.mode==='place'){act(renderer.placeItem,renderer.aim);return;}if(renderer.mode==='rope'){act('rope',{...renderer.aim,item:renderer.ropeItem});return;}if(renderer.mode==='suppress'){const turn=game.turn;act('usePrepared',{category:'skill',target:renderer.aim});if(game.turn!==turn)cancelAim();return;}
  const options=interactions();if(options.length>1){modal(t('controller.interact.title')+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+t('controller.interact.back'));return;}
  if(options[0]?.action.startsWith('objective:'))act('recoverObjective',options[0].action.slice(10));
  else if(options[0]?.action.startsWith('case:'))act('openContainer',options[0].action.slice(5));
  else if(options[0]?.action.startsWith('door:')){const b=game.nearbyDoors.find(b=>b.id===options[0].action.slice(5));if(b)act('door',{id:b.id,open:!b.open});}
  else if(options[0]?.action==='bag')showInventory('weapon');else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');else if(options[0]?.action==='exitStep')act('move',exitStep(game));else if(options[0]?.action==='operator')recoverCorpse();
}
function setPetAim(pos){if(game.seen[pos.y]?.[pos.x]&&game.passable(pos.x,pos.y)&&distance(pos,game.player)<=6){renderer.aim=pos;updateAim();}else notify(t('controller.commandRange'));}
// Drone skills that put a chassis down open a placement cursor; the default tile faces the way the player looks.
function setDroneAim(pos){if(droneCells(game).some(q=>q.x===pos.x&&q.y===pos.y)){renderer.aim={x:pos.x,y:pos.y};updateAim();}else notify(t('controller.deployRange'));}
function skill(){if(renderer.mode==='pet'||renderer.mode==='drone'||renderer.mode==='suppress'){cancelAim();return;}const id=game.player.prepared.skill;if(!id){showInventory('skill',t('controller.skill.readyOne'));return;}if(id==='suppressive_fire'){startSuppressAim();return;}if(id==='pet_command'&&game.activeAllies.some(a=>a.kind==='pet')){renderer.mode='pet';renderer.aim={x:game.player.x,y:game.player.y};notify(t('controller.skill.commandHint'));updateAim();}else if(id==='workshop')showWorkshop();else act('usePrepared',{category:'skill'});}
function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}const entry=preparedEntry(game.player,'grenade');if(!entry){showInventory('grenade',t('controller.grenade.readyOne'));return;}if(game.player[entry.resource]<=0){sayLine('empty',{item:entry.name});return;}renderer.mode='grenade';const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,game.player):locked;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
// With nothing prepared, the item button opens the item tab instead of refusing (3.97.0).
// 3.108.0: the slot is a 生效欄 now. Something in it with no action is worn, not held, so the button opens the pack
// instead — and the long press still does, which is why that shortcut had to stay.
function useItem(){if(renderer.mode==='deploy'||renderer.mode==='flare'||renderer.mode==='rope'||renderer.mode==='place'){cancelAim();return;}
  const entry=preparedEntry(game.player,'item');
  if(!entry){showInventory('item',t('controller.item.readyOne'));return;}
  if(!entry.action){showInventory('item',`${t('controller.item.worn',{entryName:entry.name})}`);return;}
  if(entry.aim==='side'){startDeploy();return;}
  if(entry.aim==='throw'){startThrowAim(game.player.prepared.item);return;}
  act('usePrepared',{category:'item'});}
// 3.135.0: a grapple line is aimed like a flare — pick the landing tile, confirm with 互動, press 道具 again to cancel.
function startThrowAim(id){const action=PREPARED_CATALOG.item[id]?.action;if(action==='rope')startRopeAim(id);else if(action==='decoy'||action==='mine')startPlaceAim(action);else startFlareAim();}
// 3.144.0 (src/field-gear.js): a decoy or a mine is placed like a flare — pick the tile, confirm with 互動, press 道具 to cancel.
function startPlaceAim(id){
  const p=game.player,entry=PREPARED_CATALOG.item[id];if(!(p[entry.resource]>0)){sayLine('empty',{item:entry.name});return;}
  // 3.148.1 (user report): the pad and swipes move this aim like a flare's, and it starts on a tile that would be accepted.
  renderer.mode='place';renderer.placeItem=id;renderer.aim=placeStart(game,id);updateAim();
  notify(id==='mine'?`${t('controller.item.mineHint',{range:MINE_TUNING.range})}`:`${t('controller.item.decoyHint',{range:DECOY_TUNING.range})}`);
}
function startRopeAim(id){
  const p=game.player,entry=PREPARED_CATALOG.item[id];if(!(p[entry.resource]>0)){sayLine('empty',{item:entry.name});return;}
  renderer.mode='rope';renderer.ropeItem=id;renderer.aim={x:p.x,y:p.y};updateAim();
  notify(`${t('controller.item.lineHint',{range:LINE_TUNING.range,v:entry.action==='rope'&&PREPARED_CATALOG.item[id].resource==='escapeLines'?t('controller.item.free'):''})}`);
}
// 3.109.0 (user request): carried cover picks its side with the direction keys, so putting it behind you costs the
// same one turn as putting it in front — no turning, and no second tap to confirm.
// 3.123.0: a flare is an item aimed like a throwable: pick a floor tile, confirm with 互動, press 道具 again to cancel.
function startFlareAim(){
  const p=game.player;if(!(p.flares>0)){sayLine('empty',{item:t('controller.item.flareName')});return;}
  const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,p):locked;
  renderer.mode='flare';renderer.aim=e&&!flareReason(game,{x:e.x,y:e.y})?{x:e.x,y:e.y}:{x:p.x,y:p.y};updateAim();
  notify(`${t('controller.item.flareHint',{range:FLARE_TUNING.range})}`);
}
function startDeploy(){
  // Refuse up front only when no side would work at all; the reason of the first blocked side explains why.
  const sides=[[0,-1],[0,1],[-1,0],[1,0]].map(d=>deployCoverReason(game,d));
  if(sides.every(Boolean)){notify(sides[0]+t('controller.period'));return;}
  renderer.mode='deploy';renderer.aim=null;updateAim();
  notify(t('controller.item.barricadeHint'));
}
function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
// 3.165.0 auto-retarget: the locked enemy is out of range, so the lock goes to the nearest enemy in range with a clear shot
// (then the nearest in range at all). A partition or barrel you locked on purpose is left alone, and so is an enemy you
// cannot swap for anything better. The lock is presentation state the rules already let you change for free (cycleTarget).
function retarget(){
  if(!autoRetarget||game.status!=='playing')return;
  const p=game.player,w=game.weapon,locked=game.enemies.find(e=>e.id===game.target&&e.hp>0);if(!locked||w.melee||distance(p,locked)<=w.range)return;
  const inRange=game.visibleEnemies.filter(e=>e.hp>0&&!isNoncombatant(e)&&distance(p,e)<=w.range).sort((a,b)=>distance(p,a)-distance(p,b));
  const pick=inRange.find(e=>game.shotClear(p,e))||inRange[0];if(pick)game.target=pick.id;
}
function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify(t('controller.noVisibleEnemies'));return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
// The corner × is gone (3.98.1, user request): it only ever appeared on menus that already carried a back button, and
// its float reserved a column on the right of the content; the pinned footer is the way out.
// On phones a menu is a bottom sheet (3.97.2, user request): its buttons and tab row sit on the screen's bottom edge for
// one-handed use, and a tabbed menu fills the height so its top does not move when tabs of different heights change.
// The upgrade pick is the exception (3.97.3, user report): it opens on its own under a thumb that is still tapping, so it
// is anchored to the top edge and the queued tap lands on the backdrop.
function modal(html,wide=false,title=false){queueMicrotask(syncMusic);cancelAim();$('#modal').classList.toggle('wide',wide);$('#modal').classList.toggle('title',title);$('#modal-content').innerHTML=html;$('#modal').classList.toggle('tabbed',!title&&Boolean($('#modal-content').querySelector('[role="tablist"],.journal-tabs')));$('#modal').classList.toggle('raised',Boolean($('#modal-content').querySelector('[data-perk]')));$('#modal').classList.toggle('transmission',Boolean($('#modal-content').querySelector('.transmission')));$('#modal').classList.toggle('briefing',Boolean($('#modal-content').querySelector('.briefing')));$('#modal').classList.toggle('outro',Boolean($('#modal-content').querySelector('.outro-channel')));$('#modal').classList.toggle('standalone',!title&&titleFlow);pinFooter(title);if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
// Main buttons stay on screen (3.97.0, user request): a menu marks them with .modal-footer; otherwise its final button
// (or button row) is pinned. When that final button is a secondary back/cancel button, the button just before it (the
// action) is pinned beside it, back first. Title screens lay themselves out and are left alone.
function pinFooter(title){
  const content=$('#modal-content');if(title)return;
  let footer=content.querySelector('.modal-footer');
  if(!footer){
    const last=content.lastElementChild;if(!last?.matches('.modal-button,.modal-row'))return;
    const prev=last.matches('.modal-button.secondary')&&last.previousElementSibling?.matches('.modal-button')?last.previousElementSibling:null;
    footer=document.createElement('div');footer.className='modal-footer';content.append(footer);
    footer.append(...[prev,last].filter(Boolean).sort((a,b)=>Number(!a.classList.contains('secondary'))-Number(!b.classList.contains('secondary'))));
  }
  // The tab row joins the pinned bar, so tabs are as reachable as the buttons (3.97.2).
  const tabs=content.querySelector('[role="tablist"],.journal-tabs');if(tabs&&!footer.contains(tabs))footer.prepend(tabs);
}
function close(){if(!entered){showIntro();return;}if(game.pendingPerks){showLevelUp();return;}if(game.status!=='playing'){showIntro();return;}$('#modal').close();$('#battle').focus({preventScroll:true});}
function modalAction(type,arg){close();act(type,arg);}
// 3.143.0 (user, 2026-09-19): feeding the pet takes a turn but keeps you in the pack, on the same tab and with the
// result on top, unless that turn leaves an enemy in view. A level-up, a room prompt or the result screen still takes over.
function feedAction(arg){const tab=inventoryTab;close();const done=act('feedPet',arg);if(done&&stayInMenu())showInventory(tab,game.logs[0]?.text||'');}
const stayInMenu=()=>entered&&game.status==='playing'&&!game.pendingPerks&&!$('#modal').open&&!game.visibleEnemies.some(e=>!isNoncombatant(e));

function showIntro(){
  titleFlow=true;
  if(isSimulation(game)&&game.status!=='playing')exitSimulation();
  const canContinue=game.status==='playing'&&(resumable||entered),simulating=isSimulation(game);
  const entry=(action,label,note,disabled=false)=>`<button class="title-entry" data-modal="${action}"${disabled?' disabled':''}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="title-screen">
    <div class="title-mark" aria-hidden="true"><svg viewBox="0 0 128 128"><path d="M23 99 58 24h15l34 75H85L65 50 44 99Z" fill="currentColor"/><path d="m56 85 9-21 9 21Z" fill="#0d1211"/></svg></div>
    <h2 class="title-word">ASH PROTOCOL</h2>
    <nav class="title-menu">
      ${entry('enter','CONTINUE',simulating?simulationLabel(game):canContinue?`${t('controller.title.continueMeta',{v:characterName(game.player.character).split(' · ').pop(),floor:game.floor})}`:t('controller.title.noRun'),!canContinue)}
      ${simulating?entry('khMenu','EXIT SIMULATION',t('controller.title.exitSim')):entry('deploy','NEW GAME',t('controller.title.newGame'))}
      ${simulating?'':entry('killhouse','KILL HOUSE',t('controller.title.killhouse'))}
      ${simulating?'':entry('unlocks','UNLOCKS',`${t('controller.title.unlocks',{v:profile().protocol.balance})}`)}
      ${entry('help','MANUAL',t('controller.title.manual'))}
      ${entry('settings','SETTING',t('controller.title.settings'))}
    </nav>
    ${storage.available?'':t('controller.title.storageWarning')}
  </div>`,false,true);
}
// Deployment is a three-step flow. The draft carries the mission and seed
// between screens; newGame() itself is unchanged.
let deployDraft={mode:null,mission:null,seed:undefined};
const MISSION_IDS=RANDOM_MISSION_IDS;
const orderedCharacters=()=>[...OPERATOR_ORDER.filter(id=>CHARACTERS[id]),...Object.keys(CHARACTERS).filter(id=>!OPERATOR_ORDER.includes(id))].filter(id=>availableCharacters(profile()).includes(id));
const lockedCharacters=()=>CHARACTER_IDS.filter(id=>CHARACTERS[id]&&!shelvedCharacter(id)&&!orderedCharacters().includes(id));
const randomSeed=()=>Math.floor(Math.random()*1000000000);
const pick=list=>list[Math.floor(Math.random()*list.length)];
const runIsLive=()=>game.status==='playing'&&(entered||resumable);
const deployNotice=()=>runIsLive()?t('controller.deploy.liveWarning'):'';
const seedLabel=seed=>seed===undefined?t('controller.deploy.random'):String(seed);
// Deployment-list additions, split from the old shared paragraph. MISSIONS[].text
// is also the mission-floor toast, so floor-3 reminders stay out of the data.
const MISSION_NOTES={
  hunt:t('controller.mission.note.hunt'),
  sweep:t('controller.mission.note.sweep'),
  retrieval:t('controller.mission.note.retrieval'),
  roundtrip:t('controller.mission.note.roundtrip'),
  archive:t('controller.mission.note.retrieval'),
  endless:t('controller.mission.note.endless')
};

function startQuick(){
  const seed=randomSeed(),mission=pick(MISSION_IDS);
  deployDraft={mode:'quick',mission,seed};
  newGame(seed,pick(availableCharacters(profile())),mission);
}
function showDeployment(){
  deploymentFaces=deploymentPortraits(Object.keys(CHARACTERS));
  deployDraft={mode:null,mission:null,seed:undefined};
  const row=(action,label,note)=>`<button class="title-entry" data-modal="${action}"><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="eyebrow">DEPLOYMENT</div><h2>${t('controller.deploy.newMission')}</h2>${deployNotice()}
<nav class="title-menu deploy-menu">
${row('deployNormal','NORMAL GAME',t('controller.deploy.custom'))}
${row('deployDaily','DAILY GAME',`${t('controller.deploy.daily',{dailySeed:dailySeed()})}`)}
${row('deployQuick','QUICK GAME',t('controller.deploy.quick'))}
</nav>
<button class="modal-button secondary" data-modal="${runIsLive()?'settings':'intro'}">${t('controller.cancel')}</button>`,true);
}

function showDeployMission(){
  const selected=game.mission.id;
  modal(`<div class="eyebrow">DEPLOYMENT / 1 OF 3</div><h2>${t('controller.deploy.pickMission')}</h2>${deployNotice()}
<fieldset class="term-list mission-list"><legend>SELECT CONTRACT</legend>${Object.entries(MISSIONS).map(([id,m])=>`<div class="term-row"><label class="term-pick"><input type="radio" name="mission" value="${id}" ${id===selected?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${m.name}</span><span class="term-meta">${id==='endless'?ENDLESS_DISPLAY_FLOORS:(m.depth||6)}F</span></span></label></div>`).join('')}</fieldset>
<div class="mission-brief" aria-live="polite">${Object.entries(MISSIONS).map(([id,m])=>`<p data-mission="${id}"${id===selected?' class="active"':''}>${sentences(m.text,MISSION_NOTES[id])}</p>`).join('')}</div>
<details class="term-detail seed-advanced"><summary>${t('controller.deploy.advanced')}</summary><label class="seed-field">${t('controller.deploy.seedLabel')}<input id="new-seed" type="number" min="0" max="999999999" placeholder="${t('controller.deploy.seedExample')}" inputmode="numeric"></label></details>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deploy">${t('controller.back')}</button><button class="modal-button" data-modal="deployOperator">${t('controller.deploy.nextOperator')}</button></div>`,true);
}

function showDeployOperator(){
  const {mission,seed,mode}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK',retry:'REDEPLOY'}[mode]||'NORMAL',retry=mode==='retry';
  modal(`<div class="eyebrow">${retry?'REDEPLOYMENT / SAME SEED':'DEPLOYMENT / 2 OF 3'}</div><h2>${t('controller.deploy.pickOperator')}</h2>
<p>${t('controller.deploy.summary',{label,missionName:MISSIONS[mission].name,v:seedLabel(seed)})}</p>${deployNotice()}
<fieldset class="term-list operator-list"><legend>SELECT OPERATOR</legend>${orderedCharacters().map(id=>{const c=CHARACTERS[id];return `<div class="term-row"><label class="term-pick"><input type="radio" name="character" value="${id}" ${id===(deployDraft.character||game.player.character)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-face">${portraitMarkup(deploymentFaces[id])}</span><span class="term-sprite"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas></span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">${c.name.toUpperCase()} · ${c.hp||100}/${c.armor||0}</span></span></label><p class="term-note">${c.text}</p><details class="term-detail"><summary>${t('controller.deploy.details')}</summary><div class="term-detail-body"><small>${c.weapons.map(slot=>WEAPONS[slot].name).join(t('controller.slash'))}</small><small>${t('controller.deploy.stats1',{v:c.plates||0,v2:combatStatSummary({character:id}),v3:capacity('grenade')+classCarryBonus(id,'grenade')})}</small><small>${t('controller.deploy.stats2',{v:startingSupplies(id).meds,v2:Object.values(GRENADES).filter(g=>startingSupplies(id)[g.resource]>0).map(g=>g.short+' ×'+startingSupplies(id)[g.resource]).join(t('controller.slash')),v3:startingKit(id)})}</small>${(c.skills||[]).map(sid=>`<small><b>${SKILLS[sid].name}</b>${t('controller.deploy.skillText',{sidText:SKILLS[sid].text})}</small>`).join('')}${c.traits.map(tid=>`<small><b>${TRAITS[tid].name}</b>${t('controller.deploy.traitText',{tidText:TRAITS[tid].text})}</small>`).join('')}</div></details></div>`;}).join('')}${lockedCharacters().map(id=>lockedOperatorRow(id)).join('')}</fieldset>
${operatorColorPicker()}
<div class="modal-footer"><button class="modal-button secondary" data-modal="${retry?'result':mode==='normal'?'deployNormal':'deploy'}">${t('controller.back')}</button><button class="modal-button" data-modal="${retry?'retryStart':'deployDifficulty'}">${retry?t('controller.deploy.go'):t('controller.deploy.nextDifficulty')}</button></div>`,true);
  mountColorPicker($('#modal .color-list'),drawOperatorSprites);drawOperatorSprites();
}
// Step 3 (3.76.2): the difficulty knob's reserved slot and the real-mode switch, which locks when the run starts.
function showDeployDifficulty(){
  const {mission,seed,mode,character}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK'}[mode]||'NORMAL',chosen=difficultyOption(deployDraft.difficulty);
  modal(`<div class="eyebrow">DEPLOYMENT / 3 OF 3</div><h2>${t('controller.deploy.pickDifficulty')}</h2>
<p>${t('controller.deploy.summary2',{label,missionName:MISSIONS[mission].name,v:characterName(character),v2:seedLabel(seed)})}</p>${deployNotice()}
<fieldset class="term-list difficulty-list"><legend>SELECT DIFFICULTY</legend>${DIFFICULTY_OPTIONS.map(d=>`<div class="term-row"><label class="term-pick"><input type="radio" name="difficulty" value="${d.id}" ${d===chosen?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${d.name}</span><span class="term-meta">${difficultyMeta(d)}</span></span></label></div>`).join('')}</fieldset>
<p class="term-note difficulty-note">${t('controller.deploy.difficultyNote')}</p>
<fieldset class="term-list facility-list"><legend>${t('controller.deploy.facility')}</legend>${FACILITY_OPTIONS.map(o=>`<div class="term-row"><label class="term-pick"><input type="radio" name="facility" value="${o.id}" ${o===facilityOption(deployDraft.facility)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${o.name}</span><span class="term-meta">${o.meta}</span></span></label></div>`).join('')}</fieldset>
<fieldset class="term-list mode-list"><legend>MODE</legend><div class="term-row"><label class="term-pick term-toggle"><input type="checkbox" name="real-mode" ${deployDraft.realMode?'checked':''}><span class="term-caret" aria-hidden="true"></span><span class="term-body"><span class="term-name">${t('controller.deploy.realMode')}</span><span class="term-meta">${realModeMeta()}</span></span></label><p class="term-note">${REAL_MODE_NOTE}</p></div></fieldset>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deployBackOperator">${t('controller.back')}</button><button class="modal-button" data-modal="new">${runIsLive()?t('controller.deploy.abandonAndGo'):t('controller.deploy.start')} →</button></div>`,true);
}
// Operator colour (3.48.2; wheel, brightness and swatches since 3.140.0, src/color-picker.js): a large preview of the
// picked class; saved only when the mission starts.
function operatorColorPicker(){
  const selected=deployDraft.color||renderer.operatorColor,character=orderedCharacters().includes(game.player.character)?game.player.character:orderedCharacters()[0];
  return colorPickerMarkup(selected,character);
}
// Redraw every class-sprite canvas on the deploy screen in the colour currently checked.
// While the wheel is dragged every step is a new colour, so the previews keep their own small cache for the colour on
// screen instead of filling the battlefield's.
let previewTints={color:null,cache:new Map()};
function drawOperatorSprites(){
  const image=renderer.classSprites,color=$('input[name="operator-color"]:checked')?.value||renderer.operatorColor;
  if(!image.complete||!image.naturalWidth){image.addEventListener('load',drawOperatorSprites,{once:true});return;}
  if(previewTints.color!==color)previewTints={color,cache:new Map()};
  for(const canvas of document.querySelectorAll('#modal canvas[data-class-sprite]')){const r=classSpriteRect(canvas.dataset.classSprite),tinted=tintedSprite(image,r,color,previewTints.cache,renderer.operatorTint),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,32,32);c.drawImage(tinted||image,tinted?0:r.x,tinted?0:r.y,32,32,0,0,32,32);}
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
function showMission(){if(isSimulation(game)){modal(`<div class="eyebrow">SIMULATION / KILL HOUSE</div><h2>${simulationLabel(game)}</h2>${missionDetails()}<button class="modal-button" data-modal="close">${t('controller.backToSim')}</button>`);return;}modal(`<div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2>${floorInfo(game.floor).name}</h2>${missionDetails()}<p>${isEndless(game)?endlessRules({intro:false}):t('controller.mission.help')}</p><button class="modal-button" data-modal="close">${t('controller.backToFieldPlain')}</button>`);}
// Mission briefing (3.168.0, user request): a near full-screen card when a new mission starts, with the controller's
// channel above it. Resuming a run, the kill house and replays go straight to the field; the mission title still opens
// the shorter briefing (showMission) at any time.
function showBriefing(){
  const def=missionDefinition(game),difficulty=difficultyOption(game.difficulty).name;
  const rows=[['briefing.objective',sentences(def.text,MISSION_NOTES[game.mission.id])],['briefing.facility',factionDef(game.facilityFaction)?.name||''],['briefing.difficulty',game.realMode?`${difficulty} · ${t('controller.deploy.realMode')}`:difficulty]].filter(([,v])=>v);
  modal(`<div class="briefing">${commsMarkup(commsLine(dutySpeaker({game}),'briefing')||{line:'comms.briefing'},{context:{game}})}<section class="briefing-card" aria-labelledby="briefing-title"><div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2 id="briefing-title">${def.name}</h2><p class="briefing-sector">${floorInfo(game.floor).name}</p><dl class="briefing-rows">${rows.map(([k,v])=>`<dt>${t(k)}</dt><dd>${v}</dd>`).join('')}</dl></section></div><div class="modal-footer"><button class="modal-button" data-modal="close">${t('briefing.start')}</button></div>`);
  armComms($('#modal-content .comms'));
}
function showMap(){modal(`<div class="eyebrow">SECTOR ${pad(game.floor)} / ${isSimulation(game)?'KILL HOUSE':floorInfo(game.floor).name}</div><h2>${t('controller.map.title')}</h2>${missionDetails()}<canvas id="overview" width="324" height="324" aria-label="${t('controller.map.aria')}"></canvas><p>${t('controller.map.legend1')}<br>${t('controller.map.legend2')}</p><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`);renderer.drawMap($('#overview'));}

function updateOrientation(raise=false){
  // Primary pointer, not any pointer: a touch laptop has a touchscreen but cannot rotate (3.44).
  orientationBlocked=!orientationOverride&&landscapeTouch({coarse:matchMedia('(pointer: coarse)').matches,type:screen.orientation?.type,angle:window.orientation,width:innerWidth,height:innerHeight,editing:document.activeElement?.matches('input,textarea')});
  const guard=$('#orientation-guard');
  if(orientationBlocked){if(raise&&guard.open)guard.close();if(!guard.open)guard.showModal();}
  else if(guard.open)guard.close();
}
// Reserve external HUD height; battlefield remains square in the portrait column.
function fitLayout(){const panel=$('.battle-panel'),hud=$('.tactical-panel'),width=panel.clientWidth,style=getComputedStyle($('.app')),height=window.innerHeight-2-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const hudHeight=[...hud.children].reduce((n,el)=>n+el.getBoundingClientRect().height,0);
  const side=Math.min(width,height-hudHeight);
  panel.style.setProperty('--board-size',`${Math.max(128,Math.floor(side))}px`);
  // Handheld feel (3.97.0, user request): once the battle screen fits, the page is locked against scrolling and bounce;
  // a layout that cannot fit (such as the landscape override) still scrolls.
  sizeDeck();
  document.documentElement.classList.toggle('scroll-locked',panel.getBoundingClientRect().height<=height+2);updateOrientation();
}
// The nine-cell layout moves the two buttons rather than duplicating them, so every [data-action] lookup, handler and
// disabled state keeps working; classic puts reload back after fire and interact last, which is the markup order.
// Keyboard (3.121.0). Every command runs the same function its button does.
const HOTKEY_RUN={moveUp:()=>move(0,-1),moveLeft:()=>move(-1,0),moveDown:()=>move(0,1),moveRight:()=>move(1,0),wait:()=>act('wait'),
  fire:()=>fireWeapon(),reload:()=>act('reload'),grenade:()=>grenade(),item:()=>useItem(),skill:()=>{if(!$('[data-action="skill"]')?.disabled)skill();},interact:()=>interact(),
  // 3.162.0 (user decision): a button straight to the weapon tab — the bag button opens the last tab, and switching
  // weapons is frequent. No gesture switches weapons directly: that costs a turn, and the tab shows the cost.
  cycleTarget:()=>cycleTarget(),toggleTargeting:()=>toggleTargeting(),bag:()=>showInventory(),weapons:()=>showInventory('weapon'),map:()=>showMap(),center:()=>centerCamera(),zoomIn:()=>zoomBy(.15),zoomOut:()=>zoomBy(-.15)};
function zoomBy(step){renderer.zoom=Math.max(.65,Math.min(1.6,renderer.zoom+step));renderer.resize();}
function centerCamera(){renderer.zoom=1;renderer.resize();renderer.camera={x:game.player.x,y:game.player.y};}
// The hint is an attribute drawn by CSS, so buttons whose label the game rewrites keep it.
function applyHotkeyHints(){
  document.documentElement.classList.toggle('hotkey-hints',hotkeyHints);
  for(const [selector,id] of Object.entries(HOTKEY_BUTTONS))for(const button of document.querySelectorAll(`.app ${selector}`)){
    const key=primaryKey(hotkeys,id);if(key)button.dataset.hotkey=keyLabel(key);else delete button.dataset.hotkey;
  }
}
function saveHotkeys(next){hotkeys=next;hotkeyMap=keyLookup(hotkeys);write('ash-hotkeys',JSON.stringify(hotkeys));applyHotkeyHints();}
function showHotkeys(message=''){
  const groups=[...new Set(HOTKEY_ACTIONS.map(action=>action.group))];
  const slot=(id,i)=>{const waiting=hotkeyCapture?.id===id&&hotkeyCapture.slot===i;return `<button class="hotkey-slot${waiting?' waiting':''}" data-hotkey-slot="${id}:${i}" aria-label="${t('controller.keys.slotAria',{v:actionLabel(id),v2:i+1,v3:waiting?t('controller.keys.waiting'):keyLabel(hotkeys[id][i])})}">${waiting?t('controller.keys.press'):keyLabel(hotkeys[id][i])}</button>`;};
  modal(`<div class="eyebrow">KEYBOARD</div><h2>${t('controller.keys.title')}</h2><p>${t('controller.keys.help')}</p>${message?`<p class="hotkey-message" role="status">${message}</p>`:''}${groups.map(group=>`<h3 class="pack-subhead">${group}</h3><div class="hotkey-rows">${HOTKEY_ACTIONS.filter(action=>action.group===group).map(action=>`<div class="hotkey-row"><span>${action.label}</span>${Array.from({length:HOTKEY_SLOTS},(_,i)=>slot(action.id,i)).join('')}</div>`).join('')}</div>`).join('')}${hotkeyCapture?t('controller.keys.cancel'):''}<div class="modal-row"><button class="modal-button secondary" data-hotkey-reset>${t('controller.keys.reset')}</button><button class="modal-button secondary" data-modal="settings">${t('controller.backToSettings')}</button></div>`);
}
function captureHotkey(e){
  if(['Shift','Control','Alt','Meta','CapsLock','Dead','Process','Unidentified'].includes(e.key)||e.isComposing)return;
  e.preventDefault();e.stopPropagation();
  const {id,slot}=hotkeyCapture;hotkeyCapture=null;
  if(e.key==='Escape'){showHotkeys();return;}
  if(e.key==='Backspace'){saveHotkeys(clearKey(hotkeys,id,slot));showHotkeys(`${t('controller.keys.cleared',{v:actionLabel(id),v2:slot+1})}`);return;}
  const result=bindKey(hotkeys,id,slot,e.key);
  if(result.error){showHotkeys(result.error);return;}
  saveHotkeys(result.bindings);
  showHotkeys(`${t('controller.keys.set',{v:actionLabel(id),v2:keyLabel(normalizeKey(e.key)),v3:result.displaced.length?`${t('controller.keys.moved',{v:result.displaced.map(actionLabel).join(t('controller.keys.joinQuote'))})}`:''})}`);
}
function applyDeck(){
  const deck=$('.control-deck'),pad=$('.direction-pad'),actions=$('.action-buttons'),corner=padLayout==='corner',grid=padLayout==='grid';
  deck.classList.toggle('corner-pad',corner);deck.classList.toggle('grid-deck',grid);
  for(const button of deck.querySelectorAll('button'))button.style.gridArea='';
  if(grid)for(const {selector,row,column} of deckPlacement(deckLayout)){const button=$(selector);pad.append(button);button.style.gridArea=`${row}/${column}`;}
  else{
    // Back to the two containers in markup order, so classic and 九宫格 are unchanged by the grid existing.
    pad.append($('[data-move="0,-1"]'),$('[data-move="-1,0"]'),$('[data-action="wait"]'),$('[data-move="1,0"]'),$('[data-move="0,1"]'));
    actions.append($('[data-action="fire"]'),$('[data-action="reload"]'),$('[data-action="grenade"]'),$('[data-action="item"]'),$('[data-action="skill"]'),$('#interact'));
    if(corner)pad.append($('[data-action="reload"]'),$('#interact'));
    deck.style.setProperty('--pad-cell',`${padCell}px`);deck.style.setProperty('--pad-gap',padCell>=52?'3px':'2px');
  }
  pad.setAttribute('aria-label',grid?t('controller.deck.grid'):corner?t('controller.deck.corner'):t('controller.deck.classic'));
  sizeDeck();
}
// The cells are square and share the deck's width, so their size is measured rather than chosen.
function sizeDeck(){
  if(padLayout!=='grid')return;
  const deck=$('.control-deck'),style=getComputedStyle(deck);
  const inner=deck.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const cell=Math.max(40,Math.min(GRID_CELL_MAX,(inner-3*(DECK_COLUMNS-1))/DECK_COLUMNS));
  deck.style.setProperty('--pad-cell',`${Math.floor(cell)}px`);deck.style.setProperty('--pad-gap','3px');
}
applyDeck();applyHotkeyHints();
const layoutObserver=new ResizeObserver(()=>requestAnimationFrame(fitLayout));
for(const el of [$('.workspace'),...$('.tactical-panel').children])layoutObserver.observe(el);
window.addEventListener('orientationchange',fitLayout);screen.orientation?.addEventListener('change',fitLayout);window.addEventListener('resize',fitLayout);window.visualViewport?.addEventListener('resize',fitLayout);fitLayout();

const INVENTORY_TABS={weapon:t('controller.tab.weapon'),...PREPARED_CATEGORIES};
// Engineer workshop panel (docs/ENGINEER.md phase 1): the class skill opens the production lines; building and
// deploying are separate one-turn actions, and a deployed unit never comes back.
let deployLine=0;
function showWorkshop(message=''){
  const p=game.player,lines=lineLimit(p);
  const row=i=>{const unit=p.productionLines[i];
    if(!unit)return `<div class="ground-loot"><strong>${t('controller.ws.lineEmpty',{v:i+1})}</strong><small>${t('controller.ws.lineEmptyHint')}</small><button data-workshop-build>${t('controller.ws.build')}</button></div>`;
    const def=UNIT_BLUEPRINTS[unit.blueprint],reason=deployReason(game,i);
    return `<div class="ground-loot"><strong>${t('controller.ws.lineUnit',{v:i+1,defName:def.name,v2:unit.payload?` · ${GRENADES[unit.payload].name}`:'',v3:Number.isInteger(unit.weapon)?` · ${game.weaponAt(unit.weapon).name}`:''})}</strong><small>${sentences(def.text,unit.payload||['unit_bomber','unit_warden','unit_boss'].includes(unit.blueprint)?'':Number.isInteger(unit.weapon)?`${t('controller.ws.magFromYou',{v:p.ammo[unit.weapon],v2:game.weaponAt(unit.weapon).mag})}`:unit.blueprint==='unit_drone'?t('controller.ws.energyFromYou'):t('controller.ws.pistolFromYou'))}</small><button data-workshop-deploy="${i}" ${reason?'disabled':''}>${reason||t('controller.ws.deploy')}</button></div>`;};
  // Field repair (3.96.0) lives in this panel, not on the interact button, which the adjacent follow drone would take over.
  const repairs=repairTargets(game).map(a=>{const reason=repairReason(game,a.id),gain=Math.min(a.maxHp-a.hp,Math.ceil(a.maxHp*REPAIR_TUNING.share));return `<div class="ground-loot"><strong>${t('controller.ws.repairTitle',{v:allyName(a),hp:a.hp,maxHp:a.maxHp})}</strong><small>${t('controller.ws.repairHint',{gain})}</small><button data-workshop-repair="${a.id}" ${reason?'disabled':''}>${reason||`${t('controller.ws.repair',{cost:REPAIR_TUNING.cost})}`}</button></div>`;}).join('');
  modal(`<div class="eyebrow">WORKSHOP / ${p.productionLines.length} OF ${lines}</div><h2>${t('controller.ws.title')}</h2><p>${t('controller.ws.summary',{v:deployedUnits(game).length,v2:deployLimit(p),scrap:p.scrap})}<br>${t('controller.ws.enemyBlueprints',{v:p.blueprints.map(id=>UNIT_BLUEPRINTS[id].name+(p.usedBlueprints.includes(id)?t('controller.ws.built'):'')).join(t('common.listSeparator'))||t('controller.ws.noneYet')})}<br>${t('controller.ws.help',{cost:REPAIR_TUNING.cost})}</p>${message?`<p role="status">${escapeHTML(message)}</p>`:''}${repairs}${Array.from({length:lines},(_,i)=>row(i)).join('')}<button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);
}
function blueprintOption(id,def,payload=null,weapon=null){
  const p=game.player,reason=buildReason(game,id,payload??undefined,weapon??undefined),throwable=payload&&GRENADES[payload],gun=weapon!==null?game.weaponAt(weapon):null;
  const detail=throwable?`${t('controller.ws.throwableDetail',{v:p[throwable.resource]})}`
    :gun?`${t('controller.ws.gunDetail',{gunName:gun.name,v:p.upgrades[weapon]||0,v2:ammoName(gun),v3:p.ammo[weapon],mag:gun.mag,v4:p[AMMUNITION[gun.ammoType].key]})}<br>${t('controller.ws.gunMove',{v:p.weapon===weapon?t('controller.ws.handGun'):''})}`
    :id==='unit_warden'?`${t('controller.ws.hpArmor',{hp:ENEMY_UNIT_TUNING.warden.hp,armor:ENEMY_UNIT_TUNING.warden.armor})}<br>${t('controller.ws.wardenGun',{v:allyWeapon({kind:'drone',sourceId:id},p).min,range:ENEMY_UNIT_TUNING.warden.range})}`
    :id==='unit_boss'?`${t('controller.ws.hpArmor',{hp:ENEMY_UNIT_TUNING.boss.hp,armor:ENEMY_UNIT_TUNING.boss.armor})}<br>${t('controller.ws.bossGun',{v:allyWeapon({kind:'drone',sourceId:id},p).min,range:ENEMY_UNIT_TUNING.boss.range,v2:bombardDamage(p)})}`
    :id==='unit_bomber'?t('controller.ws.bomberNote')
    :id==='unit_drone'?`${t('controller.ws.droneGun',{range:ENEMY_UNIT_TUNING.drone.range})}<br>${t('controller.ws.droneAmmo',{energy:p.energy})}`
    :`${t('controller.ws.lmg',{v:def.mount?t('controller.ws.mountOption'):''})}<br>${t('controller.ws.pistolAmmo')}`;
  return `<button class="perk" data-workshop-blueprint="${id}"${payload?` data-payload="${payload}"`:''}${gun?` data-weapon="${weapon}"`:''} ${reason?'disabled':''}><strong>${t('controller.ws.blueprintButton',{defName:def.name,v:throwable?` · ${throwable.name}`:gun?` · ${gun.name}`:'',cost:def.cost,v2:throwable?t('controller.ws.plusOne'):'',v3:def.once?t('controller.ws.scrapOnly'):''})}</strong><span>${def.text}<br>${detail}${reason?`<br>${reason}`:''}</span></button>`;
}
function showBlueprints(){
  const p=game.player;
  modal(`<div class="eyebrow">WORKSHOP / BLUEPRINTS</div><h2>${t('controller.ws.pickBlueprint')}</h2><p>${t('controller.ws.pickSummary',{scrap:p.scrap,productionLinesLength:p.productionLines.length,v:lineLimit(p)})}</p>${Object.entries(UNIT_BLUEPRINTS).flatMap(([id,def])=>def.payload?Object.keys(GRENADES).map(payload=>blueprintOption(id,def,payload)):[blueprintOption(id,def),...(def.mount?mountableSlots(game).map(slot=>blueprintOption(id,def,null,slot)):[])]).join('')}<button class="modal-button secondary" data-workshop>${t('controller.ws.back')}</button>`,true);
}
function startDeployAim(line){
  const reason=deployReason(game,line),cell=defaultDroneCell(game);if(reason||!cell){showWorkshop(reason||t('controller.ws.noDeployTile'));return;}
  close();deployLine=line;renderer.mode='drone';renderer.aim=cell;notify(t('controller.ws.deployHint'));updateAim();
}
// Learning data in the item tab (3.74.1). Reasons and counts come from learningInventory; both actions are free.
function learningSection(){
  const entries=learningEntries(learningInventory(game));
  return `<h3 class="pack-subhead">${t('controller.pack.learningTitle')}</h3>${entries.length?`<div class="pack-rows learning-list">${entries.map(e=>`<div class="pack-row learning-row"><div class="pack-pick"><span class="pack-icon" aria-hidden="true">${e.icon}</span><span class="pack-name">${e.title}</span><small>×${e.count}</small></div>${packInfo(`learn-${e.id}`,e.detail)}${e.useReason?`<p class="pack-reason">${e.useReason}</p>`:''}<div class="pack-actions"><button data-learn="${e.id}" ${e.useReason?'disabled':''}>${t('controller.pack.useFree')}</button></div></div>`).join('')}</div>`:t('controller.pack.learningEmpty')}${entries.length?`<p class="pack-reason">${t('controller.pack.learningTrade',{LEARNING_SCRAP})}</p>`:''}`;
}

// Druid feeding panel (3.72.1). Every number and legality check comes from petFeedingState quotes.
function petFeedingSection(){
  const state=petFeedingState(game);if(!state)return '';
  const {gate,groups}=feedingView(state,{weaponName:slot=>game.weaponAt(slot).name}),output=petOutputLine(state);
  const abilities=abilityChips(state),chips=abilities.length?`<div class="pet-abilities">${abilities.map(chip=>`<span>${chip.text}</span>`).join('')}</div>`:'';
  const lines=Object.entries(state.growth).map(([line,g])=>`<div style="--tint:${PET_LINE_TINTS[line]}"><strong>${PET_LINE_NAMES[line]}<b>${g.rank} / 6</b></strong><span class="pet-nodes" aria-label="${g.rank} / 6 個節點">${g.nodes.map(n=>`<i class="${n.major?'major':''}${n.unlocked?' on':''}">${nodeSymbol(n)}</i>`).join('')}</span><small>${lineProgress(line,g)}</small><small>◆ ${unlockedMajors(g).join('、')||'尚無'}</small>${nextNode(g)?`<small>下一個：${nextNode(g).major?'◆ ':''}${nextNode(g).name}（${nextNode(g).text}）</small>`:''}</div>`).join('');
  const kinds=state.output.selectableKinds.length?`<div class="pet-output-kinds">${state.output.selectableKinds.map(k=>`<button data-pet-output="${k}" aria-pressed="${state.output.kind===k}">${GRENADES[k].short}</button>`).join('')}</div>`:'';
  const feed=groups.map(group=>`<p class="pet-feed-group">${group.label}</p><div class="pet-feed">${group.options.map(o=>`<button ${o.allowed?'':'disabled'} ${o.id==='weapon'?`data-feed-weapon="${o.weaponSlot}"`:`data-feed-option="${o.id}"`}><span>${o.title}</span>${o.detail?`<small>${o.detail}</small>`:''}</button>`).join('')}</div>`).join('');
  return `<section class="pet-feeding"><h3>伴生餵養</h3><p class="pet-status">${petStatusLine(state)}</p><p class="pet-status">${fuelLabel(state)}</p><div class="pet-fuel"><i style="width:${fuelPercent(state)}%"></i></div>${output?`<p class="pet-status">${output}</p>`:''}${chips}${kinds}<div class="pet-lines">${lines}</div>${gate?`<p class="pet-gate">${gate}</p>`:'<p class="pet-status">相鄰時每次餵一份、花 1 回合。</p>'}${feed}</section>`;
}

// Field pack, compact for phones (3.97.0, user request): no portrait or rules text, one row per entry with its
// description behind "?", and the main button in the pinned footer. Operator stats and passive rules live in the journal,
// reached from the settings menu (3.97.1, user report: a journal button in the pack was noise).
const packInfo=(id,text)=>text?`<button class="pack-info" data-pack-info="${id}" aria-expanded="false" aria-controls="pack-desc-${id}" aria-label="${t('controller.pack.describe')}">?</button><p class="pack-desc" id="pack-desc-${id}" hidden>${text}</p>`:'';
const allyStatus=a=>`${t('controller.ally.row',{v:a.status==='reforming'?t('controller.ally.reforming'):a.status==='arriving'?t('controller.ally.arriving'):a.status==='destroyed'?t('controller.ally.destroyed'):t('controller.ally.active'),floor:a.floor,hp:a.hp,maxHp:a.maxHp,v2:a.kind==='drone'?(a.payload?` ${t('controller.ally.loaded',{short:GRENADES[a.payload].short})}`:['unit_bomber','unit_warden','unit_boss'].includes(a.sourceId)?(a.primed?(a.sourceId==='unit_warden'?t('controller.ally.charging'):t('controller.ally.windingUp')):a.bombard?t('controller.ally.bombardNext'):''):(allyWeapon(a,game.player).builtIn?t('controller.ally.selfAmmo'):` ${t('controller.ally.ammo',{v:Number.isInteger(a.weapon)?game.weaponAt(a.weapon).name+' ':'',ammo:a.ammo,v2:allyWeapon(a,game.player).mag})}`)):''})}`;
function showInventory(tab=inventoryTab,message='') {
  inventoryTab=Object.hasOwn(INVENTORY_TABS,tab)?tab:'weapon';
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1),category=inventoryTab;
  let content='';
  if(category==='weapon')content=`    <div class="pack-ammo">${AMMO_IDS.map(id=>`<span style="--tint:${AMMUNITION[id].tint};--tint-bg:${AMMUNITION[id].tint}26" title="${AMMUNITION[id].name}"><i>${AMMUNITION[id].short}</i><b>${p[AMMUNITION[id].key]}<small>/${game.ammoCapacity(id)}</small></b></span>`).join('')}</div>
    <div class="pack-weapons">${p.owned.map(index=>{const w=game.weaponAt(index),d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index];const tint=w.ammoType?AMMUNITION[w.ammoType].tint:MELEE_TINT;return `<article class="pack-weapon ${active?'equipped':''}" style="--tint:${tint};--tint-bg:${tint}1f"><div><div class="pack-weapon-head"><h3>${w.name}${level?` +${level}`:''}</h3><small>${active?t('controller.pack.equipped'):t('controller.pack.spare')}${w.melee&&game.bumpMeleeSlot()===index?t('controller.pack.bumpUse'):''} · ${w.code}</small></div><span>${t('controller.pack.weaponStats',{v:w.pellets?pelletSummary(index):`${d.min}–${d.max}`,v2:w.closeRange&&!w.pellets?` ${t('controller.pack.closeBandShort',{v:game.weaponDamage(index,{x:p.x+1,y:p.y}).min,v2:game.weaponDamage(index,{x:p.x+1,y:p.y}).max})}`:'',v3:w.shotCost>1?` ${t('controller.pack.perShot',{shotCost:w.shotCost})}`:'',v4:w.volleyCost?` ${t('controller.pack.perVolley',{volleyCost:w.volleyCost})}`:'',v5:w.burst?` ×${w.burst}${w.burstRange!==undefined?t('controller.pack.farSingle'):''}`:'',v6:w.hits?` ×${w.hits}`:'',range:w.range,v7:weaponBand(w)?` ${t('controller.pack.effective',{v:bandLabel(weaponBand(w))})}`:'',v8:ammoName(w),v9:magazineLabel(w,p.ammo[index]),v10:w.locked?t('controller.pack.boundTag'):''})}</span>${p.affixes[index]?`<p>${w.affixText}</p>`:''}<div class="pack-actions">${w.melee?`<button data-bump="${index}" aria-pressed="${game.bumpMeleeSlot()===index}" ${game.bumpMeleeSlot()===index?'disabled':''}>${game.bumpMeleeSlot()===index?t('controller.pack.bumpActive'):t('controller.pack.bumpSet')}</button>`:''}<button data-equip="${index}" ${active?'disabled':''}>${t('controller.pack.equip',{v:game.actionCost('weapon',index)})}</button><button data-salvage="${index}" ${p.owned.length<=1||w.locked?'disabled':''}>${w.locked?t('controller.pack.bound'):`${t('controller.pack.salvage',{v:salvageValue(p,index)})}`}</button></div></div></article>`;}).join('')}</div>
    ${ground.map(item=>{const w=game.weaponAt(item.slot),level=p.upgrades[item.slot]||0;const tint=w.ammoType?AMMUNITION[w.ammoType].tint:MELEE_TINT;return `<div class="ground-loot" style="--tint:${tint};--tint-bg:${tint}1f"><strong>${t('controller.pack.nearby',{wName:w.name,v:level?` +${level}`:''})}</strong><small>${t('controller.pack.affixMag',{affixText:w.affixText,v:p.ammo[item.slot],mag:w.mag})}</small><button data-compare="${item.slot}">${t('controller.pack.compare')}</button><button data-salvage-ground="${item.slot}" ${w.locked?'disabled':''}>${t('controller.pack.salvageHere',{v:salvageValue(p,item.slot)})}</button></div>`;}).join('')}
`;
  else {
    const options=preparedOptions(p,category);
    const status=(id,entry)=>entry.wear?(p.prepared[category]===id?t('controller.pack.takeOff'):t('controller.pack.putOn')):entry.resource?`×${p[entry.resource]}${CAPPED_ITEMS.includes(id)?`/${game.itemCapacity()}`:''}`:category==='skill'?(ALLY_SKILLS.includes(id)?allySkillState(game,id):`${skillStatus(p,id)}${p.skillState[id]?.cooldown?` ${t('controller.pack.cooldown',{cooldown:p.skillState[id].cooldown})}`:''}`):t('controller.pack.learned');
    // 3.107.0 (user request): a consumable is usable from the pack itself, so it needs no prepared slot. The slot
    // is on its way to becoming a 生效欄 for wearables, and a quick-use slot that also has to hold a medkit
    // cannot be both. The refusal comes from the rules layer, so a greyed button always matches what the turn
    // would have said.
    const useCell=(id,entry)=>{
      if(category!=='item'||!entry.action)return '';
      const reason=itemUseReason(game,id),cost=game.actionCost(entry.action);
      return `<button class="pack-use" data-use-item="${id}"${reason?' disabled':''} title="${reason||t(cost?'controller.useItemPaid':'controller.useItemFree',{item:entry.name})}">${t('controller.pack.use')}</button>`;
    };
    const useReason=(id,entry)=>category==='item'&&entry.action&&p[entry.resource]?itemUseReason(game,id):'';
    const row=([id,entry])=>{const on=p.prepared[category]===id,reason=useReason(id,entry);return `<div class="pack-row${on?' equipped':''}${category==='item'&&entry.action?' pack-row-usable':''}"><button class="pack-pick" data-prepare-category="${category}" data-prepare-id="${on?'':id}" aria-pressed="${on}"><span class="pack-icon" aria-hidden="true">${entry.icon}</span><span class="pack-name">${entry.name}</span><small>${on?entry.wear?t('controller.pack.wearing'):t('controller.pack.readied'):''}${status(id,entry)}</small></button>${useCell(id,entry)}${packInfo(`${category}-${id}`,(category==='skill'?skillText(p,id):entry.text)+(id==='medkit'?` ${t('controller.pack.medkitHeal',{v:healingAmount(p,45)+p.healBonus})}`:''))}${reason?`<p class="pack-reason">${t('controller.pack.reason',{reason})}</p>`:''}</div>`;};
    const allies=category==='skill'&&(game.allies.length||p.skills.includes('workshop'))?`<h3 class="pack-subhead">${t('controller.pack.alliesTitle')}</h3>${game.allies.length?`<ul class="pack-allies">${game.allies.map(a=>`<li><span>${allyName(a)}</span><small>${allyStatus(a)}</small></li>`).join('')}</ul>`:t('controller.pack.none')}${p.skills.includes('workshop')?`<p class="pack-hint">${t('controller.pack.workshopHint',{v:allySkillState(game,'workshop')})}</p>`:''}`:'';
    content=`<p class="pack-hint">${category==='grenade'?`${t('controller.pack.sharedCap',{v:grenadeTotal(p),v2:game.ammoCapacity('grenade')})} `:''}${category==='item'?t('controller.pack.itemHint'):t('controller.pack.readyHint')}</p>${options.length?`<div class="pack-rows">${options.map(row).join('')}</div>`:`<p class="pack-empty">${category==='skill'?t('controller.pack.noSkills'):t('controller.pack.nothing')}</p>`}${category==='item'?learningSection():''}${category==='skill'?petFeedingSection():''}${allies}`;
  }
  modal(`<h2 class="visually-hidden">${t('controller.pack.title')}</h2><div class="pack-resources"><span>${t('controller.pack.scrap')} <b>${p.scrap}</b></span><span>${t('controller.pack.plates')} <b>${p.plates}/${game.plateCapacity}</b></span><span>${t('controller.pack.weapons')} <b>${p.owned.length}/${game.weaponCapacity}</b></span></div>
    <div class="inventory-tabs" role="tablist" aria-label="${t('controller.pack.tabs')}">${Object.entries(INVENTORY_TABS).map(([id,label])=>`<button id="pack-tab-${id}" role="tab" aria-controls="pack-panel" aria-selected="${id===category}" tabindex="${id===category?0:-1}" data-inventory-tab="${id}">${label}</button>`).join('')}</div>
    ${message?`<p class="pack-message" role="status">${escapeHTML(message)}</p>`:''}
    <section id="pack-panel" role="tabpanel" aria-labelledby="pack-tab-${category}" tabindex="0">${content}</section>
    <div class="modal-footer"><button class="modal-button" data-modal="close">${t('controller.backToField')}</button></div>`,true);
}
// 3.141.0 (docs/WEAPONS.md): a shotgun is read by its pellets: each pellet's damage, how many reach at 1-6 tiles, the
// flat chance of each.
function pelletSummary(slot){const w=game.weaponAt(slot),d=game.pelletDamage(slot,{x:game.player.x+1,y:game.player.y});return `${t('controller.pack.pelletLine',{min:d.min,max:d.max,v:w.pellets.join(t('controller.slash')),pelletsLength:w.pellets.length,v2:pelletChance(w)})}`;}
function showWeaponComparison(take,against=game.player.weapon){
  const p=game.player,item=game.nearbyWeapon(take);if(!item||!p.owned.includes(against)){showInventory();return;}
  const old=game.weaponAt(against),next=game.weaponAt(take),a=game.weaponDamage(against),b=game.weaponDamage(take);
  const shot=w=>clampHit(w.melee?w.hitChance+actorStat(p,'meleeAccuracy'):97+w.accuracyBonus+actorStat(p,'rangedAccuracy')),pierce=w=>`${Math.round(w.pierce*100)}%`;
  const close=slot=>{const w=game.weaponAt(slot),d=w.pellets?game.pelletDamage(slot,{x:p.x+1,y:p.y}):game.weaponDamage(slot,{x:p.x+1,y:p.y});return w.pellets?`${t('controller.pack.pellets',{count:d.count,min:d.min,max:d.max})}`:w.closeRange?`${t('controller.pack.closeBand',{min:d.min,max:d.max,closeAccuracy:w.closeAccuracy})}`:t('controller.pack.sameDamage');};
  const single=(slot,d)=>{const w=game.weaponAt(slot);return w.pellets?`${t('controller.pack.perPellet',{v:game.pelletDamage(slot,{x:p.x+1,y:p.y}).min,v2:game.pelletDamage(slot,{x:p.x+1,y:p.y}).max})}`:`${d.min}–${d.max}`;};
  const aimed=(w,moving)=>w.pellets?`${t('controller.pack.perPelletHit',{v:pelletChance(w)})}`:`${shot(moving?{...w,accuracyBonus:w.accuracyBonus-22+w.tracking}:w)}%`;
  const rows=[[t('controller.cmp.close'),close(against),close(take)],[t('controller.cmp.single'),single(against,a),single(take,b)],[t('controller.cmp.rounds'),old.burstRange!==undefined?t('controller.cmp.burstBands'):old.burst||1,next.burstRange!==undefined?t('controller.cmp.burstBands'):next.burst||1],[t('controller.cmp.hitStill'),aimed(old,false),aimed(next,false)],[t('controller.cmp.hitMoving'),aimed(old,true),aimed(next,true)],[t('controller.cmp.ammoPerShot'),old.shotCost||1,next.shotCost||1],[t('controller.cmp.range'),old.range,next.range],[t('controller.cmp.magazine'),magazineLabel(old,p.ammo[against]),magazineLabel(next,p.ammo[take])],[t('controller.cmp.ammoType'),ammoName(old),ammoName(next)],[t('controller.cmp.pierce'),pierce(old),pierce(next)],[t('controller.cmp.upgrade'),`+${p.upgrades[against]}`,`+${p.upgrades[take]}`]];
  modal(`<div class="eyebrow">WEAPON COMPARISON</div><h2>${next.name}</h2><p>${next.affixText}<br>${next.desc}</p><p>${t('controller.cmp.against',{oldName:old.name,v:against===p.weapon?t('controller.cmp.equipped'):t('controller.cmp.spare')})}<br>${old.affixText}</p><div class="pack-actions">${p.owned.map(slot=>`<button data-compare="${take}" data-against="${slot}" ${slot===against?'disabled':''}>${game.weaponAt(slot).name} +${p.upgrades[slot]} · ${magazineLabel(game.weaponAt(slot),p.ammo[slot])}</button>`).join('')}<button data-salvage-ground="${take}">${t('controller.pack.salvageHere',{v:20+(p.upgrades[take]||0)*10})}</button>${p.owned.length<game.weaponCapacity?`<button class="primary" data-take="${take}">${t('controller.cmp.take')}</button>`:''}</div><table class="weapon-comparison"><thead><tr><th>${t('controller.cmp.stat')}</th><th>${t('controller.cmp.held')}</th><th>${t('controller.cmp.ground')}</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th>${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}</tbody></table><p>${t('controller.cmp.note')}</p>${old.locked?t('controller.cmp.boundNote'):`<p>${t('controller.cmp.swapNote',{oldName:old.name,v:against===p.weapon?t('controller.cmp.equipNew'):t('controller.cmp.keepCurrent')})}</p><button class="modal-button" data-replace="${take}" data-leave="${against}">${t('controller.cmp.swap')}</button>`}<button class="modal-button secondary" data-modal="bag">${t('controller.backToPack')}</button>`,true);
}
// Supply terminal (3.120.0 economy, src/terminal.js): a list of offers, then a payment step where the player picks what
// goes into the value pool; scrap covers the rest. Every price, reason and value comes from the rules module.
let terminalDraft=null;
const TRADE_GROUPS={ammo:t('controller.trade.ammo'),throw:t('controller.trade.throw'),item:t('controller.trade.item'),wear:t('controller.trade.wear'),weapon:t('controller.trade.weapon'),learning:t('controller.trade.learning')};
function terminalOfferGroups(){
  const p=game.player;
  return [
    {name:t('controller.shop.medical'),rows:[{id:'heal',title:t('controller.shop.heal'),detail:`${t('controller.shop.healDetail',{v:healingAmount(p,TERMINAL_TUNING.healAmount)})}`},{id:'med',title:t('controller.shop.medkit'),detail:`${t('controller.shop.medsHeld',{meds:p.meds,itemCapacity:game.itemCapacity()})}`},{id:'spray',title:PREPARED_CATALOG.item.spray.name,detail:`${t('controller.shop.spraysHeld',{sprays:p.sprays,itemCapacity:game.itemCapacity()})}`}]},
    {name:t('controller.shop.ammo'),rows:[{id:'ammo',title:t('controller.shop.ammoPack'),detail:Object.entries(TERMINAL_PACK).map(([id,n])=>`${AMMUNITION[id].name} ${n}`).join(t('common.listSeparator'))+t('controller.period')},...AMMO_IDS.map(id=>({id,title:`${AMMUNITION[id].name} +${TERMINAL_AMMO[id].amount}`,detail:`${t('controller.shop.current',{v:p[AMMUNITION[id].key],v2:game.ammoCapacity(id)})}`}))]},
    {name:t('controller.shop.throwables'),rows:Object.values(GRENADES).map(entry=>({id:entry.item,title:`${entry.name} +${entry.amount}`,detail:`${t('controller.shop.throwHeld',{v:p[entry.resource],v2:grenadeTotal(p),v3:game.ammoCapacity('grenade')})}`}))},
    {name:t('controller.shop.items'),rows:Object.entries(TERMINAL_ITEMS).filter(([id,offer])=>offer.sold!==false&&id!=='spray').map(([id,offer])=>{const entry=PREPARED_CATALOG.item[id],held=offer.wear?p.wearables.includes(offer.wear):p[offer.resource];return {id,title:entry.name,detail:offer.wear?(held?t('controller.shop.haveOne'):t('controller.shop.wearable')):`${t('controller.shop.itemHeld',{held,itemCapacity:game.itemCapacity()})}`};})},
    {name:t('controller.shop.upgrades'),rows:p.owned.map(slot=>{const w=game.weaponAt(slot),level=p.upgrades[slot]||0;return {id:`upgrade:${slot}`,title:`${w.name} +${Math.min(level+1,TERMINAL_TUNING.upgradeMax)}`,detail:`${t('controller.shop.upgradeDetail',{level,v:slot===p.weapon?t('controller.shop.inHand'):''})}`};})},
  ].map(group=>({...group,rows:group.rows.filter(row=>terminalSells(game.nearbyTerminal,row.id))})).filter(group=>group.rows.length);   // 3.135.0: this kind's offers only
}
function terminalAffordable(id){
  const deal=terminalDeal(game,id,{});if(!deal.reason)return '';
  const most=tradeHoldings(game).reduce((sum,row)=>sum+row.max*row.value,0);
  return game.player.scrap+most<deal.price?t('controller.shop.cannotAfford'):'';
}
function showTerminal(){
  const p=game.player,terminal=game.nearbyTerminal;terminalDraft=null;
  if(!terminal){notify(t('controller.shop.noTerminal'));return;}
  modal(`<div class="eyebrow">SUPPLY TERMINAL</div><h2>${t('controller.shop.title',{v:terminalName(terminal)})}</h2><p>${t('controller.shop.creditLeft')} <strong>${terminalRemaining(terminal)} / ${TERMINAL_TUNING.credit}</strong> ${t('controller.shop.intro',{scrap:p.scrap})}</p>${terminalOfferGroups().map(group=>`<h3 class="pack-subhead">${group.name}</h3>${group.rows.map(row=>{const reason=offerReason(game,row.id)||terminalAffordable(row.id);return `<button class="perk" data-terminal-pick="${row.id}" ${reason?'disabled':''}><strong>${row.title} · ${terminalCost(row.id,game)}</strong><span>${reason||row.detail}</span></button>`;}).join('')}`).join('')}<button class="modal-button secondary" data-modal="close">${t('controller.backToFieldPlain')}</button>`);
}
function showTerminalDeal(buy){
  const terminal=game.nearbyTerminal;if(!terminal||offerReason(game,buy)){showTerminal();return;}
  terminalDraft={buy,trade:{}};
  const title=terminalOfferGroups().flatMap(group=>group.rows).find(row=>row.id===buy)?.title||buy,price=terminalCost(buy,game),rows=tradeHoldings(game).filter(row=>row.held>0);
  const groups=Object.entries(TRADE_GROUPS).map(([group,name])=>[name,rows.filter(row=>row.group===group)]).filter(([,list])=>list.length);
  modal(`<div class="eyebrow">SUPPLY TERMINAL / PAYMENT</div><h2>${title} · ${price}</h2><p>${t('controller.pay.intro',{v:terminalRemaining(terminal),v2:terminalRemaining(terminal)-price})}</p>${groups.length?groups.map(([name,list])=>`<h3 class="pack-subhead">${name}</h3><div class="terminal-trades">${list.map(row=>`<div class="terminal-trade"><span><strong>${row.name}</strong><small>${t('controller.trade.row',{unit:row.unit,rowValue:row.value,held:row.held,v:row.reason?` · ${row.reason}`:''})}</small></span><span class="terminal-stepper"><button data-trade-step="${row.id}" data-step="-1" aria-label="${t('controller.trade.less',{rowName:row.name})}" disabled>−</button><b data-trade-count="${row.id}">0</b><button data-trade-step="${row.id}" data-step="1" aria-label="${t('controller.trade.more',{rowName:row.name})}" ${row.max?'':'disabled'}>${t('controller.trade.plus')}</button></span></div>`).join('')}</div>`).join(''):t('controller.pay.nothing')}<p class="terminal-total" id="terminal-total" aria-live="polite"></p><button class="modal-button" id="terminal-confirm" data-terminal-confirm>${t('controller.pay.confirm')}</button><button class="modal-button secondary" data-terminal-back>${t('controller.pay.back')}</button>`);
  refreshTerminalDeal();
}
function refreshTerminalDeal(){
  if(!terminalDraft)return;
  const {buy,trade}=terminalDraft,deal=terminalDeal(game,buy,trade),p=game.player,rows=new Map(tradeHoldings(game).map(row=>[row.id,row]));
  for(const node of document.querySelectorAll('[data-trade-count]'))node.textContent=String(trade[node.dataset.tradeCount]||0);
  for(const button of document.querySelectorAll('[data-trade-step]')){const id=button.dataset.tradeStep,count=trade[id]||0;button.disabled=button.dataset.step==='-1'?count<=0:count>=(rows.get(id)?.max||0);}
  const total=$('#terminal-total'),confirm=$('#terminal-confirm');
  if(total)total.textContent=`${t('controller.pay.total',{pool:deal.pool,v:deal.waste?`${t('controller.pay.wasted',{waste:deal.waste})}`:'',scrap:deal.scrap,scrap2:p.scrap,v2:Math.min(deal.pool,deal.price)+deal.scrap,price:deal.price})}`;
  if(confirm){confirm.disabled=Boolean(deal.reason);confirm.textContent=deal.reason||t('controller.pay.confirm');}
}
// Operator order is the user's preferred reading order; skills follow the
// operator that owns them, so a class without a skill simply contributes none.
const OPERATOR_ORDER=['soldier','recon','engineer','necromancer','druid','bulwark','berserker','ninja'];
// Unlock page and corpse recovery (docs/UNLOCKS.md section 8, Claude 3.90.1). Writes go through storage.grantUnlock and Game.recoverOperator only.
let unlockTab='characters';
const unlockStorageReady=()=>storage.available&&!storage.recoveryPending;
function showUnlocks(tab=unlockTab,message=''){unlockTab=tab==='stories'?'stories':'characters';modal(unlockPageMarkup(profile(),{tab:unlockTab,message,available:unlockStorageReady()}),true);drawOperatorSprites();}
function unlockRefusal(id){const entry=unlockEntry(id),reason=entry&&purchaseReason(profile(),entry,{available:unlockStorageReady()});if(entry&&!reason)return false;showUnlocks(unlockTab,reason?reason+t('controller.period'):'');return true;}
function confirmUnlock(id){if(!unlockRefusal(id))modal(purchaseConfirmMarkup(profile(),id),true);}
function buyUnlock(id){if(unlockRefusal(id))return;const entry=unlockEntry(id);
  if(!grantUnlock(game,id)){showUnlocks(unlockTab,t('controller.unlock.writeFailed'));return;}
  showUnlocks(entry.kind==='story'?'stories':'characters',entry.kind==='story'?`${t('controller.unlock.story',{title:entry.title})}`:`${t('controller.unlock.class',{label:CHARACTERS[id].label})}`);}
function recoverCorpse(){if(!operatorReady(game))return;const corpse=game.operatorCorpse,owned=availableCharacters(profile()).includes(corpse.character);
  if(!game.recoverOperator()){update();return;}
  persist();update();modal(operatorRecoveredMarkup(corpse.character,{newly:!owned}),true);drawOperatorSprites();}

function perkPips(player,perk,preview=false){
  const n=player.perks?.[perk.id]||0;
  if(perk.cap===null)return `<span class="perk-pips" role="img" aria-label="${t(preview?'controller.perkTakenPreview':'controller.perkTaken',{n,next:n+1})}"><span aria-hidden="true">×${n}</span></span>`;
  const total=Math.max(perk.cap,n+(preview?1:0)),shown=Math.min(total,32);
  const dots=Array.from({length:shown},(_,i)=>i<n?'●':preview&&i===n?'<span class="perk-next">◉</span>':'○').join('');
  return `<span class="perk-pips" role="img" aria-label="${t(preview?'controller.perkRankPreview':'controller.perkRank',{n,cap:perk.cap,next:n+1})}"><span aria-hidden="true">${dots}${total>shown?' ×'+total:''}</span></span>`;
}
function runPerks(){
  const acquired=PERKS.filter(o=>(game.player.perks?.[o.id]||0)>0);
  return acquired.length?`<section class="run-perks" aria-label="${t('controller.perks.runTitle')}"><h3>${t('controller.perks.runTitle')}</h3><ul>${acquired.map(o=>`<li><span>${o.name}</span>${perkPips(game.player,o)}</li>`).join('')}</ul></section>`:'';
}
// Level-up (3.115.0, user request): the award first lands as an incoming transmission over the battlefield, and the three
// choices open only once it is confirmed. Once per level of a run, so a second pending choice goes straight to the list.
function showLevelUp(){
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
function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>${t('controller.perks.granted')}</h2><p>${t('controller.perks.untilEnd',{v:game.pendingPerks>1?`${t('controller.perks.morePicks',{pendingPerks:game.pendingPerks})}`:''})}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>${t('controller.perks.option',{pName:p.name,v:perkPips(game.player,p,true)})}</strong><span>${p.text}${p.effect==='health'?`${t('controller.perks.classHeal',{v:healingAmount(game.player,p.heal)})}`:''}</span></button>`).join('')}${runPerks()}`);}
// Journal and result: endless records (3.49.1), class names from the character labels.
const classLabels=()=>Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,c.label]));
function endlessJournal(records){const rows=endlessRecordRows(records,classLabels());
  return `<h3>${t('controller.endless.title')}</h3><p>${rows.best?`${t('controller.endless.best',{best:rows.best,v:rows.classes.length?`<br>${t('controller.endless.classBest',{v:rows.classes.join(' · ')})}`:''})}`:t('controller.endless.none')}</p>`;}
function endlessResult(p,abandoned){if(abandoned)return t('controller.endless.abandoned');const records=profile(),rows=endlessRecordRows(records,classLabels());
  return rows.best?`<p>${t('controller.endless.bestLine',{v:isRecordRun(records,game.floor,p.level,p.kills)?t('controller.endless.newRecord'):'',best:rows.best})}</p>`:'';}
// Operator stats, run upgrades and passive rules moved here from the compact backpack (3.97.0).
function operatorStatus(){const p=game.player;return `<h3>${t('controller.status.title')}</h3><p>${t('controller.status.armor',{v:characterName(p.character),armor:p.armor})}<br>${combatStatSummary(p)}${meleeSummary(p).map(line=>'<br>'+line).join('')}</p>${runPerks()}<h3>${t('controller.status.passives')}</h3><p>${t('controller.status.passivesLine',{v:traitLabels(p).join(' · ')||t('controller.none')})}<br>${traitRuleLines(p).join('<br>')}<br>${t('controller.status.passivesNote')}</p>`;}
function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>${t('controller.journal.title')}</h2><div class="journal-tabs"><button data-modal="journal">${t('controller.journal.missions')}</button><button data-modal="bestiary">${t('controller.journal.bestiary')}</button><button data-modal="help">${t('controller.journal.manual')}</button></div><p>${game.missionSummary}</p>${runIsLive()?operatorStatus():''}<div class="result-stats"><div><b>${records.runs}</b>${t('controller.journal.runs')}</div><div><b>${records.wins}</b>${t('controller.journal.wins')}</div><div><b>${records.bestFloor}/6</b>${t('controller.journal.deepest')}</div></div><h3>${t('controller.journal.protocol',{balance:records.protocol.balance})}</h3><p>${t('controller.journal.protocolNote',{earned:game.protocol.earned,v:availableCharacters(records).length})}</p>${endlessJournal(records)}<h3>${t('controller.journal.pending',{v:(game.pendingStories||[]).length})}</h3>${(game.pendingStories||[]).map(id=>{const story=STORIES.find(s=>s.id===id);return `<p class="lore-entry"><strong>${escapeHTML(story?.title||t('controller.journal.archived'))}</strong><br>${escapeHTML(story?.body||'')}</p>`;}).join('')}<h3>${t('controller.journal.recent')}</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>${t('controller.journal.row',{v:MISSIONS[r.mission]?.name||MISSIONS.extraction.name,v2:characterName(r.character),seed:r.seed,v3:r.outcome==='abandoned'?t('controller.journal.abandoned'):r.won?t('controller.journal.extracted'):t('controller.journal.died'),v4:r.realMode?t('controller.journal.real'):'',floor:r.floor,v5:Number.isInteger(r.level)?` · LV.${pad(r.level)}`:'',kills:r.kills,turn:r.turn,v6:Array.isArray(r.mapGenerations)&&r.mapGenerations.length?` ${t('controller.journal.mapVersion',{v:r.mapGenerations.join('/')})}`:''})}</p>`).join(''):t('controller.journal.noRuns')}<button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);}
// The codex names cards the way the current facility does (3.103.1, user request), so 步槍兵 in play is 步槍兵 here.
// A variant still hides behind its parent when either the base or the facing name matches, which is what kept the
// armoured and elite cards out of the list before the factions had their own names.
function bestiary(){const codexName=id=>enemyName({type:id,faction:game.facilityFaction});
 modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>${t('controller.bestiary.title')}</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).filter(([id,e])=>!e.variantOf||(e.name!==ENEMY_TYPES[e.variantOf].name&&codexName(id)!==codexName(e.variantOf))).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${enemyGlyph(id)}</span><div><h3>${codexName(id)}</h3><small>${t('controller.bestiary.stats',{hp:e.hp,range:e.range,armor:e.armor})}</small><p>${e.role}</p><p>${traitLabels({traits:startingTraits(id,game.floor)}).join(' · ')||t('controller.bestiary.noPassives')}${floorTraitNote(id,TRAITS)}</p></div></article>`).join('')}</div><h3>${t('controller.status.passives')}</h3>${Object.values(TRAITS).map(tr=>`<p><strong>${tr.name}</strong>${t('controller.bestiary.traitText',{trText:tr.text})}</p>`).join('')}<p>${t('controller.bestiary.rulesNote')}</p><button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`,true);}
// 3.157.0: gear a class starts with beyond medkits and throwables (the ninja's decoys, mines and lines), for the operator list.
const startingKit=id=>{const s=startingSupplies(id),kit=Object.values(PREPARED_CATALOG.item).filter(e=>e.resource&&e.resource!=='meds'&&s[e.resource]>0);return kit.length?' · '+kit.map(e=>`${e.short} ×${s[e.resource]}`).join(t('controller.slash')):'';};
function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD ${VERSION}</div><h2>${t('manual.title')}</h2><p>${t('manual.intro')}</p><div class="help-grid"><b>${t('manual.directionsTitle')}</b><span>${t('manual.directions')}</span><b>${t('manual.fireTitle')}</b><span>${t('manual.fire')}</span><b>${t('manual.classesTitle')}</b><span>${t('manual.classes')}</span>${['soldier','recon','engineer','bulwark','berserker','ninja'].map(id=>`<b>${CHARACTERS[id].label}</b><span>${t(`manual.class.${id}`,{allies:t('manual.alliesTitle'),range:GRAPPLE_RANGE,ambush:MELEE_TUNING.ambush})}</span>`).join('')}<b>${t('manual.alliesTitle')}</b><span>${t('manual.allies',{carry:CARRY_DISTANCE})}</span><b>${t('manual.doorsTitle')}</b><span>${t('manual.doors')}</span><b>${t('manual.coverTitle')}</b><span>${t('manual.cover')}</span><b>${t('manual.orderTitle')}</b><span>${t('manual.order')}</span><b>${t('manual.endlessTitle')}</b><span>${endlessRules()} ${levelCapRules()}</span><b>${t('manual.unlockTitle')}</b><span>${UNLOCK_HELP}</span><b>${t('manual.lightTitle')}</b><span>${t('manual.light')}</span><b>${t('manual.hitTitle')}</b><span>${t('manual.hit')}</span><b>${t('manual.grenadeTitle')}</b><span>${t('manual.grenade')}</span><b>${t('manual.bagTitle')}</b><span>${t('manual.bag',{packLimit:PACK_LIMIT})}</span><b>${t('manual.supplyTitle')}</b><span>${t('manual.supply',{credit:TERMINAL_TUNING.credit,lineRange:LINE_TUNING.range})}</span><b>${t('manual.pursuitTitle')}</b><span>${t('manual.pursuit')}</span><b>${t('manual.suppressTitle')}</b><span>${suppressionHelp()}</span><b>${t('manual.dangerTitle')}</b><span>${t('manual.danger')}</span><b>${t('manual.exitTitle')}</b><span>${t('manual.exit')}</span><b>${t('manual.saveTitle')}</b><span>${t('manual.save')}</span></div><button class="modal-button" data-modal="close">${t('manual.close')}</button>`,true);}
function settings(){
  // 主選單進來只顯示全域設定；局內功能（指南、升級、簡介、放棄、重新部署）留在遊戲中的選單。
  const simulating=isSimulation(game),inRun=runIsLive(),sec=label=>`<div class="eyebrow settings-section">${label}</div>`;
  modal(`<div class="eyebrow">SYSTEM / BUILD ${VERSION}</div><h2>${inRun?t('settings.titleRun'):t('settings.titleSystem')}</h2>${inRun?runPerks():''}
<p>${inRun?`${t('settings.runLine',{v:characterName(game.player.character),v2:simulating?simulationLabel(game):`${t('controller.settings.missionLine',{seed:game.seed,floor:game.floor})}`,turn:game.turn})}`:`${t('settings.protocol',{v:profile().protocol.balance})}`}<br>${simulating?t('settings.simNoSave'):storage.available?t('settings.saved'):t('settings.noStorage')}</p>
${sec(t('settings.languageSection'))}
<button class="modal-button secondary" data-modal="language" lang="en">${t('settings.languageLabel',{name:LANGUAGE_STATUS[language()]?`${LANGUAGE_NAMES[language()]} (${LANGUAGE_STATUS[language()]})`:LANGUAGE_NAMES[language()]})}</button>
<p>${t('settings.languageNote')}<br>${t('settings.languageWip')}</p>
${sec(t('settings.sound'))}
<button class="modal-button secondary" data-modal="sound" aria-pressed="${audio.enabled}">${t('settings.soundLabel',{v:audio.enabled?t('controller.on'):t('controller.off')})}</button>
<label class="boundary-opacity" for="music-volume">${t('settings.musicVolume')} <output id="music-volume-value" for="music-volume">${Math.round(audio.musicVolume*100)}%</output><input id="music-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.musicVolume*100)}"></label>
<label class="boundary-opacity" for="sfx-volume">${t('settings.sfxVolume')} <output id="sfx-volume-value" for="sfx-volume">${Math.round(audio.sfxVolume*100)}%</output><input id="sfx-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.sfxVolume*100)}"></label>
<p>${t('settings.music')}</p>
<button class="modal-button secondary" data-modal="audioGrit" aria-pressed="${audio.grit!=='off'}">${t('settings.gritLabel',{v:GRIT_LABELS[audio.grit]})}</button>
<p>${t('settings.grit')}</p>
${sec(t('settings.display'))}
${inRun?t('settings.inRunButtons'):''}
<button class="modal-button secondary" data-modal="movementBoundaries" aria-pressed="${renderer.movementBoundaries}">${t('settings.boundsLabel',{v:renderer.movementBoundaries?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.bounds')}</p>
<label class="boundary-opacity" for="boundary-opacity">${t('settings.opacityLabel')} <output id="boundary-opacity-value" for="boundary-opacity">${renderer.boundaryOpacity}%</output><input id="boundary-opacity" type="range" min="0" max="100" step="5" value="${renderer.boundaryOpacity}" aria-describedby="boundary-opacity-help"></label>
<p id="boundary-opacity-help">${t('settings.opacity')}</p>
<button class="modal-button secondary" data-modal="skipPresentation" aria-pressed="${skipPresentation}">${t('settings.skipLabel',{v:skipPresentation?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.skip')}</p>
<button class="modal-button secondary" data-modal="autoRetarget" aria-pressed="${autoRetarget}">${t('settings.retargetLabel',{v:autoRetarget?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.retarget')}</p>
<button class="modal-button secondary" data-modal="frameRate" aria-pressed="${renderer.frameRate!==60}">${t('settings.fpsLabel',{frameRate:renderer.frameRate})}</button>
<p>${t('settings.fps')}</p>
<label class="boundary-opacity" for="screen-brightness">${t('settings.brightnessLabel')} <output id="screen-brightness-value" for="screen-brightness">${screenBrightness}%</output><input id="screen-brightness" type="range" min="${SCREEN_BRIGHTNESS.min}" max="${SCREEN_BRIGHTNESS.max}" step="${SCREEN_BRIGHTNESS.step}" value="${screenBrightness}" aria-describedby="screen-brightness-help"></label>
<p id="screen-brightness-help">${t('settings.brightness')}</p>
<button class="modal-button secondary" data-modal="vhs" aria-pressed="${vhsFilter}">${t('settings.vhsLabel',{v:vhsFilter?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.vhs')}</p>
<button class="modal-button secondary" data-modal="shake" aria-pressed="${renderer.shakeEnabled}">${t('settings.shakeLabel',{v:renderer.shakeEnabled?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.shake')}</p>
<button class="modal-button secondary" data-modal="glitch" aria-pressed="${renderer.glitchEnabled}">${t('settings.glitchLabel',{v:renderer.glitchEnabled?t('controller.on'):t('controller.off')})}</button><button class="modal-button secondary" data-modal="gore">${t('settings.goreLabel',{v:GORE_LABELS[goreChoice]()})}${renderer.reduceMotion&&goreChoice==='full'?t('settings.goreReduced'):''}</button>
<p>${t('settings.glitch')}</p>
<p>${t('settings.motion')}</p>
<div class="modal-row"><button class="modal-button secondary" data-modal="padLayout">${t('settings.layoutLabel',{v:DECK_LAYOUT_LABELS[padLayout]})}</button><button class="modal-button secondary" data-modal="padCell" ${padLayout==='grid'?'disabled':''}>${t('settings.padLabel',{v:padLayout==='grid'?t('settings.padNotGrid'):`${t('settings.padSize',{v:PAD_LABELS[padCell],padCell})}`})}</button></div>
<p>${t('settings.layout')}</p>
<button class="modal-button secondary" data-modal="deckEditor" ${padLayout==='grid'?'':'disabled'}>${t('settings.editDeck',{v:padLayout==='grid'?'':t('settings.gridOnly')})}</button>
${sec(t('settings.keyboard'))}
<button class="modal-button secondary" data-modal="hotkeyHints" aria-pressed="${hotkeyHints}">${t('settings.hintsLabel',{v:hotkeyHints?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.hotkeys')}</p>
<button class="modal-button secondary" data-modal="hotkeys">${t('settings.hotkeysButton')}</button>
<p>${t('settings.keymapNote')}</p>
${sec(t('settings.saveSection'))}
<div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">${t('settings.fullBackup')}</button>${simulating?'':t('settings.restore')}</div>
${read('ash-backup-before-restore')?t('settings.previousBackup'):''}
${simulating?t('settings.simBackup'):t('settings.backupBlock')}
${TEST_MODE?`${sec('測試：操作紀錄')}<div class="modal-row"><button class="modal-button secondary" data-modal="replayLoad">播放操作紀錄</button><button class="modal-button secondary" data-modal="replayFast">快速播放</button></div>
<div class="modal-row"><button class="modal-button secondary" data-modal="recordStart" ${runIsLive()&&!simulating?'':'disabled'}>從現在開始記錄</button><button class="modal-button secondary" data-modal="recordDownload" ${recording?.game===game?'':'disabled'}>下載操作紀錄</button></div>
<p>只在測試模式出現。操作紀錄來自 tools/text-play.mjs 或這裡的記錄；播放時畫面照常演出，每一步都和紀錄的狀態比對，不同就暫停。播放中不接受操作，左下角可以暫停或停止，停止後可以接手玩。</p>`:''}
${sec(t('settings.records'))}
<button class="modal-button secondary" data-modal="journal">${t('settings.journal')}</button>
${simulating?`${sec(t('settings.simSection'))}<button class="modal-button secondary" data-modal="mission">${t('settings.simBrief')}</button><button class="modal-button secondary" data-modal="khMenu">${t('settings.endSim')}</button>`:inRun?`${sec(t('settings.runSection'))}<button class="modal-button secondary" data-modal="mission">${t('settings.briefing')}</button><button class="modal-button secondary" data-modal="abandon" ${game.status!=='playing'?'disabled':''}>${t('settings.abandon')}</button><button class="modal-button secondary" data-modal="restart">${t('settings.redeploy')}</button>`:''}
${simulating?'':`${sec(t('settings.dangerSection'))}
<button class="modal-button secondary" data-modal="resetProgress">${t('settings.reset')}</button>`}
<button class="modal-button" data-modal="close">${inRun?simulating?t('settings.continueSim'):t('settings.continueRun'):t('controller.backToTitle')}</button>`);
}
// The result sheet reports on a run that is over, so it belongs to the title flow as well (3.98.1, user request):
// full screen and back up at the top, not a bottom sheet with the finished battle showing above it. 查看最後戰場
// is still how you look at the map.
// The results are the last part of a run's end (3.177.0, src/outro.js): the officer has already spoken, on the field and
// on the dark screen. Opening them stops whatever of that is still playing; reopening them later is just the report.
function showResult(){endOutro();titleFlow=true;if(isSimulation(game)){showSimulationResult();return;}const won=game.status==='won',abandoned=game.status==='abandoned',p=game.player,copy=resultCopy(game);modal(`<div class="eyebrow">${copy.eyebrow} / RUN ${game.seed}${game.realMode?' / REAL':''}</div><h2>${copy.title}</h2><p>${copy.body}</p><p>${game.missionSummary}</p>${purgeReportMarkup(game)}${resultStoriesMarkup(game,profile())}${isEndless(game)?`<div class="result-stats"><div><b>${pad(game.floor)}</b>${t('controller.result.depth')}</div><div><b>${pad(p.level)}</b>${t('controller.result.level')}</div><div><b>${p.kills}</b>${t('controller.result.kills')}</div></div>${endlessResult(p,abandoned)}<p>${t('controller.result.turns',{turn:game.turn})}</p>`:`<div class="result-stats"><div><b>${pad(game.deepestFloor)}</b>${t('controller.result.deepest')}</div><div><b>${p.kills}</b>${t('controller.result.kills')}</div><div><b>${game.turn}</b>${t('controller.result.turnCount')}</div></div>`}<p>${t('controller.result.protocolTotal',{v:game.realMode?`${t('controller.result.realProtocol',{v:protocolSettlement(game).base,v2:protocolSettlement(game).bonus})}`:`${t('controller.result.protocol',{earned:game.protocol.earned})}`,v2:profile().protocol.balance})}<br>${t('controller.result.protocolNote')}</p><div class="operator-identity result-identity">${portraitMarkup(p.portrait,game.status)}<p>${characterName(p.character)}<br>${t('controller.result.stats',{damage:p.stats.damage,grenades:p.stats.grenades,loreLength:p.lore.length})}</p></div><div class="modal-footer"><button class="modal-button secondary" data-modal="lastBattle">${t('controller.result.lastBattle')}</button>${game.status==='dead'?t('controller.result.deadButtons'):t('controller.result.redeploy')}</div>`);}
// Kill house sessions (docs/KILLHOUSE.md section 10). A simulation replaces the game on screen without abandoning or
// saving the campaign; leaving puts the stashed campaign back exactly as it was.
let simulationReturn=null;const simulationResults=new WeakMap();
function startSimulation(options){
  if(options.mode==='arcade'&&!availableCharacters(profile()).includes(options.character||'soldier')){notify(t('controller.classLocked'));return;}
  let next;try{next=startKillhouse(options);}catch(error){notify(error.message,{danger:true});return;}
  if(!isSimulation(game))simulationReturn={game,entered,resumable};
  game=next;entered=true;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();
}
function exitSimulation(){
  if(!isSimulation(game))return;
  const saved=simulationReturn?null:loadGame();
  ({game,entered,resumable}=simulationReturn||{game:saved||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),entered:false,resumable:Boolean(saved)});
  simulationReturn=null;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus=game.status;previousFloor=game.floor;update();
}
function showKillhouseMenu(){modal(killhouseMenuMarkup(profile(),orderedCharacters(),lockedCharacters()));}
// Cards already shown in this session; tutorial cards fire on the tile before a door, before the room's own entry event.
const promptLogs=new WeakMap(),promptLog=g=>{if(!promptLogs.has(g))promptLogs.set(g,new Set());return promptLogs.get(g);};
function showRoomPrompt(){const prompt=nextPrompt(game,game.takeRoomEvents(),promptLog(game));if(!prompt)return;if(prompt.modal)modal(roomPromptMarkup(prompt));else notify(prompt.text);}
// Records are written once per finished session; reopening the result reuses the same screen.
function simulationResultMarkup(){
  const r=game.simulationResult;
  if(r.outcome==='dead')return disposedMarkup(r);
  if(r.outcome!=='won')return null;
  if(r.mode==='tutorial')return tutorialResultMarkup(game,{saved:saveTutorialOutcome('completed')});
  const score=killhouseScore(r),before=bestRecord(profile(),r)?.score??null;let saved=false;
  try{saved=saveArcadeResult(game,score,KILLHOUSE_SCORE.formula);}catch{saved=false;}
  const best=bestRecord(profile(),r)?.score??null;
  return arcadeResultMarkup(game,{score,best,newRecord:saved&&best===score&&(before===null||score>before),saved});
}
function showSimulationResult(){
  if(!simulationResults.has(game))simulationResults.set(game,simulationResultMarkup());
  const html=simulationResults.get(game);if(!html){exitSimulation();showIntro();return;}modal(html);
}
function newGame(seed,character,mission,options={facilityFaction:'random'}){if(isSimulation(game))exitSimulation();const portrait=deploymentFaces[character];if(!availableCharacters(profile()).includes(character)||!validCharacter(character)||!validPortrait(portrait)||!validMissionId(mission)){notify(t('controller.pickValidCharacter'));return;}if(game.status==='playing'&&(entered||resumable)){try{abandonRun(game);}catch(error){backupError(error);return;}}entered=true;resumable=false;game=startCampaign({seed,character,portrait,mission,options,duty:TEST_MODE?dutyOverride:undefined});dutyOverride=null;commsMemory=null;commsBefore=null;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();floorToast();showBriefing();}
function exportSave(){const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ash-protocol-${game.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(t('controller.saveExported'));}
function downloadJSON(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Layout editor (3.102.0, user request): tap one cell then another and they swap, which reaches any arrangement
// without a function picker. Only 格狀 is editable, because only its cells are interchangeable.
function showDeckEditor(message=''){
  const cells=deckLayout.map((id,index)=>`<button class="deck-slot${deckPick===index?' picked':''}${id?'':' empty'}" data-slot="${index}" aria-pressed="${deckPick===index}" aria-label="${t('controller.deckEdit.slotAria',{n:index+1,v:id?DECK_LABELS[id]:t('controller.deckEdit.empty')})}"><span class="deck-slot-icon" aria-hidden="true">${id?DECK_GLYPHS[id]:'\u00b7'}</span><span>${id?DECK_LABELS[id]:t('controller.deckEdit.empty')}</span></button>`).join('');
  modal(`<div class="eyebrow">CONTROL DECK / LAYOUT</div><h2>${t('controller.deckEdit.title')}</h2>
<p>${t('controller.deckEdit.help')}</p>
<div class="deck-editor">${cells}</div>
${message?`<p>${message}</p>`:''}
<div class="modal-row"><button class="modal-button secondary" data-modal="deckMirror">${t('controller.deckEdit.mirror')}</button><button class="modal-button secondary" data-modal="deckReset">${t('controller.deckEdit.reset')}</button></div>
<button class="modal-button secondary" data-modal="settings">${t('controller.deckEdit.back')}</button>`);
}
function saveDeckLayout(){write('ash-deck-layout',JSON.stringify(deckLayout));applyDeck();fitLayout();}
function pickDeckSlot(index){
  if(deckPick===null){deckPick=index;showDeckEditor();return;}
  if(deckPick===index){deckPick=null;showDeckEditor();return;}
  deckLayout=swapSlots(deckLayout,deckPick,index);deckPick=null;saveDeckLayout();showDeckEditor();
}
function backupError(error){modal(`<h2>${t('controller.backup.failedTitle')}</h2><p>${escapeHTML(error.message)}</p><button class="modal-button" data-modal="backupCancel">${t('controller.backToSettings')}</button>`);}
function adoptSnapshot(next){
  game=next.game?connectUnlocks(next.game):new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying);entered=Boolean(next.game);resumable=Boolean(next.game);
  playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus='playing';previousFloor=game.floor;
  $('#modal').close();update();if(!entered)showIntro();
}
function applyBackup(){
  if(!pendingBackup)return;
  try{
    const next=restoreBackup(pendingBackup,game);pendingBackup=null;
    adoptSnapshot(next);notify(t('controller.backup.restored'));
  }catch(error){backupError(error);}
}

$('#import-backup').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;pendingBackup=null;
  try{
    if(file.size>BACKUP_LIMIT)throw new Error(t('controller.backup.tooLarge'));
    const raw=await file.text(),next=previewBackup(raw),p=next.snapshot.profile;pendingBackup=raw;
    modal(`<div class="eyebrow">RESTORE BACKUP</div><h2>${t('controller.backup.confirmTitle')}</h2><p>${escapeHTML(file.name)}<br>${escapeHTML(new Date(next.snapshot.createdAt).toLocaleString('zh-TW'))}</p><p>${t('controller.backup.protocol',{v:profile().protocol.balance,balance:p.protocol.balance})}<br>${t('controller.backup.records',{runs:p.runs,charactersLength:p.unlocks.characters.length,v:p.unlocks.stories?.length||0})}<br>${next.game?`${t('controller.backup.mission',{seed:next.game.seed,floor:next.game.floor,turn:next.game.turn})}`:t('controller.backup.noMission')}</p><p>${t('controller.backup.replaceNote')}</p><button class="modal-button" data-modal="backupConfirm">${t('controller.backup.confirm')}</button><button class="modal-button secondary" data-modal="backupCancel">${t('controller.cancel')}</button>`);
  }catch(error){backupError(error);}e.target.value='';
});

document.addEventListener('change',e=>{
  if(e.target.name==='operator-color'){drawOperatorSprites();return;}
  if(e.target.name==='character'&&e.target.closest('.operator-list')){const preview=$('#modal [data-color-preview]');if(preview){preview.dataset.classSprite=e.target.value;drawOperatorSprites();}return;}
  if(e.target.name!=='mission'||!e.target.closest('.mission-list'))return;
  for(const p of document.querySelectorAll('.mission-brief>p'))p.classList.toggle('active',p.dataset.mission===e.target.value);
});
document.addEventListener('input',e=>{
  if(e.target.id==='music-volume'||e.target.id==='sfx-volume'){const music=e.target.id==='music-volume',percent=volumePercent(e.target.value,music?AUDIO_TUNING.musicDefault:AUDIO_TUNING.sfxDefault);
    audio.setVolumes(music?{music:percent/100}:{sfx:percent/100});write(music?'ash-music-volume':'ash-sfx-volume',String(percent));const out=$(`#${e.target.id}-value`);if(out)out.textContent=percent+'%';return;}
  if(e.target.id==='screen-brightness'){screenBrightness=screenBrightnessPercent(e.target.value);write('ash-brightness',String(screenBrightness));applyBrightness();const out=$('#screen-brightness-value');if(out)out.textContent=screenBrightness+'%';return;}
  if(e.target.id!=='boundary-opacity')return;
  renderer.boundaryOpacity=boundaryOpacityPercent(e.target.value);write('ash-boundary-opacity',String(renderer.boundaryOpacity));
  const output=$('#boundary-opacity-value');if(output)output.textContent=renderer.boundaryOpacity+'%';
});

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(performance.now()<swallowClicksUntil){swallowClicksUntil=0;return;}
  // Settling the animation may raise a menu (level-up, room prompt); then this press was only the skip.
  if(b&&!b.disabled&&skipPlayback()&&$('#modal').open)return;
  if(playback||orientationBlocked||!b||b.disabled)return;
  // 3.117.0: pressing a button in a menu is heard (the adopted select sound); the battle controls have their own sounds.
  if(b.closest('#modal'))audio.play('select');
  if(b.dataset.packInfo){const desc=document.getElementById('pack-desc-'+b.dataset.packInfo);if(desc){desc.hidden=!desc.hidden;b.setAttribute('aria-expanded',String(!desc.hidden));}return;}
  if(b.dataset.inventoryTab){showInventory(b.dataset.inventoryTab);$(`[data-inventory-tab="${inventoryTab}"]`).focus({preventScroll:true});return;}
  if(b.dataset.useItem){const id=b.dataset.useItem,entry=PREPARED_CATALOG.item[id],reason=itemUseReason(game,id);
    if(reason){showInventory('item',reason+t('controller.period'));return;}
    if(entry.aim==='side'){close();startDeploy();return;}
    if(entry.aim==='throw'){close();startThrowAim(id);return;}
    modalAction(entry.action);return;}
  if(b.dataset.prepareCategory){
    const category=b.dataset.prepareCategory,id=b.dataset.prepareId||null;
    // Putting a wearable on or taking it off costs a turn, so it closes the pack and resolves like any other action.
    if(game.actionCost('prepare',{category,id})>0){modalAction('prepare',{category,id});return;}
    if(game.action('prepare',{category,id})){update();showInventory(category,id?t('controller.pack.readiedFree'):t('controller.pack.unreadiedFree'));$(`[data-inventory-tab="${category}"]`).focus({preventScroll:true});}return;
  }
  if(b.dataset.context){close();if(b.dataset.context.startsWith('objective:')){act('recoverObjective',b.dataset.context.slice(10));return;}if(b.dataset.context.startsWith('case:')){act('openContainer',b.dataset.context.slice(5));return;}if(b.dataset.context.startsWith('door:')){const door=game.nearbyDoors.find(d=>d.id===b.dataset.context.slice(5));if(door)act('door',{id:door.id,open:!door.open});}else if(b.dataset.context==='bag')showInventory('weapon');else if(b.dataset.context==='terminal')showTerminal();else if(b.dataset.context==='operator')recoverCorpse();else if(b.dataset.context==='exitStep'){if(exitStep(game))act('move',exitStep(game));}else act('interact');return;}
  if(b.dataset.move){move(...b.dataset.move.split(',').map(Number));return;}
  if(b.dataset.slot!==undefined){pickDeckSlot(Number(b.dataset.slot));return;}
  if(b.dataset.perk){game.choosePerk(b.dataset.perk);$('#modal').close();update();return;}
  if(b.dataset.equip!==undefined){modalAction('weapon',Number(b.dataset.equip));return;}
  // 3.136.0 (user decision): which melee weapon a bump uses is picked in the pack, like a prepared grenade; it is free.
  if(b.dataset.bump!==undefined){const slot=Number(b.dataset.bump);if(game.action('meleeChoice',slot)){update();showInventory('weapon',`${t('controller.pack.meleeChoice',{v:game.weaponAt(slot).name})}`);}return;}
  if(b.dataset.compare!==undefined){showWeaponComparison(Number(b.dataset.compare),b.dataset.against===undefined?game.player.weapon:Number(b.dataset.against));return;}
  if(b.dataset.replace!==undefined){modalAction('replaceWeapon',{take:Number(b.dataset.replace),leave:Number(b.dataset.leave)});return;}
  if(b.dataset.take!==undefined){modalAction('takeWeapon',Number(b.dataset.take));return;}
  if(b.dataset.salvage!==undefined){const index=Number(b.dataset.salvage);modal(`<div class="eyebrow">SALVAGE WEAPON</div><h2>${t('controller.salvage.title',{v:game.weaponAt(index).name})}</h2><p>${t('controller.salvage.body')}</p><button class="modal-button" data-confirm-salvage="${index}">${t('controller.salvage.confirm')}</button><button class="modal-button secondary" data-modal="bag">${t('controller.backToPack')}</button>`);return;}
  if(b.dataset.salvageGround!==undefined){const slot=Number(b.dataset.salvageGround),level=game.player.upgrades[slot]||0;
    modal(`<div class="eyebrow">SALVAGE ON SITE</div><h2>${t('controller.salvage.groundTitle',{v:game.weaponAt(slot).name})}</h2><p>${t('controller.salvage.groundBody',{v:game.player.ammo[slot],v2:salvageValue(game.player,slot)})}</p><button class="modal-button" data-confirm-salvage-ground="${slot}">${t('controller.salvage.confirm')}</button><button class="modal-button secondary" data-modal="bag">${t('controller.backToPack')}</button>`);return;}
  if(b.dataset.confirmSalvageGround!==undefined){modalAction('salvageGround',Number(b.dataset.confirmSalvageGround));return;}
  if(b.dataset.confirmSalvage!==undefined){modalAction('salvage',Number(b.dataset.confirmSalvage));return;}
  if(b.dataset.feedOption){feedAction({optionId:b.dataset.feedOption});return;}
  if(b.dataset.feedWeapon!==undefined){const slot=Number(b.dataset.feedWeapon),w=game.weaponAt(slot),q=petFeedQuote(game,{optionId:'weapon',weaponSlot:slot});
    modal(`<div class="eyebrow">FEED WEAPON</div><h2>把${w.name}餵給獵獸？</h2><p>武器會從背包移除，彈匣內的 ${game.player.ammo[slot]} 發退回備彈（超過上限的留在地上），不給廢料。砲台成長 +${q.gain}${q.overflow?`（超出 ${q.overflow} 不計）`:''}，耗費 1 回合。</p><button class="modal-button" data-confirm-feed-weapon="${slot}">確認餵食</button><button class="modal-button secondary" data-inventory-tab="skill">返回背包</button>`);return;}
  if(b.dataset.confirmFeedWeapon!==undefined){feedAction({optionId:'weapon',weaponSlot:Number(b.dataset.confirmFeedWeapon)});return;}
  if(b.dataset.petOutput){const kind=b.dataset.petOutput,reason=outputChoiceReason(game,{kind});if(reason){showInventory('skill',reason+'。');return;}
    if(game.action('setPetOutput',{kind})){update();showInventory('skill',`排出種類改為${GRENADES[kind].name}，不耗回合。`);}return;}
  if(b.dataset.learn){const id=b.dataset.learn,entry=LEARNING_ITEMS[id];if(game.action('learn',id)){persist();update();showInventory('item',t(entry?.trait?'controller.learnedPassive':'controller.learnedSkill',{name:(entry?.trait?TRAITS[entry.trait]?.name:SKILLS[entry?.skills?.[0]]?.name)??''}));}else showInventory('item');return;}
  if(b.dataset.unlockTab){showUnlocks(b.dataset.unlockTab);return;}
  if(b.dataset.unlockBuy){confirmUnlock(b.dataset.unlockBuy);return;}
  if(b.dataset.unlockConfirm){buyUnlock(b.dataset.unlockConfirm);return;}
  if(b.dataset.workshop!==undefined){showWorkshop();return;}
  if(b.dataset.workshopBuild!==undefined){showBlueprints();return;}
  if(b.dataset.workshopRepair){modalAction('repairUnit',b.dataset.workshopRepair);return;}
  if(b.dataset.workshopBlueprint){modalAction('buildUnit',{blueprint:b.dataset.workshopBlueprint,...(b.dataset.payload?{payload:b.dataset.payload}:{}),...(b.dataset.weapon!==undefined?{weapon:Number(b.dataset.weapon)}:{})});return;}
  if(b.dataset.workshopDeploy!==undefined){startDeployAim(Number(b.dataset.workshopDeploy));return;}
  if(b.dataset.bagAction){modalAction(b.dataset.bagAction);return;}
  if(hotkeyCapture&&!b.dataset.hotkeySlot)hotkeyCapture=null;   // any other button ends the wait for a key
  if(b.dataset.hotkeySlot){const [id,slot]=b.dataset.hotkeySlot.split(':');hotkeyCapture={id,slot:Number(slot)};showHotkeys();return;}
  if(b.dataset.hotkeyReset!==undefined){saveHotkeys(defaultBindings());showHotkeys(t('controller.keys.restored'));return;}
  if(b.dataset.hotkeyCancel!==undefined){hotkeyCapture=null;showHotkeys();return;}
  if(b.dataset.terminalPick){showTerminalDeal(b.dataset.terminalPick);return;}
  if(b.dataset.tradeStep&&terminalDraft){const id=b.dataset.tradeStep,max=tradeHoldings(game).find(row=>row.id===id)?.max||0,next=Math.max(0,Math.min(max,(terminalDraft.trade[id]||0)+Number(b.dataset.step)));if(next)terminalDraft.trade[id]=next;else delete terminalDraft.trade[id];refreshTerminalDeal();return;}
  if(b.dataset.terminalConfirm!==undefined&&terminalDraft){const {buy,trade}=terminalDraft;terminalDraft=null;modalAction('terminal',{buy,trade});return;}
  if(b.dataset.terminalBack!==undefined){showTerminal();return;}
  if(b.dataset.modal){switch(b.dataset.modal){
    case 'lastBattle':$('#modal').close();break;case 'enter':entered=true;$('#modal').close();update();floorToast();break;case 'intro':showIntro();break;case 'mission':showMission();break;case 'close':close();break;case 'bag':showInventory();break;case 'journal':showJournal();break;case 'bestiary':bestiary();break;case 'help':showHelp();break;case 'log':showLog();break;
    case 'unlocks':showUnlocks();break;
    case 'result':showResult();break;
    // 3.114.0 (user request): after a loss, the same mission, seed and options with only the operative chosen again.
    case 'redeploySame':{const plan=retryPlan(game);deploymentFaces=deploymentPortraits(Object.keys(CHARACTERS));deployDraft={mode:'retry',mission:plan.mission,seed:plan.seed,character:plan.character,retry:plan.options};showDeployOperator();break;}
    case 'retryStart':{const character=$('input[name="character"]:checked')?.value,color=$('input[name="operator-color"]:checked')?.value;
      if(!validCharacter(character)){notify(t('controller.pickValidOperator'));return;}
      if(validOperatorColor(color)){renderer.operatorColor=color;write('ash-operator-color',color);}
      newGame(deployDraft.seed,character,deployDraft.mission,deployDraft.retry);break;}
    case 'abandon':modal(t('controller.abandon.dialog'));break;
    case 'abandonConfirm':try{if(abandonRun(game)){cancelAim();update();}}catch(error){backupError(error);}break;
    case 'resetProgress':modal(t('controller.reset.dialog'));break;
    case 'resetConfirm':try{adoptSnapshot(resetProgress(game));notify(t('controller.reset.done'));}catch(error){backupError(error);}break;
    case 'settings':settings();break;
    case 'deckEditor':deckPick=null;showDeckEditor();break;
    case 'deckMirror':deckLayout=mirrorDeck(deckLayout);deckPick=null;saveDeckLayout();showDeckEditor(t('controller.deckEdit.mirrored'));break;
    case 'deckReset':deckLayout=[...DECK_GRID];deckPick=null;saveDeckLayout();showDeckEditor(t('controller.deckEdit.restored'));break;
    case 'padLayout':padLayout=DECK_LAYOUTS[(DECK_LAYOUTS.indexOf(padLayout)+1)%DECK_LAYOUTS.length];write('ash-pad-layout',padLayout);applyDeck();fitLayout();settings();break;
    case 'padCell':padCell=PAD_SIZES[(PAD_SIZES.indexOf(padCell)+1)%PAD_SIZES.length];write('ash-pad-cell',String(padCell));applyDeck();fitLayout();settings();break;
    case 'audioGrit':{const order=Object.keys(GRIT_LEVELS),next=order[(order.indexOf(audio.grit)+1)%order.length];audio.setGrit(next);write('ash-audio-grit',next);settings();break;}
    case 'shake':renderer.shakeEnabled=!renderer.shakeEnabled;renderer.shakes=[];write('ash-shake',renderer.shakeEnabled?'on':'off');settings();break;
    case 'gore':goreChoice=GORE_SETTINGS[(GORE_SETTINGS.indexOf(goreChoice)+1)%GORE_SETTINGS.length];renderer.goreLevel=goreLevel(goreChoice,renderer.reduceMotion);if(renderer.goreLevel==='off')renderer.gore=[];write('ash-gore',goreChoice);settings();break;
    case 'glitch':renderer.glitchEnabled=!renderer.glitchEnabled;renderer.glitches=[];renderer.objectGlitches.clear();write('ash-glitch',renderer.glitchEnabled?'on':'off');settings();break;
    case 'reclaimTab':location.reload();return;
    // 3.167.0: the language is chosen when the page loads, so switching saves the choice and reloads (the run is saved).
    case 'language':{const next=LANGUAGES[(LANGUAGES.indexOf(language())+1)%LANGUAGES.length];if(runIsLive())persist();if(languageChoice(next))location.reload();else notify(t('settings.languageFailed'));break;}
    case 'vhs':vhsFilter=!vhsFilter;write('ash-vhs',vhsFilter?'on':'off');document.documentElement.classList.toggle('vhs',vhsFilter);settings();break;
    case 'transmission':transmissionSeen=transmissionKey();showPerks();break;
    case 'hotkeyHints':hotkeyHints=!hotkeyHints;write('ash-hotkey-hints',hotkeyHints?'on':'off');applyHotkeyHints();settings();break;
    case 'hotkeys':showHotkeys();break;
    case 'frameRate':renderer.frameRate=nextFrameRate(renderer.frameRate);write('ash-frame-rate',String(renderer.frameRate));settings();break;
    case 'skipPresentation':skipPresentation=!skipPresentation;write('ash-skip-presentation',skipPresentation?'on':'off');settings();break;
    case 'autoRetarget':autoRetarget=!autoRetarget;write('ash-auto-retarget',autoRetarget?'on':'off');if(autoRetarget)retarget();settings();break;
    case 'movementBoundaries':renderer.movementBoundaries=!renderer.movementBoundaries;write('ash-movement-boundaries',renderer.movementBoundaries?'on':'off');settings();break;
    case 'sound':audio.setEnabled(!audio.enabled);write('ash-sound',audio.enabled?'on':'off');syncMusic();settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify(t('controller.backup.exported'));}catch(error){backupError(error);}break;
    case 'backupImport':$('#import-backup').click();break;
    case 'replayLoad':case 'replayFast':replayOptions={fast:b.dataset.modal==='replayFast'};$('#import-replay').click();break;
    case 'recordStart':startRecording();settings();break;
    case 'recordDownload':downloadRecording();break;
    case 'backupPrevious':{const raw=read('ash-backup-before-restore');if(raw)downloadJSON(raw,'ash-protocol-before-restore.json');break;}
    case 'backupConfirm':applyBackup();break;case 'backupCancel':pendingBackup=null;settings();break;
    case 'export':exportSave();break;case 'import':$('#import-save').click();break;
    // Deployment reached from a finished run (the result sheet's 重新部署) belongs to the title flow too, so it covers
    // the run that just ended; deploying mid-run keeps the sheet, because that battle is still the player's context.
    case 'restart':case 'deploy':if(isSimulation(game))exitSimulation();if(!runIsLive())titleFlow=true;if(tutorialGate(profile()).required)modal(tutorialGateMarkup());else showDeployment();break;
    case 'killhouse':showKillhouseMenu();break;case 'khTutorial':startSimulation({mode:'tutorial'});break;case 'khArcade':startSimulation({mode:'arcade',character:b.dataset.character});break;
    case 'khRetry':startSimulation({mode:'arcade',character:game.player.character});break;case 'khMenu':exitSimulation();showIntro();break;
    case 'khSkip':if(!saveTutorialOutcome('skipped'))notify(t('controller.killhouse.skipNotSaved'),{danger:true});showDeployment();break;
    case 'deployNormal':deployDraft={mode:'normal',mission:null,seed:undefined};showDeployMission();break;
    case 'deployOperator':{const value=$('#new-seed')?.value,seed=value!==undefined&&value!==''?Number(value):undefined;
      if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>999999999)){const advanced=$('.seed-advanced');if(advanced)advanced.open=true;notify(t('controller.deploy.seedInvalid'));return;}
      const mission=$('input[name="mission"]:checked')?.value;
      if(!validMissionId(mission)){notify(t('controller.deploy.pickValidMission'));return;}
      deployDraft={mode:'normal',mission,seed};showDeployOperator();break;}
    case 'deployDaily':{const seed=dailySeed();deployDraft={mode:'daily',mission:dailyMission(seed,MISSION_IDS),seed};showDeployOperator();break;}
    case 'deployQuick':if(runIsLive()){modal(t('controller.deploy.quickAbandon'));}else startQuick();break;
    case 'deployQuickStart':startQuick();break;
    case 'deployDifficulty':{const character=$('input[name="character"]:checked')?.value,color=$('input[name="operator-color"]:checked')?.value;
      if(!validCharacter(character)){notify(t('controller.pickValidCharacter'));return;}
      deployDraft={...deployDraft,character,color:validOperatorColor(color)?color:deployDraft.color};showDeployDifficulty();break;}
    case 'deployBackOperator':deployDraft={...deployDraft,difficulty:$('input[name="difficulty"]:checked')?.value,realMode:Boolean($('input[name="real-mode"]')?.checked),facility:$('input[name="facility"]:checked')?.value};showDeployOperator();break;
    case 'new':{const {character,color}=deployDraft,options=runOptions({difficulty:$('input[name="difficulty"]:checked')?.value,realMode:Boolean($('input[name="real-mode"]')?.checked),facility:$('input[name="facility"]:checked')?.value});
      if(validOperatorColor(color)){renderer.operatorColor=color;write('ash-operator-color',color);}
      if(!validMissionId(deployDraft.mission)){notify(t('controller.deploy.pickMissionFirst'));showDeployment();return;}
      newGame(deployDraft.seed,character,deployDraft.mission,options);break;}
  }return;}
  switch(b.dataset.action){
    case 'mission':showMission();break;case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'settings':settings();break;case 'bag':showInventory();break;case 'weapons':showInventory('weapon');break;case 'terminal':showTerminal();break;
    case 'item':useItem();break;case 'skill':skill();break;case 'saveWarning':showSaveWarning();break;
    case 'toggleTargeting':toggleTargeting();break;case 'cycleTarget':cycleTarget();break;case 'grenade':grenade();break;case 'cancelAim':cancelAim();break;case 'fire':fireWeapon();break;
    case 'zoomIn':zoomBy(.15);break;
    case 'zoomOut':zoomBy(-.15);break;
    case 'center':centerCamera();break;
    // 3.167.1: a button with no action (the landscape override) is not a game command; it used to send an empty
    // action that the rules refused as "no such item".
    default:if(b.dataset.action)act(b.dataset.action);
  }
});
$('#orientation-guard').addEventListener('cancel',e=>e.preventDefault());
// Devices that cannot rotate may continue in landscape until the page reloads (3.44).
$('#orientation-continue').addEventListener('click',()=>{orientationOverride=true;updateOrientation();});
$('#field-messages').addEventListener('click',e=>{if(!e.target.closest('button')&&entered&&!playback&&!orientationBlocked&&!$('#modal').open)showLog();});
$('#modal').addEventListener('close',()=>{titleFlow=false;syncMusic();});
$('#modal').addEventListener('cancel',e=>{if(!entered||game.pendingPerks||game.status!=='playing')e.preventDefault();});
let pointerStart=null;
$('#battle').addEventListener('pointerdown',e=>{pointerStart=(playback&&!skipEnabled())||orientationBlocked?null:{x:e.clientX,y:e.clientY};});
$('#battle').addEventListener('pointerup',e=>{
  if(pointerStart&&skipPlayback()&&$('#modal').open){pointerStart=null;return;}
  if(playback||orientationBlocked||$('#modal').open||!pointerStart){pointerStart=null;return;}
  const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;pointerStart=null;
  // One swipe = one cardinal step. No hidden pathfinding or multi-turn tap movement.
  if(Math.hypot(dx,dy)>24){if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx),0);else move(0,Math.sign(dy));return;}
  const r=$('#battle').getBoundingClientRect(),pos=renderer.unproject(e.clientX-r.left,e.clientY-r.top);
  if(renderer.mode==='pet'){setPetAim(pos);return;}
  if(renderer.mode==='drone'){setDroneAim(pos);return;}
  if(renderer.mode==='grenade'||renderer.mode==='launch'||renderer.mode==='flare'||renderer.mode==='rope'||renderer.mode==='place'){setAim(pos);return;}
  if(renderer.mode==='suppress'){setSuppressAim(pos);return;}
  if(renderer.mode==='blind'){setBlindAim(pos);return;}
  const ally=game.localAllies.find(a=>distance(a,pos)===0);if(ally){notify(`${t('controller.allyInfo',{v:allyName(ally),v2:ally.status==='reforming'?t('controller.ally.reforming'):ally.status==='arriving'?t('controller.ally.arriving'):ally.status==='destroyed'?t('controller.ally.destroyed'):`HP ${ally.hp}/${ally.maxHp}${repairTargets(game).includes(ally)?t('controller.ally.repairable'):''}${ally.kind==='drone'?(ally.payload?` ${t('controller.ally.payload',{payloadName:GRENADES[ally.payload].name})}`:['unit_bomber','unit_warden','unit_boss'].includes(ally.sourceId)?(ally.primed?(ally.sourceId==='unit_bomber'?t('controller.ally.bomberPrimed'):t('controller.ally.wardenPrimed')):ally.bombard?t('controller.ally.bombardNextAttack'):''):` ${t('controller.ally.ammoLine',{v:Number.isInteger(ally.weapon)?game.weaponAt(ally.weapon).name+' · ':'',ammo:ally.ammo,v2:allyWeapon(ally,game.player).mag})}`):''}`})}`);return;}
  const edge=renderer.hitBarrier(e.clientX-r.left,e.clientY-r.top);
  if(edge){game.target=edge.id;if(!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const supply=game.props.find(o=>isContainer(o)&&!o.opened&&distance(o,pos)===0&&game.visible(o));
  if(supply){notify(`${t('controller.crateInfo',{v:containerName(supply),v2:game.canTouch(supply)?t('controller.crate.openNow'):t('controller.crate.openNear')})}`);return;}
  const corpse=game.operatorCorpse;if(corpse&&!corpse.recovered&&!isSimulation(game)&&distance(pos,corpse)===0&&game.visible(corpse)){if(operatorReady(game))recoverCorpse();else notify(`${t('controller.corpseInfo',{v:CHARACTERS[corpse.character]?.label||t('controller.operative')})}`);return;}
  if(distance(pos,game.exitPoint)===0&&game.canTouch(pos)&&(!isSimulation(game)||exitStep(game))){if(isSimulation(game))act('move',exitStep(game));else act('interact');return;}
  if(game.props.some(o=>o.type==='terminal'&&!o.used&&distance(o,pos)===0&&game.canTouch(o))){showTerminal();return;}
  if(distance(pos,game.player)===1)move(pos.x-game.player.x,pos.y-game.player.y);
  else if(!game.visibleTiles.has(`${pos.x},${pos.y}`)&&!blindReason(game,pos))startBlindAim(pos);
  else notify(t('controller.moveHint'));
});
$('#battle').addEventListener('pointercancel',()=>{pointerStart=null;});
// Long press (3.97.0, user request): holding the grenade, item or skill button opens that backpack tab; sliding off the
// button cancels. The menu then covers the button, so the release may land on a menu control: any click within a short
// window after the release is dropped wherever it lands. Each button keeps its own timer, so a second finger cannot
// orphan one, and the timer re-checks the game state before opening the pack.
const LONG_PRESS_MS=450,presses=new Map();let swallowPointer=null,swallowClicksUntil=0;
const pressReady=()=>(!playback||skipEnabled())&&!orientationBlocked&&entered&&!$('#modal').open&&game.status==='playing';
for(const b of document.querySelectorAll('.control-deck [data-action="grenade"],.control-deck [data-action="item"],.control-deck [data-action="skill"]')){
  const stop=()=>{const press=presses.get(b);if(press){clearTimeout(press.timer);presses.delete(b);}b.classList.remove('pressing');};
  b.addEventListener('pointerdown',e=>{
    if(!pressReady()||b.disabled||e.button>0)return;
    stop();b.classList.add('pressing');
    presses.set(b,{x:e.clientX,y:e.clientY,timer:setTimeout(()=>{presses.delete(b);b.classList.remove('pressing');if(!pressReady())return;if(playback&&(!skipPlayback()||$('#modal').open))return;swallowPointer=e.pointerId;swallowClicksUntil=performance.now()+1500;navigator.vibrate?.(15);cancelAim();showInventory(b.dataset.action);},LONG_PRESS_MS)});
  });
  b.addEventListener('pointermove',e=>{const press=presses.get(b);if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>12)stop();});
  for(const type of ['pointerup','pointercancel','pointerleave'])b.addEventListener(type,stop);
}
// The release of a long press closes the swallow window shortly after; a release that never arrives expires on its own.
document.addEventListener('pointerup',e=>{if(e.pointerId!==swallowPointer)return;swallowPointer=null;swallowClicksUntil=performance.now()+400;},true);
document.addEventListener('keydown',e=>{
  // Waiting for a new key in the hotkey settings (3.121.0): the next key press is the binding, whatever it is.
  if(hotkeyCapture&&$('#modal').open){captureHotkey(e);return;}
  hotkeyCapture=null;
  if(!playback&&!orientationBlocked&&e.target.matches?.('[data-inventory-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();const ids=Object.keys(INVENTORY_TABS),i=ids.indexOf(inventoryTab),next=e.key==='Home'?0:e.key==='End'?ids.length-1:(i+(e.key==='ArrowRight'?1:-1)+ids.length)%ids.length;
    showInventory(ids[next]);$(`[data-inventory-tab="${inventoryTab}"]`).focus({preventScroll:true});return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing)return;
  // Commands come from the player's bindings (src/hotkeys.js); Escape is fixed to cancelling and the menu.
  const key=normalizeKey(e.key),command=key==='Escape'?'menu':hotkeyMap.get(key);
  // Only a command key skips, and never a held key's auto-repeat: holding an arrow must not walk blind through turns.
  if(command&&!e.repeat&&!e.target.matches('input,textarea,select')&&skipPlayback()&&$('#modal').open){e.preventDefault();return;}
  if(playback){if(e.key.length===1||e.key.startsWith('Arrow')||e.key==='Tab')e.preventDefault();return;}
  if(orientationBlocked||$('#modal').open||e.target.matches('input,textarea,select')||!command)return;
  if(command==='menu'){if(renderer.mode)cancelAim();else settings();return;}
  e.preventDefault();HOTKEY_RUN[command]?.();
});
// Operation logs (3.124.0, user request; test mode only). A log from tools/text-play.mjs, or one recorded here, plays
// back through act() with the full presentation. Every step is checked against the hash in the log and the first
// difference pauses the replay. The replayed run is not connected to the profile, and input is ignored while it plays
// (a stray tap would change the run); the controls pause, resume or stop it, and after stopping you can play on.
let replay=null,replayOptions={fast:false},replayResult=null,recording=null;
const replayControls=document.createElement('div');replayControls.id='replay-controls';replayControls.hidden=true;
Object.assign(replayControls.style,{position:'fixed',left:'8px',bottom:'8px',zIndex:60,display:'flex',gap:'6px'});
replayControls.innerHTML='<button type="button" data-replay="toggle"></button><button type="button" data-replay="stop">■ 停止</button>';
for(const b of replayControls.querySelectorAll('button'))Object.assign(b.style,{font:'12px monospace',padding:'6px 10px',background:'#1b2420e6',color:'#cfe6c3',border:'1px solid #6f8f63'});
document.body.append(replayControls);
function replayBadge(){if(replay)replayControls.querySelector('[data-replay="toggle"]').textContent=`${replay.paused?'▶':'⏸'} 重播 ${replay.index}/${replay.log.ops.length}${replay.fast?' 快速':''}${replay.mismatch?' ✗':''}`;}
function loadReplay(raw,{from=0,fast=false}={}){
  const log=JSON.parse(raw),reason=validReplay(log);if(reason)throw new Error(reason);
  const start=replayLog(log,{until:Math.max(0,Math.min(Number(from)||0,log.ops.length))});
  if(start.mismatch)throw new Error(`第 ${start.mismatch.step} 步就與紀錄不同，無法播放。`);
  if(isSimulation(game))exitSimulation();
  stopReplay(false);recording=null;replayResult=null;
  game=start.game;entered=true;resumable=false;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus=game.status;previousFloor=game.floor;
  replay={log,index:start.step,fast,paused:false,mismatch:null,timer:setInterval(replayTick,50)};
  $('#modal').close();replayControls.hidden=false;update();replayBadge();floorToast();
}
function replayTick(){
  if(!replay||replay.paused||playback||orientationBlocked||performance.now()<lockUntil)return;
  if(replay.index>=replay.log.ops.length){finishReplay();return;}
  const op=replay.log.ops[replay.index];
  if(op.op==='perk'){game.choosePerk(op.id);$('#modal').close();update();}
  else if(op.op==='target'){game.target=op.id??null;update();}
  else if(op.op==='recover'){game.recoverOperator();update();}
  else{
    if($('#modal').open)$('#modal').close();
    act(op.type,op.arg===undefined?undefined:structuredClone(op.arg));
    if(replay.fast&&playback){playback.finish();endPlayback();}
  }
  replay.index++;
  const hash=stateHash(game);
  if(op.h&&hash!==op.h){replay.paused=true;replay.mismatch={step:replay.index,op,expected:op.h,actual:hash};notify(`重播第 ${replay.index} 步與紀錄不同，已暫停。`,{danger:true});console.warn('[replay] mismatch',replay.mismatch);}
  replayBadge();
}
function finishReplay(){
  const done=replay;stopReplay(false);replayResult={steps:done.log.ops.length,mismatch:done.mismatch,hash:stateHash(game)};
  notify(done.mismatch?`重播結束：第 ${done.mismatch.step} 步與紀錄不同。`:`重播完成：${done.log.ops.length} 步全部與紀錄相同。`,{danger:Boolean(done.mismatch)});
  console.info('[replay] finished',replayResult);
}
function stopReplay(message=true){if(!replay)return;clearInterval(replay.timer);replay=null;replayControls.hidden=true;if(message)notify('已停止重播，可以從這裡接手操作。');}
replayControls.addEventListener('click',e=>{const b=e.target.closest('[data-replay]');if(!b||!replay)return;if(b.dataset.replay==='stop')stopReplay();else{replay.paused=!replay.paused;replayBadge();}});
for(const type of ['pointerdown','pointerup','click','keydown','touchstart'])window.addEventListener(type,e=>{if(replay&&!(e.target instanceof Element&&e.target.closest('#replay-controls'))){e.stopPropagation();if(e.cancelable&&type!=='touchstart')e.preventDefault();}},{capture:true,passive:false});
// Recording starts from the run on screen as it is now; a new run or a loaded save ends it.
function startRecording(){const made=createReplay(game,{tool:'browser'});recording={log:made.log,game,...recordReplay(game,made.log)};notify('開始記錄操作；到設定下載操作紀錄。');}
function downloadRecording(){if(!recording||recording.game!==game){notify('目前沒有記錄中的任務。');return;}recording.flush();downloadJSON(JSON.stringify(recording.log),`ash-replay-${game.seed}-t${game.turn}.json`);notify(`已下載 ${recording.log.ops.length} 步的操作紀錄。`);}
$('#import-replay').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{if(file.size>20000000)throw new Error('檔案超過 20 MB。');loadReplay(await file.text(),replayOptions);}
  catch(error){modal('<h2>無法播放操作紀錄</h2><p>'+escapeHTML(error.message)+'</p><button class="modal-button" data-modal="close">返回</button>');}
});
// Test mode: preview the field channel (text, or {speaker, expression, line|text}), force the next mission's officer, or
// have the officer on duty say an event's line.
if(TEST_MODE)globalThis.__ashComms={say:message=>sayComms(message),duty:id=>{dutyOverride=validDuty(id)?id:null;return dutyOverride;},event:(type,vars={})=>{const message=commsLine(dutySpeaker({game}),type,vars);if(message)sayComms(message);return message;}};
if(TEST_MODE)globalThis.__ashReplay={load:(raw,options)=>loadReplay(typeof raw==='string'?raw:JSON.stringify(raw),options),
  pause(){if(replay){replay.paused=true;replayBadge();}},resume(){if(replay){replay.paused=false;replayBadge();}},stop:()=>stopReplay(),record:startRecording,hash:()=>stateHash(game),
  get state(){return replay?{index:replay.index,total:replay.log.ops.length,paused:replay.paused,fast:replay.fast,mismatch:replay.mismatch}:{done:replayResult};},
  get recording(){return recording?.game===game?recording.log:null;}};
$('#import-save').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>1000000)throw new Error(t('controller.import.tooLarge'));const imported=Game.restore(await file.text());if(!imported)throw new Error(t('controller.import.incompatible'));const kept=write('ash-save-before-import',game.serialize());game=connectUnlocks(imported);entered=true;resumable=true;game.setCarryLevel(profile().upgrades.carrying);playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();notify(kept?t('controller.import.done'):t('controller.import.doneNoBackup')); }catch(error){modal(t('controller.import.failedTitle')+escapeHTML(error.message)+t('controller.import.failedClose'));}e.target.value='';
});
document.addEventListener('selectstart',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(!target?.closest('input,textarea'))e.preventDefault();});
document.addEventListener('contextmenu',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(target?.closest('.battle-panel'))e.preventDefault();});
// Older iOS Safari still pans or bounces a locked page; stop drags outside menus, which keep their own scrolling.
document.addEventListener('touchmove',e=>{if(document.documentElement.classList.contains('scroll-locked')&&!(e.target instanceof Element&&e.target.closest('dialog')))e.preventDefault();},{passive:false});
// No pinch zoom (3.98.1, user request): iOS Safari ignores user-scalable=no, so block the WebKit gesture events too.
for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});
window.addEventListener('pagehide',()=>{if(entered)saveGame(game);});update();showIntro();
// The title modal is open by now, so revealing the shell cannot flash the battle UI.
document.body.classList.remove('booting');
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
