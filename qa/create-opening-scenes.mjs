// File-only QA setup. Import on ?test=1; never writes browser/live storage.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {generateWithRecipes,reachable,key} from '../src/world.js';
import {MERGED_RECIPES} from '../src/map-merging.js';
import {OPENING_RECIPES} from '../src/map-openings.js';
import {edgeCells} from '../src/barriers.js';
const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
const save=(name,g)=>{if(!Game.restore(g.serialize()))throw new Error(`Invalid scene ${name}`);writeFileSync(new URL(`${name}.json`,directory),g.serialize());console.log(`${name}: seed ${g.seed}, floor ${g.floor}, ${g.generation.recipeId}`);};
function inspect(g){
  const door=g.barriers.find(b=>b.id.startsWith('edge-opening-')),seen=reachable(g,g.start);
  if(door){const spots=[...edgeCells(door),...g.openings.find(o=>o.barrierIds.includes(door.id)).path];const p=spots.find(p=>seen.has(key(p))&&![...g.enemies,...g.props,...g.hazards].some(q=>key(q)===key(p)));if(p)Object.assign(g.player,p);g.target=door.id;}
  // Terrain overview is intentional in these QA scenes; enemies retain real LOS.
  g.seen=g.grid.map(row=>row.map(()=>true));g.reveal();return g;
}
for(const recipe of OPENING_RECIPES){
  class RecipeGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,[recipe]);}}
  save(`openings-${recipe.id.split('-')[0]}`,inspect(new RecipeGame(6,[],0,'recon','onyx')));
}
let triple;
for(let seed=1;seed<=100&&!triple;seed++)for(const floor of [1,3,6]){
  const g=new Game(seed,[],0,'recon','onyx');if(floor!==1){g.floor=floor;g.loadFloor();}
  if(g.generation.version>=4&&g.links.some(link=>g.openings.filter(o=>link.every(id=>o.rooms.includes(id))).length===3)){triple=g;break;}
}
if(!triple)throw new Error('Missing triple-opening scene');save('openings-triple',inspect(triple));
for(const [name,floor,mission]of [['openings-sweep',6,'sweep'],['openings-archive',6,'archive'],['openings-endless-60',60,'endless']]){
  const g=new Game(1,[],0,'recon','onyx',mission);g.floor=floor;g.loadFloor();save(name,g);
}
class PhaseTwoGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,MERGED_RECIPES);}}
const g=Game.restore(new PhaseTwoGame(1,[],0,'recon','onyx','roundtrip').serialize());Object.assign(g.player,g.exitPoint);g.descend();save('openings-mixed-return',g);
