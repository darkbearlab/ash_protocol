import {setOperativeDraw} from '../src/operative-draw.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,generate,ENEMY_TYPES,rollEnemyAffixes} from '../src/engine.js';
import {ENEMY_AFFIXES} from '../src/enemy-affixes.js';
import {addAlly} from '../src/allies.js';
import {SAVE_VERSION} from '../src/data.js';
import {FACTIONS,factionBoss} from '../src/faction-catalog.js';
import {BOSS_TUNING,DESIGNATED,MARK_SOURCE,gunCells,gunFlank,markAccuracy,markDamage,liveMarkIntent,liveGun,inGun,designated,designatedTurns,dropStaleBossIntents,validLoyalistBosses} from '../src/loyalist-bosses.js';
import {interruptEnemyIntent} from '../src/enemy-intents.js';
import {applyDisruption} from '../src/throwables.js';
import {PROTOCOL_REWARDS} from '../src/progression.js';
import {enemyBand} from '../src/range-band.js';
import {ENEMY_BLUEPRINTS} from '../src/workshop.js';
import {timedStatusChips} from '../src/status-timers.js';
import {suppressionStacks,pinned} from '../src/suppression.js';
import {inCone} from '../src/shotgun.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.204.0 (user design 2026-09-29, docs/BOSSES.md sections 1-2): 標定官 (floor 3) marks you; 火線官 (floor 6) marks you
// and sets up a machine gun, taking turns. An open lit floor that a save round-trips.
function field(){
  const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];
  g.player.hp=g.player.maxHp=999;g.player.plates=0;g.reveal();
  return g;
}
const boss=(g,type,x,y,id=type)=>{const e=makeEnemy(type,x,y,id,type==='gunline'?6:3,0,'loyalist');e.alert=true;g.enemies.push(e);g.reveal();return e;};
const foe=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,3,0,'loyalist');e.alert=true;e.hp=e.maxHp=500;g.enemies.push(e);g.reveal();return e;};
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};
const marks=g=>g.player.traits.filter(t=>t.id===DESIGNATED);
const M=BOSS_TUNING.mark,G=BOSS_TUNING.gun;

test('the catalog: loyalists get 標定官 and 火線官; the legacy mix keeps the warden and the core guard',()=>{
  assert.deepEqual(FACTIONS.loyalist.bosses,{3:'designator',6:'gunline'});
  assert.deepEqual(FACTIONS.legacy.bosses,{3:'warden',6:'boss'});assert.deepEqual(FACTIONS.rebel.bosses,{3:'arsonist',6:'burnline'},'3.206.0: the rebels have their own (tests/rebel-bosses.test.mjs)');
  assert.deepEqual(FACTIONS.swarm.bosses,{3:'hive_beast',6:'hive_matriarch'});
  assert.equal(factionBoss('loyalist',3),'designator');assert.equal(factionBoss('loyalist',6),'gunline');
  // Stats like the chassis they share (user); both are bosses that call drones; the warden and core guard are untouched.
  const {designator:d,gunline:l,warden:w,boss:b}=ENEMY_TYPES;
  assert.deepEqual([d.hp,d.armor,d.damage,d.range],[w.hp,w.armor,w.damage,w.range]);assert.deepEqual([l.hp,l.armor,l.damage,l.range],[b.hp,b.armor,b.damage,b.range]);
  assert.deepEqual([d.hp,d.armor,l.hp,l.armor],[180,5,280,7]);
  for(const c of [d,l]){assert.ok(c.tags.includes('boss'));assert.equal(c.reinforcement,'drone');assert.ok(c.mechanical);}
  assert.deepEqual(d.specials,['mark']);assert.deepEqual(l.specials,['mark','gun']);assert.equal(w.specials,undefined);assert.equal(b.specials,undefined);
  assert.deepEqual(w.traits,['infrared','suppression_resistance']);assert.equal(w.behavior,'warden');assert.equal(b.behavior,'boss');
  assert.equal(PROTOCOL_REWARDS.designator,PROTOCOL_REWARDS.warden);assert.equal(PROTOCOL_REWARDS.gunline,PROTOCOL_REWARDS.boss);
  assert.deepEqual(enemyBand('designator'),enemyBand('warden'));assert.deepEqual(enemyBand('gunline'),enemyBand('boss'));
  assert.equal(ENEMY_BLUEPRINTS.designator,'unit_warden');assert.equal(ENEMY_BLUEPRINTS.gunline,'unit_boss');
  // Generated floors: a loyalist floor 3 and 6 (and 9 and 12 in the cycle) hold the new boss; the others do not.
  // 3.207.0: with the delisted operatives' draw off (src/operative-draw.js); 30% of floors 6, 9, 12... meet one instead.
  setOperativeDraw(()=>null);
  try{for(const seed of [3,11]){
    for(const [floor,type] of [[3,'designator'],[6,'gunline'],[9,'designator']])assert.ok(generate(seed,floor,[],0,'loyalist').enemies.some(e=>e.type===type),`${seed}:${floor}`);
    for(const faction of ['legacy']){const three=generate(seed,3,[],0,faction).enemies,six=generate(seed,6,[],0,faction).enemies;
      assert.ok(three.some(e=>e.type==='warden')&&six.some(e=>e.type==='boss'),faction);assert.ok(![...three,...six].some(e=>['designator','gunline'].includes(e.type)),faction);}
  }}finally{setOperativeDraw(null);}
});

test('標定: a round of laser, then the mark lands on its turn; three more rounds of +15 to hit and +20% damage from every enemy',()=>{
  const g=field(),b=boss(g,'designator',16,10);
  assert.ok(g.action('wait'));
  assert.deepEqual(b.markIntent,{since:g.turn},'it paints you');assert.ok(liveMarkIntent(b));assert.equal(marks(g).length,0,'not yet marked');
  assert.ok(g.logs.some(l=>l.text.includes(ENEMY_TYPES.designator.name)));
  const landed=g.turn+1;assert.ok(g.action('wait'));
  assert.equal(b.markIntent,undefined);assert.deepEqual(marks(g),[{id:DESIGNATED,source:MARK_SOURCE,turns:M.turns}],'three rounds left at your next action');
  assert.equal(b.markReady,landed+M.turns+M.cooldown+1);assert.equal(designatedTurns(g.player),3);
  const chip=timedStatusChips(g).find(c=>c.icon==='reticle');assert.ok(chip&&chip.tone==='bad'&&chip.n===3,'a bad state on the status line');
  assert.ok(!timedStatusChips(g).some(c=>c.icon==='hourglass'),'not listed twice');
  // The numbers: another enemy's aimed shot and its damage, with and without the mark.
  const r=foe(g,'rifleman',10,14,'r');g.player.moved=true;g.player.evasive=true;
  const on=g.accuracy(r,g.player).chance,onDamage=markDamage(g,r);
  const saved=g.player.traits;g.player.traits=g.player.traits.filter(t=>t.id!==DESIGNATED);
  const off=g.accuracy(r,g.player).chance;assert.equal(markDamage(g,r),1);g.player.traits=saved;
  assert.equal(on-off,M.accuracy);assert.equal(g.accuracy(r,g.player).designatedBonus,15);assert.equal(onDamage,1.2);
  assert.equal(g.meleeAccuracy(r,g.player,60)-(()=>{g.player.traits=[];const v=g.meleeAccuracy(r,g.player,60);g.player.traits=saved;return v;})(),15,'blows too');
  assert.equal(markAccuracy(g,g.player,r),0,'only enemies at you');
  // +20% on a hit that reaches you; a blast is not aimed and stays as it is.
  const hit=(mark,blast=false)=>{const h=field(),e=foe(h,'crawler',11,10,'x');if(mark)h.player.traits.push({id:DESIGNATED,source:MARK_SOURCE,turns:2});const before=h.player.hp;h.damagePlayer(50,'test',blast?null:e,blast);return before-h.player.hp;};
  assert.equal(hit(true),60);assert.equal(hit(false),50);assert.equal(hit(true,true),hit(false,true));
  // The rest of the landing round and three more: gone after the third.
  for(const left of [2,1]){assert.ok(g.action('wait'));assert.equal(designatedTurns(g.player),left);}
  assert.ok(g.action('wait'));assert.equal(marks(g).length,0);assert.equal(designated(g.player),false);
});

test('標定 cannot be shaken off: out of sight and in smoke, the paint still lands, and the mark holds',()=>{
  const g=field(),b=boss(g,'designator',16,10);
  assert.ok(g.action('wait'));assert.ok(b.markIntent);
  // Behind a wall and in thick smoke before its turn comes.
  for(let x=8;x<=20;x++)g.grid[12][x]=0;g.player.y=14;g.smoke=[{expires:g.turn+3,cells:[{x:10,y:14},{x:10,y:13},{x:11,y:14}]}];g.reveal();
  assert.equal(g.sight(b,g.player),false,'it cannot see you');
  assert.ok(g.action('wait'));assert.equal(marks(g).length,1,'the mark lands wherever you are');
  assert.ok(g.action('wait'));assert.equal(designatedTurns(g.player),2,'and does not end early out of sight');
  // Losing its target is not one of the interruptions.
  const h=field(),c=boss(h,'designator',16,10);assert.ok(h.action('wait'));interruptEnemyIntent(c,'target_lost');interruptEnemyIntent(c,'suppressed');assert.ok(c.markIntent);
  // Smoke keeps a new one from being painted: it has to see you (no infrared, Claude's call).
  const k=field(),d=boss(k,'designator',16,10);k.smoke=[{expires:k.turn+4,cells:[{x:13,y:10},{x:13,y:9},{x:13,y:11}]}];k.reveal();
  assert.equal(k.sight(d,k.player),false);assert.ok(k.action('wait'));assert.equal(d.markIntent,undefined);
});

test('標定 is stopped like any telegraph: stunned, pulled or killed while painting, the paint is dropped',()=>{
  for(const stop of [(g,b)=>applyDisruption(b,'mechanical'),(g,b)=>interruptEnemyIntent(b,'displaced'),(g,b)=>g.hurt(b,b.hp,g.player)]){
    const g=field(),b=boss(g,'designator',16,10);assert.ok(g.action('wait'));assert.ok(b.markIntent);
    stop(g,b);assert.equal(b.markIntent,undefined);assert.ok(g.action('wait'));assert.equal(marks(g).length,0,'no mark lands');
  }
  // Both are machines: an EMP stops them, a stun grenade does not (no infrared, unlike the warden).
  const s=field(),b=boss(s,'designator',16,10);assert.ok(s.action('wait'));assert.equal(applyDisruption(b,'biological'),false);assert.ok(b.markIntent);
});

test('標定 cooldown: it paints again from the second round after a mark ends, and never over a charged shot',()=>{
  const g=field(),b=boss(g,'designator',16,10),paints=[],lands=[];
  for(let i=0;i<22;i++){const before=Boolean(b.markIntent);assert.ok(g.action('wait'));if(b.markIntent&&!before)paints.push(g.turn);if(before&&!b.markIntent)lands.push(g.turn);}
  assert.ok(paints.length>=3,JSON.stringify(paints));
  for(let i=1;i<paints.length;i++){const end=lands[i-1]+M.turns;assert.ok(paints[i]>=end+M.cooldown+1,`paint ${paints[i]} after a mark ending on ${end}`);}
  for(let i=0;i<lands.length;i++)assert.equal(lands[i],paints[i]+1,'lands the round after');
  assert.ok(g.player.hp<999,'between marks it fights as the warden does');
});

test('架槍: a round of warning shows a 90-degree cone of range 7; three sweeps; a stack for anyone in it, hit or not',()=>{
  const g=field(),b=boss(g,'gunline',16,10);b.special='gun';
  assert.ok(g.action('wait'));
  assert.deepEqual(b.gun,{stage:'set',origin:{x:16,y:10},aim:{x:10,y:10}});assert.ok(liveGun(b));
  const cells=gunCells(g,b.gun.origin,b.gun.aim);
  assert.ok(cells.length>0&&cells.every(q=>{const d=Math.abs(q.x-16)+Math.abs(q.y-10);return d>=1&&d<=G.range&&inCone(b.gun.origin,b.gun.aim,q,45);}));
  assert.ok(cells.some(q=>q.x===9&&q.y===10)&&!cells.some(q=>q.x===8&&q.y===10),'range 7');
  assert.ok(cells.some(q=>q.x===13&&q.y===7)&&!cells.some(q=>q.x===13&&q.y===6),'45 degrees each side');
  assert.equal(suppressionStacks(g.player),0,'the warning itself does nothing');
  // Always missing: one stack a round all the same. Always hitting: the belt's stack on top.
  fixed(g,.999);g.player.traits=[];assert.ok(g.action('wait'));
  assert.equal(b.gun.stage,'sweep');assert.equal(b.gun.left,G.sweeps-1);assert.equal(suppressionStacks(g.player),1,'missed, still suppressed');assert.equal(g.player.hp,999);
  const h=field(),c=boss(h,'gunline',16,10);c.special='gun';assert.ok(h.action('wait'));fixed(h,0);h.player.guard=false;
  assert.ok(h.action('move',[0,1]));assert.equal(suppressionStacks(h.player),2,'hit: the belt adds its stack');assert.ok(h.player.hp<999);
  assert.ok(h.action('wait'));assert.ok(pinned(h.player),'two sweeps in the open pin you');
  // Outside the cone: nothing; unseen in it: pinned down all the same, but not shot.
  const k=field(),e=boss(k,'gunline',16,10);e.special='gun';assert.ok(k.action('wait'));
  k.player.x=16;k.player.y=4;fixed(k,0);assert.ok(k.action('wait'));assert.equal(suppressionStacks(k.player),0,'outside the cone');assert.equal(k.player.hp,999);
  const s=field(),f=boss(s,'gunline',16,10);f.special='gun';assert.ok(s.action('wait'));
  s.smoke=[{expires:s.turn+3,cells:[{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:10,y:9},{x:10,y:11}]}];s.reveal();fixed(s,0);
  assert.equal(s.sight(f,s.player),false);assert.ok(s.action('wait'));assert.equal(suppressionStacks(s.player),1);assert.equal(s.player.hp,999,'in smoke: pinned, not shot');
});

test('架槍: set up it neither moves nor turns, is easier from outside the cone, then packs up two rounds before it sets up again',()=>{
  const g=field(),b=boss(g,'gunline',16,10);b.special='gun';
  assert.ok(g.action('wait'));const {origin,aim}=b.gun;
  // You walk behind it: it keeps sweeping the same cone from the same tile.
  g.player.x=19;g.player.y=10;g.reveal();
  const inside=field(),c=boss(inside,'gunline',16,10);c.gun={stage:'sweep',origin:{x:16,y:10},aim:{x:10,y:10},left:2};c.moved=true;c.evasive=true;inside.player.x=12;inside.player.y=10;inside.reveal();
  const front=inside.accuracy(inside.player,c).chance;inside.player.x=20;inside.reveal();const behind=inside.accuracy(inside.player,c).chance;
  assert.equal(gunFlank(inside,inside.player,c),G.flank);assert.equal(inside.accuracy(inside.player,c).gunFlankBonus,15);
  inside.player.x=12;assert.equal(gunFlank(inside,inside.player,c),0,'from inside the cone, no bonus');
  inside.player.x=4;assert.equal(gunFlank(inside,inside.player,c),0,'straight ahead out of range is still in front');
  assert.equal(behind-front,G.flank,'the same distance, from behind');
  for(let i=0;i<G.sweeps;i++){assert.ok(g.action('wait'));assert.deepEqual([b.x,b.y],[16,10],'it cannot move');if(b.gun?.aim)assert.deepEqual(b.gun.aim,aim,'nor turn');}
  assert.deepEqual(b.gun,{stage:'pack',left:G.packUp});
  const hp=g.player.hp;
  for(let i=0;i<G.packUp;i++)assert.ok(g.action('wait'));   // 3.205.0: it may walk while it packs up (the next test)
  assert.equal(b.gun,undefined,'packed');assert.equal(g.player.hp,hp,'no shot while packing');
  // Then it may set up again (its next special after the gun is the mark, when that is ready).
  b.special='gun';g.player.x=b.x-6;g.player.y=b.y;g.reveal();assert.ok(g.action('wait'));assert.equal(b.gun?.stage,'set');assert.deepEqual(b.gun.origin,{x:b.x,y:b.y});
});

test('收槍 (3.205.0, user 2026-09-29: 收槍的冷卻時間可以移動): packing up it walks, off a hazard first, and never fires, marks or sets up',()=>{
  // Out of its reach: it walks toward you, both rounds.
  const g=field(),b=boss(g,'gunline',18,10);b.gun={stage:'pack',left:G.packUp};b.markReady=0;g.player.x=4;g.reveal();fixed(g,0);const hp=g.player.hp;
  assert.ok(g.action('wait'));assert.ok(b.x<18,`it walked: ${b.x}`);assert.deepEqual(b.gun,{stage:'pack',left:1});const x=b.x;
  assert.ok(g.action('wait'));assert.ok(b.x<x,'and on');assert.equal(b.gun,undefined,'packed');
  assert.equal(g.player.hp,hp,'no shot');assert.equal(b.markIntent,undefined,'no mark');assert.equal(b.charge,false,'no shot wound up');
  // In reach and with the mark ready: still nothing but its feet.
  const h=field(),c=boss(h,'gunline',15,10);c.gun={stage:'pack',left:G.packUp};c.markReady=0;c.special='mark';fixed(h,0);const hhp=h.player.hp;
  for(let i=0;i<G.packUp;i++){assert.ok(h.action('wait'));assert.equal(c.markIntent,undefined,`round ${i+1}: no mark`);assert.ok(!c.gun||c.gun.stage==='pack',`round ${i+1}: no new gun`);assert.equal(c.charge,false);}
  assert.equal(h.player.hp,hhp,'no shot in either round');assert.equal(designated(h.player),false);
  // Next to you and not seeing you (review): it stays put; a walk into you would be a free blind shot.
  const n=field(),a=boss(n,'gunline',11,10);a.gun={stage:'pack',left:G.packUp};a.markReady=999;a.lastKnown={x:10,y:10};const sight=n.sight.bind(n);n.sight=(x,y)=>x===a&&y===n.player?false:sight(x,y);n.reveal();
  fixed(n,0);const nhp=n.player.hp;n.enemyAct(a);assert.equal(n.player.hp,nhp,'no blind shot');assert.deepEqual([a.x,a.y],[11,10]);
  // On a burning tile it steps off first.
  const k=field(),f=boss(k,'gunline',16,10);f.gun={stage:'pack',left:G.packUp};k.fires=[{x:16,y:10,age:1}];fixed(k,.999);
  assert.ok(k.action('wait'));assert.notDeepEqual([f.x,f.y],[16,10],'off the fire');
});

test('架槍 is stopped like a telegraph while it sets up; stunned or pulled while sweeping, it packs up at once',()=>{
  for(const stop of [b=>applyDisruption(b,'mechanical'),b=>interruptEnemyIntent(b,'displaced')]){
    const g=field(),b=boss(g,'gunline',16,10);b.special='gun';assert.ok(g.action('wait'));assert.equal(b.gun.stage,'set');
    stop(b);assert.equal(b.gun,undefined,'dropped while setting up');
    const h=field(),c=boss(h,'gunline',16,10);c.special='gun';assert.ok(h.action('wait'));assert.ok(h.action('wait'));assert.equal(c.gun.stage,'sweep');
    stop(c);assert.deepEqual(c.gun,{stage:'pack',left:G.packUp},'packs up');
  }
  const g=field(),b=boss(g,'gunline',16,10);b.special='gun';assert.ok(g.action('wait'));g.hurt(b,b.hp,g.player);assert.equal(b.gun,undefined,'killed');
  const h=field(),c=boss(h,'gunline',16,10);c.special='gun';assert.ok(h.action('wait'));interruptEnemyIntent(c,'target_lost');assert.equal(c.gun.stage,'set','losing its target does not stop it');
});

test('火線官 takes turns: mark, then gun; a mark in the sweep is the deadly combination; drones at half health',()=>{
  const g=field(),b=boss(g,'gunline',16,10),seen=[];
  for(let i=0;i<16;i++){const had={mark:Boolean(b.markIntent),gun:b.gun?.stage==='set',sweeping:liveGun(b),marked:designated(g.player)};assert.ok(g.action('wait'));
    if(b.markIntent&&!had.mark)seen.push(['mark',g.turn]);if(b.gun?.stage==='set'&&!had.gun)seen.push(['gun',g.turn]);
    if(had.sweeping&&had.marked)seen.push(['both',g.turn]);}   // a sweep this round, with the mark on you
  const kinds=seen.filter(s=>s[0]!=='both').map(s=>s[0]);
  assert.deepEqual(kinds.slice(0,4),['mark','gun','mark','gun'],JSON.stringify(seen));
  assert.ok(seen.some(s=>s[0]==='both'),'swept while marked');
  // Both ready: the one whose turn it is goes first, and the other is next.
  for(const [next,expect] of [['gun','gun'],['mark','mark']]){const k=field(),e=boss(k,'gunline',16,10);e.special=next;e.markReady=1;assert.ok(k.action('wait'));
    assert.equal(expect==='gun'?e.gun?.stage:Boolean(e.markIntent),expect==='gun'?'set':true,next);assert.equal(expect==='gun'?Boolean(e.markIntent):e.gun,expect==='gun'?false:undefined);assert.equal(e.special,expect==='gun'?'mark':'gun');}
  // Only one of them possible (you are out of the gun's reach): the other one, whoever's turn it was.
  const far=field(),f=boss(far,'gunline',20,10);far.player.x=2;far.player.y=10;far.reveal();f.special='gun';assert.ok(far.action('wait'));assert.ok(f.markIntent,'the mark instead');assert.equal(f.gun,undefined);
  // Never on the round a mark lands.
  const lands=[];const h=field(),c=boss(h,'gunline',16,10);for(let i=0;i<12;i++){const before=Boolean(c.markIntent);assert.ok(h.action('wait'));if(before&&!c.markIntent){lands.push(h.turn);assert.notEqual(c.gun?.stage,'set');}}
  assert.ok(lands.length>0);
  // Half health: the drone call, unannounced, as the old bosses do — also on a turn the gun takes.
  for(const type of ['designator','gunline']){const k=field(),e=boss(k,type,16,10);if(type==='gunline'){e.special='gun';assert.ok(k.action('wait'));}
    e.hp=Math.floor(e.maxHp/2)-1;const before=k.enemies.length;assert.ok(k.action('wait'));assert.ok(e.reinforced,type);assert.ok(k.enemies.length>before,type);
    assert.ok(k.enemies.slice(before).every(d=>d.type==='drone'));}
});

test('saves: a paint, a gun, the cooldowns and your mark come back; bad ones are refused; stale ones are dropped',()=>{
  const g=field(),b=boss(g,'gunline',16,10);b.special='gun';
  assert.ok(g.action('wait'));assert.ok(g.action('wait'));b.markReady=g.turn+3;g.player.traits.push({id:DESIGNATED,source:MARK_SOURCE,turns:3});
  const back=Game.restore(g.serialize());assert.ok(back);const e=back.enemies.find(x=>x.id===b.id);
  assert.deepEqual(e.gun,b.gun);assert.equal(e.special,b.special);assert.equal(e.markReady,b.markReady);assert.deepEqual(back.player.traits.filter(t=>t.id===DESIGNATED),[{id:DESIGNATED,source:MARK_SOURCE,turns:3}]);
  const p=field(),d=boss(p,'designator',16,10);assert.ok(p.action('wait'));
  const painted=Game.restore(p.serialize());assert.ok(painted);assert.deepEqual(painted.enemies[0].markIntent,d.markIntent);
  assert.ok(painted.action('wait'));assert.equal(marks(painted).length,1,'it lands after the load');
  const pack=field(),k=boss(pack,'gunline',16,10);k.gun={stage:'pack',left:2};assert.ok(Game.restore(pack.serialize()));
  const bad=[
    d=>d.enemies[0].gun.extra=1,d=>d.enemies[0].gun.left=0,d=>d.enemies[0].gun.stage='aim',d=>d.enemies[0].gun.aim={x:16,y:10},d=>d.enemies[0].gun.aim={x:-1,y:3},
    d=>d.enemies[0].special='grenade',d=>d.enemies[0].markReady=d.turn+M.turns+M.cooldown+2,d=>d.enemies[0].markReady=1.5,
    d=>d.player.traits.find(t=>t.id===DESIGNATED).turns=M.turns+2,d=>d.player.traits.find(t=>t.id===DESIGNATED).source='boss:other',
    d=>d.player.traits.push({id:DESIGNATED,source:'boss:second',turns:1}),d=>d.enemies[0].traits.push({id:DESIGNATED,source:MARK_SOURCE,turns:2}),
  ];
  for(const change of bad){const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null,change.toString());}
  for(const change of [d=>d.enemies[0].markIntent={since:d.turn,extra:1},d=>d.enemies[0].markIntent={since:d.turn+1}]){const raw=JSON.parse(p.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null,change.toString());}
  // Only the cards that do it may carry it.
  const r=field(),rifle=foe(r,'rifleman',14,10,'rf');rifle.markReady=2;assert.equal(Game.restore(r.serialize()),null);delete rifle.markReady;
  const w=boss(r,'designator',18,12,'dz');w.gun={stage:'pack',left:1};assert.equal(Game.restore(r.serialize()),null,'the floor-3 boss has no gun');delete w.gun;w.special='mark';assert.equal(Game.restore(r.serialize()),null);delete w.special;
  assert.ok(Game.restore(r.serialize()));
  // Stale (moved outside its turn, stunned, dead): dropped on load, not refused (the 3.203.0 lesson).
  for(const change of [d=>{d.enemies[0].x=15;},d=>{d.enemies[0].control.disabled=2;},d=>{d.enemies[0].hp=0;}]){
    const raw=JSON.parse(g.serialize());change(raw.data);const loaded=Game.restore(JSON.stringify(raw));assert.ok(loaded,change.toString());assert.equal(loaded.enemies[0].gun,undefined);}
  for(const change of [d=>{d.enemies[0].control.disabled=2;},d=>{d.enemies[0].hp=0;}]){
    const raw=JSON.parse(p.serialize());change(raw.data);const loaded=Game.restore(JSON.stringify(raw));assert.ok(loaded,change.toString());assert.equal(loaded.enemies[0].markIntent,undefined);}
  const frame={enemies:[{...structuredClone(b),x:14}],floorStates:{}};dropStaleBossIntents(frame);assert.equal(frame.enemies[0].gun,undefined);
  // 3.206.2: sweeps and pack-up rounds left past today's tuning are cut to it, not refused (docs/CHECKLIST.md 3).
  {const raw=JSON.parse(g.serialize());raw.data.enemies[0].gun={...raw.data.enemies[0].gun,stage:'sweep',left:G.sweeps+5};const cut=Game.restore(JSON.stringify(raw));assert.ok(cut);assert.equal(cut.enemies[0].gun.left,G.sweeps-1);}
  {const raw=JSON.parse(pack.serialize());raw.data.enemies[0].gun.left=G.packUp+5;const cut=Game.restore(JSON.stringify(raw));assert.ok(cut);assert.equal(cut.enemies[0].gun.left,G.packUp);}
  assert.equal(validLoyalistBosses(g),true);
});

test('a round trip: a floor kept with a fallen boss\'s state comes back from a save, and your mark stays behind',()=>{
  const g=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'loyalist'});
  const b=makeEnemy('gunline',g.exitPoint.x,g.exitPoint.y,'kept-boss',1,0,'loyalist');b.hp=0;b.markReady=g.turn+2;b.special='gun';g.enemies.push(b);
  g.player.traits.push({id:DESIGNATED,source:MARK_SOURCE,turns:2});
  Object.assign(g.player,g.exitPoint);assert.equal(g.exitBlocked,'');assert.ok(g.descend());
  assert.equal(marks(g).length,0,'another floor: the mark is gone');
  const kept=g.floorStates[1].enemies.find(e=>e.id==='kept-boss');assert.equal(kept.markReady,b.markReady);assert.equal(kept.special,'gun');
  g.player.traits.push({id:DESIGNATED,source:MARK_SOURCE,turns:1});
  const back=Game.restore(g.serialize());assert.ok(back,'the archived floor is checked with its own turn');
  assert.equal(back.floorStates[1].enemies.find(e=>e.id==='kept-boss').special,'gun');assert.equal(marks(back).length,1);
  const raw=JSON.parse(g.serialize());raw.data.floorStates[1].enemies.find(e=>e.id==='kept-boss').special='x';assert.equal(Game.restore(JSON.stringify(raw)),null,'a bad kept one is refused');
  const stale=JSON.parse(g.serialize());stale.data.floorStates[1].enemies.find(e=>e.id==='kept-boss').markIntent={since:1};
  const loaded=Game.restore(JSON.stringify(stale));assert.ok(loaded,'a paint left on a fallen boss is dropped');assert.equal(loaded.floorStates[1].enemies.find(e=>e.id==='kept-boss').markIntent,undefined);
});

test('SAVE 82: a save from 81 loads unchanged, and a loyalist floor that already holds a warden keeps it',()=>{
  assert.equal(SAVE_VERSION,87);
  const g=field(),w=makeEnemy('warden',16,10,'old-warden',3,0,'loyalist');g.enemies.push(w);g.facilityFaction='loyalist';
  const raw=JSON.parse(g.serialize());raw.version=81;const loaded=Game.restore(JSON.stringify(raw));
  assert.ok(loaded);assert.equal(loaded.enemies.find(e=>e.id==='old-warden').type,'warden');
  const run=new Game(51,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});run.floor=3;run.loadFloor();
  const old=JSON.parse(run.serialize());old.version=81;for(const e of old.data.enemies)if(e.type==='designator')e.type='warden';
  const kept=Game.restore(JSON.stringify(old));assert.ok(kept);assert.ok(kept.enemies.some(e=>e.type==='warden')&&!kept.enemies.some(e=>e.type==='designator'),'no conversion');
});

// ---- 3.204.0 independent review: each finding's repro (qa/results/2026-09-29-claude-3.204.0-loyalist-bosses.md) -------
test('review 2: a boss with its gun set up, sweeping or packing up never fires at a mine or a decoy',()=>{
  for(const stage of ['set','sweep','pack']){
    const g=field(),b=boss(g,'gunline',16,10);
    b.gun=stage==='pack'?{stage:'pack',left:2}:{stage,origin:{x:16,y:10},aim:{x:10,y:10},...(stage==='sweep'?{left:2}:{})};
    g.mines=[{id:'mine-1-1',x:16,y:14,seen:[b.id]}];g.mineSerial=1;fixed(g,.999);g.player.traits=[];
    assert.ok(g.action('wait'));assert.equal(g.mines.length,1,`${stage}: the mine is left alone`);
    if(stage==='pack')assert.deepEqual(b.gun,{stage:'pack',left:1},'packing goes on');
    else assert.equal(suppressionStacks(g.player),1,`${stage}: the cone was swept on schedule`);
  }
  for(const stage of ['sweep','pack']){
    const g=field(),b=boss(g,'gunline',16,10);b.gun=stage==='pack'?{stage:'pack',left:2}:{stage,origin:{x:16,y:10},aim:{x:10,y:10},left:2};
    g.decoy={x:16,y:13,hp:30,maxHp:30,expires:g.turn+3,fooled:[b.id]};fixed(g,0);
    assert.ok(g.action('wait'));assert.equal(g.decoy?.hp,30,`${stage}: no shot at the decoy`);
  }
  // Without a gun it still shoots a mine it saw (the 3.145.0 rule is untouched).
  const k=field(),d=boss(k,'designator',16,10);d.markReady=99;k.mines=[{id:'mine-1-1',x:16,y:14,seen:[d.id]}];k.mineSerial=1;fixed(k,0);
  assert.ok(k.action('wait'));assert.equal(k.mines.length,0);
});

test('review 5: no 快速 or 紅外線 on the loyalist bosses; every other roll stays the same',()=>{
  const fast=ENEMY_AFFIXES.find(a=>a.id==='fast'),infrared=ENEMY_AFFIXES.find(a=>a.id==='infrared');
  for(const type of ['designator','gunline']){const e=makeEnemy(type,5,5,'x',6,0,'loyalist');assert.equal(fast.applies(e),false);assert.equal(infrared.applies(e),false);assert.deepEqual(ENEMY_TYPES[type].barredAffixes,['fast','infrared']);}
  assert.equal(fast.applies(makeEnemy('warden',5,5,'x',6,0,'loyalist')),true,'the warden keeps its rolls');
  // The same id, seed and floor: the designator gets exactly the warden's affixes but 快速 (the warden has native infrared).
  let compared=0;
  for(let seed=1;seed<=400;seed++){
    const d=rollEnemyAffixes(makeEnemy('designator',5,5,'3-boss',9,0,'loyalist'),seed,9,6),w=rollEnemyAffixes(makeEnemy('warden',5,5,'3-boss',9,0,'loyalist'),seed,9,6);
    const ids=e=>e.affixes.map(a=>a.id);assert.deepEqual(ids(d),ids(w).filter(id=>id!=='fast'),String(seed));if(ids(w).length)compared++;
  }
  assert.ok(compared>20,`${compared} seeds rolled something`);
  for(let seed=1;seed<=60;seed++)for(const floor of [3,6,9,12])for(const e of generate(seed,floor,[],0,'loyalist').enemies)if(['designator','gunline'].includes(e.type))assert.ok(!e.affixes.some(a=>['fast','infrared'].includes(a.id)),`${seed}:${floor}`);
});

test('review 7: the cone\'s +15 counts during the warning too; your units in the cone are shot and pinned too',()=>{
  const g=field(),c=boss(g,'gunline',16,10);c.gun={stage:'set',origin:{x:16,y:10},aim:{x:10,y:10}};c.moved=true;c.evasive=true;
  g.player.x=12;g.reveal();const front=g.accuracy(g.player,c).chance;g.player.x=20;g.reveal();
  assert.equal(gunFlank(g,g.player,c),G.flank);assert.equal(g.accuracy(g.player,c).chance-front,G.flank,'while it sets up');
  // A pet standing in the cone: shot at and suppressed like you; one outside it: untouched.
  const h=field(),b=boss(h,'gunline',16,10);b.gun={stage:'sweep',origin:{x:16,y:10},aim:{x:10,y:10},left:2};
  const pet=addAlly(h,'pet','crawler',{point:{x:11,y:11}});assert.ok(pet&&h.activeAllies.includes(pet));fixed(h,0);h.reveal();const hp=pet.hp;
  assert.ok(h.action('wait'));assert.ok(inGun(h,{gun:{stage:'sweep',origin:{x:16,y:10},aim:{x:10,y:10}}},pet),'still in the cone');
  assert.ok(pet.hp<hp,'shot');assert.equal(suppressionStacks(pet),2,'the cone\'s stack and the hit\'s');
});

test('review 7: the paint lands before a decoy or a mine can take the boss\'s turn, and a boss on a hazard steps off first',()=>{
  const g=field(),b=boss(g,'designator',16,10);assert.ok(g.action('wait'));assert.ok(b.markIntent);
  g.decoy={x:16,y:13,hp:30,maxHp:30,expires:g.turn+3,fooled:[b.id]};fixed(g,0);
  assert.ok(g.action('wait'));assert.equal(marks(g).length,1,'fooled by the decoy, it still marks you');assert.ok(g.decoy.hp<30,'and spends its turn on the decoy');
  const h=field(),c=boss(h,'designator',16,10);assert.ok(h.action('wait'));h.mines=[{id:'mine-1-1',x:16,y:14,seen:[c.id]}];h.mineSerial=1;fixed(h,0);
  assert.ok(h.action('wait'));assert.equal(marks(h).length,1,'a mine it saw does not put it off either');assert.equal(h.mines.length,0);
  // Standing in fire with the mark ready: it walks off before it paints.
  const k=field(),d=boss(k,'designator',16,10);k.fires=[{x:16,y:10,age:1}];assert.ok(k.action('wait'));
  assert.equal(d.markIntent,undefined,'no paint from a burning tile');assert.notDeepEqual([d.x,d.y],[16,10],'it stepped off');
});
