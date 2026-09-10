// Generates importable QA saves only; never accesses browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
const folder=new URL('./fixtures/3.25/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g,version){g.runId='qa-class-'+name;g.reveal();const parsed=JSON.parse(g.serialize());if(version)parsed.version=version;const raw=JSON.stringify(parsed);if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
for(const id of ['soldier','recon','bulwark'])await save('natural-'+id,new Game(325,[],0,id,'onyx'));
function arena(id){const g=new Game(325,[],0,id,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());for(const key of ['barriers','props','items','hazards','marks','enemies','smoke','rooms','traces'])g[key]=[];Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};return g;}
for(const id of ['soldier','recon']){const g=arena(id),e=makeEnemy('rifleman',14,10,'qa-class-target');e.hp=e.maxHp=500;g.enemies=[e];g.target=e.id;await save('bright-'+id,g);}
const melee=arena('bulwark'),e=makeEnemy('rifleman',11,10,'qa-melee-target');e.hp=e.maxHp=500;e.combatModifiers={meleeEvasion:20};melee.enemies=[e];melee.player.weapon=7;melee.target=e.id;await save('melee-hooks',melee);
const capacity=arena('recon');capacity.player.grenades=2;capacity.items=[{type:'emp',x:10,y:10,amount:3}];capacity.props=[{type:'terminal',x:11,y:10,used:false}];capacity.player.scrap=100;await save('recon-full',capacity);
const legacy=arena('recon');Object.assign(legacy.player,{hp:63,maxHp:125,armor:3,grenades:1,smoke:0,emp:1,meds:1});legacy.player.prepared.grenade='emp';await save('legacy-recon-v18',legacy,18);
console.log('Eight 3.25 fixtures generated. Combat arenas have artificial enemy HP 500; natural starters retain normal supplies and health.');
