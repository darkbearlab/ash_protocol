// Import only via ?test=1. Empty-room scenarios test mechanics, not balance.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
const folder=new URL('./fixtures/3.35/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){const g=new Game(335,[],0,'bulwark','onyx');g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x>5&&x<23&&y>5&&y<22?1:0));g.lighting=g.grid.map(r=>r.map(()=>1));g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];Object.assign(g.player,{x:10,y:10});g.start={x:7,y:7};g.end={x:21,y:20};return g;}
function enemy(g,x,y,fast=false){const e=makeEnemy('rifleman',x,y,'qa-anchor-'+g.enemies.length);e.maxHp=e.hp=600;e.alert=true;e.charge=true;e.windup=1;if(fast)grantTrait(e,'fast','qa:anchor');g.enemies.push(e);return e;}
async function save(name,g,legacy=false){g.runId='qa-anchor-'+name;g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=24;data.data.player.skills=[];data.data.player.prepared.skill=null;data.data.player.skillState={};}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
await save('natural-bulwark',new Game(335,[],0,'bulwark','onyx'));
const g=arena();await save('toggle-ready',g);await save('legacy-v24',g,true);g.action('skill','anchor');await save('anchored-empty',g);
enemy(g,14,10);await save('two-phase-fire',g);g.player.ammo[6]=4;await save('partial-magazine',g);g.player.ammo[6]=30;
g.enemies[0].x=11;await save('two-phase-fist',g);g.enemies=[];g.player.smoke=2;g.player.prepared.grenade='smoke';await save('single-smoke',g);
console.log('Eight 3.35 fixtures generated and restore-validated.');
