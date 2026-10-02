import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEnemy,generate,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {AFFIX_TUNING,ENEMY_AFFIXES,giveEnemyAffix,sprints,sprintChance,validEnemyAffixes} from '../src/enemy-affixes.js';
import {grantTrait} from '../src/traits.js';
import {makeBarrier} from '../src/barriers.js';
import {LUNGE_TRAIT} from '../src/game.js';
import {t} from '../src/i18n.js';
import {checkMines} from '../src/field-gear.js';

// 3.216.0 疾行 (user 2026-09-30, docs/ENEMY_VARIETY.md section 5): a sprinter that walks takes up to two steps along its
// usual route; next to its target after the first, a biter readies its blow instead; a gunman never fires on a sprint.
const T=AFFIX_TUNING;
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=[];g.flares=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function sprinter(g,type,x,y=10,faction='loyalist',sprint=true){const e=makeEnemy(type,x,y,'sp',6,hard,faction);if(sprint)giveEnemyAffix(e,'sprint');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return e;}
const turn=(g,e)=>{g.turn++;g.enemyAct(e);};

test('who: any fighting unit with the ordinary walk; no boss, behaviour card, flamer or fixed unit; its own stream',()=>{
 const def=ENEMY_AFFIXES.find(a=>a.id==='sprint'),of=(type,faction='loyalist')=>makeEnemy(type,1,1,'x',6,hard,faction);
 assert.equal(def.special,true);
 for(const [type,f] of [['rifleman'],['raider','rebel'],['gunner'],['crawler','swarm'],['giant_bug','swarm'],['spitter','swarm'],['rifleman_infected','swarm']])assert.ok(def.applies(of(type,f)),type);
 for(const [type,f] of [['sniper'],['squad_leader'],['enforcer','rebel'],['bomber','swarm'],['brood','swarm'],['turret'],['heavy_flamer'],['warden'],['hive_beast','swarm']])assert.equal(def.applies(of(type,f)),false,type);
 const fl=of('rifleman');giveEnemyAffix(fl,'flamer');assert.equal(def.applies(fl),false,'a flamer walks to its cone');
 const quick=of('rifleman');giveEnemyAffix(quick,'fast');assert.ok(def.applies(quick),'fast and sprint: first and far');
 const both=of('rifleman');giveEnemyAffix(both,'sprint');assert.ok(validEnemyAffixes(both));
});

test('start floors: hard from floor 3, standard from floor 5, never in the easy campaign; all three factions; deterministic',()=>{
 assert.equal(sprintChance(2,hard),0);assert.equal(sprintChance(3,hard),T.sprintPerDepth);
 assert.equal(sprintChance(4,standard),0);assert.equal(sprintChance(5,standard),T.sprintPerDepth);
 for(let f=1;f<=6;f++)assert.equal(sprintChance(f,easy),0);
 const count=(d,floor,faction)=>{let n=0;for(let seed=1;seed<=20;seed++){const ids=m=>m.enemies.filter(sprints).map(e=>e.id),a=generate(seed,floor,[],d,faction);assert.deepEqual(ids(a),ids(generate(seed,floor,[],d,faction)));n+=ids(a).length;}return n;};
 for(const faction of ['loyalist','rebel','swarm'])assert.ok(count(hard,6,faction)>0,faction);
 assert.equal(count(hard,2,'loyalist'),0);assert.equal(count(standard,4,'rebel'),0);assert.equal(count(easy,6,'swarm'),0);
});

test('a gunman covers two tiles a turn toward you and never fires while sprinting; the affix shows',()=>{
 const g=field(),p=g.player,e=sprinter(g,'rifleman',22);
 assert.match(enemyDisplayName(e),/？$/);
 turn(g,e);assert.deepEqual([e.x,e.y],[20,10],'two steps');assert.equal(p.hp,999);assert.equal(e.charge,false,'no shot readied on a sprint');
 assert.ok(!enemyDisplayName(e).endsWith('？'),'revealed');assert.ok(enemyDisplayName(e).includes(t('enemyAffixes.sprint.fragment')));
 const plain=field(),q=sprinter(plain,'rifleman',22,10,'loyalist',false);turn(plain,q);assert.deepEqual([q.x,q.y],[21,10],'one step without it');
});

// 3.218.0 貼身直擊 (user 2026-10-02: 「直接咬 還蓄勢就沒意義了」; a shared rule, src/enemy-behavior.js strikesOnContact).
test('next to you after the first step, a biter bites at once, unwarned; beside you its next blow is unwarned too',()=>{
 const g=field(),p=g.player,e=sprinter(g,'giant_bug',12,10,'swarm');
 turn(g,e);assert.deepEqual([e.x,e.y],[11,10],'one step, now beside you');assert.ok(p.hp<999,'and the bite, this turn');assert.equal(e.charge,false,'no wind-up');
 assert.equal(e.focusTarget,'player');assert.ok(e.affixes.find(a=>a.id==='sprint').revealed);
 const hp=p.hp;turn(g,e);assert.ok(p.hp<hp,'it bites again');assert.equal(e.charge,false);
 // Without the sprint the rule does not apply: beside you, a biter still winds up first.
 const k=field(),f=sprinter(k,'giant_bug',11,10,'swarm',false);turn(k,f);assert.ok(f.charge,'the usual wind-up');assert.equal(k.player.hp,999);
});

test('each step keeps the walk’s rules: never onto a taken tile; a shut door is opened, not passed; pinned, no step',()=>{
 const g=field(),e=sprinter(g,'rifleman',22);const block=makeEnemy('raider',20,10,'block',6,hard,'loyalist');g.enemies.push(block);g.reveal();
 turn(g,e);assert.notDeepEqual([e.x,e.y],[20,10],'not onto the taken tile');assert.ok(Math.abs(e.x-22)+Math.abs(e.y-10)<=2,'two steps at most');
 const d=field(),de=sprinter(d,'rifleman',22);for(const y of [9,11])d.grid[y][20]=0;d.barriers.push(makeBarrier('door',{x:21,y:10},{x:20,y:10},'edge-sp'));d.reveal();
 const door=d.barriers.find(b=>b.id==='edge-sp');turn(d,de);assert.equal(de.x,21,'one step, then the door');assert.equal(door.open,true,'its second step opens it');
 const pin=field(),pe=sprinter(pin,'rifleman',22);pe.suppression=3;turn(pin,pe);assert.deepEqual([pe.x,pe.y],[22,10],'pinned');
});

test('a lunge is the whole move: no second step after one',()=>{
 // Out of its sight it walks to where it last saw you, and a lunge sweeps up to three tiles of that route at once.
 const blind=g=>{const real=g.sight.bind(g);g.sight=(a,b)=>a?.id==='sp'?false:real(a,b);};
 const g=field();blind(g);const e=sprinter(g,'raider',16,10,'rebel');grantTrait(e,LUNGE_TRAIT,'test');e.lastKnown={x:10,y:10};
 const from=e.x;turn(g,e);const moved=from-e.x;assert.ok(moved>=2&&moved<=3,`lunged ${moved}`);
 // The same lunge without the affix goes exactly as far.
 const k=field();blind(k);const f=sprinter(k,'raider',16,10,'rebel',false);grantTrait(f,LUNGE_TRAIT,'test');f.lastKnown={x:10,y:10};turn(k,f);assert.equal(16-f.x,moved);
});

// 3.216.0 review: the second step is only a step, on the first's route, and it knows when to stop.
const unseen=g=>{const real=g.sight.bind(g);g.sight=(a,b)=>a?.id==='sp'?false:real(a,b);};
test('review: unseen beside you after the first step, the second never becomes a blind shot or bite',()=>{
 for(const [type,f] of [['rifleman','loyalist'],['giant_bug','swarm']]){
  const g=field();unseen(g);const e=sprinter(g,type,12,10,f);e.lastKnown={x:10,y:10};g.effects=[];turn(g,e);
  assert.deepEqual([e.x,e.y],[11,10],type);assert.equal(g.player.hp,999,`${type}: no blow`);assert.ok(!g.effects.some(x=>x.type==='enemyShot'),`${type}: no shot`);assert.equal(e.charge,false);
 }
});

test('review: a mine underfoot ends the sprint (it goes off as for anyone stepping on one)',()=>{
 const g=field(),e=sprinter(g,'rifleman',22);g.mines=[{id:'mine-1-1',x:21,y:10,seen:[]}];g.mineSerial=1;g.reveal();
 const hp=e.hp;turn(g,e);assert.deepEqual([e.x,e.y],[21,10],'stopped on the mine');checkMines(g);assert.ok(e.hp<hp,'and it went off');assert.equal(g.mines.length,0);
});

test('review: a gunman stops where it would fire from (its band), not a step past it',()=>{
 for(const [type,x] of [['rifleman',17],['gunner',16]]){
  const g=field(),e=sprinter(g,type,x);const plain=field(),q=sprinter(plain,type,x,10,'loyalist',false);turn(g,e);turn(plain,q);
  assert.deepEqual([e.x,e.y],[q.x,q.y],`${type}: no closer than a plain one`);
 }
});

test('review: walking to a survival point, the second step keeps to the point, not toward you',()=>{
 const g=field(),p=g.player;g.survival={points:[{id:'A',x:22,y:2,hp:30,maxHp:30}],open:false,incoming:[],wave:0,turns:0};
 const e=sprinter(g,'rifleman',22,10);e.survival={role:'point',target:'A'};assert.ok(g.sight(e,p),'it sees you');
 turn(g,e);assert.deepEqual([e.x,e.y],[22,8],'two steps toward its point');
});

test('review: a step and a lunge never stack',()=>{
 const g=field();unseen(g);const e=sprinter(g,'raider',16,10,'rebel');grantTrait(e,LUNGE_TRAIT,'test');e.lastKnown={x:8,y:10};
 g.barriers.push(makeBarrier('low_partition',{x:16,y:10},{x:15,y:10},'edge-low'));g.reveal();
 turn(g,e);assert.ok(16-e.x<=2,`at most two tiles: ${e.x}`);
});
