import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {CalloutBoard,CALLOUT_UI_TUNING,bubbleAlpha} from '../src/callout-ui.js';
import {Renderer} from '../src/renderer.js';

// A fallen speaker's bubble fades out within fadeMs, with no exceptions (user decision, 3.84.3).
const seen=(actorId,cue='attack',priority='high')=>({type:'callout',cue,category:priority==='high'?'danger':'injury',priority,visibility:'visible',actorId,position:{x:12,y:10},faction:'legacy'});

test('silencing a bubble shortens it to the fade time once, whatever the line was',()=>{
 const fade=CALLOUT_UI_TUNING.fadeMs;
 for(const [cue,priority] of [['attack','high'],['critical','medium'],['move','medium']]){
  const board=new CalloutBoard(),item=board.add(seen(`speaker-${cue}`,cue,priority),0);
  assert.ok(item.expires>1000+fade,cue);
  board.silence(item,1000);assert.equal(item.expires,1000+fade,cue);
  board.silence(item,1200);assert.equal(item.expires,1000+fade,'a second call does not restart the fade');
  assert.equal(bubbleAlpha(item,1000+fade/2),.5);assert.equal(board.active(1000+fade).length,0);
 }
 const short=new CalloutBoard(),late=short.add(seen('late'),0),end=late.expires;short.silence(late,end-100);assert.equal(late.expires,end,'an almost finished bubble is never extended');
});

test('the renderer silences a fallen speaker and leaves a living one alone',()=>{
 const g=new Game(3);g.grid=g.grid.map(row=>row.map(()=>1));g.props=[];g.barriers=[];g.enemies=[];Object.assign(g.player,{x:10,y:10});
 const alive=makeEnemy('rifleman',12,10,'alive',1),fallen=makeEnemy('rifleman',12,12,'fallen',1);g.enemies.push(alive,fallen);g.reveal();
 const r=Object.assign(Object.create(Renderer.prototype),{game:g,tile:38,w:600,h:600,callouts:new CalloutBoard()});
 r.ctx={save(){},restore(){},measureText:()=>({width:40}),fillText(){},set font(v){},set textAlign(v){},set globalAlpha(v){},set fillStyle(v){}};
 r.box=()=>{};r.project=(x,y)=>({x:x*38,y:y*38});r.projectActor=a=>r.project(a.x,a.y);
 const a=r.callouts.add(seen('alive'),0),f=r.callouts.add({...seen('fallen'),position:{x:12,y:12}},0),before=a.expires;
 fallen.hp=0;r.drawCallouts(500);
 assert.equal(f.expires,500+CALLOUT_UI_TUNING.fadeMs);assert.equal(a.expires,before);
});
