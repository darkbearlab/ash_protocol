import {actorStat} from './actor-stats.js';
import {PERK_D,VOID} from './data.js';
import {lightingEffects} from './lighting.js';
import {bestCover,coverEffects} from './cover.js';
import {blockedBetween,edgeAdjacent,edgeBlocks} from './barriers.js';
import {sizeModifier,movementModifier,activeTrait,correctionBonus,sidestepPenalty,POINT_BLANK} from './traits.js';
// Symmetric, bounded corner leaning. The player and AI use the same geometry.
import {DIRECTIONS,distance,lineOfSight} from './world.js';
import {weaponBand,bandPenalty} from './range-band.js';
import {toxicShot} from './swarm-fields.js';
import {classPerkRank,CLASS_PERK_TUNING,markValues} from './class-perks.js';

export function adjacentWalls(grid,actor) {
  // 3.164.0: a pit is not a wall — nothing to lean on at its edge.
  return DIRECTIONS.filter(([dx,dy])=>grid[actor.y+dy]?.[actor.x+dx]!==1&&grid[actor.y+dy]?.[actor.x+dx]!==VOID)
    .map(([dx,dy])=>({x:actor.x+dx,y:actor.y+dy,type:'wall',indestructible:true}));
}
export function anchors(grid,p,barriers,channel) {
  const out=[{x:p.x,y:p.y}];
  if(!Number.isInteger(p.x)||!Number.isInteger(p.y))return out;
  if(!adjacentWalls(grid,p).length&&!barriers.some(b=>edgeAdjacent(b,p)&&edgeBlocks(b,channel)))return out;
  // Lean just beyond a tile edge into a WALKABLE neighboring cell, never through a wall.
  for(const [dx,dy]of DIRECTIONS)if(grid[p.y+dy]?.[p.x+dx]===1&&!blockedBetween(barriers,p,{x:p.x+dx,y:p.y+dy},channel))out.push({x:p.x+dx*.6,y:p.y+dy*.6});
  return out;
}
export function combatSight(grid,a,b,barriers=[],channel='sight') {
  if(lineOfSight(grid,a,b,barriers,channel))return true;
  const origins=anchors(grid,a,barriers,channel),targets=anchors(grid,b,barriers,channel);
  for(const origin of origins)for(const target of targets)if(lineOfSight(grid,origin,target,barriers,channel))return true;
  return false;
}
export function wallCover(grid,target,attacker) {
  return bestCover(adjacentWalls(grid,target),target,attacker);
}
export const bracingBonus=(game,attacker,target)=>activeTrait(attacker,'braced')&&game.protectingCover(attacker,target)?12:0;
export function shotChance(game,attacker,target) {
  if(attacker===game.player&&game.weapon.melee)return {chance:game.meleeAccuracy(attacker,target,game.weapon.hitChance),innateAccuracy:actorStat(attacker,'meleeAccuracy'),innateEvasion:actorStat(target,'meleeEvasion'),base:game.weapon.hitChance,bracedBonus:0,trackingBonus:0,sidePenalty:0,accuracyBonus:0,movePenalty:0,coverPenalty:0,coverEfficiency:0,coverReduction:0,darkPenalty:0,rangePenalty:0,band:null,pointBlank:false,pointBlankBonus:0,focusBonus:0,evasionPenalty:0,cover:null,moving:Boolean(target.moved),distance:distance(attacker,target)};
  // 3.155.0 貼身射擊 (the ninja): inside POINT_BLANK.range a gun ignores cover and the target's movement, and steadies.
  const pointBlank=!game.weapon?.melee&&activeTrait(attacker,'point_blank')&&distance(attacker,target)<=POINT_BLANK.range;
  const cover=game.protectingCover(target,attacker),protection=coverEffects(cover,target,attacker);
  // 3.126.0: a squad soldier firing at the tile its leader called out takes blindShot instead of the darkness penalty.
  const light=lightingEffects(game,attacker,target),blindPenalty=attacker.blindShot||0,darkPenalty=blindPenalty?0:light.penalty;
  const moving=Boolean(target.moved);
  const weapon=attacker===game.player?game.weapon:game.actorWeapon?.(attacker),accuracyBonus=weapon?.accuracyBonus||0;
  const innateAccuracy=actorStat(attacker,'rangedAccuracy'),innateEvasion=actorStat(target,'rangedEvasion');
  // 3.148.0 升級 D: 游擊 raises the penalty for shooting you after you moved; 沉著 raises what your wait adds to your aim.
  const base=97,movePenalty=moving&&!pointBlank?Math.max(0,22+movementModifier(target)+PERK_D.skirmish*(target.perks?.skirmish||0)-(weapon?.tracking||0)):0,coverPenalty=pointBlank?0:protection.penalty;
  // 3.125.0: 已就緒 is the squad's wait, so it reads the same two numbers the player's wait does.
  const focusBonus=attacker.focus||activeTrait(attacker,'ready')?15+(attacker.focus?PERK_D.steady*(attacker.perks?.steady||0):0):0,evasionPenalty=target.evasive||activeTrait(target,'ready')?15:0;
  // 3.111.0 (user request): a precision rifle that has not spent a turn aiming is far less accurate. Waiting already sets
  // focus for every weapon, so the aim is the existing wait. Player only: allies and enemies have no way to aim.
  const aimPenalty=attacker===game.player&&weapon?.aimPenalty&&!attacker.focus?weapon.aimPenalty:0;
  const bracedBonus=bracingBonus(game,attacker,target),trackingBonus=correctionBonus(attacker,target===game.player?'player':target.id,game.turn),sideBase=sidestepPenalty(attacker,target);
  // In the open, lateral evasion must match wall cover even against tracking.
  const sidePenalty=sideBase?Math.max(sideBase,cover?0:42-movePenalty):0;
  const closeBonus=weapon?.closeRange&&distance(attacker,target)<=weapon.closeRange?weapon.closeAccuracy:0,vaultBonus=target.vaultExposed?20:0;
  // 3.152.0 有效距離 (src/range-band.js): outside the band each tile costs accuracy, too close as much as too far.
  // 3.153.0: a blind shot (the player's, or a squad soldier's called shot) already pays a flat penalty for not knowing
  // where the target stands, so the distance penalty does not stack on top of it — as with darkness. Cover, movement and
  // evasion still count: without them a blind shot would beat an aimed one whenever a target's defences passed 40.
  const band=weaponBand(weapon),rangePenalty=blindPenalty?0:bandPenalty(band,distance(attacker,target));
  const specialEvasion=(game.defensiveEvasion?.(attacker,target)||0)+(target===game.player&&activeTrait(attacker,'exposed')?markValues(target).evasion:0);
  const pointBlankBonus=pointBlank?POINT_BLANK.accuracy:0;
  // 3.159.0: a marked target is easier for the soldier to hit (src/class-perks.js markValues).
  const markBonus=attacker===game.player&&activeTrait(target,'exposed')?markValues(attacker).accuracy:0;
  const chance=Math.max(10,Math.min(99,pointBlankBonus+markBonus-specialEvasion+closeBonus+vaultBonus+base+innateAccuracy-innateEvasion+sizeModifier(target)+accuracyBonus+focusBonus+bracedBonus+trackingBonus-movePenalty-coverPenalty-evasionPenalty-sidePenalty-darkPenalty-blindPenalty-aimPenalty-rangePenalty));
  // 3.134.0: gunfire or a beam through toxic mist, from anyone but the swarm, hits half as often.
  const toxic=toxicShot(game,attacker,target,weapon);
  return {chance:toxic?Math.max(1,Math.round(chance/2)):chance,toxic,aimPenalty,rangePenalty,band,pointBlank,pointBlankBonus,markBonus,specialEvasion,closeBonus,vaultBonus,innateAccuracy,innateEvasion,darkPenalty,dark:light.dark,nightVision:light.nightVision,coverEfficiency:protection.efficiency,coverReduction:protection.reduction,bracedBonus,trackingBonus,sidePenalty,base,accuracyBonus,movePenalty,coverPenalty,focusBonus,evasionPenalty,cover,moving,distance:distance(attacker,target)};
}
