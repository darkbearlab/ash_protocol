// 3.210.0 (user 2026-10-01, docs/SKILLS.md 訊號斷層 外觀, docs/MELEE_CLASSES.md 迷彩中的連斬): your own stealth shows on your
// sprite — the recon under 訊號斷層 almost fully transparent, the ninja under its camouflage half there, both with a bright
// outline. Presentation only (src/actor-visuals.js stealthLook, drawn by src/renderer-actors.js; qa/render-snapshots.mjs
// has a scene for each).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {STEALTH_VISUAL,stealthLook} from '../src/actor-visuals.js';

test('signal break nearly hides the recon, camouflage halves the ninja, both outlined; nothing otherwise',()=>{
 const r=new Game(1,[],0,'recon','onyx'),n=new Game(1,[],0,'ninja','onyx'),s=new Game(1,[],0,'soldier','onyx');
 assert.equal(stealthLook(r.player),null);assert.equal(stealthLook(n.player),null);assert.equal(stealthLook(s.player),null);
 assert.ok(r.action('usePrepared',{category:'skill'}));const look=stealthLook(r.player);
 assert.deepEqual(look,{alpha:STEALTH_VISUAL.signalAlpha,outline:STEALTH_VISUAL.outline});assert.ok(look.alpha>0&&look.alpha<=.2,'almost, not fully, transparent');
 assert.ok(n.action('usePrepared',{category:'skill'}));const half=stealthLook(n.player);
 assert.deepEqual(half,{alpha:STEALTH_VISUAL.camoAlpha,outline:STEALTH_VISUAL.outline});assert.ok(half.alpha>=.35&&half.alpha<=.6,'semi-transparent');
 for(let i=0;i<5;i++)n.action('wait');assert.equal(stealthLook(n.player),null,'gone when the camouflage ends');
 for(let i=0;i<3;i++)r.action('wait');assert.equal(stealthLook(r.player),null,'gone when the signal break ends');
});
