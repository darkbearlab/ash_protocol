import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,ENEMY_TYPES,makeEnemy,generate,SAVE_VERSION,enemyDisplayName,applySuppression,rollEnemyAffixes,rollEnemyElite,SWARM_TUNING,tonguePlan,tongueTelegraphs,tickTongues,poisonHit,infectedDeath,validSwarm} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {factionPool} from '../src/faction-catalog.js';
import {applyDisruption} from '../src/throwables.js';
import {RUNTIME_TUNING,validRuntime} from '../src/runtime-enemies.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {pullLanding} from '../src/melee-classes.js';
const arena=()=>{const g=affixArena();g.facilityFaction='swarm';return g;};
const spawn=(g,type,x=14,y=10)=>{const e=g.spawnEnemy(type,x,y,`swarm-${g.enemies.length}`);e.alert=true;e.lastKnown={x:10,y:10};g.enemies.push(e);g.reveal();return e;};
const sure=g=>{g.rng=Object.assign(()=>0,{state:()=>1});};

test('venom hits inflict no direct damage or armour loss; stacks cap at four, DOT scales by stacks, medkit and hazmat work',()=>{
 const g=arena(),e=spawn(g,'spitter');sure(g);g.player.plates=20;const hp=g.player.hp;
 e.charge=true;g.enemyAct(e);assert.equal(g.player.hp,hp);assert.equal(g.player.plates,20);assert.equal(g.player.poison,1);assert.ok(g.effects.some(f=>f.type==='enemyShot'&&f.style==='venom'&&f.damage===0));
 for(let n=0;n<5;n++)poisonHit(g,e,g.player);assert.equal(g.player.poison,4);
 g.environmentTurn();assert.equal(g.player.hp,hp-4);assert.equal(g.player.poison,4);assert.equal(g.player.poisonClock,1);
 g.player.hazmat=5;g.environmentTurn();assert.equal(g.player.hp,hp-7);assert.equal(g.player.poison,3);
 const turn=g.turn;assert.ok(g.executePlayer('heal'));assert.equal(g.player.poison,0);assert.equal(g.turn,turn);
 g.player.poison=3;g.player.scrap=100;g.props.push({type:'terminal',x:10,y:11});g.useTerminal('heal');assert.equal(g.player.poison,0);
});
test('venom miss is harmless; allies and pets intercept without poison or damage; infected hits retain direct damage and suppression',()=>{
 const g=arena(),e=spawn(g,'spitter');g.rng=()=>.999;e.charge=true;g.enemyAct(e);assert.equal(g.player.poison,0);assert.equal(g.player.hp,100);
 const ally={id:'pet-test',kind:'pet',hp:100,x:12,y:10};g.enemyTarget=()=>ally;sure(g);e.charge=true;g.enemyAct(e);assert.equal(ally.hp,100);assert.equal(ally.poison,undefined);assert.equal(g.player.poison,0);
 const h=arena(),i=spawn(h,'rifleman_infected');sure(h);i.charge=true;assert.ok(enemyDisplayName(i).endsWith('？'));h.enemyAct(i);assert.ok(h.player.hp<100);assert.equal(h.player.poison,1);assert.equal(h.player.suppression,1);assert.ok(enemyDisplayName(i).includes('帶毒'));assert.ok(!enemyDisplayName(i).includes('育蟲'));
});
test('spitter enters swarm roster at floor three and gains a second entry at seven; other factions never contain it',()=>{
 for(const floor of [1,2,3,6,7,60]){assert.equal(factionPool('swarm',floor).filter(t=>t==='spitter').length,floor<3?0:floor<7?1:2);for(const f of ['legacy','loyalist','rebel'])assert.ok(!factionPool(f,floor).includes('spitter'));}
 assert.equal(ENEMY_TYPES.spitter.armor,0);assert.equal(ENEMY_TYPES.spitter.damage,0);assert.equal(ENEMY_TYPES.spitter.loot,undefined);
});
test('tongue shares grapple geometry, prepares for an opportunity, then pulls with no damage and a four-paid-turn cooldown',()=>{
 const g=arena(),e=spawn(g,'hive_beast');const plan=tonguePlan(g,e);assert.deepEqual(plan.point,pullLanding(g,g.player,e));const state=g.rng.state();g.enemyAct(e);
 assert.deepEqual(tongueTelegraphs(g)[0].target,{x:10,y:10});assert.equal(g.player.x,10);assert.equal(g.rng.state(),state);
 g.enemyAct(e);assert.equal(g.player.x,13);assert.equal(g.player.hp,100);assert.equal(e.tongueIntent,undefined);assert.equal(e.tongueCooldown,4);assert.ok(g.effects.some(f=>f.type==='tonguePull'));
 // 3.124.0: the pull records a three-tile move; a save taken now must load (it used to be rejected).
 assert.deepEqual(g.player.moveDelta,[3,0]);const reloaded=Game.restore(g.serialize());assert.ok(reloaded);assert.deepEqual(reloaded.player.moveDelta,[3,0]);
 g.player.x=10;for(let n=0;n<3;n++)tickTongues(g);g.enemyAct(e);assert.equal(e.tongueIntent,undefined);tickTongues(g);g.enemyAct(e);assert.ok(e.tongueIntent);
 // The ability is card data, not a boss-ID test.
 ENEMY_TYPES.qa_tongue={...ENEMY_TYPES.crawler,tongue:true};try{const h=arena(),q=spawn(h,'qa_tongue');h.enemyAct(q);assert.ok(q.tongueIntent);}finally{delete ENEMY_TYPES.qa_tongue;}
});
test('tongue cancels on stun, pin, death, displacement, target movement or blocked ray; damage alone does not cancel',()=>{
 for(const cause of ['stun','pin','death','displace','move','wall','hurt']){const g=arena(),e=spawn(g,'hive_matriarch');g.enemyAct(e);assert.ok(e.tongueIntent);
  if(cause==='stun')applyDisruption(e,'biological');if(cause==='pin')applySuppression(e,5);if(cause==='death')g.hurt(e,10000);if(cause==='displace')e.y++;if(cause==='move')g.player.y++;if(cause==='wall')g.grid[10][12]=0;if(cause==='hurt')g.hurt(e,1);
  if(cause==='pin'||cause==='stun'||cause==='death')assert.equal(e.tongueIntent,undefined);
  g.enemyAct(e);assert.equal(e.tongueIntent,undefined);assert.equal(g.player.x,cause==='hurt'?13:10);
 }
});
test('tongue needs visible clear five-tile reach and a swept unoccupied path; no passing walls, props or bodies',()=>{
 for(const block of ['range','sight','wall','units','prop']){const g=arena(),e=spawn(g,'hive_beast');if(block==='range')e.x=16;if(block==='sight')g.sight=()=>false;if(block==='wall')for(let y=0;y<27;y++)g.grid[y][12]=0;if(block==='units')for(let y=0;y<27;y++)spawn(g,'crawler',12,y);if(block==='prop')for(let y=0;y<27;y++)g.props.push({id:`p${y}`,type:'cover',x:12,y,hp:10});assert.equal(tonguePlan(g,e),null,block);}
});
test('infection is saved hidden at birth, respects faction isolation, works on fodder and elites, consumes no combat RNG',()=>{
 const g=arena(),before=g.rng.state();for(const type of ['rifleman_infected','raider_infected','fodder']){const e=spawn(g,type);assert.deepEqual(e.affixes.map(a=>a.id),['venomous','brood_host']);assert.ok(e.affixes.every(a=>!a.revealed));}
 assert.equal(g.rng.state(),before);
 const legacy=rollEnemyAffixes(makeEnemy('fodder',1,1,'l'),3,1);assert.deepEqual(legacy.affixes,[]);
 const e=rollEnemyAffixes(makeEnemy('rifleman_infected',1,1,'elite',60,0,'swarm'),1,60);ENEMY_TYPES.rifleman_infected.elite=true;try{rollEnemyElite(e,1,60);assert.ok(e.elite);assert.ok(e.affixes.some(a=>a.id==='brood_host'));}finally{delete ENEMY_TYPES.rifleman_infected.elite;}
});
test('infected death creates deterministic one or two expendable children, no reward, no recursive burst and no RNG draw',()=>{
 for(let seed=1;seed<=10;seed++){const g=arena();g.seed=seed;const e=spawn(g,'rifleman_infected');e.hp=0;const before=g.rng.state();infectedDeath(g,e);const kids=g.enemies.filter(a=>a.broodParent);assert.ok(kids.length>=1&&kids.length<=2);assert.equal(g.rng.state(),before);assert.ok(kids.every(a=>a.expendable&&a.reinforcement&&!a.affixes.length));assert.ok(validRuntime(g));assert.ok(validSwarm(g));const count=g.enemies.length;infectedDeath(g,e);assert.equal(g.enemies.length,count);const xp=g.player.xp,scrap=g.player.scrap;for(const k of kids)g.hurt(k,100);assert.equal(g.player.xp,xp);assert.equal(g.player.scrap,scrap);assert.equal(g.enemies.length,count);assert.ok(Game.restore(g.serialize()));}
});
test('death brood shares expendable/live caps with nests and other sources; blocked space produces fewer without failure',()=>{
 for(const mode of ['expendable','live','blocked']){const g=arena(),e=spawn(g,'rifleman_infected');e.hp=0;if(mode==='blocked')for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]])g.grid[e.y+dy][e.x+dx]=0;else for(let n=0;n<(mode==='live'?RUNTIME_TUNING.liveLimit:RUNTIME_TUNING.expendableLimit);n++)spawn(g,mode==='live'?'crawler':'fodder',1,n%25+1);infectedDeath(g,e);assert.equal(g.enemies.filter(a=>a.broodParent).length,0,mode);}
});
test('current save preserves poison, tongue and burst state; older optional state needs no reroll; malformed fields and archive state reject',()=>{
 assert.ok(SAVE_VERSION>=44);const g=arena(),e=spawn(g,'hive_beast');g.enemyAct(e);g.player.poison=4;const raw=g.serialize(),copy=Game.restore(raw);assert.ok(copy);assert.deepEqual(copy.enemies,e?[e]:[]);assert.equal(copy.player.poison,4);assert.equal(copy.rng.state(),g.rng.state());const frame=archiveFloor(g);assert.deepEqual(resumedFloor(frame,g.turn+9).enemies,frame.enemies);
 const old=JSON.parse(raw);old.version=42;delete old.data.enemies[0].tongueIntent;assert.ok(Game.restore(JSON.stringify(old)));
 for(const change of [d=>d.player.poison=7,d=>d.enemies[0].tongueCooldown=-1,d=>d.enemies[0].tongueIntent.target.x=99,d=>d.enemies[0].broodParent='fake',d=>d.enemies[0].tongueIntent=null]){const bad=JSON.parse(raw);change(bad.data);assert.equal(Game.restore(JSON.stringify(bad)),null);}
 const h=arena(),host=spawn(h,'fodder');host.hp=0;infectedDeath(h,host);const archived=archiveFloor(h);assert.ok(validSwarm({...g,floorStates:{1:archived}}));archived.enemies.find(a=>a.broodParent).broodParent='invalid';assert.equal(validSwarm({...g,floorStates:{1:archived}}),false);
});
