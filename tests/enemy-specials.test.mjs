import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ENEMY_TYPES,ENEMY_AFFIXES,makeEnemy,giveEnemyAffix} from '../src/engine.js';
import {ORDER,registered,specialDef,topCarriers} from '../src/enemy-specials.js';
import {specialMatrices,matrixDifferences,MATRIX_FIXTURE} from '../qa/special-matrix.mjs';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.206.1 (src/enemy-specials.js, docs/CHECKLIST.md 2): every enemy special is declared once, and the turn, the round
// start, the decoy and the mine, the hazard step, suppression, interruptions, the loader and the target card ask the
// declarations. A behaviour-neutral refactor: the goldens (qa/special-matrix.mjs) were recorded before it.

test('every special in ORDER is declared, and every step point it names is registered',()=>{
 const r=registered();
 assert.deepEqual([...r.specials].sort(),[...ORDER.ids].sort(),'ORDER.ids and the declarations');
 for(const step of ['start','top','attack','rally','end'])assert.deepEqual([...r.steps[step]].sort(),[...ORDER[step]].sort(),`ORDER.${step} and its steps`);   // end: 3.207.0
 for(const id of ORDER.tick.flat()){const s=specialDef(id);assert.ok(s.fields[s.tick?.cooldown]?.count,`${id}: its tick counts down a declared count`);assert.equal(typeof s.tick.drop,'function',id);}
 for(const id of ORDER.card)assert.equal(typeof specialDef(id).card,'function',`${id}: a card line`);
 for(const id of ORDER.ids){
  const s=specialDef(id);
  if(s.tick)assert.ok(ORDER.tick.flat().includes(id),`${id} ticks outside ORDER.tick`);
  if(s.card)assert.ok(ORDER.card.includes(id),`${id} has a card line outside ORDER.card`);
  if(s.interrupt?.cooldown)assert.ok(s.fields[s.interrupt.cooldown]?.count,`${id}: its interruption restarts a declared count`);
  if(s.load?.restart)assert.ok(s.fields[s.load.restart]?.count,`${id}: a drop on load restarts a declared count`);
  for(const [what,b] of Object.entries(s.blocks||{}))assert.ok(['decoy','mine','stepOff','pin'].includes(what)&&(b===true||typeof b==='function'),`${id} blocks ${what}`);
 }
});

test('each field has one owner, and the registry refuses a second (and anything ORDER does not name)',async()=>{
 const owners=new Map();
 for(const id of ORDER.ids)for(const k of Object.keys(specialDef(id).fields)){assert.ok(!owners.has(k),`${k}: ${owners.get(k)} and ${id}`);owners.set(k,id);}
 assert.equal(owners.get('special'),undefined,'`special` belongs to no one: each carrier says which values it may take (rotation)');
 // A fresh copy of the leaf has a registry of its own.
 const fresh=await import('../src/enemy-specials.js?registry-rules');
 fresh.registerSpecial({id:'lob',intent:'lobIntent',fields:{lobIntent:{valid:()=>true}}});
 assert.throws(()=>fresh.registerSpecial({id:'lob',intent:'lobIntent'}),/declared twice/);
 assert.throws(()=>fresh.registerSpecial({id:'pounce',intent:'pounceIntent',fields:{lobIntent:{valid:()=>true}}}),/lobIntent: owned by lob and pounce/);
 assert.throws(()=>fresh.registerSpecial({id:'nosuch',intent:'x'}),/not in ORDER\.ids/);
 assert.throws(()=>fresh.registerSpecial({id:'nest',intent:'nestIntent',interrupt:{on:['bored']}}),/unknown interrupt reason/);
 assert.throws(()=>fresh.registerSpecial({id:'mark',intent:'markIntent',fields:{markReady:{valid:()=>true}},interrupt:{on:['death'],cooldown:'markReady'}}),/not a count field/);
 assert.throws(()=>fresh.registerStep('top','nosuch',()=>false,()=>true),/not in ORDER/);
 assert.throws(()=>fresh.registerStep('top','lob',()=>false),/say whom it carries/);
 fresh.registerStep('start','mark',()=>{});assert.throws(()=>fresh.registerStep('start','mark',()=>{}),/registered twice/);
});

test('the goldens: every special\'s interruptions, blocks, round start and saves are as recorded before the registry',()=>{
 const base=JSON.parse(readFileSync(MATRIX_FIXTURE,'utf8')),diff=matrixDifferences(base,specialMatrices());
 assert.deepEqual(diff.slice(0,5),[],`${diff.length} cells differ from tests/fixtures/special-matrix.json (node qa/special-matrix.mjs lists them)`);
});

test('no unit is carried by two top steps: the first that acts would hide the other',()=>{
 const seen=new Map(ORDER.top.map(id=>[id,0]));
 for(const type of Object.keys(ENEMY_TYPES))for(const faction of ['loyalist','rebel','swarm','legacy']){
  const e=makeEnemy(type,1,1,`t-${type}`,3,0,faction),units=[e];
  // The affixes that bring a top step with them (3.206.2: the grenadier's primed throw).
  for(const id of ['flamer','grenadier'])if(ENEMY_AFFIXES.find(a=>a.id===id).applies(e)){const f=structuredClone(e);giveEnemyAffix(f,id);units.push(f);}
  for(const u of units){const steps=topCarriers(u);assert.ok(steps.length<=1,`${type} (${faction}${u.affixes?.length?`, ${u.affixes.map(a=>a.id)}`:''}): ${steps}`);for(const id of steps)seen.set(id,seen.get(id)+1);}
 }
 for(const [id,n] of seen)assert.ok(n>0,`the top step ${id} carries some unit`);
});

// Going off in place of the shot, a special leaves no shot wound up behind it (docs/CHECKLIST.md 2: 取代普通攻擊時重置),
// even one something else wound up for it (a squad's 已就緒, a watch order). 3.206.1 found seven that left it standing
// (the arsonist's spray, wall and ring, both sweeps, a missed pounce, the lob, the grenade); 3.206.2 clears it for all.
const KEPT=[];
test('a special that goes off leaves no shot wound up behind it',()=>{
 const E={x:13,y:10},T={x:10,y:10},at=q=>({x:q.x,y:q.y});
 const cases={
  flame:{card:'rifleman',affixes:['flamer'],state:{flameIntent:{origin:at(E),aim:at(T)}}},
  spray:{card:'arsonist',faction:'rebel',state:{flameIntent:{origin:at(E),aim:at(T)},heat:1}},
  wall:{card:'arsonist',faction:'rebel',state:{fireIntent:{kind:'wall',origin:at(E),cells:[{x:9,y:10},{x:8,y:10}]},special:'ring'}},
  burnSweep:{card:'burnline',faction:'rebel',state:{burn:{stage:'sweep',origin:at(E),aim:at(T),left:2},special:'mark'}},
  burnPack:{card:'burnline',faction:'rebel',state:{burn:{stage:'pack',left:2},special:'mark'}},
  gunSweep:{card:'gunline',state:{gun:{stage:'sweep',origin:at(E),aim:at(T),left:2},special:'mark'}},
  gunPack:{card:'gunline',state:{gun:{stage:'pack',left:2},special:'mark'}},
  tongue:{card:'hive_beast',faction:'swarm',state:{tongueIntent:{origin:at(E),target:at(T),point:{x:12,y:10}}}},
  charge:{card:'hive_beast',faction:'swarm',state:{chargeIntent:{origin:at(E),dir:{x:-1,y:0}}}},
  pounceHit:{card:'crawler',faction:'swarm',state:{pounceIntent:{origin:at(E),target:at(T),point:{x:11,y:10}}}},
  pounceMiss:{card:'crawler',faction:'swarm',state:{pounceIntent:{origin:at(E),target:{x:10,y:11},point:{x:11,y:11}}}},
  lob:{card:'spitter',faction:'swarm',state:{lobIntent:{origin:at(E),point:at(T)}}},
  grenade:{card:'raider',affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:at(E)}}},
  // 3.207.0: the delisted soldier's grenade and the delisted recon's smoke.
  opGrenade:{card:'delisted_soldier',state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:at(E)},scanCooldown:5}},
  smoke:{card:'delisted_recon',state:{smokeIntent:{origin:at(E),point:{x:11,y:10}}}},
 };
 const kept=[];
 for(const [id,c] of Object.entries(cases)){
  const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];Object.assign(g.player,{hp:999,maxHp:999});
  const e=makeEnemy(c.card,E.x,E.y,'u',3,0,c.faction||'loyalist');e.hp=e.maxHp=500;e.alert=true;
  for(const a of c.affixes||[]){giveEnemyAffix(e,a);e.affixes.find(x=>x.id===a).revealed=true;}
  Object.assign(e,structuredClone(c.state));g.enemies.push(e);g.reveal();
  Object.assign(e,{charge:true,aim:{x:10,y:10},windup:2,focusTarget:'player'});
  g.enemyAct(e);
  assert.ok(e.hp>0,`${id}: still standing`);
  assert.ok(g.effects.length>0,`${id}: it went off`);
  if(e.charge)kept.push(id);
 }
 assert.deepEqual(kept,KEPT);
});
