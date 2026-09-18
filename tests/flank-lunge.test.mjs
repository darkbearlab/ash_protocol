import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {activeTrait,grantTrait} from '../src/traits.js';
import {sweptGrid,sweptClear} from '../src/line-move.js';
import {flankSpot,orderFlank,openShot} from '../src/flank.js';

// 3.132.0 (user request 2026-09-18): the straight-line move behind the grapple, made general; 突進 (lunge) built on
// it; and the flank order. Lunge and flank are given to nobody yet.
function field({walls=[],crate=null}={}){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));for(const [x,y] of walls)g.grid[y][x]=0;g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=crate?[{id:'crate',x:crate.x,y:crate.y,type:'cover',hp:60,maxHp:60}]:[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'loyalist');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};

test('a straight sweep is stopped by walls and by other units, never by the mover itself',()=>{
  const g=field({walls:[[5,8]]}),e=unit(g,'rifleman',2,8,'e');
  assert.ok(sweptClear(g,e,{x:4,y:8}));assert.ok(!sweptClear(g,e,{x:6,y:8}),'a wall in the way');
  unit(g,'rifleman',3,5,'b');assert.ok(!sweptClear(g,e,{x:3,y:5}),'a unit stands there');
  assert.equal(sweptGrid(g,e)[8][2],1,'its own tile stays open');
});

test('突進: along its route it covers up to three tiles in one sweep; without the trait it takes one step',()=>{
  const plain=field(),a=unit(plain,'rifleman',3,4,'a'),goal={x:12,y:4};
  assert.deepEqual(plain.nextStep(a,goal),{x:4,y:4});
  const g=field(),e=unit(g,'rifleman',3,4,'e');grantTrait(e,'lunge','test');
  assert.deepEqual(g.nextStep(e,goal),{x:6,y:4},'three tiles in one go');
  unit(g,'rifleman',5,4,'b');const around=g.nextStep(e,goal);
  assert.notDeepEqual(around,{x:6,y:4},'never through a body in the lane');assert.ok(sweptClear(g,e,around),'it goes round it in one clear sweep');
  const near=field(),n=unit(near,'rifleman',10,13,'n');grantTrait(n,'lunge','test');
  assert.deepEqual(near.nextStep(n,near.player),{x:10,y:15},'at you, it lands beside you, never on you');
});

test('side attack: it picks a spot your cover does not face, walks there unseen and fires once it has the open shot',()=>{
  const g=field({crate:{x:10,y:15}}),e=unit(g,'rifleman',10,10,'e');
  assert.ok(!openShot(g,e,g.player),'from the north the crate protects you');
  const spot=flankSpot(g,e,g.player);assert.ok(spot);assert.ok(openShot(g,{...e,...spot},g.player));
  assert.ok(orderFlank(g,e));assert.equal(e.order.kind,'flank');assert.ok(activeTrait(e,'detour'));
  const shots=e.attackCount||0;let fired=false;
  for(let i=0;i<10&&!fired;i++){g.action('wait');fired=(e.attackCount||0)>shots||Boolean(e.charge);}
  assert.ok(fired,'it gets its shot in');assert.equal(e.order,undefined,'and the order is done');
  assert.ok(!activeTrait(e,'detour'));
});

test('being hit breaks a side attack; lunge and side attack belong to no card yet',()=>{
  const g=field({crate:{x:10,y:15}}),e=unit(g,'rifleman',10,10,'e');orderFlank(g,e,{by:'test'});g.hurt(e,1,g.player);assert.equal(e.order,undefined);
  for(const [id,def] of Object.entries(ENEMY_TYPES))assert.ok(!(def.traits||[]).includes('lunge')&&!(def.accepts||[]).includes('flank'),id);
});
