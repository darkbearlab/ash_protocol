// Kill gore (3.175.0, user request; docs/KILL_GORE.md): the blood-and-light burst of the killed-in-action scene
// (src/kia.js), lighter, on every kill. Flesh and light fly out of the far side of the wound and drift; what lands is
// stamped on a floor layer that is never saved. Colours follow what the body is made of: people bleed red and
// orange, the swarm bleeds yellow-green, machines spill oil and throw sparks; an enemy may name its own (`gore` in its
// data). Presentation only: rules, saves and replays never see it.
import {enemyDef,isBossClass} from './enemy-data.js';
import {activeTrait} from './traits.js';

export const GORE_PALETTES=Object.freeze({
  flesh:Object.freeze({drops:Object.freeze(['#5c0f12','#7d161a','#9c1d20','#c42a2a','#e04a3a']),mist:Object.freeze([150,22,26]),sparks:Object.freeze(['#fff6d8','#ffc36b']),blood:1,sparkScale:1}),
  swarm:Object.freeze({drops:Object.freeze(['#3f5212','#5d7519','#86a324','#b3c93a','#d6e25a']),mist:Object.freeze([118,146,32]),sparks:Object.freeze(['#f4ffd0','#d6e25a']),blood:1,sparkScale:1}),
  mech:Object.freeze({drops:Object.freeze(['#15130f','#241f19','#3a3128','#5a4a36','#8a6a3e']),mist:Object.freeze([72,70,66]),sparks:Object.freeze(['#fff6d8','#ffd27a','#9fdcff']),blood:.6,sparkScale:2}),
});
export const GORE_KINDS=Object.freeze(Object.keys(GORE_PALETTES));

// What a body is made of: its own data first, then machines, then the swarm, otherwise flesh.
export function goreKind(actor){
  const own=enemyDef(actor)?.gore;if(GORE_KINDS.includes(own))return own;
  if(activeTrait(actor,'mechanical')||enemyDef(actor)?.mechanical)return 'mech';
  return actor?.faction==='swarm'?'swarm':'flesh';
}

// The setting (display, kept on this device): full by default; with reduced motion asked for, at most simple.
export const GORE_SETTINGS=Object.freeze(['full','simple','off']);
export const validGoreSetting=value=>GORE_SETTINGS.includes(value);
export const goreLevel=(setting,reduceMotion=false)=>{const level=validGoreSetting(setting)?setting:'full';return reduceMotion&&level==='full'?'simple':level;};

// Amounts (1 = the killed-in-action scene). An enemy's burst is the light version: half the flesh, a dimmer and
// smaller glow; elites and bosses are nearly full. Simple drops the light and the sparks.
export const GORE_TUNING=Object.freeze({
  enemy:Object.freeze({blood:.5,light:.5,glow:.7}),
  heavy:Object.freeze({blood:.8,light:.8,glow:.9}),
  drift:.3,
});

function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// The burst, in tile units, the same every time for the same seed. Each piece jumps most of the way out at once (the
// pop, 1 - drift) and drifts the rest; drops fall and stain the floor.
export function makeBurst(seed,blow,{blood=1,light=1,glow=1,drift=GORE_TUNING.drift,kind='flesh'}={}){
  if(!blow)return null;
  const palette=GORE_PALETTES[kind]||GORE_PALETTES.flesh,r=rng(seed),away=Math.atan2(blow.dy,blow.dx);
  const drops=[],mist=[],sparks=[],amount=blood*palette.blood;
  for(let i=0,n=Math.round(46*amount);i<n;i++){
    const a=away+(r()-.5)*1.0,D=.44+r()*1.9,z0=.09+r()*.32,vz=.15+r()*.74,g=7.35,land=(vz+Math.sqrt(vz*vz+2*g*z0))/g;
    drops.push({a,D,z0,vz,g,land,size:.03+Math.floor(r()*4)*.015,color:palette.drops[Math.floor(r()*palette.drops.length)],stain:.015+Math.floor(r()*3)*.015});
  }
  for(let i=0,n=Math.round(12*amount);i<n;i++)mist.push({a:away+(r()-.5)*.8,D:.3+r()*1.2,life:.8+r()*.5,r0:.18+r()*.18,grow:1.3+r()*.4});
  for(let i=0,n=Math.round(16*light*palette.sparkScale);i<n;i++)sparks.push({a:away+(r()-.5)*1.3,D:.26+r()*.9,v:.9+r()*1.8,life:.25+r()*.25,len:.12+r()*.15,color:palette.sparks[Math.floor(r()*palette.sparks.length)]});
  return {away,pop:1-drift,light,glow,mistColor:palette.mist,drops,mist,sparks,baked:0};
}

// An enemy's burst at a given setting level, or null for none.
export function enemyBurst(seed,blow,{kind='flesh',heavy=false,level='full'}={}){
  if(!blow||level==='off')return null;
  const t=heavy?GORE_TUNING.heavy:GORE_TUNING.enemy;
  return makeBurst(seed,blow,{kind,blood:t.blood,glow:t.glow,light:level==='simple'?0:t.light});
}

// How long a burst stays in the air, in world seconds (after this only its stains remain).
export const burstLife=burst=>burst?Math.max(.32,...burst.drops.map(d=>d.land),...burst.mist.map(m=>m.life),...burst.sparks.map(s=>s.life)):0;
// Distance out along a piece's path `s` world seconds after the burst: the pop, then an easing drift.
export const burstReach=(pop,D,s,tau)=>D*(pop+(1-pop)*(1-Math.exp(-Math.max(0,s)/tau)));
export const heavyBody=actor=>Boolean(actor?.elite||isBossClass(actor));
