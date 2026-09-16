import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {generate,generateLegacy} from '../src/world.js';
import {FIELD_ITEMS,CONTAINER_KINDS,isContainer,allSupplies} from '../src/containers.js';
import {PREPARED_CATALOG} from '../src/prepared.js';
import {SUPPLY_NAMES} from '../src/data.js';

const arena=()=>new Game(3,[],0,'soldier',undefined,'extraction');
const census=(seeds=30,floors=6)=>{
 const byType={};let n=0;
 for(let seed=1;seed<=seeds;seed++)for(let floor=1;floor<=floors;floor++){
  n++;
  for(const c of generate(seed,floor).props.filter(isContainer))
   for(const i of c.contents)byType[i.type]=(byType[i.type]||0)+1;
 }
 return {floors:n,byType,rate:t=>(byType[t]||0)/n};
};

test('every field item is a real catalogue consumable that a case is allowed to hold',()=>{
 assert.ok(FIELD_ITEMS.length);
 assert.ok(CONTAINER_KINDS.field,'field kit gets its own case kind');
 for(const id of FIELD_ITEMS){
  const entry=PREPARED_CATALOG.item[id];
  assert.ok(entry,`${id} is a catalogue item`);
  assert.ok(entry.resource&&Object.hasOwn(arena().player,entry.resource),`${id} has a player resource`);
  assert.ok(SUPPLY_NAMES[id],`${id} has a ground-supply name, which backups validate against`);
 }
});

test('field kit is picked up without any carry cap, unlike ammunition and plates',()=>{
 const g=arena(),p=g.player;
 for(const id of FIELD_ITEMS)p[PREPARED_CATALOG.item[id].resource]=99;
 g.items=FIELD_ITEMS.map(type=>({x:p.x,y:p.y,type}));
 g.pickup();
 assert.deepEqual(g.items,[],'nothing is left on the ground because nothing was full');
 for(const id of FIELD_ITEMS)assert.equal(p[PREPARED_CATALOG.item[id].resource],100,id);
 // Plates still spill, which is the contrast the change was made for.
 p.plates=g.plateCapacity;
 g.items=[{x:p.x,y:p.y,type:'armor',amount:20}];
 g.pickup();
 assert.equal(g.items.length,1,'a full plate pickup is still left in place');
});

test('every floor stocks the field kit, and ammunition is no longer half the contents',()=>{
 const {rate,byType}=census();
 const ammo=['ammo','pistol','shell','energy','ordnance'].reduce((a,t)=>a+(byType[t]||0),0);
 const total=Object.values(byType).reduce((a,b)=>a+b,0);
 for(const id of FIELD_ITEMS)assert.ok(rate(id)>=.7,`${id} appears ${rate(id).toFixed(2)}/floor`);
 assert.ok(ammo/total<.42,`ammunition is ${(100*ammo/total).toFixed(1)}% of case contents`);
 // Pistol and shotgun supply is untouched: the user reports the SMG starving late and the shotgun already weakest.
 assert.ok(rate('pistol')>=1.5,'pistol rounds stay common');
 assert.ok(rate('shell')>=1.5,'shells stay common');
});

test('launcher rounds still arrive from floor three, the first floor a launcher exists on',()=>{
 for(let seed=1;seed<=8;seed++){
  for(const floor of [3,4,5,6]){
   const supplies=allSupplies(generate(seed,floor));
   assert.ok(supplies.some(i=>i.type==='ordnance'),`seed ${seed} floor ${floor} has launcher rounds`);
  }
 }
});

test('the legacy generator carries the same supplies, so old floors stay loadable',()=>{
 const map=generateLegacy(7,1);
 const supplies=allSupplies(map);
 assert.ok(supplies.some(i=>FIELD_ITEMS.includes(i.type)),'legacy floors stock it too');
 const g=arena();
 g.items=supplies.filter(i=>FIELD_ITEMS.includes(i.type)).map(i=>({...i,x:g.player.x,y:g.player.y}));
 const before=FIELD_ITEMS.map(id=>g.player[PREPARED_CATALOG.item[id].resource]);
 g.pickup();
 assert.notDeepEqual(FIELD_ITEMS.map(id=>g.player[PREPARED_CATALOG.item[id].resource]),before);
});
