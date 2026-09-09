import {cameraFrame} from './camera.js';
import {SIZE,FLOOR_INFO,ENEMY_TYPES,distance} from './engine.js';

// Orthographic board: world +x = screen right, world +y = screen down.
// Art is drawn procedurally to remain sharp at every phone density.
export class Renderer {
  constructor(canvas,game) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.game=game;this.zoom=1;
    this.camera={x:game.player.x,y:game.player.y};this.effects=[];this.last=0;
    this.aim=null;this.mode=null;this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  glow(x,y,r,color){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
  box(x,y,w,h,color,stroke){const c=this.ctx;c.fillStyle=color;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}}
  text(value,x,y,color='#c1ceb2',size=9){const c=this.ctx;c.font=`${size}px monospace`;c.textAlign='center';c.fillStyle=color;c.fillText(value,x,y);}
  frame(t) {
    const dt=Math.min((t-this.last)/1000,.1);this.last=t;
    if(!document.hidden){const frame=cameraFrame(this.game.player,this.game.targeted,this.aim,this.w,this.h,this.zoom);this.camera={x:frame.x,y:frame.y};this.tile=frame.tile;this.draw(t);}
    requestAnimationFrame(v=>this.frame(v));
  }
  draw(time) {
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.globalAlpha=1;c.imageSmoothingEnabled=false;
    this.box(0,0,this.w,this.h,'#10191a');
    const palette=FLOOR_INFO[g.floor-1],radial=c.createRadialGradient(this.w/2,this.h/2,30,this.w/2,this.h/2,this.w*.65);
    radial.addColorStop(0,'#354337');radial.addColorStop(1,'#101819');c.fillStyle=radial;c.fillRect(0,0,this.w,this.h);
    const minX=Math.max(0,Math.floor(this.camera.x-this.w/t/2-1)),maxX=Math.min(SIZE-1,Math.ceil(this.camera.x+this.w/t/2+1));
    const minY=Math.max(0,Math.floor(this.camera.y-this.h/t/2-1)),maxY=Math.min(SIZE-1,Math.ceil(this.camera.y+this.h/t/2+1));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
      const a=this.project(x,y),left=a.x-half,top=a.y-half,seen=g.seen[y][x];
      if(g.grid[y][x]!==1) {
        if([[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.grid[y+dy]?.[x+dx]===1&&g.seen[y+dy]?.[x+dx]))this.wall(a,x,y,palette.color);
        else this.box(left,top,t,t,'#12201a10','#6685790c');continue;
      }
      if(!seen)continue;
      c.globalAlpha=g.visibleTiles?.has(`${x},${y}`)?1:.36;
      const v=(x*13+y*31)%6;
      this.box(left+1,top+1,t-2,t-2,['#344031','#394334','#313e31','#3b4435','#364133','#303e32'][v],'#5964455c');
      this.box(left+5,top+5,t-10,t-10,'#1b2d2318','#86926313');
      this.line(left+7,top+7,left+t-8,top+7,'#8c9a6425');
      if(v===2||v===5)for(let i=0;i<4;i++)this.line(left+9,top+12+i*4,left+t-9,top+12+i*4,'#12231955',2);
      if(v===1){this.box(left+5,top+5,2,2,'#bcc39466');this.box(left+t-7,top+t-7,2,2,'#bcc39455');}
      for(const [dx,dy]of[[0,-1],[-1,0]])if(g.grid[y+dy]?.[x+dx]!==1){if(dx)this.line(left+3,top+7,left+3,top+t-7,'#c3aa625e',2);else this.line(left+7,top+3,left+t-7,top+3,'#c3aa625e',2);}
      const hazard=g.hazards.find(h=>h.x===x&&h.y===y);if(hazard)this.hazard(a,hazard,time);
      if(distance(p,{x,y})===1&&g.passable(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))this.box(left+3,top+3,t-6,t-6,'#b0ba8010','#b1c48a3b');
      if(g.end.x===x&&g.end.y===y)this.exit(a,time);
      for(const dead of g.enemies)if(dead.hp<=0&&dead.x===x&&dead.y===y)this.corpse(a,dead.type);
      for(const item of g.items)if(item.x===x&&item.y===y)this.item(a,item,time);
      for(const prop of g.props)if(prop.x===x&&prop.y===y)this.prop(a,prop,time);
      c.globalAlpha=1;
    }
    for(const m of g.marks)this.markArea(m,1,'#e969494f','#f8996977',String(Math.max(1,m.due-g.turn)));
    if(this.mode==='grenade'&&this.aim)this.markArea(this.aim,2,'#e6a95b33','#eacb84aa','');
    for(const e of g.visibleEnemies.filter(e=>e.charge)) {
      const a=this.project(e.x,e.y),target=e.type==='sniper'&&e.aim?e.aim:p,b=this.project(target.x,target.y);
      c.setLineDash([5,5]);this.line(a.x,a.y,b.x,b.y,e.type==='sniper'?'#efb5cb8f':'#eaaa6855',1);c.setLineDash([]);
    }
    const pos=this.project(p.x,p.y);if(p.hp<=0)this.corpse(pos,'player');else this.actor(pos,'player',time,p);
    for(const cover of g.cover){const dx=cover.x-p.x,dy=cover.y-p.y;const x=pos.x+dx*t*.48,y=pos.y+dy*t*.48;this.line(x+(dy? -t*.27:0),y+(dx?-t*.27:0),x+(dy?t*.27:0),y+(dx?t*.27:0),cover.type==='wall'?'#8bd2c9':'#c7d896',2);}
    for(const e of g.visibleEnemies){const a=this.project(e.x,e.y);this.actor(a,e.type,time,e);}
    const target=g.targeted;if(target){const a=this.project(target.x,target.y),r=t*.43;for(const [dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){this.line(a.x+dx*r,a.y+dy*r,a.x+dx*(r-7),a.y+dy*r,'#f1b07c',1.5);this.line(a.x+dx*r,a.y+dy*r,a.x+dx*r,a.y+dy*(r-7),'#f1b07c',1.5);}}
    for(const fx of this.effects) {
      const age=(time-fx.time)/650;if(age>1)continue;
      const a=this.project(fx.from.x,fx.from.y),b=this.project(fx.to.x,fx.to.y),color=fx.color||(fx.type==='shot'?'#ffe1ad':'#ff986c');
      c.globalAlpha=1-age;
      const angle=Math.atan2(b.y-a.y,b.x-a.x),step=Math.floor(age*8)/8;
      if(fx.type==='blast'){
        const size=32*Math.max(1,Math.round(t*(fx.radius+.5)/32*(.5+step)));
        this.effectSprite('impact',b,size);
        for(let i=0;i<10;i++){const theta=i*2.4,r=t*(fx.radius+.3)*step;this.box(Math.round((b.x+Math.cos(theta)*r)/3)*3,Math.round((b.y+Math.sin(theta)*r)/3)*3,3,3,i%2?'#ffb65a':'#c76039');}
      }else if(fx.type==='impact'){
        for(let i=0;i<7;i++){const theta=i*2.4,r=4+step*19;this.box(Math.round((b.x+Math.cos(theta)*r)/2)*2,Math.round((b.y+Math.sin(theta)*r)/2)*2,2,2,fx.mechanical?'#b7e2d0':'#bd654e');}
      }else if(fx.style==='claw'||fx.style==='slash'){
        if(age<.65)this.effectSprite(fx.style,b,32,angle);
      }else if(age<.6){
        const progress=Math.min(1,Math.floor(age*14)/6),end={x:b.x+(fx.miss?Math.cos(angle+1.57)*t*.35:0),y:b.y+(fx.miss?Math.sin(angle+1.57)*t*.35:0)};
        if(age<.22)this.effectSprite('muzzle',a,16,angle);
        this.effectSprite(fx.style==='plasma'?'plasma':'bullet',{x:a.x+(end.x-a.x)*progress,y:a.y+(end.y-a.y)*progress},32,angle);
      }
      if(fx.miss||fx.damage>0)this.text(fx.miss?'MISS':'−'+fx.damage,b.x,b.y-20-age*23,color,fx.miss?10:14);c.globalAlpha=1;
    }
    this.effects=this.effects.filter(e=>time-e.time<700);
    if(!this.reduceMotion)for(let i=0;i<12;i++){const x=(i*127.3+time*.003)%this.w,y=(i*83.1+Math.sin(time*.0005+i)*10)%this.h;this.box(x,y,1,1,'#c6cda733');}

  }
  sprite(name,a,size=32){const index=this.spriteNames.indexOf(name);if(index<0||!this.sprites.complete||!this.sprites.naturalWidth)return false;this.ctx.drawImage(this.sprites,(index%4)*32,Math.floor(index/4)*32,32,32,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);return true;}
  effectSprite(name,a,size=32,angle=0){const index=this.aftermathNames.indexOf(name),c=this.ctx;if(index<0||!this.aftermath.complete||!this.aftermath.naturalWidth)return false;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(angle);c.drawImage(name.startsWith('dead-')&&this.corpseReady?this.corpseAtlas:this.aftermath,(index%4)*32,Math.floor(index/4)*32,32,32,-size/2,-size/2,size,size);c.restore();return true;}
  corpse(a,type){const size=this.tile<30?16:32*Math.max(1,Math.floor(this.tile/32));const c=this.ctx;c.save();const drawn=this.effectSprite('dead-'+(type==='gunner'?'rifleman':type),a,size);c.restore();if(drawn)return;this.box(a.x-9,a.y-5,18,10,'#4e302780');this.line(a.x-7,a.y-4,a.x+8,a.y+5,'#8c78536b',3);}
  wall(a,x,y,color) {
    const t=this.tile,l=a.x-t/2,top=a.y-t/2;
    this.box(l,top,t,t,'#29372e','#64705244');
    this.box(l+2,top+2,t-4,t-10,'#4a5441','#8f997a30');
    this.box(l+2,top+t-8,t-4,7,'#20302a');
    this.line(l+6,top+5,l+t-6,top+5,'#a6af7c44');
    if((x+y)%3===0){this.box(l+t*.23,top+t-7,t*.54,2,color);this.glow(a.x,a.y+t*.4,t*.55,color+'0c');}
    if((x*3+y)%5===0)for(let i=0;i<3;i++)this.line(l+9+i*7,top+12,l+9+i*7,top+t-15,'#1a2d2550',2);
  }
  hazard(a,h,time){const t=this.tile,l=a.x-t*.43,top=a.y-t*.43;this.box(l,top,t*.86,t*.86,h.type==='acid'?'#709a4855':'#cf672c55');for(let i=0;i<4;i++){const n=(i*13)%25;this.box(l+5+n,top+5+(i*7)%23,4,3,h.type==='acid'?'#b8d47388':'#efa65a99');}this.glow(a.x,a.y,t*.7,h.type==='acid'?'#b4cd5312':'#f99a381a');}
  exit(a,time){const t=this.tile;this.box(a.x-t*.44,a.y-t*.44,t*.88,t*.88,'#284b40','#8fca9b');this.box(a.x-t*.32,a.y-t*.32,t*.64,t*.64,'#2e5b4a','#a1d3a655');for(let i=-1;i<=1;i++)this.line(a.x+i*9,a.y-8,a.x+i*9,a.y+6,'#102e24',2);this.text(this.game.bossAlive?'LOCK':'EXIT',a.x,a.y+16,'#ceebbb',8);this.glow(a.x,a.y,t*.8,'#9de0aa1c');}
  item(a,item,time){const c=this.ctx;const colors={med:'#b9d2a2',ammo:'#c4ad70',energy:'#82cfc5',ordnance:'#ca9971',grenade:'#9eba87',scrap:'#c5a171',weapon:'#e9bd77',lore:'#c2a9db'};const color=colors[item.type]||'#c8bb93';this.box(a.x-9,a.y-6,18,15,'#14271f99');this.box(a.x-9,a.y-9,18,14,color,'#d7deb07f');this.box(a.x-7,a.y-7,14,10,'#263e3066');const symbol={med:'+',ammo:'≡',energy:'ϟ',ordnance:'•',grenade:'G',scrap:'S',weapon:'W',lore:'D'}[item.type];this.text(symbol,a.x,a.y+2,'#e5eccb',10);if(item.type==='weapon'){this.glow(a.x,a.y,24,'#eabd5d30');this.text('軍械',a.x,a.y-15,'#e8c185',8);}}
  prop(a,p,time){if((p.hp>0||p.type==='terminal')&&this.sprite(p.type,a,32)){if(p.type==='cover'){this.box(a.x-12,a.y-16,24,2,'#17281f');this.box(a.x-12,a.y-16,24*p.hp/p.maxHp,2,'#cad396');}if(p.type==='terminal'&&p.used)this.box(a.x-8,a.y-7,15,10,'#17241ab0');return;}if(p.type==='terminal'){this.box(a.x-13,a.y-13,26,27,'#263c34','#75977755');this.box(a.x-9,a.y-10,18,12,p.used?'#354339':'#82b6a0');this.line(a.x-7,a.y+7,a.x+7,a.y+7,'#9da77955',2);if(!p.used)this.glow(a.x,a.y-4,20,'#9ee3b41a');return;}
    if(p.hp<=0){this.box(a.x-13,a.y-5,9,8,'#6f705751');this.box(a.x+2,a.y+3,12,6,'#85775a51');return;}
    if(p.type==='barrel'){const c=this.ctx;c.fillStyle='#795032';c.beginPath();c.ellipse(a.x,a.y,10,13,0,0,Math.PI*2);c.fill();this.box(a.x-9,a.y-7,18,3,'#ca8b4f');this.box(a.x-9,a.y+6,18,3,'#ce9859');this.text('!',a.x,a.y+4,'#ffdaa0',12);return;}
    const t=this.tile;this.box(a.x-t*.4,a.y-t*.35+5,t*.8,t*.7,'#17281f99');this.box(a.x-t*.4,a.y-t*.35,t*.8,t*.7,'#717354','#aea87988');this.box(a.x-t*.32,a.y-t*.27,t*.64,t*.54,'#525c40','#93966f66');this.line(a.x-t*.29,a.y-t*.23,a.x+t*.29,a.y+t*.23,'#b6b17999',2);this.line(a.x+t*.29,a.y-t*.23,a.x-t*.29,a.y+t*.23,'#b6b17999',2);this.box(a.x-12,a.y-t*.39,24,2,'#17281f');this.box(a.x-12,a.y-t*.39,24*p.hp/p.maxHp,2,'#c4c394');
  }
  actor(a,type,time,e) {
    const c=this.ctx,player=type==='player',def=ENEMY_TYPES[type],large=type==='boss'||type==='warden',s=this.tile/45*(large?1.15:1);
    const spriteType=type==='gunner'?'rifleman':type;
    if(this.sprites.complete&&this.sprites.naturalWidth&&this.spriteNames.includes(spriteType)){
      const size=this.tile<30?16:32*Math.max(1,Math.floor(this.tile/32));
      if(player){this.box(a.x-17,a.y-17,34,34,'#e0bb5110','#e8b36e99');if(e.guard){c.strokeStyle='#acd5ca';c.lineWidth=2;c.beginPath();c.arc(a.x,a.y,20,0,Math.PI*2);c.stroke();}}
      this.sprite(spriteType,a,size);
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
  markArea(center,radius,fill,stroke,label){const g=this.game,t=this.tile;for(let y=center.y-radius;y<=center.y+radius;y++)for(let x=center.x-radius;x<=center.x+radius;x++)if(distance(center,{x,y})<=radius&&g.grid[y]?.[x]===1){const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,fill,stroke);}if(label){const a=this.project(center.x,center.y);this.text(label,a.x,a.y+5,'#ffd3a4',17);}}
  drawMap(canvas){const c=canvas.getContext('2d'),g=this.game,k=canvas.width/SIZE;c.fillStyle='#10191a';c.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(g.grid[y][x]===1&&g.seen[y][x]){c.fillStyle=g.visibleTiles.has(`${x},${y}`)?'#809672':'#384b3a';c.fillRect(x*k+1,y*k+1,k-2,k-2);}for(const [o,color]of[[g.end,'#9ee3bf'],...g.visibleEnemies.map(e=>[e,'#e29a78']),[g.player,'#ffcb8c']])if(g.seen[o.y]?.[o.x]){c.fillStyle=color;c.fillRect(o.x*k+2,o.y*k+2,k-4,k-4);}const target=g.targeted;if(target){c.strokeStyle='#ffd9a0';c.strokeRect(target.x*k+.5,target.y*k+.5,k-1,k-1);}}
  addEffects(effects){this.effects.push(...effects.map(e=>({...e,time:performance.now()})));this.effects=this.effects.slice(-64);}
}
