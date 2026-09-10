// Artificial QA scenes, import only in ?test=1; never reset the real campaign.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {addAlly} from '../src/allies.js';
import {makeBarrier} from '../src/barriers.js';
const folder=new URL('./fixtures/3.31/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(){const g=new Game(331,[],0,'engineer','onyx','roundtrip');g.grid=Array.from({length:SIZE},(_,y)=>Array.from({length:SIZE},(_,x)=>x>5&&x<23&&y>5&&y<22?1:0));g.lighting=g.grid.map(r=>r.map(()=>1));g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];g.allySerial=0;Object.assign(g.player,{x:10,y:10,scrap:40});g.start={x:7,y:7};g.end={x:21,y:20};const a=addAlly(g,'drone','drone',{sourceId:'drone_follow',point:{x:11,y:10}});a.ammo=3;g.damageAlly(a,999);g.effects=[];return g;}
async function save(name,g,legacy=false){g.runId='qa-repair-'+name;g.reveal();const data=JSON.parse(g.serialize());if(legacy)data.version=23;const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
const g=arena();await save('wreck-adjacent',g);await save('legacy-v23-wreck',g,true);
g.barriers=[makeBarrier('door',g.player,g.allies[0],'edge-qa-repair-door')];await save('wreck-behind-door',g);g.barriers=[];
g.action('skill','drone_follow');await save('packed-wreck',g);g.player.scrap=9;await save('insufficient-scrap',g);g.player.scrap=40;
g.action('repairDrone',g.allies[0].id);await save('packed-damaged',g);g.action('repairDrone',g.allies[0].id);await save('packed-full',g);
console.log('Seven 3.31 repair fixtures generated and restore-validated.');
