import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES,SAVE_VERSION} from '../src/engine.js';
import {activeTrait} from '../src/traits.js';
import {suppressionState,pinned,SUPPRESSION_TUNING} from '../src/suppression.js';
import {SQUAD_TUNING,weaponAnswer,squadMembers,isSquadLeader,validSquad,holdsTheRoute,firingSpot} from '../src/squad.js';
import {areaCells} from '../src/throwables.js';
import {factionPool} from '../src/faction-catalog.js';

// 3.125.0 (user design 2026-09-18): 識別＋部署 → 就位者壓制 → 已就緒 → 齊射 → 小隊長重新下令。
function scene({weapon=0,members=2,leaderAt={x:10,y:10}}={}){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:10,y:16});g.player.owned=[0,1,3];g.player.weapon=weapon;g.player.ammo[weapon]=20;
  const leader=makeEnemy('squad_leader',leaderAt.x,leaderAt.y,'L',1,0,'loyalist');
  const squad=Array.from({length:members},(_,i)=>makeEnemy('rifleman',9+i*2,10,`r${i}`,1,0,'loyalist'));
  for(const e of [leader,...squad]){e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);}
  g.reveal();return {g,leader,squad};
}
const turns=(g,n)=>{for(let i=0;i<n&&g.status==='playing';i++)g.action('wait');};

test('the leader is one per floor, loyalist only, and legacy generation is untouched',()=>{
  assert.equal(ENEMY_TYPES.squad_leader.maxPerFloor,1);
  assert.ok(factionPool('loyalist',1).includes('squad_leader'));
  assert.ok(!factionPool('legacy',1).includes('squad_leader')&&!factionPool('rebel',1).includes('squad_leader')&&!factionPool('swarm',1).includes('squad_leader'));
  for(const seed of [7,11,23]){
    const loyal=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
    assert.equal(loyal.enemies.filter(e=>e.type==='squad_leader').length,1,`seed ${seed}`);
    assert.equal(new Game(seed,[],0,'soldier','onyx','extraction').enemies.filter(e=>e.type==='squad_leader').length,0);
  }
});

test('the answer to a weapon is its shape: keep away from cone, blast and melee, close on a long gun',()=>{
  const {g}=scene();
  const kinds=slot=>{g.player.weapon=slot;return weaponAnswer(g);};
  assert.equal(kinds(0).kind,'standard');
  assert.equal(kinds(1).kind,'cone');assert.ok(kinds(1).keepAway>=SQUAD_TUNING.keepAway&&kinds(1).spacing>SQUAD_TUNING.spacing);
  assert.equal(kinds(3).kind,'long');assert.equal(kinds(3).closeIn,SQUAD_TUNING.closeIn);
  const melee=new Game(4242,[],0,'berserker','onyx','extraction');assert.equal(weaponAnswer(melee).kind,'melee');
});

test('the identification turn only gives orders: nobody suppresses and nobody is hurt',()=>{
  const {g,leader,squad}=scene();
  const hp=g.player.hp;
  g.action('wait');
  assert.ok(g.logs.some(l=>l.text.includes('識別')),'the leader announces the weapon it read');
  assert.equal(leader.squad.weapon,g.weapon.id);
  assert.ok(squad.every(e=>e.squad?.leader===leader.id&&e.squad.goal),'every member carries an order');
  assert.equal(suppressionState(g.player).stacks,0,'no suppression on the identification turn');
  assert.equal(g.player.hp,hp);
  assert.equal(squadMembers(g,leader).length,squad.length);
});

test('members in position suppress every deployment turn, and the player is kept suppressed',()=>{
  const {g,leader}=scene({members:2});
  g.action('wait');                                   // the order turn, deliberately quiet
  const order=leader.squad.since;
  let quiet=[],stacked=0;
  while(leader.squad.state==='deploy'&&g.turn<order+SQUAD_TUNING.deployTurns){
    g.action('wait');
    // The enemies act inside the turn the action opens, so the suppression is stamped with the new turn number.
    // The turn the squad goes ready is spent on that order; every other deployment turn keeps firing.
    if(leader.squad.state==='deploy'&&leader.squad.suppressTurn!==g.turn)quiet.push(g.turn);
    stacked=Math.max(stacked,suppressionState(g.player).stacks);
  }
  assert.deepEqual(quiet,[],'no deployment turn passes without somebody suppressing');
  assert.ok(g.logs.some(l=>l.text.includes('壓制射擊')));
  assert.ok(stacked>0,'the suppression lands on the player');
});

test('suppression reaches the player from a tile beside them, and three stacks pin',()=>{
  const {g}=scene({members:3});
  g.action('wait');g.action('wait');
  assert.ok(suppressionState(g.player).stacks>=1);
  // A pinned player cannot move or take the lift; that is the price of standing still in the open.
  g.player.suppression=SUPPRESSION_TUNING.pinned;
  assert.ok(pinned(g.player));
  assert.equal(g.action('move',[0,-1]),false);
  assert.ok(g.logs[0].text.includes('壓制中無法移動'));
});

test('已就緒 is the wait, handed to the squad: half damage, −15 to be hit, +15 on its shot',()=>{
  const {g,leader,squad}=scene({members:2});
  turns(g,SQUAD_TUNING.deployTurns+2);
  assert.equal(leader.squad.state,'ready');
  assert.ok(squad.every(e=>activeTrait(e,'ready')),'the whole squad carries it');
  assert.ok(g.logs.some(l=>l.text.includes('已就緒')));
  const member=squad[0];
  // Away from the 10–99 clamp, so the two numbers are the wait's own: darkness and a move on both sides.
  g.lighting=g.grid.map(r=>r.map(()=>0));g.player.moved=true;member.moved=true;
  Object.assign(member,{x:g.player.x,y:g.player.y-6});g.reveal();
  const plain={...member,traits:member.traits.filter(t=>t.id!=='ready')};
  assert.equal(g.accuracy(member,g.player).chance-g.accuracy(plain,g.player).chance,15,'+15 on the ready shot');
  assert.equal(g.accuracy(g.player,plain).chance-g.accuracy(g.player,member).chance,15,'−15 to be hit');
  const before=member.hp;g.hitTarget(member,20,g.player,0,g.weaponAt(0));
  assert.ok(member.hp>before-20,'direct damage is halved');
});

test('the volley lands the turn after the order, and the leader keeps it up without firing itself',()=>{
  const {g,leader}=scene({members:2});
  const hp=g.player.hp;
  turns(g,SQUAD_TUNING.deployTurns+3);
  assert.ok(g.player.hp<hp,'the squad shoots once it is ready');
  assert.ok(g.logs.some(l=>l.text.includes('攻擊')));
  assert.ok(!g.logs.some(l=>l.text.includes('小隊長攻擊')),'the leader commands instead of shooting');
  assert.equal(leader.squad.state,'ready');
});

test('killing the leader ends the orders; only a new weapon reopens the window, moving away does not',()=>{
  const {g,leader,squad}=scene({members:2});
  turns(g,2);
  const weapon=leader.squad.weapon;
  g.player.weapon=1;g.action('wait');
  assert.notEqual(leader.squad.weapon,weapon,'a new weapon is re-identified');
  const since=leader.squad.since;
  // 3.126.0: running off is answered by the formation, not by a fresh identification window (that was the kite).
  Object.assign(g.player,{x:g.player.x+6});g.reveal();g.action('wait');
  assert.equal(leader.squad.since,since,'moving away keeps the orders');
  leader.hp=0;g.action('wait');
  assert.ok(squad.every(e=>!e.squad),'the squad goes back to ordinary behaviour');
});

// 3.126.0 bounding overwatch (user design, docs/SQUAD.md 交叉掩護推進).
function walled({wall=[],members=[['r1',6,10],['r2',9,10],['r3',11,10],['r4',14,10]],leaderAt={x:10,y:10},exit={x:2,y:2}}={}){
  const {g,leader}=scene({members:0,leaderAt});
  for(const [x,y] of wall)g.grid[y][x]=0;
  g.end=exit;g.player.hp=g.player.maxHp=999;g.player.ammo[0]=40;
  const squad=members.map(([id,x,y])=>{const e=makeEnemy('rifleman',x,y,id,1,0,'loyalist');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;});
  g.reveal();return {g,leader,squad};
}
const ready=g=>{for(let i=0;i<SQUAD_TUNING.deployTurns+1;i++)g.action('wait');};

test('whoever cannot shoot advances, never more than half, fast on the move and on arrival',()=>{
  const wall=[];for(let y=11;y<=20;y++)wall.push([11,y]);
  const {g,leader,squad}=walled({wall});
  ready(g);assert.equal(leader.squad.state,'ready');
  Object.assign(g.player,{x:9,y:15});g.reveal();g.action('wait');
  const movers=squad.filter(e=>e.squad.role==='move');
  assert.ok(movers.length>=1&&movers.length<=Math.floor(squad.length/2),'movers '+movers.length);
  assert.ok(movers.every(e=>activeTrait(e,'fast')),'an advancer is fast');
  assert.ok(squad.filter(e=>e.squad.role!=='move').every(e=>activeTrait(e,'ready')),'the rest hold 已就緒');
  // It keeps its aim, so the arrival shot needs no telegraph.
  assert.ok(movers.every(e=>e.charge));
  for(let i=0;i<6&&squad.some(e=>e.squad.role==='move');i++)g.action('wait');
  const arrived=movers.filter(e=>e.squad.role==='cover');
  assert.ok(arrived.length&&arrived.every(e=>activeTrait(e,'fast')),'still fast on the turn it arrives');
});

test('through smoke the leader calls out your tile: blind shots at −40 that replace darkness',()=>{
  const {g,leader,squad}=walled();
  ready(g);
  g.smoke=[{x:g.player.x,y:g.player.y,cells:areaCells(g.grid,g.player,2,g.barriers,g),expires:g.turn+5}];g.reveal();
  assert.ok(!squad.some(e=>g.sight(e,g.player)),'the soldiers lose sight in the smoke');
  assert.ok(g.sight(leader,g.player),'the leader sees through it (infrared)');
  const hp=g.player.hp;g.action('wait');
  assert.equal(leader.squad.blind,true);
  assert.ok(g.logs.some(l=>l.text.includes('回報你的位置')));
  assert.ok(g.logs.some(l=>l.text.includes('依小隊長回報的位置')),'somebody fired at the called-out tile');
  assert.ok(g.player.hp<=hp);
  // The number: −40, and in the dark it replaces the darkness penalty instead of adding to it.
  const shooter=squad[0];g.smoke=[];g.lighting=g.grid.map(r=>r.map(()=>0));g.reveal();
  const dark=g.accuracy(shooter,g.player);
  shooter.blindShot=SQUAD_TUNING.blindPenalty;const blind=g.accuracy(shooter,g.player);delete shooter.blindShot;
  assert.ok(dark.darkPenalty>0);assert.equal(blind.darkPenalty,0);
  assert.equal(dark.chance-blind.chance,SQUAD_TUNING.blindPenalty-dark.darkPenalty);
  // A stunned leader leaves no stale report: nobody fires blind while it cannot sense you.
  g.lighting=g.grid.map(r=>r.map(()=>1));
  g.smoke=[{x:g.player.x,y:g.player.y,cells:areaCells(g.grid,g.player,2,g.barriers,g),expires:g.turn+5}];leader.control.disabled=3;g.reveal();
  g.action('wait');
  assert.ok(!g.logs.some(l=>l.turn===g.turn&&l.text.includes('依小隊長回報的位置')),'no blind shot from a stunned leader');
});

test('blind, the squad holds 已就緒 for six turns, then half of it bounds to your last tile and disbands if you are gone',()=>{
  const wall=[];for(let y=12;y<=21;y++)wall.push([7,y]);
  const {g,leader,squad}=walled({wall});
  ready(g);
  const last={x:g.player.x,y:g.player.y};
  Object.assign(g.player,{x:3,y:20});g.reveal();
  g.action('wait');
  assert.equal(leader.squad.state,'patience');assert.deepEqual(leader.squad.last,last);
  assert.ok([leader,...squad].every(e=>activeTrait(e,'ready')),'patience keeps 已就緒');
  let waited=1;while(leader.squad.state==='patience'&&waited<20){g.action('wait');waited++;}
  assert.equal(waited,SQUAD_TUNING.patience,'six turns of patience');
  assert.equal(leader.squad.state,'search');
  assert.equal(squad.filter(e=>e.squad.role==='move').length,Math.floor(squad.length/2),'only half of them search at once');
  for(let i=0;i<20&&leader.squad;i++)g.action('wait');
  assert.equal(leader.squad,undefined,'nobody at the last tile: the squad disbands');
  assert.ok(squad.every(e=>!e.squad));
});

test('a squad standing on your only way to the lift never advances and never loses patience',()=>{
  const wall=[];for(let x=0;x<SIZE;x++)if(x!==10)wall.push([x,8]);
  const {g,leader,squad}=walled({wall,leaderAt:{x:10,y:9},members:[['r1',8,10],['r2',12,10]],exit:{x:10,y:2}});
  ready(g);
  assert.ok(holdsTheRoute(g,leader,squad));
  Object.assign(g.player,{x:3,y:20});for(let y=11;y<=22;y++)g.grid[y][5]=0;g.reveal();
  for(let i=0;i<SQUAD_TUNING.patience+4;i++)g.action('wait');
  assert.equal(leader.squad.state,'patience');assert.equal(leader.squad.patience,SQUAD_TUNING.patience);
  assert.ok(squad.every(e=>e.squad.role!=='move'),'nobody leaves the corridor');
  // Get behind them and the route no longer runs through the squad: the hold is lifted.
  Object.assign(g.player,{x:10,y:5});assert.ok(!holdsTheRoute(g,leader,squad));
});

test('squad orders survive a save, and a tampered order is refused',()=>{
  const {g}=scene({members:2});
  turns(g,SQUAD_TUNING.deployTurns+2);
  assert.equal(SAVE_VERSION,59);
  const restored=Game.restore(g.serialize());
  assert.ok(restored);
  assert.equal(restored.enemies.find(e=>isSquadLeader(e)).squad.state,'ready');
  assert.ok(validSquad(restored));
  for(const mutate of [s=>s.state='charging',s=>s.weapon=5,s=>s.suppressTurn=-1,s=>s.at={x:99,y:0},s=>s.patience=SQUAD_TUNING.patience+1,s=>s.last={x:-1,y:3},s=>s.blind='yes']){
    const raw=JSON.parse(g.serialize());mutate(raw.data.enemies.find(e=>e.type==='squad_leader').squad);
    assert.equal(Game.restore(JSON.stringify(raw)),null);
  }
  const member=JSON.parse(g.serialize());member.data.enemies.find(e=>e.type==='rifleman'&&e.squad).squad.goal={x:1.5,y:2};
  assert.equal(Game.restore(JSON.stringify(member)),null);
  const role=JSON.parse(g.serialize());role.data.enemies.find(e=>e.type==='rifleman'&&e.squad).squad.role='charge';
  assert.equal(Game.restore(JSON.stringify(role)),null);
});

// 3.127.2 (user decision): every member ends up with the player inside its own range, whatever room it was dealt.
test('a firing spot always keeps the player inside the members range, even when no spot has a clear line',()=>{
  const {g,squad}=scene();const far=squad[0];Object.assign(far,{x:10,y:1});
  const range=ENEMY_TYPES[far.type].range,answer=weaponAnswer(g);
  const open=firingSpot(g,far,g.player,answer,new Set());
  assert.ok(open&&Math.abs(open.x-g.player.x)+Math.abs(open.y-g.player.y)<=range&&g.sight({...far,...open},g.player),'open room: a clear spot in range');
  // Box the player in: no tile has a line to it, so the member must still close to its range.
  const grid=g.grid.map(r=>[...r]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)grid[16+dy][10+dx]=0;g.grid=grid;
  const boxed=firingSpot(g,far,g.player,answer,new Set());
  assert.ok(boxed,'a spot is still found');
  assert.ok(Math.abs(boxed.x-g.player.x)+Math.abs(boxed.y-g.player.y)<=range,`within range: ${boxed.x},${boxed.y}`);
  assert.ok(g.passable(boxed.x,boxed.y,far));
});
