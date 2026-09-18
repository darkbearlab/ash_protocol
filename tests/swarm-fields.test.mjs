import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,WEAPONS} from '../src/engine.js';
import {activeTrait} from '../src/traits.js';
import {spawnField,releasePayload,inToxic,FIELD_TUNING,payloadFor,toxicShot} from '../src/swarm-fields.js';
import {inSmoke} from '../src/melee-classes.js';
import {areaCells} from '../src/throwables.js';
import {addAlly} from '../src/allies.js';

// 3.134.0 (user design 2026-09-18, docs/SWARM_FIELDS.md): more kinds of fight, not bigger numbers.
function open(faction='swarm'){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:faction});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}
const unit=(g,type,x,y,id,faction)=>{const e=makeEnemy(type,x,y,id,1,0,faction||g.facilityFaction);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};
const sac=e=>['toxic','acid','spore'].find(k=>activeTrait(e,`payload_${k}`));

test('a swarm bomber carries one sac, fixed by its id; the legacy one and the rebel bot carry none',()=>{
  const seen=new Set();
  for(let i=0;i<30;i++){const e=makeEnemy('bomber',1,1,`b${i}`,1,0,'swarm');assert.equal(sac(e),payloadFor(`b${i}`));seen.add(sac(e));}
  assert.equal(seen.size,3,'all three sacs turn up');
  assert.equal(sac(makeEnemy('bomber',1,1,'b1',1,0,'legacy')),undefined);
  assert.equal(sac(makeEnemy('bomber_bot',1,1,'b1',1,0,'rebel')),undefined);
});

test('what it leaves when it bursts: five tiles of mist, one tile of acid, or five tiles of spore smoke',()=>{
  for(const kind of ['toxic','acid','spore']){
    const g=open();let id=0;while(payloadFor(`x${id}`)!==kind)id++;
    const e=unit(g,'bomber',10,8,`x${id}`);g.hurt(e,e.hp,g.player);
    if(kind==='acid'){assert.ok(g.hazards.some(h=>h.x===10&&h.y===8&&h.type==='acid'));assert.equal(g.smoke.length,0);}
    else{const cloud=g.smoke.find(s=>s.kind===kind);assert.ok(cloud,kind);assert.equal(cloud.cells.length,5);}
  }
});

test('mist never blocks sight; spore smoke blinds you but not the swarm',()=>{
  const g=open(),bug=unit(g,'crawler',10,10,'b');
  spawnField(g,'toxic',{x:10,y:13});assert.ok(g.sight(g.player,bug)&&g.sight(bug,g.player),'mist: both see');
  g.smoke=[];spawnField(g,'spore',{x:10,y:13});
  assert.ok(!g.sight(g.player,bug),'spore: you cannot see through it');assert.ok(g.sight(bug,g.player),'the bug can');
  g.smoke=[];spawnField(g,'toxic',{x:10,y:16});assert.ok(!inSmoke(g,g.player),'mist is not smoke for the ninja');
});

test('gunfire through mist hits half as often and half as hard; the swarm, grenades and launchers are untouched',()=>{
  const g=open('loyalist'),e=unit(g,'rifleman',10,10,'r');
  const clear=g.accuracy(g.player,e).chance;
  spawnField(g,'toxic',{x:10,y:13});
  const hazed=g.accuracy(g.player,e);assert.equal(hazed.toxic,true);assert.equal(hazed.chance,Math.max(1,Math.round(clear/2)));
  const hp=e.hp;g.hitTarget(e,20,g.player,0,g.weapon);const half=hp-e.hp;
  g.smoke=[];const hp2=e.hp;g.hitTarget(e,20,g.player,0,g.weapon);const full=hp2-e.hp;
  assert.ok(half<full,`${half} < ${full}`);
  spawnField(g,'toxic',{x:10,y:13});
  assert.equal(toxicShot(g,g.player,e,WEAPONS.find(w=>w.id==='launcher')),false,'a grenade launcher is not slowed');
  const bug=makeEnemy('rifleman_infected',10,10,'i',1,0,'swarm');assert.equal(toxicShot(g,bug,g.player,{}),false,'the swarm shoots through it freely');
});

test('touching mist poisons you once a turn; your units lose 1 hp a turn instead',()=>{
  const g=open();spawnField(g,'toxic',{x:10,y:16});
  const before=g.player.poison?.stacks||0;g.action('wait');
  assert.ok((g.player.poison?.stacks||0)>before||g.logs.some(l=>l.text.includes('毒霧')),'poisoned');
  assert.ok(inToxic(g,g.player));
  const h=open(),ally=addAlly(h,'survivor','crawler',{point:{x:4,y:4}});spawnField(h,'toxic',{x:4,y:4});h.enemyAct=()=>{};
  const hp=ally.hp;h.action('wait');
  assert.equal(hp-ally.hp,1,'one hp, not poison');assert.equal(ally.poison,undefined);
});

test('the spitter flushes you out from behind cover, a turn after it swells, then waits ten turns',()=>{
  const g=open();g.props=[{id:'crate',x:10,y:15,type:'cover',hp:60,maxHp:60}];g.reveal();
  const s=unit(g,'spitter',10,11,'s');
  g.action('wait');assert.deepEqual(s.lobIntent?.point,{x:10,y:16},'aimed at your tile');
  assert.ok(g.logs.some(l=>l.text.includes('準備拋出毒霧')));
  g.action('wait');assert.ok(g.smoke.some(s=>s.kind==='toxic'&&s.cells.some(q=>q.x===10&&q.y===16)),'mist where you stood');
  assert.equal(s.lobIntent,undefined);assert.ok(s.lobCooldown>0&&s.lobCooldown<=FIELD_TUNING.lobCooldown);
});

test('the spitter screens its kin: mist on the ground between you and a bug still closing in',()=>{
  const g=open(),s=unit(g,'spitter',7,15,'s'),bug=unit(g,'crawler',10,9,'b');
  g.action('wait');
  const at=s.lobIntent?.point,d=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);assert.ok(at,'it lobs');
  assert.ok(d(at,g.player)>0,'not on you');
  assert.ok(d(at,g.player)<d(bug,g.player)&&d(at,bug)<d(bug,g.player),`between you and the bug: ${at.x},${at.y}`);
});

test('mist and lobs survive a save; tampered ones are refused',()=>{
  const g=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'});
  const c={x:g.player.x,y:g.player.y};g.smoke=[{kind:'toxic',cells:areaCells(g.grid,c,1,g.barriers,g),expires:g.turn+4}];
  const back=Game.restore(g.serialize());assert.ok(back);assert.equal(back.smoke[0].kind,'toxic');
  const raw=JSON.parse(g.serialize());raw.data.smoke[0].kind='nerve';assert.equal(Game.restore(JSON.stringify(raw)),null);
});
