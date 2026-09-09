// Only import through ?test=1 -> settings -> 匯入任務.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const folder=new URL('./fixtures/3.14/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){const g=new Game(3140,[],0,'bulwark','portrait-14');g.runId=`qa-bulwark-${name}`;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,scrap:100});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;}
function enemy(g,x=11,y=10){const e=makeEnemy('rifleman',x,y,'target');Object.assign(e,{hp:400,maxHp:400,alert:true,charge:true});g.enemies.push(e);g.target=e.id;return e;}
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy)data.version=10;const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid fixture ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
const duel=arena('duel');enemy(duel);await save('bulwark-duel',duel);
const free=arena('free-switch');enemy(free,14);Object.assign(free.player,{guard:true,focus:true,evasive:true,moved:true,moveDelta:[0,1],poison:2});free.hazards=[{x:10,y:10,type:'fire'}];free.marks=[{x:10,y:10,due:2}];free.player.ammo[6]=2;await save('free-switch',free);
const pack=arena('fixed-pack');pack.player.weapon=7;pack.player.owned.push(0);pack.player.ammo[0]=8;pack.items.push(pack.registerWeapon({type:'weapon',weapon:3,x:10,y:10}));await save('fixed-pack',pack);
const old=new Game(3140,[],0,'recon','silver');old.runId='qa-bulwark-legacy';old.player.ammo[2]=3;old.player.prepared.item=null;await save('legacy-v10',old,true);
const thunder=arena('thunder');thunder.player.owned.push(0);thunder.player.ammo[0]=8;thunder.items.push(thunder.registerWeapon({type:'weapon',weapon:8,x:10,y:10}));enemy(thunder,14,10);thunder.player.ordnance=12;await save('thunder-loot',thunder);
console.log('Five isolated 3.14 fixtures created. Natural difficulty remains external QA.');
