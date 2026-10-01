import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Game,SIZE,WEAPONS,makeEnemy,generate,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {giveEnemyAffix} from '../src/enemy-affixes.js';
import {CONCEAL_TUNING,disguiseKinds,concealChance,canConceal,disguiseProp} from '../src/concealed.js';
import {targetDetails} from '../src/target-card.js';
import {containerName} from '../src/containers.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {squadMembers} from '../src/squad.js';
import {grantTrait} from '../src/traits.js';
import {addAlly} from '../src/allies.js';
import {t} from '../src/i18n.js';
import {LIGHT_MODEL,carriesFlashlight,enemyFlashlightOn} from '../src/lighting.js';
import {duelActive,grapplePlan,hookBladePlan} from '../src/melee-classes.js';
import {ignite} from '../src/fire.js';
import {throwDecoy,placeMine,mineReason,checkMines} from '../src/field-gear.js';
import {coneTargets} from '../src/shotgun.js';
import {lancePath} from '../src/lance.js';
import {suppressiveFire} from '../src/suppressive-fire.js';
import {tongueCatch,tongueLane} from '../src/swarm.js';
import {witnessDeath} from '../src/rebels.js';
import {carrierCandidate} from '../src/vault.js';
import {prepareMission} from '../src/missions.js';
import {RIG_TUNING} from '../src/containers.js';

// 3.217.0 埋伏 (user 2026-09-30, docs/ENEMY_VARIETY.md section 6): one or two a floor hide — a soldier as a supply case,
// a biter under the floor — until you come within reach (4 / 2 tiles) where it sees you, it is hurt, or you walk into it.
// Coming close, it acts at once, unwarned.
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=[];g.flares=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function hidden(g,type,x,y=10,as='case',faction='loyalist'){const e=makeEnemy(type,x,y,'hid',6,hard,faction);giveEnemyAffix(e,'concealed');e.concealed=as==='case'?{as,kind:'ammo'}:{as};g.enemies.push(e);g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return e;}
const turn=(g,e)=>{g.turn++;g.enemyAct(e);};
const hiddenOf=m=>m.enemies.filter(e=>e.concealed);
const sure=g=>{g.rng=Object.assign(()=>0,{state:()=>1});};

test('where: one or two a floor from hard floor 3 and standard floor 5; soldiers as cases, biters under the floor',()=>{
 assert.equal(concealChance(2,hard),0);assert.equal(concealChance(3,hard),CONCEAL_TUNING.perDepth);
 assert.equal(concealChance(4,standard),0);assert.equal(concealChance(5,standard),CONCEAL_TUNING.perDepth);
 for(let f=1;f<=6;f++)assert.equal(concealChance(f,easy),0);
 let seen=0;
 for(let seed=1;seed<=25;seed++)for(const faction of ['loyalist','rebel','swarm']){
  const a=generate(seed,6,[],hard,faction),b=generate(seed,6,[],hard,faction);
  assert.deepEqual(hiddenOf(a).map(e=>[e.id,e.concealed]),hiddenOf(b).map(e=>[e.id,e.concealed]),'deterministic');
  assert.ok(hiddenOf(a).length<=CONCEAL_TUNING.perFloor);seen+=hiddenOf(a).length;
  for(const e of hiddenOf(a)){
   assert.ok(e.affixes.some(x=>x.id==='concealed'&&!x.revealed));assert.ok(canConceal(e,faction));
   if(faction==='swarm'){assert.deepEqual(e.concealed,{as:'burrow'});assert.ok(['crawler','giant_bug'].includes(e.type),e.type);}
   else{assert.equal(e.concealed.as,'case');assert.ok(disguiseKinds().includes(e.concealed.kind));assert.ok(!['sniper','squad_leader','enforcer'].includes(e.type),e.type);
    assert.ok(a.props.some(o=>o.type==='container'&&o.kind===e.concealed.kind),"one of the floor's own kinds of case");}
   assert.ok(!e.keycard,'never the keycard carrier');
  }
 }
 assert.ok(seen>=60,`${seen}`);
 // The infected are an expendable crowd on a card of their own: never one of the hidden.
 assert.equal(canConceal(makeEnemy('fodder',1,1,'f',6,hard,'swarm'),'swarm'),false);assert.ok(canConceal(makeEnemy('crawler',1,1,'c',6,hard,'swarm'),'swarm'));
 for(let seed=1;seed<=15;seed++){assert.equal(hiddenOf(generate(seed,2,[],hard,'loyalist')).length,0);assert.equal(hiddenOf(generate(seed,6,[],easy,'rebel')).length,0);}
 assert.ok(!disguiseKinds().includes('vault'));
});

test('hidden: no enemy you see; a disguise is a case you can tap-lock, a burrowed bug nothing; your units never see either',()=>{
 const g=field(),p=g.player,c=hidden(g,'rifleman',16);
 assert.equal(g.visibleEnemies.includes(c),false,'not in sight lists (auto-target, ⌖ cycle)');
 assert.equal(g.sight(p,c),true,'you see the case');g.target=c.id;assert.equal(g.targeted,c,'it locks, as a rigged case');
 const card=targetDetails(g);assert.equal(card.name,containerName(disguiseProp(c)),'the card shows the case');assert.equal(card.fullName,'');
 const drone=addAlly(g,'drone','drone',{point:{x:12,y:11},sourceId:'drone_follow'});assert.ok(drone);assert.equal(g.sight(drone,c),false,'your units do not know');
});

test('come within reach where it sees you: a soldier drops the disguise and fires at once, unwarned',()=>{
 const g=field(),p=g.player,e=hidden(g,'rifleman',15);
 turn(g,e);assert.ok(e.concealed,'5 tiles: still hidden');assert.equal(p.hp,999);assert.deepEqual([e.x,e.y],[15,10],'it never moves while hidden');
 p.x=11;g.reveal();turn(g,e);
 assert.equal(e.concealed,undefined);assert.ok(p.hp<999,'shot at once');assert.equal(e.charge,false,'no wind-up left behind');
 assert.ok(e.affixes.find(a=>a.id==='concealed').revealed);assert.ok(g.logs.some(l=>l.text===t('concealed.drop',{enemy:enemyDisplayName(e)})));
 assert.ok(g.visibleEnemies.includes(e));
});

test('a burrowed bug bursts out within two tiles and bites if a step puts it beside you',()=>{
 const g=field(),p=g.player,e=hidden(g,'crawler',13,10,'burrow','swarm');
 turn(g,e);assert.ok(e.concealed,'3 tiles: still hidden');
 p.x=11;g.reveal();turn(g,e);assert.equal(e.concealed,undefined);assert.deepEqual([e.x,e.y],[12,10],'one step');assert.ok(p.hp<999,'and the bite');
 assert.ok(g.logs.some(l=>l.text===t('concealed.burst',{enemy:enemyDisplayName(e)})));
});

test('any damage shows it (a shot at the case, a blast over the bug); walking into it shows it without a blow',()=>{
 const g=field(),e=hidden(g,'rifleman',16);e.hp=e.maxHp=500;g.enemyAct=()=>{};g.target=e.id;assert.ok(g.action('fire'));assert.equal(e.concealed,undefined,'shot');
 const k=field(),b=hidden(k,'giant_bug',16,10,'burrow','swarm');k.explode({x:16,y:10},1,10);assert.equal(b.concealed,undefined,'a blast flushes it out');
 const w=field(),h=hidden(w,'rifleman',11);const hp=h.hp;assert.equal(w.action('move',[1,0]),false,'the tile is taken');
 assert.equal(h.concealed,undefined,'walking into it shows it');assert.equal(h.hp,hp,'no blow struck');assert.deepEqual([w.player.x,w.player.y],[10,10]);
});

test('the early warning marks a burrowed bug: then you see it and can shoot it',()=>{
 const g=field(),p=g.player,e=hidden(g,'giant_bug',16,10,'burrow','swarm');
 assert.equal(g.sight(p,e),false);assert.equal(g.visibleEnemies.includes(e),false);
 grantTrait(e,'exposed','skill:early_warning',2);g.reveal();
 assert.equal(g.sight(p,e),true);assert.ok(g.visibleEnemies.includes(e),'marked, it is an enemy you see');assert.ok(e.concealed,'still under the floor');
});

test('the controller says one vague line on a floor with a hidden threat, once',()=>{
 const g=field();hidden(g,'rifleman',20);const memory=newCommsMemory('r');
 const first=commsEvents({game:g,memory}).map(e=>e.type);assert.ok(first.includes('hiddenThreat'));
 assert.ok(!commsEvents({game:g,memory}).map(e=>e.type).includes('hiddenThreat'),'once a floor');
 const none=field();assert.ok(!commsEvents({game:none,memory:newCommsMemory('s')}).map(e=>e.type).includes('hiddenThreat'));
});

test('while hidden: in no squad, and no decoy or mine moves it',()=>{
 const g=field(),e=hidden(g,'rifleman',16);e.alert=true;const leader=makeEnemy('squad_leader',18,10,'lead',6,hard,'loyalist');leader.alert=true;g.enemies.push(leader);
 assert.ok(!squadMembers(g,leader).includes(e));
 // A decoy or a mine never takes its turn: hidden, it only watches (Game.enemyAct).
 g.decoy={x:15,y:10,hp:30,maxHp:30,expires:g.turn+4,fooled:[e.id]};g.mines=[{id:'mine-1-1',x:16,y:11,seen:[e.id]}];g.reveal();
 turn(g,e);assert.ok(e.concealed);assert.equal(g.decoy.hp,30,'no shot at the decoy');assert.equal(g.mines.length,1,'no shot at the mine');
});

test('saves: the hiding round-trips; a broken one is refused',()=>{
 const g=field(),e=hidden(g,'rifleman',16);g.rng=new Game(1,[],0,'soldier','onyx').rng;
 const raw=g.serialize(),back=Game.restore(raw);assert.ok(back);assert.deepEqual(back.enemies.find(x=>x.id==='hid').concealed,{as:'case',kind:'ammo'});
 const tamper=fn=>{const d=JSON.parse(raw);fn(d.data.enemies.find(x=>x.id==='hid'));return Game.restore(JSON.stringify(d));};
 for(const [why,fn] of [['an unknown kind',x=>{x.concealed.kind='vault';}],['an unknown shape',x=>{x.concealed={as:'ghost'};}],['without the affix',x=>{x.affixes=x.affixes.filter(a=>a.id!=='concealed');}],['the affix already shown',x=>{x.affixes.find(a=>a.id==='concealed').revealed=true;}],['extra keys on a burrow',x=>{x.concealed={as:'burrow',kind:'ammo'};}]])
  assert.equal(tamper(fn),null,why);
});

test('within reach but out of its sight it stays hidden; the real enemy phase gives it its watch',()=>{
 const g=field(),p=g.player,e=hidden(g,'rifleman',13);for(let y=0;y<g.grid.length;y++)g.grid[y][12]=0;g.reveal();
 turn(g,e);assert.ok(e.concealed,'a wall between: it does not see you');
 // Through Game.action: a hidden unit's turn comes round whether or not it is alert (src/game-actions.js).
 const k=field(),h=hidden(k,'rifleman',13);k.action('wait');assert.equal(h.concealed,undefined,'it saw you from 3 tiles and fired');assert.ok(k.player.hp<999);
});

test('nothing gives it away before it shows: it spots no one, says nothing, keeps its torch dark, is no duel foe',()=>{
 const g=field(),p=g.player,e=hidden(g,'rifleman',16);g.effects=[];g.reveal();
 assert.equal(e.alert,false,'6 tiles in plain view: no alert');assert.ok(!g.effects.some(x=>x.type==='callout'),'no call heard');
 e.alert=true;g.effects=[];g.enemyCallout(e,'state',{state:'spotted'});assert.ok(!g.effects.some(x=>x.type==='callout'),'a hidden unit has no voice');
 const lit={lightModel:LIGHT_MODEL,seed:5,floor:3,enemies:[]};const torch=Array.from({length:40},(_,i)=>makeEnemy('rifleman',1,1,`t${i}`)).find(x=>carriesFlashlight(lit,x));
 lit.enemies.push(torch);torch.alert=true;assert.ok(enemyFlashlightOn(lit,torch));torch.concealed={as:'case',kind:'ammo'};assert.equal(enemyFlashlightOn(lit,torch),false,'its torch stays dark');
 grantTrait(p,'duelist','qa',99);const foe=makeEnemy('rifleman',13,10,'foe',6,hard,'loyalist');foe.alert=true;g.enemies.push(foe);g.reveal();
 assert.ok(duelActive(g),'one foe you can see; the hidden one is not a second');
});

test("the ninja's last shadow step strikes a foe beside it, never a hidden one",()=>{
 const n=new Game(3470,[],0,'ninja','onyx');n.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));n.lighting=n.grid.map(r=>r.map(()=>1));
 Object.assign(n,{barriers:[],props:[],items:[],hazards:[],marks:[],enemies:[],allies:[],smoke:[],end:{x:20,y:20}});Object.assign(n.player,{x:10,y:10});n.rng=Object.assign(()=>0,{state:()=>0});
 n.player.perks.ninja_shadowstep=3;const h=hidden(n,'rifleman',12);const hp=h.hp;n.target=null;n.shadowSteps=1;
 assert.ok(n.action('move',[1,0]));assert.equal(n.shadowSteps,0);assert.ok(h.concealed,'still hidden');assert.equal(h.hp,hp,'not struck');
});

test('on a burning tile it does not flinch off while hidden: the fire reaches it and flushes it out',()=>{
 for(const [type,as,faction] of [['rifleman','case','loyalist'],['crawler','burrow','swarm']]){
  const g=field(),e=hidden(g,type,18,10,as,faction);e.hp=e.maxHp=500;g.enemyAct=()=>{};ignite(g,[{x:18,y:10}]);assert.ok(g.fires.some(f=>f.x===18&&f.y===10));
  g.action('wait');assert.deepEqual([e.x,e.y],[18,10],`${type}: never moves while hidden`);assert.ok(e.hp<500,`${type}: burnt`);assert.equal(e.concealed,undefined,`${type}: and shown`);
 }
});

test('a stun grenade that catches it shows it, stunned, with no call to attack',()=>{
 for(const [type,as,faction] of [['rifleman','case','loyalist'],['giant_bug','burrow','swarm']]){
  const g=field(),e=hidden(g,type,15,10,as,faction);g.effects=[];g.applyThrowable('stun',{x:15,y:10},0,g.player);
  assert.equal(e.concealed,undefined,type);assert.ok(e.control.disabled>0);
  assert.ok(g.logs.some(l=>l.text===t(as==='burrow'?'concealed.burst':'concealed.drop',{enemy:enemyDisplayName(e)})),'it shows before the stun is told');
  assert.ok(!g.effects.some(x=>x.type==='callout'&&x.cue==='attack'),'stunned, it calls no attack');
  const k=field(),h=hidden(k,type,15,10,as,faction);k.enemyStun({x:15,y:10});assert.equal(h.concealed,undefined,`${type}: an enemy's stun grenade too`);
 }
});

test('the decoy and the mine know nothing of it: not drawn off, no watcher, no probe; a mine on a burrowed bug goes off',()=>{
 const g=field(),e=hidden(g,'rifleman',16);g.player.decoys=1;throwDecoy(g,{x:14,y:10});assert.ok(!g.decoy.fooled.includes(e.id),'not drawn off');assert.equal(e.alert,false);
 g.player.mines=2;placeMine(g,{x:12,y:10});assert.deepEqual(g.mines.at(-1).seen,[],'no one saw it laid');
 const d=field();hidden(d,'rifleman',12);d.player.mines=1;assert.equal(mineReason(d,{x:12,y:10}),t('field-gear.mineOccupied'),'a disguise takes the tile as its case would');
 const k=field(),b=hidden(k,'crawler',12,10,'burrow','swarm');k.player.mines=1;assert.equal(mineReason(k,{x:12,y:10}),'','no free probe of the floor');
 placeMine(k,{x:12,y:10});checkMines(k);assert.equal(b.concealed,undefined,'the blast flushes it out');
});

test('aim previews never give it away; the shot itself hits a disguise in the line, never a burrowed bug',()=>{
 const shotgun=Object.values(WEAPONS).find(w=>w.cone),lance={range:8};   // the lance is a plasma affix: only its range matters here
 const g=field(),p=g.player,c=hidden(g,'rifleman',12),foe=makeEnemy('rifleman',14,10,'foe',6,hard,'loyalist');g.enemies.push(foe);g.reveal();
 assert.ok(coneTargets(g,p,foe,shotgun).includes(c),'the pellets meet the body in the case');
 assert.ok(!coneTargets(g,p,foe,shotgun,false,{preview:true}).includes(c),'the preview shows a case');
 assert.ok(lancePath(g,p,foe,lance.range).units.includes(c),'the lance goes through it');
 // The card: a disguise beside the line (it shields no one) is not counted with the foe.
 const s=field(),q=s.player,side=hidden(s,'rifleman',12,11),aimed=makeEnemy('rifleman',14,10,'foe',6,hard,'loyalist');s.enemies.push(aimed);s.reveal();
 assert.ok(coneTargets(s,q,aimed,shotgun).includes(side));q.weapon=1;if(!q.owned.includes(1))q.owned.push(1);q.ammo[1]=4;s.target=aimed.id;   // weapon 1: the shotgun
 assert.ok(targetDetails(s).state.includes(t('target-card.reached',{v:t('target-card.cone'),reachedLength:1})),'the card counts the foe alone');
 const k=field(),b=hidden(k,'giant_bug',12,10,'burrow','swarm'),bug=makeEnemy('giant_bug',14,10,'foe',6,hard,'swarm');k.enemies.push(bug);k.reveal();
 assert.ok(!coneTargets(k,k.player,bug,shotgun).includes(b),'under the floor');assert.ok(!coneTargets(k,k.player,bug,shotgun,true).includes(b),'a blind shot too');assert.ok(!lancePath(k,k.player,bug,lance.range).units.includes(b));
 grantTrait(b,'exposed','skill:early_warning',2);assert.ok(coneTargets(k,k.player,bug,shotgun,false,{preview:true}).includes(b),'marked, it is in the line and the preview');
});

test('a volley into its area aims at no hidden unit; the hive tongue passes over one',()=>{
 const g=field(),e=hidden(g,'rifleman',14);e.hp=e.maxHp=500;g.player.skills.push('suppressive_fire');g.player.skillState.suppressive_fire={remaining:0,cooldown:0};g.player.prepared.skill='suppressive_fire';sure(g);g.effects=[];
 assert.ok(suppressiveFire(g,{x:14,y:11}));const shots=g.effects.filter(x=>x.type==='shot');assert.ok(shots.length>0);
 assert.ok(shots.every(x=>x.to.x===14&&x.to.y===11),'every round to the point you chose');assert.ok(e.concealed,'still hidden');assert.ok(!(e.suppression>0),'and not suppressed');
 const k=field(),b=hidden(k,'crawler',12,10,'burrow','swarm'),boss=makeEnemy('crawler',14,10,'boss',6,hard,'swarm');k.enemies.push(boss);
 assert.equal(tongueCatch(k,boss,tongueLane(k,boss,k.player)),k.player,'the lash reaches you, not the bug under the floor');
});

test('locked, it is a rigged case to the last detail: its hp, its chance, no grapple',()=>{
 const g=field(),c=hidden(g,'rifleman',17);g.target=c.id;   // 7 tiles: a soldier's chance and a case's differ
 assert.ok(targetDetails(g).hp.includes(`${RIG_TUNING.hp} / ${RIG_TUNING.hp}`),"a rigged case's hp");
 assert.notEqual(g.accuracy(g.player,c).chance,g.fireChance(disguiseProp(c)));assert.equal(g.fireChance(c),g.fireChance(disguiseProp(c)),"the shot rolls at a case's chance");
 assert.equal(grapplePlan(g,c.id).why,'target','the grapple finds no one');
});

test("the ninja's hook blade finds no one in a case",()=>{
 const n=new Game(3470,[],0,'ninja','onyx');n.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));n.lighting=n.grid.map(r=>r.map(()=>1));
 Object.assign(n,{barriers:[],props:[],items:[],hazards:[],marks:[],enemies:[],allies:[],smoke:[],end:{x:20,y:20}});Object.assign(n.player,{x:10,y:10});
 n.player.skillState.camouflage={remaining:2,cooldown:0};const c=hidden(n,'rifleman',13),foe=makeEnemy('rifleman',10,13,'foe',6,hard,'loyalist');n.enemies.push(foe);n.reveal();
 assert.notEqual(hookBladePlan(n,foe.id).why,'target','a soldier in the open is a target');assert.equal(hookBladePlan(n,c.id).why,'target');
});

test('hidden, a rebel sees no comrade fall; no keycard and no hunt target is a hidden unit',()=>{
 const g=field(),e=hidden(g,'rifleman',16,10,'case','rebel'),dead=makeEnemy('rifleman',15,10,'dead',6,hard,'rebel');dead.hp=0;g.enemies.push(dead);g.reveal();
 assert.ok(!witnessDeath(g,dead).includes(e),'no retreat while hidden');assert.equal(e.order,undefined);
 const open=field(),seen=makeEnemy('rifleman',16,10,'seen',6,hard,'rebel'),fell=makeEnemy('rifleman',15,10,'fell',6,hard,'rebel');fell.hp=0;open.enemies.push(seen,fell);open.reveal();
 assert.ok(witnessDeath(open,fell).includes(seen),'the same rebel in the open breaks');
 const unit=makeEnemy('rifleman',1,1,'k',6,hard,'loyalist');assert.ok(carrierCandidate(unit));unit.concealed={as:'case',kind:'ammo'};assert.equal(carrierCandidate(unit),false);
 const m=new Game(3,[],0,'soldier','onyx','sweep');m.floor=6;m.loadFloor();const first=m.enemies.find(e=>e.id===m.mission.targets[0].id);
 giveEnemyAffix(first,'concealed');first.concealed={as:'case',kind:'ammo'};prepareMission(m);assert.ok(!m.mission.targets.some(x=>x.id===first.id),'the hunt picks someone you can find');
});

// The drawing and the aim controls read the browser, so the wiring is checked in the source.
test('the screen treats a disguise as its case: cone boxes, move hint, interference, auto-retarget, volley aim',()=>{
 const src=f=>readFileSync(new URL(`../src/${f}`,import.meta.url),'utf8');
 assert.ok(src('renderer-telegraphs.js').includes('coneTargets(g,p,coneAim,w,false,{preview:true})'),'the cone boxes are a preview');
 assert.ok(src('renderer-map.js').includes('!g.enemies.some(e=>e.hp>0&&!e.concealed&&e.x===x&&e.y===y)'),'the move hint stays on its tile');
 assert.ok(src('renderer-effects.js').includes("g.enemies.filter(e=>e.hp>0&&e.concealed?.as==='case'&&g.visible(e)).map(e=>e.id)"),'it glitches with the cases');
 const aim=src('controller-aim.js');assert.ok(aim.includes('if(!locked||disguised(locked)||w.melee||'),'a locked disguise is left alone, as a rigged case');
 assert.ok(aim.includes('game.enemies.includes(e)&&!disguised(e)&&!suppressivePreview('),'the volley aim does not start on it');
});
