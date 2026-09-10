// Mechanism scenes only; import into ?test=1. Never writes browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
const folder=new URL('./fixtures/3.28/',import.meta.url);await mkdir(folder,{recursive:true});
const create=()=>new Game(328,[],0,'recon','onyx','roundtrip');
const travel=g=>{Object.assign(g.player,g.exitPoint);if(!g.descend())throw Error('Travel failed');};
const clear=g=>{g.enemies.forEach(e=>e.hp=0);g.pendingPerks=0;};
function third(){const g=create();travel(g);travel(g);return g;}
function collect(g){Object.assign(g.player,g.mission.targets[0]);g.recoverObjective('objective-1');}
function arena(g){g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','smoke','traces'])g[k]=[];Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();}
async function save(name,g,legacy=false){
  g.runId='qa-retreat-'+name;g.reveal();const data=JSON.parse(g.serialize());
  if(legacy){data.version=20;delete data.data.floorStates;delete data.data.reinforcements;}
  const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);
}
await save('natural',create());
const ready=third();clear(ready);Object.assign(ready.player,ready.mission.targets[0]);await save('third-floor-data',ready);
const returning=third();clear(returning);const old=returning.floorStates[2];old.barriers.find(b=>b.type==='door').open=true;old.props.find(p=>p.type==='terminal').used=true;const box=old.props.find(p=>p.type==='container');box.opened=true;box.contents=[];old.enemies[0].hp=3;
collect(returning);travel(returning);await save('return-floor-two',returning);
clear(returning);travel(returning);clear(returning);returning.reinforcements=[];Object.assign(returning.player,returning.exitPoint);await save('entrance-extraction',returning);
const warning=third();arena(warning);warning.mission.targets=[{id:'objective-1',x:10,y:10,done:false}];collect(warning);await save('teleport-warning',warning);
const smoke=new Game(328,[],0,'recon','onyx');arena(smoke);smoke.action('grenade',{x:10,y:10});await save('smoke-five',smoke);
const legacy=new Game(328,[],0,'recon','onyx');legacy.smoke=[{cells:[{...legacy.start}],expires:legacy.turn+2}];await save('legacy-v20-smoke',legacy,true);
console.log('Seven 3.28 fixtures generated; only natural is suitable for an unmodified balance run.');
