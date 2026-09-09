import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';

test('QA currency persists across death/reload, never writes real saves, and results are idempotent',async()=>{
  const memory=new Map([['ash-profile','real-profile'],['ash-save','real-save']]);
  globalThis.location={search:'?test=1'};
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const {saveGame,loadGame,profile,recordResult}=await import('../src/storage.js');
  const g=new Game(31);g.awardProtocol('lore',1);saveGame(g);assert.equal(profile().protocol.balance,3);
  const restored=loadGame();saveGame(restored);assert.equal(profile().protocol.balance,3);
  restored.awardProtocol('floor',1);restored.status='dead';saveGame(restored);recordResult(restored);recordResult(restored);
  assert.equal(profile().protocol.balance,7);assert.equal(profile().runs,1);assert.equal(memory.has('qa-ash-save'),false);
  const sameSeed=new Game(31);sameSeed.awardProtocol('lore',1);saveGame(sameSeed);assert.equal(profile().protocol.balance,10);
  assert.equal(memory.get('ash-save'),'real-save');assert.equal(memory.get('ash-profile'),'real-profile');
  delete globalThis.location;delete globalThis.localStorage;
});
