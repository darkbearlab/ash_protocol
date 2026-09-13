// Generate isolated QA saves only; import through ?test=1. UI wiring belongs to Claude.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {fitPet,petCapacity} from '../src/pet-growth.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const scene of ['feeding','turret','extrusion','reforming','legacy-packed','legacy-down']){
 const g=new Game(372,[],0,'druid','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10,plates:30,meds:6});Object.assign(g.allies[0],{x:11,y:10,hp:30});g.start={x:5,y:5};g.end={x:20,y:20};const b=g.player.petBond,a=g.allies[0];
 if(scene==='turret'){b.growth.turret=120;b.fuel=petCapacity(g.player);}
 if(scene==='extrusion'){b.growth.extrusion=6;b.fedThrowables.smoke=6;b.outputRemaining=1;b.fuel=petCapacity(g.player);}
 fitPet(g,a);if(scene==='reforming'){g.damageAlly(a,999);b.reviveRemaining=2;}
 g.reveal();const raw=JSON.parse(g.serialize());if(scene.startsWith('legacy-')){raw.version=34;delete raw.data.player.petBond;raw.data.allies[0].status=scene==='legacy-down'?'down':'packed';if(scene==='legacy-down')raw.data.allies[0].hp=0;}
 const text=JSON.stringify(raw);if(!Game.restore(text))throw new Error('Invalid '+scene);writeFileSync(new URL('pet-'+scene+'.json',out),text);console.log(scene);
}
