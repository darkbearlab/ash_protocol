import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {PHASE_TUNING,phaseStep} from '../src/rift-phase.js';
import {detectors,nearContacts} from '../src/detection.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {distance} from '../src/world.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.230.0 (docs/FACTIONS.md 5.8): the phase body — seen only within three tiles, straight through walls toward you.
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];clearGeneratedMap(g);
  Object.assign(g.player,{x:6,y:10});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'rift');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};
const wallAt=(g,x,width=1)=>{for(let y=0;y<SIZE;y++)for(let i=0;i<width;i++)g.grid[y][x+i]=0;g.lighting=g.grid.map(r=>r.map(()=>1));g.reveal();};

test('seen only within three tiles: not drawn, not targeted, but the sensors read it',()=>{
  const g=open(),e=unit(g,'phase',10,10,'p');
  assert.ok(g.sight(g.player,e),'in plain sight');assert.equal(g.visible(e),false,'four tiles off: unseen');assert.equal(g.visibleEnemies.includes(e),false);
  const d=detectors().find(x=>x.kind==='phase');assert.ok(d);assert.deepEqual(nearContacts(g,d),[e],'the officer reads it');
  Object.assign(e,{x:9,y:10});assert.equal(g.visible(e),true,'three tiles: seen');assert.deepEqual(nearContacts(g,d),[]);
});

test('it walks straight through a wall and comes out beyond, never stopping inside one',()=>{
  const g=open();wallAt(g,8);const e=unit(g,'phase',9,10,'p');
  assert.equal(g.sight(e,g.player),false,'the wall is between');
  g.action('wait');assert.deepEqual([e.x,e.y],[7,10],'through in one move');assert.equal(g.grid[e.y][e.x],1);
  // A wall thicker than it can pass: it does not try (it never stands in a wall).
  const thick=open();wallAt(thick,7,PHASE_TUNING.through+1);const f=unit(thick,'phase',7+PHASE_TUNING.through+1,10,'f');
  assert.equal(phaseStep(thick,f,[-1,0]),null);thick.action('wait');assert.equal(thick.grid[f.y][f.x],1);
  // Out the other side onto something: no.
  const busy=open();wallAt(busy,8);const h=unit(busy,'phase',9,10,'h');unit(busy,'wisp',7,10,'w');
  assert.equal(phaseStep(busy,h,[-1,0]),null,'the tile beyond is taken');
});

test('the phase body card, and in the open it simply walks to you, a tile a turn',()=>{
  const c=ENEMY_TYPES.phase;
  assert.equal(c.energy,true);assert.equal(c.huntsLife,true);assert.equal(c.revealRange,3);assert.equal(c.loot,undefined);
  const g=open(),e=unit(g,'phase',12,10,'p');
  for(let i=0;i<5;i++)g.action('wait');
  assert.ok(distance(e,g.player)<=1,'it reached you');
});

test('a floor that holds a phase body gives the bad-feeling cue once',()=>{
  const g=open(),memory=newCommsMemory('r'),has=ev=>JSON.stringify(ev).includes('hiddenThreat');
  assert.equal(has(commsEvents({game:g,memory})),false,'nothing hidden: no cue');
  unit(g,'phase',20,20,'p');
  assert.equal(has(commsEvents({game:g,memory})),true);assert.equal(has(commsEvents({game:g,memory})),false,'once a floor');
});
