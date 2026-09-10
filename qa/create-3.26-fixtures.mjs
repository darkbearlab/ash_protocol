// Import into ?test=1 only; does not touch browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {makeBarrier} from '../src/barriers.js';
const folder=new URL('./fixtures/3.26/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g){g.runId='qa-bump-'+name;g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw Error(name);await writeFile(new URL(name+'.json',folder),raw);}
function arena(){const g=new Game(326,[],0,'bulwark','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};return g;}
const melee=arena(),enemy=makeEnemy('rifleman',11,10,'bump-target');enemy.hp=enemy.maxHp=300;enemy.alert=true;enemy.charge=true;melee.enemies=[enemy];await save('bump-slow',melee);
const door=Game.restore(melee.serialize());door.barriers=[makeBarrier('door',door.player,door.enemies[0],'edge-closed-door')];await save('door-before-melee',door);
const lines=arena();for(let x=7;x<=14;x++){lines.grid[7][x]=0;lines.grid[14][x]=0;}for(let y=7;y<=14;y++){lines.grid[y][7]=0;lines.grid[y][14]=0;}
lines.end={x:10,y:13};lines.props=[{id:'box',type:'cover',x:12,y:11,hp:65,maxHp:65},{id:'barrel',type:'barrel',x:12,y:12,hp:25,maxHp:25}];lines.barriers=[makeBarrier('door',{x:10,y:10},{x:11,y:10},'edge-test-door'),makeBarrier('partition',{x:10,y:11},{x:11,y:11},'edge-test-partition')];const openDoor=makeBarrier('door',{x:10,y:10},{x:10,y:9},'edge-open-door');openDoor.open=true;lines.barriers.push(openDoor);await save('boundary-gallery',lines);
const corridor=arena();corridor.grid=Array.from({length:SIZE},(_,y)=>Array(SIZE).fill(y===10?1:0));corridor.lighting=corridor.grid.map(r=>r.map(()=>1));corridor.seen=corridor.grid.map(r=>r.map(()=>false));corridor.end={x:20,y:10};corridor.barriers=[makeBarrier('door',corridor.player,{x:11,y:10},'edge-corridor')];await save('open-contour-corridor',corridor);
await save('natural-bulwark',new Game(326,[],0,'bulwark','onyx'));
console.log('Five 3.26 fixtures generated. Artificial enemy HP 300 is for playback checks, not balance evidence.');
