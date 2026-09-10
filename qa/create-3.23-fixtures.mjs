// Import into ?test=1 only. No browser storage access.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {makeBarrier} from '../src/barriers.js';
const folder=new URL('./fixtures/3.23/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){const g=new Game(323);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.props=[];g.barriers=[];g.enemies=[];g.items=[];g.hazards=[];g.smoke=[];g.marks=[];g.rooms=[];g.traces=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,traits:[],armor:0,plates:0});g.end={x:20,y:20};return g;}
async function save(name,g){g.runId='qa-cover-'+name;g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
for(const [name,dx,dy]of [['full',3,1],['diagonal',1,1],['oblique',2,3],['knight',1,2]]){
  const g=arena();g.enemies=[makeEnemy('rifleman',10+dx,10+dy,'qa-angle',1)];
  // Both actors have east/west-facing cover: card and incoming protection use the same angle.
  g.props=[{id:'cover-player',type:'cover',x:11,y:10,hp:65,maxHp:65},{id:'cover-enemy',type:'cover',x:9+dx,y:10+dy,hp:65,maxHp:65}];
  await save(name,g);
}
const mixed=arena();mixed.enemies=[makeEnemy('rifleman',12,13,'qa-angle',1)];mixed.barriers=[makeBarrier('door',mixed.player,{x:11,y:10},'edge-angle')];mixed.props=[{id:'cover-player',type:'cover',x:10,y:11,hp:65,maxHp:65}];await save('strongest',mixed);
const wall=arena();wall.grid[10][11]=0;wall.enemies=[makeEnemy('rifleman',12,13,'qa-angle',1)];await save('half-wall',wall);
await save('natural-323',new Game(323));
console.log('Seven 3.23 fixtures generated; HP 999 arenas are not balance evidence.');
