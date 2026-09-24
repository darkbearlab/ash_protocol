// Drawing for kill gore and the killed-in-action burst (3.175.0; src/gore.js makes the bursts). The soft parts — the
// glow, the exit flare, the mist — are drawn once into small images and stamped, rather than built as gradients every
// frame (they were nine tenths of the cost). What lands on the floor is stamped once into a floor-sized layer that is
// drawn as one image, so a floor full of kills costs the same as one; the layer is never saved and clears with the
// floor.
import {SIZE} from './data.js';
import {burstReach} from './gore.js';

const images=new Map();
function image(key,w,h,paint){
  if(typeof document==='undefined')return null;
  let canvas=images.get(key);
  if(!canvas){canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'),w,h);images.set(key,canvas);}
  return canvas;
}
// White-hot at the centre, amber, then nothing.
const glow=()=>image('glow',128,128,(c,w)=>{const g=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);g.addColorStop(0,'rgba(255,250,235,1)');g.addColorStop(.35,'rgba(255,190,110,.7)');g.addColorStop(1,'rgba(255,120,60,0)');c.fillStyle=g;c.fillRect(0,0,w,w);});
// The flare out of the exit side: a tapering wedge along +x, bright at the wound.
const flare=()=>image('flare',128,16,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(255,240,215,1)');g.addColorStop(1,'rgba(255,90,60,0)');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.lineTo(w,h*.35);c.lineTo(w,h*.65);c.lineTo(0,h);c.fill();});
// A soft puff of mist in the body's colour.
const puff=([r,g,b])=>image(`puff:${r},${g},${b}`,64,64,(c,w)=>{const gr=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(1,`rgba(${Math.round(r*.8)},${Math.round(g*.5)},${Math.round(b*.6)},0)`);c.fillStyle=gr;c.fillRect(0,0,w,w);});

// What is in the air `since` world ms after the burst, around the tile centre `a` on screen, `t` pixels a tile. While
// `frozen` (the killed-in-action freeze) only a bright core shows.
export function drawBurstAir(c,t,a,b,since,frozen=false){
  if(!b)return;
  const s=since/1000,L=b.light,G=b.glow??1;
  c.save();
  if(frozen&&L>0){const img=glow();if(img){const rad=t*.24;c.globalCompositeOperation='lighter';c.globalAlpha=Math.min(1,L);c.drawImage(img,a.x-rad,a.y-rad,rad*2,rad*2);}}
  if(s>0){
    if(L>0){
      c.globalCompositeOperation='lighter';
      const bf=1-s/.32,img=glow();
      if(bf>0&&img){const rad=t*G*(.88+.44*(1-Math.exp(-s/.2)));c.globalAlpha=Math.min(1,bf*L);c.drawImage(img,a.x-rad,a.y-rad,rad*2,rad*2);}
      const ff=1-s/.25,wedge=flare();
      if(ff>0&&wedge){const len=t*G*(1.76+.44*(1-b.pop)*(1-Math.exp(-s/.2))),hw=t*.074*G;c.save();c.translate(a.x,a.y);c.rotate(b.away);c.globalAlpha=Math.min(1,ff*.9*L);c.drawImage(wedge,0,-hw,len,hw*2);c.restore();}
      c.lineWidth=Math.max(1,t*.03);
      for(const p of b.sparks){const u=s/p.life;if(u>=1)continue;const d=(burstReach(b.pop,p.D,s,.2)+p.v*s*(1-b.pop))*t,x=a.x+Math.cos(p.a)*d,y=a.y+Math.sin(p.a)*d;c.strokeStyle=p.color;c.globalAlpha=1-u;c.beginPath();c.moveTo(x,y);c.lineTo(x-Math.cos(p.a)*p.len*t,y-Math.sin(p.a)*p.len*t);c.stroke();}
      c.globalCompositeOperation='source-over';
    }
    const cloud=puff(b.mistColor||[150,22,26]);
    if(cloud)for(const m of b.mist){const u=s/m.life;if(u>=1)continue;const d=burstReach(b.pop,m.D,s,.3)*t,rad=m.r0*t*(1+(m.grow-1)*(1-Math.exp(-s/.4)));c.globalAlpha=.45*(1-u);c.drawImage(cloud,a.x+Math.cos(m.a)*d-rad,a.y+Math.sin(m.a)*d-rad,rad*2,rad*2);}
    c.globalAlpha=1;
    for(const d of b.drops){if(s>=d.land)continue;const reach=burstReach(b.pop,d.D,s,.15)*t,z=(d.z0+d.vz*s-d.g*s*s/2)*t,w=Math.max(1,d.size*t);c.fillStyle=d.color;c.fillRect(Math.round(a.x+Math.cos(d.a)*reach),Math.round(a.y+Math.sin(d.a)*reach-z),w,w);}
  }
  c.restore();
}

// The floor layer: stains in tile space, PER_TILE pixels a tile, for one floor of one run.
export const PER_TILE=32;
export class Splatter{
  constructor(){this.canvas=null;this.key=null;}
  reset(){this.canvas=null;this.key=null;}
  use(key){if(key!==this.key){this.canvas=null;this.key=key;}}
  // Stamps the drops of burst `b` (at tile `at`) that have landed by `since` world ms, each once.
  bake(b,at,since){
    if(!b||typeof document==='undefined')return;
    const s=since/1000;let c=null;
    for(const d of b.drops){
      if(d.done||s<d.land)continue;
      d.done=true;
      if(!c){if(!this.canvas){this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=SIZE*PER_TILE;}c=this.canvas.getContext('2d');c.globalAlpha=.85;}
      const reach=burstReach(b.pop,d.D,d.land,.15),x=(at.x+.5+Math.cos(d.a)*reach)*PER_TILE,y=(at.y+.59+Math.sin(d.a)*reach)*PER_TILE;
      c.fillStyle=d.color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round((d.size+d.stain)*PER_TILE)),Math.max(1,Math.round((d.size-.015)*PER_TILE)));
    }
  }
  // `centre` is where tile (0,0)'s centre is on screen.
  draw(c,centre,t){if(this.canvas)c.drawImage(this.canvas,centre.x-t/2,centre.y-t/2,SIZE*t,SIZE*t);}
}
