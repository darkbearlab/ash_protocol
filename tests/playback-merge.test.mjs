import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {captureAction,presentStep,planPresentation,mergeMoveSteps} from '../src/presentation.js';
import {MOVE_MS} from '../src/actor-visuals.js';
import {CalloutBoard} from '../src/callout-ui.js';
import {Renderer} from '../src/renderer.js';

// Presentation only (3.84.2): merged move steps and bubbles that follow their speaker. Rules and RNG are untouched.
function arena(){
 const g=new Game(3);g.grid=g.grid.map(row=>row.map(()=>1));g.props=[];g.items=[];g.hazards=[];g.barriers=[];g.enemies=[];
 Object.assign(g.player,{x:10,y:10});return g;
}
const walker=(g,id,x,y)=>{const e=makeEnemy('rifleman',x,y,id,1);g.enemies.push(e);return e;};

test('consecutive move-only steps play as one move event; a shot or a repeated mover ends the group',()=>{
 const g=arena(),a=walker(g,'walker-a',12,10),b=walker(g,'walker-b',12,12),c=walker(g,'walker-c',8,10);g.reveal();
 const {steps}=captureAction(g,()=>{
  presentStep(g,()=>{a.x=13;});presentStep(g,()=>{b.y=13;});presentStep(g,()=>{c.x=7;});
  presentStep(g,()=>{a.x=14;});
  presentStep(g,()=>{g.effects.push({type:'enemyShot',attackerType:'rifleman',from:{x:b.x,y:b.y},to:{x:10,y:10},damage:0,miss:true});});
  presentStep(g,()=>{c.x=6;});
  return true;
 });
 assert.equal(steps.length,6);
 const merged=mergeMoveSteps(steps);assert.equal(merged.length,4,'three walkers, then walker-a again, then the shot, then walker-c');
 const plan=planPresentation(steps),moveEvents=plan.events.filter(e=>e.effects.some(f=>f.type==='move'));
 assert.deepEqual(moveEvents[0].effects.filter(f=>f.type==='move').map(f=>f.actorId).sort(),['walker-a','walker-b','walker-c']);
 assert.equal(moveEvents.length,3);
 const shot=plan.events.find(e=>e.effects.some(f=>f.type==='enemyShot'));assert.ok(shot.time>=moveEvents[1].time+MOVE_MS);
 const unmerged=steps.reduce((n,s)=>n+(s.effects.length?0:MOVE_MS),0);assert.ok(plan.duration<unmerged+1000,'three walkers no longer take three move animations');
 assert.deepEqual(planPresentation(steps,{reduceMotion:true}).events.flatMap(e=>e.effects).filter(f=>f.type==='move'),[]);
});

test('a death or the player moving is never merged into a group of walkers',()=>{
 const g=arena(),a=walker(g,'walker-a',12,10),b=walker(g,'walker-b',12,12);g.reveal();
 const {steps}=captureAction(g,()=>{presentStep(g,()=>{a.x=13;});presentStep(g,()=>{b.y=13;b.hp=0;});presentStep(g,()=>{g.player.x=11;});return true;});
 assert.equal(mergeMoveSteps(steps).length,steps.length);
});

test('a bubble follows its speaker to the tile where it fell instead of staying where it spoke',()=>{
 const g=arena(),speaker=walker(g,'speaker',12,10);g.reveal();
 const r=Object.assign(Object.create(Renderer.prototype),{game:g,tile:38,w:600,h:600,callouts:new CalloutBoard()});
 const boxes=[];
 r.ctx={save(){},restore(){},measureText:()=>({width:40}),fillText(){},set font(v){},set textAlign(v){},set globalAlpha(v){},set fillStyle(v){}};
 r.box=(x,y,w,h)=>boxes.push({x,y,w,h});r.project=(x,y)=>({x:x*38,y:y*38});r.projectActor=a=>r.project(a.x,a.y);
 r.callouts.add({type:'callout',cue:'move',category:'tactical',priority:'medium',visibility:'visible',actorId:'speaker',position:{x:12,y:10},faction:'legacy'},0);
 speaker.x=13;speaker.hp=0;g.visible=p=>p.x===13&&p.y===10;
 r.drawCallouts(10);
 const bubble=boxes[0];assert.ok(bubble,'the bubble is drawn');
 assert.equal(bubble.x+bubble.w/2,13*38,'centred over the fallen speaker');
});
