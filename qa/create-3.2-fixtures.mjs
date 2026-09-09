// Optional fixtures for the external verifier. Import ONLY with ?test=1.
// Does not open a browser or access localStorage. Generated JSON stays local.
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const output=new URL('./fixtures/3.2/',import.meta.url);
await mkdir(output,{recursive:true});
function arena(){const g=new Game(320);g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>Number(x>0&&y>0&&x<SIZE-1&&y<SIZE-1)));g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];Object.assign(g.player,{x:10,y:10,hp:70,meds:0});g.start={x:10,y:10};g.end={x:20,y:20};return g;}
async function save(name,g){g.reveal();await writeFile(new URL(name,output),g.serialize());}
const supplies=arena();supplies.items=[{x:11,y:10,type:'ammo',amount:20,cache:true},{x:12,y:10,type:'energy',amount:12,cache:true},{x:13,y:10,type:'ordnance',amount:3,cache:true},{x:10,y:11,type:'med',cache:true},{x:9,y:10,type:'armor',amount:20,cache:true},{x:10,y:9,type:'weapon',weapon:2},{x:10,y:9,type:'weapon',weapon:3}];supplies.props=[{id:'qa-terminal',type:'terminal',x:11,y:9,used:false}];await save('supplies.json',supplies);
const milestones=arena();milestones.items=[{x:11,y:10,type:'lore',floor:1}];milestones.end={x:12,y:10};await save('milestones.json',milestones);
const death=arena();death.player.hp=1;death.player.plates=0;death.hazards=[{x:11,y:10,type:'fire'}];death.items=[{x:10,y:11,type:'lore',floor:1}];await save('death.json',death);
const drops=arena();drops.floor=3;drops.enemies=[makeEnemy('warden',13,10,'qa-warden',3)];drops.enemies[0].hp=1;await save('warden-drop.json',drops);
console.log(`QA-only fixtures created: ${fileURLToPath(output)}. Import using ?test=1; never the real campaign.`);
