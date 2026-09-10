import {lightingEffects} from './lighting.js';
import {bestCover,coverEffects} from './cover.js';
import {blockedBetween,edgeAdjacent,edgeBlocks} from './barriers.js';
import {sizeModifier,movementModifier,activeTrait,correctionBonus,sidestepPenalty} from './traits.js';
// Symmetric, bounded corner leaning. The player and AI use the same geometry.
import {DIRECTIONS,distance,lineOfSight} from './world.js';

export function adjacentWalls(grid,actor) {
  return DIRECTIONS.filter(([dx,dy])=>grid[actor.y+dy]?.[actor.x+dx]!==1)
    .map(([dx,dy])=>({x:actor.x+dx,y:actor.y+dy,type:'wall',indestructible:true}));
}
function anchors(grid,p,barriers,channel) {
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
  if(attacker===game.player&&game.weapon.melee)return {chance:game.weapon.hitChance,base:game.weapon.hitChance,bracedBonus:0,trackingBonus:0,sidePenalty:0,accuracyBonus:0,movePenalty:0,coverPenalty:0,coverEfficiency:0,coverReduction:0,darkPenalty:0,focusBonus:0,evasionPenalty:0,cover:null,moving:Boolean(target.moved),distance:distance(attacker,target)};
  const cover=game.protectingCover(target,attacker),protection=coverEffects(cover,target,attacker);
  const light=lightingEffects(game,attacker,target),darkPenalty=light.penalty;
  const moving=Boolean(target.moved);
  const weapon=attacker===game.player?game.weapon:null,accuracyBonus=weapon?.accuracyBonus||0;
  const base=97,movePenalty=moving?Math.max(0,22+movementModifier(target)-(weapon?.tracking||0)):0,coverPenalty=protection.penalty;
  const focusBonus=attacker.focus?15:0,evasionPenalty=target.evasive?15:0;
  const bracedBonus=bracingBonus(game,attacker,target),trackingBonus=correctionBonus(attacker,target===game.player?'player':target.id,game.turn),sideBase=sidestepPenalty(attacker,target);
  // In the open, lateral evasion must match wall cover even against tracking.
  const sidePenalty=sideBase?Math.max(sideBase,cover?0:42-movePenalty):0;
  const chance=Math.max(10,Math.min(99,base+sizeModifier(target)+accuracyBonus+focusBonus+bracedBonus+trackingBonus-movePenalty-coverPenalty-evasionPenalty-sidePenalty-darkPenalty));
  return {chance,darkPenalty,dark:light.dark,nightVision:light.nightVision,coverEfficiency:protection.efficiency,coverReduction:protection.reduction,bracedBonus,trackingBonus,sidePenalty,base,accuracyBonus,movePenalty,coverPenalty,focusBonus,evasionPenalty,cover,moving,distance:distance(attacker,target)};
}
