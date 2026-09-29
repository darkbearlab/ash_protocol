// Settings: the tabs of the settings screen, brightness, gore, grit and pad labels, key bindings and hints, the
// control deck's layout and editor, and save export.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {LANGUAGE_NAMES,LANGUAGE_STATUS,language,t} from './i18n.js';
import {TEST_MODE,profile,read,storage,write} from './storage.js';
import {SCREEN_BRIGHTNESS} from './screen-tone.js';
import {characterName} from './characters.js';
import {isSimulation} from './engine.js';
import {simulationLabel} from './killhouse-ui.js';
import {VERSION} from './version.js';
import {HOTKEY_ACTIONS,HOTKEY_BUTTONS,HOTKEY_SLOTS,actionLabel,bindKey,clearKey,keyLabel,keyLookup,normalizeKey,primaryKey} from './hotkeys.js';
import {DECK_COLUMNS,DECK_GLYPHS,DECK_LABELS,deckPlacement,swapSlots} from './deck-layout.js';
import {lastRunLog} from './run-log.js';
import {$,audio,autoRetarget,deckLayout,deckPick,fitLayout,game,goreChoice,hotkeyCapture,hotkeyHints,hotkeyMap,hotkeys,modal,padCell,padLayout,renderer,screenBrightness,setDeckLayout,setDeckPick,setHotkeyCapture,setHotkeyMap,setHotkeys,skipPresentation,vhsFilter} from './controller.js';
import {runIsLive} from './controller-deploy.js';
import {notify} from './controller-hud.js';
import {runPerks} from './controller-screens.js';
const GORE_LABELS={full:()=>t('settings.gore.full'),simple:()=>t('settings.gore.simple'),off:()=>t('settings.gore.off')};
export function applyBrightness(){document.documentElement.style.setProperty('--screen-brightness',String(screenBrightness/100));document.documentElement.classList.toggle('toned',screenBrightness!==SCREEN_BRIGHTNESS.initial);}
// Control deck (3.98.0, user request): pad size and layout are display preferences, kept local like the boundary lines.
export const PAD_SIZES=[44,52,60,68],PAD_LABELS={44:t('controller.pad.standard'),52:t('controller.pad.large'),60:t('controller.pad.xlarge'),68:t('controller.pad.huge')};
// 3.101.0 (user request): 格狀 drops the split entirely - one five-by-three field of identical cells, so the pad
// size setting has nothing to say there, because the cell size is the deck width divided by five.
export const DECK_LAYOUTS=['classic','corner','grid'],DECK_LAYOUT_LABELS={classic:t('controller.layout.classic'),corner:t('controller.layout.corner'),grid:t('controller.layout.grid')},GRID_CELL_MAX=76;
const GRIT_LABELS={off:t('controller.grit.off'),light:t('controller.grit.light'),heavy:t('controller.grit.heavy')};
// The hint is an attribute drawn by CSS, so buttons whose label the game rewrites keep it.
export function applyHotkeyHints(){
  document.documentElement.classList.toggle('hotkey-hints',hotkeyHints);
  for(const [selector,id] of Object.entries(HOTKEY_BUTTONS))for(const button of document.querySelectorAll(`.app ${selector}`)){
    const key=primaryKey(hotkeys,id);if(key)button.dataset.hotkey=keyLabel(key);else delete button.dataset.hotkey;
  }
}
export function saveHotkeys(next){setHotkeys(next);setHotkeyMap(keyLookup(hotkeys));write('ash-hotkeys',JSON.stringify(hotkeys));applyHotkeyHints();}
export function showHotkeys(message=''){
  const groups=[...new Set(HOTKEY_ACTIONS.map(action=>action.group))];
  const slot=(id,i)=>{const waiting=hotkeyCapture?.id===id&&hotkeyCapture.slot===i;return `<button class="hotkey-slot${waiting?' waiting':''}" data-hotkey-slot="${id}:${i}" aria-label="${t('controller.keys.slotAria',{v:actionLabel(id),v2:i+1,v3:waiting?t('controller.keys.waiting'):keyLabel(hotkeys[id][i])})}">${waiting?t('controller.keys.press'):keyLabel(hotkeys[id][i])}</button>`;};
  modal(`<div class="eyebrow">KEYBOARD</div><h2>${t('controller.keys.title')}</h2><p>${t('controller.keys.help')}</p>${message?`<p class="hotkey-message" role="status">${message}</p>`:''}${groups.map(group=>`<h3 class="pack-subhead">${group}</h3><div class="hotkey-rows">${HOTKEY_ACTIONS.filter(action=>action.group===group).map(action=>`<div class="hotkey-row"><span>${action.label}</span>${Array.from({length:HOTKEY_SLOTS},(_,i)=>slot(action.id,i)).join('')}</div>`).join('')}</div>`).join('')}${hotkeyCapture?t('controller.keys.cancel'):''}<div class="modal-row"><button class="modal-button secondary" data-hotkey-reset>${t('controller.keys.reset')}</button><button class="modal-button secondary" data-modal="settings">${t('controller.backToSettings')}</button></div>`);
}
export function captureHotkey(e){
  if(['Shift','Control','Alt','Meta','CapsLock','Dead','Process','Unidentified'].includes(e.key)||e.isComposing)return;
  e.preventDefault();e.stopPropagation();
  const {id,slot}=hotkeyCapture;setHotkeyCapture(null);
  if(e.key==='Escape'){showHotkeys();return;}
  if(e.key==='Backspace'){saveHotkeys(clearKey(hotkeys,id,slot));showHotkeys(`${t('controller.keys.cleared',{v:actionLabel(id),v2:slot+1})}`);return;}
  const result=bindKey(hotkeys,id,slot,e.key);
  if(result.error){showHotkeys(result.error);return;}
  saveHotkeys(result.bindings);
  showHotkeys(`${t('controller.keys.set',{v:actionLabel(id),v2:keyLabel(normalizeKey(e.key)),v3:result.displaced.length?`${t('controller.keys.moved',{v:result.displaced.map(actionLabel).join(t('controller.keys.joinQuote'))})}`:''})}`);
}
export function applyDeck(){
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
export function sizeDeck(){
  if(padLayout!=='grid')return;
  const deck=$('.control-deck'),style=getComputedStyle(deck);
  const inner=deck.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  const cell=Math.max(40,Math.min(GRID_CELL_MAX,(inner-3*(DECK_COLUMNS-1))/DECK_COLUMNS));
  deck.style.setProperty('--pad-cell',`${Math.floor(cell)}px`);deck.style.setProperty('--pad-gap','3px');
}
// 3.183.0 (user, 2026-09-25): the settings sit in tabs — run (only in a run or a simulation, and where it opens there),
// general (where it opens from the title menu), display, sound and controls. The last tab is remembered per context on
// this device, never in a save.
const SETTINGS_TABS=['run','general','display','sound','controls'];
const settingsTabLabels=()=>({run:t('settings.tab.run'),general:t('settings.tab.general'),display:t('settings.tab.display'),sound:t('settings.tab.sound'),controls:t('settings.tab.controls')});
const settingsTabKey=withRun=>withRun?'ash-settings-tab-run':'ash-settings-tab';
function settingsTab(withRun){const saved=read(settingsTabKey(withRun));return SETTINGS_TABS.includes(saved)&&(withRun||saved!=='run')?saved:withRun?'run':'general';}
export function settings(){
  // 主選單進來只顯示全域設定；局內功能（指南、升級、簡介、放棄、重新部署）留在遊戲中的選單。
  const simulating=isSimulation(game),inRun=runIsLive(),withRun=inRun||simulating,sec=label=>`<div class="eyebrow settings-section">${label}</div>`;
  const tab=settingsTab(withRun),tabs=SETTINGS_TABS.filter(id=>withRun||id!=='run');
  const panels={
    run:()=>`${inRun?runPerks():''}
${simulating?`${sec(t('settings.simSection'))}<button class="modal-button secondary" data-modal="mission">${t('settings.simBrief')}</button><button class="modal-button secondary" data-modal="khMenu">${t('settings.endSim')}</button>`:`<button class="modal-button secondary" data-modal="mission">${t('settings.briefing')}</button>`}
${inRun?t('settings.inRunButtons'):''}
<button class="modal-button secondary" data-modal="journal">${t('settings.journal')}</button>
${simulating?'':`${sec(t('settings.runSection'))}<button class="modal-button secondary" data-modal="abandon" ${game.status!=='playing'?'disabled':''}>${t('settings.abandon')}</button><button class="modal-button secondary" data-modal="restart">${t('settings.redeploy')}</button>`}`,
    general:()=>`${sec(t('settings.languageSection'))}
<button class="modal-button secondary" data-modal="language" lang="en">${t('settings.languageLabel',{name:LANGUAGE_STATUS[language()]?`${LANGUAGE_NAMES[language()]} (${LANGUAGE_STATUS[language()]})`:LANGUAGE_NAMES[language()]})}</button>
<p>${t('settings.languageNote')}<br>${t('settings.languageWip')}</p>
${sec(t('settings.saveSection'))}
<div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">${t('settings.fullBackup')}</button>${simulating?'':t('settings.restore')}</div>
<div class="modal-row"><button class="modal-button secondary" data-modal="runLog" ${lastRunLog(game)?'':'disabled'}>${t('controller.runLog.download')}</button></div>
${read('ash-backup-before-restore')?t('settings.previousBackup'):''}
${simulating?t('settings.simBackup'):t('settings.backupBlock')}
${TEST_MODE?`${sec('測試：操作紀錄')}<div class="modal-row"><button class="modal-button secondary" data-modal="replayLoad">播放操作紀錄</button><button class="modal-button secondary" data-modal="replayFast">快速播放</button></div>
<p>只在測試模式出現。操作紀錄來自 tools/text-play.mjs 或這裡的記錄；播放時畫面照常演出，每一步都和紀錄的狀態比對，不同就暫停。播放中不接受操作，左下角可以暫停或停止，停止後可以接手玩。</p>`:''}
${withRun?'':`${sec(t('settings.records'))}
<button class="modal-button secondary" data-modal="journal">${t('settings.journal')}</button>`}
${simulating?'':`${sec(t('settings.dangerSection'))}
<button class="modal-button secondary" data-modal="resetProgress">${t('settings.reset')}</button>`}`,
    display:()=>`<label class="boundary-opacity" for="screen-brightness">${t('settings.brightnessLabel')} <output id="screen-brightness-value" for="screen-brightness">${screenBrightness}%</output><input id="screen-brightness" type="range" min="${SCREEN_BRIGHTNESS.min}" max="${SCREEN_BRIGHTNESS.max}" step="${SCREEN_BRIGHTNESS.step}" value="${screenBrightness}" aria-describedby="screen-brightness-help"></label>
<p id="screen-brightness-help">${t('settings.brightness')}</p>
<button class="modal-button secondary" data-modal="frameRate" aria-pressed="${renderer.frameRate!==60}">${t('settings.fpsLabel',{frameRate:renderer.frameRate})}</button>
<p>${t('settings.fps')}</p>
<button class="modal-button secondary" data-modal="smokeQuality" aria-pressed="${renderer.smokeQuality!=='layers'}">${t('settings.smokeLabel',{v:t(renderer.smokeQuality==='baked'?'settings.smokeBaked':'settings.smokeLayers')})}</button>
<p>${t('settings.smoke')}</p>
<button class="modal-button secondary" data-modal="vhs" aria-pressed="${vhsFilter}">${t('settings.vhsLabel',{v:vhsFilter?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.vhs')}</p>
<button class="modal-button secondary" data-modal="shake" aria-pressed="${renderer.shakeEnabled}">${t('settings.shakeLabel',{v:renderer.shakeEnabled?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.shake')}</p>
<button class="modal-button secondary" data-modal="glitch" aria-pressed="${renderer.glitchEnabled}">${t('settings.glitchLabel',{v:renderer.glitchEnabled?t('controller.on'):t('controller.off')})}</button><button class="modal-button secondary" data-modal="gore">${t('settings.goreLabel',{v:GORE_LABELS[goreChoice]()})}${renderer.reduceMotion&&goreChoice==='full'?t('settings.goreReduced'):''}</button>
<p>${t('settings.glitch')}</p>
<p>${t('settings.motion')}</p>
<button class="modal-button secondary" data-modal="movementBoundaries" aria-pressed="${renderer.movementBoundaries}">${t('settings.boundsLabel',{v:renderer.movementBoundaries?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.bounds')}</p>
<label class="boundary-opacity" for="boundary-opacity">${t('settings.opacityLabel')} <output id="boundary-opacity-value" for="boundary-opacity">${renderer.boundaryOpacity}%</output><input id="boundary-opacity" type="range" min="0" max="100" step="5" value="${renderer.boundaryOpacity}" aria-describedby="boundary-opacity-help"></label>
<p id="boundary-opacity-help">${t('settings.opacity')}</p>`,
    sound:()=>`<button class="modal-button secondary" data-modal="sound" aria-pressed="${audio.enabled}">${t('settings.soundLabel',{v:audio.enabled?t('controller.on'):t('controller.off')})}</button>
<label class="boundary-opacity" for="music-volume">${t('settings.musicVolume')} <output id="music-volume-value" for="music-volume">${Math.round(audio.musicVolume*100)}%</output><input id="music-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.musicVolume*100)}"></label>
<label class="boundary-opacity" for="sfx-volume">${t('settings.sfxVolume')} <output id="sfx-volume-value" for="sfx-volume">${Math.round(audio.sfxVolume*100)}%</output><input id="sfx-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.sfxVolume*100)}"></label>
<p>${t('settings.music')}</p>
<button class="modal-button secondary" data-modal="audioGrit" aria-pressed="${audio.grit!=='off'}">${t('settings.gritLabel',{v:GRIT_LABELS[audio.grit]})}</button>
<p>${t('settings.grit')}</p>`,
    controls:()=>`${sec(t('settings.layoutSection'))}
<div class="modal-row"><button class="modal-button secondary" data-modal="padLayout">${t('settings.layoutLabel',{v:DECK_LAYOUT_LABELS[padLayout]})}</button><button class="modal-button secondary" data-modal="padCell" ${padLayout==='grid'?'disabled':''}>${t('settings.padLabel',{v:padLayout==='grid'?t('settings.padNotGrid'):`${t('settings.padSize',{v:PAD_LABELS[padCell],padCell})}`})}</button></div>
<p>${t('settings.layout')}</p>
<button class="modal-button secondary" data-modal="deckEditor" ${padLayout==='grid'?'':'disabled'}>${t('settings.editDeck',{v:padLayout==='grid'?'':t('settings.gridOnly')})}</button>
${sec(t('settings.keyboard'))}
<button class="modal-button secondary" data-modal="hotkeyHints" aria-pressed="${hotkeyHints}">${t('settings.hintsLabel',{v:hotkeyHints?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.hotkeys')}</p>
<button class="modal-button secondary" data-modal="hotkeys">${t('settings.hotkeysButton')}</button>
<p>${t('settings.keymapNote')}</p>
${sec(t('settings.assist'))}
<button class="modal-button secondary" data-modal="skipPresentation" aria-pressed="${skipPresentation}">${t('settings.skipLabel',{v:skipPresentation?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.skip')}</p>
<button class="modal-button secondary" data-modal="autoRetarget" aria-pressed="${autoRetarget}">${t('settings.retargetLabel',{v:autoRetarget?t('controller.on'):t('controller.off')})}</button>
<p>${t('settings.retarget')}</p>`,
  };
  modal(`<div class="eyebrow">SYSTEM / BUILD ${VERSION}</div><h2>${inRun?t('settings.titleRun'):t('settings.titleSystem')}</h2>
<p>${inRun?`${t('settings.runLine',{v:characterName(game.player.character),v2:simulating?simulationLabel(game):`${t('controller.settings.missionLine',{seed:game.seed,floor:game.floor})}`,turn:game.turn})}`:`${t('settings.protocol',{v:profile().protocol.balance})}`}<br>${simulating?t('settings.simNoSave'):storage.available?t('settings.saved'):t('settings.noStorage')}</p>
<div class="inventory-tabs settings-tabs" role="tablist" aria-label="${t('settings.tabs')}" style="--tabs:${tabs.length}">${tabs.map(id=>`<button id="settings-tab-${id}" role="tab" aria-controls="settings-panel" aria-selected="${id===tab}" tabindex="${id===tab?0:-1}" data-settings-tab="${id}">${settingsTabLabels()[id]}</button>`).join('')}</div>
<section id="settings-panel" class="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${tab}" tabindex="0">${panels[tab]()}</section>
<button class="modal-button" data-modal="close">${inRun?simulating?t('settings.continueSim'):t('settings.continueRun'):t('controller.backToTitle')}</button>`);
}
// A tab button, or ←/→/Home/End on one: remember the tab for this context and redraw.
export function showSettingsTab(id){const withRun=runIsLive()||isSimulation(game);if(!SETTINGS_TABS.includes(id)||(!withRun&&id==='run'))return;write(settingsTabKey(withRun),id);settings();$(`[data-settings-tab="${id}"]`)?.focus({preventScroll:true});}
export function exportSave(){const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ash-protocol-${game.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(t('controller.saveExported'));}
export function downloadJSON(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Layout editor (3.102.0, user request): tap one cell then another and they swap, which reaches any arrangement
// without a function picker. Only 格狀 is editable, because only its cells are interchangeable.
export function showDeckEditor(message=''){
  const cells=deckLayout.map((id,index)=>`<button class="deck-slot${deckPick===index?' picked':''}${id?'':' empty'}" data-slot="${index}" aria-pressed="${deckPick===index}" aria-label="${t('controller.deckEdit.slotAria',{n:index+1,v:id?DECK_LABELS[id]:t('controller.deckEdit.empty')})}"><span class="deck-slot-icon" aria-hidden="true">${id?DECK_GLYPHS[id]:'\u00b7'}</span><span>${id?DECK_LABELS[id]:t('controller.deckEdit.empty')}</span></button>`).join('');
  modal(`<div class="eyebrow">CONTROL DECK / LAYOUT</div><h2>${t('controller.deckEdit.title')}</h2>
<p>${t('controller.deckEdit.help')}</p>
<div class="deck-editor">${cells}</div>
${message?`<p>${message}</p>`:''}
<div class="modal-row"><button class="modal-button secondary" data-modal="deckMirror">${t('controller.deckEdit.mirror')}</button><button class="modal-button secondary" data-modal="deckReset">${t('controller.deckEdit.reset')}</button></div>
<button class="modal-button secondary" data-modal="settings">${t('controller.deckEdit.back')}</button>`);
}
export function saveDeckLayout(){write('ash-deck-layout',JSON.stringify(deckLayout));applyDeck();fitLayout();}
export function pickDeckSlot(index){
  if(deckPick===null){setDeckPick(index);showDeckEditor();return;}
  if(deckPick===index){setDeckPick(null);showDeckEditor();return;}
  setDeckLayout(swapSlots(deckLayout,deckPick,index));setDeckPick(null);saveDeckLayout();showDeckEditor();
}
