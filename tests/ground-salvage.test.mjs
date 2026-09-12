// 3.50.0 (Claude, user request): salvage a dropped weapon where it lies, without picking it up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,WEAPONS} from '../src/engine.js';
import {spriteSize} from '../src/target-card.js';

function arena(character='soldier'){
 const g=new Game(5010,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke'])g[k]=[];
 g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
const drop=(g,base,x=11,y=10)=>{const item=g.registerWeapon({x,y,type:'weapon',weapon:base},true);g.items.push(item);return item;}

test('ground salvage pays magazine and scrap, removes the weapon and costs one turn',()=>{
 const g=arena(),item=drop(g,3);g.player.upgrades[item.slot]=2;g.player.reserve=10;
 const scrap=g.player.scrap,turn=g.turn,mag=g.player.ammo[item.slot];
 assert.ok(g.action('salvageGround',item.slot));
 assert.equal(g.player.scrap,scrap+40,'20 base plus 10 per modification level');
 assert.equal(g.player.reserve,10+mag);assert.equal(g.player.ammo[item.slot],0);assert.equal(g.player.upgrades[item.slot],0);
 assert.equal(g.items.length,0);assert.equal(g.turn,turn+1);
 assert.ok(Game.restore(g.serialize()),'the freed slot still round-trips');
});

test('a full pack can still salvage from the ground, which picking up cannot',()=>{
 const g=arena();while(g.player.owned.length<g.weaponCapacity)g.player.owned.push(drop(g,0).slot);
 g.items=[];const item=drop(g,4);const turn=g.turn;
 assert.equal(g.action('takeWeapon',item.slot),false,'pack is full');
 assert.equal(g.turn,turn,'a refused pickup costs nothing');
 assert.ok(g.action('salvageGround',item.slot));assert.equal(g.items.length,0);
});

test('out of reach or bound weapons are refused without spending a turn',()=>{
 const g=arena(),far=drop(g,3,15,10);const turn=g.turn;
 assert.equal(g.action('salvageGround',far.slot),false);assert.equal(g.turn,turn);assert.equal(g.items.length,1);
 const bound=WEAPONS.findIndex(w=>w.locked);const h=arena(),locked=drop(h,bound);
 assert.equal(h.action('salvageGround',locked.slot),false);assert.equal(h.items.length,1);
});

test('sprites keep the same share of a tile at every zoom level',()=>{
 const ratios=[20,25,29,30,34,38,45].map(t=>spriteSize(t)/t);
 assert.ok(Math.max(...ratios)-Math.min(...ratios)<.04,`sprite/tile ratios drift: ${ratios.map(r=>r.toFixed(2))}`);
 assert.equal(spriteSize(38),32,'the default mobile tile keeps the original 32px sprite');
});
