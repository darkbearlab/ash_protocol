// Import through ?test=1 -> settings -> 匯入任務. Never use live saves.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const folder=new URL('./fixtures/3.13/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name,portrait){const g=new Game(3130,[],0,'recon',portrait);g.runId=`qa-portrait-${name}`;g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,hp:100,maxHp:100});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;}
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=9;delete data.data.player.portrait;}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
const side=arena('sidestep','silver');Object.assign(side.player,{moved:true,moveDelta:[0,1],hp:200,maxHp:200});for(const [x,y,id]of [[14,10,'east'],[10,14,'south']]){const e=makeEnemy('rifleman',x,y,id);Object.assign(e,{hp:1000,maxHp:1000,alert:true,charge:true});side.enemies.push(e);}await save('sidestep',side);
const victory=arena('extraction','onyx');victory.floor=6;victory.end={x:10,y:11};await save('extraction',victory);
const death=arena('kia','ember');death.player.hp=1;death.player.poison=1;await save('kia',death);
const legacy=arena('legacy','cedar');legacy.player.ammo[2]=3;legacy.player.prepared.item=null;await save('legacy-v9',legacy,true);
// Verify the two results with the engine; UI playback remains external QA.
victory.action('interact');if(victory.status!=='won')throw Error('Extraction fixture did not win');
death.action('wait');if(death.status!=='dead')throw Error('KIA fixture did not die');
console.log('Created four QA-only campaigns in qa/fixtures/3.13/.');
