import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SPRAY_PLATES,SURGE_COST,SURGE_STEPS,TERMINAL_STOCK} from '../src/game.js';
import {PREPARED_CATALOG} from '../src/prepared.js';
import {SAVE_VERSION} from '../src/data.js';

const run=()=>new Game(3,[],0,'soldier',undefined,'extraction');

test('both consumables sit in the item catalogue with a resource and an action',()=>{
 for(const id of ['spray','adrenaline']){
  const entry=PREPARED_CATALOG.item[id];
  assert.ok(entry&&entry.resource&&entry.action,id);
  assert.ok(Object.hasOwn(run().player,entry.resource),`${entry.resource} must be a player field`);
 }
});

test('the repair spray refills plates, costs a turn, and refuses when full',()=>{
 const g=run(),p=g.player;
 p.sprays=2;p.plates=0;
 const turn=g.turn;
 assert.equal(g.action('plate'),true);
 assert.equal(p.plates,SPRAY_PLATES);
 assert.equal(p.sprays,1);
 assert.ok(g.turn>turn,'using it advances the turn');
 // Never overfills, and the last points are not wasted silently.
 p.plates=g.plateCapacity-5;
 assert.equal(g.action('plate'),true);
 assert.equal(p.plates,g.plateCapacity);
 assert.equal(g.action('plate'),false,'no spray left');
 p.sprays=1;
 assert.equal(g.action('plate'),false,'plates already full');
});

test('adrenaline is free, priced in health, and buys movement only',()=>{
 const g=run(),p=g.player;
 p.adrenaline=1;p.hp=80;
 const turn=g.turn,x=p.x;
 assert.equal(g.action('surge'),true);
 assert.equal(p.hp,80-SURGE_COST);
 assert.equal(g.shadowSteps,SURGE_STEPS);
 assert.equal(g.turn,turn,'using it does not advance the turn');
 assert.equal(g.action('move',[1,0]),true);
 assert.equal(g.turn,turn,'the free move does not advance the turn either');
 assert.ok(p.x!==x);
 assert.equal(g.shadowSteps,SURGE_STEPS-1);
 // Anything other than a move forfeits what is left, exactly like 影步.
 g.action('wait');
 assert.equal(g.shadowSteps,0);
});

test('adrenaline can never be the thing that kills you, and does not stack',()=>{
 const g=run(),p=g.player;
 p.adrenaline=2;p.hp=SURGE_COST;
 assert.equal(g.action('surge'),false,'refused at exactly the cost');
 assert.equal(p.hp,SURGE_COST);
 p.hp=SURGE_COST+1;
 assert.equal(g.action('surge'),true);
 p.hp=80;
 assert.equal(g.action('surge'),false,'refused while free moves are already running');
});

test('the terminal sells both up to a carry cap, and old saves migrate to none',()=>{
 assert.equal(SAVE_VERSION,52);
 const g=run(),p=g.player;
 p.sprays=TERMINAL_STOCK;p.adrenaline=TERMINAL_STOCK;p.scrap=999;
 const terminal={type:'terminal',x:p.x,y:p.y,used:false};
 g.props.push(terminal);
 assert.equal(g.useTerminal('spray'),false,'carry cap');
 assert.equal(g.useTerminal('adrenaline'),false,'carry cap');
 p.sprays=0;
 assert.equal(g.useTerminal('spray'),true);
 assert.equal(p.sprays,1);
 const legacy=JSON.parse(g.serialize());legacy.version=SAVE_VERSION-1;
 delete legacy.data.player.sprays;delete legacy.data.player.adrenaline;
 const back=Game.restore(JSON.stringify(legacy));
 assert.ok(back,'an older save still loads');
 assert.equal(back.player.sprays,0);assert.equal(back.player.adrenaline,0);
});
