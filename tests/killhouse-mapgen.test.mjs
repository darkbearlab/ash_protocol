import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeMap,tutorialMap,KILLHOUSE_RECIPES} from '../src/killhouse-maps.js';
import {generateWithRecipes,reachable,key} from '../src/world.js';
import {MAP_RECIPES} from '../src/map-recipes-data.js';
import {validateRecipe} from '../src/map-recipes.js';
import {tutorialCue} from '../src/killhouse-ui.js';
import {createKillhouse} from '../src/killhouse.js';
import {civilianAction} from '../src/civilians.js';
test('arcade inherits campaign geometry, furnishings and combat positions across 30 seeds',()=>{
 for(let seed=0;seed<30;seed++){
  const a=arcadeMap(seed),b=generateWithRecipes(seed,4,[],MAP_RECIPES,'loyalist');
  for(const field of ['grid','cells','barriers','openings','annexes','links','start','end'])assert.deepEqual(a[field],b[field]);
  assert.deepEqual(a.enemies.filter(e=>e.type!=='civilian').map(({id,x,y})=>({id,x,y})),b.enemies.map(({id,x,y})=>({id,x,y})));
  assert.deepEqual(a.props,b.props.filter(p=>!['container','terminal','nest'].includes(p.type)));
  assert.ok(a.enemies.every(e=>['rifleman','raider','gunner','sniper','rifleman_armored','raider_armored','civilian'].includes(e.type)&&e.simulation));
  assert.equal(a.items.length,0);assert.equal(a.mapStyle,'killhouse');
 }
});
test('tutorial uses valid campaign recipe and gates preserve sequential access and pre-door cards',()=>{
 assert.ok(validateRecipe(KILLHOUSE_RECIPES.tutorial));const g=createKillhouse();
 for(const entry of g.tutorialEntrances){
  Object.assign(g.player,entry.approach);assert.equal(tutorialCue(g),entry.toRoom);
  const gate=g.barriers.find(b=>b.id===entry.barrierId);
  if(gate){assert.equal(gate.open,false);assert.equal(reachable(g,g.start,{openDoors:false}).has(key(g.rooms[entry.toRoom].footprint[0])),false);gate.open=true;}
 }
 assert.ok(reachable(g,g.start).has(key(g.end)));
 assert.ok(g.props.some(p=>p.type==='module'));assert.ok(g.barriers.some(b=>b.type==='low_partition'));
});
test('researcher remains in left area and never opens a teaching gate',()=>{
 const g=createKillhouse(),e=g.enemies.find(e=>e.type==='civilian');g.sight=()=>true;
 for(let turn=0;turn<40;turn++){g.turn=turn;Object.assign(g.player,{x:10+(turn%3),y:18+turn%7});civilianAction({g,e});assert.ok(e.x>=10&&e.x<13&&e.y>=18&&e.y<25);}
 assert.ok(g.barriers.filter(b=>b.type==='door').every(b=>!b.open));
});
