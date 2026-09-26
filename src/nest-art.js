import {nestStyle,NEST_STYLES} from './runtime-enemies.js';
export const NEST_ATLAS=new URL('../assets/pixel/nests-v1/atlas.png',import.meta.url).href;
export const NEST_EFFECT_MS=280;
// 3.194.0 (user): survival reinforcements step out of the rift portal (row 2 of the nest atlas): it opens, holds while
// the enemy appears inside it, and collapses away. No RNG; the motes are placed by angle.
export const PORTAL_EFFECT_MS=600;
export function drawPortalEffect(c,image,a,tile,elapsed){
 if(elapsed<0||elapsed>=PORTAL_EFFECT_MS)return;
 const u=elapsed/PORTAL_EFFECT_MS,open=Math.min(1,u/.3),closing=u>.7?(u-.7)/.3:0,size=tile*1.3*(.35+.65*open)*(1-.35*closing);
 c.save();c.globalAlpha=1-closing*.9;
 if(!drawNestSprite(c,image,a,size,'rift',closing?'collapse':'active')){c.fillStyle='#b06cff';c.fillRect(a.x-size*.2,a.y-size*.3,size*.4,size*.6);}
 c.fillStyle='#d9b3ff';
 for(let i=0;i<8;i++){const angle=i*.785+u*2.2,r=tile*(.18+.42*u);c.fillRect(Math.round(a.x+Math.cos(angle)*r),Math.round(a.y+Math.sin(angle)*r*.8),2,2);}
 c.restore();
}
export function drawNestSprite(c,image,a,tile,style,state){
 const column={dormant:0,active:1,collapse:2,ruins:3}[state],row=style==='rift'?1:0;
 if(!image?.complete||!image.naturalWidth)return false;
 c.drawImage(image,column*32,row*32,32,32,Math.round(a.x-tile/2),Math.round(a.y-tile/2),Math.round(tile),Math.round(tile));return true;
}
export function drawNest(c,image,a,tile,p,faction){
 const style=nestStyle(p,faction),state=p.hp<=0?'ruins':p.nest.active?'active':'dormant';
 if(drawNestSprite(c,image,a,tile,style,state))return;
 c.fillStyle=NEST_STYLES[style].color;c.fillRect(a.x-tile*.3,a.y+tile*.1,tile*.6,tile*(p.hp>0?.2:.08));
 if(p.hp>0){c.fillStyle='#171b20';c.fillRect(a.x-tile*.2,a.y+tile*.11,tile*.4,tile*.1);}
}
export function drawNestEffect(c,image,fx,a,b,tile,elapsed){
 if(elapsed<0||elapsed>=NEST_EFFECT_MS)return;
 const style=fx.nestStyle,color=NEST_STYLES[style]?.color||NEST_STYLES.burrow.color,u=elapsed/NEST_EFFECT_MS,collapse=fx.type==='nestCollapse';
 c.save();c.globalAlpha=1-u;
 if(collapse)drawNestSprite(c,image,a,tile,style,'collapse');
 // Short square motes for portals; falling earth clods for burrows. No RNG.
 const center=collapse?a:b;
 for(let i=0;i<(fx.quiet?3:7);i++){
  const angle=i*2.4,r=tile*(.08+.3*u),x=center.x+Math.cos(angle)*r;
  const y=center.y+Math.sin(angle)*r*(style==='rift'?1:.4)+(style==='burrow'?(u*u-u)*tile*.5:0);
  c.fillStyle=color;const size=style==='rift'?2:3;c.fillRect(Math.round(x),Math.round(y),size,size);
 }
 c.restore();
}
