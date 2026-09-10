// Import these raw saves only through ?test=1. Artificial scenes are not balance evidence.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {addAlly} from '../src/allies.js';
const folder=new URL('./fixtures/3.30/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(character){const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x>5&&x<23&&y>5&&y<22?1:0));g.lighting=g.grid.map(r=>r.map(()=>1));g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];g.allySerial=0;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:7,y:7};g.end={x:21,y:20};return g;}
const enemy=(g,type,x,y,hp=100)=>{const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);e.hp=hp;e.maxHp=Math.max(e.maxHp,hp);g.enemies.push(e);return e;};
async function save(name,g,legacy=false){g.runId='qa-allies-'+name;g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=22;delete data.data.allies;delete data.data.allySerial;}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
for(const c of ['engineer','druid','necromancer'])await save('natural-'+c,new Game(330,[],0,c,'onyx'));
const machine=arena('engineer');addAlly(machine,'drone','drone',{sourceId:'drone_follow',status:'packed'});enemy(machine,'rifleman',15,10);await save('deploy-and-recover',machine);
machine.action('skill','drone_follow');machine.allies[0].ammo=3;machine.allies[0].hp=19;await save('damaged-machine',machine);machine.damageAlly(machine.allies[0],999);await save('destroyed-machine',machine);
const beast=arena('druid'),pet=addAlly(beast,'pet','crawler',{sourceId:'pet_command',point:{x:11,y:10}});enemy(beast,'rifleman',16,10);await save('pet-command',beast);beast.damageAlly(pet,999);await save('pet-rescue',beast);
const necro=arena('necromancer');for(const [i,type]of ['rifleman','raider','crawler','warden'].entries())enemy(necro,type,13+i,12,0);enemy(necro,'rifleman',17,10);await save('corpse-pool',necro);
const trip=new Game(330,[],0,'druid','onyx','roundtrip');trip.allies[0].hp=37;Object.assign(trip.player,trip.exitPoint);trip.descend();await save('pet-left-floor-one',trip);
const survivors=arena('soldier');addAlly(survivors,'survivor','rifleman',{sourceId:'rescue-room',missionId:'future-rescue',point:{x:11,y:10}});enemy(survivors,'rifleman',15,10);await save('survivor-hook',survivors);
await save('legacy-v22',arena('soldier'),true);
console.log('Twelve 3.30 fixtures generated; natural scenes retain ordinary difficulty.');
