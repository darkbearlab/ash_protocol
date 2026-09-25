import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,TERMINAL_ITEMS,terminalReason} from '../src/game.js';
import {PREPARED_CATALOG,WEARABLE_IDS,isWearable,wornEntry,prepareCost,preparedOptions,canPrepare,validPrepared,validWearableCatalog} from '../src/prepared.js';
import {lightingEffects} from '../src/lighting.js';
import {activeTrait} from '../src/traits.js';
import {SAVE_VERSION} from '../src/data.js';

const run=()=>new Game(3,[],0,'soldier',undefined,'extraction');
const own=g=>{g.player.wearables.push('nvg');return g;};
const terminal=g=>{g.player.scrap=999;g.props.push({type:'terminal',x:g.player.x,y:g.player.y,used:false});return g;};

test('the catalogue declares real traits, and a wearable has no action to run',()=>{
 assert.ok(WEARABLE_IDS.length,'at least one wearable exists');
 assert.ok(validWearableCatalog(),'every declared passive is a real trait');
 for(const id of WEARABLE_IDS){
  const entry=PREPARED_CATALOG.item[id];
  assert.ok(isWearable(id));
  assert.equal(entry.action,undefined,'the slot is a 生效欄 for it, not a quick-use slot');
  assert.equal(entry.resource,undefined,'wearables are owned, not stocked');
 }
});

test('a wearable has to be owned before it can be worn',()=>{
 const g=run(),p=g.player;
 assert.deepEqual(p.wearables,[]);
 assert.ok(!preparedOptions(p,'item').some(([id])=>id==='nvg'),'not listed while unowned');
 assert.equal(canPrepare(p,'item','nvg'),false);
 assert.equal(g.action('prepare',{category:'item',id:'nvg'}),false);
 assert.equal(p.prepared.item,'medkit');
 own(g);
 assert.ok(preparedOptions(p,'item').some(([id])=>id==='nvg'));
 assert.equal(canPrepare(p,'item','nvg'),true);
});

test('putting one on and taking it off cost a turn each; everything else stays free',()=>{
 const g=own(run()),p=g.player;
 assert.equal(g.actionCost('prepare',{category:'item',id:'medkit'}),0,'consumable → consumable is free');
 assert.equal(g.actionCost('prepare',{category:'grenade',id:'smoke'}),0);
 assert.equal(g.actionCost('prepare',{category:'item',id:'nvg'}),1,'putting it on');
 let turn=g.turn;
 assert.equal(g.action('prepare',{category:'item',id:'nvg'}),true);
 assert.equal(g.turn,turn+1);
 assert.equal(wornEntry(p)?.name,'夜視鏡');
 assert.equal(g.actionCost('prepare',{category:'item',id:null}),1,'taking it off');
 // Wearable → consumable is one turn in total, not two: only the swap is paid for.
 assert.equal(prepareCost(p,{category:'item',id:'medkit'}),1);
 turn=g.turn;
 assert.equal(g.action('prepare',{category:'item',id:'medkit'}),true);
 assert.equal(g.turn,turn+1);
 assert.equal(wornEntry(p),null);
 assert.equal(g.actionCost('prepare',{category:'item',id:null}),0,'and it is free again once nothing is worn');
});

test('the passives follow the slot, and the goggles really cancel the dark penalty',()=>{
 const g=own(run()),p=g.player;
 const dark={x:p.x+3,y:p.y};
 g.lighting[dark.y][dark.x]=0;
 assert.ok(lightingEffects(g,p,dark).penalty>0,'dark costs accuracy without them');
 assert.equal(g.action('prepare',{category:'item',id:'nvg'}),true);
 assert.ok(activeTrait(p,'night_vision'));
 assert.equal(lightingEffects(g,p,dark).penalty,0);
 assert.equal(g.action('prepare',{category:'item',id:null}),true);
 assert.equal(activeTrait(p,'night_vision'),false,'and they are gone the moment it comes off');
 assert.equal(p.traits.filter(t=>t.source==='item:wear').length,0);
});

test('saves carry ownership, re-derive the passives, and refuse a slot the run cannot fill',()=>{
 assert.equal(SAVE_VERSION,74);   // 3.148.0: perk D
 const g=own(run()),p=g.player;
 assert.equal(g.action('prepare',{category:'item',id:'nvg'}),true);
 const back=Game.restore(g.serialize());
 assert.ok(back);
 assert.deepEqual(back.player.wearables,['nvg']);
 assert.equal(back.player.prepared.item,'nvg');
 assert.ok(activeTrait(back.player,'night_vision'));
 // Claiming to wear something the run never picked up is rejected outright.
 const forged=JSON.parse(g.serialize());forged.data.player.wearables=[];
 assert.equal(validPrepared(forged.data.player),false);
 assert.equal(Game.restore(JSON.stringify(forged)),null);
 // Keeping the passive after taking them off is not rejected, just undone.
 const stale=JSON.parse(g.serialize());stale.data.player.prepared.item=null;
 assert.ok(stale.data.player.traits.some(t=>t.source==='item:wear'));
 const healed=Game.restore(JSON.stringify(stale));
 assert.ok(healed);
 assert.equal(activeTrait(healed.player,'night_vision'),false);
 // Older saves simply own none.
 const legacy=JSON.parse(g.serialize());legacy.version=SAVE_VERSION-1;
 delete legacy.data.player.wearables;legacy.data.player.prepared.item='medkit';
 const old=Game.restore(JSON.stringify(legacy));
 assert.ok(old);
 assert.deepEqual(old.player.wearables,[]);
});

test('the terminal stocks exactly what the rules will sell, and only one of each wearable',()=>{
 for(const [id,offer] of Object.entries(TERMINAL_ITEMS)){
  assert.ok(PREPARED_CATALOG.item[id],`${id} is a real catalogue item`);
  assert.ok(Number.isInteger(offer.cost)&&offer.cost>0,`${id} has a price`);
  assert.ok(Boolean(offer.resource)!==Boolean(offer.wear),`${id} is either stocked or worn, not both`);
  if(offer.wear)assert.ok(isWearable(offer.wear));
  if(offer.resource)assert.ok(Object.hasOwn(run().player,offer.resource));
 }
 const g=terminal(run()),p=g.player;
 // 3.135.0 (user decision): goggles are not sold any more — snipers and unidentified crates are where they come from.
 assert.equal(TERMINAL_ITEMS.nvg.sold,false);assert.equal(g.useTerminal('nvg'),false,'goggles are not on sale');
 assert.deepEqual(p.wearables,[]);
 assert.equal(g.useTerminal('spray'),true);
 assert.equal(p.sprays,1);
 p.sprays=99;
 g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(g.useTerminal('spray'),true,'consumables have no carry cap (3.110.0)');
});

// Caught in browser QA: validateAction kept a second whitelist that never learned about the 3.106.0 items, so the
// terminal refused them before the screen was ever consulted. Both entry points must now answer identically.
test('the action gate and the trade itself always agree about the terminal',()=>{
 const options=['heal','ammo','grenade','smoke','emp','stun','pistol','rifle','shell','energy','ordnance',...Object.keys(TERMINAL_ITEMS),'nonsense'];
 for(const option of options){
  const g=terminal(run()),p=g.player;
  for(const scrap of [0,999]){
   p.scrap=scrap;
   const allowed=!terminalReason(g,option);
   assert.equal(g.action('terminal',option),allowed,`${option} at ${scrap} scrap`);
   if(allowed)assert.ok(p.scrap<scrap,'a trade that goes through charges for itself');
   else assert.equal(p.scrap,scrap,'a refused trade costs nothing');
   g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
  }
 }
});
