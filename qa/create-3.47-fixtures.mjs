// Isolated rule fixtures; import only through ?test=1. No browser storage access.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,makeBarrier} from '../src/engine.js';
const folder=new URL('./fixtures/3.47/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(character){const g=new Game(3470,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});return g;}
function enemy(g,type,x,y){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);g.enemies.push(e);g.target=e.id;return e;}
async function save(name,g,legacy=false){g.runId='qa-melee-'+name;g.reveal();const v=JSON.parse(g.serialize());if(legacy){v.version=28;delete v.data.player.battleSpirit;}const raw=JSON.stringify(v);if(!Game.restore(raw))throw Error(name);await writeFile(new URL(name+'.json',folder),raw);}
for(const c of ['berserker','ninja'])await save('natural-'+c,new Game(3470,[],0,c,'onyx'));
const pull=arena('berserker');enemy(pull,'rifleman',12,12);pull.player.hp=70;await save('grapple-pull',pull);
const dash=arena('berserker');enemy(dash,'warden',13,10);dash.hazards=[{x:12,y:10,type:'heat'}];await save('grapple-dash',dash);
const block=arena('berserker');enemy(block,'rifleman',13,10);for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])block.barriers.push(makeBarrier('partition',block.player,{x:10+dx,y:10+dy},'edge-'+dx+'-'+dy));await save('grapple-blocked',block);
const spirit=arena('berserker');spirit.turn=10;spirit.player.battleSpirit={stacks:5,lastKill:6};await save('spirit-decay',spirit);
const camo=arena('ninja');enemy(camo,'rifleman',12,10);camo.player.skillState.camouflage={remaining:1,cooldown:0};await save('camo-final-turn',camo);
const ambush=arena('ninja');enemy(ambush,'rifleman',11,10);ambush.lighting[10][10]=0;ambush.player.skillState.camouflage={remaining:0,cooldown:7};await save('ambush-dark',ambush);
await save('legacy-v28',new Game(3470),true);
console.log('Nine 3.47 fixtures generated and restored. UI/normal balance remain external.');
