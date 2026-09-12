// Import only on ?test=1. Never writes browser storage or touches a real run.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
for(const [name,floor,mission]of [['mapgen-entry',1,'extraction'],['mapgen-sweep',6,'sweep'],['mapgen-archive',6,'archive'],['mapgen-endless-60',60,'endless']]){
  const g=new Game(428,[],0,'recon','onyx',mission);if(floor!==1){g.floor=floor;g.loadFloor();}
  writeFileSync(new URL(`${name}.json`,directory),g.serialize());console.log(`${name}.json`);
}
const g=new Game(428,[],0,'recon','onyx','roundtrip');
// Model a pre-v2 floor without changing its geometry, loot or weapon instances.
for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];Object.assign(g.player,g.end);g.descend();
writeFileSync(new URL('mapgen-mixed-return.json',directory),g.serialize());console.log('mapgen-mixed-return.json');
