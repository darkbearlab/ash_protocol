// Signal interference (3.149.0, user request 2026-09-19; docs/SIGNAL_GLITCH.md). Presentation only: never read by the
// rules and never saved, so it may roll Math.random freely. It used to be the screen shake's colour split; now it stands
// on its own, with its own setting, and comes in two sizes:
// - screen: the whole frame parts into a red and a blue-green layer and a few horizontal bands tear sideways;
// - object: one sprite, prop or item is cut into slices that jump sideways, with red and blue-green ghosts.
import {chromaSplit} from './screen-shake.js';

export const GLITCH_TUNING=Object.freeze({
 fromShake:.8,                                   // your shot, a blast, a hit: screen strength per pixel of its shake
 disabled:{amp:5,ms:420,pulse:{amp:3,ms:160,every:[1100,2000]}},   // stunned or EMP'd: a burst, then pulses while it lasts
 pinned:{amp:2,ms:130,every:[1800,3600]},       // pinned by suppression
 skill:{amp:3.5,ms:320,ids:['early_warning','signal_break']},
 transmission:{amp:4,ms:520},                    // the level-up INCOMING TRANSMISSION
 lowHp:{ratio:.3,amp:2.5,ms:110,every:[2600,5200]},
 playerMove:{chance:.12,amp:2,ms:150},
 affixMove:{chance:.25,amp:2.5,ms:150},affixAttack:{chance:.45,amp:3,ms:180},affixIdle:{amp:2,ms:140,every:[3500,8000]},
 ambient:{every:[5500,11000],count:[1,3],amp:[1.5,2.5],ms:[90,170]},
 uiMs:280,maxScreen:6,
});
const between=([a,b])=>a+Math.random()*(b-a);
// A screen burst's strength over its life: up at once, then a flickering fall.
export function screenStrength(impulses,time){
 let s=0;for(const g of impulses){const p=(time-g.start)/g.duration;if(p<0||p>=1)continue;const flicker=Math.floor(time/40)%3?1:.45;s+=g.amp*(1-p)*flicker;}
 return Math.min(GLITCH_TUNING.maxScreen,s);
}
export const liveGlitches=(list,time)=>list.filter(g=>time-g.start<g.duration);
// Revealed affixes only: a glitch must not give away an affix the player has not seen yet.
export const affixed=e=>Boolean(e?.affixes?.some(a=>a.revealed));
// What a turn's effects set off, given the shake impulses the same effects made (src/screen-shake.js).
export function effectGlitches(effects,view,start,shakes=[]){
 const T=GLITCH_TUNING,screen=shakes.map(s=>({start:s.start,duration:s.duration,amp:s.amp*T.fromShake})),objects=[];let hit=false;
 const enemyAt=pos=>view.enemies?.find(e=>e.hp>0&&e.x===pos.x&&e.y===pos.y);
 for(const e of effects){
  if(e.type==='pulse'&&e.skill&&T.skill.ids.includes(e.skill))screen.push({start,duration:T.skill.ms,amp:T.skill.amp});
  else if(e.type==='move'&&e.to){
   if(e.actorId==='player'){if(Math.random()<T.playerMove.chance)objects.push({key:'player',start,duration:T.playerMove.ms,amp:T.playerMove.amp});}
   else{const foe=view.enemies?.find(x=>x.id===e.actorId);if(affixed(foe)&&Math.random()<T.affixMove.chance)objects.push({key:foe.id,start,duration:T.affixMove.ms,amp:T.affixMove.amp});}
  }else if(e.type==='enemyShot'&&e.from){
   const foe=enemyAt(e.from);if(affixed(foe)&&Math.random()<T.affixAttack.chance)objects.push({key:foe.id,start,duration:T.affixAttack.ms,amp:T.affixAttack.amp});
   if(!e.miss&&e.damage>0&&e.to&&view.player&&e.to.x===view.player.x&&e.to.y===view.player.y)hit=true;
  }else if(e.type==='impact'&&e.player&&e.damage>0)hit=true;
 }
 for(const o of objects)o.seed=Math.random()*1000;
 return {screen,objects,hit};
}
// Glitches that come from how things stand rather than from what just happened, checked every frame. `state` keeps the
// clocks between frames; returns the new screen bursts and object glitches.
export function stateGlitches(state,view,time,visible){
 const T=GLITCH_TUNING,p=view.player,screen=[],objects=[];if(!p)return {screen,objects};
 const disabled=(p.control?.disabled||0)>0;
 if(disabled&&!state.disabled){screen.push({start:time,duration:T.disabled.ms,amp:T.disabled.amp});state.nextDisabled=time+between(T.disabled.pulse.every);}
 else if(disabled&&time>=(state.nextDisabled||0)){screen.push({start:time,duration:T.disabled.pulse.ms,amp:T.disabled.pulse.amp});state.nextDisabled=time+between(T.disabled.pulse.every);}
 state.disabled=disabled;
 const pulse=(on,key,d)=>{if(!on){state[key]=null;return;}if(state[key]==null)state[key]=time+between(d.every);else if(time>=state[key]){screen.push({start:time,duration:d.ms,amp:d.amp});state[key]=time+between(d.every);}};
 pulse((p.suppression||0)>=3,'nextPinned',T.pinned);
 pulse(p.hp>0&&p.hp<p.maxHp*T.lowHp.ratio,'nextLowHp',T.lowHp);
 state.idle??={};
 for(const e of visible.enemies.filter(affixed)){const due=state.idle[e.id];if(due==null)state.idle[e.id]=time+between(T.affixIdle.every);else if(time>=due){objects.push({key:e.id,start:time,duration:T.affixIdle.ms,amp:T.affixIdle.amp,seed:Math.random()*1000});state.idle[e.id]=time+between(T.affixIdle.every);}}
 if(state.nextAmbient==null)state.nextAmbient=time+between(T.ambient.every);
 else if(time>=state.nextAmbient){
  const pool=[...visible.keys],n=Math.min(pool.length,Math.round(between(T.ambient.count)));
  for(let i=0;i<n;i++){const k=pool.splice(Math.floor(Math.random()*pool.length),1)[0];objects.push({key:k,start:time,duration:between(T.ambient.ms),amp:between(T.ambient.amp),seed:Math.random()*1000});}
  state.nextAmbient=time+between(T.ambient.every);
 }
 return {screen,objects};
}

// ---- drawing ---------------------------------------------------------------------------------------------------------
const hash=(a,b,c)=>{let h=2166136261;for(const n of [a,b,c]){h^=Math.floor(n*1000);h=Math.imul(h,16777619);}return ((h>>>0)%10000)/10000;};
const canvases=new Map();
function scratch(name,w,h){let c=canvases.get(name);if(!c){c=document.createElement('canvas');canvases.set(name,c);}if(c.width!==w||c.height!==h){c.width=w;c.height=h;}return c;}
// Split `src` into its red and its blue-green part, keeping its transparency.
function channels(src){
 const out=[];
 for(const [name,color] of [['red','#ff0000'],['cyan','#00ffff']]){
  const c=scratch(`glitch-${name}`,src.width,src.height),x=c.getContext('2d');
  x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='copy';x.drawImage(src,0,0);
  x.globalCompositeOperation='multiply';x.fillStyle=color;x.fillRect(0,0,c.width,c.height);
  x.globalCompositeOperation='destination-in';x.drawImage(src,0,0);x.globalCompositeOperation='source-over';out.push(c);
 }
 return out;
}
// Draw one object through the glitch. `r` is the renderer: its drawing helpers all use r.ctx, which is pointed at a
// small canvas around the object while `draw` runs; the result is put back in jumping slices with colour ghosts.
export function drawGlitched(r,a,draw,g,time){
 if(!(r.tile>0)){draw();return;}
 const size=Math.ceil(r.tile*2.8),dpr=r.dpr||1,off=scratch('glitch-object',Math.ceil(size*dpr),Math.ceil(size*dpr)),oc=off.getContext('2d');
 oc.setTransform(1,0,0,1,0,0);oc.clearRect(0,0,off.width,off.height);oc.setTransform(dpr,0,0,dpr,dpr*(size/2-a.x),dpr*(size/2-a.y));oc.imageSmoothingEnabled=false;
 const main=r.ctx;r.ctx=oc;try{draw();}finally{r.ctx=main;}
 const p=(time-g.start)/g.duration,amp=g.amp*(p<.5?1:2*(1-p)),step=Math.floor(time/45),slices=4,h=size/slices,left=a.x-size/2,top=a.y-size/2;
 main.save();main.imageSmoothingEnabled=false;
 for(let i=0;i<slices;i++){const dx=(hash(g.seed,i,step)-.5)*6*amp;main.drawImage(off,0,Math.round(i*h*dpr),off.width,Math.round(h*dpr),left+dx,top+i*h,size,h);}
 const [red,cyan]=channels(off),d=amp*1.2;
 main.globalCompositeOperation='screen';main.globalAlpha=.7;main.drawImage(red,left+d,top,size,size);main.drawImage(cyan,left-d,top,size,size);
 main.restore();
}
// The whole frame: the colour split, then a few bands torn sideways.
export function screenGlitch(canvas,strength,dpr=1,time=0){
 if(strength<.75||!canvas.width||!canvas.height)return;   // a hidden board (orientation guard, menus) has no size
 chromaSplit(canvas,{x:strength,y:0,strength},dpr);
 const copy=scratch('glitch-copy',canvas.width,canvas.height),x=copy.getContext('2d');x.setTransform(1,0,0,1,0,0);x.globalCompositeOperation='copy';x.drawImage(canvas,0,0);
 const c=canvas.getContext('2d'),step=Math.floor(time/50),bands=1+Math.floor(hash(strength,step,7)*3);
 c.save();c.setTransform(1,0,0,1,0,0);
 for(let i=0;i<bands;i++){const y=Math.floor(hash(i,step,3)*canvas.height),h=Math.max(2,Math.floor((4+hash(i,step,5)*18)*dpr)),dx=Math.round((hash(i,step,9)-.5)*6*strength*dpr);c.drawImage(copy,0,y,canvas.width,h,dx,y,canvas.width,h);}
 c.restore();
}
