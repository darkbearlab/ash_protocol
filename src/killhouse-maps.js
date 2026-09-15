import {SIZE,WEAPONS} from './data.js';
import {CHARACTERS} from './characters.js';
import {AMMUNITION,AMMO_IDS} from './ammunition.js';
import {makeEnemy} from './world.js';
import {makeBarrier} from './barriers.js';
import {fullLighting} from './lighting.js';
// Explicit, isolated recipe pool. It never enters campaign recipe selection or consumes its RNG.
export const KILLHOUSE_RECIPES={
 tutorial:{id:'tutorial',rooms:[[3,3,8,5],[16,3,8,5],[16,11,8,5],[3,11,8,5],[3,19,8,5],[16,19,8,5]],links:[[0,1],[1,2],[2,3],[3,4],[4,5]]},
 arcade:[
  {id:'switchback',rooms:[[3,3,8,5],[16,3,8,5],[16,11,8,5],[3,11,8,5],[3,19,8,5],[16,19,8,5]],links:[[0,1],[1,2],[2,3],[3,4],[4,5],[0,3],[2,5]]},
  {id:'crossfire',rooms:[[3,3,8,7],[16,3,8,7],[16,15,8,9],[3,15,8,9]],links:[[0,1],[1,2],[2,3],[3,0]]}
 ]
};
export function armoryWeapons(character,selection='all'){
 const owned=CHARACTERS[character].weapons,classes=new Set(owned.map(i=>WEAPONS[i].weaponClass));
 return WEAPONS.flatMap((w,i)=>(!w.locked&&(selection==='all'||classes.has(w.weaponClass)))?[i]:[]);
}
export function killhouseMap(seed,phase,character,options){
 const prep=phase==='armory',tutorial=phase==='tutorial',recipe=prep?{id:'armory',rooms:[[10,10,7,7]],links:[]}:tutorial?KILLHOUSE_RECIPES.tutorial:KILLHOUSE_RECIPES.arcade[(seed>>>0)%KILLHOUSE_RECIPES.arcade.length];
 const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0)),rooms=recipe.rooms.map(([x,y,w,h],id)=>({id,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),visualTheme:'industrial'}));
 for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++)grid[y][x]=1;
 const barriers=[];
 for(const [i,j]of recipe.links){const a=rooms[i],b=rooms[j];let x=a.cx,y=a.cy;while(x!==b.cx||y!==b.cy){const nx=x+Math.sign(b.cx-x),ny=x===b.cx?y+Math.sign(b.cy-y):y;grid[ny][nx]=1;
   if(!prep&&j>1&&((nx===b.x-1&&nx>x)||(nx===b.x+b.w&&nx<x)||(ny===b.y-1&&ny>y)))barriers.push(makeBarrier('door',{x,y},{x:nx,y:ny},`edge-kh-${i}-${j}`));x=nx;y=ny;}}
 const start={x:rooms[0].x+1,y:rooms[0].cy},last=rooms.at(-1),end={x:last.x+last.w-2,y:last.cy},enemies=[],items=[],props=[];
 const add=(type,r,dx,dy)=>enemies.push({...makeEnemy(type,r.x+dx,r.y+dy,`kh-${enemies.length}`,1,0,'loyalist'),simulation:true});
 if(prep){const cells=[];for(let y=10;y<=16;y++)for(let x=10;x<=16;x++)if(y!==13&&x!==13)cells.push({x,y});
  for(const weapon of armoryWeapons(character,options.armory))items.push({...cells.shift(),type:'weapon',weapon});
  for(const id of AMMO_IDS)items.push({...cells.shift(),type:AMMUNITION[id].item,amount:AMMUNITION[id].base*3});
  for(const type of ['grenade','smoke','emp','stun'])items.push({...cells.shift(),type,amount:4});
 }else{
  for(const [i,r]of rooms.entries()){
   props.push({id:`kh-cover-${i}`,type:'cover',x:r.cx,y:r.y+1,hp:60,maxHp:60});
   if(i===0)continue;
   if(tutorial){if(i===1)add('rifleman',r,5,3);if(i===2)add('sniper',r,6,3);if(i===3){add('raider',r,2,3);add('rifleman',r,5,3);}if(i===4){add('civilian',r,2,1);add('civilian',r,5,1);add('gunner',r,6,3);}if(i===5){add('rifleman',r,2,1);add('raider',r,5,1);add('gunner',r,5,3);}}
   else {add('rifleman',r,2,3);add('raider',r,5,1);add(i%2?'sniper':'gunner',r,6,r.h-2);add('civilian',r,1,1);}
  }
  if(tutorial)for(const [room,type,amount]of [[0,'ammo',32],[1,'med',1],[2,'grenade',2],[3,'ammo',32],[4,'med',1]]){const r=rooms[room];items.push({x:r.x+1,y:r.cy,type,amount});}
 }
 return {grid,rooms,barriers,start,end,startRoom:0,endRoom:rooms.length-1,links:recipe.links.map(x=>[...x]),mainRoute:rooms.map(r=>r.id),rewardRooms:[],enemies,items,props,hazards:[],marks:[],lighting:fullLighting(grid),mapStyle:'killhouse',killhouseRecipe:recipe.id};
}
