// Browser QA: import only in ?test=1. This script never accesses browser storage.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game,isNoncombatant} from '../src/engine.js';
const dir=new URL('./fixtures/civilians/',import.meta.url);mkdirSync(dir,{recursive:true});
for(const floor of [1,3,6]){
 const g=new Game(1,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});g.floor=floor;g.loadFloor();
 writeFileSync(new URL(`loyalist-${floor}.json`,dir),g.serialize());
 console.log(`floor ${floor}: ${g.enemies.filter(isNoncombatant).length} civilians`);
}
