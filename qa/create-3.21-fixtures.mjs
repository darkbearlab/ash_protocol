// Import into ?test=1 only. Does not access browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
const folder=new URL('./fixtures/3.21/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){const g=new Game(321);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.props=[];g.barriers=[];g.enemies=[];g.items=[];g.hazards=[];g.smoke=[];g.marks=[];g.rooms=[];g.traces=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999});g.end={x:20,y:20};return g;}
async function save(name,g){g.runId='qa-wall-'+name;g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
const gallery=arena();for(let x=7;x<=13;x++)gallery.grid[7][x]=0;for(let y=8;y<=12;y++)gallery.grid[y][7]=0;for(let x=8;x<=12;x++)gallery.grid[12][x]=0;gallery.grid[9][13]=0;gallery.grid[10][13]=0;gallery.grid[10][14]=0;gallery.grid[11][13]=0;
gallery.rooms=[{x:8,y:8,w:5,h:4,cx:10,cy:10,visualTheme:'industrial',wallStyle:{face:'access',cap:'bolted'}}];
gallery.items=[{x:10,y:11,type:'med',amount:1}];gallery.props=[{id:'case-wall',type:'container',kind:'medical',x:9,y:11,opened:false,contents:[{type:'med',amount:1}],indestructible:true},{id:'cover-wall',type:'cover',x:8,y:8,hp:65,maxHp:65}];gallery.enemies=[makeEnemy('rifleman',11,11,'qa-wall-enemy',1)];gallery.barriers=[makeBarrier('door',{x:12,y:8},{x:13,y:8},'edge-wall-door')];await save('wall-gallery',gallery);
const other=Game.restore(gallery.serialize());other.rooms[0].wallStyle={face:'hazard',cap:'concrete'};await save('wall-alternate',other);
await save('natural-321',new Game(321));await save('natural-790',new Game(790));
console.log('Four 3.21 fixtures generated; gallery HP 999 is not balance evidence.');
