// Files only. Import exclusively with ?test=1.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {makeEnemy,distance} from '../src/world.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
import {tickNests,RUNTIME_TUNING} from '../src/runtime-enemies.js';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
function save(name,g){if(!Game.restore(g.serialize()))throw new Error('Invalid '+name);writeFileSync(new URL(name+'.json',out),g.serialize());console.log(name);}
function arena(){const g=new Game(3);for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];Object.assign(g.player,{x:10,y:10});g.reveal();return g;}
function nest(g){const n={id:'nest-1-0',type:'nest',x:13,y:10,hp:45,maxHp:45,nest:{active:false,total:6,interval:2,remaining:6,cooldown:0,serial:0}};g.props.push(n);return n;}
const melee=arena();melee.enemies=[makeEnemy('fodder',11,10,'qa-fodder'),makeEnemy('fodder',10,11,'qa-fodder-2'),makeEnemy('rifleman',14,10,'qa-rifleman')];melee.enemies[2].control.disabled=4;melee.target=melee.enemies[0].id;melee.reveal();save('runtime-melee-chain',melee);
const nests=arena();nest(nests);nests.reveal();save('runtime-nest',nests);
const cap=arena();nest(cap);for(let i=0;i<RUNTIME_TUNING.liveLimit;i++){const e=makeEnemy('rifleman',1+i%8,1+Math.floor(i/8),'qa-cap-'+i);e.hp=1;e.control.disabled=4;cap.enemies.push(e);}cap.reveal();save('runtime-cap',cap);
const trip=new Game(1,[],0,'soldier','onyx','roundtrip');Object.assign(trip.player,trip.exitPoint);trip.descend(false);const home=trip.props.find(p=>p.type==='nest');
const near=trip.grid.flatMap((r,y)=>r.map((v,x)=>({x,y}))).find(p=>trip.passable(p.x,p.y)&&distance(p,home)<=5&&!trip.enemies.some(e=>e.hp>0&&distance(p,e)===0));Object.assign(trip.player,near);tickNests(trip);Object.assign(trip.player,trip.exitPoint);trip.descend(false);trip.enemies.forEach(e=>e.hp=0);Object.assign(trip.player,trip.mission.targets[0]);trip.recoverObjective(trip.mission.targets[0].id);trip.reveal();save('runtime-return',trip);
