import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {Game,makeEnemy,WEAPONS,SAVE_VERSION} from '../src/engine.js';
import {generate} from '../src/world.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {FACTIONS,factionTraits,factionTraitRank} from '../src/faction-catalog.js';
import {startingTraits,traitLabels,cardTraitLabels,activeTrait,grantTrait,syncFactionTraits} from '../src/traits.js';
import {meleeSuppressionRank,suppressionStacks,pinned} from '../src/suppression.js';
import {attackRound,followUpRound} from '../src/pursuit.js';
import {addAlly} from '../src/allies.js';
import {tickNests} from '../src/runtime-enemies.js';
import {targetDetails} from '../src/target-card.js';
import {SWARM_BOSS_TUNING} from '../src/swarm-tuning.js';

// 3.208.0 (user decisions 2026-09-30, docs/SWARM.md section 14): the swarm's larvae exerted almost no pressure — they
// die to one round and were killed for free through pursuit. Three rule changes, larva and boss numbers untouched:
// agile larvae (swarm only), first-bullet pursuit (all factions) and 近戰壓制 N (the swarm's biters only).
const RANKS={fodder:1,brood:1,crawler:2,giant_bug:3,hive_beast:5,hive_matriarch:5};
const W=Object.fromEntries(WEAPONS.map((w,i)=>[w.id,i]));
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};
const quiet=g=>Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});

// ---- the override traits -------------------------------------------------------------------------------------------
test('the swarm override: agile larvae and 近戰壓制 N on its biters; the shared cards elsewhere keep theirs',()=>{
  for(const [type,n] of Object.entries(RANKS)){
    const e=makeEnemy(type,5,5,`s-${type}`,3,0,'swarm');
    assert.equal(meleeSuppressionRank(e),n,type);
    assert.ok(e.traits.some(t=>t.id==='melee_suppression'&&t.source==='faction:swarm'),`${type}: the trait is saved on the unit`);
    assert.ok(!e.traits.some(t=>'rank' in t),`${type}: the rank is the table's, not the save's`);
    assert.equal(activeTrait(e,'agile'),type==='brood',`${type}: only the larva is agile`);
  }
  // The legacy mix's fodder, larvae and crawlers, the loyalist and rebel dogs: exactly their card's traits.
  for(const [faction,types] of [['legacy',Object.keys(RANKS)],['loyalist',['crawler']],['rebel',['crawler']]])for(const type of types){
    const e=makeEnemy(type,5,5,`x-${type}`,3,0,faction);
    assert.deepEqual(e.traits,startingTraits(type,3),`${faction} ${type}`);assert.equal(meleeSuppressionRank(e),0);assert.equal(activeTrait(e,'agile'),false);
  }
  // Bombers explode, spitters spit and the infected shoot: no trait.
  for(const type of ['bomber','spitter','rifleman_infected','raider_infected'])assert.equal(meleeSuppressionRank(makeEnemy(type,5,5,'n',3,0,'swarm')),0,type);
  // Only the swarm's table adds traits.
  for(const [id,d] of Object.entries(FACTIONS))for(const [type,o] of Object.entries(d.overrides||{}))if(o.traits)assert.equal(id,'swarm',`${id} ${type}`);
  assert.deepEqual(factionTraits('swarm','brood'),[{id:'agile',source:'faction:swarm'},{id:'melee_suppression',source:'faction:swarm'}]);
  assert.deepEqual(factionTraits('legacy','brood'),[]);assert.deepEqual(factionTraits(undefined,'brood'),[]);
  // A rank belongs to the source that gave the trait: the same trait from anywhere else has none.
  assert.equal(factionTraitRank({type:'crawler',traits:[{id:'melee_suppression',source:'qa'}]},'melee_suppression'),0);
});

test('every swarm unit of those cards carries them wherever it comes from: generated floors and runtime births',()=>{
  let seen=0;
  for(const seed of [1,2,3])for(const floor of [1,2,3,5,6,7])for(const e of generate(seed,floor,[],0,'swarm').enemies)if(RANKS[e.type]){
    seen++;assert.equal(meleeSuppressionRank(e),RANKS[e.type],`${seed}:${floor} ${e.id}`);assert.equal(activeTrait(e,'agile'),e.type==='brood');
  }
  assert.ok(seen>=30,`${seen} swarm biters generated`);
  for(const e of generate(1,3).enemies)assert.equal(meleeSuppressionRank(e),0,`legacy ${e.id}`);
  // Runtime births (nests, burst hosts, the matriarch's sacs, waves) go through Game.spawnEnemy with the facility's faction.
  const g=affixArena();g.facilityFaction='swarm';const child=g.spawnEnemy('brood',12,12,'child');assert.equal(meleeSuppressionRank(child),1);assert.ok(activeTrait(child,'agile'));
  const l=affixArena();const old=l.spawnEnemy('brood',12,12,'child');assert.equal(meleeSuppressionRank(old),0);assert.equal(activeTrait(old,'agile'),false);
});

test('agile larvae: a shot at a swarm larva that moved is 13 worse than at the legacy one; standing still, the same',()=>{
  const g=affixArena();clearGeneratedMap(g);g.reveal();
  const swarm=makeEnemy('brood',14,10,'swarm-larva',1,0,'swarm'),legacy=makeEnemy('brood',10,14,'legacy-larva',1,0,'legacy');
  g.enemies.push(swarm,legacy);g.reveal();
  const chance=e=>g.accuracy(g.player,e).chance;
  assert.equal(chance(swarm),chance(legacy),'standing still: agile does not apply');
  for(const e of [swarm,legacy]){e.moved=true;e.moveDelta=[-1,0];}
  assert.equal(chance(legacy)-chance(swarm),13,'moved: −35 instead of −22');
});

// ---- first-bullet pursuit ------------------------------------------------------------------------------------------
// An open floor, every round a hit for its least damage (rng 0), and nobody else acting.
function range(character='soldier'){
  const g=new Game(3,[],0,character);clearGeneratedMap(g);g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
  for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
  Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};fixed(g,0);quiet(g);g.reveal();return g;
}
const larva=(g,x,y,hp)=>{const e=makeEnemy('brood',x,y,`larva-${g.enemies.length}`,g.floor);Object.assign(e,{hp,maxHp:Math.max(hp,6),alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;};
const hold=(g,id)=>{const p=g.player;let slot=p.owned.find(s=>g.weaponAt(s).id===id);if(slot===undefined){const item={x:p.x,y:p.y,type:'weapon',weapon:W[id]};g.registerWeapon(item);g.collectWeapon(item);slot=item.slot;}p.weapon=slot;p.ammo[slot]=Math.max(p.ammo[slot]||0,30);return slot;};
const impacts=(g,e)=>g.effects.filter(f=>f.type==='impact'&&f.from.x===e.x&&f.from.y===e.y).map(f=>f.damage);
// What one round of the weapon does to a larva at (13,10), measured on a copy of the set-up.
function perRound(character,weapon,x=13){const g=range(character);hold(g,weapon);const e=larva(g,x,10,1000);g.fire();const d=impacts(g,e);assert.ok(d.length>1&&d.every(v=>v===d[0]),`${weapon}: equal rounds ${d}`);return d[0];}

test('first-bullet pursuit: a burst earns it only when its first round makes the kill; a later round is a paid turn',()=>{
  for(const [character,weapon] of [['recon','smg'],['soldier','rifle'],['bulwark','lmg']]){
    const D=perRound(character,weapon);
    {const g=range(character);hold(g,weapon);const e=larva(g,13,10,D);assert.ok(g.action('fire'));assert.ok(e.hp<=0);assert.equal(g.pursuit,1,`${weapon}: the first round killed it`);}
    {const g=range(character),slot=hold(g,weapon),ammo=g.player.ammo[slot],turn=g.turn;const e=larva(g,13,10,D+1);assert.ok(g.action('fire'));
     assert.ok(e.hp<=0);assert.equal(ammo-g.player.ammo[slot],2,`${weapon}: the burst stopped at the kill on its second round`);
     assert.equal(g.turn,turn+1);assert.equal(g.pursuit,0,`${weapon}: killed on the second round, no token`);}
  }
  // Blind fire goes through the same burst.
  const D=perRound('soldier','rifle');
  for(const [hp,token] of [[D,1],[D+1,0]]){
    const g=range();hold(g,'rifle');const e=larva(g,13,10,hp);e.alert=false;g.smoke=[{cells:[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:13+dx,y:10+dy})),expires:g.turn+6}];g.reveal();
    assert.equal(g.teamVisible(e),false);assert.ok(g.action('blindFire',{x:13,y:10}));assert.ok(e.hp<=0);assert.equal(g.pursuit,token,`blind fire, larva ${hp}`);
  }
  // The suppressive fire skill: its rounds too.
  for(const [hp,token] of [[D,1],[D+1,0]]){
    const g=range(),p=g.player;hold(g,'rifle');p.skills.push('suppressive_fire');p.prepared.skill='suppressive_fire';const e=larva(g,13,10,hp);
    assert.ok(g.action('suppressiveFire',{x:13,y:10}));assert.ok(e.hp<=0);assert.equal(g.pursuit,token,`suppressive fire, larva ${hp}`);
  }
});

test('first-bullet pursuit: a round\'s blast belongs to it (the launcher inside a burst); a chainsaw\'s later cuts are follow-ups',()=>{
  // 雷霆 fires three explosive rounds at a rifleman; the larva beside it is caught by each blast.
  const blast=(()=>{const g=range();hold(g,'thunder');const r=makeEnemy('rifleman',13,10,'r',1);Object.assign(r,{hp:5000,maxHp:5000,alert:true});g.enemies.push(r);g.target=r.id;const e=larva(g,13,11,1000);g.target=r.id;g.fire();return impacts(g,e);})();
  assert.ok(blast.length===3&&blast.every(v=>v===blast[0]),`three equal blasts ${blast}`);
  for(const [hp,pending] of [[blast[0],true],[blast[0]+1,false]]){
    const g=range();hold(g,'thunder');const r=makeEnemy('rifleman',13,10,'r',1);Object.assign(r,{hp:5000,maxHp:5000,alert:true});g.enemies.push(r);const e=larva(g,13,11,hp);g.target=r.id;g.reveal();
    g.pursuitPending=false;g.fire();assert.ok(e.hp<=0);assert.equal(g.pursuitPending,pending,`larva ${hp}: blast of round ${pending?1:2}`);
  }
  // The chainsaw: ten cuts in one action. (Its bite costs your next action, so it never keeps a token anyway: the rule
  // is read where it is made, Game.hurt.)
  const cut=(()=>{const g=range('berserker'),slot=hold(g,'chainsaw');g.player.meleeSlot=slot;const e=larva(g,11,10,1000);g.strike(null,slot);return impacts(g,e);})();
  assert.ok(cut.length===10,`ten cuts ${cut}`);
  for(const [hp,pending] of [[cut[0],true],[cut[0]+1,false]]){
    const g=range('berserker'),slot=hold(g,'chainsaw');g.player.meleeSlot=slot;const e=larva(g,11,10,hp);g.pursuitPending=false;g.strike(null,slot);
    assert.ok(e.hp<=0);assert.equal(g.pursuitPending,pending,`chainsaw, larva ${hp}`);
  }
});

test('first-bullet pursuit: one shell, one blow or one grenade is a first round; an anchored second attack has a first round of its own',()=>{
  // A shotgun shell: all its pellets at once, two larvae down.
  {const g=range();hold(g,'shotgun');const a=larva(g,12,10,6),b=larva(g,12,11,6);g.target=a.id;assert.ok(g.action('fire'));assert.ok(a.hp<=0&&b.hp<=0);assert.equal(g.pursuit,1);}
  // A blow (bump) and a grenade.
  {const g=range();larva(g,11,10,6);assert.ok(g.action('move',[1,0]));assert.equal(g.pursuit,1,'a bump');}
  {const g=range(),p=g.player;p.grenades=1;p.prepared.grenade='frag';larva(g,13,10,6);assert.ok(g.action('grenade',{x:13,y:10}));assert.equal(g.pursuit,1,'a grenade');}
  // Anchored, the bulwark attacks twice: five rounds leave the larva at 1, the second attack's first round kills it.
  const D=perRound('bulwark','lmg');
  const g=range('bulwark');hold(g,'lmg');g.player.skillState.anchor.remaining=1;const e=larva(g,13,10,5*D+1),turn=g.turn;
  assert.ok(g.action('fire'));assert.ok(e.hp<=0);assert.equal(g.turn,turn+1);assert.equal(g.pursuit,1,'the second attack\'s first round');
  // The scope itself: only rounds after the first, nested inside an outer attack's, and gone after it.
  const s={};assert.equal(followUpRound(s),false);
  attackRound(s,0,()=>assert.equal(followUpRound(s),false));
  attackRound(s,1,()=>{assert.equal(followUpRound(s),true);attackRound(s,0,()=>assert.equal(followUpRound(s),true,'inside a follow-up round'));});
  assert.equal(followUpRound(s),false);
  assert.throws(()=>attackRound(s,2,()=>{throw new Error('x');}));assert.equal(followUpRound(s),false,'even when the round throws');
});

// ---- 近戰壓制 N ------------------------------------------------------------------------------------------------------
function field(character='soldier'){
  const g=affixArena(character);clearGeneratedMap(g);g.fires=undefined;g.flares=[];g.facilityFaction='swarm';
  Object.assign(g.player,{hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;
}
const unit=(g,type,x,y,id=type,faction='swarm')=>{const e=makeEnemy(type,x,y,id,1,0,faction);Object.assign(e,{hp:600,maxHp:600,alert:true,lastKnown:{x:g.player.x,y:g.player.y}});g.enemies.push(e);g.reveal();return e;};
// Beside its target with a blow wound up: its turn is the blow.
const windUp=(e,p)=>Object.assign(e,{charge:true,windup:1,aim:{x:p.x,y:p.y},focusTarget:p.id||'player'});
const pet=(g,x,y)=>{const a=addAlly(g,'pet','crawler',{point:{x,y}});a.hp=a.maxHp=300;g.reveal();return a;};

test('近戰壓制: a blow that lands gives its rank in stacks — larva 1, hunter 2, giant bug 3; a miss or a legacy card none',()=>{
  for(const [type,faction,stacks] of [['brood','swarm',1],['fodder','swarm',1],['crawler','swarm',2],['giant_bug','swarm',3],['crawler','legacy',0],['crawler','loyalist',0],['brood','legacy',0]]){
    const g=field(),e=windUp(unit(g,type,11,10,type,faction),g.player),hp=g.player.hp;
    if(type==='fodder')e.actionDelay=0;
    fixed(g,0);g.enemyAct(e);assert.ok(g.player.hp<hp,`${faction} ${type} bit`);
    assert.equal(suppressionStacks(g.player),stacks,`${faction} ${type}`);
  }
  {const g=field(),e=windUp(unit(g,'giant_bug',11,10),g.player);fixed(g,0);g.enemyAct(e);assert.ok(pinned(g.player),'three stacks pin you');}
  {const g=field(),e=windUp(unit(g,'crawler',11,10),g.player),hp=g.player.hp;fixed(g,.999);g.enemyAct(e);assert.equal(g.player.hp,hp);assert.equal(suppressionStacks(g.player),0,'a miss gives nothing');}
});

test('近戰壓制: resistance subtracts, machines are immune, your units count; the blind blow and the pounce\'s bite too',()=>{
  // The bulwark and the berserker (resistance 1) shrug off a larva and take one less from the rest.
  for(const character of ['bulwark','berserker'])for(const [type,stacks] of [['brood',0],['crawler',1],['giant_bug',2]]){
    const g=field(character),e=windUp(unit(g,type,11,10),g.player);fixed(g,0);g.enemyAct(e);assert.equal(suppressionStacks(g.player),stacks,`${character} ${type}`);
  }
  // Your pet, bitten, is suppressed; a drone is a machine.
  {const g=field();g.player.x=3;g.reveal();const a=pet(g,12,10),e=windUp(unit(g,'crawler',13,10),a);fixed(g,0);g.enemyAct(e);assert.ok(a.hp<300);assert.equal(suppressionStacks(a),2,'your pet');}
  {const g=field();g.player.x=3;g.reveal();const a=addAlly(g,'drone','drone',{point:{x:12,y:10}});g.reveal();const hp=a.hp,e=windUp(unit(g,'giant_bug',13,10),a);fixed(g,0);g.enemyAct(e);assert.ok(a.hp<hp,'the drone was hit');assert.equal(suppressionStacks(a),0,'a machine is immune');assert.ok(!a.suppression);}
  // The blind blow: its next step toward where it last saw you is your tile (your signal break hides you; the swarm
  // sees through the dark and a blow beside you sees through smoke).
  {const g=field(),e=unit(g,'crawler',11,10);g.player.skillState.signal_break={remaining:2,cooldown:0};g.reveal();assert.equal(g.sight(e,g.player),false);
   const hp=g.player.hp;fixed(g,0);g.enemyAct(e);assert.ok(g.player.hp<hp,'a blind blow');assert.deepEqual([e.x,e.y],[11,10]);assert.equal(suppressionStacks(g.player),2);}
  // The hunter's pounce: it crouches, then lands beside you and bites.
  {const g=field(),e=unit(g,'crawler',13,10);fixed(g,0);g.enemyAct(e);assert.ok(e.pounceIntent,'crouched');const hp=g.player.hp;g.enemyAct(e);
   assert.equal(e.pounceIntent,undefined);assert.ok(g.player.hp<hp,'bitten on landing');assert.equal(suppressionStacks(g.player),2);}
  // Review fix (a bug since 3.133.0): with one of your units nearer the bug than you, the pounce still lands beside you
  // and bites you, not your unit across the room.
  {const g=field(),e=unit(g,'crawler',13,10),a=addAlly(g,'survivor','rifleman',{point:{x:14,y:11}});a.hp=a.maxHp=300;g.reveal();
   fixed(g,0);g.enemyAct(e);assert.ok(e.pounceIntent,'crouched at you');assert.equal(g.enemyTarget(e),a,'the tree would pick your unit');
   const hp=g.player.hp;g.enemyAct(e);assert.deepEqual([e.x,e.y],[11,10],'landed beside you');
   assert.ok(g.player.hp<hp,'you are bitten');assert.equal(suppressionStacks(g.player),2);assert.equal(a.hp,300,'your unit is untouched');assert.equal(suppressionStacks(a),0);}
});

const C=SWARM_BOSS_TUNING.charge;
const tongueOnly=e=>{if(e.type==='hive_beast')e.chargeCooldown=C.cooldown;if(e.type==='hive_matriarch')e.nestCooldown=SWARM_BOSS_TUNING.nest.cooldown;return e;};
test('近戰壓制 5: the swarm bosses\' tongue bite and charge suppress whoever they hit — you, your units, their own kind, a civilian',()=>{
  // The tongue's bite on you.
  {const g=field(),e=tongueOnly(unit(g,'hive_beast',15,10));g.enemyAct(e);assert.ok(e.tongueIntent);fixed(g,0);g.enemyAct(e);assert.deepEqual([g.player.x,g.player.y],[14,10]);assert.equal(suppressionStacks(g.player),5);}
  // Whoever is on the line first.
  for(const who of ['pet','crawler','civilian','giant_bug']){
    const g=field(),e=tongueOnly(unit(g,'hive_matriarch',15,10));g.enemyAct(e);assert.ok(e.tongueIntent,who);
    const body=who==='pet'?pet(g,12,10):unit(g,who,12,10,`in-the-way-${who}`,who==='civilian'?'loyalist':'swarm');body.alert=false;const hp=body.hp;
    fixed(g,0);g.enemyAct(e);assert.ok(body.hp<hp,`${who} bitten`);
    assert.equal(suppressionStacks(body),who==='giant_bug'?4:5,`${who}: 5, less its resistance`);assert.equal(suppressionStacks(g.player),0,'you were behind it');
  }
  // The charge: everyone on the lane, on top of the shove and the knock-down.
  {const g=field(),e=unit(g,'hive_beast',16,10);g.enemyAct(e);assert.ok(e.chargeIntent);
   const a=pet(g,14,10),bug=unit(g,'giant_bug',12,10,'big');bug.alert=false;fixed(g,0);g.enemyAct(e);
   assert.equal(suppressionStacks(g.player),5);assert.equal(suppressionStacks(a),5);assert.equal(suppressionStacks(bug),4,'its own kind, less its resistance');
   assert.equal(g.player.control.disabled,C.disabled,'still knocked down');}
  // Not the delisted berserker, which borrows the same charge and grapple: it has no such trait.
  {const g=field(),e=unit(g,'delisted_berserker',16,10,'op','rebel');e.tongueCooldown=9;g.enemyAct(e);assert.ok(e.chargeIntent);fixed(g,0);g.enemyAct(e);assert.ok(g.player.hp<999);assert.equal(suppressionStacks(g.player),0);}
});

// ---- saves ---------------------------------------------------------------------------------------------------------
const stripped=e=>({...e,traits:e.traits.filter(t=>!t.source.startsWith('faction:'))});
// A swarm round trip: floor 2's nest lets out a larva, then floor 2 is kept and floor 3 holds the hive beast.
function swarmTrip(){
  const g=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'swarm'});
  Object.assign(g.player,g.exitPoint);assert.equal(g.exitBlocked,'');assert.ok(g.descend());
  const nest=g.props.find(p=>p.type==='nest');assert.ok(nest);
  const near=[[-2,0],[2,0],[0,-2],[0,2]].map(([dx,dy])=>({x:nest.x+dx,y:nest.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.x===q.x&&e.y===q.y));
  Object.assign(g.player,near);tickNests(g);const child=g.enemies.find(e=>e.type==='brood');assert.ok(child,'a larva');
  Object.assign(g.player,g.exitPoint);assert.equal(g.exitBlocked,'');assert.ok(g.descend());assert.equal(g.floor,3);
  assert.ok(g.floorStates[2].enemies.some(e=>e.id===child.id),'the larva is on the kept floor');assert.ok(g.enemies.some(e=>e.type==='hive_beast'));
  return {g,child};
}
test('SAVE 86: swarm units in an older save get their traits — this floor and a kept one; the legacy mix is untouched',()=>{
  assert.equal(SAVE_VERSION,94);
  const {g,child}=swarmTrip();
  const raw=JSON.parse(g.serialize());raw.version=85;
  raw.data.enemies=raw.data.enemies.map(stripped);for(const f of Object.values(raw.data.floorStates))f.enemies=f.enemies.map(stripped);
  const back=Game.restore(JSON.stringify(raw));assert.ok(back,'loads');
  const all=[...back.enemies,...Object.values(back.floorStates).flatMap(f=>f.enemies)];let n=0;
  for(const e of all)if(RANKS[e.type]){n++;assert.equal(meleeSuppressionRank(e),RANKS[e.type],e.id);assert.equal(activeTrait(e,'agile'),e.type==='brood',e.id);}
  assert.ok(n>=10&&all.some(e=>e.id===child.id)&&back.enemies.some(e=>e.type==='hive_beast'&&meleeSuppressionRank(e)===5));
  assert.deepEqual(back.floorStates[2].enemies.find(e=>e.id===child.id).traits,child.traits,'the kept larva as a new one is made');
  // Loaded again as it is now: nothing doubled.
  const again=Game.restore(back.serialize());assert.deepEqual(again.enemies.map(e=>e.traits),back.enemies.map(e=>e.traits));
  // A legacy run's larvae and crawlers are left as they were.
  const l=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'legacy'});assert.ok(l.enemies.some(e=>['fodder','crawler'].includes(e.type)));
  const lr=JSON.parse(l.serialize());lr.version=85;const lb=Game.restore(JSON.stringify(lr));assert.ok(lb);assert.deepEqual(lb.enemies.map(e=>e.traits),l.enemies.map(e=>e.traits));
  // A current save missing them (hand-edited) still loads: only broken data is refused.
  const bare=JSON.parse(g.serialize());bare.data.enemies=bare.data.enemies.map(stripped);assert.ok(Game.restore(JSON.stringify(bare)));
  // syncFactionTraits on its own: idempotent, and it never passes the cap.
  const e=makeEnemy('crawler',1,1,'c',1,0,'swarm'),copy=structuredClone(e);syncFactionTraits({enemies:[e]});assert.deepEqual(e,copy);
  const full=makeEnemy('brood',1,1,'b',1,0,'swarm');full.traits=[...Array(67)].map((_,i)=>({id:'fast',source:'qa-'+i}));syncFactionTraits({enemies:[full]});
  assert.equal(full.traits.length,68,'one of the two fits under the cap');
});

// Review (3.208.0): the faction traits follow the table on every load, not only once, without moving anything else.
test('every load re-syncs faction traits to the table: a trait it drops is dropped, one it adds is added; unchanged, the list is untouched',()=>{
  const {g,child}=swarmTrip();
  // A larva on the kept floor with a timed trait after its faction ones (a remove-and-reappend would reorder them).
  const kept=g.floorStates[2].enemies.find(e=>e.id===child.id);grantTrait(kept,'fast','qa',3);
  const hunter=g.enemies.find(e=>e.type==='crawler');grantTrait(hunter,'slow','qa',2);
  const raw=g.serialize(),before=JSON.parse(raw).data;
  // Unchanged table: every enemy's list, here and kept, byte for byte; and the sync itself reassigns nothing.
  const back=Game.restore(raw);assert.ok(back);
  const lists=d=>JSON.stringify([d.enemies.map(e=>e.traits),Object.values(d.floorStates).map(f=>f.enemies.map(e=>e.traits))]);
  assert.equal(lists(back),lists(before));
  const units=d=>[...d.enemies,...Object.values(d.floorStates).flatMap(f=>f.enemies)];
  const arrays=units(back).map(e=>e.traits);syncFactionTraits(back);
  assert.ok(units(back).every((e,i)=>e.traits===arrays[i]),'the same arrays');
  // A later table: the larva loses its agility, the hunter gains night vision; the rest keeps its order.
  const o=FACTIONS.swarm.overrides,old={brood:o.brood.traits,crawler:o.crawler.traits};
  try{
    o.brood.traits=[{id:'melee_suppression',rank:1}];o.crawler.traits=[{id:'melee_suppression',rank:2},{id:'night_vision'}];
    const later=Game.restore(raw);assert.ok(later,'still loads');
    const larva=later.floorStates[2].enemies.find(e=>e.id===child.id),h=later.enemies.find(e=>e.id===hunter.id);
    assert.equal(activeTrait(larva,'agile'),false,'dropped on the kept floor');assert.deepEqual(larva.traits,kept.traits.filter(t=>t.id!=='agile'));
    assert.deepEqual(h.traits,[...hunter.traits,{id:'night_vision',source:'faction:swarm'}],'appended after everything it had');
    assert.equal(meleeSuppressionRank(h),2);
    // Gone from the table entirely: no rankless label, no effect.
    o.crawler.traits=[];const none=Game.restore(raw).enemies.find(e=>e.id===hunter.id);
    assert.equal(meleeSuppressionRank(none),0);assert.ok(!none.traits.some(t=>t.source.startsWith('faction:')));assert.ok(!traitLabels(none).some(l=>l.includes('近戰壓制')));
  }finally{o.brood.traits=old.brood;o.crawler.traits=old.crawler;}
});

// ---- the label -----------------------------------------------------------------------------------------------------
test('the label: 近戰壓制 N 階 on the target card and in the hostile database; English too',()=>{
  const g=field();quiet(g);
  const labels=(type,faction)=>cardTraitLabels(type,3,faction);
  const card=(type,faction='swarm')=>{g.enemies=[];const e=unit(g,type,13,10,type,faction);g.target=e.id;g.reveal();return targetDetails(g).traits;};
  assert.match(card('crawler'),/近戰壓制 2 階/);assert.match(card('brood'),/敏捷.*近戰壓制 1 階|近戰壓制 1 階.*敏捷/);
  assert.match(card('hive_beast'),/壓制抗性 1 階/);assert.match(card('hive_beast'),/近戰壓制 5 階/);
  assert.doesNotMatch(card('crawler','legacy'),/近戰壓制/);assert.doesNotMatch(card('brood','legacy'),/敏捷/);
  // The database lists a card the way the facility's units carry it (controller-screens.js bestiary; tools/text-play.mjs).
  assert.ok(labels('giant_bug','swarm').includes('近戰壓制 3 階'));assert.ok(labels('brood','swarm').includes('敏捷'));
  assert.ok(!labels('giant_bug','legacy').some(l=>l.includes('近戰壓制')));assert.ok(!labels('brood',undefined).includes('敏捷'));
  const script=`const {cardTraitLabels,TRAITS}=await import('./src/traits.js');console.log(JSON.stringify({crawler:cardTraitLabels('crawler',3,'swarm'),text:TRAITS.melee_suppression.text}));`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),env:{...process.env,ASH_LANGUAGE:'en'},encoding:'utf8'});
  const out=JSON.parse(r.stdout);assert.ok(out.crawler.includes('Melee Suppression rank 2'),out.crawler.join());assert.match(out.text,/suppression stacks as its rank/);
});
