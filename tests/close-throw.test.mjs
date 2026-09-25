// 3.177.9 (user): the ninja's own stun grenades and EMPs pass it by, so it can throw one at its feet (close throw), and it
// sees through smoke like the recon (infrared). Enemies around it are disabled as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {DISRUPT_TURNS} from '../src/throwables.js';
import {activeTrait} from '../src/traits.js';
function arena(character){
 const g=new Game(3177,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 for(const [x,y] of [[11,10],[9,10],[10,12]]){const e=makeEnemy('crawler',x,y,`qa-${x}-${y}`);Object.assign(e,{hp:500,maxHp:500,alert:true});g.enemies.push(e);}
 g.reveal();return g;
}
const stunAtFeet=g=>{g.player.stun=1;g.player.prepared.grenade='stun';return g.action('grenade',{x:g.player.x,y:g.player.y});};
test('the ninja throws a stun grenade at its feet: the swarm around it is disabled, the ninja is not',()=>{
 const g=arena('ninja');
 assert.ok(activeTrait(g.player,'close_throw')&&activeTrait(g.player,'infrared')&&activeTrait(g.player,'night_vision'));
 assert.ok(stunAtFeet(g));
 assert.equal(g.player.control.disabled,0,'close throw');
 assert.ok(g.enemies.every(e=>e.control.disabled>0),'every crawler within two tiles');
});
test('anyone else is caught by their own stun grenade as before',()=>{
 const g=arena('recon');assert.ok(!activeTrait(g.player,'close_throw'));
 assert.ok(stunAtFeet(g));
 assert.equal(g.player.control.disabled,DISRUPT_TURNS);
});
test('a ninja run saved before 3.177.9 gains infrared and close throw on load',()=>{
 const g=arena('ninja'),raw=JSON.parse(g.serialize());
 raw.data.player.traits=raw.data.player.traits.filter(t=>!['infrared','close_throw'].includes(t.id));
 const back=Game.restore(JSON.stringify(raw));assert.ok(back);
 for(const id of ['infrared','close_throw'])assert.equal(back.player.traits.filter(t=>t.id===id&&t.source==='character:ninja').length,1,id);
 const again=Game.restore(back.serialize());assert.equal(again.player.traits.length,back.player.traits.length,'no duplicates on a second load');
});
