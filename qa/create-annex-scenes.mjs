// File-only fixtures: import exclusively on ?test=1. Never writes live storage.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {generateWithRecipes,key} from '../src/world.js';
import {OPENING_RECIPES} from '../src/map-openings.js';
const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
const save=(name,g)=>{if(!Game.restore(g.serialize()))throw new Error(`Invalid scene ${name}`);writeFileSync(new URL(`${name}.json`,directory),g.serialize());console.log(`${name}: seed ${g.seed}, floor ${g.floor}, ${g.generation.recipeId}`);};
for(const type of ['platform','dock','balcony']){
  let found=false;
  for(let seed=1;seed<=100&&!found;seed++){
    const g=new Game(seed,[],0,'recon','onyx');const a=g.annexes.find(a=>a.type===type);if(!a)continue;
    const gate=a.openings.find(gate=>![...g.enemies,...g.props,...g.hazards].some(p=>key(p)===key(gate.inside)));if(!gate)continue;
    Object.assign(g.player,gate.inside);g.seen=g.grid.map(row=>row.map(()=>true));g.reveal();save(`annex-${type}`,g);found=true;
  }
  if(!found)throw new Error(`Missing ${type} scene`);
}
for(const [name,floor,mission]of [['annex-sweep',6,'sweep'],['annex-archive',6,'archive'],['annex-endless-60',60,'endless']]){
  const g=new Game(1,[],0,'recon','onyx',mission);g.floor=floor;g.loadFloor();save(name,g);
}
class PhaseThreeGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,OPENING_RECIPES);}}
const g=Game.restore(new PhaseThreeGame(1,[],0,'recon','onyx','roundtrip').serialize());Object.assign(g.player,g.exitPoint);g.descend();save('annex-mixed-return',g);
