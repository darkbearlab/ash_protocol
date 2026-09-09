import {sizeModifier,movementModifier,activeTrait,correctionBonus,sidestepPenalty} from './traits.js';
// Symmetric, bounded corner leaning. The player and AI use the same geometry.
import {DIRECTIONS,distance,lineOfSight} from './world.js';

export function adjacentWalls(grid,actor) {
  return DIRECTIONS.filter(([dx,dy])=>grid[actor.y+dy]?.[actor.x+dx]!==1)
    .map(([dx,dy])=>({x:actor.x+dx,y:actor.y+dy,type:'wall',indestructible:true}));
}
function anchors(grid,p) {
  const out=[{x:p.x,y:p.y}];
  if(!adjacentWalls(grid,p).length)return out;
  // Lean just beyond a tile edge into a WALKABLE neighboring cell, never through a wall.
  for(const [dx,dy]of DIRECTIONS)if(grid[p.y+dy]?.[p.x+dx]===1)out.push({x:p.x+dx*.6,y:p.y+dy*.6});
  return out;
}
export function combatSight(grid,a,b) {
  if(lineOfSight(grid,a,b))return true;
  const origins=anchors(grid,a),targets=anchors(grid,b);
  for(const origin of origins)for(const target of targets)if(lineOfSight(grid,origin,target))return true;
  return false;
}
export function wallCover(grid,target,attacker) {
  const dx=attacker.x-target.x,dy=attacker.y-target.y;
  return adjacentWalls(grid,target).find(w=>{
    const wx=w.x-target.x,wy=w.y-target.y,dot=wx*dx+wy*dy;
    if(dot>0)return true;
    if(dot<0)return false;
    // A flat wall parallel to a shot gives no protection; its open end does.
    return grid[w.y+Math.sign(dy)]?.[w.x+Math.sign(dx)]===1;
  });
}
export const bracingBonus=(game,attacker,target)=>activeTrait(attacker,'braced')&&game.protectingCover(attacker,target)?12:0;
export function shotChance(game,attacker,target) {
  const cover=game.protectingCover(target,attacker);
  const moving=Boolean(target.moved);
  const weapon=attacker===game.player?game.weapon:null,accuracyBonus=weapon?.accuracyBonus||0;
  const base=97,movePenalty=moving?Math.max(0,22+movementModifier(target)-(weapon?.tracking||0)):0,coverPenalty=cover?(cover.type==='wall'?42:35):0;
  const focusBonus=attacker.focus?15:0,evasionPenalty=target.evasive?15:0;
  const bracedBonus=bracingBonus(game,attacker,target),trackingBonus=correctionBonus(attacker,target===game.player?'player':target.id,game.turn),sideBase=sidestepPenalty(attacker,target);
  // In the open, lateral evasion must match wall cover even against tracking.
  const sidePenalty=sideBase?Math.max(sideBase,cover?0:42-movePenalty):0;
  const chance=Math.max(10,Math.min(99,base+sizeModifier(target)+accuracyBonus+focusBonus+bracedBonus+trackingBonus-movePenalty-coverPenalty-evasionPenalty-sidePenalty));
  return {chance,bracedBonus,trackingBonus,sidePenalty,base,accuracyBonus,movePenalty,coverPenalty,focusBonus,evasionPenalty,cover,moving,distance:distance(attacker,target)};
}
