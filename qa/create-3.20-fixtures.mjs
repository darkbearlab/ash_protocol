// Import only into ?test=1. Generates files, never writes browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {makeBarrier} from '../src/barriers.js';
import {FURNITURE,modulePoint} from '../src/modules.js';
import {addTrace,TRACE_KINDS} from '../src/traces.js';
const folder=new URL('./fixtures/3.20/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g,legacy=false){g.runId=`qa-art-${name}`;g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=16;delete data.data.traces;}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid fixture: ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
function arena(){const g=new Game(320,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.barriers=[];g.props=[];g.items=[];g.enemies=[];g.hazards=[];g.marks=[];g.smoke=[];g.rooms=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,scrap:100});g.end={x:22,y:22};return g;}
const gallery=arena();
for(const [i,theme]of ['restroom','checkpoint'].entries()){
  const m={id:`module-gallery-${i}`,type:'module',theme,x:8+i*3,y:7,rotation:i,indestructible:true};gallery.props.push(m);
  for(const [n,style]of [['toilet','sink'],['counter','scanner'],['locker','bench']][i].entries())gallery.props.push({...modulePoint(m,n,0),id:`${m.id}-${n}`,type:'cover',style,moduleId:m.id,hp:FURNITURE[style].hp,maxHp:FURNITURE[style].hp});
}
gallery.props.push({id:'cover-gallery',type:'cover',x:8,y:11,hp:65,maxHp:65},{id:'barrel-gallery',type:'barrel',x:10,y:12,hp:18,maxHp:18},{id:'terminal-gallery',type:'terminal',x:12,y:11,used:false},{id:'case-gallery',type:'container',kind:'medical',x:9,y:10,opened:false,contents:[{type:'med',amount:1}],indestructible:true});
gallery.barriers=[makeBarrier('door',{x:10,y:10},{x:11,y:10},'edge-door-gallery'),makeBarrier('partition',{x:13,y:10},{x:13,y:11},'edge-partition-gallery')];await save('terrain-gallery',gallery);
const guard=Game.restore(gallery.serialize()),m=guard.props.find(p=>p.type==='module'&&p.theme==='checkpoint');m.theme='guardpost';m.rotation=3;
for(const [n,style]of ['locker','bench'].entries()){const p=guard.props.find(p=>p.id===m.id+'-'+n);Object.assign(p,modulePoint(m,n,0),{style,hp:FURNITURE[style].hp,maxHp:FURNITURE[style].hp});}
await save('terrain-guardpost',guard);
const stains=arena();for(const [i,kind]of TRACE_KINDS.entries())addTrace(stains,{x:8+i%4,y:9+Math.floor(i/4)*3},kind);stains.items=[{x:10,y:9,type:'med'}];stains.hazards=[{x:8,y:12,type:'fire'}];await save('trace-gallery',stains);
const battle=arena();battle.enemies=[makeEnemy('rifleman',12,10,'qa-bio',1),makeEnemy('drone',13,12,'qa-mech',1)];battle.enemies[0].hp=1;battle.props=[{id:'cover-shot',type:'cover',x:10,y:12,hp:5,maxHp:65}];battle.player.xp=2;await save('shot-impact-traces',battle);
const saved=arena();for(const kind of TRACE_KINDS)addTrace(saved,{x:10+TRACE_KINDS.indexOf(kind)%3,y:10},kind);await save('saved-traces',saved);await save('legacy-v16',saved,true);
const natural=new Game(320,[],0,'soldier','onyx','archive');await save('natural-archive',natural);
console.log('Seven 3.20 fixtures generated. Artificial HP 999 in galleries is not balance evidence.');
