// Generate files only; import through ?test=1, never the real campaign.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {makeEnemy} from '../src/world.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const full of [false,true]){
 const g=new Game(17,[],0,'recon');for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];
 g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms'])g[k]=[];
 Object.assign(g.player,{x:10,y:10,xp:2,grenades:full?2:0});const e=makeEnemy('rifleman',12,10,'supply-qa');e.hp=1;e.control.disabled=4;g.enemies=[e];g.target=e.id;g.reveal();
 if(!Game.restore(g.serialize()))throw new Error('Invalid fixture');
 writeFileSync(new URL(`recon-supply-${full?'full':'space'}.json`,out),g.serialize());
}
