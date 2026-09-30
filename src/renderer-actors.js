// Actors (3.206.3 split): sprites and their caches (tints, elite outlines, the dark), class art, corpses, idle
// breathing, a unit with its bars, pips and marks, and the corner badge.
// Methods of Renderer (src/renderer.js), which copies them onto Renderer.prototype (src/mixin.js, 3.206.3): `this` is
// the renderer, `this.game` the state being drawn and `this.ctx` the canvas.
import {suppressionStacks} from './suppression.js';
import {unitTree} from './behavior-tree.js';
import {ELITE_VISUAL,OPERATIVE_VISUAL,enemyDrawing,enemySprite,enemyTint,spriteToneRole} from './enemy-visuals.js';
import {classSpriteRect} from './class-art.js';
import {tintPixels,tintedSprite} from './operator-color.js';
import {isDark} from './lighting.js';
import {spriteSize} from './target-card.js';
import {ENEMY_TYPES} from './engine.js';
import {DARK_ACTOR_BRIGHTNESS,cornerHidden} from './actor-visuals.js';
import {drawKiaGround,drawKiaBody} from './kia-art.js';
import {isBarrier} from './barriers.js';
import {missionTarget} from './missions.js';
import {setsFires} from './rebel-bosses.js';
import {connected} from './allies.js';
import {t as tx} from './i18n.js';   // t is the tile size in the draw code
// Two source pixels over 2.4s, the value the user picked from qa/breathing-lab.html.
const BREATH_DROP=2,BREATH_PERIOD=2400;
export class RendererActors {
  cornerBadge(a){
    // Screen-space status: readable above wall art, without fading the actor silhouette.
    const c=this.ctx,y=Math.round(a.y+this.tile*.43),w=16,x=Math.round(a.x-w/2);
    this.box(x,y,w,15,'#263c34ee','#759777');
    const cx=x+8,cy=y+7.5;
    c.save();c.strokeStyle='#82b6a0';c.lineWidth=1;c.beginPath();c.arc(cx,cy,4,0,Math.PI*2);c.stroke();
    this.line(cx-6,cy,cx+6,cy,'#82b6a0',1);this.line(cx,cy-6,cx,cy+6,'#82b6a0',1);
    this.line(cx-5,cy+5,cx+5,cy-5,'#263c34',3);this.line(cx-5,cy+5,cx+5,cy-5,'#a3e3c0',1.5);c.restore();
  }
  // Enemy tint and elite outline (3.79.1). Untinted, non-elite enemies go straight to sprite(), so they draw exactly
  // as before; cells are cached per source image so theme tone changes cannot reuse a stale canvas.
  cellCanvas(image,from,key,paint){const byImage=(this.enemyCellCache??=new WeakMap());let cache=byImage.get(image);if(!cache){cache=new Map();byImage.set(image,cache);}if(cache.has(key))return cache.get(key);let canvas=null;try{canvas=document.createElement('canvas');canvas.width=canvas.height=32;const c=canvas.getContext('2d');c.drawImage(image,from.x,from.y,32,32,0,0,32,32);paint(c);}catch{canvas=null;}cache.set(key,canvas);return canvas;}
  // A ring-only canvas (silhouette spread one pixel, sprite shape removed) drawn after the sprite with shadows off;
  // drawn underneath, the sprite's own shadow blur hid the ring.
  outlineRing(image,from,key,color){const byImage=(this.enemyCellCache??=new WeakMap());let cache=byImage.get(image);if(!cache){cache=new Map();byImage.set(image,cache);}const id=`ring:${key}:${color}`;if(cache.has(id))return cache.get(id);let ring=null;try{const silhouette=document.createElement('canvas');silhouette.width=silhouette.height=32;const s=silhouette.getContext('2d');s.drawImage(image,from.x,from.y,32,32,0,0,32,32);s.globalCompositeOperation='source-in';s.fillStyle=color;s.fillRect(0,0,32,32);ring=document.createElement('canvas');ring.width=ring.height=34;const r=ring.getContext('2d');for(let dx=0;dx<=2;dx++)for(let dy=0;dy<=2;dy++)if(dx!==1||dy!==1)r.drawImage(silhouette,dx,dy);r.globalCompositeOperation='destination-out';r.drawImage(image,from.x,from.y,32,32,1,1,32,32);}catch{ring=null;}cache.set(id,ring);return ring;}
  drawOutline(image,from,key,color,a,size){const ring=this.outlineRing(image,from,key,color);if(!ring)return;const c=this.ctx,unit=size/32,x=Math.round(a.x-size/2),y=Math.round(a.y-size/2);c.save();c.shadowColor='transparent';c.shadowBlur=0;c.drawImage(ring,0,0,34,34,x-unit,y-unit,size+2*unit,size+2*unit);c.restore();}
  enemySprite(name,a,size,dark,hidden,tint,outline){
    if(!tint&&!outline)return this.sprite(name,a,size,dark,hidden);
    const index=this.spriteNames.indexOf(name);if(index<0||!this.sprites.complete||!this.sprites.naturalWidth)return false;
    const cell={x:index%4*32,y:Math.floor(index/4)*32,size:32},toned=this.artTones?.get(this.sprites,cell,spriteToneRole(name)),image=toned||this.sprites,from=toned?{x:0,y:0}:cell;
    let source=image,sx=from.x,sy=from.y;
    if(tint){const tinted=this.cellCanvas(image,from,`tint:${name}:${tint}`,c=>{const pixels=c.getImageData(0,0,32,32);tintPixels(pixels.data,tint);c.putImageData(pixels,0,0);});if(tinted){source=tinted;sx=0;sy=0;}}
    if(dark)source=this.darkActors.get(source);if(hidden)source=this.hiddenActors?.get(source)||source;
    this.ctx.drawImage(source,sx,sy,32,32,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);
    if(outline)this.drawOutline(image,from,name,outline,a,size);
    return true;
  }
  sprite(name,a,size=32,dark=false,hidden=false){const index=this.spriteNames.indexOf(name);if(index<0||!this.sprites.complete||!this.sprites.naturalWidth)return false;const cell={x:index%4*32,y:Math.floor(index/4)*32,size:32},toned=this.artTones?.get(this.sprites,cell,spriteToneRole(name));let source=dark?this.darkActors.get(toned||this.sprites):toned||this.sprites;if(hidden)source=this.hiddenActors?.get(source)||source;this.ctx.drawImage(source,toned?0:cell.x,toned?0:cell.y,32,32,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);return true;}
  // Elite corpses keep the gold outline so the player can tell which body it was (3.79.1).
  deadOutline(name,a,size,color){const index=this.aftermathNames.indexOf(name);if(index<0||!this.aftermath?.complete||!this.aftermath.naturalWidth)return;const image=this.corpseReady?this.corpseAtlas:this.aftermath;this.drawOutline(image,{x:(index%4)*32,y:Math.floor(index/4)*32},name,color,a,size);}
  effectSprite(name,a,size=32,angle=0,dark=false){const index=this.aftermathNames.indexOf(name),c=this.ctx;if(index<0||!this.aftermath.complete||!this.aftermath.naturalWidth)return false;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(angle);const source=name.startsWith('dead-')&&this.corpseReady?this.corpseAtlas:this.aftermath;c.drawImage(dark?this.darkActors.get(source):source,(index%4)*32,Math.floor(index/4)*32,32,32,-size/2,-size/2,size,size);c.restore();return true;}
  // The operator colour (3.48.2) tints the grey class art from a cached canvas; without one the grey cell is drawn as is.
  // 3.207.0: `tint` (a '#rrggbb' at full strength) draws a delisted operative in its card's colour instead of yours.
  classSprite(a,size,character,dead=false,dark=false,tint=null){const image=this.classSprites;if(!image?.complete||!image.naturalWidth)return false;const r=classSpriteRect(character,dead),tinted=tint?tintedSprite(image,r,tint,this.tintCache,1):tintedSprite(image,r,this.operatorColor,this.tintCache,this.operatorTint),c=this.ctx;c.drawImage(dark?this.darkActors.get(tinted||image):tinted||image,tinted?0:r.x,tinted?0:r.y,r.w,r.h,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);return true;}
  // Endless class corpse (docs/UNLOCKS.md section 4, Claude 3.90.1): the operator's fallen sprite with a pulsing ID tag, dimmed once recovered.
  operatorCorpse(a,corpse,time){const size=spriteSize(this.tile),c=this.ctx;c.save();if(corpse.recovered)c.globalAlpha*=.45;if(!this.classSprite(a,size,corpse.character,true,isDark(this.game,corpse)))this.box(a.x-9,a.y-5,18,10,'#4e302780');c.restore();if(corpse.recovered)return;this.keyBeam(a,time,.8);/* 3.151.0: a beam marks the corpse like the keycard */c.save();c.globalAlpha*=this.reduceMotion?1:.7+.3*Math.sin(time/260);const top=Math.round(a.y-this.tile*.46);this.box(a.x-9,top,18,11,'#123d46','#82e6ec');this.text('ID',a.x,top+9,'#b7fcff',8);c.restore();}
  // A delisted operative falls with the player's class art (3.207.0, docs/BOSSES.md section 5).
  corpse(a,type,character,actor){const fall=this.effects.find(e=>e.type==='fall'&&e.actorType===type&&this.time-e.time<140&&this.project(e.to.x,e.to.y).x===a.x&&this.project(e.to.x,e.to.y).y===a.y);if(fall&&!this.reduceMotion){const progress=Math.max(0,Math.min(1,(this.time-fall.time)/140));a={x:a.x+Math.round((1-progress)*3),y:a.y-Math.round((1-progress)*4)};}const size=spriteSize(this.tile),dark=isDark(this.game,this.unproject(a.x,a.y));const c=this.ctx;c.save();const op=ENEMY_TYPES[type]?.operative,drawn=(type==='player'&&this.classSprite(a,size,character,true,dark))||(op&&this.classSprite(a,size,op,true,dark,enemyTint({type})||ENEMY_TYPES[type].color))||(this.effectSprite('dead-'+enemySprite(type).corpse,a,size,0,dark)&&(actor?.elite&&this.deadOutline('dead-'+enemySprite(type).corpse,a,size,ELITE_VISUAL.corpseOutline),true));c.restore();if(drawn)return;this.box(a.x-9,a.y-5,18,10,'#4e302780');this.line(a.x-7,a.y-4,a.x+8,a.y+5,'#8c78536b',3);}
  // Idle breathing (3.104.0, user request): the sprite is cut at the waist and the top half settles two source pixels
  // and comes back. Phases are staggered by actor id so a room does not rise and fall in unison, machines do not
  // breathe, and reduced motion turns it off entirely.
  breathOffset(actor,type,time,size){
    if(this.reduceMotion||!actor||actor.hp<=0||ENEMY_TYPES[type]?.mechanical)return 0;
    let h=2166136261;for(const ch of String(actor.id||'player')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    const t=(((h>>>0)%BREATH_PERIOD+time)%BREATH_PERIOD)/BREATH_PERIOD;
    return Math.round((1-Math.cos(t*Math.PI*2))/2*BREATH_DROP*size/32);
  }
  actor(a,type,time,e,hidden=false) {
    const c=this.ctx,dark=isDark(this.game,this.unproject(a.x,a.y)),player=type==='player',def=ENEMY_TYPES[type],look=enemySprite(type),drawing=enemyDrawing(type),s=this.tile/45*look.scale;
    const spriteType=look.key;
    if(this.sprites.complete&&this.sprites.naturalWidth&&this.spriteNames.includes(spriteType)){
      const size=spriteSize(this.tile)*look.size;
      if(player){this.box(a.x-17,a.y-17,34,34,'#e0bb5110','#e8b36e99');if(e.guard){c.strokeStyle='#acd5ca';c.lineWidth=2;c.beginPath();c.arc(a.x,a.y,20,0,Math.PI*2);c.stroke();}}
      // Optical camouflage (3.47.1): the ninja's sprite fades while it is active; the frame and label stay readable.
      c.save();if(player&&e.skillState?.camouflage?.remaining>0)c.globalAlpha=.42;c.shadowColor='rgba(0,0,0,0.9)';c.shadowBlur=8;
      // 3.207.0: a delisted operative is drawn with the player's class art in its card's colour; the ninja, when it shows at
      // all, as a silhouette of dense noise (OPERATIVE_VISUAL).
      const op=!player&&def?.operative,noise=op==='ninja';
      const body=()=>{if(noise&&this.cloakNoise(a,size,time,e))return;if(op&&this.classSprite(a,size,op,false,dark,enemyTint(e)||def.color))return;if(!player||!this.classSprite(a,size,e.character,false,dark)){if(player)this.sprite(spriteType,a,size,dark,hidden);else this.enemySprite(spriteType,a,size,dark,hidden,enemyTint(e),e?.elite?ELITE_VISUAL.outline:null);}};
      const drop=this.breathOffset(e,type,time,size);
      if(!drop)body();
      else{
        // Clip rather than slice the atlas, so every sprite path (class, enemy, tinted, outlined) breathes the same way.
        c.save();c.beginPath();c.rect(a.x-size,a.y,size*2,size*2);c.clip();body();c.restore();
        c.save();c.beginPath();c.rect(a.x-size,a.y-size*2,size*2,size*2);c.clip();c.translate(0,drop);body();c.restore();
      }
      c.restore();
      if(e.control?.disabled){this.box(a.x-size/2,a.y-size/2,size,size,'#b9d5e94f');this.text(`×${e.control.disabled}`,a.x+this.tile*.35,a.y-10,'#d6edff',11);}
      if(player){this.text('YOU',a.x,a.y+this.tile*.58,'#e8ba81',7);const f=e.facing||[0,1];this.box(a.x+f[0]*18-1,a.y+f[1]*18-1,3,3,'#ffe3ab');}
      else{this.enemyBars(a,e,def);if(e.charge)this.text(unitTree(e).fixedTile?String(e.windup||1):'!',a.x+this.tile*.38,a.y-9,'#ffc789',14);}
      return;
    }
    c.save();c.translate(a.x,a.y);c.scale(s,s);
    this.glow(0,0,22,player?'#e2b2631f':'#00000033');
    if(player){this.box(-16,-16,32,32,'#e0bb5110','#e8b36e99');if(e.guard){c.strokeStyle='#acd5ca';c.lineWidth=2;c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.stroke();}}
    const facing=player?e.facing:[this.game.player.x-e.x,this.game.player.y-e.y];
    c.rotate(Math.atan2(facing[1],facing[0])-Math.PI/2);
    if(drawing.shape==='critter'){
      const color=enemyTint(e)||drawing.color||'#ba966d';for(const x of[-10,10])for(const y of[-7,7])this.line(x*.5,y*.7,x,y+3,color,3);
      this.box(-7,-9,14,18,'#6d6544',color);this.box(-6,-2,12,12,color);this.box(-5,8,10,5,'#d1b88a');this.line(-4,12,4,12,'#ed855c',2);if(drawing.glow)this.glow(0,0,16,drawing.glow);
    }else if(drawing.shape==='drone'){
      for(const x of[-10,10]){this.box(x-4,-8,8,16,'#547b70','#adcfc0');this.line(x,-11,x,11,'#8ad5d177',2);}
      this.box(-7,-6,14,12,'#99c9bd','#d4eee1');this.box(-3,0,6,4,'#edbb8d');
    }else{
      const color=player?'#ca9257':enemyTint(e)||def.color;this.box(-8,-7,6,18,'#334939','#6a795555');this.box(2,-7,6,18,'#334939','#6a795555');
      this.box(-12,-6,24,16,color,'#d5c29055');this.box(-7,-8,14,18,player?'#827853':'#59684d');
      this.box(-7,-10,14,13,color,'#e1d7a66f');this.box(-5,0,10,3,player?'#aff1e0':'#f2ab80');
      if(!drawing.unarmed){this.box(8,1,5,20,'#1d2e29','#879c8a');this.box(9,18,3,6,'#b0b6a1');}
      if(drawing.heavy){this.box(-15,-7,6,19,'#8f795c','#d2bd9255');this.box(9,-7,6,19,'#8f795c','#d2bd9255');}
      if(drawing.longBarrel)this.box(9,18,3,12,'#cad3b2');
    }
    c.restore();
    if(!player&&e?.elite)this.box(Math.round(a.x)-15,Math.round(a.y)-15,30,30,'#00000000',ELITE_VISUAL.outline);
    if(!player){this.enemyBars(a,e,def);if(e.charge)this.text(unitTree(e).fixedTile?String(e.windup||1):'!',a.x+this.tile*.38,a.y-9,'#ffc789',14);}
    else this.text('YOU',a.x,a.y+this.tile*.58,'#e8ba81',7);
  }
  // 3.207.0: the delisted ninja's optical camouflage, seen: its class silhouette (the untinted cell's own shape) filled
  // with grey noise that changes every noiseMs of world time (fixed with reduced motion), from a hash of its id — never
  // Math.random, so a frame drawn twice is the same.
  cloakNoise(a,size,time,e){
    const image=this.classSprites;if(!image?.complete||!image.naturalWidth)return false;
    const r=classSpriteRect('ninja',false),V=OPERATIVE_VISUAL,frame=this.reduceMotion?0:Math.floor(time/V.noiseMs);
    let canvas=this.noiseCanvas;if(!canvas){try{canvas=this.noiseCanvas=document.createElement('canvas');canvas.width=r.w;canvas.height=r.h;}catch{return false;}}
    const c=canvas.getContext('2d');c.clearRect(0,0,r.w,r.h);c.drawImage(image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
    let h=2166136261;for(const ch of `${e?.id||'ninja'}:${frame}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
    try{const px=c.getImageData(0,0,r.w,r.h),d=px.data;for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;h=Math.imul(h^h>>>15,2246822507)>>>0;h=Math.imul(h^h>>>13,3266489909)>>>0;const on=(h&1023)/1024<V.noiseDensity,v=on?40+(h>>>10&191):0;d[i]=d[i+1]=d[i+2]=v;d[i+3]=on?Math.round(255*V.noiseAlpha):40;}c.putImageData(px,0,0);}catch{return false;}
    this.ctx.drawImage(canvas,0,0,r.w,r.h,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);return true;
  }
  // Health bar and suppression pips; real mode hides both, while the charge "!" and sniper countdown stay (3.76.3).
  enemyBars(a,e,def){if(this.game.realMode)return;this.box(a.x-13,a.y-this.tile*.45,26,3,'#17271e');this.box(a.x-13,a.y-this.tile*.45,26*e.hp/e.maxHp,3,e.charge?'#f2b779':def.color);this.suppressionPips(a,e);}
  // One pip per suppression stack above the health bar; orange once the actor is pinned (3.74.1).
  suppressionPips(a,e){const n=suppressionStacks(e);for(let i=0;i<n;i++)this.box(a.x-13+i*5.4,a.y-this.tile*.45-4,4,2,n>=3?'#f2a85c':'#b8cff5');}
  // The units (3.206.3, from Renderer.draw): blood on the floor and the fallen operative, you, your cover, the enemies
  // in view and their heat, your allies. Returns the enemies hidden at a corner, badged by drawOverlays.
  drawActors(time){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    // Stains stamped on this floor's layer as drops land (never saved), then the layer; the fallen operative's pool.
    // 3.175.1: in a dark room the blood darkens with it, tile by tile (the actors' dark brightness).
    const goreShade=(x,y)=>isDark(g,{x:Math.round(x),y:Math.round(y)})?DARK_ACTOR_BRIGHTNESS:1;
    if(this.splatter){this.splatter.use(`${g.seed}:${g.floor}`);for(const b of this.gore||[])this.splatter.bake(b.burst,b.at,time-b.start);if(this.kia?.burst)this.splatter.bake(this.kia.burst,this.kia.at,time-this.kia.start);this.splatter.draw(c,this.project(0,0),t,goreShade);}
    if(this.kia)drawKiaGround(this,time);
    const pos=this.projectActor(p);if(p.hp<=0){if(this.kia)drawKiaBody(this,pos,p.character,time);else this.corpse(pos,'player',p.character);}else if(!this.extractedAt(time))this.glitchDraw(pos,'player',()=>this.actor(pos,'player',time,p));   // 3.194.0: gone in the extraction beam
    for(const cover of g.cover){const dx=cover.x-p.x,dy=cover.y-p.y;const x=pos.x+dx*t*(isBarrier(cover)?1:.48),y=pos.y+dy*t*(isBarrier(cover)?1:.48);this.line(x+(dy? -t*.27:0),y+(dx?-t*.27:0),x+(dy?t*.27:0),y+(dx?t*.27:0),cover.type==='wall'?'#8bd2c9':'#c7d896',2);}
    const hiddenEnemies=new Set(g.visibleEnemies.filter(e=>cornerHidden(g,e)));
    for(const e of g.visibleEnemies){const a=this.projectActor(e);this.glitchDraw(a,e.id,()=>this.actor(a,e.type,time,e,hiddenEnemies.has(e)));if(e.keycard&&e.hp>0)this.keyBeam({x:a.x,y:a.y-this.tile*.55},time,.45);/* 3.146.0: carries the keycard */if(missionTarget(g,e))this.text('◇',a.x-this.tile*.35,a.y-8,'#88f3ff',12);}
    // 3.206.0: an overheated arsonist steams, with its venting rounds left; before that, its heat as pips.
    for(const e of g.visibleEnemies)if(e.hp>0&&(e.overheat>0||setsFires(e)&&e.heat>0))this.heatMarks(this.projectActor(e),e,time);
    for(const ally of g.localAllies||[])if(g.seen[ally.y]?.[ally.x]){const a=this.projectActor(ally);if(ally.hp>0&&ally.status==='active'){this.actor(a,ally.type,time,ally);this.box(a.x-t*.36,a.y-t*.36,t*.72,t*.72,'#64e7cf18','#83efd1');this.text(ally.kind==='pet'?'PET':ally.kind==='summon'?'SUM':ally.sourceId==='drone_munition'?'MUN':ally.sourceId==='unit_bomber'?'BOT':ally.sourceId==='unit_drone'?'DRN':ally.sourceId==='unit_warden'?'WDN':ally.sourceId==='unit_boss'?'CORE':'ALLY',a.x,a.y+t*.55,connected(g,ally)?'#9df4d5':'#a5a5a5',8);if(ally.primed)this.text('!',a.x+t*.38,a.y-9,'#ffc789',14);}else {this.corpse(a,ally.type);this.text(ally.status==='down'?tx('renderer.recover'):'×',a.x,a.y+12,'#e3cf86',10);}}
    return hiddenEnemies;
  }
}
