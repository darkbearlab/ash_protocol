// File-only: import these scenes exclusively through ?test=1.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {generateWithRecipes,reachable,key,distance} from '../src/world.js';
import {ANNEX_RECIPES} from '../src/map-annexes.js';
import {moduleCells} from '../src/modules.js';
const directory=new URL('./fixtures/',import.meta.url);mkdirSync(directory,{recursive:true});
const save=(name,g)=>{if(!Game.restore(g.serialize()))throw new Error(`Invalid scene ${name}`);writeFileSync(new URL(`${name}.json`,directory),g.serialize());console.log(`${name}: seed ${g.seed}, floor ${g.floor}, ${g.generation.recipeId}`);};
for(const theme of ['office','warehouse','garage','hangar']){
  let found=false;
  for(let seed=1;seed<=100&&!found;seed++){
    const g=new Game(seed,[],0,'recon','onyx'),m=g.props.find(p=>p.type==='module'&&p.theme===theme);if(!m)continue;
    const center=moduleCells(m)[Math.floor(moduleCells(m).length/2)],spots=[...reachable(g,g.start)].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};}).filter(p=>![...g.props,...g.enemies,...g.hazards].some(q=>key(q)===key(p))).sort((a,b)=>distance(a,center)-distance(b,center));
    Object.assign(g.player,spots[0]);g.seen=g.grid.map(r=>r.map(()=>true));g.reveal();g.target=g.props.find(p=>p.moduleId===m.id&&p.hp>0&&g.visible(p))?.id??g.target;save(`furnished-${theme}`,g);found=true;
  }
  if(!found)throw new Error(`Missing ${theme}`);
}
for(const [name,floor,mission]of [['furnished-sweep',6,'sweep'],['furnished-archive',6,'archive'],['furnished-endless-60',60,'endless']]){
  const g=new Game(2,[],0,'recon','onyx',mission);g.floor=floor;g.loadFloor();save(name,g);
}
class OldGame extends Game{generateFloor(){return generateWithRecipes(this.seed,this.floor,this.unlockedWeapons,ANNEX_RECIPES);}}
const g=Game.restore(new OldGame(2,[],0,'recon','onyx','roundtrip').serialize());Object.assign(g.player,g.exitPoint);g.descend();save('furnished-mixed-return',g);
