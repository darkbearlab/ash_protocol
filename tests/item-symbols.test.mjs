import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLY_NAMES} from '../src/data.js';
import {ITEM_SYMBOLS,ITEM_COLORS} from '../src/renderer.js';
import {LINE_ITEMS} from '../src/lines.js';

// 3.136.1 (user report): a dropped grapple line printed "undefined" on its tile. Every item that can lie on the ground
// needs a symbol and a colour of its own.
test('every ground item type has a symbol and a colour',()=>{
 for(const type of [...Object.keys(SUPPLY_NAMES),...Object.keys(LINE_ITEMS),'nvg']){
  assert.equal(typeof ITEM_SYMBOLS[type],'string',`${type} symbol`);assert.ok(ITEM_SYMBOLS[type].length,`${type} symbol`);
  assert.match(ITEM_COLORS[type]||'',/^#[0-9a-f]{6}$/i,`${type} colour`);
 }
});

// 3.136.2 (user request): ground items shrink with the map and hide once it is small.
test('ground items shrink with the tile, never grow, and hide below 25 px; full size draws untransformed',async()=>{
 const {Renderer,itemScale}=await import('../src/renderer.js');
 assert.equal(itemScale(60),1);assert.equal(itemScale(38),1);assert.ok(Math.abs(itemScale(38*.85)-.85)<1e-9);assert.ok(Math.abs(itemScale(38*.7)-.7)<1e-9);
 assert.equal(itemScale(38*.65),0,'the smallest zoom step hides them');
 const draw=tile=>{const calls=[];const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>{calls.push([k,...a]);},set:(o,k,v)=>{o[k]=v;return true;}});
  const r=Object.assign(Object.create(Renderer.prototype),{tile,ctx,game:{weaponAt:()=>({code:'X'})}});r.item({x:100,y:200},{type:'redeploy_line',x:0,y:0},0);return calls;};
 const full=draw(38),small=draw(38*.7),none=draw(24.7);
 assert.ok(full.length&&!full.some(c=>['save','scale','translate'].includes(c[0])),'full size: exactly the old calls');
 const scale=small.find(c=>c[0]==='scale');assert.ok(scale&&Math.abs(scale[1]-.7)<1e-9&&scale[1]===scale[2],'drawn at 70%');
 assert.ok(small.some(c=>c[0]==='translate'&&c[1]===100&&c[2]===200)&&small.at(-1)[0]==='restore');
 assert.deepEqual(none,[],'hidden: nothing drawn');
});
