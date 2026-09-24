import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GORE_PALETTES,GORE_SETTINGS,GORE_TUNING,goreKind,goreLevel,validGoreSetting,makeBurst,enemyBurst,burstLife,goreSize,goreForce,goreForceScale} from '../src/gore.js';
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
 const blow={dx:0,dy:1},scene=kiaBurst(5,blow),full=enemyBurst(5,blow),simple=enemyBurst(5,blow,{level:'simple'}),big=enemyBurst(5,blow,{size:2.2});
 assert.equal(enemyBurst(5,blow,{level:'off'}),null);
 assert.equal(enemyBurst(5,null),null,'no direction, no burst');
 const mean=list=>list.reduce((a,b)=>a+b,0)/list.length,seeds=[...Array(60).keys()].map(i=>i+1);
 const fullDrops=seeds.map(s=>enemyBurst(s,blow).drops.length);
 assert.ok(Math.abs(mean(fullDrops)-46*GORE_TUNING.enemy.blood)<3,'a rifleman: on average half the flesh of the operative\'s death');
 assert.ok(full.drops.length<big.drops.length,'the same draw, a bigger body');
 assert.equal(simple.light,0);assert.equal(simple.sparks.length,0,'simple: no light, no sparks');
 assert.equal(simple.drops.length,full.drops.length,'but the same flesh');
 assert.ok(full.glow<1&&full.light<1);
 assert.ok(burstLife(full)>=.32&&burstLife(full)<=1.5,'in the air for about a second, then only stains');
 assert.ok(scene.drops.length>full.drops.length);
});

// 3.175.1 (user: by maximum health): how much flesh follows the body's size; the blow still sets how far it flies.
test('the body\'s size, from its maximum health, sets how much: a larva a pinch, a matriarch a flood',()=>{
 assert.equal(goreSize(22),1,'a rifleman');
 assert.equal(goreSize(6),.6,'a larva, held at the floor');
 assert.equal(goreSize(600),2.2,'the hive matriarch, held at the ceiling');
 assert.ok(Math.abs(goreSize(90)-Math.sqrt(90/22))<1e-9,'a brute');
 assert.equal(goreSize(undefined),1);
 const blow={dx:1,dy:0},mean=list=>list.reduce((a,b)=>a+b,0)/list.length,seeds=[...Array(60).keys()].map(i=>i+1);
 const at=(size,f,extra={})=>mean(seeds.map(s=>f(enemyBurst(s,blow,{size,...extra}))));
 const drops=b=>b.drops.length,puff=b=>mean(b.mist.map(m=>m.r0)),reach=b=>mean(b.drops.map(d=>d.D));
 assert.ok(at(goreSize(6),drops)<at(1,drops)&&at(1,drops)<at(goreSize(150),drops)&&at(goreSize(150),drops)<=at(goreSize(600),drops));
 assert.ok(at(2.2,puff)>at(1,puff)*1.3,'bigger bodies, bigger puffs');
 assert.ok(Math.abs(at(2.2,reach)-at(1,reach))<at(1,reach)*.1,'size does not change how far it flies');
 assert.ok(at(1,drops,{elite:true})>at(1,drops)*1.15,'a little more for elites');
 const player={x:2,y:4,hp:50,character:'soldier'};
 const state=(enemy,hp)=>({player,enemies:[{...enemy,hp}],allies:[],items:[],logs:[],visible:()=>true});
 const fallOf=enemy=>planPresentation([{before:state(enemy,5),after:state(enemy,0),effects:[{type:'shot',from:{x:2,y:4},to:{x:6,y:4},damage:0},{type:'impact',from:{x:6,y:4},to:{x:6,y:4},damage:30}]}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall'&&e.actorType===enemy.type);
 assert.equal(fallOf({id:'1-1',type:'boss',x:6,y:4}).size,2.2,'from the type\'s maximum health');
 assert.equal(fallOf({id:'1-1',type:'rifleman',x:6,y:4,maxHp:90}).size,goreSize(90),'or the body\'s own');
 assert.equal(fallOf({id:'1-1',type:'raider_elite',x:6,y:4,elite:true}).elite,true);
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
 assert.equal(shot.size,1);
 assert.equal(shot.elite,false);
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

// 3.176.0 (user request): every harmful hit a body lives through throws a little, about a tenth of a kill.
test('a hit that is not a kill throws a little flesh or a few sparks, shaped like a kill but far smaller',async()=>{
 const {hitBurst,HIT_TUNING}=await import('../src/gore.js');
 const blow={dx:1,dy:0},mean=list=>list.reduce((a,b)=>a+b,0)/list.length,seeds=[...Array(100).keys()].map(i=>i+1);
 const avg=(o,f)=>mean(seeds.map(s=>f(hitBurst(s,blow,o))));
 assert.ok(avg({},b=>b.drops.length)>=2.5&&avg({},b=>b.drops.length)<=6,'a few drops');
 assert.ok(avg({},b=>b.mist.length)<=2,'a wisp of mist');
 assert.ok(avg({kind:'mech'},b=>b.sparks.length)>avg({},b=>b.sparks.length),'machines throw more sparks');
 assert.ok(avg({damage:40},b=>b.drops.length)>avg({damage:8},b=>b.drops.length),'harder hits throw more');
 assert.ok(avg({size:2.2},b=>b.drops.length)>avg({},b=>b.drops.length),'bigger bodies throw more');
 assert.ok(avg({},b=>Math.max(...b.drops.map(d=>d.D)))<avg({},b=>Math.max(...enemyBurst(1,blow).drops.map(d=>d.D))),'and not as far as a kill');
 assert.equal(hitBurst(3,blow,{level:'simple'}).sparks.length,0);
 assert.equal(hitBurst(3,blow,{level:'off'}),null);
 assert.equal(hitBurst(3,null),null);
 assert.ok(HIT_TUNING.blood<GORE_TUNING.enemy.blood/3);
});

test('the presentation marks harmful hits on living bodies, not kills or props; the operative\'s hits come from the shooter',()=>{
 const player={x:2,y:4,hp:50,character:'soldier'};
 const at={x:6,y:4},state=(hp,extra=[])=>({player,enemies:[{id:'1-1',type:'rifleman',faction:'rebel',x:6,y:4,hp},...extra],allies:[],items:[],logs:[],visible:()=>true});
 const shot=[{type:'shot',weaponId:'rifle',from:{x:2,y:4},to:at,damage:0},{type:'impact',from:at,to:at,damage:9}];
 const impacts=(before,after,effects)=>planPresentation([{before,after,effects}]).events.flatMap(e=>e.effects).filter(e=>e.type==='impact');
 const lived=impacts(state(20),state(11),shot)[0];
 assert.deepEqual(lived.hit.blow,{dx:1,dy:0});
 assert.deepEqual(lived.hit.force,{style:'bullet',damage:9});
 assert.equal(lived.hit.gore,'flesh');assert.equal(lived.hit.size,1);
 assert.equal(impacts(state(5),state(0),shot)[0].hit,undefined,'a kill bursts from its fall instead');
 const crate=[{type:'shot',weaponId:'rifle',from:{x:2,y:4},to:{x:4,y:4},damage:0},{type:'impact',from:{x:4,y:4},to:{x:4,y:4},damage:9}];
 assert.equal(impacts(state(20),state(20),crate)[0].hit,undefined,'a prop is no body');
 const me=hp=>({player:{...player,hp},enemies:[{id:'1-1',type:'rifleman',x:6,y:4,hp:20}],allies:[],items:[],logs:[],visible:()=>true});
 const onMe=planPresentation([{before:me(50),after:me(40),effects:[{type:'enemyShot',attackerType:'rifleman',from:{x:6,y:4},to:{x:2,y:4},damage:10}]}]).events.flatMap(e=>e.effects).find(e=>e.type==='impact');
 assert.deepEqual(onMe.hit.blow,{dx:-1,dy:0},'shot from the right: the spray goes left');
 assert.equal(onMe.hit.gore,'flesh');
});
