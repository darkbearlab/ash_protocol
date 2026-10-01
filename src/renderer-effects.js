// Effects and the top layers (3.206.3 split): effects as they arrive and in flight (shots, bursts, flame bursts,
// muzzle flashes, boss moments), the extraction beam, signal interference, callout bubbles, the range flash and the
// overlays drawn over the walls.
// Methods of Renderer (src/renderer.js), which copies them onto Renderer.prototype (src/mixin.js, 3.206.3): `this` is
// the renderer, `this.game` the state being drawn and `this.ctx` the canvas.
import {liveImpulses,shakeImpulses} from './screen-shake.js';
import {bubbleGlitch,drawGlitched,drawGlitchedBox,effectGlitches,liveGlitches,screenGlitch,screenStrength,stateGlitches} from './signal-glitch.js';
import {CHARGE_VISUAL,EGG_VISUAL,REBEL_FIRE_VISUAL,TONGUE_VISUAL,VENOM_VISUAL,tongueVisual} from './enemy-visuals.js';
import {CalloutBoard,DIRECTION_ARROWS,bubbleAlpha,bubbleText,edgePoint} from './callout-ui.js';
import {NEST_ATLAS,drawPortalEffect,drawNestEffect} from './nest-art.js';
import {isDark} from './lighting.js';
import {burstLife,enemyBurst,hitBurst,meleeFling,corpseTrail} from './gore.js';
import {CORPSE_TUNING} from './corpse-layer.js';
import {MUZZLE_FLASHES,flashCells,flashUnit,muzzlePoint} from './muzzle-flash.js';
import {SIZE,distance} from './engine.js';
import {VOID} from './data.js';
import {fxSheet} from './fx-sprites.js';
   // t is the tile size in the draw code
import {DARK_ACTOR_BRIGHTNESS} from './actor-visuals.js';
import {drawBurstAir} from './gore-art.js';
import {drawKiaAir} from './kia-art.js';
// The extraction beam's phases, in ms (3.195.0, user's timing): a hair-thin beam comes slowly down, splits into the beam and
// its halo and widens to one tile, holds (the operative is gone halfway), narrows back to a hair, and breaks into motes.
export const EXTRACTION_BEAM=Object.freeze({descend:800,expand:400,hold:600,contract:400,dissolve:800,thin:1.5,get vanish(){return this.descend+this.expand+this.hold/2;},get total(){return this.descend+this.expand+this.hold+this.contract+this.dissolve;}});
// 3.165.0: the range flash is two quick flashes of this length with this gap between them. 3.165.1 (user: 太搶眼了):
// thinner, faster and fainter — a hint, not a highlight.
const RANGE_FLASH=Object.freeze({ms:90,gap:70,alpha:.45,width:1});
export const itemGlitchKey=i=>`item:${i.type}:${i.x},${i.y}`;
// 3.210.0: a hit the plates took whole shows its number in the plates' steel blue, so the bulwark sees each hit land.
const PLATE_NUMBER='#9cc8e6';
export class RendererEffects {
  // Callout bubbles (3.76.4): drawn last so they sit above walls. A visible line follows its speaker while it stays
  // visible; a heard line only knows a direction, so it hugs that screen edge with an arrow and never marks a tile.
  drawCallouts(time){
    const c=this.ctx,g=this.game;(this.callouts??=new CalloutBoard()).dropOtherFloors(g.floor);const items=this.callouts.active(time);if(!items.length)return;   // dropOtherFloors: 3.207.0, last words stay on their floor
    c.save();c.font='10px monospace';c.textAlign='center';
    for(const item of items){
      const e=item.event,visible=e.visibility==='visible',text=visible?bubbleText(item):`${DIRECTION_ARROWS[e.direction]||''} ${bubbleText(item)}`;
      let x,y;
      if(visible){
        // Follow the speaker, alive or fallen, while its tile is visible (3.84.2): a unit that speaks, moves and dies in one turn
        // used to leave its bubble on the tile where it spoke.
        // 3.207.0: last words stay over the body where it fell, and are not silenced by the fall that brought them.
        const own=e.speaker==='player',speaker=own?g.player:e.lastWords?null:g.enemies.find(a=>a.id===e.actorId),shown=own||speaker&&(speaker.hp>0?g.visibleEnemies.includes(speaker):g.visible(speaker)),p=shown?this.projectActor(speaker):this.project(e.position.x,e.position.y);x=p.x;y=p.y-this.tile*.62;
        if(speaker&&speaker.hp<=0)this.callouts.silence(item,time);}
      else ({x,y}=edgePoint(e.direction,this.w,this.h));
      const w=Math.ceil(c.measureText(text).width)+10,h=15,left=Math.max(2,Math.min(this.w-w-2,x-w/2)),top=Math.max(2,Math.min(this.h-h-2,y-h));
      const border=e.speaker==='player'?this.operatorColor:e.lastWords?'#b8aca0':e.priority==='high'?'#f2a85c':e.priority==='medium'?'#9fd9c8':'#9aa59a';
      const ink=e.speaker==='player'?'#f4f7ef':e.lastWords?'#efe9df':e.priority==='high'?'#ffd7a8':'#e3eee6',tail=visible?Math.round(x)-2:null;
      // this.ctx, not c: under a glitch the drawing goes to a scratch canvas first (src/signal-glitch.js drawGlitchedBox).
      const draw=()=>{const k=this.ctx;k.font='10px monospace';k.textAlign='center';this.box(left,top,w,h,'#101a17e6',border);if(tail!==null)this.box(tail,top+h,4,3,border);k.fillStyle=ink;k.fillText(text,left+w/2,top+11);};
      c.globalAlpha=bubbleAlpha(item,time);
      const gl=this.glitchEnabled&&bubbleGlitch(item,time);if(gl)drawGlitchedBox(this,{left,top,w,h:h+3},draw,gl,time);else draw();
    }
    c.restore();
  }
  // 3.165.0 (user request): a shot refused for range outlines, in yellow, every tile the player could shoot from here —
  // within the weapon's range with a clear line of fire — and flashes it twice, quickly.
  flashRange(){
    const g=this.game,p=g.player,range=g.weapon?.range||0,cells=new Set();
    for(let y=Math.max(0,p.y-range);y<=Math.min(SIZE-1,p.y+range);y++)for(let x=Math.max(0,p.x-range);x<=Math.min(SIZE-1,p.x+range);x++){
      const q={x,y};if((x===p.x&&y===p.y)||distance(p,q)<=range&&(g.grid[y][x]===1||g.grid[y][x]===VOID)&&g.shotClear(p,q))cells.add(`${x},${y}`);
    }   // your own tile is inside, so no ring is drawn around you
    this.rangeFlash={start:this.time,cells};
  }
  drawRangeFlash(){
    const f=this.rangeFlash;if(!f)return;const age=this.time-f.start;if(age>=RANGE_FLASH.ms*2+RANGE_FLASH.gap){this.rangeFlash=null;return;}
    if(age%(RANGE_FLASH.ms+RANGE_FLASH.gap)>=RANGE_FLASH.ms)return;
    const c=this.ctx,t=this.tile,has=(x,y)=>f.cells.has(`${x},${y}`);c.save();c.globalAlpha*=RANGE_FLASH.alpha;c.strokeStyle='#ffd84a';c.lineWidth=RANGE_FLASH.width;c.lineCap='square';c.beginPath();
    for(const k of f.cells){const [x,y]=k.split(',').map(Number),a=this.project(x,y),l=a.x-t/2,tp=a.y-t/2;
      if(!has(x,y-1)){c.moveTo(l,tp);c.lineTo(l+t,tp);}if(!has(x,y+1)){c.moveTo(l,tp+t);c.lineTo(l+t,tp+t);}
      if(!has(x-1,y)){c.moveTo(l,tp);c.lineTo(l,tp+t);}if(!has(x+1,y)){c.moveTo(l+t,tp);c.lineTo(l+t,tp+t);}}
    c.stroke();c.restore();
  }
  // The swarm bosses' moments: dust down a charge's path and a burst where it hits the wall, a puff where a body was
  // knocked aside, and the sac splitting (or crushed) as it hatches.
  swarmBossEffect(fx,a,b,elapsed){
    const g=this.game,t=this.tile,c=this.ctx;
    if(fx.kind==='rush'&&elapsed<450&&(g.visible(fx.from)||g.visible(fx.to))){c.globalAlpha=1-elapsed/450;const n=Math.max(1,Math.round(Math.hypot(b.x-a.x,b.y-a.y)/(t*.5)));for(let i=0;i<=n;i++){const k=i/n,r=2+((i*7)%3);this.box(Math.round(a.x+(b.x-a.x)*k+((i*13)%7-3))-r/2,Math.round(a.y+(b.y-a.y)*k+((i*11)%7-3))-r/2,r,r,CHARGE_VISUAL.dust);}
      if(fx.crash&&fx.dir&&elapsed<300){const w=this.project(fx.to.x+fx.dir.x*.5,fx.to.y+fx.dir.y*.5);c.globalAlpha=1;this.effectSprite('impact',w,32);}}
    else if(fx.kind==='shove'&&elapsed<300&&g.visible(fx.to)){c.globalAlpha=1-elapsed/300;for(let i=0;i<6;i++){const th=i*1.05,r=4+elapsed/300*t*.3;this.box(Math.round(b.x+Math.cos(th)*r)-1,Math.round(b.y+Math.sin(th)*r)-1,3,3,CHARGE_VISUAL.dust);}}
    else if((fx.kind==='hatch'||fx.kind==='eggLost')&&elapsed<420&&g.visible(fx.to)){c.globalAlpha=1-elapsed/420;for(let i=0;i<8;i++){const th=i*.785,r=3+elapsed/420*t*.4;this.box(Math.round(b.x+Math.cos(th)*r)-1,Math.round(b.y+Math.sin(th)*r)-1,3,3,fx.kind==='hatch'?EGG_VISUAL.sac:EGG_VISUAL.vein);}}
    else if(fx.kind==='charge'&&elapsed<260&&g.visible(fx.from)){c.globalAlpha=1-elapsed/260;this.box(a.x-t*.45,a.y-t*.45,t*.9,t*.9,CHARGE_VISUAL.fill,CHARGE_VISUAL.chevron);}
  }
  // The rebel bosses' moments: steam bursting off an arsonist as it overheats; a hot flash on a boss as it warns fire.
  rebelBossEffect(fx,a,b,elapsed){
    const g=this.game,t=this.tile,c=this.ctx,V=REBEL_FIRE_VISUAL;
    if(fx.kind==='overheat'&&elapsed<600&&g.visible(fx.from)){c.globalAlpha=1-elapsed/600;for(let i=0;i<10;i++){const th=i*.628,r=4+elapsed/600*t*.55;this.box(Math.round(a.x+Math.cos(th)*r)-2,Math.round(a.y+Math.sin(th)*r)-2,4,4,V.steam);}}
    else if((fx.kind==='wall'||fx.kind==='ring'||fx.kind==='burn')&&elapsed<260&&g.visible(fx.from)){c.globalAlpha=1-elapsed/260;this.box(a.x-t*.45,a.y-t*.45,t*.9,t*.9,V.fill,V.line);}
  }
  // 3.203.0: the flamethrower's burst (Codex's flame-burst.png, drawn facing east) on every tile the spray reached that you
  // can see, turned to the spray's direction about the tile's centre and played once, four frames in 600 ms (inside the
  // effect's 650 ms); without the sheet, a flicker of orange.
  flameBurst(fx,elapsed){
    const c=this.ctx,t=this.tile,g=this.game,sheet=fxSheet('flameBurst'),frame=Math.min(3,Math.floor(elapsed/150)),angle=Math.atan2(fx.to.y-fx.from.y,fx.to.x-fx.from.x),fade=frame<3?1:Math.max(0,1-(elapsed-450)/200);
    for(const q of fx.cells||[]){
      if(!g.visible(q))continue;
      const a=this.project(q.x,q.y);
      if(sheet){c.save();c.globalAlpha=fade;c.translate(a.x,a.y);c.rotate(angle);c.imageSmoothingEnabled=false;c.drawImage(sheet.img,frame*sheet.cell,0,sheet.cell,sheet.cell,-t/2,-t/2,t,t);c.restore();}
      else{c.globalAlpha=fade;this.glow(a.x,a.y,t*.6,'#ff8a3a55');this.box(a.x-t*.2,a.y-t*.2,t*.4,t*.4,frame%2?'#ffb45a88':'#ff7a3a88');}
    }
  }
  // 3.194.0 (user): extraction, in the keycard's light (keyBeam). 3.195.0 (user): a hair-thin beam comes slowly down on the
  // operative; only when it lands does it split into the beam and a halo that is always a little wider; the beam opens to
  // exactly one tile, holds while the operative goes, closes back to a hair and then breaks into motes that go out one
  // after another. controller.endRun sets `extraction` ({start, at}) and darkens only after EXTRACTION_BEAM.total.
  extractedAt(time){return Boolean(this.extraction&&time-this.extraction.start>=EXTRACTION_BEAM.vanish);}
  extractionBeam(time){
    const x=this.extraction,T=EXTRACTION_BEAM,el=time-x.start;if(el<0||el>T.total)return;
    const c=this.ctx,t=this.tile,a=this.project(x.at.x,x.at.y),foot=a.y+t*.3,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>v*v*(3-2*v);
    const landed=T.descend,opened=landed+T.expand,held=opened+T.hold,closed=held+T.contract;
    c.save();c.globalCompositeOperation='lighter';
    if(el<closed){
      const bottom=el<landed?foot*ease(clamp(el/landed)):foot;
      const main=el<landed?T.thin:el<opened?T.thin+(t-T.thin)*ease((el-landed)/T.expand):el<held?t:t-(t-T.thin)*ease((el-held)/T.contract);
      const split=el<landed?0:clamp(Math.min((el-landed)/120,(closed-el)/120)),halo=main+2+Math.max(3,main*.3);
      if(split>0){const h=c.createLinearGradient(a.x,0,a.x,bottom);h.addColorStop(0,`rgba(255,232,150,${.03*split})`);h.addColorStop(1,`rgba(255,236,170,${.28*split})`);c.fillStyle=h;c.fillRect(a.x-halo/2,0,halo,bottom);}
      const m=c.createLinearGradient(a.x,0,a.x,bottom);m.addColorStop(0,'rgba(255,238,170,.18)');m.addColorStop(.75,'rgba(255,242,190,.6)');m.addColorStop(1,'rgba(255,250,228,.95)');c.fillStyle=m;c.fillRect(a.x-main/2,0,main,bottom);
      if(el<landed)this.glow(a.x,bottom,5,'rgba(255,246,210,.9)');
      else{const pool=(main-T.thin)/(t-T.thin);this.glow(a.x,foot,t*(.25+.45*pool)+3,`rgba(255,236,170,${.25+.3*pool})`);}
    }else{
      // The hair breaks into motes, unevenly (user: the unevenness is the point): uneven gaps and sizes, a loose
      // bottom-first order, each drifting and going out at its own pace. Hashed from the mote's index, so no RNG.
      const u=clamp((el-closed)/T.dissolve),hash=(i,k)=>((Math.imul(i+1,2654435761)^Math.imul(k+7,40503))>>>0)/4294967296;
      for(let i=0,y=foot;y>0;i++){
        const w=1+Math.floor(hash(i,2)*2.4),h=w+(hash(i,9)<.35?Math.floor(hash(i,10)*7):0);   // some motes are short streaks
        const start=clamp((foot-y)/foot*.5+hash(i,3)*.42),life=.1+hash(i,4)*.4,local=clamp((u-start)/life);
        if(local<1){const drift=local*(3+hash(i,6)*14),dx=(hash(i,7)-.5)*(1.5+local*7),glow=.3+.7*hash(i,5);
          c.fillStyle=`rgba(255,244,205,${glow*(1-local)})`;c.fillRect(Math.round(a.x+dx-w/2),Math.round(y-drift-h),w,h);}
        y-=h+1+Math.pow(hash(i,1),2.5)*24;   // mostly tight, now and then a long gap
      }
    }
    c.restore();
  }
  // Callouts go to the bubble board, timed from the moment playback reaches them; everything else is a short effect.
  // Pixel cells laid along the barrel (src/muzzle-flash.js), over the shooter's sprite. In a dark room the first frames
  // also throw a small light; it is only paint, lighting and sight rules never see it.
  muzzleFlash(fx,from,angle,elapsed){
    const t=this.tile,u=flashUnit(t),cells=flashCells(fx.flash,angle,elapsed,{unit:u,still:fx.quiet});if(!cells.length)return;
    const c=this.ctx,m=muzzlePoint(from,angle,t),alpha=c.globalAlpha,spec=MUZZLE_FLASHES[fx.flash];c.globalAlpha=1;
    if(!fx.quiet&&elapsed<spec.frameMs*2&&isDark(this.game,fx.from))this.glow(m.x,m.y,t*1.1,spec.glow+'55');
    for(const cell of cells){c.fillStyle=cell.color;c.fillRect(Math.round(m.x+cell.x-u/2),Math.round(m.y+cell.y-u/2),u,u);}
    c.globalAlpha=alpha;
  }
  addEffects(effects,elapsed=0){const start=this.time-Math.max(0,elapsed);
    // 3.175.0 kill gore (src/gore.js): a kill with a direction bursts on the far side; how much follows the setting.
    // 3.211.0 (docs/KILL_GORE.md 近戰的甩出血光): a melee kill, by anyone, flings its gore instead (src/gore.js meleeFling):
    // a slash sweeps to the kill's side, a thrust runs through, a saw sprays.
    const killSeed=e=>((this.game.seed|0)*31+(this.game.turn|0)*977+e.to.x*57+e.to.y)|0;
    for(const e of effects)if(e.type==='fall'&&e.actorType!=='player'&&e.blow&&this.gore&&this.goreLevel!=='off'){const seed=killSeed(e),o={kind:e.gore,size:e.size,elite:e.elite,level:this.goreLevel,damage:e.force?.damage},burst=e.force?.style==='melee'?meleeFling(seed,e.blow,{...o,cut:e.force.cut,heft:e.force.heft}):enemyBurst(seed,e.blow,{...o,style:e.force?.style});if(burst)this.gore.push({start,at:{x:e.to.x,y:e.to.y},burst,life:burstLife(burst)*1000});}
    // 3.211.0 (docs/KILL_GORE.md 屍體圖層): an enemy's body is thrown on the corpse layer (src/corpse-layer.js), shaking blood
    // along its path when it really flies. Off keeps the old fall; reduced motion lays it straight at rest.
    if(this.corpses)for(const e of effects)if(e.type==='fall'&&e.enemy&&e.actorId!=null){const g=this.game,seed=killSeed(e);this.corpses.use(`${g.seed}:${g.floor}`,this.goreLevel==='off');
      const body=this.corpses.fall(e,start,this.corpseWorld(),{side:(seed>>>4)&1?1:-1,flat:this.goreLevel==='off',still:this.reduceMotion});
      if(body&&body.dist>=CORPSE_TUNING.slump&&this.gore&&this.goreLevel!=='off'&&!this.reduceMotion){const trail=corpseTrail(seed,body,{kind:e.gore,size:e.size,level:this.goreLevel});if(trail)this.gore.push({start,at:{x:e.to.x,y:e.to.y},burst:trail,life:burstLife(trail)*1000});}}
    // 3.176.0 hit gore: a small spray for every harmful hit a body lives through.
    for(const e of effects)if(e.type==='impact'&&e.hit?.blow&&this.gore&&this.goreLevel!=='off'){const g=this.game,seed=((g.seed|0)*37+(g.turn|0)*1009+e.to.x*61+e.to.y*7+this.gore.length)|0,burst=hitBurst(seed,e.hit.blow,{kind:e.hit.gore,size:e.hit.size,level:this.goreLevel,style:e.hit.force?.style,damage:e.damage});if(burst)this.gore.push({start,at:{x:e.to.x,y:e.to.y},burst,life:burstLife(burst)*1000});}for(const e of effects)if(e.type==='callout')(this.callouts??=new CalloutBoard()).add(e,start);this.effects.push(...effects.filter(e=>e.type!=='callout').map(e=>({...e,time:start})));this.effects=this.effects.slice(-64);const kicks=shakeImpulses(effects,this.game.player,start);if(this.shakeEnabled)this.shakes=[...liveImpulses(this.shakes,this.time),...kicks].slice(-24);
    if(this.glitchEnabled){const r=effectGlitches(effects,this.game,start,kicks);this.glitches=[...liveGlitches(this.glitches,this.time),...r.screen].slice(-24);for(const o of r.objects)this.objectGlitches.set(o.key,o);if(r.hit)this.onPlayerHit?.();}}
  // 3.149.0 signal interference: the state-driven glitches, then the whole-frame one.
  glitchFrame(){
    const g=this.game,visible=[...g.visibleEnemies.map(e=>e.id),...g.props.filter(o=>o.id&&o.hp!==0&&g.visible(o)).map(o=>o.id),...g.items.filter(i=>g.visible(i)).map(itemGlitchKey)];
    const r=stateGlitches(this.glitchState,g,this.time,{enemies:g.visibleEnemies,keys:visible});
    this.glitches=[...liveGlitches(this.glitches,this.time),...r.screen];for(const o of r.objects)this.objectGlitches.set(o.key,o);
    screenGlitch(this.canvas,screenStrength(this.glitches,this.time),this.dpr,this.time);
  }
  glitchBurst({amp,ms}){if(this.glitchEnabled)this.glitches.push({start:this.time,duration:ms,amp});}
  // Draws one object, through the glitch while it has one.
  glitchDraw(a,key,draw){
    const gl=this.glitchEnabled&&this.objectGlitches.get(key);
    if(!gl||this.time<gl.start){draw();return;}
    if(this.time-gl.start>=gl.duration){this.objectGlitches.delete(key);draw();return;}
    drawGlitched(this,a,draw,gl,this.time);
  }
  // Effects in flight (3.206.3, from Renderer.draw): shots, bursts, telegraph flashes and labels, then dust motes,
  // gore in the air and the fallen operative's scene.
  drawEffects(time){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    const goreShade=(x,y)=>isDark(g,{x:Math.round(x),y:Math.round(y)})?DARK_ACTOR_BRIGHTNESS:1;   // as drawActors' stains
    for(const fx of this.effects) {
      if(fx.type==='move'||fx.type==='callout'||fx.type==='cameraHold'||fx.type==='pickup')continue;
      const elapsed=time-fx.time-(fx.delay||0),age=elapsed/650;if(age<0||age>1)continue;
      const a=this.project(fx.from.x,fx.from.y),b=this.project(fx.to.x,fx.to.y),color=fx.color||(fx.type==='shot'?'#ffe1ad':'#ff986c');
      c.globalAlpha=1-age;
      const angle=Math.atan2(b.y-a.y,b.x-a.x),step=Math.floor(age*8)/8;
      // 3.116.0 (user decision): a flash only for a shooter the player can see, judged once per shot on the state it came from.
      const shot=fx.type==='shot'||fx.type==='enemyShot';
      if(shot&&fx.flash){fx.shooterSeen??=fx.type==='enemyShot'?g.visibleEnemies.some(e=>e.x===fx.from.x&&e.y===fx.from.y):g.visible(fx.from);if(fx.shooterSeen)this.muzzleFlash(fx,a,angle,elapsed);}
      if(fx.type==='flame'){this.flameBurst(fx,elapsed);c.globalAlpha=1;continue;}   // 3.203.0
      if(fx.type==='flameTelegraph'){c.globalAlpha=1;continue;}   // its cone is drawn from the game state
      if(fx.type==='bossTelegraph'){if(fx.kind==='marked'&&elapsed<320){c.globalAlpha=1-elapsed/320;this.line(a.x,a.y,b.x,b.y,'#ff5a5a',2.5);this.box(b.x-t*.45,b.y-t*.45,t*.9,t*.9,'#ff3b3b33','#ff6a6a');}else{this.swarmBossEffect(fx,a,b,elapsed);this.rebelBossEffect(fx,a,b,elapsed);}c.globalAlpha=1;continue;}   // 3.204.0: drawn from the game state; the landing flashes
      if(fx.type==='portalSpawn'){if(g.visible(fx.to))drawPortalEffect(c,this.terrainImages?.get(NEST_ATLAS),b,t,elapsed);c.globalAlpha=1;continue;}   // 3.194.0
      if(fx.type==='nestCollapse'||fx.type==='nestSpawn'){if(g.visible(fx.type==='nestCollapse'?fx.from:fx.to))drawNestEffect(c,this.terrainImages?.get(NEST_ATLAS),fx,a,b,t,elapsed);c.globalAlpha=1;continue;}
      if(fx.quiet){
        const q=shot?a:b;
        if(age<.25&&!(shot&&fx.flash))this.box(q.x-5,q.y-5,10,10,'#ffe1ad55');
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
      }else if(fx.type==='tongueTelegraph'){
        // The persistent line comes from game state; the announcement only flashes the grabbed tile.
        const V=tongueVisual(fx);if(g.visible(fx.from)&&elapsed<260)this.box(b.x-t*.45,b.y-t*.45,t*.9,t*.9,V.fill,V.edge);   // 3.207.0: a grapple in steel
      }else if(fx.type==='tonguePull'){
        if(g.visible(fx.origin)||g.visible(fx.to)){const o=this.project(fx.origin.x,fx.origin.y),k=Math.min(1,elapsed/220),q={x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};const V=tongueVisual(fx);this.line(o.x,o.y,q.x,q.y,V.flesh,3);this.box(q.x-3,q.y-3,6,6,V.tip);}
      }else if(fx.style==='venom'){
        const travel=fx.travel||130,offset=(fx.spread||0)+(fx.missPath?.35:0),end={x:b.x+Math.cos(angle+1.57)*t*offset,y:b.y+Math.sin(angle+1.57)*t*offset};
        if(elapsed<travel){const progress=elapsed/travel,q={x:a.x+(end.x-a.x)*progress,y:a.y+(end.y-a.y)*progress-Math.sin(progress*Math.PI)*t*.25};this.box(q.x-3,q.y-3,6,6,VENOM_VISUAL.blob,VENOM_VISUAL.rim);this.box(q.x-Math.cos(angle)*7-1,q.y-Math.sin(angle)*7-1,2,2,VENOM_VISUAL.blob);}
        else if(!fx.miss&&!fx.missPath)for(let i=0;i<6;i++){const theta=i*1.05,r=3+step*12;this.box(Math.round(end.x+Math.cos(theta)*r)-1,Math.round(end.y+Math.sin(theta)*r)-1,2,2,VENOM_VISUAL.drop);}
      }else if(fx.style==='claw'||fx.style==='slash'){
        if(elapsed<(fx.travel||80))this.effectSprite(fx.style,b,32,angle);
      }else if(elapsed<(fx.travel||125)){
        const progress=Math.min(1,elapsed/(fx.travel||125)),offset=(fx.spread||0)+(fx.missPath ? .35 : 0),end={x:b.x+Math.cos(angle+1.57)*t*offset,y:b.y+Math.sin(angle+1.57)*t*offset};
        const q={x:a.x+(end.x-a.x)*progress,y:a.y+(end.y-a.y)*progress};
        if(fx.style==='grenade'){q.y-=Math.sin(progress*Math.PI)*t*.35;this.box(q.x-3,q.y-3,6,6,color,'#e9efca');}
        else if(fx.style==='pellet')this.box(q.x-1,q.y-1,3,3,'#ffe1ad');
        else {this.line(q.x-Math.cos(angle)*(fx.style==='tracer'?18:7),q.y-Math.sin(angle)*(fx.style==='tracer'?18:7),q.x,q.y,color,fx.style==='tracer'?2:1);this.effectSprite(fx.style==='plasma'?'plasma':'bullet',q,fx.style==='tracer'?32:16,angle);}
      }
      if(fx.miss||fx.damage>0&&!this.game.realMode)this.text(fx.miss?'MISS':'−'+fx.damage,b.x,b.y-20-(fx.quiet?0:age*23),color,fx.miss?10:14);
      else if(fx.plates>0&&!this.game.realMode)this.text('−'+fx.plates,b.x,b.y-20-(fx.quiet?0:age*23),PLATE_NUMBER,14);   // 3.210.0: what the bulwark's plates took
      c.globalAlpha=1;
    }
    this.effects=this.effects.filter(e=>time-e.time<Math.max(700,e.duration||0));
    if(!this.reduceMotion)for(let i=0;i<12;i++){const x=(i*127.3+time*.003)%this.w,y=(i*83.1+Math.sin(time*.0005+i)*10)%this.h;this.box(x,y,1,1,'#c6cda733');}
    if(this.gore?.length){for(const b of this.gore)drawBurstAir(c,t,this.project(b.at.x,b.at.y),b.burst,time-b.start,false,(dx,dy)=>goreShade(b.at.x+dx,b.at.y+dy));this.gore=this.gore.filter(b=>time-b.start<b.life);}
    if(this.kia)drawKiaAir(this,time);
  }
  // The top layers (3.206.3, from Renderer.draw): the tactical overlay, corner badges, sensor contacts, the range
  // flash and callout bubbles.
  drawOverlays(time,hiddenEnemies){
    const c=this.ctx,g=this.game,t=this.tile,half=t/2,p=g.player;
    // Optional tactical overlay uses ground coordinates, above wall art for readability.
    this.drawTacticalOverlays();
    for(const e of hiddenEnemies)this.cornerBadge(this.projectActor(e));
    // Snapshot sensor UI may cross walls; it never reveals terrain or supplies.
    for(const contact of [...(g.sensorContacts||[]),...(g.petSensorContacts||[])]){const a=this.project(contact.x,contact.y);this.box(a.x-3,a.y-3,6,6,'#ffe6a5');this.box(a.x-6,a.y-6,12,12,'#00000000','#e9c27d99');}
    this.drawRangeFlash();
    this.drawCallouts(time);
  }
}
