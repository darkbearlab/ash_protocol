import {LOOT_ATLAS} from './loot-icons.js';
import {mapStyleAtlases} from './map-styles.js';
import {shakeOffset,liveImpulses} from './screen-shake.js';
import './signal-glitch.js';   // load order only (3.206.3 split)
import {FRAME_RATE_DEFAULT,frameDue,nextDue} from './frame-rate.js';
import './terminal.js';   // load order only (3.206.3 split)
import './lines.js';   // load order only (3.206.3 split)
import './affix-ui.js';   // load order only (3.206.3 split)
import {SPRITE_NAMES,AFTERMATH_NAMES} from './enemy-visuals.js';
import {CalloutBoard} from './callout-ui.js';
import {NEST_ATLAS} from './nest-art.js';
import {DECAL_ATLAS,FactionDecals} from './faction-decals.js';
import {SCENERY_ATLAS} from './scenery.js';
import {partitionGeometry,DOOR_ATLAS,doorGeometry} from './barrier-art.js';
import {actorPosition,DarkActorCache,muteCornerPixels} from './actor-visuals.js';
import {CLASS_ATLAS} from './class-art.js';
import {DEFAULT_OPERATOR_COLOR} from './operator-color.js';
import './movement-boundaries.js';   // load order only (3.206.3 split)
import {lampWall} from './lighting.js';
import {ArtToneCache} from './art-tone.js';
import {WALL_ATLAS} from './walls.js';
import './kia-art.js';   // load order only (3.206.3 split)
import {Splatter} from './gore-art.js';
import {CorpseLayer} from './corpse-layer.js';
import {THEMES} from './themes.js';
import {cameraFrame,zoomStep} from './camera.js';
import './muzzle-flash.js';   // load order only (3.206.3 split)
import {targetCardPlacement,actorObstacle} from './target-card.js';
import {floorInfo} from './engine.js';
// 3.206.3: the class is split by topic; each file holds one topic's methods, copied onto Renderer below (src/mixin.js).
import {mixin} from './mixin.js';
import {RendererMap} from './renderer-map.js';
export {ITEM_COLORS,ITEM_SYMBOLS,ITEM_SCALE,itemScale} from './renderer-map.js';
import {RendererActors} from './renderer-actors.js';
import {RendererClouds} from './renderer-clouds.js';
import {RendererTelegraphs} from './renderer-telegraphs.js';
import {RendererEffects} from './renderer-effects.js';
export {EXTRACTION_BEAM} from './renderer-effects.js';

// Orthographic board: world +x = screen right, world +y = screen down.
// Pixel atlases use nearest-neighbor drawing, with procedural missing-image fallbacks.
export class Renderer {
  constructor(canvas,game) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.game=game;this.zoom=1;
    this.camera={x:game.player.x,y:game.player.y};this.effects=[];this.darkActors=new DarkActorCache();this.hiddenActors=new DarkActorCache(muteCornerPixels);this.last=0;this.frameRate=FRAME_RATE_DEFAULT;this.time=0;this.kia=null;this.pace=null;this.kiaZoom=1;this.gore=[];this.splatter=new Splatter();this.goreLevel='full';this.corpses=new CorpseLayer();   // corpses: 3.211.0, src/corpse-layer.js
    this.shakes=[];this.shakeEnabled=true;this.shift=null;   // screen shake (3.147.0, src/screen-shake.js)
    this.glitches=[];this.objectGlitches=new Map();this.glitchState={};this.glitchEnabled=true;   // signal interference (3.149.0, src/signal-glitch.js)
    this.movementBoundaries=false;this.boundaryOpacity=80;this.targetingEnabled=true;this.callouts=new CalloutBoard();this.aim=null;this.mode=null;this.reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.terrainImages=new Map();for(const def of Object.values(THEMES))if(!this.terrainImages.has(def.atlas)){const image=new Image();image.src=def.atlas;this.terrainImages.set(def.atlas,image);}
    for(const url of [SCENERY_ATLAS,DOOR_ATLAS,NEST_ATLAS,DECAL_ATLAS,LOOT_ATLAS,...mapStyleAtlases()]){const image=new Image();image.src=url;this.terrainImages.set(url,image);}
    this.decals=new FactionDecals();   // faction traces on floors and wall faces (3.139.0, docs/FACTION_DECALS.md)
    this.wallImage=new Image();this.wallImage.src=WALL_ATLAS;this.terrainImages.set(WALL_ATLAS,this.wallImage);this.artTones=new ArtToneCache();
    this.sprites=new Image();this.sprites.src=new URL('../assets/pixel/atlas.png',import.meta.url).href;
    this.classSprites=new Image();this.classSprites.src=CLASS_ATLAS;this.operatorColor=DEFAULT_OPERATOR_COLOR;this.operatorTint=1;this.tintCache=new Map();
    this.aftermath=new Image();this.aftermath.src=new URL('../assets/pixel/aftermath.png',import.meta.url).href;
    // Precompute once at native resolution; avoids Canvas filter support differences on phones.
    this.corpseAtlas=document.createElement('canvas');
    this.aftermath.addEventListener('load',()=>{const atlas=this.corpseAtlas;atlas.width=this.aftermath.naturalWidth;atlas.height=this.aftermath.naturalHeight;const c=atlas.getContext('2d');c.drawImage(this.aftermath,0,0);const pixels=c.getImageData(0,0,atlas.width,atlas.height),d=pixels.data;for(let i=0;i<d.length;i+=4){const gray=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722;for(let k=0;k<3;k++)d[i+k]=Math.round((d[i+k]*.3+gray*.7)*.8);}c.putImageData(pixels,0,0);this.corpseReady=true;});
    this.aftermathNames=[...AFTERMATH_NAMES];
    this.spriteNames=[...SPRITE_NAMES];
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.resize();
    requestAnimationFrame(t=>this.frame(t));
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=r.width*this.dpr;this.canvas.height=r.height*this.dpr;this.tile=(this.w<600?38:45)*this.zoom;}
  project(x,y,z=0){return {x:this.w/2+(x-this.camera.x)*this.tile,y:this.h/2+(y-this.camera.y)*this.tile-z};}
  visualActor(actor){return actorPosition(actor,actor===this.game.player?'player':actor.id,this.game.floor,this.effects,this.time,this.reduceMotion);}
  projectActor(actor){const p=this.visualActor(actor);return this.project(p.x,p.y);}
  unproject(px,py){return {x:Math.round((px-this.w/2)/this.tile+this.camera.x),y:Math.round((py-this.h/2)/this.tile+this.camera.y)};}
  // 3.187.0: where a wall lamp is drawn, against its wall; tapping near it locks onto it, the rest of its tile still moves.
  lampPoint(lamp){const a=this.project(lamp.x,lamp.y),[dx,dy]=lampWall(this.game.grid,lamp);return {x:a.x+dx*this.tile*.38,y:a.y+dy*this.tile*.38};}
  hitLamp(x,y){
    const reach=Math.max(12,this.tile*.22);
    return (this.game.lamps||[]).filter(l=>l.hp>0&&this.game.visible(l)).map(l=>({l,d:Math.hypot(x-this.lampPoint(l).x,y-this.lampPoint(l).y)})).filter(o=>o.d<=reach).sort((a,b)=>a.d-b.d)[0]?.l;
  }
  hitBarrier(x,y){
    return this.game.barriers.filter(b=>b.hp>0&&this.game.visible(b)).map(b=>{
      const p=this.project(b.x,b.y),normal=Math.abs(b.axis==='x'?x-p.x:y-p.y),along=Math.abs(b.axis==='x'?y-p.y:x-p.x);
      const boxes=b.type==='door'?doorGeometry(b,p,this.tile):[partitionGeometry(b,p,this.tile)];
      return {b,normal,hit:boxes.some(q=>x>=q.left-2&&x<=q.left+q.width+2&&y>=q.top-2&&y<=q.bottom+2)};
    }).filter(o=>o.hit).sort((a,b)=>a.normal-b.normal)[0]?.b;
  }
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
  glow(x,y,r,color){const c=this.ctx,g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
  box(x,y,w,h,color,stroke){const c=this.ctx;c.fillStyle=color;c.fillRect(x,y,w,h);if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}}
  text(value,x,y,color='#c1ceb2',size=9){const c=this.ctx;c.font=`${size}px monospace`;c.textAlign='center';c.fillStyle=color;c.fillText(value,x,y);}
  // 3.119.0: redraws at the chosen rate (src/frame-rate.js), and the clock, playback and camera keep running under a
  // full-page menu while the hidden battlefield is not drawn at all.
  frame(t) {
    const tick=t-(this.lastTick??t);this.lastTick=t;
    if(!frameDue(t,this.due??t,tick)){requestAnimationFrame(v=>this.frame(v));return;}
    this.due=nextDue(this.due??t,t,this.frameRate);
    const dt=Math.min((t-this.last)/1000,.1);this.last=t;
    // 3.174.0: `pace` (the killed-in-action scene, src/kia.js) slows or stops the world's clock — effects, playback and
    // all — while the camera keeps real time, so it can push in during the freeze. 3.204.0: a boss scene's pace may also
    // name a `focus` tile and how far (`blend`, 0-1) the camera has slid onto it.
    if(!document.hidden&&!this.isPaused?.()){const pace=this.pace?.(),world=dt*1000*(pace?pace.scale:1);this.kiaZoom=pace?pace.zoom:1;this.sceneFocus=pace?.focus?{x:pace.focus.x,y:pace.focus.y,blend:pace.blend??1}:null;this.time+=world;this.onFrame?.(world);this.updateCamera(dt*1000);if(!this.isCovered?.()){this.shift=this.shakes.length?shakeOffset(this.shakes=liveImpulses(this.shakes,this.time),this.time):null;this.draw(this.time);if(this.glitchEnabled)this.glitchFrame();this.placeTargetCard();}}
    requestAnimationFrame(v=>this.frame(v));
  }
  // The frame is recomputed every frame; only the zoom eases (src/camera.js). A new run, a new floor or a resized board
  // starts from the exact framing instead of easing across it.
  updateCamera(dt){
    // While the operative falls (3.174.0) the camera looks at nothing else.
    const g=this.game,fallen=this.kia,locked=!fallen&&this.targetingEnabled?g.targeted:null,holds=fallen?[]:this.effects.filter(e=>e.type==='cameraHold'&&this.time-e.time<e.duration).map(e=>e.to);
    const frame=cameraFrame(this.visualActor(g.player),locked?this.visualActor(locked):null,fallen?null:this.aim,this.w,this.h,this.zoom,holds);
    const scene=[g.seed,g.floor,this.w,this.h].join(':'),key=[this.zoom,this.mode||'',this.aim?'aim':'',locked?.id??'',holds.length?'hold':''].join('|');
    this.zoomState=zoomStep(scene===this.cameraScene?this.zoomState:null,{key,want:frame.tile,dt,reduceMotion:this.reduceMotion});this.cameraScene=scene;
    this.camera={x:frame.x,y:frame.y};this.tile=this.zoomState.tile*(this.kiaZoom||1);
    // 3.204.0 boss scenes (src/boss-scenes.js): the camera slides from its usual framing onto the boss and back.
    const f=this.sceneFocus;if(f&&f.blend>0)this.camera={x:frame.x+(f.x-frame.x)*f.blend,y:frame.y+(f.y-frame.y)*f.blend};
  }
  placeTargetCard(){
    const ui=this.targetUI,target=this.game.targeted;if(!ui)return;
    if(!target||ui.card.hidden){ui.card.style.visibility='hidden';ui.link.setAttribute('hidden','');ui.frame=null;return;}
    const frame=[this.effects.some(e=>e.type==='move'&&this.time-e.time<e.travel)?this.time:0,target.id,target.x,target.y,this.game.player.x,this.game.player.y,this.w,this.h,this.tile,this.camera.x,this.camera.y,this.sprites.naturalWidth,...this.game.visibleEnemies.flatMap(e=>[e.id,e.x,e.y])].join(',');
    if(!ui.dirty&&ui.frame===frame)return;ui.frame=frame;
    const compact=this.w<240;if(ui.compact!==compact){ui.card.classList.toggle('compact',compact);ui.compact=compact;ui.dirty=true;}
    const width=Math.min(104,this.w-10);
    if(ui.width!==width||ui.dirty){ui.card.style.width=`${width}px`;ui.width=width;ui.height=Math.ceil(ui.card.getBoundingClientRect().height);ui.dirty=false;}
    const a=this.projectActor(target),p=this.projectActor(this.game.player),fallbackActors=!this.sprites.complete||!this.sprites.naturalWidth;
    const obstacles=[{x:6,y:6,w:118,h:54,weight:60},{x:this.w-140,y:this.h-40,w:134,h:34,weight:60}];
    const pos=targetCardPlacement({target:a,player:p,tile:this.tile,width:this.w,height:this.h,cardWidth:width,cardHeight:ui.height,bottomInset:44,previousCorner:ui.corner,obstacles,blockers:this.game.visibleEnemies.filter(e=>e!==target).map(e=>actorObstacle(this.projectActor(e),this.tile,fallbackActors)),fallbackActors});
    if(!pos){ui.card.style.visibility='hidden';ui.link.setAttribute('hidden','');return;}
    ui.corner=pos.corner;ui.card.style.visibility='visible';
    const signature=[pos.x,pos.y,pos.link.x,pos.link.y,a.x,a.y,this.w,this.h].join(',');
    if(ui.position!==signature){ui.card.style.transform=`translate(${pos.x}px,${pos.y}px)`;ui.link.setAttribute('viewBox',`0 0 ${this.w} ${this.h}`);ui.path.setAttribute('d',`M ${a.x} ${a.y} L ${pos.link.x} ${pos.link.y}`);ui.position=signature;}
    ui.link.removeAttribute('hidden');
  }
  // One frame, back to front (3.206.3: each pass lives with its topic): the floor and what lies on it
  // (renderer-map.js), telegraphs and aims (renderer-telegraphs.js), the units (renderer-actors.js), what they aim at
  // (renderer-telegraphs.js), the effects in flight (renderer-effects.js), the walls over all of it (renderer-map.js),
  // the extraction beam, and the overlays on top (renderer-effects.js).
  draw(time) {
    const c=this.ctx,g=this.game;
    if(this.shift?.strength){c.setTransform(1,0,0,1,0,0);c.fillStyle='#10191a';c.fillRect(0,0,this.canvas.width,this.canvas.height);}
    c.setTransform(this.dpr,0,0,this.dpr,this.dpr*(this.shift?.x||0),this.dpr*(this.shift?.y||0));c.globalAlpha=1;c.imageSmoothingEnabled=false;
    this.box(0,0,this.w,this.h,'#10191a');
    const palette=floorInfo(g.floor),radial=c.createRadialGradient(this.w/2,this.h/2,30,this.w/2,this.h/2,this.w*.65);
    radial.addColorStop(0,'#354337');radial.addColorStop(1,'#101819');c.fillStyle=radial;c.fillRect(0,0,this.w,this.h);
    const wallCells=this.drawGround(time);
    this.drawTelegraphs(time);
    const hiddenEnemies=this.drawActors(time);
    this.drawTargeting(time);
    this.drawEffects(time);
    this.drawWalls(wallCells);
    // 3.198.5 (user): the extraction beam falls from the top of the screen, so it is drawn over the walls it crosses
    // rather than occluded by them like other world-space effects.
    if(this.extraction)this.extractionBeam(time);

    this.drawOverlays(time,hiddenEnemies);
  }
}
mixin(Renderer,RendererMap,RendererActors,RendererClouds,RendererTelegraphs,RendererEffects);
