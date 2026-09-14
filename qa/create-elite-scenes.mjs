// Import only into ?test=1. No browser storage is accessed by this generator.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/engine.js';
const dir=new URL('./fixtures/elites/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const floor of [8,12,60]){
 const g=new Game(1,[],0,'soldier','onyx','endless');g.floor=floor;g.loadFloor();
 writeFileSync(new URL(`floor-${floor}.json`,dir),g.serialize());
 console.log(`floor ${floor}: ${g.enemies.filter(e=>e.elite).length} elites`);
}
