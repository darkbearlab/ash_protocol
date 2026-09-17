import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {captureAction,planPresentation,Playback} from '../src/presentation.js';

// 3.114.0 (user request): pressing a command while a turn is still animating ends the animation and runs the command.
function arena(){
  const g=new Game(51);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();
  g.rng=Object.assign(()=>0,{state:()=>0});return g;
}
// Two riflemen that survive the shot and answer it, so the turn has several steps to present.
function busyTurn(){
  const g=arena();
  for(const [i,y] of [[0,9],[1,11]]){const e=makeEnemy('rifleman',14,y,'e'+i);e.hp=400;e.maxHp=400;e.alert=true;g.enemies.push(e);}
  g.reveal();g.target='e0';
  const {success,steps}=captureAction(g,()=>g.action('fire'));
  assert.ok(success);return {g,plan:planPresentation(steps)};
}

test('finishing mid-way emits exactly the events a full playback would, in order, then stops',()=>{
  const {plan}=busyTurn();
  assert.ok(plan.events.length>=3,'the fixture must present more than one step');
  const full=[],skipped=[];
  const whole=new Playback(plan,event=>full.push(event));while(!whole.done)whole.advance(50);
  const cut=new Playback(plan,event=>skipped.push({event,skipping:Boolean(cut.skipping)}));
  cut.advance(0);cut.advance(60);
  const before=skipped.length;assert.ok(before<plan.events.length,'still animating when the next command arrives');
  cut.finish();
  assert.equal(cut.done,true);assert.equal(cut.elapsed,plan.duration);
  assert.deepEqual(skipped.map(s=>s.event),full,'no event is lost or repeated, and the last state is the resolved turn');
  assert.ok(skipped.slice(0,before).every(s=>!s.skipping)&&skipped.slice(before).every(s=>s.skipping),'only the settled events are flagged, so their sounds can be dropped');
  cut.finish();cut.advance(100);assert.equal(skipped.length,full.length,'finishing twice or advancing afterwards emits nothing');
});

test('finishing a playback that already ended is a no-op',()=>{
  const {plan}=busyTurn(),seen=[];
  const playback=new Playback(plan,event=>seen.push(event));while(!playback.done)playback.advance(100);
  const count=seen.length;playback.finish();
  assert.equal(seen.length,count);assert.equal(playback.skipping,undefined);
});

test('the controller skips only on a live turn, keeps the input lock, and lets the setting turn it off',async()=>{
  const source=await readFile(new URL('../src/controller.js',import.meta.url),'utf8');
  assert.ok(source.includes("let skipPresentation=read('ash-skip-presentation')!=='off';"),'on unless the player turned it off');
  assert.ok(source.includes("write('ash-skip-presentation',skipPresentation?'on':'off')"));
  assert.ok(source.includes('data-modal="skipPresentation"'),'the settings menu has the switch');
  assert.ok(source.includes("function skipEnabled(){return skipPresentation&&game.status==='playing';}"),'a turn that ended the run always plays out');
  assert.ok(/function skipPlayback\(\)\{\s*if\(!playback\|\|!skipEnabled\(\)\|\|orientationBlocked\|\|!entered\|\|performance\.now\(\)<lockUntil\)return false;/.test(source),'the double-input lock still applies');
  assert.ok(source.includes('if(playback.skipping)return;update();'),'settled events neither redraw one by one nor play their sounds');
  assert.ok(source.includes("command&&!e.repeat&&"),'a held key never skips');
  assert.equal((source.match(/\.finish\(\)/g)||[]).length,1,'every path goes through skipPlayback');
});
