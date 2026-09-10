// Run locally, then import JSON into ?test=1 only. Never writes browser storage.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {fullLighting} from '../src/lighting.js';
import {grantTrait} from '../src/traits.js';
import {areaCells} from '../src/throwables.js';
const folder=new URL('./fixtures/3.24/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(character='soldier'){
  const g=new Game(324,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=fullLighting(g.grid);g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.enemies=[];g.smoke=[];g.marks=[];g.rooms=[];g.traces=[];
  Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,emp:1,stun:1,smoke:1,grenades:0});g.end={x:20,y:20};
  for(let y=8;y<=13;y++)for(let x=12;x<=16;x++)g.lighting[y][x]=0;return g;
}
function add(g,type='rifleman',x=14,y=10){const e=makeEnemy(type,x,y,'qa-sense-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;}
async function save(name,g){g.runId='qa-senses-'+name;g.reveal();const raw=g.serialize();if(!Game.restore(raw))throw Error('Invalid fixture '+name);await writeFile(new URL(name+'.json',folder),raw);}
for(const character of ['soldier','recon']){const g=arena(character);add(g);await save('dark-'+character,g);g.smoke=[{cells:areaCells(g.grid,{x:12,y:10}),expires:g.turn+2}];for(const e of g.enemies){e.alert=false;e.lastKnown=null;}await save('smoke-'+character,g);}
const one=arena();grantTrait(one.player,'infrared','qa');add(one);one.smoke=[{cells:areaCells(one.grid,{x:12,y:10}),expires:3}];await save('infrared-only',one);
const enemy=arena();add(enemy,'warden');enemy.smoke=[{cells:areaCells(enemy.grid,{x:12,y:10}),expires:3}];await save('enemy-infrared',enemy);
const stun=arena('recon');add(stun,'warden',12,10);add(stun,'drone',12,11);const night=add(stun,'drone',11,12);grantTrait(night,'night_vision','qa');stun.player.prepared.grenade='stun';await save('stun-sensors',stun);
await save('natural-soldier',new Game(324,[],0,'soldier','onyx'));await save('natural-recon',new Game(324,[],0,'recon','onyx'));
const legacy=JSON.parse(arena('recon').serialize());legacy.version=17;legacy.data.runId='qa-senses-legacy';delete legacy.data.lighting;legacy.data.player.traits=legacy.data.player.traits.filter(t=>!['night_vision','infrared'].includes(t.id));if(!Game.restore(JSON.stringify(legacy)))throw Error('Invalid legacy fixture');await writeFile(new URL('legacy-recon-v17.json',folder),JSON.stringify(legacy));
console.log('Ten 3.24 fixtures generated; HP 999/500 arenas are not difficulty evidence.');
