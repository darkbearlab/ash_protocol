import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,ENEMY_TYPES} from '../src/data.js';
import {CHARACTERS} from '../src/characters.js';
import {DRONE_HP,SENTRY_ARMOR,deployLimit,lineLimit,addAlly,allyWeapon,allyAct,allySkillState,fitDrone,canAllySkill,commandPet,carryCandidates,departAllies,arriveAllies,summonPool,validAllies,PET_TETHER,SUMMON_LIMIT,SUMMON_INTERVAL,SUMMON_TETHER,RALLY_TURNS,defaultDroneCell} from '../src/allies.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {grantTrait} from '../src/traits.js';
import {DISRUPT_TURNS} from '../src/throwables.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
import {UNIT_BLUEPRINTS,deployReason} from '../src/workshop.js';
function arena(character='engineer'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
}
const drone=(g,point={x:11,y:10},status='active',sourceId='drone_follow')=>addAlly(g,'drone','drone',{point,status,sourceId});
const pet=(g,point={x:11,y:10})=>addAlly(g,'pet','crawler',{point,sourceId:'pet_command'});
const enemy=(g,x=14,y=10,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);g.enemies.push(e);return e;};
const use=g=>g.action('usePrepared',{category:'skill'});
const deploy=(g,point=null,line=0)=>g.action('deployUnit',{line,...(point||{})});
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});

test('six free classes restore with their actual starting allies and skills without changing old classes',()=>{
 for(const id of Object.keys(CHARACTERS)){const g=new Game(330,[],0,id,'onyx');assert.ok(Game.restore(g.serialize()),id);assert.equal(g.allies.length,id==='druid'?1:0);assert.deepEqual(g.player.productionLines,id==='engineer'?[{blueprint:'drone_follow'}]:[]);assert.equal(g.player.hp,CHARACTERS[id].hp);}
});
test('deploying a built unit spends a turn and no rounds of yours, new deployment cannot shoot immediately',()=>{
 const g=arena(),e=enemy(g);g.reveal();zero(g);const pistol=g.player.pistol,rifle=g.player.reserve;
 assert.ok(deploy(g));const a=g.allies[0];assert.equal(g.turn,2);assert.deepEqual(g.player.productionLines,[]);assert.equal(g.player.pistol,pistol,'3.155.0: a machine with its own gun costs you no rounds');assert.equal(g.player.reserve,rifle);assert.equal(e.hp,22);assert.equal(a.status,'active');
 g.action('wait');assert.ok(e.hp<22);assert.equal(g.player.pistol,pistol,'and firing spends none either');
});
test('deployed units never return: the workshop skill itself is refused without spending time',()=>{
 const g=arena();assert.equal(canAllySkill(g,'workshop'),true);const turn=g.turn;assert.equal(use(g),false);assert.equal(g.turn,turn);
 assert.ok(deploy(g));const a=g.allies[0];assert.equal(use(g),false);assert.equal(a.status,'active');assert.deepEqual(g.player.productionLines,[]);assert.equal(allySkillState(g,'workshop'),'序列 0/1 · 部署 1/1');
});
test('building needs a known blueprint, scrap and a free production line; refusals spend no time',()=>{
 const g=arena();g.player.scrap=100;const turn=g.turn;
 assert.equal(g.action('buildUnit',{blueprint:'drone_sentry'}),false);assert.match(g.logs[0].text,/序列已滿/);
 g.player.productionLines=[];g.player.scrap=UNIT_BLUEPRINTS.drone_sentry.cost-1;assert.equal(g.action('buildUnit',{blueprint:'drone_sentry'}),false);assert.equal(g.action('buildUnit',{blueprint:'warden'}),false);assert.equal(g.turn,turn);assert.deepEqual(g.player.productionLines,[]);
 g.player.scrap=UNIT_BLUEPRINTS.drone_sentry.cost+5;assert.ok(g.action('buildUnit',{blueprint:'drone_sentry'}));assert.equal(g.turn,turn+1);assert.equal(g.player.scrap,5);assert.deepEqual(g.player.productionLines,[{blueprint:'drone_sentry'}]);assert.ok(Game.restore(g.serialize()));
 const s=arena('soldier');s.player.scrap=100;assert.equal(s.action('buildUnit',{blueprint:'drone_follow'}),false);assert.deepEqual(s.player.productionLines,[]);
});
test('stationary drone never moves and disconnected drones stop firing and granting sight',()=>{
 const g=arena(),a=drone(g,{x:18,y:10},'active','drone_sentry'),e=enemy(g,20);a.ammo=8;a.bornTurn=1;g.turn=2;zero(g);g.reveal();const before=e.hp;allyAct(g,a);assert.equal(a.x,18);assert.equal(e.hp,before,'out of touch: no shot');
 g.player.x=15;g.reveal();const hp=e.hp;allyAct(g,a);assert.equal(a.x,18);assert.ok(e.hp<hp,'back in touch: it fires, and its own gun needs no rounds');
});
test('follow drone shoots only at its own position and follows its tether rather than chasing',()=>{
 const g=arena(),a=drone(g,{x:11,y:10});a.ammo=12;a.bornTurn=1;g.turn=2;enemy(g,19);zero(g);allyAct(g,a);assert.equal(a.x,11);assert.equal(a.ammo,12);
 g.player.x=7;allyAct(g,a);assert.equal(a.x,10);assert.equal(a.ammo,12);
});
test('pet destination commands are free, bounded, and execute on the next own opportunity',()=>{
 const g=arena('druid'),a=pet(g);const turn=g.turn,rng=g.rng.state();assert.ok(g.action('commandPet',{x:13,y:10}));assert.equal(g.turn,turn);assert.equal(g.rng.state(),rng);assert.equal(a.x,11);
 g.action('wait');assert.equal(a.x,12);g.action('wait');assert.equal(a.x,13);assert.equal(commandPet(g,{x:20,y:10}),false);assert.ok(g.action('commandPet',{x:10,y:10}));assert.equal(a.order,null);
});
// Superseded recovery cases are covered by pet-feeding.test.mjs (3.72).
test('the pet chases up to nine tiles from the player while survivors keep the six-tile tether',()=>{
 const g=arena('druid'),a=pet(g),e=enemy(g,18,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();for(let i=0;i<9;i++)g.action('wait');assert.ok(e.hp<500);assert.ok(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)<=PET_TETHER);
 const n=arena('soldier'),s=addAlly(n,'survivor','crawler',{point:{x:11,y:10}}),f=enemy(n,18,10);f.hp=500;n.enemyAct=()=>{};n.reveal();for(let i=0;i<9;i++)n.action('wait');assert.equal(f.hp,500);
});
test('no ally may be packed in a save; a v25 save loads unchanged and its first local read is kept verbatim',async()=>{
 const g=arena('necromancer'),s=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:11,y:10}}),raw=JSON.parse(g.serialize());raw.data.allies[0].status='packed';assert.equal(Game.restore(JSON.stringify(raw)),null);
 const d=arena('druid'),a=pet(d);a.hp=37;const old=JSON.parse(d.serialize());old.version=25;const text=JSON.stringify(old),memory=new Map([['qa-ash-save',text],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?pet337'),restored=storage.loadGame();assert.ok(restored);assert.deepEqual(restored.allies,d.allies);assert.deepEqual(restored.player,d.player);assert.equal(restored.rng.state(),d.rng.state());assert.equal(memory.get('qa-ash-save-v25-backup'),text);assert.equal(memory.get('ash-save'),'untouched');
});
test('a fast lethal hit cancels paid feeding and consumes no medkit',()=>{
 const g=arena('druid'),a=pet(g);a.hp=20;const e=enemy(g,7);e.charge=true;e.windup=1;grantTrait(e,'fast','test:fast');g.player.hp=1;zero(g);g.reveal();const meds=g.player.meds;assert.ok(g.action('feedPet',{optionId:'medkit'}));assert.equal(g.status,'dead');assert.equal(a.status,'active');assert.equal(g.player.meds,meds);
});
test('necro summons rise on their own every four paid turns from anyone who fell here, up to three, bosses excluded, nothing consumed',()=>{
 const g=arena('necromancer'),summons=()=>g.activeAllies.filter(a=>a.kind==='summon').length;for(const type of ['rifleman','crawler','warden'])enemy(g,14+g.enemies.length,10,type).hp=0;g.enemyAct=()=>{};
 g.action('wait');assert.equal(summons(),1);assert.equal(g.player.skillState.raise_dead.cooldown,SUMMON_INTERVAL-1);assert.ok(g.activeAllies.every(a=>a.type!=='warden'));assert.equal(summonPool(g).length,2);assert.ok(g.enemies.every(e=>!e.raised));
 const s=g.activeAllies[0];assert.equal(s.maxHp,Math.max(32,makeEnemy(s.type,0,0,'x').hp));assert.equal(allyWeapon(s).min,Math.max(8,ENEMY_TYPES[s.type].damage));
 for(let i=0;i<SUMMON_INTERVAL-1;i++)g.action('wait');assert.equal(summons(),1);g.action('wait');assert.equal(summons(),2);
 for(let i=0;i<SUMMON_INTERVAL*2;i++)g.action('wait');assert.equal(summons(),SUMMON_LIMIT);assert.ok(Game.restore(g.serialize()));
});
test('machines never rise: dead drones and cyborgs stay out of the pool, so a floor of fallen machines raises nothing',()=>{
 const g=arena('necromancer'),summons=()=>g.activeAllies.filter(a=>a.kind==='summon').length;enemy(g,14,10,'drone').hp=0;const c=enemy(g,15,10,'rifleman');grantTrait(c,'mechanical','test:cyborg');c.hp=0;g.enemyAct=()=>{};
 assert.equal(summonPool(g).length,0);g.action('wait');assert.equal(summons(),0);assert.match(allySkillState(g,'raise_dead'),/尚無可起身/);
 enemy(g,16,10,'crawler').hp=0;assert.deepEqual(summonPool(g).map(e=>e.type),['crawler']);g.action('wait');assert.equal(summons(),1);assert.equal(g.activeAllies[0].type,'crawler');
});
test('rising draws are weighted by how many fell, deterministic across restore, and the new summon waits for the next turn',()=>{
 const fallen=g=>{for(let j=0;j<5;j++)enemy(g,14+j,12,'crawler').hp=0;enemy(g,20,12,'gunner').hp=0;g.enemyAct=()=>{};};
 const g=arena('necromancer');fallen(g);const saved=Game.restore(g.serialize());saved.enemyAct=()=>{};g.action('wait');saved.action('wait');assert.deepEqual(g.allies,saved.allies);assert.equal(g.rng.state(),saved.rng.state());assert.equal(g.allies[0].bornTurn,g.turn);
 const counts={crawler:0,gunner:0};for(let i=0;i<60;i++){const h=arena('necromancer');fallen(h);const r=i/60;h.rng=Object.assign(()=>r,{state:()=>1});h.action('wait');counts[h.allies[0].type]++;}
 assert.deepEqual(counts,{crawler:50,gunner:10});
});
test('enemies select and damage closer allies, preserving player health',()=>{
 const g=arena('druid'),a=pet(g,{x:12,y:10}),e=enemy(g,15);a.order={x:12,y:10};e.charge=true;e.windup=1;g.reveal();zero(g);const hp=g.player.hp;g.action('wait');assert.equal(g.player.hp,hp);assert.ok(a.hp<90);assert.equal(g.enemyTarget(e),a);
});
test('friendly attacks earn normal enemy kill rewards, friendly deaths earn nothing',()=>{
 const g=arena(),a=drone(g),e=enemy(g,14);e.hp=1;a.ammo=12;a.bornTurn=1;g.turn=2;zero(g);const kills=g.player.kills;allyAct(g,a);assert.equal(g.player.kills,kills+1);const xp=g.player.xp,scrap=g.player.scrap;g.damageAlly(a,999);assert.equal(g.player.xp,xp);assert.equal(g.player.scrap,scrap);
});
test('explosions and matching disruption affect allies, EMP leaves organic pets intact',()=>{
 const g=arena('druid'),a=pet(g),b=drone(g,{x:10,y:11});g.player.emp=1;g.player.prepared.grenade='emp';g.action('grenade',{x:10,y:10});assert.equal(a.control.disabled,0);assert.equal(b.control.disabled,DISRUPT_TURNS-1);const hp=a.hp;g.explode({x:10,y:10},2,25);assert.ok(a.hp<hp);assert.ok(b.hp<b.maxHp);
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
 const g=arena(),a=drone(g,{x:11,y:10}),b=pet(g,{x:17,y:10});a.hp=12;a.ammo=4;const s=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:18,y:10}}),ids=departAllies(g);assert.ok(!g.allies.includes(s));assert.ok(g.allies.includes(b));g.floor=2;g.player.x=5;g.player.y=5;arriveAllies(g,ids);assert.equal(a.floor,2);assert.equal(a.hp,12);assert.equal(a.ammo,4);assert.equal(b.floor,2);assert.ok(validAllies(g));
});
test('roundtrip transports the pet and preserves growth, without reinitializing a second pet',()=>{
 const g=new Game(331,[],0,'druid','onyx','roundtrip'),a=g.allies[0];a.hp=37;const original={x:a.x,y:a.y};Object.assign(g.player,g.exitPoint);assert.ok(g.descend());assert.equal(a.floor,2);assert.equal(g.allies.length,1);assert.ok(Game.restore(g.serialize()));
 g.mission.returning=true;g.mission.targets=[{id:'objective-1',x:g.start.x,y:g.start.y,done:true}];g.mission.reinforced=[];Object.assign(g.player,g.start);g.enemies.forEach(e=>e.hp=0);assert.ok(g.descend());assert.equal(g.floor,1);assert.equal(a.hp,37);assert.equal(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y),1);assert.ok(g.localAllies.includes(a));
});
test('survivor hook records independent source and mission IDs and uses the same combat/persistence',()=>{
 const g=arena('soldier'),a=addAlly(g,'survivor','rifleman',{point:{x:11,y:10},sourceId:'rescue-room',missionId:'rescue-01'});assert.ok(a);const restored=Game.restore(g.serialize());assert.ok(restored);assert.equal(restored.allies[0].missionId,'rescue-01');assert.equal(restored.player.character,'soldier');
});
test('complete backups preserve active, downed and left-behind units without duplicate IDs',()=>{
 const g=arena('druid'),a=pet(g);g.damageAlly(a,999);drone(g,{x:12,y:12});const b=addAlly(g,'survivor','rifleman',{point:{x:15,y:15},missionId:'rescue'});b.floor=2;
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
   const id=g.player.prepared.skill;if(character==='engineer'&&!deployReason(g,0))g.action('deployUnit',{line:0});else if(canAllySkill(g,id)&&(character==='necromancer'||character==='druid'&&g.allies[0].status==='down'))use(g);
   else {const e=g.visibleEnemies.find(e=>g.shotClear(g.player,e)&&g.visible(e)&&Math.abs(e.x-g.player.x)+Math.abs(e.y-g.player.y)<=g.weapon.range);if(e&&g.player.ammo[g.player.weapon]){g.target=e.id;g.action('fire');}else g.action('wait');}
   if(g.status==='playing')assert.ok(Game.restore(g.serialize()),character+' '+seed+' '+i);
  }
 }
});

test('deployment cannot materialize through a closed door when there is no reachable empty floor',()=>{
 const g=arena();g.grid=g.grid.map(r=>r.map(()=>0));g.grid[10][10]=g.grid[10][11]=1;g.barriers=[makeBarrier('door',{x:10,y:10},{x:11,y:10},'edge-blocked-spawn')];const ammo=g.player.pistol;
 assert.equal(deploy(g),false);assert.equal(g.turn,1);assert.equal(g.player.pistol,ammo);assert.equal(g.player.productionLines.length,1);g.barriers[0].open=true;assert.ok(deploy(g));assert.equal(g.allies[0].x,11);
});


test('a destroyed unit is replaced by building and deploying another of either blueprint, never beyond the deploy limit',()=>{
 for(const blueprint of ['drone_follow','drone_sentry']){
  const g=arena();assert.ok(deploy(g));const a=g.allies[0];g.damageAlly(a,999);assert.equal(a.status,'destroyed');
  g.player.scrap=UNIT_BLUEPRINTS[blueprint].cost+5;assert.ok(g.action('buildUnit',{blueprint}));assert.equal(g.player.scrap,5);
  const pistol=g.player.pistol;assert.ok(deploy(g));const b=g.allies.find(x=>x.kind==='drone'&&x.status==='active');
  assert.notEqual(b.id,a.id);assert.equal(b.sourceId,blueprint);assert.equal(b.hp,DRONE_HP);assert.equal(b.bornTurn,g.turn);assert.equal(g.player.pistol,pistol,'3.155.0: its own gun, its own rounds');assert.ok(Math.abs(b.x-g.player.x)+Math.abs(b.y-g.player.y)<=2);
  assert.equal(b.armor,blueprint==='drone_sentry'?SENTRY_ARMOR:0);assert.equal(b.traits.some(t=>t.id==='no_cover'),blueprint!=='drone_sentry');
  g.player.scrap=100;assert.ok(g.action('buildUnit',{blueprint}));assert.equal(deploy(g),false);assert.match(g.logs[0].text,/部署上限 1 台/);assert.ok(Game.restore(g.serialize()));
 }
});
test('units left on another floor do not count toward the deploy limit, and class perks raise both limits',()=>{
 const g=arena();assert.ok(deploy(g));const a=g.allies[0];a.floor=2;assert.equal(allySkillState(g,'workshop'),'序列 0/1 · 部署 0/1');
 g.player.scrap=30;assert.ok(g.action('buildUnit',{blueprint:'drone_follow'}));assert.ok(deploy(g));assert.equal(g.allies.filter(x=>x.kind==='drone').length,2);assert.ok(validAllies(g));assert.ok(Game.restore(g.serialize()));
 g.player.scrap=60;assert.ok(g.action('buildUnit',{blueprint:'drone_sentry'}));assert.equal(g.action('buildUnit',{blueprint:'drone_sentry'}),false);assert.equal(deploy(g),false);
 g.player.perks.engineer_lines=1;g.player.perks.engineer_deploy=1;assert.equal(lineLimit(g.player),2);assert.equal(deployLimit(g.player),2);
 assert.ok(g.action('buildUnit',{blueprint:'drone_sentry'}));assert.ok(deploy(g));assert.equal(deploy(g),false);assert.equal(allySkillState(g,'workshop'),'序列 1/2 · 部署 2/2');
});
test('a fast lethal enemy cancels a committed build and charges no scrap',()=>{
 const g=arena();g.player.productionLines=[];g.player.scrap=40;const e=enemy(g,14);e.alert=true;grantTrait(e,'fast','test:build');g.enemyAct=()=>{g.player.hp=0;};
 assert.ok(g.action('buildUnit',{blueprint:'drone_follow'}));assert.equal(g.status,'dead');assert.equal(g.player.scrap,40);assert.deepEqual(g.player.productionLines,[]);
});
test('a ground wreck stays behind on its floor and survives complete backup; the workshop still shows its lines',()=>{
 const g=arena();assert.ok(deploy(g));const a=g.allies[0];g.damageAlly(a,999);assert.ok(!departAllies(g).includes(a.id));g.floor=2;assert.equal(allySkillState(g,'workshop'),'序列 0/1 · 部署 0/1');
 const copy=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa');assert.deepEqual(copy.game.allies,g.allies);
 const raw=JSON.parse(g.serialize());raw.data.allies[0].status='active';assert.equal(Game.restore(JSON.stringify(raw)),null);
 raw.data.allies[0].status='destroyed';raw.data.allies[0].hp=-1;assert.equal(Game.restore(JSON.stringify(raw)),null);
});
// 3.41: the follow drone stays adjacent, and deploying or building a drone takes a chosen tile.
test('the follow drone stays adjacent: two tiles away it steps back beside the player',()=>{
 const g=arena(),a=drone(g,{x:12,y:10});a.ammo=12;a.bornTurn=1;g.turn=2;allyAct(g,a);assert.equal(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y),1);
});
test('a unit is deployed on a chosen free tile within two steps; other tiles and lines are refused without spending time',()=>{
 const g=arena();enemy(g,11,10).hp=500;g.enemyAct=()=>{};
 for(const bad of [{x:10,y:13},{x:11,y:10}])assert.equal(deploy(g,bad),false);assert.equal(g.turn,1);assert.equal(g.player.productionLines.length,1);
 assert.equal(g.action('deployUnit',{line:1,x:10,y:8}),false);assert.equal(g.action('deployUnit',{line:'0',x:10,y:8}),false);assert.equal(g.turn,1);
 assert.ok(deploy(g,{x:10,y:8}));const a=g.allies[0];assert.deepEqual([a.status,a.x,a.y,g.turn],['active',10,8,2]);assert.ok(Game.restore(g.serialize()));
});
test('without a chosen tile the unit lands beside the player; in a corridor in front, never behind',()=>{
 const f=arena();f.player.facing=[0,1];assert.equal(defaultDroneCell(f).d,1);assert.ok(deploy(f));assert.deepEqual([f.allies[0].x,f.allies[0].y],[11,10]);
 const c=arena();c.grid=c.grid.map(r=>r.map(()=>0));for(let x=5;x<=15;x++)c.grid[10][x]=1;c.player.facing=[-1,0];assert.ok(deploy(c));assert.deepEqual([c.allies[0].x,c.allies[0].y],[9,10]);
});
test('a fast enemy taking the chosen tile first cancels the committed placement; nothing is spent but the turn',()=>{
 const g=arena(),e=enemy(g,12,10);e.hp=500;e.alert=true;grantTrait(e,'fast','test:place');g.enemyAct=x=>{if(x===e){e.x=11;e.y=10;}};
 const pistol=g.player.pistol;assert.ok(deploy(g,{x:11,y:10}));assert.equal(g.turn,2);assert.equal(g.allies.length,0);assert.equal(g.player.productionLines.length,1);assert.equal(g.player.pistol,pistol);
});
// 3.40 necromancer (user decision): automatic rising, a fallen pool that is never used up, and a free rally.
test('summons hunt enemies up to nine tiles from the player',()=>{
 const g=arena('necromancer'),s=addAlly(g,'summon','crawler',{sourceId:'raise_dead',point:{x:11,y:10}}),e=enemy(g,18,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 for(let i=0;i<9;i++)g.action('wait');assert.ok(e.hp<500);assert.ok(Math.abs(s.x-g.player.x)+Math.abs(s.y-g.player.y)<=SUMMON_TETHER);
});
test('rally is free, brings hunting summons back for three turns, then they hunt again; it needs a summon',()=>{
 const g=arena('necromancer'),s=addAlly(g,'summon','crawler',{sourceId:'raise_dead',point:{x:11,y:10}}),e=enemy(g,17,10);e.hp=500;g.enemyAct=()=>{};g.reveal();
 g.action('wait');g.action('wait');const out=s.x;assert.ok(out>=13);
 const turn=g.turn,rng=g.rng.state();assert.ok(use(g));assert.equal(g.turn,turn);assert.equal(g.rng.state(),rng);assert.equal(s.rallyTurn,turn+RALLY_TURNS);
 g.action('wait');assert.ok(s.x<out);g.action('wait');g.action('wait');assert.ok(Math.abs(s.x-g.player.x)+Math.abs(s.y-g.player.y)<=2);
 g.action('wait');g.action('wait');assert.ok(s.x>=13);assert.ok(Game.restore(g.serialize()));
 for(const bad of ['2',g.turn+RALLY_TURNS+1]){const raw=JSON.parse(g.serialize());raw.data.allies[0].rallyTurn=bad;assert.equal(Game.restore(JSON.stringify(raw)),null);}
 const n=arena('necromancer');assert.equal(use(n),false);assert.equal(n.turn,1);assert.match(n.logs[0].text,/集結/);
});
// 3.39 engineer drone, reworked by the workshop in 3.91.0: pistol rounds, 90 HP, self-reload near the player.
// 3.155.0 (user decision): a machine built with its own gun never reloads from the player, empty magazine or not. The
// reload errand is now only for a mounted player weapon (tests/mount.test.mjs).
test('a machine with its own gun never spends the player rounds, and still walks its leash',()=>{
 const g=arena(),a=drone(g,{x:11,y:10});a.ammo=0;a.bornTurn=1;g.turn=2;const rifle=g.player.reserve,pistol=g.player.pistol;
 const e=enemy(g,13,10);e.hp=500;zero(g);g.reveal();allyAct(g,a);
 assert.ok(e.hp<500,'an empty magazine no longer stops it');assert.equal(g.player.pistol,pistol);assert.equal(g.player.reserve,rifle);
 g.enemies=[];a.x=15;g.turn=7;allyAct(g,a);assert.equal(a.x,14,'and it still closes the leash');assert.equal(g.player.pistol,pistol);
});
test('the placed sentry takes cover and plating while the hovering follow drone does not',()=>{
 const g=arena(),s=drone(g,{x:12,y:10},'active','drone_sentry');g.props=[{id:'cover-c',type:'cover',x:13,y:10,hp:60,maxHp:60}];const e=enemy(g,17,10);
 assert.equal(s.armor,SENTRY_ARMOR);assert.ok(g.protectingCover(s,e));s.sourceId='drone_follow';fitDrone(s);assert.equal(s.armor,0);assert.equal(g.protectingCover(s,e),null);
});
test('v26 saves refit drones: follow pistol rounds are handed back, 45 HP chassis widen to 90 without healing, sentries gain plating and cover',async()=>{
 const g=arena(),a=drone(g);a.ammo=7;a.maxHp=45;a.hp=30;const old=JSON.parse(g.serialize());old.version=26;const restored=Game.restore(JSON.stringify(old));
 assert.ok(restored);assert.equal(restored.player.pistol,g.player.pistol+7);const d=restored.allies[0];assert.deepEqual([d.ammo,d.hp,d.maxHp],[0,30,DRONE_HP]);
 const s=arena(),b=drone(s,{x:11,y:10},'active','drone_sentry');b.armor=0;b.traits.push({id:'no_cover',source:'ally:drone'});b.ammo=5;const o2=JSON.parse(s.serialize());o2.version=26;const r2=Game.restore(JSON.stringify(o2));
 assert.equal(r2.allies[0].armor,SENTRY_ARMOR);assert.ok(!r2.allies[0].traits.some(t=>t.id==='no_cover'));assert.equal(r2.allies[0].ammo,0);assert.equal(r2.player.reserve,s.player.reserve+5);assert.equal(r2.player.pistol,s.player.pistol);
 const text=JSON.stringify(old),memory=new Map([['qa-ash-save',text],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?drone339');assert.ok(storage.loadGame());assert.equal(memory.get('qa-ash-save-v26-backup'),text);assert.equal(memory.get('ash-save'),'untouched');
});
// 3.36 ally iteration round 1 (closing in when the exact tile is taken, holding fights) and
// 3.38 swaps: walking into an ally trades places, and allies trade places in narrow ways.
const corridor=(g,x0,x1)=>{g.grid=g.grid.map(r=>r.map(()=>0));for(let x=x0;x<=x1;x++)g.grid[10][x]=1;};
const rooms=(g,rects)=>{g.grid=g.grid.map(r=>r.map(()=>0));for(const [x0,y0,x1,y1] of rects)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)g.grid[y][x]=1;};
test('walking into an ally trades places for one turn; the ally gives up that action',()=>{
 const g=arena('druid'),a=pet(g),e=enemy(g,9,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 assert.ok(g.action('move',[1,0]));assert.deepEqual([g.player.x,a.x,a.y,g.turn,a.restTurn],[11,10,10,2,2]);assert.equal(e.hp,500);
 g.action('wait');assert.ok(e.hp<500);assert.ok(Game.restore(g.serialize()));
});
test('allies can never box the player in: a dead-end ally still swaps and two summons are walked back out',()=>{
 const g=arena('druid'),a=pet(g);corridor(g,5,11);assert.ok(g.action('move',[1,0]));assert.deepEqual([g.player.x,a.x],[11,10]);
 const n=arena('necromancer');corridor(n,3,15);n.player.x=6;addAlly(n,'summon','rifleman',{sourceId:'raise_dead',point:{x:5,y:10}});addAlly(n,'summon','rifleman',{sourceId:'raise_dead',point:{x:4,y:10}});
 for(let i=0;i<9;i++)assert.ok(n.action('move',[1,0]));for(let i=0;i<12;i++)assert.ok(n.action('move',[-1,0]),`step back ${i}`);assert.equal(n.player.x,3);assert.ok(Game.restore(n.serialize()));
});
test('sentries, disabled allies, low rails and an anchored bulwark refuse a swap without spending time',()=>{
 const g=arena(),s=drone(g,{x:11,y:10},'active','drone_sentry');assert.equal(g.action('move',[1,0]),false);assert.equal(g.refusal.cue,'blocked');assert.match(g.refusal.text,/砲台/);
 s.sourceId='drone_follow';s.control.disabled=2;assert.equal(g.action('move',[1,0]),false);assert.equal(g.refusal.cue,'blocked');assert.match(g.refusal.text,/失能/);
 s.control.disabled=0;g.barriers=[makeBarrier('low_partition',{x:10,y:10},{x:11,y:10},'swap-rail')];assert.equal(g.action('move',[1,0]),false);assert.equal(g.turn,1);assert.equal(s.x,11);
 const b=arena('bulwark');assert.ok(use(b));addAlly(b,'survivor','rifleman',{point:{x:11,y:10}});const turn=b.turn;assert.equal(b.action('move',[1,0]),false);assert.equal(b.refusal.cue,'anchored');assert.match(b.refusal.text,/下錨/);assert.equal(b.turn,turn);
});
test('a faster ally that already acted gives up its next action instead, and the rest marker round-trips',()=>{
 const g=arena('necromancer'),a=addAlly(g,'summon','raider',{sourceId:'raise_dead',point:{x:11,y:10}}),e=enemy(g,13,10);grantTrait(a,'fast','test:swap');e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 assert.ok(g.action('move',[1,0]));assert.deepEqual([g.player.x,a.x],[11,10]);assert.ok(e.hp<500);assert.equal(a.restTurn,g.turn+1);assert.ok(Game.restore(g.serialize()));
 const hp=e.hp;g.action('wait');assert.equal(e.hp,hp);g.action('wait');assert.ok(e.hp<hp);
 for(const bad of [0,'3',g.turn+2]){const raw=JSON.parse(g.serialize());raw.data.allies[0].restTurn=bad;assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
test('a fast enemy disabling the ally first cancels the committed swap; nothing moves but the turn is spent',()=>{
 const g=arena('druid'),a=pet(g);const e=enemy(g,14,10);e.hp=500;e.alert=true;grantTrait(e,'fast','test:swap');g.enemyAct=x=>{if(x===e)a.control.disabled=2;};
 assert.ok(g.action('move',[1,0]));assert.equal(g.turn,2);assert.deepEqual([g.player.x,a.x],[10,11]);assert.equal(a.restTurn,undefined);
});
test('stepping back into a pet behind you in a corridor puts it in front to reach the enemy',()=>{
 const g=arena('druid'),a=pet(g,{x:8,y:10});corridor(g,3,14);g.player.x=9;const e=enemy(g,13,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 assert.ok(g.action('move',[-1,0]));assert.deepEqual([g.player.x,a.x],[8,9]);for(let i=0;i<5;i++)g.action('wait');assert.ok(e.hp<500);
});
test('an ally trades places with one parked in a doorway only when the parked one keeps its shot',()=>{
 const layout=[[3,6,8,14],[9,10,9,10],[10,6,16,14]];
 const g=arena('druid');rooms(g,layout);Object.assign(g.player,{x:6,y:12});const s=addAlly(g,'summon','gunner',{sourceId:'raise_dead',point:{x:9,y:10}}),a=pet(g,{x:8,y:10}),e=enemy(g,13,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
 g.action('wait');assert.deepEqual([a.x,s.x],[9,8]);assert.equal(s.restTurn,g.turn+1);const hp=e.hp;for(let i=0;i<5;i++)g.action('wait');assert.equal(Math.abs(a.x-e.x)+Math.abs(a.y-e.y),1);assert.ok(e.hp<hp);
 const h=arena('druid');rooms(h,layout);Object.assign(h.player,{x:6,y:12});const t=addAlly(h,'summon','gunner',{sourceId:'raise_dead',point:{x:9,y:10}}),b=pet(h,{x:8,y:10});enemy(h,13,10).hp=500;enemy(h,10,8).hp=500;h.enemyAct=()=>{};zero(h);h.reveal();
 for(let i=0;i<3;i++)h.action('wait');assert.deepEqual([b.x,t.x],[8,9]);
});
test('a pet holding a commanded tile is never traded aside by another ally',()=>{
 const g=arena('necromancer');corridor(g,3,16);g.player.x=5;const p=addAlly(g,'pet','crawler',{sourceId:'pet_command',point:{x:8,y:10}});p.order={x:8,y:10};const s=addAlly(g,'summon','crawler',{sourceId:'raise_dead',point:{x:7,y:10}});enemy(g,12,10).hp=500;g.enemyAct=()=>{};g.reveal();
 for(let i=0;i<3;i++)g.action('wait');assert.deepEqual([s.x,p.x],[7,8]);
});
test('two summons queue through a one-tile corridor instead of the rear one freezing',()=>{
 const g=arena('necromancer');corridor(g,2,24);const A=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:9,y:10}}),B=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:8,y:10}});
 for(let i=0;i<8;i++)assert.ok(g.action('move',[1,0]));for(let i=0;i<4;i++)g.action('wait');
 // 3.71.1: summons idle adjacent, so the queue closes to 1 and 2 behind (was 3 and 4 at the old idle radius).
 assert.deepEqual([g.player.x-A.x,g.player.x-B.x],[1,2]);
});
test('melee pets hold a fight inside the tether instead of pacing back to the idle leash',()=>{
 for(const k of [5,6]){const g=arena('druid'),a=pet(g),e=enemy(g,10+k,10);e.hp=500;g.enemyAct=()=>{};zero(g);g.reveal();
  for(let i=0;i<8;i++){g.action('wait');assert.ok(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)<=PET_TETHER);}assert.ok(e.hp<500,`enemy ${k} tiles out`);}
});
test('follow drones fire from their tile before closing the idle leash, and still never chase',()=>{
 const g=arena(),a=drone(g,{x:7,y:10});a.ammo=12;a.bornTurn=1;g.turn=2;const e=enemy(g,11,11);e.hp=500;zero(g);g.reveal();allyAct(g,a);assert.equal(a.x,7);assert.ok(e.hp<500,'it fires from where it stands');
});
test('a pet whose hold tile is taken fights from where it stands instead of idling',()=>{
 const g=arena('druid'),a=pet(g,{x:12,y:10}),e=enemy(g,13,10);e.hp=500;a.order={x:13,y:10};g.enemyAct=()=>{};zero(g);g.reveal();g.action('wait');assert.ok(e.hp<500);assert.deepEqual([a.x,a.y],[12,10]);
});
test('v23 original local save is backed up verbatim; a destroyed follow drone hands its pistol rounds back and resources survive migration',async()=>{
 const g=arena(),a=drone(g);a.ammo=5;g.damageAlly(a,999);const old=JSON.parse(g.serialize());old.version=23;const raw=JSON.stringify(old),memory=new Map([['qa-ash-save',raw],['ash-save','untouched']]);
 globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?repair331'),restored=storage.loadGame();assert.ok(restored);
 assert.deepEqual(restored.allies,[]);
 assert.equal(restored.player.pistol,g.player.pistol+5);assert.deepEqual({...restored.player,pistol:g.player.pistol},{...g.player,productionLines:[]});assert.equal(restored.rng.state(),g.rng.state());assert.equal(memory.get('qa-ash-save-v23-backup'),raw);assert.equal(memory.get('ash-save'),'untouched');
 restored.player.scrap=UNIT_BLUEPRINTS.drone_follow.cost;assert.ok(restored.action('buildUnit',{blueprint:'drone_follow'}));
});

// 3.71.1: raised summons idle adjacent like the follow drone; the pet keeps its looser idle leash.
test('an idle summon two tiles away steps beside the player, while an idle pet at the same distance stays put',()=>{
 const g=arena('necromancer'),s=addAlly(g,'summon','rifleman',{point:{x:12,y:10},sourceId:'raise_dead'});s.bornTurn=1;g.turn=2;allyAct(g,s);
 assert.equal(Math.abs(s.x-g.player.x)+Math.abs(s.y-g.player.y),1);
 const h=arena('druid'),p=pet(h,{x:12,y:10});p.bornTurn=1;h.turn=2;allyAct(h,p);
 assert.deepEqual([p.x,p.y],[12,10]);
});

test('deploy refuses a half-given tile and a full ally list with nothing to prune, without spending time',()=>{
 const g=arena();assert.equal(g.action('deployUnit',{line:0,x:12}),false);assert.equal(g.turn,1);assert.equal(g.player.productionLines.length,1);
 g.allies=Array.from({length:32},(_,i)=>({kind:'survivor',floor:1,status:'active',hp:1,x:0,y:i}));assert.equal(deployReason(g,0),'友軍名額已滿，無法部署。');
 Object.assign(g.allies[5],{kind:'drone',status:'destroyed',hp:0});assert.equal(deployReason(g,0),'');
 Object.assign(g.allies[5],{status:'active',hp:1,floor:2});assert.equal(deployReason(g,0),'');
});
// 3.91.0 engineer workshop (docs/ENGINEER.md phase 1): saves move the old chassis into workshop state.
test('v45 saves turn the drone skills into the workshop: packed chassis into a line, wrecks dropped, deployed units kept, magazines handed back',()=>{
 const old=setup=>{const g=arena();g.player.productionLines=[];setup(g);const raw=JSON.parse(g.serialize());raw.version=45;const p=raw.data.player;p.skills=['drone_follow','drone_sentry'];p.skillState={drone_follow:{remaining:0,cooldown:0},drone_sentry:{remaining:0,cooldown:0}};p.prepared.skill='drone_sentry';delete p.productionLines;return {g,raw};};
 const packed=old(g=>{drone(g,{x:11,y:10}).ammo=5;});packed.raw.data.allies[0].status='packed';const r1=Game.restore(JSON.stringify(packed.raw));
 assert.ok(r1);assert.deepEqual(r1.allies,[]);assert.deepEqual(r1.player.productionLines,[{blueprint:'drone_follow'}]);assert.equal(r1.player.reserve,packed.g.player.reserve+5);
 assert.deepEqual(r1.player.skills,['workshop']);assert.equal(r1.player.prepared.skill,'workshop');assert.deepEqual(Object.keys(r1.player.skillState),['workshop']);assert.ok(Game.restore(r1.serialize()));
 const wreck=old(g=>{g.damageAlly(drone(g),999);});const r2=Game.restore(JSON.stringify(wreck.raw));assert.ok(r2);assert.deepEqual(r2.allies,[]);assert.deepEqual(r2.player.productionLines,[]);
 const active=old(g=>{drone(g,{x:11,y:10},'active','drone_sentry').ammo=3;});const r3=Game.restore(JSON.stringify(active.raw));
 assert.ok(r3);assert.equal(r3.allies[0].status,'active');assert.equal(r3.allies[0].ammo,0);assert.equal(r3.player.reserve,active.g.player.reserve+3);assert.ok(Game.restore(r3.serialize()));
 const soldier=arena('soldier'),raw=JSON.parse(soldier.serialize());raw.version=45;delete raw.data.player.productionLines;const r4=Game.restore(JSON.stringify(raw));assert.ok(r4);assert.deepEqual(r4.player,soldier.player);
});
test('malformed production lines cannot fabricate units, exceed the line limit or exist without the workshop',()=>{
 const g=arena();assert.ok(Game.restore(g.serialize()));
 for(const change of [d=>d.player.productionLines={blueprint:'drone_follow'},d=>d.player.productionLines.push({blueprint:'drone_follow'}),d=>d.player.productionLines[0]={blueprint:'warden'},d=>d.player.productionLines[0].hp=5,d=>d.player.productionLines[0]=null,d=>{d.player.skills=[];d.player.prepared.skill=null;d.player.skillState={};}]){const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
});
