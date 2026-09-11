import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {SAVE_VERSION,LEGACY_SAVE_VERSIONS} from '../src/data.js';
import {PROFILE_VERSION,normalizeProfile} from '../src/progression.js';
import {validateProfile} from '../src/backup.js';
import {SKILLS} from '../src/skills.js';
import {SUMMON_INTERVAL} from '../src/allies.js';
import {dailySeed,dateKey,dailyMission} from '../src/daily.js';
import {MISSIONS} from '../src/missions.js';

// 3.44: traps that would only show up at the next format change, plus the salted daily seed.
const memoryStorage=(memory,fail=()=>false)=>({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{if(fail(k))throw new Error('quota');memory.set(k,v);},removeItem:k=>memory.delete(k)});

test('every earlier save version stays accepted and is backed up before migrating, derived from SAVE_VERSION',async()=>{
  assert.deepEqual(LEGACY_SAVE_VERSIONS,Array.from({length:SAVE_VERSION-1},(_,i)=>i+1));
  const raw=JSON.stringify({version:SAVE_VERSION-1,data:null}),memory=new Map([['qa-ash-save',raw]]);
  globalThis.location={search:'?test=1'};globalThis.localStorage=memoryStorage(memory);
  const storage=await import('../src/storage.js?versions344');
  assert.equal(storage.loadGame(),null);assert.equal(memory.get(`qa-ash-save-v${SAVE_VERSION-1}-backup`),raw);
});

test('profile format lives in one constant: backups accept it and carrying levels survive normalizing',()=>{
  const p=normalizeProfile();assert.equal(p.version,PROFILE_VERSION);validateProfile(p);
  assert.throws(()=>validateProfile({...p,version:PROFILE_VERSION+1}),/版本/);
  const levels=normalizeProfile({...p,upgrades:{carrying:{...p.upgrades.carrying,rifle:1}}}).upgrades.carrying;assert.equal(levels.rifle,1);
});

test('the rising timer fits the skill cooldown field that saves are validated against',()=>{
  assert.ok(SKILLS.raise_dead.cooldown>=SUMMON_INTERVAL);
});

test('a failed save reports false, and the next successful save reports true and clears the failure',async()=>{
  let failing=true;const memory=new Map();
  globalThis.location={search:'?test=1'};globalThis.localStorage=memoryStorage(memory,()=>failing);
  const storage=await import('../src/storage.js?savefail344'),{Game}=await import('../src/game.js');
  const g=new Game(7);assert.equal(storage.saveGame(g),false);assert.equal(storage.storage.available,false);assert.equal(memory.has('qa-ash-save'),false);
  failing=false;assert.equal(storage.saveGame(g),true);assert.equal(storage.storage.available,true);assert.ok(Game.restore(memory.get('qa-ash-save')));
});

test('the daily seed hashes the date with a phrase: valid, stable, and not the date or the next number',()=>{
  const day=new Date(2026,8,11),seeds=Array.from({length:60},(_,i)=>dailySeed(new Date(2026,8,11+i)));
  assert.equal(dailySeed(day),dailySeed(new Date(2026,8,11,23,59)));
  for(const [i,s] of seeds.entries()){assert.ok(Number.isInteger(s)&&s>=0&&s<=999999999);assert.notEqual(s,dateKey(new Date(2026,8,11+i)));}
  assert.equal(new Set(seeds).size,seeds.length);assert.ok(seeds.slice(1).every((s,i)=>Math.abs(s-seeds[i])!==1));
  assert.ok(Object.keys(MISSIONS).includes(dailyMission(seeds[0],Object.keys(MISSIONS))));
});

test('the offline cache lists every source module, so a new file cannot break offline starts',()=>{
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js')))assert.ok(sw.includes(`./src/${file}`),file);
});
