// Killed in action (3.174.0, user design; docs/STORY.md 8). The operative's death plays as its own scene: the view
// freezes and pushes in on the body, blood and light burst out of the wound on the side away from the killing blow,
// the world runs slow while the body falls, then at normal speed the officer on duty calls for the operative; only
// when that call ends do the results come up, with her loss report. Rules and saves are untouched: the run's result is
// recorded the moment the operative dies, and this is only how it is shown. The timings are the user's picks from the
// preview page (2026-09-24).
import {commsDuration} from './comms.js';

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
// Where the killing blow came from, as a unit vector pointing from the attacker into the operative, or null when the
// death has no direction (poison, fire, acid...). The last shot that hurt the operative's tile wins; a blast counts
// from its origin when it went off on another tile.
export function killingBlow(effects,at){
  const hits=(effects||[]).filter(e=>e&&e.from&&e.to);
  const shot=[...hits].reverse().find(e=>e.type==='enemyShot'&&e.damage>0&&same(e.to,at)&&!same(e.from,at));
  const blast=[...hits].reverse().find(e=>e.type==='blast'&&!same(e.from,at)&&Math.max(Math.abs(e.from.x-at.x),Math.abs(e.from.y-at.y))<=(e.radius??0));
  const from=(shot||blast)?.from;
  if(!from)return null;
  const dx=at.x-from.x,dy=at.y-from.y,l=Math.hypot(dx,dy);
  return {dx:dx/l,dy:dy/l};
}

// The burst, in tile units, the same every time for the same seed and direction. Each piece jumps most of the way
// out at once (the pop, 1 - drift) and drifts the rest during the slow motion; drops fall and stain the floor.
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const BLOOD_COLORS=Object.freeze(['#5c0f12','#7d161a','#9c1d20','#c42a2a','#e04a3a']);
export function kiaBurst(seed,blow,tuning=KIA_TUNING){
  if(!blow)return null;
  const r=rng(seed),away=Math.atan2(blow.dy,blow.dx);
  const drops=[],mist=[],sparks=[];
  for(let i=0,n=Math.round(46*tuning.blood);i<n;i++){
    const a=away+(r()-.5)*1.0,D=.44+r()*1.9,z0=.09+r()*.32,vz=.15+r()*.74,g=7.35,land=(vz+Math.sqrt(vz*vz+2*g*z0))/g;
    drops.push({a,D,z0,vz,g,land,size:.03+Math.floor(r()*4)*.015,color:BLOOD_COLORS[Math.floor(r()*5)],stain:.015+Math.floor(r()*3)*.015});
  }
  for(let i=0,n=Math.round(12*tuning.blood);i<n;i++)mist.push({a:away+(r()-.5)*.8,D:.3+r()*1.2,life:.8+r()*.5,r0:.18+r()*.18,grow:1.3+r()*.4});
  for(let i=0,n=Math.round(16*tuning.light);i<n;i++)sparks.push({a:away+(r()-.5)*1.3,D:.26+r()*.9,v:.9+r()*1.8,life:.25+r()*.25,len:.12+r()*.15,color:r()<.5?'#fff6d8':'#ffc36b'});
  return {away,pop:1-tuning.drift,light:tuning.light,drops,mist,sparks};
}
// Distance out along a piece's path `s` world seconds after the burst: the pop, then an easing drift.
export const burstReach=(pop,D,s,tau)=>D*(pop+(1-pop)*(1-Math.exp(-Math.max(0,s)/tau)));
