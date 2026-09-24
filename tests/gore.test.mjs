import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GORE_PALETTES,GORE_SETTINGS,GORE_TUNING,goreKind,goreLevel,validGoreSetting,makeBurst,enemyBurst,burstLife,heavyBody,goreForce,goreForceScale} from '../src/gore.js';
import {killingBlow,ENEMY_BLOWS,kiaBurst} from '../src/kia.js';
import {planPresentation} from '../src/presentation.js';

// 3.175.0 (user request, docs/KILL_GORE.md): the killed-in-action burst, lighter, on every kill; colours by what the
// body is made of; a setting (full by default, simple under reduced motion, off).
test('bodies bleed by what they are made of: people red, the swarm yellow-green, machines oil and sparks',()=>{
 assert.equal(goreKind({type:'rifleman',faction:'loyalist'}),'flesh');
 assert.equal(goreKind({type:'crawler',faction:'rebel'}),'flesh');
 assert.equal(goreKind({type:'rifleman_infected',faction:'swarm'}),'swarm');
 assert.equal(goreKind({type:'giant_bug',faction:'swarm'}),'swarm');
 assert.equal(goreKind({type:'drone',faction:'loyalist'}),'mech','the drone is mechanical in its data');
 assert.equal(goreKind({type:'rifleman',faction:'rebel',traits:[{id:'mechanical'}]}),'mech');
 assert.deepEqual(Object.keys(GORE_PALETTES),['flesh','swarm','mech']);
 const oil=makeBurst(3,{dx:1,dy:0},{kind:'mech'}),flesh=makeBurst(3,{dx:1,dy:0},{kind:'flesh'});
 assert.ok(oil.drops.every(d=>GORE_PALETTES.mech.drops.includes(d.color)));
 assert.ok(oil.drops.length<flesh.drops.length&&oil.sparks.length>flesh.sparks.length,'machines spill less and spark more');
 assert.deepEqual(oil.mistColor,GORE_PALETTES.mech.mist);
});

test('the setting: full by default, simple under reduced motion, off; enemies get the light version',()=>{
 assert.deepEqual(GORE_SETTINGS,['full','simple','off']);
 assert.equal(goreLevel(undefined),'full');
 assert.equal(goreLevel('nonsense'),'full');
 assert.equal(goreLevel('full',true),'simple','reduced motion keeps it at simple');
 assert.equal(goreLevel('off',true),'off');
 assert.ok(validGoreSetting('simple')&&!validGoreSetting('max'));
 const blow={dx:0,dy:1},scene=kiaBurst(5,blow),full=enemyBurst(5,blow),simple=enemyBurst(5,blow,{level:'simple'}),heavy=enemyBurst(5,blow,{heavy:true});
 assert.equal(enemyBurst(5,blow,{level:'off'}),null);
 assert.equal(enemyBurst(5,null),null,'no direction, no burst');
 const mean=list=>list.reduce((a,b)=>a+b,0)/list.length,seeds=[...Array(60).keys()].map(i=>i+1);
 const fullDrops=seeds.map(s=>enemyBurst(s,blow).drops.length),heavyDrops=seeds.map(s=>enemyBurst(s,blow,{heavy:true}).drops.length);
 assert.ok(Math.abs(mean(fullDrops)-46*GORE_TUNING.enemy.blood)<3,'on average half the flesh of the operative\'s death');
 assert.ok(mean(heavyDrops)>mean(fullDrops)&&mean(heavyDrops)<scene.drops.length,'elites and bosses are nearly full');
 assert.ok(full.drops.length<heavy.drops.length,'the same draw, heavier body');
 assert.equal(simple.light,0);assert.equal(simple.sparks.length,0,'simple: no light, no sparks');
 assert.equal(simple.drops.length,full.drops.length,'but the same flesh');
 assert.ok(full.glow<1&&full.light<1);
 assert.ok(burstLife(full)>=.32&&burstLife(full)<=1.5,'in the air for about a second, then only stains');
 assert.ok(heavyBody({type:'rifleman',elite:true}));
 assert.ok(!heavyBody({type:'rifleman'}));
});

// 3.175.1 (user request): no two bursts alike; the kind of round and how hard it hit shape the spray.
test('every burst draws its own amount, spread and reach, shaped by the kind of round and the harm',()=>{
 const blow={dx:1,dy:0},mean=list=>list.reduce((a,b)=>a+b,0)/list.length,seeds=[...Array(60).keys()].map(i=>i+1);
 const spread=b=>mean(b.drops.map(d=>Math.abs(d.a-b.away))),reach=b=>mean(b.drops.map(d=>d.D));
 const bursts=seeds.map(s=>enemyBurst(s,blow));
 assert.ok(new Set(bursts.map(b=>b.drops.length)).size>=6,'the amount varies');
 assert.ok(Math.max(...bursts.map(spread))>Math.min(...bursts.map(spread))*1.25,'the spread varies');
 assert.ok(Math.max(...bursts.map(reach))>Math.min(...bursts.map(reach))*1.2,'the reach varies');
 assert.ok(new Set(bursts.map(b=>b.away.toFixed(3))).size>=50,'each is aimed a little differently');
 const by=style=>seeds.map(s=>enemyBurst(s,blow,{style}));
 const avg=(style,f)=>mean(by(style).map(f));
 assert.ok(avg('pellet',spread)>avg('bullet',spread)&&avg('bullet',spread)>avg('precision',spread),'shotgun wide, sniper narrow');
 assert.ok(avg('blast',spread)>avg('pellet',spread),'a blast throws widest');
 assert.ok(avg('melee',reach)<avg('bullet',reach)&&avg('precision',reach)>avg('bullet',reach),'blades close, the sniper far');
 assert.ok(avg('plasma',b=>b.drops.length)<avg('bullet',b=>b.drops.length)&&avg('plasma',b=>b.glow)>avg('bullet',b=>b.glow),'plasma burns: less liquid, more light');
 assert.ok(avg('melee',b=>b.glow)<avg('bullet',b=>b.glow)*.5,'little light from a blade');
 const hard=enemyBurst(9,blow,{damage:60}),soft=enemyBurst(9,blow,{damage:8});
 assert.ok(hard.drops.length>soft.drops.length&&reach(hard)>reach(soft),'the harder the blow, the more and the farther');
 const at={x:5,y:5},hit=(weaponId,extra={})=>goreForce([{type:'shot',weaponId,from:{x:1,y:5},to:at,damage:0,...extra},{type:'impact',from:at,to:at,damage:30}],at);
 assert.deepEqual(hit('rifle'),{style:'bullet',damage:30});
 assert.equal(hit('shotgun').style,'pellet');
 assert.equal(hit('sniper').style,'precision');
 assert.equal(hit('plasma',{style:'plasma'}).style,'plasma');
 assert.equal(hit('katana',{style:'claw'}).style,'melee');
 assert.equal(hit('chainsaw').style,'melee');
 assert.equal(hit('launcher',{style:'grenade'}).style,'blast');
 assert.equal(goreForce([{type:'blast',from:{x:3,y:5},to:{x:3,y:5},damage:0,radius:2},{type:'impact',from:at,to:at,damage:40}],at).style,'blast');
 assert.equal(goreForceScale(24),1);assert.equal(goreForceScale(1000),1.6);assert.equal(goreForceScale(1),.7);
});

test('an enemy\'s fall carries the killing blow and its body kind; a kill with no direction has none',()=>{
 const at={x:6,y:4};
 assert.deepEqual(killingBlow([{type:'shot',from:{x:2,y:4},to:at,damage:30}],at,ENEMY_BLOWS),{dx:1,dy:0},'the operative\'s shot');
 assert.equal(killingBlow([{type:'shot',from:{x:2,y:4},to:at,damage:30}],at),null,'the operative\'s own death only counts enemy shots');
 const player={x:2,y:4,hp:50,character:'soldier'};
 const state=hp=>({player,enemies:[{id:'1-1',type:'rifleman',faction:'rebel',x:6,y:4,hp}],allies:[],items:[],logs:[],visible:()=>true});
 const fallOf=effects=>planPresentation([{before:state(8),after:state(0),effects}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall'&&e.actorType==='rifleman');
 const shot=fallOf([{type:'shot',weaponId:'ar',from:{x:2,y:4},to:{x:6,y:4},damage:12}]);
 assert.deepEqual(shot.blow,{dx:1,dy:0});
 // As the game records the operative's shot: the flight carries no damage, the harm is an impact on the tile.
 assert.deepEqual(fallOf([{type:'shot',weaponId:'ar',style:'bullet',from:{x:2,y:4},to:{x:6,y:4},damage:0},{type:'impact',from:{x:6,y:4},to:{x:6,y:4},damage:25}]).blow,{dx:1,dy:0});
 assert.equal(fallOf([{type:'shot',weaponId:'ar',from:{x:2,y:4},to:{x:6,y:4},damage:0,miss:true}]).blow,null,'a miss is not the blow');
 assert.equal(shot.gore,'flesh');
 assert.equal(shot.heavy,false);
 assert.equal(fallOf([]).blow,null,'poison or fire: no burst');
});

test('drops land within a second of world time; the burst code ships offline and the setting stays on the device',()=>{
 const b=makeBurst(9,{dx:1,dy:0});
 const early=Math.min(...b.drops.map(d=>d.land)),late=Math.max(...b.drops.map(d=>d.land));
 assert.ok(early>0&&late<1);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const file of ['gore.js','gore-art.js','kia.js','kia-art.js'])assert.ok(sw.includes(`./src/${file}`),file);
 const settings=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.match(settings,/data-modal="gore"/,'the setting is on the settings page');
 assert.match(settings,/write\('ash-gore',goreChoice\)/,'kept on this device, not in the save');
});
