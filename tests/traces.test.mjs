import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {addTrace,spentCase,validTraces,TRACE_KINDS,TRACE_LIMIT,TRACE_CELL_LIMIT,drawTrace} from '../src/traces.js';
import {grantTrait} from '../src/traits.js';
import {captureAction,planPresentation,Playback} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(){const g=new Game(320,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.barriers=[];g.props=[];g.items=[];g.enemies=[];g.hazards=[];g.marks=[];g.smoke=[];Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.reveal();return g;}
function enemy(g,type='rifleman',x=12,y=10){const e=makeEnemy(type,x,y,'enemy-'+g.enemies.length);g.enemies.push(e);g.reveal();return e;}

test('cosmetic traces are deterministic and cannot change battle RNG, ammunition, HP or geometry',()=>{
  const g=arena(),before=JSON.parse(g.serialize());for(const kind of TRACE_KINDS)addTrace(g,g.player,kind);
  const after=JSON.parse(g.serialize());after.data.traces=[];assert.deepEqual(after,before);
  const copy=arena();for(const kind of TRACE_KINDS)addTrace(copy,copy.player,kind);assert.deepEqual(g.traces,copy.traces);
  const a=arena(),b=arena();enemy(a);enemy(b);addTrace(a,a.player,'blood');assert.ok(a.action('fire'));assert.ok(b.action('fire'));const x=JSON.parse(a.serialize()),y=JSON.parse(b.serialize());delete x.data.runId;delete y.data.runId;x.data.traces=[];y.data.traces=[];assert.deepEqual(x,y);
});
test('per-cell and per-floor limits evict oldest decorations; repeated bursts do not grow without bound',()=>{
  const g=arena();for(let i=0;i<100;i++)addTrace(g,g.player,'casing');assert.equal(g.traces.length,1);
  for(const kind of TRACE_KINDS)addTrace(g,g.player,kind);assert.equal(g.traces.length,TRACE_CELL_LIMIT);assert.deepEqual(g.traces.map(t=>t.kind),TRACE_KINDS.slice(-3));
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)addTrace(g,{x,y},'blood');assert.equal(g.traces.length,TRACE_LIMIT);assert.ok(validTraces(g.traces,g.grid));
});
test('actual player shots leave correct spent cases; plasma, explosives, fists and free preparation do not',()=>{
  for(const [base,kind]of [[0,'casing'],[1,'shell'],[2,'casing'],[4,null],[5,null]]){
    const g=arena();g.player.owned=[base];g.player.weapon=base;g.player.ammo[base]=2;enemy(g);g.rng=Object.assign(()=>.999,{state:()=>0});const before=g.player.ammo[base];g.action('fire');assert.ok(g.player.ammo[base]<before);assert.equal(g.traces.find(t=>['casing','shell'].includes(t.kind))?.kind??null,kind);
  }
  const g=arena();spentCase(g,g.player,'ordnance');spentCase(g,g.player,'energy');assert.deepEqual(g.traces,[]);g.action('prepare',{category:'item',id:null});assert.deepEqual(g.traces,[]);
});
test('biological injury stains blood; mechanical keyword stains oil independently of enemy name',()=>{
  const g=arena(),e=enemy(g);g.hurt(e,1);assert.ok(g.traces.some(t=>t.kind==='blood'));
  grantTrait(e,'mechanical','qa');g.hurt(e,1);assert.ok(g.traces.some(t=>t.kind==='oil'));g.damagePlayer(10,'test');assert.ok(g.traces.some(t=>t.kind==='blood'&&t.x===10));
});
test('explosion scorch uses the original blast footprint before a door is destroyed; EMP leaves no scorch',()=>{
  const g=arena();g.player.x=3;g.player.y=3;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));for(let x=8;x<=12;x++)g.grid[10][x]=1;g.grid[3][3]=1;
  g.barriers=[makeBarrier('door',{x:10,y:10},{x:11,y:10},'door-qa')];g.explode({x:10,y:10},2,100);assert.equal(g.barriers[0].hp,0);assert.ok(g.traces.some(t=>t.kind==='scorch'&&t.x===10));assert.ok(!g.traces.some(t=>t.kind==='scorch'&&t.x===11));
  const h=arena();h.player.emp=1;h.player.prepared.grenade='emp';h.action('grenade',{x:11,y:10});assert.equal(h.traces.length,0);
});
test('broken props leave debris once, while barrels chain safely and intact damage leaves chips',()=>{
  const g=arena(),p={id:'cover-test',type:'cover',x:11,y:10,hp:60,maxHp:60};g.props=[p];g.damageProp(p,5);assert.ok(g.traces.some(t=>t.kind==='chip'));g.damageProp(p,100);assert.ok(g.traces.some(t=>t.kind==='debris'));const traces=structuredClone(g.traces);g.damageProp(p,100);assert.deepEqual(g.traces,traces);
});
test('persistent stains appear after projectile travel and playback never adds them a second time',()=>{
  const g=arena(),e=enemy(g);e.hp=1;g.rng=Object.assign(()=>0,{state:()=>0});const {steps}=captureAction(g,()=>g.action('fire')),plan=planPresentation(steps),stored=structuredClone(g.traces);
  assert.deepEqual(plan.events[0].state.traces,[]);assert.ok(plan.events.find(event=>event.time>0&&event.state.traces.some(t=>t.kind==='blood')));
  const replay=new Playback(plan,()=>{});for(let i=0;i<50;i++)replay.advance(100);assert.ok(replay.done);assert.deepEqual(g.traces,stored);
});
test('save and complete backup retain traces; legacy v16 starts clean and descending discards only old-floor traces',()=>{
  const g=arena();addTrace(g,g.player,'oil');const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.deepEqual(restored.traces,g.traces);
  const old=JSON.parse(g.serialize());old.version=16;delete old.data.traces;const migrated=Game.restore(JSON.stringify(old));assert.deepEqual(migrated.traces,[]);assert.deepEqual(migrated.player,g.player);
  Object.assign(g.player,g.end);g.descend();assert.equal(g.floor,2);assert.deepEqual(g.traces,[]);
});
test('malformed trace data is rejected, and rendering decorations cannot change the game',()=>{
  const g=arena();addTrace(g,g.player,'blood');
  for(const mutate of [t=>t[0].kind='unknown',t=>t[0].x=-1,t=>t[0].rotation=4,t=>t[0].variant=.5,t=>t.push({...t[0]})]){const data=JSON.parse(g.serialize());mutate(data.data.traces);assert.equal(Game.restore(JSON.stringify(data)),null);}
  const before=g.serialize(),ctx={globalAlpha:1,save(){},restore(){},translate(){},rotate(){},fillRect(){}};
  for(const kind of TRACE_KINDS)drawTrace(ctx,{...g.traces[0],kind},50,50,38);assert.equal(g.serialize(),before);
});
test('v16 local first load keeps original bytes in QA without touching live storage',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?traces'),old=JSON.parse(arena().serialize());old.version=16;delete old.data.traces;const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v16-backup'),raw);assert.equal(memory.has('ash-save'),false);
});
