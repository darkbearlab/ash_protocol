// Synthetic campaigns for external QA. Import only through ?test=1.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,random} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
const folder=new URL('./fixtures/3.10/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name){const g=new Game(3100);g.runId=`qa-traits-${name}-${Date.now()}`;g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,hp:300,maxHp:300});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};g.rng=random(0);return g;}
function add(g,type,id,x,y,trait){const e=makeEnemy(type,x,y,id);e.hp=e.maxHp=100;e.alert=true;e.charge=true;e.windup=1;if(trait)grantTrait(e,trait,'qa:fixture');g.enemies.push(e);return e;}
async function save(name,g){g.reveal();if(!Game.restore(g.serialize()))throw Error(`Invalid ${name}`);await writeFile(new URL(`${name}.json`,folder),g.serialize());}
for(const speed of ['normal','fast','slow']){
  const g=arena(speed);if(speed!=='normal')grantTrait(g.player,speed,'qa:player');
  add(g,'gunner','fast',14,10,'fast');add(g,'gunner','normal',10,14);add(g,'gunner','slow',6,10,'slow');g.target='fast';await save(`order-${speed}`,g);
}
const flee=arena('flee');flee.player.weapon=1;const runner=add(flee,'rifleman','flee',14,10,'fast');runner.charge=false;flee.props=[{id:'cover',type:'cover',x:13,y:9,hp:65,maxHp:65}];flee.target=runner.id;await save('flee-range',flee);
const traits=arena('traits');add(traits,'drone','drone',14,10);traits.props=[{id:'cover',type:'cover',x:13,y:10,hp:65,maxHp:65}];add(traits,'brute','large',10,14);const small=add(traits,'crawler','small',6,10,'small');grantTrait(small,'agile','qa:fixture');small.moved=true;grantTrait(traits.player,'clumsy','qa:player');traits.target='drone';await save('passives',traits);
const cancel=arena('cancel');grantTrait(cancel.player,'fast','qa:character');grantTrait(cancel.player,'slow','qa:temporary',1);add(cancel,'gunner','fast',14,10,'fast');cancel.target='fast';await save('cancel-expire',cancel);
console.log('Created six QA-only campaigns in qa/fixtures/3.10/.');
