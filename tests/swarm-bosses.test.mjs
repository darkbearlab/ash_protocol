import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily,memberText} from './helpers/source.mjs';
import {Game,makeEnemy,ENEMY_TYPES,SAVE_VERSION,applySuppression,scaleEnemy,floorDamageBonus,makeBarrier,VOID} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {SWARM_BOSS_TUNING,SWARM_TUNING} from '../src/swarm-tuning.js';
import {chargeLane,chargeLanes,chargeSide,chargeReady,crashBonus,eggSpot,eggSacs,laidNests,tickSwarmBosses,dropStaleSwarmIntents,validSwarmBosses} from '../src/swarm-bosses.js';
import {tongueLane,tonguePlan,tongueTelegraphs,hookLanding} from '../src/swarm.js';
import {addAlly} from '../src/allies.js';
import {applyDisruption} from '../src/throwables.js';
import {RUNTIME_TUNING,tickNests,validRuntime} from '../src/runtime-enemies.js';
import {giveOrder} from '../src/orders.js';
import {targetDetails} from '../src/target-card.js';
import {hazardTile} from '../src/hazard-paths.js';

// 3.205.0 (user design 2026-09-29, docs/BOSSES.md section 4): the tongue takes the first body on its line and bites it;
// the hive beast charges a lane and knocks everything on it aside; the matriarch lays egg sacs that hatch into nests.
const C=SWARM_BOSS_TUNING.charge,N=SWARM_BOSS_TUNING.nest;
function field(character='soldier'){
  const g=affixArena(character);clearGeneratedMap(g);g.fires=undefined;g.flares=[];g.facilityFaction='swarm';
  Object.assign(g.player,{hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();
  return g;
}
const boss=(g,type,x,y,id=type)=>{const e=g.spawnEnemy(type,x,y,id);e.alert=true;g.enemies.push(e);g.reveal();return e;};
const bug=(g,type,x,y,id)=>{const e=g.spawnEnemy(type,x,y,id);e.alert=true;e.hp=e.maxHp=500;g.enemies.push(e);g.reveal();return e;};
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};
// No combat dice at all: a roll here fails the test.
const noDice=g=>{g.rng=Object.assign(()=>{throw new Error('combat dice rolled');},{state:()=>1});};
// Only the tongue: the other specials held on their cooldowns (enemyAct runs no round-start tick).
const tongueOnly=e=>{if(e.type==='hive_beast')e.chargeCooldown=C.cooldown;if(e.type==='hive_matriarch')e.nestCooldown=N.cooldown;return e;};
const bite=(g,type)=>scaleEnemy(ENEMY_TYPES[type].damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec);
const wall=(g,x,y)=>{g.grid[y][x]=0;g.lighting[y][x]=0;};
const pet=(g,x,y)=>{const a=addAlly(g,'pet','crawler',{point:{x,y}});a.hp=a.maxHp=300;g.reveal();return a;};

test('the catalog: the beast charges and tongues, the matriarch lays nests, tongues and charges when hurt; the numbers',()=>{
  const {hive_beast:b,hive_matriarch:m}=ENEMY_TYPES;
  assert.deepEqual(b.specials,['charge','tongue']);assert.deepEqual(m.specials,['nest','tongue','charge']);
  assert.ok(b.tongue&&m.tongue);assert.equal(b.chargeBelow,undefined);assert.equal(m.chargeBelow,true);
  assert.deepEqual([b.damage,m.damage],[26,30],'the bite is the card blow (user: 巨獸 26、母后 30)');
  assert.deepEqual(C,{lane:8,damage:15,crush:30,disabled:1,crashBonus:20,cooldown:3,below:.5});
  assert.deepEqual(N,{near:3,far:4,live:2,brood:3,cooldown:6});
  assert.equal(SWARM_TUNING.tongueRange,5);assert.equal(RUNTIME_TUNING.nestHp,45);assert.equal(RUNTIME_TUNING.interval,2);
  for(const type of ['giant_bug','designator','gunline','crawler'])assert.ok(!(ENEMY_TYPES[type].specials||[]).some(k=>['charge','nest','tongue'].includes(k)),type);
});

test('鉤舌: the tongue takes the first body on its line, any side, drags it beside the boss and bites it in the same action',()=>{
  // The player is aimed at; something steps into the line in between. Each is caught instead of you.
  for(const who of ['ally','bug','civilian']){
    const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));g.enemyAct(e);assert.ok(e.tongueIntent,who);
    const body=who==='ally'?pet(g,12,10):bug(g,who==='bug'?'crawler':'civilian',12,10,`in-the-way-${who}`);const hp=body.hp,you=g.player.hp;
    fixed(g,0);g.enemyAct(e);
    assert.deepEqual([body.x,body.y],[14,10],`${who}: dragged beside the boss`);assert.ok(body.hp<hp,`${who}: bitten`);
    assert.deepEqual([g.player.x,g.player.y,g.player.hp],[10,10,you],`${who}: you were behind it`);
    assert.equal(e.tongueIntent,undefined);assert.equal(e.tongueCooldown,SWARM_TUNING.tongueCooldown);
    assert.ok(g.effects.some(f=>f.type==='tonguePull'&&f.to.x===14));
  }
  // Already beside the boss on the line: bitten where it stands.
  {const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));g.enemyAct(e);const a=pet(g,14,10),hp=a.hp;fixed(g,0);g.enemyAct(e);assert.deepEqual([a.x,a.y],[14,10]);assert.ok(a.hp<hp,'adjacent: bitten in place');}
  // It aims at whoever it is fighting: your unit, when that is its target.
  {const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));g.player.y=20;const a=pet(g,11,10);g.enemyTarget=()=>a;g.reveal();g.enemyAct(e);assert.deepEqual(e.tongueIntent?.target,{x:11,y:10},'aimed at your unit');}
  // A blow it had wound up is dropped for the tongue, and none is left standing after the lash.
  {const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));Object.assign(e,{charge:true,aim:{x:14,y:10},windup:1});g.enemyAct(e);assert.ok(e.tongueIntent);assert.equal(e.charge,false);assert.equal(e.aim,null);
   Object.assign(e,{charge:true,aim:{x:10,y:10},windup:1});fixed(g,0);g.enemyAct(e);assert.deepEqual([e.charge,e.aim,e.windup],[false,null,1]);}
  // You, and the blow in full: the card's damage grown by floor, like every blow (beast 26, matriarch 30).
  for(const type of ['hive_beast','hive_matriarch']){
    const g=field(),e=tongueOnly(boss(g,type,15,10));g.enemyAct(e);fixed(g,0);const hp=g.player.hp,turn=g.turn;
    g.enemyAct(e);assert.deepEqual([g.player.x,g.player.y],[14,10],type);assert.equal(hp-g.player.hp,bite(g,type),`${type}: pulled and bitten at once`);assert.equal(g.turn,turn);
    assert.ok(!e.charge&&e.windup===1&&e.aim===null,`${type}: no blow left wound up behind the lash`);
  }
});

test('鉤舌: its own kind is bitten too, and that kill is not yours',()=>{
  const g=field(),e=tongueOnly(boss(g,'hive_matriarch',15,10));g.enemyAct(e);
  const brood=bug(g,'crawler',12,10,'victim');brood.hp=3;const kills=g.player.kills,xp=g.player.xp,scrap=g.player.scrap;
  fixed(g,0);g.enemyAct(e);
  assert.ok(brood.hp<=0,'bitten to death');assert.deepEqual([g.player.kills,g.player.xp,g.player.scrap],[kills,xp,scrap],'no kill, xp or scrap for you');
});

test('鉤舌: an empty line misses; the line runs on to its reach past the aimed tile; walls and closed doors stop it',()=>{
  const miss=change=>{const g=field(),e=tongueOnly(boss(g,'hive_beast',14,10));g.enemyAct(e);change(g);const hp=g.player.hp,at=[g.player.x,g.player.y];fixed(g,0);g.enemyAct(e);
    return {g,e,moved:g.player.x!==at[0]||g.player.y!==at[1],hurt:g.player.hp<hp};};
  let r=miss(g=>{g.player.y=11;});assert.deepEqual([r.moved,r.hurt],[false,false],'off the line: missed');assert.equal(r.e.tongueCooldown,4);
  assert.ok(r.g.logs.some(l=>l.text.includes('撲空')),'a miss is logged');
  r=miss(g=>{g.player.x=9;});assert.deepEqual([r.moved,r.hurt],[true,true],'a step back along the line, still in reach: caught');
  r=miss(g=>{wall(g,12,10);});assert.deepEqual([r.moved,r.hurt],[false,false],'a wall now cuts the line');
  r=miss(g=>{g.barriers=[makeBarrier('door',{x:12,y:10},{x:13,y:10},'door-1')];});assert.deepEqual([r.moved,r.hurt],[false,false],'a closed door stops it');
  r=miss(g=>{g.barriers=[{...makeBarrier('door',{x:12,y:10},{x:13,y:10},'door-1'),open:true}];});assert.deepEqual([r.moved,r.hurt],[true,true],'an open one does not');
  r=miss(g=>{g.props.push({id:'crate',type:'cover',x:12,y:10,hp:40,maxHp:40});});assert.deepEqual([r.moved,r.hurt],[false,false],'nor does a solid object let it through');
  // The line drawn is the line flown: out to five tiles from the boss.
  const g=field(),e=tongueOnly(boss(g,'hive_beast',14,10));g.enemyAct(e);const lane=tongueTelegraphs(g)[0].lane;
  assert.deepEqual(lane.map(q=>q.x),[13,12,11,10,9]);assert.deepEqual(lane,tongueLane(g,e,g.player));
});

test('鉤舌 over a pit: it crosses and what it catches always lands on floor',()=>{
  const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));for(const x of [12,13,14])g.grid[10][x]=VOID;g.reveal();
  assert.ok(tonguePlan(g,e),'the pit does not stop the announcement');g.enemyAct(e);fixed(g,0);g.enemyAct(e);
  assert.equal(g.grid[g.player.y][g.player.x],1,'landed on floor');assert.equal(Math.abs(g.player.x-15)+Math.abs(g.player.y-10),1,'beside the boss');
  // Every tile beside the boss a pit: nothing to drag to, so nothing is announced.
  const h=field(),b=tongueOnly(boss(h,'hive_beast',15,10));for(const [x,y] of [[14,10],[16,10],[15,9],[15,11]])h.grid[y][x]=VOID;h.reveal();
  assert.equal(tonguePlan(h,b),null);
});

test('衝鋒: a round of warning draws the lane; then everyone on it is knocked aside for 15 and disabled a round',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10),turn=g.turn;noDice(g);g.enemyAct(e);
  assert.deepEqual(e.chargeIntent,{origin:{x:16,y:10},dir:{x:-1,y:0}});assert.deepEqual([g.player.x,g.player.y,g.player.hp],[10,10,999]);
  Object.assign(e,{charge:true,aim:{x:10,y:10},windup:1});   // (as if a blow were wound up: the charge replaces it)
  const lane=chargeLanes(g)[0];assert.equal(lane.cells.length,C.lane);assert.equal(lane.crash,false);assert.deepEqual(lane.cells.at(-1),{x:8,y:10});
  assert.ok(g.effects.some(f=>f.type==='bossTelegraph'&&f.kind==='charge'));
  // Your unit on the lane too. The charge itself never rolls the combat dice.
  const a=pet(g,13,10),ahp=a.hp;noDice(g);g.enemyAct(e);assert.equal(g.turn,turn);
  const side=[{x:10,y:9},{x:10,y:11}][chargeSide(g,e,g.player)];
  assert.deepEqual({x:g.player.x,y:g.player.y},side,'one tile aside, the side the hash picked');assert.equal(g.player.hp,999-C.damage);
  assert.equal(g.player.control.disabled,C.disabled);assert.equal(a.control.disabled,C.disabled);assert.equal(Math.abs(a.y-10),1);assert.equal(a.x,13);assert.ok(a.hp<ahp);
  assert.deepEqual([e.x,e.y],[8,10],'it runs to the end of the lane');assert.equal(e.chargeIntent,undefined);assert.equal(e.chargeCooldown,C.cooldown);
  assert.deepEqual([e.charge,e.aim,e.windup],[false,null,1],'no blow left wound up behind the charge');
  assert.equal(e.crashed,undefined,'no wall at the end: not stunned');assert.equal(e.control.disabled,0);
  // 3.208.0 (近戰壓制 5): the ram pins you too, so the knocked-down round is a wait (a move would be refused as pinned).
  assert.equal(g.player.suppression,5);assert.equal(a.suppression,5,'your unit too');
  // Disabled a round: your next action is lost, the one after is yours.
  fixed(g,.999);const x=g.player.x;g.action('wait');assert.equal(g.player.x,x);assert.equal(g.player.y,side.y,'the knocked-down round');
  assert.equal(g.player.control.disabled,0);assert.equal(e.chargeCooldown,C.cooldown-1,'a round has passed on its cooldown');
  // A blow it had wound up before it lowered its head is dropped for the charge.
  const w=field(),b=boss(w,'hive_beast',16,10);Object.assign(b,{charge:true,aim:{x:15,y:10},windup:1});w.enemyAct(b);assert.ok(b.chargeIntent);assert.deepEqual([b.charge,b.aim],[false,null]);
});

test('衝鋒: with no free side it stays and takes 30, still disabled; never into a pit, a body or across a closed door',()=>{
  for(const block of ['walls','pit','bodies','doors']){
    const g=field(),e=boss(g,'hive_beast',16,10);g.enemyAct(e);assert.ok(e.chargeIntent,block);
    if(block==='walls'){wall(g,10,9);wall(g,10,11);}
    if(block==='pit'){g.grid[9][10]=VOID;wall(g,10,11);}
    if(block==='bodies'){bug(g,'crawler',10,9,'b1');bug(g,'crawler',10,11,'b2');}
    if(block==='doors')g.barriers=[makeBarrier('door',{x:10,y:10},{x:10,y:9},'d1'),makeBarrier('partition',{x:10,y:10},{x:10,y:11},'d2')];
    noDice(g);g.enemyAct(e);
    assert.deepEqual([g.player.x,g.player.y],[10,10],`${block}: it stays`);assert.equal(g.player.hp,999-C.crush,`${block}: 30`);assert.equal(g.player.control.disabled,1);
    assert.deepEqual([e.x,e.y],[8,10],`${block}: the beast runs on past it`);
  }
  // A body that could not be knocked aside at the lane's end: the beast stops short of it (and a wall there still stuns it).
  {const g=field(),e=boss(g,'hive_beast',16,10);wall(g,9,10);wall(g,10,9);wall(g,10,11);g.reveal();g.enemyAct(e);noDice(g);g.enemyAct(e);
   assert.deepEqual([g.player.x,g.player.y,g.player.hp],[10,10,999-C.crush]);assert.deepEqual([e.x,e.y],[11,10],'stopped short of you');assert.equal(e.crashed,true);}
  // One side free: that one, whatever the hash says. A pit side is never used.
  for(const [open,shut] of [[9,11],[11,9]]){const g=field(),e=boss(g,'hive_beast',16,10);g.enemyAct(e);g.grid[shut][10]=VOID;noDice(g);g.enemyAct(e);assert.equal(g.player.y,open);assert.equal(g.player.hp,999-C.damage);}
});

test('衝鋒: everyone on the lane, any side — its own kind and civilians too — and no kill of yours',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10);g.enemyAct(e);
  const a=bug(g,'crawler',14,10,'own'),c=bug(g,'civilian',12,10,'civ'),weak=bug(g,'crawler',11,10,'weak');weak.hp=5;const kills=g.player.kills,xp=g.player.xp;
  fixed(g,.999);g.enemyAct(e);   // a body that falls still drops what it carried (its own roll), as any death does
  for(const u of [a,c])if(u.hp>0){assert.equal(u.hp,500-C.damage,u.id);assert.equal(Math.abs(u.y-10),1,u.id);assert.equal(u.control.disabled,1,u.id);}
  assert.ok(weak.hp<=0);assert.deepEqual([g.player.kills,g.player.xp],[kills,xp],'the charge killed it, not you');
  assert.equal(Math.abs(g.player.y-10),1);
});

test('衝鋒 into a wall: it stops there, stunned a round, and +20 to hit it until its own next turn',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10);wall(g,9,10);g.reveal();g.enemyAct(e);
  assert.equal(chargeLanes(g)[0].crash,true,'the warning already shows the wall');assert.deepEqual(chargeLanes(g)[0].cells.at(-1),{x:10,y:10});
  noDice(g);g.enemyAct(e);
  assert.deepEqual([e.x,e.y],[10,10],'stopped against the wall (you were knocked aside)');
  assert.equal(e.control.disabled,1);assert.equal(e.crashed,true);assert.equal(e.vaultExposed,true);assert.equal(e.moved,false,'dazed where it stands');
  assert.equal(g.accuracy(g.player,e).vaultBonus,20,'a shot: +20');assert.equal(crashBonus(e),C.crashBonus);
  g.player.suppression=0;   // 3.208.0: the ram pinned you (近戰壓制 5); measured without your stacks, which would floor the chance
  const blow=g.meleeAccuracy(g.player,e,40);e.crashed=undefined;assert.equal(blow-g.meleeAccuracy(g.player,e,40),20,'a blow: +20');e.crashed=true;
  g.target=e.id;assert.match(targetDetails(g).state,/撞牆暈眩 \+20/);
  // Its next turn is lost and the opening closes with it.
  fixed(g,.999);g.player.control.disabled=0;const at=[e.x,e.y];g.action('wait');
  assert.deepEqual([e.x,e.y],at,'stunned: it did nothing');assert.equal(e.crashed,undefined);assert.equal(e.vaultExposed,false);
  // A lane of full length with a wall just past it is no crash.
  const h=field(),b=boss(h,'hive_beast',18,10);wall(h,9,10);h.reveal();h.enemyAct(b);assert.equal(chargeLanes(h)[0].crash,false);assert.equal(chargeLanes(h)[0].cells.length,8);
  // Doors, partitions, crates and nests stop it the same way; a pit ends the lane as a wall does.
  for(const stop of ['door','crate','pit']){const k=field(),c=boss(k,'hive_beast',16,10);if(stop==='door')k.barriers=[makeBarrier('door',{x:9,y:10},{x:10,y:10},'d')];if(stop==='crate')k.props.push({id:'c',type:'cover',x:9,y:10,hp:40,maxHp:40});if(stop==='pit')k.grid[10][9]=VOID;k.reveal();
    k.enemyAct(c);noDice(k);k.enemyAct(c);assert.equal(c.crashed,true,stop);assert.deepEqual([c.x,c.y],[10,10],stop);}
});

test('衝鋒: cooldown of three rounds; only in line two to eight tiles off with sight; the matriarch below half health only',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10);e.tongueCooldown=SWARM_TUNING.tongueCooldown;g.enemyAct(e);noDice(g);g.enemyAct(e);assert.equal(e.chargeCooldown,3);
  Object.assign(g.player,{x:e.x+4,y:e.y,control:{disabled:0,immune:0}});g.reveal();
  for(let n=1;n<C.cooldown;n++){tickSwarmBosses(g);e.tongueCooldown=4;fixed(g,.999);g.enemyAct(e);assert.equal(e.chargeIntent,undefined,`round ${n}: still cooling`);Object.assign(e,{x:8,y:10});}
  tickSwarmBosses(g);e.tongueCooldown=4;fixed(g,.999);g.enemyAct(e);assert.ok(e.chargeIntent,'the third round: it can again');
  const not=(setup,why)=>{const h=field(),b=boss(h,'hive_beast',16,10);b.tongueCooldown=4;setup(h,b);h.reveal();fixed(h,.999);h.enemyAct(b);assert.equal(b.chargeIntent,undefined,why);};
  not((h)=>{h.player.y=11;},'not in line');not((h,b)=>{b.x=11;},'next to you it bites instead');not((h,b)=>{b.x=19;},'nine tiles is too far');
  not((h)=>{wall(h,13,10);},'a wall between');not((h)=>{h.sight=()=>false;},'no sight');
  // The matriarch: only below half her health.
  const m=field(),q=boss(m,'hive_matriarch',16,10);q.nestCooldown=6;q.tongueCooldown=4;fixed(m,.999);m.enemyAct(q);assert.equal(q.chargeIntent,undefined,'whole: no charge');assert.equal(chargeReady(q),false);
  q.hp=Math.floor(q.maxHp/2)-1;q.charge=false;assert.equal(chargeReady(q),true);m.enemyAct(q);assert.ok(q.chargeIntent,'below half: it charges');
});

test('衝鋒: the side is a fixed hash, never the dice — a replay and a reload knock it the same way',()=>{
  const sides=new Set();
  for(let seed=1;seed<=24;seed++){
    const run=()=>{const g=field();g.seed=seed;const e=boss(g,'hive_beast',16,10);g.enemyAct(e);return g;};
    const a=run(),b=Game.restore(a.serialize());noDice(a);noDice(b);a.enemyAct(a.enemies[0]);b.enemyAct(b.enemies[0]);
    assert.deepEqual([a.player.x,a.player.y],[b.player.x,b.player.y],`seed ${seed}`);sides.add(a.player.y);
    assert.equal(chargeSide(a,a.enemies[0],a.player),chargeSide(b,b.enemies[0],b.player));
  }
  assert.deepEqual([...sides].sort(),[11,9],'both sides come up');
});

test('衝鋒 is dropped when the beast is stunned, pinned, moved or killed while it warns; each starts the cooldown',()=>{
  for(const cause of ['stun','pin','move','death']){
    const g=field(),e=boss(g,'hive_beast',16,10);g.enemyAct(e);assert.ok(e.chargeIntent);
    if(cause==='stun')applyDisruption(e,'biological');if(cause==='pin'){e.traits=[];applySuppression(e,9);}if(cause==='move')e.y=11;if(cause==='death')g.hurt(e,99999);
    if(cause!=='move')assert.equal(e.chargeIntent,undefined,`${cause}: dropped at once`);tickSwarmBosses(g);
    const hp=g.player.hp;fixed(g,.999);g.enemyAct(e);assert.equal(g.player.hp,hp,`${cause}: no charge`);assert.equal(e.chargeIntent,undefined);
    assert.ok(e.chargeCooldown>0,cause);
  }
});

test('產蟲巢: a sac on a floor tile three or four from you that you can see; the next round a nest of three larvae',()=>{
  const g=field(),m=boss(g,'hive_matriarch',16,12,'mother');const state=g.rng.state();g.enemyAct(m);
  const egg=m.nestIntent;assert.ok(egg);assert.equal(g.rng.state(),state,'no dice');
  const d=Math.abs(egg.x-g.player.x)+Math.abs(egg.y-g.player.y);assert.ok(d>=N.near&&d<=N.far,`${d}`);assert.equal(g.grid[egg.y][egg.x],1);assert.ok(g.visible(egg));
  assert.deepEqual(eggSacs(g),[{sourceId:'mother',x:egg.x,y:egg.y}]);assert.equal(laidNests(g,m).length,0,'not a nest yet');
  assert.ok(g.effects.some(f=>f.type==='bossTelegraph'&&f.kind==='egg'));
  // The next turn begins with the hatch; it is not her action (she goes on: here, she walks toward you).
  fixed(g,.999);const was=[m.x,m.y];g.enemyAct(m);const [nest]=laidNests(g,m);
  assert.deepEqual({id:nest.id,x:nest.x,y:nest.y,hp:nest.hp,maxHp:nest.maxHp},{id:'mother-nest-0',x:egg.x,y:egg.y,hp:45,maxHp:45});
  assert.deepEqual(nest.nest,{active:false,total:3,interval:2,remaining:3,cooldown:0,serial:0});
  assert.equal(m.nestIntent,undefined);assert.equal(m.nestCooldown,N.cooldown);assert.notDeepEqual([m.x,m.y],was,'and then she acted');
  assert.ok(g.solid(nest.x,nest.y));assert.ok(validRuntime(g));
  // Three larvae in all, every two rounds, then it caves in.
  let brood=0;for(let n=0;n<10;n++){tickNests(g);brood=g.enemies.filter(e=>e.nestId===nest.id).length;}
  assert.equal(brood,N.brood);assert.equal(nest.hp,0);assert.ok(validRuntime(g));
});

test('產蟲巢: two of hers at most; six rounds after a hatch; a taken tile loses the sac; stunned or killed she loses it',()=>{
  const g=field(),m=boss(g,'hive_matriarch',16,12,'mother');m.tongueCooldown=4;
  const lay=()=>{fixed(g,.999);g.enemyAct(m);};
  lay();lay();assert.equal(laidNests(g,m).length,1);
  for(let n=1;n<N.cooldown;n++){tickSwarmBosses(g);m.tongueCooldown=4;lay();assert.equal(m.nestIntent,undefined,`round ${n}: cooling`);}
  tickSwarmBosses(g);m.tongueCooldown=4;lay();assert.ok(m.nestIntent,'the sixth round: another sac');lay();assert.equal(laidNests(g,m).filter(o=>o.hp>0).length,2);
  for(let n=0;n<N.cooldown;n++)tickSwarmBosses(g);m.tongueCooldown=4;lay();assert.equal(m.nestIntent,undefined,'two standing: no third');
  laidNests(g,m)[0].hp=0;m.tongueCooldown=4;lay();assert.ok(m.nestIntent,'one down: she lays again');
  // A body on the tile when it hatches: the sac is lost, and the cooldown runs all the same.
  const q=m.nestIntent;bug(g,'crawler',q.x,q.y,'squatter');const count=laidNests(g,m).length;lay();
  assert.equal(laidNests(g,m).length,count,'no nest');assert.equal(m.nestCooldown,N.cooldown);assert.ok(g.logs.some(l=>l.text.includes('卵囊被壓破')));
  for(const cause of ['stun','death']){
    const h=field(),w=boss(h,'hive_matriarch',16,12,'w');fixed(h,.999);h.enemyAct(w);assert.ok(w.nestIntent);
    if(cause==='stun')applyDisruption(w,'biological');else h.hurt(w,99999);
    assert.equal(w.nestIntent,undefined,cause);assert.equal(w.nestCooldown,N.cooldown);
  }
});

test('產蟲巢: the sac never cuts off floor you can reach, and is laid nearest her',()=>{
  // A one-tile corridor is the only floor three or four tiles from you: no sac there.
  const g=field();for(let y=0;y<27;y++)for(let x=0;x<27;x++)g.grid[y][x]=0;
  for(let x=4;x<=20;x++)g.grid[10][x]=1;for(let y=8;y<=12;y++)for(let x=16;x<=20;x++)g.grid[y][x]=1;g.lighting=g.grid.map(r=>r.map(()=>1));
  Object.assign(g.player,{x:10,y:10});const m=boss(g,'hive_matriarch',18,10,'m');g.reveal();
  assert.equal(eggSpot(g,m),null,'every candidate is a corridor tile');
  const h=field(),w=boss(h,'hive_matriarch',16,10,'w'),spot=eggSpot(h,w);
  assert.equal(Math.abs(spot.x-16)+Math.abs(spot.y-10),16-10-N.far,'as close to her as the ring allows');
  // Close to you, still three or four tiles off you (never at your feet); and only when she sees you.
  const k=field(),near=boss(k,'hive_matriarch',11,10,'near'),q=eggSpot(k,near),d=Math.abs(q.x-10)+Math.abs(q.y-10);assert.ok(d>=N.near&&d<=N.far,`${d}`);
  const b=field(),blind=boss(b,'hive_matriarch',16,12,'blind'),sight=b.sight.bind(b);blind.tongueCooldown=4;b.sight=(x,y)=>!(x===blind&&y===b.player)&&sight(x,y);
  assert.ok(eggSpot(b,blind),'there is a tile for it');fixed(b,.999);b.enemyAct(blind);assert.equal(blind.nestIntent,undefined,'she does not see you: no sac');
});

test('saves: a charge, a stunned beast, a sac and her nests come back; stale warnings are dropped; bad ones refused',()=>{
  assert.equal(SAVE_VERSION,94);
  const g=field(),b=boss(g,'hive_beast',16,10,'beast'),m=boss(g,'hive_matriarch',16,14,'mother');
  g.enemyAct(b);m.nestIntent={x:13,y:12};m.nestCooldown=0;
  g.props.push({id:'mother-nest-0',type:'nest',x:14,y:16,hp:45,maxHp:45,nest:{active:true,total:3,interval:2,remaining:2,cooldown:2,serial:1}});
  const child=g.spawnEnemy('brood',14,17,'mother-nest-0-child-1');child.nestId='mother-nest-0';g.enemies.push(child);
  g.props.push({id:'nest-1-0',type:'nest',x:3,y:20,hp:45,maxHp:45,nest:{active:false,total:6,interval:2,remaining:6,cooldown:0,serial:0}});   // the floor's own nest besides hers
  assert.ok(validRuntime(g),'her nests do not count toward the generated one');
  const raw=g.serialize(),back=Game.restore(raw);assert.ok(back,'loads');
  assert.deepEqual(back.enemies.find(e=>e.id==='beast').chargeIntent,b.chargeIntent);assert.deepEqual(back.enemies.find(e=>e.id==='mother').nestIntent,{x:13,y:12});
  assert.deepEqual(back.props.find(o=>o.id==='mother-nest-0'),g.props.find(o=>o.id==='mother-nest-0'));
  // Crashed and stunned.
  const c=field(),k=boss(c,'hive_beast',16,10,'k');wall(c,9,10);c.reveal();c.enemyAct(k);noDice(c);c.enemyAct(k);assert.equal(k.crashed,true);
  const kb=Game.restore(c.serialize());assert.ok(kb);assert.equal(kb.enemies[0].crashed,true);assert.equal(kb.enemies[0].vaultExposed,true);
  // Stale: dropped, never a reason to refuse the run.
  const stale=(change,check)=>{const d=JSON.parse(raw);change(d.data);const s=Game.restore(JSON.stringify(d));assert.ok(s,change.toString());check(s);};
  stale(d=>{d.enemies.find(e=>e.id==='beast').x=17;},s=>{const e=s.enemies.find(e=>e.id==='beast');assert.equal(e.chargeIntent,undefined);assert.equal(e.chargeCooldown,C.cooldown);});
  stale(d=>{d.enemies.find(e=>e.id==='beast').hp=0;},s=>assert.equal(s.enemies.find(e=>e.id==='beast').chargeIntent,undefined));
  stale(d=>{d.enemies.find(e=>e.id==='beast').control={disabled:1,immune:0};},s=>assert.equal(s.enemies.find(e=>e.id==='beast').chargeIntent,undefined));
  stale(d=>{d.enemies.find(e=>e.id==='mother').hp=0;},s=>{const e=s.enemies.find(e=>e.id==='mother');assert.equal(e.nestIntent,undefined);assert.equal(e.nestCooldown,N.cooldown);});
  stale(d=>{const e=d.enemies.find(e=>e.id==='mother');e.tongueIntent={origin:{x:15,y:14},target:{x:10,y:10},point:{x:15,y:13}};},s=>assert.equal(s.enemies.find(e=>e.id==='mother').tongueIntent,undefined,'a tongue left where its boss no longer stands'));
  // Malformed: refused.
  for(const change of [d=>{d.enemies.find(e=>e.id==='beast').chargeIntent.dir={x:1,y:1};},d=>{d.enemies.find(e=>e.id==='beast').chargeCooldown=-1;},d=>{d.enemies.find(e=>e.id==='beast').chargeCooldown=1.5;},
    d=>{d.enemies.find(e=>e.id==='beast').chargeIntent.extra=1;},d=>{d.enemies.find(e=>e.id==='mother').nestIntent={x:13,y:12,z:0};},
    d=>{d.grid[12][13]=0;},d=>{d.enemies.find(e=>e.id==='mother').nestCooldown='6';},d=>{d.enemies.find(e=>e.id==='beast').nestCooldown=1;},
    d=>{d.enemies.find(e=>e.id==='beast').crashed=true;},d=>{d.props.find(o=>o.id==='mother-nest-0').nest={active:true,total:0,interval:2,remaining:0,cooldown:0,serial:0};},
    d=>{Object.assign(d.props.find(o=>o.id==='mother-nest-0'),{hp:50,maxHp:45});},
    d=>{d.props.find(o=>o.id==='mother-nest-0').id='beast-nest-0';}]){
    const d=JSON.parse(raw);change(d.data);assert.equal(Game.restore(JSON.stringify(d)),null,change.toString());
  }
  assert.equal(validSwarmBosses(g),true);
});

test('SAVE 83: a save from 82 loads unchanged; a kept floor on a round trip keeps her sac, her nests and a charge',()=>{
  const g=field(),b=boss(g,'hive_beast',16,10,'beast');g.enemyAct(b);delete b.chargeIntent;delete b.chargeCooldown;
  const old=JSON.parse(g.serialize());old.version=82;const loaded=Game.restore(JSON.stringify(old));assert.ok(loaded);assert.equal(loaded.enemies[0].chargeIntent,undefined);
  const r=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'swarm'});Object.assign(r.player,r.exitPoint);assert.equal(r.exitBlocked,'');assert.ok(r.descend());
  const frame=r.floorStates[1],spot=frame.grid.flatMap((row,y)=>row.map((v,x)=>({x,y,v}))).filter(q=>q.v===1&&!frame.props.some(o=>o.x===q.x&&o.y===q.y)&&!frame.enemies.some(e=>e.x===q.x&&e.y===q.y)&&!frame.items.some(o=>o.x===q.x&&o.y===q.y)&&!(q.x===frame.start.x&&q.y===frame.start.y)&&!(q.x===frame.end.x&&q.y===frame.end.y));
  const [a,c,d]=spot;const mother=makeEnemy('hive_matriarch',a.x,a.y,'kept-mother',1,0,'swarm');mother.alert=true;mother.nestIntent={x:c.x,y:c.y};mother.chargeCooldown=2;mother.nestCooldown=0;
  frame.enemies.push(mother);frame.props.push({id:'kept-mother-nest-0',type:'nest',x:d.x,y:d.y,hp:45,maxHp:45,nest:{active:false,total:3,interval:2,remaining:3,cooldown:0,serial:0}});
  const back=Game.restore(r.serialize());assert.ok(back,'the archived floor is checked with its own rules');
  const kept=back.floorStates[1].enemies.find(e=>e.id==='kept-mother');assert.deepEqual(kept.nestIntent,{x:c.x,y:c.y});assert.ok(back.floorStates[1].props.some(o=>o.id==='kept-mother-nest-0'));
  const bad=JSON.parse(r.serialize());bad.data.floorStates[1].props.find(o=>o.id==='kept-mother-nest-0').nest.total=9;assert.equal(Game.restore(JSON.stringify(bad)),null,'a bad kept nest is refused');
  const stale=JSON.parse(r.serialize());stale.data.floorStates[1].enemies.find(e=>e.id==='kept-mother').hp=0;const s=Game.restore(JSON.stringify(stale));
  assert.ok(s,'a sac left by a fallen matriarch is dropped');assert.equal(s.floorStates[1].enemies.find(e=>e.id==='kept-mother').nestIntent,undefined);
  const frameOnly={enemies:[{...structuredClone(mother),hp:0}],floorStates:{}};dropStaleSwarmIntents(frameOnly);assert.equal(frameOnly.enemies[0].nestIntent,undefined);
});

test('interactions: a decoy, a mine, an order, fire and smoke never keep a warned charge from going off where it was warned',()=>{
  // Fooled by a decoy next to it, it still charges (and does not spend the round on the decoy).
  const g=field(),e=boss(g,'hive_beast',16,10);g.enemyAct(e);g.decoy={x:16,y:11,hp:30,maxHp:30,expires:g.turn+3,fooled:[e.id]};noDice(g);g.player.control.disabled=0;
  g.enemyAct(e);assert.deepEqual([e.x,e.y],[8,10],'decoy: charged');assert.equal(g.decoy.hp,30);
  // A mine it watched go down: still the charge.
  const h=field(),b=boss(h,'hive_beast',16,10);h.enemyAct(b);h.mines=[{id:'mine-1-1',x:16,y:14,seen:[b.id]}];h.mineSerial=1;noDice(h);h.enemyAct(b);assert.deepEqual([b.x,b.y],[8,10],'mine: charged');
  // An order that would walk it away: the charge first, from where it was warned.
  const o=field(),k=boss(o,'hive_beast',16,10);o.enemyAct(k);assert.ok(giveOrder(o,k,{kind:'retreat',by:'self',at:{x:22,y:20}}));noDice(o);o.enemyAct(k);assert.deepEqual([k.x,k.y],[8,10],'order: charged');
  // Standing in fire while warned, it does not step off first; a body may be knocked onto burning floor.
  const f=field(),w=boss(f,'hive_beast',16,10);f.enemyAct(w);f.fires=[{x:16,y:10,age:1},{x:10,y:9,age:1}];wall(f,10,11);assert.ok(hazardTile(f,16,10,w));
  noDice(f);f.enemyAct(w);assert.deepEqual([w.x,w.y],[8,10],'fire: charged from its tile');assert.deepEqual([f.player.x,f.player.y],[10,9],'onto the burning side, the only free one');
  // In smoke you are out of its sight, but the warned charge goes all the same; a new one needs sight.
  const s=field(),z=boss(s,'hive_beast',16,10);s.enemyAct(z);s.smoke=[{cells:[{x:10,y:10},{x:11,y:10}],expires:s.turn+5}];noDice(s);s.enemyAct(z);assert.equal(Math.abs(s.player.y-10),1,'smoke: knocked aside');
  const n=field(),y=boss(n,'hive_beast',16,10);n.smoke=[{cells:[{x:10,y:10},{x:11,y:10}],expires:n.turn+5}];y.tongueCooldown=4;fixed(n,.999);n.enemyAct(y);assert.equal(y.chargeIntent,undefined,'unseen: no new charge');
  // Light smoke (steam and haze) halves aims, not charges: the lane is the same.
  const v=field(),u=boss(v,'hive_beast',16,10);v.smoke=[{kind:'haze',cells:[{x:12,y:10}],expires:v.turn+5}];v.enemyAct(u);noDice(v);v.enemyAct(u);assert.deepEqual([u.x,u.y],[8,10]);
  // The target card says what is coming.
  const t=field(),q=boss(t,'hive_beast',16,10);t.enemyAct(q);t.target=q.id;assert.match(targetDetails(t).state,/衝鋒蓄勢/);
  const m=field(),mm=boss(m,'hive_matriarch',16,12);m.enemyAct(mm);m.target=mm.id;assert.match(targetDetails(m).state,/產卵中/);
});


// ---- the independent review (3.205.0) ----------------------------------------------------------------------------
import {decalPlan} from '../src/faction-decals.js';
import {edgeCells} from '../src/barriers.js';
import {reachable} from '../src/world.js';
import {validSwarm} from '../src/swarm.js';

test('review 1: a save from before the user retunes the swarm bosses still loads: cooldowns cut to today\'s, nests kept as they were',()=>{
  const g=field(),b=boss(g,'hive_beast',16,10,'beast'),m=boss(g,'hive_matriarch',16,14,'mother');
  // As a save written under longer cooldowns, bigger nests and a higher cap would hold them.
  Object.assign(b,{chargeCooldown:C.cooldown+4,tongueCooldown:SWARM_TUNING.tongueCooldown+3});m.nestCooldown=N.cooldown+5;
  const nest=(n,x,extra={})=>({id:`mother-nest-${n}`,type:'nest',x,y:20,hp:60,maxHp:60,nest:{active:true,total:6,interval:3,remaining:4,cooldown:1,serial:2},...extra});
  g.props.push(nest(0,3),nest(1,5),nest(2,7),nest(3,9,{hp:0,nest:{active:true,total:5,interval:3,remaining:0,cooldown:0,serial:5}}));   // three standing, one spent
  for(const n of [0,1,2])for(let i=1;i<=2;i++){const c=g.spawnEnemy('brood',3+n*2,21+i,`mother-nest-${n}-child-${i}`);c.nestId=`mother-nest-${n}`;g.enemies.push(c);}
  const back=Game.restore(g.serialize());assert.ok(back,'loads');
  const bb=back.enemies.find(e=>e.id==='beast'),mm=back.enemies.find(e=>e.id==='mother');
  assert.deepEqual([bb.chargeCooldown,bb.tongueCooldown,mm.nestCooldown],[C.cooldown,SWARM_TUNING.tongueCooldown,N.cooldown],'cut to today\'s tuning');
  assert.equal(back.props.filter(o=>o.id.startsWith('mother-nest-')).length,4,'her nests, the spent one too');
  // With three of hers standing (over today's two) she lays no more.
  mm.tongueCooldown=4;mm.nestCooldown=0;fixed(back,.999);back.enemyAct(mm);assert.equal(mm.nestIntent,undefined,'over the cap: no sac');
});

test('review 2: a beast killed on its own charge stops there: it rams no one else, does not run on or crash',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10,'beast');e.tongueCooldown=4;fixed(g,.5);g.enemyAct(e);assert.ok(e.chargeIntent);
  e.hp=10;wall(g,15,9);wall(g,15,11);g.reveal();const sac=bug(g,'bomber',15,10,'sac');sac.hp=sac.maxHp=12;   // crushed, it bursts beside the beast
  const hp=g.player.hp;fixed(g,.5);g.enemyAct(e);
  assert.ok(e.hp<=0,'the blast killed it');assert.deepEqual([e.x,e.y],[16,10],'its body stays where it fell');
  assert.deepEqual([g.player.hp,g.player.x,g.player.y,g.player.control.disabled],[hp,10,10,0],'you were not rammed');
  assert.ok(!g.effects.some(f=>f.type==='bossTelegraph'&&f.kind==='rush'),'no run drawn');assert.equal(e.crashed,undefined);
});

test('review 3: a body beside the boss across a low partition is dragged over it (a blow could not reach it there), then bitten',()=>{
  const g=field(),e=tongueOnly(boss(g,'hive_beast',15,10));g.enemyAct(e);
  g.barriers=[makeBarrier('low_partition',{x:14,y:10},{x:15,y:10},'edge-lp')];g.player.x=14;g.reveal();assert.equal(g.canCross(e,g.player),false);
  fixed(g,0);const hp=g.player.hp;g.enemyAct(e);
  assert.notDeepEqual([g.player.x,g.player.y],[14,10],'dragged over the partition');assert.equal(Math.abs(g.player.x-15)+Math.abs(g.player.y-10),1);assert.ok(g.canCross(e,g.player));
  assert.ok(g.player.hp<hp,'bitten');assert.equal(g.barriers[0].hp,g.barriers[0].maxHp,'the partition is not hit');assert.ok(Game.restore(g.serialize()));
  // Beside it with nothing between: bitten in place, and the log says so (no drag).
  const h=field(),b=tongueOnly(boss(h,'hive_beast',15,10));h.enemyAct(b);h.player.x=14;h.reveal();fixed(h,0);h.enemyAct(b);
  assert.deepEqual([h.player.x,h.player.y],[14,10]);assert.ok(h.logs.some(l=>l.text.includes('張口就咬')));assert.ok(!h.logs.slice(0,3).some(l=>l.text.includes('拖向')));
});

test('review 4: a sac never takes the one tile in front of a locked vault door (locked doors count as open for the route check)',()=>{
  let checked=0;
  for(const seed of [3,4]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'});g.floor=6;g.loadFloor();
    const door=g.barriers.find(b=>b.vault),m=g.enemies.find(e=>e.type==='hive_matriarch');assert.ok(door&&door.locked&&m,`${seed}`);
    const reach=reachable(g,g.start),front=edgeCells(door).map(c=>({x:Math.round(c.x),y:Math.round(c.y)})).find(c=>reach.has(`${c.x},${c.y}`));
    const floor=[];for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid.length;x++)if(g.grid[y][x]===1&&!g.solid(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))floor.push({x,y});
    for(const p of floor.filter(p=>[3,4].includes(Math.abs(p.x-front.x)+Math.abs(p.y-front.y)))){
      Object.assign(g.player,p);const near=floor.find(q=>Math.abs(q.x-front.x)+Math.abs(q.y-front.y)===1&&!(q.x===p.x&&q.y===p.y));if(!near)continue;Object.assign(m,near);g.reveal();
      if(!g.visible(front))continue;
      const q=eggSpot(g,m);checked++;assert.ok(!q||q.x!==front.x||q.y!==front.y,`seed ${seed}: not in front of the vault door`);
    }
  }
  assert.ok(checked>0,'the vault fronts were tried');
});

test('review 5: a flying unit of yours over a pit is a valid save, and the tongue may be aimed at it there',()=>{
  const g=field('engineer');assert.ok(g.action('deployUnit',{line:0,x:10,y:11}));const d=g.allies.find(a=>a.kind==='drone');assert.ok(d);
  for(let y=9;y<=11;y++)for(let x=12;x<=14;x++)g.grid[y][x]=VOID;Object.assign(d,{x:13,y:10});
  assert.ok(g.passable(13,10,d));assert.ok(Game.restore(g.serialize()),'a drone hovering over a pit loads (it used to be refused)');
  g.player.x=3;g.player.y=3;for(let x=0;x<27;x++)wall(g,x,6);const e=boss(g,'hive_beast',17,10);e.chargeCooldown=3;g.reveal();
  assert.equal(g.enemyTarget(e),d);fixed(g,.999);g.enemyAct(e);assert.deepEqual(e.tongueIntent?.target,{x:13,y:10},'aimed at the drone over the pit');
  assert.equal(validSwarm(g),true);assert.ok(Game.restore(g.serialize()));
  // Walking units are still never over a pit.
  const w=field();pet(w,11,10);w.grid[10][11]=VOID;assert.equal(Game.restore(w.serialize()),null,'a pet over a pit is refused');
});

test('review 6: a boss hurting its own kind is logged as its doing and kept out of your damage count',()=>{
  const g=field(),e=boss(g,'hive_beast',16,10);e.tongueCooldown=4;g.enemyAct(e);bug(g,'crawler',14,10,'own');
  const before=g.player.stats.damage;fixed(g,.999);g.enemyAct(e);
  assert.equal(g.player.stats.damage,before,'not your damage');
  assert.ok(g.logs.some(l=>l.text.includes(`${ENEMY_TYPES.hive_beast.name}傷到`)),'the beast did it');assert.ok(!g.logs.some(l=>/^命中/.test(l.text)),'not "you hit"');
  // Your own hits still count.
  const h=field(),o=bug(h,'crawler',12,10,'x'),d=h.player.stats.damage;h.hurt(o,7,h.player);assert.equal(h.player.stats.damage,d+7);
});

test('review 7: gaps: the sac\'s tile rules, low partitions and the tongue, the landing\'s edge, the knock-down, the decals',()=>{
  // The sac: an item, a mine, a hazard, fire, the decoy, the start or the exit on the chosen tile moves it; so does not seeing it.
  for(const put of ['item','mine','hazard','fire','decoy','start','end','unseen']){
    const g=field(),m=boss(g,'hive_matriarch',16,12,'m'),q=eggSpot(g,m);assert.ok(q,put);
    if(put==='item')g.items.push({x:q.x,y:q.y,type:'med'});if(put==='mine')g.mines=[{id:'mine-1-1',x:q.x,y:q.y,seen:[]}];if(put==='hazard')g.hazards.push({x:q.x,y:q.y,type:'acid'});
    if(put==='fire')g.fires=[{x:q.x,y:q.y,age:1}];if(put==='decoy')g.decoy={x:q.x,y:q.y,hp:30,maxHp:30,expires:g.turn+3,fooled:[]};if(put==='start')g.start={x:q.x,y:q.y};if(put==='end')g.end={x:q.x,y:q.y};
    if(put==='unseen'){const visible=g.visible.bind(g);g.visible=p=>!(p.x===q.x&&p.y===q.y)&&visible(p);}
    const r=eggSpot(g,m);assert.ok(r,put);assert.notDeepEqual([r.x,r.y],[q.x,q.y],put);
  }
  // A low partition does not stop the tongue (a closed door or a partition does).
  const t=field(),b=tongueOnly(boss(t,'hive_beast',15,10));t.barriers=[makeBarrier('low_partition',{x:12,y:10},{x:13,y:10},'lp')];t.reveal();
  assert.ok(tongueLane(t,b,t.player).some(q=>q.x===10&&q.y===10),'over the low partition');
  // The landing is never across an edge from the boss.
  const h=field(),c=tongueOnly(boss(h,'hive_beast',15,10));h.barriers=[makeBarrier('low_partition',{x:14,y:10},{x:15,y:10},'lp')];h.reveal();
  const plan=tonguePlan(h,c);assert.ok(plan);assert.notDeepEqual(plan.point,{x:14,y:10});assert.ok(h.canCross(plan.point,c));
  // Knocked down clears an earlier stun's immunity (a unit is never both), and the save loads.
  const k=field(),w=boss(k,'hive_beast',16,10);k.enemyAct(w);k.player.control={disabled:0,immune:2};noDice(k);k.enemyAct(w);
  assert.deepEqual(k.player.control,{disabled:1,immune:0});assert.ok(Game.restore(k.serialize()));
  // The floor's decals look only at its own nest: one she lays later leaves them as they were (a reload would not move them).
  const d=new Game(5,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'});d.floor=6;d.loadFloor();const mother=d.enemies.find(e=>e.type==='hive_matriarch'),plan0=JSON.stringify(decalPlan(d));
  const floor=[];for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(d.grid[y][x]===1&&!d.props.some(o=>o.x===x&&o.y===y))floor.push({x,y});
  let moved=0;for(const q of floor.filter((_,i)=>i%20===0)){const laid={id:`${mother.id}-nest-0`,type:'nest',x:q.x,y:q.y,hp:45,maxHp:45,nest:{active:false,total:3,interval:2,remaining:3,cooldown:0,serial:0}};
    d.props.push(laid);assert.equal(JSON.stringify(decalPlan(d)),plan0,`laid at ${q.x},${q.y}`);laid.id='nest-6-9';if(JSON.stringify(decalPlan(d))!==plan0)moved++;d.props.pop();}
  assert.ok(moved>0,'(a nest of the floor\'s own there would move them)');
});

// ---- 3.206.0 (user): the egg sac's look ---------------------------------------------------------------------------
test('3.206.0 (user): the egg sac shows the swarm wave\'s burrow on its warning tile; the drawn sac is only the fallback',async()=>{
  const source=sourceFamily('renderer');
  const body=memberText(source,'  eggSac(q,time){');
  assert.match(body,/if\(drawNestSprite\(c,this\.terrainImages\?\.get\(NEST_ATLAS\),a,t,'burrow','active'\)\)return;/,'the burrow, as the swarm wave draws it');
  assert.ok(body.indexOf('EGG_VISUAL.fill')<body.indexOf("'burrow'")&&body.indexOf("'burrow'")<body.indexOf('c.ellipse('),'over the warning tile, with the drawn sac after it as the fallback');
});
