import {movementBoundaries,boundaryOpacityPercent} from './movement-boundaries.js';
import {isDark} from './lighting.js';
import {ArtToneCache} from './art-tone.js';
import {WALL_ATLAS,drawWall} from './walls.js';
import {drawTrace} from './traces.js';
import {THEMES,themeAt,resolveSprite} from './themes.js';
import {missionObjects,missionTarget} from './missions.js';
import {MODULE_TYPES,moduleCells,modulePoint} from './modules.js';
import {isContainer,CONTAINER_KINDS} from './containers.js';
import {isBarrier,edgeCells} from './barriers.js';
import {areaCells} from './throwables.js';
import {cameraFrame} from './camera.js';
import {targetCardPlacement,actorObstacle} from './target-card.js';
import {SIZE,FLOOR_INFO,ENEMY_TYPES,SUPPLY_NAMES,SUPPLY_ROOMS,distance} from './engine.js';

// Orthographic board: world +x = screen right, world +y = screen down.
// Pixel atlases use nearest-neighbor drawing, with procedural missing-image fallbacks.
export class Renderer {
  constructor(canvas,game) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.game=game;this.zoom=1;
    this.camera={x:game.player.x,y:game.player.y};this.effects=[];this.last=0;this.time=0;
    this.movementBoundaries=false;this.boundaryOpacity=80;this.targetingEnabled=true;this.aim=null;this.mode=null;this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.terrainImages=new Map();for(const def of Object.values(THEMES))if(!this.terrainImages.has(def.atlas)){const image=new Image();image.src=def.atlas;this.terrainImages.set(def.atlas,image);}
    this.wallImage=new Image();this.wallImage.src=WALL_ATLAS;this.terrainImages.set(WALL_ATLAS,this.wallImage);this.artTones=new ArtToneCache();
    this.sprites=new Image();this.sprites.src=new URL('../assets/pixel/atlas.png',import.meta.url).href;
    this.aftermath=new Image();this.aftermath.src=new URL('../assets/pixel/aftermath.png',import.meta.url).href;
    // Precompute once at native resolution; avoids Canvas filter support differences on phones.
    this.corpseAtlas=document.createElement('canvas');
    this.aftermath.addEventListener('load',()=>{const atlas=this.corpseAtlas;atlas.width=this.aftermath.naturalWidth;atlas.height=this.aftermath.naturalHeight;const c=atlas.getContext('2d');c.drawImage(this.aftermath,0,0);const pixels=c.getImageData(0,0,atlas.width,atlas.height),d=pixels.data;for(let i=0;i<d.length;i+=4){const gray=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;for(let k=0;k<3;k++)d[i+k]=Math.round((d[i+k]*.3+gray*.7)*.8);}c.putImageData(pixels,0,0);this.corpseReady=true;});
    this.aftermathNames=['dead-player','dead-rifleman','dead-raider','dead-sniper','dead-brute','dead-drone','dead-warden','dead-boss','dead-crawler','dead-bomber','muzzle','bullet','plasma','slash','claw','impact'];
    this.spriteNames=['player','rifleman','raider','sniper','brute','drone','warden','boss','crawler','bomber','cover','barrel','med','ammo','grenade','terminal'];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    requestAnimationFrame(t=>this.frame(t));
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=r.width*this.dpr;this.canvas.height=r.height*this.dpr;this.tile=(this.w<600?38:45)*this.zoom;}
  project(x,y,z=0){return {x:this.w/2+(x-this.camera.x)*this.tile,y:this.h/2+(y-this.camera.y)*this.tile-z};}
  unproject(px,py){return {x:Math.round((px-this.w/2)/this.tile+this.camera.x),y:Math.round((py-this.h/2)/this.tile+this.camera.y)};}
  hitBarrier(x,y){return this.game.barriers.filter(b=>b.hp>0&&this.game.visible(b)).map(b=>{const p=this.project(b.x,b.y);return {b,normal:Math.abs(b.axis==='x'?x-p.x:y-p.y),along:Math.abs(b.axis==='x'?y-p.y:x-p.x)};}).filter(o=>o.normal<=Math.min(10,this.tile*.23)&&o.along<=this.tile*.47).sort((a,b)=>a.normal-b.normal)[0]?.b;}
  drawBarrier(b,scale=this.tile){
    const p=this.project(b.x,b.y),vertical=b.axis==='x',half=scale*.5,color=b.hp<=0?'#65746b':b.open?'#8ad2bb':b.type==='door'?'#dec184':'#9da99d';
    const segment=(a,z,width)=>this.line(p.x+(vertical?0:a),p.y+(vertical?a:0),p.x+(vertical?0:z),p.y+(vertical?z:0),color,width);
    if(b.hp<=0){segment(-half,-half*.72,3);segment(half*.72,half,3);return;}
    if(b.open){segment(-half,-half*.62,5);segment(half*.62,half,5);this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');return;}
    if(this.terrain(b.type,p,b,Math.round(scale),vertical?0:1)){this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');return;}
    segment(-half,half,7);segment(-half+2,half-2,3);
    if(b.type==='door'){this.box(p.x-3,p.y-3,6,6,'#283e36');this.box(p.x-1,p.y-1,2,2,'#f2d691');}
    this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');
  }
  objectHealth(object,x,y,width=24,color='#cad396'){
    if(!(object.hp>0&&object.hp<object.maxHp))return;
    this.box(x,y,width,2,'#17281f');this.box(x,y,width*object.hp/object.maxHp,2,color);
  }
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  glow(x,y,r,color){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
  box(x,y,w,h,color,stroke){const c=this.ctx;c.fillStyle=color;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}}
  text(value,x,y,color='#c1ceb2',size=9){const c=this.ctx;c.font=`${size}px monospace`;c.textAlign='center';c.fillStyle=color;c.fillText(value,x,y);}
  frame(t) {
    const dt=Math.min((t-this.last)/1000,.1);this.last=t;
    if(!document.hidden&&!this.isPaused?.()){this.time+=dt*1000;this.onFrame?.(dt*1000);const frame=cameraFrame(this.game.player,this.targetingEnabled?this.game.targeted:null,this.aim,this.w,this.h,this.zoom);this.camera={x:frame.x,y:frame.y};this.tile=frame.tile;this.draw(this.time);this.placeTargetCard();}
    requestAnimationFrame(v=>this.frame(v));
  }
  placeTargetCard(){
    const ui=this.targetUI,target=this.game.targeted;if(!ui)return;
    if(!target||ui.card.hidden){ui.card.style.visibility='hidden';ui.link.setAttribute('hidden','');ui.frame=null;return;}
    const frame=[target.id,target.x,target.y,this.game.player.x,this.game.player.y,this.w,this.h,this.tile,this.camera.x,this.camera.y,this.sprites.naturalWidth,...this.game.visibleEnemies.flatMap(e=>[e.id,e.x,e.y])].join(',');
    if(!ui.dirty&&ui.frame===frame)return;ui.frame=frame;
    const compact=this.w<240;if(ui.compact!==compact){ui.card.classList.toggle('compact',compact);ui.compact=compact;ui.dirty=true;}
    const width=Math.min(104,this.w-10);
    if(ui.width!==width||ui.dirty){ui.card.style.width=`${width}px`;ui.width=width;ui.height=Math.ceil(ui.card.getBoundingClientRect().height);ui.dirty=false;}
    const a=this.project(target.x,target.y),p=this.project(this.game.player.x,this.game.player.y),fallbackActors=!this.sprites.complete||!this.sprites.naturalWidth;
    const obstacles=[{x:6,y:6,w:118,h:54,weight:60},{x:this.w-140,y:this.h-40,w:134,h:34,weight:60}];
    const pos=targetCardPlacement({target:a,player:p,tile:this.tile,width:this.w,height:this.h,cardWidth:width,cardHeight:ui.height,bottomInset:44,previousCorner:ui.corner,obstacles,blockers:this.game.visibleEnemies.filter(e=>e!==target).map(e=>actorObstacle(this.project(e.x,e.y),this.tile,fallbackActors)),fallbackActors});
    if(!pos){ui.card.style.visibility='hidden';ui.link.setAttribute('hidden','');return;}
    ui.corner=pos.corner;ui.card.style.visibility='visible';
    const signature=[pos.x,pos.y,pos.link.x,pos.link.y,a.x,a.y,this.w,this.h].join(',');
    if(ui.position!==signature){ui.card.style.transform=`translate(${pos.x}px,${pos.y}px)`;ui.link.setAttribute('viewBox',`0 0 ${this.w} ${this.h}`);ui.path.setAttribute('d',`M ${a.x} ${a.y} L ${pos.link.x} ${pos.link.y}`);ui.position=signature;}
    ui.link.removeAttribute('hidden');
  }
  draw(time) {
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    const traceCells=new Map();for(const trace of g.traces){const k=trace.x+','+trace.y;if(!traceCells.has(k))traceCells.set(k,[]);traceCells.get(k).push(trace);}
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalAlpha=1;c.imageSmoothingEnabled=false;
    this.box(0,0,this.w,this.h,'#10191a');
    const palette=FLOOR_INFO[g.floor-1],radial=c.createRadialGradient(this.w/2,this.h/2,30,this.w/2,this.h/2,this.w*.65);
    radial.addColorStop(0,'#354337');radial.addColorStop(1,'#101819');c.fillStyle=radial;c.fillRect(0,0,this.w,this.h);
    const floorCells=[],wallCells=[];
    const minX=Math.max(0,Math.floor(this.camera.x-this.w/t/2-1)),maxX=Math.min(SIZE-1,Math.ceil(this.camera.x+this.w/t/2+1));
    const minY=Math.max(0,Math.floor(this.camera.y-this.h/t/2-1)),maxY=Math.min(SIZE-1,Math.ceil(this.camera.y+this.h/t/2+2));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
      const a=this.project(x,y),left=a.x-half,top=a.y-half,seen=g.seen[y][x];
      if(g.grid[y][x]!==1) {
        if([[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.grid[y+dy]?.[x+dx]===1&&g.seen[y+dy]?.[x+dx])){this.box(left,top,t,t,'#202e2b');wallCells.push({a,x,y});}
        else this.box(left,top,t,t,'#12201a10','#6685790c');continue;
      }
      if(!seen)continue;
      c.globalAlpha=g.visibleTiles?.has(`${x},${y}`)?1:.36;
      if(!this.terrain('floor',a,{x,y},Math.ceil(t))){
      const v=(x*13+y*31)%6;
      this.box(left+1,top+1,t-2,t-2,['#344031','#394334','#313e31','#3b4435','#364133','#303e32'][v],'#5964455c');
      this.box(left+5,top+5,t-10,t-10,'#1b2d2318','#86926313');
      this.line(left+7,top+7,left+t-8,top+7,'#8c9a6425');
      if(v===2||v===5)for(let i=0;i<4;i++)this.line(left+9,top+12+i*4,left+t-9,top+12+i*4,'#12231955',2);
      if(v===1){this.box(left+5,top+5,2,2,'#bcc39466');this.box(left+t-7,top+t-7,2,2,'#bcc39455');}
      for(const [dx,dy]of[[0,-1],[-1,0]])if(g.grid[y+dy]?.[x+dx]!==1){if(dx)this.line(left+3,top+7,left+3,top+t-7,'#c3aa625e',2);else this.line(left+7,top+3,left+t-7,top+3,'#c3aa625e',2);}
      }
      const module=g.props.find(m=>m.type==='module'&&moduleCells(m).some(q=>q.x===x&&q.y===y));if(module&&!this.terrainReady)this.moduleFloor(a,module);
      if(isDark(g,{x,y})){
        this.box(left,top,Math.ceil(t),Math.ceil(t),'#060c22a6');
        // Boundary ticks are static and grid-aligned, distinct from unexplored fog.
        for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]])if(g.grid[y+dy]?.[x+dx]===1&&!isDark(g,{x:x+dx,y:y+dy})){const mx=a.x+dx*half,my=a.y+dy*half;this.line(mx-(dy?t*.2:0),my-(dx?t*.2:0),mx+(dy?t*.2:0),my+(dx?t*.2:0),'#8a9abb',1);}
      }
      floorCells.push({a,left,top,x,y});c.globalAlpha=1;
    }
    for(const {a,left,top,x,y}of floorCells){
      c.globalAlpha=g.visibleTiles?.has(x+','+y)?1:.36;
      for(const trace of traceCells.get(x+','+y)||[])drawTrace(c,trace,a.x,a.y,t);
      const hazard=g.hazards.find(h=>h.x===x&&h.y===y);if(hazard)this.hazard(a,hazard,time);
      if(distance(p,{x,y})===1&&g.passable(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))this.box(left+3,top+3,t-6,t-6,'#b0ba8010','#b1c48a3b');
      const room=g.rooms?.find(r=>r.supply&&r.cx===x&&r.cy===y);if(room){const sign=SUPPLY_ROOMS[room.supply];if(sign)this.text(sign.name,a.x,a.y-this.tile*.4,sign.color,9);}
      if(g.exitPoint.x===x&&g.exitPoint.y===y)this.exit(a,time);
      for(const dead of g.enemies)if(dead.hp<=0&&dead.x===x&&dead.y===y)this.corpse(a,dead.type);
      for(const prop of g.props)if(isContainer(prop)&&prop.x===x&&prop.y===y)this.prop(a,prop,time);
      for(const item of g.items)if(item.x===x&&item.y===y)this.item(a,item,time);
      for(const prop of g.props)if(!isContainer(prop)&&prop.x===x&&prop.y===y)this.prop(a,prop,time);
      for(const objective of missionObjects(g))if(!objective.done&&objective.x===x&&objective.y===y){this.box(a.x-9,a.y-8,18,16,'#123d46','#82e6ec');this.text('D',a.x,a.y+4,'#b7fcff',12);}
      for(const cloud of g.smoke)if(cloud.cells.some(q=>q.x===x&&q.y===y)){this.box(left+1,top+1,t-2,t-2,'#abc1cd66');for(let n=0;n<3;n++)this.box(left+5+n*7,top+8+(x+y+n)%3*6,11,5,'#d4dfe84a');this.text(String(Math.max(1,cloud.expires-g.turn)),a.x+t*.3,a.y+t*.3,'#d3e2ed',8);}
      c.globalAlpha=1;
    }
    for(const b of g.barriers)if(edgeCells(b).some(q=>g.seen[q.y]?.[q.x])){c.globalAlpha=g.visible(b)?1:.35;this.drawBarrier(b);c.globalAlpha=1;}
    for(const spawn of g.reinforcements||[])if(g.visible(spawn))this.markArea(spawn,0,'#70dce833','#94f0eeaa','+'+Math.max(1,spawn.due-g.turn));
    for(const m of g.marks)this.markArea(m,1,'#e969494f','#f8996977',String(Math.max(1,m.due-g.turn)));
    if(this.mode==='grenade'&&this.aim)this.markArea(this.aim,2,'#e6a95b33','#eacb84aa','');
    for(const e of g.visibleEnemies.filter(e=>e.charge)) {
      const a=this.project(e.x,e.y),target=e.type==='sniper'&&e.aim?e.aim:p,b=this.project(target.x,target.y);
      c.setLineDash([5,5]);this.line(a.x,a.y,b.x,b.y,e.type==='sniper'?'#efb5cb8f':'#eaaa6855',1);c.setLineDash([]);
    }
    const pos=this.project(p.x,p.y);if(p.hp<=0)this.corpse(pos,'player');else this.actor(pos,'player',time,p);
    for(const cover of g.cover){const dx=cover.x-p.x,dy=cover.y-p.y;const x=pos.x+dx*t*(isBarrier(cover)?1:.48),y=pos.y+dy*t*(isBarrier(cover)?1:.48);this.line(x+(dy? -t*.27:0),y+(dx?-t*.27:0),x+(dy?t*.27:0),y+(dx?t*.27:0),cover.type==='wall'?'#8bd2c9':'#c7d896',2);}
    for(const e of g.visibleEnemies){const a=this.project(e.x,e.y);this.actor(a,e.type,time,e);if(missionTarget(g,e))this.text('◇',a.x-this.tile*.35,a.y-8,'#88f3ff',12);}
    const target=this.targetingEnabled?g.targeted:null;if(target){const a=this.project(target.x,target.y),r=t*.43;for(const [dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){this.line(a.x+dx*r,a.y+dy*r,a.x+dx*(r-7),a.y+dy*r,'#f1b07c',1.5);this.line(a.x+dx*r,a.y+dy*r,a.x+dx*r,a.y+dy*(r-7),'#f1b07c',1.5);}}
    for(const fx of this.effects) {
      const elapsed=time-fx.time-(fx.delay||0),age=elapsed/650;if(age<0||age>1)continue;
      const a=this.project(fx.from.x,fx.from.y),b=this.project(fx.to.x,fx.to.y),color=fx.color||(fx.type==='shot'?'#ffe1ad':'#ff986c');
      c.globalAlpha=1-age;
      const angle=Math.atan2(b.y-a.y,b.x-a.x),step=Math.floor(age*8)/8;
      if(fx.quiet){
        const q=fx.type==='shot'||fx.type==='enemyShot'?a:b;
        if(age<.25)this.box(q.x-5,q.y-5,10,10,'#ffe1ad55');
      }else if(fx.type==='fall'){
        if(elapsed<140){c.globalAlpha=(1-elapsed/140)*.85;this.effectSprite('impact',b,32);}
      }else if(fx.type==='miss'){
        // Arrival label only.
      }else if(fx.type==='unpack'){
        this.box(b.x-10,b.y-8,20,16,'#e5d99b55');
      }else if(fx.type==='gate'){
        this.box(b.x-7,b.y-7,14,14,fx.open?'#8ad2bb77':'#dec18477');
      }else if(fx.type==='pulse'){
        c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(b.x,b.y,t*(fx.radius+.3)*step,0,Math.PI*2);c.stroke();
      }else if(fx.type==='blast'){
        const size=32*Math.max(1,Math.round(t*(fx.radius+.5)/32*(.5+step)));
        this.effectSprite('impact',b,size);
        for(let i=0;i<10;i++){const theta=i*2.4,r=t*(fx.radius+.3)*step;this.box(Math.round((b.x+Math.cos(theta)*r)/3)*3,Math.round((b.y+Math.sin(theta)*r)/3)*3,3,3,i%2?'#ffb65a':'#c76039');}
      }else if(fx.type==='impact'){
        if(elapsed<70)this.box(b.x-6,b.y-6,12,12,'#fff1cbba');
        for(let i=0;i<7;i++){const theta=i*2.4,r=4+step*19;this.box(Math.round((b.x+Math.cos(theta)*r)/2)*2,Math.round((b.y+Math.sin(theta)*r)/2)*2,2,2,fx.mechanical?'#b7e2d0':'#bd654e');}
      }else if(fx.style==='claw'||fx.style==='slash'){
        if(elapsed<(fx.travel||80))this.effectSprite(fx.style,b,32,angle);
      }else if(elapsed<(fx.travel||125)){
        const progress=Math.min(1,elapsed/(fx.travel||125)),offset=(fx.spread||0)+(fx.missPath ? .35 : 0),end={x:b.x+Math.cos(angle+1.57)*t*offset,y:b.y+Math.sin(angle+1.57)*t*offset};
        if(age<.22)this.effectSprite('muzzle',a,16,angle);
        const q={x:a.x+(end.x-a.x)*progress,y:a.y+(end.y-a.y)*progress};
        if(fx.style==='grenade'){q.y-=Math.sin(progress*Math.PI)*t*.35;this.box(q.x-3,q.y-3,6,6,color,'#e9efca');}
        else if(fx.style==='pellet')this.box(q.x-1,q.y-1,3,3,'#ffe1ad');
        else {this.line(q.x-Math.cos(angle)*(fx.style==='tracer'?18:7),q.y-Math.sin(angle)*(fx.style==='tracer'?18:7),q.x,q.y,color,fx.style==='tracer'?2:1);this.effectSprite(fx.style==='plasma'?'plasma':'bullet',q,fx.style==='tracer'?32:16,angle);}
      }
      if(fx.miss||fx.damage>0)this.text(fx.miss?'MISS':'−'+fx.damage,b.x,b.y-20-(fx.quiet?0:age*23),color,fx.miss?10:14);c.globalAlpha=1;
    }
    this.effects=this.effects.filter(e=>time-e.time<700);
    if(!this.reduceMotion)for(let i=0;i<12;i++){const x=(i*127.3+time*.003)%this.w,y=(i*83.1+Math.sin(time*.0005+i)*10)%this.h;this.box(x,y,1,1,'#c6cda733');}
    // Walls occlude all world-space content, including actors, traces and transient effects.
    for(const {a,x,y}of wallCells){
      c.globalAlpha=[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.visibleTiles?.has((x+dx)+','+(y+dy)))?1:.36;
      this.wall(a,x,y);c.globalAlpha=1;
    }

    // Optional tactical overlay uses ground coordinates, above wall art for readability.
    this.drawTacticalOverlays();
  }
  drawTacticalOverlays(){
    const c=this.ctx,g=this.game,alpha=boundaryOpacityPercent(this.boundaryOpacity)/100;
    c.save();c.globalAlpha=alpha;
    if(this.movementBoundaries&&alpha>0)for(const edge of movementBoundaries(g)){
      const a=this.project(edge.x1,edge.y1),b=this.project(edge.x2,edge.y2);
      this.line(a.x,a.y,b.x,b.y,'#10191a',3);this.line(a.x,a.y,b.x,b.y,'#ffffff',1);
    }
    c.globalAlpha=1;
    for(const door of g.barriers)if(door.type==='door'&&door.hp>0&&g.visible(door)){
      const p=this.project(door.x,door.y),h=this.tile*.46,vertical=door.axis==='x';
      const a={x:p.x-(vertical?0:h),y:p.y-(vertical?h:0)},b={x:p.x+(vertical?0:h),y:p.y+(vertical?h:0)};
      if(door.open){for(const q of [a,b]){this.box(Math.round(q.x)-3,Math.round(q.y)-3,6,6,'#10191a');this.box(Math.round(q.x)-2,Math.round(q.y)-2,4,4,'#6ef39b');}}
      else {this.line(a.x,a.y,b.x,b.y,'#10191a',4);this.line(a.x,a.y,b.x,b.y,'#6ef39b',2);}
    }
    c.restore();
  }
  terrain(role,a,point,size=Math.round(this.tile),rotation=0){
    const sprite=resolveSprite(themeAt(this.game,point),role),image=sprite&&this.terrainImages.get(sprite.url);
    this.terrainReady=Boolean(image?.complete&&image.naturalWidth);
    if(!this.terrainReady)return false;
    const c=this.ctx;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(rotation*Math.PI/2);c.imageSmoothingEnabled=false;
    const toned=this.artTones?.get(image,sprite,role==='floor'?'floor':'prop');
    c.drawImage(toned||image,toned?0:sprite.x,toned?0:sprite.y,sprite.size,sprite.size,-Math.floor(size/2),-Math.floor(size/2),size,size);c.restore();return true;
  }
  sprite(name,a,size=32){const index=this.spriteNames.indexOf(name);if(index<0||!this.sprites.complete||!this.sprites.naturalWidth)return false;const cell={x:index%4*32,y:Math.floor(index/4)*32,size:32},toned=this.artTones?.get(this.sprites,cell,index<10?'unit':'prop');this.ctx.drawImage(toned||this.sprites,toned?0:cell.x,toned?0:cell.y,32,32,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);return true;}
  effectSprite(name,a,size=32,angle=0){const index=this.aftermathNames.indexOf(name),c=this.ctx;if(index<0||!this.aftermath.complete||!this.aftermath.naturalWidth)return false;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(angle);c.drawImage(name.startsWith('dead-')&&this.corpseReady?this.corpseAtlas:this.aftermath,(index%4)*32,Math.floor(index/4)*32,32,32,-size/2,-size/2,size,size);c.restore();return true;}
  corpse(a,type){const fall=this.effects.find(e=>e.type==='fall'&&e.actorType===type&&this.time-e.time<140&&this.project(e.to.x,e.to.y).x===a.x&&this.project(e.to.x,e.to.y).y===a.y);if(fall&&!this.reduceMotion){const progress=Math.max(0,Math.min(1,(this.time-fall.time)/140));a={x:a.x+Math.round((1-progress)*3),y:a.y-Math.round((1-progress)*4)};}const size=this.tile<30?16:32*Math.max(1,Math.floor(this.tile/32));const c=this.ctx;c.save();const drawn=this.effectSprite('dead-'+(type==='gunner'?'rifleman':type),a,size);c.restore();if(drawn)return;this.box(a.x-9,a.y-5,18,10,'#4e302780');this.line(a.x-7,a.y-4,a.x+8,a.y+5,'#8c78536b',3);}
  wall(a,x,y){
    const g=this.game,adjacent=[[0,1],[0,-1],[1,0],[-1,0]].map(([dx,dy])=>({x:x+dx,y:y+dy})).find(p=>g.grid[p.y]?.[p.x]===1);
    return drawWall(this.ctx,g,x,y,this.tile,a,this.terrainImages,themeAt(g,adjacent||{x,y}),this.artTones);
  }

  hazard(a,h,time){const t=this.tile,l=a.x-t*.43,top=a.y-t*.43;this.box(l,top,t*.86,t*.86,h.type==='acid'?'#709a4855':'#cf672c55');for(let i=0;i<4;i++){const n=(i*13)%25;this.box(l+5+n,top+5+(i*7)%23,4,3,h.type==='acid'?'#b8d47388':'#efa65a99');}this.glow(a.x,a.y,t*.7,h.type==='acid'?'#b4cd5312':'#f99a381a');}
  exit(a,time){const t=this.tile;this.box(a.x-t*.44,a.y-t*.44,t*.88,t*.88,'#284b40','#8fca9b');this.box(a.x-t*.32,a.y-t*.32,t*.64,t*.64,'#2e5b4a','#a1d3a655');for(let i=-1;i<=1;i++)this.line(a.x+i*9,a.y-8,a.x+i*9,a.y+6,'#102e24',2);this.text(this.game.exitBlocked?'LOCK':this.game.exitLabel==='上樓'?'UP':this.game.exitLabel==='下樓'?'DOWN':'EXIT',a.x,a.y+16,'#ceebbb',8);this.glow(a.x,a.y,t*.8,'#9de0aa1c');}
  item(a,item,time){const c=this.ctx;const colors={smoke:'#a9bbcb',emp:'#81dce9',stun:'#eee0a0',armor:'#92c4df',med:'#b9d2a2',ammo:'#c4ad70',pistol:'#b2c998',shell:'#dca186',energy:'#82cfc5',ordnance:'#ca9971',grenade:'#9eba87',scrap:'#c5a171',weapon:'#e9bd77',lore:'#c2a9db'};const color=colors[item.type]||'#c8bb93';this.box(a.x-9,a.y-6,18,15,'#14271f99');this.box(a.x-9,a.y-9,18,14,color,'#d7deb07f');this.box(a.x-7,a.y-7,14,10,'#263e3066');const symbol={smoke:'≋',emp:'E',stun:'✦',armor:'▣',med:'+',ammo:'R',pistol:'P',shell:'S',energy:'ϟ',ordnance:'•',grenade:'G',scrap:'◇',weapon:'W',lore:'D'}[item.type];this.text(symbol,a.x,a.y+2,'#e5eccb',10);if(item.cache)this.text(SUPPLY_NAMES[item.type],a.x,a.y+17,color,8);if(item.type==='weapon'){this.glow(a.x,a.y,24,'#eabd5d30');this.text('軍械',a.x,a.y-15,'#e8c185',8);}}
  moduleFloor(a,m){
    const t=this.tile,l=a.x-t/2,top=a.y-t/2,color=MODULE_TYPES[m.theme].color;
    this.box(l+2,top+2,t-4,t-4,m.theme==='restroom'?'#73939455':m.theme==='checkpoint'?'#8c784344':'#687b5744');
    if(m.theme==='restroom'){const q=(t-6)/2;for(let y=0;y<2;y++)for(let x=0;x<2;x++)this.box(l+3+x*q,top+3+y*q,q-1,q-1,(x+y)%2?'#a7c3b133':'#283e3f55');}
    else for(let i=0;i<3;i++)this.box(l+4+i*7,top+t-6,4,2,color+'66');
  }
  furniture(a,p){
    const m=this.game.props.find(o=>o.id===p.moduleId);
    // These sprites have a visible front face, not a top-down view to rotate.
    const rotation=['locker','counter','bench'].includes(p.style)?0:m?.rotation||0;
    if(this.terrain(p.style,a,p,Math.round(this.tile),rotation)){this.objectHealth(p,a.x-12,a.y-this.tile*.44);return;}

    const u=Math.max(1,Math.floor(this.tile/22)),x=Math.round(a.x)-8*u,y=Math.round(a.y)-8*u;
    const rect=(dx,dy,w,h,color)=>this.box(x+dx*u,y+dy*u,w*u,h*u,color);
    rect(0,2,16,14,'#132720aa');
    if(p.style==='toilet'){rect(4,0,8,4,'#aebbb4');rect(3,5,10,9,'#c9d3c8');rect(5,6,6,5,'#526b69');rect(6,7,4,3,'#88b6b0');rect(5,14,6,2,'#8b9e94');}
    if(p.style==='sink'){rect(0,1,16,13,'#96aba3');rect(2,4,12,8,'#d2dacf');rect(4,5,8,5,'#537c7c');rect(7,0,2,6,'#dae0cb');rect(6,8,4,1,'#a4c6bd');}
    if(p.style==='counter'){rect(0,2,16,12,'#aa9973');rect(1,3,14,7,'#d1bd89');rect(2,11,12,3,'#665e43');rect(9,4,5,4,'#253e35');rect(10,5,3,2,'#8db6a0');}
    if(p.style==='scanner'){rect(1,1,14,10,'#859b91');rect(3,3,10,6,'#193c34');rect(4,4,6,1,'#9bceaa');rect(4,7,8,1,'#70aa90');rect(6,11,4,2,'#576a60');rect(3,13,10,2,'#9ea982');}
    if(p.style==='locker'){rect(1,0,14,16,'#879681');rect(2,1,5,14,'#536553');rect(9,1,5,14,'#63765c');rect(5,6,1,4,'#d0c49b');rect(10,6,1,4,'#d0c49b');for(let i=0;i<2;i++)rect(3+i*7,2,3,1,'#adbaa2');}
    if(p.style==='bench'){rect(0,2,16,11,'#889174');rect(1,3,14,8,'#b3b69a');rect(2,13,3,2,'#485c48');rect(11,13,3,2,'#485c48');rect(8,4,5,5,'#587363');rect(2,5,3,3,'#d2d4bb');rect(3,6,2,1,'#64533d');}
    this.objectHealth(p,a.x-12,y-4);
  }
  prop(a,p,time){
    if(p.type==='module'){const q=modulePoint(p,0,1);if(this.game.visibleTiles.has(`${q.x},${q.y}`)){const pos=this.project(q.x,q.y);this.text(MODULE_TYPES[p.theme].code,pos.x,pos.y+this.tile*.3,MODULE_TYPES[p.theme].color,8);}return;}
    if(p.style&&p.hp>0){this.furniture(a,p);return;}

    if(isContainer(p)){
      if(!p.opened&&this.terrain('case',a,p)){const info=CONTAINER_KINDS[p.kind];this.box(a.x-7,a.y-4,14,10,'#18332eee',info.color);this.text(info.symbol,a.x,a.y+4,info.color,9);return;}

      const info=CONTAINER_KINDS[p.kind],u=Math.max(1,Math.floor(this.tile/22)),x=Math.round(a.x)-8*u,y=Math.round(a.y)-6*u;
      this.box(x,y,16*u,12*u,'#172a23');this.box(x+u,y+u,14*u,10*u,p.opened?'#34453b':info.color);
      this.box(x+3*u,y+3*u,10*u,6*u,p.opened?'#14271f':'#465343');
      if(p.opened){this.box(x,y-2*u,16*u,2*u,'#687963');return;}
      this.box(x+u,y+5*u,2*u,2*u,'#e2d8ac');this.box(x+13*u,y+5*u,2*u,2*u,'#e2d8ac');this.text(info.symbol,a.x,a.y+3*u,info.color,9*u);return;
    }
if((p.hp>0||p.type==='terminal')&&this.terrain(p.type,a,p)){
      this.objectHealth(p,a.x-12,a.y-16);
      if(p.type==='terminal'&&p.used)this.box(a.x-8,a.y-9,16,12,'#17241ad0');return;
    }
if((p.hp>0||p.type==='terminal')&&this.sprite(p.type,a,32)){this.objectHealth(p,a.x-12,a.y-16);if(p.type==='terminal'&&p.used)this.box(a.x-8,a.y-7,15,10,'#17241ab0');return;}if(p.type==='terminal'){this.box(a.x-13,a.y-13,26,27,'#263c34','#75977755');this.box(a.x-9,a.y-10,18,12,p.used?'#354339':'#82b6a0');this.line(a.x-7,a.y+7,a.x+7,a.y+7,'#9da77955',2);if(!p.used)this.glow(a.x,a.y-4,20,'#9ee3b41a');return;}
    if(p.hp<=0){this.box(a.x-13,a.y-5,9,8,'#6f705751');this.box(a.x+2,a.y+3,12,6,'#85775a51');return;}
    if(p.type==='barrel'){const c=this.ctx;c.fillStyle='#795032';c.beginPath();c.ellipse(a.x,a.y,10,13,0,0,Math.PI*2);c.fill();this.box(a.x-9,a.y-7,18,3,'#ca8b4f');this.box(a.x-9,a.y+6,18,3,'#ce9859');this.text('!',a.x,a.y+4,'#ffdaa0',12);this.objectHealth(p,a.x-12,a.y-16);return;}
    const t=this.tile;this.box(a.x-t*.4,a.y-t*.35+5,t*.8,t*.7,'#17281f99');this.box(a.x-t*.4,a.y-t*.35,t*.8,t*.7,'#717354','#aea87988');this.box(a.x-t*.32,a.y-t*.27,t*.64,t*.54,'#525c40','#93966f66');this.line(a.x-t*.29,a.y-t*.23,a.x+t*.29,a.y+t*.23,'#b6b17999',2);this.line(a.x+t*.29,a.y-t*.23,a.x-t*.29,a.y+t*.23,'#b6b17999',2);this.objectHealth(p,a.x-12,a.y-t*.39,24,'#c4c394');
  }
  actor(a,type,time,e) {
    const c=this.ctx,player=type==='player',def=ENEMY_TYPES[type],large=type==='boss'||type==='warden',s=this.tile/45*(large?1.15:1);
    const spriteType=type==='gunner'?'rifleman':type;
    if(this.sprites.complete&&this.sprites.naturalWidth&&this.spriteNames.includes(spriteType)){
      const size=this.tile<30?16:32*Math.max(1,Math.floor(this.tile/32));
      if(player){this.box(a.x-17,a.y-17,34,34,'#e0bb5110','#e8b36e99');if(e.guard){c.strokeStyle='#acd5ca';c.lineWidth=2;c.beginPath();c.arc(a.x,a.y,20,0,Math.PI*2);c.stroke();}}
      c.save();c.shadowColor='rgba(0,0,0,0.9)';c.shadowBlur=8;this.sprite(spriteType,a,size);c.restore();
      if(e.control?.disabled){this.box(a.x-size/2,a.y-size/2,size,size,'#b9d5e94f');this.text(`×${e.control.disabled}`,a.x+this.tile*.35,a.y-10,'#d6edff',11);}
      if(player){this.text('YOU',a.x,a.y+this.tile*.58,'#e8ba81',7);const f=e.facing||[0,1];this.box(a.x+f[0]*18-1,a.y+f[1]*18-1,3,3,'#ffe3ab');}
      else{this.box(a.x-13,a.y-this.tile*.45,26,3,'#17271e');this.box(a.x-13,a.y-this.tile*.45,26*e.hp/e.maxHp,3,e.charge?'#f2b779':def.color);if(e.charge)this.text(e.type==='sniper'?String(e.windup||1):'!',a.x+this.tile*.38,a.y-9,'#ffc789',14);}
      return;
    }
    c.save();c.translate(a.x,a.y);c.scale(s,s);
    this.glow(0,0,22,player?'#e2b2631f':'#00000033');
    if(player){this.box(-16,-16,32,32,'#e0bb5110','#e8b36e99');if(e.guard){c.strokeStyle='#acd5ca';c.lineWidth=2;c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.stroke();}}
    const facing=player?e.facing:[this.game.player.x-e.x,this.game.player.y-e.y];
    c.rotate(Math.atan2(facing[1],facing[0])-Math.PI/2);
    if(type==='crawler'||type==='bomber'){
      const color=type==='bomber'?'#aabb71':'#ba966d';for(const x of[-10,10])for(const y of[-7,7])this.line(x*.5,y*.7,x,y+3,color,3);
      this.box(-7,-9,14,18,'#6d6544',color);this.box(-6,-2,12,12,color);this.box(-5,8,10,5,'#d1b88a');this.line(-4,12,4,12,'#ed855c',2);if(type==='bomber')this.glow(0,0,16,'#e9d24c33');
    }else if(type==='drone'){
      for(const x of[-10,10]){this.box(x-4,-8,8,16,'#547b70','#adcfc0');this.line(x,-11,x,11,'#8ad5d177',2);}
      this.box(-7,-6,14,12,'#99c9bd','#d4eee1');this.box(-3,0,6,4,'#edbb8d');
    }else{
      const color=player?'#ca9257':def.color;this.box(-8,-7,6,18,'#334939','#6a795555');this.box(2,-7,6,18,'#334939','#6a795555');
      this.box(-12,-6,24,16,color,'#d5c29055');this.box(-7,-8,14,18,player?'#827853':'#59684d');
      this.box(-7,-10,14,13,color,'#e1d7a66f');this.box(-5,0,10,3,player?'#aff1e0':'#f2ab80');
      this.box(8,1,5,20,'#1d2e29','#879c8a');this.box(9,18,3,6,'#b0b6a1');
      if(type==='brute'||large){this.box(-15,-7,6,19,'#8f795c','#d2bd9255');this.box(9,-7,6,19,'#8f795c','#d2bd9255');}
      if(type==='sniper')this.box(9,18,3,12,'#cad3b2');
    }
    c.restore();
    if(!player){this.box(a.x-13,a.y-this.tile*.45,26,3,'#17271e');this.box(a.x-13,a.y-this.tile*.45,26*e.hp/e.maxHp,3,e.charge?'#f2b779':def.color);if(e.charge)this.text(e.type==='sniper'?String(e.windup||1):'!',a.x+this.tile*.38,a.y-9,'#ffc789',14);}
    else this.text('YOU',a.x,a.y+this.tile*.58,'#e8ba81',7);
  }
  markArea(center,radius,fill,stroke,label){const g=this.game,t=this.tile;for(const {x,y} of areaCells(g.grid,center,radius,g.barriers)){const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,fill,stroke);}if(label){const a=this.project(center.x,center.y);this.text(label,a.x,a.y+5,'#ffd3a4',17);}}
  drawMap(canvas){const c=canvas.getContext('2d'),g=this.game,k=canvas.width/SIZE;c.fillStyle='#10191a';c.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(g.grid[y][x]===1&&g.seen[y][x]){c.fillStyle=g.visibleTiles.has(`${x},${y}`)?(isDark(g,{x,y})?'#343e62':'#809672'):(isDark(g,{x,y})?'#232a40':'#384b3a');c.fillRect(x*k+1,y*k+1,k-2,k-2);}for(const m of g.props.filter(p=>p.type==='module'))for(const q of moduleCells(m))if(g.seen[q.y]?.[q.x]){c.strokeStyle=MODULE_TYPES[m.theme].color+'88';c.lineWidth=1;c.strokeRect(q.x*k+1,q.y*k+1,k-2,k-2);}for(const station of g.props.filter(p=>p.type==='terminal'&&g.seen[p.y]?.[p.x])){c.fillStyle=station.used?'#526c62':'#a3e3c0';c.fillRect(station.x*k+3,station.y*k+3,k-6,k-6);}for(const b of g.barriers)if(b.hp>0&&edgeCells(b).some(p=>g.seen[p.y]?.[p.x])){const x=(b.x+.5)*k,y=(b.y+.5)*k;c.strokeStyle=b.open?'#8ad2bb':b.type==='door'?'#dec184':'#bdc7bd';c.lineWidth=2;c.beginPath();c.moveTo(x-(b.axis==='y'?k/2:0),y-(b.axis==='x'?k/2:0));c.lineTo(x+(b.axis==='y'?k/2:0),y+(b.axis==='x'?k/2:0));c.stroke();}for(const box of g.props.filter(o=>isContainer(o)&&!o.opened&&g.seen[o.y]?.[o.x])){c.strokeStyle=CONTAINER_KINDS[box.kind].color;c.lineWidth=2;c.strokeRect(box.x*k+3,box.y*k+3,Math.max(3,k-6),Math.max(3,k-6));}for(const item of g.items)if(g.seen[item.y]?.[item.x]){c.fillStyle='#d9bd7b';c.fillRect(item.x*k+4,item.y*k+4,Math.max(2,k-8),Math.max(2,k-8));}for(const [o,color]of[[g.exitPoint,'#9ee3bf'],...g.visibleEnemies.map(e=>[e,'#e29a78']),[g.player,'#ffcb8c']])if(g.seen[o.y]?.[o.x]){c.fillStyle=color;c.fillRect(o.x*k+2,o.y*k+2,k-4,k-4);}for(const o of [...missionObjects(g).filter(t=>!t.done),...g.visibleEnemies.filter(e=>missionTarget(g,e))])if(g.seen[o.y]?.[o.x]){c.strokeStyle='#88f3ff';c.lineWidth=2;c.strokeRect(o.x*k+1,o.y*k+1,k-2,k-2);}const target=this.targetingEnabled?g.targeted:null;if(target){c.strokeStyle='#ffd9a0';c.strokeRect(target.x*k+.5,target.y*k+.5,k-1,k-1);}}
  addEffects(effects){this.effects.push(...effects.map(e=>({...e,time:this.time})));this.effects=this.effects.slice(-64);}
}
