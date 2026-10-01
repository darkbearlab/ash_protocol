import {t} from './i18n.js';
import {DIRECTIONS,distance,key,lineOfSight} from './world.js';
import {WEAPONS,ENEMY_TYPES,seeThrough} from './data.js';
import {objectSightGrid} from './scenery.js';
import {inCone} from './shotgun.js';
import {barrierBetween,edgeBlocks} from './barriers.js';
import {areaCells} from './throwables.js';
import {reduceDirectDamage} from './traits.js';
import {AFFIX_TUNING,birthRandom,enemyArmor,isFlamer,enemyDisplayName as enemyName} from './enemy-affixes.js';
import {scaleEnemy} from './endless.js';
import {fireproof,enemyDef} from './enemy-data.js';
import {registerSpecial,validSpecials,dropStaleSpecials,INTERRUPT_REASONS} from './enemy-specials.js';

// Burning floor and the flamethrower (3.203.0, user design 2026-09-29, docs/HAZARDS.md sections 2 and 4).
// - A burning tile is `{x,y,age}` in the floor's `fires` (absent when nothing burns); `age` counts the rounds it has
//   burned, this one included. Fire comes only from a flamethrower (yours or a 火焰兵's) and a flamer's fuel tank.
// - At the start of each round every burning tile rolls one of three (Claude's numbers, user 2026-09-29): out 40%, burns
//   on 40%, burns on and spreads one tile 20%. Each burning neighbour moves 10% from out to burns on, out never below
//   10%; a tile burns at most five rounds, and at most 30 tiles burn on a floor. The dice are a hash of the seed, the
//   floor, the round and the tile, never the combat RNG.
// - You can walk into it; whoever ends a round on it takes `damage` (both sides; your hazmat counts against it, as for
//   acid and steam; flyers are above it). Every route treats it as a hazard (src/hazard-paths.js).
// - It is a light source (src/lighting.js) and smokes like light smoke: a shot whose line crosses a burning tile hits half
//   as often, at full damage, and nobody's sight is blocked (src/vents.js hazeShot).
// - The fixed fire of floors 5-6 (`hazards`, type 'fire') glows as well, but never spreads or smokes.
export const FIRE_TUNING=Object.freeze({out:.4,spread:.2,neighbour:.1,minOut:.1,maxAge:5,maxTiles:30,damage:10,tankDamage:30});
export const FLAMETHROWER=WEAPONS.findIndex(w=>w.id==='flamer');
const fnv=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// One die per tile and round, from the run's seed: replays, saves and reloads all see the same fire.
export const fireDie=(g,q,salt)=>fnv(`${g.seed}:${g.floor}:${g.turn}:${q.x},${q.y}:${salt}`)/4294967296;
// The odds for a tile with `n` burning neighbours (the four sides).
export function fireOdds(n=0){
 const T=FIRE_TUNING,out=Math.max(T.minOut,T.out-n*T.neighbour);
 return {out,persist:1-T.spread-out,spread:T.spread};
}
export const burningAt=(g,pos)=>g.fires?.find(f=>f.x===pos.x&&f.y===pos.y)||null;
const fixedFire=(g,q)=>Boolean(g.hazards?.some(h=>h.type==='fire'&&h.x===q.x&&h.y===q.y));
// A tile that can catch: bare floor (not a pit, not under a crate, barrel or nest), not the fixed fire.
export const flammable=(g,q)=>g.grid[q.y]?.[q.x]===1&&!(g.solid?.(q.x,q.y))&&!fixedFire(g,q);
// Which sheet row a burning tile shows (src/renderer-clouds.js burning): it catches, burns, then dies down in its last two rounds.
export const fireRow=f=>f.age<=1?'ignite':f.age>=FIRE_TUNING.maxAge-1?'embers':'steady';

// Start of a round (Game.action, after the vents). Every tile rolls against the fire as it stood when the round began, so
// the order they are read in never matters; spreads land in reading order until the floor's cap.
export function tickFires(g){
 if(!g.fires?.length)return;
 const T=FIRE_TUNING,before=new Set(g.fires.map(key)),kept=[],spreading=[];
 for(const f of [...g.fires].sort((a,b)=>a.y-b.y||a.x-b.x)){
  if(f.age>=T.maxAge)continue;   // five rounds: burnt out
  const n=DIRECTIONS.filter(([dx,dy])=>before.has(`${f.x+dx},${f.y+dy}`)).length,odds=fireOdds(n),roll=fireDie(g,f,'fire-v1');
  if(roll<odds.out)continue;
  kept.push({x:f.x,y:f.y,age:f.age+1});
  if(roll>=odds.out+odds.persist)spreading.push(f);
 }
 const now=new Set(kept.map(key));
 for(const f of spreading){
  if(kept.length>=T.maxTiles)break;
  // Onto a neighbouring floor tile that was not burning when the round began and has not caught since; a wall, a
  // closed door or a partition stops it (a low partition does not, as for a blast).
  const options=DIRECTIONS.map(([dx,dy])=>({x:f.x+dx,y:f.y+dy})).filter(q=>!before.has(key(q))&&!now.has(key(q))&&flammable(g,q)&&!edgeBlocks(barrierBetween(g.barriers||[],f,q),'blast'));
  if(!options.length)continue;
  const q=options[Math.floor(fireDie(g,f,'fire-spread-v1')*options.length)];
  kept.push({x:q.x,y:q.y,age:1});now.add(key(q));
 }
 g.fires=kept.length?kept:undefined;
}
// Set tiles alight (a spray, a tank). A tile already burning catches again from the start (fresh fuel: Claude's call);
// a new one only while fewer than 30 burn on the floor. Returns how many are burning now of those asked.
// 3.206.0 `makeRoom` (a rebel boss's fire, src/rebel-bosses.js; Claude's call): a boss's warned fire never fails for the
// cap. With 30 already burning, the oldest tile goes out for each new one (the longest burning; the first in reading
// order among equals), never one of those being lit now. The floor still never holds more than 30. With `makeRoom` it
// returns {lit, displaced}: how many of those asked burn now, and how many old tiles went out for them.
export function ignite(g,cells,{makeRoom=false}={}){
 const fires=[...(g.fires||[])],fresh=new Set(cells.filter(q=>flammable(g,q)).map(key));let lit=0,displaced=0;
 const index=()=>new Map(fires.map((f,i)=>[key(f),i]));let at=index();
 for(const q of cells){
  if(!flammable(g,q))continue;
  const i=at.get(key(q));
  if(i!==undefined){fires[i]={x:q.x,y:q.y,age:1};lit++;continue;}
  if(fires.length>=FIRE_TUNING.maxTiles){
   if(!makeRoom)continue;
   let old=-1;
   for(let j=0;j<fires.length;j++){const f=fires[j];if(fresh.has(key(f)))continue;if(old<0||f.age>fires[old].age||f.age===fires[old].age&&(f.y<fires[old].y||f.y===fires[old].y&&f.x<fires[old].x))old=j;}
   if(old<0)continue;
   fires.splice(old,1);displaced++;at=index();
  }
  at.set(key(q),fires.length);fires.push({x:q.x,y:q.y,age:1});lit++;
 }
 g.fires=fires.length?fires:undefined;return makeRoom?{lit,displaced}:lit;
}

// The tiles a spray reaches: out to the weapon's range, inside its cone around the aim, along a line a blast would pass
// (walls, closed doors and partitions stop it; low partitions and crates that are not full cover do not). Over a pit it
// still reaches whatever hovers there, but only floor catches. Nearest first.
export function flameCells(g,from,aim,w=WEAPONS[FLAMETHROWER]){
 const out=[];
 if(!aim||(aim.x===from.x&&aim.y===from.y))return out;
 for(let y=from.y-w.range;y<=from.y+w.range;y++)for(let x=from.x-w.range;x<=from.x+w.range;x++){
  const q={x,y},d=distance(from,q);
  if(!d||d>w.range||!seeThrough(g.grid[y]?.[x])||!inCone(from,aim,q,w.flameCone))continue;
  if(lineOfSight(objectSightGrid(g,from,q),from,q,g.barriers||[],'blast'))out.push(q);
 }
 return out.sort((a,b)=>distance(from,a)-distance(from,b)||a.y-b.y||a.x-b.x);
}
// Everyone on `cells` but `attacker` takes `roll()` — no hit roll, no cover, armour subtracts as for a blade or a blast.
// Friends are not spared, either side's. 3.206.0: a fireproof card (the rebel bosses) takes nothing, and your own spray
// says so when you can see it. Returns how many units it burned. (sprayFlame; a rebel boss's fire, src/rebel-bosses.js)
export function burnUnits(g,attacker,cells,roll){
 const reached=new Set(cells.map(key)),yours=attacker===g.player;
 const units=[g.player,...g.activeAllies,...g.enemies].filter(u=>u!==attacker&&u.hp>0&&reached.has(key(u)));
 let burned=0;
 for(const u of units){
  if(fireproof(u)){if(yours&&g.visible(u))g.log(t('rebelBosses.fireproof',{enemy:enemyName(u)}));continue;}
  const damage=roll();burned++;
  if(u===g.player)g.damagePlayer(damage,t('flames.flameSource',{enemy:enemyName(attacker)}),null,true);
  else if(g.activeAllies.includes(u))g.damageAlly(u,damage,null,true);
  else if(yours)g.hitTarget(u,damage,g.player,0,g.weapon);
  else g.hurt(u,reduceDirectDamage(u,Math.max(1,damage-enemyArmor(u))),attacker);
 }
 return burned;
}
// One spray (yours from Game.launch, a flamer's from src/enemy-behavior.js): every unit on a reached tile burns
// (burnUnits), and then the tiles catch. Returns the tiles, how many units it burned and how many tiles caught.
// 3.206.0 `makeRoom` (the arsonist's spray): the tiles catch as a boss's fire does (ignite); `displaced` says how many
// old tiles went out for them.
// 3.214.0: the flamethrower a unit sprays with - a card's own reach (`flameRange`: the heavy flamer's 3) on the same cone.
export const flameWeapon=u=>{const r=enemyDef(u)?.flameRange;return r?{...WEAPONS[FLAMETHROWER],range:r}:WEAPONS[FLAMETHROWER];};
export function sprayFlame(g,attacker,aim,roll,{makeRoom=false}={}){
 const w=flameWeapon(attacker),cells=flameCells(g,attacker,aim,w);
 g.effects.push({type:'flame',from:{x:attacker.x,y:attacker.y},to:{x:aim.x,y:aim.y},cells:cells.map(({x,y})=>({x,y})),damage:0});
 const hits=burnUnits(g,attacker,cells,roll);
 const caught=ignite(g,cells,{makeRoom}),lit=makeRoom?caught.lit:caught;
 return {cells,hits,lit,weapon:w,displaced:makeRoom?caught.displaced:0};
}
// A flamer's spray: the flamethrower's damage, grown with depth like any enemy's.
export const flamerDamage=g=>{const w=WEAPONS[FLAMETHROWER];return scaleEnemy(w.min+Math.floor(g.rng()*(w.max-w.min+1)),g.floor,'damage',g.difficultySpec);};
// A flamer that falls: 30% its tank goes up — the bomber's blast around it, and the tiles it reaches catch — otherwise it
// leaves its flamethrower (Game.hurt, with the other drops). Its own hash, so no other roll moves. Returns true on a blast.
export function flamerTank(g,e){
 if(!isFlamer(e)||birthRandom(g.seed,g.floor,e.id,'flamer-tank-v1')()>=AFFIX_TUNING.flamerBlast)return false;
 g.log(t('flames.tankBlows',{enemy:enemyName(e)}),true);
 const at={x:e.x,y:e.y};
 g.explode(at,1,scaleEnemy(FIRE_TUNING.tankDamage,g.floor,'damage',g.difficultySpec));
 ignite(g,areaCells(g.grid,at,1,g.barriers,g));
 return true;
}

// A flamer's marked cone is live while the flamer stands where it marked it, alive and not stunned (the renderer and the
// text tool draw only those). 3.203.0 review: one left behind by something that moved or stopped the flamer outside its
// own turn is dropped when a save loads, as the flamer itself would drop it on its turn, instead of refusing the save.
export const liveFlameIntent=e=>Boolean(e?.hp>0&&!e.control?.disabled&&e.flameIntent?.origin&&e.flameIntent.origin.x===e.x&&e.flameIntent.origin.y===e.y);
// Saves: `fires` on this floor and every kept one (validFireTiles; the loader checks the marked cone with the other
// specials, src/enemy-specials.js), and a flamer's marked cone (validFires: both, as tests ask).
const cell=(q,grid)=>q&&typeof q==='object'&&Object.keys(q).length===2&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&seeThrough(grid?.[q.y]?.[q.x]);
// 3.206.0: the arsonist (a card that only sprays, `flameOnly`) marks its cone the same way, with no affix to reveal.
export const validFlameIntent=(e,grid)=>{const i=e.flameIntent;return Boolean(i&&typeof i==='object'&&Object.keys(i).length===2&&cell(i.origin,grid)&&cell(i.aim,grid)&&i.origin.x===e.x&&i.origin.y===e.y&&(i.aim.x!==e.x||i.aim.y!==e.y)&&e.hp>0&&!e.control?.disabled&&(e.affixes?.some(a=>a.id==='flamer'&&a.revealed)||ENEMY_TYPES[e.type]?.flameOnly===true||ENEMY_TYPES[e.type]?.flamer===true));};
export function validFireTiles(g){
 for(const f of [g,...Object.values(g.floorStates||{})]){
  if(f.fires!==undefined){
   if(!Array.isArray(f.fires)||f.fires.length>FIRE_TUNING.maxTiles)return false;
   const seen=new Set();
   for(const q of f.fires){
    if(!q||typeof q!=='object'||Object.keys(q).length!==3||!Number.isInteger(q.x)||!Number.isInteger(q.y)||f.grid?.[q.y]?.[q.x]!==1||!Number.isInteger(q.age)||q.age<1||q.age>FIRE_TUNING.maxAge||seen.has(key(q)))return false;
    seen.add(key(q));
   }
  }
 }
 return true;
}
export const validFires=g=>validFireTiles(g)&&validSpecials(g,['flame']);
// 3.206.1 (src/enemy-specials.js): the marked cone as the shared rules see it. Carried by an affix flamer and by a card
// that only sprays (`flameOnly`, the arsonist): neither turns on a decoy or shoots a mine (it has no gun), and a marked
// cone keeps it from stepping off a hazard; any interruption drops the cone (no cooldown). An affix flamer's cone goes
// off at the very top of its turn, and its flamethrower replaces the affix branches and the shot (src/enemy-behavior.js);
// the arsonist's goes off in the rebel bosses' step (src/rebel-bosses.js). `gunless`: a squad, the ambush watch and the
// enforcer's rally hold no gun on either (3.206.2: the arsonist too — a squad leader could ready it, and the rally then
// fire a gun it does not have). Saves: a cone left where its unit no longer stands is dropped, and so is the arsonist's
// while it vents (3.206.0).
const sprays=e=>Boolean(enemyDef(e)?.flameOnly);
registerSpecial({id:'flame',intent:'flameIntent',carries:e=>isFlamer(e)||sprays(e),
 fields:{flameIntent:{valid:(v,e,f)=>validFlameIntent(e,f.grid)}},
 interrupt:{on:INTERRUPT_REASONS},
 blocks:{decoy:e=>isFlamer(e)||sprays(e),mine:e=>isFlamer(e)||sprays(e)||Boolean(e.flameIntent),stepOff:true},
 load:{stale:e=>{const i=e.flameIntent;return Boolean(i&&typeof i==='object'&&i.origin&&typeof i.origin==='object'&&!liveFlameIntent(e))||Boolean(e.flameIntent&&e.overheat>0&&enemyDef(e)?.flameOnly===true);}},
 gunless:e=>isFlamer(e)||sprays(e),
 card:(g,e)=>[liveFlameIntent(e)?t('target-card.flameMarked'):''],   // 3.206.2: the cone it will spray from here
});
export const dropStaleFlameIntents=g=>dropStaleSpecials(g,['flame']);
