import {STORIES} from './story-data.js';
import {availableCharacters,unlockEntry,CHARACTER_IDS} from './unlock-catalog.js';
import {connectUnlocks,startCampaign,startKillhouse,grantUnlock} from './storage.js';
import {unlockPageMarkup,purchaseReason,purchaseConfirmMarkup,operatorRecoveredMarkup,resultStoriesMarkup,lockedOperatorRow,operatorSignal,UNLOCK_HELP} from './unlock-ui.js';
import {isNoncombatant} from './enemy-data.js';
import {healingAmount} from './traits.js';
import {UNIT_BLUEPRINTS,buildReason,deployReason,deployedUnits,mountableSlots,repairReason,repairTargets} from './workshop.js';
import {ALLY_SKILLS,allySkillState,canAllySkill,allyName,allyWeapon,droneCells,defaultDroneCell,deployLimit,lineLimit,MUNITION_TUNING,TETHER,CARRY_DISTANCE,SUMMON_LIMIT,SUMMON_INTERVAL,SUMMON_TETHER,RALLY_TURNS,PET_TETHER,DRONE_HP,SENTRY_ARMOR,ENEMY_UNIT_TUNING,bombardDamage,REPAIR_TUNING} from './allies.js';
import {petFeedingState,petFeedQuote,outputChoiceReason} from './pet-growth.js';
import {feedingView,petStatusLine,petOutputLine,fuelLabel,fuelPercent,lineProgress,nodeSymbol,nextNode,unlockedMajors,abilityChips,PET_LINE_NAMES,PET_LINE_TINTS,petHelpText} from './pet-ui.js';
import {learningInventory} from './learning.js';
import {LEARNING_ITEMS,LEARNING_SCRAP} from './learning-data.js';
import {suppressivePreview} from './suppressive-fire.js';
import {suppressionStatus,learningEntries,suppressionHelp,traitRuleLines} from './suppression-ui.js';
import {SKILLS,skillActive,skillStatus,canUseSkill} from './skills.js';
import {boundaryOpacityPercent} from './movement-boundaries.js';
import {SCREEN_BRIGHTNESS,screenBrightnessPercent} from './screen-tone.js';
import {drawTinyText,TINY_TEXT} from './pixel-text.js';
import {actorStat,clampHit,combatStatSummary} from './actor-stats.js';
import {isDark} from './lighting.js';
import {missionDepth,returning,MISSIONS,RANDOM_MISSION_IDS,validMissionId,missionDefinition,missionProgress} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {ammoName,magazineLabel,salvageValue} from './weapons.js';
import {TERMINAL_TUNING,TERMINAL_PACK,terminalCost,terminalDeal,terminalRemaining,tradeHoldings,offerReason,terminalSells,terminalName} from './terminal.js';
import {deploymentPortraits,portraitMarkup,validPortrait} from './portraits.js';
import {CHARACTERS,validCharacter,characterName,startingSupplies,classCarryBonus} from './characters.js';
import {PREPARED_CATEGORIES,PREPARED_CATALOG,preparedOptions,preparedEntry,CAPPED_ITEMS} from './prepared.js';
import {levelCost} from './perks.js';
import {resultCopy,retryPlan} from './result-copy.js';
import {isBarrier,barrierFace} from './barriers.js';
import {GRENADES,grenadeTotal,SMOKE_DURATION,DISRUPT_TURNS,BOSS_DISRUPT_TURNS,DISRUPT_IMMUNITY} from './throwables.js';
import {MELEE_TUNING,GRAPPLE_RANGE,GRAPPLE_COOLDOWN,CAMO_DURATION,CAMO_COOLDOWN} from './melee-classes.js';
import {grappleLabel,meleeStatus,meleeSummary} from './melee-ui.js';
import {DEFAULT_OPERATOR_COLOR,validOperatorColor,tintedSprite} from './operator-color.js';
import {colorPickerMarkup,mountColorPicker} from './color-picker.js';
import {classSpriteRect} from './class-art.js';
import {ENDLESS_DISPLAY_FLOORS,isEndless} from './endless.js';
import {depthLabel,levelLabel,levelTitle,endlessRules,levelCapRules,endlessRecordRows,isRecordRun,growthLabel,endlessFloorText} from './endless-ui.js';
import {purgeReportMarkup} from './purge-review-ui.js';
import {createKillhouse,isSimulation,tutorialGate} from './engine.js';
import {saveTutorialOutcome,saveArcadeResult} from './storage.js';
import {exitStep,nextPrompt,promptDue,roomPromptMarkup,tutorialGateMarkup,killhouseMenuMarkup,disposedMarkup,tutorialResultMarkup,arcadeResultMarkup,killhouseScore,bestRecord,KILLHOUSE_SCORE,simulationLabel,simulationBrief} from './killhouse-ui.js';
import {PACK_LIMIT} from './data.js';
import {dailySeed,dailyMission} from './daily.js';
import {VERSION} from './version.js';
import {TRAITS,traitLabels,startingTraits,initiative} from './traits.js';
import {AMMUNITION,AMMO_IDS,MELEE_TINT,CARRY_COSTS,capacity,TERMINAL_AMMO,carryingSpent} from './ammunition.js';
import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,WEAPONS,FLOORS,floorInfo,PERKS,ENEMY_TYPES,enemyName,distance,protocolSettlement,itemUseReason,deployCoverReason,TERMINAL_ITEMS,terminalReason} from './engine.js';
import {DIFFICULTY_OPTIONS,difficultyOption,difficultyMeta,realModeMeta,REAL_MODE_NOTE,runOptions,FACILITY_OPTIONS,facilityOption} from './deploy-ui.js';
import {Renderer} from './render.js';
import {AudioEngine,AUDIO_TUNING,volumePercent} from './audio.js';
import {GRIT_LEVELS,gritLevel} from './audio-grit.js';
import {frameRate,nextFrameRate} from './frame-rate.js';
import {FLARE_TUNING,flareReason} from './flares.js';
import {LINE_TUNING} from './lines.js';
import {HOTKEY_ACTIONS,HOTKEY_SLOTS,HOTKEY_BUTTONS,normalizeKey,validHotkey,keyLabel,parseBindings,defaultBindings,bindKey,clearKey,keyLookup,actionLabel,primaryKey} from './hotkeys.js';
import {eventSounds,actionSound} from './sound-cues.js';
import {engagementHeard,freshCombat,stepCombat,musicTrack} from './music-state.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {targetDetails} from './target-card.js';
import {enemyGlyph,floorTraitNote} from './enemy-visuals.js';
import {unitTree} from './behavior-tree.js';
import {read,write,loadGame,saveGame,storage,profile,recordResult,TEST_MODE,exportBackup,previewBackup,restoreBackup,abandonRun,resetProgress} from './storage.js';
import {DECK_GRID,DECK_COLUMNS,DECK_SLOTS,DECK_LABELS,DECK_GLYPHS,deckPlacement,mirrorDeck,swapSlots,parseDeckLayout} from './deck-layout.js';
import {createReplay,recordReplay,replayLog,stateHash,validReplay} from './replay.js';

const $=s=>document.querySelector(s),audio=new AudioEngine();
const savedGame=loadGame();
let inventoryTab='weapon',deploymentFaces={};
// Title flow (3.98.1, user report): the title screen and every menu reached from it take the full-screen terminal
// treatment. A bottom sheet left the finished run showing above it; closing the dialog always reveals the battle.
let titleFlow=false;
let playback=null,entered=false,orientationBlocked=false,orientationOverride=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor,noticeTimer;
renderer.targetingEnabled=read('ash-targeting')!=='off';
renderer.movementBoundaries=read('ash-movement-boundaries')==='on';
// 3.114.0 (user request): a command pressed while the last turn is still animating ends that animation and runs. On by
// default; the settings menu turns it off.
let skipPresentation=read('ash-skip-presentation')!=='off';
// 3.115.0 (user request): a VHS filter over the whole screen, a display preference that is off by default. It is CSS only
// (expansion.css): the class on <html> shows the layer after the app and the one inside the dialog.
let vhsFilter=read('ash-vhs')==='on';document.documentElement.classList.toggle('vhs',vhsFilter);
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
const PAD_SIZES=[44,52,60,68],PAD_LABELS={44:'標準',52:'大',60:'特大',68:'巨大'};
// 3.101.0 (user request): 格狀 drops the split entirely - one five-by-three field of identical cells, so the pad
// size setting has nothing to say there, because the cell size is the deck width divided by five.
const DECK_LAYOUTS=['classic','corner','grid'],DECK_LAYOUT_LABELS={classic:'經典',corner:'九宫格',grid:'格狀'},GRID_CELL_MAX=76;
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
const GRIT_LABELS={off:'關閉',light:'輕',heavy:'重'};
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
const notice=document.createElement('div');notice.className='battle-notice';notice.setAttribute('role','status');$('#field-messages').append(notice);
// The message bar shows one line; the button opens the whole combat log and counts the extra lines of the last action (3.44).
// 3.104.0 (user request): the message bar sits in the header, one line with an ellipsis, and the extra-line counter
// is a bare +N chip — the old ≡ looked like the ☰ menu two buttons away.
const logButton=document.createElement('button');logButton.className='log-button';logButton.dataset.modal='log';logButton.setAttribute('aria-label','查看戰鬥紀錄');$('#field-messages').append(logButton);
// 3.104.0 (user request): the bar is not empty when quiet — it falls back to the floor and mission line that used to
// live in this row, so a message only borrows the space for a couple of seconds.
const missionLine=view=>isSimulation(view)?simulationLabel(view):isEndless(view)?`${depthLabel(view.floor)} · ${missionDefinition(view).name}`
 :`${pad(view.floor)} / ${returning(view)?'回程 · ':''}${missionDefinition(view).name}${view.floor===missionDepth(view)?` ${missionProgress(view).done}/${missionProgress(view).total}`:''}`;
function restNotice(){const view=renderer.game;if(!view)return;notice.textContent=missionLine(view);notice.classList.remove('danger');notice.classList.add('resting','show');logButton.textContent='';logButton.classList.remove('more');}
let lastActionLogs=1;
const freshLogs=old=>{const i=old?game.logs.indexOf(old):-1;return old&&i>=0?i:game.logs.length;};
// Saving can fail quietly (storage full or blocked). Keep a header warning up until a save succeeds (3.44).
let saveWarned=false,saveWarningDue=false;
function persist(){const ok=saveGame(game);$('#save-warning').hidden=ok;if(!ok&&!saveWarned){saveWarned=true;saveWarningDue=true;}return ok;}
function showSaveWarning(){saveWarningDue=false;modal(`<div class="eyebrow">SAVE / 無法存檔</div><h2>這一步沒有存到。</h2><p>瀏覽器拒絕寫入本機儲存，可能是空間已滿、封鎖了網站資料，或上次還原還沒復原。在恢復之前，關閉頁面會失去這局進度。</p><p>可以先到設定匯出存檔；釋出空間或允許網站資料後，下一次成功存檔時上方的「⚠ 未存檔」會自動消失。</p><div class="modal-row"><button class="modal-button secondary" data-modal="settings">開啟設定</button><button class="modal-button" data-modal="close">繼續 →</button></div>`);}
// Every line of the run (latest 50), newest first; a new turn starts a new block.
function showLog(){
  const rows=game.logs.map((l,i)=>`<li class="${[l.danger?'danger':'',i&&game.logs[i-1].turn!==l.turn?'new-turn':''].join(' ').trim()}"><b>${String(l.turn).padStart(3,'0')}</b><span>${escapeHTML(l.text)}</span></li>`).join('');
  modal(`<div class="eyebrow">LOG / 戰鬥紀錄</div><h2>最近 ${game.logs.length} 則</h2><ol class="combat-log">${rows||'<li><span>尚無紀錄。</span></li>'}</ol><button class="modal-button" data-modal="close">返回戰場 →</button>`);
}
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text,{extra=0,danger=false}={}){notice.textContent=text;notice.classList.remove('resting');notice.classList.add('show');notice.classList.toggle('danger',danger);logButton.textContent=extra>0?`+${extra}`:'';logButton.classList.toggle('more',extra>0);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.classList.remove('show');noticeTimer=setTimeout(restNotice,600);},2700);}
// A new blueprint is announced with the action's latest line even when later logs would cover it (docs/ENGINEER.md
// section 7); the latest line keeps its danger colour.
const notifyLatest=()=>{const latest=game.logs[0],blueprint=game.logs.slice(0,Math.max(1,lastActionLogs)).find(l=>l.text.startsWith('取得藍圖'));if(latest)notify(blueprint&&blueprint!==latest?`${blueprint.text} ${latest.text}`:latest.text,{extra:lastActionLogs-1,danger:latest.danger});};
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
  const sectorLabel=isSimulation(view)?'模擬':isEndless(view)?depthLabel(view.floor):`${pad(view.floor)} 層`;
  if(notice.classList.contains('resting'))restNotice();
  // The mission summary moved into the ☰ menu (3.104.0, user request): most runs just push deeper, and the row
  // it used to occupy is worth more as the message bar.
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#mobile-plates-bar').style.width=`${(p.plates||0)/view.plateCapacity*100}%`;$('#mobile-plates').textContent=`${p.plates||0} / ${view.plateCapacity}`;lowHealth(p);
  $('#level').textContent=`${sectorLabel} · ${levelLabel(p.level)}`;$('#level').title=`${sectorLabel}；${levelTitle(p.level,p.xp,levelCost(game,p.level))}`;
  // One spelling of a prepared slot's label, so a mode that borrows the button can put it back exactly (3.109.0).
  for(const category of Object.keys(PREPARED_CATEGORIES)){
    const entry=preparedEntry(p,category),button=$(`[data-action="${category}"]`),count=entry?.resource?p[entry.resource]:null;
    button.querySelector('.action-icon').textContent=entry?.icon||'◇';
    if(category!=='grenade')button.querySelector('strong').textContent=slotLabel(view,category);
    button.title=entry?`${entry.name}：${entry.text}${category==='skill'?(ALLY_SKILLS.includes(p.prepared.skill)?' 目前'+allySkillState(view,p.prepared.skill)+'。':' 目前'+skillStatus(p,p.prepared.skill)+'；冷卻剩餘 '+(p.skillState[p.prepared.skill]?.cooldown||0)+'。'):''}`:`到背包預備${PREPARED_CATEGORIES[category]}`;
    if(category==='skill'){if(entry?.toggle)button.setAttribute('aria-pressed',String(skillActive(p,p.prepared.skill)));else button.removeAttribute('aria-pressed');}
    button.setAttribute('aria-label',entry?`使用預備${PREPARED_CATEGORIES[category]}：${entry.name}${category==='skill'?'，'+skillLabel(view,p.prepared.skill):''}${count===null?'':`，剩餘 ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`);
  }
  $('[data-action="reload"] strong').textContent=w.melee?'近戰 ∞':`${view.actionCost('reload')===0?'快填':'裝填'} ${p.ammo[p.weapon]}/${w.mag}`;
  $('[data-action="reload"]').title=w.melee?`${w.name}無須裝填`:`裝填：${view.actionCost('reload')} 回合`;
  $('#quick-weapon').textContent=w.melee?`${w.code} · ∞`:`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;$('#quick-weapon').title=w.melee?w.desc:`${ammoName(w)}：備彈 ${reserve}/${view.ammoCapacity(w.ammoType)}`;
  const threats=view.visibleEnemies.filter(e=>!isNoncombatant(e)&&ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range&&(view.sight(e,p)||(unitTree(e).fixedTile&&e.charge&&e.aim&&distance(e.aim,p)===0)));
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  $('#status-effects').textContent=[view.pursuit?'追擊 · 下次攻擊免費':'',view.weapon?.aimPenalty&&!p.focus?`未瞄準 · 命中 −${view.weapon.aimPenalty}`:'',suppressionStatus(p),...meleeStatus(view),p.recovery?'鏈鋸收勢 · 下次行動跳過':'',skillActive(p,'anchor')?'下錨 · 攻擊×2 · 無法移動':'',p.vaultExposed?'翻越破綻 +20':'',skillActive(p,'early_warning')?'預警快照':'',skillActive(p)?`斷層 ${p.skillState.signal_break.remaining}`:'',isDark(view,p)?'暗區':'',exposed?`暴露 ${exposed}`:threats.length?(threats.some(e=>view.accuracy(e,p).coverEfficiency===.5)?'半效掩護':'掩護'):view.cover.length?'牆 / 箱旁':'',p.moved?'移動':'',threats.some(e=>view.accuracy(e,p).sidePenalty)?`側身 ${threats.filter(e=>view.accuracy(e,p).sidePenalty).length}`:'',p.guard?'減傷 50%':'',p.plates?`護甲板 ${p.plates}`:'',p.focus?'瞄準 +15':'',p.evasive?'閃避 +15':'',p.poison?`中毒 ${p.poison} 層`:'',p.control.disabled?`失能 ${p.control.disabled} · 按等待`:'',p.control.immune?`失能免疫 ${p.control.immune}`:'',view.smoke.some(s=>s.cells.some(c=>c.x===p.x&&c.y===p.y))?'煙霧中':'',initiative(p)<0?'快速':initiative(p)>0?'緩速':''].filter(Boolean).join(' · ');
  $('#status-effects').style.color=exposed?'#f3a182':'#b6d5b0';$('#status-effects').title=exposed?`${exposed} 名射手對你有無掩護射線；應立即尋找牆角或箱體。`:'掩體有方向性，注意側翼。';
  // Grapple preview: only while the hook is ready and the locked target is a legal pull or dash.
  renderer.grapplePreview=null;
  if(p.prepared.skill==='grapple'&&!p.skillState.grapple?.cooldown&&!p.control.disabled&&view.status==='playing'){const plan=view.grapplePlan();if(!plan.reason)renderer.grapplePreview={from:{x:plan.mover.x,y:plan.mover.y},point:plan.point,dash:plan.dash};}
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?'關閉瞄準資訊':'開啟瞄準資訊');
  aimingButton.textContent=renderer.targetingEnabled?'瞄準 開':'瞄準 關';
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-name').setAttribute('aria-label',details.fullName||details.name);$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;$('#target-traits').textContent=details.traits;$('#target-order').textContent=details.order;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  // The grenade, item and skill buttons stay pressable when unusable (3.97.0): with nothing prepared a tap opens that
  // backpack tab, and a long press always does. They only look unavailable.
  for(const b of document.querySelectorAll('.control-deck button')){
    const slot=Object.hasOwn(PREPARED_CATEGORIES,b.dataset.action);
    const unusable=(b.dataset.action==='skill'&&(!(ALLY_SKILLS.includes(p.prepared.skill)?canAllySkill(view,p.prepared.skill):canUseSkill(p,p.prepared.skill))||p.control.disabled))||(b.dataset.action==='reload'&&w.melee)||(slot&&(!preparedEntry(p,b.dataset.action)||!preparedEntry(p,b.dataset.action).action||(preparedEntry(p,b.dataset.action).resource&&p[preparedEntry(p,b.dataset.action).resource]<=0)));
    b.disabled=(Boolean(playback)&&!skipEnabled())||view.status!=='playing'||(!slot&&unusable);
    b.classList.toggle('unavailable',slot&&unusable);
  }
  $('[data-action="fire"] strong').textContent=w.melee?'揮拳':'開火';
  updateAim(view);
  if(playback)return;
  if(view.floor!==previousFloor){previousFloor=view.floor;floorToast();}
  if(entered)persist();
  if(game.status!=='playing'&&lastStatus==='playing'){lastStatus=game.status;if(!replay)recordResult(game);showResult();}
  else if(entered&&isSimulation(game)&&game.status==='playing'&&!$('#modal').open&&promptDue(game,promptLog(game)))showRoomPrompt();
  else if(entered&&game.pendingPerks&&game.status==='playing')showLevelUp();
  else if(entered&&saveWarningDue&&!$('#modal').open)showSaveWarning();
}
renderer.isPaused=()=>orientationBlocked;
renderer.frameRate=frameRate(read('ash-frame-rate'));
// The title and every menu opened from it sit on an opaque backdrop, so the battlefield behind them is not drawn.
renderer.isCovered=()=>$('#modal').open&&$('#modal').matches('.title,.standalone');
// Rules are resolved before a presentation starts, so skipping only drops frames. A turn that ended the run always plays
// out, so a death is never covered by the result screen mid-fall; the 120ms double-input lock still applies.
function skipEnabled(){return skipPresentation&&game.status==='playing';}
function endPlayback(){playback=null;renderer.game=game;update();notifyLatest();}
function skipPlayback(){
  if(!playback||!skipEnabled()||orientationBlocked||!entered||performance.now()<lockUntil)return false;
  playback.finish();endPlayback();return true;
}
renderer.onFrame=dt=>{
  if(!playback)return;
  playback.advance(dt);
  if(playback.done)endPlayback();
};
function act(type,arg) {
  skipPlayback();
  if(playback||orientationBlocked||!entered||$('#modal').open||performance.now()<lockUntil)return false;
  pointerStart=null;
  const oldLog=game.logs[0],{success,steps}=captureAction(game,()=>game.action(type,arg));
  if(success){
    // Persist the fully resolved turn before presenting any of its snapshots.
    lastActionLogs=freshLogs(oldLog);persist();lockUntil=performance.now()+120;const cue=actionSound(type==='usePrepared'?preparedEntry(game.player,arg.category)?.action:type);if(cue)audio.play(cue);noteCombat(false);
    if(steps.length){
      renderer.effects=[];
      playback=new Playback(planPresentation(steps,{reduceMotion:renderer.reduceMotion}),event=>{
        renderer.game=event.state;renderer.addEffects(event.effects,playback.elapsed-event.time);
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
  if(success||(type!=='grenade'&&type!=='launch'&&type!=='deployCover'&&type!=='flare'&&type!=='rope'&&!(type==='usePrepared'&&arg?.category==='grenade')))cancelAim();update();return success;
}
function move(dx,dy){if(renderer.mode==='deploy'){act('deployCover',[dx,dy]);return;}if(renderer.mode==='launch'||renderer.mode==='rope'){const from=renderer.aim||game.player;setAim({x:from.x+dx,y:from.y+dy});return;}if(renderer.mode==='pet'){setPetAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='drone'){setDroneAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='grenade'||renderer.mode==='flare'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else if(renderer.mode==='suppress'){setSuppressAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});}else act('move',[dx,dy]);}
function floorToast(){if(isSimulation(game))return;if(isEndless(game)){const growth=growthLabel(game.floor,game.difficultySpec);notify(`第 ${depthLabel(game.floor)} 層 · ${floorInfo(game.floor).name}：${growth?growth+'。':''}${endlessFloorText(game.floor)}${operatorSignal(game)}`);return;}notify(`第 ${game.floor} 層 · ${floorInfo(game.floor).name}：${returning(game)?game.missionSummary:game.floor===missionDepth(game)?missionDefinition(game).text:floorInfo(game.floor).text}`);}
const slotLabel=(view,category)=>{const p=view.player,entry=preparedEntry(p,category),count=entry?.resource?p[entry.resource]:null;
  return entry?`${entry.short}${category==='skill'?' '+skillLabel(view,p.prepared.skill):count===null?'':` ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`;};
function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
// Suppressive fire aims an area like a grenade, but range comes from the weapon and validity from suppressivePreview (3.74.1).
function startSuppressAim(){const p=game.player,reason=suppressivePreview(game,{x:p.x,y:p.y}).reason;if(reason){notify(reason);return;}const pick=[game.targeted,...game.visibleEnemies].find(e=>e&&game.enemies.includes(e)&&!suppressivePreview(game,{x:e.x,y:e.y}).reason);renderer.mode='suppress';renderer.aim=pick?{x:pick.x,y:pick.y}:{x:p.x,y:p.y};notify(`點武器射程 ${game.weapon.range} 格內看得見的地板，按右下確認壓制射擊；再按技能取消。`);updateAim();}
function setSuppressAim(pos){const reason=suppressivePreview(game,pos).reason;if(reason){notify(reason);return;}renderer.aim=pos;updateAim();}
function setAim(pos){const launch=renderer.mode==='launch'||renderer.mode==='rope',range=renderer.mode==='rope'?LINE_TUNING.range:launch?game.weapon.range:5;if(distance(pos,game.player)<=range&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify(launch?`落點需在視線內 ${range} 格以內。`:'投擲落點需在視線內 5 格以內。');}
// 3.111.0 (user request): a point-target launcher is aimed like a thrown grenade — pick a tile, confirm with 互動 —
// so the fire key opens that mode instead of shooting the locked enemy. Pressing fire again cancels.
function fireWeapon(){
  if(renderer.mode==='launch'){cancelAim();return;}
  if(!game.weapon.pointTarget){act('fire');return;}
  if(game.player.ammo[game.player.weapon]<=0){notify('彈匣已空，請裝填。');return;}
  const p=game.player,locked=game.targeted,face=isBarrier(locked)?barrierFace(locked,p):locked;
  const start=[face,...game.visibleEnemies].find(o=>o&&distance(o,p)<=game.weapon.range&&game.visible(o));
  renderer.mode='launch';renderer.aim=start?{x:start.x,y:start.y}:null;updateAim();
  notify(start?'點地圖或用方向鍵調整落點，按右下確認；再按開火取消。':'點地圖選落點，按右下確認；再按開火取消。');
}
const operatorReady=view=>!isSimulation(view)&&view.status==='playing'&&!!view.operatorCorpse&&!view.operatorCorpse.recovered&&view.canTouch(view.operatorCorpse);
function interactions(view=renderer.game){return [...view.nearbyObjectives.map(t=>({label:'回收機密',action:`objective:${t.id}`})),...view.nearbyContainers.map(c=>({label:`開${view.containerLabel(c)}`,action:`case:${c.id}`})),...view.nearbyDoors.map(b=>({label:view.doorLabel(b),action:`door:${b.id}`})),...(view.groundWeapon?[{label:'拾取',action:'bag'}]:[]),...(view.nearbyTerminal?[{label:`終端 ${terminalRemaining(view.nearbyTerminal)}`,action:'terminal'}]:[]),...(operatorReady(view)?[{label:'回收識別資料',action:'operator'}]:[]),...(view.canTouch(view.exitPoint)&&(!isSimulation(view)||exitStep(view))?[{label:view.exitBlocked?'電梯鎖定':view.exitLabel+(view.allyTravelSummary?' · '+view.allyTravelSummary:''),action:isSimulation(view)?'exitStep':'descend'}]:[])];}
function updateAim(view=renderer.game){const launching=renderer.mode==='launch',deploying=renderer.mode==='deploy',commanding=renderer.mode==='pet'||renderer.mode==='drone',aiming=renderer.mode==='grenade',roping=renderer.mode==='rope',flaring=renderer.mode==='flare'||roping,suppressing=renderer.mode==='suppress',preview=suppressing&&renderer.aim?suppressivePreview(view,renderer.aim):null,b=$('#interact'),options=interactions(view);
  const entry=preparedEntry(view.player,'grenade');
  $('#grenade-label').textContent=aiming?'取消投擲':entry?`${entry.short} ${view.player[entry.resource]}`:'手榴彈未預備';
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=(Boolean(playback)&&!skipEnabled())||(view.status==='playing'&&!aiming&&!flaring&&!launching&&!commanding&&!suppressing&&!deploying&&!options.length)||Boolean(preview?.reason);
  b.querySelector('strong').textContent=view.status!=='playing'?'結果':launching?'確認發射':deploying?'取消設置':commanding?(renderer.mode==='drone'?'確認部署':'確認指揮'):aiming?'確認投擲':roping?'確認拉繩':flaring?'確認照明':suppressing?`確認壓制 · ${preview?.rounds??0} 發`:options.length>1?'互動':options[0]?.label||'互動';
  b.classList.toggle('aiming',aiming||flaring||launching||commanding||suppressing||deploying);
  const fire=$('[data-action="fire"]');
  if(fire){fire.classList.toggle('aiming',launching);fire.querySelector('strong').textContent=launching?'取消發射':view.weapon?.melee?'揮拳':'開火';}$('[data-action="skill"]')?.classList.toggle('aiming',suppressing);b.title=view.allyTravelSummary||'';
  const item=$('[data-action="item"]');
  if(item){item.classList.toggle('aiming',deploying||flaring);item.querySelector('strong').textContent=deploying?'取消設置':roping?'取消拉繩':flaring?'取消照明':slotLabel(view,'item');}
  for(const key of ['0,-1','0,1','-1,0','1,0'])$(`[data-move="${key}"]`)?.classList.toggle('aiming',deploying);
}
function interact(){if(renderer.mode==='deploy'){cancelAim();return;}if(renderer.mode==='launch'){if(renderer.aim)act('launch',renderer.aim);else notify('先點地圖選落點。');return;}if(renderer.mode==='pet'){act('commandPet',renderer.aim);return;}if(renderer.mode==='drone'){act('deployUnit',{line:deployLine,x:renderer.aim.x,y:renderer.aim.y});return;}if(game.status!=='playing'){showResult();return;}if(renderer.mode==='grenade'){act('usePrepared',{category:'grenade',target:renderer.aim});return;}if(renderer.mode==='flare'){act('flare',renderer.aim);return;}if(renderer.mode==='rope'){act('rope',{...renderer.aim,item:renderer.ropeItem});return;}if(renderer.mode==='suppress'){const turn=game.turn;act('usePrepared',{category:'skill',target:renderer.aim});if(game.turn!==turn)cancelAim();return;}
  const options=interactions();if(options.length>1){modal('<h2>附近互動</h2>'+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+'<button class="modal-button" data-modal="close">返回戰場</button>');return;}
  if(options[0]?.action.startsWith('objective:'))act('recoverObjective',options[0].action.slice(10));
  else if(options[0]?.action.startsWith('case:'))act('openContainer',options[0].action.slice(5));
  else if(options[0]?.action.startsWith('door:')){const b=game.nearbyDoors.find(b=>b.id===options[0].action.slice(5));if(b)act('door',{id:b.id,open:!b.open});}
  else if(options[0]?.action==='bag')showInventory('weapon');else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');else if(options[0]?.action==='exitStep')act('move',exitStep(game));else if(options[0]?.action==='operator')recoverCorpse();
}
function setPetAim(pos){if(game.seen[pos.y]?.[pos.x]&&game.passable(pos.x,pos.y)&&distance(pos,game.player)<=6){renderer.aim=pos;updateAim();}else notify('指揮位置需在已探索的 6 格內。');}
// Drone skills that put a chassis down open a placement cursor; the default tile faces the way the player looks.
function setDroneAim(pos){if(droneCells(game).some(q=>q.x===pos.x&&q.y===pos.y)){renderer.aim={x:pos.x,y:pos.y};updateAim();}else notify('部署位置需在你 2 步內、走得到的空格。');}
function skill(){if(renderer.mode==='pet'||renderer.mode==='drone'||renderer.mode==='suppress'){cancelAim();return;}const id=game.player.prepared.skill;if(!id){showInventory('skill','還沒有預備技能，點一個技能預備。');return;}if(id==='suppressive_fire'){startSuppressAim();return;}if(id==='pet_command'&&game.activeAllies.some(a=>a.kind==='pet')){renderer.mode='pet';renderer.aim={x:game.player.x,y:game.player.y};notify('點目的地後按右下確認；點自己代表召回。');updateAim();}else if(id==='workshop')showWorkshop();else act('usePrepared',{category:'skill'});}
function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}const entry=preparedEntry(game.player,'grenade');if(!entry){showInventory('grenade','還沒有預備投擲物，點一個投擲物預備。');return;}if(game.player[entry.resource]<=0){notify(`${entry.name}已用盡。`);return;}renderer.mode='grenade';const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,game.player):locked;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
// With nothing prepared, the item button opens the item tab instead of refusing (3.97.0).
// 3.108.0: the slot is a 生效欄 now. Something in it with no action is worn, not held, so the button opens the pack
// instead — and the long press still does, which is why that shortcut had to stay.
function useItem(){if(renderer.mode==='deploy'||renderer.mode==='flare'||renderer.mode==='rope'){cancelAim();return;}
  const entry=preparedEntry(game.player,'item');
  if(!entry){showInventory('item','還沒有預備道具，點一個道具預備。');return;}
  if(!entry.action){showInventory('item',`佩戴中：${entry.name}。脫下要 1 回合；消耗品可以直接在這裡按「使用」。`);return;}
  if(entry.aim==='side'){startDeploy();return;}
  if(entry.aim==='throw'){startThrowAim(game.player.prepared.item);return;}
  act('usePrepared',{category:'item'});}
// 3.135.0: a grapple line is aimed like a flare — pick the landing tile, confirm with 互動, press 道具 again to cancel.
function startThrowAim(id){if(PREPARED_CATALOG.item[id]?.action==='rope')startRopeAim(id);else startFlareAim();}
function startRopeAim(id){
  const p=game.player,entry=PREPARED_CATALOG.item[id];if(!(p[entry.resource]>0)){notify(`${entry.name}已用盡。`);return;}
  renderer.mode='rope';renderer.ropeItem=id;renderer.aim={x:p.x,y:p.y};updateAim();
  notify(`點 ${LINE_TUNING.range} 格內看得見的地板，確認後沿直線把你拉過去${entry.action==='rope'&&PREPARED_CATALOG.item[id].resource==='escapeLines'?'（不耗回合）':''}；再按道具鍵取消。`);
}
// 3.109.0 (user request): carried cover picks its side with the direction keys, so putting it behind you costs the
// same one turn as putting it in front — no turning, and no second tap to confirm.
// 3.123.0: a flare is an item aimed like a throwable: pick a floor tile, confirm with 互動, press 道具 again to cancel.
function startFlareAim(){
  const p=game.player;if(!(p.flares>0)){notify('照明彈已用盡。');return;}
  const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,p):locked;
  renderer.mode='flare';renderer.aim=e&&!flareReason(game,{x:e.x,y:e.y})?{x:e.x,y:e.y}:{x:p.x,y:p.y};updateAim();
  notify(`點 ${FLARE_TUNING.range} 格內看得見的地板，亮起的格子就是會被照亮的範圍；按右下確認，再按道具鍵取消。`);
}
function startDeploy(){
  // Refuse up front only when no side would work at all; the reason of the first blocked side explains why.
  const sides=[[0,-1],[0,1],[-1,0],[1,0]].map(d=>deployCoverReason(game,d));
  if(sides.every(Boolean)){notify(sides[0]+'。');return;}
  renderer.mode='deploy';renderer.aim=null;updateAim();
  notify('按方向鍵選一側架設掩體；再按道具鍵取消。');
}
function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify('附近沒有可見敵人。');return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
// The corner × is gone (3.98.1, user request): it only ever appeared on menus that already carried a back button, and
// its float reserved a column on the right of the content; the pinned footer is the way out.
// On phones a menu is a bottom sheet (3.97.2, user request): its buttons and tab row sit on the screen's bottom edge for
// one-handed use, and a tabbed menu fills the height so its top does not move when tabs of different heights change.
// The upgrade pick is the exception (3.97.3, user report): it opens on its own under a thumb that is still tapping, so it
// is anchored to the top edge and the queued tap lands on the backdrop.
function modal(html,wide=false,title=false){queueMicrotask(syncMusic);cancelAim();$('#modal').classList.toggle('wide',wide);$('#modal').classList.toggle('title',title);$('#modal-content').innerHTML=html;$('#modal').classList.toggle('tabbed',!title&&Boolean($('#modal-content').querySelector('[role="tablist"],.journal-tabs')));$('#modal').classList.toggle('raised',Boolean($('#modal-content').querySelector('[data-perk]')));$('#modal').classList.toggle('transmission',Boolean($('#modal-content').querySelector('.transmission')));$('#modal').classList.toggle('standalone',!title&&titleFlow);pinFooter(title);if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
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

function showIntro(){
  titleFlow=true;
  if(isSimulation(game)&&game.status!=='playing')exitSimulation();
  const canContinue=game.status==='playing'&&(resumable||entered),simulating=isSimulation(game);
  const entry=(action,label,note,disabled=false)=>`<button class="title-entry" data-modal="${action}"${disabled?' disabled':''}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="title-screen">
    <div class="title-mark" aria-hidden="true"><svg viewBox="0 0 128 128"><path d="M23 99 58 24h15l34 75H85L65 50 44 99Z" fill="currentColor"/><path d="m56 85 9-21 9 21Z" fill="#0d1211"/></svg></div>
    <h2 class="title-word">ASH PROTOCOL</h2>
    <nav class="title-menu">
      ${entry('enter','CONTINUE',simulating?simulationLabel(game):canContinue?`${characterName(game.player.character).split(' · ').pop()} · 第 ${game.floor} 層`:'無進行中的任務',!canContinue)}
      ${simulating?entry('khMenu','EXIT SIMULATION','結束模擬，回到原本的戰役'):entry('deploy','NEW GAME','選擇角色與合約')}
      ${simulating?'':entry('killhouse','KILL HOUSE','模擬訓練 · 街機')}
      ${simulating?'':entry('unlocks','UNLOCKS',`協定點數 ${profile().protocol.balance} · 職業與紀錄`)}
      ${entry('help','MANUAL','規則與操作')}
      ${entry('settings','SETTING','備份 · 顯示 · 音效')}
    </nav>
    ${storage.available?'':'<p class="title-warning">⚠ 本機儲存無法使用：這局進度不會保存，請到 SETTING 匯出備份。</p>'}
  </div>`,false,true);
}
// Deployment is a three-step flow. The draft carries the mission and seed
// between screens; newGame() itself is unchanged.
let deployDraft={mode:null,mission:null,seed:undefined};
const MISSION_IDS=RANDOM_MISSION_IDS;
const orderedCharacters=()=>[...OPERATOR_ORDER.filter(id=>CHARACTERS[id]),...Object.keys(CHARACTERS).filter(id=>!OPERATOR_ORDER.includes(id))].filter(id=>availableCharacters(profile()).includes(id));
const lockedCharacters=()=>CHARACTER_IDS.filter(id=>CHARACTERS[id]&&!orderedCharacters().includes(id));
const randomSeed=()=>Math.floor(Math.random()*1000000000);
const pick=list=>list[Math.floor(Math.random()*list.length)];
const runIsLive=()=>game.status==='playing'&&(entered||resumable);
const deployNotice=()=>runIsLive()?'<p class="deploy-warning">! 目前有進行中的任務。確認後才會放棄，已賺點數與永久進度保留。</p>':'';
const seedLabel=seed=>seed===undefined?'隨機':String(seed);
// Deployment-list additions, split from the old shared paragraph. MISSIONS[].text
// is also the mission-floor toast, so floor-3 reminders stay out of the data.
const MISSION_NOTES={
  hunt:'第 3 層仍需擊敗頭目。指定目標以青色菱形標記。',
  sweep:'第 3 層仍需擊敗頭目；第 6 層頭目不是必要目標。指定目標以青色菱形標記。',
  retrieval:'第 3 層仍需擊敗頭目；第 6 層頭目不是必要目標。回收耗 1 回合，不占背包容量。',
  roundtrip:'回收耗 1 回合，不占背包容量。',
  archive:'第 3 層仍需擊敗頭目；第 6 層頭目不是必要目標。回收耗 1 回合，不占背包容量。',
  endless:'每三層一場頭目戰：第 3、6、9、12… 層。死亡時記錄到達深度。'
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
  modal(`<div class="eyebrow">DEPLOYMENT</div><h2>新任務</h2>${deployNotice()}
<nav class="title-menu deploy-menu">
${row('deployNormal','NORMAL GAME','自選任務與種子')}
${row('deployDaily','DAILY GAME',`每日固定 · 種子 ${dailySeed()}`)}
${row('deployQuick','QUICK GAME','全隨機 · 直接開始')}
</nav>
<button class="modal-button secondary" data-modal="${runIsLive()?'settings':'intro'}">取消</button>`,true);
}

function showDeployMission(){
  const selected=game.mission.id;
  modal(`<div class="eyebrow">DEPLOYMENT / 1 OF 3</div><h2>選擇任務</h2>${deployNotice()}
<fieldset class="term-list mission-list"><legend>SELECT CONTRACT</legend>${Object.entries(MISSIONS).map(([id,m])=>`<div class="term-row"><label class="term-pick"><input type="radio" name="mission" value="${id}" ${id===selected?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${m.name}</span><span class="term-meta">${id==='endless'?ENDLESS_DISPLAY_FLOORS:(m.depth||6)}F</span></span></label></div>`).join('')}</fieldset>
<div class="mission-brief" aria-live="polite">${Object.entries(MISSIONS).map(([id,m])=>`<p data-mission="${id}"${id===selected?' class="active"':''}>${m.text}${MISSION_NOTES[id]||''}</p>`).join('')}</div>
<details class="term-detail seed-advanced"><summary>進階</summary><label class="seed-field">地圖種子（留空隨機）<input id="new-seed" type="number" min="0" max="999999999" placeholder="例：2026" inputmode="numeric"></label></details>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deploy">← 返回</button><button class="modal-button" data-modal="deployOperator">下一步：幹員 →</button></div>`,true);
}

function showDeployOperator(){
  const {mission,seed,mode}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK',retry:'REDEPLOY'}[mode]||'NORMAL',retry=mode==='retry';
  modal(`<div class="eyebrow">${retry?'REDEPLOYMENT / SAME SEED':'DEPLOYMENT / 2 OF 3'}</div><h2>選擇幹員</h2>
<p>${label} · ${MISSIONS[mission].name} · 種子 ${seedLabel(seed)}</p>${deployNotice()}
<fieldset class="term-list operator-list"><legend>SELECT OPERATOR</legend>${orderedCharacters().map(id=>{const c=CHARACTERS[id];return `<div class="term-row"><label class="term-pick"><input type="radio" name="character" value="${id}" ${id===(deployDraft.character||game.player.character)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-face">${portraitMarkup(deploymentFaces[id])}</span><span class="term-sprite"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas></span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">${c.name.toUpperCase()} · ${c.hp||100}/${c.armor||0}</span></span></label><p class="term-note">${c.text}</p><details class="term-detail"><summary>詳細資料</summary><div class="term-detail-body"><small>${c.weapons.map(slot=>WEAPONS[slot].name).join('／')}</small><small>護甲板 ${c.plates||0} · ${combatStatSummary({character:id})} · 基礎投擲容量 ${capacity('grenade')+classCarryBonus(id,'grenade')}</small><small>醫療包 ×${startingSupplies(id).meds} · ${Object.values(GRENADES).filter(g=>startingSupplies(id)[g.resource]>0).map(g=>g.short+' ×'+startingSupplies(id)[g.resource]).join('／')}</small>${(c.skills||[]).map(sid=>`<small><b>${SKILLS[sid].name}</b>：${SKILLS[sid].text}</small>`).join('')}${c.traits.map(t=>`<small><b>${TRAITS[t].name}</b>：${TRAITS[t].text}</small>`).join('')}</div></details></div>`;}).join('')}${lockedCharacters().map(id=>lockedOperatorRow(id)).join('')}</fieldset>
${operatorColorPicker()}
<div class="modal-footer"><button class="modal-button secondary" data-modal="${retry?'result':mode==='normal'?'deployNormal':'deploy'}">← 返回</button><button class="modal-button" data-modal="${retry?'retryStart':'deployDifficulty'}">${retry?'投入 →':'下一步：難度 →'}</button></div>`,true);
  mountColorPicker($('#modal .color-list'),drawOperatorSprites);drawOperatorSprites();
}
// Step 3 (3.76.2): the difficulty knob's reserved slot and the real-mode switch, which locks when the run starts.
function showDeployDifficulty(){
  const {mission,seed,mode,character}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK'}[mode]||'NORMAL',chosen=difficultyOption(deployDraft.difficulty);
  modal(`<div class="eyebrow">DEPLOYMENT / 3 OF 3</div><h2>選擇難度</h2>
<p>${label} · ${MISSIONS[mission].name} · ${characterName(character)} · 種子 ${seedLabel(seed)}</p>${deployNotice()}
<fieldset class="term-list difficulty-list"><legend>SELECT DIFFICULTY</legend>${DIFFICULTY_OPTIONS.map(d=>`<div class="term-row"><label class="term-pick"><input type="radio" name="difficulty" value="${d.id}" ${d===chosen?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${d.name}</span><span class="term-meta">${difficultyMeta(d)}</span></span></label></div>`).join('')}</fieldset>
<p class="term-note difficulty-note">兩種難度的敵人數值成長一樣慢；標準另外讓詞條、菁英與特殊敵人提早出現。部署後不能切換。</p>
<fieldset class="term-list facility-list"><legend>FACILITY · 開發用</legend>${FACILITY_OPTIONS.map(o=>`<div class="term-row"><label class="term-pick"><input type="radio" name="facility" value="${o.id}" ${o===facilityOption(deployDraft.facility)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${o.name}</span><span class="term-meta">${o.meta}</span></span></label></div>`).join('')}</fieldset>
<fieldset class="term-list mode-list"><legend>MODE</legend><div class="term-row"><label class="term-pick term-toggle"><input type="checkbox" name="real-mode" ${deployDraft.realMode?'checked':''}><span class="term-caret" aria-hidden="true"></span><span class="term-body"><span class="term-name">真實模式</span><span class="term-meta">${realModeMeta()}</span></span></label><p class="term-note">${REAL_MODE_NOTE}</p></div></fieldset>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deployBackOperator">← 返回</button><button class="modal-button" data-modal="new">${runIsLive()?'確認放棄並部署':'開始新任務'} →</button></div>`,true);
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
  const targets=game.floor===missionDepth(game)?game.mission.targets.map((t,i)=>{
    const e=game.enemies.find(e=>e.id===t.id),done=def.kind==='recover'?t.done:e?.hp<=0;
    const known=def.kind==='recover'?game.seen[t.y]?.[t.x]:e&&game.visible(e);
    return `<p>${done?'✓':'◇'} ${i+1}. ${done?'已完成':known?def.kind==='recover'?'已發現機密資料匣':enemyName(e):'尚未定位'}${!done&&known?'（查看樓層地圖）':''}</p>`;
  }).join(''):'';
  return `<p><strong>${game.missionSummary}</strong><br>${def.text}</p>${targets}`;
}
function showMission(){if(isSimulation(game)){modal(`<div class="eyebrow">SIMULATION / KILL HOUSE</div><h2>${simulationLabel(game)}</h2>${missionDetails()}<button class="modal-button" data-modal="close">返回模擬</button>`);return;}modal(`<div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2>${floorInfo(game.floor).name}</h2>${missionDetails()}<p>${isEndless(game)?endlessRules({intro:false}):'回收：靠近青色 D 資料匣後，按右下互動，耗 1 回合。爆炸不會毀掉任務資料；收下後不占容量。指定殲滅：青色菱形敵人，任何原因死亡都計入；普通敵人不代替指定目標。原路回收需沿各層入口上樓，到第 1 層入口撤離；其他任務完成後前往綠色電梯。'}</p><button class="modal-button" data-modal="close">返回戰場</button>`);}
function showMap(){modal(`<div class="eyebrow">SECTOR ${pad(game.floor)} / ${isSimulation(game)?'KILL HOUSE':floorInfo(game.floor).name}</div><h2>樓層地圖</h2>${missionDetails()}<canvas id="overview" width="324" height="324" aria-label="已探索地圖，橙色為角色、紅色為可見敵人、綠色為已發現電梯"></canvas><p>橙：角色 · 紅：敵人 · 綠：電梯 · 青：任務目標 · 方框：鎖定目標<br>金色小點：已發現補給；彩色方框：未開補給箱；金線／青色門框：關門／開門，灰線：隔板。淡色地框：生活模組；亮綠小方塊：補給站（使用後暗綠）。只顯示已探索區域，查看不耗回合。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`);renderer.drawMap($('#overview'));}

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
  cycleTarget:()=>cycleTarget(),toggleTargeting:()=>toggleTargeting(),bag:()=>showInventory(),map:()=>showMap(),center:()=>centerCamera(),zoomIn:()=>zoomBy(.15),zoomOut:()=>zoomBy(-.15)};
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
  const slot=(id,i)=>{const waiting=hotkeyCapture?.id===id&&hotkeyCapture.slot===i;return `<button class="hotkey-slot${waiting?' waiting':''}" data-hotkey-slot="${id}:${i}" aria-label="${actionLabel(id)} 第 ${i+1} 個按鍵：${waiting?'等待按鍵':keyLabel(hotkeys[id][i])}">${waiting?'按下按鍵…':keyLabel(hotkeys[id][i])}</button>`;};
  modal(`<div class="eyebrow">KEYBOARD</div><h2>熱鍵設定</h2><p>點一格後按下新的按鍵；按 Backspace 清掉這一格，Esc 取消。已經被其他指令用掉的按鍵會從那個指令移過來。Esc 固定是選單與取消。</p>${message?`<p class="hotkey-message" role="status">${message}</p>`:''}${groups.map(group=>`<h3 class="pack-subhead">${group}</h3><div class="hotkey-rows">${HOTKEY_ACTIONS.filter(action=>action.group===group).map(action=>`<div class="hotkey-row"><span>${action.label}</span>${Array.from({length:HOTKEY_SLOTS},(_,i)=>slot(action.id,i)).join('')}</div>`).join('')}</div>`).join('')}${hotkeyCapture?'<button class="modal-button secondary" data-hotkey-cancel>取消</button>':''}<div class="modal-row"><button class="modal-button secondary" data-hotkey-reset>恢復預設</button><button class="modal-button secondary" data-modal="settings">返回設定</button></div>`);
}
function captureHotkey(e){
  if(['Shift','Control','Alt','Meta','CapsLock','Dead','Process','Unidentified'].includes(e.key)||e.isComposing)return;
  e.preventDefault();e.stopPropagation();
  const {id,slot}=hotkeyCapture;hotkeyCapture=null;
  if(e.key==='Escape'){showHotkeys();return;}
  if(e.key==='Backspace'){saveHotkeys(clearKey(hotkeys,id,slot));showHotkeys(`已清掉「${actionLabel(id)}」的第 ${slot+1} 個按鍵。`);return;}
  const result=bindKey(hotkeys,id,slot,e.key);
  if(result.error){showHotkeys(result.error);return;}
  saveHotkeys(result.bindings);
  showHotkeys(`「${actionLabel(id)}」設為 ${keyLabel(normalizeKey(e.key))}${result.displaced.length?`，已從「${result.displaced.map(actionLabel).join('」「')}」移除`:''}。`);
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
  pad.setAttribute('aria-label',grid?'操作區':corner?'移動、等待、裝填與互動':'移動與等待');
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

const INVENTORY_TABS={weapon:'武器',...PREPARED_CATEGORIES};
// Engineer workshop panel (docs/ENGINEER.md phase 1): the class skill opens the production lines; building and
// deploying are separate one-turn actions, and a deployed unit never comes back.
let deployLine=0;
function showWorkshop(message=''){
  const p=game.player,lines=lineLimit(p);
  const row=i=>{const unit=p.productionLines[i];
    if(!unit)return `<div class="ground-loot"><strong>序列 ${i+1} · 空</strong><small>選一張藍圖生產，放進這條序列。</small><button data-workshop-build>生產 · 選藍圖</button></div>`;
    const def=UNIT_BLUEPRINTS[unit.blueprint],reason=deployReason(game,i);
    return `<div class="ground-loot"><strong>序列 ${i+1} · ${def.name}${unit.payload?` · ${GRENADES[unit.payload].name}`:''}${Number.isInteger(unit.weapon)?` · ${game.weaponAt(unit.weapon).name}`:''}</strong><small>${def.text}${unit.payload||['unit_bomber','unit_warden','unit_boss'].includes(unit.blueprint)?'':Number.isInteger(unit.weapon)?`彈匣 ${p.ammo[unit.weapon]}/${game.weaponAt(unit.weapon).mag}，部署時從你身上補滿。`:unit.blueprint==='unit_drone'?'部署時從你身上裝填能量電池。':'部署時從你身上裝填手槍彈。'}</small><button data-workshop-deploy="${i}" ${reason?'disabled':''}>${reason||'部署 · 選位置 · 1 回合'}</button></div>`;};
  // Field repair (3.96.0) lives in this panel, not on the interact button, which the adjacent follow drone would take over.
  const repairs=repairTargets(game).map(a=>{const reason=repairReason(game,a.id),gain=Math.min(a.maxHp-a.hp,Math.ceil(a.maxHp*REPAIR_TUNING.share));return `<div class="ground-loot"><strong>修理 · ${allyName(a)} · HP ${a.hp}/${a.maxHp}</strong><small>在你旁邊，修理回復 ${gain} 生命。</small><button data-workshop-repair="${a.id}" ${reason?'disabled':''}>${reason||`修理 · ${REPAIR_TUNING.cost} 廢料 · 1 回合`}</button></div>`;}).join('');
  modal(`<div class="eyebrow">WORKSHOP / ${p.productionLines.length} OF ${lines}</div><h2>工坊</h2><p>部署中 ${deployedUnits(game).length}/${deployLimit(p)} · 廢料 ${p.scrap}<br>敵方藍圖：${p.blueprints.map(id=>UNIT_BLUEPRINTS[id].name+(p.usedBlueprints.includes(id)?'（已製作）':'')).join('、')||'尚未取得'}<br>部署出去的機體不會回收；受損的機體在你旁邊時會列在下面，可以修理（${REPAIR_TUNING.cost} 廢料、1 回合、回復一半生命）；留在別層的不算部署上限。</p>${message?`<p role="status">${escapeHTML(message)}</p>`:''}${repairs}${Array.from({length:lines},(_,i)=>row(i)).join('')}<button class="modal-button" data-modal="close">返回戰場 →</button>`,true);
}
function blueprintOption(id,def,payload=null,weapon=null){
  const p=game.player,reason=buildReason(game,id,payload??undefined,weapon??undefined),throwable=payload&&GRENADES[payload],gun=weapon!==null?game.weaponAt(weapon):null;
  const detail=throwable?`投擲物：持有 ${p[throwable.resource]} 顆，製作時用掉 1 顆`
    :gun?`武器：${gun.name} +${p.upgrades[weapon]||0}（${ammoName(gun)}，彈匣 ${p.ammo[weapon]}/${gun.mag}，身上 ${p[AMMUNITION[gun.ammoType].key]}）<br>從背包移到機體；製作時從你身上補滿彈匣，之後換彈也扣這種彈藥。${p.weapon===weapon?'<br>這是你手上的武器，裝上後改拿背包裡的下一把。':''}`
    :id==='unit_warden'?`生命 ${ENEMY_UNIT_TUNING.warden.hp}、裝甲 ${ENEMY_UNIT_TUNING.warden.armor}<br>武器：內建蓄力砲，傷害 ${allyWeapon({kind:'drone',sourceId:id},p).min}、射程 ${ENEMY_UNIT_TUNING.warden.range}，每次射擊前蓄力一次（失去目標或被 EMP 失能時取消）`
    :id==='unit_boss'?`生命 ${ENEMY_UNIT_TUNING.boss.hp}、裝甲 ${ENEMY_UNIT_TUNING.boss.armor}<br>武器：內建電漿砲，傷害 ${allyWeapon({kind:'drone',sourceId:id},p).min}、射程 ${ENEMY_UNIT_TUNING.boss.range}，和轟炸交替（中心 ${bombardDamage(p)}、半徑 1、兩次行動後爆炸，你在範圍內也會受傷）`
    :id==='unit_bomber'?'不帶武器、不用彈藥；爆炸半徑 1，你在範圍內一樣會被波及'
    :id==='unit_drone'?`武器：內建電漿槍，射程 ${ENEMY_UNIT_TUNING.drone.range}<br>彈藥：能量電池，部署時從你身上裝填（身上 ${p.energy}）`
    :`武器：內建輕機槍${def.mount?'（也可以選一把背包裡的遠程武器裝上）':''}<br>彈藥：手槍彈，部署時從你身上裝填`;
  return `<button class="perk" data-workshop-blueprint="${id}"${payload?` data-payload="${payload}"`:''}${gun?` data-weapon="${weapon}"`:''} ${reason?'disabled':''}><strong>${def.name}${throwable?` · ${throwable.name}`:gun?` · ${gun.name}`:''} · ${def.cost} 廢料${throwable?'＋1 顆':''}${def.once?' · 只吃廢料 · 一次性':''} · 1 回合</strong><span>${def.text}<br>${detail}${reason?`<br>${reason}`:''}</span></button>`;
}
function showBlueprints(){
  const p=game.player;
  modal(`<div class="eyebrow">WORKSHOP / BLUEPRINTS</div><h2>選擇藍圖</h2><p>廢料 ${p.scrap} · 序列 ${p.productionLines.length}/${lineLimit(p)}</p>${Object.entries(UNIT_BLUEPRINTS).flatMap(([id,def])=>def.payload?Object.keys(GRENADES).map(payload=>blueprintOption(id,def,payload)):[blueprintOption(id,def),...(def.mount?mountableSlots(game).map(slot=>blueprintOption(id,def,null,slot)):[])]).join('')}<button class="modal-button secondary" data-workshop>返回工坊</button>`,true);
}
function startDeployAim(line){
  const reason=deployReason(game,line),cell=defaultDroneCell(game);if(reason||!cell){showWorkshop(reason||'你身邊 2 步內沒有可以部署的空格。');return;}
  close();deployLine=line;renderer.mode='drone';renderer.aim=cell;notify('點身邊 2 步內的空格，按右下確認部署；再按技能取消。');updateAim();
}
// Learning data in the item tab (3.74.1). Reasons and counts come from learningInventory; both actions are free.
function learningSection(){
  const entries=learningEntries(learningInventory(game));
  return `<h3 class="pack-subhead">學習資料</h3>${entries.length?`<div class="pack-rows learning-list">${entries.map(e=>`<div class="pack-row learning-row"><div class="pack-pick"><span class="pack-icon" aria-hidden="true">${e.icon}</span><span class="pack-name">${e.title}</span><small>×${e.count}</small></div>${packInfo(`learn-${e.id}`,e.detail)}${e.useReason?`<p class="pack-reason">${e.useReason}</p>`:''}<div class="pack-actions"><button data-learn="${e.id}" ${e.useReason?'disabled':''}>使用 · 不耗回合</button></div></div>`).join('')}</div>`:'<p class="pack-empty">沒有學習資料。開啟未識別貨櫃可能取得。</p>'}${entries.length?`<p class="pack-reason">用不到的資料可以在補給終端抵 ${LEARNING_SCRAP} 廢料。</p>`:''}`;
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
const packInfo=(id,text)=>text?`<button class="pack-info" data-pack-info="${id}" aria-expanded="false" aria-controls="pack-desc-${id}" aria-label="說明">?</button><p class="pack-desc" id="pack-desc-${id}" hidden>${text}</p>`:'';
const allyStatus=a=>`${a.status==='reforming'?'消散，重生倒數中':a.status==='arriving'?'等候落點':a.status==='destroyed'?'已毀':'活動'} · 第 ${a.floor} 層 · HP ${a.hp}/${a.maxHp}${a.kind==='drone'?(a.payload?` · 裝填${GRENADES[a.payload].short}`:['unit_bomber','unit_warden','unit_boss'].includes(a.sourceId)?(a.primed?(a.sourceId==='unit_warden'?' · 蓄力中':' · 蓄勢中'):a.bombard?' · 下次轟炸':''):` · ${Number.isInteger(a.weapon)?game.weaponAt(a.weapon).name+' ':''}${a.ammo}/${allyWeapon(a,game.player).mag} 發`):''}`;
function showInventory(tab=inventoryTab,message='') {
  inventoryTab=Object.hasOwn(INVENTORY_TABS,tab)?tab:'weapon';
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1),category=inventoryTab;
  let content='';
  if(category==='weapon')content=`    <div class="pack-ammo">${AMMO_IDS.map(id=>`<span style="--tint:${AMMUNITION[id].tint};--tint-bg:${AMMUNITION[id].tint}26" title="${AMMUNITION[id].name}"><i>${AMMUNITION[id].short}</i><b>${p[AMMUNITION[id].key]}<small>/${game.ammoCapacity(id)}</small></b></span>`).join('')}</div>
    <div class="pack-weapons">${p.owned.map(index=>{const w=game.weaponAt(index),d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index];const tint=w.ammoType?AMMUNITION[w.ammoType].tint:MELEE_TINT;return `<article class="pack-weapon ${active?'equipped':''}" style="--tint:${tint};--tint-bg:${tint}1f"><div><div class="pack-weapon-head"><h3>${w.name}${level?` +${level}`:''}</h3><small>${active?'已裝備':'備用'}${w.melee&&game.bumpMeleeSlot()===index?' · 撞擊使用':''} · ${w.code}</small></div><span>傷害 ${d.min}–${d.max}${w.closeRange?` · 1–2 格 ${game.weaponDamage(index,{x:p.x+1,y:p.y}).min}–${game.weaponDamage(index,{x:p.x+1,y:p.y}).max}／命中 +15`:''}${w.burst?` ×${w.burst}${w.burstRange!==undefined?'／遠距 ×1':''}`:''}${w.hits?` ×${w.hits}`:''} · 射程 ${w.range} · ${ammoName(w)} · ${magazineLabel(w,p.ammo[index])}${w.locked?' · 固定裝備':''}</span>${p.affixes[index]?`<p>${w.affixText}</p>`:''}<div class="pack-actions">${w.melee?`<button data-bump="${index}" aria-pressed="${game.bumpMeleeSlot()===index}" ${game.bumpMeleeSlot()===index?'disabled':''}>${game.bumpMeleeSlot()===index?'撞擊使用中':'撞擊時用這把 · 不耗回合'}</button>`:''}<button data-equip="${index}" ${active?'disabled':''}>裝備 · ${game.actionCost('weapon',index)} 回合</button><button data-salvage="${index}" ${p.owned.length<=1||w.locked?'disabled':''}>${w.locked?'固定裝備':`拆解 +${salvageValue(p,index)}`}</button></div></div></article>`;}).join('')}</div>
    ${ground.map(item=>{const w=game.weaponAt(item.slot),level=p.upgrades[item.slot]||0;const tint=w.ammoType?AMMUNITION[w.ammoType].tint:MELEE_TINT;return `<div class="ground-loot" style="--tint:${tint};--tint-bg:${tint}1f"><strong>附近：${w.name}${level?` +${level}`:''}</strong><small>${w.affixText} · 彈匣 ${p.ammo[item.slot]}/${w.mag}</small><button data-compare="${item.slot}">比較／拾取／交換</button><button data-salvage-ground="${item.slot}" ${w.locked?'disabled':''}>就地拆解 +${salvageValue(p,item.slot)}</button></div>`;}).join('')}
`;
  else {
    const options=preparedOptions(p,category);
    const status=(id,entry)=>entry.wear?(p.prepared[category]===id?'脫下 1 回合':'戴上 1 回合'):entry.resource?`×${p[entry.resource]}${CAPPED_ITEMS.includes(id)?`/${game.itemCapacity()}`:''}`:category==='skill'?(ALLY_SKILLS.includes(id)?allySkillState(game,id):`${skillStatus(p,id)}${p.skillState[id]?.cooldown?` · 冷卻 ${p.skillState[id].cooldown}`:''}`):'已學會';
    // 3.107.0 (user request): a consumable is usable from the pack itself, so it needs no prepared slot. The slot
    // is on its way to becoming a 生效欄 for wearables, and a quick-use slot that also has to hold a medkit
    // cannot be both. The refusal comes from the rules layer, so a greyed button always matches what the turn
    // would have said.
    const useCell=(id,entry)=>{
      if(category!=='item'||!entry.action)return '';
      const reason=itemUseReason(game,id),cost=game.actionCost(entry.action);
      return `<button class="pack-use" data-use-item="${id}"${reason?' disabled':''} title="${reason||`使用${entry.name}，${cost?'消耗 1 回合':'不耗回合'}`}">使用</button>`;
    };
    const useReason=(id,entry)=>category==='item'&&entry.action&&p[entry.resource]?itemUseReason(game,id):'';
    const row=([id,entry])=>{const on=p.prepared[category]===id,reason=useReason(id,entry);return `<div class="pack-row${on?' equipped':''}${category==='item'&&entry.action?' pack-row-usable':''}"><button class="pack-pick" data-prepare-category="${category}" data-prepare-id="${on?'':id}" aria-pressed="${on}"><span class="pack-icon" aria-hidden="true">${entry.icon}</span><span class="pack-name">${entry.name}</span><small>${on?entry.wear?'佩戴中 · ':'已預備 · ':''}${status(id,entry)}</small></button>${useCell(id,entry)}${packInfo(`${category}-${id}`,entry.text+(id==='medkit'?` 目前回復 ${healingAmount(p,45)+p.healBonus} 生命。`:''))}${reason?`<p class="pack-reason">${reason}。</p>`:''}</div>`;};
    const allies=category==='skill'&&(game.allies.length||p.skills.includes('workshop'))?`<h3 class="pack-subhead">同行與留置友軍</h3>${game.allies.length?`<ul class="pack-allies">${game.allies.map(a=>`<li><span>${allyName(a)}</span><small>${allyStatus(a)}</small></li>`).join('')}</ul>`:'<p class="pack-hint">無。</p>'}${p.skills.includes('workshop')?`<p class="pack-hint">工坊 · ${allySkillState(game,'workshop')} · 預備後按技能鈕打開</p>`:''}`:'';
    content=`<p class="pack-hint">${category==='grenade'?`共用容量 ${grenadeTotal(p)} / ${game.ammoCapacity('grenade')} · `:''}${category==='item'?'消耗品直接按「使用」，不必先預備；佩戴型點一下戴上、再點一下脫下，各消耗 1 回合。預備與取消預備不耗回合。':'點一下預備，再點一下取消，不耗回合。'}</p>${options.length?`<div class="pack-rows">${options.map(row).join('')}</div>`:`<p class="pack-empty">${category==='skill'?'尚未學會主動技能。':'目前沒有可預備的項目。'}</p>`}${category==='item'?learningSection():''}${category==='skill'?petFeedingSection():''}${allies}`;
  }
  modal(`<h2 class="visually-hidden">作戰背包</h2><div class="pack-resources"><span>◇ 廢料 <b>${p.scrap}</b></span><span>▣ 護甲板 <b>${p.plates}/${game.plateCapacity}</b></span><span>▤ 武器 <b>${p.owned.length}/${game.weaponCapacity}</b></span></div>
    <div class="inventory-tabs" role="tablist" aria-label="背包分類">${Object.entries(INVENTORY_TABS).map(([id,label])=>`<button id="pack-tab-${id}" role="tab" aria-controls="pack-panel" aria-selected="${id===category}" tabindex="${id===category?0:-1}" data-inventory-tab="${id}">${label}</button>`).join('')}</div>
    ${message?`<p class="pack-message" role="status">${escapeHTML(message)}</p>`:''}
    <section id="pack-panel" role="tabpanel" aria-labelledby="pack-tab-${category}" tabindex="0">${content}</section>
    <div class="modal-footer"><button class="modal-button" data-modal="close">返回戰場 →</button></div>`,true);
}
function showWeaponComparison(take,against=game.player.weapon){
  const p=game.player,item=game.nearbyWeapon(take);if(!item||!p.owned.includes(against)){showInventory();return;}
  const old=game.weaponAt(against),next=game.weaponAt(take),a=game.weaponDamage(against),b=game.weaponDamage(take);
  const shot=w=>clampHit(w.melee?w.hitChance+actorStat(p,'meleeAccuracy'):97+w.accuracyBonus+actorStat(p,'rangedAccuracy')),pierce=w=>`${Math.round(w.pierce*100)}%`;
  const close=slot=>{const w=game.weaponAt(slot),d=game.weaponDamage(slot,{x:p.x+1,y:p.y});return w.closeRange?`${d.min}–${d.max}／命中 +${w.closeAccuracy}`:'同一般傷害';};
  const rows=[['1–2 格特效',close(against),close(take)],['單次傷害',`${a.min}–${a.max}`,`${b.min}–${b.max}`],['每次攻擊發數',old.burstRange!==undefined?'2／遠距 1':old.burst||1,next.burstRange!==undefined?'2／遠距 1':next.burst||1],['靜止裸露命中',`${shot(old)}%`,`${shot(next)}%`],['移動目標命中',`${shot({...old,accuracyBonus:old.accuracyBonus-22+old.tracking})}%`,`${shot({...next,accuracyBonus:next.accuracyBonus-22+next.tracking})}%`],['射程',old.range,next.range],['彈匣',magazineLabel(old,p.ammo[against]),magazineLabel(next,p.ammo[take])],['彈種',ammoName(old),ammoName(next)],['穿透',pierce(old),pierce(next)],['改裝等級',`+${p.upgrades[against]}`,`+${p.upgrades[take]}`]];
  modal(`<div class="eyebrow">WEAPON COMPARISON</div><h2>${next.name}</h2><p>${next.affixText}<br>${next.desc}</p><p>比較對象：${old.name} ${against===p.weapon?'（已裝備）':'（備用）'}<br>${old.affixText}</p><div class="pack-actions">${p.owned.map(slot=>`<button data-compare="${take}" data-against="${slot}" ${slot===against?'disabled':''}>${game.weaponAt(slot).name} +${p.upgrades[slot]} · ${magazineLabel(game.weaponAt(slot),p.ammo[slot])}</button>`).join('')}<button data-salvage-ground="${take}">就地拆解 +${20+(p.upgrades[take]||0)*10}</button>${p.owned.length<game.weaponCapacity?`<button class="primary" data-take="${take}">收進空格 · 1 回合</button>`:''}</div><table class="weapon-comparison"><thead><tr><th>能力</th><th>持有</th><th>地面</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th>${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}</tbody></table><p>命中欄含天生命中修正，未計入條件被動／等待／掩體／目標迴避；傷害含本局模組與改裝，未扣目標護甲。穿透減少護甲與掩體減傷，不提高命中率。</p>${old.locked?'<p>裝甲內建武器不能交換或拆解，切換進出不耗回合。</p>':`<p>交換會將${old.name}連同剩餘彈匣、詞條與改裝放在腳下。${against===p.weapon?'新武器立即裝備。':'目前裝備不變。'}</p><button class="modal-button" data-replace="${take}" data-leave="${against}">交換此武器 · 1 回合</button>`}<button class="modal-button secondary" data-modal="bag">返回背包</button>`,true);
}
// Supply terminal (3.120.0 economy, src/terminal.js): a list of offers, then a payment step where the player picks what
// goes into the value pool; scrap covers the rest. Every price, reason and value comes from the rules module.
let terminalDraft=null;
const TRADE_GROUPS={ammo:'彈藥',throw:'投擲物',item:'醫療包與道具',wear:'佩戴',weapon:'武器（照拆解價）',learning:'學習資料（照拆解價）'};
function terminalOfferGroups(){
  const p=game.player;
  return [
    {name:'醫療',rows:[{id:'heal',title:'醫療修復',detail:`回復 ${healingAmount(p,TERMINAL_TUNING.healAmount)} 生命並清除中毒。`},{id:'med',title:'醫療包 +1',detail:`持有 ${p.meds} / ${game.itemCapacity()}，超出的留在腳下。`},{id:'spray',title:PREPARED_CATALOG.item.spray.name,detail:`持有 ${p.sprays} / ${game.itemCapacity()}，超出的留在腳下。`}]},
    {name:'彈藥',rows:[{id:'ammo',title:'彈藥補給包',detail:Object.entries(TERMINAL_PACK).map(([id,n])=>`${AMMUNITION[id].name} ${n}`).join('、')+'。'},...AMMO_IDS.map(id=>({id,title:`${AMMUNITION[id].name} +${TERMINAL_AMMO[id].amount}`,detail:`目前 ${p[AMMUNITION[id].key]} / ${game.ammoCapacity(id)}`}))]},
    {name:'投擲物',rows:Object.values(GRENADES).map(entry=>({id:entry.item,title:`${entry.name} +${entry.amount}`,detail:`持有 ${p[entry.resource]} · 共用容量 ${grenadeTotal(p)} / ${game.ammoCapacity('grenade')}`}))},
    {name:'道具',rows:Object.entries(TERMINAL_ITEMS).filter(([id,offer])=>offer.sold!==false&&id!=='spray').map(([id,offer])=>{const entry=PREPARED_CATALOG.item[id],held=offer.wear?p.wearables.includes(offer.wear):p[offer.resource];return {id,title:entry.name,detail:offer.wear?(held?'已經有一件。':'佩戴型：戴上與脫下各 1 回合。'):`持有 ${held} / ${game.itemCapacity()}，超出的留在腳下。`};})},
    {name:'武器改裝',rows:p.owned.map(slot=>{const w=game.weaponAt(slot),level=p.upgrades[slot]||0;return {id:`upgrade:${slot}`,title:`${w.name} +${Math.min(level+1,TERMINAL_TUNING.upgradeMax)}`,detail:`單次傷害 +5 · 目前 +${level}${slot===p.weapon?' · 手上這把':''}`};})},
  ].map(group=>({...group,rows:group.rows.filter(row=>terminalSells(game.nearbyTerminal,row.id))})).filter(group=>group.rows.length);   // 3.135.0: this kind's offers only
}
function terminalAffordable(id){
  const deal=terminalDeal(game,id,{});if(!deal.reason)return '';
  const most=tradeHoldings(game).reduce((sum,row)=>sum+row.max*row.value,0);
  return game.player.scrap+most<deal.price?'廢料和可抵價的東西都不夠。':'';
}
function showTerminal(){
  const p=game.player,terminal=game.nearbyTerminal;terminalDraft=null;
  if(!terminal){notify('附近沒有可用補給終端。');return;}
  modal(`<div class="eyebrow">SUPPLY TERMINAL</div><h2>${terminalName(terminal)}：選擇要交易的補給。</h2><p>此終端剩餘額度 <strong>${terminalRemaining(terminal)} / ${TERMINAL_TUNING.credit}</strong> · 持有廢料 ${p.scrap}。一次交易一項、耗費 1 回合，可以拿身上的東西抵價。容量不足時，多出的補給留在腳下。</p>${terminalOfferGroups().map(group=>`<h3 class="pack-subhead">${group.name}</h3>${group.rows.map(row=>{const reason=offerReason(game,row.id)||terminalAffordable(row.id);return `<button class="perk" data-terminal-pick="${row.id}" ${reason?'disabled':''}><strong>${row.title} · ${terminalCost(row.id,game)}</strong><span>${reason||row.detail}</span></button>`;}).join('')}`).join('')}<button class="modal-button secondary" data-modal="close">返回戰場</button>`);
}
function showTerminalDeal(buy){
  const terminal=game.nearbyTerminal;if(!terminal||offerReason(game,buy)){showTerminal();return;}
  terminalDraft={buy,trade:{}};
  const title=terminalOfferGroups().flatMap(group=>group.rows).find(row=>row.id===buy)?.title||buy,price=terminalCost(buy,game),rows=tradeHoldings(game).filter(row=>row.held>0);
  const groups=Object.entries(TRADE_GROUPS).map(([group,name])=>[name,rows.filter(row=>row.group===group)]).filter(([,list])=>list.length);
  modal(`<div class="eyebrow">SUPPLY TERMINAL / PAYMENT</div><h2>${title} · ${price}</h2><p>把要抵價的東西加進來，不夠的部分用廢料補；抵超過價格的部分作廢。護甲板不能抵價。本台剩餘額度 ${terminalRemaining(terminal)}，交易後 ${terminalRemaining(terminal)-price}。</p>${groups.length?groups.map(([name,list])=>`<h3 class="pack-subhead">${name}</h3><div class="terminal-trades">${list.map(row=>`<div class="terminal-trade"><span><strong>${row.name}</strong><small>每 ${row.unit} 抵 ${row.value} · 持有 ${row.held}${row.reason?` · ${row.reason}`:''}</small></span><span class="terminal-stepper"><button data-trade-step="${row.id}" data-step="-1" aria-label="少抵一份${row.name}" disabled>−</button><b data-trade-count="${row.id}">0</b><button data-trade-step="${row.id}" data-step="1" aria-label="多抵一份${row.name}" ${row.max?'':'disabled'}>＋</button></span></div>`).join('')}</div>`).join(''):'<p class="pack-empty">身上沒有可以抵價的東西。</p>'}<p class="terminal-total" id="terminal-total" aria-live="polite"></p><button class="modal-button" id="terminal-confirm" data-terminal-confirm>交易 · 1 回合</button><button class="modal-button secondary" data-terminal-back>返回清單</button>`);
  refreshTerminalDeal();
}
function refreshTerminalDeal(){
  if(!terminalDraft)return;
  const {buy,trade}=terminalDraft,deal=terminalDeal(game,buy,trade),p=game.player,rows=new Map(tradeHoldings(game).map(row=>[row.id,row]));
  for(const node of document.querySelectorAll('[data-trade-count]'))node.textContent=String(trade[node.dataset.tradeCount]||0);
  for(const button of document.querySelectorAll('[data-trade-step]')){const id=button.dataset.tradeStep,count=trade[id]||0;button.disabled=button.dataset.step==='-1'?count<=0:count>=(rows.get(id)?.max||0);}
  const total=$('#terminal-total'),confirm=$('#terminal-confirm');
  if(total)total.textContent=`抵價 ${deal.pool}${deal.waste?`（${deal.waste} 作廢）`:''} ＋ 廢料 ${deal.scrap}（持有 ${p.scrap}）＝ ${Math.min(deal.pool,deal.price)+deal.scrap} / ${deal.price}`;
  if(confirm){confirm.disabled=Boolean(deal.reason);confirm.textContent=deal.reason||'交易 · 1 回合';}
}
// Operator order is the user's preferred reading order; skills follow the
// operator that owns them, so a class without a skill simply contributes none.
const OPERATOR_ORDER=['soldier','recon','engineer','necromancer','druid','bulwark','berserker','ninja'];
// Unlock page and corpse recovery (docs/UNLOCKS.md section 8, Claude 3.90.1). Writes go through storage.grantUnlock and Game.recoverOperator only.
let unlockTab='characters';
const unlockStorageReady=()=>storage.available&&!storage.recoveryPending;
function showUnlocks(tab=unlockTab,message=''){unlockTab=tab==='stories'?'stories':'characters';modal(unlockPageMarkup(profile(),{tab:unlockTab,message,available:unlockStorageReady()}),true);drawOperatorSprites();}
function unlockRefusal(id){const entry=unlockEntry(id),reason=entry&&purchaseReason(profile(),entry,{available:unlockStorageReady()});if(entry&&!reason)return false;showUnlocks(unlockTab,reason?reason+'。':'');return true;}
function confirmUnlock(id){if(!unlockRefusal(id))modal(purchaseConfirmMarkup(profile(),id),true);}
function buyUnlock(id){if(unlockRefusal(id))return;const entry=unlockEntry(id);
  if(!grantUnlock(game,id)){showUnlocks(unlockTab,'無法寫入玩家檔案，點數沒有扣除，請稍後再試。');return;}
  showUnlocks(entry.kind==='story'?'stories':'characters',entry.kind==='story'?`已解鎖設施紀錄「${entry.title}」。`:`已解鎖${CHARACTERS[id].label}，之後的新任務可以選擇。`);}
function recoverCorpse(){if(!operatorReady(game))return;const corpse=game.operatorCorpse,owned=availableCharacters(profile()).includes(corpse.character);
  if(!game.recoverOperator()){update();return;}
  persist();update();modal(operatorRecoveredMarkup(corpse.character,{newly:!owned}),true);drawOperatorSprites();}

function perkPips(player,perk,preview=false){
  const n=player.perks?.[perk.id]||0;
  if(perk.cap===null)return `<span class="perk-pips" role="img" aria-label="已取得 ${n} 次${preview?'，選取後 '+(n+1)+' 次':''}"><span aria-hidden="true">×${n}</span></span>`;
  const total=Math.max(perk.cap,n+(preview?1:0)),shown=Math.min(total,32);
  const dots=Array.from({length:shown},(_,i)=>i<n?'●':preview&&i===n?'<span class="perk-next">◉</span>':'○').join('');
  return `<span class="perk-pips" role="img" aria-label="${n}/${perk.cap}${preview?'，選取後 '+(n+1)+'/'+perk.cap:''}"><span aria-hidden="true">${dots}${total>shown?' ×'+total:''}</span></span>`;
}
function runPerks(){
  const acquired=PERKS.filter(o=>(game.player.perks?.[o.id]||0)>0);
  return acquired.length?`<section class="run-perks" aria-label="本局強化"><h3>本局強化</h3><ul>${acquired.map(o=>`<li><span>${o.name}</span>${perkPips(game.player,o)}</li>`).join('')}</ul></section>`:'';
}
// Level-up (3.115.0, user request): the award first lands as an incoming transmission over the battlefield, and the three
// choices open only once it is confirmed. Once per level of a run, so a second pending choice goes straight to the list.
function showLevelUp(){
  if(transmissionSeen===transmissionKey()){showPerks();return;}
  if($('#modal').open&&$('#modal-content .transmission'))return;   // already on screen; do not restart its animation
  modal(`<div class="transmission" role="alert"><div class="eyebrow">PRIORITY SIGNAL / LV. ${game.player.level}</div><p class="transmission-title"><canvas class="transmission-pixels" aria-hidden="true"></canvas><span class="visually-hidden">INCOMING TRANSMISSION</span></p><p class="transmission-note">臨時強化授權待接收。</p></div><div class="modal-footer"><button class="modal-button" data-modal="transmission">確認</button></div>`);
  // 3.116.0 (user request): the heading is drawn as pixel letters (src/pixel-text.js) instead of a smooth font.
  // 3.117.0 (user correction): tiny real text with hard pixels, redrawn once the webfont has loaded.
  const draw=()=>{const heading=$('#modal .transmission-pixels');if(heading)drawTinyText(heading,'INCOMING TRANSMISSION',{color:'#f0c27a',shadow:'#3a2412'});};
  draw();document.fonts?.load?.(`${TINY_TEXT.weight} ${TINY_TEXT.px}px ${TINY_TEXT.font}`).then(draw,()=>{});
  audio.play('transmission');
}
function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>臨時強化已授權。</h2><p>強化生效至本次任務結束。${game.pendingPerks>1?`還有 ${game.pendingPerks} 次選擇。`:''}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>＋ ${p.name} ${perkPips(game.player,p,true)}</strong><span>${p.text}${p.effect==='health'?`（本角色回血 ${healingAmount(game.player,p.heal)}）`:''}</span></button>`).join('')}${runPerks()}`);}
// Journal and result: endless records (3.49.1), class names from the character labels.
const classLabels=()=>Object.fromEntries(Object.entries(CHARACTERS).map(([id,c])=>[id,c.label]));
function endlessJournal(records){const rows=endlessRecordRows(records,classLabels());
  return `<h3>無盡深入</h3><p>${rows.best?`最佳：${rows.best}${rows.classes.length?`<br>各職業最深：${rows.classes.join(' · ')}`:''}`:'尚未挑戰。死亡時記錄到達深度；放棄不列入。'}</p>`;}
function endlessResult(p,abandoned){if(abandoned)return '<p>放棄的無盡任務不列入深度紀錄。</p>';const records=profile(),rows=endlessRecordRows(records,classLabels());
  return rows.best?`<p>${isRecordRun(records,game.floor,p.level,p.kills)?'<strong>新紀錄！</strong> ':''}無盡最佳：${rows.best}</p>`:'';}
// Operator stats, run upgrades and passive rules moved here from the compact backpack (3.97.0).
function operatorStatus(){const p=game.player;return `<h3>幹員狀態</h3><p>${characterName(p.character)} · 裝甲 ${p.armor}<br>${combatStatSummary(p)}${meleeSummary(p).map(line=>'<br>'+line).join('')}</p>${runPerks()}<h3>被動規則</h3><p>${traitLabels(p).join(' · ')||'無'}。<br>${traitRuleLines(p).join('<br>')}<br>被動自動生效，不占主動技能預備欄。</p>`;}
function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>歷次部署紀錄。</h2><div class="journal-tabs"><button data-modal="journal">任務紀錄</button><button data-modal="bestiary">敵人圖鑑</button><button data-modal="help">操作指南</button></div><p>${game.missionSummary}</p>${runIsLive()?operatorStatus():''}<div class="result-stats"><div><b>${records.runs}</b>完成任務</div><div><b>${records.wins}</b>成功撤離</div><div><b>${records.bestFloor}/6</b>最深紀錄</div></div><h3>協定點數 ${records.protocol.balance}</h3><p>本次累積 ${game.protocol.earned} · 死亡仍保留。可用於職業與設施紀錄解鎖；目前已解鎖 ${availableCharacters(records).length} 個職業。</p>${endlessJournal(records)}<h3>待撤離確認 ${(game.pendingStories||[]).length}</h3>${(game.pendingStories||[]).map(id=>{const story=STORIES.find(s=>s.id===id);return `<p class="lore-entry"><strong>${escapeHTML(story?.title||'已封存')}</strong><br>${escapeHTML(story?.body||'')}</p>`;}).join('')}<h3>最近任務</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>${MISSIONS[r.mission]?.name||MISSIONS.extraction.name} · ${characterName(r.character)} · RUN ${r.seed} · ${r.outcome==='abandoned'?'放棄':r.won?'撤離':'陣亡'}${r.realMode?' · 真實模式':''} · ${r.floor} 層${Number.isInteger(r.level)?` · LV.${pad(r.level)}`:''} · ${r.kills} 擊殺 · ${r.turn} 回合</p>`).join(''):'<p>第一次任務紀錄尚未完成。</p>'}<button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
// The codex names cards the way the current facility does (3.103.1, user request), so 步槍兵 in play is 步槍兵 here.
// A variant still hides behind its parent when either the base or the facing name matches, which is what kept the
// armoured and elite cards out of the list before the factions had their own names.
function bestiary(){const codexName=id=>enemyName({type:id,faction:game.facilityFaction});
 modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>已登錄的敵對目標。</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).filter(([id,e])=>!e.variantOf||(e.name!==ENEMY_TYPES[e.variantOf].name&&codexName(id)!==codexName(e.variantOf))).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${enemyGlyph(id)}</span><div><h3>${codexName(id)}</h3><small>基礎生命 ${e.hp} · 射程 ${e.range} · 護甲 ${e.armor}</small><p>${e.role}</p><p>${traitLabels({traits:startingTraits(id,game.floor)}).join(' · ')||'無被動規則'}${floorTraitNote(id,TRAITS)}</p></div></article>`).join('')}</div><h3>被動規則</h3>${Object.values(TRAITS).map(t=>`<p><strong>${t.name}</strong>：${t.text}</p>`).join('')}<p>相反規則互相抵銷，同名多個來源不疊加。快速 → 普通 → 緩速，各階玩家優先，每人每回合行動一次。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD ${VERSION}</div><h2>每一步，都有代價。</h2><p>部署時選擇六層深入、三層往返或無盡深入任務。原路回收：第 3 層取件、擊敗頭目，再沿入口上樓回第 1 層撤離；回程不補給，每層至多兩名增援，預告兩次行動後傳送，抵達當輪不攻擊。第 3 層擊敗頭目；第 6 層依簡報完成核心殲滅、指定殲滅或機密回收，再從綠色電梯撤離。點上方任務標題查看進度；地圖只標出已探索資料匣與當前可見指定敵人。</p><div class="help-grid"><b>四方向</b><span>↑ ↓ ← → 就是畫面上的上下左右。方向鈕、鍵盤 WASD / 方向鍵或點相鄰格移動。以下寫的都是預設按鍵，可以在設定的「鍵盤」段更改，也能讓按鈕左上角顯示按鍵。</span><b>射擊</b><span>點敵人、掩體或油桶鎖定，再按開火 / Space。目標鈕 / Tab 輪換敵人。瞄準鈕 / Q 收起或顯示浮卡、鎖定框及目標取景，關閉時仍可開火，視野如同沒有鎖定目標；點擊敵人會重新開啟瞄準。有敵人時會閃爍提醒。</span><b>友軍與職業</b><span>工程師按技能打開工坊：空的生產序列花廢料生產追隨無人機或定點砲台（各 ${UNIT_BLUEPRINTS.drone_follow.cost} 廢料、1 回合）；完成的機體點你身邊 2 步內的空格，按右下確認部署（1 回合），再按技能取消。部署出去的機體不會回收，受損時站在它旁邊打開工坊修理（${REPAIR_TUNING.cost} 廢料、1 回合、回復一半生命，含機體強化加成）；基礎 1 條序列、同時部署 1 台，職業升級各可加到 4，留在別層的機體不算部署上限。追隨無人機與定點砲台 ${DRONE_HP} HP，在你 ${CARRY_DISTANCE} 步內會自己用你身上的彈藥換彈（內建輕機槍用手槍彈，掛載武器用那把武器的彈種；打空，或閒著時剩一半以下），用牠自己的行動。追隨無人機閒置時貼在你身邊、可隨時換位，射程 ${allyWeapon({kind:'drone',sourceId:'drone_follow'}).range}；定點砲台裝甲 ${SENTRY_ARMOR}、可利用掩體、不移動。生產這兩種機體時，可以把背包裡的一把遠程武器裝上去（背包至少留一把，近戰與固定武器不行）：機體改用那把武器的傷害、射程、連發、穿透、詞條與改裝射擊，命中另扣機體修正，換彈扣你身上那種彈藥；爆炸型武器不打機體旁邊的敵人，但你在爆炸範圍內照樣會被波及；機體被打爆時，武器連同剩下的子彈掉在原地。浮游彈藥花 ${UNIT_BLUEPRINTS.drone_munition.cost} 廢料加 1 顆投擲物生產，生命 ${MUNITION_TUNING.hp}，不算部署上限：看得到敵人就一格一格飛近，${MUNITION_TUNING.dive} 格內沿直線俯衝到敵人旁邊，同一次行動引爆裝入的投擲物（半徑 ${MUNITION_TUNING.radius}，效果同投擲物，範圍內的友軍也會受影響），不預告；你站在爆炸範圍內也會被波及，不和你換位，換層時不跟著走。擊毀巡弋無人機或自爆機器人時取得該藍圖（誰打的都算，自爆機器人自己引爆的不算），每種一次：改造無人機 ${UNIT_BLUEPRINTS.unit_drone.cost} 廢料，生命 ${ENEMY_UNIT_TUNING.drone.hp}，飛行、不用掩體，內建電漿槍射程 ${ENEMY_UNIT_TUNING.drone.range}、吃你的能量電池，會追擊繩索內的敵人；改造自爆機器人 ${UNIT_BLUEPRINTS.unit_bomber.cost} 廢料，生命 ${ENEMY_UNIT_TUNING.bomber.hp}，不算部署上限，走到敵人旁邊蓄勢一次、下次行動自爆（半徑 ${ENEMY_UNIT_TUNING.bomber.radius}，敵人走開也照樣引爆），被打爆時也會爆炸；你在範圍內一樣會被波及，它不和你換位，換層時不跟著走。擊毀封鎖官或核心守衛取得頭目藍圖，只吃廢料、每局只能製作一次：改造封鎖官 ${UNIT_BLUEPRINTS.unit_warden.cost} 廢料，生命 ${ENEMY_UNIT_TUNING.warden.hp}、裝甲 ${ENEMY_UNIT_TUNING.warden.armor}，每次射擊前蓄力一次（射程 ${ENEMY_UNIT_TUNING.warden.range}，失去目標或被 EMP 失能時取消）；改造核心守衛 ${UNIT_BLUEPRINTS.unit_boss.cost} 廢料，生命 ${ENEMY_UNIT_TUNING.boss.hp}、裝甲 ${ENEMY_UNIT_TUNING.boss.armor}，槍擊（射程 ${ENEMY_UNIT_TUNING.boss.range}）與延遲轟炸交替，轟炸標記在 2 格外的目標上、兩次行動後爆炸，你在範圍內也會受傷。兩者都不用彈藥、可用掩體、會追擊繩索內的敵人，算部署上限，換層時跟著走。德魯伊技能指定已探索 ${TETHER} 格內目的地，右下確認，點自己召回；指令免費，下次寵物行動執行。寵物會追擊離你 ${PET_TETHER} 格內的敵人。${petHelpText()}死靈法師不用施法：本層倒下過的非頭目、非機械敵人每 ${SUMMON_INTERVAL} 回合自動有一隻起身為召喚物，倒下越多的種類越常出現，屍體不消耗，最多 ${SUMMON_LIMIT} 隻；召喚物生命同該物種（32～150）、傷害取物種基礎值、沒有裝甲，會主動追擊離你 ${SUMMON_TETHER} 格內的敵人。按技能免費集結，${RALLY_TURNS} 回合內召喚物回到你身邊，換層前記得用。死靈法師本身難以治療，回血減半。友軍繩索：機體 ${TETHER} 格、寵物 ${PET_TETHER} 格、召喚物 ${SUMMON_TETHER} 格，繩索內提供視線，敵人會攻擊牠們；爆炸與失能同樣有效。有目標時友軍在繩索內持續交戰，沒有目標才跟回身邊。朝友軍移動會與牠交換位置，照常花 1 回合，友軍放棄一次行動；定點砲台、失能或隔著矮隔板時不能換。窄路上友軍之間也會互換位置讓路，但不會打斷正在攻擊的友軍。換層時 ${CARRY_DISTANCE} 格可通路內活友軍同行，保留 HP／彈藥，太遠召喚物消失、機體留在原層，回程才能重新會合；伴生獵獸不論遠近一律同行。</span><b>新增戰術</b><span>士兵預警：免費啟動，8 格內敵人位置以光點穿牆顯示，持續至下一次耗回合行動結束；不追蹤移動、不提供射線，同時向被掃描敵人暴露你的位置。冷卻 5 次行動。矮隔板耐久 60、不擋視線或爆炸，提供箱體等級掩護；朝它移動直接翻越、耗 1 回合，至下次自己行動前被射擊命中 +20，敵我相同，落點有人不能翻。霰彈槍 1–2 格基礎傷害 60–72、命中 +15；更遠維持 42–54。走廊沿用連接其中一房的照明，畫面柔化不改各格明暗與視線規則。</span><b>門與隔板</b><span>障礙物在兩格之間，不占地板。朝關門移動：花 1 回合開門，人留原地；再移動才通過。正面或斜角可從右下互動鍵開／關，皆花 1 回合、人留原地；斜角與同側門前格之間不能有牆或障礙阻隔。點門板或隔板邊界可鎖定破壞：門耐久 60、隔板 90。關閉時阻擋通行、視線與爆炸，並提供方向性掩體；打開或摧毀後讓出通道。人型／一般機械會開門，獸類與重型近戰敵人破門。敵人記得最後看見你的位置，關門不會讓它忘記你。</span><b>掩體</b><span>掩體朝向與來火偏角小於 45° 為完整，45° 起半效，約 63.4°（側向是正向兩倍）起無效。半效命中懲罰與減傷減半，多個掩體取最強、不疊加。牆角仍可探身，但平行來火不提供掩護；爆炸傷害不吃掩體減傷。</span><b>行動順序</b><span>快速 → 普通 → 緩速，同速玩家先行動。選定有效行動後不能重選；射擊追蹤原目標，目標先移出視線／射程仍向最後確認位置開火落空，消耗彈藥與回合。等待防護從自己行動後生效，維持到下次自己行動前。移動閃避維持到自己的下次行動；狙擊手的蓄勢鎖定仍射向原落點。回合末才結算轟炸與地形。</span><b>角色被動</b><span>士兵：自己相對目標有掩體時命中 +12；連續回合射擊同一敵人，後續每次 +8、最高 +24。未命中仍累積，耗回合的其他動作中斷；同輪連發只算一次。偵察兵：相對攻擊者主要橫向移動時，被射擊命中額外 −20，暴露時移動與側身合計至少 −42；手槍彈種武器免費裝填，仍扣備彈。免費動作不消耗等待或中斷連射。</span><b>重裝兵</b><span>大型、笨拙、緩速：普通敵人先行動，每回合仍移動一格。生命 200、裝甲 6、直接傷害再減 25%（不擋環境與中毒）；難以治療，回血減半。輕機槍三連發使用步槍彈；動力拳相鄰一格、基礎命中 99%、無限使用，無視掩體。朝相鄰敵人移動會使用背包裡選定的近戰武器（預設是動力拳）攻擊，耗 1 回合、留在原地且保留目前槍械；門關閉時先開門。固有技能「下錨」：啟動／解除各 1 回合，下錨時不能移動或換層、套用笨拙；自己的武器射擊與近戰在普通及緩速各執行一次，分別消耗彈藥。第二次射擊仍追蹤原目標；投擲物與友軍不加倍，投擲仍在原本速度使用一次。動力拳不能拆解或交換，可改裝；切換進出不耗回合，實際攻擊才耗回合。</span><b>狂戰士</b><span>生命 ${CHARACTERS.berserker.hp}、裝甲 ${CHARACTERS.berserker.armor}，射擊命中 ${CHARACTERS.berserker.combat.rangedAccuracy}，綁定狂戰斧（不能拆解或交換，切換不耗回合）。鉤鎖對目前鎖定的敵人使用，${GRAPPLE_RANGE} 格內看得到即可，可斜向：一般敵人拉到你身邊，大型與頭目改由你衝過去，到位後砍一刀；花 1 回合、冷卻 ${GRAPPLE_COOLDOWN}。地圖上會預覽落點，技能鈕顯示「拉近」或「衝刺」。嗜血：近戰實際傷害的 ${MELEE_TUNING.bloodlust*100}% 回復生命。戰意：近戰擊殺疊層、最多 ${MELEE_TUNING.spiritMax} 層，每層減傷 ${MELEE_TUNING.spiritReduction*100}%；${MELEE_TUNING.spiritDelay} 回合沒有近戰擊殺後，每 ${MELEE_TUNING.spiritInterval} 回合掉一層，狀態列會顯示倒數。刃藏：每帶一把近戰武器，所有攻擊 +${MELEE_TUNING.bladeDamage*100}%、減傷 ${MELEE_TUNING.bladeReduction*100}%。</span><b>忍者</b><span>生命 ${CHARACTERS.ninja.hp}、射擊迴避 +${CHARACTERS.ninja.combat.rangedEvasion}，側身、夜視，綁定忍刀、副武器${WEAPONS[CHARACTERS.ninja.weapons[1]].name}，投擲容量 +${CHARACTERS.ninja.carryBonus.grenade}，開局煙霧 ${CHARACTERS.ninja.supplies.smoke}、震撼 ${CHARACTERS.ninja.supplies.stun}。光學迷彩免費啟動：${CAMO_DURATION} 次付費行動內敵人對你的命中 −${MELEE_TUNING.camoEvasion}，攻擊不解除；效果結束後冷卻 ${CAMO_COOLDOWN}，迷彩不會讓敵人看不到你。伏擊：目標失能、目標或你站在煙霧中、目標還沒發現你，或你站在暗處時，近戰傷害 ×${MELEE_TUNING.ambush}，並讓迷彩冷卻 −1（生效中不減）；鎖定目標符合時狀態列顯示「伏擊」。單挑：只有一名已發現你的敵人看得到你時，射擊與近戰迴避 +${MELEE_TUNING.duelist}。</span><b>無盡與等級</b><span>${endlessRules()} ${levelCapRules()}</span><b>解鎖</b><span>${UNLOCK_HELP}</span><b>兵種配給</b><span>Soldier 射擊命中 +8。Recon 射擊迴避 +10，基礎投擲容量 6；開局煙霧／EMP 各 2 顆，預備煙霧。生命／裝甲：重裝兵 ${CHARACTERS.bulwark.hp}／${CHARACTERS.bulwark.armor}、狂戰士 ${CHARACTERS.berserker.hp}／${CHARACTERS.berserker.armor}，其餘職業 100／0。重裝兵與死靈法師「難以治療」：醫療包、終端、升級與下樓的基礎回血都減半並向下取整，急救訓練給醫療包的加成不減；生命上限與護甲板不受影響。近戰有獨立命中／迴避修正，各職業初值均 0。被動自動生效。Recon 起始學會並預備「訊號斷層」，免費啟動，持續 3 次耗回合行動、冷卻 6 次（啟動起算）。敵人暫時無法更新你的位置，但會搜索最後目擊處；已鎖定的狙擊與轟炸仍會落下。免費裝填／預備不倒數，下樓結束效果、保留冷卻。</span><b>照明與感知</b><span>部分房間停電，目標在暗區時射擊命中 −40 個百分點，可與移動／掩體疊加，不額外減傷。夜視消除此懲罰；紅外線看穿煙霧但不穿牆、不自帶夜視。Recon 起始兩者都有；狙擊手有夜視、封鎖官有紅外線。生物或有任一感知被動者都會被震撼彈失能，機械也不例外；多條符合不重複結算。</span><b>命中率</b><span>暴露且靜止 97%；移動 −22%。完整箱體 −35、牆／隔板 −42 個百分點；半效為 −18／−21。完整減傷 45%、半效 22.5%，敵我規則相同。角落的半透明卡片顯示名稱、HP、命中率、距離與掩體；卡片不攔截觸控。</span><b>手榴彈</b><span>先在背包的手榴彈分頁預備，再按 G 或投擲物按鈕，點地板選落點，再按右下「確認投擲」；原手榴彈按鈕可取消。四種投擲物共用容量，射程 5、半徑 2。破片會自傷與連鎖引爆；EMP 對機械、震撼彈對生物或有夜視／紅外線者，跳過 ${DISRUPT_TURNS} 次自身行動（頭目 ${BOSS_DISRUPT_TURNS} 次；投擲當回合還沒行動的，當回合就算第 1 次），恢復後免疫 ${DISRUPT_IMMUNITY} 次行動；震撼彈會影響自己，失能時按中央等待恢復。煙霧持續 ${SMOKE_DURATION} 輪（含投擲當輪），阻擋無紅外線者的視線、煙內只見相鄰格，不擋爆炸與已鎖定落點的狙擊。</span><b>背包</b><span>B 開啟背包，分為武器／手榴彈／道具／技能。長按投擲物、道具或技能鈕直接打開對應分頁；還沒預備時點一下也會打開。幹員數值、本局強化與被動規則在右上選單的「幹員狀態、任務紀錄與敵人圖鑑」。備彈上限與彈匣分開計算；護甲板吸收直接傷害的至多一半，消耗後可拾取修復，不擋毒液或高熱。投擲物、道具與技能各有獨立預備欄，預備不耗回合；使用成本依項目，訊號斷層免費啟動。被動自動生效。可帶 ${PACK_LIMIT} 把武器。在背包直接選擇武器換裝，所需回合顯示於按鈕；交換、拾取、拆解、改裝與補給各消耗 1 回合，比較不耗時；走上武器會在有空格時收下，相同槍種不會自動拆解。Q 開關瞄準資訊（不耗回合）、R 裝填、H 使用預備道具、F / 句點 / 中央鈕等待：自己行動後至下次行動前，直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15（最高 99%）。加成不疊加；任何有效行動後失效。</span><b>補給</b><span>低矮補給箱可走過、不提供掩體且不會被破壞。靠近後用右下互動開箱，花 1 回合；內容固定，落地後走上去拾取。箱內物資不會直接進背包，空箱留下。武器、資料片與敵人掉落仍在地上。走上道具即可拾取；護甲板滿額時留在原地。彈藥庫有五類備彈，醫療室與裝甲庫提供專用補給，探索地圖可查看已發現的補給。五類備彈與手榴彈各有上限，多出的留在地上；容量固定為基礎值與職業加成。醫療包、修復噴劑、腎上腺素、摺疊掩體與照明彈每種最多帶 5 個，多出的同樣留在地上；學會「攜行擴充」後，每種彈藥上限 +50%、投擲物 +2、每種道具 +2。靠近終端選購補給與武器改裝，一次一項、耗 1 回合：用廢料付，或拿身上的東西抵價（彈藥與道具約六折，武器與學習資料照拆解價，醫療包 10，護甲板不能抵），多抵的作廢；每台終端有 60 額度。終端分軍械彈藥、治療、道具三種，只賣自己這一類；每層只有其中兩種，分別在彈藥庫、醫療室、裝甲庫。夜視鏡不在終端販售：狙擊手可能掉落，未識別貨櫃也可能開出。持槍敵人偶爾掉落逃命繩索（不耗回合，一次 1 條）或重部署鉤索（耗 1 回合，一次 3 條）：從背包或道具鍵使用，點 6 格內看得見的地板，沿直線把你拉過去；牆、實心物件與其他單位會擋住，幼蟲不擋；一條只用一次。武器可帶一種詞條，背包可比較並交換；同類武器分別保留彈匣與改裝，不會自動拆解。拆解回收備彈／廢料，改裝增傷至 +3。</span><b>生活區與補給站</b><span>新樓層最多 2 處衛浴間、門禁櫃檯或值勤哨站（地形放不下時可能沒有）；家具可破壞，和箱體一樣提供掩體。衛浴間以門與隔板圍合，標記 WC／ACCESS／POST。地板標線沒有額外互動或保證獎勵。每層補給站縮為兩座：主路一座、探索支路一座；各只能購買一次，價格不變，已發現站可在地圖查看。</span><b>雜兵與追擊</b><span>雜兵與巢穴幼蟲不給經驗、廢料或掉落。玩家親手擊殺可準備一次免費攻擊，目標不限；可繼續連鎖，但不與影步疊加。免費準備／換裝保留追擊，其他付費動作放棄。撞上敵人時用背包裡選定的近戰武器攻擊（在背包的武器頁按「撞擊時用這把」，不耗回合；沒選時用背包裡第一把），不切換手上的槍；沒有近戰武器就徒手。未識別貨櫃可能開出求生小刀（比徒手準也痛）、手爪（在快速的敵人之前出手，打沒裝甲的目標 ×1.5）、軍刀（命中後濺射目標身旁敵人 45%）、長矛（拿在手上可開火，刺穿 2 格直線上的每個單位，友軍也會被刺中）與鏈鋸（普通敵人先動；命中後連鋸 10 下、每下 3–10、無視裝甲，之後你跳過下一次行動）。巢穴靠近後持續啟動，有限量放出幼蟲；摧毀便停止。</span><b>壓制與學習資料</b><span>${suppressionHelp()}</span><b>危險</b><span>! 代表敵人蓄勢。紅色轟炸格兩回合後爆炸；綠色毒液與橘色高熱格會傷害站在上面的單位。</span><b>撤離</b><span>到綠色電梯鄰格，按電梯按鈕或 E。本層頭目或最終任務要求未完成時電梯鎖定。</span><b>存檔</b><span>每步自動儲存在目前瀏覽器；寫入失敗時上方會出現「⚠ 未存檔」。設定可匯出 / 匯入存檔，避免換裝置失去進度。</span></div><button class="modal-button" data-modal="close">收到，返回戰場 →</button>`,true);}
function settings(){
  // 主選單進來只顯示全域設定；局內功能（指南、升級、簡介、放棄、重新部署）留在遊戲中的選單。
  const simulating=isSimulation(game),inRun=runIsLive(),sec=label=>`<div class="eyebrow settings-section">${label}</div>`;
  modal(`<div class="eyebrow">SYSTEM / BUILD ${VERSION}</div><h2>${inRun?'作戰設定':'系統設定'}</h2>${inRun?runPerks():''}
<p>${inRun?`${characterName(game.player.character)} · ${simulating?simulationLabel(game):`任務 ${game.seed} · 第 ${game.floor} 層`} · ${game.turn} 回合`:`協定點數 ${profile().protocol.balance}`}<br>${simulating?'模擬不保存中途進度。':storage.available?'進度已自動儲存。':'本機儲存不可用，請匯出存檔保留進度。'}</p>
${sec('聲音')}
<button class="modal-button secondary" data-modal="sound" aria-pressed="${audio.enabled}">聲音：${audio.enabled?'開啟':'關閉'}</button>
<label class="boundary-opacity" for="music-volume">音樂音量 <output id="music-volume-value" for="music-volume">${Math.round(audio.musicVolume*100)}%</output><input id="music-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.musicVolume*100)}"></label>
<label class="boundary-opacity" for="sfx-volume">音效音量 <output id="sfx-volume-value" for="sfx-volume">${Math.round(audio.sfxVolume*100)}%</output><input id="sfx-volume" type="range" min="0" max="100" step="5" value="${Math.round(audio.sfxVolume*100)}"></label>
<p>選單播放〈待命〉；進入設施後播放該派系的探索配樂，敵人喊出交戰的台詞時切換成交戰配樂，視野內連續十回合沒有敵人再切回探索。</p>
<button class="modal-button secondary" data-modal="audioGrit" aria-pressed="${audio.grit!=='off'}">訊號雜訊：${GRIT_LABELS[audio.grit]}</button>
<p>每個音效播放時隨機偏一點音高與時間，偶爾混進爆音、靜電或訊號斷一下；配樂加上錄影帶的抖音。按一下切換 關閉／輕／重。</p>
${sec('顯示')}
${inRun?`<div class="modal-row"><button class="modal-button secondary" data-modal="help">作戰指南</button><button class="modal-button secondary" data-modal="log">戰鬥紀錄</button></div>`:''}
<button class="modal-button secondary" data-modal="movementBoundaries" aria-pressed="${renderer.movementBoundaries}">移動邊界白線：${renderer.movementBoundaries?'開啟':'關閉'}</button>
<p>沿可見牆與障礙物標示輪廓；斷點不延伸。門另以綠線表示關閉、兩側綠點表示開啟。</p>
<label class="boundary-opacity" for="boundary-opacity">白線不透明度 <output id="boundary-opacity-value" for="boundary-opacity">${renderer.boundaryOpacity}%</output><input id="boundary-opacity" type="range" min="0" max="100" step="5" value="${renderer.boundaryOpacity}" aria-describedby="boundary-opacity-help"></label>
<p id="boundary-opacity-help">0% 完全透明，100% 不透明；只調整白線，綠色門提示不受影響。</p>
<button class="modal-button secondary" data-modal="skipPresentation" aria-pressed="${skipPresentation}">演出中按指令直接執行：${skipPresentation?'開啟':'關閉'}</button>
<p>開啟時，上一回合的動畫還沒播完就按下一個指令，會立刻結束動畫並執行；關閉時要等動畫播完。本回合陣亡或任務結束時一定會播完。</p>
<button class="modal-button secondary" data-modal="frameRate" aria-pressed="${renderer.frameRate!==60}">畫面更新：每秒 ${renderer.frameRate} 次</button>
<p>戰場每秒重畫的次數，全遊戲共用，按一下切換 60／30／15。越低越省電、手機越不會熱，動畫越不順，但動作的快慢不變；15 適合舊手機，槍口火光這類很短的效果可能看不到。整頁選單蓋住戰場時一律不重畫。</p>
<label class="boundary-opacity" for="screen-brightness">畫面明度 <output id="screen-brightness-value" for="screen-brightness">${screenBrightness}%</output><input id="screen-brightness" type="range" min="${SCREEN_BRIGHTNESS.min}" max="${SCREEN_BRIGHTNESS.max}" step="${SCREEN_BRIGHTNESS.step}" value="${screenBrightness}" aria-describedby="screen-brightness-help"></label>
<p id="screen-brightness-help">整個畫面一起調，包括選單與結算畫面；100% 為原始亮度。和 VHS 濾鏡可以一起用。</p>
<button class="modal-button secondary" data-modal="vhs" aria-pressed="${vhsFilter}">VHS 濾鏡：${vhsFilter?'開啟':'關閉'}</button>
<p>在整個畫面疊上掃描線、雜訊、暗角與緩慢捲動的訊號帶。系統設定減少動態效果時，雜訊與訊號帶不會動。</p>
<div class="modal-row"><button class="modal-button secondary" data-modal="padLayout">操作區排版：${DECK_LAYOUT_LABELS[padLayout]}</button><button class="modal-button secondary" data-modal="padCell" ${padLayout==='grid'?'disabled':''}>方向鍵大小：${padLayout==='grid'?'格狀不適用':`${PAD_LABELS[padCell]}（${padCell}）`}</button></div>
<p>九宫格把「裝填」、「互動」移到方向鍵的右上與左上，右側只剩四顆更大的按鈕。格狀則沒有左右之分：整條操作區是五欄三列的同尺寸方格，尺寸由寬度推出來，所以沒有方向鍵大小可調。關閉設定後即可看到效果。</p>
<button class="modal-button secondary" data-modal="deckEditor" ${padLayout==='grid'?'':'disabled'}>編輯按鈕位置${padLayout==='grid'?'':'（格狀限定）'}</button>
${sec('鍵盤')}
<button class="modal-button secondary" data-modal="hotkeyHints" aria-pressed="${hotkeyHints}">按鈕上顯示熱鍵：${hotkeyHints?'開啟':'關閉'}</button>
<p>在方向鍵、行動鈕、目標與地圖按鈕的左上角標出對應的鍵盤按鍵。</p>
<button class="modal-button secondary" data-modal="hotkeys">熱鍵設定</button>
<p>每個指令可以設兩個按鍵。Esc 固定是選單與取消。</p>
${sec('存檔')}
<div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">完整備份</button>${simulating?'':'<button class="modal-button secondary" data-modal="backupImport">還原備份</button>'}</div>
${read('ash-backup-before-restore')?'<button class="modal-button secondary" data-modal="backupPrevious">下載還原前備份</button>':''}
${simulating?'<p>模擬中：完整備份保存的是原本的戰役；還原、單局匯出入與重置要先結束模擬。</p>':`<p>完整備份包含點數、解鎖、任務歷史與目前任務。下方僅匯出／匯入單局任務。</p>
<div class="modal-row"><button class="modal-button secondary" data-modal="export">匯出任務</button><button class="modal-button secondary" data-modal="import">匯入任務</button></div>`}
${TEST_MODE?`${sec('測試：操作紀錄')}<div class="modal-row"><button class="modal-button secondary" data-modal="replayLoad">播放操作紀錄</button><button class="modal-button secondary" data-modal="replayFast">快速播放</button></div>
<div class="modal-row"><button class="modal-button secondary" data-modal="recordStart" ${runIsLive()&&!simulating?'':'disabled'}>從現在開始記錄</button><button class="modal-button secondary" data-modal="recordDownload" ${recording?.game===game?'':'disabled'}>下載操作紀錄</button></div>
<p>只在測試模式出現。操作紀錄來自 tools/text-play.mjs 或這裡的記錄；播放時畫面照常演出，每一步都和紀錄的狀態比對，不同就暫停。播放中不接受操作，左下角可以暫停或停止，停止後可以接手玩。</p>`:''}
${sec('紀錄')}
<button class="modal-button secondary" data-modal="journal">幹員狀態、任務紀錄與敵人圖鑑</button>
${simulating?`${sec('模擬')}<button class="modal-button secondary" data-modal="mission">模擬說明</button><button class="modal-button secondary" data-modal="khMenu">結束模擬</button>`:inRun?`${sec('本局')}<button class="modal-button secondary" data-modal="mission">任務簡介</button><button class="modal-button secondary" data-modal="abandon" ${game.status!=='playing'?'disabled':''}>放棄本局（保留永久進度）</button><button class="modal-button secondary" data-modal="restart">重新部署新任務</button>`:''}
${simulating?'':`${sec('危險')}
<button class="modal-button secondary" data-modal="resetProgress">重置遊戲進度</button>`}
<button class="modal-button" data-modal="close">${inRun?simulating?'繼續模擬 →':'繼續任務 →':'← 返回主選單'}</button>`);
}
// The result sheet reports on a run that is over, so it belongs to the title flow as well (3.98.1, user request):
// full screen and back up at the top, not a bottom sheet with the finished battle showing above it. 查看最後戰場
// is still how you look at the map.
function showResult(){titleFlow=true;if(isSimulation(game)){showSimulationResult();return;}const won=game.status==='won',abandoned=game.status==='abandoned',p=game.player,copy=resultCopy(game);modal(`<div class="eyebrow">${copy.eyebrow} / RUN ${game.seed}${game.realMode?' / REAL':''}</div><h2>${copy.title}</h2><p>${copy.body}</p><p>${game.missionSummary}</p>${purgeReportMarkup(game)}${resultStoriesMarkup(game,profile())}${isEndless(game)?`<div class="result-stats"><div><b>${pad(game.floor)}</b>到達深度</div><div><b>${pad(p.level)}</b>等級</div><div><b>${p.kills}</b>消滅敵人</div></div>${endlessResult(p,abandoned)}<p>行動 ${game.turn} 回合</p>`:`<div class="result-stats"><div><b>${pad(game.deepestFloor)}</b>最深樓層</div><div><b>${p.kills}</b>消滅敵人</div><div><b>${game.turn}</b>行動回合</div></div>`}<p>${game.realMode?`真實模式 · 本次協定點數 +${protocolSettlement(game).base}，真實加成 +${protocolSettlement(game).bonus}`:`本次協定點數 +${game.protocol.earned}`} · 累計持有 ${profile().protocol.balance}<br>死亡仍保留，可在 UNLOCKS 解鎖職業與設施紀錄。</p><div class="operator-identity result-identity">${portraitMarkup(p.portrait,game.status)}<p>${characterName(p.character)}<br>總傷害 ${p.stats.damage} · 投擲 ${p.stats.grenades} · 資料 ${p.lore.length}/6</p></div><div class="modal-footer"><button class="modal-button secondary" data-modal="lastBattle">查看最後戰場</button>${game.status==='dead'?'<button class="modal-button secondary" data-modal="deploy">重新部署</button><button class="modal-button" data-modal="redeploySame">繼續投入幹員</button>':'<button class="modal-button" data-modal="deploy">重新部署 →</button>'}</div>`);}
// Kill house sessions (docs/KILLHOUSE.md section 10). A simulation replaces the game on screen without abandoning or
// saving the campaign; leaving puts the stashed campaign back exactly as it was.
let simulationReturn=null;const simulationResults=new WeakMap();
function startSimulation(options){
  if(options.mode==='arcade'&&!availableCharacters(profile()).includes(options.character||'soldier')){notify('職業尚未解鎖。');return;}
  let next;try{next=startKillhouse(options);}catch(error){notify(error.message,{danger:true});return;}
  if(!isSimulation(game))simulationReturn={game,entered,resumable};
  game=next;entered=true;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();
}
function exitSimulation(){
  if(!isSimulation(game))return;
  const saved=simulationReturn?null:loadGame();
  ({game,entered,resumable}=simulationReturn||{game:saved||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),entered:false,resumable:Boolean(saved)});
  simulationReturn=null;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();cancelAim();lastStatus=game.status;previousFloor=game.floor;update();
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
function newGame(seed,character,mission,options={facilityFaction:'random'}){if(isSimulation(game))exitSimulation();const portrait=deploymentFaces[character];if(!availableCharacters(profile()).includes(character)||!validCharacter(character)||!validPortrait(portrait)||!validMissionId(mission)){notify('請選擇有效角色。');return;}if(game.status==='playing'&&(entered||resumable)){try{abandonRun(game);}catch(error){backupError(error);return;}}entered=true;resumable=false;game=startCampaign({seed,character,portrait,mission,options});playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();floorToast();}
function exportSave(){const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ash-protocol-${game.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('存檔已匯出。');}
function downloadJSON(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Layout editor (3.102.0, user request): tap one cell then another and they swap, which reaches any arrangement
// without a function picker. Only 格狀 is editable, because only its cells are interchangeable.
function showDeckEditor(message=''){
  const cells=deckLayout.map((id,index)=>`<button class="deck-slot${deckPick===index?' picked':''}${id?'':' empty'}" data-slot="${index}" aria-pressed="${deckPick===index}" aria-label="${index+1} \u865f\u4f4d\u7f6e\uff1a${id?DECK_LABELS[id]:'\u7a7a\u683c'}"><span class="deck-slot-icon" aria-hidden="true">${id?DECK_GLYPHS[id]:'\u00b7'}</span><span>${id?DECK_LABELS[id]:'\u7a7a\u683c'}</span></button>`).join('');
  modal(`<div class="eyebrow">CONTROL DECK / LAYOUT</div><h2>\u7de8\u8f2f\u6309\u9215\u4f4d\u7f6e</h2>
<p>\u9ede\u4e00\u683c\uff0c\u518d\u9ede\u53e6\u4e00\u683c\uff0c\u5169\u8005\u4e92\u63db\u3002\u8ddf\u7a7a\u683c\u4e92\u63db\u5c31\u662f\u628a\u6309\u9215\u642c\u904e\u53bb\u3002\u6539\u5b8c\u95dc\u9589\u5c31\u80fd\u770b\u5230\u7d50\u679c\u3002</p>
<div class="deck-editor">${cells}</div>
${message?`<p>${message}</p>`:''}
<div class="modal-row"><button class="modal-button secondary" data-modal="deckMirror">\u5de6\u53f3\u93e1\u50cf</button><button class="modal-button secondary" data-modal="deckReset">\u9084\u539f\u9810\u8a2d</button></div>
<button class="modal-button secondary" data-modal="settings">\u2190 \u8fd4\u56de\u8a2d\u5b9a</button>`);
}
function saveDeckLayout(){write('ash-deck-layout',JSON.stringify(deckLayout));applyDeck();fitLayout();}
function pickDeckSlot(index){
  if(deckPick===null){deckPick=index;showDeckEditor();return;}
  if(deckPick===index){deckPick=null;showDeckEditor();return;}
  deckLayout=swapSlots(deckLayout,deckPick,index);deckPick=null;saveDeckLayout();showDeckEditor();
}
function backupError(error){modal(`<h2>備份操作未完成</h2><p>${escapeHTML(error.message)}</p><button class="modal-button" data-modal="backupCancel">返回設定</button>`);}
function adoptSnapshot(next){
  game=next.game?connectUnlocks(next.game):new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying);entered=Boolean(next.game);resumable=Boolean(next.game);
  playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();cancelAim();lastStatus='playing';previousFloor=game.floor;
  $('#modal').close();update();if(!entered)showIntro();
}
function applyBackup(){
  if(!pendingBackup)return;
  try{
    const next=restoreBackup(pendingBackup,game);pendingBackup=null;
    adoptSnapshot(next);notify('完整備份已還原；原資料可在設定下載。');
  }catch(error){backupError(error);}
}

$('#import-backup').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;pendingBackup=null;
  try{
    if(file.size>BACKUP_LIMIT)throw new Error('備份檔案超過 5 MB 限制。');
    const raw=await file.text(),next=previewBackup(raw),p=next.snapshot.profile;pendingBackup=raw;
    modal(`<div class="eyebrow">RESTORE BACKUP</div><h2>還原這份完整備份？</h2><p>${escapeHTML(file.name)}<br>${escapeHTML(new Date(next.snapshot.createdAt).toLocaleString('zh-TW'))}</p><p>協定點數：${profile().protocol.balance} → ${p.protocol.balance}<br>任務紀錄：${p.runs} 次 · 職業 ${p.unlocks.characters.length} · 紀錄 ${p.unlocks.stories?.length||0}<br>${next.game?`備份任務 ${next.game.seed} · 第 ${next.game.floor} 層 · ${next.game.turn} 回合`:'備份沒有進行中的任務，還原後可開始新任務。'}</p><p>點數、紀錄與目前任務會以備份快照替換。還原前會自動保存原資料，可回設定下載。</p><button class="modal-button" data-modal="backupConfirm">確認還原</button><button class="modal-button secondary" data-modal="backupCancel">取消</button>`);
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
    if(reason){showInventory('item',reason+'。');return;}
    if(entry.aim==='side'){close();startDeploy();return;}
    if(entry.aim==='throw'){close();startThrowAim(id);return;}
    modalAction(entry.action);return;}
  if(b.dataset.prepareCategory){
    const category=b.dataset.prepareCategory,id=b.dataset.prepareId||null;
    // Putting a wearable on or taking it off costs a turn, so it closes the pack and resolves like any other action.
    if(game.actionCost('prepare',{category,id})>0){modalAction('prepare',{category,id});return;}
    if(game.action('prepare',{category,id})){update();showInventory(category,id?'已預備，不耗回合。':'已取消預備，不耗回合。');$(`[data-inventory-tab="${category}"]`).focus({preventScroll:true});}return;
  }
  if(b.dataset.context){close();if(b.dataset.context.startsWith('objective:')){act('recoverObjective',b.dataset.context.slice(10));return;}if(b.dataset.context.startsWith('case:')){act('openContainer',b.dataset.context.slice(5));return;}if(b.dataset.context.startsWith('door:')){const door=game.nearbyDoors.find(d=>d.id===b.dataset.context.slice(5));if(door)act('door',{id:door.id,open:!door.open});}else if(b.dataset.context==='bag')showInventory('weapon');else if(b.dataset.context==='terminal')showTerminal();else if(b.dataset.context==='operator')recoverCorpse();else if(b.dataset.context==='exitStep'){if(exitStep(game))act('move',exitStep(game));}else act('interact');return;}
  if(b.dataset.move){move(...b.dataset.move.split(',').map(Number));return;}
  if(b.dataset.slot!==undefined){pickDeckSlot(Number(b.dataset.slot));return;}
  if(b.dataset.perk){game.choosePerk(b.dataset.perk);$('#modal').close();update();return;}
  if(b.dataset.equip!==undefined){modalAction('weapon',Number(b.dataset.equip));return;}
  // 3.136.0 (user decision): which melee weapon a bump uses is picked in the pack, like a prepared grenade; it is free.
  if(b.dataset.bump!==undefined){const slot=Number(b.dataset.bump);if(game.action('meleeChoice',slot)){update();showInventory('weapon',`撞擊時使用${game.weaponAt(slot).name}，不耗回合。`);}return;}
  if(b.dataset.compare!==undefined){showWeaponComparison(Number(b.dataset.compare),b.dataset.against===undefined?game.player.weapon:Number(b.dataset.against));return;}
  if(b.dataset.replace!==undefined){modalAction('replaceWeapon',{take:Number(b.dataset.replace),leave:Number(b.dataset.leave)});return;}
  if(b.dataset.take!==undefined){modalAction('takeWeapon',Number(b.dataset.take));return;}
  if(b.dataset.salvage!==undefined){const index=Number(b.dataset.salvage);modal(`<div class="eyebrow">SALVAGE WEAPON</div><h2>拆解${game.weaponAt(index).name}？</h2><p>回收彈匣內的備彈與廢料。武器將從背包移除，耗費 1 回合。</p><button class="modal-button" data-confirm-salvage="${index}">確認拆解</button><button class="modal-button secondary" data-modal="bag">返回背包</button>`);return;}
  if(b.dataset.salvageGround!==undefined){const slot=Number(b.dataset.salvageGround),level=game.player.upgrades[slot]||0;
    modal(`<div class="eyebrow">SALVAGE ON SITE</div><h2>就地拆解${game.weaponAt(slot).name}？</h2><p>不撿起來，直接在原地拆掉：回收彈匣內的 ${game.player.ammo[slot]} 發與 ${salvageValue(game.player,slot)} 廢料，武器消失，耗費 1 回合。</p><button class="modal-button" data-confirm-salvage-ground="${slot}">確認拆解</button><button class="modal-button secondary" data-modal="bag">返回背包</button>`);return;}
  if(b.dataset.confirmSalvageGround!==undefined){modalAction('salvageGround',Number(b.dataset.confirmSalvageGround));return;}
  if(b.dataset.confirmSalvage!==undefined){modalAction('salvage',Number(b.dataset.confirmSalvage));return;}
  if(b.dataset.feedOption){modalAction('feedPet',{optionId:b.dataset.feedOption});return;}
  if(b.dataset.feedWeapon!==undefined){const slot=Number(b.dataset.feedWeapon),w=game.weaponAt(slot),q=petFeedQuote(game,{optionId:'weapon',weaponSlot:slot});
    modal(`<div class="eyebrow">FEED WEAPON</div><h2>把${w.name}餵給獵獸？</h2><p>武器會從背包移除，彈匣內的 ${game.player.ammo[slot]} 發退回備彈（超過上限的留在地上），不給廢料。砲台成長 +${q.gain}${q.overflow?`（超出 ${q.overflow} 不計）`:''}，耗費 1 回合。</p><button class="modal-button" data-confirm-feed-weapon="${slot}">確認餵食</button><button class="modal-button secondary" data-inventory-tab="skill">返回背包</button>`);return;}
  if(b.dataset.confirmFeedWeapon!==undefined){modalAction('feedPet',{optionId:'weapon',weaponSlot:Number(b.dataset.confirmFeedWeapon)});return;}
  if(b.dataset.petOutput){const kind=b.dataset.petOutput,reason=outputChoiceReason(game,{kind});if(reason){showInventory('skill',reason+'。');return;}
    if(game.action('setPetOutput',{kind})){update();showInventory('skill',`排出種類改為${GRENADES[kind].name}，不耗回合。`);}return;}
  if(b.dataset.learn){const id=b.dataset.learn,entry=LEARNING_ITEMS[id];if(game.action('learn',id)){persist();update();showInventory('item',`已學會${(entry?.name||'').replace('學習資料','')}，${entry?.trait?'立即生效':'到技能分頁預備後使用'}。不耗回合。`);}else showInventory('item');return;}
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
  if(b.dataset.hotkeyReset!==undefined){saveHotkeys(defaultBindings());showHotkeys('已恢復預設按鍵。');return;}
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
      if(!validCharacter(character)){notify('請選擇有效幹員。');return;}
      if(validOperatorColor(color)){renderer.operatorColor=color;write('ash-operator-color',color);}
      newGame(deployDraft.seed,character,deployDraft.mission,deployDraft.retry);break;}
    case 'abandon':modal('<h2>放棄本局？</h2><p>結束目前任務，保留已賺的協定點數、解鎖與紀錄。這不算成功撤離。確認前會自動保存完整備份。</p><button class="modal-button" data-modal="abandonConfirm">確認放棄本局</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'abandonConfirm':try{if(abandonRun(game)){cancelAim();update();}}catch(error){backupError(error);}break;
    case 'resetProgress':modal('<h2>重置遊戲進度？</h2><p>清除目前任務、全部協定點數、解鎖與任務紀錄，從零開始。只影響目前正式／測試區。</p><p>會先保存完整備份，之後可在設定下載「還原前備份」。音效與瞄準偏好不變；再次放棄任務、還原或重置會覆寫這份備份，請先下載留存。</p><button class="modal-button secondary" data-modal="backupExport">先下載目前完整備份</button><button class="modal-button" data-modal="resetConfirm">確認清空遊戲進度</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'resetConfirm':try{adoptSnapshot(resetProgress(game));notify('遊戲進度已重置；原資料可從設定下載。');}catch(error){backupError(error);}break;
    case 'settings':settings();break;
    case 'deckEditor':deckPick=null;showDeckEditor();break;
    case 'deckMirror':deckLayout=mirrorDeck(deckLayout);deckPick=null;saveDeckLayout();showDeckEditor('\u5df2\u5de6\u53f3\u93e1\u50cf\u3002');break;
    case 'deckReset':deckLayout=[...DECK_GRID];deckPick=null;saveDeckLayout();showDeckEditor('\u5df2\u9084\u539f\u9810\u8a2d\u3002');break;
    case 'padLayout':padLayout=DECK_LAYOUTS[(DECK_LAYOUTS.indexOf(padLayout)+1)%DECK_LAYOUTS.length];write('ash-pad-layout',padLayout);applyDeck();fitLayout();settings();break;
    case 'padCell':padCell=PAD_SIZES[(PAD_SIZES.indexOf(padCell)+1)%PAD_SIZES.length];write('ash-pad-cell',String(padCell));applyDeck();fitLayout();settings();break;
    case 'audioGrit':{const order=Object.keys(GRIT_LEVELS),next=order[(order.indexOf(audio.grit)+1)%order.length];audio.setGrit(next);write('ash-audio-grit',next);settings();break;}
    case 'vhs':vhsFilter=!vhsFilter;write('ash-vhs',vhsFilter?'on':'off');document.documentElement.classList.toggle('vhs',vhsFilter);settings();break;
    case 'transmission':transmissionSeen=transmissionKey();showPerks();break;
    case 'hotkeyHints':hotkeyHints=!hotkeyHints;write('ash-hotkey-hints',hotkeyHints?'on':'off');applyHotkeyHints();settings();break;
    case 'hotkeys':showHotkeys();break;
    case 'frameRate':renderer.frameRate=nextFrameRate(renderer.frameRate);write('ash-frame-rate',String(renderer.frameRate));settings();break;
    case 'skipPresentation':skipPresentation=!skipPresentation;write('ash-skip-presentation',skipPresentation?'on':'off');settings();break;
    case 'movementBoundaries':renderer.movementBoundaries=!renderer.movementBoundaries;write('ash-movement-boundaries',renderer.movementBoundaries?'on':'off');settings();break;
    case 'sound':audio.setEnabled(!audio.enabled);write('ash-sound',audio.enabled?'on':'off');syncMusic();settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify('完整備份已匯出。');}catch(error){backupError(error);}break;
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
    case 'khSkip':if(!saveTutorialOutcome('skipped'))notify('無法寫入略過紀錄，下次部署仍會詢問。',{danger:true});showDeployment();break;
    case 'deployNormal':deployDraft={mode:'normal',mission:null,seed:undefined};showDeployMission();break;
    case 'deployOperator':{const value=$('#new-seed')?.value,seed=value!==undefined&&value!==''?Number(value):undefined;
      if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>999999999)){const advanced=$('.seed-advanced');if(advanced)advanced.open=true;notify('種子需為 0–999999999 的整數。');return;}
      const mission=$('input[name="mission"]:checked')?.value;
      if(!validMissionId(mission)){notify('請選擇有效任務。');return;}
      deployDraft={mode:'normal',mission,seed};showDeployOperator();break;}
    case 'deployDaily':{const seed=dailySeed();deployDraft={mode:'daily',mission:dailyMission(seed,MISSION_IDS),seed};showDeployOperator();break;}
    case 'deployQuick':if(runIsLive()){modal('<div class="eyebrow">QUICK GAME</div><h2>放棄目前任務？</h2><p>快速任務會立即隨機決定任務、種子與幹員並開始。已賺點數與永久進度保留。</p><button class="modal-button" data-modal="deployQuickStart">確認放棄並開始 →</button><button class="modal-button secondary" data-modal="deploy">← 返回</button>');}else startQuick();break;
    case 'deployQuickStart':startQuick();break;
    case 'deployDifficulty':{const character=$('input[name="character"]:checked')?.value,color=$('input[name="operator-color"]:checked')?.value;
      if(!validCharacter(character)){notify('請選擇有效角色。');return;}
      deployDraft={...deployDraft,character,color:validOperatorColor(color)?color:deployDraft.color};showDeployDifficulty();break;}
    case 'deployBackOperator':deployDraft={...deployDraft,difficulty:$('input[name="difficulty"]:checked')?.value,realMode:Boolean($('input[name="real-mode"]')?.checked),facility:$('input[name="facility"]:checked')?.value};showDeployOperator();break;
    case 'new':{const {character,color}=deployDraft,options=runOptions({difficulty:$('input[name="difficulty"]:checked')?.value,realMode:Boolean($('input[name="real-mode"]')?.checked),facility:$('input[name="facility"]:checked')?.value});
      if(validOperatorColor(color)){renderer.operatorColor=color;write('ash-operator-color',color);}
      if(!validMissionId(deployDraft.mission)){notify('請先選擇任務。');showDeployment();return;}
      newGame(deployDraft.seed,character,deployDraft.mission,options);break;}
  }return;}
  switch(b.dataset.action){
    case 'mission':showMission();break;case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'settings':settings();break;case 'bag':showInventory();break;case 'terminal':showTerminal();break;
    case 'item':useItem();break;case 'skill':skill();break;case 'saveWarning':showSaveWarning();break;
    case 'toggleTargeting':toggleTargeting();break;case 'cycleTarget':cycleTarget();break;case 'grenade':grenade();break;case 'cancelAim':cancelAim();break;case 'fire':fireWeapon();break;
    case 'zoomIn':zoomBy(.15);break;
    case 'zoomOut':zoomBy(-.15);break;
    case 'center':centerCamera();break;
    default:act(b.dataset.action);
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
  if(renderer.mode==='grenade'||renderer.mode==='launch'||renderer.mode==='flare'||renderer.mode==='rope'){setAim(pos);return;}
  if(renderer.mode==='suppress'){setSuppressAim(pos);return;}
  const ally=game.localAllies.find(a=>distance(a,pos)===0);if(ally){notify(`${allyName(ally)} · ${ally.status==='reforming'?'消散，重生倒數中':ally.status==='arriving'?'等候落點':ally.status==='destroyed'?'已毀':`HP ${ally.hp}/${ally.maxHp}${repairTargets(game).includes(ally)?' · 在你旁邊，可以打開工坊修理':''}${ally.kind==='drone'?(ally.payload?` · 裝填${GRENADES[ally.payload].name}`:['unit_bomber','unit_warden','unit_boss'].includes(ally.sourceId)?(ally.primed?(ally.sourceId==='unit_bomber'?' · 蓄勢中，下次行動自爆':' · 蓄力中，下次行動射擊'):ally.bombard?' · 下次攻擊改為轟炸':''):` · ${Number.isInteger(ally.weapon)?game.weaponAt(ally.weapon).name+' · ':''}彈藥 ${ally.ammo}/${allyWeapon(ally,game.player).mag}`):''}`}。`);return;}
  const edge=renderer.hitBarrier(e.clientX-r.left,e.clientY-r.top);
  if(edge){game.target=edge.id;if(!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const supply=game.props.find(o=>isContainer(o)&&!o.opened&&distance(o,pos)===0&&game.visible(o));
  if(supply){notify(`${containerName(supply)}：${game.canTouch(supply)?'按右下互動開啟（1 回合）':'靠近後以右下互動開啟'}。`);return;}
  const corpse=game.operatorCorpse;if(corpse&&!corpse.recovered&&!isSimulation(game)&&distance(pos,corpse)===0&&game.visible(corpse)){if(operatorReady(game))recoverCorpse();else notify(`${CHARACTERS[corpse.character]?.label||'幹員'}的遺體：靠近後按右下互動回收識別資料，不耗回合。`);return;}
  if(distance(pos,game.exitPoint)===0&&game.canTouch(pos)&&(!isSimulation(game)||exitStep(game))){if(isSimulation(game))act('move',exitStep(game));else act('interact');return;}
  if(game.props.some(o=>o.type==='terminal'&&!o.used&&distance(o,pos)===0&&game.canTouch(o))){showTerminal();return;}
  if(distance(pos,game.player)===1)move(pos.x-game.player.x,pos.y-game.player.y);
  else notify('點相鄰格移動，或在戰場滑動一步。');
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
  game=start.game;entered=true;resumable=false;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();cancelAim();lastStatus=game.status;previousFloor=game.floor;
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
if(TEST_MODE)globalThis.__ashReplay={load:(raw,options)=>loadReplay(typeof raw==='string'?raw:JSON.stringify(raw),options),
  pause(){if(replay){replay.paused=true;replayBadge();}},resume(){if(replay){replay.paused=false;replayBadge();}},stop:()=>stopReplay(),record:startRecording,hash:()=>stateHash(game),
  get state(){return replay?{index:replay.index,total:replay.log.ops.length,paused:replay.paused,fast:replay.fast,mismatch:replay.mismatch}:{done:replayResult};},
  get recording(){return recording?.game===game?recording.log:null;}};
$('#import-save').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>1000000)throw new Error('存檔超過大小限制。');const imported=Game.restore(await file.text());if(!imported)throw new Error('存檔格式不相容或任務已結束。');const kept=write('ash-save-before-import',game.serialize());game=connectUnlocks(imported);entered=true;resumable=true;game.setCarryLevel(profile().upgrades.carrying);playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];renderer.callouts.clear();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();notify(kept?'存檔已匯入；原進度已在本機備份。':'存檔已匯入；原進度的本機備份沒有寫入成功。'); }catch(error){modal('<h2>無法匯入存檔</h2><p>'+escapeHTML(error.message)+'</p><button class="modal-button" data-modal="close">返回戰場</button>');}e.target.value='';
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
