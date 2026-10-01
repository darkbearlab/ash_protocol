// Comms and scenes: the controller's channel (queue, cards, stored records), the training course's beats, comms
// events, boss intro and kill scenes, the killed-in-action scene and the end-of-run outro.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {t} from './i18n.js';
import {STORIES} from './story-data.js';
import {GLITCH_TUNING} from './signal-glitch.js';
import {storyText} from './story-text.js';
import {isSimulation} from './engine.js';
import {armComms,commsForLogs,commsLine,commsMarkup,dutySpeaker} from './comms.js';
import {KIA_TUNING,kiaBurst,kiaSeconds,kiaTimeScale,kiaTimes,kiaZoom} from './kia.js';
import {BOSS_SCENE_TUNING,bossIntroLines,bossKillLine,deathBurst,deathCamera,deathTimeScale,deathTimes,firstBossScene,frontOfQueue,introCamera,introDone,newBossSceneMemory} from './boss-scenes.js';
import {OUTRO_TUNING,outroPlan} from './outro.js';
import {burstLife} from './gore.js';
import {commsEvents,newCommsMemory} from './comms-events.js';
import {courseActive,courseCardClosed,courseDeathLines,takeCourseBeats} from './course.js';
import {COURSE_EXTRACT_LINE} from './course-script.js';
import {courseCardMarkup} from './course-ui.js';
import {EXTRACTION_BEAM} from './render.js';
import {$,commsBefore,commsLayer,commsMemory,entered,game,modal,outroShade,playback,renderer,replay,setCommsMemory} from './controller.js';
import {update} from './controller-hud.js';
import {showResult} from './controller-screens.js';
export let kia=null,bossScene=null,bossSceneMemory=null;
const commsQueue=[];
let commsRound=0,commsShownAt=0;
export function sayComms(message){commsQueue.push(message);if(commsQueue.length===1)showNextComms();}
// One box at a time: a line already on the bar is never shown again. (3.198.0: a `then` that says the next line itself —
// the training course — used to have that line armed twice, and the spare timer cleared the line after it early.)
function showNextComms(){
  const message=commsQueue[0],round=commsRound;if(message===undefined||commsLayer.firstElementChild)return;
  commsLayer.innerHTML=commsMarkup(message,{context:{game},compact:true});commsShownAt=performance.now();message?.shown?.();   // shown: 3.204.0, a boss intro's clock
  armComms(commsLayer.querySelector('.comms'),()=>{if(round!==commsRound)return;commsLayer.innerHTML='';commsQueue.shift();message?.then?.();showNextComms();},{tap:message?.tap!==false});
}
// A message's `then` runs when its box has closed (3.177.0, the end of a run).
// Drops whatever is showing or waiting; a box already closing finishes quietly (3.174.0).
function clearComms(){commsRound++;commsQueue.length=0;commsLayer.innerHTML='';}
function sayCommsFor(entries){for(const message of commsForLogs(entries))sayComms(message);}
// 3.204.0 (review): a boss intro goes to the front of the queue (src/boss-scenes.js frontOfQueue): the line on the bar
// gives way at once (its `then` still runs) and the waiting ones follow the intro in their order.
function sayCommsFirst(message){
  const showing=Boolean(commsLayer.firstElementChild),{queue,dropped}=frontOfQueue(commsQueue,message,showing);
  commsRound++;commsLayer.innerHTML='';commsQueue.splice(0,commsQueue.length,...queue);dropped?.then?.();showNextComms();
}
// The training course (3.198.0, src/course.js): its beats play in order on the comms bar. A card opens as soon as the
// line before it starts, and the comms bar stays where it is at the top of the screen, drawn above the card, so the
// conversation keeps going (user, 2026-09-27: the card must not swallow the dialogue; it stays at the top edge). Input waits while a card is still to come, so the lesson and the floor stay
// in step.
export let courseQueue=[],courseBusy=false,courseCard=null,courseWaiting=false;
export const courseHolds=()=>courseBusy&&courseQueue.some(item=>item.card);
function resetCourse(){courseQueue=[];courseBusy=false;courseCard=null;courseWaiting=false;if(commsLayer.parentElement!==$('.battle-header'))$('.battle-header').append(commsLayer);}
export function playCourse(){if(!courseActive(game))return;for(const beat of takeCourseBeats(game))courseQueue.push(...beat.items);if(!courseBusy)courseNext();}
export function courseNext(){
  if(!courseActive(game)||game.status!=='playing'){resetCourse();return;}
  const item=courseQueue[0];if(!item){courseBusy=false;return;}courseBusy=true;
  // A card never replaces a menu the player opened (settings, the map): it waits for that menu to close.
  if(item.card&&$('#modal').open){courseWaiting=true;return;}
  courseQueue.shift();
  if(item.say){
    // A line with a card after it opens the card at once and plays on top of it; the card's close carries on.
    if(courseQueue[0]?.card){sayComms(item.say);courseNext();return;}
    sayComms({...item.say,then:courseNext});return;
  }
  courseCard={id:item.card};modal(courseCardMarkup(item.card,0));commsOnCard(true);
}
// While a card is open the comms bar joins the dialog (the only way above its backdrop) but is pinned to the header's
// own place on screen, so it never moves; it goes back to the header when the card closes.
function commsOnCard(on,box=null){
  const header=$('.battle-header'),host=on?$('#modal'):header;
  if(on){const r=box||header.getBoundingClientRect();commsLayer.style.setProperty('--comms-top',`${r.top}px`);commsLayer.style.setProperty('--comms-left',`${r.left}px`);commsLayer.style.setProperty('--comms-width',`${r.width}px`);}
  else for(const k of ['--comms-top','--comms-left','--comms-width'])commsLayer.style.removeProperty(k);
  if(commsLayer.parentElement===host)return;
  // Moving a node restarts its CSS animations (and a closed dialog has already dropped them): the countdown line carries
  // on from the time its line has been up.
  if(on)host.prepend(commsLayer);else host.append(commsLayer);
  const bar=commsLayer.querySelector('.comms-timer')?.getAnimations?.()[0];if(bar)bar.currentTime=performance.now()-commsShownAt;
}
// 3.200.0 (user): opening a facility record to read it (the archive, or the field journal) plays the controllers'
// remarks on the comms bar, pinned to the top of the screen across the record window; a tap moves to the next line.
// Opening another record starts its remarks instead; closing the record, or the window showing anything else, stops them.
export let recordComms=null;
export function playRecordComms(id){
  const story=STORIES.find(s=>s.id===id),lines=story?storyText(story).comms:[];
  if(!lines.length||courseCard)return;
  clearComms();recordComms=id;
  // Just above the window when there is room for the bar, otherwise over its top edge; never above the header's place.
  const h=$('.battle-header').getBoundingClientRect(),r=$('#modal-content').getBoundingClientRect();commsOnCard(true,{top:Math.max(h.top,r.top-46),left:r.left,width:r.width});
  for(const line of lines)sayComms(line);
}
export function endRecordComms(){if(recordComms===null)return;recordComms=null;clearComms();commsOnCard(false);}
export function closeCourseCard(){const id=courseCard?.id;if(!id)return;courseCard=null;if($('#modal').open)$('#modal').close();commsOnCard(false);courseCardClosed(game,id);playCourse();courseNext();}
export function sayCommsEvents(entries){
  if(game.status!=='playing')return;   // 3.174.0: a death has its own scene; the last turn's alerts stay quiet
  sayCommsFor(entries);
  if(!entered||isSimulation(game))return;
  if(commsMemory?.runId!==game.runId)setCommsMemory(newCommsMemory(game.runId));
  const speaker=dutySpeaker({game});
  // 3.204.0: a boss seen for the first time plays its intro (src/boss-scenes.js) ahead of this action's other remarks.
  const intro=event=>Boolean(event.actor),events=commsEvents({game,before:commsBefore,logs:entries,memory:commsMemory}).sort((a,b)=>Number(intro(b))-Number(intro(a)));
  for(const event of events){if(intro(event)){startBossIntro(event,speaker);continue;}const message=commsLine(speaker,event.type,event.vars);if(message)sayComms(message);}
}
// Killed in action (3.174.0, user design; docs/STORY.md 8; timing and burst in src/kia.js). It starts when the
// operative's fall plays: the world freezes and slows (renderer.pace), the camera pushes in, blood and light burst
// away from the killing blow. Once the body is down the officer on duty calls for the operative on the header bar —
// the call cannot be tapped away — and only when it ends does the run's end go on (src/outro.js: the dark screen, the
// loss report, then the results). The kill house and replays play
// the scene without voices. The result itself was recorded when the operative died. (`kia` is declared with the
// game state at the top.)
export function startKia(fall){
  bossScene=null;   // 3.204.0: your own fall wins over a boss's
  clearComms();resetCourse();
  // 3.198.0: the training course voices its deaths (src/course.js courseDeathLines); the rest of the kill house stays quiet.
  const quiet=Boolean(replay)||isSimulation(game)&&!courseActive(game),seed=(Number(game.seed)||0)*31+game.turn;
  kia={start:performance.now(),times:kiaTimes(),quiet,voiced:false,resultAt:Infinity,resultPending:false,shown:false};
  renderer.kia={start:renderer.time,at:{x:fall.to.x,y:fall.to.y},blow:fall.blow||null,burst:kiaBurst(seed,fall.blow||null),frozen:true};
  renderer.pace=()=>{if(!kia)return null;const since=performance.now()-kia.start;renderer.kia.frozen=since<KIA_TUNING.freezeMs;return {scale:kiaTimeScale(since),zoom:kiaZoom(since,kia.times.voiceAt)};};
}
export function kiaTick(){
  if(!kia||kia.shown)return;
  const since=performance.now()-kia.start;
  if(!kia.voiced&&since>=kia.times.voiceAt){
    kia.voiced=true;
    // The course's controllers talk it over (lines can be tapped on); the results wait for the last one to close.
    const lines=!kia.quiet&&courseActive(game)?courseDeathLines(game):null,k=kia;
    if(lines?.length)lines.forEach((m,i)=>sayComms(i===lines.length-1?{...m,then:()=>{if(kia===k)k.resultAt=performance.now()-k.start;}}:m));
    else{
    const message=kia.quiet||lines?null:commsLine(dutySpeaker({game}),'kia');
    if(message){const seconds=kiaSeconds(t(message.line,message.vars));sayComms({...message,seconds,tap:false});kia.resultAt=since+seconds*1000+KIA_TUNING.closeMs;}
    else kia.resultAt=since;
    }
  }
  if(since>=kia.resultAt&&kia.resultPending&&!playback){kia.shown=true;renderer.pace=null;renderer.kia.frozen=false;endRun();}
}
// A new run, a loaded save or a replay clears the scene; the fallen body and the blood stay until then, so the last
// battlefield still shows them.
// Boss scenes (3.204.0, user 2026-09-29; docs/BOSSES.md sections 5-6; timings and lines in src/boss-scenes.js). The intro
// starts from the comms `boss` event and ends when the officer's line has closed and the camera has slid back; the kill
// starts when the boss's fall plays and runs on its own clock. Both drive the camera through renderer.pace (a focus tile
// and how far to slide onto it), lock the controls while they play, and play once per boss. Reduced motion keeps the
// lines only. The kill house plays them without voices; a replay (test mode) skips them, so a fast replay never waits.
// (`bossScene` and `kia` are declared at the top of this file.)
const sceneMemory=()=>{if(bossSceneMemory?.runId!==game.runId)bossSceneMemory=newBossSceneMemory(game.runId);return bossSceneMemory;};
function endBossScene(){if(!bossScene)return;bossScene=null;if(!kia)renderer.pace=null;update();}   // update: a level-up held back by the scene
// 3.207.0: a delisted operative's intro is two lines (its serial, then its class): the camera starts with the first on
// the bar and slides back only once the last has closed.
function startBossIntro(event,speaker){
  const actor=event.actor;if(!actor||!firstBossScene(sceneMemory(),'intro',actor.id))return;
  const messages=bossIntroLines(speaker,actor.type,event.vars);
  if(renderer.reduceMotion||replay||kia||bossScene||$('#modal').open){for(const m of messages)sayComms(m);return;}   // a window already open: the lines only
  // The clock (slide, hold, failsafe) runs from when her line is on the bar (`start`), not from the event (3.204.0 review).
  const scene={kind:'intro',start:null,created:performance.now(),at:{x:actor.x,y:actor.y},endAt:Infinity};bossScene=scene;
  renderer.pace=()=>{if(bossScene!==scene)return null;const cam=scene.start===null?{blend:0,zoom:1}:introCamera(performance.now()-scene.start,scene.endAt);return {scale:1,zoom:cam.zoom,focus:scene.at,blend:cam.blend};};
  const shown=()=>{if(bossScene===scene&&scene.start===null)scene.start=performance.now();};
  const then=()=>{if(bossScene!==scene||scene.endAt!==Infinity)return;scene.start??=performance.now();scene.endAt=performance.now()-scene.start;};
  if(messages.length)sayCommsFirst(messages.map((m,i)=>({...m,...(i===0?{shown}:{}),...(i===messages.length-1?{then}:{})})));
  else{scene.start=performance.now();scene.endAt=BOSS_SCENE_TUNING.intro.quietMs;}
}
export function startBossDeath(fall){
  if(kia||game.status!=='playing'||!firstBossScene(sceneMemory(),'death',fall.actorId))return;   // you fell this turn too: yours plays
  if(bossScene)return;   // 3.204.0 review: a second boss down in the same action; the first one's scene (and line) covers both
  // 3.207.0: a delisted operative's line confirms it destroyed by its serial (src/boss-scenes.js bossKillLine).
  const dead=game.enemies.find(e=>e.id===fall.actorId)||null,quiet=Boolean(replay)||isSimulation(game),message=quiet?null:bossKillLine(dutySpeaker({game}),!game.exitBlocked,{},dead);
  if(renderer.reduceMotion||replay){if(message)sayComms(message);return;}
  const scene={kind:'death',start:performance.now(),times:deathTimes(),at:{x:fall.to.x,y:fall.to.y},message,voiced:false};bossScene=scene;
  const seed=((Number(game.seed)||0)*53+game.turn*7+fall.to.x*31+fall.to.y)|0,burst=renderer.gore?deathBurst(seed,fall.blow||null,fall.gore||'flesh',renderer.goreLevel):null;
  if(burst)renderer.gore.push({start:renderer.time,at:{...scene.at},burst,life:burstLife(burst)*1000});
  renderer.pace=()=>{if(bossScene!==scene)return null;const since=performance.now()-scene.start,cam=deathCamera(since,scene.times);return {scale:deathTimeScale(since),zoom:cam.zoom,focus:scene.at,blend:cam.blend};};
}
export function bossSceneTick(){
  const s=bossScene;if(!s)return;
  if(s.kind==='intro'&&s.start===null){if(performance.now()-s.created>BOSS_SCENE_TUNING.intro.maxMs)endBossScene();return;}   // her line never came up
  const since=performance.now()-s.start;
  if(s.kind==='intro'){if(introDone(since,s.endAt))endBossScene();return;}
  if(!s.voiced&&since>=s.times.voiceAt){s.voiced=true;if(s.message)sayComms(s.message);}
  if(since>=s.times.endAt)endBossScene();
}
export function resetKia(){bossScene=null;kia=null;renderer.kia=null;renderer.pace=null;renderer.gore=[];renderer.splatter.reset();renderer.corpses?.reset();endOutro();resetCourse();}
// The end of a run in three parts (3.177.0, user design; src/outro.js, docs/STORY.md 8): the officer approves the
// extraction on the header bar (for a death the scene above has played instead), the field fades to dark, she speaks
// in the middle of the screen — and when the purge review finds the unit deficient the overseer cuts in with a silence
// — then the results. The result was recorded when the run ended; each part checks that this run's end is still the
// one playing, so a new run or the results opened another way stop it.
let outro=null;
export function endOutro(){outro=null;outroShade.classList.remove('on');renderer.extraction=null;}
export const ending=()=>Boolean(outro)||Boolean(kia&&!kia.shown);
export function endRun(){
  if(isSimulation(game)){if(courseActive(game)&&game.status==='won')courseExtraction();else showResult();return;}
  const round={plan:outroPlan(game,{voiced:!replay})};outro=round;
  const darken=()=>{if(outro!==round)return;outroShade.classList.add('on');setTimeout(()=>outroChannel(round,0),OUTRO_TUNING.darkMs);};
  // 3.194.0 (user): a won run is lifted out in a beam of light first (renderer.extractionBeam); the dark waits for it.
  // 3.195.0: on the beam's own clock (the renderer's world time), so a slow or stalled frame never cuts it short; a
  // stalled page (hidden) still moves on after a few seconds.
  if(game.status==='won')renderer.extraction={start:renderer.time,at:{x:game.player.x,y:game.player.y}};
  const began=performance.now(),afterBeam=()=>{const x=renderer.extraction;if(outro!==round)return;if(!x||renderer.time-x.start>=EXTRACTION_BEAM.total||performance.now()-began>EXTRACTION_BEAM.total+5000)darken();else setTimeout(afterBeam,80);};
  clearComms();
  if(round.plan.field)sayComms({...round.plan.field,then:afterBeam});else afterBeam();
}
// 3.198.0: the training course ends in the extraction beam too, with Wren's line under it, then straight to the results.
function courseExtraction(){
  const round={course:true};outro=round;clearComms();
  renderer.extraction={start:renderer.time,at:{x:game.player.x,y:game.player.y}};
  const began=performance.now(),done=()=>{const x=renderer.extraction;if(outro!==round)return;if(!x||renderer.time-x.start>=EXTRACTION_BEAM.total||performance.now()-began>EXTRACTION_BEAM.total+5000)showResult();else setTimeout(done,80);};
  sayComms({...COURSE_EXTRACT_LINE,then:done});
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
// Setters for the other controller modules (an imported binding is read-only).
export function setCourseWaiting(value){courseWaiting=value;}
