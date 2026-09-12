// File-only fixtures. Import solely with ?test=1; never touch browser storage.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
import {MAP_RECIPES} from '../src/map-recipes-data.js';
import {generateWithRecipes} from '../src/world.js';
import {SLOT_RECIPES} from '../src/map-slots.js';
import {makeBarrier} from '../src/barriers.js';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
function save(name,g){if(!Game.restore(g.serialize()))throw new Error(`Invalid ${name}`);writeFileSync(new URL(`${name}.json`,out),g.serialize());console.log(`${name}: ${g.seed}/${g.floor}, ${g.generation?.recipeId??'hand-built'}`);}
for(const recipe of MAP_RECIPES){
  let found=false;for(let seed=1;seed<=100&&!found;seed++){
    class RecipeGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,[recipe]);}}
    const g=new RecipeGame(seed,[],0,'recon','onyx');g.floor=3;g.loadFloor();if(g.generation.recipeId!==recipe.id)continue;
    g.seen=g.grid.map(r=>r.map(()=>true));save(`recipe-${recipe.id}`,g);found=true;
  }if(!found)throw new Error(`No safe example for ${recipe.id}`);
}
const g=new Game(1,[],0,'soldier','onyx');for(const field of MAP_FIELDS)delete g[field];g.mapGenerations=[1];
g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x>0&&y>0&&x<26&&y<26?1:0));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
for(const k of ['props','items','enemies','hazards','marks','barriers','rooms','traces','smoke'])g[k]=[];
g.start={x:12,y:13};g.end={x:23,y:23};Object.assign(g.player,g.start);g.target=null;
function add(type,a,b){g.barriers.push(makeBarrier(type,{x:a[0],y:a[1]},{x:b[0],y:b[1]},`edge-qa-${g.barriers.length}`));}
for(const [x,y,arms]of [[9,10,2],[14,10,3],[9,15,4]]){
  add('partition',[x,y],[x+1,y]);add('low_partition',[x+1,y],[x+1,y+1]);
  if(arms>=3)add('partition',[x,y+1],[x+1,y+1]);if(arms===4)add('low_partition',[x,y],[x,y+1]);
}
add('partition',[14,14],[14,15]);add('door',[15,14],[15,15]);add('partition',[16,14],[16,15]);
add('partition',[17,11],[18,11]);add('door',[17,12],[18,12]);add('partition',[17,13],[18,13]);
g.reveal();save('recipe-barrier-joints',g);
for(const b of g.barriers)if(b.type==='door')b.open=true;g.reveal();save('recipe-open-doors',g);
class OldGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,SLOT_RECIPES);}}
const mixed=Game.restore(new OldGame(1,[],0,'recon','onyx','roundtrip').serialize());Object.assign(mixed.player,mixed.exitPoint);mixed.descend();save('recipe-mixed-return',mixed);
const deep=new Game(1,[],0,'recon','onyx','endless');deep.floor=60;deep.loadFloor();save('recipe-endless-60',deep);
