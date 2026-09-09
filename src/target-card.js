import {ENEMY_TYPES,distance} from './engine.js';

export function targetDetails(game){
  const target=game.targeted;if(!target)return null;
  const enemy=ENEMY_TYPES[target.type],aim=enemy?game.accuracy(game.player,target):{chance:Math.min(99,97+(game.player.focus?15:0))};
  const range=distance(game.player,target),withinRange=range<=game.weapon.range;
  return {name:enemy?.name||(target.type==='barrel'?'爆裂油桶':'可破壞掩體'),hp:`HP ${Math.max(0,target.hp)} / ${target.maxHp??target.hp}`,
    chance:withinRange?`命中 ${aim.chance}%`:'無法射擊',distance:`距離 ${range} 格 / 射程 ${game.weapon.range}`,
    cover:enemy?(aim.cover?aim.cover.type==='wall'?'牆角掩護':'箱體掩護':'無掩護'):'可破壞物',
    state:[withinRange?'':'超出射程',target.moved?'移動中':'',target.charge?'即將攻擊':''].filter(Boolean).join(' · '),withinRange};
}

const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
// Place beside the target, flipping at edges. Prefer clear player/target silhouettes,
// then avoid other visible enemies and corner HUD. Tiny viewports use least overlap.
export function targetCardPlacement({target,player,tile,width,height,cardWidth,cardHeight,obstacles=[]}){
  const gap=Math.max(18,tile*.65)+7,pad=5,w=Math.min(cardWidth,width-2*pad),h=Math.min(cardHeight,height-2*pad);
  const candidates=[
    [target.x+gap,target.y-h/2],[target.x-gap-w,target.y-h/2],
    [target.x-w/2,target.y-gap-h],[target.x-w/2,target.y+gap],
    [target.x+gap,target.y-gap-h],[target.x-gap-w,target.y-gap-h],
    [target.x+gap,target.y+gap],[target.x-gap-w,target.y+gap],
    [pad,pad],[width-w-pad,pad],[pad,height-h-pad],[width-w-pad,height-h-pad]
  ];
  const silhouette=p=>({x:p.x-18,y:p.y-22,w:36,h:44});
  let best=null;
  for(const [cx,cy]of candidates){const r={x:Math.round(Math.max(pad,Math.min(width-w-pad,cx))),y:Math.round(Math.max(pad,Math.min(height-h-pad,cy))),w,h};
    const link={x:Math.max(r.x,Math.min(r.x+w,target.x)),y:Math.max(r.y,Math.min(r.y+h,target.y))};
    const score=overlap(r,silhouette(target))*1000+overlap(r,silhouette(player))*800+obstacles.reduce((sum,o)=>sum+overlap(r,o)*(o.weight||25),0)+Math.hypot(link.x-target.x,link.y-target.y);
    if(!best||score<best.score)best={...r,link,score};
  }
  return best;
}
