import {ENEMY_TYPES,distance} from './engine.js';

export function targetDetails(game){
  const target=game.targeted;if(!target)return null;
  const enemy=ENEMY_TYPES[target.type],aim=enemy?game.accuracy(game.player,target):{chance:game.fireChance(target)};
  const range=distance(game.player,target),withinRange=range<=game.weapon.range;
  return {name:enemy?.name||(target.type==='barrel'?'爆裂油桶':'可破壞掩體'),hp:`HP ${Math.max(0,target.hp)} / ${target.maxHp??target.hp}`,
    chance:withinRange?`命中 ${aim.chance}%`:'無法射擊',distance:`距離 ${range} 格 / 射程 ${game.weapon.range}`,
    cover:enemy?(aim.cover?aim.cover.type==='wall'?'牆角掩護':'箱體掩護':'無掩護'):'可破壞物',
    state:[withinRange?'':'超出射程',target.moved?'移動中':'',target.charge?'即將攻擊':''].filter(Boolean).join(' · '),withinRange};
}

const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
// Include sprite, health bar and charge marker at every rendered zoom.
export function actorObstacle(point,tile,fallback=false){
  const size=tile<30?16:32*Math.max(1,Math.floor(tile/32));
  const extent=fallback?tile*.8:0;
  const rx=Math.max(18,size/2+3,tile*.38+10,extent),top=Math.max(24,size/2+3,tile*.45+5,extent),bottom=Math.max(20,size/2+3,tile*.58+4,extent);
  return {x:point.x-rx,y:point.y-top,w:rx*2,h:top+bottom};
}
// Actors are hard exclusions. If no free rectangle fits, omit the card.
export function targetCardPlacement({target,player,tile,width,height,cardWidth,cardHeight,obstacles=[],blockers=[],fallbackActors=false}){
  const pad=5,w=cardWidth,h=cardHeight;
  if(w>width-pad*2||h>height-pad*2)return null;
  const hard=[actorObstacle(target,tile,fallbackActors),actorObstacle(player,tile,fallbackActors),...blockers];
  const clampX=x=>Math.round(Math.max(pad,Math.min(width-w-pad,x)));
  const clampY=y=>Math.round(Math.max(pad,Math.min(height-h-pad,y)));
  // All obstacle edges are candidates, including gaps between a crowded group.
  const xs=new Set([pad,width-w-pad,clampX(target.x-w/2)]),ys=new Set([pad,height-h-pad,clampY(target.y-h/2)]);
  for(const o of [...hard,...obstacles]){xs.add(clampX(Math.floor(o.x-w-2)));xs.add(clampX(Math.ceil(o.x+o.w+2)));ys.add(clampY(Math.floor(o.y-h-2)));ys.add(clampY(Math.ceil(o.y+o.h+2)));}
  let best=null;
  for(const x of xs)for(const y of ys){const r={x,y,w,h};
    if(hard.some(o=>overlap(r,o)>0))continue;
    const link={x:Math.max(x,Math.min(x+w,target.x)),y:Math.max(y,Math.min(y+h,target.y))};
    const score=obstacles.reduce((sum,o)=>sum+overlap(r,o)*(o.weight||25),0)+Math.hypot(link.x-target.x,link.y-target.y);
    if(!best||score<best.score)best={...r,link,score};
  }
  return best;
}
