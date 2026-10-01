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
// 3.211.0: a blow struck in melee — a melee weapon of yours or a friend's, a claw or a blade, or an enemy that fights in
// melee (its card's `projectile`), whatever style its swing is drawn in.
const meleeShot=(shot,weapon)=>Boolean(weapon?.melee||shot.weaponId==='unarmed'||shot.style==='claw'||shot.style==='slash'||!weapon&&enemyDef(shot.attackerType)?.projectile==='melee');
// The kind of blow and the harm it did to the body's tile that step. 3.211.0: a melee blow also says how it cut and how
// heavy it was (meleeCut); a shotgun's, from how far it was fired (`range`, in tiles: point-blank throws a body).
export function goreForce(effects,at,types=['shot','enemyShot']){
  const list=(effects||[]).filter(Boolean),damage=list.filter(e=>same(e.to,at)).reduce((n,e)=>n+(e.damage>0?e.damage:0),0);
  const shot=[...list].reverse().find(e=>types.includes(e.type)&&e.from&&!e.miss&&same(e.to,at)&&!same(e.from,at));
  const weapon=shot?.weaponId?WEAPONS.find(w=>w.id===shot.weaponId):null;
  const style=!shot?(list.some(e=>e.type==='blast'&&e.from&&Math.max(Math.abs(e.from.x-at.x),Math.abs(e.from.y-at.y))<=(e.radius??0))?'blast':'bullet')
    :shot.style==='grenade'||shot.weaponId==='launcher'?'blast'
    :meleeShot(shot,weapon)?'melee'
    :weapon?.pellets||shot.weaponId==='shotgun'?'pellet'
    :shot.weaponId==='sniper'?'precision'
    :shot.style==='plasma'||weapon?.ammoType==='energy'?'plasma':'bullet';
  if(style==='melee')return {style,damage,...meleeCut(shot,weapon)};
  if(style==='pellet')return {style,damage,range:Math.abs(shot.from.x-at.x)+Math.abs(shot.from.y-at.y)};
  return {style,damage};
}
// 3.211.0 (user decisions 2026-10-01, docs/KILL_GORE.md 近戰的甩出血光): how a melee blow cut — a `slash` (blades, the
// axe, the sabre, claws, a bump, the power fist, an enemy's claw or blade) sweeps across the blow, a `thrust` (the
// spear) runs straight through, a `saw` (the chainsaw) sprays — and its `heft`, 1 for the katana, up to 1.6 for the
// heaviest (the power fist, the axe, a brute or a hive beast) and down to .6 for knives, claws and fists. A weapon's
// heft is its average blow against the katana's; an enemy's, its card's damage, a quarter more for the large ones.
const clampHeft=v=>Math.min(1.6,Math.max(.6,v));
export function meleeCut(shot,weapon=shot?.weaponId?WEAPONS.find(w=>w.id===shot.weaponId):null){
  if(weapon?.melee)return {cut:weapon.thrust?'thrust':weapon.hits>1?'saw':'slash',heft:weapon.hits>1?1.1:clampHeft(Math.sqrt((weapon.min+weapon.max)/2/32))};
  if(shot?.weaponId==='unarmed')return {cut:'slash',heft:.6};
  const def=enemyDef(shot?.attackerType);
  if(!def)return {cut:'slash',heft:.8};
  return {cut:'slash',heft:clampHeft(Math.sqrt(Math.max(1,def.damage||12)/14)*(def.drawing?.heavy||def.traits?.includes('large')?1.25:1))};
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

// 3.176.0 (user request): every harmful hit that a body lives through throws a little — a few drops and a wisp of mist,
// or a few sparks off a machine, and a pinprick of light — away from the shot. About a tenth of a kill; the kind of
// round, the harm and the body's size still shape it, a little. The same setting governs it.
export const HIT_TUNING=Object.freeze({blood:.11,light:.15,glow:.3,reach:.45,mist:.6});
export function hitBurst(seed,blow,{kind='flesh',size=1,level='full',style='bullet',damage=10}={}){
  if(!blow||level==='off')return null;
  const t=HIT_TUNING,shape=GORE_STYLES[style]||GORE_STYLES.bullet,force=goreForceScale(damage);
  const j=rng(seed^0x27d4eb2f),vary=(lo,hi)=>lo+(hi-lo)*j();
  return makeBurst(seed,blow,{kind,blood:t.blood*shape.amount*force*Math.sqrt(size)*vary(.75,1.3),glow:t.glow*shape.glow,light:level==='simple'?0:t.light*Math.min(1.5,shape.glow),
    cone:shape.cone*vary(.8,1.2),reach:t.reach*shape.reach*(.8+.2*force)*vary(.8,1.25),mistSize:t.mist*shape.mist*vary(.8,1.2),aim:vary(-.15,.15)});
}

// 3.211.0 (user decisions 2026-10-01, docs/KILL_GORE.md 近戰的甩出血光): a melee kill flings its gore instead of
// bursting it out of the far side. A slash sweeps it sideways across the blow in an arc (to one side, picked by the
// kill's seed) and drags an arc-shaped smear on the floor; a thrust sprays it in a straight line through and behind the
// body with a streak; a saw sprays it fine and long, landing as a sheet. Heavier weapons throw a wider arc and more
// chunks; light ones a thinner one. The same palettes, setting and darkness as every burst. Pieces may leave late (`t0`,
// seconds) so the swing reads as a sweep; `smear` is stamped on the floor layer point by point as the sweep passes.
export const FLING_TUNING=Object.freeze({
  slash:Object.freeze({drops:54,arc:1.75,back:.35,radius:.85,sweep:.18,smear:.8,width:.1,chunks:.1}),
  thrust:Object.freeze({drops:46,spread:.24,reach:1.9,streak:1.3,width:.09,speed:.07}),
  saw:Object.freeze({drops:84,cone:1.2,turn:.75,reach:1.1,spray:.45}),
  pop:.35,
});
export function meleeFling(seed,blow,{kind='flesh',size=1,elite=false,level='full',cut='slash',heft=1,damage=24}={}){
  if(!blow||level==='off')return null;
  const palette=GORE_PALETTES[kind]||GORE_PALETTES.flesh,r=rng(seed),j=rng(seed^0x5bd1e995),vary=(lo,hi)=>lo+(hi-lo)*j();
  const T=GORE_TUNING.enemy,force=goreForceScale(damage),body=size*(elite?GORE_TUNING.eliteBonus:1),light=level==='simple'?0:T.light*.5;
  const amount=T.blood*GORE_STYLES.melee.amount*force*vary(.8,1.2)*body*(.55+.45*heft)*palette.blood,side=(seed>>>4)&1?1:-1,away=Math.atan2(blow.dy,blow.dx)+vary(-.08,.08);
  const drops=[],mist=[],sparks=[],smear=[],pick=()=>palette.drops[Math.floor(r()*palette.drops.length)],dark=()=>palette.drops[1+Math.floor(r()*2)];
  const drop=(a,D,t0,{size:sz=.03+Math.floor(r()*3)*.015,z0=.1+r()*.22,vz=.1+r()*.5,ox=0,oy=0}={})=>{const g=7.35;drops.push({a,D,z0,vz,g,land:(vz+Math.sqrt(vz*vz+2*g*z0))/g,t0,ox,oy,size:sz,color:pick(),stain:.015+Math.floor(r()*3)*.015});};
  if(cut==='thrust'){
   const F=FLING_TUNING.thrust,reach=F.reach*(.8+.2*force)*(.85+.3*heft);
   for(let i=0,n=Math.round(F.drops*amount);i<n;i++){const D=(.15+Math.pow(r(),.8)*.85)*reach;drop(away+(r()-.5)*F.spread,D,D*F.speed,{size:(.025+Math.floor(r()*3)*.012)*(.8+.2*heft),z0:.08+r()*.16,vz:.05+r()*.35});}
   for(let i=0,n=Math.round(5*amount);i<n;i++)mist.push({a:away+(r()-.5)*.3,D:(.3+r()*.9)*reach*.6,life:.7+r()*.4,r0:(.14+r()*.12)*Math.sqrt(body),grow:1.3+r()*.3,t0:r()*.12});
   for(let k=0,m=14,len=F.streak*(.85+.3*heft);k<m;k++){const u=k/(m-1),d=.25+u*(len-.25);smear.push({x:Math.cos(away)*d,y:Math.sin(away)*d,w:F.width*(1-.6*u)*(.5+.5*heft),t:.08+d*F.speed,color:dark()});}
  }else if(cut==='saw'){
   const F=FLING_TUNING.saw,turn=away+side*F.turn;
   for(let i=0,n=Math.round(F.drops*amount);i<n;i++)drop(turn+(r()-.5)*F.cone,(.2+r()*.9)*F.reach*(.85+.3*force),r()*F.spray,{size:.018+Math.floor(r()*2)*.01,z0:.1+r()*.2,vz:.25+r()*.5});
   for(let i=0,n=Math.round(10*amount);i<n;i++)mist.push({a:turn+(r()-.5)*F.cone,D:(.2+r()*.7)*F.reach,life:.6+r()*.5,r0:(.12+r()*.12)*Math.sqrt(body),grow:1.4+r()*.4,t0:r()*F.spray});
  }else{
   const F=FLING_TUNING.slash,span=F.arc*(.75+.25*heft),a0=away-side*F.back,radius=F.radius*(.6+.5*heft)*(.9+.2*force);
   for(let i=0,n=Math.round(F.drops*amount);i<n;i++){const u=(i+r())/n,chunk=r()<F.chunks*heft;drop(a0+side*span*u+(r()-.5)*.12,radius*(.8+.35*r())*(.85+.3*u),u*F.sweep,{size:chunk?.06+Math.floor(r()*3)*.015:(.03+Math.floor(r()*3)*.015)*(.75+.25*heft),z0:.12+r()*.2,vz:.1+r()*.45});}
   for(let i=0,n=Math.round(6*amount);i<n;i++){const u=r();mist.push({a:a0+side*span*u,D:radius*(.4+r()*.5),life:.7+r()*.4,r0:(.15+r()*.12)*Math.sqrt(body),grow:1.3+r()*.3,t0:u*F.sweep});}
   for(let k=0,m=24,rs=radius*F.smear;k<m;k++){const u=k/(m-1),a=a0+side*span*(.08+.92*u),d=rs*(.85+.3*u);smear.push({x:Math.cos(a)*d,y:Math.sin(a)*d,w:F.width*(.5+.5*heft)*(.3+.7*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.1)),.6)),t:u*F.sweep+.14,color:dark()});}
  }
  if(light>0)for(let i=0,n=Math.round(10*light*palette.sparkScale);i<n;i++)sparks.push({a:away+side*(r()-.2)*1.2,D:(.2+r()*.6),v:.9+r()*1.4,life:.2+r()*.2,len:.1+r()*.12,color:palette.sparks[Math.floor(r()*palette.sparks.length)],t0:r()*.12});
  return {away,pop:FLING_TUNING.pop,light,glow:T.glow*GORE_STYLES.melee.glow,mistColor:palette.mist,drops,mist,sparks,smear,baked:0,cut,side};
}
// 3.211.0 (docs/KILL_GORE.md 屍體圖層): blood shaken off a body as it is thrown, along its path (`path`: the unit direction,
// how far it flew in tiles and how long that took in ms). Drops leave each point as the body passes it and a dragged
// streak marks the floor. Presentation only, like every burst.
export function corpseTrail(seed,path,{kind='flesh',size=1,level='full'}={}){
  if(!path||level==='off'||!(path.dist>0))return null;
  const palette=GORE_PALETTES[kind]||GORE_PALETTES.flesh,r=rng(seed^0x2c1b3c6d),along=Math.atan2(path.dir.y,path.dir.x),when=f=>(1-Math.cbrt(1-Math.min(1,f)))*path.duration/1000;
  const drops=[],smear=[],amount=Math.sqrt(size)*palette.blood;
  for(let i=0,n=Math.round(14*path.dist*amount);i<n;i++){const f=r(),d=f*path.dist,z0=.05+r()*.12,vz=.08+r()*.3,g=7.35;drops.push({a:along+Math.PI+(r()-.5)*2.2,D:.06+r()*.3,z0,vz,g,land:(vz+Math.sqrt(vz*vz+2*g*z0))/g,t0:when(f),ox:path.dir.x*d,oy:path.dir.y*d,size:.025+Math.floor(r()*3)*.012,color:palette.drops[Math.floor(r()*palette.drops.length)],stain:.015+Math.floor(r()*2)*.015});}
  for(let k=0,m=Math.max(2,Math.round(path.dist*9));k<m;k++){const f=(k+.5)/m,d=f*path.dist;smear.push({x:path.dir.x*d+(r()-.5)*.06,y:path.dir.y*d+(r()-.5)*.06,w:.035+r()*.03,t:when(f)+.03,color:palette.drops[Math.floor(r()*2)]});}
  return {away:along,pop:FLING_TUNING.pop,light:0,glow:0,mistColor:palette.mist,drops,mist:[],sparks:[],smear,baked:0};
}

// How long a burst stays in the air, in world seconds (after this only its stains remain). 3.211.0: counting pieces
// that leave late (`t0`) and the floor smear still to be stamped.
const late=p=>p.t0||0;
export const burstLife=burst=>burst?Math.max(.32,...burst.drops.map(d=>late(d)+d.land),...burst.mist.map(m=>late(m)+m.life),...burst.sparks.map(s=>late(s)+s.life),...(burst.smear||[]).map(m=>m.t)):0;
// Distance out along a piece's path `s` world seconds after the burst: the pop, then an easing drift.
export const burstReach=(pop,D,s,tau)=>D*(pop+(1-pop)*(1-Math.exp(-Math.max(0,s)/tau)));
