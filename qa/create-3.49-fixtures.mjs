// Import only in ?test=1. This generator never opens browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,MAX_LEVEL,makeEnemy} from '../src/engine.js';
const out=new URL('./fixtures/3.49/',import.meta.url);await mkdir(out,{recursive:true});
const rank=(g,level)=>{g.player.level=level;g.player.xp=0;g.perkPicks=Math.min(level-1,MAX_LEVEL-1);g.player.perks={med:g.perkPicks};};
function run(floor){const g=new Game(3490,[],0,'soldier','onyx','endless');if(floor>1){g.floor=floor;g.loadFloor();}return g;}
async function save(name,g){g.runId='qa-endless-'+name;g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw new Error('Fixture failed restore: '+name);await writeFile(new URL(name+'.json',out),raw);}
for(const floor of [7,12,20]){const g=run(floor);rank(g,Math.min(25,floor+12));await save('endless-'+floor,g);}
const near=run(7);rank(near,19);near.player.xp=20;
const q=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>({x:near.player.x+dx,y:near.player.y+dy})).find(p=>near.passable(p.x,p.y)&&near.canCross(near.player,p)&&!near.enemies.some(e=>e.x===p.x&&e.y===p.y));
if(!q)throw Error('No fixture target cell');const e=makeEnemy('rifleman',q.x,q.y,'qa-level-target',7);e.hp=1;near.enemies.push(e);near.target=e.id;
await save('level-19-near',near);
const high=run(20);rank(high,25);high.player.xp=26;await save('level-25',high);
await writeFile(new URL('README.txt',out),'Only import through ?test=1. Five saves validated by Game.restore.\nendless-7/12/20: natural generated floor, synthetic resource-perk history, NOT balance fixtures.\nlevel-19-near: kill adjacent 1 HP rifleman for the last choice (LV20).\nlevel-25: next kill grants automatic cap supplies.\nUI floorInfo migration remains Claude work.\n');
console.log('Five endless/level fixtures generated and restored in qa/fixtures/3.49.');
