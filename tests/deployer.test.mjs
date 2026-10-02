import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,ENEMY_TYPES,SAVE_VERSION,RUN_SAVE_FLOOR,enemyDisplayName} from '../src/engine.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {AFFIX_TUNING,DEPLOY_KINDS,ENEMY_AFFIXES,armDeployer,deployKindOf,deployerChance,giveEnemyAffix,enemyNameParts} from '../src/enemy-affixes.js';
import {ownDeployed,deploySpot} from '../src/enemy-behavior.js';
import {DIFFICULTY_CURVES} from '../src/endless.js';
import {specialDef,ORDER} from '../src/enemy-specials.js';
import {distance} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {LIGHT_MODEL,isBlack} from '../src/lighting.js';
import {RUNTIME_TUNING} from '../src/runtime-enemies.js';
import {t} from '../src/i18n.js';

// 3.212.0 投放 rework (user 2026-09-30, docs/ENEMY_VARIETY.md sections 1 and 9): each deployer puts out one kind fixed at
// birth, two in all, one of its own up at a time; its units pay nothing; the fixed turret is a new card; infected
// soldiers never deploy; the variety affixes start at hard floor 3, standard floor 5, never on easy in the campaign.
const T=AFFIX_TUNING;
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];Object.assign(g.player,{x:10,y:10,hp:9999,maxHp:9999,plates:0,armor:0,guard:false});g.reveal();return g;}
// A rifleman deployer of `kind` at distance 5 on the player's row, alert and in sight; dice that always deploy.
function deployer(g,kind,x=15,y=10){const e=sceneEnemy(g,'rifleman',['deployer'],x,y);assert.ok(armDeployer(e,kind));e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.rng=Object.assign(()=>0,{state:()=>1});return e;}
const live=(g,e)=>ownDeployed(g,e).filter(d=>d.hp>0);
const deployers=map=>map.enemies.filter(e=>e.affixes?.some(a=>a.id==='deployer'));

test('the kind is fixed at birth on its own stream: one of the four, with two charges, the same every time',()=>{
 assert.deepEqual(DEPLOY_KINDS,['drone','munition','turret','bomber_bot'],'saved ids, only ever appended to');
 for(const id of DEPLOY_KINDS)assert.ok(ENEMY_TYPES[id],id);
 assert.equal(T.deployerCharges,2);assert.equal(T.deployerLive,1);
 const seen=new Set();let n=0;
 for(let seed=1;seed<=30;seed++)for(const floor of [5,6]){
  const a=generate(seed,floor,[],hard,'loyalist'),b=generate(seed,floor,[],hard,'loyalist');
  assert.deepEqual(deployers(a).map(e=>[e.id,e.deployKind,e.deployCharges]),deployers(b).map(e=>[e.id,e.deployKind,e.deployCharges]),'deterministic');
  for(const e of deployers(a)){n++;assert.equal(e.deployKind,deployKindOf(seed,floor,e.id));assert.equal(e.deployCharges,2);seen.add(e.deployKind);}
  for(const e of a.enemies.filter(e=>!e.affixes?.some(x=>x.id==='deployer')))assert.ok(e.deployKind===undefined&&e.deployCharges===undefined,'only a deployer carries them');
 }
 assert.ok(n>=10,`${n} deployers`);assert.deepEqual([...seen].sort(),[...DEPLOY_KINDS].sort(),'all four kinds come up');
 // giveEnemyAffix alone does not arm one (only the birth roll does); arming takes only a deployer and a known kind.
 const u=makeEnemy('rifleman',1,1,'u',6,hard);assert.equal(armDeployer(u,'drone'),false);giveEnemyAffix(u,'deployer');assert.equal(u.deployKind,undefined);
 assert.equal(armDeployer(u,'tank'),false);assert.ok(armDeployer(u,'turret'));assert.deepEqual([u.deployKind,u.deployCharges],['turret',2]);
});

test('start floors: hard from floor 3, standard from floor 5, never in the easy campaign; endless reaches it deep',()=>{
 assert.equal(deployerChance(2,hard),0);assert.equal(deployerChance(3,hard),T.deployerPerDepth);
 assert.equal(deployerChance(4,standard),0);assert.equal(deployerChance(5,standard),T.deployerPerDepth);
 for(let f=1;f<=6;f++)assert.equal(deployerChance(f,easy),0,`easy ${f}`);assert.ok(deployerChance(8,easy)>0,'endless reaches it');
 assert.equal(DIFFICULTY_CURVES.classic.varietyStart,8,'classic unchanged');
 const count=(d,floor)=>{let n=0;for(let seed=1;seed<=25;seed++)n+=deployers(generate(seed,floor,[],d,'loyalist')).length;return n;};
 assert.equal(count(hard,2),0);assert.ok(count(hard,3)>0);
 assert.equal(count(standard,4),0);assert.ok(count(standard,5)>0);
 for(const f of [1,3,6])assert.equal(count(easy,f),0);
});

test('infected soldiers never deploy',()=>{
 const def=ENEMY_AFFIXES.find(a=>a.id==='deployer');
 for(const type of ['rifleman_infected','raider_infected'])assert.equal(def.applies(makeEnemy(type,1,1,'x',6,hard,'swarm')),false,type);
 assert.ok(def.applies(makeEnemy('rifleman',1,1,'x',6,hard,'loyalist')));
 for(let seed=1;seed<=30;seed++)for(const floor of [5,6,12])assert.equal(deployers(generate(seed,floor,[],hard,'swarm')).length,0,`swarm ${seed} ${floor}`);
});

test('a drone deployer: beside it, two in all, one of its own up at a time; the name shows the kind once revealed',()=>{
 const g=field(),p=g.player,e=deployer(g,'drone');
 assert.match(enemyDisplayName(e),/？$/,'hidden until it deploys');
 g.enemyAct(e);
 let [d]=live(g,e);assert.ok(d,'deployed');assert.equal(d.type,'drone');assert.equal(distance(d,e),1,'beside it');assert.equal(d.id,`${e.id}-deploy-0`);
 assert.equal(e.deployCharges,1);
 assert.deepEqual(enemyNameParts(e).fragments,[t('enemyAffixes.deployer.drone')]);assert.ok(enemyDisplayName(e).endsWith(t('enemy-affixes.fragment',{fragment:t('enemyAffixes.deployer.drone')})),enemyDisplayName(e));
 assert.ok(g.logs.some(l=>l.text===t('enemy-behavior.deployUnit',{name:enemyDisplayName(e),unit:enemyDisplayName(d)})));
 // While it is up, no second one, whatever the dice.
 for(let n=0;n<3;n++){g.turn++;e.charge=false;g.enemyAct(e);}
 assert.equal(ownDeployed(g,e).length,1);assert.equal(e.deployCharges,1);
 // Once it is down, the second and last.
 d.hp=1;g.hurt(d,5,p);g.turn++;e.charge=false;g.enemyAct(e);
 assert.equal(live(g,e).length,1);assert.equal(live(g,e)[0].id,`${e.id}-deploy-1`,'ids are never reused');assert.equal(e.deployCharges,0);
 live(g,e)[0].hp=0;for(let n=0;n<4;n++){g.turn++;e.charge=false;g.enemyAct(e);}
 assert.equal(ownDeployed(g,e).length,2,'not infinite');assert.equal(e.deployCharges,0);
});

test('a bomb bot goes beside the deployer; the trigger is 3.103.0\'s (sight, distance 4 to 7)',()=>{
 const g=field(),e=deployer(g,'bomber_bot');
 e.x=13;g.reveal();g.enemyAct(e);assert.equal(ownDeployed(g,e).length,0,'distance 3: too close');
 e.x=18;g.reveal();g.turn++;g.enemyAct(e);assert.equal(ownDeployed(g,e).length,0,'distance 8: too far');
 e.x=17;g.reveal();g.turn++;g.enemyAct(e);
 const [b]=live(g,e);assert.ok(b);assert.equal(b.type,'bomber_bot');assert.equal(distance(b,e),1);
 // Every tile beside it taken (other units stand there): nothing, and the charge is kept; one frees up, it goes there.
 const k=field(),c=deployer(k,'drone',15,10),around=[[16,10],[14,10],[15,9],[15,11]].map(([x,y],i)=>{const o=makeEnemy('raider',x,y,`wall-${i}`,6,hard,'loyalist');o.hp=o.maxHp=500;k.enemies.push(o);return o;});
 k.reveal();assert.equal(deploySpot(k,c,k.player),null);k.enemyAct(c);assert.equal(ownDeployed(k,c).length,0);assert.equal(c.deployCharges,2);
 around[0].hp=0;c.charge=false;k.turn++;k.enemyAct(c);const [w]=live(k,c);assert.ok(w);assert.deepEqual([w.x,w.y],[16,10]);
 // Unseen, nothing.
 const h=field(),f=deployer(h,'bomber_bot');for(let y=0;y<h.grid.length;y++)h.grid[y][13]=0;h.reveal();h.enemyAct(f);assert.equal(ownDeployed(h,f).length,0);
});

test('a turret goes on a free tile beside it that sees you and is in its range; none, and no charge is spent',()=>{
 const g=field(),p=g.player,e=deployer(g,'turret',17,10);   // distance 7: only (16,10) beside it is in the turret's range
 g.props.push({id:'crate',type:'cover',x:16,y:10,hp:65,maxHp:65});g.reveal();
 assert.equal(deploySpot(g,e,p),null);
 g.enemyAct(e);
 assert.equal(ownDeployed(g,e).length,0,'no deployment');assert.equal(e.deployCharges,2,'and no charge spent');
 assert.ok(e.charge||e.moved,'it fights as usual instead (winds up its shot or closes in)');
 assert.equal(e.affixes.find(a=>a.id==='deployer').revealed,false,'nothing revealed');
 g.props=[];e.x=17;e.y=10;g.turn++;e.charge=false;g.reveal();g.enemyAct(e);
 const [u]=live(g,e);assert.ok(u);assert.equal(u.type,'turret');assert.deepEqual({x:u.x,y:u.y},{x:16,y:10});assert.equal(e.deployCharges,1);
 assert.deepEqual(enemyNameParts(e).fragments,[t('enemyAffixes.deployer.turret')]);
 // A tile that cannot see you does not count: with every tile beside it cut off from you (sight from a bare tile refused;
 // the units' own sight untouched), it keeps its charge; a drone or a bomb bot needs no sight of you.
 const h=field(),f=deployer(h,'turret',15,10),real=h.sight.bind(h);
 h.sight=(a,b)=>a?.id||a===h.player?real(a,b):false;
 assert.equal(deploySpot(h,f,h.player),null);h.enemyAct(f);assert.equal(ownDeployed(h,f).length,0);assert.equal(f.deployCharges,2);
 for(const kind of ['drone','bomber_bot'])assert.equal(distance(deploySpot(h,f,h.player,kind),f),1,kind);
 h.sight=real;const q=deploySpot(h,f,h.player);assert.ok(q&&real(q,h.player)&&distance(q,f)===1);
});

test('the fixed turret never moves: it winds up once, fires every round, and waits when it cannot shoot',()=>{
 const g=field(),p=g.player,u=makeEnemy('turret',15,10,'tur',6,hard,'loyalist');u.alert=true;g.enemies.push(u);g.reveal();
 g.rng=Object.assign(()=>0,{state:()=>1});
 assert.ok(ENEMY_TYPES.turret.mechanical&&ENEMY_TYPES.turret.rapid&&!ENEMY_TYPES.turret.tags.includes('armed'));
 g.enemyAct(u);assert.ok(u.charge,'the warning round');assert.equal(p.hp,p.maxHp);
 const hp=p.hp;g.turn++;g.enemyAct(u);assert.ok(p.hp<hp,'fires');assert.ok(u.charge,'and stays ready (rapid)');
 const hp2=p.hp;g.turn++;g.enemyAct(u);assert.ok(p.hp<hp2,'fires again next round');
 // Out of range: it does not walk; the wound-up shot is let go.
 p.x=3;g.reveal();g.turn++;g.enemyAct(u);assert.deepEqual([u.x,u.y],[15,10]);assert.equal(u.charge,false);
 // Behind a wall: it does not walk either; nor off a hazard.
 p.x=10;for(let y=0;y<g.grid.length;y++)g.grid[y][12]=0;g.hazards.push({x:15,y:10,type:'acid'});g.reveal();
 for(let n=0;n<3;n++){g.turn++;g.enemyAct(u);}
 assert.deepEqual([u.x,u.y],[15,10]);
});

test('what it deploys pays nothing when it falls: no xp, scrap, drops or protocol',()=>{
 for(const kind of DEPLOY_KINDS){
  const g=field(),p=g.player,e=deployer(g,kind,15,10);g.enemyAct(e);
  const [d]=live(g,e);assert.ok(d,kind);assert.equal(d.expendable,true);assert.equal(d.reinforcement,true);
  const pay=()=>({xp:p.xp,scrap:p.scrap,items:g.items.length,protocol:g.protocol.earned}),before=pay(),kills=p.kills;
  g.rng=Object.assign(()=>0,{state:()=>1});   // every drop roll would land
  d.hp=1;g.hurt(d,5,p);assert.ok(d.hp<=0);
  assert.deepEqual(pay(),before,kind);assert.equal(p.kills,kills+1,'it still counts as a kill');
 }
});

test('saves: the kind and charges round-trip; broken data is refused, charges past the tuning are cut',()=>{
 assert.equal(SAVE_VERSION,93);assert.equal(RUN_SAVE_FLOOR,88);
 assert.ok(ORDER.ids.includes('deploy'));assert.deepEqual(Object.keys(specialDef('deploy').fields).sort(),['deployCharges','deployKind']);
 const g=field(),e=deployer(g,'turret',16,10);g.enemyAct(e);assert.equal(live(g,e).length,1);
 g.rng=new Game(1,[],0,'soldier','onyx').rng;
 const raw=g.serialize(),back=Game.restore(raw);assert.ok(back);
 assert.deepEqual(back.enemies.map(x=>[x.id,x.type,x.deployKind,x.deployCharges,x.expendable,x.reinforcement]),g.enemies.map(x=>[x.id,x.type,x.deployKind,x.deployCharges,x.expendable,x.reinforcement]));
 const tamper=fn=>{const d=JSON.parse(raw);fn(d.data.enemies.find(x=>x.id===e.id),d.data.enemies);return Game.restore(JSON.stringify(d));};
 for(const [why,fn] of [
  ['an unknown kind',x=>{x.deployKind='tank';}],['a kind that is not a string',x=>{x.deployKind=3;}],
  ['no kind on a deployer',x=>{delete x.deployKind;}],['no charges on a deployer',x=>{delete x.deployCharges;}],
  ['negative charges',x=>{x.deployCharges=-1;}],['fractional charges',x=>{x.deployCharges=1.5;}],
  ['a kind on a unit that does not deploy',(x,all)=>{all.find(u=>u.id!==x.id).deployKind='drone';}],
  ['charges on a unit that does not deploy',(x,all)=>{all.find(u=>u.id!==x.id).deployCharges=1;}],
 ])assert.equal(tamper(fn),null,why);
 const cut=tamper(x=>{x.deployCharges=9;});assert.ok(cut,'tuning-bound: cut, not refused');assert.equal(cut.enemies.find(x=>x.id===e.id).deployCharges,T.deployerCharges);
 assert.ok(tamper(x=>{x.deployCharges=0;}),'spent is fine');
 // A floor kept on a round trip is checked the same way.
 const r=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'loyalist'});Object.assign(r.player,r.exitPoint);assert.equal(r.exitBlocked,'');assert.ok(r.descend());
 const kept=JSON.parse(r.serialize()),u=makeEnemy('rifleman',1,1,'kept-dep',1,hard,'loyalist');giveEnemyAffix(u,'deployer');
 const f1=kept.data.floorStates[1],taken=q=>[...f1.enemies,...f1.props,f1.start,f1.end].some(o=>o&&o.x===q.x&&o.y===q.y)||(f1.hazards||[]).some(o=>o.x===q.x&&o.y===q.y);
 let spot=null;for(let y=1;y<f1.grid.length-1&&!spot;y++)for(let x=1;x<f1.grid.length-1&&!spot;x++)if(f1.grid[y][x]===1&&!taken({x,y}))spot={x,y};
 const keptRaw=k=>{const d=structuredClone(kept);const x=structuredClone(u);Object.assign(x,k,spot);d.data.floorStates[1].enemies.push(x);return JSON.stringify(d);};
 const ok=Game.restore(keptRaw({deployKind:'drone',deployCharges:1}));assert.ok(ok,'kept floor: a whole deployer loads');assert.equal(ok.floorStates[1].enemies.find(x=>x.id==='kept-dep').deployKind,'drone');
 assert.equal(Game.restore(keptRaw({deployKind:'drone',deployCharges:7})).floorStates[1].enemies.find(x=>x.id==='kept-dep').deployCharges,T.deployerCharges,'kept floor: cut too');
 assert.equal(Game.restore(keptRaw({deployKind:'drone'})),null,'kept floor: a deployer without its charges');
 assert.equal(Game.restore(keptRaw({deployKind:'nope',deployCharges:1})),null,'kept floor: an unknown kind');
});

// 3.212.0 review: rules the first tests never caught breaking.
test('a deployed unit never lands on a hazard, across a closed edge, or past the floor\'s room; none of it spends a charge',()=>{
 const g=field(),e=deployer(g,'drone',15,10);
 g.hazards.push({x:16,y:10,type:'acid'},{x:15,y:9,type:'acid'},{x:15,y:11,type:'acid'});
 g.barriers.push(makeBarrier('door',{x:15,y:10},{x:14,y:10},'edge-deploy'));g.reveal();
 assert.equal(deploySpot(g,e,g.player),null,'hazards on three sides, a closed door on the fourth');
 g.enemyAct(e);assert.equal(ownDeployed(g,e).length,0);assert.equal(e.deployCharges,2);
 g.hazards=g.hazards.filter(h=>!(h.x===15&&h.y===9));assert.deepEqual(deploySpot(g,e,g.player),{x:15,y:9},'the one clear tile');
 // No room on the floor (RUNTIME_TUNING.liveLimit living enemies): nothing, and the charge is kept.
 const k=field(),c=deployer(k,'drone',15,10);
 for(let n=0;k.enemies.filter(o=>o.hp>0).length<RUNTIME_TUNING.liveLimit;n++){const o=makeEnemy('raider',1+n%5,1+Math.floor(n/5)%5,`pad-${n}`,6,hard,'loyalist');o.alert=false;k.enemies.push(o);}
 k.reveal();k.enemyAct(c);assert.equal(ownDeployed(k,c).length,0,'floor full');assert.equal(c.deployCharges,2);
});

test('a turret\'s tile is judged by a turret standing there: it finds you in the black, and needs a clear shot',()=>{
 // Everything black: a deployer with night vision sees you; a machine on the tile beside it would find you too.
 const g=field();g.lightModel=LIGHT_MODEL;g.lamps=[];g.lighting=g.grid.map(row=>row.map(()=>0));
 const e=sceneEnemy(g,'rifleman',['deployer','night_vision'],15,10);assert.ok(armDeployer(e,'turret'));e.alert=true;e.lastKnown={x:10,y:10};g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();
 assert.ok(isBlack(g,g.player)&&g.sight(e,g.player));
 const q=deploySpot(g,e,g.player);assert.ok(q,'a tile is found in the black');
 g.enemyAct(e);const [u]=live(g,e);assert.ok(u,'and the turret goes up');assert.equal(g.sight(u,g.player),true,'and it does see you');
 // A tile that sees you but has no shot (sight allowed, the shot refused from every tile beside it): none.
 const h=field(),f=deployer(h,'turret',15,10),real=h.shotClear.bind(h);
 h.shotClear=(a,b)=>a?.type==='turret'?false:real(a,b);
 assert.equal(deploySpot(h,f,h.player),null);h.enemyAct(f);assert.equal(ownDeployed(h,f).length,0);assert.equal(f.deployCharges,2);
});

test('the turret holds its fire without a clear shot, even with you in sight',()=>{
 const g=field(),p=g.player,u=makeEnemy('turret',15,10,'tur',6,hard,'loyalist');u.alert=true;g.enemies.push(u);g.reveal();
 g.rng=Object.assign(()=>0,{state:()=>1});const real=g.shotClear.bind(g);g.shotClear=(a,b)=>a===u?false:real(a,b);
 assert.ok(g.sight(u,p));
 for(let n=0;n<3;n++){g.turn++;g.enemyAct(u);}
 assert.equal(u.charge,false,'never winds up');assert.equal(p.hp,p.maxHp,'never fires');
 g.shotClear=real;g.turn++;g.enemyAct(u);assert.ok(u.charge,'with the shot back, it winds up');
});

test('a unit spawned marked expendable (what a deployer puts out) rolls ordinary affixes but never elite',()=>{
 const g=field();g.floor=20;g.difficulty='hard';g.difficultyOffset=0;
 const plain=Array.from({length:300},(_,i)=>g.spawnEnemy('turret',3,3,`plain-${i}`)),marked=Array.from({length:300},(_,i)=>g.spawnEnemy('turret',3,3,`mark-${i}`,{expendable:true,reinforcement:true}));
 assert.ok(plain.some(e=>e.elite),'deep enough that an unmarked turret can roll elite');
 assert.equal(marked.filter(e=>e.elite).length,0,'marked before the rolls: never');
 assert.ok(marked.some(e=>e.affixes.length),'ordinary affixes still roll');
 assert.ok(marked.every(e=>e.expendable&&e.reinforcement));
});

test('a run saved before 3.212.0 with a deployer still loads (to be settled): one munition, spent or not',()=>{
 const g=field(),e=deployer(g,'drone',18,10);g.rng=new Game(1,[],0,'soldier','onyx').rng;
 const d=JSON.parse(g.serialize());d.version=87;
 const old=d.data.enemies.find(x=>x.id===e.id);delete old.deployKind;delete old.deployCharges;old.munitionSpent=true;
 const second=structuredClone(old);second.id='dep-2';second.y=12;delete second.munitionSpent;d.data.enemies.push(second);
 const back=Game.restore(JSON.stringify(d));assert.ok(back,'not refused');
 assert.deepEqual(['dep-2',e.id].map(id=>{const x=back.enemies.find(u=>u.id===id);return [x.deployKind,x.deployCharges];}),[['munition',1],['munition',0]]);
 d.version=88;assert.equal(Game.restore(JSON.stringify(d)),null,'a 3.212.0 save without them is still broken data');
});

test('a deployer will not set a unit on a mine it has seen',()=>{
 const g=field(),e=deployer(g,'drone',15,10);
 g.hazards.push({x:16,y:10,type:'acid'},{x:15,y:9,type:'acid'},{x:15,y:11,type:'acid'});g.mines=[{id:'mine-1-1',x:14,y:10,seen:[e.id]}];g.reveal();
 assert.equal(deploySpot(g,e,g.player),null,'the only free tile holds a mine it saw');
 g.mines[0].seen=[];assert.deepEqual(deploySpot(g,e,g.player),{x:14,y:10},'one it never saw is just a tile');
});
