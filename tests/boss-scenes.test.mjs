import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily} from './helpers/source.mjs';
import {BOSS_SCENE_TUNING,introCamera,introDone,deathTimes,deathTimeScale,deathCamera,deathDone,deathBurst,bossIntroLine,bossKillLine,newBossSceneMemory,firstBossScene,bossFallOf,frontOfQueue} from '../src/boss-scenes.js';
import {KIA_TUNING,kiaTimes} from '../src/kia.js';
import {COMMS_LINES,COMMS_EXPRESSIONS,COMMS_SPEAKERS,resolveComms} from '../src/comms.js';
import {GORE_PALETTES} from '../src/gore.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {planPresentation,captureAction} from '../src/presentation.js';
import {ENEMY_TYPES,SIZE} from '../src/data.js';
import {Game} from '../src/game.js';
import {makeEnemy} from '../src/world.js';
import {isBossClass} from '../src/enemy-data.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import zh from '../src/text-zh-tw.js';
import en from '../src/text-en.js';

// 3.204.0 (user 2026-09-29, docs/BOSSES.md sections 5-6): the boss intro and kill scenes. The timings are pure functions;
// src/controller-comms.js plays them.
const D=BOSS_SCENE_TUNING.death,I=BOSS_SCENE_TUNING.intro;

test('the kill scene is the operative\'s cut short: 0.6 s of slow motion, two to three seconds in all',()=>{
  assert.ok(Object.isFrozen(BOSS_SCENE_TUNING)&&Object.isFrozen(D)&&Object.isFrozen(I));
  assert.equal(D.slowMs,600);assert.equal(KIA_TUNING.slowMs,1200);assert.ok(D.slowMs<KIA_TUNING.slowMs);
  const t=deathTimes();
  assert.ok(t.normalAt<=t.fallEnd&&t.fallEnd<t.voiceAt&&t.voiceAt<t.endAt,JSON.stringify(t));
  assert.ok(t.endAt>=2000&&t.endAt<=3000,`${t.endAt} ms`);assert.ok(t.endAt<kiaTimes().voiceAt+KIA_TUNING.zoomOutMs,'shorter than yours');
  assert.equal(t.normalAt,D.freezeMs+D.slowMs);
  assert.equal(deathTimeScale(-1),1);assert.equal(deathTimeScale(0),0);assert.equal(deathTimeScale(D.freezeMs-1),0);
  assert.equal(deathTimeScale(D.freezeMs),D.slowScale);assert.equal(deathTimeScale(t.normalAt-1),D.slowScale);assert.equal(deathTimeScale(t.normalAt),1);
  // A slower tuning moves every mark with it.
  const slow={...D,slowMs:1200};assert.ok(deathTimes(slow).endAt>t.endAt);
});

test('the kill scene\'s camera slides onto the body, pushes in, holds, and is back when the scene ends',()=>{
  const t=deathTimes();
  assert.deepEqual(deathCamera(-5,t),{blend:0,zoom:1});
  const start=deathCamera(0,t);assert.equal(start.blend,0);assert.equal(start.zoom,1);
  assert.equal(deathCamera(D.panMs,t).blend,1);assert.equal(deathCamera(D.zoomInMs,t).zoom,D.zoom);
  const held=deathCamera(t.voiceAt-1,t);assert.equal(held.blend,1);assert.equal(held.zoom,D.zoom);
  let last=held;for(let s=t.voiceAt;s<=t.endAt;s+=50){const c=deathCamera(s,t);assert.ok(c.blend<=last.blend+1e-9&&c.zoom<=last.zoom+1e-9);last=c;}
  const end=deathCamera(t.endAt,t);assert.ok(end.blend<1e-9&&Math.abs(end.zoom-1)<1e-9);
  assert.equal(deathDone(t.endAt-1,t),false);assert.equal(deathDone(t.endAt,t),true);
});

test('the intro holds on the boss while the line is up and slides back only after it has closed',()=>{
  assert.deepEqual(introCamera(-1),{blend:0,zoom:1});assert.equal(introCamera(0).blend,0);
  assert.equal(introCamera(I.panMs).blend,1);assert.ok(Math.abs(introCamera(I.panMs).zoom-I.zoom)<1e-9);
  assert.equal(introCamera(9000).blend,1,'a long line keeps it there');assert.equal(introDone(9000),false,'and the controls locked');
  const end=3000;assert.equal(introCamera(end,end).blend,1);
  assert.ok(introCamera(end+I.returnMs/2,end).blend>0&&introCamera(end+I.returnMs/2,end).blend<1);
  assert.equal(introCamera(end+I.returnMs,end).blend,0);assert.equal(introDone(end+I.returnMs-1,end),false);assert.equal(introDone(end+I.returnMs,end),true);
  // A line tapped away before the slide finished returns from where it got; a line that never reports back is cut off.
  const early=introCamera(I.panMs/2,I.panMs/2);assert.ok(early.blend>0&&early.blend<1);assert.equal(introCamera(I.panMs/2+I.returnMs,I.panMs/2).blend,0);
  assert.equal(introDone(I.maxMs+I.returnMs),true);assert.ok(I.quietMs>0&&I.quietMs<I.maxMs);
});

test('the kill burst is in what the boss is made of and follows the gore setting',()=>{
  const blow={dx:1,dy:0};
  for(const kind of ['mech','swarm','flesh']){const b=deathBurst(7,blow,kind);assert.ok(b.drops.length>0);assert.ok(b.drops.every(d=>GORE_PALETTES[kind].drops.includes(d.color)),kind);assert.ok(b.sparks.length>0);}
  assert.ok(deathBurst(7,blow,'mech').sparks.length>deathBurst(7,blow,'flesh').sparks.length,'machines throw more sparks');
  assert.equal(deathBurst(7,blow,'mech','simple').sparks.length,0,'simple: no light');assert.ok(deathBurst(7,blow,'mech','simple').drops.length>0);
  assert.equal(deathBurst(7,blow,'mech','off'),null);assert.equal(deathBurst(7,null,'mech'),null,'no direction, no burst');
  assert.deepEqual(deathBurst(9,blow,'swarm'),deathBurst(9,blow,'swarm'),'the same every time for the same seed');
});

test('lines: a boss\'s own intro when it has one, the generic line otherwise; the kill line only with the exit open',()=>{
  const pick=n=>({random:()=>n});
  const line=(speaker,type)=>bossIntroLine(speaker,type,{name:ENEMY_TYPES[type].name},pick(0));
  assert.deepEqual(line('egret','designator'),{speaker:'egret',line:'comms.egret.introLoyal3.1',vars:{name:ENEMY_TYPES.designator.name},expression:'serious'});
  assert.equal(line('wren','designator').line,'comms.wren.introLoyal3.1');assert.equal(line('wren','designator').expression,'surprised');
  assert.equal(line('egret','gunline').line,'comms.egret.introLoyal6.1');assert.equal(line('egret','gunline').expression,'serious');
  assert.equal(line('wren','gunline').line,'comms.wren.introLoyal6.1');assert.equal(line('wren','gunline').expression,'alarmed');
  // 3.205.0: the swarm bosses' own lines (the user's final picks), faces as reviewed.
  assert.deepEqual(line('egret','hive_beast'),{speaker:'egret',line:'comms.egret.introBeast.1',vars:{name:ENEMY_TYPES.hive_beast.name},expression:'alarmed'});
  assert.equal(line('wren','hive_beast').line,'comms.wren.introBeast.1');assert.equal(line('wren','hive_beast').expression,'surprised');
  assert.equal(line('egret','hive_matriarch').line,'comms.egret.introMatriarch.1');assert.equal(line('egret','hive_matriarch').expression,'worried');
  assert.equal(line('wren','hive_matriarch').line,'comms.wren.introMatriarch.1');assert.equal(line('wren','hive_matriarch').expression,'alarmed');
  // 3.206.0: the rebel bosses' own lines (the user's final picks, intro.rebel3 and intro.rebel6), faces as reviewed.
  assert.deepEqual(line('egret','arsonist'),{speaker:'egret',line:'comms.egret.introRebel3.1',vars:{name:ENEMY_TYPES.arsonist.name},expression:'concerned'});
  assert.equal(line('wren','arsonist').line,'comms.wren.introRebel3.1');assert.equal(line('wren','arsonist').expression,'alarmed');
  assert.equal(line('egret','burnline').line,'comms.egret.introRebel6.1');assert.equal(line('egret','burnline').expression,'serious');
  assert.equal(line('wren','burnline').line,'comms.wren.introRebel6.1');assert.equal(line('wren','burnline').expression,'worried');
  assert.equal(zh['comms.egret.introRebel3.1'],'{name}。它會用火封住你的退路。火會蔓延，保持移動。');assert.equal(en['comms.egret.introRebel3.1'],'{name}. It uses fire to cut off your retreat. Fire spreads. Keep moving.');
  assert.equal(zh['comms.wren.introRebel3.1'],'是{name}……它會放火把你圍起來，別被燒到了！');assert.equal(en['comms.wren.introRebel3.1'],"It's {name}... It'll ring you with fire. Don't get burned!");
  assert.equal(zh['comms.egret.introRebel6.1'],'{name}。它會標定你，再用火逼你走位。別被趕進死角。');assert.equal(en['comms.egret.introRebel6.1'],"{name}. It marks you, then herds you with fire. Don't get driven into a corner.");
  assert.equal(zh['comms.wren.introRebel6.1'],'標定加放火……這個超討厭。腳步別停喔。');assert.equal(en['comms.wren.introRebel6.1'],"Marking and fire... this one's nasty. Keep your feet moving.");
  for(const type of ['warden','boss'])for(const speaker of ['egret','wren'])assert.match(line(speaker,type).line,new RegExp(`^comms\\.${speaker}\\.boss\\.`),`${speaker}:${type}`);
  for(const type of ['designator','warden'])assert.equal(line('overseer',type),null,'the overseer says nothing, as before');
  assert.match(resolveComms(line('egret','designator')).text,new RegExp(ENEMY_TYPES.designator.name));
  assert.equal(bossKillLine('egret',false),null,'no line claiming an exit that is still shut');
  assert.deepEqual(bossKillLine('egret',true,pick(0)),{speaker:'egret',line:'comms.egret.bossKill.1',vars:{},expression:'relieved'});
  assert.equal(bossKillLine('egret',true,pick(.99)).line,'comms.egret.bossKill.2');assert.equal(bossKillLine('egret',true,pick(.99)).expression,'serious');
  assert.equal(bossKillLine('wren',true,pick(0)).expression,'grin');assert.equal(bossKillLine('wren',true,pick(.99)).expression,'sigh');
  assert.equal(bossKillLine('overseer',true),null);
  for(const speaker of ['egret','wren'])for(const event of ['introLoyal3','introLoyal6','introBeast','introMatriarch','introRebel3','introRebel6','bossKill']){
    assert.ok(COMMS_LINES[speaker][event]?.length,`${speaker}.${event}`);assert.ok(COMMS_EXPRESSIONS[speaker][event],`${speaker}.${event} face`);
    for(const entry of COMMS_LINES[speaker][event]){const id=typeof entry==='string'?entry:entry.id;assert.ok(zh[id]&&en[id],id);
      const face=typeof entry==='string'?COMMS_EXPRESSIONS[speaker][event]:entry.expression;assert.ok(Object.hasOwn(COMMS_SPEAKERS[speaker].expressions,face),`${id}: ${face}`);}}
  assert.equal(ENEMY_TYPES.designator.intro,'introLoyal3');assert.equal(ENEMY_TYPES.gunline.intro,'introLoyal6');assert.equal(ENEMY_TYPES.warden.intro,undefined);
  assert.equal(ENEMY_TYPES.hive_beast.intro,'introBeast');assert.equal(ENEMY_TYPES.hive_matriarch.intro,'introMatriarch');
  assert.equal(ENEMY_TYPES.arsonist.intro,'introRebel3');assert.equal(ENEMY_TYPES.burnline.intro,'introRebel6');assert.equal(ENEMY_TYPES.boss.intro,undefined);
});

test('each scene plays once per boss, for the run on screen',()=>{
  const m=newBossSceneMemory('run-a');
  assert.equal(firstBossScene(m,'intro','3-boss'),true);assert.equal(firstBossScene(m,'intro','3-boss'),false,'once');
  assert.equal(firstBossScene(m,'death','3-boss'),true,'the kill is its own scene');assert.equal(firstBossScene(m,'death','3-boss'),false);
  assert.equal(firstBossScene(m,'intro','6-boss'),true,'another boss');
  assert.equal(firstBossScene(m,'intro',undefined),false);assert.equal(firstBossScene(null,'intro','x'),false);assert.equal(firstBossScene(m,'other','x'),false);
  assert.equal(firstBossScene(newBossSceneMemory('run-b'),'intro','3-boss'),true,'a new run starts clean');
});

test('the boss event names the boss it saw, and a boss\'s fall names its body, in what it is made of',()=>{
  const at=(id,type,x,y)=>({id,type,x,y,hp:100,maxHp:180,faction:'loyalist',traits:[]});
  const run=enemies=>({turn:3,floor:3,player:{x:10,y:10},visibleEnemies:enemies,logs:[]});
  const memory=newCommsMemory('r'),events=commsEvents({game:run([at('3-9','designator',12,10)]),memory});
  const boss=events.find(e=>e.type==='boss');assert.deepEqual(boss.actor,{id:'3-9',type:'designator',x:12,y:10});assert.ok(boss.vars.name);
  assert.ok(events.filter(e=>e!==boss).every(e=>e.actor===undefined),'only the boss event carries one');
  const player={x:2,y:4,hp:50,character:'soldier'},state=(enemy,hp)=>({player,enemies:[{...enemy,hp}],allies:[],items:[],logs:[],visible:()=>true});
  const fall=enemy=>planPresentation([{before:state(enemy,5),after:state(enemy,0),effects:[{type:'shot',from:{x:2,y:4},to:{x:6,y:4},damage:0},{type:'impact',from:{x:6,y:4},to:{x:6,y:4},damage:30}]}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall');
  const d=fall({id:'3-9',type:'designator',x:6,y:4,traits:[{id:'mechanical',source:'enemy:designator'}]});assert.equal(d.actorId,'3-9');assert.equal(d.gore,'mech');assert.ok(d.blow);
  assert.equal(fall({id:'6-1',type:'hive_matriarch',x:6,y:4,faction:'swarm',traits:[]}).gore,'swarm');
});

test('the controller plays them: locked while they run, your fall wins, reduced motion keeps only the line',async()=>{
  const source=sourceFamily('controller');
  assert.ok(/courseHolds\(\)\|\|bossScene\|\|performance\.now\(\)<lockUntil\)return false;/.test(source),'no action while a scene plays');
  assert.ok(source.includes("function skipEnabled(){return skipPresentation&&game.status==='playing'&&!bossScene;}"),'nor a skip');
  assert.ok(source.includes("function startKia(fall){\n  bossScene=null;"),'your own scene takes over');
  assert.ok(source.includes("if(kia||game.status!=='playing'||!firstBossScene(sceneMemory(),'death',fall.actorId))return;"),'the boss\'s scene gives way when you fell in the same turn');
  assert.ok(source.includes("if(renderer.reduceMotion||replay||kia||bossScene||$('#modal').open){for(const m of messages)sayComms(m);return;}"),'reduced motion (or a replay, or a window open): the intro lines only (3.207.0: two for a delisted operative)');
  assert.ok(source.includes('if(!replay||replay.paused||playback||bossScene||'),'a replay waits for a scene rather than losing a step');
  assert.ok(source.includes("game.pendingPerks&&game.status==='playing'&&!bossScene)showLevelUp();"),'a level-up waits for the scene');
  assert.ok(source.includes("if(renderer.reduceMotion||replay){if(message)sayComms(message);return;}"),'reduced motion: the kill line only');
  assert.ok(source.includes('bossKillLine(dutySpeaker({game}),!game.exitBlocked,{},dead)'),'the kill line only with the exit open (3.207.0: a delisted operative is confirmed by its serial, whatever the exit)');
  assert.ok(source.includes('kiaTick();bossSceneTick();'));
});

// ---- 3.204.0 independent review ---------------------------------------------------------------------------------------
test('review 1: only an enemy boss\'s fall starts the kill scene; your own converted warden or core guard does not',()=>{
  const g=new Game(330,[],0,'engineer','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
  for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;
  Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();
  const p=g.player;p.blueprints=['unit_warden'];p.usedBlueprints=['unit_warden'];p.productionLines=[{blueprint:'unit_warden'}];
  assert.ok(g.action('deployUnit',{line:0,x:11,y:10}));const unit=g.allies.find(a=>a.sourceId==='unit_warden');unit.hp=1;unit.armor=0;
  const foe=makeEnemy('rifleman',13,10,'foe-0');foe.hp=foe.maxHp=50000;foe.alert=true;g.enemies.push(foe);p.x=4;p.y=4;g.reveal();g.rng=Object.assign(()=>0,{state:()=>1});
  const steps=[];for(let i=0;i<4&&unit.hp>0;i++)steps.push(...captureAction(g,()=>g.action('wait')).steps);
  const falls=planPresentation(steps).events.flatMap(e=>e.effects).filter(e=>e.type==='fall');
  assert.ok(falls.some(f=>isBossClass(f.actorType)&&f.actorId===unit.id),'your unit fell on the boss card');
  assert.equal(bossFallOf(falls),null,'no kill scene for it');assert.ok(falls.every(f=>f.enemy!==true));
  // An enemy boss falling in the same kind of step does start it.
  const player={x:2,y:4,hp:50,character:'soldier'},state=hp=>({player,enemies:[{id:'6-1',type:'gunline',x:6,y:4,hp,traits:[]}],allies:[],items:[],logs:[],visible:()=>true});
  const enemyFalls=planPresentation([{before:state(5),after:state(0),effects:[{type:'shot',from:{x:2,y:4},to:{x:6,y:4},damage:0},{type:'impact',from:{x:6,y:4},to:{x:6,y:4},damage:30}]}]).events.flatMap(e=>e.effects);
  assert.equal(bossFallOf(enemyFalls)?.actorId,'6-1');assert.equal(bossFallOf(enemyFalls).enemy,true);
});

test('review 3: a boss intro jumps the comms queue, and its clock starts when her line is up',async()=>{
  const a={line:'a'},b={line:'b'},c={line:'c'},intro={line:'intro'};
  assert.deepEqual(frontOfQueue([],intro,false),{queue:[intro],dropped:null});
  assert.deepEqual(frontOfQueue([a,b,c],intro,true),{queue:[intro,b,c],dropped:a},'the line on the bar gives way, the waiting ones follow in order');
  assert.deepEqual(frontOfQueue([a,b],intro,false),{queue:[intro,a,b],dropped:null},'nothing on the bar: nothing is dropped');
  const q=[a,b];frontOfQueue(q,intro,true);assert.deepEqual(q,[a,b],'the queue passed in is not changed');
  const source=sourceFamily('controller');
  // 3.207.0: several lines (a delisted operative's two) go first in their order; the first starts the clock, the last ends it.
  assert.ok(source.includes('const shown=()=>{if(bossScene===scene&&scene.start===null)scene.start=performance.now();};'),'the clock starts when a line is shown');
  assert.ok(source.includes('if(messages.length)sayCommsFirst(messages.map((m,i)=>({...m,...(i===0?{shown}:{}),...(i===messages.length-1?{then}:{})})));'),'the intro goes first and starts its clock when shown');
  assert.deepEqual(frontOfQueue([a,b],[intro,c],true),{queue:[intro,c,b],dropped:a},'two intro lines keep their order at the front');
  assert.ok(source.includes('commsShownAt=performance.now();message?.shown?.();'),'the bar reports when a line is up');
  assert.ok(source.includes("if(s.kind==='intro'&&s.start===null){if(performance.now()-s.created>BOSS_SCENE_TUNING.intro.maxMs)endBossScene();return;}"),'a line that never comes up cannot hold the controls');
});

test('review 6: a second boss down in the same action does not restart the camera',async()=>{
  const source=sourceFamily('controller');
  assert.ok(/firstBossScene\(sceneMemory\(\),'death',fall\.actorId\)\)return;[^\n]*\n\s*if\(bossScene\)return;/.test(source));
  assert.ok(source.includes('const bossFall=!kia&&bossFallOf(event.effects);'),'the playback asks bossFallOf');
});
