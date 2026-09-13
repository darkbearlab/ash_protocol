import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {makeEnemy,distance,key} from '../src/world.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {recordExposure,cornerRay} from '../src/corner.js';
import {combatStep} from '../src/tactics.js';
import {addAlly,allyAct,leash} from '../src/allies.js';
import {makeBarrier} from '../src/barriers.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {grantTrait} from '../src/traits.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(character='soldier'){
 const g=new Game(1,[],0,character);clearGeneratedMap(g);
 g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x&&y&&x<26&&y<26?1:0));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
 g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));g.start={x:2,y:2};g.end={x:23,y:23};Object.assign(g.player,{x:9,y:10});
 g.rng=Object.assign(()=>.99,{state:()=>7});g.reveal();return g;
}
function foe(g,x,y,type='rifleman'){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length,g.floor);g.enemies.push(e);return e;}
function corner(){
 const g=arena();for(let y=1;y<=10;y++)g.grid[y][10]=0;
 const e=foe(g,12,11);g.target=e.id;g.reveal();return {g,e};
}
test('quiet target endpoints cannot be assumed; actual shot opens only its used corner immediately',()=>{
 const {g,e}=corner();assert.ok(g.sight(e,g.player));assert.ok(g.shotClear(g.player,e));assert.equal(g.shotClear(e,g.player),false);
 assert.equal(g.attackStatus(e,g.player).reason,'target_corner_hidden');
 e.charge=true;e.windup=1;const ammo=g.player.ammo[g.player.weapon];assert.ok(g.action('fire'));
 assert.ok(g.player.ammo[g.player.weapon]<ammo);assert.equal(g.player.cornerExposure.until.south,g.turn+2);assert.ok(g.shotClear(e,g.player));
 assert.ok(g.effects.some(f=>f.type==='enemyShot'),'same turn ordinary enemy can return fire');
 assert.equal(g.attackStatus(e,g.player).targetExposed,true);assert.equal(g.player.cornerExposure.until.north,undefined);
 const end=g.player.cornerExposure.until.south;g.turn=end;assert.ok(g.shotClear(e,g.player));g.turn=end+1;assert.equal(g.shotClear(e,g.player),false);
});
test('exposure is symmetric for allies/enemies, does not see through smoke/doors and clears on movement',()=>{
 const {g,e}=corner();Object.assign(e,{x:9,y:10});Object.assign(g.player,{x:12,y:11});g.reveal();assert.equal(g.shotClear(g.player,e),false);
 recordExposure(g,e,g.player);assert.ok(g.shotClear(g.player,e));assert.ok(g.sight(g.player,e));
 g.smoke=[{cells:[{x:e.x,y:e.y}],expires:g.turn+3}];assert.equal(g.attackStatus(g.player,e).attackable,false);g.smoke=[];
 g.barriers=[makeBarrier('door',{x:9,y:10},{x:9,y:11},'qa-door')];assert.equal(g.shotClear(g.player,e),false);g.barriers=[];
 e.y--;g.reveal();e.y++;g.reveal();assert.equal(e.cornerExposure,null);assert.equal(g.shotClear(g.player,e),false);
 g.enemies=[];const a=addAlly(g,'survivor','rifleman',{point:{x:9,y:10}});g.enemies=[];const target=foe(g,12,12);a.bornTurn=0;
 allyAct(g,a);assert.ok(a.cornerExposure);assert.ok(g.shotClear(target,a));assert.equal(a.tactics,null);
});
test('free pursuit fire refreshes exposure without ticking; melee and hand grenades do not open a corner',()=>{
 const {g,e}=corner();g.pursuit=1;const t=g.turn;assert.ok(g.action('fire'));assert.equal(g.turn,t);assert.equal(g.player.cornerExposure.until.south,t+2);
 const h=arena();const b=foe(h,10,10);h.target=b.id;assert.ok(h.action('move',[1,0]));assert.equal(h.player.cornerExposure,null);
 const thrown=corner().g;assert.ok(thrown.action('grenade',{x:12,y:11}));assert.equal(thrown.player.cornerExposure,null);
});
test('committed fire pays ammo when target hides before execution; positional sniper ray remains geometric',()=>{
 const {g,e}=corner();Object.assign(e,{x:9,y:10});Object.assign(g.player,{x:12,y:11});recordExposure(g,e,g.player);g.target=e.id;g.reveal();
 const intent={id:e.id,x:e.x,y:e.y},ammo=g.player.ammo[g.player.weapon];e.cornerExposure=null;
 assert.ok(g.fire(intent));assert.ok(g.player.ammo[g.player.weapon]<ammo);assert.ok(g.effects.every(f=>f.miss));
 assert.equal(g.shotClear(g.player,e),false);assert.ok(g.shotClear(g.player,{x:e.x,y:e.y}));assert.ok(cornerRay(g,g.player,e,{tile:true}).clear);
});
function twoDoors(character='soldier'){
 const g=arena(character);for(let y=1;y<26;y++)g.grid[y][10]=0;g.grid[8][10]=1;g.grid[14][10]=1;Object.assign(g.player,{x:13,y:8});return g;
}
test('shared planner takes a longer second doorway around occupied front line and reserves distinct firing cells',()=>{
 const g=twoDoors();const front=foe(g,10,8),back=foe(g,9,8),other=foe(g,9,9);front.alert=back.alert=other.alert=true;
 const start={x:back.x,y:back.y};let throughOther=false,reached=false;
 for(let i=0;i<22;i++){
  g.turn++;const plan=combatStep(g,back,g.player,{range:3,peers:g.enemies});assert.ok(plan?.step);
  assert.notEqual(key(plan.step),key(front));Object.assign(back,plan.step);throughOther ||=back.x===10&&back.y===14;
  if(distance(back,g.player)<=3&&g.shotClear(back,g.player)){reached=true;break;}
 }
 assert.ok(throughOther);assert.ok(reached);assert.equal(front.x,10);assert.equal(front.y,8);assert.ok(distance(start,back)>0);
 const plan=combatStep(g,other,g.player,{range:3,peers:g.enemies});assert.ok(plan?.step);assert.notEqual(key(plan.goal),key(back));
});
test('rear melee summon routes around a fighting ally within tether instead of displacing it',()=>{
 const g=twoDoors('necromancer');Object.assign(g.player,{x:9,y:11});const front=addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:10,y:8}}),rear=addAlly(g,'summon','crawler',{sourceId:'raise_dead',point:{x:9,y:8}});
 front.bornTurn=rear.bornTurn=0;const e=foe(g,11,8);e.hp=999;let crossed=false;
 for(let i=0;i<20;i++){g.turn++;allyAct(g,rear);crossed ||=rear.x===10&&rear.y===14;assert.ok(distance(rear,g.player)<=leash(rear));if(distance(rear,e)===1)break;}
 assert.ok(crossed);assert.equal(distance(rear,e),1);assert.deepEqual({x:front.x,y:front.y},{x:10,y:8});
});
test('short holding is bounded and a live ally order/fixed sentry is not replaced by flanking',()=>{
 const {g,e}=corner();const other=foe(g,12,12);other.tactics={target:{x:g.player.x,y:g.player.y},goal:{x:9,y:11},until:g.turn+8,holdUntil:0,retryAfter:0};
 const plan=combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true});assert.ok(plan.hold);g.turn+=2;
 assert.ok(!combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true})?.hold);
 const h=arena('engineer'),a=addAlly(h,'drone','drone',{sourceId:'drone_sentry',point:{x:8,y:10}});a.bornTurn=0;foe(h,15,15);allyAct(h,a);assert.deepEqual([a.x,a.y],[8,10]);
});
test('saved exposure/plans round trip, migrate v33 and preserve remaining lifetimes across floor archive',()=>{
 const {g,e}=corner();recordExposure(g,g.player,e);recordExposure(g,e,g.player);
 e.tactics={target:{x:g.player.x,y:g.player.y},goal:{x:9,y:11},until:g.turn+8,holdUntil:0,retryAfter:0};
 const raw=g.serialize(),restored=Game.restore(raw);assert.ok(restored);assert.deepEqual(restored.player.cornerExposure,g.player.cornerExposure);assert.deepEqual(restored.enemies[0].tactics,e.tactics);
 const backup=makeBackup(g,normalizeProfile(),'qa');assert.ok(decodeBackup(JSON.stringify(backup),'qa'));
 const old=JSON.parse(raw);old.version=33;const legacy=Game.restore(JSON.stringify(old));assert.ok(legacy);assert.ok(legacy.player.cornerExposure==null);assert.ok(legacy.enemies[0].tactics==null);
 const frame=archiveFloor(g),back=resumedFloor(frame,g.turn+20);assert.equal(back.enemies[0].tactics.until,e.tactics.until+20);
 const invalid=JSON.parse(raw);invalid.data.player.cornerExposure.until.south=g.turn+3;assert.equal(Game.restore(JSON.stringify(invalid)),null);
 const bad=JSON.parse(raw);bad.data.enemies[0].tactics.goal.x=99;assert.equal(Game.restore(JSON.stringify(bad)),null);
});

test('allies keep only the last seen position while rounding a wall, and explicit orders take priority',()=>{
 const g=twoDoors('necromancer');Object.assign(g.player,{x:9,y:11});
 addAlly(g,'summon','rifleman',{sourceId:'raise_dead',point:{x:10,y:8}});
 const a=addAlly(g,'summon','crawler',{sourceId:'raise_dead',point:{x:9,y:8}}),e=foe(g,11,8);a.bornTurn=0;
 g.turn++;allyAct(g,a);assert.deepEqual(a.tactics.target,{x:11,y:8});
 Object.assign(e,{x:20,y:20});g.turn++;allyAct(g,a);assert.deepEqual(a.tactics.target,{x:11,y:8});
 a.order={x:a.x-1,y:a.y};const before=distance(a,a.order);g.turn++;allyAct(g,a);assert.ok(distance(a,a.order)<before,JSON.stringify({x:a.x,y:a.y,order:a.order,before}));
});
test('enemy target selection prefers an attackable ally over a nearer protected player',()=>{
 const {g,e}=corner();const a=addAlly(g,'survivor','rifleman',{point:{x:17,y:11}});
 assert.ok(distance(e,g.player)<distance(e,a));assert.equal(g.shotClear(e,g.player),false);assert.ok(g.shotClear(e,a));assert.equal(g.enemyTarget(e),a);
});

test('approaching AI advances along the long axis instead of mirroring endless lateral movement',()=>{
 const g=arena();Object.assign(g.player,{x:13,y:20});const e=foe(g,12,11);e.alert=true;
 for(let i=0;i<4;i++){g.player.x=i%2?12:13;g.turn++;g.enemyAct(e);}
 assert.ok(e.y>=14,JSON.stringify({x:e.x,y:e.y}));
});
test('exposure expires after the last eligible paid queue, before the next input can offer a stale shot',()=>{
 const {g,e}=corner();g.enemyAct=()=>{};recordExposure(g,g.player,e);
 g.action('wait');assert.ok(g.player.cornerExposure);g.action('wait');assert.equal(g.player.cornerExposure,null);assert.equal(g.shotClear(e,g.player),false);
});

test('failed routes retain hold retry limits and disabled peers cannot justify holding',()=>{
 const {g,e}=corner(),other=foe(g,12,12);other.tactics={target:{x:g.player.x,y:g.player.y},goal:{x:9,y:11},until:g.turn+24,holdUntil:0,retryAfter:0};
 g.passable=()=>false;assert.ok(combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true}).hold);
 g.turn+=2;assert.equal(combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true}),null);
 g.turn++;assert.equal(combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true}),null);
 e.tactics=null;other.control.disabled=2;assert.equal(combatStep(g,e,g.player,{range:7,peers:g.enemies,hold:true}),null);
});
