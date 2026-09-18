import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES,SAVE_VERSION,enemyName} from '../src/engine.js';
import {activeTrait,grantTrait} from '../src/traits.js';
import {REBEL_TUNING,TAUNT_TRAITS,isCowering,canCower,cower,witnessDeath,rebelMorale,advanceCharge,validRebels,CONSCRIPT_TYPES} from '../src/rebels.js';
import {factionPool} from '../src/faction-catalog.js';
import {SUPPRESSION_TUNING} from '../src/suppression.js';

// 3.127.0 rebels (user design 2026-09-18, docs/REBELS.md): 躲藏、嘲笑、督戰官、強徵兵.
// Walls go in before the first reveal: sight is cached per grid, and the rules never reshape the grid mid-floor.
function arena({walls=[]}={}){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));for(const [x,y] of walls)g.grid[y][x]=0;g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  g.props=[{id:'crate-a',x:7,y:11,type:'cover',hp:65,maxHp:65}];
  Object.assign(g.player,{x:10,y:17});g.player.hp=g.player.maxHp=999;g.player.ammo[0]=40;
  g.reveal();return g;
}
const add=(g,type,x,y,id,extra={})=>{const e=makeEnemy(type,x,y,id,1,0,'rebel');Object.assign(e,extra);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};

test('conscripts: rebel floors only, beside an ordinary gunman, named 強徵兵, and they pay nothing',()=>{
  const g=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
  const conscripts=g.enemies.filter(e=>e.conscript);
  assert.ok(conscripts.length>0);
  for(const c of conscripts){
    const parent=g.enemies.find(e=>e.id===c.id.slice(0,-2));
    assert.ok(parent&&CONSCRIPT_TYPES.includes(parent.type)&&!parent.elite&&parent.type===c.type,'same card as the rebel it came with');
    assert.equal(Math.abs(parent.x-c.x)+Math.abs(parent.y-c.y),1,'right beside it');
    assert.equal(enemyName(c),'強徵兵');
  }
  assert.equal(conscripts.filter(c=>c.conscript&&g.enemies.some(o=>o.id===c.id+'-c')).length,0,'a conscript brings nobody');
  for(const faction of ['legacy','loyalist','swarm'])assert.equal(new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:faction}).enemies.filter(e=>e.conscript).length,0,faction);
  const a=arena(),c=add(a,'rifleman',10,12,'c',{conscript:true});
  const xp=a.player.xp,scrap=a.player.scrap,items=a.items.length;a.hurt(c,c.hp,a.player);
  assert.equal(a.player.xp,xp,'no experience');assert.equal(a.player.scrap,scrap,'no scrap');assert.equal(a.items.length,items,'no drop');
});

test('an ordinary rebel below half health breaks for cover and holds it, shooting back only when it can',()=>{
  const g=arena(),e=add(g,'rifleman',8,10,'r');
  e.hp=Math.floor(e.maxHp/2)-1;                    // the player at (10,17) is nine tiles off: seen, but out of its range
  g.action('wait');
  assert.ok(isCowering(e),'it breaks');assert.deepEqual(e.order?.kind,'retreat');assert.deepEqual(e.order.at,{x:7,y:10},'the nearest tile the crate shields from the player');
  assert.equal(e.order.patience,null,'no time limit (3.131.0: hiding is a retreat order)');
  for(let i=0;i<3;i++)g.action('wait');
  assert.deepEqual({x:e.x,y:e.y},{x:7,y:10},'and it stays there');
  assert.ok(activeTrait(e,'cowering'),'the card shows 躲藏');
  Object.assign(g.player,{x:7,y:15});g.reveal();g.action('wait');
  assert.ok(e.charge,'with a line on you it shoots back');
  // Suppression pins it: a pinned coward cannot run, which is how the player finishes one.
  const h=arena(),p=add(h,'rifleman',8,10,'p');p.hp=1;p.suppression=SUPPRESSION_TUNING.pinned;
  h.action('wait');assert.ok(isCowering(p));assert.deepEqual({x:p.x,y:p.y},{x:8,y:10},'pinned: it cannot move');
});

test('seeing a comrade gunned down within four tiles breaks ordinary rebels; elites, machines and the enforcer never break',()=>{
  const g=arena();
  const dead=add(g,'rifleman',10,10,'d'),near=add(g,'rifleman',8,10,'n'),far=add(g,'rifleman',15,10,'f');
  const elite=add(g,'raider_elite',11,10,'x'),drone=add(g,'drone',9,11,'m'),enforcer=add(g,'enforcer',10,8,'E');
  g.hurt(dead,dead.hp,g.player);
  assert.ok(isCowering(near),'within four tiles and in sight');
  assert.ok(!isCowering(far),'five tiles away');
  for(const e of [elite,drone,enforcer])assert.ok(!isCowering(e)&&!canCower(e),e.type);
  // A wall between them: it did not see it.
  const h=arena({walls:[[9,10],[9,9],[9,11]]}),d2=add(h,'rifleman',10,10,'d'),hidden=add(h,'rifleman',8,10,'h');
  h.hurt(d2,d2.hp,h.player);assert.ok(!isCowering(hidden),'no line of sight, no panic');
  // An execution or a self-destruction is not the player's doing.
  const k=arena(),v=add(k,'rifleman',10,10,'v'),watcher=add(k,'rifleman',8,10,'w'),en=add(k,'enforcer',10,8,'E');
  k.hurt(v,v.hp,en);assert.ok(!isCowering(watcher));
});

test('嘲笑: every rebel who can see a coward draws one boost for the coming turn, and only then',()=>{
  const g=arena(),coward=add(g,'rifleman',8,10,'c'),mocker=add(g,'rifleman',11,10,'m'),blind=add(g,'rifleman',20,3,'b'),enforcer=add(g,'enforcer',10,6,'E');
  g.grid[5][19]=0;g.grid[4][20]=0;g.grid[3][19]=0;g.grid[2][20]=0;g.grid[4][19]=0;g.grid[4][21]=0;g.grid[3][21]=0;g.grid[2][19]=0;g.grid[2][21]=0;g.reveal();
  cower(g,coward);
  rebelMorale(g);
  const boost=mocker.traits.filter(t=>t.source==='rebel:taunt');
  assert.equal(boost.length,1,'exactly one boost');assert.ok(TAUNT_TRAITS.includes(boost[0].id));assert.equal(boost[0].turns,1,'for one turn');
  assert.ok(!blind.traits.some(t=>t.source==='rebel:taunt'),'no coward in sight, no draw');
  assert.ok(!enforcer.traits.some(t=>t.source==='rebel:taunt'),'the enforcer does not taunt');
  assert.ok(!coward.traits.some(t=>t.source==='rebel:taunt'),'nor does the coward');
  // Drawn at the end of a turn, it survives into the next one and is gone after it.
  coward.hp=0;g.action('wait');
  assert.ok(!mocker.traits.some(t=>t.source==='rebel:taunt'),'the coward is gone: the boost ran out and nothing new was drawn');
});

test('the enforcer is slow, fires a long hopeless gun, marks a coward and executes it the next turn for no experience',()=>{
  const card=ENEMY_TYPES.enforcer;
  assert.ok(card.traits.includes('slow'));assert.equal(card.range,10);assert.ok(card.combat.rangedAccuracy<=-40);
  assert.equal(card.maxPerFloor,2);assert.equal(card.maxPerFloorDeep,3);
  assert.ok(factionPool('rebel',1).includes('enforcer')&&!factionPool('loyalist',1).includes('enforcer')&&!factionPool('legacy',1).includes('enforcer'));
  const g=arena(),enforcer=add(g,'enforcer',10,6,'E'),coward=add(g,'rifleman',9,8,'c');
  cower(g,coward);
  g.action('wait');
  assert.deepEqual(enforcer.executeIntent,{id:'c'},'marked first — the player gets a turn to answer');
  assert.ok(g.logs.some(l=>l.text.includes('盯上了')));
  const xp=g.player.xp,kills=g.player.kills;
  g.action('wait');
  assert.equal(coward.hp<=0,true,'executed');
  assert.equal(g.player.xp,xp,'no experience');assert.equal(g.player.kills,kills,"not the player's kill");
  // Killing the marked coward first denies the execution.
  const h=arena(),e2=add(h,'enforcer',10,6,'E'),c2=add(h,'rifleman',9,8,'c');cower(h,c2);h.action('wait');
  h.hurt(c2,c2.hp,h.player);h.action('wait');
  assert.ok(!h.logs.some(l=>l.text.includes('處決了')),'nothing left to execute');
});

test('an execution rallies cowards in range, fires every rebel already aiming, and boosts everyone in range',()=>{
  const g=arena(),enforcer=add(g,'enforcer',10,6,'E'),victim=add(g,'rifleman',9,8,'v'),other=add(g,'rifleman',12,8,'o');
  // Normal-speed soldiers act before the slow enforcer; the idle one walks a step first, so it starts well inside range.
  const aimer=add(g,'rifleman',10,11,'a'),idle=add(g,'rifleman',11,7,'i');
  cower(g,victim);cower(g,other);
  g.action('wait');assert.ok(['v','o'].includes(enforcer.executeIntent?.id),'it marked one of the two cowards');
  // Stage the moment right before the enforcer acts: one soldier aiming, one not, both in range.
  aimer.charge=true;aimer.windup=1;aimer.aim={x:g.player.x,y:g.player.y};idle.charge=false;
  const shotsBefore=aimer.attackCount||0;
  const hp=g.player.hp;g.player.guard=false;
  const target=g.enemies.find(e=>e.id===enforcer.executeIntent.id);
  const marked=target.id,rest=[victim,other].find(e=>e.id!==marked);
  g.action('wait');
  assert.ok(g.enemies.find(e=>e.id===marked).hp<=0,'the marked coward is executed');
  assert.ok(!isCowering(rest),'the other coward in range rejoins the fight');
  assert.ok(g.logs.some(l=>l.text.includes('歸隊')));
  // A rifleman fires continuously (it stays aimed), so the advance hands it a second shot in the same turn.
  assert.equal((aimer.attackCount||0)-shotsBefore,2,'its own shot, and one more from the advance');
  assert.ok(g.logs.some(l=>l.text.includes('立刻開火')));
  for(const e of [aimer,idle,rest])assert.ok(e.traits.some(t=>t.source==='rebel:taunt'),`${e.id} drew a boost from the execution`);
  // The advance only pushes those already aiming.
  const h=arena(),s=add(h,'rifleman',10,11,'s');s.charge=false;
  assert.equal(advanceCharge(h,s),null);assert.equal(s.charge,false);
});

test('with nobody to execute, the enforcer shoots its long gun at you, badly',()=>{
  const g=arena(),enforcer=add(g,'enforcer',10,8,'E');g.props=[];   // nothing to hide behind
  assert.ok(g.accuracy(enforcer,g.player).chance<g.accuracy(makeEnemy('rifleman',10,8,'r',1,0,'rebel'),g.player).chance,'far worse than a rifleman');
  g.action('wait');g.action('wait');
  assert.ok(g.logs.some(l=>l.text.includes('督戰官攻擊')||l.text.includes('督戰官未命中')),'it takes its shot');
  assert.deepEqual([enforcer.x,enforcer.y],[10,8],'and never walks at you');
});

// 3.127.1 (user request): like a researcher, it warns everyone when it sees you, then hides so it lives to use the rules.
test('seeing you, the enforcer warns everyone within eight tiles, takes cover, and never advances',()=>{
  const g=arena(),enforcer=add(g,'enforcer',10,10,'E');delete enforcer.lastKnown;enforcer.alert=false;
  const near=add(g,'rifleman',4,8,'n'),far=add(g,'rifleman',1,1,'f');
  for(const o of [near,far]){o.alert=false;delete o.lastKnown;}
  const heard=[];g.onEnemyCallout=ev=>heard.push(ev);
  g.reveal();
  assert.ok(near.alert&&near.lastKnown,'eight tiles off: warned');assert.ok(!far.alert,'further: not');
  assert.ok(g.logs.some(l=>l.text.includes('發出警告')));
  assert.ok(heard.some(ev=>ev.cue==='alarm'&&ev.voice==='enforcer'),'in its own voice');
  assert.equal(enforcer.alarmCooldown,REBEL_TUNING.alarmCooldown);
  const logs=g.logs.length;g.reveal();
  assert.equal(g.logs.slice(logs).filter(l=>l.text.includes('發出警告')).length,0,'once per cooldown');
  for(let i=0;i<8;i++)g.action('wait');
  assert.ok(g.protectingCover(enforcer,g.player),`behind cover at ${enforcer.x},${enforcer.y}`);
  const at=[enforcer.x,enforcer.y];g.action('wait');g.action('wait');
  assert.deepEqual([enforcer.x,enforcer.y],at,'and it stays there');
  assert.ok(validRebels(g.enemies));
});

// 3.127.2 (user decision): both warnings really wait five turns, however the turn they were raised in unfolded.
test('the enforcer and a researcher in plain view warn exactly every five turns',()=>{
  const g=arena();g.props=[];Object.assign(g.player,{x:5,y:5});
  const enforcer=add(g,'enforcer',5,12,'E'),researcher=makeEnemy('civilian',0,0,'civ',1,0,'rebel');g.enemies.push(researcher);  // cornered: it cannot flee farther
  const turns={alarm:[],scream:[]};
  for(let i=0;i<16;i++){
    const before=g.logs.length;g.action('wait');
    const fresh=g.logs.slice(0,g.logs.length-before).map(l=>l.text);
    if(fresh.some(t=>t.includes('發出警告')))turns.alarm.push(g.turn);
    if(fresh.some(t=>t.includes('尖叫')))turns.scream.push(g.turn);
  }
  for(const [kind,list] of Object.entries(turns)){
    assert.ok(list.length>=3,`${kind}: ${list}`);
    for(let i=1;i<list.length;i++)assert.equal(list[i]-list[i-1],5,`${kind}: ${list}`);
  }
  assert.ok(enforcer.hp>0&&researcher.hp>0);
});

test('conscripts speak for themselves, and a rally is shouted by the coward it happens to',()=>{
  const g=arena(),heard=[];g.onEnemyCallout=ev=>heard.push(ev);
  const c=add(g,'rifleman',10,12,'c',{conscript:true}),r=add(g,'rifleman',12,12,'r');
  g.enemyCallout(c,'telegraph',{action:'attack'});g.enemyCallout(r,'telegraph',{action:'attack'});
  assert.equal(heard[0].voice,'conscript');assert.notEqual(heard[1].voice,'conscript');
  heard.length=0;
  const enforcer=add(g,'enforcer',10,9,'E');cower(g,c);cower(g,r);
  enforcer.executeIntent={id:'c'};g.action('wait');
  assert.ok(heard.some(ev=>ev.cue==='execute'&&ev.voice==='enforcer'),'the enforcer names the crime');
  assert.ok(heard.some(ev=>ev.cue==='rally'&&ev.actorId===r.id&&ev.voice!=='conscript'),'the rallied one answers');
  assert.ok(!isCowering(r));
});

test('floor caps: at most two enforcers a floor, three from floor 7',()=>{
  for(const seed of [3,7,11,19,23]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});
    assert.ok(g.enemies.filter(e=>e.type==='enforcer').length<=2,`seed ${seed}`);
    const deep=new Game(seed,[],0,'soldier','onyx','endless');deep.floor=9;deep.facilityFaction='rebel';
  }
});

test('rebel state survives a save, and tampered state is refused',()=>{
  assert.equal(SAVE_VERSION,62);
  const g=arena(),e=add(g,'rifleman',8,10,'r'),enforcer=add(g,'enforcer',10,6,'E'),c=add(g,'rifleman',12,10,'c',{conscript:true});
  cower(g,e);enforcer.executeIntent={id:'r'};
  const back=Game.restore(g.serialize());assert.ok(back);
  assert.ok(validRebels(back));assert.ok(isCowering(back.enemies.find(o=>o.id==='r')));assert.deepEqual(back.enemies.find(o=>o.id==='r').order,e.order);
  for(const [id,mutate] of [['c',o=>o.conscript='yes'],['r',o=>o.order.at={x:1.5,y:2}],['r',o=>delete o.order],['E',o=>o.executeIntent={id:''}]]){
    const raw=JSON.parse(g.serialize());mutate(raw.data.enemies.find(o=>o.id===id));
    assert.equal(Game.restore(JSON.stringify(raw)),null,id);
  }
});

// 3.131.0 (SAVE 60): a pre-60 save kept the cover spot in cowerAt; it loads as the retreat order.
test('an old save with cowerAt loads as a retreat order',()=>{
  const g=arena(),e=add(g,'rifleman',8,10,'r');cower(g,e);
  const raw=JSON.parse(g.serialize());raw.version=59;const old=raw.data.enemies.find(o=>o.id==='r');old.cowerAt={...old.order.at};delete old.order;
  const back=Game.restore(JSON.stringify(raw));assert.ok(back);
  const r=back.enemies.find(o=>o.id==='r');assert.equal(r.cowerAt,undefined);assert.equal(r.order.kind,'retreat');assert.deepEqual(r.order.at,e.order.at);
});
