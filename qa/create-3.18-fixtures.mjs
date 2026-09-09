// Integrated map-group QA. Files only; import in ?test=1, never production storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,makeBarrier,DIRECTIONS} from '../src/engine.js';
import {MODULE_TYPES,FURNITURE,modulePoint,moduleCells} from '../src/modules.js';
const folder=new URL('./fixtures/3.18/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy)data.version=14;const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid fixture ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
for(const theme of Object.keys(MODULE_TYPES)){
  let g,m;for(let seed=1;seed<=12;seed++){g=new Game(seed);m=g.props.find(p=>p.type==='module'&&p.theme===theme);if(m)break;}
  if(!m)throw Error(`Missing theme ${theme}`);g.runId=`qa-modules-${theme}`;g.enemies=[];g.hazards=[];g.marks=[];Object.assign(g.player,modulePoint(m,0,1));g.player.scrap=100;await save(theme,g);
}
const combined=new Game(318);combined.runId='qa-map-group-combined';combined.barriers=[];combined.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));combined.props=[];combined.items=[];combined.enemies=[];combined.hazards=[];combined.marks=[];combined.smoke=[];combined.rooms=[];combined.end={x:20,y:20};Object.assign(combined.player,{x:11,y:10,hp:300,maxHp:300,scrap:100});
const m={id:'module-qa',type:'module',theme:'restroom',x:12,y:9,rotation:0,indestructible:true};combined.props.push(m,...MODULE_TYPES.restroom.furniture.map((style,n)=>({...modulePoint(m,n,0),id:`${m.id}-${n}`,type:'cover',style,moduleId:m.id,hp:FURNITURE[style].hp,maxHp:FURNITURE[style].hp})));
const cells=moduleCells(m);for(const a of cells)for(const [dx,dy]of DIRECTIONS){const b={x:a.x+dx,y:a.y+dy};if(cells.some(p=>p.x===b.x&&p.y===b.y))continue;combined.barriers.push(makeBarrier(a.x===12&&a.y===10&&dx===-1?'door':'partition',a,b,`edge-qa-${combined.barriers.length}`));}
combined.props.push({id:'case-qa',type:'container',kind:'medical',x:13,y:10,opened:false,indestructible:true,contents:[{type:'med',amount:1},{type:'ammo',amount:20}]},{id:'qa-terminal',type:'terminal',x:11,y:11,used:false});
const e=makeEnemy('rifleman',14,10,'qa-enemy');Object.assign(e,{alert:true,lastKnown:{x:11,y:10}});combined.enemies=[e];await save('combined-interactions',combined);
const stations=new Game(7);stations.runId='qa-map-group-stations';stations.enemies=[];const terminal=stations.props.find(p=>p.type==='terminal');Object.assign(stations.player,{x:terminal.x,y:terminal.y,scrap:100,reserve:0});await save('two-stations',stations);
const old=new Game(7);old.runId='qa-map-group-legacy';old.enemies=[];old.props=old.props.filter(p=>p.type!=='module'&&!p.moduleId&&p.type!=='terminal');old.barriers=old.barriers.filter(b=>!b.id.startsWith('edge-module-'));old.rooms.forEach((r,i)=>old.props.push({id:`1-console-${i}`,type:'terminal',x:r.x+r.w-1,y:r.y,used:i===0}));await save('legacy-v14',old,true);
const natural=new Game(7);natural.runId='qa-map-group-natural';await save('natural-seed-7',natural);
console.log('Seven integrated 3.18 fixtures generated. Door/container historical fixtures remain available.');
