// Files only. Import them on ?test=1; never touches browser or live save storage.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {generateWithRecipes,PHASE_ONE_RECIPES,reachable,key} from '../src/world.js';
import {roomContains} from '../src/map-geometry.js';
const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
const save=(name,g)=>{if(!Game.restore(g.serialize()))throw new Error(`Invalid scene: ${name}`);writeFileSync(new URL(`${name}.json`,directory),g.serialize());console.log(`${name}.json: seed ${g.seed}, floor ${g.floor}, ${g.generation.recipeId}`);};
const found=new Set();
for(let seed=1;seed<=100&&found.size<3;seed++){
  const g=new Game(seed,[],0,'recon','onyx'),hall=g.rooms.find(r=>r.cellIds?.length>1);if(!hall)continue;
  const shape=hall.cellIds.length===4?'hangar':hall.w>hall.h?'horizontal':'vertical';if(found.has(shape))continue;found.add(shape);
  const seen=reachable(g,g.start),spot=hall.footprint.find(p=>seen.has(key(p))&&!g.enemies.some(e=>key(e)===key(p))&&!g.props.some(o=>key(o)===key(p))&&!g.hazards.some(o=>key(o)===key(p)));
  Object.assign(g.player,spot);g.reveal();save(`merged-${shape}`,g);
  if(!g.enemies.some(e=>roomContains(hall,e)))throw new Error('Hall has no enemy population');
}
if(found.size!==3)throw new Error('Missing geometry variant');
for(const [name,floor,mission]of [['merged-sweep',6,'sweep'],['merged-archive',6,'archive'],['merged-endless-60',60,'endless']]){
  const g=new Game(2,[],0,'recon','onyx',mission);g.floor=floor;g.loadFloor();save(name,g);
}
class PhaseOneGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,PHASE_ONE_RECIPES);}}
const g=Game.restore(new PhaseOneGame(2,[],0,'recon','onyx','roundtrip').serialize());
Object.assign(g.player,g.exitPoint);g.descend();save('merged-mixed-return',g);
