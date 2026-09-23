import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLY_ROOMS} from '../src/data.js';
import {MODULE_TYPES} from '../src/modules.js';

// 3.165.2 (user decision 2026-09-23, docs/TEXT_INVENTORY.md): zone labels painted on the floor are English stencils in
// every language, so they stay out of the language table.
const stencil=/^[A-Z]{2,8}$/;

test('supply rooms paint an English stencil and keep no Chinese name',()=>{
  assert.deepEqual(Object.keys(SUPPLY_ROOMS).sort(),['ammo','armor','medical']);
  for(const [kind,room] of Object.entries(SUPPLY_ROOMS)){
    assert.match(room.code,stencil,kind);
    assert.equal(room.name,undefined,kind);
  }
});

test('living modules paint English stencils',()=>{
  for(const [theme,module] of Object.entries(MODULE_TYPES))assert.match(module.code,stencil,theme);
});
