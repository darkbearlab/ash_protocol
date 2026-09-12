import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {makeBarrier} from '../src/barriers.js';
import {movementBoundaries,boundaryOpacityPercent} from '../src/movement-boundaries.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {grantTrait} from '../src/traits.js';
import {Renderer} from '../src/renderer.js';

function arena(character='bulwark',Type=Game){const g=new Type(326,[],0,character);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.rng=Object.assign(()=>.5,{state:()=>42});g.reveal();return g;}
function add(g,x=11,y=10,id='bump'){const e=makeEnemy('rifleman',x,y,id);e.hp=e.maxHp=500;e.alert=true;e.charge=true;g.enemies.push(e);g.reveal();return e;}

test('bump uses free integrated melee, pays one turn, preserves gun/ammo and does not move or retain aim bonuses',()=>{
  const g=arena(),e=add(g),ammo=structuredClone(g.player.ammo),turn=g.turn;g.player.focus=true;g.player.evasive=true;g.player.guard=true;
  const {success,steps}=captureAction(g,()=>g.action('move',[1,0]));assert.ok(success);assert.equal(g.turn,turn+1);assert.equal(g.player.weapon,6);assert.deepEqual(g.player.ammo,ammo);assert.equal(g.player.x,10);assert.equal(g.player.y,10);assert.ok(e.hp<500);
  for(const key of ['focus','evasive','guard','moved'])assert.equal(g.player[key],false);assert.deepEqual(g.player.moveDelta,[0,0]);
  const attack=steps.find(s=>s.effects.some(f=>f.weaponId==='powerfist'));assert.ok(attack);assert.equal(attack.before.player.weapon,6);assert.equal(attack.after.player.weapon,6);
  assert.ok(steps.findIndex(s=>s.effects.some(f=>f.type==='enemyShot'))<steps.indexOf(attack),'slow player acts after the enemy');
});
test('bump uses first eligible inventory slot and its upgrades, without inheriting ranged damage properties',()=>{
  const g=arena(),e=add(g);g.player.owned=[6,7,9];g.player.weaponBases[9]=7;g.player.affixes[9]=null;g.player.ammo[9]=0;g.player.upgrades[9]=3;
  assert.equal(g.bumpMeleeSlot(),7);g.player.owned=[6,9,7];assert.equal(g.bumpMeleeSlot(),9);
  // Compare exact same melee roll with manual equipped fire, including adjacent wall cover.
  g.player.owned=[6,9];g.grid[10][12]=0;g.reveal();const other=Game.restore(g.serialize());assert.ok(other);other.player.weapon=9;g.rng=other.rng=()=>.5;
  g.action('move',[1,0]);other.action('fire');assert.equal(e.hp,other.enemies[0].hp);assert.equal(g.player.weapon,6);
});
class Escape extends Game{executeEnemy(e){e.x=12;return false;}}
test('committed bump cannot move after escape or retarget another enemy, and consumes the turn',()=>{
  const g=arena('bulwark',Escape),e=add(g),other=add(g,10,11,'other'),turn=g.turn;
  assert.ok(g.action('move',[1,0]));assert.equal(g.turn,turn+1);assert.equal(e.hp,500);assert.equal(other.hp,500);assert.equal(g.player.x,10);assert.equal(g.target,e.id);assert.ok(g.effects.some(f=>f.weaponId==='powerfist'&&f.miss&&f.to.x===11));
});
class Sidestep extends Game{executeEnemy(e){e.x=10;e.y=11;return false;}}
test('committed bump follows original identity if it remains adjacent',()=>{
  const g=arena('bulwark',Sidestep),e=add(g);assert.ok(g.action('move',[1,0]));assert.ok(e.hp<500);assert.ok(g.effects.some(f=>f.weaponId==='powerfist'&&f.to.y===11));assert.equal(g.player.weapon,6);
});
test('no eligible melee falls back to unarmed, closed door opens first, partitions and diagonals reject',()=>{
  const s=arena('soldier');add(s);const turn=s.turn;assert.equal(s.action('move',[1,0]),true);assert.equal(s.turn,turn+1);assert.equal(s.player.x,10);assert.ok(s.effects.some(e=>e.weaponId==='unarmed'));
  const g=arena(),e=add(g);const door=makeBarrier('door',g.player,e,'door');g.barriers=[door];g.reveal();assert.ok(g.action('move',[1,0]));assert.equal(door.open,true);assert.equal(e.hp,500);assert.equal(g.player.x,10);
  g.barriers=[makeBarrier('partition',g.player,e,'partition')];g.reveal();const before=g.turn;assert.equal(g.action('move',[1,0]),false);assert.equal(g.action('move',[1,1]),false);assert.equal(g.turn,before);
  const base=g.weaponAt.bind(g);g.barriers=[];g.weaponAt=slot=>({...base(slot),integrated:false});assert.equal(g.weaponAt(g.bumpMeleeSlot()).unarmed,true);
});
test('death or disability before bump prevents the strike; fast player can strike first and death presentation precedes upgrade',()=>{
  const g=arena();add(g);g.player.hp=1;assert.ok(g.action('move',[1,0]));assert.equal(g.status,'dead');assert.ok(!g.effects.some(f=>f.weaponId==='powerfist'));
  const disabled=arena();add(disabled);disabled.player.control.disabled=1;assert.ok(disabled.action('move',[1,0]));assert.ok(!disabled.effects.some(f=>f.weaponId==='powerfist'));
  const quick=arena();const e=add(quick);e.hp=1;quick.player.traits=quick.player.traits.filter(t=>t.id!=='slow');grantTrait(quick.player,'fast','test');quick.player.xp=2;
  const {steps}=captureAction(quick,()=>quick.action('move',[1,0]));const shot=steps.find(s=>s.effects.some(f=>f.weaponId==='powerfist'));assert.ok(shot);assert.equal(shot.before.pendingPerks,0);assert.ok(shot.after.pendingPerks>0);
  const plan=planPresentation(steps);assert.ok(plan.events.some(event=>event.effects.some(f=>f.type==='fall')));assert.equal(quick.player.weapon,6);
});
test('boundary lines follow visible walkable ground, not enemies, items, dark-room or fog edges',()=>{
  const g=arena();g.visibleTiles=new Set(['10,10','11,10']);const before=g.serialize();assert.deepEqual(movementBoundaries(g),[]);assert.equal(g.serialize(),before);
  add(g);g.visibleTiles=new Set(['10,10','11,10']);g.items=[{type:'med',x:11,y:10}];g.lighting[10][11]=0;assert.deepEqual(movementBoundaries(g),[]);
  g.grid[9][10]=0;g.visibleTiles.add('10,9');assert.deepEqual(movementBoundaries(g),[{x1:9.5,y1:9.5,x2:10.5,y2:9.5}]);
  g.grid[9][10]=1;g.props=[{type:'cover',x:11,y:10,hp:30,maxHp:30}];assert.equal(movementBoundaries(g).length,1);g.visibleTiles.delete('11,10');assert.deepEqual(movementBoundaries(g),[]);
  g.visibleTiles.add('11,10');g.props[0].hp=0;assert.deepEqual(movementBoundaries(g),[]);
});
test('doors never cap contours; closed partitions still have a shared edge and unseen edges stay hidden',()=>{
  const g=arena(),door=makeBarrier('door',g.player,{x:11,y:10},'d');g.barriers=[door];g.visibleTiles=new Set(['10,10','11,10']);assert.deepEqual(movementBoundaries(g),[]);
  door.open=true;assert.deepEqual(movementBoundaries(g),[]);door.open=false;door.hp=0;assert.deepEqual(movementBoundaries(g),[]);
  door.type='partition';door.hp=90;assert.equal(movementBoundaries(g).length,1);g.visibleTiles.clear();assert.deepEqual(movementBoundaries(g),[]);
});
test('optional white overlay renders after wall art and does not mutate saves',()=>{
  const g=arena();g.grid[10][11]=0;g.reveal();const before=g.serialize(),calls=[],gradient={addColorStop(){}},ctx=new Proxy({createRadialGradient(){return gradient;}},{get:(o,k)=>k in o?o[k]:()=>{}});
  const r=Object.create(Renderer.prototype);Object.assign(r,{game:g,ctx,w:300,h:400,tile:38,dpr:1,camera:{x:10,y:10},effects:[],reduceMotion:true,targetingEnabled:false,movementBoundaries:true,terrain(){return true;},wall(){calls.push('wall');},actor(){},exit(){},line(...a){if(a[4]==='#ffffff')calls.push('white');}});
  r.draw(0);assert.ok(calls.indexOf('white')>calls.lastIndexOf('wall'));assert.equal(g.serialize(),before);r.movementBoundaries=false;calls.length=0;r.draw(0);assert.ok(!calls.includes('white'));
});
test('settings stores boundary preference through namespace helpers and module is precached',async()=>{
  const source=await readFile(new URL('../src/controller.js',import.meta.url),'utf8');assert.ok(source.includes("read('ash-movement-boundaries')==='on'"));assert.ok(source.includes("write('ash-movement-boundaries',renderer.movementBoundaries?'on':'off')"));
  assert.ok((await readFile(new URL('../sw.js',import.meta.url),'utf8')).includes('./src/movement-boundaries.js'));
});

test('corridor sides stop at their exact endpoints at doors and fog without reading hidden layout',()=>{
  const g=arena();g.grid[9][10]=0;g.grid[11][10]=0;g.visibleTiles=new Set(['10,10','10,9','10,11','9,10']);
  const before=g.serialize(),lines=movementBoundaries(g);assert.equal(lines.length,2);
  for(const line of lines){assert.equal(line.x1,9.5);assert.equal(line.x2,10.5);assert.equal(line.y1,line.y2);}
  assert.equal(g.serialize(),before);
  // Hidden room shapes/props must not influence the schematic continuation.
  g.grid[10][12]=0;g.props=[{type:'cover',x:11,y:10,hp:65,maxHp:65}];assert.deepEqual(movementBoundaries(g),lines);
  g.grid[10][12]=1;g.props=[];g.visibleTiles.add('11,10');const door=makeBarrier('door',g.player,{x:11,y:10},'edge-portal');g.barriers=[door];
  assert.deepEqual(movementBoundaries(g),lines);door.open=true;assert.deepEqual(movementBoundaries(g),lines);
  g.barriers=[];assert.ok(movementBoundaries(g).every(e=>e.x2===10.5),'known open space has no guessed contour extension');
});
test('fog itself never closes an opening; an actual wall face remains a real boundary',()=>{
  const g=arena();g.visibleTiles=new Set(['10,10']);assert.deepEqual(movementBoundaries(g),[]);
  g.grid[10][11]=0;assert.equal(movementBoundaries(g).length,1);
});

test('open contours have exact endpoints in all four cardinal directions without joining across the opening',()=>{
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const g=arena(),nx=-dy,ny=dx;g.visibleTiles=new Set(['10,10',(10-dx)+','+(10-dy)]);
    for(const sign of [-1,1]){g.grid[10+ny*sign][10+nx*sign]=0;g.visibleTiles.add((10+nx*sign)+','+(10+ny*sign));}
    const edges=movementBoundaries(g);assert.equal(edges.length,2);
    for(const e of edges){const along=[(e.x1-10)*dx+(e.y1-10)*dy,(e.x2-10)*dx+(e.y2-10)*dy].sort((a,b)=>a-b);assert.ok(Math.abs(along[0]+.5)<1e-9);assert.ok(Math.abs(along[1]-.5)<1e-9);}
  }
});

function overlay(g,opacity=80,enabled=true){
  const calls=[],stack=[],ctx={globalAlpha:.42,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();}};
  const r=Object.create(Renderer.prototype);Object.assign(r,{game:g,ctx,boundaryOpacity:opacity,movementBoundaries:enabled,tile:40,w:400,h:400,camera:{x:10,y:10},line(...args){calls.push({kind:'line',args,alpha:ctx.globalAlpha});},box(...args){calls.push({kind:'box',args,alpha:ctx.globalAlpha});}});
  r.drawTacticalOverlays();return {calls,ctx};
}
test('white opacity scales both strokes, zero hides them, and drawing restores canvas alpha',()=>{
  const g=arena();g.grid[9][10]=0;g.visibleTiles=new Set(['10,10']);const before=g.serialize();
  for(const value of [20,80,100]){const {calls,ctx}=overlay(g,value);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.alpha===value/100));assert.equal(ctx.globalAlpha,.42);}
  assert.deepEqual(overlay(g,0).calls,[]);assert.deepEqual(overlay(g,80,false).calls,[]);assert.equal(g.serialize(),before);
});
test('both door orientations show a green closed line or exactly two open dots independent of white settings',()=>{
  for(const next of [{x:11,y:10},{x:10,y:11}]){
    const g=arena(),door=makeBarrier('door',g.player,next,'edge-mark');g.barriers=[door];g.reveal();
    const green=state=>state.calls.filter(c=>c.args[4]==='#6ef39b');
    let marks=green(overlay(g,0,false));assert.equal(marks.length,1);assert.equal(marks[0].kind,'line');assert.equal(marks[0].alpha,1);
    const [x1,y1,x2,y2]=marks[0].args;if(door.axis==='x'){assert.equal(x1,x2);assert.notEqual(y1,y2);}else {assert.equal(y1,y2);assert.notEqual(x1,x2);}
    door.open=true;marks=green(overlay(g,20));assert.equal(marks.length,2);assert.ok(marks.every(m=>m.kind==='box'&&m.alpha===1));
    if(door.axis==='x')assert.equal(marks[0].args[0],marks[1].args[0]);else assert.equal(marks[0].args[1],marks[1].args[1]);
    door.hp=0;assert.deepEqual(green(overlay(g)),[]);door.hp=60;Object.assign(g.player,{x:25,y:25});g.reveal();assert.deepEqual(green(overlay(g)),[]);
    Object.assign(g.player,{x:10,y:10});g.reveal();door.type='partition';door.open=false;assert.deepEqual(green(overlay(g)),[]);
  }
});
test('opacity preference parses persisted strings safely and preserves fully transparent zero',()=>{
  for(const value of [null,undefined,'','bad',NaN,Infinity,{},false])assert.equal(boundaryOpacityPercent(value),80);
  assert.equal(boundaryOpacityPercent('0'),0);assert.equal(boundaryOpacityPercent('35'),35);assert.equal(boundaryOpacityPercent('100'),100);
  assert.equal(boundaryOpacityPercent('-5'),0);assert.equal(boundaryOpacityPercent('120'),100);assert.equal(boundaryOpacityPercent(42.4),42);
});
