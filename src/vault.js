// Keycards and vaults (3.146.0, user decisions 2026-09-19; docs/VAULTS.md). A third of the floors lock one of their
// closets (the 2×2 compartments and restroom modules: one door, four tiles, never on anyone's way) behind a steel door
// that nothing breaks. Inside is a vault case with one item from VAULT_LOOT. The keycard is carried by one enemy,
// preferring an elite, and drops when it dies; it opens that floor's vault only.
// Placed last in generate(), from hashes of its own, so nothing else on the floor moves. This module imports nothing
// that imports world.js.
import {barrierBetween,blockedBetween,vaultable,edgeCells} from './barriers.js';
import {isBossClass,isNoncombatant,enemyDef} from './enemy-data.js';
import {WEAPONS} from './data.js';
import {dropOnlyAffixes,affixAllowed} from './weapons.js';
import {validLearningId} from './learning-data.js';
import {activeTrait} from './traits.js';
import {weaponUnlocked} from './progression.js';
import {moduleCells} from './modules.js';

// User: 「看機率，三分之一吧」. About one floor in five has no closet that qualifies, so a floor that has one rolls 41%, which
// puts a vault on about a third of floors 1-6 (32.8% over seeds 1-60; deeper endless floors have fewer closets, 7.2%).
export const VAULT_TUNING=Object.freeze({chance:.41,maxTiles:6,fallbackScrap:45});
const PLASMA=WEAPONS.findIndex(w=>w.id==='plasma');
// The high-rarity list (user: 「高稀有物品，看是要另外維護一個清單」). One entry per vault, equally likely; edit freely.
// Each entry is a ground item, or a function of the vault's hash that returns one.
export const VAULT_LOOT=Object.freeze([
 Object.freeze({id:'exo',name:'外骨骼',item:()=>({type:'exo'})}),
 Object.freeze({id:'plasma',name:'電漿步槍（貫穿、爆裂或速射）',item:h=>{const affixes=dropOnlyAffixes(PLASMA);return {type:'weapon',weapon:PLASMA,affix:affixes[h%affixes.length]};}}),
 Object.freeze({id:'extended_carry',name:'攜行擴充學習資料',item:()=>({type:'learning',learningId:'trait_extended_carry'})}),
]);

const fnv=text=>{let h=2166136261;for(const s of text){h^=s.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const key=p=>`${p.x},${p.y}`;
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
// Floor tiles reachable from start with every door open (vaultable edges too) except `shut`.
function region(map,shut){
 const seen=new Set([key(map.start)]),queue=[map.start];
 for(let i=0;i<queue.length;i++)for(const [dx,dy] of DIRS){
  const a=queue[i],b={x:a.x+dx,y:a.y+dy};if(map.grid[b.y]?.[b.x]!==1||seen.has(key(b)))continue;
  const edge=barrierBetween(map.barriers,a,b);if(shut&&edge===shut||blockedBetween(map.barriers,a,b)&&edge.type!=='door'&&!vaultable(edge))continue;
  seen.add(key(b));queue.push(b);
 }return seen;
}
// A closet: a door that, shut, cuts off a handful of tiles with nothing on them that has to stay reachable.
function closets(map){
 const all=region(map,null),out=[];
 for(const door of map.barriers){
  if(door.type!=='door'||door.hp<=0)continue;
  const kept=region(map,door),inside=[...all].filter(k=>!kept.has(k));
  if(!inside.length||inside.length>VAULT_TUNING.maxTiles)continue;
  const tiles=new Set(inside),on=p=>tiles.has(key(p));
  // Mission objectives, terminals, the armoury weapon and anything lying loose (weapons, lore) have to stay reachable;
  // supply cases may be locked in with the vault.
  if([map.start,map.end,...map.enemies,...map.items,...(map.slots||[]).filter(s=>['objective','terminal','weapon'].includes(s.kind))].some(on)||map.props.some(p=>on(p)&&(p.type==='nest'||p.type==='terminal')))continue;
  const fixtures=new Set(map.props.filter(p=>p.type==='module').flatMap(moduleCells).map(key));
  const free=inside.map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};}).filter(q=>!fixtures.has(key(q))&&![...map.props,...map.items,...map.hazards].some(o=>o.x===q.x&&o.y===q.y)).sort((a,b)=>a.y-b.y||a.x-b.x);
  if(free.length)out.push({door,tile:free[free.length-1]});
 }return out.sort((a,b)=>a.door.id<b.door.id?-1:a.door.id>b.door.id?1:0);
}
export const vaultCapable=map=>Boolean(map?.generation&&closets(map).length&&map.enemies.some(carrierCandidate));
const carrierCandidate=e=>e.hp>0&&!isBossClass(e)&&!isNoncombatant(e)&&!enemyDef(e)?.expendable&&!e.horde&&!['bomber','munition'].includes(enemyDef(e)?.behavior);
export function placeVault(map,seed,floor){
 if(!map?.generation||!Array.isArray(map.barriers))return map;
 if(fnv(`${seed}:${floor}:vault-v1`)/4294967296>=VAULT_TUNING.chance)return map;
 const options=closets(map),pool=map.enemies.filter(carrierCandidate),elites=pool.filter(e=>e.elite),carriers=elites.length?elites:pool;
 if(!options.length||!carriers.length)return map;
 const {door,tile}=options[fnv(`${seed}:${floor}:vault-door`)%options.length],carrier=carriers[fnv(`${seed}:${floor}:vault-key`)%carriers.length];
 const loot=VAULT_LOOT[fnv(`${seed}:${floor}:vault-loot`)%VAULT_LOOT.length].item(fnv(`${seed}:${floor}:vault-pick`));
 Object.assign(door,{open:false,vault:true,locked:true,indestructible:true});
 carrier.keycard=true;
 map.props.push({id:`case-${floor}-vault`,type:'container',kind:'vault',x:tile.x,y:tile.y,opened:false,indestructible:true,contents:[loot]});
 return map;
}

// ---- in play --------------------------------------------------------------------------------------------------------
export const isVaultDoor=b=>b?.type==='door'&&b.vault===true;
export const hasKeycard=g=>(g.player.keycards||[]).includes(g.floor);
export const lockedReason=(g,b)=>b?.locked&&!hasKeycard(g)?'保險室的鐵門鎖著，需要這一層的鑰匙卡':'';
export function unlockVault(g,b){
 const p=g.player;p.keycards=p.keycards.filter(f=>f!==g.floor);b.locked=false;
 g.log('用鑰匙卡打開了保險室的鐵門。',true);
}
export function dropKeycard(g,e){
 if(!e.keycard)return;delete e.keycard;
 g.items.push({...g.enemyDropPoint(e),type:'key'});g.log('鑰匙卡掉在地上了！',true);
}
export function pickKeycard(g){
 const p=g.player;if(!p.keycards.includes(g.floor))p.keycards.push(g.floor);
 g.log('取得鑰匙卡。這一層的保險室打得開了。',true);
}
export const carriesKeycard=e=>e?.keycard===true&&e.hp>0;
// What the vault holds, for the player who opens it: the exoskeleton for a frame too large or one who already has one,
// and a weapon the profile has not unlocked, become scrap instead, so a vault is never wasted.
export function vaultContents(g,item){
 const p=g.player,unusable=item.type==='exo'&&(activeTrait(p,'large')||p.wearables.includes('exo'))||item.type==='weapon'&&!weaponUnlocked(WEAPONS[item.weapon],g.unlockedWeapons);
 if(!unusable)return item;
 g.log(`保險箱裡的東西你用不上，換成 ${VAULT_TUNING.fallbackScrap} 廢料。`);return {type:'scrap',amount:VAULT_TUNING.fallbackScrap};
}
export function floorVaultNote(g){
 if(!g.barriers.some(b=>isVaultDoor(b)&&b.locked))return;
 g.log('這一層有一間上鎖的保險室。鑰匙卡在一名敵人身上：頭上有光點的那一個。');
}

// ---- saves ----------------------------------------------------------------------------------------------------------
const validLoot=i=>Boolean(i)&&(i.type==='exo'&&Object.keys(i).length===1||
 i.type==='learning'&&validLearningId(i.learningId)&&Object.keys(i).length===2||
 i.type==='weapon'&&i.weapon===PLASMA&&dropOnlyAffixes(PLASMA).includes(i.affix)&&affixAllowed(i.weapon,i.affix)&&Object.keys(i).length===3);
export const validVaultCase=c=>c.opened?c.contents.length===0:c.contents.length===1&&validLoot(c.contents[0]);
// One vault door a floor at most, steel and unbreakable; a locked one is shut. One keycard carrier at most.
export function validVaultState(barriers,enemies){
 const doors=barriers.filter(b=>b.vault!==undefined||b.locked!==undefined);
 if(doors.length>1||doors.some(b=>b.type!=='door'||b.vault!==true||b.indestructible!==true||typeof b.locked!=='boolean'||b.locked&&b.open))return false;
 if(barriers.some(b=>b.indestructible!==undefined&&b.vault!==true))return false;
 const carriers=enemies.filter(e=>e.keycard!==undefined);
 return carriers.length<=1&&carriers.every(e=>e.keycard===true);
}
export const validKeycards=p=>Array.isArray(p.keycards)&&p.keycards.length<=64&&new Set(p.keycards).size===p.keycards.length&&p.keycards.every(f=>Number.isSafeInteger(f)&&f>=1&&f<=100000);
