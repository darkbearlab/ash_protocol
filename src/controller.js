import {t,language,languageChoice,LANGUAGES} from './i18n.js';
import {localizeDocument} from './localize-dom.js';
import './story-data.js';   // load order only (3.206.3 split)
import {playerCalloutEvent} from './callouts.js';
import './signal-glitch.js';   // load order only (3.206.3 split)
import {availableCharacters} from './unlock-catalog.js';
import {connectUnlocks,startCampaign,startKillhouse} from './storage.js';
import './unlock-ui.js';   // load order only (3.206.3 split)
import {isNoncombatant} from './enemy-data.js';
import {repairTargets} from './workshop.js';
import {allyName,allyWeapon} from './allies.js';
import {petFeedQuote,outputChoiceReason} from './pet-growth.js';
import './pet-ui.js';   // load order only (3.206.3 split)
import {LEARNING_ITEMS} from './learning-data.js';
import './suppression-ui.js';   // load order only (3.206.3 split)
import {SKILLS} from './skills.js';
import {iconSvg} from './ui-icons.js';
import {blindReason} from './blind-fire.js';
import {boundaryOpacityPercent} from './movement-boundaries.js';
import {smokeQuality} from './fx-sprites.js';
import {screenBrightnessPercent} from './screen-tone.js';
import './pixel-text.js';   // load order only (3.206.3 split)
import {offeredMission,validMissionId} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {salvageValue} from './weapons.js';
import {tradeHoldings} from './terminal.js';
import {deploymentPortraits,validPortrait} from './portraits.js';
import {CHARACTERS,validCharacter} from './characters.js';
import {PREPARED_CATALOG,preparedEntry} from './prepared.js';
import {retryPlan} from './result-copy.js';
import {GRENADES} from './throwables.js';
import './melee-ui.js';   // load order only (3.206.3 split)
import {DEFAULT_OPERATOR_COLOR,validOperatorColor} from './operator-color.js';
import './color-picker.js';   // load order only (3.206.3 split)
import './class-art.js';   // load order only (3.206.3 split)
import './endless-ui.js';   // load order only (3.206.3 split)
import './purge-review-ui.js';   // load order only (3.206.3 split)
import {isSimulation,tutorialGate} from './engine.js';
import {saveTutorialOutcome} from './storage.js';
import {exitStep,tutorialGateMarkup} from './killhouse-ui.js';
import {dailySeed,dailyMission} from './daily.js';
import {aboutMarkup} from './about.js';
import {TRAITS} from './traits.js';
import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,distance,itemUseReason} from './engine.js';
import {runOptions} from './deploy-ui.js';
import {commsLine,dutySpeaker} from './comms.js';
import {bossFallOf} from './boss-scenes.js';
import {OUTRO_TUNING} from './outro.js';
import {GORE_SETTINGS,validGoreSetting,goreLevel} from './gore.js';
import {commsSnapshot} from './comms-events.js';
import {validDuty} from './duty.js';
import {courseActive} from './course.js';
import {courseCardMarkup} from './course-ui.js';
import {Renderer} from './render.js';
import {AudioEngine,AUDIO_TUNING,volumePercent} from './audio.js';
import {GRIT_LEVELS,gritLevel} from './audio-grit.js';
import {frameRate,nextFrameRate} from './frame-rate.js';
import {normalizeKey,parseBindings,defaultBindings,keyLookup} from './hotkeys.js';
import {eventSounds,actionSound} from './sound-cues.js';
import {engagementHeard,freshCombat,stepCombat,musicTrack} from './music-state.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {read,write,loadGame,saveGame,profile,TEST_MODE,exportBackup,previewBackup,restoreBackup,abandonRun,resetProgress,TAB_ID,claimTab,tabKey} from './storage.js';
import {mirrorDeck,parseDeckLayout,DECK_GRID} from './deck-layout.js';
import {replayLog,stateHash,validReplay} from './replay.js';
import {persistRunLog,lastRunLog,runLogName,noteRunError} from './run-log.js';
// 3.206.3: the topic modules (declarations only; they load before this file's start-up code runs).
import {floorToast,notify,notifyLatest,renderEffects,update} from './controller-hud.js';
import {bossScene,bossSceneTick,closeCourseCard,courseCard,courseHolds,courseNext,courseWaiting,endRecordComms,kia,kiaTick,playRecordComms,recordComms,resetKia,sayComms,setCourseWaiting,startBossDeath,startKia} from './controller-comms.js';
import {HOTKEY_RUN,cancelAim,centerCamera,cycleTarget,fireWeapon,grenade,interact,move,operatorReady,recoverCorpse,retarget,setAim,setBlindAim,setDroneAim,setPetAim,setSuppressAim,skill,startBlindAim,startDeploy,startThrowAim,toggleTargeting,useItem,zoomBy} from './controller-aim.js';
import {MISSION_IDS,drawOperatorSprites,runIsLive,showDeployDifficulty,showDeployMission,showDeployOperator,showDeployment,showIntro,showKillhouseMenu,startQuick} from './controller-deploy.js';
import {bestiary,buyUnlock,confirmUnlock,showBriefing,showHelp,showJournal,showLevelUp,showLog,showMap,showMission,showPerks,showResult,showUnlocks} from './controller-screens.js';
import {INVENTORY_TABS,inventoryTab,refreshTerminalDeal,setTerminalDraft,showBlueprints,showInventory,showTerminal,showTerminalDeal,showWeaponComparison,showWorkshop,startDeployAim,terminalDraft} from './controller-pack.js';
import {DECK_LAYOUTS,PAD_SIZES,applyBrightness,applyDeck,applyHotkeyHints,captureHotkey,downloadJSON,exportSave,pickDeckSlot,saveDeckLayout,saveHotkeys,settings,showDeckEditor,showHotkeys,showSettingsTab,sizeDeck} from './controller-settings.js';

const $=s=>document.querySelector(s),audio=new AudioEngine();
const savedGame=loadGame();
let deploymentFaces={};
// Title flow (3.98.1, user report): the title screen and every menu reached from it take the full-screen terminal
// treatment. A bottom sheet left the finished run showing above it; closing the dialog always reveals the battle.
let titleFlow=false;
let playback=null,entered=false,orientationBlocked=false,orientationOverride=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor;
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
// A hit on you makes the controls glitch for a moment, a beat after the shot, when the round lands.
const glitchUI=(ms=280)=>{for(const el of document.querySelectorAll('.tactical-panel,.mobile-status,#mobile-hp,#mobile-plates')){el.classList.remove('ui-glitch');void el.offsetWidth;el.classList.add('ui-glitch');setTimeout(()=>el.classList.remove('ui-glitch'),ms);}};
renderer.onPlayerHit=()=>setTimeout(()=>glitchUI(),90);
// Keyboard bindings and the key hints on the buttons (3.121.0, src/hotkeys.js).
let hotkeys=parseBindings(read('ash-hotkeys')),hotkeyMap=keyLookup(hotkeys),hotkeyHints=read('ash-hotkey-hints')==='on',hotkeyCapture=null;
// 3.116.0 (user request): whole-screen brightness. A root filter would miss the dialog (it sits in the top layer), so two
// backdrop-filter layers do it, the same way as the VHS layers; at 100% they are not drawn at all.
let screenBrightness=screenBrightnessPercent(read('ash-brightness'));
applyBrightness();
// The level-up transmission (showLevelUp) is shown once per level of a run.
let transmissionSeen=null;
const transmissionKey=()=>`${game.runId}:${game.player.level}`;
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
let lastActionLogs=1;
const freshLogs=old=>{const i=old?game.logs.indexOf(old):-1;return old&&i>=0?i:game.logs.length;};
// Saving can fail quietly (storage full or blocked). Keep a header warning up until a save succeeds (3.44).
let saveWarned=false,saveWarningDue=false;
// 3.150.0: the tab opened last owns the save; one that has been overtaken stops saving and says so.
let tabLost=false;claimTab();
addEventListener('storage',e=>{if(e.key!==tabKey()||!e.newValue||e.newValue===TAB_ID||tabLost)return;tabLost=true;modal(t('controller.otherTab'));});
function persist(){if(tabLost)return false;const ok=saveGame(game);persistRunLog(game);$('#save-warning').hidden=ok;if(!ok&&!saveWarned){saveWarned=true;saveWarningDue=true;}return ok;}
function showSaveWarning(){saveWarningDue=false;modal(t('controller.saveFailed'));}
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let effectsOpen=false;
for(const [action,icon] of [['weapons','list'],['cycleTarget','target'],['toggleTargeting','eye'],['bag','pack']]){const button=$(`.loadout-bar [data-action="${action}"]`);if(button)button.innerHTML=iconSvg(icon);}

// 3.197.0 (freeze audit): an unexpected script error shows a quiet notice once a session, asking for the run log, and is
// noted in that log, instead of leaving a tester with a silently stuck screen. The browser's resize-loop warning is noise.
let errorNoticed=false;
function reportError(error){
  const text=String(error?.stack||error?.message||error||'');if(/ResizeObserver loop/.test(text))return;
  noteRunError(text);if(errorNoticed)return;errorNoticed=true;notify(t('controller.errorNotice'),{danger:true});
}
addEventListener('error',e=>{if(e.error||e.message)reportError(e.error||e.message);});
addEventListener('unhandledrejection',e=>reportError(e.reason));
// Comms over the field (3.168.1, user request): new log lines that a hook names make someone speak; the hooks wait
// for the writing (src/comms.js COMMS_HOOKS). A message names its speaker, expression and line (3.168.2). One box at a
// time, the rest wait their turn.
// 3.173.0 (user's pick from the mockups): the slim box covers the battle header, not the field.
const commsLayer=document.createElement('div');commsLayer.className='comms-layer';commsLayer.setAttribute('aria-live','polite');$('.battle-header').append(commsLayer);
$('#modal-content').addEventListener('toggle',e=>{
  const d=e.target;if(!(d instanceof HTMLDetailsElement)||!d.dataset.story)return;
  if(d.open)playRecordComms(d.dataset.story);else if(recordComms===d.dataset.story)endRecordComms();
},true);
// 3.169.0 (docs/STORY.md 8): the officer on duty remarks on what the last action showed; the kill house has no comms.
let commsBefore=null,commsMemory=null,dutyOverride=null;
renderer.isPaused=()=>orientationBlocked;
renderer.frameRate=frameRate(read('ash-frame-rate'));
renderer.smokeQuality=smokeQuality(read('ash-smoke-quality'));   // 3.202.0 (user): layered smoke by default, the pre-stacked one to save power
// The title and every menu opened from it sit on an opaque backdrop, so the battlefield behind them is not drawn.
renderer.isCovered=()=>$('#modal').open&&$('#modal').matches('.title,.standalone,.outro');
// Rules are resolved before a presentation starts, so skipping only drops frames. A turn that ended the run always plays
// out, so a death is never covered by the result screen mid-fall; the 120ms double-input lock still applies.
function skipEnabled(){return skipPresentation&&game.status==='playing'&&!bossScene;}   // 3.204.0: a boss scene plays out
function endPlayback(){playback=null;renderer.game=game;update();notifyLatest();}
function skipPlayback(){
  if(!playback||!skipEnabled()||orientationBlocked||!entered||performance.now()<lockUntil)return false;
  playback.finish();endPlayback();return true;
}
const outroShade=document.createElement('div');outroShade.className='outro-shade';outroShade.setAttribute('aria-hidden','true');outroShade.style.transitionDuration=`${OUTRO_TUNING.darkMs}ms`;document.body.append(outroShade);
renderer.onFrame=dt=>{
  kiaTick();bossSceneTick();
  if(!playback)return;
  playback.advance(dt);
  if(playback.done)endPlayback();
};
// 3.163.0 (user decision): the operator's own line over their head — an invalid input, or a warning of the next one.
const sayLine=(cue,detail={})=>renderer.addEffects([playerCalloutEvent(cue,detail)]);
function act(type,arg) {
  skipPlayback();
  if(playback||orientationBlocked||!entered||$('#modal').open||courseHolds()||bossScene||performance.now()<lockUntil)return false;   // bossScene: 3.204.0
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
        const bossFall=!kia&&bossFallOf(event.effects);if(bossFall)startBossDeath(bossFall);   // 3.204.0: an enemy boss's fall only
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
  if(success||(type!=='grenade'&&type!=='launch'&&type!=='blindFire'&&type!=='deployCover'&&type!=='flare'&&type!=='rope'&&type!=='decoy'&&type!=='mine'&&type!=='glowstick'&&!(type==='usePrepared'&&arg?.category==='grenade')))cancelAim();update();return success;
}
// The corner × is gone (3.98.1, user request): it only ever appeared on menus that already carried a back button, and
// its float reserved a column on the right of the content; the pinned footer is the way out.
// On phones a menu is a bottom sheet (3.97.2, user request): its buttons and tab row sit on the screen's bottom edge for
// one-handed use, and a tabbed menu fills the height so its top does not move when tabs of different heights change.
// The upgrade pick is the exception (3.97.3, user report): it opens on its own under a thumb that is still tapping, so it
// is anchored to the top edge and the queued tap lands on the backdrop.
function modal(html,wide=false,title=false){queueMicrotask(syncMusic);cancelAim();endRecordComms();$('#modal').classList.toggle('wide',wide);$('#modal').classList.toggle('title',title);$('#modal-content').innerHTML=html;$('#modal').classList.toggle('tabbed',!title&&Boolean($('#modal-content').querySelector('[role="tablist"],.journal-tabs')));$('#modal').classList.toggle('raised',Boolean($('#modal-content').querySelector('[data-perk]')));$('#modal').classList.toggle('transmission',Boolean($('#modal-content').querySelector('.transmission')));$('#modal').classList.toggle('briefing',Boolean($('#modal-content').querySelector('.briefing')));$('#modal').classList.toggle('outro',Boolean($('#modal-content').querySelector('.outro-channel')));$('#modal').classList.toggle('standalone',!title&&titleFlow);pinFooter(title);if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
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

// Deployment is a three-step flow. The draft carries the mission and seed
// between screens; newGame() itself is unchanged.
let deployDraft={mode:null,mission:null,seed:undefined};




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
applyDeck();applyHotkeyHints();
const layoutObserver=new ResizeObserver(()=>requestAnimationFrame(fitLayout));
for(const el of [$('.workspace'),...$('.tactical-panel').children])layoutObserver.observe(el);
window.addEventListener('orientationchange',fitLayout);screen.orientation?.addEventListener('change',fitLayout);window.addEventListener('resize',fitLayout);window.visualViewport?.addEventListener('resize',fitLayout);fitLayout();




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
function newGame(seed,character,mission,options={facilityFaction:'random'}){if(isSimulation(game))exitSimulation();const portrait=deploymentFaces[character];if(!availableCharacters(profile()).includes(character)||!validCharacter(character)||!validPortrait(portrait)||!validMissionId(mission)){notify(t('controller.pickValidCharacter'));return;}if(game.status==='playing'&&(entered||resumable)){try{abandonRun(game);}catch(error){backupError(error);return;}}entered=true;resumable=false;game=startCampaign({seed,character,portrait,mission,options,duty:TEST_MODE?dutyOverride:undefined});dutyOverride=null;commsMemory=null;commsBefore=null;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();floorToast();showBriefing();}
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
  if(b.dataset.effects!==undefined){effectsOpen=!effectsOpen;renderEffects();return;}   // 3.193.0: the effects strip
  // 3.198.0: a course card pages in place; its last page carries the course on.
  if(b.dataset.coursePage!==undefined&&courseCard){audio.play('select');modal(courseCardMarkup(courseCard.id,Number(b.dataset.coursePage)));return;}
  if(b.dataset.courseDone!==undefined){audio.play('select');closeCourseCard();return;}
  // 3.117.0: pressing a button in a menu is heard (the adopted select sound); the battle controls have their own sounds.
  if(b.closest('#modal'))audio.play('select');
  if(b.dataset.packInfo){const desc=document.getElementById('pack-desc-'+b.dataset.packInfo);if(desc){desc.hidden=!desc.hidden;b.setAttribute('aria-expanded',String(!desc.hidden));}return;}
  if(b.dataset.settingsTab){showSettingsTab(b.dataset.settingsTab);return;}
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
  if(b.dataset.terminalConfirm!==undefined&&terminalDraft){const {buy,trade}=terminalDraft;setTerminalDraft(null);modalAction('terminal',{buy,trade});return;}
  if(b.dataset.terminalBack!==undefined){showTerminal();return;}
  if(b.dataset.modal){switch(b.dataset.modal){
    case 'lastBattle':$('#modal').close();break;case 'enter':entered=true;$('#modal').close();update();floorToast();break;case 'intro':showIntro();break;case 'mission':showMission();break;case 'close':close();break;case 'bag':showInventory();break;case 'journal':showJournal();break;case 'bestiary':bestiary();break;case 'help':showHelp();break;case 'about':modal(aboutMarkup(),true);break;case 'log':showLog();break;
    case 'unlocks':showUnlocks();break;
    case 'result':showResult();break;
    // 3.114.0 (user request): after a loss, the same mission, seed and options with only the operative chosen again.
    case 'redeploySame':{const plan=retryPlan(game);deploymentFaces=deploymentPortraits(Object.keys(CHARACTERS));deployDraft={mode:'retry',mission:offeredMission(plan.mission),seed:plan.seed,character:plan.character,retry:plan.options};showDeployOperator();break;}
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
    case 'smokeQuality':renderer.smokeQuality=renderer.smokeQuality==='baked'?'layers':'baked';write('ash-smoke-quality',renderer.smokeQuality);settings();break;
    case 'skipPresentation':skipPresentation=!skipPresentation;write('ash-skip-presentation',skipPresentation?'on':'off');settings();break;
    case 'autoRetarget':autoRetarget=!autoRetarget;write('ash-auto-retarget',autoRetarget?'on':'off');if(autoRetarget)retarget();settings();break;
    case 'movementBoundaries':renderer.movementBoundaries=!renderer.movementBoundaries;write('ash-movement-boundaries',renderer.movementBoundaries?'on':'off');settings();break;
    case 'sound':audio.setEnabled(!audio.enabled);write('ash-sound',audio.enabled?'on':'off');syncMusic();settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify(t('controller.backup.exported'));}catch(error){backupError(error);}break;
    case 'backupImport':$('#import-backup').click();break;
    case 'replayLoad':case 'replayFast':replayOptions={fast:b.dataset.modal==='replayFast'};$('#import-replay').click();break;
    case 'runLog':{const log=lastRunLog(game);if(!log){notify(t('controller.runLog.none'));break;}downloadJSON(JSON.stringify(log),runLogName(log));notify(t('controller.runLog.saved',{n:log.ops.length}));break;}
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
    case 'mission':showMission();break;case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'about':modal(aboutMarkup(),true);break;case 'settings':settings();break;case 'bag':showInventory();break;case 'weapons':showInventory('weapon');break;case 'terminal':showTerminal();break;
    case 'item':useItem();break;case 'skill':skill();break;case 'saveWarning':showSaveWarning();break;
    case 'toggleTargeting':toggleTargeting();break;case 'flashlight':act('flashlight');break;case 'cycleTarget':cycleTarget();break;case 'grenade':grenade();break;case 'cancelAim':cancelAim();break;case 'fire':fireWeapon();break;
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
$('#modal').addEventListener('close',()=>{titleFlow=false;syncMusic();endRecordComms();if(courseCard)closeCourseCard();else if(courseWaiting){setCourseWaiting(false);courseNext();}});
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
  // 3.187.0: a wall lamp is picked where it is drawn, against its wall, so the middle of its tile still moves you there.
  const lamp=renderer.hitLamp(e.clientX-r.left,e.clientY-r.top);
  if(lamp){game.target=lamp.id;if(!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const supply=game.props.find(o=>isContainer(o)&&!o.opened&&distance(o,pos)===0&&game.visible(o));
  if(supply){notify(`${t('controller.crateInfo',{v:containerName(supply),v2:game.canTouch(supply)?t('controller.crate.openNow'):t('controller.crate.openNear')})}`);return;}
  const corpse=game.operatorCorpse;if(corpse&&!corpse.recovered&&!isSimulation(game)&&distance(pos,corpse)===0&&game.visible(corpse)){if(operatorReady(game))recoverCorpse();else notify(`${t('controller.corpseInfo',{v:CHARACTERS[corpse.character]?.label||t('controller.operative')})}`);return;}
  if(distance(pos,game.exitPoint)===0&&game.canTouch(pos)&&(!isSimulation(game)||courseActive(game)||exitStep(game))){if(isSimulation(game)&&!courseActive(game))act('move',exitStep(game));else act('interact');return;}
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
  if(!playback&&!orientationBlocked&&e.target.matches?.('[data-settings-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();const ids=[...document.querySelectorAll('[data-settings-tab]')].map(b=>b.dataset.settingsTab),i=ids.indexOf(e.target.dataset.settingsTab),next=e.key==='Home'?0:e.key==='End'?ids.length-1:(i+(e.key==='ArrowRight'?1:-1)+ids.length)%ids.length;
    showSettingsTab(ids[next]);return;
  }
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
let replay=null,replayOptions={fast:false},replayResult=null;
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
  stopReplay(false);replayResult=null;
  game=start.game;entered=true;resumable=false;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();resetKia();cancelAim();lastStatus=game.status;previousFloor=game.floor;
  replay={log,index:start.step,fast,paused:false,mismatch:null,timer:setInterval(replayTick,50)};
  $('#modal').close();replayControls.hidden=false;update();replayBadge();floorToast();
}
function replayTick(){
  if(!replay||replay.paused||playback||bossScene||orientationBlocked||performance.now()<lockUntil)return;   // bossScene: 3.204.0
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
$('#import-replay').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try{if(file.size>20000000)throw new Error('檔案超過 20 MB。');loadReplay(await file.text(),replayOptions);}
  catch(error){modal('<h2>無法播放操作紀錄</h2><p>'+escapeHTML(error.message)+'</p><button class="modal-button" data-modal="close">返回</button>');}
});
// Test mode: preview the field channel (text, or {speaker, expression, line|text}), force the next mission's officer, or
// have the officer on duty say an event's line.
// 3.198.0: test mode only — the live game and a redraw, for staging the training course's card pictures (tools/course-shots.mjs).
if(TEST_MODE)globalThis.__ashSim={get game(){return game;},update:()=>update(),get renderer(){return renderer;},start:options=>startSimulation(options),act:(type,arg)=>act(type,arg),get bossScene(){return bossScene;}};   // act, bossScene: 3.204.0, for staging the boss scenes
if(TEST_MODE)globalThis.__ashComms={say:message=>sayComms(message),duty:id=>{dutyOverride=validDuty(id)?id:null;return dutyOverride;},event:(type,vars={})=>{const message=commsLine(dutySpeaker({game}),type,vars);if(message)sayComms(message);return message;}};
if(TEST_MODE)globalThis.__ashReplay={load:(raw,options)=>loadReplay(typeof raw==='string'?raw:JSON.stringify(raw),options),
  pause(){if(replay){replay.paused=true;replayBadge();}},resume(){if(replay){replay.paused=false;replayBadge();}},stop:()=>stopReplay(),hash:()=>stateHash(game),
  get state(){return replay?{index:replay.index,total:replay.log.ops.length,paused:replay.paused,fast:replay.fast,mismatch:replay.mismatch}:{done:replayResult};},
  get recording(){return lastRunLog(game);}};   // 3.186.0: every run records itself (src/run-log.js)
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
window.addEventListener('pagehide',()=>{if(entered){saveGame(game);persistRunLog(game);}});update();showIntro();
// The title modal is open by now, so revealing the shell cannot flash the battle UI.
document.body.classList.remove('booting');
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
// Setters for the topic modules (3.206.3 split): an imported binding is read-only, so they change this state here.
function setDeploymentFaces(value){deploymentFaces=value;}
function setTitleFlow(value){titleFlow=value;}
function setLastStatus(value){lastStatus=value;}
function setPreviousFloor(value){previousFloor=value;}
function setHotkeys(value){hotkeys=value;}
function setHotkeyMap(value){hotkeyMap=value;}
function setHotkeyCapture(value){hotkeyCapture=value;}
function setDeckLayout(value){deckLayout=value;}
function setDeckPick(value){deckPick=value;}
function setCommsMemory(value){commsMemory=value;}
function setDeployDraft(value){deployDraft=value;}
// What the topic modules (src/controller-*.js) use from here (3.206.3 split).
export {$,act,audio,autoRetarget,close,commsBefore,commsLayer,commsMemory,deckLayout,deckPick,deployDraft,deploymentFaces,effectsOpen,entered,escapeHTML,exitSimulation,fitLayout,game,goreChoice,hotkeyCapture,hotkeyHints,hotkeyMap,hotkeys,lastActionLogs,lastStatus,logButton,modal,newGame,notice,outroShade,pad,padCell,padLayout,persist,playback,previousFloor,renderer,replay,resumable,saveWarningDue,sayLine,screenBrightness,showSaveWarning,simulationResults,skipEnabled,skipPresentation,syncMusic,titleFlow,transmissionKey,transmissionSeen,vhsFilter,setDeploymentFaces,setTitleFlow,setLastStatus,setPreviousFloor,setHotkeys,setHotkeyMap,setHotkeyCapture,setDeckLayout,setDeckPick,setCommsMemory,setDeployDraft};
