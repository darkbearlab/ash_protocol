import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {WEAPONS} from '../src/data.js';
import {weaponStats} from '../src/weapons.js';
import {coneTargets,inCone,rayCells,shotgunBand} from '../src/shotgun.js';
import {targetDetails} from '../src/target-card.js';

const SG=1;
// A lit open floor, the player at (5,15) holding the standard shotgun, nobody else around.
function lane(){
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));
 p.x=5;p.y=15;p.weapon=SG;if(!p.owned.includes(SG))p.owned.push(SG);p.ammo[SG]=4;p.shell=99;
 g.reveal();
 return {g,p};
}
const foe=(g,dx,dy,id)=>{const p=g.player,e=g.spawnEnemy('brute',p.x+dx,p.y+dy,id);e.alert=false;g.enemies.push(e);g.reveal();return e;};
const always=g=>{g.rng=()=>0;};                       // every roll hits, lowest damage

test('the standard shotgun reaches six tiles with a sixty-degree cone and three damage bands',()=>{
 const w=weaponStats(SG);
 assert.equal(w.range,6);assert.equal(w.cone,30);
 assert.deepEqual([1,2].map(d=>shotgunBand(w,d).band),['close','close']);
 assert.deepEqual([3,4].map(d=>shotgunBand(w,d).band),['mid','mid']);
 assert.deepEqual([5,6].map(d=>shotgunBand(w,d).band),['far','far']);
 assert.deepEqual([shotgunBand(w,1).min,shotgunBand(w,3).min,shotgunBand(w,6).min],[60,42,21],'the far band is the weak one');
});

// 3.141.0: each target in the cone takes the pellets its distance allows, and every pellet rolls its own hit.
test('one shell reaches every enemy in the cone, and each rolls its own hit',()=>{
 const {g,p}=lane(),a=foe(g,3,0,'a'),b=foe(g,4,1,'b'),c=foe(g,4,-1,'c');
 g.target=a.id;
 const hp=[a,b,c].map(e=>e.hp);
 // a is 3 tiles off (5 pellets: 10 rolls when all land); the next target's 3 pellets all miss; the last one's land.
 let calls=0;g.rng=()=>{calls++;return calls>10&&calls<=13?.9999:0;};
 assert.equal(g.action('fire'),true);
 assert.equal(p.ammo[SG],3,'one shell');
 const hurt=[a,b,c].map((e,i)=>e.hp<hp[i]);
 assert.deepEqual(hurt.filter(Boolean).length,2,'two of three hit, because each target rolled on its own');
 assert.equal(calls,10+3+6);
});

test('a target standing directly behind another is shielded',()=>{
 const {g}=lane(),front=foe(g,2,0,'front'),back=foe(g,4,0,'back');
 g.target=front.id;always(g);
 const reached=coneTargets(g,g.player,front,weaponStats(SG)).map(o=>o.id);
 assert.deepEqual(reached,['front']);
 const hp=back.hp;
 assert.equal(g.action('fire'),true);
 assert.equal(back.hp,hp);
 assert.ok(rayCells(g.player,back).some(c=>c.x===front.x&&c.y===front.y));
});

test('outside the cone is safe, however close',()=>{
 const {g,p}=lane(),aim=foe(g,4,0,'aim'),side=foe(g,1,1,'side');
 g.target=aim.id;always(g);
 assert.equal(inCone(p,aim,side,30),false,'45 degrees off the aim');
 const hp=side.hp;
 assert.equal(g.action('fire'),true);
 assert.equal(side.hp,hp);
});

test('the cone hits allies too',()=>{
 const {g,p}=lane(),aim=foe(g,5,0,'aim');
 g.target=aim.id;always(g);
 // A friendly drone standing in the cone, off the aim line so it does not shield the enemy.
 const friend={id:'ally-1',kind:'drone',status:'active',floor:g.floor,x:p.x+3,y:p.y+1,hp:40,maxHp:40,armor:0,traits:[],control:{disabled:0,immune:0},moveDelta:[0,0]};
 g.allies=[friend];
 assert.ok(g.activeAllies.includes(friend),'the fixture drone counts as active');
 assert.ok(coneTargets(g,p,aim,weaponStats(SG)).includes(friend));
 assert.match(targetDetails(g).state,/含友軍 1/);
 assert.equal(g.action('fire'),true);
 assert.ok(friend.hp<40,'the friend takes the pellets');
});

test('damage falls off with distance for the same shell',()=>{
 const near=lane(),far=lane();
 const a=foe(near.g,1,0,'n'),b=foe(far.g,6,0,'f');
 near.g.target=a.id;far.g.target=b.id;always(near.g);always(far.g);
 const ha=a.hp,hb=b.hp;
 near.g.action('fire');far.g.action('fire');
 assert.ok(ha-a.hp>(hb-b.hp)*2,'point blank does more than twice the far band');
});

test('doors, cover and barrels are still breached one target at a time',()=>{
 const {g,p}=lane(),barrel={id:'barrel-1',type:'barrel',x:p.x+2,y:p.y,hp:18,maxHp:18};
 g.props.push(barrel);foe(g,4,1,'bystander');g.reveal();
 g.target=barrel.id;always(g);
 const bystander=g.enemies[0],hp=bystander.hp;
 assert.equal(g.action('fire'),true);
 assert.ok(barrel.hp<18,'the prop is hit');
 assert.equal(p.ammo[SG],3);
 // The barrel exploding may reach the bystander; what must not happen is a cone. Radius 1 cannot reach (4,1).
 assert.equal(bystander.hp,hp);
});

test('an empty cone still spends the shell and says it missed',()=>{
 const {g,p}=lane(),e=foe(g,3,0,'gone');g.target=e.id;
 const aim={x:e.x,y:e.y};
 g.enemies=[];
 assert.equal(g.fireCone(aim),true);
 assert.equal(p.ammo[SG],3);
 assert.match(g.logs[0].text,/沒有打中/);
});
