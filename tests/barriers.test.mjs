import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,generate,reachable,lineOfSight,combatSight,random} from '../src/engine.js';
import {makeBarrier,edgeCells,barrierBetween,blockedBetween,validBarriers,edgeKey,edgeCover} from '../src/barriers.js';
import {areaCells} from '../src/throwables.js';
import {grantTrait} from '../src/traits.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {targetDetails} from '../src/target-card.js';
import {Renderer} from '../src/renderer.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(corridor=false,character='soldier'){
  const g=new Game(316,[],0,character);g.barriers=[];g.grid=Array.from({length:SIZE},(_,y)=>Array(SIZE).fill(corridor&&y!==10?0:1));
  Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];clearGeneratedMap(g);
  g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function gate(g,type='door',a={x:10,y:10},b={x:11,y:10}){const e=makeBarrier(type,a,b,`edge-test-${g.barriers.length}`);g.barriers.push(e);g.reveal();return e;}
function enemy(g,type='rifleman',x=11,y=10){const e=makeEnemy(type,x,y,'enemy');Object.assign(e,{hp:300,maxHp:300,alert:true,charge:false,lastKnown:{x:g.player.x,y:g.player.y}});g.enemies.push(e);g.reveal();return e;}

test('one canonical boundary shares open/destruction state from either side and leaves both floors usable',()=>{
  const g=arena(),b=gate(g),[a,c]=edgeCells(b);assert.equal(barrierBetween(g.barriers,a,c),b);assert.equal(barrierBetween(g.barriers,c,a),b);
  assert.ok(g.passable(a.x,a.y)&&g.passable(c.x,c.y));assert.equal(g.canCross(a,c),false);b.open=true;assert.ok(g.canCross(c,a));b.open=false;b.hp=0;assert.ok(g.canCross(a,c));
});
test('walking into a closed door opens it for one turn without movement or waiting bonuses',()=>{
  const g=arena(true),b=gate(g);g.player.guard=g.player.focus=true;
  assert.ok(g.action('move',[1,0]));assert.equal(g.turn,2);assert.equal(b.open,true);assert.equal(g.player.x,10);assert.equal(g.player.moved,false);assert.equal(g.player.focus,false);
  assert.ok(g.action('move',[1,0]));assert.equal(g.player.x,11);assert.equal(g.player.moved,true);assert.ok(g.action('door',{id:b.id,open:false}));assert.equal(b.open,false);assert.equal(g.player.x,11);
  assert.equal(g.action('door',{id:b.id,open:false}),false);assert.equal(g.turn,4);
});
test('closed doors open before checking hidden occupancy; partitions reject movement without consuming time',()=>{
  const g=arena(true),b=gate(g);enemy(g);assert.ok(g.action('move',[1,0]));assert.equal(b.open,true);assert.equal(g.player.x,10);
  assert.equal(g.action('move',[1,0]),true);assert.equal(g.turn,3);assert.equal(g.player.x,10);assert.ok(g.effects.some(e=>e.weaponId==='unarmed'));
  const wall=arena(),p=gate(wall,'partition');assert.equal(wall.action('move',[1,0]),false);assert.equal(wall.turn,1);assert.equal(wall.target,p.id);assert.equal(wall.action('door',{id:p.id,open:true}),false);
});
test('open intent never becomes movement or a closing toggle when an earlier enemy changes that door',()=>{
  const g=arena(true),b=gate(g),e=enemy(g);grantTrait(e,'fast','test');g.enemyAct=()=>g.setDoor(b,true);
  assert.ok(g.action('move',[1,0]));assert.equal(g.player.x,10);assert.equal(b.open,true);assert.equal(g.turn,2);
  e.x=13;g.reveal();g.enemyAct=()=>g.setDoor(b,false);assert.ok(g.action('move',[1,0]));assert.equal(g.player.x,10);assert.equal(b.open,false);assert.equal(g.turn,3);
});
test('sealed single-cell and multi-cell compartments cannot be bypassed by leaning or diagonal corner rays',()=>{
  const g=arena();for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])gate(g,'partition',g.player,{x:10+dx,y:10+dy});
  for(let y=7;y<=13;y++)for(let x=7;x<=13;x++)if(x!==10||y!==10){assert.equal(g.sight(g.player,{x,y}),false,`${x},${y}`);assert.equal(g.sight({x,y},g.player),false);}
  g.barriers[0].hp=0;assert.ok(g.sight(g.player,{x:11,y:10}));assert.equal(g.sight(g.player,{x:9,y:10}),false);
  const h=arena(true);gate(h);assert.equal(h.visible({x:11,y:10}),false);assert.equal(lineOfSight(h.grid,{x:9,y:10},{x:12,y:10},h.barriers),false);
});
test('edge sight is symmetric for randomized integer and leaning rays',()=>{
  const rng=random(316),g=arena();
  for(let y=7;y<15;y++)for(let x=7;x<15;x++)if(rng()<.3)gate(g,'partition',{x,y},{x:x+1,y});
  for(let i=0;i<800;i++){const a={x:5+Math.floor(rng()*12),y:5+Math.floor(rng()*12)},b={x:5+Math.floor(rng()*12),y:5+Math.floor(rng()*12)};assert.equal(combatSight(g.grid,a,b,g.barriers),combatSight(g.grid,b,a,g.barriers),JSON.stringify([a,b]));}
});
test('edge cover has wall strength, respects direction/no-cover, and disappears when opened or destroyed',()=>{
  const g=arena(),e=enemy(g,'rifleman',12,9),b=gate(g);g.player.traits=[];
  assert.equal(g.protectingCover(g.player,e),b);assert.equal(g.accuracy(e,g.player).coverPenalty,42);assert.equal(edgeCover(g.barriers,g.player,{x:8,y:10}),null);
  g.damagePlayer(20,'test',e);assert.equal(g.player.hp,489);assert.equal(b.hp,53);
  grantTrait(g.player,'no_cover','test');assert.equal(g.protectingCover(g.player,e),null);assert.equal(g.canCross(g.player,{x:11,y:10}),false);
  g.player.traits=[];b.open=true;assert.equal(Boolean(g.protectingCover(g.player,e)),false);b.open=false;b.hp=0;assert.equal(Boolean(g.protectingCover(g.player,e)),false);
});
test('barriers can be locked, shot and punched without receiving enemy XP or drops',()=>{
  const g=arena(true),b=gate(g);g.target=b.id;const kills=g.player.kills;assert.equal(targetDetails(g).name,'隔離門');assert.match(targetDetails(g).hp,/耐久/);
  assert.ok(g.action('fire'));assert.ok(b.hp<60);assert.equal(g.player.ammo[0],7);assert.equal(g.player.kills,kills);assert.equal(g.items.length,0);
  const f=arena(true,'bulwark'),wall=gate(f,'partition');f.player.weapon=7;f.target=wall.id;assert.ok(f.action('fire'));assert.ok(wall.hp<90);assert.equal(f.player.ammo[7],0);
  f.damageProp(wall,200);assert.equal(wall.hp,0);assert.ok(f.canCross(f.player,{x:11,y:10}));assert.equal(f.action('door',{id:wall.id,open:true}),false);
});
test('melee cannot reach an adjacent enemy through an isolated closed edge even when leaning sees around it',()=>{
  const g=arena(false,'bulwark'),b=gate(g),e=enemy(g);g.player.weapon=7;g.target=e.id;assert.equal(g.action('fire'),false);assert.equal(g.turn,1);
  g.target=b.id;assert.ok(g.action('fire'));assert.equal(e.hp,300);
});
test('a destroyed shield still protects the far side from that same explosion',()=>{
  const g=arena(true),b=gate(g),e=enemy(g);const hp=g.player.hp;
  g.explode(g.player,2,100);assert.equal(b.hp,0);assert.equal(e.hp,300);assert.ok(g.player.hp<hp);
  g.explode(g.player,2,20);assert.equal(e.hp,290);
});
test('smoke, EMP and blast footprints honor closed edges, including smoke adjacency',()=>{
  const g=arena(true),b=gate(g),e=enemy(g,'drone');
  assert.equal(areaCells(g.grid,g.player,2,g.barriers).some(p=>p.x>10),false);
  g.player.emp=1;g.player.prepared.grenade='emp';assert.ok(g.action('grenade',{x:10,y:10}));assert.equal(e.control.disabled,0);
  // The drone opened the door during its own action; close before smoke checks.
  b.open=false;g.smoke=[{cells:[{x:10,y:10}],expires:g.turn+2}];assert.equal(g.sight(g.player,{x:11,y:10}),false);
  b.open=true;assert.equal(g.sight(g.player,{x:11,y:10}),true);
});
test('human/machine opening and animal breaching each spend the enemy action without crossing or attacking',()=>{
  for(const type of ['rifleman','drone','warden']){const g=arena(true),b=gate(g),e=enemy(g,type);g.action('wait');assert.equal(b.open,true,type);assert.equal(e.x,11);assert.equal(g.player.hp,500);assert.equal(e.charge,false);}
  for(const type of ['crawler','brute','bomber','boss']){const g=arena(true),b=gate(g),e=enemy(g,type);g.action('wait');assert.equal(b.open,false);assert.ok(b.hp<60,type);assert.equal(e.x,11);assert.equal(g.player.hp,500);}
});
test('closed edges prevent terminal, weapon and elevator interactions across the gap',()=>{
  const g=arena(true),b=gate(g);g.props=[{type:'terminal',id:'terminal',x:11,y:10,used:false}];g.items=[g.registerWeapon({type:'weapon',weapon:2,x:11,y:10})];g.end={x:11,y:10};g.player.scrap=100;
  assert.equal(g.nearbyTerminal,undefined);assert.equal(g.groundWeapon,undefined);assert.equal(g.action('terminal','rifle'),false);assert.equal(g.action('takeWeapon',g.items[0].slot),false);assert.equal(g.action('interact'),false);assert.equal(g.turn,1);
  g.setDoor(b,true);assert.ok(g.nearbyTerminal);assert.ok(g.groundWeapon);assert.ok(g.canTouch(g.end));
});
test('closing a door intercepts an already aimed sniper shot and preserves projectile-first feedback',()=>{
  const g=arena(true),b=gate(g),e=enemy(g,'sniper',13);b.open=true;e.charge=true;e.windup=1;e.aim={x:10,y:10};g.reveal();
  const {steps}=captureAction(g,()=>g.action('door',{id:b.id,open:false}));assert.equal(g.player.hp,500);assert.equal(b.hp,35);
  const shot=steps.find(s=>s.effects.some(e=>e.type==='enemyShot'));assert.ok(shot);assert.equal(shot.before.barriers[0].hp,60);assert.equal(shot.after.barriers[0].hp,35);assert.deepEqual(shot.effects.find(e=>e.type==='enemyShot').to,{x:10.5,y:10});assert.ok(planPresentation(steps).duration>0);
});
test('first-step path planning can approach doors but never path through a fixed partition',()=>{
  const g=arena(true),b=gate(g,'partition'),e=enemy(g,'rifleman',13);assert.equal(g.nextStep(e,g.player),null);assert.equal(g.canRoute(g.player,{x:11,y:10}),false);
  g.barriers=[makeBarrier('door',...edgeCells(b),'edge-route')];assert.ok(g.nextStep(e,g.player));assert.ok(g.canRoute(g.player,{x:11,y:10}));
});
test('save and full backup retain edges; v12 maps receive no newly inserted doors; malformed edges are rejected',()=>{
  const g=arena(true),b=gate(g);b.hp=33;b.open=true;
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.barriers,g.barriers);
  const old=JSON.parse(g.serialize());old.version=12;delete old.data.barriers;const migrated=Game.restore(JSON.stringify(old));assert.ok(migrated);assert.deepEqual(migrated.barriers,[]);assert.deepEqual(migrated.grid,g.grid);assert.deepEqual(migrated.player,g.player);
  for(const mutate of [d=>delete d.barriers,d=>d.barriers.push({...d.barriers[0],id:'edge-duplicate'}),d=>d.barriers[0].x=10,d=>d.barriers[0].hp=-1,d=>d.barriers[0].open='yes',d=>d.barriers[0].id='enemy',d=>d.barriers[0].type='glass']){const raw=JSON.parse(g.serialize());mutate(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('generation preserves floor reachability and unique valid edges across seeds and all six floors',()=>{
  let compartments=0,doors=0;
  for(let seed=1;seed<=24;seed++)for(let floor=1;floor<=6;floor++){
    const m=generate(seed,floor);assert.ok(validBarriers(m.barriers,m.grid));assert.equal(new Set(m.barriers.map(edgeKey)).size,m.barriers.length);
    const r=reachable(m,m.start);for(const p of [m.end,...m.items,...m.enemies])assert.ok(r.has(`${p.x},${p.y}`),`${seed}/${floor} ${p.x},${p.y}`);
    assert.equal(reachable({...m,props:[]},m.start).size,m.grid.flat().filter(v=>v===1).length);
    compartments+=Number(m.barriers.some(b=>b.type==='partition'));doors+=m.barriers.filter(b=>b.type==='door').length;
  }assert.ok(compartments>100);assert.ok(doors>144);
});
test('edge touch selection uses the actual boundary and cannot select a hidden or destroyed barrier',()=>{
  const g=arena(true),b=gate(g);const renderer={game:g,tile:40,project:(x,y)=>({x:x*40,y:y*40})};
  assert.equal(Renderer.prototype.hitBarrier.call(renderer,420,400),b);assert.equal(Renderer.prototype.hitBarrier.call(renderer,400,400),undefined);
  b.hp=0;assert.equal(Renderer.prototype.hitBarrier.call(renderer,420,400),undefined);
});


test('blast preview paints only reachable cells and expands when the door opens',()=>{
  const g=arena(true),b=gate(g),painted=[];
  const renderer={game:g,tile:40,project:(x,y)=>{painted.push({x,y});return {x:x*40,y:y*40};},box:()=>{}};
  Renderer.prototype.markArea.call(renderer,g.player,2,'fill','stroke');assert.deepEqual(painted.map(p=>p.x),[8,9,10]);
  b.open=true;painted.length=0;Renderer.prototype.markArea.call(renderer,g.player,2,'fill','stroke');assert.deepEqual(painted.map(p=>p.x),[8,9,10,11,12]);
});


test('interactive doors accept all four corner positions in both orientations without moving or changing cover adjacency',()=>{
 for(const axis of ['x','y'])for(const side of [0,1])for(const offset of [-1,1]){
  const g=arena(),b=gate(g,'door',{x:10,y:10},axis==='x'?{x:11,y:10}:{x:10,y:11});
  Object.assign(g.player,axis==='x'?{x:10+side,y:10+offset}:{x:10+offset,y:10+side});
  const before={x:g.player.x,y:g.player.y},turn=g.turn;assert.ok(g.nearbyDoors.includes(b));assert.equal(edgeCover(g.barriers,g.player,{x:15,y:15}),null);
  assert.ok(g.action('door',{id:b.id,open:true}));assert.equal(b.open,true);assert.equal(g.turn,turn+1);assert.deepEqual({x:g.player.x,y:g.player.y},before);assert.equal(g.player.moved,false);
  assert.ok(g.action('door',{id:b.id,open:false}));assert.equal(b.open,false);assert.equal(g.turn,turn+2);assert.deepEqual({x:g.player.x,y:g.player.y},before);
 }
});
test('corner door operation cannot reach through solid tiles, furniture, or closed intervening edges, and never extends forward range',()=>{
 const g=arena(),b=gate(g);Object.assign(g.player,{x:10,y:9});
 g.grid[10][10]=0;assert.equal(g.nearbyDoors.includes(b),false);g.grid[10][10]=1;
 g.props=[{id:'cover-block',type:'cover',x:10,y:10,hp:30,maxHp:30}];assert.equal(g.nearbyDoors.includes(b),false);g.props=[];
 const block=gate(g,'partition',{x:10,y:9},{x:10,y:10});assert.equal(g.action('door',{id:b.id,open:true}),false);assert.equal(g.turn,1);
 block.hp=0;assert.ok(g.nearbyDoors.includes(b));
 for(const pos of [{x:9,y:10},{x:12,y:10},{x:10,y:8},{x:9,y:9}]){Object.assign(g.player,pos);assert.equal(g.nearbyDoors.includes(b),false);}
 Object.assign(g.player,{x:10,y:9});b.hp=0;assert.equal(g.nearbyDoors.includes(b),false);
});
test('corner operation does not depend on enemy occupancy; ordinary movement still takes only the cardinal step',()=>{
 const g=arena(),b=gate(g);Object.assign(g.player,{x:10,y:9});enemy(g,'rifleman',10,10);assert.ok(g.nearbyDoors.includes(b));g.enemyAct=()=>{};
 assert.ok(g.action('door',{id:b.id,open:true}));assert.equal(g.player.y,9);
 const h=arena(),door=gate(h);Object.assign(h.player,{x:10,y:9});assert.ok(h.action('move',[0,1]));assert.equal(h.player.y,10);assert.equal(door.open,false);
});
test('corner door intent is rechecked after fast actors; new obstruction cancels without movement while turn remains spent',()=>{
 const g=arena(),b=gate(g);Object.assign(g.player,{x:10,y:9});const e=enemy(g,'rifleman',14,9);grantTrait(e,'fast','test:corner');
 g.enemyAct=()=>{g.grid[10][10]=0;};assert.ok(g.action('door',{id:b.id,open:true}));assert.equal(b.open,false);assert.equal(g.turn,2);assert.equal(g.player.x,10);assert.equal(g.player.y,9);
});
