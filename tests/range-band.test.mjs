import {ENEMY_TYPES} from '../src/data.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {SIZE} from '../src/data.js';
import {BAND_TUNING,WEAPON_BANDS,ENEMY_BANDS,weaponBand,enemyBand,bandPenalty,inBand} from '../src/range-band.js';
import {weaponStats} from '../src/weapons.js';
import {grantTrait} from '../src/traits.js';
import {targetDetails} from '../src/target-card.js';

// 3.152.0 有效距離 (user decision 2026-09-20, docs/WEAPONS.md): every shooter has a band; each tile outside it costs
// BAND_TUNING.perTile accuracy up to the cap, too close as much as too far, for the player and the enemies alike.
function arena(character='soldier'){
 const g=new Game(3,[],0,character,undefined,'extraction'),p=g.player;
 g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());
 for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke','allies'])g[k]=[];
 Object.assign(p,{x:10,y:10,traits:[]});g.start={x:5,y:5};g.end={x:25,y:25};g.reveal();
 return g;
}
const foe=(g,x,y=10,type='rifleman')=>{const e=makeEnemy(type,x,y,`b${x}${y}`,1);Object.assign(e,{hp:500,maxHp:500,alert:true,moved:false});g.enemies.push(e);g.reveal();return e;};
const still=g=>{Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});return g;};

test('the penalty grows a tile at a time on both sides and stops at the cap',()=>{
 const band=[3,5];
 assert.deepEqual([1,2,3,4,5,6,7,8,9].map(d=>bandPenalty(band,d)),[8,4,0,0,0,4,8,12,12]);
 assert.equal(bandPenalty(null,99),0);assert.ok(inBand(null,99));
 assert.equal(BAND_TUNING.perTile*3,BAND_TUNING.cap,'the cap is three tiles out');
});

// 3.153.0 (faction review): a far edge two tiles short of the card's range left a dead zone — the unit had a clean shot
// and walked away from a −4 instead of taking it. Both faction reviews measured the same loss, so the rule is pinned.
test('no enemy band leaves a dead zone: every far edge is within one tile of the card range',()=>{
 for(const [type,band] of Object.entries(ENEMY_BANDS)){
  const range=ENEMY_TYPES[type]?.range;
  assert.ok(Number.isInteger(range),`${type} is a real enemy type`);
  assert.ok(band[1]>=range-1&&band[1]<=range,`${type} band ${band} against range ${range}`);
  assert.ok(band[0]>=1&&band[0]<band[1],`${type} band ${band} runs near to far`);
 }
});

test('the player loses accuracy outside the band and nothing inside it',()=>{
 const g=still(arena()),p=g.player;p.combatModifiers={rangedAccuracy:-20};   // keep every shot off the 99% ceiling
 const chance=x=>{const e=foe(g,x);const c=g.accuracy(p,e).chance;g.enemies=[];g.reveal();return c;};
 const inside=chance(13),near=chance(12),far=chance(16);
 assert.deepEqual(weaponBand(g.weapon),WEAPON_BANDS.rifle);
 assert.equal(inside-near,BAND_TUNING.perTile,'one tile too close');
 assert.equal(inside-far,BAND_TUNING.perTile,'one tile too far');
 assert.equal(inside-chance(18),BAND_TUNING.cap,'three tiles out is the cap');
 const e=foe(g,12);assert.equal(g.accuracy(p,e).rangePenalty,BAND_TUNING.perTile);
 assert.equal(targetDetails(g,e).distance.includes(`有效 ${WEAPON_BANDS.rifle[0]}–${WEAPON_BANDS.rifle[1]}`),true);
 assert.ok(targetDetails(g,e).state.includes(`太近 −${BAND_TUNING.perTile}`));
});

test('the long barrel and the recon extended burst push the far edge out only',()=>{
 const plain=weaponStats(0),long=weaponStats(0,'longbarrel');
 assert.deepEqual(plain.band,WEAPON_BANDS.rifle);assert.deepEqual(long.band,[WEAPON_BANDS.rifle[0],WEAPON_BANDS.rifle[1]+2]);
 const recon={traits:[]};grantTrait(recon,'extended_burst','test');
 assert.deepEqual(weaponStats(2,null,recon).band,[WEAPON_BANDS.smg[0],WEAPON_BANDS.smg[1]+2]);
 assert.deepEqual(weaponStats(2).band,WEAPON_BANDS.smg);
});

test('the shotgun, the launcher and melee have no band',()=>{
 for(const slot of [1,5,7])assert.equal(weaponStats(slot).band??null,null,`slot ${slot}`);
 const g=still(arena()),p=g.player;p.weapon=1;if(!p.owned.includes(1))p.owned.push(1);p.shell=20;p.ammo[1]=4;g.reveal();
 const e=foe(g,16);assert.equal(g.accuracy(p,e).rangePenalty,0);
});

test('enemies shoot at their own band; a rifleman is as blind up close as the player',()=>{
 const g=still(arena()),p=g.player,e=foe(g,12);
 assert.deepEqual(enemyBand('rifleman'),ENEMY_BANDS.rifleman);
 assert.deepEqual(enemyBand('rifleman_armored'),ENEMY_BANDS.rifleman,'a variant keeps its base band');
 assert.equal(g.accuracy(e,p).rangePenalty,BAND_TUNING.perTile);
 e.x=13;g.reveal();assert.equal(g.accuracy(e,p).rangePenalty,0);
});

test('a shooter standing too close backs off before firing, and fires anyway when it cannot move',()=>{
 const g=arena(),p=g.player,e=foe(g,12);   // two tiles away, the rifleman's band starts at three
 g.rng=Object.assign(()=>0,{state:()=>1});
 g.enemyAct(e);
 assert.ok(e.moved,'it stepped away instead of shooting from a bad distance');
 assert.ok(g.accuracy(e,p).rangePenalty<BAND_TUNING.perTile*2,'and it is closer to its band than before');
 const boxed=arena(),q=boxed.player,f=foe(boxed,12);
 for(const [x,y] of [[13,10],[12,9],[12,11],[11,9],[11,11]])boxed.grid[y][x]=0;   // a pocket: every way out leads to you
 boxed.reveal();boxed.rng=Object.assign(()=>0,{state:()=>1});
 boxed.enemyAct(f);
 assert.ok(!f.moved&&f.charge,'nowhere better to stand, so it takes the shot anyway');
 const contact=arena(),c=foe(contact,11);contact.rng=Object.assign(()=>0,{state:()=>1});contact.enemyAct(c);
 assert.ok(!c.moved&&c.charge,'and nobody steps out of contact: next to you it shoots where it stands');
});
