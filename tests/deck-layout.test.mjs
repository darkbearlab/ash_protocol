import test from 'node:test';
import assert from 'node:assert/strict';
import {DECK_GRID,DECK_IDS,DECK_SLOTS,DECK_COLUMNS,validDeckLayout,mirrorDeck,deckPlacement} from '../src/deck-layout.js';

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
