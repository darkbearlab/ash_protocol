// File-only QA. Import exclusively through ?test=1.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
import {makeEnemy} from '../src/world.js';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const affix of [null,'longbarrel']){
  const g=new Game(1,[],0,'recon');for(const field of MAP_FIELDS)delete g[field];g.mapGenerations=[1];
  g.grid=Array.from({length:27},()=>Array(27).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
  for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms'])g[k]=[];
  Object.assign(g.player,{x:10,y:10});g.player.affixes[2]=affix;
  g.enemies=[{x:15,y:10},{x:15,y:11},{x:15,y:12},{x:15,y:13},{x:15,y:14}].map((p,i)=>{const e=makeEnemy('rifleman',p.x,p.y,`range-${5+i}`);e.hp=e.maxHp=999;e.control.disabled=4;return e;});
  g.target='range-6';g.reveal();if(!Game.restore(g.serialize()))throw new Error('Invalid fixture');
  const name=`recon-burst-${affix||'standard'}`;writeFileSync(new URL(name+'.json',out),g.serialize());console.log(name);
  if(!affix){const raw=JSON.parse(g.serialize());raw.data.player.traits=raw.data.player.traits.filter(t=>t.id!=='extended_burst');writeFileSync(new URL('recon-burst-old-save.json',out),JSON.stringify(raw));}
}
