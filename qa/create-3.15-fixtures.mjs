// Generate isolated saves; import ONLY in ?test=1 via settings -> 匯入任務.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
const folder=new URL('./fixtures/3.15/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name,character='recon'){
  const g=new Game(3150,[],0,character,'portrait-06');g.runId=`qa-throwables-${name}`;
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,grenades:1,emp:1,stun:1,smoke:1,scrap:100});
  g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;
}
function enemy(g,type,x,y){const e=makeEnemy(type,x,y,`${type}-${g.enemies.length}`);Object.assign(e,{hp:300,maxHp:300,alert:true,charge:true,windup:1,aim:{x:10,y:10}});g.enemies.push(e);return e;}
async function save(name,g,legacy=false){g.reveal();const value=JSON.parse(g.serialize());if(legacy){value.version=11;delete value.data.smoke;for(const k of ['control','emp','stun','smoke'])delete value.data.player[k];for(const actor of [value.data.player,...value.data.enemies]){actor.traits=actor.traits.filter(t=>!['biological','mechanical'].includes(t.id));delete actor.control;delete actor.lastKnown;}}
  const raw=JSON.stringify(value);if(!Game.restore(raw))throw Error(`Invalid fixture: ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);
}
const mix=arena('mixed');enemy(mix,'drone',14,10);enemy(mix,'rifleman',14,11);mix.player.prepared.grenade='emp';await save('mixed-targets',mix);
const fog=arena('smoke');enemy(fog,'rifleman',15,10);enemy(fog,'raider',15,11);fog.player.prepared.grenade='smoke';await save('smoke-escape',fog);
const sniper=arena('sniper');enemy(sniper,'sniper',15,10);sniper.player.prepared.grenade='smoke';await save('marked-sniper',sniper);
const self=arena('self');self.player.prepared.grenade='stun';self.player.ammo[2]=1;await save('self-stun',self);
const slow=arena('slow','bulwark');enemy(slow,'warden',14,10);const fast=enemy(slow,'drone',14,11);grantTrait(fast,'fast','qa:fast');slow.player.prepared.grenade='emp';await save('slow-vs-boss',slow);
const stock=arena('stock');stock.props=[{id:'terminal',type:'terminal',x:10,y:11,used:false}];stock.items=[{x:11,y:10,type:'emp',amount:3},{x:10,y:9,type:'smoke',amount:2}];await save('shared-capacity',stock);
const old=arena('legacy','bulwark');old.player.ammo[6]=7;old.player.upgrades[7]=2;await save('legacy-v11',old,true);
console.log('Seven isolated 3.15 fixtures generated. Mobile and natural balance QA remain external.');
