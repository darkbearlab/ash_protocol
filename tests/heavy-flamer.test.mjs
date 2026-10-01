import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,ENEMY_TYPES,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {ENEMY_AFFIXES,isFlamer,enemyArmor} from '../src/enemy-affixes.js';
import {flameCells,flameWeapon,FLAMETHROWER,liveFlameIntent} from '../src/fire.js';
import {heavySpecial,heavyChance,HEAVY_TUNING} from '../src/world.js';
import {factionDef} from '../src/factions.js';
import {WEAPONS} from '../src/data.js';
import {distance} from '../src/world.js';
import {t} from '../src/i18n.js';
import {LIGHT_MODEL} from '../src/lighting.js';
import {reduceDirectDamage} from '../src/traits.js';
import {giveEnemyAffix} from '../src/enemy-affixes.js';

// 3.214.0 重裝火焰兵 (user 2026-09-30, docs/ENEMY_VARIETY.md section 3): a flamer by its card with a 3-tile cone, large,
// slow, heavily armoured, fireproof; one at most a floor of the loyalists and the rebels, from hard floor 3 and standard
// floor 5.
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
const heavies=m=>m.enemies.filter(e=>e.type==='heavy_flamer');
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=[];g.flares=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function heavy(g,x=13,y=10,faction='loyalist'){const e=makeEnemy('heavy_flamer',x,y,'hf',6,hard,faction);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return e;}

test('the card: a flamer by its card with a 3-tile cone, armour 6, heavy armour, large, slow, unpinnable, fireproof',()=>{
 const d=ENEMY_TYPES.heavy_flamer,e=makeEnemy('heavy_flamer',1,1,'x',6,hard,'loyalist');
 assert.ok(isFlamer(e),'a flamer without the affix');assert.equal(flameWeapon(e).range,3);assert.equal(WEAPONS[FLAMETHROWER].range,5,'the flamethrower itself unchanged');
 assert.equal(enemyArmor(e),6);for(const id of ['large','slow','suppression_resistance','heavy_armor'])assert.ok(e.traits.some(x=>x.id===id),id);
 assert.ok(d.fireproof);assert.ok(d.tags.includes('armed'));
 assert.equal(enemyDisplayName(makeEnemy('heavy_flamer',1,1,'a',6,hard,'loyalist')).replace(/？$/,''),t('loyalistNames.heavy_flamer.name'));
 assert.equal(enemyDisplayName(makeEnemy('heavy_flamer',1,1,'b',6,hard,'rebel')).replace(/？$/,''),t('rebelNames.heavy_flamer.name'));
 // No affix that would break it: no fast (slow is its point), no second flamer, no gun affixes.
 for(const id of ['fast','flamer','suppressor','grenadier','deployer','lockdown'])assert.equal(ENEMY_AFFIXES.find(a=>a.id===id).applies(e),false,id);
});

test('where: hard from floor 3, standard from floor 5, never in the easy campaign or the swarm; one at most, in place',()=>{
 assert.equal(heavyChance(2,hard),0);assert.equal(heavyChance(3,hard),HEAVY_TUNING.perDepth);
 assert.equal(heavyChance(4,standard),0);assert.equal(heavyChance(5,standard),HEAVY_TUNING.perDepth);
 for(let f=1;f<=6;f++)assert.equal(heavyChance(f,easy),0,`easy ${f}`);
 assert.equal(factionDef('swarm').heavy,undefined);assert.equal(factionDef('loyalist').heavy,'heavy_flamer');assert.equal(factionDef('rebel').heavy,'heavy_flamer');
 let seen=0;
 for(let seed=1;seed<=30;seed++)for(const faction of ['loyalist','rebel'])for(const floor of [2,5,6]){
  const a=generate(seed,floor,[],hard,faction),b=generate(seed,floor,[],hard,faction);
  assert.ok(heavies(a).length<=1,'one at most');assert.deepEqual(heavies(a).map(e=>[e.id,e.x,e.y]),heavies(b).map(e=>[e.id,e.x,e.y]),'deterministic');
  if(floor===2)assert.equal(heavies(a).length,0);seen+=heavies(a).length;
 }
 assert.ok(seen>=10,`${seen}`);
 for(let seed=1;seed<=20;seed++){assert.equal(heavies(generate(seed,6,[],easy,'loyalist')).length,0);assert.equal(heavies(generate(seed,6,[],hard,'swarm')).length,0);}
 // In place: the floor's enemies otherwise stay as they were; the one replaced was an ordinary armed soldier with no
 // behaviour of its own.
 let checked=0;
 for(let seed=1;seed<=40&&checked<5;seed++){
  const m={enemies:Array.from({length:12},(_,i)=>makeEnemy(['rifleman','raider','sniper','crawler'][i%4],i+1,3,`e${i}`,6,hard,'loyalist'))};
  const before=m.enemies.map(e=>[e.id,e.type,e.x,e.y]);heavySpecial(m,seed,6,hard,'loyalist');
  const changed=m.enemies.map((e,i)=>[e,before[i]]).filter(([e,b])=>e.type!==b[1]);
  assert.ok(changed.length<=1);
  for(const [e,b] of changed){checked++;assert.equal(e.type,'heavy_flamer');assert.deepEqual([e.id,e.x,e.y],[b[0],b[2],b[3]]);assert.ok(['rifleman','raider'].includes(b[1]),b[1]);}
 }
 assert.ok(checked>0);
});

test('it marks a 3-tile cone only within 3 tiles, sprays it the next round, and the floor catches',()=>{
 const g=field(),p=g.player,e=heavy(g,14,10);
 g.enemyAct(e);assert.equal(e.flameIntent,undefined,'4 tiles off: it walks, it does not mark');assert.ok(e.moved);
 assert.deepEqual([e.x,e.y],[13,10]);g.turn++;g.enemyAct(e);
 assert.ok(liveFlameIntent(e),'within 3: marked');const cone=flameCells(g,e.flameIntent.origin,e.flameIntent.aim,flameWeapon(e));
 assert.ok(cone.length&&cone.every(q=>distance(e,q)<=3),'never past 3');assert.ok(cone.some(q=>q.x===p.x&&q.y===p.y));
 assert.ok(flameCells(g,e,p).some(q=>distance(e,q)>3),'the flamethrower\'s own cone would reach further');
 const hp=p.hp;g.turn++;g.enemyAct(e);assert.ok(p.hp<hp,'sprayed');assert.ok((g.fires||[]).some(f=>f.x===p.x&&f.y===p.y),'your tile burns');
 assert.ok(g.effects.some(f=>f.type==='flame'&&f.cells.every(q=>distance(e,q)<=3)));
});

test('heavy armour: pistol rounds and buckshot barely scratch it; it does not burn',()=>{
 const g=field(),e=heavy(g,12,10);e.hp=e.maxHp=500;g.enemyAct=()=>{};g.target=e.id;const p=g.player;
 const per=w=>{p.weapon=w;p.ammo[w]=99;const before=e.hp;g.target=e.id;g.action('fire');return before-e.hp;};
 const rifle=per(0),smg=per(2);assert.ok(rifle>0&&smg<rifle,`rifle ${rifle} smg ${smg}`);
 assert.equal(reduceDirectDamage(e,100),75,'heavy armour: direct damage -25% after armour');
 const k=field(),f=heavy(k,12,10),hp=f.hp,r=makeEnemy('rifleman',12,12,'control',6,hard,'loyalist');r.alert=true;k.enemies.push(r);const rhp=r.hp;
 k.fires=[{x:12,y:10,age:1},{x:12,y:12,age:1}];k.reveal();k.environmentTurn();
 assert.ok(r.hp<rhp,'a rifleman in the same fire burns (the test reaches the fire)');assert.equal(f.hp,hp,'fireproof');
});

test('it falls as a flamer does: its tank goes up or it leaves the flamethrower',()=>{
 let tanks=0,drops=0;
 for(let i=0;i<20;i++){const g=field(),e=makeEnemy('heavy_flamer',12,10,`hf${i}`,6,hard,'loyalist');g.enemies.push(e);g.reveal();g.rng=new Game(i+3).rng;
  const items=g.items.length;e.hp=1;g.hurt(e,5,g.player);
  if(g.logs.some(l=>l.text===t('flames.tankBlows',{enemy:enemyDisplayName(e)})))tanks++;else if(g.items.slice(items).some(it=>it.type==='weapon'&&it.weapon===FLAMETHROWER))drops++;}
 assert.ok(tanks>0&&drops>0,`tanks ${tanks}, drops ${drops}`);assert.equal(tanks+drops,20);
});

test('saves: its marked cone round-trips and loads as a flamer\'s',()=>{
 const g=field(),e=heavy(g,13,10);g.enemyAct(e);assert.ok(liveFlameIntent(e));
 g.rng=new Game(1,[],0,'soldier','onyx').rng;const back=Game.restore(g.serialize());assert.ok(back);
 assert.deepEqual(back.enemies.find(x=>x.id==='hf').flameIntent,e.flameIntent);
});

test('no gun to blind-fire: next to you in the black, a flamer (by card or by affix) holds instead of shooting (3.214.0 review)',()=>{
 for(const make of [g=>heavy(g,11,10),g=>{const e=makeEnemy('rifleman',11,10,'af',6,hard,'loyalist');giveEnemyAffix(e,'flamer');e.alert=true;g.enemies.push(e);g.rng=Object.assign(()=>0,{state:()=>1});return e;}]){
  const g=field();g.lightModel=LIGHT_MODEL;g.lamps=[];g.lighting=g.grid.map(row=>row.map(()=>0));Object.assign(g.player,{flashlight:false});
  const e=make(g);e.lastKnown={x:10,y:10};g.reveal();assert.equal(g.sight(e,g.player),false,'it cannot see you');
  const hp=g.player.hp;g.effects=[];g.turn++;g.enemyAct(e);
  assert.equal(g.player.hp,hp,`${e.type}: no damage`);assert.ok(!g.effects.some(f=>f.type==='enemyShot'),`${e.type}: no shot`);
 }
 // Walking toward where it last saw you, its next step is your tile (you stand in its way, unseen): no shot either.
 const g=field();g.lightModel=LIGHT_MODEL;g.lamps=[];g.lighting=g.grid.map(row=>row.map(()=>0));Object.assign(g.player,{flashlight:false,x:11,y:10});
 const e=heavy(g,12,10);e.lastKnown={x:9,y:10};g.reveal();assert.equal(g.sight(e,g.player),false);
 const hp=g.player.hp;g.effects=[];g.turn++;g.enemyAct(e);assert.equal(g.player.hp,hp,'walk-in: no damage');assert.ok(!g.effects.some(f=>f.type==='enemyShot'),'walk-in: no shot');
});

test('it never replaces the start-room scout or a rebel hero card that is always elite (3.214.0 review)',()=>{
 for(let seed=1;seed<=40;seed++){
  const heroes={enemies:['raider_elite','gunner_elite','raider_elite'].map((type,i)=>makeEnemy(type,i+1,3,`h${i}`,6,hard,'rebel'))};
  heavySpecial(heroes,seed,6,hard,'rebel');assert.ok(heroes.enemies.every(e=>e.type!=='heavy_flamer'),'heroes stay');
  const scout={enemies:[makeEnemy('rifleman',2,3,'6-scout',6,hard,'loyalist'),makeEnemy('sniper',3,3,'s',6,hard,'loyalist')]};
  heavySpecial(scout,seed,6,hard,'loyalist');assert.ok(scout.enemies.every(e=>e.type!=='heavy_flamer'),'the scout stays');
 }
});
