import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,generate,giveEnemyAffix,rollEnemyAffixes,rollEnemyElite,ENEMY_TYPES} from '../src/engine.js';
import {WEAPONS,SAVE_VERSION,floorInfo} from '../src/data.js';
import {FIRE_TUNING,FLAMETHROWER,fireOdds,fireDie,tickFires,ignite,flameCells,sprayFlame,flamerTank,validFires,fireRow,burningAt,burnUnits} from '../src/fire.js';
import {t} from '../src/i18n.js';
import {enemyDisplayName} from '../src/enemy-affixes.js';
import {AFFIX_TUNING,ENEMY_AFFIXES,flamerChance,isFlamer,enemyArmor,birthRandom} from '../src/enemy-affixes.js';
import {hazardTile,HAZARD_TUNING} from '../src/hazard-paths.js';
import {hazeShot} from '../src/vents.js';
import {lightAt,LIGHT,LIGHT_MODEL} from '../src/lighting.js';
import {AMMUNITION,ammoInfo} from '../src/ammunition.js';
import {rollAffix,affixAllowed} from '../src/weapons.js';
import {CHARACTERS} from '../src/characters.js';
import {CRATE_FLAMER,UNKNOWN_LOOT} from '../src/learning-data.js';
import {archiveFloor} from '../src/retreat.js';
import {mountableSlots} from '../src/workshop.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {liveFlameIntent,dropStaleFlameIntents} from '../src/fire.js';
import {stepOffHazard} from '../src/hazard-paths.js';
import {interruptEnemyIntent} from '../src/enemy-intents.js';
import {applyDisruption} from '../src/throwables.js';
import {giveOrder} from '../src/orders.js';
import {execute} from '../src/rebels.js';
import {makeReady,suppressFrom} from '../src/squad.js';
import {VOID} from '../src/data.js';

// 3.203.0 (user design 2026-09-29, docs/HAZARDS.md sections 2 and 4): burning floor, the flamethrower and the 火焰兵.
// An open lit floor (the affix arena, which a save round-trips) without the generated floor's lamps and vents.
function field(){
  const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];
  g.player.hp=g.player.maxHp=999;g.player.plates=0;g.reveal();
  return g;
}
const foe=(g,type,x,y,id,affixes=[])=>{const e=makeEnemy(type,x,y,id,1,0,'loyalist');for(const a of affixes)giveEnemyAffix(e,a);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
const fixed=g=>{g.rng=Object.assign(()=>0,{state:()=>1});};

test('the odds: out 40 / burns on 40 / spreads 20; each burning neighbour moves 10 from out to burns on, out never under 10',()=>{
  assert.deepEqual(fireOdds(0),{out:.4,persist:.4,spread:.2});
  const one=fireOdds(1);assert.ok(Math.abs(one.out-.3)<1e-9&&Math.abs(one.persist-.5)<1e-9&&one.spread===.2);
  const three=fireOdds(3);assert.ok(Math.abs(three.out-.1)<1e-9&&Math.abs(three.persist-.7)<1e-9);
  assert.deepEqual(fireOdds(4),fireOdds(3),'out stops at 10%');
  // A lone tile over many rounds: the three outcomes land near their shares.
  const g=field(),counts={out:0,persist:0,spread:0};
  for(let turn=1;turn<=4000;turn++){g.turn=turn;g.fires=[{x:10,y:12,age:1}];tickFires(g);const n=g.fires?.length||0;counts[n===0?'out':n===1?'persist':'spread']++;}
  assert.ok(Math.abs(counts.out/4000-.4)<.03&&Math.abs(counts.persist/4000-.4)<.03&&Math.abs(counts.spread/4000-.2)<.03,JSON.stringify(counts));
});

test('dice come from the seed, the floor, the round and the tile, never the combat RNG; the same fire burns the same way',()=>{
  const a=field(),b=field(),state=a.rng.state();
  const start=[{x:5,y:5,age:1},{x:6,y:5,age:2},{x:5,y:6,age:1},{x:12,y:12,age:3}];
  a.fires=structuredClone(start);b.fires=structuredClone(start);
  for(let i=0;i<6;i++){a.turn++;b.turn++;tickFires(a);tickFires(b);assert.deepEqual(a.fires,b.fires);}
  assert.equal(a.rng.state(),state,'no combat roll was spent');
  assert.equal(fireDie(a,{x:3,y:4},'fire-v1'),fireDie({...a},{x:3,y:4},'fire-v1'));
  const other=field();other.seed++;other.fires=structuredClone(start);other.turn=a.turn-6;
  let differs=false;for(let i=0;i<6;i++){other.turn++;tickFires(other);}differs=JSON.stringify(other.fires)!==JSON.stringify(a.fires);
  assert.ok(differs,'another run rolls other dice');
});

test('five rounds at most, thirty tiles a floor at most, and a spread only onto floor that is not burning',()=>{
  const g=field();g.fires=[{x:8,y:8,age:FIRE_TUNING.maxAge}];g.turn=7;tickFires(g);
  assert.equal(g.fires,undefined,'a tile that has burned five rounds goes out whatever it rolls');
  const lit=ignite(g,Array.from({length:40},(_,i)=>({x:i%10+2,y:Math.floor(i/10)+2})));
  assert.equal(lit,30);assert.equal(g.fires.length,FIRE_TUNING.maxTiles);
  for(let i=0;i<20;i++){g.turn++;tickFires(g);assert.ok((g.fires?.length||0)<=FIRE_TUNING.maxTiles);}
  // One free neighbour: a wall above, the fixed fire to the right, a crate below; the left is bare floor.
  const h=field();h.grid[4][5]=0;h.hazards=[{x:6,y:5,type:'fire'}];h.props=[{id:'crate-1',type:'cover',x:5,y:6,hp:40,maxHp:40}];
  let spreads=0;
  for(let turn=1;turn<=600;turn++){h.turn=turn;h.fires=[{x:5,y:5,age:1}];tickFires(h);
    for(const f of h.fires||[]){if(f.x===5&&f.y===5)continue;spreads++;assert.deepEqual([f.x,f.y],[4,5],'only onto the free floor tile');}}
  assert.ok(spreads>60,`spreads ${spreads}`);
  // A closed door on that side as well: nowhere left to go.
  h.barriers=[{id:'edge-door',type:'door',axis:'x',x:4.5,y:5,hp:60,maxHp:60,open:false}];
  for(let turn=1;turn<=300;turn++){h.turn=turn;h.fires=[{x:5,y:5,age:1}];tickFires(h);assert.ok((h.fires||[]).every(f=>f.x===5&&f.y===5),'a closed door stops it');}
  // Surrounded by fire: nowhere to spread, it only burns on.
  const k=field();for(let turn=1;turn<=200;turn++){k.turn=turn;k.fires=[{x:5,y:5,age:1},{x:4,y:5,age:1},{x:6,y:5,age:1},{x:5,y:4,age:1},{x:5,y:6,age:1}];tickFires(k);
    const born=(k.fires||[]).filter(f=>f.age===1);for(const f of born)assert.ok(!(f.x===5&&f.y===5)&&[[4,5],[6,5],[5,4],[5,6]].every(([x,y])=>x!==f.x||y!==f.y),'never onto a tile that was burning');}
});

test('whoever ends the round on it takes 10 (your hazmat counts), both sides; flyers are above it',()=>{
  const g=field(),e=foe(g,'rifleman',11,10,'r'),d=foe(g,'drone',10,11,'d'),idle=foe(g,'rifleman',9,10,'i');e.alert=true;
  g.fires=[{x:10,y:10,age:1},{x:11,y:10,age:1},{x:10,y:11,age:1},{x:9,y:10,age:1}];
  g.player.hazmat=3;const hp=g.player.hp,ehp=e.hp,dhp=d.hp,ihp=idle.hp;g.environmentTurn();
  assert.equal(hp-g.player.hp,FIRE_TUNING.damage-3);assert.equal(ehp-e.hp,FIRE_TUNING.damage);assert.equal(d.hp,dhp,'a drone flies over it');
  assert.ok(!(idle.x===9&&idle.y===10)&&idle.hp===ihp,'an idle guard steps off it first');
  assert.ok(g.logs.some(l=>/火/.test(l.text)));
});

test('every walker routes around it: a hazard at the usual step cost, and nobody stands in it by choice',()=>{
  const g=field(),e=foe(g,'rifleman',4,10,'w');e.alert=true;Object.assign(g.player,{x:20,y:20});
  assert.equal(hazardTile(g,6,10,e),false);
  // A wall down the arena with two gaps, at y=10 and y=13; a burning tile in the first.
  for(let y=0;y<SIZE;y++)if(y!==10&&y!==13)g.grid[y][6]=0;g.fires=[{x:6,y:10,age:1}];
  assert.ok(hazardTile(g,6,10,e)&&hazardTile(g,6,10,g.player)&&hazardTile(g,6,10,{kind:'pet'}),'for both sides');
  const walk=()=>{const path=[];const at={x:e.x,y:e.y};for(let i=0;i<20&&!(e.x===8&&e.y===10);i++){const s=g.nextStep(e,{x:8,y:10});if(!s)break;e.x=s.x;e.y=s.y;path.push(`${s.x},${s.y}`);}Object.assign(e,at);return path;};
  const around=walk();assert.ok(around.includes('8,10')&&!around.includes('6,10')&&around.includes('6,13'),`around: ${around}`);
  g.fires=undefined;const through=walk();assert.ok(through.includes('6,10')&&through.length===4,`through: ${through}`);
  assert.equal(HAZARD_TUNING.stepCost,40);
});

test('it smokes like light smoke: shots through it hit half as often at full damage and sight is not blocked; the fixed fire does neither',()=>{
  const g=field(),e=foe(g,'rifleman',15,10,'r');e.alert=true;g.reveal();
  const clear=g.accuracy(g.player,e).chance;
  g.fires=[{x:12,y:10,age:2}];
  assert.ok(g.sight(g.player,e),'sight passes');
  const hazed=g.accuracy(g.player,e);assert.ok(hazed.haze);assert.equal(hazed.chance,Math.max(1,Math.round(clear/2)));
  assert.ok(hazeShot(g,e,g.player,{ranged:true}),'the enemy shooting back is slowed too');
  g.fires=undefined;g.hazards=[{x:12,y:10,type:'fire'}];assert.equal(g.accuracy(g.player,e).haze,false,'the fixed fire does not smoke');
});

test('fire lights the dark: burning tiles and the fixed fire of floors 5-6 glow; the fixed fire never spreads',()=>{
  const g=field();g.lighting=g.grid.map(r=>r.map(()=>0));g.lightModel=LIGHT_MODEL;g.lamps=[];g.player.flashlight=false;
  assert.equal(lightAt(g,{x:4,y:4}),LIGHT.black);
  g.hazards=[{x:4,y:4,type:'fire'}];assert.equal(lightAt(g,{x:4,y:4}),LIGHT.lit);assert.equal(lightAt(g,{x:5,y:4}),LIGHT.lit);assert.equal(lightAt(g,{x:6,y:4}),LIGHT.dim);assert.equal(lightAt(g,{x:7,y:4}),LIGHT.black);
  g.hazards=[{x:4,y:4,type:'acid'}];assert.equal(lightAt(g,{x:4,y:4}),LIGHT.black,'acid does not glow');
  g.hazards=[];g.fires=[{x:15,y:15,age:1}];assert.equal(lightAt(g,{x:15,y:16}),LIGHT.lit,'a burning tile does');
  g.fires=undefined;g.hazards=[{x:4,y:4,type:'fire'}];
  for(let i=0;i<30;i++){g.action('wait');assert.equal(g.fires,undefined,'the fixed fire never starts a burning tile');}
  assert.equal(fireRow({age:1}),'ignite');assert.equal(fireRow({age:2}),'steady');assert.equal(fireRow({age:4}),'embers');assert.equal(fireRow({age:5}),'embers');
});

test('the flamethrower: range 5, a cone, every unit on a reached tile burns (friends too), the tiles catch, 8 sprays and no reload',()=>{
  const w=WEAPONS[FLAMETHROWER];
  assert.equal(FLAMETHROWER,18);assert.equal(w.id,'flamer');assert.equal(w.range,5);assert.equal(w.mag,8);assert.ok(w.tank&&w.flame&&w.pointTarget&&w.lootOnly);
  assert.equal(AMMUNITION[w.ammoType],undefined,'fuel has no reserve');assert.equal(ammoInfo(w.ammoType).key,null);
  for(let i=0;i<50;i++)assert.equal(rollAffix(FLAMETHROWER,`seed-${i}`),null,'always a plain one');
  assert.equal(affixAllowed(FLAMETHROWER,'extended'),false);
  const g=field(),near=foe(g,'rifleman',12,10,'n'),far=foe(g,'rifleman',16,10,'f'),side=foe(g,'rifleman',11,14,'s');
  const slot=g.addWeapon(FLAMETHROWER);g.player.weapon=slot;assert.equal(g.player.ammo[slot],8);assert.equal(g.player.affixes[slot],null);
  const cells=flameCells(g,g.player,{x:14,y:10});
  assert.ok(cells.every(q=>Math.abs(q.x-10)+Math.abs(q.y-10)<=5)&&cells.length>=8&&cells.length<=11,`${cells.length} tiles`);
  assert.ok(g.action('launch',{x:14,y:10}));
  assert.ok(near.hp<500,'in the cone');assert.equal(far.hp,500,'six tiles away: out of reach');assert.equal(side.hp,500,'outside the cone');
  assert.deepEqual(new Set(g.fires.map(f=>`${f.x},${f.y}`)),new Set(cells.map(q=>`${q.x},${q.y}`)),'every reached tile catches');
  assert.ok(g.fires.every(f=>f.age===1));
  assert.equal(g.player.ammo[slot],7);
  assert.equal(g.action('reload'),false,'no reload');assert.equal(g.player.ammo[slot],7);
  for(let i=0;i<7;i++)assert.ok(g.action('launch',{x:14,y:10}));
  assert.equal(g.player.ammo[slot],0);assert.equal(g.action('launch',{x:14,y:10}),false,'an empty tank is empty for good');assert.equal(g.emptyCue(),'no_ammo');
  const h=field(),s2=h.addWeapon(FLAMETHROWER);assert.equal(mountableSlots(h).includes(s2),false,'no workshop unit mounts it');
  const walls=field();walls.grid[10][12]=0;assert.ok(!flameCells(walls,walls.player,{x:14,y:10}).some(q=>q.x>12&&q.y===10),'a wall stops it');
});

test('a flamer: armoured, marks its cone for a round, sprays it the next wherever the target went, and never fires a gun',()=>{
  const g=field(),e=foe(g,'rifleman',13,10,'fl',['flamer']);e.alert=true;fixed(g);g.reveal();
  assert.ok(isFlamer(e));assert.equal(enemyArmor(e),AFFIX_TUNING.flamerArmor);assert.equal(enemyArmor(makeEnemy('rifleman',1,1,'plain')),0);
  const hp=g.player.hp;g.enemyAct(e);
  assert.deepEqual(e.flameIntent,{origin:{x:13,y:10},aim:{x:10,y:10}});assert.ok(e.affixes.find(a=>a.id==='flamer').revealed,'it shows itself');
  assert.equal(g.player.hp,hp,'the marking round does no harm');assert.equal(g.fires,undefined);
  const marked=flameCells(g,e,{x:10,y:10});
  // Step out of the cone: the spray goes where it was marked and misses you.
  Object.assign(g.player,{x:10,y:14});g.reveal();g.enemyAct(e);
  assert.equal(e.flameIntent,undefined);assert.equal(g.player.hp,hp,'out of the marked cone');
  assert.deepEqual(new Set(g.fires.map(f=>`${f.x},${f.y}`)),new Set(marked.map(q=>`${q.x},${q.y}`)),'the marked tiles burn');
  assert.ok(!g.effects.some(f=>f.type==='enemyShot'),'no gunshot, ever');
  // Stay in it: you burn.
  const h=field(),f2=foe(h,'rifleman',13,10,'fl2',['flamer']);f2.alert=true;fixed(h);h.reveal();const hp2=h.player.hp;h.enemyAct(f2);h.enemyAct(f2);
  assert.ok(h.player.hp<hp2,'standing in the cone');
  // Pulled away or stunned in between, the cone is dropped.
  const k=field(),f3=foe(k,'rifleman',13,10,'fl3',['flamer']);f3.alert=true;fixed(k);k.reveal();k.enemyAct(f3);f3.y=9;k.enemyAct(f3);assert.equal(k.fires,undefined,'moved: no spray from somewhere else');
  // Out of reach it walks closer rather than shoot.
  const m=field(),f4=foe(m,'rifleman',18,10,'fl4',['flamer']);f4.alert=true;fixed(m);m.reveal();const x=f4.x;m.enemyAct(f4);
  assert.ok(f4.x<x&&!f4.flameIntent&&!m.effects.some(f=>f.type==='enemyShot'));
});

test('who becomes a flamer: an armed soldier without its own behaviour, never with a gun affix, on its own stream from floor 3',()=>{
  const flamer=ENEMY_AFFIXES.find(d=>d.id==='flamer');assert.ok(flamer.special);
  for(const type of ['rifleman','raider','gunner','rifleman_armored'])assert.ok(flamer.applies(makeEnemy(type,1,1,'a')),type);
  for(const type of ['sniper','squad_leader','enforcer','crawler','drone','brute','rifleman_infected'])assert.equal(flamer.applies(makeEnemy(type,1,1,'a')),false,type);
  const withGun=makeEnemy('raider',1,1,'b');giveEnemyAffix(withGun,'grenadier');assert.equal(flamer.applies(withGun),false);
  assert.deepEqual([1,2,3,4,6,8,12].map(f=>flamerChance(f)),[0,0,.02,.04,.08,.12,.12]);
  for(let f=1;f<=6;f++)assert.equal(flamerChance(f,{curve:'easy',offset:0}),0,'easy: none in the six ordinary floors');
  let n=0;for(let seed=1;seed<=15;seed++)for(let f=3;f<=6;f++)for(const e of generate(seed,f).enemies)if(isFlamer(e)){n++;assert.ok(!e.affixes.some(a=>['suppressor','grenadier','deployer'].includes(a.id)));}
  assert.ok(n>10,`${n} flamers`);
  // An elite flamer's top-up never adds a gun affix.
  let elites=0;for(let seed=1;seed<=400;seed++){const e=rollEnemyElite(rollEnemyAffixes(makeEnemy('raider_elite',1,1,`t-${seed}`,20),seed,20),seed,20);if(isFlamer(e)){elites++;assert.ok(!e.affixes.some(a=>['suppressor','grenadier'].includes(a.id)));}}
  assert.ok(elites>0);
});

test('a fallen flamer: 30% its tank goes up (a blast, and the floor round it burns), otherwise it leaves its flamethrower',()=>{
  const bang=field(),ids=[...Array(400).keys()].map(i=>`fall-${i}`),blows=id=>birthRandom(bang.seed,bang.floor,id,'flamer-tank-v1')()<AFFIX_TUNING.flamerBlast;
  const share=ids.filter(blows).length/ids.length;assert.ok(Math.abs(share-.3)<.06,`${share}`);
  const a=foe(bang,'rifleman',14,10,ids.find(blows),['flamer']);const hp=bang.player.hp;bang.hurt(a,9999,bang.player);
  assert.ok(bang.effects.some(f=>f.type==='blast'));assert.ok(bang.fires?.length>=3,'the floor round it burns');
  assert.ok(!bang.items.some(i=>i.type==='weapon'&&i.weapon===FLAMETHROWER),'nothing left to pick up');assert.equal(bang.player.hp,hp,'four tiles off: clear of the blast');
  const drop=field(),b=foe(drop,'rifleman',14,10,ids.find(id=>!blows(id)),['flamer']);drop.hurt(b,9999,drop.player);
  const item=drop.items.find(i=>i.type==='weapon');assert.ok(item);assert.equal(item.weapon,FLAMETHROWER);assert.equal(drop.player.ammo[item.slot],8,'a full tank');
  assert.equal(drop.fires,undefined);assert.ok(!drop.items.some(i=>i.type==='weapon'&&i.weapon===0),'no rifle: it carried none');
});

test('where a flamethrower comes from: flamers and unidentified crates only',()=>{
  assert.equal(CRATE_FLAMER.weapon,FLAMETHROWER);assert.equal(UNKNOWN_LOOT.length,27,'the old list, and every other crate, stay as they were');
  let found=0,crates=0;for(let seed=1;seed<=30;seed++)for(let f=1;f<=6;f++){const map=generate(seed,f);
    for(const c of map.props.filter(p=>p.type==='container'&&p.kind==='unknown')){crates++;if(c.contents.some(i=>i.type==='weapon'&&i.weapon===FLAMETHROWER))found++;}
    assert.ok(!map.items.some(i=>i.type==='weapon'&&i.weapon===FLAMETHROWER),'not on the floor: no armory has one');
    assert.ok(!map.props.some(p=>p.type==='container'&&p.kind!=='unknown'&&p.contents?.some(i=>i.type==='weapon'&&i.weapon===FLAMETHROWER)));}
  assert.ok(found>0&&found/crates<.08,`${found} of ${crates}`);
  for(let f=1;f<=12;f++)assert.notEqual(floorInfo(f).weapon,FLAMETHROWER);
  for(const c of Object.values(CHARACTERS))assert.ok(!c.weapons.includes(FLAMETHROWER),'no starting kit');
  for(const t of Object.values(ENEMY_TYPES))assert.notEqual(t.loot?.weapon,FLAMETHROWER);
});

test('saves: fires and a marked cone come back, bad ones are refused, and a save from 80 loads without either',()=>{
  const g=field(),e=foe(g,'rifleman',13,10,'fl',['flamer']);e.alert=true;fixed(g);g.reveal();g.enemyAct(e);
  g.fires=[{x:3,y:3,age:2},{x:4,y:3,age:5}];
  const back=Game.restore(g.serialize());assert.ok(back);assert.deepEqual(back.fires,g.fires);assert.deepEqual(back.enemies[0].flameIntent,e.flameIntent);
  for(const bad of [[{x:3,y:3,age:6}],[{x:3,y:3,age:0}],[{x:3,y:3}],[{x:3,y:3,age:1},{x:3,y:3,age:2}],[{x:3,y:3,age:1,extra:1}],Array.from({length:31},(_,i)=>({x:i%20,y:Math.floor(i/20),age:1}))]){
    const raw=JSON.parse(g.serialize());raw.data.fires=bad;assert.equal(Game.restore(JSON.stringify(raw)),null,JSON.stringify(bad).slice(0,60));}
  const wall=JSON.parse(g.serialize());wall.data.grid[3][3]=0;assert.equal(validFires({grid:wall.data.grid,fires:[{x:3,y:3,age:1}]}),false,'not on a wall');
  for(const change of [d=>d.enemies[0].affixes[0].revealed=false,d=>d.enemies[0].flameIntent.extra=1,d=>d.enemies[0].flameIntent.aim={x:-1,y:3}]){
    const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
  // 3.203.0 review: a cone whose flamer was moved or stunned outside its turn is dropped on load, not the whole save.
  for(const change of [d=>d.enemies[0].flameIntent.origin={x:1,y:1},d=>d.enemies[0].control.disabled=2]){
    const raw=JSON.parse(g.serialize());change(raw.data);const back=Game.restore(JSON.stringify(raw));assert.ok(back);assert.equal(back.enemies[0].flameIntent,undefined);}
  assert.equal(SAVE_VERSION,92);
  const plain=field();const old=JSON.parse(plain.serialize());old.version=80;const loaded=Game.restore(JSON.stringify(old));
  assert.ok(loaded,'a save from 3.202.0 loads');assert.equal(loaded.fires,undefined);
});

test('a round trip: a floor left without fire and a floor left burning both come back from a save',()=>{
  const g=new Game(331,[],0,'soldier','onyx','roundtrip');g.fires=undefined;
  Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  const spot=[...Array(SIZE*SIZE).keys()].map(i=>({x:i%SIZE,y:Math.floor(i/SIZE)})).find(p=>g.grid[p.y][p.x]===1&&g.floorStates[1].grid[p.y]?.[p.x]!==1);
  assert.ok(spot,'a tile that is floor here and wall on the floor above');
  g.fires=[{x:spot.x,y:spot.y,age:1}];
  const back=Game.restore(g.serialize());
  assert.ok(back,'the archived floor does not take this floor\'s fire when the save is checked');
  assert.deepEqual(back.fires,g.fires);assert.equal(back.floorStates[1].fires,undefined);
  // Left burning: the fire waits on the kept floor.
  const h=new Game(331,[],0,'soldier','onyx','roundtrip'),tile=[...Array(SIZE*SIZE).keys()].map(i=>({x:i%SIZE,y:Math.floor(i/SIZE)})).find(p=>h.grid[p.y][p.x]===1&&!h.solid(p.x,p.y));
  h.fires=[{x:tile.x,y:tile.y,age:3}];assert.deepEqual(archiveFloor(h).fires,h.fires);
  Object.assign(h.player,h.exitPoint);assert.ok(h.descend());assert.equal(h.fires,undefined,'the next floor starts without fire');
  const again=Game.restore(h.serialize());assert.ok(again);assert.deepEqual(again.floorStates[1].fires,[{x:tile.x,y:tile.y,age:3}]);
});

// ---- 3.203.0 independent review: each finding's repro (qa/results/2026-09-29-claude-3.203.0-fire.md) ------------------
test('review 1: a marked cone goes off before any order moves the flamer, and a save with it always loads',()=>{
  // A flank order (loyalist) and a retreat order (rebel, hurt) used to walk the flamer off its mark: the save was refused.
  const g=field();g.props.push({id:'crate-a',type:'cover',x:12,y:12,hp:80,maxHp:80});
  const e=foe(g,'rifleman',15,11,'fl',['flamer']);e.alert=true;foe(g,'rifleman',11,17,'bud').alert=true;
  Object.assign(g.player,{x:11,y:11});g.reveal();
  assert.ok(g.action('wait'));assert.ok(e.flameIntent);
  assert.ok(g.action('move',[0,1]));
  assert.deepEqual([e.x,e.y],[15,11],'it sprayed from its mark');assert.equal(e.flameIntent,undefined);assert.ok(g.fires?.length>0);
  assert.ok(Game.restore(g.serialize()),'the save loads');
  const h=field();for(let y=11;y<=20;y++)h.grid[y][12]=0;h.props.push({id:'crate-a',type:'cover',x:16,y:13,hp:80,maxHp:80});
  const r=makeEnemy('rifleman',15,10,'fl',1,0,'rebel');giveEnemyAffix(r,'flamer');r.maxHp=300;r.hp=120;r.alert=true;h.enemies.push(r);
  Object.assign(h.player,{x:11,y:10});h.reveal();
  assert.ok(h.action('wait'));assert.ok(r.flameIntent);assert.ok(h.action('move',[0,1]));
  assert.deepEqual([r.x,r.y],[15,10]);assert.ok(Game.restore(h.serialize()));
  // Moved by anything else: the stale mark is not drawn, and a save drops it instead of refusing the run.
  const k=field(),m=foe(k,'rifleman',13,10,'m',['flamer']);m.alert=true;fixed(k);k.reveal();k.enemyAct(m);assert.ok(liveFlameIntent(m));
  m.y=12;assert.equal(liveFlameIntent(m),false);
  const back=Game.restore(k.serialize());assert.ok(back);assert.equal(back.enemies.find(x=>x.id==='m').flameIntent,undefined);
  m.y=10;const raw=JSON.parse(k.serialize());raw.data.enemies.find(x=>x.id==='m').flameIntent.extra=1;
  assert.equal(Game.restore(JSON.stringify(raw)),null,'a malformed one is still refused');
  const frame={enemies:[{...structuredClone(m),y:11}],floorStates:{}};dropStaleFlameIntents(frame);assert.equal(frame.enemies[0].flameIntent,undefined);
});

test('review 2: a flamer never shoots a decoy or a mine; a marked cone keeps anyone from shooting mines',()=>{
  const g=field();fixed(g);const e=foe(g,'rifleman',20,10,'fl',['flamer']);e.alert=true;g.player.decoys=1;
  assert.ok(g.action('decoy',{x:14,y:10}));g.effects=[];const hp=g.decoy.hp;g.enemyAct(e);
  assert.equal(g.effects.filter(f=>f.type==='enemyShot').length,0);assert.equal(g.decoy.hp,hp);
  const h=field();fixed(h);const f=foe(h,'rifleman',18,10,'fl2',['flamer']);f.alert=true;h.player.mines=1;
  assert.ok(h.action('mine',{x:13,y:10}));Object.assign(h.player,{x:3,y:20});h.reveal();h.effects=[];h.enemyAct(f);
  assert.equal(h.effects.filter(x=>x.type==='enemyShot').length,0);assert.equal(h.mines.length,1,'the mine is still there');
  const k=field();fixed(k);const r=foe(k,'rifleman',18,10,'plain');k.mines=[{id:'mine-1-1',x:13,y:10,seen:['plain']}];k.mineSerial=1;
  r.alert=true;Object.assign(k.player,{x:3,y:20});k.reveal();r.flameIntent={origin:{x:18,y:10},aim:{x:3,y:20}};k.effects=[];k.enemyAct(r);
  assert.equal(k.mines.length,1,'a telegraphed attack under way is not dropped to shoot a mine');
});

test('review 3: a flamer holds no aim, so a watch order, a squad or an enforcer rally never gets its gun to fire',()=>{
  const g=field();fixed(g);for(let y=0;y<SIZE;y++)if(y!==10)g.grid[y][12]=0;
  const e=makeEnemy('rifleman',15,12,'fl',1,0,'rebel');giveEnemyAffix(e,'flamer');e.hp=e.maxHp=300;e.alert=true;g.enemies.push(e);
  Object.assign(g.player,{x:9,y:14});e.lastKnown={x:9,y:14};g.reveal();
  giveOrder(g,e,{kind:'hold',by:'self',at:{x:15,y:12},watch:{x:12,y:10},from:{x:9,y:14},patience:6,breakOn:['hit','passed']});
  g.enemyAct(e);assert.equal(e.charge,false,'watching, but holding no aim');
  Object.assign(g.player,{x:12,y:10});g.reveal();g.enemyAct(e);assert.ok(e.flameIntent);g.enemyAct(e);
  assert.equal(e.charge,false);assert.equal(e.aim,null);
  const enf=makeEnemy('enforcer',17,14,'enf',1,0,'rebel');enf.alert=true;g.enemies.push(enf);
  const victim=makeEnemy('rifleman',18,14,'v',1,0,'rebel');g.enemies.push(victim);
  e.charge=true;e.aim={x:12,y:10};g.effects=[];const hp=g.player.hp;execute(g,enf,victim);
  assert.equal(g.effects.filter(f=>f.type==='enemyShot'&&f.from.x===e.x&&f.from.y===e.y).length,0,'the rally fires no gun of its');assert.equal(g.player.hp,hp);
  // A burning tile under it: with no aim held it steps off like anyone else.
  e.charge=false;e.aim=null;ignite(g,[{x:e.x,y:e.y}]);const at=`${e.x},${e.y}`;Object.assign(g.player,{x:9,y:14});g.reveal();g.enemyAct(e);
  assert.notEqual(`${e.x},${e.y}`,at,'off the fire');
  // Squads: no held aim and no covering fire for a flamer.
  const s=field(),leader=foe(s,'squad_leader',15,15,'lead'),plain=foe(s,'rifleman',16,15,'m1'),fl=foe(s,'rifleman',17,15,'m2',['flamer']);
  makeReady(s,leader,[plain,fl]);assert.equal(plain.charge,true);assert.equal(fl.charge,false);
  assert.equal(suppressFrom(s,fl,s.player,leader),false);
});

test('review 4 and 6: no spray at your own tile, the log says what burned, and an empty tank says so',()=>{
  const g=field(),slot=g.addWeapon(FLAMETHROWER);g.player.weapon=slot;
  assert.equal(g.action('launch',{x:g.player.x,y:g.player.y}),false,'a spray needs a direction');assert.equal(g.player.ammo[slot],8);assert.equal(g.fires,undefined);
  // Nothing can catch (the floor is at its 30): the log does not claim the floor is burning.
  ignite(g,Array.from({length:30},(_,i)=>({x:i%10+2,y:Math.floor(i/10)+20})));
  assert.ok(g.action('launch',{x:14,y:10}));assert.equal(g.logs[0].text,'火焰沒有燒到任何東西。');
  // A spray over a pit burns whoever stands in it, but only floor catches.
  const h=field(),u=foe(h,'rifleman',12,10,'u'),s2=h.addWeapon(FLAMETHROWER);h.player.weapon=s2;
  for(let y=6;y<=14;y++)for(let x=11;x<=15;x++)h.grid[y][x]=VOID;h.grid[10][12]=1;h.grid[10][14]=1;
  h.fires=Array.from({length:30},(_,i)=>({x:i%10+2,y:Math.floor(i/10)+20,age:1}));
  assert.ok(h.action('launch',{x:14,y:10}));assert.ok(u.hp<500);assert.equal(h.logs.find(l=>/火焰噴中/.test(l.text)).text,'火焰噴中 1 個單位。');
  const k=field(),s3=k.addWeapon(FLAMETHROWER);k.player.weapon=s3;k.player.ammo[s3]=0;k.refusal=undefined;
  assert.equal(k.action('launch',{x:13,y:10}),false);assert.equal(k.refusal?.cue,'no_ammo');
});

test('review 7: interruptions clear a marked cone, it is a committed move, and a fresh pack has no flamethrower slot',()=>{
  const g=field(),e=foe(g,'rifleman',13,10,'fl',['flamer']);e.alert=true;fixed(g);g.reveal();g.enemyAct(e);assert.ok(e.flameIntent);
  interruptEnemyIntent(e,'displaced');assert.equal(e.flameIntent,undefined);
  g.enemyAct(e);assert.ok(e.flameIntent);applyDisruption(e,'biological');assert.equal(e.flameIntent,undefined,'stunned: dropped');
  const h=field(),f=foe(h,'rifleman',13,10,'fl2',['flamer']);f.alert=true;f.affixes[0].revealed=true;f.flameIntent={origin:{x:13,y:10},aim:{x:10,y:10}};
  h.fires=[{x:13,y:10,age:1}];assert.equal(stepOffHazard(h,f,{x:10,y:10}),false,'a marked cone is a committed move');
  delete f.flameIntent;assert.equal(stepOffHazard(h,f,{x:10,y:10}),true);
  for(const seed of [3,7,11]){const p=new Game(seed).player;
    assert.deepEqual(p.weaponBases.slice(0,18),[...Array(18).keys()],'slot = weapon for the catalog');
    assert.equal(p.weaponBases.indexOf(FLAMETHROWER),-1,'no slot for weapons added after the catalog');
    assert.equal(p.ammo.length,p.weaponBases.length);}
});

test('a pre-existing slip fixed in 3.203.0: plates up to the rack perk cap load; more are cut to it (3.210.0)',()=>{
  const g=new Game(5,[],0,'soldier','onyx');g.player.perks.plate_rack=1;g.player.plates=g.plateCapacity-5;
  assert.ok(g.player.plates>30);assert.ok(Game.restore(g.serialize()),'plates over the bare class cap, under the rack cap');
  // 3.210.0: the cap is a tuning number (docs/CHECKLIST.md section 3), so plates over it are cut to it on load, not refused.
  g.player.plates=g.plateCapacity+1;const cut=Game.restore(g.serialize());assert.ok(cut,'over the cap still loads');assert.equal(cut.player.plates,g.plateCapacity,'cut to the cap');
  g.player.plates=-1;assert.equal(Game.restore(g.serialize()),null,'a negative count is broken data');
});

// 3.213.0 (docs/CHECKLIST.md 2, 打到自己人): an enemy flamer's spray that kills another enemy is not your kill — no kill
// count, xp or scrap — and the log says who did it; your own spray still pays you.
test('an enemy flamer burning one of its own is not your kill',()=>{
 const g=affixArena();clearGeneratedMap(g);g.fires=undefined;Object.assign(g.player,{x:3,y:3});
 const f=makeEnemy('rifleman',12,10,'fl',6,{curve:'hard',offset:0},'loyalist');giveEnemyAffix(f,'flamer');f.alert=true;
 const v=makeEnemy('rifleman',10,10,'victim',6,{curve:'hard',offset:0},'loyalist');v.hp=1;g.enemies.push(f,v);g.reveal();
 const p=g.player,before={kills:p.kills,xp:p.xp,scrap:p.scrap,damage:p.stats.damage};
 burnUnits(g,f,[{x:10,y:10}],()=>20);
 assert.ok(v.hp<=0,'burned down');
 assert.deepEqual({kills:p.kills,xp:p.xp,scrap:p.scrap,damage:p.stats.damage},before,'nothing of it is yours');
 const said=new Set(Array.from({length:40},(_,n)=>t('swarmBosses.hitOwn',{enemy:enemyDisplayName(f),target:enemyDisplayName(v),damage:n+1})));
 assert.ok(g.logs.some(l=>said.has(l.text)),'the log names the flamer');
 const w=makeEnemy('rifleman',10,11,'mine',6,{curve:'hard',offset:0},'loyalist');w.hp=1;g.enemies.push(w);const k=p.kills;
 burnUnits(g,p,[{x:10,y:11}],()=>20);assert.equal(p.kills,k+1,'your own spray is your kill');
});

test('an execution by the enforcer is not your hit either: not in your damage, not logged as yours',()=>{
 const g=affixArena();clearGeneratedMap(g);Object.assign(g.player,{x:3,y:3});
 const boss=makeEnemy('enforcer',12,10,'enf',6,{curve:'hard',offset:0},'rebel'),v=makeEnemy('rifleman',10,10,'shot',6,{curve:'hard',offset:0},'rebel');g.enemies.push(boss,v);g.reveal();
 const p=g.player,before={kills:p.kills,xp:p.xp,scrap:p.scrap,damage:p.stats.damage};
 execute(g,boss,v);assert.ok(v.hp<=0);
 assert.deepEqual({kills:p.kills,xp:p.xp,scrap:p.scrap,damage:p.stats.damage},before);
 const yours=new Set(Array.from({length:300},(_,n)=>t('game.hit',{target:enemyDisplayName(v),damage:n})));
 assert.ok(!g.logs.some(l=>yours.has(l.text)),'no line reads as your hit');assert.ok(g.logs.some(l=>l.text===t('swarmBosses.hitOwn',{enemy:enemyDisplayName(boss),target:enemyDisplayName(v),damage:22})||l.text.startsWith(enemyDisplayName(boss))),'the enforcer did it');
});
