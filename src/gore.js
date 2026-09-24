// Kill gore (3.175.0, user request; docs/KILL_GORE.md): the blood-and-light burst of the killed-in-action scene
// (src/kia.js), lighter, on every kill. Flesh and light fly out of the far side of the wound and drift; what lands is
// stamped on a floor layer that is never saved. Colours follow what the body is made of: people bleed red and
// orange, the swarm bleeds yellow-green, machines spill oil and throw sparks; an enemy may name its own (`gore` in its
// data). Presentation only: rules, saves and replays never see it.
import {enemyDef} from './enemy-data.js';
import {activeTrait} from './traits.js';
import {WEAPONS} from './data.js';

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
// smaller glow. How much flesh follows the body's size (3.175.1, user: by maximum health — a larva is a pinch, a hive
// matriarch a flood), with a little more for elites so the gold-framed ones still stand out. Simple drops the light and
// the sparks.
export const GORE_TUNING=Object.freeze({
  enemy:Object.freeze({blood:.5,light:.5,glow:.7}),
  baseHp:22,            // a rifleman: size 1
  size:Object.freeze([.6,2.2]),
  eliteBonus:1.25,
  drift:.3,
});
// Body size from maximum health: the square root against a rifleman's, held between .6 and 2.2 (so a boss fills its
// corner, not the screen). Remaining health does not count: a boss finished with a small shot still goes big.
export const goreSize=maxHp=>{const [lo,hi]=GORE_TUNING.size;return Math.min(hi,Math.max(lo,Math.sqrt(Math.max(1,maxHp||GORE_TUNING.baseHp)/GORE_TUNING.baseHp)));};

function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// The burst, in tile units, the same every time for the same seed. Each piece jumps most of the way out at once (the
// pop, 1 - drift) and drifts the rest; drops fall and stain the floor.
// Shape (3.175.1): `cone` widens the spray, `reach` scales how far it flies, `mistSize` the puffs, `aim` turns the
// whole burst a little off the line of the blow. The killed-in-action scene keeps the defaults.
export function makeBurst(seed,blow,{blood=1,light=1,glow=1,drift=GORE_TUNING.drift,kind='flesh',cone=1,reach=1,mistSize=1,aim=0}={}){
  if(!blow)return null;
  const palette=GORE_PALETTES[kind]||GORE_PALETTES.flesh,r=rng(seed),away=Math.atan2(blow.dy,blow.dx)+aim;
  const drops=[],mist=[],sparks=[],amount=blood*palette.blood;
  for(let i=0,n=Math.round(46*amount);i<n;i++){
    const a=away+(r()-.5)*1.0*cone,D=(.44+r()*1.9)*reach,z0=.09+r()*.32,vz=.15+r()*.74,g=7.35,land=(vz+Math.sqrt(vz*vz+2*g*z0))/g;
    drops.push({a,D,z0,vz,g,land,size:.03+Math.floor(r()*4)*.015,color:palette.drops[Math.floor(r()*palette.drops.length)],stain:.015+Math.floor(r()*3)*.015});
  }
  for(let i=0,n=Math.round(12*amount);i<n;i++)mist.push({a:away+(r()-.5)*.8*cone,D:(.3+r()*1.2)*reach,life:.8+r()*.5,r0:(.18+r()*.18)*mistSize,grow:1.3+r()*.4});
  for(let i=0,n=Math.round(16*light*palette.sparkScale);i<n;i++)sparks.push({a:away+(r()-.5)*1.3*cone,D:(.26+r()*.9)*reach,v:.9+r()*1.8,life:.25+r()*.25,len:.12+r()*.15,color:palette.sparks[Math.floor(r()*palette.sparks.length)]});
  return {away,pop:1-drift,light,glow,mistColor:palette.mist,drops,mist,sparks,baked:0};
}

// What the killing blow was (3.175.1, user request: each burst its own, by the kind of round and how hard it hit).
// Shotguns spray wide and short, the sniper narrow and long, plasma burns (less liquid, more light and steam), blades
// and fists stay close with little light, blasts throw everything around.
export const GORE_STYLES=Object.freeze({
  bullet:Object.freeze({cone:1,reach:1,amount:1,mist:1,glow:1}),
  pellet:Object.freeze({cone:1.6,reach:.8,amount:1.25,mist:1.1,glow:.9}),
  precision:Object.freeze({cone:.55,reach:1.5,amount:1,mist:.9,glow:1.1}),
  plasma:Object.freeze({cone:.9,reach:.9,amount:.75,mist:1.3,glow:1.5}),
  melee:Object.freeze({cone:1.35,reach:.6,amount:1.15,mist:.9,glow:.35}),
  blast:Object.freeze({cone:2.4,reach:1.3,amount:1.4,mist:1.4,glow:1.3}),
});
const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y;
// The kind of blow and the harm it did to the body's tile that step.
export function goreForce(effects,at,types=['shot','enemyShot']){
  const list=(effects||[]).filter(Boolean),damage=list.filter(e=>same(e.to,at)).reduce((n,e)=>n+(e.damage>0?e.damage:0),0);
  const shot=[...list].reverse().find(e=>types.includes(e.type)&&e.from&&!e.miss&&same(e.to,at)&&!same(e.from,at));
  const weapon=shot?.weaponId?WEAPONS.find(w=>w.id===shot.weaponId):null;
  const style=!shot?(list.some(e=>e.type==='blast'&&e.from&&Math.max(Math.abs(e.from.x-at.x),Math.abs(e.from.y-at.y))<=(e.radius??0))?'blast':'bullet')
    :shot.style==='grenade'||shot.weaponId==='launcher'?'blast'
    :weapon?.melee||shot.style==='claw'?'melee'
    :weapon?.pellets||shot.weaponId==='shotgun'?'pellet'
    :shot.weaponId==='sniper'?'precision'
    :shot.style==='plasma'||weapon?.ammoType==='energy'?'plasma':'bullet';
  return {style,damage};
}
// How hard a blow of `damage` lands, as a multiplier: a typical rifle round (about 24) is 1.
export const goreForceScale=damage=>Math.min(1.6,Math.max(.7,Math.sqrt(Math.max(1,damage||24)/24)));

// An enemy's burst at a given setting level, or null for none. Every burst draws its own amount, spread, reach, mist
// and glow within a range around what the blow calls for (a second random stream, so the pieces keep their places).
// The size sets how much flesh and mist (and how big the puffs); the blow sets how far and how wide.
export function enemyBurst(seed,blow,{kind='flesh',size=1,elite=false,level='full',style='bullet',damage=24}={}){
  if(!blow||level==='off')return null;
  const t=GORE_TUNING.enemy,shape=GORE_STYLES[style]||GORE_STYLES.bullet,force=goreForceScale(damage),body=size*(elite?GORE_TUNING.eliteBonus:1);
  const j=rng(seed^0x5bd1e995),vary=(lo,hi)=>lo+(hi-lo)*j();
  const amount=vary(.75,1.25),cone=vary(.8,1.2),reach=vary(.85,1.2),mistSize=vary(.8,1.3),glow=vary(.8,1.2),aim=vary(-.12,.12);
  return makeBurst(seed,blow,{kind,blood:t.blood*shape.amount*force*amount*body,glow:t.glow*shape.glow*glow,light:level==='simple'?0:t.light*Math.min(1.5,shape.glow),
    cone:shape.cone*cone,reach:shape.reach*(.8+.2*force)*reach,mistSize:shape.mist*mistSize*Math.sqrt(body),aim});
}

// How long a burst stays in the air, in world seconds (after this only its stains remain).
export const burstLife=burst=>burst?Math.max(.32,...burst.drops.map(d=>d.land),...burst.mist.map(m=>m.life),...burst.sparks.map(s=>s.life)):0;
// Distance out along a piece's path `s` world seconds after the burst: the pop, then an easing drift.
export const burstReach=(pop,D,s,tau)=>D*(pop+(1-pop)*(1-Math.exp(-Math.max(0,s)/tau)));
