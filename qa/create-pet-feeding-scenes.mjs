// Generate isolated QA saves only; import through ?test=1. UI wiring belongs to Claude.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy} from '../src/world.js';
import {fitPet,petCapacity,PET_FEEDING_TUNING as T} from '../src/pet-growth.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
const out=new URL('./fixtures/',import.meta.url);mkdirSync(out,{recursive:true});
for(const scene of ['feeding','turret','extrusion','reforming','legacy-packed','legacy-down','nodes-max','nodes-scan','nodes-smoke','legacy-v35']){
 const g=new Game(372,[],0,'druid','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);Object.assign(g.player,{x:10,y:10,plates:30,meds:6});Object.assign(g.allies[0],{x:11,y:10,hp:30});g.start={x:5,y:5};g.end={x:20,y:20};const b=g.player.petBond,a=g.allies[0];
 if(scene==='turret'){b.growth.turret=T.thresholds.turret.at(-1);b.fuel=petCapacity(g.player);}
 if(scene==='extrusion'){b.growth.extrusion=T.thresholds.extrusion.at(-1);b.fedThrowables.smoke=b.growth.extrusion;b.outputRemaining=1;b.fuel=petCapacity(g.player);}
 if(scene==='nodes-max'){for(const [line,ns] of Object.entries(T.thresholds))b.growth[line]=ns.at(-1);b.fedThrowables.frag=b.growth.extrusion;b.fuel=petCapacity(g.player);}
 if(scene==='nodes-scan'){b.growth.armor=T.thresholds.armor[3];b.scanRemaining=1;for(let y=0;y<SIZE;y++)g.grid[y][12]=0;g.enemies.push(makeEnemy('rifleman',14,10,'scan-foe',1));g.seen=g.grid.map(r=>r.map(()=>false));}
 if(scene==='nodes-smoke'){b.growth.extrusion=T.thresholds.extrusion.at(-1);b.fedThrowables.frag=b.growth.extrusion;g.player.hp=20;a.hp=20;}
 fitPet(g,a);if(scene==='reforming'){g.damageAlly(a,999);b.reviveRemaining=2;}
 g.reveal();const raw=JSON.parse(g.serialize());if(['legacy-packed','legacy-down'].includes(scene)){raw.version=34;delete raw.data.player.petBond;raw.data.allies[0].status=scene==='legacy-down'?'down':'packed';if(scene==='legacy-down')raw.data.allies[0].hp=0;}
 if(scene==='legacy-v35'){raw.version=35;raw.data.player.petBond.growth.vitality=20;raw.data.player.petBond.outputRemaining=12;Object.assign(raw.data.allies[0],{hp:140,maxHp:150});for(const k of ['criticalUsedFloors','guardianUsedFloors','steadfast','scanRemaining','scanTurn','scanContacts'])delete raw.data.player.petBond[k];}
 const text=JSON.stringify(raw);if(!Game.restore(text))throw new Error('Invalid '+scene);writeFileSync(new URL('pet-'+scene+'.json',out),text);console.log(scene);
}
