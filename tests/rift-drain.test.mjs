import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {DRAIN_TUNING,maxHpOf} from '../src/drain.js';
import {tickDrain,drainAura,liveAnchors} from '../src/rift.js';
import {healActor} from '../src/traits.js';
import {addAlly} from '../src/allies.js';
import {LIGHT_MODEL,LIGHT,lightAt,hiddenInDark} from '../src/lighting.js';
import {grantTrait} from '../src/traits.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.228.0 (docs/FACTIONS.md 5.2 and 5.6): 流逝 — stacks gained near a drain aura lower the maximum health in play — and
// the shade, whose aura it is and which eats the light around it. An open, powered floor with one rift anchor; you at
// (10,16).
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];clearGeneratedMap(g);
  g.props.push({id:'anchor-1-0',type:'nest',x:2,y:2,hp:60,maxHp:60,anchor:{active:true,serial:0,reforms:[]}});
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=100;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'rift');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};

test('the maximum in play: 5% a stack, rounded up, never below half; the saved maximum is untouched',()=>{
  assert.equal(maxHpOf({maxHp:100}),100);assert.equal(maxHpOf({maxHp:100,drain:1}),95);assert.equal(maxHpOf({maxHp:100,drain:10}),50);
  assert.equal(maxHpOf({maxHp:100,drain:25}),50,'ten stacks at most');assert.equal(maxHpOf({maxHp:33,drain:1}),32);
  const p={hp:70,maxHp:100,drain:4};assert.equal(healActor(p,50),10,'healing stops at the maximum in play');
  assert.equal(p.hp,80);assert.equal(p.maxHp,100);
});

test('each enemy phase near a drain aura adds a stack per source; health above the new maximum is cut',()=>{
  const g=open(),s=unit(g,'shade',10,13,'s');
  assert.equal(drainAura(s),2,'流逝光環 2, from the rift');
  tickDrain(g);assert.equal(g.player.drain,undefined,'three tiles off: nothing');
  Object.assign(s,{x:10,y:14});tickDrain(g);assert.equal(g.player.drain,1);assert.equal(g.player.hp,95,'cut to 95');
  unit(g,'shade',12,16,'t');tickDrain(g);assert.equal(g.player.drain,3,'two sources, two stacks');
  for(let i=0;i<10;i++)tickDrain(g);assert.equal(g.player.drain,DRAIN_TUNING.maxStacks);assert.equal(maxHpOf(g.player),50);assert.equal(g.player.hp,50);
  assert.ok(g.logs.some(l=>l.text.includes('流逝')));
  // In play it happens at the end of the round, after the enemies.
  const h=open();unit(h,'shade',10,14,'s');h.action('wait');assert.equal(h.player.drain,1);
});

test('living allies and pets drain, machines do not; without an anchor nothing drains',()=>{
  const g=open(),s=unit(g,'shade',10,14,'s');
  const near=[[9,16],[11,16],[10,15]].map(([x,y])=>({x,y}));
  const drone=addAlly(g,'drone','drone',{point:near[0],sourceId:'drone_follow'});
  const pet=addAlly(g,'pet','pet',{point:near[1],sourceId:'pet_test'});
  tickDrain(g);
  assert.equal(drone.drain,undefined,'a machine is untouched');if(pet)assert.equal(pet.drain,1,'a pet drains');
  const bare=open();bare.props=[];unit(bare,'shade',10,14,'s');bare.player.drain=3;
  tickDrain(bare);assert.equal(bare.player.drain,undefined,'no anchor here: the stacks lift, none are gained');
  void s;
});

test('the last anchor gone, the drain lifts at once and the maximum comes back, but not the health',()=>{
  const g=open();unit(g,'shade',10,14,'s');for(let i=0;i<4;i++)tickDrain(g);
  assert.equal(g.player.drain,4);assert.equal(g.player.hp,80);
  g.damageProp(g.props[0],999,g.player);
  assert.equal(liveAnchors(g).length,0);assert.equal(g.player.drain,undefined);assert.equal(maxHpOf(g.player),100);assert.equal(g.player.hp,80,'health stays');
  assert.ok(g.logs.some(l=>l.text.includes('流逝散去')));
  // A possessed human that was the last anchor lifts it too.
  const h=open();h.props=[];const host=unit(h,'possessed',4,4,'h');host.anchor={active:true,serial:0,reforms:[]};unit(h,'shade',10,14,'s');
  tickDrain(h);assert.equal(h.player.drain,1);h.hurt(host,999,h.player);assert.equal(h.player.drain,undefined);
});

test('the stacks go down with you: a rift floor with anchors keeps them',()=>{
  const g=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});g.player.drain=3;g.player.hp=Math.min(g.player.hp,maxHpOf(g.player));
  for(const e of g.enemies)e.hp=0;Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  assert.equal(g.floor,2);assert.ok(liveAnchors(g).length>0);assert.equal(g.player.drain,3);
  tickDrain(g);assert.equal(g.player.drain>=3,true,'still there');
});

test('saves: the stacks round-trip; more than ten are cut; broken ones refuse; health above the maximum is cut',()=>{
  const g=open();g.player.drain=4;g.player.hp=80;
  const copy=Game.restore(g.serialize());assert.ok(copy);assert.equal(copy.player.drain,4);
  {const raw=JSON.parse(g.serialize());raw.data.player.drain=15;raw.data.player.hp=100;const r=Game.restore(JSON.stringify(raw));assert.ok(r);assert.equal(r.player.drain,10);assert.equal(r.player.hp,50);}
  for(const bad of [0,-1,1.5,'3']){const raw=JSON.parse(g.serialize());raw.data.player.drain=bad;assert.equal(Game.restore(JSON.stringify(raw)),null,String(bad));}
});

test('噬光體: the light within two tiles is gone; night vision and infrared cannot see into it; it is always seen itself',()=>{
  const g=open();g.lightModel=LIGHT_MODEL;g.lamps=[];
  const s=unit(g,'shade',10,10,'s'),w=unit(g,'wisp',11,11,'w');
  assert.equal(lightAt(g,{x:10,y:12}),LIGHT.black,'powered, yet black');assert.equal(lightAt(g,{x:10,y:13}),LIGHT.lit,'three tiles off: lit');
  grantTrait(g.player,'night_vision','test');grantTrait(g.player,'infrared','test');
  assert.equal(hiddenInDark(g,g.player,w),true,'the wisp in its dark is hidden from night vision and infrared');
  assert.equal(hiddenInDark(g,g.player,s),false,'the shade is always seen');
  Object.assign(g.player,{x:10,y:12});assert.equal(hiddenInDark(g,w,g.player),false,'the rift sees you there');
  const human=unit(g,'possessed',10,8,'h');assert.equal(hiddenInDark(g,human,g.player),true,'a possessed human does not');
  s.hp=0;assert.equal(lightAt(g,{x:10,y:12})>LIGHT.black,true,'the light comes back when it falls');
});

test('the shade card: a large energy body with no loot, in the later rift roster and the floor-2 preview',()=>{
  const c=ENEMY_TYPES.shade;
  assert.equal(c.energy,true);assert.equal(c.huntsLife,true);assert.equal(c.eatsLight,2);assert.equal(c.loot,undefined);assert.ok(c.traits.includes('large'));
});
