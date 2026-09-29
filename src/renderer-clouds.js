// Smoke, fire and vents (3.206.3 split): smoke vents, the smoke field in both qualities (docs/HAZARDS.md) and
// burning floor.
// Methods of Renderer (src/renderer.js), which copies them onto Renderer.prototype (src/mixin.js, 3.206.3): `this` is
// the renderer, `this.game` the state being drawn and `this.ctx` the canvas.
import {FX_SMOKE_ALPHA,fxField,fxFieldFailed,fxFrame,fxSheet} from './fx-sprites.js';
import {VENT_COLOR,ventStage} from './vents.js';
import {fireRow} from './fire.js';
// Cloud colours: fill and puffs (3.134.0; haze and steam 3.202.0).
export const CLOUD_TONES=Object.freeze({smoke:['#abc1cd66','#d4dfe84a'],toxic:['#8fbf4a55','#c6e5864a'],spore:['#9c7d5366','#c8ad874a'],haze:['#c9d3da2e','#e6edf236'],steam:['#e3f1f55c','#ffffff52']});
// cloudField's stacks, back to front: where in the texture (texture pixels), drift (texture pixels a second), opacity and
// a tint laid over that layer alone (the back one darker, the front one lighter, so the cloud has depth and keeps some
// of its gaps), all at the floor's pixel size; veil: how much of the kind's tone lies underneath. 'baked' is 'layers'
// composited ahead of time (art/smoke-field-v1/process.py mirrors these numbers), so it only drifts.
const FIELD_STACKS=Object.freeze({
 layers:{veil:.5,layers:[{at:[0,0],speed:[2,1],alpha:.9,tint:'rgba(8,12,14,.45)'},{at:[131,71],speed:[-1.5,1.8],alpha:.55},{at:[57,199],speed:[3,-.8],alpha:.45,tint:'rgba(235,242,246,.3)'}]},
 baked:{veil:0,layers:[{at:[0,0],speed:[2,1],alpha:1}]}});
// A separable box blur of a mask (cloudField).
function blurField(m,w,h,r){const out=new Float32Array(m.length),tmp=new Float32Array(m.length),n=2*r+1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let d=-r;d<=r;d++){const xx=Math.min(w-1,Math.max(0,x+d));s+=m[y*w+xx];}tmp[y*w+x]=s/n;}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let s=0;for(let d=-r;d<=r;d++){const yy=Math.min(h-1,Math.max(0,y+d));s+=tmp[yy*w+x];}out[y*w+x]=s/n;}
 return out;}
export class RendererClouds {

  // 3.202.0 smoke vent (docs/HAZARDS.md section 3): a grate in the floor with its kind's colour on the rim; the rim pulses
  // in the round it hisses and burns bright while it sprays. A Codex sheet replaces it once it is there.
  vent(a,v,time,x,y){
    const t=this.tile,c=this.ctx,stage=ventStage(v,this.game.turn),warn=stage===0,spray=stage===1||stage===2,sheet=fxSheet('vent'),row=sheet?.rows?.[v.kind];
    // Idle is column 0; the warning alternates 1-2 and the spray 3-4 at six frames a second, never all five in a loop.
    if(sheet&&row!==undefined){const flip=Math.floor(time*6/1000)%2,col=warn?1+flip:spray?3+flip:0;c.drawImage(sheet.img,col*sheet.cell,row*sheet.cell,sheet.cell,sheet.cell,a.x-t/2,a.y-t/2,t,t);return;}
    const l=a.x-t*.34,top=a.y-t*.34,w=t*.68,rim=VENT_COLOR[v.kind]||'#b8c7d0',pulse=warn?.5+.5*Math.sin(time/120):spray?1:.35;
    this.box(l,top,w,w,'#161c1c',rim+Math.round(pulse*200).toString(16).padStart(2,'0'));
    for(let i=1;i<=3;i++)this.line(l+3,top+i*w/4,l+w-3,top+i*w/4,'#0b0f0f',2);
    if(warn||spray)this.glow(a.x,a.y,t*(spray?.7:.5),rim+(spray?'22':'16'));
  }
  // Smoke as one field (3.202.0, user 2026-09-29): per kind, the cells' part of the kind's large texture anchored to the
  // map (src/fx-sprites.js fxField). The 'layers' quality stacks it three times (other parts of the texture drifting
  // other ways, the back one darker, the front one lighter) over half a veil of the kind's tone; 'baked' draws the same
  // stack composited ahead of time, once (FIELD_STACKS; the smoke setting). Everything is cut per tile and drawn on
  // exactly the floor tiles' rects (Renderer.terrain), 32 texture pixels a tile, so the smoke's pixels sit on the floor's
  // pixel grid (user). The mask is on the same grid: only the cloud's outer edge fades, over about a fifth of a tile in
  // quarter steps of opacity (user: a fifth to a quarter at most; the steps over a dither), rebuilt only when the
  // cloud's cells change.
  smokeField(kind){
    const want=this.smokeQuality==='baked'?'baked':'layers';
    const tex=fxField(kind,want);if(tex)return {tex,stack:FIELD_STACKS[want]};
    // Only when the chosen file cannot be had does the other quality stand in.
    const other=want==='baked'?'layers':'baked',spare=fxFieldFailed(kind,want)&&fxField(kind,other);
    return spare?{tex:spare,stack:FIELD_STACKS[other]}:null;
  }
  cloudField(cells,time){
    if(!cells.length)return;
    const c=this.ctx,t=this.tile,T=Math.ceil(t),dpr=this.dpr||1,kinds=new Map();
    for(const q of cells){if(!kinds.has(q.kind))kinds.set(q.kind,[]);kinds.get(q.kind).push(q);}
    this.fieldScratch??=document.createElement('canvas');this.fieldMasks??=new Map();this.fieldCache??=new Map();
    const rect=(x,y)=>{const a=this.project(x,y);return {l:Math.round(a.x)-T/2,t:Math.round(a.y)-T/2};};
    for(const [kind,list] of kinds){
      const field=this.smokeField(kind);if(!field)continue;const {tex,stack}=field;
      const x0=Math.min(...list.map(q=>q.x))-1,y0=Math.min(...list.map(q=>q.y))-1,x1=Math.max(...list.map(q=>q.x))+1,y1=Math.max(...list.map(q=>q.y))+1;
      const mask=this.fieldMask(kind,list,x0,y0,x1-x0+1,y1-y0+1);
      const o=rect(x0,y0),e=rect(x1,y1),W=e.l+T-o.l,H=e.t+T-o.t,base=this.project(x0,y0);
      const shifts=stack.layers.map(l=>[l.at[0]+Math.floor(time*l.speed[0]/1000),l.at[1]+Math.floor(time*l.speed[1]/1000)]);
      // The stack only changes when a layer moves a whole texture pixel, so a still camera reuses the last composite.
      const key=[this.smokeQuality,x0,y0,x1,y1,t,dpr,base.x%1,base.y%1,shifts.join(';'),this.fieldMasks.get(kind).key].join('|');
      let cached=this.fieldCache.get(kind);
      if(!cached){cached={key:null,canvas:document.createElement('canvas')};this.fieldCache.set(kind,cached);}
      const layer=cached.canvas;
      if(cached.key!==key){
      layer.width=Math.ceil(W*dpr);layer.height=Math.ceil(H*dpr);const lc=layer.getContext('2d');
      const scratch=this.fieldScratch;scratch.width=layer.width;scratch.height=layer.height;const sc=scratch.getContext('2d');
      for(const ctx of [lc,sc]){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;}
      const tone=(CLOUD_TONES[kind]||CLOUD_TONES.smoke)[0];if(stack.veil){lc.fillStyle=tone.slice(0,7)+Math.round(parseInt(tone.slice(7)||'ff',16)*stack.veil).toString(16).padStart(2,'0');lc.fillRect(0,0,W,H);}
      stack.layers.forEach((l,i)=>{
        // Each layer is cut and tinted on its own (back darker, front lighter) before it goes on the stack.
        const [dx,dy]=shifts[i],n=tex.width-32;
        sc.clearRect(0,0,W,H);
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const r=rect(x,y);sc.drawImage(tex,(((x*32+dx)%n)+n)%n,(((y*32+dy)%n)+n)%n,32,32,r.l-o.l,r.t-o.t,T,T);}
        if(l.tint){sc.globalCompositeOperation='source-atop';sc.fillStyle=l.tint;sc.fillRect(0,0,W,H);sc.globalCompositeOperation='source-over';}
        lc.globalAlpha=l.alpha;lc.drawImage(scratch,0,0,scratch.width,scratch.height,0,0,W,H);lc.globalAlpha=1;
      });
      // The mask goes on the same tile rects, assembled first: destination-in clears whatever a single draw does not cover.
      sc.clearRect(0,0,W,H);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const r=rect(x,y);sc.drawImage(mask,(x-x0)*32,(y-y0)*32,32,32,r.l-o.l,r.t-o.t,T,T);}
      lc.globalCompositeOperation='destination-in';lc.drawImage(scratch,0,0,scratch.width,scratch.height,0,0,W,H);lc.globalCompositeOperation='source-over';
      cached.key=key;
      }
      c.save();c.globalAlpha=FX_SMOKE_ALPHA[kind]??.6;c.drawImage(layer,0,0,layer.width,layer.height,o.l,o.t,W,H);c.restore();
    }
  }
  // cloudField's mask on the texture's 32-pixel grid: cloud cells in, a box blur of about a fifth of a tile across the
  // outer edge in quarter steps on that grid, times each tile's own alpha (remembered tiles are dimmer).
  fieldMask(kind,list,x0,y0,bw,bh){
    const key=`${x0},${y0},${bw},${bh}|`+list.map(q=>`${q.x},${q.y},${q.alpha}`).join(';'),cached=this.fieldMasks.get(kind);
    if(cached?.key===key)return cached.canvas;
    const S=32,mw=bw*S,mh=bh*S,cov=new Float32Array(mw*mh),level=new Float32Array(bw*bh);
    for(const q of list){level[(q.y-y0)*bw+q.x-x0]=Math.max(level[(q.y-y0)*bw+q.x-x0],q.alpha);for(let j=0;j<S;j++)cov.fill(1,((q.y-y0)*S+j)*mw+(q.x-x0)*S,((q.y-y0)*S+j)*mw+(q.x-x0+1)*S);}
    // A tile outside the cloud takes the brightest neighbouring cloud tile's alpha for the fringe that spills onto it.
    const at=(x,y)=>x<0||y<0||x>=bw||y>=bh?0:level[y*bw+x],lv=new Float32Array(bw*bh);
    for(let y=0;y<bh;y++)for(let x=0;x<bw;x++)lv[y*bw+x]=at(x,y)||Math.max(at(x-1,y),at(x+1,y),at(x,y-1),at(x,y+1),at(x-1,y-1),at(x+1,y-1),at(x-1,y+1),at(x+1,y+1));
    const m=blurField(cov,mw,mh,3),canvas=cached?.canvas||document.createElement('canvas');canvas.width=mw;canvas.height=mh;
    const mc=canvas.getContext('2d'),img=mc.createImageData(mw,mh);
    for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
      const k=y*mw+x,edge=Math.round(m[k]*4)/4;
      img.data[k*4]=img.data[k*4+1]=img.data[k*4+2]=255;img.data[k*4+3]=Math.round(edge*lv[Math.floor(y/S)*bw+Math.floor(x/S)]*255);
    }
    mc.putImageData(img,0,0);this.fieldMasks.set(kind,{key,canvas});return canvas;
  }
  // 3.203.0 burning floor (src/fire.js): Codex's fire sheet, its row by how long the tile has burned (it catches, burns,
  // dies down in its last rounds); without the sheet, the fixed fire's procedural flames.
  burning(a,f,time){const t=this.tile,fire=fxSheet('fire');
    if(!fire){this.hazard(a,{type:'fire',x:f.x,y:f.y},time);return;}
    this.glow(a.x,a.y,t*.8,'#cf672c44');this.ctx.drawImage(fire.img,fxFrame(time,f.x,f.y,fire.frames)*fire.cell,fire.rows[fireRow(f)]*fire.cell,fire.cell,fire.cell,a.x-t/2,a.y-t/2,t,t);this.glow(a.x,a.y,t*.7,'#f99a381a');}
}
