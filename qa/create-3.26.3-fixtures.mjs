// Visual QA scenes; import only into ?test=1. Never accesses browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const folder=new URL('./fixtures/3.26.3/',import.meta.url);await mkdir(folder,{recursive:true});
for(const crowded of [false,true]){
  const g=new Game(3263,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>false));
  for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];
  Object.assign(g.player,{x:13,y:13});g.end={x:22,y:22};
  const positions=crowded?[[16,13],[11,10],[16,10],[11,16],[16,16],[9,13],[18,13],[13,9],[13,17]]:[[16,13]];
  for(const [i,[x,y]]of positions.entries()){const e=makeEnemy('rifleman',x,y,'qa-corner-'+i);e.hp=e.maxHp=300;g.enemies.push(e);}
  g.target='qa-corner-0';g.runId='qa-corners-'+(crowded?'crowded':'single');g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw Error('Invalid corner fixture');
  await writeFile(new URL((crowded?'crowded':'single')+'.json',folder),raw);
}
console.log('Two corner placement fixtures generated; artificial enemy HP is for visual QA only.');
