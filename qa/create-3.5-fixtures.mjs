// Only import these artificial scenes into ?test=1; never use a real campaign.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {random} from '../src/world.js';
const folder=new URL('./fixtures/3.5/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){
  const g=new Game(51);g.runId=`qa-presentation-${name}-${Date.now()}`;
  g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x&&y&&x<SIZE-1&&y<SIZE-1?1:0));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};g.rng=random(0);return g;
}
function enemy(g,type,hp,x,y){const e=makeEnemy(type,x,y,'enemy-'+g.enemies.length);e.hp=hp;e.maxHp=Math.max(e.maxHp,hp);g.enemies.push(e);return e;}
async function save(name,g){g.reveal();await writeFile(new URL(name+'.json',folder),g.serialize());}
const kill=arena('upgrade');enemy(kill,'rifleman',1,14,10);kill.player.xp=2;await save('shot-upgrade',kill);
const burst=arena('burst');enemy(burst,'brute',100,14,10);const shooter=enemy(burst,'rifleman',22,10,14);shooter.charge=true;shooter.windup=1;
Object.assign(burst.player,{weapon:2,owned:[0,1,2]});burst.player.ammo[2]=2;burst.target='enemy-0';await save('burst-response',burst);
const blast=arena('blast');enemy(blast,'rifleman',1,14,10);blast.props=[{id:'barrel',type:'barrel',x:13,y:10,hp:18,maxHp:18}];await save('grenade-chain',blast);
const death=arena('death');const attacker=enemy(death,'rifleman',22,14,10);attacker.charge=true;attacker.windup=1;death.player.hp=1;await save('enemy-death',death);
console.log('Created four QA-only scenes in qa/fixtures/3.5/. Import into ?test=1 only.');
