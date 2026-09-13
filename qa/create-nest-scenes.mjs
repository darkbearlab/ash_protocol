// Files only; import with ?test=1, never into a real campaign.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
import {nestStyle} from '../src/runtime-enemies.js';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const x of [12,13]){
 const g=new Game(3);clearGeneratedMap(g);g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
 Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};
 const n={id:'nest-1-0',type:'nest',x,y:10,hp:45,maxHp:45,nest:{active:false,total:1,remaining:1,serial:0,cooldown:0,interval:2}};g.props.push(n);g.target=n.id;g.reveal();
 const raw=g.serialize();if(!Game.restore(raw))throw new Error('Invalid fixture');const name=`nest-${nestStyle(n)}-last-spawn.json`;writeFileSync(new URL(name,out),raw);console.log(name);
}
