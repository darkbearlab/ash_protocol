import {validLearningId} from './learning-data.js';
import {unlockRandom} from './run-unlocks.js';
import {WEAPONS} from './data.js';
// Low floor cases: walkable, no cover or destruction. Contents move to ground exactly once.
export const CONTAINER_KINDS={
  unknown:{name:'未識別貨櫃',color:'#94bbc3',symbol:'?'},
  ammo:{name:'彈藥箱',color:'#d9bd7b',symbol:'R'},medical:{name:'醫療箱',color:'#a9d9ac',symbol:'+'},
  armor:{name:'護甲箱',color:'#92c4df',symbol:'▣'},ordnance:{name:'投擲物箱',color:'#b8c694',symbol:'G'},
  salvage:{name:'廢料箱',color:'#c5a171',symbol:'◇'},supply:{name:'補給箱',color:'#c9c6ac',symbol:'·'},
};
const types=new Set(['ammo','pistol','shell','energy','ordnance','grenade','emp','stun','smoke','med','armor','scrap']);
export const isContainer=o=>o?.type==='container';
// Rigged cases (3.100.0, user request): rebel floors leave booby-trapped cases among the real ones. A normal case is
// indestructible and carries no hp, so it can never be locked; a rigged one has hp, which is the only tell — tapping it
// locks on, exactly as it would on a barrel. Props are never auto-locked and never enter the ⌖ cycle, both of which
// read visibleEnemies, so the player has to go looking.
export const RIG_TUNING={hp:18,perFloor:2,chance:.25,radius:2};
export const isRigged=o=>isContainer(o)&&o.rigged===true;
// Keyed on (seed, floor, case id) rather than the map RNG, so geometry and every existing map stay bit-identical.
export function rigContainers(g){
 if(g.simulation||g.facilityFaction!=='rebel')return g;
 let rigged=0;
 for(const c of g.props){
  if(rigged>=RIG_TUNING.perFloor)break;
  if(!isContainer(c)||c.opened||c.rigged||!c.contents.length)continue;
  if(unlockRandom(g.seed,g.floor,`rig-${c.id}`)>=RIG_TUNING.chance)continue;
  delete c.indestructible;c.hp=RIG_TUNING.hp;c.maxHp=RIG_TUNING.hp;c.rigged=true;rigged++;
 }
 return g;
}
export const containerName=o=>CONTAINER_KINDS[o.kind]?.name||'補給箱';
const kindFor=type=>['ammo','pistol','shell','energy','ordnance'].includes(type)?'ammo':['grenade','emp','stun','smoke'].includes(type)?'ordnance':type==='med'?'medical':type==='armor'?'armor':type==='scrap'?'salvage':'supply';
export function packSupplies(map,floor){
  const grouped=new Set(),cases=[];
  const pack=(items,pos,kind)=>{
    if(!items.length)return;
    const contents=items.map(({type,amount,cache})=>({type,...(amount!==undefined?{amount}:{}),...(cache?{cache:true}:{})}));
    cases.push({id:`case-${floor}-${cases.length}`,type:'container',kind,x:pos.x,y:pos.y,opened:false,indestructible:true,contents});
    for(const i of items)grouped.add(i);
  };
  for(const r of map.rooms.filter(r=>r.supply)){
    const contents=map.items.filter(i=>i.cache&&types.has(i.type)&&i.x>=r.x&&i.x<r.x+r.w&&i.y>=r.y&&i.y<r.y+r.h);
    // Keep the case at an already reserved supply tile, so geometry and RNG are unchanged.
    if(contents.length)pack(contents,contents.find(i=>i.x===r.cx&&i.y===r.cy)||contents[0],r.supply);
  }
  for(const item of map.items)if(types.has(item.type)&&!grouped.has(item)){
    const contents=map.items.filter(i=>!grouped.has(i)&&types.has(i.type)&&i.x===item.x&&i.y===item.y);
    const existing=cases.find(c=>c.x===item.x&&c.y===item.y);
    if(existing){for(const i of contents){const {type,amount,cache}=i;existing.contents.push({type,...(amount!==undefined?{amount}:{}),...(cache?{cache:true}:{})});grouped.add(i);}}
    else pack(contents,item,contents.every(i=>kindFor(i.type)===kindFor(item.type))?kindFor(item.type):'supply');
  }
  map.items=map.items.filter(i=>!grouped.has(i));map.props.push(...cases);return map;
}
// Used by conservation tests/headless routing, never by the player-facing map.
export const allSupplies=map=>[...map.items,...map.props.filter(isContainer).flatMap(c=>c.contents.map(i=>({...i,x:c.x,y:c.y})))];
export function validContainers(props,grid,otherIds=[]){
  const ids=new Set(otherIds),positions=new Set();let count=0;
  for(const p of props){
    if(!isContainer(p))continue;
    if(++count>128||typeof p.id!=='string'||!/^case-[a-zA-Z0-9_-]{1,90}$/.test(p.id)||ids.has(p.id))return false;
    if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||grid[p.y]?.[p.x]!==1||positions.has(`${p.x},${p.y}`))return false;
    if(!Object.hasOwn(CONTAINER_KINDS,p.kind)||typeof p.opened!=='boolean')return false;
    // A case is either an ordinary indestructible one or a rigged one with hp; nothing in between.
    if(p.rigged===undefined){if(p.indestructible!==true||p.hp!==undefined||p.maxHp!==undefined)return false;}
    else if(p.rigged!==true||p.indestructible!==undefined||!Number.isInteger(p.maxHp)||p.maxHp<1||p.maxHp>100||!Number.isInteger(p.hp)||p.hp<0||p.hp>p.maxHp)return false;
    if(!Array.isArray(p.contents)||p.contents.length>32||(p.opened?p.contents.length!==0:p.contents.length===0&&p.kind!=='unknown'))return false;
    if(p.contents.some(i=>!i||(i.type==='learning'?(!validLearningId(i.learningId)||Object.keys(i).some(k=>!['type','learningId'].includes(k))):i.type==='weapon'?(!Number.isInteger(i.weapon)||!WEAPONS[i.weapon]||WEAPONS[i.weapon].locked||Object.keys(i).some(k=>!['type','weapon'].includes(k))):(!types.has(i.type)||(i.amount!==undefined&&(!Number.isSafeInteger(i.amount)||i.amount<=0||i.amount>10000000))||(i.cache!==undefined&&i.cache!==true)||Object.keys(i).some(k=>!['type','amount','cache'].includes(k))))))return false;
    ids.add(p.id);positions.add(`${p.x},${p.y}`);
  }return true;
}
