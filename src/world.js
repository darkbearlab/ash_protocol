import {addSwarmWaves} from './swarm-waves.js';
import {addNoncombatants} from './civilians.js';
import {rollEnemyElite} from './elite-enemies.js';
import {DEFAULT_FACTION,factionPool,factionBoss,factionDef} from './factions.js';
import {isBossClass,isNoncombatant,ENEMY_SPAWNS} from './enemy-data.js';
import {rollEnemyAffixes} from './enemy-affixes.js';
import {fillUnknownContainers} from './learning-data.js';
import {addRuntimePopulation} from './runtime-enemies.js';
import {MAP_RECIPES} from './map-recipes-data.js';
import {orderedRecipes,recipeGroups} from './map-recipes.js';
import {SLOT_RECIPES,furnishMap} from './map-slots.js';
import {latticeCells,cellNeighbors,collapseCellLinks,describeRooms} from './map-geometry.js';
import {MERGED_RECIPES,selectMergeRecipe,mergePlans,mergeMap} from './map-merging.js';
import {OPENING_RECIPES,addOpenings} from './map-openings.js';
import {ANNEX_RECIPES,addAnnexes,addRequestedAnnexes} from './map-annexes.js';
import {placePopulation,reservationPosts} from './map-population.js';
import {ENDLESS_TUNING,extraEnemies,scaleEnemy} from './endless.js';
import {createLighting} from './lighting.js';
import {selectSupplyStations,addLivingModules} from './modules.js';
import {packSupplies} from './containers.js';
import {vaultable,blockedBetween,barrierBetween,makeBarrier,edgeCells,edgeKey} from './barriers.js';
import {startingTraits,grantTrait} from './traits.js';
import {SIZE,ENEMY_TYPES,floorInfo,WEAPONS,RARE_ARMORY} from './data.js';
import {weaponUnlocked} from './progression.js';
export function random(seed) {
  let a=seed>>>0;
  const next=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
  next.state=()=>a; return next;
}
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const key=(p)=>`${p.x},${p.y}`;
export const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
export function lineOfSight(grid,a,b,barriers=[],channel='sight') {
  let x=Math.floor(a.x+.5),y=Math.floor(a.y+.5);
  const endX=Math.floor(b.x+.5),endY=Math.floor(b.y+.5),dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy);
  if(grid[y]?.[x]!==1||grid[endY]?.[endX]!==1)return false;
  const stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
  let tx=dx?(x+(sx>0?.5:-.5)-a.x)/dx:Infinity,ty=dy?(y+(sy>0?.5:-.5)-a.y)/dy:Infinity;
  for(let i=0;i<SIZE*3;i++){
    if(x===endX&&y===endY)return true;
    if(Math.abs(tx-ty)<1e-9){
      const from={x,y},across={x:x+sx,y:y+sy},horizontal={x:x+sx,y},vertical={x,y:y+sy};
      const viaX=grid[y]?.[x+sx]===1&&!blockedBetween(barriers,from,horizontal,channel)&&!blockedBetween(barriers,horizontal,across,channel);
      const viaY=grid[y+sy]?.[x]===1&&!blockedBetween(barriers,from,vertical,channel)&&!blockedBetween(barriers,vertical,across,channel);
      if(!viaX&&!viaY)return false;x+=sx;y+=sy;tx+=stepX;ty+=stepY;
    }
    else if(tx<ty){if(blockedBetween(barriers,{x,y},{x:x+sx,y},channel))return false;x+=sx;tx+=stepX;}
    else{if(blockedBetween(barriers,{x,y},{x,y:y+sy},channel))return false;y+=sy;ty+=stepY;}
    if(grid[y]?.[x]!==1)return false;
  }return false;
}
export function makeEnemy(type,x,y,id,floor=1,offset=0,faction=DEFAULT_FACTION) {
  const def=ENEMY_TYPES[type],hp=def.expendable||isNoncombatant(type)?def.hp:scaleEnemy(def.hp+(isBossClass(type)?0:Math.max(0,floor-2)*(def.fragile?2:4)),floor,'hp',offset);
  return {id,type,x,y,hp,maxHp:hp,faction,...(isNoncombatant(type)?{screamCooldown:0}:{}),...(def.combat?{combatModifiers:{...def.combat}}:{}),...(def.expendable?{expendable:true,reinforcement:true,actionDelay:0}:{}),vaultExposed:false,traits:startingTraits(type,floor),moveDelta:[0,0],fireChain:null,control:{disabled:0,immune:0},lastKnown:null,alert:false,charge:false,windup:0,aim:null,attackCount:0,moved:false};
}
// Phase one has one built-in skeleton. Empty pools explicitly select v1.
export const PHASE_ONE_RECIPES=Object.freeze([Object.freeze({id:'grid-v2'})]);
export function generate(seed,floor=1,unlocks=[],offset=0,faction=DEFAULT_FACTION){const map=fillUnknownContainers(addRuntimePopulation(generateWithRecipes(seed,floor,unlocks,MAP_RECIPES,faction),seed,floor,generationSafe,faction),seed,floor);for(const e of map.enemies){e.faction=faction;const fresh=makeEnemy(e.type,e.x,e.y,e.id,floor,offset,faction);e.hp=fresh.hp;e.maxHp=fresh.maxHp;e.traits=e.traits.filter(t=>t.source!=='endless:elite');rollEnemyAffixes(e,seed,floor,offset);rollEnemyElite(e,seed,floor,offset);}if(map.generation)map.generation={version:10,recipeId:'enemies-v10',base:map.generation};if(map.generation&&map.enemies.some(e=>e.elite))map.generation={version:11,recipeId:'elites-v11',base:map.generation};return addSwarmWaves(addNoncombatants(map,seed,floor,faction),seed,floor,faction);}
export function generateWithRecipes(seed,floor=1,unlocks=[],recipes=MAP_RECIPES,faction=DEFAULT_FACTION){
  if(!recipes.length)return generateLegacy(seed,floor,unlocks,faction);
  if(recipes.some(r=>r.layout)){
    for(const recipe of orderedRecipes(seed,floor,recipes)){const map=generateCustom(seed,floor,unlocks,recipe,faction);if(map)return map;}
    return generateWithRecipes(seed,floor,unlocks,SLOT_RECIPES,faction);
  }
  if(recipes.some(r=>!['grid-v2',...MERGED_RECIPES.map(r=>r.id),...OPENING_RECIPES.map(r=>r.id),...ANNEX_RECIPES.map(r=>r.id),...SLOT_RECIPES.map(r=>r.id)].includes(r.id)))throw new Error('Unsupported skeleton recipe');
  const chosen=selectMergeRecipe(seed,floor,recipes),openingRecipe=OPENING_RECIPES.find(r=>r.id===chosen.id);
  if(chosen.id==='furnished-v6'){const base=generateWithRecipes(seed,floor,unlocks,ANNEX_RECIPES,faction);return base.generation?(furnishMap(base,seed,floor,{reachable,generationSafe})||base):base;}
  if(chosen.id==='edge-annexes-v5'){const base=generateWithRecipes(seed,floor,unlocks,OPENING_RECIPES,faction);return base.generation?(addAnnexes(base,seed,floor,{reachable,generationSafe})||base):base;}
  if(openingRecipe){const base=generateWithRecipes(seed,floor,unlocks,MERGED_RECIPES,faction);return base.generation?(addOpenings(base,seed,floor,{...openingRecipe,...chosen},{reachable,generationSafe})||base):base;}
  const map=generateBase(seed,floor,unlocks,true,null,null,faction);
  if(!map||!generationSafe(map))return generateLegacy(seed,floor,unlocks,faction);
  const recipe=selectMergeRecipe(seed,floor,recipes);
  if(recipe.id!=='grid-v2')for(const ids of mergePlans(map,seed,floor,recipe.id)){
    const merged=mergeMap(map,ids,seed,floor,recipe.id,{reachable,generationSafe});if(merged)return merged;
  }
  return map;
}
// Historical v1 is a byte-for-byte API. Live generate/loadFloor attach faction at the boundary.
export function generateLegacy(seed,floor=1,unlocks=[],faction=DEFAULT_FACTION){const map=generateBase(seed,floor,unlocks,false,null,null,faction);for(const e of map.enemies)delete e.faction;return map;}
function generateCustom(seed,floor,unlocks,recipe,faction){
  const groups=recipeGroups(recipe),endpoints=groups.filter(([label,ids])=>ids.length===1&&!recipe.annex?.[label]).map(([,ids])=>ids[0]);
  if(endpoints.length<2)return null;
  const checks={reachable,generationSafe},base=generateBase(seed,floor,unlocks,true,endpoints,groups.map(([,ids])=>ids),faction);
  if(!base||!generationSafe(base))return null;
  let map=mergeMap(base,[],seed,floor,'hangar-v3',checks,groups.map(([,ids])=>ids));if(!map)return null;
  const ids=Object.fromEntries(groups.map(([label],i)=>[label,i])),openings={};
  for(const [label,range]of Object.entries(recipe.openings||{}))openings[label.includes('-')?label.split('-').map(l=>ids[l]).sort((a,b)=>a-b).join('-'):label]=range;
  map=addOpenings(map,seed,floor,{id:recipe.id,openings,doorRatio:recipe.doorRatio??.3},checks);if(!map)return null;
  // Omitted annex means no annex. Explicit requests must all succeed or the
  // complete recipe is rejected; its identity never claims a partial layout.
  if(Object.keys(recipe.annex||{}).length){map=addRequestedAnnexes(map,seed,floor,Object.entries(recipe.annex).map(([label,value])=>{const [type,side]=value.split('-');return {roomId:ids[label],type,side};}),checks);if(!map)return null;}
  map=furnishMap(map,seed,floor,checks);if(!map)return null;
  for(const r of map.rooms)r.visualTheme=recipe.theme??'industrial';
  map.generation={version:7,recipeId:recipe.id,recipe:structuredClone(recipe)};
  return generationSafe(map)?map:null;
}
function generateBase(seed,floor,unlocks,v2,endpoints=null,groups=null,faction=DEFAULT_FACTION) {
  const rng=random(seed+floor*7919),grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0)),rooms=[];
  for(let ry=0;ry<3;ry++)for(let rx=0;rx<3;rx++) {
    const w=6+Math.floor(rng()*2),h=6+Math.floor(rng()*2),x=rx*8+2,y=ry*8+2;
    const r={x,y,w,h,cx:x+Math.floor(w/2),cy:y+Math.floor(h/2)}; rooms.push(r);
    for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)grid[j][i]=1;
  }
  const shuffled=list=>{const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
  const cells=latticeCells(),neighbors=i=>cellNeighbors(cells,i);
  if(v2)rooms.splice(0,rooms.length,...describeRooms(rooms,cells));
  const startOptions=endpoints||[0,2,6,8],startCell=startOptions[Math.floor(rng()*startOptions.length)],startRoom=cells[startCell].roomId,visited=new Set([startCell]),stack=[startCell];let links=[];
  // Random spanning tree, then up to two loops. Retain a leaf for optional exploration.
  while(stack.length){const a=stack.at(-1),options=neighbors(a).filter(n=>!visited.has(n));if(!options.length){stack.pop();continue;}const b=options[Math.floor(rng()*options.length)];links.push([a,b]);visited.add(b);stack.push(b);}
  const degree=i=>links.filter(edge=>edge.includes(i)).length;
  const candidates=shuffled(cells.flatMap(({id:a})=>neighbors(a).filter(b=>b>a&&!links.some(e=>e.includes(a)&&e.includes(b))).map(b=>[a,b])));
  for(const [a,b]of candidates){if(links.length>=cells.length+1)break;const leaves=cells.filter(({id})=>id!==startCell&&degree(id)+(id===a||id===b?1:0)===1);if(leaves.length)links.push([a,b]);}
  links=collapseCellLinks(cells,links);
  const parents=new Map([[startRoom,null]]),queue=[startRoom];
  for(let i=0;i<queue.length;i++)for(const edge of links.filter(e=>e.includes(queue[i]))){const b=edge.find(n=>n!==queue[i]);if(!parents.has(b)){parents.set(b,queue[i]);queue.push(b);}}
  const endRoom=queue.filter(id=>!endpoints||endpoints.includes(id)).at(-1),mainRoute=[];for(let i=endRoom;i!==null;i=parents.get(i))mainRoute.unshift(i);
  const differentReward=(id,chosen)=>!groups||!groups.some(ids=>ids.includes(id)&&chosen.some(i=>ids.includes(i)));
  const rewardRooms=[];for(const id of shuffled(rooms.map((_,i)=>i).filter(i=>!mainRoute.includes(i))))if(rewardRooms.length<3&&differentReward(id,rewardRooms))rewardRooms.push(id);
  for(const i of shuffled(rooms.map((_,i)=>i).filter(i=>i!==startRoom&&i!==endRoom&&!rewardRooms.includes(i))))if(rewardRooms.length<3&&differentReward(i,rewardRooms))rewardRooms.push(i);
  rewardRooms.forEach((i,n)=>rooms[i].supply=['ammo','medical','armor'][n]);
  const corridors=new Set(),corridorPaths=[];let path;
  const carve=(a,b)=>{let x=a.x,y=a.y;grid[y][x]=1;corridors.add(`${x},${y}`);path.cells.push({x,y});while(x!==b.x){x+=Math.sign(b.x-x);grid[y][x]=1;corridors.add(`${x},${y}`);path.cells.push({x,y});}while(y!==b.y){y+=Math.sign(b.y-y);grid[y][x]=1;corridors.add(`${x},${y}`);path.cells.push({x,y});}};
  for(const [ai,bi]of links){path={rooms:[ai,bi],cells:[]};corridorPaths.push(path);const a=rooms[ai],b=rooms[bi];
    // Offset entrances break long straight firing lanes; only cardinal neighboring rooms connect.
    if(a.y===b.y){const left=a.x<b.x?a:b,doorX=left.x+left.w,ay=a.cy+Math.floor(rng()*3)-1,by=b.cy+Math.floor(rng()*3)-1;carve({x:a.cx,y:ay},{x:doorX,y:ay});carve({x:doorX,y:ay},{x:doorX,y:by});carve({x:doorX,y:by},{x:b.cx,y:by});}
    else{const top=a.y<b.y?a:b,doorY=top.y+top.h,ax=a.cx+Math.floor(rng()*3)-1,bx=b.cx+Math.floor(rng()*3)-1;carve({x:ax,y:a.cy},{x:ax,y:doorY});carve({x:ax,y:doorY},{x:bx,y:doorY});carve({x:bx,y:doorY},{x:bx,y:b.cy});}
  }
  const start={x:rooms[startRoom].cx,y:rooms[startRoom].cy},end={x:rooms[endRoom].cx,y:rooms[endRoom].cy};
  const enemies=[],items=[],props=[],hazards=[],info=floorInfo(floor);
  const pool=factionPool(faction,floor);

  // Explicit v1 compatibility baseline retains its historical RNG draw positions and elite payload.
  const spawnEnemy=(type,x,y,id)=>{const e=makeEnemy(type,x,y,id,floor,0,faction);if(floor>6&&!isBossClass(type)&&rng()<Math.min(.5,(floor-6)*.04)){const options=['fast','infrared','night_vision'].filter(id=>!e.traits.some(t=>t.id===id));if(options.length){const chosen=options[Math.floor(rng()*options.length)];if(!v2)grantTrait(e,chosen,'endless:elite');}}return e;};
  rooms.forEach((r,i)=>{
    const posts=reservationPosts(r,{legacy:!v2,deep:floor>6});
    if(i!==startRoom)for(let j=0;j<(3+extraEnemies(floor)+(floor>=3&&rng()<.45?1:0));j++) {
      const drawn=i===endRoom&&j===0&&factionBoss(faction,info.cycleFloor)?factionBoss(faction,info.cycleFloor):pool[Math.floor(rng()*pool.length)];
      // A card may cap how many of it a floor can hold (3.125.0: one squad leader). The draw is never repeated, so the
      // seeded stream is identical; the card that is over its cap becomes the faction's plain scout.
      const card=ENEMY_TYPES[drawn],cap=floor>6?(card?.maxPerFloorDeep??card?.maxPerFloor):card?.maxPerFloor;
      const type=cap&&enemies.filter(e=>e.type===drawn).length>=cap?factionDef(faction).scout:drawn;
      const post=posts[j];if(!post)throw new Error("Legacy enemy post capacity exceeded");
      enemies.push(spawnEnemy(type,post.x,post.y,`${floor}-${i}-${j}`,floor));
    }
    props.push({id:`${floor}-cover-${i}`,x:r.x+1,y:r.y+2,type:'cover',hp:65,maxHp:65});
    if(i%3===1)props.push({id:`${floor}-barrel-${i}`,x:r.x+r.w-1,y:r.y+r.h-2,type:'barrel',hp:18,maxHp:18});
    props.push({id:`${floor}-console-${i}`,x:r.x+r.w-1,y:r.y,type:'terminal',used:false});
    // 3.110.0 (user request): about half of everything in a case used to be ammunition, and ammunition is capped, so
    // a full pack turned a case into "已滿，留在原地". Taking this cycle from mod 3 to mod 5 swaps one rifle slot AND one
    // pistol slot (not only rifle, as 3.110.0 first claimed). 3.110.1 takes the cut the whole way to a third: the cache now
    // carries the three rounds usable from floor 1, and the two late weapons' ammunition (energy, launcher) comes
    // from the start-room drop on the floors those weapons can actually appear on.
    if(i===startRoom||i%2===0)items.push({x:r.x+1,y:r.y+r.h-2,type:i===startRoom?'med':['ammo','pistol','shell','spray','adrenaline'][Math.floor(i/2)%5]});
    if(i===1||i===6)items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'grenade',amount:1});
    if(i===2||i===7)items.push({x:r.x+2,y:r.y+r.h-2,type:'scrap',amount:18});
    if(floor<=6&&i===rewardRooms[0])items.push({x:r.cx,y:r.cy-1,type:'lore',floor});
    if(info.hazard&&i!==startRoom&&i%2===1)hazards.push({x:r.x+r.w-2,y:r.y+2,type:info.hazard});
    if(r.supply==='ammo'){items.push({x:r.cx-1,y:r.cy,type:'ammo',amount:20,cache:true},{x:r.cx,y:r.cy,type:'spray',amount:1,cache:true},{x:r.cx+1,y:r.cy,type:'barricade',amount:1,cache:true},{x:r.cx-1,y:r.cy+1,type:'pistol',amount:24,cache:true},{x:r.cx+1,y:r.cy+1,type:'shell',amount:12,cache:true});}
    if(r.supply)items.push({x:r.cx,y:r.cy+1,type:{ammo:'emp',medical:'stun',armor:'smoke'}[r.supply],amount:1,cache:true});
    if(r.supply==='medical')items.push({x:r.cx,y:r.cy,type:'med',amount:1,cache:true});
    // 3.123.0: one flare in the armour room's case, next to the smoke; placed on an existing supply tile, no RNG.
    if(r.supply==='armor')items.push({x:r.cx,y:r.cy,type:'armor',amount:20,cache:true},{x:r.cx,y:r.cy,type:'flare',amount:1,cache:true});
  });
  // Guaranteed weapon discoveries, placed off the critical path so full packs never block progress.
  const preferred=info.weapon;
  const unlocked=WEAPONS.map((w,i)=>({w,i})).filter(({w})=>w.unlockId&&weaponUnlocked(w,unlocks));
  const weapon=unlocked.length&&rng()<.25?unlocked[Math.floor(rng()*unlocked.length)].i:preferred;
  const armory=rooms[rewardRooms[0]];items.push({x:armory.cx,y:armory.cy+1,type:'weapon',weapon});
  if(floor>=RARE_ARMORY.minFloor&&rng()<RARE_ARMORY.chance)items.push({x:armory.cx,y:armory.cy+1,type:'weapon',weapon:RARE_ARMORY.weapon});
  // The launcher only exists from floor 3 (GL-03 on 4, the rare TB-09 from 3), so this stays the one reliable source
  // of launcher rounds now that the ammunition cache trades its own for a folding cover.
  if(floor>=3){const r=rooms[startRoom];items.push({x:r.x+r.w-2,y:r.y+r.h-2,type:'energy',amount:27});items.push({x:r.x+r.w-2,y:r.y+1,type:'ordnance',amount:4});}
  const spawn=rooms[startRoom];enemies.unshift(spawnEnemy(factionDef(faction).scout,spawn.x+spawn.w-1,spawn.y+1,`${floor}-scout`,floor));
  // Doorways can now enter from any side. Never place a solid prop or hazard on a connecting lane.
  for(let i=props.length-1;i>=0;i--)if(props[i].hp>0&&corridors.has(key(props[i])))props.splice(i,1);
  for(let i=hazards.length-1;i>=0;i--)if(corridors.has(key(hazards[i])))hazards.splice(i,1);
  const map={grid,rooms,start,end,startRoom,endRoom,links,mainRoute,rewardRooms,enemies,items,props,hazards,marks:[]};
  // Door-side shelters, internal wall corners and offset firing positions.
  // Keep both center lanes open, and verify occupied destinations after each room edit.
  const destinations=[start,end,...enemies,...items];
  const reserved=new Set([...corridors,...[...destinations,...props,...hazards].map(key)]);
  rooms.forEach((r,i)=>{
    r.kind=['貨架倉庫','環形機房','錯列檢查點'][Math.floor(rng()*3)];
    const added=[],walls=[],previousProps=props.length;
    for(const spot of [{x:r.x+r.w-2,y:r.y+2},{x:r.x+2,y:r.y+r.h-2}])if(!reserved.has(key(spot))){const prop={...spot,type:'cover',id:`${floor}-lane-${i}-${added.length}`,hp:80,maxHp:80};props.push(prop);added.push(prop);}
    const shapes={'貨架倉庫':[[0,-2],[1,-2],[-1,2],[0,2]],'環形機房':[[0,0],[1,0],[0,1],[1,1]],'錯列檢查點':[[1,-1],[1,-2],[-1,1],[-1,2]]};
    if(i!==startRoom)for(const [dx,dy]of shapes[r.kind]){const spot={x:r.cx+dx,y:r.cy+dy};if(!reserved.has(key(spot))&&!props.some(o=>key(o)===key(spot))){grid[spot.y][spot.x]=0;walls.push(spot);}}
    const seen=reachable(map,start);
    const floors=reachable({...map,props:[]},start);
    if(destinations.some(p=>!seen.has(key(p)))||floors.size!==grid.flat().filter(n=>n===1).length){for(const p of walls)grid[p.y][p.x]=1;props.splice(previousProps);}
  });
  map.barriers=[];
  // A few single-width corridor doors, after terrain/RNG generation is complete.
  const occupied=p=>props.some(o=>o.hp>0&&o.x===p.x&&o.y===p.y);
  for(const [i,r]of rooms.entries()){
    if(i===startRoom||map.barriers.length>=3)continue;
    const candidates=[];
    for(let y=r.y+1;y<r.y+r.h-1;y++)candidates.push([{x:r.x,y},{x:r.x-1,y}],[{x:r.x+r.w-1,y},{x:r.x+r.w,y}]);
    for(let x=r.x+1;x<r.x+r.w-1;x++)candidates.push([{x,y:r.y},{x,y:r.y-1}],[{x,y:r.y+r.h-1},{x,y:r.y+r.h}]);
    const pair=candidates.find(([a,b])=>grid[a.y]?.[a.x]===1&&grid[b.y]?.[b.x]===1&&!occupied(a)&&!occupied(b)&&corridors.has(key(b))&&(a.x!==b.x?grid[b.y-1]?.[b.x]!==1&&grid[b.y+1]?.[b.x]!==1:grid[b.y]?.[b.x-1]!==1&&grid[b.y]?.[b.x+1]!==1)&&!barrierBetween(map.barriers,a,b));
    if(pair)map.barriers.push(makeBarrier('door',...pair,`edge-${floor}-entrance-${i}`));
  }
  // One neutral 2x2 compartment. It is terrain only; themed room modules come later.
  let placed=false;
  for(const [i,r]of rooms.entries()){
    if(i===startRoom||placed)continue;
    for(let y=r.y+1;y<r.y+r.h-2&&!placed;y++)for(let x=r.x+1;x<r.x+r.w-2&&!placed;x++){
      const cells=[{x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}];
      if(cells.some(p=>grid[p.y]?.[p.x]!==1||corridors.has(key(p))||occupied(p)||[start,end].some(q=>key(q)===key(p))))continue;
      const pairs=[];for(const cell of cells)for(const [dx,dy]of DIRECTIONS){const other={x:cell.x+dx,y:cell.y+dy};if(!cells.some(p=>key(p)===key(other)))pairs.push([cell,other]);}
      const boundaries=pairs.filter(([,b])=>grid[b.y]?.[b.x]===1);
      if(!boundaries.length||boundaries.some(([a,b])=>occupied(b)||barrierBetween(map.barriers,a,b)))continue;
      const addition=boundaries.map(([a,b],n)=>makeBarrier(n===0?'door':'partition',a,b,`edge-${floor}-cell-${i}-${n}`));
      const previous=map.barriers;map.barriers=[...previous,...addition];
      const accessible=reachable(map,start),all=reachable({...map,props:[]},start);
      if(destinations.some(p=>!accessible.has(key(p)))||all.size!==grid.flat().filter(v=>v===1).length)map.barriers=previous;else placed=true;
    }
  }
  packSupplies(map,floor);selectSupplyStations(map,floor);
  if(v2){
    map.cells=cells;
    map.openings=corridorPaths.map((p,i)=>({id:`opening-${floor}-${i}`,rooms:p.rooms,cells:[...new Map(p.cells.map(c=>[key(c),c])).values()],barrierIds:map.barriers.filter(b=>b.type==='door'&&edgeCells(b).every(c=>p.cells.some(q=>key(q)===key(c)))).map(b=>b.id)}));
    map.annexes=[];map.generation={version:2,recipeId:'grid-v2'};
  }
  if(v2&&!placePopulation(map,reachable(map,map.start),floor))return null;
  addLivingModules(map,seed,floor,{corridors,reachable});map.lighting=createLighting(grid,rooms,start,seed,floor,corridorPaths);
  // Two low rails per floor, independent of gameplay RNG. Existing sealed rooms stay sealed.
  for(const [i,r]of rooms.entries()){
    if(i===startRoom||map.barriers.filter(b=>b.type==='low_partition').length>=2)continue;
    const axis=(seed+i+floor)%2,options=[];
    for(let y=r.y+1;y<r.y+r.h-1;y++)for(let x=r.x+1;x<r.x+r.w-1;x++)options.push([{x,y},{x:x+(axis?0:1),y:y+(axis?1:0)}]);
    const pair=options.find(cells=>cells.every(p=>grid[p.y]?.[p.x]===1&&![start,end,...props,...hazards,...items,...enemies].some(o=>key(o)===key(p))&&!map.barriers.some(b=>edgeCells(b).some(q=>key(q)===key(p)))));
    if(pair)map.barriers.push(makeBarrier('low_partition',...pair,`edge-${floor}-low-${i}`));
  }
  return map;
}
export function reachable(map,start,{openDoors=true}={}) {
  const queue=[start],seen=new Set([key(start)]);
  for(let i=0;i<queue.length;i++)for(const [dx,dy]of DIRECTIONS){const p={x:queue[i].x+dx,y:queue[i].y+dy},edge=barrierBetween(map.barriers,queue[i],p);if(blockedBetween(map.barriers,queue[i],p)&&!(openDoors&&edge.type==='door')&&!vaultable(edge))continue;if(map.grid[p.y]?.[p.x]===1&&!seen.has(key(p))&&!map.props.some(o=>o.hp>0&&(o.type==='cover'||o.type==='barrel'||o.type==='nest')&&o.x===p.x&&o.y===p.y)){seen.add(key(p));queue.push(p);}}
  return seen;
}
export function generationSafe(map){
  const seen=reachable(map,map.start),all=reachable({...map,props:[]},map.start);
  const destinations=[map.start,map.end,...map.enemies,...map.items,...map.props.filter(p=>p.type==='container'||p.type==='terminal')];
  const corridors=new Set((map.openings||[]).flatMap(o=>o.cells.map(key)));
  return destinations.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)&&seen.has(key(p)))&&all.size===map.grid.flat().filter(n=>n===1).length&&
    new Set(map.enemies.map(e=>e.id)).size===map.enemies.length&&new Set(map.enemies.map(key)).size===map.enemies.length&&
    ![...map.props.filter(p=>p.hp>0),...map.hazards].some(p=>corridors.has(key(p)));
}
