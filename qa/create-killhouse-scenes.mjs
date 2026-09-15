// Volatile sessions intentionally cannot be imported as campaign JSON.
// In a ?test=1 browser console import /ash_protocol/src/killhouse.js and call the
// same factory. This Node helper produces inspection data, not a playable save.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createKillhouse} from '../src/killhouse.js';
const out='qa/fixtures/killhouse';mkdirSync(out,{recursive:true});
for(const mode of ['tutorial','arcade'])for(const seed of mode==='tutorial'?[1]:[0,1]){
 const g=createKillhouse({mode,seed,character:'recon'});if(mode==='arcade'){Object.assign(g.player,g.end);g.descend();}
 writeFileSync(`${out}/${mode}-${seed}.json`,JSON.stringify({inspectionOnly:true,options:{mode,seed,character:'recon'},simulation:g.simulation,grid:g.grid,rooms:g.rooms,start:g.start,end:g.end,barriers:g.barriers,enemies:g.enemies,items:g.items,result:g.simulationResult},null,2));
 console.log(mode,seed,g.enemies.length,g.killhouseRecipe);
}
