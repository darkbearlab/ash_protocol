import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SPRAY_PLATES,SURGE_COST,SURGE_STEPS,itemUseReason} from '../src/game.js';
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

// 3.110.0 (user request): consumables have no carry cap anywhere — the pack picks them up uncapped, so the terminal
// must not cap them either, or the two would tell the player different things.
// 3.136.0 (user decision): the carry cap of five applies; one bought past it waits at your feet.
test('the terminal sells both up to the carry cap, and old saves migrate to none',()=>{
 assert.equal(SAVE_VERSION,65);   // 3.138.0: the perk rules
 const g=run(),p=g.player;
 p.sprays=4;p.adrenaline=5;p.scrap=999;g.items=[];
 g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(g.useTerminal('spray'),true);
 assert.equal(p.sprays,5);
 g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(g.useTerminal('adrenaline'),true,'still sold at the cap');
 assert.equal(p.adrenaline,5);assert.equal(g.items.find(i=>i.type==='adrenaline'&&i.x===p.x&&i.y===p.y)?.amount,1,'left at your feet');
 p.sprays=0;
 g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(g.useTerminal('spray'),true);
 assert.equal(p.sprays,1);
 const legacy=JSON.parse(g.serialize());legacy.version=SAVE_VERSION-1;
 delete legacy.data.player.sprays;delete legacy.data.player.adrenaline;
 const back=Game.restore(JSON.stringify(legacy));
 assert.ok(back,'an older save still loads');
 assert.equal(back.player.sprays,0);assert.equal(back.player.adrenaline,0);
});

// 3.107.0: the pack greys a 使用 button from this helper, so it has to agree with the turn itself.
test('itemUseReason names the refusal, and matches what the action would do',()=>{
 const g=run(),p=g.player;
 p.meds=0;p.sprays=0;p.adrenaline=0;
 for(const [id,entry] of Object.entries(PREPARED_CATALOG.item)){
  assert.match(itemUseReason(g,id),/沒有/,id);
  assert.equal(g.action(entry.action),false,`${id} refused with none carried`);
 }
 assert.equal(itemUseReason(g,'nothing'),'沒有這個道具');
 // Carried but pointless: each one names its own reason and the action still refuses.
 p.meds=1;p.sprays=1;p.adrenaline=1;
 p.hp=p.maxHp;p.poison=0;p.plates=g.plateCapacity;
 assert.equal(itemUseReason(g,'medkit'),'生命已滿且未中毒');
 assert.equal(itemUseReason(g,'spray'),'護甲板已滿');
 assert.equal(g.action('heal'),false);
 assert.equal(g.action('plate'),false);
 // Adrenaline: carried, but the health price and the leftover free moves both block it.
 assert.equal(itemUseReason(g,'adrenaline'),'');
 p.hp=SURGE_COST;
 assert.equal(itemUseReason(g,'adrenaline'),'生命不足以承受');
 p.hp=80;p.adrenaline=2;
 assert.equal(g.action('surge'),true);
 assert.equal(itemUseReason(g,'adrenaline'),'免費移動還沒用完');
});

test('a consumable needs no prepared slot to work',()=>{
 const g=run(),p=g.player;
 g.action('prepare',{category:'item',id:null});
 assert.equal(p.prepared.item,null);
 p.meds=1;p.hp=p.maxHp-40;
 assert.equal(itemUseReason(g,'medkit'),'');
 assert.equal(g.action('heal'),true,'the pack uses it in place');
 assert.equal(p.meds,0);
});

// Caught in browser QA: the loader tied free moves to the ninja perk, so a save taken between the injection and the
// steps was rejected outright and the run was lost.
test('a save taken mid-adrenaline still loads, with the free moves intact',()=>{
 const g=run(),p=g.player;
 p.adrenaline=1;p.hp=80;
 assert.equal(g.action('surge'),true);
 assert.equal(g.shadowSteps,SURGE_STEPS);
 const back=Game.restore(g.serialize());
 assert.ok(back,'a soldier mid-surge is a legal state');
 assert.equal(back.shadowSteps,SURGE_STEPS);
 assert.equal(back.player.hp,80-SURGE_COST);
 // And the restored run can still spend them.
 assert.equal(back.action('move',[1,0]),true);
 assert.equal(back.shadowSteps,SURGE_STEPS-1);
});
