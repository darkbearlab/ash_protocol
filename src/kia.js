// Killed in action (3.174.0, user design; docs/STORY.md 8). The operative's death plays as its own scene: the view
// freezes and pushes in on the body, blood and light burst out of the wound on the side away from the killing blow,
// the world runs slow while the body falls, then at normal speed the officer on duty calls for the operative; only
// when that call ends do the results come up, with her loss report. Rules and saves are untouched: the run's result is
// recorded the moment the operative dies, and this is only how it is shown. The timings are the user's picks from the
// preview page (2026-09-24).
import {commsDuration} from './comms.js';
import {makeBurst,burstReach} from './gore.js';
export {burstReach};

export const KIA_TUNING=Object.freeze({
  zoom:1.4,          // the push-in, as a multiple of the tile size
  zoomInMs:140,      // real time to push in, from the hit
  zoomOutMs:380,     // real time to pull back, from the officer's first word
  freezeMs:210,      // real time the world stands still on the hit
  slowScale:.2,      // world speed after the freeze
  slowMs:1200,       // real time at that speed
  fallMs:300,        // world time the body takes to fall
  holdMs:700,        // real time after the body is down before the officer speaks
  voiceScale:1.4,    // both lines stay longer than ordinary comms
  drift:.3,          // share of the burst's travel left for the slow motion; the rest happens at once
  blood:1,light:1,   // amounts
  closeMs:220,       // the comms box's closing fade
});

// Real-time marks after the hit: when the world is back at normal speed, when the body is down, when she speaks.
export function kiaTimes(tuning=KIA_TUNING){
  const normalAt=tuning.freezeMs+tuning.slowMs,worldInSlow=tuning.slowMs*tuning.slowScale;
  const fallEnd=worldInSlow>=tuning.fallMs?tuning.freezeMs+tuning.fallMs/tuning.slowScale:normalAt+(tuning.fallMs-worldInSlow);
  return {normalAt,fallEnd,voiceAt:Math.max(normalAt,fallEnd)+tuning.holdMs};
}

// How fast the world runs, `sinceHit` real milliseconds after the hit.
export function kiaTimeScale(sinceHit,tuning=KIA_TUNING){
  if(sinceHit<0)return 1;
  if(sinceHit<tuning.freezeMs)return 0;
  if(sinceHit<tuning.freezeMs+tuning.slowMs)return tuning.slowScale;
  return 1;
}

const easeOut=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
const easeInOut=x=>{x=Math.min(1,Math.max(0,x));return x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;};
// The push-in multiplier: in fast on the hit, held until the officer speaks, then back out.
export function kiaZoom(sinceHit,voiceAt,tuning=KIA_TUNING){
  if(sinceHit<0)return 1;
  const z=tuning.zoom;
  if(sinceHit<voiceAt)return 1+(z-1)*easeOut(sinceHit/tuning.zoomInMs);
  return z-(z-1)*easeInOut((sinceHit-voiceAt)/tuning.zoomOutMs);
}

// How long her lines stay, in seconds (the comms `seconds` field).
export const kiaSeconds=(text,tuning=KIA_TUNING)=>Math.round(commsDuration(text)*tuning.voiceScale)/1000;

const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
// Where the killing blow came from, as a unit vector pointing from the attacker into the body, or null when the death
// has no direction (poison, fire, acid...). The last shot that hurt the body's tile wins; a blast counts from its origin
// when it went off on another tile. The operative is hit by `enemyShot`; enemies (3.175.0 kill gore) by the
// operative's and allies' `shot` and by each other. A shot's own damage may be 0 with the harm on a separate `impact`
// at the tile (the operative's shots), so a shot that did not miss counts when the tile was hurt that step.
export const ENEMY_BLOWS=Object.freeze(['shot','enemyShot']);
export function killingBlow(effects,at,types=['enemyShot']){
  const hits=(effects||[]).filter(e=>e&&e.from&&e.to),hurt=hits.some(e=>e.damage>0&&same(e.to,at));
  const shot=[...hits].reverse().find(e=>types.includes(e.type)&&!e.miss&&(e.damage>0||hurt)&&same(e.to,at)&&!same(e.from,at));
  const blast=[...hits].reverse().find(e=>e.type==='blast'&&!same(e.from,at)&&Math.max(Math.abs(e.from.x-at.x),Math.abs(e.from.y-at.y))<=(e.radius??0));
  const from=(shot||blast)?.from;
  if(!from)return null;
  const dx=at.x-from.x,dy=at.y-from.y,l=Math.hypot(dx,dy);
  return {dx:dx/l,dy:dy/l};
}

// The burst: the kill-gore burst (src/gore.js) at full strength, in flesh colours.
export const kiaBurst=(seed,blow,tuning=KIA_TUNING)=>makeBurst(seed,blow,{blood:tuning.blood,light:tuning.light,drift:tuning.drift,kind:'flesh'});
