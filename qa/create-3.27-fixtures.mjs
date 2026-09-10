// Import these only into ?test=1. No browser storage is accessed here.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const folder=new URL('./fixtures/3.27/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){
  const g=new Game(327,[],0,'recon','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());
  for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];
  Object.assign(g.player,{x:10,y:10});g.end={x:11,y:10};g.reveal();return g;
}
async function save(name,g,legacy=false){
  g.runId='qa-signal-'+name;g.reveal();const data=JSON.parse(g.serialize());
  if(legacy){data.version=19;data.data.player.skills=[];data.data.player.prepared.skill=null;delete data.data.player.skillState;}
  const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);
}
await save('natural',new Game(327,[],0,'recon','onyx'));
const ready=arena();await save('ready',ready);
const search=arena();search.enemies=['rifleman','drone','sniper','warden'].map((type,i)=>makeEnemy(type,14,8+i,'qa-sensor-'+i));search.reveal();await save('sensors-search',search);
const sniper=arena(),e=makeEnemy('sniper',14,10,'qa-committed');sniper.enemies=[e];sniper.reveal();Object.assign(e,{charge:true,windup:1,aim:{x:10,y:10}});await save('committed-sniper',sniper);
const bombard=arena();bombard.marks=[{x:10,y:10,due:bombard.turn+1}];await save('bombardment',bombard);
const active=arena();active.action('usePrepared',{category:'skill'});active.action('wait');active.action('wait');await save('one-action-left',active);
const legacy=arena();Object.assign(legacy.player,{hp:43,emp:0,smoke:0,meds:0,reserve:7});await save('legacy-v19',legacy,true);
console.log('Seven signal break fixtures generated. Arena scenes are mechanism checks, not balance evidence.');
