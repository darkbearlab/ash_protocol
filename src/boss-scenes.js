// Boss scenes (3.204.0, user 2026-09-29; docs/BOSSES.md sections 5 and 6). Presentation only: rules, saves and replays
// never see them; src/controller.js plays them with these timings. Each plays once per boss.
// - The intro: when the officer on duty first sees a boss (the comms `boss` event, src/comms-events.js), input locks and
//   the camera slides onto the boss and pushes in a little while she speaks; it slides back only once her line has
//   closed. A boss with its own line (its card's `intro`) gets it, any other boss the generic one. The overseer has no
//   line for a boss, as before, so on his watch the camera just holds on it for a moment.
// - The kill: the killed-in-action scene (src/kia.js) cut short, because the fight goes on. The world freezes, the camera
//   slides onto the body and pushes in, a burst flies away from the killing blow in what the boss is made of (src/gore.js
//   goreKind; the gore setting applies), slow motion for 0.6 s (the operative's is 1.2 s), the fall, then the officer's
//   kill line — which also says the exit is open, so it is said only when it is — and the camera pulls back. About two
//   seconds; input stays locked until the camera is back. When you fall in the same turn, your own scene plays instead.
// With reduced motion neither moves the camera or the clock: only the line is said, and input is never locked.
import {commsLine} from './comms.js';
import {enemyDef,isBossClass} from './enemy-data.js';
import {makeBurst} from './gore.js';

// The user tunes these after playtesting, as with KIA_TUNING (src/kia.js).
export const BOSS_SCENE_TUNING=Object.freeze({
 intro:Object.freeze({
  zoom:1.2,          // the push-in, as a multiple of the tile size
  panMs:450,         // real time to slide onto the boss
  returnMs:450,      // real time to slide back, once the line has closed
  quietMs:1600,      // how long the camera holds on the boss when nobody speaks
  maxMs:15000,       // a line that never reports back (cleared by something else) cannot hold the controls longer
 }),
 death:Object.freeze({
  zoom:1.3,          // the push-in (the operative's is 1.4)
  zoomInMs:140,      // real time to push in, from the hit
  panMs:260,         // real time to slide onto the body
  freezeMs:180,      // real time the world stands still on the hit
  slowScale:.25,     // world speed after the freeze
  slowMs:600,        // real time at that speed (the operative's: 1200)
  fallMs:300,        // world time the body takes to fall
  holdMs:650,        // real time after the body is down before the officer speaks and the camera pulls back
  zoomOutMs:600,     // real time to pull back; input is free again when it ends
  blood:.8,light:1,  // the scene's own burst, on top of the ordinary kill gore
  drift:.3,          // share of the burst's travel left for the slow motion
 }),
});

const easeOut=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
const easeInOut=x=>{x=Math.min(1,Math.max(0,x));return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;};

// ---- the intro -----------------------------------------------------------------------------------------------------
// `since`: real ms since the scene began; `endAt`: when the line closed (Infinity while it is still up). How far the
// camera has slid onto the boss (blend 0-1) and the push-in multiplier.
export function introCamera(since,endAt=Infinity,tuning=BOSS_SCENE_TUNING.intro){
 if(since<0)return {blend:0,zoom:1};
 const end=Math.min(endAt,tuning.maxMs),held=easeInOut(end/tuning.panMs);
 const blend=since<end?easeInOut(since/tuning.panMs):held*(1-easeInOut((since-end)/tuning.returnMs));
 return {blend,zoom:1+(tuning.zoom-1)*blend};
}
export const introDone=(since,endAt=Infinity,tuning=BOSS_SCENE_TUNING.intro)=>since>=Math.min(endAt,tuning.maxMs)+tuning.returnMs;

// ---- the kill ------------------------------------------------------------------------------------------------------
// Real-time marks after the hit: the world back at normal speed, the body down, the officer speaking, the scene over.
export function deathTimes(tuning=BOSS_SCENE_TUNING.death){
 const normalAt=tuning.freezeMs+tuning.slowMs,worldInSlow=tuning.slowMs*tuning.slowScale;
 const fallEnd=worldInSlow>=tuning.fallMs?tuning.freezeMs+tuning.fallMs/tuning.slowScale:normalAt+(tuning.fallMs-worldInSlow);
 const voiceAt=Math.max(normalAt,fallEnd)+tuning.holdMs;
 return {normalAt,fallEnd,voiceAt,endAt:voiceAt+tuning.zoomOutMs};
}
export function deathTimeScale(since,tuning=BOSS_SCENE_TUNING.death){
 if(since<0)return 1;
 if(since<tuning.freezeMs)return 0;
 if(since<tuning.freezeMs+tuning.slowMs)return tuning.slowScale;
 return 1;
}
export function deathCamera(since,times=deathTimes(),tuning=BOSS_SCENE_TUNING.death){
 if(since<0)return {blend:0,zoom:1};
 if(since<times.voiceAt)return {blend:easeOut(since/tuning.panMs),zoom:1+(tuning.zoom-1)*easeOut(since/tuning.zoomInMs)};
 const back=easeInOut((since-times.voiceAt)/tuning.zoomOutMs),blend=easeOut(times.voiceAt/tuning.panMs)*(1-back);
 return {blend,zoom:tuning.zoom-(tuning.zoom-1)*back};
}
export const deathDone=(since,times=deathTimes())=>since>=times.endAt;
// The fall that starts the kill scene: an enemy boss's (src/presentation.js marks enemy falls). Your own converted warden
// or core guard (the workshop's boss chassis) shares the boss card, and its fall is not a kill (3.204.0 review).
export const bossFallOf=effects=>(effects||[]).find(e=>e?.type==='fall'&&e.enemy===true&&isBossClass(e.actorType))||null;
// The scene's burst: the operative's scene's burst in what the boss is made of, or none with gore off or no direction.
// The simple setting drops the light, as for every other burst.
export function deathBurst(seed,blow,kind='flesh',level='full',tuning=BOSS_SCENE_TUNING.death){
 if(!blow||level==='off')return null;
 return makeBurst(seed,blow,{blood:tuning.blood,light:level==='simple'?0:tuning.light,drift:tuning.drift,kind});
}

// ---- lines and memory ----------------------------------------------------------------------------------------------
// The intro line: the boss's own when the speaker has one for it, otherwise the generic `boss` line; null when she has
// neither (the overseer).
export function bossIntroLine(speaker,type,vars={},options={}){
 const own=enemyDef(type)?.intro;
 return (own?commsLine(speaker,own,vars,options):null)||commsLine(speaker,'boss',vars,options);
}
// The kill line says the exit is open, so it is said only when it is.
export const bossKillLine=(speaker,exitOpen,options={})=>exitOpen?commsLine(speaker,'bossKill',{},options):null;
// A boss intro jumps the comms queue (3.204.0 review: behind three waiting lines it held the controls for 15 s): the line
// on the bar, if any, gives way; the waiting ones follow the intro in their order. The new queue and the line dropped.
export function frontOfQueue(queue,message,showing=false){
 const waiting=[...(queue||[])],dropped=showing&&waiting.length?waiting.shift():null;
 return {queue:[message,...waiting],dropped};
}
// Once per boss and scene, for the run on screen (like the comms memory: the controller keeps it, a save does not).
export const newBossSceneMemory=runId=>({runId,intro:[],death:[]});
export function firstBossScene(memory,kind,id){
 if(!memory||!Array.isArray(memory[kind])||id===undefined||memory[kind].includes(id))return false;
 memory[kind].push(id);return true;
}
