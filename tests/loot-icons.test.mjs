import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WEAPONS} from '../src/data.js';
import {weaponStats} from '../src/weapons.js';
import {AMMUNITION,MELEE_TINT} from '../src/ammunition.js';
import {PREPARED_CATALOG} from '../src/prepared.js';
import {ITEM_COLORS,ITEM_SCALE,itemScale} from '../src/renderer.js';
import {LOOT_ICON,SPECIAL_LOOT,lootCell} from '../src/loot-icons.js';

// 3.154.0 (art by Codex and the user, docs/LOOT_ICONS_HANDOFF.md): five classes of ground loot share one atlas. The
// classification follows the pack (user decision 2026-09-20), so these tests read the pack's own catalogue.
test('every ground item type has a cell, or is one of the three that keep their own mark',()=>{
 for(const type of Object.keys(ITEM_COLORS)){
  const cell=lootCell({type,slot:0},type==='weapon'?weaponStats(0):null);
  if(SPECIAL_LOOT.includes(type)){assert.equal(cell,null,`${type} keeps its own mark`);continue;}
  assert.ok(cell,`${type} has no cell`);
  assert.ok(cell.col>=0&&cell.col<LOOT_ICON.columns&&cell.row>=0&&cell.row<LOOT_ICON.rows,`${type} is inside the atlas`);
 }
});

test('the pack decides the classes: its throwables are one column, its items another',()=>{
 for(const entry of Object.values(PREPARED_CATALOG.grenade))
  assert.deepEqual(lootCell({type:entry.item},null),{col:5,row:0},`${entry.item} is a throwable in the pack`);
 const gear={medkit:'med',spray:'spray',adrenaline:'adrenaline',barricade:'barricade',flare:'flare',escape_line:'escape_line',
  redeploy_line:'redeploy_line',irg:'irg',nvg:'nvg',decoy:'decoy',mine:'mine',exo:'exo'};
 assert.deepEqual(Object.keys(gear),Object.keys(PREPARED_CATALOG.item),'the pack item list and this table agree');
 for(const type of Object.values(gear))assert.deepEqual(lootCell({type},null),{col:6,row:0},`${type} is gear`);
 assert.deepEqual(lootCell({type:'armor'},null),{col:6,row:0},'armour plates are gear too');
 assert.deepEqual(lootCell({type:'scrap'},null),{col:7,row:0});
});

test('a weapon and its ammunition share the column of the ammo type, and melee weapons are tinted',()=>{
 const column={pistol:0,rifle:1,shell:2,energy:3,ordnance:4};
 for(const [type,ammo] of Object.entries(AMMUNITION)){
  if(column[type]===undefined)continue;   // the grenade resource is a throwable, not a magazine
  assert.deepEqual(lootCell({type:ammo.item},null),{col:column[type],row:1},`${ammo.item} sits under its own weapons`);
 }
 WEAPONS.forEach((definition,slot)=>{
  const weapon=weaponStats(slot),cell=lootCell({type:'weapon',slot},weapon);
  assert.ok(cell,`${definition.code} has a cell`);
  if(weapon.melee){assert.deepEqual(cell,{col:0,row:0,tint:MELEE_TINT},`${definition.code} uses the melee tint`);return;}
  assert.deepEqual(cell,{col:column[weapon.ammoType],row:0},`${definition.code} follows its ammo type`);
 });
});

test('the atlas is the eight by two grid of 16px cells the handoff describes',async()=>{
 const png=await readFile(new URL('../assets/pixel/loot-icons-v1/atlas.png',import.meta.url));
 assert.equal(png.readUInt32BE(16),LOOT_ICON.cell*LOOT_ICON.columns);
 assert.equal(png.readUInt32BE(20),LOOT_ICON.cell*LOOT_ICON.rows);
});

test('loot stays visible across the whole zoom range the player can reach',()=>{
 const smallest=38*.65;   // the narrow layout at the furthest zoom out (renderer resize, controller zoomBy)
 assert.ok(ITEM_SCALE.hideBelow<smallest,`items must not vanish at ${smallest.toFixed(1)}px tiles`);
 assert.ok(LOOT_ICON.size*itemScale(smallest)>=12,'and the icon is still bigger than a floor speck');
 assert.equal(itemScale(ITEM_SCALE.hideBelow-1),0,'below the threshold nothing is drawn, as before');
});
