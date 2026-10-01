// 3.211.0 天誅 / Tenchu (user decisions 2026-10-01, docs/MELEE_CLASSES.md 下一版：天誅): 3.210.0's hook blade renamed, with
// its own line and landing. The line passes through enemies and cover (crates, solid props, low partitions) but not
// walls; a closed door counts as a wall. A target 2-4 tiles away needs a free tile beside it on the ninja's side; next
// to the target the ninja goes through it to the far side when it can stand and strike there, else strikes in place.
// Every use shouts 「天誅！」 through the operator's callout bubble. Passed-through units take nothing; the attack origin
// (3.209.0) is the tile the ninja strikes from.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,VOID,makeEnemy,makeBarrier} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
import {captureAction} from '../src/presentation.js';
import {hookBladePlan,tenchuLine,tenchuLanding} from '../src/melee-classes.js';
import {calloutLine,PLAYER_LINES} from '../src/callout-ui.js';
import {PLAYER_CUES} from '../src/callouts.js';
import {SKILLS} from '../src/skills.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

function arena(){
 const g=new Game(3211,[],0,'ninja','onyx');g.player.weapon=g.player.owned[0];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke','rooms','traces'])g[k]=[];clearGeneratedMap(g);g.fires=undefined;
 Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();
 Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 assert.ok(g.action('usePrepared',{category:'skill'}),'camouflage on');return g;
}
function enemy(g,x,y,type='rifleman',hp=1000){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp,maxHp:hp,alert:true});g.enemies.push(e);g.reveal();return e;}
const aim=(g,e)=>{g.target=e.id;g.reveal();return e;};
const edge=(g,type,a,b)=>{const e=makeBarrier(type,a,b,`edge-${g.barriers.length}`);g.barriers.push(e);g.reveal();return e;};
const shouts=steps=>steps.flatMap(s=>s.effects).filter(f=>f.type==='callout'&&f.speaker==='player'&&f.cue==='tenchu');
// One Tenchu through the skill button (the gun may stay in hand) or the blade swing: what happened.
function go(g,how='skill'){const turn=g.turn,{success,steps}=captureAction(g,()=>how==='skill'?g.action('usePrepared',{category:'skill'}):g.action('fire'));return {success,steps,spent:g.turn-turn,at:[g.player.x,g.player.y]};}
function refusedFree(g,why,how='skill'){const at=[g.player.x,g.player.y],left=g.player.skillState.camouflage.remaining;assert.equal(hookBladePlan(g).why,why);const r=go(g,how);assert.equal(r.success,false,why);assert.equal(r.spent,0,`${why}: no turn`);assert.deepEqual(r.at,at);assert.equal(g.player.skillState.camouflage.remaining,left,'nor a camouflage action');assert.equal(shouts(r.steps).length,0,'and no shout');}

test('the line passes through enemies, crates, solid props and low partitions; they take nothing',()=>{
 const g=arena(),t=aim(g,enemy(g,14,10));
 const a=enemy(g,11,10,'rifleman',50),b=enemy(g,12,10,'brute',90);g.props=[{id:'crate',type:'cover',x:12,y:9,hp:60,maxHp:60}];
 edge(g,'low_partition',{x:10,y:10},{x:11,y:10});aim(g,t);
 assert.ok(tenchuLine(g,g.player,t));const r=go(g,'fire');assert.ok(r.success);assert.equal(r.spent,1);
 assert.deepEqual(r.at,[13,10],'on the tile on its near side');assert.ok(t.hp<1000,'the target is struck');assert.equal(a.hp,50,'a passed-through enemy takes nothing');assert.equal(b.hp,90);
 // A crate and a vehicle cockpit (a full prop) on the line do not stop it either.
 const h=arena(),u=aim(h,enemy(h,14,10));h.props=[{id:'crate',type:'cover',x:11,y:10,hp:60,maxHp:60},{id:'cockpit',type:'cover',style:'rover_2',x:12,y:10,hp:75,maxHp:75}];h.visible=()=>true;
 assert.ok(tenchuLine(h,h.player,u));assert.ok(!hookBladePlan(h).reason);assert.deepEqual(hookBladePlan(h).point,{x:13,y:10});
 // Brood (矮小) as well, as any unit.
 const k=arena(),v=aim(k,enemy(k,13,10));const brood=enemy(k,12,9,'brood',20);grantTrait(brood,'underfoot','test');const w=enemy(k,11,10,'rifleman',40);aim(k,v);assert.deepEqual(hookBladePlan(k).point,{x:12,y:10});assert.equal(w.hp,40);
});

test('walls stop the line, and a closed door or a full partition counts as a wall; an open or broken door does not',()=>{
 // The target counts as seen (as through a corner lean) so only the line is tested.
 const seen=g=>{g.visible=()=>true;return g;};
 const wall=seen(arena()),t=aim(wall,enemy(wall,14,10));wall.grid[10][12]=0;assert.equal(tenchuLine(wall,wall.player,t),false);refusedFree(wall,'line');
 for(const type of ['door','partition']){const g=seen(arena()),e=aim(g,enemy(g,14,10));const d=edge(g,type,{x:11,y:10},{x:12,y:10});refusedFree(g,'line');assert.match(g.logs[0].text,/牆、關著的門或隔板/,'the refusal names what stops it (review)');
  if(type==='door'){d.open=true;assert.ok(!hookBladePlan(g).reason,'an open door lets it through');d.open=false;d.hp=0;assert.ok(!hookBladePlan(g).reason,'so does a broken one');}}
 // Review: the player's texts say the same as the rule — partitions stop it, low partitions do not.
 assert.match(SKILLS.camouflage.text,/不穿牆、關著的門與隔板/);assert.match(SKILLS.camouflage.text,/含矮隔板/);
 // The real case: around a closed door the target is not even seen.
 const g=arena();aim(g,enemy(g,14,10));edge(g,'door',{x:11,y:10},{x:12,y:10});refusedFree(g,'target');
 // A wall between the landing and the target's near side (an off-axis landing round a corner) is refused too.
 const c=seen(arena()),e=aim(c,enemy(c,12,12));c.grid[11][11]=0;c.grid[12][11]=0;c.grid[11][12]=0;assert.equal(tenchuLanding(c,c.player,e),null);
});

test('a target 2-4 tiles away: the landing is on the near side, along the longer axis first; taken or unstandable, it cannot go',()=>{
 const g=arena(),e=aim(g,enemy(g,12,12));assert.deepEqual(hookBladePlan(g).point,{x:11,y:12},'an exact diagonal: the horizontal neighbour');
 enemy(g,11,12,'drone');aim(g,e);assert.deepEqual(hookBladePlan(g).point,{x:12,y:11},'then the other near-side neighbour');
 enemy(g,12,11,'drone');aim(g,e);refusedFree(g,'room');
 const h=arena(),f=aim(h,enemy(h,11,13));assert.deepEqual(hookBladePlan(h).point,{x:11,y:12},'the longer axis is vertical');
 // Never the far side or a flank of a target out of reach: a straight-on target with its near tile taken is refused.
 const s=arena(),u=aim(s,enemy(s,13,10));enemy(s,12,10,'drone');aim(s,u);refusedFree(s,'room','fire');
 // A pit or a solid prop on the near tile is no landing; nor a tile the blade cannot reach the target from.
 const pit=arena(),p=aim(pit,enemy(pit,13,10));pit.grid[10][12]=VOID;refusedFree(pit,'room');
 const crate=arena(),q=aim(crate,enemy(crate,13,10));crate.props=[{id:'crate',type:'cover',x:12,y:10,hp:60,maxHp:60}];crate.reveal();refusedFree(crate,'room');
 const low=arena(),r=aim(low,enemy(low,13,10));edge(low,'low_partition',{x:12,y:10},{x:13,y:10});refusedFree(low,'room');
});

test('next to the target: through it to the far side and strike; with no footing there, a strike in place',()=>{
 const g=arena(),e=aim(g,enemy(g,11,10));const r=go(g);assert.ok(r.success);assert.equal(r.spent,1);assert.deepEqual(r.at,[12,10],'through the target to its far side');assert.ok(e.hp<1000);assert.deepEqual(g.player.facing,[-1,0]);
 const line=r.steps.flatMap(s=>s.effects).find(f=>f.type==='tonguePull');assert.deepEqual(line.from,{x:10,y:10});assert.deepEqual(line.to,{x:12,y:10});
 // The 3.209.0 attack origin is the tile it strikes from: the blow comes from the far side.
 const slash=r.steps.flatMap(s=>s.effects).find(f=>f.type==='shot'&&f.style==='slash');assert.deepEqual(slash.from,{x:12,y:10});assert.deepEqual(e.lastKnown,{x:12,y:10});
 assert.ok(g.logs.some(l=>/穿過/.test(l.text)));
 const inPlace=(setup,label)=>{const h=arena(),f=aim(h,enemy(h,11,10));setup(h);aim(h,f);const s=go(h);assert.ok(s.success,label);assert.equal(s.spent,1,label);assert.deepEqual(s.at,[10,10],label);assert.ok(f.hp<1000,`${label}: still struck`);assert.equal(shouts(s.steps).length,1,`${label}: and shouted`);};
 inPlace(h=>{h.grid[10][12]=0;},'a wall behind it');
 inPlace(h=>{enemy(h,12,10,'drone');},'a unit behind it');
 inPlace(h=>{h.grid[10][12]=VOID;},'a pit behind it');
 inPlace(h=>{h.props=[{id:'crate',type:'cover',x:12,y:10,hp:60,maxHp:60}];},'a crate behind it');
 inPlace(h=>{edge(h,'door',{x:11,y:10},{x:12,y:10});},'a closed door behind it');
 inPlace(h=>{edge(h,'low_partition',{x:11,y:10},{x:12,y:10});},'a low partition behind it (no blow from there)');
 inPlace(h=>{h.player.suppression=3;},'pinned');
 // Over a low partition between them: through to the far side, which the blade reaches; with no far side, no strike at all.
 const v=arena(),w=aim(v,enemy(v,11,10));edge(v,'low_partition',{x:10,y:10},{x:11,y:10});aim(v,w);const s=go(v);assert.deepEqual(s.at,[12,10]);assert.ok(w.hp<1000);
 const x=arena(),y=aim(x,enemy(x,11,10));edge(x,'low_partition',{x:10,y:10},{x:11,y:10});x.grid[10][12]=0;aim(x,y);refusedFree(x,'room');
 // A plain blade swing at an adjacent enemy is no Tenchu: no move, no shout.
 const z=arena(),q=aim(z,enemy(z,11,10)),plain=go(z,'fire');assert.deepEqual(plain.at,[10,10]);assert.equal(shouts(plain.steps).length,0);assert.ok(q.hp<1000);
});

test('every use shouts 「天誅！」 in the operator\'s bubble, before the pull; the line is the user\'s word in both languages',()=>{
 assert.ok(PLAYER_CUES.includes('tenchu'));assert.equal(PLAYER_LINES.tenchu,'天誅！');
 const g=arena(),e=aim(g,enemy(g,13,10));const r=go(g);const shout=shouts(r.steps);assert.equal(shout.length,1,'once');assert.equal(calloutLine(shout[0]),'天誅！');assert.equal(shout[0].visibility,'visible');
 const said=r.steps.findIndex(s=>s.effects.some(f=>f.type==='callout')),pulled=r.steps.findIndex(s=>s.before.player.x!==s.after.player.x);assert.ok(said>=0&&said<pulled,'the shout comes first');
 assert.ok(!g.logs.some(l=>l.text==='天誅！'),'a callout, never logged');
 const again=go(g);assert.equal(shouts(again.steps).length,1,'and again, next to it');assert.ok(e.hp<1000);
});
