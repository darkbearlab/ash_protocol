// Telegraphs and targeting (3.206.3 split): what the enemies have announced and what you are aiming — reinforcements,
// marks and grenades, flamer and boss cones, charge lanes, egg sacs, walls and rings of fire, heat, aim previews,
// field gear, lamps, survival points, the shotgun cone, wind-ups, tongue pulls — and, over the units, grenade labels,
// a boss's paint and your mark, pet and drone aims, the grapple preview and the locked target.
// Methods of Renderer (src/renderer.js), which copies them onto Renderer.prototype (src/mixin.js, 3.206.3): `this` is
// the renderer, `this.game` the state being drawn and `this.ctx` the canvas.
import {t as tx} from './i18n.js';   // t is the tile size in the draw code
import {lineReason} from './lines.js';
import {grenadeMarkers} from './affix-ui.js';
import {unitTree} from './behavior-tree.js';
import {CHARGE_VISUAL,EGG_VISUAL,REBEL_FIRE_VISUAL,OPERATIVE_VISUAL,tongueVisual} from './enemy-visuals.js';
import {smokeTelegraphs} from './delisted-operatives.js';
import {NEST_ATLAS,drawNestSprite} from './nest-art.js';
import {blindReason} from './blind-fire.js';
import {DECOY_TUNING,decoyReason,glowstickReason,mineReason} from './field-gear.js';
import {isNoncombatant} from './enemy-data.js';
import {droneCells} from './allies.js';
import {LIGHT,flareLightCells,glowstickCells,isLamp} from './lighting.js';
import {areaCells,squareCells} from './throwables.js';
import {SURVIVAL_TUNING,pointLetter,pointStatus,pointTargeted} from './survival.js';
import {coneTargets,inCone} from './shotgun.js';
import {distance,tongueTelegraphs} from './engine.js';
import {flameCells,liveFlameIntent} from './fire.js';
import {BOSS_TUNING,designated,gunCells,liveGun,liveMarkIntent} from './loyalist-bosses.js';
import {chargeLanes,eggSacs} from './swarm-bosses.js';
import {REBEL_BOSS_TUNING,burnCells,liveBurn,liveFireIntent} from './rebel-bosses.js';
import {POINT_COLORS,POINT_FRAME,pointFrame} from './renderer-map.js';
export class RendererTelegraphs {
  // A spray's reach, tile by tile: the flamethrower's aim and a flamer's marked cone.
  // 3.205.0 (src/swarm-bosses.js): a charge lane with chevrons pointing down it, and a red bar across its end when it will
  // hit a wall there (and stun itself).
  chargeLane(lane,time){
    const g=this.game,t=this.tile,c=this.ctx,{dir}=lane,s=t*.14;
    for(const q of lane.cells){if(!g.visible(q))continue;const a=this.project(q.x,q.y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,CHARGE_VISUAL.fill,CHARGE_VISUAL.edge);
      c.globalAlpha=.7+.3*Math.sin(time/110);const x=a.x+dir.x*s*.6,y=a.y+dir.y*s*.6;
      this.line(x-dir.x*s-dir.y*s,y-dir.y*s-dir.x*s,x,y,CHARGE_VISUAL.chevron,2);this.line(x-dir.x*s+dir.y*s,y-dir.y*s+dir.x*s,x,y,CHARGE_VISUAL.chevron,2);c.globalAlpha=1;}
    const last=lane.cells[lane.cells.length-1]||lane.origin;
    if(lane.crash&&g.visible(last)){const a=this.project(last.x+dir.x*.5,last.y+dir.y*.5),h=t*.46;if(dir.x)this.box(a.x-3,a.y-h,6,h*2,CHARGE_VISUAL.wall);else this.box(a.x-h,a.y-3,h*2,6,CHARGE_VISUAL.wall);}
  }
  // The matriarch's egg sac on the tile it will hatch on next round. 3.206.0 (user): the swarm wave's burrow (the hole a
  // surge comes out of, src/nest-art.js) over the warning tile; the pale, pulsing sac below is only the fallback for when
  // the nest atlas has not loaded.
  eggSac(q,time){
    const a=this.project(q.x,q.y),t=this.tile,c=this.ctx,beat=1+.06*Math.sin(time/150);
    this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,EGG_VISUAL.fill,EGG_VISUAL.edge);
    if(drawNestSprite(c,this.terrainImages?.get(NEST_ATLAS),a,t,'burrow','active'))return;
    c.beginPath();c.ellipse(a.x,a.y+t*.05,t*.2*beat,t*.27*beat,0,0,Math.PI*2);c.fillStyle=EGG_VISUAL.sac;c.fill();c.strokeStyle=EGG_VISUAL.vein;c.lineWidth=1.5;c.stroke();
    this.line(a.x-t*.06,a.y-t*.12,a.x+t*.02,a.y+t*.14,EGG_VISUAL.vein,1);this.box(a.x-t*.1,a.y-t*.12,3,3,EGG_VISUAL.glow);
  }
  // 3.206.0 (src/rebel-bosses.js): a warned wall or ring of fire, pulsing. The wall's tiles with a line through their
  // middles; the ring's tiles, and its gaps dashed green with an arrow pointing out of the ring (where it lets you go).
  fireIntent(s,time){
    const g=this.game,t=this.tile,c=this.ctx,V=REBEL_FIRE_VISUAL;
    c.globalAlpha=.75+.25*Math.sin(time/120);
    for(const q of s.cells)if(g.visible(q)){const a=this.project(q.x,q.y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,V.fill,V.edge);}
    c.globalAlpha=1;
    if(s.kind==='wall'){for(let i=1;i<s.cells.length;i++){const p=s.cells[i-1],q=s.cells[i];if(!g.visible(p)&&!g.visible(q))continue;const a=this.project(p.x,p.y),b=this.project(q.x,q.y);this.line(a.x,a.y,b.x,b.y,V.line,3);}return;}
    for(const q of s.gaps||[])if(g.visible(q)){
      const a=this.project(q.x,q.y),dx=q.x-s.center.x,dy=q.y-s.center.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,h=t*.22,tip={x:a.x+ux*h,y:a.y+uy*h};
      c.setLineDash([3,2]);this.box(a.x-t/2+3,a.y-t/2+3,t-6,t-6,V.gapFill,V.gap);c.setLineDash([]);
      this.line(a.x-ux*h,a.y-uy*h,tip.x,tip.y,V.gap,2);this.line(tip.x,tip.y,tip.x-ux*h*.7-uy*h*.6,tip.y-uy*h*.7+ux*h*.6,V.gap,2);this.line(tip.x,tip.y,tip.x-ux*h*.7+uy*h*.6,tip.y-uy*h*.7-ux*h*.6,V.gap,2);
    }
  }
  // An overheated arsonist: pale steam rising and a dashed cool-blue ring, with its venting rounds left; its heat before
  // that as a row of pips over it (lit ones orange).
  heatMarks(a,e,time){
    const t=this.tile,c=this.ctx,V=REBEL_FIRE_VISUAL;
    if(e.overheat>0){
      for(let i=0;i<5;i++){const k=(time/900+i/5)%1,x=a.x+Math.sin(i*2.1+time/400)*t*.22,y=a.y-t*.2-k*t*.45;c.globalAlpha=.55*(1-k);this.box(Math.round(x)-2,Math.round(y)-2,4,4,V.steam);}
      c.globalAlpha=1;c.beginPath();c.setLineDash([4,3]);c.arc(a.x,a.y,t*.48,0,Math.PI*2);c.strokeStyle=V.vent;c.lineWidth=1.5;c.stroke();c.setLineDash([]);
      this.text(String(e.overheat),a.x+t*.36,a.y-t*.3,V.vent,12);return;
    }
    const max=REBEL_BOSS_TUNING.arsonist.heat;for(let i=0;i<max;i++)this.box(Math.round(a.x+(i-(max-1)/2)*t*.2)-2,Math.round(a.y-t*.56)-2,5,5,i<e.heat?V.heat:V.heatOff);
  }
  flameArea(cells,fill,stroke){const t=this.tile;for(const {x,y} of cells){const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,fill,stroke);}}
  // Grenadier telegraphs (3.75.1): amber landing tile and dashed throw line while it can be stopped, red blast once thrown.
  grenadeMarker(m){const c=this.ctx,to=this.project(m.x,m.y),prepare=m.phase==='prepare';
    if(m.line){const from=this.project(m.origin.x,m.origin.y);c.setLineDash(prepare?[5,4]:[2,5]);this.line(from.x,from.y,to.x,to.y,prepare?'#f0c77acc':'#f8996999',prepare?1.5:1);c.setLineDash([]);}
    // 3.188.0: a stun grenade is yellow, and once thrown marks the 3×3 it will reach.
    if(m.stun&&!prepare){const t=this.tile;for(const {x,y} of squareCells(this.game,m)){const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,'#e8dc6a3a','#f2e88caa');}return;}
    this.markArea(m,prepare?0:m.radius,prepare?(m.stun?'#e8dc6a2e':'#e6b35b2e'):'#e969494f',prepare?(m.stun?'#f2e88cdd':'#f0c77add'):'#f8996977','');}
  // Drawn after actors: the landing tile is usually the player's, whose sprite would hide a centred tag.
  grenadeLabel(m){const t=this.tile,a=this.project(m.x,m.y),y=a.y-t*.5-3,w=m.label.length*10+8,prepare=m.phase==='prepare';
    this.box(a.x-w/2,y-10,w,13,'#1b1410d9',prepare?'#f0c77a99':'#f8996999');this.text(m.label,a.x,y,prepare?'#ffe0a0':'#ffd3a4',9);}
  markArea(center,radius,fill,stroke,label){const g=this.game,t=this.tile;for(const {x,y} of areaCells(g.grid,center,radius,g.barriers,g)){const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,fill,stroke);}if(label){const a=this.project(center.x,center.y);this.text(label,a.x,a.y+5,'#ffd3a4',17);}}
  // Telegraphs and aims (3.206.3, from Renderer.draw), on the floor under the units: reinforcements, marks, grenade,
  // flamer and boss telegraphs, aim previews, field gear, lamps, survival points, flares, the shotgun cone, wind-ups
  // and tongue pulls.
  drawTelegraphs(time){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    // Swarm waves arrive unannounced (user decision, 3.85.2); only retreat reinforcements keep their countdown marker.
    for(const spawn of g.reinforcements||[])if(g.visible(spawn))this.markArea(spawn,0,'#70dce833','#94f0eeaa','+'+Math.max(1,spawn.due-g.turn));
    // Allied bombardment marks (3.95.0) are amber, so the player can tell them from enemy marks; both still hurt the player.
    for(const m of g.marks)if(m.kind!=='grenade')this.markArea(m,1,m.kind==='ally'?'#e9a2494f':'#e969494f',m.kind==='ally'?'#f8c46977':'#f8996977',String(Math.max(1,m.due-g.turn)));
    for(const m of grenadeMarkers(g))this.grenadeMarker(m);
    // 3.203.0: a flamer's marked cone (src/enemy-behavior.js flamerAct), every tile of it you can see, until it sprays.
    for(const e of g.enemies)if(liveFlameIntent(e))this.flameArea(flameCells(g,e.flameIntent.origin,e.flameIntent.aim).filter(q=>g.visible(q)),'#f0643c30','#ff8d5ccc');
    // 3.204.0 (src/loyalist-bosses.js): a boss's set-up machine gun — its cone amber while it sets up, red while it sweeps,
    // with the sweeps still to come by the boss.
    // 3.205.0 (src/swarm-bosses.js): a swarm boss's charge lane, every tile of it you can see, and the matriarch's egg sac.
    for(const lane of chargeLanes(g))this.chargeLane(lane,time);
    for(const sac of eggSacs(g))if(g.visible(sac))this.eggSac(sac,time);
    for(const e of g.enemies)if(liveGun(e)){const sweep=e.gun.stage==='sweep';this.flameArea(gunCells(g,e.gun.origin,e.gun.aim).filter(q=>g.visible(q)),sweep?'#e8503c2e':'#f0b43c24',sweep?'#ff7a5cbb':'#ffd27a99');if(g.visible(e)){const a=this.project(e.x,e.y);this.text(String(sweep?e.gun.left:BOSS_TUNING.gun.sweeps),a.x+t*.36,a.y-t*.3,sweep?'#ff9a7c':'#ffd27a',12);}}
    // 3.206.0 (src/rebel-bosses.js): the arsonist's warned wall or ring of fire (the ring's gaps green, pointing the way out)
    // and 焚線官's set-up flamethrower — 火線官's cone in fire colours, with the sweeps still to come by the boss.
    for(const e of g.enemies)if(liveFireIntent(e))this.fireIntent(e.fireIntent,time);
    for(const e of g.enemies)if(liveBurn(e)){const sweep=e.burn.stage==='sweep',[fill,edge]=sweep?REBEL_FIRE_VISUAL.sweep:REBEL_FIRE_VISUAL.set;this.flameArea(burnCells(g,e.burn.origin,e.burn.aim).filter(q=>g.visible(q)),fill,edge);if(g.visible(e)){const a=this.project(e.x,e.y);this.text(String(sweep?e.burn.left:REBEL_BOSS_TUNING.burn.sweeps),a.x+t*.36,a.y-t*.3,sweep?REBEL_FIRE_VISUAL.sweepText:REBEL_FIRE_VISUAL.setText,12);}}
    if(this.mode==='grenade'&&this.aim)this.markArea(this.aim,2,'#e6a95b33','#eacb84aa','');
    // 3.123.0: a flare's aim shows exactly the tiles it would light now (shadows and full cover stay unmarked).
    // 3.135.0: a grapple line's aim — the straight pull and its landing, green when it can go, red when it cannot.
    if(this.mode==='rope'&&this.aim){const t=this.tile,ok=!lineReason(g,{...this.aim,item:this.ropeItem}),from=this.project(g.player.x,g.player.y),a=this.project(this.aim.x,this.aim.y);this.line(from.x,from.y,a.x,a.y,ok?'#9ee6a0aa':'#e8756aaa',2);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,ok?'#9ee6a033':'#e8756a33',ok?'#9ee6a0':'#e8756a');}
    if(this.mode==='flare'&&this.aim){const t=this.tile;for(const {x,y,level} of flareLightCells(g,this.aim)){const a=this.project(x,y);if(level===LIGHT.lit)this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,'#ffd27a26','#ffe0a066');else this.box(a.x-t/2+4,a.y-t/2+4,t-8,t-8,'#ffd27a10','#ffe0a033');}const a=this.project(this.aim.x,this.aim.y);this.text('✺',a.x,a.y+5,'#ffe3a8',15);}
    // 3.144.0 (src/field-gear.js): placing a decoy or a mine shows the tile, and the decoy marks the enemies it would draw.
    if(this.mode==='blind'&&this.aim){const t=this.tile,ok=!blindReason(g,this.aim),from=this.project(g.player.x,g.player.y),a=this.project(this.aim.x,this.aim.y),tone=ok?'#e8c46acc':'#e8756aaa';
      c.save();c.setLineDash([4,4]);this.line(from.x,from.y,a.x,a.y,ok?'#e8c46a66':'#e8756a66',1.5);c.restore();this.box(a.x-t/2+3,a.y-t/2+3,t-6,t-6,ok?'#e8c46a1a':'#e8756a1a',tone);
      this.line(a.x-t*.32,a.y,a.x-t*.12,a.y,tone,2);this.line(a.x+t*.12,a.y,a.x+t*.32,a.y,tone,2);this.line(a.x,a.y-t*.32,a.x,a.y-t*.12,tone,2);this.line(a.x,a.y+t*.12,a.x,a.y+t*.32,tone,2);this.text('?',a.x,a.y+4,tone,11);}
    if(this.mode==='place'&&this.aim){const t=this.tile,ok=!(this.placeItem==='mine'?mineReason(g,this.aim):this.placeItem==='glowstick'?glowstickReason(g,this.aim):decoyReason(g,this.aim)),a=this.project(this.aim.x,this.aim.y);
      if(this.placeItem==='glowstick')for(const {x,y} of glowstickCells(g,this.aim)){const q=this.project(x,y);this.box(q.x-t/2+4,q.y-t/2+4,t-8,t-8,'#9dff8a10','#9dff8a40');}
      if(this.placeItem==='decoy')for(const e of g.visibleEnemies.filter(e=>distance(e,this.aim)<=DECOY_TUNING.radius&&!isNoncombatant(e))){const q=this.project(e.x,e.y);this.box(q.x-t/2+3,q.y-t/2+3,t-6,t-6,'#e0c46a1f','#e0c46a99');}
      this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,ok?'#e0c46a33':'#e8756a33',ok?'#e0c46a':'#e8756a');this.text(this.placeItem==='mine'?'✱':this.placeItem==='glowstick'?'⌇':'◎',a.x,a.y+5,ok?'#ffe3a8':'#f3a79c',15);}
    // Your mines (only you know where they are) and a live decoy with its hit points and turns left.
    for(const m of g.mines||[])if(g.seen?.[m.y]?.[m.x]){const a=this.project(m.x,m.y),t=this.tile;this.box(a.x-t*.16,a.y-t*.12,t*.32,t*.24,'#2a2f2c','#8c7a5a');this.box(a.x-1.5,a.y-1.5,3,3,'#ff5a4a');}
    if(g.decoy&&g.seen?.[g.decoy.y]?.[g.decoy.x]){const d=g.decoy,a=this.project(d.x,d.y),t=this.tile,pulse=this.reduceMotion?.5:.5+.5*Math.sin(time/180);
      this.glow(a.x,a.y,t*(1+.4*pulse),'#e0c46a2a');this.box(a.x-t*.18,a.y-t*.18,t*.36,t*.36,'#3b3522','#e0c46a');this.text('◎',a.x,a.y+4,'#ffe7a0',11);
      this.text(`${d.hp}·${Math.max(1,d.expires-g.turn)}`,a.x,a.y+t*.42,'#ffe7a0',8);}
    // 3.178.0 (docs/LIGHTING.md): wall lamps glow warm against their wall; a glowstick is a small green bar.
    // 3.187.0: a lamp that has been shot out is a dark fitting.
    for(const lamp of g.lamps||[])if(g.seen?.[lamp.y]?.[lamp.x]){const {x:lx,y:ly}=this.lampPoint(lamp);if(lamp.hp>0){this.glow(lx,ly,this.tile*.9,'#ffdca030');this.box(lx-3,ly-3,6,6,'#fff0c8','#8a6a3a');}else this.box(lx-3,ly-3,6,6,'#2a2620','#5a4a32');}
    // 3.189.0 (docs/SURVIVAL.md): survival points, shown seen or not: letter and life; red while held, grey once fallen;
    // 3.192.0: framed in amber, pulsing, while a group is after it.
    for(const [i,pt] of (g.survival?.points||[]).entries()){const a=this.project(pt.x,pt.y),t=this.tile,status=pointStatus(g,pt),fallen=status==='fallen',color=POINT_COLORS[status];if(!fallen)this.glow(a.x,a.y,t*.9,color+'38');if(pointTargeted(g,pt)){const pulse=.55+.45*Math.abs(Math.sin(time/320));this.ctx.globalAlpha=pulse;pointFrame(this.ctx,a.x,a.y,t*.47,t*.16,2,POINT_FRAME);this.ctx.globalAlpha=1;}this.box(a.x-t*.28,a.y-t*.28,t*.56,t*.56,color+'40',color);this.text(pointLetter(i),a.x,a.y+4,color,11);if(!fallen){const w=t*.6;this.box(a.x-w/2,a.y+t*.34,w,3,'#000000aa');this.box(a.x-w/2,a.y+t*.34,w*pt.hp/SURVIVAL_TUNING.pointHp,3,color);}}
    for(const stick of g.glowsticks||[])if(g.seen?.[stick.y]?.[stick.x]){const a=this.project(stick.x,stick.y),t=this.tile;this.glow(a.x,a.y,t*.8,'#9dff8a2a');this.line(a.x-4,a.y+3,a.x+4,a.y-3,'#c8ffb8',3);}
    for(const flare of g.flares||[])if(g.seen?.[flare.y]?.[flare.x]){const a=this.project(flare.x,flare.y),t=this.tile;this.glow(a.x,a.y,t*1.6,'#ffd27a30');this.box(a.x-2,a.y-2,4,4,'#fff1c4');this.text(String(Math.max(1,flare.expires-g.turn)),a.x+t*.3,a.y+t*.3,'#ffe3a8',8);}
    if(this.mode==='launch'&&this.aim){if(g.weapon?.flame)this.flameArea(flameCells(g,g.player,this.aim),'#e6a95b26','#eacb84aa');else this.markArea(this.aim,1,'#e6a95b33','#eacb84aa','');}   // 3.203.0: the flamethrower's cone
    // 3.112.0: the shotgun's cone, faint on the floor and firm on everyone one shell will reach; red for a friend.
    const coneAim=this.targetingEnabled&&!this.mode&&g.weapon?.cone&&g.targeted&&g.enemies.includes(g.targeted)?g.targeted:null;
    if(coneAim){
      const p=g.player,w=g.weapon,t=this.tile;
      for(let y=p.y-w.range;y<=p.y+w.range;y++)for(let x=p.x-w.range;x<=p.x+w.range;x++){
        const cell={x,y};
        if((x===p.x&&y===p.y)||distance(p,cell)>w.range||g.grid[y]?.[x]!==1||!g.visible(cell)||!inCone(p,coneAim,cell,w.cone))continue;
        const a=this.project(x,y);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,'#e6a95b24');
      }
      for(const o of coneTargets(g,p,coneAim,w)){const a=this.projectActor(o),friend=!g.enemies.includes(o);this.box(a.x-t/2+2,a.y-t/2+2,t-4,t-4,friend?'#e9696933':'#e6a95b26',friend?'#f89969cc':'#eacb84aa');}
    }
    if(this.mode==='suppress'&&this.aim)this.markArea(this.aim,1,'#8fb2ea33','#b8cff5bb','');
    for(const e of g.visibleEnemies.filter(e=>e.charge)) {
      const a=this.projectActor(e),target=unitTree(e).fixedTile&&e.aim?e.aim:g.activeAllies.find(a=>a.id===e.focusTarget)||p,b=this.projectActor(target);
      c.setLineDash([5,5]);this.line(a.x,a.y,b.x,b.y,unitTree(e).fixedTile?'#efb5cb8f':'#eaaa6855',1);c.setLineDash([]);
    }
    // Tongue pulls (3.84.1): the announced line to the grabbed tile and the landing tile, only for bosses the player can see.
    for(const tongue of tongueTelegraphs(g)){
      const source=g.visibleEnemies.find(e=>e.id===tongue.sourceId);if(!source)continue;
      // 3.205.0: the whole line it will fly along (to its reach or the first wall): the first body on it is caught.
      const V=tongueVisual(tongue);   // 3.207.0: a delisted berserker's grapple in steel
      for(const q of tongue.lane)if(g.visible(q)){const m=this.project(q.x,q.y);this.box(m.x-t*.4,m.y-t*.4,t*.8,t*.8,V.lane);}
      const end=tongue.lane[tongue.lane.length-1]||tongue.target,a=this.projectActor(source),b=this.project(tongue.target.x,tongue.target.y),l=this.project(tongue.landing.x,tongue.landing.y),z=this.project(end.x,end.y);
      c.setLineDash([4,3]);this.line(a.x,a.y,z.x,z.y,V.line,2);c.setLineDash([]);
      this.box(b.x-t*.42,b.y-t*.42,t*.84,t*.84,V.fill,V.edge);this.box(l.x-t*.28,l.y-t*.28,t*.56,t*.56,'#00000000',V.landing);
    }
    // 3.207.0 (src/delisted-operatives.js): a delisted recon's warned smoke grenade, the cloud's tiles you can see, with a
    // dashed arc from the recon while you see it.
    for(const s of smokeTelegraphs(g)){
      const V=OPERATIVE_VISUAL,pulse=this.reduceMotion?.5:.5+.5*Math.sin(time/200);
      for(const q of s.cells)if(g.visible(q)){const m=this.project(q.x,q.y);c.globalAlpha=.6+.4*pulse;this.box(m.x-t*.44,m.y-t*.44,t*.88,t*.88,V.smokeFill,V.smokeEdge);c.globalAlpha=1;}
      const source=g.visibleEnemies.find(e=>e.id===s.sourceId);
      if(source){const a=this.projectActor(source),b=this.project(s.point.x,s.point.y),mid={x:(a.x+b.x)/2,y:Math.min(a.y,b.y)-t*.8};c.save();c.setLineDash([4,4]);c.strokeStyle=V.smokeLine;c.lineWidth=1.5;c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(mid.x,mid.y,b.x,b.y);c.stroke();c.restore();this.text('≋',b.x,b.y+5,'#e3edf4',15);}
    }
  }
  // What is aimed at whom (3.206.3, from Renderer.draw), over the units: grenade labels, a boss's paint and your
  // mark, pet and drone aims, the grapple preview and the locked target.
  drawTargeting(time){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    const pos=this.projectActor(p);
    for(const m of grenadeMarkers(g))this.grenadeLabel(m);
    // 3.204.0: a boss's paint, a pulsing laser from it to you until it lands; the mark itself, red brackets around you.
    for(const e of g.enemies)if(liveMarkIntent(e)&&p.hp>0){const a=this.projectActor(e),b=this.projectActor(p);c.globalAlpha=.55+.45*Math.sin(time/90);this.line(a.x,a.y,b.x,b.y,'#ff3b3b',1.5);this.box(b.x-2,b.y-2,4,4,'#ff6a6a');c.globalAlpha=1;}
    if(p.hp>0&&designated(p)){const r=t*.47;for(const [dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){this.line(pos.x+dx*r,pos.y+dy*r,pos.x+dx*(r-6),pos.y+dy*r,'#ff5a5a',1.5);this.line(pos.x+dx*r,pos.y+dy*r,pos.x+dx*r,pos.y+dy*(r-6),'#ff5a5a',1.5);}}
    if(this.mode==='pet'&&this.aim){const a=this.project(this.aim.x,this.aim.y);this.box(a.x-t*.42,a.y-t*.42,t*.84,t*.84,'#7fd8b52a','#9cedca');this.text('指令',a.x,a.y+4,'#a9f3d5',10);}
    if(this.mode==='drone'&&this.aim){for(const q of droneCells(g)){const a=this.project(q.x,q.y);this.box(a.x-t*.4,a.y-t*.4,t*.8,t*.8,'#7fd8b50f','#7fd8b566');}const a=this.project(this.aim.x,this.aim.y);this.box(a.x-t*.42,a.y-t*.42,t*.84,t*.84,'#7fd8b53a','#9cedca');this.text(tx('renderer.deploy'),a.x,a.y+4,'#a9f3d5',10);}
    // Grapple preview (3.47.1): the tile the berserker or the pulled enemy lands on before the strike.
    const hook=this.targetingEnabled?this.grapplePreview:null;if(hook){const a=this.project(hook.from.x,hook.from.y),b=this.project(hook.point.x,hook.point.y);c.setLineDash([4,4]);this.line(a.x,a.y,b.x,b.y,'#e6c07a99',1.5);c.setLineDash([]);this.box(b.x-t*.42,b.y-t*.42,t*.84,t*.84,'#e6c07a24','#f0cf8a');this.text(hook.dash?tx('renderer.charge'):tx('renderer.pull'),b.x,b.y+4,'#ffe0a3',10);}
    const target=this.targetingEnabled?g.targeted:null;if(target){const lamp=isLamp(target),a=lamp?this.lampPoint(target):this.projectActor(target),r=lamp?Math.max(9,t*.2):t*.43;for(const [dx,dy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){this.line(a.x+dx*r,a.y+dy*r,a.x+dx*(r-7),a.y+dy*r,'#f1b07c',1.5);this.line(a.x+dx*r,a.y+dy*r,a.x+dx*r,a.y+dy*(r-7),'#f1b07c',1.5);}}
  }
}
