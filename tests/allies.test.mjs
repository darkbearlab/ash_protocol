import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {CHARACTERS} from '../src/characters.js';
import {DRONE_REPAIR_COST,droneRepairReason,addAlly,allyWeapon,allyAct,canAllySkill,commandPet,carryCandidates,departAllies,arriveAllies,corpsePool,validAllies,PET_REGEN,PET_MEDKIT_FRACTION,PET_TETHER} from '../src/allies.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {grantTrait} from '../src/traits.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(character='engineer'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];g.allySerial=0;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
}
const drone=(g,point={x:11,y:10},status='active',sourceId='drone_follow')=>addAlly(g,'drone','drone',{point,status,sourceId});
const pet=(g,point={x:11,y:10})=>addAlly(g,'pet','crawler',{point,sourceId:'pet_command'});
const enemy=(g,x=14,y=10,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);g.enemies.push(e);return e;};
const use=g=>g.action('usePrepared',{category:'skill'});
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});

test('six free classes restore with their actual starting allies and skills without changing old classes',()=>{
 for(const id of Object.keys(CHARACTERS)){const g=new Game(330,[],0,id,'onyx');assert.ok(Game.restore(g.serialize()),id);assert.equal(g.allies.length,['engineer','druid'].includes(id)?1:0);assert.equal(g.player.hp,CHARACTERS[id].hp);}
});
test('drone deployment spends a turn and real ammo, new deployment cannot shoot immediately',()=>{
 const g=arena(),a=drone(g,{x:10,y:10},'packed'),e=enemy(g);g.reveal();zero(g);const rounds=g.player.pistol;
 assert.ok(use(g));assert.equal(g.turn,2);assert.equal(g.player.pistol,rounds-12);assert.equal(a.ammo,12);assert.equal(e.hp,22);assert.equal(a.status,'active');
 g.action('wait');assert.equal(a.ammo,11);assert.ok(e.hp<22);
});
test('recovery retains injury and ammunition, refills only missing rounds, switching modes conserves ammo',()=>{
 const g=arena(),a=drone(g);a.ammo=3;a.hp=19;const pistol=g.player.pistol;assert.ok(use(g));assert.equal(a.status,'packed');assert.equal(a.hp,19);assert.equal(a.ammo,12);assert.equal(g.player.pistol,pistol-9);
 g.action('prepare',{category:'skill',id:'drone_sentry'});const rifle=g.player.reserve;assert.ok(use(g));assert.equal(a.sourceId,'drone_sentry');assert.equal(a.ammo,8);assert.equal(g.player.reserve,rifle-8);assert.equal(g.player.pistol,pistol+3);assert.equal(a.hp,19);
});
test('distant destroyed machine cannot be redeployed and the other skill cannot create a second chassis',()=>{
 const g=arena(),a=drone(g,{x:15,y:10});g.damageAlly(a,1000);const turn=g.turn;assert.equal(use(g),false);g.action('prepare',{category:'skill',id:'drone_sentry'});assert.equal(use(g),false);assert.equal(g.turn,turn);assert.equal(g.allies.length,1);assert.ok(Game.restore(g.serialize()));
});
test('stationary drone never moves and disconnected drones stop firing and granting sight',()=>{
 const g=arena(),a=drone(g,{x:18,y:10},'active','drone_sentry'),e=enemy(g,20);a.ammo=8;a.bornTurn=1;g.turn=2;zero(g);g.reveal();const before=e.hp;allyAct(g,a);assert.equal(a.x,18);assert.equal(a.ammo,8);assert.equal(e.hp,before);
 g.player.x=15;g.reveal();allyAct(g,a);assert.equal(a.x,18);assert.equal(a.ammo,7);
});
test('follow drone shoots only at its own position and follows its tether rather than chasing',()=>{
 const g=arena(),a=drone(g,{x:11,y:10});a.ammo=12;a.bornTurn=1;g.turn=2;enemy(g,17);zero(g);allyAct(g,a);assert.equal(a.x,11);assert.equal(a.ammo,12);
 g.player.x=7;allyAct(g,a);assert.equal(a.x,10);assert.equal(a.ammo,12);
});
test('pet destination commands are free, bounded, and execute on the next own opportunity',()=>{
 const g=arena('druid'),a=pet(g);const turn=g.turn,rng=g.rng.state();assert.ok(g.action('commandPet',{x:13,y:10}));assert.equal(g.turn,turn);assert.equal(g.rng.state(),rng);assert.equal(a.x,11);
 g.action('wait');assert.equal(a.x,12);g.action('wait');assert.equal(a.x,13);assert.equal(commandPet(g,{x:20,y:10}),false);assert.ok(g.action('commandPet',{x:10,y:10}));assert.equal(a.order,null);
});
// 3.37 (user decision) replaces the medkit rescue: a downed pet is recovered, heals while packed and steps back out.
test('a downed pet is recovered from an adjacent tile for one turn without medicine, then heals while packed',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,1000);assert.equal(a.status,'down');assert.equal(a.hp,0);g.player.meds=0;
 g.player.x=8;assert.equal(use(g),false);assert.equal(g.turn,1);assert.match(g.logs[0].text,/相鄰/);
 g.player.x=10;assert.ok(use(g));assert.equal(g.turn,2);assert.equal(a.status,'packed');assert.equal(a.hp,PET_REGEN);assert.equal(g.player.meds,0);assert.ok(!g.localAllies.includes(a));assert.ok(Game.restore(g.serialize()));
});
test('standing on the downed pet recovers it; a packed pet leaves the map and travels with the player',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,1000);g.player.x=11;assert.ok(use(g));assert.equal(a.status,'packed');
 assert.ok(departAllies(g).includes(a.id));g.floor=2;g.player.x=5;g.player.y=5;arriveAllies(g,[a.id]);assert.equal(a.floor,2);assert.ok(validAllies(g));assert.ok(Game.restore(g.serialize()));
});
test('a packed pet heals on paid turns only and steps out beside the player once whole while its skill is prepared',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,1000);assert.ok(use(g));a.hp=a.maxHp-2*PET_REGEN;
 g.action('prepare',{category:'skill',id:null});assert.equal(a.hp,a.maxHp-2*PET_REGEN);
 g.action('wait');g.action('wait');assert.equal(a.hp,a.maxHp);assert.equal(a.status,'packed');
 g.action('prepare',{category:'skill',id:'pet_command'});assert.equal(a.status,'packed');g.action('wait');
 assert.equal(a.status,'active');assert.equal(a.bornTurn,g.turn);assert.ok(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)<=2);assert.notEqual(a.x+','+a.y,g.player.x+','+g.player.y);assert.ok(Game.restore(g.serialize()));
});
test('a medkit adds half the pet health while packed for one turn; without one the skill gives a reason and costs nothing',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,1000);assert.ok(use(g));a.hp=10;g.player.meds=1;
 assert.ok(use(g));assert.equal(g.turn,3);assert.equal(g.player.meds,0);assert.equal(a.hp,10+Math.ceil(a.maxHp*PET_MEDKIT_FRACTION)+PET_REGEN);
 const turn=g.turn,hp=a.hp;assert.equal(use(g),false);assert.equal(g.turn,turn);assert.equal(a.hp,hp);assert.match(g.logs[0].text,/醫療包/);
});
test('the pet chases up to nine tiles from the player while other allies keep the six-tile tether',()=>{
 const g=arena('druid'),a=pet(g),e=enemy(g,18,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();for(let i=0;i<9;i++)g.action('wait');assert.ok(e.hp<500);assert.ok(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)<=PET_TETHER);
 const n=arena('necromancer'),s=addAlly(n,'summon','crawler',{sourceId:'raise_dead',point:{x:11,y:10}}),f=enemy(n,18,10);f.hp=500;n.enemyAct=()=>{};n.reveal();for(let i=0;i<9;i++)n.action('wait');assert.equal(f.hp,500);
});
test('only pets and drones may be packed in a save; a v25 save loads unchanged and its first local read is kept verbatim',async()=>{
 const g=arena('necromancer'),s=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:11,y:10}}),raw=JSON.parse(g.serialize());raw.data.allies[0].status='packed';assert.equal(Game.restore(JSON.stringify(raw)),null);
 const d=arena('druid'),a=pet(d);a.hp=37;const old=JSON.parse(d.serialize());old.version=25;const text=JSON.stringify(old),memory=new Map([['qa-ash-save',text],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?pet337'),restored=storage.loadGame();assert.ok(restored);assert.deepEqual(restored.allies,d.allies);assert.deepEqual(restored.player,d.player);assert.equal(restored.rng.state(),d.rng.state());assert.equal(memory.get('qa-ash-save-v25-backup'),text);assert.equal(memory.get('ash-save'),'untouched');
});
test('a fast lethal hit cancels paid rescue and consumes no medkit',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,1000);const e=enemy(g,14);e.charge=true;e.windup=1;grantTrait(e,'fast','test:fast');g.player.hp=1;zero(g);g.reveal();const meds=g.player.meds;assert.ok(use(g));assert.equal(g.status,'dead');assert.equal(a.status,'down');assert.equal(g.player.meds,meds);
});
test('necro consumes distinct actual corpses, excludes bosses, refills only missing slots and cannot recycle summons',()=>{
 const g=arena('necromancer');for(const type of ['rifleman','crawler','warden'])enemy(g,14+g.enemies.length,10,type).hp=0;zero(g);assert.ok(use(g));assert.equal(g.activeAllies.length,2);assert.equal(g.enemies.filter(e=>e.raised).length,2);assert.equal(corpsePool(g).length,0);assert.equal(g.player.skillState.raise_dead.cooldown,3);
 const survivors=g.activeAllies;survivors[0].hp=7;g.damageAlly(survivors[1],999);for(let i=0;i<3;i++)g.action('wait');assert.equal(use(g),false);enemy(g,18,10,'raider').hp=0;assert.ok(use(g));assert.equal(g.activeAllies.length,2);assert.equal(survivors[0].hp,7);assert.ok(Game.restore(g.serialize()));
});
test('summon selection is deterministic across restore and new summons wait until next turn',()=>{
 const g=arena('necromancer');for(const type of ['rifleman','raider','crawler'])enemy(g,16+g.enemies.length,10,type).hp=0;const saved=Game.restore(g.serialize());assert.ok(saved);use(g);use(saved);assert.deepEqual(g.allies,saved.allies);assert.equal(g.rng.state(),saved.rng.state());assert.ok(g.allies.every(a=>a.bornTurn===g.turn));
});
test('enemies select and damage closer allies, preserving player health',()=>{
 const g=arena('druid'),a=pet(g,{x:12,y:10}),e=enemy(g,15);a.order={x:12,y:10};e.charge=true;e.windup=1;g.reveal();zero(g);const hp=g.player.hp;g.action('wait');assert.equal(g.player.hp,hp);assert.ok(a.hp<90);assert.equal(g.enemyTarget(e),a);
});
test('friendly attacks earn normal enemy kill rewards, friendly deaths earn nothing',()=>{
 const g=arena(),a=drone(g),e=enemy(g,14);e.hp=1;a.ammo=12;a.bornTurn=1;g.turn=2;zero(g);const kills=g.player.kills;allyAct(g,a);assert.equal(g.player.kills,kills+1);const xp=g.player.xp,scrap=g.player.scrap;g.damageAlly(a,999);assert.equal(g.player.xp,xp);assert.equal(g.player.scrap,scrap);
});
test('explosions and matching disruption affect allies, EMP leaves organic pets intact',()=>{
 const g=arena('druid'),a=pet(g),b=drone(g,{x:10,y:11});g.player.emp=1;g.player.prepared.grenade='emp';g.action('grenade',{x:10,y:10});assert.equal(a.control.disabled,0);assert.equal(b.control.disabled,1);const hp=a.hp;g.explode({x:10,y:10},2,25);assert.ok(a.hp<hp);assert.ok(b.hp<45);
});
test('friendly movement cannot overlap player or enemies and navigates doors and low rails',()=>{
 const g=arena('druid'),a=pet(g);g.barriers=[makeBarrier('door',{x:11,y:10},{x:12,y:10},'edge-test-door')];a.order={x:12,y:10};g.action('wait');assert.equal(g.barriers[0].open,true);assert.equal(a.x,11);g.action('wait');assert.equal(a.x,12);
 g.barriers=[makeBarrier('low_partition',{x:12,y:10},{x:13,y:10},'edge-test-low')];a.order={x:13,y:10};g.action('wait');assert.equal(a.x,13);assert.equal(a.vaultExposed,true);assert.equal(g.action('move',[1,0]),true);assert.equal(g.action('move',[1,0]),true);assert.equal(g.action('move',[1,0]),false);
});
test('shared sight reveals nearby ally observations but never shoots through player walls',()=>{
 const g=arena('druid');for(let y=0;y<SIZE;y++)g.grid[y][12]=0;pet(g,{x:13,y:10});const e=enemy(g,14);g.reveal();assert.equal(g.visible(e),false);assert.ok(g.visibleEnemies.includes(e));assert.ok(g.seen[e.y][e.x]);g.target=e.id;assert.equal(g.action('fire'),false);
});
test('carry uses a three-step traversable route, closed walls or doors prevent proximity shortcuts',()=>{
 const g=arena(),a=drone(g,{x:12,y:10});assert.ok(carryCandidates(g).includes(a));for(let y=0;y<SIZE;y++)g.grid[y][11]=0;assert.equal(carryCandidates(g).includes(a),false);
});
test('departure removes abandoned summons only and arrivals preserve ammo and injury',()=>{
 const g=arena(),a=drone(g,{x:11,y:10}),b=pet(g,{x:17,y:10});a.hp=12;a.ammo=4;const s=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:18,y:10}}),ids=departAllies(g);assert.ok(!g.allies.includes(s));assert.ok(g.allies.includes(b));g.floor=2;g.player.x=5;g.player.y=5;arriveAllies(g,ids);assert.equal(a.floor,2);assert.equal(a.hp,12);assert.equal(a.ammo,4);assert.equal(b.floor,1);assert.ok(validAllies(g));
});
test('roundtrip preserves abandoned pet and permits reunion, without reinitializing a second pet',()=>{
 const g=new Game(331,[],0,'druid','onyx','roundtrip'),a=g.allies[0];a.hp=37;const original={x:a.x,y:a.y};Object.assign(g.player,g.exitPoint);assert.ok(g.descend());assert.equal(a.floor,1);assert.equal(g.allies.length,1);assert.ok(Game.restore(g.serialize()));
 g.mission.returning=true;g.mission.targets=[{id:'objective-1',x:g.start.x,y:g.start.y,done:true}];g.mission.reinforced=[];Object.assign(g.player,g.start);g.enemies.forEach(e=>e.hp=0);assert.ok(g.descend());assert.equal(g.floor,1);assert.equal(a.hp,37);assert.deepEqual({x:a.x,y:a.y},original);assert.ok(g.localAllies.includes(a));
});
test('survivor hook records independent source and mission IDs and uses the same combat/persistence',()=>{
 const g=arena('soldier'),a=addAlly(g,'survivor','rifleman',{point:{x:11,y:10},sourceId:'rescue-room',missionId:'rescue-01'});assert.ok(a);const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(restored.allies[0].missionId,'rescue-01');assert.equal(restored.player.character,'soldier');
});
test('complete backups preserve active, packed, downed and left-behind units without duplicate IDs',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,999);drone(g,{x:10,y:10},'packed');const b=addAlly(g,'survivor','rifleman',{point:{x:15,y:15},missionId:'rescue'});b.floor=2;
 const result=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa');assert.deepEqual(result.game.allies,g.allies);assert.equal(result.game.allySerial,g.allySerial);
});
test('v22 migration adds empty allies without gifting units or changing player resources/RNG',()=>{
 const g=arena('soldier'),old=JSON.parse(g.serialize());old.version=22;delete old.data.allies;delete old.data.allySerial;const restored=Game.restore(JSON.stringify(old));assert.ok(restored);assert.deepEqual(restored.player,g.player);assert.deepEqual(restored.allies,[]);assert.equal(restored.rng.state(),g.rng.state());
});
test('malformed ally state cannot fabricate duplicate bodies, negative ammo, invalid orders or bad affiliation',()=>{
 const g=arena(),a=drone(g);for(const change of [d=>d.allies.push({...d.allies[0]}),d=>d.allies[0].ammo=-1,d=>d.allies[0].kind='enemy',d=>d.allies[0].status='packed-bad',d=>d.allies[0].x=d.player.x,d=>d.allies[0].sourceId='raise_dead',d=>d.allies[0].order={x:100,y:1},d=>delete d.allies,d=>d.allySerial=0]){const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('ally shooting and death use projectile then impact/death playback, never create enemy drops for allies',()=>{
 const g=arena(),a=drone(g),e=enemy(g,14);a.ammo=12;a.bornTurn=1;g.turn=2;zero(g);e.hp=1;const result=captureAction(g,()=>g.action('wait')),plan=planPresentation(result.steps);assert.ok(plan.events.some(x=>x.effects.some(e=>e.type==='shot')));assert.ok(plan.events.some(x=>x.effects.some(e=>e.type==='fall')));
});

test('recalled drones leave the frozen queue and retain disruption instead of taking a packed action',()=>{
 const g=arena(),a=drone(g);a.ammo=3;a.control.disabled=2;assert.ok(use(g));assert.equal(a.status,'packed');assert.equal(a.control.disabled,2);assert.equal(a.moved,false);
});
test('downed pets blocked by an enemy cannot consume medicine or revive on that enemy',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,999);enemy(g,11);const meds=g.player.meds,turn=g.turn;assert.equal(use(g),false);assert.equal(g.player.meds,meds);assert.equal(g.turn,turn);
});
test('charged sniper keeps its marked tile when allies move; the occupant at impact takes the hit',()=>{
 const g=arena('druid'),a=pet(g,{x:12,y:10}),e=enemy(g,16,10,'sniper');e.charge=true;e.windup=1;e.aim={x:12,y:10};e.focusTarget=a.id;a.x=12;a.y=11;a.order={x:12,y:11};g.player.x=12;g.player.y=10;g.reveal();zero(g);const hp=g.player.hp;g.action('wait');assert.ok(g.player.hp<hp);assert.equal(a.hp,90);
});
test('v22 first local read preserves the original QA save before allied schema migration',async()=>{
 const memory=new Map([['ash-save','live untouched']]);globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?allies330'),old=JSON.parse(arena('soldier').serialize());old.version=22;delete old.data.allies;delete old.data.allySerial;const raw=JSON.stringify(old);memory.set('qa-ash-save',raw);assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v22-backup'),raw);assert.equal(memory.get('ash-save'),'live untouched');
});
test('new class natural-map actions keep legal occupancy and roundtrip-safe saves across seeds',()=>{
 for(const character of ['engineer','druid','necromancer'])for(let seed=1;seed<=3;seed++){
  const g=new Game(seed,[],0,character,'onyx','roundtrip');
  for(let i=0;i<40&&g.status==='playing';i++){
   if(g.pendingPerks){g.choosePerk(g.perkChoices[0].id);continue;}
   const id=g.player.prepared.skill;if(canAllySkill(g,id)&&(character==='necromancer'||character==='engineer'&&g.allies[0].status==='packed'||character==='druid'&&g.allies[0].status==='down'))use(g);
   else {const e=g.visibleEnemies.find(e=>g.shotClear(g.player,e)&&g.visible(e)&&Math.abs(e.x-g.player.x)+Math.abs(e.y-g.player.y)<=g.weapon.range);if(e&&g.player.ammo[g.player.weapon]){g.target=e.id;g.action('fire');}else g.action('wait');}
   if(g.status==='playing')assert.ok(Game.restore(g.serialize()),character+' '+seed+' '+i);
  }
 }
});

test('deployment cannot materialize through a closed door when there is no reachable empty floor',()=>{
 const g=arena();g.grid=g.grid.map(r=>r.map(()=>0));g.grid[10][10]=g.grid[10][11]=1;drone(g,{x:10,y:10},'packed');g.barriers=[makeBarrier('door',{x:10,y:10},{x:11,y:10},'edge-blocked-spawn')];const ammo=g.player.pistol;
 assert.equal(use(g),false);assert.equal(g.turn,1);assert.equal(g.player.pistol,ammo);g.barriers[0].open=true;assert.ok(use(g));assert.equal(g.allies[0].x,11);
});


test('wreck recovery uses either drone skill, costs a turn, and preserves identity, hp and all ammo',()=>{
 for(const skill of ['drone_follow','drone_sentry']){
  const g=arena(),a=drone(g);a.ammo=4;g.damageAlly(a,999);g.action('prepare',{category:'skill',id:skill});
  const before={pistol:g.player.pistol,rifle:g.player.reserve,scrap:g.player.scrap,id:a.id};
  assert.ok(use(g));assert.equal(g.turn,2);assert.equal(a.status,'packed');assert.equal(a.hp,0);assert.equal(a.ammo,4);assert.equal(a.id,before.id);assert.equal(a.sourceId,'drone_follow');
  assert.equal(g.player.pistol,before.pistol);assert.equal(g.player.reserve,before.rifle);assert.equal(g.player.scrap,before.scrap);assert.equal(use(g),false);assert.equal(g.allies.length,1);assert.ok(Game.restore(g.serialize()));
 }
});
test('wreck retrieval requires same floor and a clear adjacent edge, rejects occupied wrecks, allows standing on it',()=>{
 const g=arena(),a=drone(g);g.damageAlly(a,999);
 g.barriers=[makeBarrier('door',g.player,a,'edge-repair-door')];assert.equal(use(g),false);g.barriers[0].open=true;
 a.floor=2;assert.equal(use(g),false);a.floor=1;enemy(g,11);assert.equal(use(g),false);g.enemies=[];
 pet(g,{x:11,y:10});assert.equal(use(g),false);g.allies=g.allies.filter(x=>x.kind==='drone');
 g.player.x=11;assert.ok(use(g));assert.equal(a.status,'packed');assert.ok(Game.restore(g.serialize()));
});
test('packed machine repair spends scrap and a turn, restores half maximum rounded up, caps hp and never refills ammo',()=>{
 const g=arena(),a=drone(g,{x:10,y:10},'packed');a.hp=0;a.ammo=3;a.control.disabled=2;g.player.scrap=50;
 const pistol=g.player.pistol,rifle=g.player.reserve,id=a.id;g.player.prepared.skill=null;
 assert.ok(g.action('repairDrone',id));assert.equal(g.turn,2);assert.equal(a.hp,23);assert.equal(g.player.scrap,50-DRONE_REPAIR_COST);assert.equal(a.status,'packed');assert.equal(a.ammo,3);assert.equal(a.control.disabled,2);
 assert.ok(g.action('repairDrone',id));assert.equal(a.hp,45);assert.equal(g.player.scrap,50-2*DRONE_REPAIR_COST);assert.equal(g.player.pistol,pistol);assert.equal(g.player.reserve,rifle);
 const turn=g.turn;assert.equal(g.action('repairDrone',id),false);assert.equal(g.turn,turn);assert.equal(droneRepairReason(g,id),'狀態完好');assert.ok(Game.restore(g.serialize()));
});
test('repair rejects deployed units, ground wrecks, insufficient funds, missing skills and invalid ids without spending time',()=>{
 const g=arena(),a=drone(g);a.hp=10;g.player.scrap=50;assert.equal(g.action('repairDrone',a.id),false);
 g.damageAlly(a,999);assert.equal(g.action('repairDrone',a.id),false);a.status='packed';g.player.scrap=DRONE_REPAIR_COST-1;assert.equal(g.action('repairDrone',a.id),false);
 g.player.scrap=50;g.player.skills=[];assert.equal(g.action('repairDrone',a.id),false);assert.equal(g.action('repairDrone','ally-999'),false);assert.equal(g.turn,1);assert.equal(g.player.scrap,50);assert.equal(a.hp,0);
});
test('fast lethal or disabling enemies prevent committed repair from charging scrap',()=>{
 for(const effect of ['death','disable']){
  const g=arena(),a=drone(g,{x:10,y:10},'packed');a.hp=0;g.player.scrap=30;
  const e=enemy(g,14);grantTrait(e,'fast','test:repair-fast');e.alert=true;
  g.enemyAct=()=>{if(effect==='death')g.player.hp=0;else g.player.control.disabled=2;};
  assert.ok(g.action('repairDrone',a.id));assert.equal(g.turn,2);assert.equal(g.player.scrap,30);assert.equal(a.hp,0);
 }
});
test('a fast enemy occupying the wreck cancels recovery while the committed turn is still spent',()=>{
 const g=arena(),a=drone(g);g.damageAlly(a,999);const e=enemy(g,14);e.alert=true;grantTrait(e,'fast','test:repair-fast');g.enemyAct=()=>{e.x=a.x;e.y=a.y;};
 assert.ok(use(g));assert.equal(g.turn,2);assert.equal(a.status,'destroyed');assert.equal(a.hp,0);
});
test('repaired wreck must deploy separately, conserves ammunition through mode switch and does not shoot on deployment',()=>{
 const g=arena(),a=drone(g);a.ammo=3;g.damageAlly(a,999);g.player.scrap=30;const pistol=g.player.pistol,rifle=g.player.reserve;
 assert.ok(use(g));assert.ok(g.action('repairDrone',a.id));assert.equal(g.activeAllies.length,0);assert.equal(a.hp,23);
 g.action('prepare',{category:'skill',id:'drone_sentry'});const e=enemy(g,15);e.alert=false;g.enemyAct=()=>{};const hp=e.hp;
 assert.ok(use(g));assert.equal(g.turn,4);assert.equal(a.hp,23);assert.equal(a.status,'active');assert.equal(a.sourceId,'drone_sentry');assert.equal(a.ammo,8);assert.equal(e.hp,hp);
 assert.equal(g.player.pistol,pistol+3);assert.equal(g.player.reserve,rifle-8);assert.equal(g.allies.length,1);
});
test('packed zero-hp wreck follows floors and survives complete backup while ground wreck stays behind',()=>{
 const g=arena(),a=drone(g);g.damageAlly(a,999);assert.ok(!departAllies(g).includes(a.id));assert.ok(use(g));const ids=departAllies(g);assert.ok(ids.includes(a.id));
 g.floor=2;arriveAllies(g,ids);assert.equal(a.floor,2);assert.equal(a.hp,0);assert.equal(a.status,'packed');
 const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa');assert.deepEqual(copy.game.allies,g.allies);
 const raw=JSON.parse(g.serialize());raw.data.allies[0].status='active';assert.equal(Game.restore(JSON.stringify(raw)),null);
 raw.data.allies[0].status='packed';raw.data.allies[0].hp=-1;assert.equal(Game.restore(JSON.stringify(raw)),null);
});
// 3.36 ally iteration round 1: shoves, closing in when the exact tile is taken, and holding fights.
const corridor=(g,x0,x1)=>{g.grid=g.grid.map(r=>r.map(()=>0));for(let x=x0;x<=x1;x++)g.grid[10][x]=1;};
test('walking into an ally shoves it along the move for one turn; the ally gives up that action',()=>{
 const g=arena('druid'),a=pet(g),e=enemy(g,13,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 assert.ok(g.action('move',[1,0]));assert.deepEqual([g.player.x,a.x,a.y,g.turn,a.restTurn],[11,12,10,2,2]);assert.equal(e.hp,500);
 g.action('wait');assert.ok(e.hp<500);assert.ok(Game.restore(g.serialize()));
});
test('a blocked shove sidesteps but never backs into the player; a boxed-in ally refuses without spending time',()=>{
 const g=arena('druid'),a=pet(g);corridor(g,5,11);
 assert.equal(g.action('move',[1,0]),false);assert.equal(g.turn,1);assert.equal(a.x,11);assert.match(g.logs[0].text,/沒有空位/);
 g.grid[11][11]=1;assert.ok(g.action('move',[1,0]));assert.deepEqual([g.player.x,g.player.y,a.x,a.y],[11,10,11,11]);
});
test('sentries, disabled allies, low rails and an anchored bulwark refuse a shove without spending time',()=>{
 const g=arena(),s=drone(g,{x:11,y:10},'active','drone_sentry');assert.equal(g.action('move',[1,0]),false);assert.match(g.logs[0].text,/哨兵/);
 s.sourceId='drone_follow';s.control.disabled=2;assert.equal(g.action('move',[1,0]),false);assert.match(g.logs[0].text,/失能/);
 s.control.disabled=0;g.barriers=[makeBarrier('low_partition',{x:10,y:10},{x:11,y:10},'push-rail')];assert.equal(g.action('move',[1,0]),false);assert.equal(g.turn,1);assert.equal(s.x,11);
 const b=arena('bulwark');assert.ok(use(b));addAlly(b,'survivor','rifleman',{point:{x:11,y:10}});const turn=b.turn;assert.equal(b.action('move',[1,0]),false);assert.match(b.logs[0].text,/下錨/);assert.equal(b.turn,turn);
});
test('a faster ally that already acted gives up its next action instead, and the rest marker round-trips',()=>{
 const g=arena('necromancer'),a=addAlly(g,'summon','raider',{sourceId:'raise_dead',point:{x:11,y:10}}),e=enemy(g,13,10);grantTrait(a,'fast','test:push');e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 assert.ok(g.action('move',[1,0]));assert.ok(e.hp<500);assert.equal(a.restTurn,g.turn+1);assert.ok(Game.restore(g.serialize()));
 const hp=e.hp;g.action('wait');assert.equal(e.hp,hp);g.action('wait');assert.ok(e.hp<hp);
 for(const bad of [0,'3',g.turn+2]){const raw=JSON.parse(g.serialize());raw.data.allies[0].restTurn=bad;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('a fast enemy taking the only free tile cancels the committed shove; nothing moves but the turn is spent',()=>{
 const g=arena('druid'),a=pet(g);corridor(g,5,14);const e=enemy(g,14,10);e.hp=500;e.alert=true;grantTrait(e,'fast','test:push');g.enemyAct=x=>{if(x===e){e.x=12;e.y=10;}};
 assert.ok(g.action('move',[1,0]));assert.equal(g.turn,2);assert.deepEqual([g.player.x,a.x,e.x],[10,11,12]);assert.equal(a.restTurn,undefined);
});
test('two summons queue through a one-tile corridor instead of the rear one freezing',()=>{
 const g=arena('necromancer');corridor(g,2,24);const A=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:9,y:10}}),B=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:8,y:10}});
 for(let i=0;i<8;i++)assert.ok(g.action('move',[1,0]));for(let i=0;i<4;i++)g.action('wait');assert.deepEqual([g.player.x-A.x,g.player.x-B.x],[3,4]);
});
test('melee pets hold a fight inside the tether instead of pacing back to the idle leash',()=>{
 for(const k of [5,6]){const g=arena('druid'),a=pet(g),e=enemy(g,10+k,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
  for(let i=0;i<8;i++){g.action('wait');assert.ok(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)<=PET_TETHER);}assert.ok(e.hp<500,`enemy ${k} tiles out`);}
});
test('follow drones fire from their tile before closing the idle leash, and still never chase',()=>{
 const g=arena(),a=drone(g,{x:7,y:10});a.ammo=12;a.bornTurn=1;g.turn=2;enemy(g,11,11);zero(g);g.reveal();allyAct(g,a);assert.equal(a.x,7);assert.equal(a.ammo,11);
});
test('a pet whose hold tile is taken fights from where it stands instead of idling',()=>{
 const g=arena('druid'),a=pet(g,{x:12,y:10}),e=enemy(g,13,10);e.hp=500;a.order={x:13,y:10};g.enemyAct=()=>{};zero(g);g.reveal();g.action('wait');assert.ok(e.hp<500);assert.deepEqual([a.x,a.y],[12,10]);
});
test('v23 original local save is backed up verbatim; destroyed chassis and resources survive migration',async()=>{
 const g=arena(),a=drone(g);a.ammo=5;g.damageAlly(a,999);const old=JSON.parse(g.serialize());old.version=23;const raw=JSON.stringify(old),memory=new Map([['qa-ash-save',raw],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?repair331'),restored=storage.loadGame();assert.ok(restored);assert.deepEqual(restored.allies,g.allies);assert.deepEqual(restored.player,g.player);assert.equal(restored.rng.state(),g.rng.state());assert.equal(memory.get('qa-ash-save-v23-backup'),raw);assert.equal(memory.get('ash-save'),'untouched');assert.ok(use(restored));
});
