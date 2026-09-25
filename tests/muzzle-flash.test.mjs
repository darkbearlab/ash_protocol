import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MUZZLE_FLASHES,barrelAxes,flashCells,flashLength,flashUnit,muzzlePoint,STILL_MS} from '../src/muzzle-flash.js';
import {projectileVisuals} from '../src/presentation.js';

// 3.116.0 (user request): muzzle flashes drawn in code, one look per weapon family, only for a shooter the player can see.
const shot=(extra,reduceMotion=false)=>projectileVisuals({from:{x:0,y:0},to:{x:4,y:0},...extra},reduceMotion).map(v=>v.flash);

test('each weapon family gets its flash; a spread shot flashes once and every round fired flashes on its own',()=>{
  assert.deepEqual(shot({type:'shot',weaponId:'shotgun'}),['shotgun',null,null,null],'four tiles out, four pellets');
  assert.deepEqual(shot({type:'shot',weaponId:'smg'}),['smg'],'3.185.0: a burst is one shot effect a round');
  assert.deepEqual(shot({type:'shot',weaponId:'sniper'}),['sniper']);
  assert.deepEqual(shot({type:'shot',weaponId:'plasma'}),['plasma']);
  assert.deepEqual(shot({type:'shot',weaponId:'launcher',style:'grenade'}),['launcher'],'a launched grenade still leaves the launcher flash');
  assert.deepEqual(shot({type:'enemyShot',attackerType:'warden'}),['plasma'],'enemies use their weapon family');
  for(const none of [{type:'shot',style:'grenade'},{type:'shot',weaponId:'unarmed'},{type:'enemyShot',attackerType:'crawler'}])assert.deepEqual(shot(none).filter(Boolean),[],JSON.stringify(none));
  assert.deepEqual(shot({type:'shot',weaponId:'smg'},true),['smg'],'reduced motion draws one visual, so one flash');
});

test('flash cells stay on the pixel grid in every direction, and the flash ends',()=>{
  for(const name of Object.keys(MUZZLE_FLASHES))for(let k=0;k<16;k++){
    const angle=k*Math.PI/8+.13,unit=flashUnit(38+k);
    for(let t=0;t<flashLength(name);t+=10)for(const cell of flashCells(name,angle,t,{unit})){
      assert.ok(Number.isInteger(cell.x/unit),`${name} ${angle} x`);assert.ok(Number.isInteger(cell.y/unit),`${name} ${angle} y`);assert.match(cell.color,/^#[0-9a-f]{6}([0-9a-f]{2})?$/);
    }
    assert.deepEqual(flashCells(name,angle,flashLength(name),{unit}),[],`${name} is over after its frames`);
    assert.deepEqual(flashCells(name,angle,-1,{unit}),[]);
  }
  assert.ok(flashLength('smg')<flashLength('shotgun'),'a burst round is a quick flicker, a shotgun blast lingers');
});

test('the flash points down the barrel, sits at the muzzle, and holds still for reduced motion',()=>{
  assert.deepEqual(barrelAxes(0).along,[1,0]);assert.deepEqual(barrelAxes(Math.PI/2).along,[0,1]);assert.deepEqual(barrelAxes(-Math.PI*3/4).along,[-1,-1]);
  const east=flashCells('sniper',0,0,{unit:2});assert.ok(east.every(c=>c.x>=0),'a flash pointing east never reaches back west');
  assert.ok(Math.max(...east.map(c=>c.x))>=10,'the sniper flash is long');
  const straight=muzzlePoint({x:100,y:100},0,40),diagonal=muzzlePoint({x:100,y:100},Math.PI/4,40);
  assert.deepEqual(straight,{x:115,y:100});assert.ok(Math.abs(Math.hypot(diagonal.x-100,diagonal.y-100)-15)<1.5,'a diagonal muzzle is no further out');
  assert.deepEqual(flashCells('rifle',0,STILL_MS-1,{still:true}),flashCells('rifle',0,0),'reduced motion holds the first frame');
  assert.deepEqual(flashCells('rifle',0,STILL_MS,{still:true}),[]);
});

test('the renderer draws a flash only for a shooter the player can see, above the sprite, and no longer the old sprite',async()=>{
  const source=await readFile(new URL('../src/renderer.js',import.meta.url),'utf8');
  assert.ok(source.includes("fx.shooterSeen??=fx.type==='enemyShot'?g.visibleEnemies.some(e=>e.x===fx.from.x&&e.y===fx.from.y):g.visible(fx.from);if(fx.shooterSeen)this.muzzleFlash(fx,a,angle,elapsed);"));
  assert.ok(!source.includes("effectSprite('muzzle'"),'the 16px centre sprite is gone');
  assert.ok(source.includes("if(!fx.quiet&&elapsed<spec.frameMs*2&&isDark(this.game,fx.from))this.glow("),'a dark room only gets paint, no lighting change');
  const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8');
  for(const file of ['muzzle-flash','pixel-text','screen-tone'])assert.ok(worker.includes(`./src/${file}.js`),file);
});
