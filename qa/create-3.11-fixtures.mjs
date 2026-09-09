// Import these synthetic campaigns only through ?test=1 -> 匯入任務.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
const folder=new URL('./fixtures/3.11/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){const g=new Game(3110);g.runId=`qa-prepared-${name}-${Date.now()}`;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,hp:150,maxHp:200});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;}
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=7;delete data.data.player.prepared;delete data.data.player.skills;}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
const armed=arena('armed');const fast=makeEnemy('rifleman',14,10,'fast');Object.assign(fast,{hp:100,maxHp:100,alert:true,charge:true,windup:1});grantTrait(fast,'fast','qa:fast');armed.enemies=[fast];armed.target=fast.id;Object.assign(armed.player,{guard:true,focus:true,evasive:true});await save('prepared-fast',armed);
const empty=arena('empty');empty.player.meds=empty.player.grenades=0;empty.items=[{type:'med',x:11,y:10},{type:'grenade',amount:1,x:11,y:10}];await save('empty-refill',empty);
const old=arena('legacy');old.player.ammo[0]=3;old.player.upgrades[0]=2;grantTrait(old.player,'small','qa:small');await save('legacy-v7',old,true);
console.log('Created three QA-only campaigns in qa/fixtures/3.11/.');
