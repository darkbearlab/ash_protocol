import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {applySuppression,pinned} from '../src/suppression.js';
import {grantTrait} from '../src/traits.js';

// 3.145.0 (user decision 2026-09-19, docs/SUPPRESSION.md): stacks halve when the unit's own turn is over, player and
// enemies alike, instead of at the end of the round. Before, stacks put on the player in the enemy phase were halved
// before the player ever acted, so the player could never be pinned (5 became 2).
function arena(character='soldier'){
 const g=new Game(3,[],0,character,undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];g.flares=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(p,{x:10,y:10});g.end={x:25,y:25};g.reveal();
 return g;
}
const foe=(g,x,y,id)=>{const e=makeEnemy('rifleman',x,y,id,1);Object.assign(e,{hp:500,maxHp:500,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;};

test('stacks an enemy puts on you are all there for your next action, and halve once it is done',()=>{
 const g=arena(),p=g.player;foe(g,16,10,'e');
 let pin=true;Object.defineProperty(g,'enemyAct',{value:()=>{if(pin)applySuppression(p,4);},configurable:true});
 assert.ok(g.action('wait'));
 assert.equal(p.suppression,4,'not halved at the end of the round any more');
 assert.ok(pinned(p));
 const turn=g.turn;assert.equal(g.action('move',[0,1]),false,'pinned: you cannot move this action');assert.equal(g.turn,turn);
 pin=false;assert.ok(g.action('wait'));
 assert.equal(p.suppression,2,'halved after your own action');
 assert.ok(g.action('move',[0,1]));
});

test('an enemy that acted before you keeps what you put on it until its own next turn',()=>{
 const g=arena(),p=g.player,fast=foe(g,14,10,'fast'),slow=foe(g,14,12,'slow');grantTrait(fast,'fast','test');
 Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 // Stacks land during your action: the fast one has had its turn, the ordinary one has not.
 const act=g.executePlayer.bind(g);g.executePlayer=(type,arg)=>{applySuppression(fast,4);applySuppression(slow,4);return act(type,arg);};
 assert.ok(g.action('wait'));
 assert.equal(fast.suppression,4,'still whole when its next turn comes');
 assert.equal(slow.suppression,2,'its turn came after yours and halved them');
 g.executePlayer=act;assert.ok(g.action('wait'));
 assert.equal(fast.suppression,2);assert.equal(slow.suppression,1);
 assert.equal(p.suppression??0,0);
});

test('a broken exoskeleton pins you for your next action',()=>{
 const g=arena(),p=g.player;foe(g,16,10,'e');p.wearables.push('exo');p.exoPlates=4;
 Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 assert.ok(g.action('prepare',{category:'item',id:'exo'}));
 Object.defineProperty(g,'enemyAct',{value:()=>{if(p.wearables.includes('exo'))g.damagePlayer(20,'test');},configurable:true});
 assert.ok(g.action('wait'));
 assert.ok(!p.wearables.includes('exo'));assert.equal(p.suppression,5);
 assert.equal(g.action('move',[0,1]),false,'all five stacks are there: pinned');
});
