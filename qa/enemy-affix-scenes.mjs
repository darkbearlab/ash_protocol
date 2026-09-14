import {Game,SIZE,makeEnemy,giveEnemyAffix,grantNativeResistance} from '../src/engine.js';
import {MAP_FIELDS} from '../src/map-geometry.js';
export function affixArena(character='soldier'){
 const g=new Game(475,[],0,character,'onyx');for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
}
export function sceneEnemy(g,type='raider',ids=[],x=14,y=10){const e=makeEnemy(type,x,y,`scene-${g.enemies.length}`);e.hp=e.maxHp=200;for(const id of ids)giveEnemyAffix(e,id);g.enemies.push(e);g.target=e.id;g.reveal();return e;}
export function affixScenes(){
 const hidden=affixArena();sceneEnemy(hidden,'raider',['grenadier','suppressor','fast']);
 const prepare=affixArena(),e=sceneEnemy(prepare,'raider',['grenadier']);e.affixes[0].revealed=true;e.grenadeIntent={stage:'prepare',x:10,y:10,origin:{x:e.x,y:e.y}};
 const flight=Game.restore(prepare.serialize());flight.enemyAct(flight.enemies[0]);
 const resistance=affixArena('bulwark');resistance.player.learningItems.trait_suppression_resistance=4;sceneEnemy(resistance,'raider',['suppressor']);
 const legacy=JSON.parse(hidden.serialize());legacy.version=37;delete legacy.data.difficultyOffset;for(const e of legacy.data.enemies){delete e.affixes;e.traits=e.traits.filter(t=>!t.source.startsWith('affix:'));e.traits.push({id:'fast',source:'endless:elite'});}
 const deep=new Game(475,[],0,'soldier','onyx','endless');deep.floor=12;deep.loadFloor();
 return {hidden,prepare,flight,resistance,deep,legacy};
}
