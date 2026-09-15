import {SIZE,WEAPONS} from './data.js';
import {CHARACTERS} from './characters.js';
import {AMMUNITION,AMMO_IDS} from './ammunition.js';
import {makeEnemy,generateWithRecipes} from './world.js';
import {MAP_RECIPES} from './map-recipes-data.js';
import {addNoncombatants} from './civilians.js';
import {recipeGroups,validateRecipe} from './map-recipes.js';
import {roomTiles,latticeCells} from './map-geometry.js';
import {roomInterface} from './map-openings.js';
import {buildModule} from './map-slots.js';
import {isBossClass,hasEnemyTag} from './enemy-data.js';
import {makeBarrier} from './barriers.js';
import {fullLighting} from './lighting.js';
// Explicit, isolated recipe pool. It never enters campaign recipe selection or consumes its RNG.
export const KILLHOUSE_GENERATION={floor:4};
export const KILLHOUSE_RECIPES={tutorial:{id:'killhouse-tutorial',name:'六區訓練',theme:'security',layout:[['A','A','B'],['D','C','B'],['D','E','F']],openings:{default:[1,1]},doorRatio:0},arcade:MAP_RECIPES};
export function arcadeMap(seed){
 const floor=KILLHOUSE_GENERATION.floor,map=generateWithRecipes(seed,floor,[],MAP_RECIPES,'loyalist');
 // Retain the campaign geometry/population slots. Replace non-human combatants in place; no new budget or random rolls.
 map.enemies=map.enemies.filter(e=>!isBossClass(e)&&!e.expendable).map(e=>({...makeEnemy(hasEnemyTag(e,'armed')&&!e.traits.some(t=>t.id==='mechanical')?e.type:'gunner',e.x,e.y,e.id,1,0,'loyalist'),simulation:true}));
 const recipeId=map.generation?.recipeId;addNoncombatants(map,seed,floor,'loyalist');for(const e of map.enemies)e.simulation=true;
 map.items=[];map.props=map.props.filter(p=>!['container','terminal','nest'].includes(p.type));
 for(const r of map.rooms)delete r.supply;
 map.mapStyle='killhouse';map.killhouseRecipe=recipeId||'campaign-fallback';map.campaignTemplateFloor=floor;
 return map;
}
export function tutorialMap(){
 const recipe=validateRecipe(KILLHOUSE_RECIPES.tutorial),groups=recipeGroups(recipe),labels=['A','B','C','D','E','F'];
 const cells=latticeCells(),grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
 const rooms=labels.map((label,id)=>{const ids=groups.find(([l])=>l===label)[1],xs=ids.map(n=>n%3*8+2),ys=ids.map(n=>Math.floor(n/3)*8+2),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)+7-x,h=Math.max(...ys)+7-y;
  const r={id,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),cellIds:ids,visualTheme:'security'};r.footprint=roomTiles(r);for(const p of r.footprint)grid[p.y][p.x]=1;for(const n of ids)cells[n].roomId=id;return r;});
 const links=[[0,1],[1,2],[2,3],[3,4],[4,5]],barriers=[],openings=[],tutorialEntrances=[];
 for(const [i,j]of links){const face=roomInterface(rooms[i],rooms[j]),along=Math.floor((face.low+face.high)/2),path=[];
  for(let v=face.from;v<=face.to;v++){const p=face.axis==='x'?{x:v,y:along}:{x:along,y:v};grid[p.y][p.x]=1;path.push(p);}if(rooms[i][face.axis]>rooms[j][face.axis])path.reverse();
  const id=`edge-kh-${i}-${j}`,gate=makeBarrier('door',path.at(-2),path.at(-1),id);if(gate)barriers.push(gate);
  openings.push({id:`opening-kh-${i}-${j}`,rooms:[i,j],cells:path,path,mouths:[path[0],path.at(-1)],barrierIds:gate?[id]:[]});tutorialEntrances.push({fromRoom:i,toRoom:j,barrierId:gate?id:null,approach:{...path.at(-2)}});
 }
 const props=[],items=[],enemies=[],start={x:3,y:5},end={x:23,y:21};
 // Hand-authored cover exercises using the same physical props/edge components as campaigns.
 for(const r of rooms){for(const [dx,dy]of [[2,2],[r.w-3,r.h-3]])props.push({id:`kh-cover-${r.id}-${dx}-${dy}`,type:'cover',x:r.x+dx,y:r.y+dy,hp:80,maxHp:80});
  for(const [n,type]of ['partition','low_partition'].entries())barriers.push(makeBarrier(type,{x:r.x+3,y:r.y+1+n},{x:r.x+4,y:r.y+1+n},`edge-kh-divider-${r.id}-${n}`));}
 for(const [theme,x,y,n]of [['office',10,3,0],['warehouse',19,10,1]]){const m=buildModule(theme,{x,y},1,n);props.push(m.marker,...m.parts);barriers.push(...m.barriers);}
 const placements=[['rifleman',21,6],['sniper',13,12],['raider',4,13],['rifleman',5,16],['civilian',11,19],['gunner',15,23],['rifleman',20,19],['raider',23,20],['gunner',23,23]];
 for(const [type,x,y]of placements)enemies.push({...makeEnemy(type,x,y,`kh-${enemies.length}`,1,0,'loyalist'),simulation:true,...(type==='civilian'?{simulationBounds:{x:10,y:18,w:3,h:7},simulationNoDoors:true}:{})});
 for(const [x,y,type,amount]of [[4,5,'ammo',32],[19,7,'med',1],[15,15,'grenade',2],[3,19,'ammo',32],[11,23,'med',1]])items.push({x,y,type,amount});
 return {grid,rooms,cells,openings,annexes:[],barriers,start,end,startRoom:0,endRoom:5,links,mainRoute:[0,1,2,3,4,5],rewardRooms:[],enemies,items,props,hazards:[],marks:[],lighting:fullLighting(grid),mapStyle:'killhouse',killhouseRecipe:recipe.id,tutorialEntrances};
}
export function armoryWeapons(character,selection='all'){
 const owned=CHARACTERS[character].weapons,classes=new Set(owned.map(i=>WEAPONS[i].weaponClass));
 return WEAPONS.flatMap((w,i)=>(!w.locked&&(selection==='all'||classes.has(w.weaponClass)))?[i]:[]);
}
export function killhouseMap(seed,phase,character,options){
 if(phase==='combat')return arcadeMap(seed);if(phase==='tutorial')return tutorialMap();
 const r={id:0,x:10,y:10,w:7,h:7,cx:13,cy:13},grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0)),items=[],cells=[];
 for(let y=10;y<=16;y++)for(let x=10;x<=16;x++){grid[y][x]=1;if(y!==13&&x!==13)cells.push({x,y});}
 for(const weapon of armoryWeapons(character,options.armory))items.push({...cells.shift(),type:'weapon',weapon});
 for(const id of AMMO_IDS)items.push({...cells.shift(),type:AMMUNITION[id].item,amount:AMMUNITION[id].base*3});
 for(const type of ['grenade','smoke','emp','stun'])items.push({...cells.shift(),type,amount:4});
 return {grid,rooms:[r],barriers:[],start:{x:11,y:13},end:{x:15,y:13},startRoom:0,endRoom:0,links:[],mainRoute:[0],rewardRooms:[],enemies:[],items,props:[],hazards:[],marks:[],lighting:fullLighting(grid),mapStyle:'killhouse',killhouseRecipe:'armory'};
}
