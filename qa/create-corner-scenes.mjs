import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {makeEnemy} from '../src/world.js';
import {addAlly} from '../src/allies.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
import {recordExposure} from '../src/corner.js';
function arena(character='soldier'){
 const g=new Game(17,[],0,character);clearGeneratedMap(g);g.turn=2;
 g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x&&y&&x<26&&y<26?1:0));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
 g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));g.start={x:2,y:2};g.end={x:23,y:23};Object.assign(g.player,{x:9,y:10});return g;
}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'qa-'+g.enemies.length,g.floor);g.enemies.push(e);return e;};
function save(name,g){g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw new Error(name+' failed restore');writeFileSync('qa/fixtures/'+name+'.json',raw);console.log(name);}
mkdirSync('qa/fixtures',{recursive:true});
const quiet=arena();for(let y=1;y<=10;y++)quiet.grid[y][10]=0;
const q=enemy(quiet,12,11);q.charge=true;q.windup=1;quiet.target=q.id;save('corner-first-shot',quiet);
const hidden=arena();for(let y=1;y<=10;y++)hidden.grid[y][10]=0;Object.assign(hidden.player,{x:12,y:11});
const h=enemy(hidden,9,10);hidden.target=h.id;save('corner-hidden-enemy',hidden);
recordExposure(hidden,h,hidden.player);save('corner-exposed-enemy',hidden);
const summons=arena('necromancer');for(let y=1;y<26;y++)summons.grid[y][10]=0;summons.grid[8][10]=1;summons.grid[14][10]=1;Object.assign(summons.player,{x:9,y:11});
addAlly(summons,'summon','rifleman',{sourceId:'raise_dead',point:{x:10,y:8}});
addAlly(summons,'summon','crawler',{sourceId:'raise_dead',point:{x:9,y:8}});
for(const a of summons.allies)a.bornTurn=1;
enemy(summons,11,8,'brute');save('corner-summon-detour',summons);
const crowd=arena();for(let y=1;y<=10;y++)crowd.grid[y][10]=0;
for(const [x,y] of [[12,11],[12,12],[13,11],[13,12]])enemy(crowd,x,y);
save('corner-enemy-flank',crowd);
