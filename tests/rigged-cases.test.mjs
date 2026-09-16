import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {isContainer,isRigged,RIG_TUNING} from '../src/containers.js';
import {FRAG_DAMAGE} from '../src/throwables.js';
import {containerName} from '../src/containers.js';
import {targetDetails} from '../src/target-card.js';

const floorOf=(faction,seed=4242)=>new Game(seed,[],0,'soldier',undefined,'extraction',{facilityFaction:faction});
const cases=g=>g.props.filter(isContainer);

test('only rebel floors rig cases, at most two, and a rigged case looks like any other',()=>{
 for(const seed of [1,77,4242,90210]){
  const loyal=floorOf('loyalist',seed);
  assert.equal(cases(loyal).filter(isRigged).length,0);
  assert.ok(cases(loyal).every(c=>c.indestructible===true&&c.hp===undefined));
  const rebel=floorOf('rebel',seed),rigged=cases(rebel).filter(isRigged);
  assert.ok(rigged.length<=RIG_TUNING.perFloor);
  // The disguise is the point: rigged cases keep an ordinary kind and still hold real contents.
  assert.ok(rigged.every(c=>c.kind!=='unknown'&&c.contents.length>0));
 }
});

test('a rigged case is the only case that can be locked, and is never auto-locked or cycled',()=>{
 const g=floorOf('rebel'),rigged=cases(g).filter(isRigged);
 assert.ok(rigged.length>0);
 // controller taps pick from props with hp > 0; autoTarget and the cycle read visibleEnemies, which holds no props.
 assert.ok(rigged.every(c=>c.hp>0&&c.maxHp===RIG_TUNING.hp&&c.indestructible===undefined));
 assert.ok(cases(g).filter(c=>!isRigged(c)).every(c=>!(c.hp>0)));
 g.autoTarget();
 assert.ok(g.target===null||g.enemies.some(e=>e.id===g.target));
 assert.ok(!g.visibleEnemies.some(e=>isContainer(e)));
});

test('opening a rigged case detonates it on the spot and destroys what was inside',()=>{
 const g=floorOf('rebel'),c=cases(g).find(isRigged);
 Object.assign(g.player,{x:c.x,y:c.y});
 const items=g.items.length,hp=g.player.hp;
 assert.equal(g.openContainer(c.id),true);
 assert.equal(g.player.hp,hp-FRAG_DAMAGE);
 assert.equal(g.items.length,items);
 assert.deepEqual(c.contents,[]);
 assert.equal(c.opened,true);assert.equal(c.hp,0);
 assert.match(g.logs.map(l=>l.text??l).join(' '),/引信/);
});

test('destroying a rigged case from range costs the supplies but not the operator',()=>{
 const g=floorOf('rebel'),c=cases(g).find(isRigged);
 const hp=g.player.hp,items=g.items.length;
 assert.ok(Math.abs(g.player.x-c.x)+Math.abs(g.player.y-c.y)>RIG_TUNING.radius);
 g.damageProp(c,RIG_TUNING.hp,g.player);
 assert.equal(c.hp,0);assert.deepEqual(c.contents,[]);assert.equal(c.opened,true);
 assert.equal(g.player.hp,hp);assert.equal(g.items.length,items);
});

test('rigged cases survive a save round trip and validation rejects malformed ones',()=>{
 const g=floorOf('rebel');
 const back=Game.restore(g.serialize());
 assert.ok(back);
 assert.deepEqual(cases(back).filter(isRigged).map(c=>c.id),cases(g).filter(isRigged).map(c=>c.id));
 for(const broken of [c=>{c.hp=undefined;},c=>{c.maxHp=undefined;},c=>{c.hp=c.maxHp+1;},c=>{c.indestructible=true;},c=>{c.rigged='yes';}]){
  const raw=JSON.parse(g.serialize());
  broken(raw.data.props.find(p=>p.rigged));
  assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
});

test('simulations never rig cases',()=>{
 const g=floorOf('rebel');
 g.simulation={kind:'killhouse'};g.loadFloor();
 assert.equal(cases(g).filter(isRigged).length,0);
});

test('a locked rigged case reads as the supply case it pretends to be, with hit points',()=>{
 const g=floorOf('rebel'),c=cases(g).find(isRigged);
 const stand=(t)=>{const spot=[[0,-1],[0,1],[1,0],[-1,0]].map(([dx,dy])=>({x:t.x+dx,y:t.y+dy})).find(q=>g.grid[q.y]?.[q.x]===1);Object.assign(g.player,spot);g.reveal();g.target=t.id;};
 stand(c);
 const card=targetDetails(g);
 assert.equal(card.name,containerName(c));
 assert.match(card.hp,new RegExp(`HP ${RIG_TUNING.hp} / ${RIG_TUNING.hp}`));
 // An ordinary case has no hp at all, so it can never become a target in the first place.
 stand(cases(g).find(x=>!isRigged(x)));
 assert.equal(targetDetails(g),null);
});
