import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {BLIND_TUNING,blindReason,shownItems} from '../src/blind-fire.js';
import {coneTargets} from '../src/shotgun.js';

// 3.151.0 (user decisions 2026-09-20, docs/WEAPONS.md 盲射): shoot into a tile you cannot see. −40 to hit in place of the
// darkness penalty, the shotgun unaffected; you see nothing you could not see (option 丙).
function arena(){
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];g.flares=[];g.traces=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(p,{x:10,y:10});g.end={x:25,y:25};g.reveal();
 Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 return g;
}
const cloud=(g,cx,cy)=>{g.smoke=[{cells:[[0,0],[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:cx+dx,y:cy+dy})),expires:g.turn+6}];g.reveal();};
const hidden=(g,x,y,hp=500)=>{const e=makeEnemy('rifleman',x,y,`h${x}${y}`,1);Object.assign(e,{hp,maxHp:hp,alert:false});g.enemies.push(e);g.reveal();return e;};

test('blind fire needs a gun, range, a clear shot and a tile you cannot see a target on',()=>{
 const g=arena(),p=g.player;cloud(g,14,10);const e=hidden(g,14,10);
 assert.equal(g.teamVisible(e),false);assert.equal(blindReason(g,{x:14,y:10}),'');
 assert.equal(blindReason(g,{x:10,y:10}),'不能朝自己腳下盲射');
 assert.equal(blindReason(g,{x:10+g.weapon.range+1,y:10}),'超出射程');
 g.grid[10][12]=0;assert.equal(blindReason(g,{x:14,y:10}),'射線被擋住');g.grid[10][12]=1;
 g.smoke=[];g.reveal();assert.equal(blindReason(g,{x:14,y:10}),'看得到目標，直接鎖定開火');
 p.ammo[p.weapon]=0;cloud(g,14,10);assert.equal(blindReason(g,{x:14,y:10}),'彈匣不足，請裝填');
 const knife=p.owned.find(i=>g.weaponAt(i).melee);if(knife!==undefined){p.weapon=knife;assert.equal(blindReason(g,{x:14,y:10}),'近戰武器不能盲射');}
 assert.equal(g.action('blindFire',{x:10,y:10}),false);
});

test('the blind shot rolls at −40 in place of darkness',()=>{
 const g=arena(),p=g.player;cloud(g,16,10);const e=hidden(g,16,10);e.moved=true;
 const plain=g.accuracy(p,e).chance;assert.ok(plain<99&&plain-BLIND_TUNING.penalty>10,`an unclamped shot: ${plain}`);p.blindShot=BLIND_TUNING.penalty;const blind=g.accuracy(p,e).chance;delete p.blindShot;
 assert.equal(plain-blind,BLIND_TUNING.penalty);
 g.lighting[10][16]=0;const dark=g.accuracy(p,e).chance;p.blindShot=BLIND_TUNING.penalty;assert.equal(g.accuracy(p,e).chance,blind,'darkness is replaced, not added');delete p.blindShot;assert.ok(dark<plain);
});

test('you learn nothing you cannot see: no hit line, no impact, every tracer a miss',()=>{
 const g=arena(),p=g.player;cloud(g,14,10);const e=hidden(g,14,10);g.rng=()=>0;
 const ammo=p.ammo[p.weapon],before=g.logs.length;
 assert.ok(g.action('blindFire',{x:14,y:10}));assert.ok(e.hp<500,'the shot landed');
 const lines=g.logs.slice(0,g.logs.length-before).map(l=>l.text);
 assert.ok(lines.includes(`盲射：消耗 ${ammo-p.ammo[p.weapon]} 發，看不到結果。`));
 assert.ok(!lines.some(t=>/命中|未命中|傷害/.test(t)),lines.join(' / '));
 assert.ok(g.effects.filter(f=>f.type==='shot').every(f=>f.miss));
 assert.ok(!g.effects.some(f=>f.type==='impact'||f.type==='blast'));
 assert.equal(p.fireChain,null);assert.ok(!e.lastKnown,'the hit alone does not give you away');
});

test('what the shot leaves on an unseen tile shows once the tile is seen',()=>{
 const g=arena();cloud(g,14,10);const e=hidden(g,14,10,1),rng=g.rng;g.rng=()=>0;
 assert.ok(g.action('blindFire',{x:14,y:10}));assert.ok(e.hp<=0);g.rng=rng;
 const memo=g.blindAftermath.get('14,10');assert.deepEqual(memo.dead,[]);assert.deepEqual(memo.traces,[]);
 const unseen=g.items.filter(i=>!g.visibleTiles.has(`${i.x},${i.y}`));assert.ok(unseen.every(i=>!shownItems(g).includes(i)),'dropped loot waits until its tile is seen, next tiles too');
 g.items.push({type:'ammo',x:14,y:10,amount:5});assert.ok(!shownItems(g).some(i=>i.x===14&&i.y===10),'loot waits until seen');
 assert.ok(!('blindAftermath' in JSON.parse(g.serialize()).data),'presentation memory is not saved');
 g.smoke=[];g.reveal();assert.equal(g.blindAftermath.size,0);assert.ok(shownItems(g).some(i=>i.x===14&&i.y===10));
});

test('an empty tile only spends the rounds',()=>{
 const g=arena(),p=g.player;cloud(g,14,10);const ammo=p.ammo[p.weapon];
 assert.ok(g.action('blindFire',{x:14,y:10}));assert.ok(p.ammo[p.weapon]<ammo);assert.equal(g.logs[0].text.startsWith('盲射：消耗'),true);
});

test('the shotgun blind-fires into the cone at its usual pellet chance',()=>{
 const g=arena(),p=g.player,SG=1;p.weapon=SG;if(!p.owned.includes(SG))p.owned.push(SG);p.ammo[SG]=4;p.shell=99;g.reveal();
 cloud(g,13,10);const e=hidden(g,13,10);g.rng=()=>0;
 assert.equal(coneTargets(g,p,{x:13,y:10},g.weapon).length,0,'a normal cone skips what you cannot see');
 assert.deepEqual(coneTargets(g,p,{x:13,y:10},g.weapon,true),[e]);
 assert.ok(g.action('blindFire',{x:13,y:10}));assert.equal(p.ammo[SG],3);assert.ok(e.hp<500,'every pellet rolls at the plain pellet chance');
 assert.ok(g.effects.filter(f=>f.type==='shot').every(f=>f.miss));
});
