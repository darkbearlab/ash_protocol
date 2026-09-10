// Angles measured from the defender toward the adjacent cover.
// Compare forward/lateral components exactly; no atan or rounded degrees at thresholds.
export function coverEfficiency(cover,target,attacker){
  if(!cover)return 0;
  const nx=cover.x-target.x,ny=cover.y-target.y,dx=attacker.x-target.x,dy=attacker.y-target.y;
  const forward=nx*dx+ny*dy,lateral=Math.abs(nx*dy-ny*dx);
  if(forward<=0||lateral>=2*forward)return 0;
  return lateral<forward?1:.5;
}
export function coverEffects(cover,target,attacker){
  const efficiency=coverEfficiency(cover,target,attacker);
  const strong=cover&&['wall','door','partition'].includes(cover.type);
  return {efficiency,penalty:Math.round((strong?42:35)*efficiency),reduction:.45*efficiency};
}
export function bestCover(candidates,target,attacker){
  let best,score=0;
  for(const cover of candidates){const penalty=coverEffects(cover,target,attacker).penalty;if(penalty>score){best=cover;score=penalty;}}
  return best;
}
