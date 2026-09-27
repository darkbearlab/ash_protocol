import {SIZE} from './data.js';
import {makeEnemy} from './world.js';
import {recipeGroups,validateRecipe} from './map-recipes.js';
import {roomTiles,latticeCells} from './map-geometry.js';
import {roomInterface} from './map-openings.js';
import {makeBarrier} from './barriers.js';
import {LIGHT_MODEL} from './lighting.js';

// The training course's floor (3.198.0, src/course-script.js). Six rooms on the campaign lattice, in teaching order:
//   A A B      A movement and cover (a compartment behind a door, a supply box)   B attack (the training drone)
//   D D C      C throwables (three target drones)                                 D the dark room (dim, then black)
//   E E F      E noncombatants (a long room)                                      F the fight on your own, the elevator
// The rooms the user left without a layout follow the conditions agreed in chat on 2026-09-27; docs/KILLHOUSE.md 14.
export const COURSE_RECIPE={id:'killhouse-course',name:'training course',theme:'security',layout:[['A','A','B'],['D','D','C'],['E','E','F']],openings:{default:[1,1]},doorRatio:0};
// Where each link crosses its shared face, and which one is an open doorway (the researcher runs through it).
const LINKS=Object.freeze([{rooms:[0,1],along:5},{rooms:[1,2],along:21},{rooms:[2,3],along:13},{rooms:[3,4],along:4},{rooms:[4,5],along:21,open:true}]);
export const COURSE_LAYOUT=Object.freeze({
 start:{x:3,y:5},end:{x:24,y:21},
 pillar:{x:9,y:5},crates:[[6,3],[6,7],[8,20],[11,23],[14,19],[20,21]],
 // Room A's compartment: a partition between x 12 and 13 with a door at y 5, and the supply box inside.
 compartment:{x:12,door:5},box:{x:15,y:3},
 // Room D is unpowered: a glowstick by the entrance makes the dim stretch, one wall lamp lights the far end.
 lamp:{x:2,y:13},glowstick:{x:16,y:13},
 medkit:{x:6,y:23}
});
// Who stands where, and their part in the course (src/course.js reads `course`).
const CAST=Object.freeze([
 // Five tiles from the doorway: inside a drone's range (5) from the first step in, and it never moves to close in.
 {id:'kh-drone',type:'drone',x:22,y:5,course:'drone'},
 // Left first: from the doorway the left and middle drones are equally near, and auto-lock takes the left one.
 {id:'kh-target-0',type:'drone',x:20,y:14,course:'target'},{id:'kh-target-1',type:'drone',x:21,y:15,course:'target'},{id:'kh-target-2',type:'drone',x:22,y:16,course:'target'},
 // Neither dark-room rifleman carries a flashlight (the hash in src/lighting.js carriesFlashlight; tests pin it).
 {id:'kh-dark-0',type:'rifleman',x:3,y:12,course:'dark'},{id:'kh-dark-1',type:'rifleman',x:2,y:15,course:'dark'},
 // A few steps from the door, so he is on screen when he screams (user, 2026-09-27).
 {id:'kh-civ',type:'civilian',x:7,y:21,course:'civilian'},
 {id:'kh-guard-0',type:'rifleman',x:19,y:20,course:'guard'},{id:'kh-guard-1',type:'raider',x:21,y:23,course:'guard'},{id:'kh-guard-2',type:'gunner',x:22,y:19,course:'guard'}
]);
export function courseMap(){
 const recipe=validateRecipe(COURSE_RECIPE),groups=recipeGroups(recipe),labels=['A','B','C','D','E','F'],L=COURSE_LAYOUT;
 const cells=latticeCells(),grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));
 const rooms=labels.map((label,id)=>{const ids=groups.find(([l])=>l===label)[1],xs=ids.map(n=>n%3*8+2),ys=ids.map(n=>Math.floor(n/3)*8+2),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)+7-x,h=Math.max(...ys)+7-y;
  const r={id,x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2),cellIds:ids,visualTheme:'security'};for(const p of roomTiles(r))grid[p.y][p.x]=1;for(const n of ids)cells[n].roomId=id;return r;});
 const links=LINKS.map(l=>l.rooms),barriers=[],openings=[],tutorialEntrances=[];
 for(const {rooms:[i,j],along,open}of LINKS){
  const face=roomInterface(rooms[i],rooms[j]);if(along<face.low||along>face.high)throw Error(`course link ${i}-${j} crosses outside its face`);
  const path=[];for(let v=face.from;v<=face.to;v++){const p=face.axis==='x'?{x:v,y:along}:{x:along,y:v};grid[p.y][p.x]=1;path.push(p);}if(rooms[i][face.axis]>rooms[j][face.axis])path.reverse();
  const id=`edge-kh-${i}-${j}`,gate=open?null:makeBarrier('door',path.at(-2),path.at(-1),id);if(gate)barriers.push(gate);
  openings.push({id:`opening-kh-${i}-${j}`,rooms:[i,j],cells:path,path,mouths:[path[0],path.at(-1)],barrierIds:gate?[id]:[]});tutorialEntrances.push({fromRoom:i,toRoom:j,barrierId:gate?id:null,approach:{...path.at(-2)}});
 }
 grid[L.pillar.y][L.pillar.x]=0;
 for(const r of rooms)r.footprint=roomTiles(r).filter(p=>grid[p.y][p.x]===1);
 // The compartment: a full partition with one door in it.
 const A=rooms[0];
 for(let y=A.y;y<A.y+A.h;y++){const a={x:L.compartment.x,y},b={x:L.compartment.x+1,y};barriers.push(y===L.compartment.door?makeBarrier('door',a,b,'edge-kh-compartment'):makeBarrier('partition',a,b,`edge-kh-partition-${y}`));}
 const props=L.crates.map(([x,y],n)=>({id:`kh-cover-${n}`,type:'cover',x,y,hp:80,maxHp:80}));
 // A fixed supply box. Its medkit is marked so the course knows when it has been picked up (a soldier carries 2 of 5).
 props.push({id:'case-1-0',type:'container',kind:'medical',...L.box,opened:false,indestructible:true,contents:[{type:'med',amount:1,course:'box'}]});
 const enemies=CAST.map(c=>({...makeEnemy(c.type,c.x,c.y,c.id,1,0,'loyalist'),simulation:true,course:c.course}));
 const items=[{...L.medkit,type:'med',amount:1}];
 // Power everywhere but room D.
 const D=rooms[3],lighting=grid.map((row,y)=>row.map((_,x)=>x>=D.x&&x<D.x+D.w&&y>=D.y&&y<D.y+D.h?0:1));
 return {grid,rooms,cells,openings,annexes:[],barriers,start:{...L.start},end:{...L.end},startRoom:0,endRoom:5,links,mainRoute:[0,1,2,3,4,5],rewardRooms:[],enemies,items,props,hazards:[],marks:[],
  lighting,lamps:[{id:'lamp-1-0',...L.lamp,hp:1}],lightModel:LIGHT_MODEL,glowsticks:[{...L.glowstick}],mapStyle:'killhouse',killhouseRecipe:COURSE_RECIPE.id,tutorialEntrances};
}
