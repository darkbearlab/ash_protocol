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

// 3.128.0 (user design): squads are placed, not drawn — two per loyalist floor, a leader and three guns each, in the
// largest rooms, outside the threat budget.
test('squads are placed, not drawn: two per loyalist floor, a leader at the back and three guns in front',()=>{
  for(const faction of ['legacy','loyalist','rebel','swarm'])for(const floor of [1,3,9])assert.ok(!factionPool(faction,floor).includes('squad_leader'),`${faction} ${floor}`);
  assert.equal(ENEMY_TYPES.squad_leader.maxPerFloor,undefined,'no draw cap: it is never drawn');
  for(const seed of [3,7,11,23,42]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
    const leaders=g.enemies.filter(e=>e.type==='squad_leader');
    assert.equal(leaders.length,2,`seed ${seed}`);
    for(const leader of leaders){
      const id=leader.id.slice(0,-2),members=g.enemies.filter(e=>e.id.startsWith(`${id}-`)&&e!==leader);
      assert.deepEqual(members.map(e=>e.type),['rifleman','rifleman','gunner'],`seed ${seed}`);
      const room=g.rooms.findIndex(r=>leader.x>=r.x&&leader.x<r.x+r.w&&leader.y>=r.y&&leader.y<r.y+r.h);
      assert.notEqual(room,g.startRoom,'never in the room you arrive in');
      const d=q=>Math.abs(q.x-g.start.x)+Math.abs(q.y-g.start.y);
      for(const m of members){
        const gap=Math.abs(m.x-leader.x)+Math.abs(m.y-leader.y);assert.ok(gap>=2&&gap<=5,`seed ${seed}: ${gap}`);
        assert.ok(d(m)<=d(leader),'the leader stands behind its squad');assert.ok(!m.elite&&!m.conscript);
      }
      assert.ok(!g.mission.targets?.some(t=>t.id===leader.id),'never a mission target');
    }
    for(const faction of ['legacy','rebel','swarm'])assert.equal(new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:faction}).enemies.filter(e=>e.type==='squad_leader').length,0,faction);
  }
  const deep=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});deep.floor=4;deep.loadFloor();
  const late=deep.enemies.filter(e=>e.id.startsWith('squad-4-0-')&&e.type!=='squad_leader').map(e=>e.type);
  assert.deepEqual(late,['rifleman_armored','gunner','sniper'],'from floor 3 the late roster');
});

test('the answer to a weapon is its shape: keep away from cone, blast and melee, close on a long gun',()=>{
  const {g}=scene();
  const kinds=slot=>{g.player.weapon=slot;return weaponAnswer(g);};
  assert.equal(kinds(0).kind,'standard');
  assert.equal(kinds(1).kind,'cone');assert.ok(kinds(1).keepAway>=SQUAD_TUNING.keepAway&&kinds(1).spacing>SQUAD_TUNING.spacing);
  assert.equal(kinds(3).kind,'long');assert.equal(kinds(3).closeIn,SQUAD_TUNING.closeIn);
  const melee=new Game(4242,[],0,'berserker','onyx','extraction');melee.player.weapon=melee.player.owned[0];assert.equal(weaponAnswer(melee).kind,'melee');
});

test('the identification turn only gives orders: nobody suppresses and nobody is hurt',()=>{
  const {g,leader,squad}=scene();
  const hp=g.player.hp;
  g.action('wait');
  assert.ok(g.logs.some(l=>l.text.includes('識別')),'the leader announces the weapon it read');
  assert.equal(leader.squad.weapon,g.weapon.id);
  assert.ok(squad.every(e=>e.squad?.leader===leader.id&&e.order?.at),'every member carries an order');
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
  assert.equal(g.refusal?.cue,'pinned');   // 3.163.0: spoken, not logged
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
  const movers=squad.filter(e=>e.order?.kind==='bound');
  assert.ok(movers.length>=1&&movers.length<=Math.floor(squad.length/2),'movers '+movers.length);
  assert.ok(movers.every(e=>activeTrait(e,'fast')),'an advancer is fast');
  assert.ok(squad.filter(e=>e.order?.kind!=='bound').every(e=>activeTrait(e,'ready')),'the rest hold 已就緒');
  // It keeps its aim, so the arrival shot needs no telegraph.
  assert.ok(movers.every(e=>e.charge));
  assert.ok(movers.every(e=>activeTrait(e,'detour')),'an advancer carries 迂迴 (3.129.0)');
  for(let i=0;i<6&&squad.some(e=>e.order?.kind==='bound');i++)g.action('wait');
  const arrived=movers.filter(e=>e.order?.kind==='post');
  assert.ok(arrived.length&&arrived.every(e=>activeTrait(e,'fast')),'still fast on the turn it arrives');
  assert.ok(arrived.every(e=>!activeTrait(e,'detour')),'and no longer detours once there');
});

// 3.128.1 (user decision): in contact, half rounds up — three members bound in a pair, not one at a time.
test('a squad of three bounds in a pair when two of them cannot shoot',()=>{
  const wall=[];for(let y=11;y<=20;y++)wall.push([11,y]);
  const {g,leader,squad}=walled({wall,members:[['r1',6,10],['r2',9,10],['r3',14,10]]});
  ready(g);assert.equal(leader.squad.state,'ready');
  // Step to a tile, next to where you stand, that two of the three cannot shoot.
  const shoots=(e,q)=>g.sight(e,q)&&g.shotClear(e,q)&&Math.abs(e.x-q.x)+Math.abs(e.y-q.y)<=ENEMY_TYPES.rifleman.range;
  let spot=null;for(let y=12;y<=20&&!spot;y++)for(let x=12;x<=16&&!spot;x++){const q={x,y};if(g.grid[y][x]===1&&!g.enemies.some(e=>e.x===x&&e.y===y)&&squad.filter(e=>!shoots(e,q)).length>=2&&squad.some(e=>shoots(e,q)))spot=q;}
  assert.ok(spot,'a tile where one covers and two are blind');
  Object.assign(g.player,spot);g.reveal();
  const blind=squad.filter(e=>!shoots(e,g.player)).length;
  g.action('wait');
  const movers=squad.filter(e=>e.order?.kind==='bound').length;
  assert.ok(blind>=2,`need two who cannot shoot, got ${blind}`);
  assert.equal(movers,Math.min(2,blind),'two advance together');
});

// 3.128.1 (user decision): the deadline readies whoever is in place; a straggler keeps walking and is readied on arrival.
test('at the deadline a straggler is not ready: it keeps walking and is readied once it arrives',()=>{
  const {g,leader,squad}=walled({members:[['r1',9,10],['r2',11,10],['late',3,10]]});
  const late=squad[2];
  for(let i=0;i<8&&leader.squad?.state!=='ready';i++)g.action('wait');
  assert.equal(leader.squad.state,'ready');
  assert.equal(late.order.set,false,'still on its way');
  assert.ok(!activeTrait(late,'ready'),'not ready while walking');
  assert.ok(squad.slice(0,2).every(e=>activeTrait(e,'ready')),'those in place are');
  const goal=late.order.at,far=Math.abs(late.x-goal.x)+Math.abs(late.y-goal.y);g.action('wait');
  assert.ok(Math.abs(late.x-goal.x)+Math.abs(late.y-goal.y)<far||late.order.set,'it keeps walking');
  for(let i=0;i<12&&!late.order.set;i++)g.action('wait');
  assert.ok(late.order.set,'it arrives');
  g.action('wait');
  assert.ok(activeTrait(late,'ready'),'and the leader readies it');
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
  // Dim, not black (3.178.0): the old light rule, where an unpowered tile is dim and nobody is hidden.
  const shooter=squad[0];g.smoke=[];g.lighting=g.grid.map(r=>r.map(()=>0));g.lightModel=undefined;g.lamps=undefined;g.reveal();
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
  g.end=null;   // no lift to predict a route to, so nobody ambushes: this is the search alone (伏擊 has its own tests)
  ready(g);
  const last={x:g.player.x,y:g.player.y};
  Object.assign(g.player,{x:3,y:20});g.reveal();
  g.action('wait');
  assert.equal(leader.squad.state,'patience');assert.deepEqual(leader.squad.last,last);
  assert.ok([leader,...squad].every(e=>activeTrait(e,'ready')),'patience keeps 已就緒');
  let waited=1;while(leader.squad.state==='patience'&&waited<20){g.action('wait');waited++;}
  assert.equal(waited,SQUAD_TUNING.patience,'six turns of patience');
  assert.equal(leader.squad.state,'search');
  // 3.130.0: the half farthest from your last tile goes to ambush the doorway on your way to the lift; the rest
  // search, bounding half at a time as before.
  const ambushers=squad.filter(e=>e.order?.kind==='ambush'),searchers=squad.filter(e=>e.order?.kind!=='ambush');
  assert.ok(ambushers.length<=squad.length-Math.floor(squad.length/2),'at most the other half ambushes');
  assert.equal(searchers.filter(e=>e.order?.kind==='bound').length,Math.max(1,Math.floor(searchers.length/2)),'the searchers bound half at a time');
  assert.ok(squad.filter(e=>e.order?.kind==='bound').every(e=>activeTrait(e,'detour')),'searchers carry 迂迴 too');
  for(let i=0;i<20&&leader.squad;i++)g.action('wait');
  assert.equal(leader.squad,undefined,'nobody at the last tile: the squad disbands');
  assert.ok(squad.every(e=>!e.squad));
  assert.ok(squad.every(e=>!e.order),'and every ambush has ended by now (six turns of patience at most)');
});

test('a squad standing on your only way to the lift never advances and never loses patience',()=>{
  const wall=[];for(let x=0;x<SIZE;x++)if(x!==10)wall.push([x,8]);
  const {g,leader,squad}=walled({wall,leaderAt:{x:10,y:9},members:[['r1',8,10],['r2',12,10]],exit:{x:10,y:2}});
  ready(g);
  assert.ok(holdsTheRoute(g,leader,squad));
  Object.assign(g.player,{x:3,y:20});for(let y=11;y<=22;y++)g.grid[y][5]=0;g.reveal();
  for(let i=0;i<SQUAD_TUNING.patience+4;i++)g.action('wait');
  assert.equal(leader.squad.state,'patience');assert.equal(leader.squad.patience,SQUAD_TUNING.patience);
  assert.ok(squad.every(e=>e.order?.kind!=='bound'),'nobody leaves the corridor');
  // Get behind them and the route no longer runs through the squad: the hold is lifted.
  Object.assign(g.player,{x:10,y:5});assert.ok(!holdsTheRoute(g,leader,squad));
});

test('squad orders survive a save, and a tampered order is refused',()=>{
  const {g}=scene({members:2});
  turns(g,SQUAD_TUNING.deployTurns+2);
  assert.equal(SAVE_VERSION,76);
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

// 3.132.0 (SAVE 61): a member's spot, arrival and role moved into its duty order; older saves convert on load.
test('an old save with squad goal/set/role loads as post and bound orders',()=>{
  const {g,leader,squad}=scene();turns(g,1);
  const raw=JSON.parse(g.serialize());raw.version=60;
  const [a,b]=raw.data.enemies.filter(e=>e.squad&&e.squad.leader===leader.id);
  for(const [m,role] of [[a,'cover'],[b,'move']]){Object.assign(m.squad,{goal:{...m.order.at},set:false,role});delete m.order;}
  const back=Game.restore(JSON.stringify(raw));assert.ok(back);
  const [na,nb]=[a,b].map(m=>back.enemies.find(e=>e.id===m.id));
  assert.equal(na.order.kind,'post');assert.equal(nb.order.kind,'bound');assert.equal(na.order.by,leader.id);
  assert.equal(na.order.set,false);assert.equal(na.squad.goal,undefined);assert.equal(nb.squad.role,undefined);
});
