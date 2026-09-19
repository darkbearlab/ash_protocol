import {distance} from './world.js';
// Shotgun cone (3.112.0, user request; spec in docs/WEAPONS.md). One shell reaches every living enemy and active ally
// inside a cone around the aim, out to the weapon's range. Each target rolls its own hit and its own damage, damage falls
// off with distance in three bands, and a target standing behind something the same blast already reaches is shielded.
// Allies are not spared: the user decided the cone hits friends too.

// The cells a straight shot crosses between two tiles, endpoints excluded. Same stepping as lineOfSight, so "behind"
// here means the same thing it means for sight and shots.
export function rayCells(a,b){
  const cells=[],dx=b.x-a.x,dy=b.y-a.y,sx=Math.sign(dx),sy=Math.sign(dy);
  let x=a.x,y=a.y;
  const stepX=dx?1/Math.abs(dx):Infinity,stepY=dy?1/Math.abs(dy):Infinity;
  let tx=dx?(x+(sx>0?.5:-.5)-a.x)/dx:Infinity,ty=dy?(y+(sy>0?.5:-.5)-a.y)/dy:Infinity;
  for(let i=0;i<256;i++){
    if(Math.abs(tx-ty)<1e-9){x+=sx;y+=sy;tx+=stepX;ty+=stepY;}
    else if(tx<ty){x+=sx;tx+=stepX;}
    else{y+=sy;ty+=stepY;}
    if(x===b.x&&y===b.y)return cells;
    cells.push({x,y});
  }
  return cells;
}

// Inside the cone: the angle between the aim and the target, seen from the shooter, is at most the half-angle.
export function inCone(from,aim,point,halfAngle){
  const ax=aim.x-from.x,ay=aim.y-from.y,px=point.x-from.x,py=point.y-from.y;
  const al=Math.hypot(ax,ay),pl=Math.hypot(px,py);
  if(!al||!pl)return false;
  return (ax*px+ay*py)/(al*pl)>=Math.cos(halfAngle*Math.PI/180)-1e-9;
}

// Nearest first, so a nearer target shields the ones behind it.
export function coneTargets(g,from,aim,w){
  const candidates=[...g.enemies.filter(e=>e.hp>0),...g.activeAllies.filter(a=>a.hp>0)]
    .filter(o=>distance(from,o)<=w.range&&inCone(from,aim,o,w.cone)&&g.visible(o)&&g.shotClear(from,o))
    .sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y));
  const reached=[];
  for(const o of candidates){
    const between=rayCells(from,o);
    if(reached.some(r=>between.some(c=>c.x===r.x&&c.y===r.y)))continue;
    reached.push(o);
  }
  return reached;
}

// The three damage bands. Close and middle are the shotgun's existing numbers; the far band is new with range 6.
export function shotgunBand(w,range){
  if(w.closeRange&&range<=w.closeRange)return {min:w.closeMin,max:w.closeMax,band:'close'};
  if(w.farFrom&&range>=w.farFrom)return {min:w.farMin,max:w.farMax,band:'far'};
  return {min:w.min,max:w.max,band:'mid'};
}

// Pellets (3.141.0, user decisions 2026-09-19; docs/WEAPONS.md). The player's cone lands a number of pellets fixed by
// distance, each rolling a flat pelletHit%: darkness, a moving target, evasion, readiness and the shooter's own accuracy
// do not change it; only the weapon's own affix does (穩定 +10, 擴容 −8), and toxic mist still halves it. Beyond the
// table (a long barrel) one pellet reaches. Enemies' shotguns keep the old single roll.
export const pelletsAt=(w,range)=>w.pellets?(w.pellets[Math.max(1,range)-1]??1):0;
export const pelletChance=(w,toxic=false)=>{const chance=Math.max(10,Math.min(99,(w.pelletHit||0)+(w.affixAccuracy||0)));return toxic?Math.max(1,Math.round(chance/2)):chance;};
