// Screen shake (3.147.0, user request 2026-09-19): presentation only, never read by the rules and never saved.
// Effects become impulses when the renderer receives them, so the shake plays in step with the turn's playback:
// - recoil: your shot kicks the view away from where you fire, harder for heavier guns;
// - jolt: a blast (fading with its distance from you) or harm without a shooter shakes it; a shot that hits you knocks
//   it away from the shooter;
// - buzz: the chainsaw rattles it.
// While it moves, the red and the blue-green channels part along the motion, a colour-fringe afterimage (user idea).
import {WEAPONS} from './data.js';

export const SHAKE_TUNING=Object.freeze({
 // Recoil kick in screen pixels, by weapon class; melee blows jab a little toward the target instead.
 recoil:Object.freeze({rifle:2.2,smg:1.7,shotgun:5,sniper:4,plasma:3.2,launcher:4.2,burst_launcher:4.8,lmg:2.6,melee:1.6}),
 recoilMs:150,blastMs:380,hurtMs:240,sawMs:420,hitDelay:90,
 blastPerRadius:5.5,blastReach:9,hurtBase:1.8,hurtPerDamage:.12,hurtMax:6.5,saw:1.8,
 maxShift:9,chromaPerPx:.8,chromaMax:5,
});

const classOf=id=>WEAPONS.find(w=>w.id===id)?.weaponClass;
const unit=(from,to)=>{const dx=to.x-from.x,dy=to.y-from.y,n=Math.hypot(dx,dy);return n?{x:dx/n,y:dy/n}:{x:0,y:-1};};
// One impulse per effect that should move the view. `player` is the position the turn is being shown from.
export function shakeImpulses(effects,player,start){
 const T=SHAKE_TUNING,out=[];
 for(const e of effects){
  if(e.type==='shot'&&e.from&&e.to&&player&&e.from.x===player.x&&e.from.y===player.y){
   const cls=classOf(e.weaponId),dir=unit(e.from,e.to);
   if(e.weaponId==='chainsaw')out.push({kind:'buzz',start,duration:T.sawMs,amp:T.saw,dir});
   else if(e.style==='slash'||cls==='melee')out.push({kind:'kick',start,duration:T.recoilMs,amp:T.recoil.melee,dir});
   else if(cls&&T.recoil[cls])out.push({kind:'kick',start,duration:T.recoilMs,amp:T.recoil[cls],dir:{x:-dir.x,y:-dir.y}});
  }else if(e.type==='blast'&&e.from&&player){
   const d=Math.abs(e.from.x-player.x)+Math.abs(e.from.y-player.y),near=Math.max(0,1-d/T.blastReach);
   if(near>0)out.push({kind:'jolt',start,duration:T.blastMs,amp:T.blastPerRadius*Math.max(1,e.radius||1)*near,seed:e.from.x*7+e.from.y*13});
  }else if(e.type==='enemyShot'&&!e.miss&&e.damage>0&&e.from&&e.to&&player&&e.to.x===player.x&&e.to.y===player.y){
   // Shot: the view is knocked away from the shooter, a beat after the round leaves the muzzle.
   out.push({kind:'kick',start:start+T.hitDelay,duration:T.hurtMs,amp:Math.min(T.hurtMax,T.hurtBase+e.damage*T.hurtPerDamage),dir:unit(e.from,e.to)});
  }else if(e.type==='impact'&&e.player&&e.damage>0){
   out.push({kind:'jolt',start,duration:T.hurtMs,amp:Math.min(T.hurtMax,T.hurtBase+e.damage*T.hurtPerDamage),seed:e.damage});
  }
 }
 return out;
}
// The view's offset at `time`, and which way it is moving (for the colour split).
export function shakeOffset(impulses,time){
 let x=0,y=0;
 for(const s of impulses){
  const p=(time-s.start)/s.duration;if(p<0||p>=1)continue;
  if(s.kind==='kick'){const e=p<.2?p/.2:(1-(p-.2)/.8)**2;x+=s.dir.x*s.amp*e;y+=s.dir.y*s.amp*e;}
  else if(s.kind==='buzz'){const e=(1-p)**.5,w=time*.55;x+=s.amp*e*Math.sin(w);y+=s.amp*e*Math.cos(w*1.3);}
  else{const e=(1-p)**2,w=time*.09+(s.seed||0);x+=s.amp*e*Math.sin(w*1.7);y+=s.amp*e*Math.cos(w*2.3);}
 }
 const T=SHAKE_TUNING,n=Math.hypot(x,y),k=n>T.maxShift?T.maxShift/n:1;
 return {x:x*k,y:y*k,strength:Math.min(n,T.maxShift)};
}
export const liveImpulses=(impulses,time)=>impulses.filter(s=>time-s.start<s.duration);

// The colour split: the frame is copied into a red-only and a blue-green-only layer, which are added back side by side.
// Aligned they rebuild the frame exactly; parted they leave coloured fringes on every edge. Only runs while shaking.
const layers=new WeakMap();
export function chromaSplit(canvas,shift,dpr=1){
 const T=SHAKE_TUNING,px=Math.min(T.chromaMax,shift.strength*T.chromaPerPx)*dpr;if(px<.75||!canvas.width||!canvas.height)return;   // a hidden board has no size
 let l=layers.get(canvas);
 if(!l||l.w!==canvas.width||l.h!==canvas.height){const make=()=>{const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;return c;};l={w:canvas.width,h:canvas.height,red:make(),cyan:make()};layers.set(canvas,l);}
 for(const [layer,color] of [[l.red,'#ff0000'],[l.cyan,'#00ffff']]){
  const c=layer.getContext('2d');c.globalCompositeOperation='copy';c.drawImage(canvas,0,0);
  c.globalCompositeOperation='multiply';c.fillStyle=color;c.fillRect(0,0,l.w,l.h);c.globalCompositeOperation='source-over';
 }
 const n=shift.strength||1,dx=shift.x/n*px,dy=shift.y/n*px,c=canvas.getContext('2d');
 c.save();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='copy';c.drawImage(l.red,dx,dy);
 c.globalCompositeOperation='lighter';c.drawImage(l.cyan,-dx,-dy);c.restore();
}
