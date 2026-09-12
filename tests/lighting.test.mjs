import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,generate} from '../src/engine.js';
import {fullLighting,createLighting,isDark} from '../src/lighting.js';
import {grantTrait,activeTrait} from '../src/traits.js';
import {applyDisruption,skipDisabled,areaCells,DISRUPT_TURNS,BOSS_DISRUPT_TURNS} from '../src/throwables.js';
import {makeBarrier} from '../src/barriers.js';
import {targetDetails} from '../src/target-card.js';
import {snapshot,captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {Renderer} from '../src/renderer.js';

function arena(character='soldier'){
  const g=new Game(324,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=fullLighting(g.grid);
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.enemies=[];g.smoke=[];g.marks=[];g.rooms=[];clearGeneratedMap(g);g.traces=[];
  Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500,armor:0,plates:0});/* Cancel Soldier innate +8 to isolate this rule. */g.player.combatModifiers=character==='soldier'?{rangedAccuracy:-8}:{};g.end={x:20,y:20};g.reveal();return g;
}
function enemy(g,type='rifleman',x=14,y=10){const e=makeEnemy(type,x,y,'qa-light-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;}
function smoke(g){g.smoke=[{cells:areaCells(g.grid,{x:12,y:10}),expires:g.turn+2}];}

test('each new floor has three deterministic dark rooms, with lit entrance and inherited corridor lighting',()=>{
  const layouts=new Set();
  for(let seed=1;seed<=20;seed++)for(let floor=1;floor<=6;floor++){
    const map=generate(seed,floor),again=generate(seed,floor).lighting;
    assert.deepEqual(map.lighting,again);assert.equal(isDark(map,map.start),false);
    assert.equal(map.rooms.filter(r=>map.lighting.slice(r.y,r.y+r.h).some(row=>row.slice(r.x,r.x+r.w).includes(0))).length,3);
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(map.grid[y][x]===1)assert.ok([0,1].includes(map.lighting[y][x]));
    layouts.add(JSON.stringify(map.lighting));
  }
  assert.ok(layouts.size>20);
});
test('darkness checks the target cell, combines with half cover and movement, and never reduces damage',()=>{
  const g=arena(),e=enemy(g);g.player.traits=[];g.lighting[e.y][e.x]=0;
  assert.equal(g.accuracy(g.player,e).chance,57);assert.equal(g.accuracy(e,g.player).chance,97);
  e.moved=true;assert.equal(g.accuracy(g.player,e).chance,35);e.moved=false;
  g.props=[{id:'cover',type:'cover',x:13,y:10,hp:65,maxHp:65}];g.player.y=9; // (4,1): full crate
  assert.equal(g.accuracy(g.player,e).chance,22);g.player.x=13; // (1,1): half crate
  assert.equal(g.accuracy(g.player,e).chance,39);
  g.props=[];g.hitTarget(e,40,g.player);assert.equal(e.hp,460);
  g.lighting[10][10]=0;g.player.x=10;g.player.y=10;g.damagePlayer(40,'QA',e);assert.equal(g.player.hp,460);
});
test('night vision is shooter-specific for biological, mechanical and unclassified units',()=>{
  for(const body of ['biological','mechanical',null]){
    const g=arena(),e=enemy(g);g.player.traits=[];e.traits=[];if(body)grantTrait(e,body,'qa');
    g.lighting[e.y][e.x]=0;g.lighting[g.player.y][g.player.x]=0;
    assert.equal(g.accuracy(g.player,e).chance,57);grantTrait(e,'night_vision','qa');
    assert.equal(g.accuracy(g.player,e).chance,57);assert.equal(g.accuracy(e,g.player).chance,97);
    grantTrait(g.player,'night_vision','qa');assert.equal(g.accuracy(g.player,e).chance,97);
    e.traits=e.traits.filter(t=>t.id!=='night_vision');assert.equal(g.accuracy(e,g.player).chance,57);
  }
});
test('Recon has both senses, enemies are explicitly equipped, and infrared does not grant night vision',()=>{
  const g=arena('recon');for(const id of ['night_vision','infrared'])assert.ok(activeTrait(g.player,id));
  assert.ok(activeTrait(makeEnemy('sniper',1,1,'s'),'night_vision'));assert.ok(activeTrait(makeEnemy('warden',1,1,'w'),'infrared'));
  for(const type of ['drone','boss','rifleman'])for(const id of ['night_vision','infrared'])assert.equal(activeTrait(makeEnemy(type,1,1,type),id),false);
  const s=arena(),e=enemy(s);s.lighting[e.y][e.x]=0;grantTrait(s.player,'infrared','qa');smoke(s);s.reveal();
  assert.equal(s.visible(e),true);assert.equal(s.accuracy(s.player,e).chance,57);
  s.player.traits=[{id:'night_vision',source:'qa'}];s.reveal();assert.equal(s.visible(e),false);
});
test('infrared sight is directional, handles smoke endpoints, and never sees through solid walls or closed doors',()=>{
  const g=arena('recon'),e=enemy(g);smoke(g);g.reveal();
  assert.equal(g.visible(e),true);assert.equal(g.sight(e,g.player),false);assert.equal(e.alert,false);assert.equal(e.lastKnown,null);
  g.player.x=12;g.reveal();assert.equal(g.visible(e),true);assert.equal(g.sight(e,g.player),false);
  for(let y=0;y<SIZE;y++)g.grid[y][13]=0;assert.equal(g.visible(e),false);
  for(let y=0;y<SIZE;y++)g.grid[y][13]=1;
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));for(let x=10;x<=15;x++)g.grid[10][x]=1;
  g.barriers=[makeBarrier('door',{x:12,y:10},{x:13,y:10},'edge-light')];assert.equal(g.visible(e),false);
  g.barriers[0].open=true;assert.equal(g.visible(e),true);
});
test('enemy infrared detects a player hidden from player sight, and ordinary enemies retain only last seen coordinates',()=>{
  const g=arena(),e=enemy(g,'warden');smoke(g);g.reveal();assert.equal(g.visible(e),false);assert.equal(e.alert,true);assert.deepEqual(e.lastKnown,{x:10,y:10});
  const h=arena('recon'),blind=enemy(h);h.reveal();assert.equal(blind.alert,true);const last={...blind.lastKnown};smoke(h);h.player.y=9;h.reveal();
  assert.deepEqual(blind.lastKnown,last);assert.equal(h.sight(blind,h.player),false);h.enemyAct(blind);assert.deepEqual(blind.lastKnown,last);
});
test('actual infrared fire crosses smoke; a blind committed shot spends ammunition without damage',()=>{
  for(const character of ['recon','soldier']){
    const g=arena(character),e=enemy(g);g.reveal();g.target=e.id;grantTrait(e,'fast','qa');g.enemyAct=()=>smoke(g);g.rng=Object.assign(()=>0,{state:()=>0});
    const ammo=g.player.ammo[g.player.weapon];assert.ok(g.action('fire'));assert.ok(g.player.ammo[g.player.weapon]<ammo);
    assert.equal(e.hp<500,character==='recon');
  }
});
test('stun affects either sense on any body once, with shared EMP immunity and boss duration',()=>{
  for(const body of [null,'biological','mechanical'])for(const ids of [[],['night_vision'],['infrared'],['night_vision','infrared']]){
    const g=arena(),e=enemy(g);e.traits=[];if(body)grantTrait(e,body,'qa');for(const id of ids)grantTrait(e,id,'qa');
    const affected=body==='biological'||ids.length>0;
    assert.equal(applyDisruption(e,'biological'),affected);assert.equal(e.control.disabled,affected?DISRUPT_TURNS:0);assert.equal(e.hp,500);
    if(affected){assert.equal(applyDisruption(e,'biological'),false);for(let i=0;i<DISRUPT_TURNS;i++)skipDisabled(e);assert.equal(e.control.immune,2);assert.equal(applyDisruption(e,'mechanical'),false);}
  }
  const w=makeEnemy('warden',1,1,'w');assert.ok(applyDisruption(w,'biological'));assert.equal(w.control.disabled,BOSS_DISRUPT_TURNS);
});
test('actual stun grenade reaches infrared machines and self, but not ordinary machines',()=>{
  const g=arena('recon'),sensed=enemy(g,'warden',12,10),plain=enemy(g,'drone',12,11);g.player.stun=1;g.player.prepared.grenade='stun';g.reveal();
  assert.ok(g.action('grenade',{x:11,y:10}));assert.equal(g.player.control.disabled,DISRUPT_TURNS);assert.equal(sensed.control.disabled,BOSS_DISRUPT_TURNS-1);assert.equal(plain.control.disabled,0);
});
test('aim card labels darkness or night vision, props use darkness, melee ignores it',()=>{
  const g=arena(),e=enemy(g);g.lighting[e.y][e.x]=0;g.reveal();assert.match(targetDetails(g).state,/暗區 −40/);
  grantTrait(g.player,'night_vision','qa');assert.match(targetDetails(g).state,/夜視抵銷暗區/);
  g.player.traits=[];const barrel={id:'barrel',type:'barrel',x:13,y:10,hp:18,maxHp:18};g.props=[barrel];g.lighting[10][13]=0;assert.equal(g.fireChance(barrel),57);
  const b=arena('bulwark'),near=enemy(b,'rifleman',11,10);b.player.weapon=7;b.lighting[10][11]=0;b.reveal();assert.equal(b.accuracy(b.player,near).chance,99);assert.equal(b.accuracy(b.player,near).darkPenalty,0);
});
test('lighting survives saves, backups and presentation without changing RNG; malformed lighting is rejected',()=>{
  const g=arena('recon'),e=enemy(g);g.lighting[10][14]=0;smoke(g);g.reveal();const raw=g.serialize(),rng=g.rng.state();
  assert.deepEqual(Game.restore(raw).lighting,g.lighting);assert.deepEqual(snapshot(g).lighting,g.lighting);
  assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game.lighting,g.lighting);
  targetDetails(g);g.accuracy(g.player,e);assert.equal(g.rng.state(),rng);
  for(const change of [d=>delete d.lighting,d=>d.lighting.pop(),d=>d.lighting[0].pop(),d=>d.lighting[0][0]=2,d=>d.lighting[0][0]='0']){const bad=JSON.parse(raw);change(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
  const plan=planPresentation(captureAction(g,()=>g.action('fire')).steps);assert.ok(plan.events.length);for(const event of plan.events)assert.deepEqual(event.state.lighting,g.lighting);
});
test('v17 Recon migration adds exactly two senses and keeps old floor lit, resources and RNG intact',()=>{
  const g=arena('recon');g.lighting[10][10]=0;const old=JSON.parse(g.serialize());old.version=17;delete old.data.lighting;old.data.player.traits=old.data.player.traits.filter(t=>!['night_vision','infrared'].includes(t.id));
  const before=structuredClone(old.data.player),restored=Game.restore(JSON.stringify(old));assert.ok(restored);for(const id of ['night_vision','infrared'])assert.ok(activeTrait(restored.player,id));
  const after={...restored.player,traits:restored.player.traits.filter(t=>!['night_vision','infrared'].includes(t.id))};assert.deepEqual(after,before);assert.equal(restored.rng.state(),old.rngState);assert.deepEqual(restored.lighting,fullLighting(g.grid));
  assert.deepEqual(Game.restore(restored.serialize()).player,restored.player);
  old.data.player.traits=Array.from({length:66},(_,i)=>({id:'fast',source:'legacy:'+i}));const full=Game.restore(JSON.stringify(old));assert.ok(full);assert.equal(full.player.traits.length,68);assert.ok(activeTrait(full.player,'infrared'));
  restored.floor=2;restored.loadFloor();assert.ok(restored.lighting.some(row=>row.includes(0)));
});
test('darkness paints only the floor beneath objects and actors; map uses a distinct dark color',()=>{
  const g=arena();g.lighting[10][10]=0;g.reveal();const stages=[],colors=[],gradient={addColorStop(){}};
  const ctx=new Proxy({globalAlpha:1,fillRect(){colors.push(this.fillStyle);if(typeof this.fillStyle==='string'&&this.fillStyle.startsWith('#060c22'))stages.push('dark');},createRadialGradient(){return gradient;}},{get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){o[k]=v;return true;}});
  const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,game:g,tile:38,w:300,h:400,dpr:1,camera:{x:10,y:10},effects:[],reduceMotion:true,targetingEnabled:false,terrain(){return true;},wall(){},prop(){stages.push('prop');},actor(){stages.push('actor');},corpse(){},item(){},drawBarrier(){},hazard(){},exit(){},terrainReady:true});
  const before=g.serialize();r.draw(0);assert.ok(stages.includes('dark'));assert.ok(stages.indexOf('dark')<stages.indexOf('actor'));r.drawMap({width:280,getContext:()=>ctx});assert.ok(colors.includes('#343e62'));assert.equal(g.serialize(),before);
});
test('first local v17 load preserves original QA backup without touching live data',async()=>{
  const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const storage=await import('../src/storage.js?lighting'),old=JSON.parse(arena('recon').serialize());old.version=17;delete old.data.lighting;old.data.player.traits=old.data.player.traits.filter(t=>!['night_vision','infrared'].includes(t.id));
  const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v17-backup'),raw);assert.equal(memory.has('ash-save'),false);
});
