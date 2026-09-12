import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {PORTRAITS,pickPortrait,deploymentPortraits,portraitForLegacy,portraitPath,portraitMarkup} from '../src/portraits.js';
import {grantTrait} from '../src/traits.js';
import {AFFIXES} from '../src/weapons.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

test('cosmetic selection covers the pool, avoids duplicate deployment faces and commits the preview',()=>{
  assert.deepEqual(PORTRAITS.map((_,i)=>pickPortrait(()=>i/PORTRAITS.length)),PORTRAITS);
  for(const r of [0,.25,.5,.75,.999]){
    const choices=deploymentPortraits(['soldier','recon'],()=>r);
    assert.notEqual(choices.soldier,choices.recon);
    const g=new Game(313,[],0,'recon',choices.recon);
    assert.equal(g.player.portrait,choices.recon);
  }
  assert.throws(()=>new Game(313,[],0,'soldier','../invalid'));
});
test('portrait choices do not change seeded maps, combat RNG or subsequent actions',()=>{
  const a=new Game(313,[],0,'recon','ember'),b=new Game(313,[],0,'recon','silver');
  assert.deepEqual(a.grid,b.grid);assert.deepEqual(a.enemies,b.enemies);assert.equal(a.rng.state(),b.rng.state());
  for(let i=0;i<3;i++){a.action('wait');b.action('wait');}
  assert.equal(a.rng.state(),b.rng.state());assert.equal(a.player.hp,b.player.hp);
});
test('portrait persists through save, next floor and full backup; v9 migration is repeatable without changing progress',()=>{
  const g=new Game(313,[],0,'recon','silver');g.player.ammo[2]=3;g.player.prepared.item=null;
  assert.equal(Game.restore(g.serialize()).player.portrait,'silver');
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  assert.deepEqual(restored.player,g.player);
  const old=JSON.parse(g.serialize());old.version=9;old.data.player.smoke=0;old.data.player.emp=0;old.data.player.stun=0;delete old.data.player.portrait;
  const a=Game.restore(JSON.stringify(old)),b=Game.restore(JSON.stringify(old));
  assert.equal(a.player.portrait,portraitForLegacy(g.runId));assert.equal(a.player.portrait,b.player.portrait);
  const {portrait,...player}=a.player;assert.deepEqual(player,old.data.player);assert.equal(a.rng.state(),g.rng.state());
  assert.equal(Game.restore(a.serialize()).player.portrait,portrait);
  g.floor=2;g.loadFloor();assert.equal(g.player.portrait,'silver');
  for(const id of [undefined,null,'unknown','constructor','../onyx']){const raw=JSON.parse(g.serialize());raw.data.player.portrait=id;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('KIA applies only to death; paths are allowlisted and all portraits ship offline as 64px indexed PNGs',()=>{
  assert.match(portraitMarkup('silver','dead'),/kia-stamp.*KIA/);
  for(const status of ['playing','won','abandoned'])assert.doesNotMatch(portraitMarkup('silver',status),/kia-stamp/);
  assert.equal(portraitPath('../../escape'),portraitPath('ember'));
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  for(const id of PORTRAITS){
    const path=portraitPath(id);assert.ok(sw.includes(path));
    const png=readFileSync(new URL(`../${path}`,import.meta.url));
    assert.equal(png.readUInt32BE(16),64);assert.equal(png.readUInt32BE(20),64);assert.equal(png[25],3);
  }
});
test('v9 original is backed up in QA and portrait history survives full profile backup',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?portraits');const g=new Game(313,[],0,'recon','cedar');
  const raw=JSON.parse(g.serialize());raw.version=9;delete raw.data.player.portrait;const text=JSON.stringify(raw);
  memory.set('qa-ash-save',text);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v9-backup'),text);assert.equal(memory.has('ash-save'),false);
  g.status='dead';const profile=storage.recordResult(g);assert.equal(profile.history[0].portrait,'cedar');
  const backup=makeBackup(null,profile,'qa');assert.equal(decodeBackup(JSON.stringify(backup),'qa').snapshot.profile.history[0].portrait,'cedar');
  backup.profile.history[0].portrait='invalid';assert.throws(()=>decodeBackup(JSON.stringify(backup),'qa'));
});
test('exposed lateral movement matches stationary wall protection for every weapon affix, size and movement trait',()=>{
  const g=new Game(313);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.props=[];g.player.x=10;g.player.y=10;g.player.traits=[];
  const e=makeEnemy('rifleman',14,10,'target');grantTrait(e,'sidestep','test');
  for(let weapon=0;weapon<6;weapon++)for(const affix of [null,...Object.keys(AFFIXES)])for(const movement of [null,'agile','clumsy'])for(const size of [null,'large','small']){
    g.player.weapon=weapon;g.player.affixes[weapon]=affix;e.traits=[{id:'sidestep',source:'test'}];
    if(movement)grantTrait(e,movement,'test');if(size)grantTrait(e,size,'test');
    e.moved=false;e.moveDelta=[0,0];g.grid[10][13]=0;const wall=g.accuracy(g.player,e);assert.equal(wall.coverPenalty,42);
    g.grid[10][13]=1;e.moved=true;e.moveDelta=[0,1];const side=g.accuracy(g.player,e);
    assert.ok(side.movePenalty+side.sidePenalty>=42);assert.ok(side.chance<=wall.chance,`${weapon}/${affix}/${movement}/${size}`);
  }
});
test('Recon exposed sidestep plus innate evasion is 45%, stacks with agility, ends with a paid action and adds no cover damage reduction',()=>{
  const g=new Game(313,[],0,'recon');g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.props=[];g.player.x=10;g.player.y=10;
  const e=makeEnemy('rifleman',14,10,'east');g.player.moved=true;g.player.moveDelta=[0,1];
  assert.equal(g.accuracy(e,g.player).chance,45);assert.ok(!g.protectingCover(g.player,e));
  grantTrait(g.player,'agile','test');assert.equal(g.accuracy(e,g.player).chance,32);
  g.enemies=[];g.hazards=[];g.marks=[];g.action('wait');assert.equal(g.accuracy(e,g.player).sidePenalty,0);
});
