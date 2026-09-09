// Only import in ?test=1. This script creates files, never browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,makeBarrier} from '../src/engine.js';
const folder=new URL('./fixtures/3.17/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){const g=new Game(317);g.runId=`qa-containers-${name}`;g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.props=[];g.enemies=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});return g;}
function box(g,x=11,y=10,contents=[{type:'ammo',amount:20},{type:'pistol',amount:24}],kind='ammo'){const c={id:`case-qa-${g.props.length}`,type:'container',kind,x,y,opened:false,indestructible:true,contents};g.props.push(c);return c;}
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy)data.version=13;const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid fixture ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
const basic=arena('basic');box(basic);await save('open-and-collect',basic);
const mixed=arena('mixed');box(mixed);box(mixed,10,9,[{type:'med',amount:1}],'medical');mixed.props.push({type:'terminal',id:'qa-terminal',x:10,y:11,used:false});mixed.items.push(mixed.registerWeapon({type:'weapon',weapon:2,x:10,y:10}));mixed.barriers.push(makeBarrier('door',mixed.player,{x:9,y:10},'edge-mixed'));await save('mixed-interactions',mixed);
const gate=arena('gate');const c=box(gate);gate.barriers.push(makeBarrier('door',gate.player,c,'edge-closed'));await save('closed-door',gate);
const cap=arena('capacity');box(cap,11,10,[{type:'ammo',amount:20},{type:'emp',amount:3}]);cap.player.reserve=cap.ammoCapacity('rifle')-1;cap.player.grenades=4;await save('capacity-overflow',cap);
const fallback=arena('fallback');box(fallback);const e=makeEnemy('rifleman',11,10,'qa-blocker');e.control.disabled=2;fallback.enemies=[e];fallback.hazards=[{x:11,y:9,type:'fire'},{x:12,y:10,type:'acid'},{x:11,y:11,type:'fire'}];await save('occupied-drop',fallback);
const blast=arena('blast');box(blast);Object.assign(blast.player,{hp:500,maxHp:500,grenades:2});await save('blast-proof',blast);
const old=arena('legacy');old.items=[{type:'ammo',amount:17,x:11,y:10},{type:'med',x:10,y:11}];await save('legacy-v13',old,true);
const natural=new Game(7);natural.runId='qa-containers-natural';await save('natural-seed-7',natural);
console.log('Eight isolated 3.17 fixtures generated; mobile and natural balance QA remain external.');
