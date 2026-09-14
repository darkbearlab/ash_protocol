// Read-only comparison against the last release; the temporary module is under ignored qa/node.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Renderer} from '../src/renderer.js';
import {ENEMY_TYPES,makeEnemy} from '../src/engine.js';
import {SPRITE_NAMES} from '../src/enemy-visuals.js';
const dir=new URL('./node/',import.meta.url);mkdirSync(dir,{recursive:true});
const path=new URL('civilian-before-renderer.mjs',dir);
writeFileSync(path,execFileSync('git',['show','fac5503:src/renderer.js'],{encoding:'utf8'}).replaceAll("from './","from '../../src/"));
const Before=(await import(path.href)).Renderer;
function capture(Class){
 const calls=[],ctx=new Proxy({}, {get:(_,name)=>(...args)=>calls.push([name,...args]),set:(_,name,value)=>{calls.push(['set',name,value]);return true;}});
 for(const type of Object.keys(ENEMY_TYPES).filter(id=>id!=='civilian'))for(const loaded of [false,true])for(const state of ['plain','windup','disabled'])for(const faction of ['legacy','loyalist','rebel']){
  const r=Object.create(Class.prototype);Object.assign(r,{ctx,tile:38,sprites:{complete:loaded,naturalWidth:128},spriteNames:SPRITE_NAMES,game:{player:{x:10,y:10},lighting:[[1]]},unproject:()=>({x:0,y:0})});
  for(const method of ['box','line','glow','text','sprite','classSprite','enemySprite','enemyBars'])r[method]=(...args)=>{calls.push([method,...args]);return loaded;};
  const e=makeEnemy(type,12,10,'render',3,0,faction);if(state==='windup'){e.charge=true;e.windup=2;}if(state==='disabled')e.control.disabled=2;
  r.actor({x:24,y:32},type,0,e);
 }
 return calls;
}
const before=capture(Before),after=capture(Renderer);assert.deepEqual(after,before);
console.log(`All ${after.length} original-enemy drawing calls/parameters identical to fac5503 (loaded/fallback, plain/windup/disabled, three factions).`);
