// The map (3.206.3 split): floor art, walls, doors and partitions (the vault's steel), pits, props, furniture and
// modules, ground items and keycards, hazards, the exit, the tactical overlay and the floor map.
// Methods of Renderer (src/renderer.js), which copies them onto Renderer.prototype (src/mixin.js, 3.206.3): `this` is
// the renderer, `this.game` the state being drawn and `this.ctx` the canvas.
import {LOOT_ATLAS,LOOT_ICON,drawLootIcon,lootCell} from './loot-icons.js';
import {mapStyle} from './map-styles.js';
import {TERMINAL_TUNING,terminalRemaining} from './terminal.js';
import {NEST_ATLAS,drawNest,drawNestSprite} from './nest-art.js';
import {drawDoor,drawPartition,barrierJunctions,drawJunction} from './barrier-art.js';
import {boundaryOpacityPercent,movementBoundaries} from './movement-boundaries.js';
import {isDark,floorShading,isBlack,seesInDark} from './lighting.js';
import {drawWall} from './walls.js';
import {resolveSprite,themeAt} from './themes.js';
import {missionObjects,missionTarget} from './missions.js';
import {MODULE_TYPES,moduleCells,modulePoint} from './modules.js';
import {CONTAINER_KINDS,isContainer} from './containers.js';
import {edgeCells,blockedBetween} from './barriers.js';
import {pointLetter,pointStatus,pointTargeted} from './survival.js';
import {SIZE,SUPPLY_NAMES,distance,SUPPLY_ROOMS} from './engine.js';
import {VOID} from './data.js';
import {fxFrame,fxSheet,FX_SMOKE_ALPHA} from './fx-sprites.js';
import {drawTrace} from './traces.js';
import {burningAt} from './fire.js';
import {itemGlitchKey} from './renderer-effects.js';
import {CLOUD_TONES} from './renderer-clouds.js';
// How a survival point shows, on the field and the floor map: quiet, held (3.191.0) or fallen; 3.192.0 (user): a point a
// group is after wears a terminal-style amber frame (four corner brackets) instead of a colour of its own.
export const POINT_COLORS=Object.freeze({quiet:'#6fd3d6',pressed:'#ff5a44',fallen:'#6b6b6b'}),POINT_FRAME='#ffc861';
export function pointFrame(c,cx,cy,half,arm,width,color){c.strokeStyle=color;c.lineWidth=width;c.beginPath();for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){const x=cx+sx*half,y=cy+sy*half;c.moveTo(x-sx*arm,y);c.lineTo(x,y);c.lineTo(x,y-sy*arm);}c.stroke();}
// Ground item colours and symbols. 3.136.1: the grapple lines and goggles (3.135.0) had none, so their tiles printed
// "undefined"; tests/item-symbols.test.mjs now checks every ground item type, and a missing one shows '?'.
export const ITEM_COLORS=Object.freeze({smoke:'#a9bbcb',emp:'#81dce9',stun:'#eee0a0',armor:'#92c4df',med:'#b9d2a2',ammo:'#c4ad70',pistol:'#b2c998',shell:'#dca186',energy:'#82cfc5',ordnance:'#ca9971',grenade:'#9eba87',scrap:'#c5a171',weapon:'#e9bd77',lore:'#c2a9db',learning:'#b9a2e6',spray:'#b6a2d6',adrenaline:'#e0a7c4',barricade:'#c9b48c',flare:'#e7c46e',glowstick:'#9dff8a',nvg:'#9fd0a8',escape_line:'#d7b27a',redeploy_line:'#a9c3d6',decoy:'#e0c46a',mine:'#d9785a',exo:'#9fb3c8',key:'#ffe9a0',irg:'#e07a6a'});
export const ITEM_SYMBOLS=Object.freeze({smoke:'≋',emp:'E',stun:'✦',armor:'▣',med:'+',ammo:'R',pistol:'P',shell:'S',energy:'ϟ',ordnance:'•',grenade:'G',scrap:'◇',weapon:'W',lore:'D',spray:'▣',adrenaline:'⚡',barricade:'▬',flare:'✺',glowstick:'⌇',nvg:'◉',escape_line:'↟',redeploy_line:'⇢',decoy:'◎',mine:'✱',exo:'⛨',key:'✧',irg:'◍'});
// 3.136.2 (user request): ground items shrink with the map the way units do — full size at the default tile, never
// larger — and are hidden once the tile is so small they would only be clutter. With the zoom buttons that is the
// smallest step (0.65 → 24.7 px); wide framing for a far target can hide them too. At full size nothing is transformed,
// so the default view draws exactly as before.
// 3.154.0: the pixel icons read at a glance where the letters did not, so loot stays drawn across the whole zoom
// range the player can reach — the narrow layout's furthest zoom out is a 24.7px tile, which 25 used to cut off.
export const ITEM_SCALE=Object.freeze({full:38,hideBelow:20});
export const itemScale=tile=>tile<ITEM_SCALE.hideBelow?0:Math.min(1,tile/ITEM_SCALE.full);
export class RendererMap {
  // 3.146.0: the vault's steel door, drawn over the ordinary door: grey steel, and a padlock while it is locked.
  // 3.177.3 (user): the closet's sealed walls get the same steel, and no health bar, since nothing breaks them.
  steel(boxes){for(const q of boxes)this.box(q.left,q.top,q.width,Math.max(2,q.bottom-q.top),'#8fa4b85c','#c8d4de');}
  vaultDoor(b,boxes){
    this.steel(boxes);
    if(!b.locked)return;
    const q=boxes[0],x=Math.round(q.left+q.width/2),y=Math.round((q.faceTop+q.bottom)/2);
    this.line(x-3,y-3,x-3,y-6,'#e8c95a',2);this.line(x+3,y-3,x+3,y-6,'#e8c95a',2);this.line(x-3,y-7,x+3,y-7,'#e8c95a',2);
    this.box(x-5,y-3,10,8,'#6b5420','#e8c95a');this.box(x-1,y,2,3,'#1a1408');
  }
  drawBarrier(b,scale=this.tile){
    const p=this.project(b.x,b.y),vertical=b.axis==='x',half=scale*.5,color=b.hp<=0?'#65746b':b.open?'#8ad2bb':b.type==='door'?'#dec184':'#9da99d';
    const segment=(a,z,width)=>this.line(p.x+(vertical?0:a),p.y+(vertical?a:0),p.x+(vertical?0:z),p.y+(vertical?z:0),color,width);
    if(b.hp<=0&&b.type==='door'&&mapStyle(this.game)!=='facility'){drawDoor(this.ctx,b,p,scale,this.terrainImages,this.game);return;}
    if(b.hp<=0){segment(-half,-half*.72,3);segment(half*.72,half,3);return;}
    if(b.type==='low_partition'||b.type==='partition'){const q=drawPartition(this.ctx,b,p,scale,this.terrainImages,this.game);if(b.vaultWall){this.steel([q]);return;}this.objectHealth(b,p.x-7,q.top-4,14);return;}
    if(b.type==='door'){const boxes=drawDoor(this.ctx,b,p,scale,this.terrainImages,this.game);if(b.vault){this.vaultDoor(b,boxes);return;}this.objectHealth(b,p.x-7,Math.min(...boxes.map(q=>q.top))-4,14,'#e6bd82');return;}
    if(b.open){segment(-half,-half*.62,5);segment(half*.62,half,5);this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');return;}
    if(this.terrain(b.type,p,b,Math.round(scale),vertical?0:1)){this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');return;}
    segment(-half,half,7);segment(-half+2,half-2,3);
    if(b.type==='door'){this.box(p.x-3,p.y-3,6,6,'#283e36');this.box(p.x-1,p.y-1,2,2,'#f2d691');}
    this.objectHealth(b,p.x-7,p.y+half-4,14,'#e6bd82');
  }
  // 3.120.0: a terminal someone has bought from shows what it can still hand out; a fresh one is always full.
  terminalCredit(p,a){if(p.used||!p.spent)return;this.text(`${terminalRemaining(p)}/${TERMINAL_TUNING.credit}`,a.x,a.y-this.tile*.42,'#9ee3b4',9);}
  objectHealth(object,x,y,width=24,color='#cad396'){
    if(this.game.realMode||!(object.hp>0&&object.hp<object.maxHp))return;
    this.box(x,y,width,2,'#17281f');this.box(x,y,width*object.hp/object.maxHp,2,color);
  }
  // 3.164.0 pits (src/pits.js): a red-black warning band along every floor edge that drops into a pit, closing at the
  // outer corners. Pixel stripes from a 16x3 art strip scaled like the tiles; the phase repeats every tile so the bands join.
  pitRim(a,x,y,t){
    const g=this.game,v=(dx,dy)=>g.grid[y+dy]?.[x+dx]===VOID,sides=[[0,-1],[1,0],[0,1],[-1,0]].filter(([dx,dy])=>v(dx,dy)),corners=[[-1,-1],[1,-1],[1,1],[-1,1]].filter(([dx,dy])=>v(dx,dy)&&!v(dx,0)&&!v(0,dy));
    if(!sides.length&&!corners.length)return;
    if(!this.pitStripes){const make=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const q=cv.getContext('2d');for(let j=0;j<h;j++)for(let i=0;i<w;i++){q.fillStyle=((i+j)&3)<2?'#b23a2c':'#16120f';q.fillRect(i,j,1,1);}return cv;};this.pitStripes={h:make(16,3),v:make(3,16)};}
    const c=this.ctx,left=a.x-t/2,top=a.y-t/2,b=t*3/16,{h,v:vs}=this.pitStripes;
    for(const [dx,dy]of sides){if(dy)c.drawImage(h,left,dy>0?top+t-b:top,t,b);else c.drawImage(vs,dx>0?left+t-b:left,top,b,t);}
    for(const [dx,dy]of corners)c.drawImage(h,0,0,3,3,dx>0?left+t-b:left,dy>0?top+t-b:top,b,b);
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
    const sprite=resolveSprite(themeAt(this.game,point),role,this.game),image=sprite&&this.terrainImages.get(sprite.url);
    this.terrainReady=Boolean(image?.complete&&image.naturalWidth);
    if(!this.terrainReady)return false;
    const c=this.ctx;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(rotation*Math.PI/2);c.imageSmoothingEnabled=false;
    const toned=this.artTones?.get(image,sprite,role==='floor'?'floor':'prop');
    c.drawImage(toned||image,toned?0:sprite.x,toned?0:sprite.y,sprite.size,sprite.size,-Math.floor(size/2),-Math.floor(size/2),size,size);c.restore();return true;
  }
  wall(a,x,y){
    const g=this.game,adjacent=[[0,1],[0,-1],[1,0],[-1,0]].map(([dx,dy])=>({x:x+dx,y:y+dy})).find(p=>g.grid[p.y]?.[p.x]===1);
    const q=drawWall(this.ctx,g,x,y,this.tile,a,this.terrainImages,themeAt(g,adjacent||{x,y}),this.artTones);
    if(q)this.decals?.face(this,x,y,q);
    return q;
  }
  hazard(a,h,time){const t=this.tile,l=a.x-t*.43,top=a.y-t*.43;
    // 3.202.0: the fixed fire of floors 5-6 burns with the sheet's steady row once Codex's sprites are there.
    const fire=h.type==='fire'&&fxSheet('fire');if(fire){this.glow(a.x,a.y,t*.8,'#cf672c44');this.ctx.drawImage(fire.img,fxFrame(time,h.x,h.y,fire.frames)*fire.cell,fire.rows.steady*fire.cell,fire.cell,fire.cell,a.x-t/2,a.y-t/2,t,t);this.glow(a.x,a.y,t*.7,'#f99a381a');return;}
    this.glow(a.x,a.y,t*.8,h.type==='acid'?'#709a4870':'#cf672c70');   // 3.202.0 (user): a soft edge, not a hard square
    for(let i=0;i<4;i++){const n=(i*13)%25;this.box(l+5+n,top+5+(i*7)%23,4,3,h.type==='acid'?'#b8d47388':'#efa65a99');}this.glow(a.x,a.y,t*.7,h.type==='acid'?'#b4cd5312':'#f99a381a');}
  exit(a,time){const t=this.tile;this.box(a.x-t*.44,a.y-t*.44,t*.88,t*.88,'#284b40','#8fca9b');this.box(a.x-t*.32,a.y-t*.32,t*.64,t*.64,'#2e5b4a','#a1d3a655');for(let i=-1;i<=1;i++)this.line(a.x+i*9,a.y-8,a.x+i*9,a.y+6,'#102e24',2);this.text(this.game.exitBlocked?'LOCK':this.game.exitKind==='up'?'UP':this.game.exitKind==='down'?'DOWN':'EXIT',a.x,a.y+16,'#ceebbb',8);this.glow(a.x,a.y,t*.8,'#9de0aa1c');}
  // 3.146.0 (user idea): the keycard is a point of light with a beam standing up from it, no box. A trial of a new way
  // to mark things worth walking to; `size` 1 on the ground, smaller over the enemy that carries it.
  keyBeam(a,time,size=1){
    const c=this.ctx,pulse=.78+.22*Math.sin(time/320),h=this.tile*2.3*size,w=Math.max(2,5*size);
    const beam=c.createLinearGradient(a.x,a.y,a.x,a.y-h);beam.addColorStop(0,`rgba(255,238,170,${.62*pulse})`);beam.addColorStop(.55,`rgba(255,232,150,${.22*pulse})`);beam.addColorStop(1,'rgba(255,232,150,0)');
    c.save();c.globalCompositeOperation='lighter';c.fillStyle=beam;c.fillRect(a.x-w*1.6,a.y-h,w*3.2,h);c.fillRect(a.x-w/2,a.y-h,w,h);c.restore();
    this.glow(a.x,a.y,16*size*pulse+4,'#ffe7a080');c.beginPath();c.arc(a.x,a.y,Math.max(1.5,3.2*size),0,Math.PI*2);c.fillStyle='#fff8dc';c.fill();
  }
  // 3.177.6 (user): an item you could not take any of right now is drawn at LOOT_ICON.dim, so after a firefight the
  // floor shows what is still worth a step. It comes back to full strength as soon as there is room for it.
  groundItem(a,item,time){
    if(this.game.canTake?.(item)!==false){this.item(a,item,time);return;}
    const c=this.ctx;c.save();c.globalAlpha*=LOOT_ICON.dim;this.item(a,item,time);c.restore();
  }
  item(a,item,time){const k=itemScale(this.tile);if(!k)return;const c=this.ctx;if(item.type==='key'){this.keyBeam(a,time,Math.max(.6,k));return;}
    // 3.154.0 (docs/LOOT_ICONS_HANDOFF.md): five classes of ground loot are one pixel icon each, nothing layered on top —
    // no frame, no glow, no weapon code. The keycard, the data and the learning chips keep their own marks below.
    const weapon=item.type==='weapon'?this.game.weaponAt(item.slot):null,cell=lootCell(item,weapon);
    // 3.203.0: a flamethrower is Codex's own 16px icon (loot-flamer.png), outside the atlas; the tinted silhouette without it.
    const flamer=weapon?.flame&&fxSheet('lootFlamer');
    if(flamer){const size=Math.max(4,Math.round(LOOT_ICON.size*k)),smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;c.drawImage(flamer.img,0,0,flamer.cell,flamer.cell,Math.round(a.x-size/2),Math.round(a.y-size/2),size,size);c.imageSmoothingEnabled=smooth;return;}
    if(cell&&drawLootIcon(c,this.terrainImages?.get(LOOT_ATLAS),cell,a,LOOT_ICON.size*k))return;
if(k<1){c.save();c.translate(a.x,a.y);c.scale(k,k);a={x:0,y:0};}const color=ITEM_COLORS[item.type]||'#c8bb93';this.box(a.x-9,a.y-6,18,15,'#14271f99');this.box(a.x-9,a.y-9,18,14,color,'#d7deb07f');this.box(a.x-7,a.y-7,14,10,'#263e3066');const symbol=item.type==='learning'?(String(item.learningId||'').startsWith('trait_')?'◆':'✦'):ITEM_SYMBOLS[item.type]||'?';this.text(symbol,a.x,a.y+2,'#e5eccb',10);if(item.cache&&SUPPLY_NAMES[item.type])this.text(SUPPLY_NAMES[item.type],a.x,a.y+17,color,8);if(item.type==='weapon'){this.glow(a.x,a.y,24,'#eabd5d30');this.text(this.game.weaponAt(item.slot).code,a.x,a.y-15,'#ffe0a3',8);this.box(a.x-11,a.y-11,22,18,'#00000000','#f6cf82');}if(item.type==='learning')this.glow(a.x,a.y,22,'#b9a2e633');if(k<1)c.restore();}
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
    if(p.type==='nest'){drawNest(this.ctx,this.terrainImages?.get(NEST_ATLAS),a,this.tile,p,this.game?.facilityFaction);if(p.hp>0)this.objectHealth(p,a.x-12,a.y-this.tile*.4);return;}

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
      if(p.type==='terminal'&&p.used)this.box(a.x-8,a.y-9,16,12,'#17241ad0');if(p.type==='terminal')this.terminalCredit(p,a);return;
    }
if((p.hp>0||p.type==='terminal')&&this.sprite(p.type,a,32)){this.objectHealth(p,a.x-12,a.y-16);if(p.type==='terminal'&&p.used)this.box(a.x-8,a.y-7,15,10,'#17241ab0');if(p.type==='terminal')this.terminalCredit(p,a);return;}if(p.type==='terminal'){this.box(a.x-13,a.y-13,26,27,'#263c34','#75977755');this.box(a.x-9,a.y-10,18,12,p.used?'#354339':'#82b6a0');this.line(a.x-7,a.y+7,a.x+7,a.y+7,'#9da77955',2);if(!p.used)this.glow(a.x,a.y-4,20,'#9ee3b41a');this.terminalCredit(p,a);return;}
    if(p.hp<=0){this.box(a.x-13,a.y-5,9,8,'#6f705751');this.box(a.x+2,a.y+3,12,6,'#85775a51');return;}
    if(p.type==='barrel'){const c=this.ctx;c.fillStyle='#795032';c.beginPath();c.ellipse(a.x,a.y,10,13,0,0,Math.PI*2);c.fill();this.box(a.x-9,a.y-7,18,3,'#ca8b4f');this.box(a.x-9,a.y+6,18,3,'#ce9859');this.text('!',a.x,a.y+4,'#ffdaa0',12);this.objectHealth(p,a.x-12,a.y-16);return;}
    const t=this.tile;this.box(a.x-t*.4,a.y-t*.35+5,t*.8,t*.7,'#17281f99');this.box(a.x-t*.4,a.y-t*.35,t*.8,t*.7,'#717354','#aea87988');this.box(a.x-t*.32,a.y-t*.27,t*.64,t*.54,'#525c40','#93966f66');this.line(a.x-t*.29,a.y-t*.23,a.x+t*.29,a.y+t*.23,'#b6b17999',2);this.line(a.x+t*.29,a.y-t*.23,a.x-t*.29,a.y+t*.23,'#b6b17999',2);this.objectHealth(p,a.x-12,a.y-t*.39,24,'#c4c394');
  }
  drawMap(canvas){const c=canvas.getContext('2d'),g=this.game,k=canvas.width/SIZE;c.fillStyle='#10191a';c.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(g.grid[y][x]===VOID&&g.mapped(x,y)){c.fillStyle='#07090a';c.fillRect(x*k+1,y*k+1,k-2,k-2);c.strokeStyle='#b8392c99';c.lineWidth=1;c.strokeRect(x*k+1.5,y*k+1.5,k-3,k-3);}for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(g.grid[y][x]===1&&g.mapped(x,y)){c.fillStyle=g.visibleTiles.has(`${x},${y}`)?(isDark(g,{x,y})?'#343e62':'#809672'):(isDark(g,{x,y})?'#232a40':'#384b3a');c.fillRect(x*k+1,y*k+1,k-2,k-2);}for(const m of g.props.filter(p=>p.type==='module'))for(const q of moduleCells(m))if(g.mapped(q.x,q.y)){c.strokeStyle=MODULE_TYPES[m.theme].color+'88';c.lineWidth=1;c.strokeRect(q.x*k+1,q.y*k+1,k-2,k-2);}for(const station of g.props.filter(p=>p.type==='terminal'&&g.mapped(p.x,p.y))){c.fillStyle=station.used?'#526c62':'#a3e3c0';c.fillRect(station.x*k+3,station.y*k+3,k-6,k-6);}for(const b of g.barriers)if(b.hp>0&&edgeCells(b).some(p=>g.mapped(p.x,p.y))){const x=(b.x+.5)*k,y=(b.y+.5)*k;c.strokeStyle=b.open?'#8ad2bb':b.type==='door'?'#dec184':'#bdc7bd';c.lineWidth=2;c.beginPath();c.moveTo(x-(b.axis==='y'?k/2:0),y-(b.axis==='x'?k/2:0));c.lineTo(x+(b.axis==='y'?k/2:0),y+(b.axis==='x'?k/2:0));c.stroke();}for(const box of g.props.filter(o=>isContainer(o)&&!o.opened&&g.mapped(o.x,o.y))){c.strokeStyle=CONTAINER_KINDS[box.kind].color;c.lineWidth=2;c.strokeRect(box.x*k+3,box.y*k+3,Math.max(3,k-6),Math.max(3,k-6));}for(const item of g.items)if(g.seen[item.y]?.[item.x]){c.fillStyle='#d9bd7b';c.fillRect(item.x*k+4,item.y*k+4,Math.max(2,k-8),Math.max(2,k-8));}for(const [o,color]of[[g.exitPoint,'#9ee3bf'],...g.visibleEnemies.map(e=>[e,'#e29a78']),...(g.localAllies||[]).map(a=>[a,a.hp>0?'#83efd1':'#b5a774']),[g.player,'#ffcb8c']])if(o===g.exitPoint?g.mapped(o.x,o.y):g.seen[o.y]?.[o.x]){c.fillStyle=color;c.fillRect(o.x*k+2,o.y*k+2,k-4,k-4);}for(const o of [...missionObjects(g).filter(t=>!t.done),...g.visibleEnemies.filter(e=>missionTarget(g,e))])if(g.seen[o.y]?.[o.x]){c.strokeStyle='#88f3ff';c.lineWidth=2;c.strokeRect(o.x*k+1,o.y*k+1,k-2,k-2);}// 3.191.0 (user): the floor map shows every point big and filled, by status: red while held; 3.192.0: framed while targeted.
    for(const [n,pt] of (g.survival?.points||[]).entries()){const color=POINT_COLORS[pointStatus(g,pt)],r=k*1.3,cx=(pt.x+.5)*k,cy=(pt.y+.5)*k;c.fillStyle=color;c.fillRect(cx-r,cy-r,r*2,r*2);c.strokeStyle='#0a0f10';c.lineWidth=1;c.strokeRect(cx-r,cy-r,r*2,r*2);c.fillStyle='#0a0f10';c.font=`bold ${Math.round(r*1.5)}px monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(pointLetter(n),cx,cy+.5);if(pointTargeted(g,pt))pointFrame(c,cx,cy,r+k*.55,k*.7,1.5,POINT_FRAME);}
const target=this.targetingEnabled?g.targeted:null;if(target){c.strokeStyle='#ffd9a0';c.strokeRect(target.x*k+.5,target.y*k+.5,k-1,k-1);}}
  // The floor pass (3.206.3, from Renderer.draw): floor tiles and what lies on them — traces, vents, hazards, fire, the
  // burrow, move hints, supply signs, the exit, bodies, props, drops, objectives — then the smoke field over them.
  // Returns the wall tiles beside seen floor; drawWalls lays them over everything drawn after this.
  drawGround(time){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    const traceCells=new Map();for(const trace of g.traces){const k=trace.x+','+trace.y;if(!traceCells.has(k))traceCells.set(k,[]);traceCells.get(k).push(trace);}
    const floorCells=[],wallCells=[];
    const minX=Math.max(0,Math.floor(this.camera.x-this.w/t/2-1)),maxX=Math.min(SIZE-1,Math.ceil(this.camera.x+this.w/t/2+1));
    const minY=Math.max(0,Math.floor(this.camera.y-this.h/t/2-1)),maxY=Math.min(SIZE-1,Math.ceil(this.camera.y+this.h/t/2+2));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
      const a=this.project(x,y),left=a.x-half,top=a.y-half,seen=g.mapped(x,y);   // 3.191.0: survival maps everything
      if(g.grid[y][x]===VOID)continue;   // 3.164.0 pits: no floor at all (user decision)
      if(g.grid[y][x]!==1) {
        if([[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.grid[y+dy]?.[x+dx]===1&&g.mapped(x+dx,y+dy))){this.box(left,top,t,t,'#202e2b');wallCells.push({a,x,y});}
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
      for(const [dx,dy]of[[0,-1],[-1,0]])if(g.grid[y+dy]?.[x+dx]!==1&&g.grid[y+dy]?.[x+dx]!==VOID){if(dx)this.line(left+3,top+7,left+3,top+t-7,'#c3aa625e',2);else this.line(left+7,top+3,left+t-7,top+3,'#c3aa625e',2);}
      }else this.decals?.floor(this,x,y,a,Math.ceil(t));   // faction decals lie under the darkness bands, fog and props
      this.pitRim(a,x,y,t);   // 3.164.0: like a decal, but fixed — under the darkness bands, fog, props and railings
      const module=g.props.find(m=>m.type==='module'&&moduleCells(m).some(q=>q.x===x&&q.y===y));if(module&&!this.terrainReady)this.moduleFloor(a,module);
      for(const band of floorShading(g,x,y))this.box(left+band.x*t,top+band.y*t,band.w*t,band.h*t,band.color);
      floorCells.push({a,left,top,x,y});c.globalAlpha=1;
    }
    const fieldCells=[],bodies=[],later=[];
    // 3.211.0 (docs/KILL_GORE.md 屍體圖層): the floor's bodies by tile, once, for the corpse pass below.
    const deadAt=new Map();for(const dead of g.enemies)if(dead.hp<=0&&!dead.raised){const k=dead.x+','+dead.y;if(!deadAt.has(k))deadAt.set(k,[]);deadAt.get(k).push(dead);}
    for(const {a,left,top,x,y}of floorCells){
      c.globalAlpha=g.visibleTiles?.has(x+','+y)?1:.36;
      // 3.151.0 blind fire: until the tile is seen again it keeps what it showed before the shot (src/blind-fire.js).
      const memo=g.visibleTiles?.has(x+','+y)?null:g.blindAftermath?.get(x+','+y);
      // 3.191.0: on a mapped but never-seen tile (survival) traces, hazards, bodies and drops stay unknown.
      const looked=g.seen[y][x];
      if(looked)for(const trace of memo?memo.traces:traceCells.get(x+','+y)||[])drawTrace(c,trace,a.x,a.y,t);
      const vent=looked&&g.vents?.find(v=>v.x===x&&v.y===y);if(vent)this.vent(a,vent,time,x,y);   // 3.202.0
      const hazard=looked&&g.hazards.find(h=>h.x===x&&h.y===y);if(hazard)this.hazard(a,hazard,time);
      const burning=looked&&burningAt(g,{x,y});if(burning)this.burning(a,burning,time);   // 3.203.0
      // Swarm invasion point (3.85.1): a burrow appears once the surge wakes up and turns to rubble when it is spent.
      // It is not a prop, so it never blocks, takes damage or shows a health bar (docs/SWARM.md 9.1).
      if(g.swarmWaves?.active&&g.swarmWaves.origin.x===x&&g.swarmWaves.origin.y===y)drawNestSprite(c,this.terrainImages?.get(NEST_ATLAS),a,t,'burrow',g.swarmWaves.remaining>0?'active':'ruins');
      if(distance(p,{x,y})===1&&g.passable(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y))this.box(left+3,top+3,t-6,t-6,'#b0ba8010','#b1c48a3b');
      const room=g.rooms?.find(r=>r.supply&&r.cx===x&&r.cy===y);if(room){const sign=SUPPLY_ROOMS[room.supply];if(sign)this.text(sign.code,a.x,a.y-this.tile*.4,sign.color,9);}
      if(g.exitPoint.x===x&&g.exitPoint.y===y)this.exit(a,time);
      // 3.178.0: what lies in the black, bodies and items, is not seen unless you see in the dark.
      const shown=looked&&(!isBlack(g,{x,y})||seesInDark(g,p));
      if(shown)for(const dead of deadAt.get(x+','+y)||[])if(!memo||memo.dead.includes(dead.id))bodies.push({dead,alpha:c.globalAlpha});
      later.push({a,left,top,x,y,memo,shown,burning,alpha:c.globalAlpha});
    }
    // 3.211.0: the bodies, each where its throw left it (src/corpse-layer.js), after everything flat on the floor and
    // before the props and drops of every tile, so loot always shows at its tile's centre.
    this.drawCorpses(bodies,time);
    for(const {a,x,y,memo,shown,burning,alpha}of later){
      c.globalAlpha=alpha;
      if(g.operatorCorpse?.x===x&&g.operatorCorpse.y===y)this.operatorCorpse(a,g.operatorCorpse,time);
      for(const prop of g.props)if(isContainer(prop)&&prop.x===x&&prop.y===y)this.glitchDraw(a,prop.id,()=>this.prop(a,prop,time));
      for(const prop of g.props)if(!isContainer(prop)&&prop.x===x&&prop.y===y)this.glitchDraw(a,prop.id,()=>this.prop(a,prop,time));
      if(shown)for(const weapon of [false,true])for(const item of memo?memo.items:g.items)if((item.type==='weapon')===weapon&&item.x===x&&item.y===y)this.glitchDraw(a,itemGlitchKey(item),()=>this.groundItem(a,item,time));
      for(const objective of missionObjects(g))if(!objective.done&&objective.x===x&&objective.y===y){this.box(a.x-9,a.y-8,18,16,'#123d46','#82e6ec');this.text('D',a.x,a.y+4,'#b7fcff',12);}
      // 3.134.0: toxic mist is green, spore smoke brown; plain smoke keeps its grey. 3.202.0: the vents' light smoke is a
      // thin pale veil and steam white; a Codex sheet (src/fx-sprites.js) replaces the boxes once it is there.
      for(const cloud of g.smoke)if(cloud.cells.some(q=>q.x===x&&q.y===y)){
        const kind=cloud.kind||'smoke',sheet=fxSheet('smoke'),row=sheet?.rows?.[kind],left=a.x-t/2,top=a.y-t/2;
        // Smoke as one field (3.202.0): drawn after this pass by cloudField, the count on top of it.
        if(this.smokeField(kind)){fieldCells.push({x,y,kind,alpha:c.globalAlpha,a,label:String(Math.max(1,cloud.expires-g.turn))});continue;}
        // The sprite has transparent margins, so a faint veil of the old fill goes underneath to keep a cloud whole (handoff).
        if(sheet&&row!==undefined){const tone=CLOUD_TONES[kind]||CLOUD_TONES.smoke,base=c.globalAlpha;this.glow(a.x,a.y,t*.8,tone[0].slice(0,7)+'40');c.globalAlpha=base*(FX_SMOKE_ALPHA[kind]??.6);c.drawImage(sheet.img,fxFrame(time,x,y,sheet.frames)*sheet.cell,row*sheet.cell,sheet.cell,sheet.cell,left,top,t,t);c.globalAlpha=base;}
        else{const tone=CLOUD_TONES[kind]||CLOUD_TONES.smoke;this.glow(a.x,a.y,t*.8,tone[0]);for(let n=0;n<(kind==='haze'?2:3);n++)this.box(left+5+n*7,top+8+(x+y+n)%3*6,11,5,tone[1]);}
        this.text(String(Math.max(1,cloud.expires-g.turn)),a.x+t*.3,a.y+t*.3,'#d3e2ed',8);
      }
      // 3.203.0: a burning tile smokes like light smoke, drawn by the same smoke field and never as a sprite of its own;
      // it has no count (a fire's end is rolled, not known). Without the field only the flames show.
      if(burning&&!fieldCells.some(q=>q.x===x&&q.y===y&&q.kind==='haze')&&this.smokeField('haze'))fieldCells.push({x,y,kind:'haze',alpha:c.globalAlpha,a,label:null});
      c.globalAlpha=1;
    }
    this.cloudField(fieldCells,time);
    for(const q of fieldCells)if(q.label){c.globalAlpha=q.alpha;this.text(q.label,q.a.x+t*.3,q.a.y+t*.3,'#d3e2ed',8);}c.globalAlpha=1;
    return wallCells;
  }
  // 3.211.0 (docs/KILL_GORE.md 屍體圖層): what a thrown body may cross and lie on — floor without a solid prop (no wall,
  // no pit) — and the edges that stop it (a closed door, a partition, a low partition), read from the state being drawn.
  corpseWorld(){const g=this.game;return {open:(x,y)=>g.grid[y]?.[x]===1&&!g.solid(x,y),edge:(a,b)=>blockedBetween(g.barriers,a,b)};}
  // The corpse pass: each body at its pose on the corpse layer (src/corpse-layer.js), at its own tile's fog alpha, dark
  // where it lies in the dark. A floor with more than CORPSE_TUNING.keep bodies fades its oldest out.
  // Review (3.211.0): every body is posed (marked drawn) before the cap is settled, so one rebuilt past the cap is hidden
  // before it shows; with the setting off (`flat`) the layer starts over and the old settling nudge is kept (layer=false).
  drawCorpses(bodies,time){
    const g=this.game,c=this.ctx,layer=this.corpses;if(!layer)return;
    const world=this.corpseWorld(),flat=this.goreLevel==='off';
    layer.use(`${g.seed}:${g.floor}`,flat);
    const poses=bodies.map(({dead})=>layer.pose(dead,time,world,{flat}));
    layer.settle(g.enemies.filter(e=>e.hp<=0&&!e.raised),time);
    for(const [i,{dead,alpha}]of bodies.entries()){
      const pose=poses[i],fade=layer.alpha(dead.id,time);if(fade<=0)continue;
      c.globalAlpha=alpha*fade;
      this.corpse(this.project(dead.x+pose.x,dead.y+pose.y-pose.lift),dead.type,undefined,dead,pose.angle,!flat);
    }
    c.globalAlpha=1;
  }
  // Walls and raised partitions (3.206.3, from Renderer.draw) occlude everything drawn before them.
  drawWalls(wallCells){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    // Raised partitions share the wall occlusion layer; footprints remain on ground edges.
    const seenBarriers=g.barriers.filter(b=>edgeCells(b).some(q=>g.mapped(q.x,q.y)));
    const barriers=[...seenBarriers.map(b=>({b,y:b.y+(b.axis==='x'?.5:.08)})),...barrierJunctions(seenBarriers).map(j=>({j,y:j.y+.081}))].sort((a,b)=>a.y-b.y);
    for(const {b,j}of barriers){c.globalAlpha=(b?g.visible(b):j.edges.some(e=>g.visible(e)))?1:.35;if(b)this.drawBarrier(b);else drawJunction(c,j,this.project(j.x,j.y),this.tile,this.terrainImages,g);c.globalAlpha=1;}
    // Walls occlude all world-space content, including actors, traces and transient effects.
    for(const {a,x,y}of wallCells){
      c.globalAlpha=[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.visibleTiles?.has((x+dx)+','+(y+dy)))?1:.36;
      this.wall(a,x,y);c.globalAlpha=1;
    }
  }
}
