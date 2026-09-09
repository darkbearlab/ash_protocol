// Artificial, QA-only scenes. Import the full backup only into ?test=1.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE} from '../src/engine.js';
import {AMMUNITION} from '../src/ammunition.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup} from '../src/backup.js';
const folder=new URL('./fixtures/3.7/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){const g=new Game(51);g.runId=`qa-ammo-${name}-${Date.now()}`;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,scrap:100,owned:[0,1,2]});g.player.ammo[2]=18;g.enemies=[];g.items=[];g.hazards=[];g.marks=[];g.rooms=[];g.props=[{id:'terminal',type:'terminal',x:11,y:10,used:false}];g.end={x:20,y:20};g.reveal();return g;}
async function save(name,value){await writeFile(new URL(name,folder),typeof value==='string'?value:JSON.stringify(value,null,2));}
const full=arena('caps');for(const [type,info]of Object.entries(AMMUNITION)){full.player[info.key]=full.ammoCapacity(type)-1;full.items.push({x:10,y:11,type:info.item,amount:5});}await save('partial-pickups.json',full.serialize());
const gear=arena('gear'),p=normalizeProfile();p.protocol={balance:200,earned:200};await save('carrying-backup.json',makeBackup(gear,p,'qa'));
const old=arena('legacy');old.player.reserve=301;old.player.energy=80;old.player.ordnance=20;old.player.grenades=9;old.items=[{x:10,y:10,type:'ammo',amount:47}];const legacy=JSON.parse(old.serialize());legacy.version=3;delete legacy.data.player.pistol;delete legacy.data.player.shell;delete legacy.data.carryLevel;await save('legacy-v3.json',legacy);
console.log('Created qa/fixtures/3.7/: two campaign files and one QA-only full backup with artificial points.');
