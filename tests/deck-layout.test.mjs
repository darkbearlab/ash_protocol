import test from 'node:test';
import assert from 'node:assert/strict';
import {DECK_GRID,DECK_IDS,DECK_SLOTS,DECK_COLUMNS,validDeckLayout,mirrorDeck,deckPlacement,swapSlots,parseDeckLayout,DECK_LABELS,DECK_GLYPHS} from '../src/deck-layout.js';

test('the default grid holds every deck button exactly once in fifteen slots',()=>{
 assert.equal(DECK_GRID.length,DECK_SLOTS);
 assert.ok(validDeckLayout(DECK_GRID));
 assert.equal(DECK_GRID.filter(Boolean).length,DECK_IDS.length);
});

test('mirroring reverses each row and stays valid',()=>{
 const mirrored=mirrorDeck(DECK_GRID);
 assert.ok(validDeckLayout(mirrored));
 assert.deepEqual(mirrored.slice(0,DECK_COLUMNS),DECK_GRID.slice(0,DECK_COLUMNS).reverse());
 assert.deepEqual(mirrorDeck(mirrored),DECK_GRID);
});

test('validation rejects layouts that would strand the player',()=>{
 const drop=DECK_GRID.map(id=>id==='fire'?null:id);
 const twice=DECK_GRID.map(id=>id==='item'?'fire':id);
 for(const bad of [drop,twice,DECK_GRID.slice(1),[...DECK_GRID,'fire'],DECK_GRID.map(id=>id==='wait'?'menu':id),'grid',null])
  assert.equal(validDeckLayout(bad),false);
});

test('placement gives every button a one-based row and column',()=>{
 const spots=deckPlacement(DECK_GRID);
 assert.equal(spots.length,DECK_IDS.length);
 assert.deepEqual(spots.find(s=>s.id==='reload'),{id:'reload',selector:'[data-action="reload"]',row:1,column:1});
 assert.deepEqual(spots.find(s=>s.id==='down'),{id:'down',selector:'[data-move="0,1"]',row:3,column:2});
 assert.ok(spots.every(s=>s.row>=1&&s.row<=3&&s.column>=1&&s.column<=DECK_COLUMNS));
});

test('swapping two slots keeps the layout valid and is its own inverse',()=>{
 const moved=swapSlots(DECK_GRID,0,10);
 assert.ok(validDeckLayout(moved));
 assert.equal(moved[10],DECK_GRID[0]);assert.equal(moved[0],null);
 assert.deepEqual(swapSlots(moved,0,10),DECK_GRID);
 const both=swapSlots(DECK_GRID,3,6);
 assert.deepEqual([both[3],both[6]],[DECK_GRID[6],DECK_GRID[3]]);
 assert.ok(validDeckLayout(both));
});

test('stored layouts are accepted only when they validate',()=>{
 assert.deepEqual(parseDeckLayout(JSON.stringify(DECK_GRID)),DECK_GRID);
 assert.deepEqual(parseDeckLayout(JSON.stringify(mirrorDeck(DECK_GRID))),mirrorDeck(DECK_GRID));
 for(const bad of ['','{','null','[]',JSON.stringify(DECK_GRID.slice(1)),JSON.stringify(DECK_GRID.map(id=>id==='fire'?null:id))])
  assert.equal(parseDeckLayout(bad),null);
});

test('every button has a label and a glyph for the editor',()=>{
 for(const id of DECK_IDS){assert.ok(DECK_LABELS[id]);assert.ok(DECK_GLYPHS[id]);}
 assert.equal(Object.keys(DECK_LABELS).length,DECK_IDS.length);
 assert.equal(Object.keys(DECK_GLYPHS).length,DECK_IDS.length);
});

test('mirroring keeps the compass: the left arrow stays left of 等待',()=>{
 const mirrored=mirrorDeck(DECK_GRID);
 const at=(layout,id)=>{const i=layout.indexOf(id);return {row:Math.floor(i/DECK_COLUMNS),column:i%DECK_COLUMNS};};
 const wait=at(mirrored,'wait'),left=at(mirrored,'left'),right=at(mirrored,'right'),up=at(mirrored,'up'),down=at(mirrored,'down');
 assert.equal(left.row,wait.row);assert.equal(right.row,wait.row);
 assert.ok(left.column<wait.column,'left arrow must sit left of wait');
 assert.ok(right.column>wait.column,'right arrow must sit right of wait');
 assert.equal(up.column,wait.column);assert.equal(down.column,wait.column);
 assert.ok(up.row<wait.row&&down.row>wait.row);
 // The cluster really did move to the other thumb.
 assert.ok(wait.column>at(DECK_GRID,'wait').column);
});
