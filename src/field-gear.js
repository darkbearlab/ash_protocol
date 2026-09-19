// Field gear (3.144.0, user decisions 2026-09-19; docs/ITEMS.md 誘餌、地雷、外骨骼): three player-only items.
// - 誘餌 (decoy): thrown up to 5 tiles. Every enemy within 6 tiles of where it lands forgets where you are, goes for the
//   decoy instead and cannot see you (the recon's 訊號斷層, per enemy). An enemy you attack, and any fooled enemy that
//   can see it being attacked, snaps out of it; so does one that ends up next to you. Bosses, suicide units and
//   non-combatants are never fooled. It has 30 HP and lasts 4 turns; fooled enemies still fight your allies.
// - 地雷 (mine): placed up to 3 tiles away, at most 3 on a floor. A walking enemy that steps on it sets it off: 60 at
//   the centre, 50 a tile away, like every blast (−10 a tile), plus 爆破專家. You and your allies never set it off but
//   are caught in its blast; other blasts set it off. Enemies cannot see mines; one that watched you lay it avoids it.
//   Mines left behind are gone when you change floors.
// - 外骨骼 (exoskeleton): a wearable. Ranged hit +10, melee damage +20%, and 50 armour plates of its own that take their
//   share of each hit before your plates do. When they are gone the frame breaks, is lost and pins you: 5 suppression
//   stacks. Nothing repairs it, and a large frame (the bulwark) cannot wear it.
import {distance} from './world.js';
import {enemyDef,hasEnemyTag,isBossClass,isNoncombatant} from './enemy-data.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {applySuppression} from './suppression.js';
import {activeTrait} from './traits.js';
import {syncWearableTraits} from './prepared.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {EXO_ACCURACY} from './actor-stats.js';

export const DECOY_TUNING=Object.freeze({range:5,radius:6,duration:4,hp:30,hit:85});
export const MINE_TUNING=Object.freeze({range:3,radius:1,damage:60,max:3});
export const EXO_TUNING=Object.freeze({plates:50,accuracy:EXO_ACCURACY,melee:1.2,suppression:5});

const floorTile=(g,pos)=>Boolean(pos)&&Number.isInteger(pos.x)&&Number.isInteger(pos.y)&&g.grid[pos.y]?.[pos.x]===1;
const standing=(g,pos)=>[g.player,...g.enemies.filter(e=>e.hp>0),...g.activeAllies].some(a=>a.x===pos.x&&a.y===pos.y);

// ---- 誘餌 ------------------------------------------------------------------------------------------------------------
// Only enemies that fight the ordinary way can be drawn off: bosses see through it, and suicide units and munitions
// have no attack to spend on it.
const foolable=e=>e.hp>0&&!isNoncombatant(e)&&!isBossClass(e)&&!enemyDef(e)?.expendable&&!['bomber','munition'].includes(enemyDef(e)?.behavior);
export function decoyReason(g,pos){
 const p=g.player;
 if(!(p.decoys>0))return '沒有誘餌';
 if(!floorTile(g,pos))return '先選擇看得見的地板作為落點';
 if(distance(p,pos)>DECOY_TUNING.range||!g.visible(pos))return `落點需在視線內 ${DECOY_TUNING.range} 格以內`;
 return '';
}
export function throwDecoy(g,pos){
 const p=g.player;p.decoys--;p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
 const fooled=g.enemies.filter(e=>foolable(e)&&distance(e,pos)<=DECOY_TUNING.radius);
 for(const e of fooled){e.alert=true;e.lastKnown={x:pos.x,y:pos.y};}
 g.decoy={x:pos.x,y:pos.y,hp:DECOY_TUNING.hp,maxHp:DECOY_TUNING.hp,expires:g.turn+DECOY_TUNING.duration-1,fooled:fooled.map(e=>e.id)};
 g.effects.push({type:'shot',style:'grenade',from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
 g.log(fooled.length?`誘餌啟動：${fooled.length} 名敵人被引開，看不到你。`:'誘餌啟動，附近沒有敵人上當。');
 return true;
}
export const fooled=(g,e)=>Boolean(g.decoy?.hp>0&&e?.id&&g.decoy.fooled.includes(e.id));
// The one check sight() asks: a fooled enemy does not see you, unless it is right next to you.
export const decoyHides=(g,a)=>fooled(g,a)&&distance(a,g.player)>1;
const release=(g,ids)=>{if(g.decoy)g.decoy.fooled=g.decoy.fooled.filter(id=>!ids.includes(id));};
// You attacked `e`: it, and every fooled enemy that could see it happen, stop falling for the decoy.
export function noticeAttack(g,e){
 if(!g.decoy||!e?.id)return;
 const witnesses=g.enemies.filter(o=>o!==e&&fooled(g,o)&&o.hp>0&&g.sight(o,e)).map(o=>o.id);
 if(fooled(g,e)||witnesses.length){release(g,[e.id,...witnesses]);g.log('攻擊暴露了你：被誘餌引開的敵人回過神來。',true);}
}
export function damageDecoy(g,amount){
 const d=g.decoy;if(!d)return;
 d.hp=Math.max(0,d.hp-amount);g.effects.push({type:'impact',from:{x:d.x,y:d.y},to:{x:d.x,y:d.y},damage:amount});
 if(d.hp<=0){g.decoy=null;g.log('誘餌被摧毀，被引開的敵人不再上當。',true);}
}
// A fooled enemy's turn: next to you it sees through the decoy (and the ordinary turn runs); with the decoy in reach it
// spends the turn on it; otherwise the ordinary turn walks it to the decoy, which is where it now thinks you are.
export function decoyAct(g,e){
 if(!fooled(g,e))return false;
 if(distance(e,g.player)<=1){release(g,[e.id]);return false;}
 const d=g.decoy,def=enemyDef(e),range=def?.range||1;
 if(distance(e,d)>range||(range>1?!g.shotClear(e,d):false))return false;
 const damage=def.expendable?def.damage:scaleEnemy(def.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec),hit=g.rng()*100<DECOY_TUNING.hit;
 e.facing=[Math.sign(d.x-e.x),Math.sign(d.y-e.y)];
 g.effects.push({type:'enemyShot',attackerType:e.type,style:def.attackStyle,from:{x:e.x,y:e.y},to:{x:d.x,y:d.y},damage:0,miss:!hit});
 if(hit){g.log(`${enemyDisplayName(e)}攻擊誘餌（${damage}）。`,false,`${enemyDisplayName(e)}攻擊誘餌。`);damageDecoy(g,damage);}else g.log(`${enemyDisplayName(e)}沒打中誘餌。`,false,`${enemyDisplayName(e)}沒打中誘餌。`);
 return true;
}
// The turn counts up before anyone acts, so a decoy thrown this turn sees four enemy rounds (like a flare's count).
export function tickDecoy(g){if(g.decoy&&g.turn>=g.decoy.expires){g.decoy=null;g.log('誘餌的電力耗盡。');}}
export const validDecoy=g=>g.decoy===null||Boolean(g.decoy)&&floorTile(g,g.decoy)&&Number.isInteger(g.decoy.hp)&&g.decoy.hp>0&&g.decoy.maxHp===DECOY_TUNING.hp&&g.decoy.hp<=g.decoy.maxHp&&Number.isInteger(g.decoy.expires)&&g.decoy.expires>g.turn&&g.decoy.expires<=g.turn+DECOY_TUNING.duration&&Array.isArray(g.decoy.fooled)&&g.decoy.fooled.every(id=>typeof id==='string');

// ---- 地雷 ------------------------------------------------------------------------------------------------------------
export const mineAt=(g,x,y)=>(g.mines||[]).find(m=>m.x===x&&m.y===y)||null;
// Pathing asks this with the walker: an enemy that watched the mine go down walks around it.
export const knownMine=(g,actor,x,y)=>Boolean(actor?.id&&(g.mines||[]).some(m=>m.x===x&&m.y===y&&m.seen.includes(actor.id)));
export function mineReason(g,pos){
 const p=g.player;
 if(!(p.mines>0))return '沒有地雷';
 if((g.mines||[]).length>=MINE_TUNING.max)return `同一層最多 ${MINE_TUNING.max} 顆地雷`;
 if(!floorTile(g,pos))return '先選擇看得見的地板';
 if(distance(p,pos)>MINE_TUNING.range||!g.visible(pos))return `埋設點需在視線內 ${MINE_TUNING.range} 格以內`;
 if(standing(g,pos)||g.solid(pos.x,pos.y)||g.props.some(o=>o.x===pos.x&&o.y===pos.y)||mineAt(g,pos.x,pos.y))return '那一格已經有東西';
 if(g.exitPoint&&g.exitPoint.x===pos.x&&g.exitPoint.y===pos.y)return '出口不能埋地雷';
 return '';
}
export function placeMine(g,pos){
 const p=g.player;p.mines--;p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
 const seen=g.enemies.filter(e=>e.hp>0&&g.sight(e,pos)).map(e=>e.id);
 g.mineSerial=(g.mineSerial||0)+1;g.mines=[...(g.mines||[]),{id:`mine-${g.floor}-${g.mineSerial}`,x:pos.x,y:pos.y,seen}];
 g.log(seen.length?`地雷埋好了，但有 ${seen.length} 名敵人看見，會繞開它。`:'地雷埋好了。');
 return true;
}
export function detonateMine(g,m){
 if(!(g.mines||[]).includes(m))return;
 g.mines=g.mines.filter(o=>o!==m);g.log('地雷引爆！',true);
 g.explode({x:m.x,y:m.y},MINE_TUNING.radius,MINE_TUNING.damage+(g.player.blastBonus||0),g.player);
}
// After anything moves: a walking enemy standing on a mine sets it off. Flying ones pass over.
export function checkMines(g){
 for(const m of [...(g.mines||[])]){const e=g.enemies.find(e=>e.hp>0&&e.x===m.x&&e.y===m.y&&!hasEnemyTag(e,'flying'));if(e)detonateMine(g,m);}
}
export const validMines=g=>Array.isArray(g.mines)&&g.mines.length<=MINE_TUNING.max&&new Set(g.mines.map(m=>`${m.x},${m.y}`)).size===g.mines.length&&g.mines.every(m=>m&&typeof m.id==='string'&&floorTile(g,m)&&Array.isArray(m.seen)&&m.seen.every(id=>typeof id==='string'))&&Number.isInteger(g.mineSerial)&&g.mineSerial>=g.mines.length;

// ---- 外骨骼 ----------------------------------------------------------------------------------------------------------
export const wearingExo=p=>activeTrait(p,'exoskeleton');
export const exoReason=p=>activeTrait(p,'large')?'體型太大，穿不下外骨骼':'';
// Its plates take their share of a hit first; `half` is the share every armour plate may take (half the hit).
export function exoAbsorb(g,half){
 const p=g.player;if(!wearingExo(p)||!(p.exoPlates>0))return 0;
 const taken=Math.min(p.exoPlates,half);p.exoPlates-=taken;return taken;
}
export function breakExo(g){
 const p=g.player;p.exoPlates=0;p.wearables=p.wearables.filter(id=>id!=='exo');if(p.prepared.item==='exo')p.prepared={...p.prepared,item:null};
 syncWearableTraits(p);applySuppression(p,EXO_TUNING.suppression);
 g.log('外骨骼損毀！你被壓制在原地。',true);
}
export const validExo=p=>Number.isInteger(p.exoPlates)&&p.exoPlates>=0&&p.exoPlates<=EXO_TUNING.plates&&(p.wearables.includes('exo')?p.exoPlates>0:p.exoPlates===0);
