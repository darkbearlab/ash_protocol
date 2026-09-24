// Drawing for the killed-in-action scene (3.174.0; src/kia.js holds the timing and the burst). The renderer calls
// these with itself while `renderer.kia` is set: {start (world ms of the hit), at (tile), blow, burst, frozen}.
// Everything is sized in tiles, so the push-in and the zoom buttons scale it with the board.
import {KIA_TUNING} from './kia.js';
import {drawBurstAir} from './gore-art.js';
import {classSpriteRect} from './class-art.js';
import {tintedSprite} from './operator-color.js';
import {spriteSize} from './target-card.js';

const easeOut=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
const FALL=KIA_TUNING.fallMs;

// The pool that spreads under the body once it is down. (The stains where drops landed are stamped on the floor layer
// by the renderer, src/gore-art.js.) Drawn under the body.
export function drawKiaGround(r,time){
  const k=r.kia,b=k?.burst;if(!b)return;
  const since=time-k.start;if(since<=0)return;
  const c=r.ctx,t=r.tile,a=r.project(k.at.x,k.at.y),pool=Math.min(1,Math.max(0,(since-FALL)/1600));
  if(pool>0){c.fillStyle='rgba(92,15,18,.72)';c.beginPath();c.ellipse(a.x+k.blow.dx*t*.03,a.y+t*.15,t*(.09+.26*pool),t*(.06+.13*pool),0,0,Math.PI*2);c.fill();}
}

// The body: standing and flashing while the world is frozen, knocked a little away from the blow and tipping over,
// then the fallen sprite settling (the same fallen sprite as an ordinary corpse).
const scratch=typeof document!=='undefined'?document.createElement('canvas'):null;
export function drawKiaBody(r,a,character,time,dark=false){
  const k=r.kia,t=r.tile,size=spriteSize(t),c=r.ctx,since=time-k.start;
  const blow=k.blow,kick=blow?t*.06:0,dx=blow?.dx??0,dy=blow?.dy??0;
  if(k.frozen||since<=0){
    r.classSprite(a,size,character,false,dark);
    if(k.frozen)flash(r,a,size,character,blow?'rgba(255,245,230,.85)':'rgba(150,230,120,.75)');
    return;
  }
  const f=Math.min(1,since/FALL);
  if(f<.45){
    const q=easeOut(f/.45),tilt=(blow?Math.sign(dx||1)*.3:.15)*q;
    c.save();c.translate(Math.round(a.x+dx*kick*q),Math.round(a.y+dy*kick*q+t*.03*q));c.rotate(tilt);r.classSprite({x:0,y:0},size,character,false,dark);c.restore();
  }else{
    const q=easeOut((f-.45)/.55);
    r.classSprite({x:a.x+dx*kick+(1-q)*t*.044,y:a.y+dy*kick-(1-q)*t*.088+t*.03},size,character,true,dark);
  }
}
function flash(r,a,size,character,color){
  const image=r.classSprites;if(!scratch||!image?.complete||!image.naturalWidth)return;
  const rect=classSpriteRect(character,false),tinted=tintedSprite(image,rect,r.operatorColor,r.tintCache,r.operatorTint);
  scratch.width=rect.w;scratch.height=rect.h;const s=scratch.getContext('2d');
  s.clearRect(0,0,rect.w,rect.h);s.drawImage(tinted||image,tinted?0:rect.x,tinted?0:rect.y,rect.w,rect.h,0,0,rect.w,rect.h);
  s.globalCompositeOperation='source-atop';s.fillStyle=color;s.fillRect(0,0,rect.w,rect.h);s.globalCompositeOperation='source-over';
  r.ctx.drawImage(scratch,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);
}

// In the air: the burst (src/gore-art.js), with only a bright core while the world is frozen.
export function drawKiaAir(r,time){
  const k=r.kia;if(!k?.burst)return;
  drawBurstAir(r.ctx,r.tile,r.project(k.at.x,k.at.y),k.burst,time-k.start,k.frozen);
}
