// 3.177.6 (user): a ground item you could not take any of right now is drawn dimmed. Game.canTake must say exactly what
// pickup() would do, for every kind of ground item, before and after the carrier fills up.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,WEAPONS} from '../src/engine.js';
import {FIELD_ITEMS} from '../src/containers.js';
import {LOOT_ICON} from '../src/loot-icons.js';
import {Renderer} from '../src/renderer.js';

// Piles carry an explicit amount, so taking part of one shows as a smaller pile.
const KINDS=[...['ammo','pistol','shell','energy','ordnance'].map(type=>({type,amount:10})),...['grenade','emp','stun','smoke','med',...FIELD_ITEMS].map(type=>({type,amount:1})),
 {type:'armor',amount:20},{type:'exo'},{type:'irg'},{type:'nvg'},{type:'scrap'},{type:'weapon',weapon:WEAPONS.findIndex(w=>w.id==='rifle')}];
// Put one fresh copy under the operator and pick it up; says whether any of it left the floor. (A weapon is registered
// to the operator even when a full pack leaves it lying there, so the operator's state is not the measure.)
function pick(g,kind){
 const p=g.player,item={...kind,x:p.x,y:p.y};g.items=[item];g.pickup();
 const left=g.items.find(i=>i===item);return !left||kind.amount!==undefined&&left.amount<kind.amount;
}
test('canTake says what pickup would do, for every kind of ground item, until the carrier is full',()=>{
 for(const kind of KINDS){
  const g=new Game(3177,[],0,'soldier','onyx');g.enemies=[];let full=false;
  for(let i=0;i<300&&!full;i++){
   const expect=g.canTake({...kind,x:g.player.x,y:g.player.y});
   assert.equal(pick(g,kind),expect,`${kind.type} #${i}: canTake ${expect}`);
   full=!expect;
  }
  if(['scrap'].includes(kind.type))assert.ok(!full,'scrap is always taken');
  else assert.ok(full,`${kind.type}: the carrier fills up`);
 }
});
test('the renderer draws an item you could not take at the dim opacity, and a takeable one as it is',()=>{
 const alphas=[],ctx={globalAlpha:1,save(){this.stack=[...(this.stack||[]),this.globalAlpha];},restore(){this.globalAlpha=this.stack.pop();}};
 const draw=take=>{const r={ctx,game:{canTake:()=>take},item:()=>alphas.push(ctx.globalAlpha)};Renderer.prototype.groundItem.call(r,{x:0,y:0},{type:'ammo'},0);};
 draw(true);draw(false);
 assert.deepEqual(alphas,[1,LOOT_ICON.dim]);assert.equal(ctx.globalAlpha,1,'the canvas is restored');
 assert.ok(LOOT_ICON.dim>0&&LOOT_ICON.dim<1);
});
