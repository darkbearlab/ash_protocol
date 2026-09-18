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
