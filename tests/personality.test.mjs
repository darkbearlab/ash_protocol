import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {activeTrait} from '../src/traits.js';
import {personalityOf,accepts} from '../src/personality.js';
import {ORDER_TUNING} from '../src/orders.js';
import {sweptClear} from '../src/line-move.js';
import {SWARM_TUNING} from '../src/swarm-tuning.js';
import {cower,isCowering} from '../src/rebels.js';

// 3.133.0 personality (user decision 2026-09-18, docs/ORDERS.md §8.1) and the hunter bug's pounce.
function open(faction){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:faction});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
// Two rooms and one door at (11,6); the lift is east of it. Last seen in the west room.
function rooms(faction='loyalist'){
  const g=open(faction);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  for(let y=2;y<=10;y++)for(let x=2;x<=24;x++)if(x!==11)g.grid[y][x]=1;g.grid[6][11]=1;g.lighting=g.grid.map(r=>r.map(()=>1));
  g.end={x:22,y:6};Object.assign(g.player,{x:8,y:6});g.reveal();return g;
}
const unit=(g,type,x,y,id,faction)=>{const e=makeEnemy(type,x,y,id,1,0,faction||g.facilityFaction);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};

test('the table belongs to faction and card: the same card is a different soldier in another faction',()=>{
  const g=open('loyalist');
  const name=(type,faction)=>personalityOf(makeEnemy(type,1,1,'x',1,0,faction))?.name||null;
  assert.equal(name('rifleman','loyalist'),'紀律');assert.equal(name('rifleman','rebel'),'怕死');
  assert.equal(name('sniper','loyalist'),'狡猾');assert.equal(name('sniper','rebel'),'狡猾');assert.equal(name('raider_elite','rebel'),'狡猾');
  assert.equal(name('crawler','swarm'),'兇猛');assert.equal(name('crawler','loyalist'),null,'a loyalist hound is not a hunter bug');
  assert.equal(name('squad_leader','loyalist'),'指揮');assert.equal(name('enforcer','rebel'),'指揮');assert.equal(name('civilian','loyalist'),'逃命');
  assert.equal(name('rifleman_infected','swarm'),'無心');assert.equal(name('drone','rebel'),'無心');
  // The legacy mix has no table: it keeps the card's own accepts (its sniper still ambushes), nothing else changes.
  assert.equal(name('rifleman','legacy'),null);
  assert.ok(accepts(makeEnemy('sniper',1,1,'s',1,0,'legacy'),'ambush'));assert.ok(!accepts(makeEnemy('rifleman',1,1,'r',1,0,'legacy'),'hold'));
});

test('紀律: a soldier who knows where you were holds the doorway on your way to the lift, nine turns, unshaken by hits',()=>{
  const g=rooms(),e=unit(g,'rifleman',15,4,'d');
  g.action('wait');
  assert.equal(e.order?.kind,'hold');assert.equal(e.order.by,'self');assert.deepEqual(e.order.watch,{x:11,y:6});
  assert.equal(e.order.patience,Math.round(ORDER_TUNING.patience*1.5),'patience ×1.5');
  assert.ok(!e.order.breakOn.includes('hit'),'a hit does not break it');
  g.hurt(e,1,g.player);assert.equal(e.order?.kind,'hold');
});

test('an order a unit waited out is not taken again for a while',()=>{
  const g=rooms(),e=unit(g,'rifleman',15,4,'d');g.action('wait');assert.equal(e.order?.kind,'hold');
  Object.assign(g.player,{x:3,y:2});g.reveal();   // out of the doorway's sight: nothing to shoot, it just waits
  let n=0;while(e.order&&n<30){g.action('wait');n++;}
  assert.equal(e.order,undefined);assert.equal(e.orderRest?.kind,'hold');
  const until=e.orderRest.until;g.action('wait');assert.equal(e.order,undefined,'resting');
  assert.ok(until-g.turn<=ORDER_TUNING.rest);
  const raw=JSON.parse(g.serialize());raw.data.enemies.find(o=>o.id==='d').orderRest={kind:'hold',until:-1};
  assert.equal(Game.restore(JSON.stringify(raw)),null,'a tampered rest is refused');
});

test('one pins, one goes round: a disciplined soldier behind your cover takes the flank while another has the shot',()=>{
  const g=open('loyalist');g.props=[{id:'crate',x:10,y:15,type:'cover',hp:60,maxHp:60}];g.reveal();
  const pin=unit(g,'rifleman',14,16,'pin'),flanker=unit(g,'rifleman',10,11,'f');
  g.action('wait');
  assert.equal(flanker.order?.kind,'flank');assert.equal(flanker.order.by,'self');
  assert.ok(!flanker.order.breakOn.includes('hit'),'disciplined: a hit does not break it');
  assert.equal(pin.order,undefined,'the one with the shot just shoots');
});

test('怕死 is who hides: rebel gunmen and conscripts break, a rebel sniper (狡猾) does not',()=>{
  const g=open('rebel');
  const r=unit(g,'rifleman',8,10,'r'),c=unit(g,'rifleman',12,10,'c');c.conscript=true;const s=unit(g,'sniper',14,10,'s');
  assert.ok(cower(g,r));assert.ok(cower(g,c));assert.ok(!cower(g,s));
  assert.ok(isCowering(r)&&isCowering(c)&&!isCowering(s));
});

test('撲擊: the hunter bug crouches for a turn, then leaps beside you and bites; three turns before the next',()=>{
  const g=open('swarm'),b=unit(g,'crawler',10,13,'b');
  g.action('wait');assert.ok(b.pounceIntent,'announced');assert.deepEqual([b.x,b.y],[10,13],'it has not moved yet');
  assert.ok(g.logs.some(l=>l.text.includes('準備撲擊')));
  const hp=g.player.hp;g.action('wait');
  assert.equal(Math.abs(b.x-10)+Math.abs(b.y-16),1,'beside you');assert.ok(g.player.hp<hp,'and it bit');
  assert.equal(b.pounceIntent,undefined);assert.ok(b.pounceCooldown>0&&b.pounceCooldown<=SWARM_TUNING.pounceCooldown);
  const dog=unit(open('loyalist'),'crawler',10,13,'dog');assert.ok(!personalityOf(dog)?.pounce,'a loyalist hound never pounces');
});

test('step off the announced tile and it misses: it lands where it said, exposed for a turn',()=>{
  const g=open('swarm'),b=unit(g,'crawler',10,13,'b');g.action('wait');
  const landing={...b.pounceIntent.point};
  Object.assign(g.player,{x:14,y:16});g.reveal();g.action('wait');
  assert.deepEqual({x:b.x,y:b.y},landing,'it still leaps');assert.equal(b.vaultExposed,true,'and lands open');
  assert.ok(g.logs.some(l=>l.text.includes('撲空')));
});

test('矮小: brood never stops a straight move, but nothing lands on one',()=>{
  const g=open('swarm'),b=unit(g,'crawler',10,13,'b'),brood=unit(g,'brood',10,14,'y');
  assert.ok(activeTrait(brood,'underfoot'));
  assert.ok(sweptClear(g,b,{x:10,y:15}),'over the brood');assert.ok(!sweptClear(g,b,{x:10,y:14}),'not onto it');
  g.action('wait');assert.ok(b.pounceIntent,'the brood in the lane does not stop the pounce');
});

test('a pounce in progress survives a save; a tampered one is refused',()=>{
  const g=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'}),b=g.enemies.find(e=>e.type==='crawler');assert.ok(b);
  const floor=(x,y)=>g.grid[y]?.[x]===1;
  const target=[[0,2],[2,0],[0,-2],[-2,0],[1,1],[-1,1],[1,-1],[-1,-1]].map(([dx,dy])=>({x:b.x+dx,y:b.y+dy})).find(t=>floor(t.x,t.y));
  const point=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:target.x+dx,y:target.y+dy})).find(q=>floor(q.x,q.y));
  b.pounceIntent={origin:{x:b.x,y:b.y},target,point};b.pounceCooldown=0;
  const back=Game.restore(g.serialize());assert.ok(back);assert.deepEqual(back.enemies.find(e=>e.id===b.id).pounceIntent,b.pounceIntent);
  for(const bad of [{point:{x:point.x+5,y:point.y}},{origin:{x:b.x+1,y:b.y}},{cooldown:9}]){
    const raw=JSON.parse(g.serialize()),e=raw.data.enemies.find(o=>o.id===b.id);
    if(bad.cooldown)e.pounceCooldown=bad.cooldown;else Object.assign(e.pounceIntent,bad);
    assert.equal(Game.restore(JSON.stringify(raw)),null,JSON.stringify(bad));
  }
});
