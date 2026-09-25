import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,generate} from '../src/engine.js';
import {LIGHT,LIGHT_MODEL,LIGHT_TUNING,lightAt,isLamp,lampWall,validLamps} from '../src/lighting.js';
import {Renderer} from '../src/renderer.js';
import {targetDetails} from '../src/target-card.js';
import {SAVE_VERSION} from '../src/data.js';

// 3.187.0 (user, decision C6): wall lamps can be aimed at and shot out, and a blast breaks them too; that patch goes dark.
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function arena(lamps=[{id:'lamp-1-0',x:10,y:4,hp:1}]){
  const g=new Game(316,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.grid[3][10]=0;
  g.lighting=g.grid.map(row=>row.map(()=>0));
  Object.assign(g,{barriers:[],props:[],items:[],hazards:[],marks:[],smoke:[],enemies:[],allies:[],flares:[],glowsticks:[],gunFlashes:[]});
  clearGeneratedMap(g);g.lightModel=LIGHT_MODEL;g.lamps=lamps;
  Object.assign(g.player,{x:10,y:9,facing:[0,-1],flashlight:false});
  Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});g.reveal();return g;
}
const sure=g=>{g.rng=Object.assign(()=>0,{state:()=>1});};

test('a lamp is a target: locked like a door, harder to hit, and one hit puts it out and darkens its patch',()=>{
  const g=arena(),lamp=g.lamps[0];assert.ok(isLamp(lamp));assert.deepEqual(lampWall(g.grid,lamp),[0,-1],'it hangs on the wall above its tile');
  assert.equal(lightAt(g,{x:10,y:6}),LIGHT.lit);
  g.target=lamp.id;assert.equal(g.targeted,lamp);
  const stand={id:'stand-in',x:lamp.x,y:lamp.y};g.player.combatModifiers={rangedAccuracy:-30};   // off the 99% cap
  assert.equal(g.fireChance(lamp),g.fireChance(stand)-LIGHT_TUNING.lampHitPenalty);g.player.combatModifiers={};
  const card=targetDetails(g);assert.equal(card.name,'鹵素燈');assert.match(card.hp,/耐久 1 \/ 1/);
  sure(g);const ammo=g.player.ammo[0],turn=g.turn;assert.ok(g.action('fire'));
  assert.equal(lamp.hp,0);assert.equal(g.turn,turn+1);assert.equal(ammo-g.player.ammo[0],1,'the burst stops once the lamp is out');
  assert.equal(lightAt(g,{x:10,y:6}),LIGHT.black);assert.equal(lightAt(g,{x:10,y:4}),LIGHT.black);
  assert.ok(g.logs.some(l=>l.text==='牆上的鹵素燈碎了，這一帶暗了下來。'));
  assert.equal(g.targeted,undefined,'a broken lamp cannot be locked');assert.equal(g.action('fire'),false);
});

test('a blast breaks the lamps it reaches, walls and doors shielding the rest',()=>{
  const g=arena([{id:'lamp-1-0',x:10,y:4,hp:1},{id:'lamp-1-1',x:14,y:4,hp:1}]);
  g.explode({x:10,y:5},1,30,g.player);assert.deepEqual(g.lamps.map(l=>l.hp),[0,1]);
});

test('lamps save their state; older saves keep every lamp lit; a bad state is refused',()=>{
  const g=arena();g.lamps[0].hp=0;const copy=Game.restore(g.serialize());assert.ok(copy);assert.equal(copy.lamps[0].hp,0);
  assert.equal(SAVE_VERSION,76);
  const live=new Game(3);live.descend?.();const raw=JSON.parse(live.serialize());raw.version=75;
  for(const f of [raw.data,...Object.values(raw.data.floorStates||{})])for(const l of f.lamps||[])delete l.hp;
  const old=Game.restore(JSON.stringify(raw));assert.ok(old);assert.ok(old.lamps.length&&old.lamps.every(l=>l.hp===1));
  for(const hp of [2,-1,'1',undefined]){const bad=JSON.parse(g.serialize());bad.data.lamps[0].hp=hp;assert.equal(Game.restore(JSON.stringify(bad)),null,String(hp));}
  assert.equal(validLamps([{id:'lamp-1-0',x:10,y:4,hp:1,extra:1}],g.grid),false);
  for(let seed=1;seed<=4;seed++)assert.ok(generate(seed,2).lamps.every(l=>l.hp===1));
});

test('touch: tapping the lamp against its wall locks it; the middle of its tile does not',async()=>{
  const g=arena(),renderer={game:g,tile:40,project:(x,y)=>({x:x*40,y:y*40})};renderer.lampPoint=Renderer.prototype.lampPoint.bind(renderer);
  const at=Renderer.prototype.lampPoint.call(renderer,g.lamps[0]);assert.deepEqual([at.x,Math.round(at.y)],[400,145]);
  assert.equal(Renderer.prototype.hitLamp.call(renderer,400,146),g.lamps[0]);assert.equal(Renderer.prototype.hitLamp.call(renderer,400,160),undefined);
  g.lamps[0].hp=0;assert.equal(Renderer.prototype.hitLamp.call(renderer,400,146),undefined);
  const source=await read('../src/controller.js');
  assert.ok(source.indexOf('renderer.hitLamp(')>source.indexOf('renderer.hitBarrier(')&&source.indexOf('renderer.hitLamp(')<source.indexOf('game.props.filter(p=>p.hp>0&&game.visible(p))'),'picked before other targets and before moving');
});
