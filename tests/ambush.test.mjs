import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {activeTrait} from '../src/traits.js';
import {ORDER_TUNING,validOrders} from '../src/orders.js';
import {playerRoute,chokeOnRoute,ambushSpot,orderAmbush} from '../src/ambush.js';
import {exposedFrom} from '../src/detour.js';
import {deploySquad} from '../src/squad.js';

// 3.130.0 伏擊 (user design 2026-09-18, docs/ORDERS.md): two rooms joined by one door at (11,6). You were last seen in
// the west room; the lift is in the east room, so your way runs through that door.
const DOOR={x:11,y:6},EXIT={x:22,y:6},LAST={x:8,y:6};   // close enough to hear it (8 tiles)
function rooms(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
  for(let y=2;y<=10;y++)for(let x=2;x<=24;x++)if(x!==11)g.grid[y][x]=1;
  g.grid[DOOR.y][DOOR.x]=1;g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];
  g.end={...EXIT};Object.assign(g.player,{...LAST});g.player.hp=g.player.maxHp=999;g.reveal();
  return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,1,0,'loyalist');e.alert=true;e.lastKnown={...LAST};g.enemies.push(e);return e;};
const until=(g,cond,n=20)=>{for(let i=0;i<n&&!cond();i++)g.action('wait');return cond();};

test('it reads your way to the lift, finds the door on it, and a spot you cannot see that covers the door',()=>{
  const g=rooms(),e=unit(g,'rifleman',20,8,'a');
  const route=playerRoute(g,LAST,EXIT);assert.ok(route&&route.length>10);
  const choke=chokeOnRoute(g,route);assert.deepEqual({x:choke.x,y:choke.y},DOOR);
  const spot=ambushSpot(g,e,LAST,choke);assert.ok(spot,'a spot exists');
  assert.ok(!exposedFrom(g,LAST).has(`${spot.x},${spot.y}`),'you cannot see it from where you were');
  assert.ok(g.sight({...e,...spot},DOOR)&&g.shotClear({...e,...spot},DOOR),'it covers the door');
  assert.notEqual(spot.y,DOOR.y,'never straight out of the door');
  assert.ok(Math.abs(spot.x-DOOR.x)+Math.abs(spot.y-DOOR.y)<=7,'inside its own range');
});

test('the ambusher detours into place, holds its aim on the door and mutters something vague',()=>{
  const g=rooms(),e=unit(g,'rifleman',20,8,'a'),heard=[];g.onEnemyCallout=ev=>heard.push(ev);
  assert.ok(orderAmbush(g,e));assert.equal(e.order.kind,'ambush');assert.equal(e.order.by,'self');
  assert.ok(activeTrait(e,'detour'),'it walks the way you cannot see');
  assert.ok(until(g,()=>e.x===e.order.at.x&&e.y===e.order.at.y&&e.charge),'in place');
  assert.deepEqual(e.aim,DOOR);assert.equal(e.windup,1,'the first shot needs no warning');
  g.action('wait');assert.equal(e.order?.kind,'ambush','it waits');
  assert.ok(heard.some(ev=>ev.cue==='lurk'),'it says something');
  assert.ok(validOrders(g));
});

test('you step into the door: it fires at once and the order is done',()=>{
  const g=rooms(),e=unit(g,'rifleman',20,8,'a');orderAmbush(g,e);
  until(g,()=>e.charge&&e.x===e.order?.at.x&&e.y===e.order?.at.y);
  const shots=e.attackCount||0;Object.assign(g.player,{...DOOR});g.reveal();g.action('wait');
  assert.equal(e.order,undefined);assert.equal(e.attackCount,shots+1,'it fired this very turn');
  assert.ok(!activeTrait(e,'detour'));
});

test('it gives up after six turns of waiting, when hit, when seen, or when you go another way',()=>{
  const patient=rooms(),a=unit(patient,'rifleman',20,8,'a');orderAmbush(patient,a);
  until(patient,()=>a.charge&&a.x===a.order?.at.x&&a.y===a.order?.at.y);
  let waited=0;while(a.order&&waited<20){patient.action('wait');waited++;}
  assert.equal(waited,ORDER_TUNING.patience,'six turns, like the squad');
  assert.equal(a.aim,null,'no blind shot at the empty door afterwards');
  const hit=rooms(),b=unit(hit,'rifleman',20,8,'b');orderAmbush(hit,b);hit.hurt(b,1,hit.player);assert.equal(b.order,undefined,'hit');
  const seen=rooms(),c=unit(seen,'rifleman',20,8,'c');orderAmbush(seen,c);
  const look=seen.teamVisible.bind(seen);seen.teamVisible=o=>o===c||look(o);seen.action('wait');assert.equal(c.order,undefined,'seen');
  const other=rooms(),d=unit(other,'rifleman',20,8,'d');orderAmbush(other,d);
  d.lastKnown={x:18,y:9};other.action('wait');assert.equal(d.order,undefined,'you are already past its door');
});

test('a sniper takes an ambush by itself; a rifleman does not',()=>{
  const g=rooms(),s=unit(g,'sniper',20,8,'s'),r=unit(g,'rifleman',22,9,'r');
  g.action('wait');
  assert.equal(s.order?.kind,'ambush');assert.equal(s.order.by,'self');
  assert.equal(r.order,undefined,'a rifleman on its own keeps its usual ways');
});

test('a squad that loses you sends the half farthest from your last tile to ambush, on the leader\'s order',()=>{
  const g=rooms(),leader=unit(g,'squad_leader',21,4,'L');
  const members=[unit(g,'rifleman',14,9,'m1'),unit(g,'rifleman',16,9,'m2'),unit(g,'rifleman',23,9,'m3'),unit(g,'rifleman',24,3,'m4')];
  deploySquad(g,leader,members,g.weapon.id);for(const m of members){m.squad.set=true;m.squad.goal={x:m.x,y:m.y};}
  Object.assign(leader.squad,{state:'patience',patience:1,last:{...LAST}});
  g.action('wait');
  assert.equal(leader.squad.state,'search');
  const ambushers=members.filter(m=>m.order?.kind==='ambush');
  assert.ok(ambushers.length>=1&&ambushers.length<=2,'at most half');
  assert.ok(ambushers.every(m=>m.order.by==='L'),'on the leader\'s order');
  const far=[...members].sort((a,b)=>(Math.abs(b.x-LAST.x)+Math.abs(b.y-LAST.y))-(Math.abs(a.x-LAST.x)+Math.abs(a.y-LAST.y))).slice(0,2);
  assert.ok(ambushers.every(m=>far.includes(m)),'the farthest go');
  assert.ok(members.filter(m=>!m.order).some(m=>m.squad.role==='move'),'the rest still search');
});

test('an order survives a save; a tampered one is refused',()=>{
  const g=new Game(7,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'}),e=g.enemies.find(o=>o.type==='rifleman');
  e.order={kind:'ambush',by:'self',at:{x:e.x,y:e.y},watch:{x:e.x+1,y:e.y},from:{x:g.player.x,y:g.player.y},since:g.turn,patience:6,breakOn:['spotted','hit','passed']};
  const back=Game.restore(g.serialize());assert.ok(back);assert.deepEqual(back.enemies.find(o=>o.id===e.id).order,e.order);
  for(const bad of [{kind:'nap'},{patience:0},{patience:1.5},{breakOn:['bored']},{breakOn:['hit','hit']},{at:{x:-1,y:0}},{since:g.turn+5},{by:''},{extra:1}]){
    const raw=JSON.parse(g.serialize());Object.assign(raw.data.enemies.find(o=>o.id===e.id).order,bad);
    assert.equal(Game.restore(JSON.stringify(raw)),null,JSON.stringify(bad));
  }
});
