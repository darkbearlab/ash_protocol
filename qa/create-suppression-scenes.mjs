// Import only through ?test=1. Raw saves are ignored; this generator is versioned.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {makeEnemy} from '../src/world.js';
import {LEARNING_ITEMS} from '../src/learning-data.js';
import {grantTrait} from '../src/traits.js';
import {PET_FEEDING_TUNING,fitPet,petCapacity} from '../src/pet-growth.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const scene of ['manuals','corner','rapid','pet-lock','legacy-v36','loot-melee','pinned']){
 const g=new Game(374,[],0,scene==='pet-lock'?'druid':'soldier','onyx');
 g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x>0&&x<26&&y>0&&y<26?1:0));
 for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies'])g[k]=[];clearGeneratedMap(g);g.start={x:2,y:2};g.end={x:23,y:23};Object.assign(g.player,{x:12,y:11});g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 g.player.learningItems=Object.fromEntries(Object.keys(LEARNING_ITEMS).map(id=>[id,2]));
 g.action('learn','skill_suppressive_fire');g.action('prepare',{category:'skill',id:'suppressive_fire'});
 const enemy=(x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,`scene-${g.enemies.length}`,1);e.maxHp=e.hp=400;g.enemies.push(e);return e;};
 if(scene==='corner'){for(let y=1;y<=10;y++){g.grid[y][10]=0;g.lighting[y][10]=0;}enemy(9,10);enemy(9,11);}
 if(scene==='rapid'){g.action('learn','trait_rapid_fire');g.player.owned=[2,1];g.player.weapon=2;g.player.ammo[2]=18;enemy(15,11);}
 if(scene==='pet-lock'){Object.assign(g.allies[0],{x:12,y:12});g.player.petBond.growth.turret=PET_FEEDING_TUNING.thresholds.turret[2];g.player.petBond.fuel=petCapacity(g.player);fitPet(g,g.allies[0]);g.player.owned=[6,1];g.player.weapon=6;g.player.ammo[6]=30;enemy(16,12);}
 if(scene==='manuals')g.props.push({id:'case-qa-manual',type:'container',kind:'unknown',x:13,y:11,opened:false,indestructible:true,contents:[{type:'learning',learningId:'trait_rapid_fire'}]});
 if(scene==='loot-melee')for(const [i,base] of [11,12].entries())g.items.push(g.registerWeapon({x:13+i,y:11,type:'weapon',weapon:base},true));
 if(scene==='pinned'){g.player.suppression=3;enemy(13,11);}
 if(scene==='legacy-v36')enemy(16,11).petSuppressed=15;
 g.reveal();g.target=g.enemies[0]?.id||null;const raw=JSON.parse(g.serialize());
 if(scene==='legacy-v36'){raw.version=36;delete raw.data.player.learningItems;}
 const text=JSON.stringify(raw);if(!Game.restore(text))throw new Error(`Invalid scene: ${scene}`);
 writeFileSync(new URL(`suppression-${scene}.json`,out),text);console.log(scene);
}
