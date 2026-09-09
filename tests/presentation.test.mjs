import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {captureAction,planPresentation,Playback,FLIGHT_MS,snapshot} from '../src/presentation.js';

function arena(){
  const g=new Game(51);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();
  g.rng=Object.assign(()=>0,{state:()=>0});return g;
}
function enemy(g,type='rifleman',hp=1,x=14,y=10){const e=makeEnemy(type,x,y,'e'+g.enemies.length);e.hp=hp;g.enemies.push(e);g.reveal();return e;}
function advance(playback,ms){while(ms>0){const dt=Math.min(ms,50);playback.advance(dt);ms-=dt;}}

test('lethal shot is saved immediately, but living target and HP remain until projectile arrival',()=>{
  const g=arena(),e=enemy(g);g.player.xp=2;
  const {success,steps}=captureAction(g,()=>g.action('fire'));
  assert.ok(success);assert.ok(e.hp<=0);assert.equal(g.pendingPerks,1);
  const restored=Game.restore(g.serialize());assert.ok(restored.enemies[0].hp<=0);assert.equal(restored.pendingPerks,1);
  const plan=planPresentation(steps);let view,fx;
  const playback=new Playback(plan,event=>{view=event.state;fx=event.effects;});playback.advance(0);
  assert.equal(view.targeted.hp,1);assert.equal(view.pendingPerks,0);assert.equal(fx[0].type,'shot');
  advance(playback,FLIGHT_MS-1);assert.equal(view.targeted.hp,1);assert.equal(playback.done,false);
  playback.advance(1);assert.ok(view.enemies[0].hp<=0);assert.equal(view.targeted,undefined);assert.equal(view.pendingPerks,1);
  assert.equal(playback.done,false,'death must remain visible before the upgrade modal is permitted');
  advance(playback,plan.duration-FLIGHT_MS);assert.equal(playback.done,true);
  view.player.hp=1;assert.equal(g.player.hp,100,'render snapshots never mutate authoritative saves');
});

test('burst shots resolve separately, then enemy fire waits for both impacts',()=>{
  const g=arena(),e=enemy(g,'brute',100);g.player.weapon=2;g.player.owned.push(2);g.player.ammo[2]=2;
  const shooter=enemy(g,'rifleman',22,10,14);shooter.charge=true;shooter.windup=1;g.target=e.id;
  const {steps}=captureAction(g,()=>g.action('fire'));assert.equal(steps.length,3);
  assert.equal(steps[0].effects[0].type,'shot');assert.equal(steps[1].effects[0].type,'shot');assert.equal(steps[2].effects[0].type,'enemyShot');
  assert.ok(steps[0].after.enemies[0].hp<steps[0].before.enemies[0].hp);
  assert.equal(steps[1].before.enemies[0].hp,steps[0].after.enemies[0].hp);
  assert.equal(steps[2].before.player.hp,100);assert.ok(steps[2].after.player.hp<100);
  const plan=planPresentation(steps);assert.ok(plan.events[4].time>plan.events[3].time);
  assert.equal(plan.events[4].effects[0].damage,0);assert.ok(plan.events[5].effects.some(e=>e.damage>0));
});

test('grenades and chained barrels keep victims and props intact until arrival',()=>{
  const g=arena();enemy(g);g.props=[{id:'b',type:'barrel',x:13,y:10,hp:18,maxHp:18}];
  const {steps}=captureAction(g,()=>g.action('grenade',{x:14,y:10}));const plan=planPresentation(steps);
  assert.equal(plan.events[0].effects[0].style,'grenade');assert.equal(plan.events[0].state.props[0].hp,18);
  assert.ok(plan.events[1].state.props[0].hp<=0);assert.ok(plan.events[1].state.enemies[0].hp<=0);
  assert.equal(plan.events[1].effects.filter(e=>e.type==='blast').length,2);
  assert.ok(plan.events[1].time>=FLIGHT_MS);
});

test('miss labels appear only at arrival, and lethal enemy or environment hits retain a death beat',()=>{
  const miss=arena();enemy(miss);miss.rng=Object.assign(()=>.999,{state:()=>0});
  const shot=planPresentation(captureAction(miss,()=>miss.action('fire')).steps);
  assert.equal(shot.events[0].effects[0].miss,false);assert.equal(shot.events[0].effects[0].missPath,true);
  assert.equal(shot.events[1].effects[0].type,'miss');assert.equal(shot.events[1].state.enemies[0].hp,1);
  for(const environment of [false,true]){
    const g=arena();g.player.hp=1;
    if(environment)g.hazards=[{x:10,y:10,type:'fire'}];else{const e=enemy(g,'rifleman',22);e.charge=true;e.windup=1;}
    const plan=planPresentation(captureAction(g,()=>g.action('wait')).steps);
    assert.equal(g.status,'dead');assert.ok(plan.events.at(-1).state.player.hp<=0);
    assert.ok(plan.duration>plan.events.at(-1).time);
  }
});

test('visible frame clock preserves order after suspension, and completion is emitted only once',()=>{
  const g=arena();enemy(g);const {steps}=captureAction(g,()=>g.action('fire'));
  for(const reduceMotion of [false,true]){
    const plan=planPresentation(steps,{reduceMotion}),seen=[];
    const playback=new Playback(plan,event=>seen.push(event));playback.advance(0);
    assert.equal(seen.length,1);assert.equal(playback.done,false);
    // No advance while hidden/landscape; an enormous first frame cannot finish the sequence.
    playback.advance(60000);assert.equal(playback.done,false);assert.equal(playback.elapsed,100);
    advance(playback,plan.duration);assert.equal(playback.done,true);assert.deepEqual(seen,plan.events);
    playback.advance(100);assert.equal(seen.length,2);
    if(reduceMotion)assert.ok(seen.every(e=>e.effects.every(fx=>fx.quiet)));
  }
});

test('capturing a turn preserves RNG, saves, combat rules and rejected actions',()=>{
  for(const type of ['fire','grenade','wait','move','reload']){
    const g=arena();enemy(g,'brute',100);const ordinary=Game.restore(g.serialize());
    const recorded=Game.restore(g.serialize()),arg=type==='grenade'?{x:14,y:10}:type==='move'?[0,1]:undefined;
    const plain=ordinary.action(type,arg),result=captureAction(recorded,()=>recorded.action(type,arg));
    assert.equal(result.success,plain);assert.equal(recorded.serialize(),ordinary.serialize());
    assert.deepEqual(recorded.effects,ordinary.effects);
    assert.ok(snapshot(recorded).visibleTiles instanceof Set);
    if(!result.success)assert.equal(result.steps.length,0);
  }
});
