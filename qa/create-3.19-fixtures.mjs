// Files only: import via ?test=1. Does not touch any browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {MISSIONS,missionTarget} from '../src/missions.js';
import {makeEnemy} from '../src/world.js';
import {SIZE} from '../src/data.js';
const folder=new URL('./fixtures/3.19/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g,legacy=false){
  g.runId=`qa-mission-${name}`;g.reveal();const data=JSON.parse(g.serialize());
  if(legacy){data.version=15;delete data.data.mission;}
  const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid fixture: ${name}`);
  await writeFile(new URL(`${name}.json`,folder),raw);
}
for(const id of Object.keys(MISSIONS)){
  const g=new Game(319,[],0,'soldier','onyx',id);g.floor=6;g.loadFloor();
  const def=MISSIONS[id],first=def.kind==='recover'?g.mission.targets[0]:def.kind==='hunt'?g.enemies.find(e=>missionTarget(g,e)):g.enemies.find(e=>e.type==='boss');
  // Natural generated floor, with artificial durability to inspect UI safely.
  Object.assign(g.player,{x:first.x,y:first.y+1,hp:999,maxHp:999});
  if(!g.passable(g.player.x,g.player.y)||g.enemies.some(e=>e.hp>0&&e.x===g.player.x&&e.y===g.player.y))Object.assign(g.player,g.start);
  await save(`final-${id}`,g);
}
const mixed=new Game(319,[],0,'soldier','onyx','archive');mixed.floor=6;mixed.barriers=[];mixed.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));mixed.rooms=[];mixed.items=[];mixed.hazards=[];mixed.marks=[];mixed.smoke=[];mixed.props=[{id:'case-qa-mission',type:'container',kind:'medical',x:10,y:9,opened:false,contents:[{type:'med',amount:1}],indestructible:true},{id:'qa-station',type:'terminal',x:9,y:10,used:false}];mixed.enemies=[makeEnemy('boss',22,22,'optional-boss',6)];mixed.end={x:10,y:11};Object.assign(mixed.player,{x:10,y:10,hp:999,maxHp:999,scrap:100});mixed.mission.targets=[{id:'objective-1',x:11,y:10,done:false},{id:'objective-2',x:15,y:10,done:true},{id:'objective-3',x:17,y:10,done:true}];await save('last-data-mixed-interaction',mixed);
const old=new Game(319);old.floor=6;old.loadFloor();await save('legacy-v15-final',old,true);
const natural=new Game(319,[],0,'recon','silver','retrieval');await save('natural-recon-retrieval',natural);
console.log('Eight 3.19 fixtures generated in qa/fixtures/3.19/. Artificial HP is not balance evidence.');
