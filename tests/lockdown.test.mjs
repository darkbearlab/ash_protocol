import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {makeEnemy,generate,ENEMY_TYPES,enemyDisplayName} from '../src/engine.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {AFFIX_TUNING,ENEMY_AFFIXES,giveEnemyAffix,lockdownChance,locksDown,validEnemyAffixes} from '../src/enemy-affixes.js';
import {lockdownPlan,tickLockdowns} from '../src/lockdown.js';
import {specialDef,ORDER,topCarriers} from '../src/enemy-specials.js';
import {makeBarrier} from '../src/barriers.js';
import {cornerRay} from '../src/corner.js';
import {VOID} from '../src/data.js';
import {addAlly} from '../src/allies.js';
import {t} from '../src/i18n.js';

// 3.213.0 封鎖 (user 2026-09-30, docs/ENEMY_VARIETY.md section 2): a gunman that sees you hiding at a corner aims at the
// tile beside you that would put you in its line, warns one round and fires at that tile the next, whoever stands there
// of yours; one round off after; from hard floor 3 and standard floor 5.
const T=AFFIX_TUNING;
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
// The corner of tests/corner-tactics.test.mjs: a wall down column 10 to row 10; you at (9,10) just past its end, the
// gunman at (12,11) — it sees you lean, it has no shot at you, and (9,11) below you is in its line.
function corner({type='rifleman',affixes=['lockdown']}={}){
 const g=new Game(1,[],0,'soldier');clearGeneratedMap(g);
 g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x&&y&&x<26&&y<26?1:0));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
 g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));g.start={x:2,y:2};g.end={x:23,y:23};
 Object.assign(g.player,{x:9,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});
 for(let y=1;y<=10;y++)g.grid[y][10]=0;
 const e=makeEnemy(type,12,11,'lk',g.floor,hard,'loyalist');for(const id of affixes)giveEnemyAffix(e,id);e.alert=true;g.enemies.push(e);
 g.rng=Object.assign(()=>0,{state:()=>7});g.reveal();return {g,e,p:g.player};
}
const round=(g,e)=>{g.turn++;tickLockdowns(g);g.enemyAct(e);};
const tile={x:9,y:11};

test('who: a gunman with reach 5+ and no behaviour of its own, never infected, a flamer or a grenadier; its own stream',()=>{
 const def=ENEMY_AFFIXES.find(a=>a.id==='lockdown'),of=(type,faction='loyalist')=>makeEnemy(type,1,1,'x',6,hard,faction);
 assert.equal(def.special,true,'never in the ordinary pool');
 for(const type of ['rifleman','raider','gunner','rifleman_armored'])assert.ok(def.applies(of(type)),type);
 for(const type of ['sniper','squad_leader','enforcer'])assert.equal(def.applies(of(type)),false,`${type}: its own behaviour`);
 for(const type of ['rifleman_infected','raider_infected'])assert.equal(def.applies(of(type,'swarm')),false,type);
 for(const type of ['crawler','drone','turret'])assert.equal(def.applies(of(type,type==='crawler'?'swarm':'loyalist')),false,type);
 const flamer=of('rifleman');giveEnemyAffix(flamer,'flamer');assert.equal(def.applies(flamer),false,'a flamer has no gun');
 const thrower=of('rifleman');giveEnemyAffix(thrower,'grenadier');assert.equal(def.applies(thrower),false,'a grenadier has a warned step of its own');
 // ...and an elite's top-up never adds a grenadier to a lockdown gunman (the grenadier's own rule), nor does a save hold one.
 const locked=of('rifleman');giveEnemyAffix(locked,'lockdown');assert.equal(ENEMY_AFFIXES.find(a=>a.id==='grenadier').applies(locked),false);
 assert.deepEqual(topCarriers(locked),['lockdown'],'one top step');
 const both=of('rifleman');giveEnemyAffix(both,'lockdown');both.affixes.push({id:'grenadier',revealed:false});assert.equal(validEnemyAffixes(both),false);
 // Never fast either way (3.213.0 review): acting before you, it would aim and fire with no warning you could act on.
 const quick=of('rifleman');giveEnemyAffix(quick,'fast');assert.equal(def.applies(quick),false,'a fast gunman');
 assert.equal(ENEMY_AFFIXES.find(a=>a.id==='fast').applies(locked),false,'no fast top-up');
 const fastLock=of('rifleman');giveEnemyAffix(fastLock,'lockdown');giveEnemyAffix(fastLock,'fast');assert.equal(validEnemyAffixes(fastLock),false);
 assert.ok(validEnemyAffixes(locked));
});

test('start floors: hard from floor 3, standard from floor 5, never in the easy campaign; deterministic',()=>{
 assert.equal(lockdownChance(2,hard),0);assert.equal(lockdownChance(3,hard),T.lockdownPerDepth);
 assert.equal(lockdownChance(4,standard),0);assert.equal(lockdownChance(5,standard),T.lockdownPerDepth);
 for(let f=1;f<=6;f++)assert.equal(lockdownChance(f,easy),0,`easy ${f}`);
 const count=(d,floor,faction='loyalist')=>{let n=0;for(let seed=1;seed<=25;seed++){const a=generate(seed,floor,[],d,faction),b=generate(seed,floor,[],d,faction);const ids=m=>m.enemies.filter(locksDown).map(e=>e.id);assert.deepEqual(ids(a),ids(b));n+=ids(a).length;}return n;};
 assert.equal(count(hard,2),0);assert.ok(count(hard,3)>0);assert.ok(count(hard,6,'rebel')>0);
 assert.equal(count(standard,4),0);assert.ok(count(standard,5)>0);
 assert.equal(count(easy,6),0);assert.equal(count(hard,6,'swarm'),0,'the swarm\'s gunmen are infected');
});

test('at a corner: it aims at the tile beside you that is in its line, warns one round, then fires at that tile',()=>{
 const {g,e,p}=corner();
 assert.ok(g.sight(e,p)&&!g.shotClear(e,p),'it sees you lean but has no shot');
 // A tile is judged as a body on it that has not leaned out: your own tile is open to it only through your lean.
 assert.equal(cornerRay(g,e,{x:9,y:10},{tile:true}).clear,true);assert.equal(cornerRay(g,e,{x:9,y:10},{centre:true}).clear,false);
 assert.deepEqual(lockdownPlan(g,e)?.tile,tile);
 e.charge=true;e.aim={x:9,y:10};e.windup=1;   // a shot wound up for it (a squad's 已就緒, a watch order) is let go
 assert.match(enemyDisplayName(e),/？$/,'hidden until it aims');
 round(g,e);
 assert.deepEqual(e.lockIntent,{origin:{x:12,y:11},tile});assert.equal(e.charge,false,'no ordinary shot wound up beside it');assert.equal(e.aim,null);
 assert.equal(e.affixes.find(a=>a.id==='lockdown').revealed,true);
 assert.equal(g.logs[0].text,t('lockdown.aim',{enemy:enemyDisplayName(e)}));assert.ok(g.effects.some(f=>f.type==='enemyTelegraph'&&f.to.x===9&&f.to.y===11));
 assert.deepEqual(specialDef('lockdown').card(g,e),[t('target-card.lockdown')]);
 // You stay put: the burst goes into the empty tile.
 round(g,e);
 assert.equal(e.lockIntent,undefined);assert.equal(p.hp,999,'you stayed behind the corner');assert.equal(g.logs[0].text,t('lockdown.empty',{enemy:enemyDisplayName(e)}));
 assert.ok(g.effects.some(f=>f.type==='enemyShot'&&f.to.x===9&&f.to.y===11&&f.miss));assert.equal(e.lockCooldown,T.lockdownCooldown);
});

test('of the tiles in its line, the one nearest its line to you, then reading order',()=>{
 // Open ground with your corner faked (no shot at you): every tile beside you is in its line. Its line runs from (15,11)
 // to you at (10,10): (11,10) and (9,10) lie nearest it (opposite tiles tie), and reading order takes (9,10) — not
 // (10,9), first in reading order of all four.
 const {g,e,p}=corner();for(let y=1;y<=10;y++)g.grid[y][10]=1;p.x=10;p.y=10;e.x=15;e.y=11;g.reveal();
 const real=g.shotClear.bind(g);g.shotClear=(a,b)=>a===e&&b===p?false:real(a,b);
 assert.deepEqual(lockdownPlan(g,e)?.tile,{x:9,y:10});
});

// Its corner faked (it sees you, no shot at you), so each filter is tested on its own.
const faked=k=>{const real={sight:k.g.sight.bind(k.g),shot:k.g.shotClear.bind(k.g)};k.g.sight=(a,b)=>a===k.e&&b===k.p?true:real.sight(a,b);k.g.shotClear=(a,b)=>a===k.e&&b===k.p?false:real.shot(a,b);return k;};
test('only a tile you could step onto, within its reach, and in its line for a body standing there (3.213.0 review)',()=>{
 // A pit below you: not a tile you can stand on (and nothing else beside you is in its line).
 const pit=faked(corner());pit.g.grid[11][9]=VOID;pit.g.reveal();assert.equal(lockdownPlan(pit.g,pit.e),null,'a pit');
 // A shut door between you and the tile below: you cannot step there.
 const door=faked(corner());door.g.barriers.push(makeBarrier('door',{x:9,y:10},{x:9,y:11},'edge-step'));door.g.reveal();assert.equal(lockdownPlan(door.g,door.e),null,'across a shut door');
 // Open ground, you at its full reach (7): the tile beyond you is out of its reach, the one before you is not.
 const far=faked(corner());for(let y=1;y<=10;y++)far.g.grid[y][10]=1;far.p.x=10;far.p.y=10;far.e.x=17;far.e.y=10;far.g.reveal();
 assert.deepEqual(lockdownPlan(far.g,far.e)?.tile,{x:11,y:10});
 // A wall below the corner's end and the gunman a row lower: the tile below you is open to it only through a lean from
 // that tile, not for a body standing there — no tile.
 const lean=faked(corner());lean.g.grid[11][10]=0;lean.e.y=12;lean.g.reveal();
 assert.equal(cornerRay(lean.g,lean.e,tile,{tile:true}).clear,true);assert.equal(cornerRay(lean.g,lean.e,tile,{centre:true}).clear,false);
 assert.equal(lockdownPlan(lean.g,lean.e),null,'lean-only tiles do not count');
});

test('it follows its orders and its hazard step first, and only aims when you are the turn\'s target (3.213.0 review)',()=>{
 // Standing on acid at the corner: it steps off instead of aiming.
 const acid=corner();acid.g.hazards.push({x:12,y:11,type:'acid'});acid.g.reveal();acid.g.turn++;acid.g.enemyAct(acid.e);
 assert.equal(acid.e.lockIntent,undefined);assert.notDeepEqual([acid.e.x,acid.e.y],[12,11],'stepped off');
 // A drone of yours in the open is the turn's target: it is shot at, not the tile beside you.
 const k=corner();const drone=addAlly(k.g,'drone','drone',{point:{x:12,y:14},sourceId:'drone_follow'});assert.ok(drone);k.g.reveal();
 assert.ok(k.g.shotClear(k.e,drone));k.g.turn++;k.g.enemyAct(k.e);assert.equal(k.e.lockIntent,undefined);
 assert.ok(k.e.charge||drone.hp<drone.maxHp,'it takes on the drone');
 assert.equal(specialDef('lockdown').blocks.decoy,true,'a decoy waits for the warned burst');
});

test('stepping out onto the locked tile gets you shot; an ally standing there is shot instead',()=>{
 const {g,e,p}=corner();round(g,e);
 p.y=11;g.reveal();round(g,e);assert.ok(p.hp<999,'you stepped into it');
 const k=corner();round(k.g,k.e);
 const ally=addAlly(k.g,'drone','drone',{point:tile,sourceId:'drone_follow'});assert.ok(ally);const hp=ally.hp;round(k.g,k.e);
 assert.ok(ally.hp<hp,'your unit on the tile takes the burst');assert.equal(k.p.hp,999);
});

test('an enemy is never on the tile it picks, and an enemy that walks onto it is not shot',()=>{
 const {g,e}=corner();const o=makeEnemy('raider',9,11,'mate',g.floor,hard,'loyalist');o.alert=false;g.enemies.push(o);g.reveal();
 const plan=lockdownPlan(g,e);assert.notDeepEqual(plan?.tile,tile,'not the tile a comrade stands on');
 const k=corner();round(k.g,k.e);const m=makeEnemy('raider',9,11,'mate',k.g.floor,hard,'loyalist');m.alert=false;k.g.enemies.push(m);const hp=m.hp;
 round(k.g,k.e);assert.equal(m.hp,hp,'enemy rounds never hit enemies (as the sniper\'s tile)');
});

test('only at a corner, seen and in reach: in the open it shoots you, unseen or out of reach it does nothing of the sort',()=>{
 const open=corner();open.p.y=13;open.g.reveal();assert.ok(open.g.shotClear(open.e,open.p));assert.equal(lockdownPlan(open.g,open.e),null);
 round(open.g,open.e);assert.equal(open.e.lockIntent,undefined);
 const far=corner();far.e.x=far.p.x+3;far.e.y=far.p.y+ENEMY_TYPES.rifleman.range;far.g.reveal();assert.equal(lockdownPlan(far.g,far.e),null,'out of reach');
 const dark=corner();const real=dark.g.sight.bind(dark.g);dark.g.sight=(a,b)=>a===dark.e?false:real(a,b);assert.equal(lockdownPlan(dark.g,dark.e),null,'unseen');
 const plain=corner({affixes:[]});assert.equal(lockdownPlan(plain.g,plain.e),null,'no affix');
});

test('one round off after it fires, then it may aim again',()=>{
 const {g,e}=corner();round(g,e);round(g,e);assert.equal(e.lockIntent,undefined);
 round(g,e);assert.equal(e.lockIntent,undefined,'the round off');
 // It may have shifted along the wall in the round off; wherever it stands, it aims again at a tile beside you.
 round(g,e);assert.ok(e.lockIntent,'aiming again');assert.equal(Math.abs(e.lockIntent.tile.x-9)+Math.abs(e.lockIntent.tile.y-10),1);
});

test('dropped when it is pinned, stunned, moved or falls; a shut door stops the burst',()=>{
 const pin=corner();pin.e.suppression=3;pin.g.turn++;pin.g.enemyAct(pin.e);assert.equal(pin.e.lockIntent,undefined,'pinned, it does not aim');
 // Pinned after the round start (your suppressive fire lands mid-round): the warned burst is dropped, not fired.
 const late=corner();round(late.g,late.e);late.e.suppression=3;late.p.y=11;late.g.reveal();late.g.enemyAct(late.e);
 assert.equal(late.e.lockIntent,undefined);assert.equal(late.p.hp,999,'no burst from a pinned gunman');
 // Moved off its tile between the warning and the shot: no burst into the tile from somewhere else.
 const mv=corner();round(mv.g,mv.e);mv.e.x=13;mv.g.reveal();mv.g.turn++;mv.g.enemyAct(mv.e);
 assert.ok(!mv.g.logs.some(l=>l.text===t('lockdown.empty',{enemy:enemyDisplayName(mv.e)})),'the aim is dropped, not fired');assert.ok(!mv.g.effects.some(f=>f.type==='enemyShot'&&f.to.x===9&&f.to.y===11&&f.miss));
 for(const [why,hit] of [['pinned',e=>{e.suppression=3;}],['stunned',e=>{e.control={disabled:1,immune:0};}],['moved',e=>{e.x=13;}],['dead',e=>{e.hp=0;}]]){
  const {g,e}=corner();round(g,e);assert.ok(e.lockIntent);hit(e);g.turn++;tickLockdowns(g);g.enemyAct(e);
  assert.equal(e.lockIntent,undefined,why);
 }
 // One door shut after the aim, between it and the tile (3.213.0 review: the burst checks the aim's own line).
 const {g,e,p}=corner();round(g,e);
 const shut=makeBarrier('door',{x:9,y:11},{x:10,y:11},'edge-lk');g.barriers.push(shut);const doorHp=shut.hp;
 p.y=11;g.reveal();
 round(g,e);assert.equal(p.hp,999,'blocked');assert.ok(g.logs.some(l=>l.text===t('lockdown.blocked',{enemy:enemyDisplayName(e)})));assert.ok(shut.hp<doorHp,'the door takes it, as from the sniper');
});

test('smoke does not matter once it aims: it fires at the tile, not at you',()=>{
 const {g,e,p}=corner();round(g,e);
 g.smoke=[{cells:[{x:11,y:11},{x:10,y:11},{x:9,y:11}],expires:g.turn+6}];p.y=11;g.reveal();assert.equal(g.sight(e,p),false,'it cannot see you in the smoke');
 round(g,e);assert.ok(p.hp<999);
});

test('saves: the aim and the cooldown round-trip; a stale aim is dropped, a malformed one refused, a long cooldown cut',()=>{
 assert.ok(ORDER.ids.includes('lockdown')&&ORDER.top.includes('lockdown'));
 const {g,e}=corner();round(g,e);g.rng=new Game(1,[],0,'soldier','onyx').rng;
 const raw=g.serialize(),back=Game.restore(raw);assert.ok(back);
 assert.deepEqual(back.enemies.find(x=>x.id==='lk').lockIntent,e.lockIntent);
 const tamper=fn=>{const d=JSON.parse(raw);fn(d.data.enemies.find(x=>x.id==='lk'));return Game.restore(JSON.stringify(d));};
 // A tile on the map past its reach (the card's, tuning-bound): dropped, not refused.
 const reach=tamper(x=>{x.lockIntent.tile={x:20,y:20};});assert.ok(reach,'past its reach: stale, not refused');assert.equal(reach.enemies.find(x=>x.id==='lk').lockIntent,undefined);
 const moved=tamper(x=>{x.x=13;});assert.ok(moved,'stale, not refused');assert.equal(moved.enemies.find(x=>x.id==='lk').lockIntent,undefined);assert.equal(moved.enemies.find(x=>x.id==='lk').lockCooldown,T.lockdownCooldown,'the cooldown restarts');
 for(const [why,fn] of [['a tile off the map',x=>{x.lockIntent.tile={x:-1,y:3};}],['a tile on a wall',x=>{x.lockIntent.tile={x:10,y:9};}],['not an object',x=>{x.lockIntent='aim';}],['on a gunman without the affix',x=>{x.affixes=x.affixes.filter(a=>a.id!=='lockdown');}],['a fractional cooldown',x=>{x.lockCooldown=1.5;}]])
  assert.equal(tamper(fn),null,why);
 const cut=tamper(x=>{delete x.lockIntent;x.lockCooldown=9;});assert.ok(cut);assert.equal(cut.enemies.find(x=>x.id==='lk').lockCooldown,T.lockdownCooldown);
});
