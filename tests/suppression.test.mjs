import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {applySuppression,finishSuppression,tickSuppression,pinned,suppressionState} from '../src/suppression.js';
import {grantTrait} from '../src/traits.js';
import {actorStat} from '../src/actor-stats.js';
import {suppressiveFire,suppressiveArea} from '../src/suppressive-fire.js';
import {volleyAt} from '../src/weapons.js';
import {applyPerk,ammoDropChance} from '../src/perks.js';
import {PERKS} from '../src/data.js';
export function arena(character='soldier'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10});for(const a of g.allies)Object.assign(a,{x:11,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
}
const foe=(g,type='rifleman',x=14,y=10)=>{const e=makeEnemy(type,x,y,`test-${g.enemies.length}`,1);e.hp=e.maxHp=500;g.enemies.push(e);g.target=e.id;g.reveal();return e;};
const sure=g=>g.rng=Object.assign(()=>0,{state:()=>1});
const arm=(g,slot)=>{g.player.owned=[slot];g.player.weapon=slot;g.player.ammo[slot]=g.weapon.mag;};
const skill=g=>{g.player.skills.push('suppressive_fire');g.player.skillState.suppressive_fire={remaining:0,cooldown:0};g.player.prepared.skill='suppressive_fire';};
test('suppression caps at five, penalizes both channels, halves only at world end; machines immune and bosses subtract once',()=>{
 const g=arena(),e=foe(g);applySuppression(e,9);assert.equal(e.suppression,5);assert.ok(pinned(e));assert.equal(actorStat(e,'rangedAccuracy'),-40);assert.equal(actorStat(e,'meleeAccuracy'),-40);tickSuppression(e);assert.equal(e.suppression,2);tickSuppression(e);assert.equal(e.suppression,1);tickSuppression(e);assert.equal(e.suppression,0);
 for(const type of ['boss','warden']){const b=foe(g,type);b.traits=b.traits.filter(t=>t.id!=='mechanical');finishSuppression([b],new Set([b]),3,1);assert.equal(b.suppression,1);applySuppression(b,1);assert.equal(b.suppression,1);}
 const m=foe(g,'drone');applySuppression(m,5);assert.equal(m.suppression,0);assert.ok(suppressionState(m).immune);
});
test('two single-stack sources sustain immobilization after first turn',()=>{const e={hp:100,type:'rifleman'};const values=[];for(let i=0;i<5;i++){applySuppression(e,1);applySuppression(e,1);values.push(e.suppression);tickSuppression(e);}assert.deepEqual(values,[2,3,3,3,3]);});
test('weapon passive uses rounds actually fired, at least one hit, once per attack; no melee or grenade source',()=>{
 const g=arena(),e=foe(g);arm(g,6);sure(g);g.fire();assert.equal(e.suppression,1);assert.equal(g.player.ammo[6],27);delete e.suppression;g.player.ammo[6]=2;g.fire();assert.equal(e.suppression,undefined);
 g.player.ammo[6]=30;g.rng=Object.assign(()=>.999,{state:()=>1});g.fire();assert.equal(e.suppression,undefined);
});
test('rapid fire extends bursts and recon long-range single shots, lowers all firearm accuracy, includes launchers',()=>{
 const g=arena('recon');grantTrait(g.player,'rapid_fire','qa');assert.equal(volleyAt(g.weapon,5),3);assert.equal(volleyAt(g.weapon,6),2);assert.equal(g.weapon.accuracyBonus,-10);g.player.affixes[2]='longbarrel';assert.equal(volleyAt(g.weapon,7),3);assert.equal(volleyAt(g.weapon,8),2);arm(g,5);assert.equal(volleyAt(g.weapon,3),2);assert.equal(g.weapon.accuracyBonus,-10);arm(g,9);assert.equal(g.weapon.accuracyBonus,0);
});
test('suppressed player can shoot, reload, wait, bump melee and open doors, but cannot walk, swap or shadowstep',()=>{
 const g=arena(),e=foe(g,'rifleman',11);g.player.suppression=3;const turn=g.turn;assert.equal(g.action('move',[0,1]),false);assert.equal(g.turn,turn);sure(g);assert.ok(g.action('move',[1,0]));assert.equal(g.player.x,10);assert.ok(e.hp<500);assert.equal(g.player.suppression,1);
 g.player.suppression=3;g.shadowSteps=1;assert.equal(g.action('move',[0,1]),false);assert.equal(g.player.y,10);
});
test('suppressed enemies stay put rather than seek cover or approach, but still charge and attack',()=>{
 const g=arena(),e=foe(g,'crawler',15);e.suppression=3;e.alert=true;g.enemyAct(e);assert.equal(e.x,15);e.x=11;g.enemyAct(e);assert.ok(e.charge);sure(g);const hp=g.player.hp;g.enemyAct(e);assert.ok(g.player.hp<hp);assert.equal(e.suppression,3);
});
test('free attacks preserve stacks; paid disabled opportunities still halve them',()=>{
 const g=arena(),e=foe(g);sure(g);e.suppression=4;g.pursuit=1;const t=g.turn;assert.ok(g.action('fire'));assert.equal(g.turn,t);assert.equal(e.suppression,4);e.control.disabled=1;assert.ok(g.action('wait'));assert.equal(e.suppression,2);
});
test('area skill validates before paying, runs through prepared entry, adds hit and guaranteed sources only once',()=>{
 const g=arena(),e=foe(g);skill(g);sure(g);const t=g.turn;g.player.ammo[0]=2;assert.equal(g.action('usePrepared',{category:'skill',target:{x:14,y:10}}),false);assert.equal(g.turn,t);g.player.ammo[0]=8;g.enemyAct=()=>{};assert.ok(g.action('usePrepared',{category:'skill',target:{x:14,y:10}}));assert.equal(g.player.ammo[0],5);assert.equal(e.suppression,1,'2 aggregate then world half');assert.equal(g.player.skillState.suppressive_fire.cooldown,0);
});
test('area skill distributes actual rounds and suppresses missed/corner-hidden targets without damage',()=>{
 const g=arena(),a=foe(g),b=foe(g,'rifleman',14,11);skill(g);sure(g);g.shotClear=(actor,target)=>target!==b;const before=b.hp;suppressiveFire(g,{x:14,y:10});assert.ok(a.hp<500);assert.equal(b.hp,before);assert.equal(a.suppression,2);assert.equal(b.suppression,1);assert.equal(g.player.ammo[0],5);assert.equal(suppressiveArea(g,{x:14,y:10}).length,5);
 const h=arena(),e=foe(h);skill(h);h.rng=Object.assign(()=>.999,{state:()=>1});suppressiveFire(h,e);assert.equal(e.hp,500);assert.equal(e.suppression,1);
});
test('explosive skill and barrel chains cannot damage hidden enemies',()=>{
 const g=arena(),a=foe(g),b=foe(g,'rifleman',14,11);skill(g);arm(g,8);sure(g);g.shotClear=(actor,target)=>target!==b;g.props.push({id:'barrel',type:'barrel',x:15,y:10,hp:1,maxHp:1});suppressiveFire(g,a);assert.equal(b.hp,500);assert.equal(b.suppression,1);
});
test('committed skill fires into its fixed area after targets leave the ray; rapid fire consumes four',()=>{
 const g=arena();skill(g);grantTrait(g.player,'rapid_fire','qa');g.shotClear=()=>false;const e=foe(g);suppressiveFire(g,e);assert.equal(e.hp,500);assert.equal(e.suppression,1);assert.equal(g.player.ammo[0],4);
});
test('current saves reject malformed suppression and inventory; v36 migrates away old pet effect without changing resources',()=>{
 const g=arena(),e=foe(g);e.suppression=4;assert.ok(Game.restore(g.serialize()));for(const value of [-1,6,.5,'2']){const raw=JSON.parse(g.serialize());raw.data.enemies[0].suppression=value;assert.equal(Game.restore(JSON.stringify(raw)),null);}
 const raw=JSON.parse(g.serialize());raw.version=36;delete raw.data.player.learningItems;raw.data.enemies[0].petSuppressed=15;const copy=Game.restore(JSON.stringify(raw));assert.ok(copy);assert.equal(copy.enemies[0].petSuppressed,undefined);assert.deepEqual(copy.player.learningItems,{});assert.equal(copy.player.reserve,g.player.reserve);
 const bad=JSON.parse(g.serialize());delete bad.data.player.learningItems;assert.equal(Game.restore(JSON.stringify(bad)),null);
});
test('real corner geometry admits guaranteed area suppression while blocking bullet damage',()=>{
 const g=arena();Object.assign(g.player,{x:12,y:11});for(let y=1;y<=10;y++)g.grid[y][10]=0;
 const e=foe(g,'rifleman',9,10);skill(g);sure(g);assert.ok(g.visible(e));assert.equal(g.shotClear(g.player,e),false);
 assert.ok(g.action('usePrepared',{category:'skill',target:{x:9,y:10}}));assert.equal(e.hp,500);assert.equal(g.player.ammo[0],5);
 assert.equal(e.suppression,0,'one guaranteed stack halves to zero after affecting enemy opportunity');
});
test('ammo recovery has three capped tiers and excluded enemies still drop nothing',()=>{
 const chances=[.35,.5,.65,.8],perk=PERKS.find(p=>p.id==='ammo_recovery');assert.equal(perk.cap,3);
 for(let rank=0;rank<4;rank++){
  const g=arena();for(let i=0;i<rank;i++)applyPerk(g,perk);assert.ok(Math.abs(ammoDropChance(g.player)-chances[rank])<1e-9);
  const e=foe(g,'crawler');g.rng=Object.assign(()=>chances[rank]-.001,{state:()=>1});g.hurt(e,999);assert.ok(g.items.some(i=>i.type==='ammo'));
 }
 for(const flag of ['reinforcement','expendable']){const g=arena(),e=foe(g,'crawler');e[flag]=true;g.player.perks.ammo_recovery=3;sure(g);g.hurt(e,999);assert.deepEqual(g.items,[]);}
});
test('learned anchor fires suppression skill at normal and slow phases; each volley pays separately',()=>{
 const g=arena(),e=foe(g);skill(g);g.player.skills.push('anchor');g.player.skillState.anchor={remaining:1,cooldown:0};grantTrait(g.player,'clumsy','skill:anchor');sure(g);g.enemyAct=()=>{};
 assert.ok(g.action('usePrepared',{category:'skill',target:{x:e.x,y:e.y}}));assert.equal(g.player.ammo[0],2);assert.equal(e.suppression,2,'four stacks followed by halving');
});
