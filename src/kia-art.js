// Drawing for the killed-in-action scene (3.174.0; src/kia.js holds the timing and the burst). The renderer calls
// these with itself while `renderer.kia` is set: {start (world ms of the hit), at (tile), blow, burst, frozen}.
// Everything is sized in tiles, so the push-in and the zoom buttons scale it with the board.
import {KIA_TUNING,burstReach} from './kia.js';
import {classSpriteRect} from './class-art.js';
import {tintedSprite} from './operator-color.js';
import {spriteSize} from './target-card.js';

const easeOut=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
const FALL=KIA_TUNING.fallMs;

// Blood that stays on the floor: the pool under the body and the stains where drops landed. Drawn under the body.
export function drawKiaGround(r,time){
  const k=r.kia,b=k?.burst;if(!b)return;
  const since=time-k.start,s=since/1000;if(s<=0)return;
  const c=r.ctx,t=r.tile,a=r.project(k.at.x,k.at.y);
  const pool=Math.min(1,Math.max(0,(since-FALL)/1600));
  if(pool>0){c.fillStyle='rgba(92,15,18,.72)';c.beginPath();c.ellipse(a.x+k.blow.dx*t*.03,a.y+t*.15,t*(.09+.26*pool),t*(.06+.13*pool),0,0,Math.PI*2);c.fill();}
  c.save();c.globalAlpha=.85;
  for(const d of b.drops)if(s>=d.land){const reach=burstReach(b.pop,d.D,d.land,.15)*t;c.fillStyle=d.color;c.fillRect(Math.round(a.x+Math.cos(d.a)*reach),Math.round(a.y+t*.09+Math.sin(d.a)*reach),Math.max(1,(d.size+d.stain)*t),Math.max(1,(d.size-.015)*t));}
  c.restore();
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

// In the air: the light (a core while frozen, then a bloom and a flare out of the exit side), sparks, blood mist and
// drops. Everything pops most of the way out at once and only drifts during the slow motion.
export function drawKiaAir(r,time){
  const k=r.kia,b=k?.burst;if(!b)return;
  const c=r.ctx,t=r.tile,a=r.project(k.at.x,k.at.y),since=time-k.start,s=since/1000,L=b.light;
  c.save();
  if(k.frozen&&L>0){c.globalCompositeOperation='lighter';const rad=t*.24,g=c.createRadialGradient(a.x,a.y,0,a.x,a.y,rad);g.addColorStop(0,`rgba(255,250,235,${Math.min(1,L)})`);g.addColorStop(1,'rgba(255,160,90,0)');c.fillStyle=g;c.fillRect(a.x-rad,a.y-rad,rad*2,rad*2);}
  if(s>0){
    if(L>0){
      c.globalCompositeOperation='lighter';
      const bf=1-s/.32;
      if(bf>0){const rad=t*(.88+.44*(1-Math.exp(-s/.2))),al=Math.min(1,bf*L),g=c.createRadialGradient(a.x,a.y,0,a.x,a.y,rad);g.addColorStop(0,`rgba(255,250,235,${al})`);g.addColorStop(.35,`rgba(255,190,110,${.7*al})`);g.addColorStop(1,'rgba(255,120,60,0)');c.fillStyle=g;c.fillRect(a.x-rad,a.y-rad,rad*2,rad*2);}
      const ff=1-s/.25;
      if(ff>0){c.save();c.translate(a.x,a.y);c.rotate(b.away);const len=t*(1.76+.44*(1-b.pop)*(1-Math.exp(-s/.2))),al=ff*.9*L,g=c.createLinearGradient(0,0,len,0);g.addColorStop(0,`rgba(255,240,215,${al})`);g.addColorStop(1,'rgba(255,90,60,0)');c.fillStyle=g;c.beginPath();c.moveTo(0,-t*.074);c.lineTo(len,-t*.022);c.lineTo(len,t*.022);c.lineTo(0,t*.074);c.fill();c.restore();}
      c.lineWidth=Math.max(1,t*.03);
      for(const p of b.sparks){const u=s/p.life;if(u>=1)continue;const d=(burstReach(b.pop,p.D,s,.2)+p.v*s*(1-b.pop))*t,x=a.x+Math.cos(p.a)*d,y=a.y+Math.sin(p.a)*d;c.strokeStyle=p.color;c.globalAlpha=1-u;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(p.a)*p.len*t,y-Math.sin(p.a)*p.len*t);c.stroke();}
      c.globalAlpha=1;c.globalCompositeOperation='source-over';
    }
    for(const m of b.mist){const u=s/m.life;if(u>=1)continue;const d=burstReach(b.pop,m.D,s,.3)*t,x=a.x+Math.cos(m.a)*d,y=a.y+Math.sin(m.a)*d,rad=m.r0*t*(1+(m.grow-1)*(1-Math.exp(-s/.4))),g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,`rgba(150,22,26,${.45*(1-u)})`);g.addColorStop(1,'rgba(120,10,16,0)');c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);}
    for(const d of b.drops){if(s>=d.land)continue;const reach=burstReach(b.pop,d.D,s,.15)*t,z=(d.z0+d.vz*s-d.g*s*s/2)*t;c.fillStyle=d.color;const w=Math.max(1,d.size*t);c.fillRect(Math.round(a.x+Math.cos(d.a)*reach),Math.round(a.y+Math.sin(d.a)*reach-z),w,w);}
  }
  c.restore();
}
