import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {BLINK_TUNING} from '../src/rift-blink.js';
import {bindAnchors,liveAnchors,RIFT_TUNING} from '../src/rift.js';
import {tickNests} from '../src/runtime-enemies.js';
import {ENEMY_AFFIXES} from '../src/enemy-affixes.js';
import {distance} from '../src/world.js';
import {LIGHT_MODEL,isDark} from '../src/lighting.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.227.0 (docs/FACTIONS.md 5.5): the rift's shared blink (src/rift-blink.js) and the possessed human, a living anchor
// (src/rift.js). An open, lit floor; you at (10,16).
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];clearGeneratedMap(g);
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'rift');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};
const said=(g,text)=>g.logs.some(l=>l.text.includes(text));

test('閃爍體: it marks the tile beside you, then appears there next turn and strikes at once',()=>{
  const g=open(),f=unit(g,'flicker',10,13,'f');
  g.action('wait');
  assert.ok(f.blinkIntent,'marked');assert.deepEqual([f.x,f.y],[10,13],'not moved yet');
  assert.deepEqual(f.blinkIntent.point,{x:10,y:15},'the tile beside you nearest to it');assert.deepEqual(f.blinkIntent.target,{x:10,y:16});
  assert.ok(said(g,'閃爍'));
  const hp=g.player.hp;g.action('wait');
  assert.deepEqual([f.x,f.y],[10,15]);assert.ok(g.player.hp<hp,'and it struck');
  assert.equal(f.blinkIntent,undefined);assert.ok(f.blinkCooldown>0&&f.blinkCooldown<=BLINK_TUNING.strikeCooldown);
  assert.ok(g.effects.some(fx=>fx.type==='portalSpawn'));
});

test('step off the tile you stood on and the flicker lands empty-handed; a taken tile makes it fizzle in place',()=>{
  {
    const g=open(),f=unit(g,'flicker',10,13,'f');g.action('wait');
    Object.assign(g.player,{x:14,y:16});g.reveal();const hp=g.player.hp;g.action('wait');
    assert.deepEqual([f.x,f.y],[10,15],'it still appears where it marked');assert.equal(g.player.hp,hp,'but strikes nothing');
  }
  {
    const g=open(),f=unit(g,'flicker',10,13,'f');g.action('wait');
    const blocker=makeEnemy('wisp',10,15,'w',1,0,'rift');g.enemies.push(blocker);
    g.action('wait');
    assert.deepEqual([f.x,f.y],[10,13],'nowhere to appear: it stays');assert.equal(f.blinkIntent,undefined);assert.ok(f.blinkCooldown>0);
    assert.ok(said(g,'落空'));
  }
  // Out of reach (5 tiles) or too close (beside you): no mark.
  const far=open(),a=unit(far,'flicker',10,11,'a');far.action('wait');assert.equal(a.blinkIntent,undefined);
});

test('被附身者: come within two tiles and it marks a tile at least four away that sees you, then blinks there',()=>{
  const g=open(),h=unit(g,'possessed',10,14,'h');
  g.action('wait');
  const mark=h.blinkIntent;assert.ok(mark,'marked');assert.deepEqual([h.x,h.y],[10,14]);
  assert.ok(distance(mark.point,g.player)>=BLINK_TUNING.evadeGap);assert.ok(distance(mark.point,{x:10,y:14})<=BLINK_TUNING.evadeReach);
  g.action('wait');
  assert.deepEqual({x:h.x,y:h.y},mark.point,'it appears on its mark');assert.ok(h.blinkCooldown>0);
  // Farther than two tiles it just fights.
  const calm=open(),c=unit(calm,'possessed',10,12,'c');calm.action('wait');assert.equal(c.blinkIntent,undefined);
});

test('a pinned possessed human loses its mark; an energy body cannot be pinned out of one',()=>{
  const g=open(),h=unit(g,'possessed',10,14,'h');g.action('wait');assert.ok(h.blinkIntent);
  h.suppression=3;g.action('wait');
  assert.equal(h.blinkIntent,undefined,'the pin drops it');assert.deepEqual([h.x,h.y],[10,14]);
});

test('the possessed is a living anchor: its bodies form again beside it wherever it stands, and dissipate when it falls',()=>{
  const g=open(),h=unit(g,'possessed',4,4,'h'),w=unit(g,'wisp',4,8,'w'),x=unit(g,'flicker',6,8,'x');
  bindAnchors({props:g.props,enemies:g.enemies});
  assert.ok(h.anchor);assert.equal(w.anchorId,'h');assert.equal(x.anchorId,'h');assert.deepEqual(liveAnchors(g),[h]);
  const xp=g.player.xp;g.hurt(w,999,g.player);assert.equal(g.player.xp,xp+1);
  assert.equal(h.anchor.reforms.length,1);
  // It walks; the marked tile follows it.
  Object.assign(h,{x:7,y:4});g.turn=h.anchor.reforms[0].due;tickNests(g);
  const again=g.enemies.find(e=>e.reformed);assert.ok(again);assert.equal(distance(again,h),1,'beside where it stands now');assert.equal(again.anchorId,'h');
  g.hurt(again,999,g.player);assert.equal(h.anchor.reforms.length,1);
  // It falls: the standing bodies dissipate (no kill, no xp), the pending one never forms; it pays its own xp.
  const kills=g.player.kills,before=g.player.xp;
  g.hurt(h,999,g.player);
  assert.equal(x.hp<=0&&x.dissipated,true);assert.equal(h.anchor.reforms.length,0);
  assert.equal(g.player.kills,kills+1,'only the host counts');assert.equal(g.player.xp,before+ENEMY_TYPES.possessed.xp);
  assert.ok(said(g,'被附身者倒下'));
  g.turn+=RIFT_TUNING.reformTurns*2;const n=g.enemies.length;tickNests(g);assert.equal(g.enemies.length,n);
  assert.deepEqual(liveAnchors(g),[]);
});

test('saves: a host and a marked blink round-trip; a stale mark is dropped; anchor state on another card is refused',()=>{
  const g=open(),h=unit(g,'possessed',4,4,'h'),w=unit(g,'wisp',4,8,'w'),f=unit(g,'flicker',10,13,'f');
  bindAnchors({props:g.props,enemies:g.enemies});g.hurt(w,999,g.player);g.action('wait');assert.ok(f.blinkIntent);
  const copy=Game.restore(g.serialize());assert.ok(copy);
  assert.deepEqual(copy.enemies.find(e=>e.id==='h').anchor,h.anchor);assert.deepEqual(copy.enemies.find(e=>e.id==='f').blinkIntent,f.blinkIntent);
  {const raw=JSON.parse(g.serialize());const e=raw.data.enemies.find(e=>e.id==='f');e.x+=1;const r=Game.restore(JSON.stringify(raw));assert.ok(r,'a moved carrier loads');assert.equal(r.enemies.find(e=>e.id==='f').blinkIntent,undefined,'without its mark');}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='f').blinkIntent.point={x:'a',y:1};assert.equal(Game.restore(JSON.stringify(raw)),null);}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='f').blinkCooldown=99;assert.equal(Game.restore(JSON.stringify(raw)).enemies.find(e=>e.id==='f').blinkCooldown,Math.max(BLINK_TUNING.strikeCooldown,BLINK_TUNING.evadeCooldown),'cut to the tuning');}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='f').anchor={active:true,serial:0,reforms:[]};assert.equal(Game.restore(JSON.stringify(raw)),null,'only a possessed human carries an anchor');}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='h').anchor.reforms[0].type='rifleman';assert.equal(Game.restore(JSON.stringify(raw)),null);}
});

test('the cards: the flicker is an energy body that strikes, the possessed a human anchor that evades and never draws a top-step affix',()=>{
  const f=ENEMY_TYPES.flicker,h=ENEMY_TYPES.possessed;
  assert.equal(f.energy,true);assert.equal(f.huntsLife,true);assert.equal(f.blink,'strike');assert.equal(f.loot,undefined);
  assert.equal(h.energy,undefined);assert.equal(h.anchorHolder,true);assert.equal(h.blink,'evade');assert.ok(h.sprite.outline,'outlined: it reads at a glance');
  const e=makeEnemy('possessed',1,1,'p',3,0,'rift');
  for(const id of ['flamer','grenadier','lockdown','disarm'])assert.equal(ENEMY_AFFIXES.find(a=>a.id===id).applies(e),false,id);
});

// 3.229.0 (user 2026-11-16): most possessed hosts fight hand to hand; the armed ones shoot only in the light.
test('a melee possessed host blinks in beside you and strikes; it is still an anchor',()=>{
  const g=open(),h=unit(g,'possessed_melee',10,13,'h'),w=unit(g,'wisp',3,3,'w');
  bindAnchors({props:g.props,enemies:g.enemies});assert.ok(h.anchor);assert.equal(w.anchorId,'h');
  g.action('wait');assert.deepEqual(h.blinkIntent?.point,{x:10,y:15},'marks the tile beside you');
  const hp=g.player.hp;g.action('wait');assert.deepEqual([h.x,h.y],[10,15]);assert.ok(g.player.hp<hp,'and strikes');
  g.hurt(h,999,g.player);assert.equal(w.dissipated,true,'its bodies go with it');
  assert.equal(ENEMY_TYPES.possessed_melee.range,1);assert.equal(ENEMY_TYPES.possessed_melee.loot,undefined);
});

test('an armed possessed human shoots only when it and its target both stand in the light; in the dark it closes in',()=>{
  const lit=open(),a=unit(lit,'possessed',10,11,'a');
  const hp=lit.player.hp;lit.action('wait');assert.ok(lit.player.hp<hp||a.charge,'in the light it fires (or aims)');
  // You in the light, the shooter on an unpowered tile (dim at best): it sees you, but does not fire.
  const dark=open();dark.lightModel=LIGHT_MODEL;dark.lamps=[];dark.lighting[11][10]=0;
  const b=unit(dark,'possessed',10,11,'b');assert.ok(isDark(dark,b));assert.ok(dark.sight(b,dark.player),'it sees you');const before=dark.player.hp;
  dark.action('wait');assert.equal(dark.player.hp,before,'no shot from the dark');assert.equal(b.charge,false);assert.ok(distance(b,dark.player)<5,'it closes in');
});
