// Artificial mechanism scenes: import only into ?test=1, never live saves.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
const folder=new URL('./fixtures/3.29/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){const g=new Game(329,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x>6&&x<21&&y>6&&y<18?1:0));g.lighting=g.grid.map(r=>r.map(()=>1));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];g.seen=g.grid.map(r=>r.map(()=>false));Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:8,y:8};g.end={x:19,y:16};return g;}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);e.hp=e.maxHp=300;g.enemies.push(e);return e;};
async function save(name,g,legacy=false){g.runId='qa-tactical-'+name;g.reveal();const state=JSON.parse(g.serialize());if(legacy){state.version=21;state.data.player.skills=[];state.data.player.skillState={};state.data.player.prepared.skill=null;delete state.data.sensorContacts;delete state.data.player.vaultExposed;for(const e of state.data.enemies)delete e.vaultExposed;}const raw=JSON.stringify(state);if(!Game.restore(raw))throw Error('Invalid '+name);await writeFile(new URL(name+'.json',folder),raw);}
await save('natural-soldier',new Game(329,[],0,'soldier','onyx'));await save('natural-recon',new Game(329,[],0,'recon','onyx'));
const warning=arena();for(let y=7;y<18;y++)warning.grid[y][12]=0;enemy(warning,14,10);enemy(warning,15,11);enemy(warning,19,10);await save('warning-wall',warning);
const rails=arena();rails.barriers=[makeBarrier('low_partition',{x:10,y:10},{x:11,y:10},'edge-qa-low-x'),makeBarrier('low_partition',{x:10,y:12},{x:10,y:13},'edge-qa-low-y')];enemy(rails,15,10);await save('vault-gallery',rails);
const shotgun=arena();shotgun.player.weapon=1;enemy(shotgun,12,10,'brute');enemy(shotgun,10,13,'brute');await save('shotgun-close-far',shotgun);
const loot=arena();const dead=enemy(loot,11,10);dead.hp=0;loot.dropEnemyWeapon(dead,0);loot.items.push({x:11,y:10,type:'ammo',amount:10});await save('corpse-weapon-stack',loot);
const light=arena();for(let y=7;y<18;y++)for(let x=13;x<21;x++)light.lighting[y][x]=0;light.grid[12][12]=0;enemy(light,15,10);await save('soft-edges',light);
const old=arena();old.player.hp=27;old.player.reserve=7;await save('legacy-v21',old,true);
console.log('Eight 3.29 fixtures; only natural scenes retain normal balance.');
