import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {WARP_TUNING,warpPlan,landing} from '../src/rift-warp.js';
import {BEAM_TUNING,beamLane} from '../src/rift-beam.js';
import {ENEMY_AFFIXES} from '../src/enemy-affixes.js';
import {topCarriers} from '../src/enemy-specials.js';
import {addAlly} from '../src/allies.js';
import {distance,key} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.231.0 (docs/FACTIONS.md 5.9): the displacer moves you if you stay put; the ray body warns a line, then fires along it.
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];clearGeneratedMap(g);
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'rift');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};
const said=(g,text)=>g.logs.some(l=>l.text.includes(text));

test('錯位體: it marks a spot 3–4 tiles from you, by the rift, and moves you there if you stay put',()=>{
  const g=open(),d=unit(g,'displacer',10,12,'d'),w=unit(g,'wisp',14,17,'w');w.alert=false;
  g.action('wait');
  const m=d.warpIntent;assert.ok(m,'marked');assert.deepEqual(m.target,{x:10,y:16});
  const gap=distance(m.point,m.target);assert.ok(gap>=WARP_TUNING.near&&gap<=WARP_TUNING.far);
  assert.ok(distance(m.point,w)<=WARP_TUNING.crowd,'among the rift');assert.ok(said(g,'扭曲'));
  g.action('wait');
  assert.deepEqual({x:g.player.x,y:g.player.y},m.point,'moved');assert.equal(d.warpIntent,undefined);assert.ok(d.warpCooldown>0);
  assert.ok(said(g,'扯到'));assert.ok(g.effects.some(fx=>fx.type==='portalSpawn'));
});

test('step off the tile and the displacement misses; a taken spot fizzles; an anchoring skill holds you',()=>{
  {const g=open(),d=unit(g,'displacer',10,12,'d');g.action('wait');assert.ok(d.warpIntent);g.action('move',[1,0]);assert.deepEqual([g.player.x,g.player.y],[11,16]);assert.ok(said(g,'落空'));}
  {const g=open(),d=unit(g,'displacer',10,12,'d');g.action('wait');const p=d.warpIntent.point;unit(g,'wisp',p.x,p.y,'w');g.action('wait');assert.deepEqual([g.player.x,g.player.y],[10,16]);assert.ok(said(g,'被占住'));}
  {const g=open(),d=unit(g,'displacer',10,12,'d');g.action('wait');g.player.skillState={anchor:{remaining:3}};g.action('wait');assert.deepEqual([g.player.x,g.player.y],[10,16]);assert.ok(said(g,'穩住'));void d;}
});

test('it only marks floor you could stand on with a way out: no hazard, no wall, no tile boxed in',()=>{
  const g=open();
  g.hazards.push({type:'acid',x:10,y:13,turns:5});
  assert.equal(landing(g,{x:10,y:13}),false,'a hazard');
  g.grid[5][5]=0;assert.equal(landing(g,{x:5,y:5}),false,'a wall');
  // A tile with walls on three sides and an enemy on the fourth: no way out.
  for(const [x,y] of [[2,3],[4,3],[3,2]])g.grid[y][x]=0;unit(g,'wisp',3,4,'w');
  assert.equal(landing(g,{x:3,y:3}),false,'boxed in');
  const d=unit(g,'displacer',10,12,'d'),plan=warpPlan(g,d);assert.ok(plan&&landing(g,plan.point));
  // Too close (beside you) or too far: no mark.
  const near=open(),a=unit(near,'displacer',10,15,'a');assert.equal(warpPlan(near,a),null);
  const far=open(),b=unit(far,'displacer',10,10,'b');assert.equal(warpPlan(far,b),null);
});

test('射線體: it marks a line through you, holds still, then fires along it; step off and it hits nothing',()=>{
  const g=open(),r=unit(g,'beamer',10,11,'r');
  g.action('wait');
  assert.ok(r.beamIntent,'marked');assert.deepEqual([r.x,r.y],[10,11],'it holds still');
  const lane=beamLane(g,r.beamIntent.origin,r.beamIntent.target);assert.ok(lane.some(q=>key(q)===key(g.player)));assert.equal(lane.length,BEAM_TUNING.range,'on to its reach');
  const hp=g.player.hp;g.action('wait');assert.ok(g.player.hp<hp,'hit');assert.equal(r.beamIntent,undefined);assert.ok(r.beamCooldown>0);assert.ok(said(g,'射線掃過'));
  const h=open(),s=unit(h,'beamer',10,11,'s');h.action('wait');h.action('move',[1,0]);const before=h.player.hp;
  // Its next turn fires: the move above was the turn it fired on, so the shot went down the line you left.
  assert.equal(h.player.hp,before);assert.ok(said(h,'沒打中'));void s;
});

test('the beam goes through every one of yours on the line; cover in between, or a door shut on it, stops it',()=>{
  const g=open(),r=unit(g,'beamer',10,11,'r');
  const pet=addAlly(g,'pet','pet',{point:{x:10,y:17},sourceId:'pet_test'});
  g.action('wait');assert.ok(r.beamIntent);
  const hp=g.player.hp,pp=pet?.hp;g.action('wait');
  assert.ok(g.player.hp<hp,'you');if(pet)assert.ok(pet.hp<pp,'and on through to the pet');
  const c=open(),q=unit(c,'beamer',10,11,'q');c.props.push({id:'c1',type:'cover',x:10,y:14,hp:80,maxHp:80});c.reveal();c.action('wait');assert.equal(q.beamIntent,undefined,'behind cover on its line: no mark');
  const d=open(),s=unit(d,'beamer',10,11,'s');d.action('wait');assert.ok(s.beamIntent);
  d.barriers.push(makeBarrier('door',{x:10,y:12},{x:10,y:13},'edge-door'));
  assert.equal(beamLane(d,s.beamIntent.origin,s.beamIntent.target).some(q=>q.y>=13),false,'the line stops at the door');
  const before=d.player.hp;d.action('wait');assert.equal(d.player.hp,before);
});

test('the cards: energy bodies with one top step each, and no affix that brings another',()=>{
  for(const id of ['displacer','beamer']){const c=ENEMY_TYPES[id];assert.equal(c.energy,true);assert.equal(c.huntsLife,true);assert.equal(c.loot,undefined);}
  for(const id of ['displacer','beamer']){
    const e=makeEnemy(id,1,1,id,3,0,'rift');assert.equal(topCarriers(e).length,1,id);
    for(const a of ['flamer','grenadier','lockdown','disarm'])assert.equal(ENEMY_AFFIXES.find(x=>x.id===a).applies(e),false,`${id} ${a}`);
  }
});

test('saves: marks round-trip; a moved carrier drops its mark; malformed marks refuse; cooldowns are cut',()=>{
  const g=open(),d=unit(g,'displacer',10,12,'d'),r=unit(g,'beamer',13,16,'r');g.action('wait');
  assert.ok(d.warpIntent&&r.beamIntent);
  const copy=Game.restore(g.serialize());assert.ok(copy);
  assert.deepEqual(copy.enemies.find(e=>e.id==='d').warpIntent,d.warpIntent);assert.deepEqual(copy.enemies.find(e=>e.id==='r').beamIntent,r.beamIntent);
  {const raw=JSON.parse(g.serialize());for(const e of raw.data.enemies)e.y-=1;const c=Game.restore(JSON.stringify(raw));assert.ok(c);assert.equal(c.enemies.find(e=>e.id==='d').warpIntent,undefined);assert.equal(c.enemies.find(e=>e.id==='r').beamIntent,undefined);}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='d').warpIntent.point={x:'a',y:1};assert.equal(Game.restore(JSON.stringify(raw)),null);}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='r').beamIntent.target=null;assert.equal(Game.restore(JSON.stringify(raw)),null);}
  {const raw=JSON.parse(g.serialize());const e=raw.data.enemies.find(e=>e.id==='d');delete e.warpIntent;e.warpCooldown=99;assert.equal(Game.restore(JSON.stringify(raw)).enemies.find(e=>e.id==='d').warpCooldown,WARP_TUNING.cooldown);}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='r').warpIntent={origin:{x:13,y:16},target:{x:10,y:16},point:{x:10,y:12}};assert.equal(Game.restore(JSON.stringify(raw)),null,'only a displacer carries one');}
});
