// Import ONLY in ?test=1 via settings -> 匯入任務; no browser storage is touched.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,makeBarrier} from '../src/engine.js';
const folder=new URL('./fixtures/3.16/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name,{corridor=false,character='soldier'}={}){
  const g=new Game(3160,[],0,character,'portrait-06');g.runId=`qa-barriers-${name}`;
  g.barriers=[];g.grid=Array.from({length:SIZE},(_,y)=>Array(SIZE).fill(corridor&&y!==10?0:1));
  Object.assign(g.player,{x:10,y:10,grenades:1,emp:1,stun:1,smoke:1,scrap:100});
  g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];g.end={x:20,y:10};return g;
}
function edge(g,type='door',a={x:10,y:10},b={x:11,y:10}){const e=makeBarrier(type,a,b,`edge-qa-${g.barriers.length}`);g.barriers.push(e);return e;}
function enemy(g,type,x,y){const e=makeEnemy(type,x,y,`qa-${type}-${g.enemies.length}`);Object.assign(e,{alert:true,lastKnown:{x:10,y:10}});g.enemies.push(e);return e;}
async function save(name,g,legacy=false){
  g.reveal();const value=JSON.parse(g.serialize());if(legacy){value.version=12;delete value.data.barriers;}
  const raw=JSON.stringify(value);if(!Game.restore(raw))throw Error(`Invalid fixture: ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);
}
const basic=arena('basic',{corridor:true});edge(basic);await save('door-basics',basic);
const mixed=arena('mixed');edge(mixed);edge(mixed,'door',{x:10,y:10},{x:10,y:9});mixed.props=[{id:'qa-terminal',type:'terminal',x:10,y:11,used:false}];mixed.items=[mixed.registerWeapon({type:'weapon',weapon:2,x:10,y:10})];await save('mixed-interactions',mixed);
const cover=arena('cover');edge(cover,'partition');enemy(cover,'rifleman',12,9);await save('partition-cover',cover);
const open=arena('enemy-open',{corridor:true});edge(open);enemy(open,'rifleman',11,10);await save('enemy-opens',open);
const bash=arena('enemy-bash',{corridor:true});edge(bash);enemy(bash,'brute',11,10);await save('enemy-bashes',bash);
const sniper=arena('sniper',{corridor:true});edge(sniper).open=true;Object.assign(enemy(sniper,'sniper',13,10),{charge:true,windup:1,aim:{x:10,y:10}});await save('sniper-door',sniper);
const blast=arena('blast',{corridor:true});edge(blast);Object.assign(blast.player,{hp:500,maxHp:500,blastBonus:20});Object.assign(enemy(blast,'rifleman',11,10),{hp:300,maxHp:300});await save('blast-shield',blast);
const sealed=arena('sealed');for(const [i,[dx,dy]]of [[1,0],[-1,0],[0,1],[0,-1]].entries())edge(sealed,i===0?'door':'partition',sealed.player,{x:10+dx,y:10+dy});enemy(sealed,'rifleman',12,10);await save('sealed-cell',sealed);
const old=arena('legacy',{character:'bulwark'});old.player.ammo[6]=7;old.player.upgrades[7]=2;await save('legacy-v12',old,true);
const natural=new Game(7);natural.runId='qa-barriers-natural';await save('natural-seed-7',natural);
console.log('Ten isolated 3.16 fixtures generated. Mobile operation and natural balance QA remain external.');
