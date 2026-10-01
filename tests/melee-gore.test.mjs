// 3.211.0 (user decisions 2026-10-01, docs/KILL_GORE.md 近戰的甩出血光): a melee kill by anyone flings its gore —
// slashes sweep it sideways across the blow in an arc with an arc-shaped smear, the spear's thrust runs it straight
// through and behind, the chainsaw sprays it fine and long; heavier weapons throw more and wider. Guns and blasts keep
// their bursts; the setting, the palettes and the darkness are the same as every burst's.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily} from './helpers/source.mjs';
import {GORE_PALETTES,goreForce,meleeCut,meleeFling,enemyBurst,burstLife,FLING_TUNING} from '../src/gore.js';
import {planPresentation} from '../src/presentation.js';

const at={x:5,y:5},blow={dx:1,dy:0},seeds=[...Array(40).keys()].map(i=>i+1),mean=l=>l.reduce((a,b)=>a+b,0)/l.length;
const strike=(extra)=>goreForce([{type:'shot',from:{x:4,y:5},to:at,damage:0,...extra},{type:'impact',from:at,to:at,damage:30}],at);
// Angle of a piece relative to the blow, in (-π, π].
const rel=(b,a)=>Math.atan2(Math.sin(a-Math.atan2(blow.dy,blow.dx)),Math.cos(a-Math.atan2(blow.dy,blow.dx)));

test('a melee blow is told apart from a shot, by anyone: how it cut and how heavy it was',()=>{
 assert.deepEqual(strike({weaponId:'rifle'}),{style:'bullet',damage:30},'a rifle round is unchanged');
 assert.equal(strike({weaponId:'shotgun'}).style,'pellet');assert.equal(strike({weaponId:'shotgun'}).range,1,'and how far the shotgun was fired');
 for(const [weaponId,cut] of [['katana','slash'],['axe','slash'],['sabre','slash'],['knife','slash'],['claws','slash'],['powerfist','slash'],['spear','thrust'],['chainsaw','saw'],['unarmed','slash']])
  assert.deepEqual([strike({weaponId,style:'slash'}).style,strike({weaponId,style:'slash'}).cut],['melee',cut],weaponId);
 const heft=id=>meleeCut({weaponId:id}).heft;
 assert.ok(heft('powerfist')>heft('axe')&&heft('axe')>heft('katana')&&heft('katana')>heft('knife')&&heft('knife')>heft('claws'),'heavier weapons have more heft');
 assert.ok(Math.abs(heft('katana')-1)<.05,'the katana is the yardstick');
 // Enemies: a brute's blade (drawn as a slash), a swarm claw, and the melee cards whose swing has no style of its own.
 assert.equal(strike({type:'enemyShot',attackerType:'brute',style:'slash'}).style,'melee','a brute\'s blow was a bullet before 3.211.0');
 assert.equal(goreForce([{type:'enemyShot',attackerType:'crawler',style:'claw',from:{x:4,y:5},to:at,damage:12}],at).style,'melee');
 assert.equal(goreForce([{type:'enemyShot',attackerType:'fodder',from:{x:4,y:5},to:at,damage:4}],at).style,'melee','a melee card striking a friend of yours');
 assert.equal(goreForce([{type:'enemyShot',attackerType:'rifleman',style:'bullet',from:{x:4,y:5},to:at,damage:12}],at).style,'bullet');
 assert.equal(goreForce([{type:'enemyShot',attackerType:'delisted_ninja',style:'slash',from:{x:4,y:5},to:at,damage:30}],at).style,'melee','the knife of a gunner up close (its blow drawn as a slash)');
 assert.ok(meleeCut({attackerType:'brute'}).heft>meleeCut({attackerType:'crawler'}).heft,'a brute swings heavier than a crawler');
 // A pet's bite (its own weapon id, drawn as a claw).
 assert.equal(strike({weaponId:'pet_bite',style:'claw'}).style,'melee');
});

test('a slash sweeps its gore sideways in an arc, to the kill\'s side, leaving an arc-shaped smear',()=>{
 const sides=new Set();
 for(const s of seeds){
  const b=meleeFling(s,blow,{cut:'slash',heft:1});sides.add(b.side);
  const angles=b.drops.map(d=>rel(b,d.a)*b.side);
  assert.ok(Math.max(...angles)>1.2,'sweeps well round to its side');assert.ok(mean(angles)>.3,'mostly to that side');assert.ok(Math.min(...angles)>-.6,'barely to the other');
  // The sweep: pieces leave later the further round they go.
  const order=[...b.drops].sort((p,q)=>p.t0-q.t0),first=order.slice(0,5),last=order.slice(-5);
  assert.ok(mean(last.map(d=>rel(b,d.a)*b.side))>mean(first.map(d=>rel(b,d.a)*b.side))+.8,'the swing reads as a sweep');
  assert.ok(Math.max(...b.drops.map(d=>d.t0))<=FLING_TUNING.slash.sweep+1e-9&&Math.max(...b.drops.map(d=>d.t0))>FLING_TUNING.slash.sweep*.8,'over the time of the sweep');
  // The smear: a curve at a near-constant distance, round through more than a radian.
  const r=b.smear.map(m=>Math.hypot(m.x,m.y)),a=b.smear.map(m=>Math.atan2(m.y,m.x));
  assert.ok(b.smear.length>=12&&Math.max(...r)<Math.min(...r)*1.5&&Math.max(...a)-Math.min(...a)>1,'an arc, not a line');
 }
 assert.deepEqual([...sides].sort(),[-1,1],'either side, by the kill');
 assert.equal(meleeFling(7,blow).side,meleeFling(7,blow).side,'fixed for the same kill');
});

test('heavier weapons throw a wider arc and more chunks; light ones a thinner one',()=>{
 const avg=(heft,f)=>mean(seeds.map(s=>f(meleeFling(s,blow,{cut:'slash',heft}))));
 const span=b=>{const a=b.drops.map(d=>rel(b,d.a)*b.side);return Math.max(...a)-Math.min(...a);},chunks=b=>b.drops.filter(d=>d.size>=.06).length,width=b=>mean(b.smear.map(m=>m.w)),reach=b=>mean(b.drops.map(d=>d.D));
 assert.ok(avg(1.6,b=>b.drops.length)>avg(.6,b=>b.drops.length)*1.3,'more pieces');
 assert.ok(avg(1.6,span)>avg(.6,span),'a wider arc');assert.ok(avg(1.6,reach)>avg(.6,reach)*1.3,'thrown further');
 assert.ok(avg(1.6,chunks)>avg(.6,chunks)*1.5,'more chunks');assert.ok(avg(1.6,width)>avg(.6,width)*1.3,'a thicker smear');
});

test('a thrust runs straight through and behind the body; a saw sprays fine and long',()=>{
 for(const s of seeds){
  const t=meleeFling(s,blow,{cut:'thrust'});
  assert.ok(t.drops.every(d=>Math.abs(rel(t,d.a))<=FLING_TUNING.thrust.spread/2+.09),'a narrow line along the blow');
  assert.ok(Math.max(...t.drops.map(d=>d.D))>1.2,'well behind the body');
  assert.ok(t.smear.every(m=>Math.abs(Math.atan2(m.y,m.x)-t.away)<1e-9)&&t.smear.every(m=>m.x>0),'a straight streak behind it');
  const saw=meleeFling(s,blow,{cut:'saw'});
  assert.ok(saw.drops.length>t.drops.length,'more, finer pieces');assert.ok(mean(saw.drops.map(d=>d.size))<mean(t.drops.map(d=>d.size)));
  assert.ok(Math.max(...saw.drops.map(d=>d.t0))>.3,'sprayed over a while, not at once');assert.equal(saw.smear.length,0,'it lands as a sheet');
 }
});

test('the same palettes and setting as every burst: off is none, simple has no light, machines spark',()=>{
 assert.equal(meleeFling(3,blow,{level:'off'}),null);assert.equal(meleeFling(3,null),null,'no direction, no fling');
 for(const kind of ['flesh','swarm','mech']){const b=meleeFling(3,blow,{kind});assert.ok(b.drops.every(d=>GORE_PALETTES[kind].drops.includes(d.color)),kind);assert.ok(b.smear.every(m=>GORE_PALETTES[kind].drops.includes(m.color)));}
 assert.equal(meleeFling(3,blow,{level:'simple'}).sparks.length,0);assert.equal(meleeFling(3,blow,{level:'simple'}).light,0);
 assert.ok(meleeFling(3,blow,{kind:'mech'}).sparks.length>meleeFling(3,blow,{kind:'flesh'}).sparks.length);
 assert.ok(mean(seeds.map(s=>meleeFling(s,blow,{size:2.2}).drops.length))>mean(seeds.map(s=>meleeFling(s,blow,{size:.6}).drops.length))*2,'bodies by their size');
 // It stays in the air until its last piece lands and its smear is stamped.
 const b=meleeFling(3,blow,{cut:'saw'});assert.ok(burstLife(b)>=Math.max(...b.drops.map(d=>d.t0+d.land)));
});

test('the renderer flings a melee kill by anyone and keeps the burst for guns and blasts',()=>{
 const player={x:4,y:5,hp:50,character:'soldier'};
 const state=hp=>({player,enemies:[{id:'1-1',type:'rifleman',faction:'loyalist',x:5,y:5,hp}],allies:[],items:[],logs:[],visible:()=>true});
 const fall=effects=>planPresentation([{before:state(8),after:state(0),effects}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall');
 const blade=fall([{type:'shot',weaponId:'katana',style:'slash',from:{x:4,y:5},to:at,damage:0},{type:'impact',from:at,to:at,damage:30}]);
 assert.equal(blade.force.style,'melee');assert.equal(blade.force.cut,'slash');assert.ok(blade.enemy,'an enemy\'s fall, for the corpse layer');
 const ally={id:'a1',kind:'drone',type:'rifleman',x:5,y:5,hp:8,status:'active',floor:1};
 const down=planPresentation([{before:{player,enemies:[],allies:[ally],items:[],logs:[]},after:{player,enemies:[],allies:[{...ally,hp:0}],items:[],logs:[]},effects:[{type:'enemyShot',attackerType:'brute',style:'slash',from:{x:4,y:5},to:at,damage:20}]}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall');
 assert.equal(down.force.style,'melee','an enemy\'s blade killing a unit of yours flings too');assert.ok(!down.enemy,'yours is no corpse-layer body');
 const effects=sourceFamily('renderer');
 assert.match(effects,/force\?\.style==='melee'\?meleeFling\(/,'melee kills fling');assert.match(effects,/enemyBurst\(seed,e\.blow/,'the rest burst as before');
 // A gun kill's burst is untouched by any of this.
 assert.deepEqual(enemyBurst(9,blow,{style:'bullet'}),enemyBurst(9,blow,{style:'bullet'}));
});
