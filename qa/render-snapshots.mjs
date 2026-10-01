// Render and UI snapshots (3.206.3): the proof a behaviour-neutral change to the renderer or the browser controller
// (src/renderer*.js, src/controller*.js) draws and shows exactly what it did before. The node checks (npm test, the save
// fuzz, the identity baseline) never run either of them.
// A separate headless Chrome (its own temp profile, DevTools protocol, no packages) opens this checkout in test mode
// (?test=1), served by its own `node server.mjs` on a free port unless --base names a running server. With Math.random,
// Date and randomUUID pinned, Google Fonts blocked and the service worker bypassed:
// - canvas: scenes staged through window.__ashSim (map, props, lighting, fog, each boss telegraph, smoke fields in both
//   qualities, fire, vents, aim modes, effects, the target card...) drawn by hand at a fixed time with the animation loop
//   paused, each recorded as a hash of the canvas pixels (drawn twice: a scene that is not stable fails at once);
// - dom: the HTML of key screens reached by clicking through the real UI (title, settings tabs, deployment, the run's
//   HUD, a move, a shot, pack tabs, map, log, journal, manual, keys, deck editor, terminal, the comms strip, a descent,
//   a boss intro's control lock).
// Page errors (exceptions, console.error) are recorded too.
//   node qa/render-snapshots.mjs --out <file>                  record
//   node qa/render-snapshots.mjs --out <file> --against <old>  ...and list every scene or screen that differs (exit 1)
//   node qa/render-snapshots.mjs --only canvas|dom             one half while iterating; --base http://localhost:5174
//   node qa/render-snapshots.mjs --out <file> --png <dir>        also save each canvas scene as a picture, to look at
// Hashes depend on the machine's Chrome and fonts: compare two runs on the same machine, never commit them.
// docs/CHECKLIST.md section 1 says when to run it.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';

const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const OUT=arg('out',null),AGAINST=arg('against',null),ONLY=arg('only',null),BASE_ARG=arg('base',null),PNG=arg('png',null);
const CHROME=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise(ok=>{const s=createServer();s.listen(0,()=>{const {port}=s.address();s.close(()=>ok(port));});});
if(!OUT){console.log('usage: node qa/render-snapshots.mjs --out <file> [--against <old>] [--only canvas|dom] [--base <url>]');process.exit(2);}

// Pinned before any page script runs: the same dice, clock and ids every load, and every page error kept.
const SHIM=`(()=>{let s=20260930;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
 const FIXED=Date.UTC(2026,8,30,4,0,0),D=Date;class FD extends D{constructor(...a){super(...(a.length?a:[FIXED]));}static now(){return FIXED;}}globalThis.Date=FD;
 let n=0;if(globalThis.crypto)crypto.randomUUID=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
 matchMedia=(orig=>q=>q.includes('prefers-reduced-motion')?{matches:false,media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}:orig(q))(matchMedia.bind(window));
})();`;

// In-page helpers for the canvas scenes. Every scene builds its own game, points the live renderer at it, and draws one
// frame by hand; the controller's own game is not touched.
const LIB=`(async()=>{window.__rsSeed=v=>{let s=v>>>0;Math.random=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};};window.__rs=await (async()=>{
 const E=await import('./src/engine.js'),{MAP_FIELDS}=await import('./src/map-geometry.js'),{grantTrait}=await import('./src/traits.js');
 const R=__ashSim.renderer,T=100000;
 R.isPaused=()=>true;   // the loop keeps asking for frames but draws nothing
 function arena(o={}){
  const g=new E.Game(o.seed??475,[],0,o.character||'soldier','onyx',o.mission||'extraction',{facilityFaction:o.faction||'loyalist'});
  for(const k of MAP_FIELDS)delete g[k];g.mapGenerations=[1];g.grid=Array.from({length:E.SIZE},()=>Array(E.SIZE).fill(1));
  for(let i=0;i<E.SIZE;i++){g.grid[0][i]=0;g.grid[E.SIZE-1][i]=0;g.grid[i][0]=0;g.grid[i][E.SIZE-1]=0;}
  for(let x=3;x<9;x++)g.grid[6][x]=0;   // a wall run, for wall art and occlusion
  g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
  for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];
  g.lightModel=undefined;g.lamps=undefined;g.vents=undefined;g.fires=undefined;g.flares=[];g.glowsticks=[];
  Object.assign(g.player,{x:10,y:10});g.start={x:5,y:5};g.end={x:20,y:20};g.reveal();return g;
 }
 function floor(faction,level,seed=1,character='soldier',mission='extraction'){const g=new E.Game(seed,[],0,character,'onyx',mission,{facilityFaction:faction});g.floor=level;g.loadFloor();return g;}
 function enemy(g,type,x,y,o={}){
  const e=E.makeEnemy(type,x,y,'s'+g.enemies.length,o.floor??3,0,o.faction||'loyalist');e.hp=e.maxHp=o.hp??200;
  for(const a of o.affixes||[]){E.giveEnemyAffix(e,a);e.affixes.find(x=>x.id===a).revealed=true;}
  Object.assign(e,structuredClone(o.state||{}));e.alert=o.alert??true;g.enemies.push(e);g.reveal();return e;
 }
 const hex=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 function reset(g){
  Object.assign(R,{game:g,mode:null,aim:null,placeItem:null,ropeItem:null,effects:[],gore:[],kia:null,extraction:null,pace:null,shakes:[],shift:null,glitches:[],glitchState:{},grapplePreview:null,rangeFlash:null,zoom:1,targetingEnabled:true,smokeQuality:'layers',movementBoundaries:false,boundaryOpacity:80,glitchEnabled:true,kiaZoom:1,sceneFocus:null,time:T});
  R.objectGlitches.clear();R.callouts=new R.callouts.constructor();R.splatter?.reset();R.corpses?.reset();   // a fresh board: its sequence numbers place the bubbles; corpses: 3.211.0
 }
 // Draw one frame at a fixed time: camera settled from scratch, the dice reseeded, the glitch pass included.
 function frame(time){R.resize();R.cameraScene=null;R.zoomState=null;R.updateCamera(16);R.draw(time);if(R.glitchEnabled)R.glitchFrame();}
 async function shot(g,setup,{at=0}={}){
  // Three times: a cache that follows the scene a frame late (the smoke field's masks) settles on the second; the
  // third must match it. The dice are reseeded for the set-up (addEffects rolls the glitches) and for the frame.
  const out=[];
  for(let i=0;i<3;i++){reset(g);g.reveal();__rsSeed(5);await setup?.(R,g);__rsSeed(7);frame(T+at);out.push(await hex(pixels(R.canvas)));}
  if(out[1]!==out[2])throw Error('unstable scene: '+out.join(' '));
  return out[2];
 }
 async function map(g){const c=document.createElement('canvas');c.width=300;c.height=300;reset(g);g.reveal();__rsSeed(7);R.drawMap(c);return hex(pixels(c));}
 // A generated floor with a feature in it (the first faction, floor and seed that has one), the player a few tiles off.
 function feature(test,seeds=4){
  for(let seed=1;seed<=seeds;seed++)for(const faction of ['loyalist','rebel','swarm','legacy'])for(let level=1;level<=6;level++){
   let g;try{g=floor(faction,level,seed);}catch{continue;}
   const q=test(g);if(!q)continue;
   const spot=[[2,0],[0,2],[-2,0],[0,-2],[1,1],[-1,-1],[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:q.x+dx,y:q.y+dy})).find(p=>g.grid[p.y]?.[p.x]===1&&!g.solid(p.x,p.y)&&!g.enemies.some(e=>e.hp>0&&e.x===p.x&&e.y===p.y));
   if(!spot)continue;Object.assign(g.player,spot);g.seen=g.grid.map(r=>r.map(()=>true));g.reveal();return g;
  }
  throw Error('no floor has this feature');
 }
 // 3.211.0: an action played as the game shows it — the presentation plan's events (falls with their blows, callouts)
 // handed to the renderer at their own times — and the time of the first fall, so a scene can be drawn after the kill.
 const P=await import('./src/presentation.js');
 function play(g,act){g.effects=[];const {success,steps}=P.captureAction(g,act);g.effects=[];if(!success)throw Error('the action was refused');const events=P.planPresentation(steps).events.map(e=>({time:e.time,effects:e.effects}));return {events,fall:events.find(e=>e.effects.some(f=>f.type==='fall'))?.time??0};}
 function replay(R,events){for(const ev of events){R.time=T+ev.time;R.addEffects(structuredClone(ev.effects),0);}R.time=T;}
 // A weapon in hand by id (a melee weapon in the pack when there is room), for the melee kills.
 function wield(g,id){const slot=g.addWeapon(E.WEAPONS.findIndex(w=>w.id===id));if(slot===false)throw Error('no room for '+id);g.player.weapon=slot;return g;}
 return {E,R,T,arena,floor,enemy,grantTrait,shot,map,reset,feature,play,replay,wield};
})();})()`;

// Canvas scenes: name → async body with L (the helpers above) in scope; it returns a hash. Effects are cloned for each
// draw, because the renderer marks the ones it has drawn (fx.shooterSeen, a callout bubble's glitch clock).
const at=(x,y)=>`{x:${x},y:${y}}`;
const CANVAS={
 'floor-loyalist-1':`const g=L.floor('loyalist',1,1);return L.shot(g);`,
 'floor-loyalist-1-far':`const g=L.floor('loyalist',1,1);return L.shot(g,R=>{R.zoom=.65;});`,
 'floor-rebel-2':`const g=L.floor('rebel',2,2);return L.shot(g);`,
 'floor-swarm-4':`const g=L.floor('swarm',4,3);return L.shot(g);`,
 'floor-legacy-5':`const g=L.floor('legacy',5,4);return L.shot(g);`,
 'floor-boss-3':`const g=L.floor('loyalist',3,1);const b=g.enemies.find(e=>/designator|gunline/.test(e.type));if(b){const q=[[0,4],[4,0],[0,-4],[-4,0],[3,3]].map(([dx,dy])=>({x:b.x+dx,y:b.y+dy})).find(q=>g.grid[q.y]?.[q.x]===1&&!g.solid(q.x,q.y));if(q)Object.assign(g.player,q);}return L.shot(g);`,
 'floor-flashlight':`const g=L.floor('loyalist',2,5);g.player.flashlight=true;return L.shot(g);`,
 'floor-movement-bounds':`const g=L.floor('loyalist',1,1);return L.shot(g,R=>{R.movementBoundaries=true;R.boundaryOpacity=60;});`,
 'floor-no-targeting':`const g=L.floor('rebel',2,2);const e=g.visibleEnemies[0];if(e)g.target=e.id;return L.shot(g,R=>{R.targetingEnabled=false;});`,
 'floor-druid':`const g=L.floor('swarm',1,6,'druid');return L.shot(g);`,
 'floor-engineer':`const g=L.floor('loyalist',1,7,'engineer');return L.shot(g);`,
 'floor-survival':`const g=L.floor('loyalist',1,8,'soldier','survival');return L.shot(g);`,
 'map-loyalist-1':`return L.map(L.floor('loyalist',1,1));`,
 'map-swarm-4':`return L.map(L.floor('swarm',4,3));`,
 'killhouse':`return L.shot(__ashSim.game);`,
 'target-card':`const g=L.arena(),e=L.enemy(g,'rifleman',13,10);g.target=e.id;return L.shot(g);`,
 'aiming-rifleman':`const g=L.arena(),e=L.enemy(g,'rifleman',14,10,{state:{charge:true,windup:1,aim:${at(10,10)}}});return L.shot(g);`,
 // 3.209.0: in the black, unseen, the aim line goes to the tile it holds its aim on (a blinded squad's report), not to you.
 'aim-held-unseen':`const g=L.arena();g.lighting=g.grid.map(r=>r.map(()=>0));g.lightModel=2;g.lamps=[];g.glowsticks=[${at(15,11)}];L.enemy(g,'rifleman',15,10,{state:{charge:true,windup:1,aim:${at(12,13)}}});return L.shot(g);`,
 'mark-laser':`const g=L.arena({faction:'loyalist'}),e=L.enemy(g,'designator',15,10,{faction:'loyalist',state:{markIntent:{since:0}}});return L.shot(g,null,{at:37});`,
 'designated':`const g=L.arena({faction:'loyalist'});L.enemy(g,'designator',15,10,{faction:'loyalist'});L.grantTrait(g.player,'designated','boss:mark');return L.shot(g);`,
 'gun-set':`const g=L.arena({faction:'loyalist'});L.enemy(g,'gunline',14,10,{faction:'loyalist',state:{gun:{stage:'set',origin:${at(14,10)},aim:${at(10,10)}},special:'mark'}});return L.shot(g);`,
 'gun-sweep':`const g=L.arena({faction:'loyalist'});L.enemy(g,'gunline',14,10,{faction:'loyalist',state:{gun:{stage:'sweep',origin:${at(14,10)},aim:${at(10,10)},left:2},special:'mark'}});return L.shot(g);`,
 'burn-set':`const g=L.arena({faction:'rebel'});L.enemy(g,'burnline',14,10,{faction:'rebel',state:{burn:{stage:'set',origin:${at(14,10)},aim:${at(10,10)}},special:'mark'}});return L.shot(g);`,
 'burn-sweep':`const g=L.arena({faction:'rebel'});L.enemy(g,'burnline',14,10,{faction:'rebel',state:{burn:{stage:'sweep',origin:${at(14,10)},aim:${at(10,10)},left:2},special:'mark'}});return L.shot(g);`,
 'charge-lane':`const g=L.arena({faction:'swarm'});L.enemy(g,'hive_beast',15,10,{faction:'swarm',state:{chargeIntent:{origin:${at(15,10)},dir:{x:-1,y:0}},chargeCooldown:1}});return L.shot(g,null,{at:120});`,
 'egg-sac':`const g=L.arena({faction:'swarm'});L.enemy(g,'hive_matriarch',15,12,{faction:'swarm',state:{nestIntent:${at(12,12)},nestCooldown:1}});return L.shot(g,null,{at:250});`,
 'tongue':`const g=L.arena({faction:'swarm'});L.enemy(g,'hive_beast',14,10,{faction:'swarm',state:{tongueIntent:{origin:${at(14,10)},target:${at(10,10)},point:${at(13,10)}},tongueCooldown:1}});return L.shot(g);`,
 'fire-wall':`const g=L.arena({faction:'rebel'});L.enemy(g,'arsonist',15,10,{faction:'rebel',state:{fireIntent:{kind:'wall',origin:${at(15,10)},cells:[${at(12,9)},${at(12,10)},${at(12,11)}]},special:'ring'}});return L.shot(g,null,{at:90});`,
 'fire-ring':`const g=L.arena({faction:'rebel'});L.enemy(g,'arsonist',15,10,{faction:'rebel',state:{fireIntent:{kind:'ring',origin:${at(15,10)},cells:[${at(9,9)},${at(10,9)},${at(11,9)},${at(9,10)},${at(11,10)},${at(9,11)},${at(10,11)}],center:${at(10,10)},gaps:[${at(11,11)}]},special:'wall',heat:2}});return L.shot(g,null,{at:90});`,
 'arsonist-heat':`const g=L.arena({faction:'rebel'});L.enemy(g,'arsonist',14,10,{faction:'rebel',state:{heat:2}});L.enemy(g,'arsonist',14,12,{faction:'rebel',state:{overheat:2}});return L.shot(g,null,{at:300});`,
 'flamer-cone':`const g=L.arena();L.enemy(g,'rifleman',14,10,{affixes:['flamer'],state:{flameIntent:{origin:${at(14,10)},aim:${at(10,10)}}}});return L.shot(g);`,
 'grenadier':`const g=L.arena();L.enemy(g,'raider',14,10,{affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:${at(14,10)}}}});return L.shot(g);`,
 'lockdown':`const g=L.arena();L.enemy(g,'rifleman',14,10,{affixes:['lockdown'],state:{lockIntent:{origin:${at(14,10)},tile:${at(10,11)}}}});return L.shot(g);`,   // 3.213.0
 'smoke-layers':`const g=L.arena();for(const [kind,x,y] of [['smoke',11,8],['toxic',14,11],['spore',8,12],['haze',12,13],['steam',7,8]])g.smoke.push({kind,expires:g.turn+3,cells:[${at('x','y')},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}]});g.reveal();return L.shot(g,R=>{R.smokeQuality='layers';},{at:500});`,
 'smoke-baked':`const g=L.arena();for(const [kind,x,y] of [['smoke',11,8],['toxic',14,11],['spore',8,12],['haze',12,13],['steam',7,8]])g.smoke.push({kind,expires:g.turn+3,cells:[${at('x','y')},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1}]});g.reveal();return L.shot(g,R=>{R.smokeQuality='baked';},{at:500});`,
 'fire':`const g=L.arena();g.fires=[{x:12,y:9,age:1},{x:13,y:9,age:2},{x:12,y:10,age:3},{x:9,y:12,age:1}];return L.shot(g,null,{at:210});`,
 'vents':`const g=L.arena();g.vents=[{id:'v1',kind:'smoke',phase:0,x:12,y:9},{id:'v2',kind:'steam',phase:6,x:8,y:12},{id:'v3',kind:'toxic',phase:5,x:13,y:12}];return L.shot(g,null,{at:160});`,
 'field-gear':`const g=L.arena();g.mines=[${at(11,12)}];g.decoy={x:12,y:8,hp:3,expires:g.turn+4};g.flares=[{x:8,y:9,expires:g.turn+3}];g.glowsticks=[${at(13,12)}];return L.shot(g,null,{at:400});`,
 'hazard-marks':`const g=L.arena();g.marks=[{x:12,y:12,due:g.turn+2,kind:'enemy'},{x:8,y:8,due:g.turn+1,kind:'ally'}];g.reinforcements=[{x:14,y:8,due:g.turn+3}];return L.shot(g);`,
 'aim-grenade':`const g=L.arena();return L.shot(g,R=>{R.mode='grenade';R.aim=${at(13,11)};});`,
 'aim-flare':`const g=L.arena();return L.shot(g,R=>{R.mode='flare';R.aim=${at(12,12)};});`,
 'aim-blind':`const g=L.arena();return L.shot(g,R=>{R.mode='blind';R.aim=${at(13,10)};});`,
 'aim-decoy':`const g=L.arena();L.enemy(g,'rifleman',14,11);return L.shot(g,R=>{R.mode='place';R.placeItem='decoy';R.aim=${at(12,11)};});`,
 'aim-mine':`const g=L.arena();return L.shot(g,R=>{R.mode='place';R.placeItem='mine';R.aim=${at(11,10)};});`,
 'aim-glowstick':`const g=L.arena();return L.shot(g,R=>{R.mode='place';R.placeItem='glowstick';R.aim=${at(11,11)};});`,
 'aim-suppress':`const g=L.arena();return L.shot(g,R=>{R.mode='suppress';R.aim=${at(13,10)};});`,
 'aim-rope':`const g=L.arena();return L.shot(g,R=>{R.mode='rope';R.ropeItem='escape_line';R.aim=${at(10,13)};});`,
 'aim-launch':`const g=L.arena();return L.shot(g,R=>{R.mode='launch';R.aim=${at(13,12)};});`,
 'shotgun-cone':`const g=L.arena();const slot=g.addWeapon(L.E.WEAPONS.findIndex(w=>w.id==='shotgun'));if(slot!==false)g.player.weapon=slot;const e=L.enemy(g,'rifleman',13,10);L.enemy(g,'rifleman',12,11);g.target=e.id;return L.shot(g);`,
 'effects-fire':`const g=L.arena(),e=L.enemy(g,'rifleman',13,10,{hp:30});g.target=e.id;g.action('fire');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:80});`,
 'effects-late':`const g=L.arena(),e=L.enemy(g,'rifleman',13,10,{hp:30});g.target=e.id;g.action('fire');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:330});`,
 'effects-grenade':`const g=L.arena();L.enemy(g,'rifleman',13,12,{hp:20});L.enemy(g,'rifleman',14,12,{hp:20});const ok=g.action('grenade',${at(13,12)});const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:260});`,
 'effects-move':`const g=L.arena();L.enemy(g,'rifleman',15,12);g.effects=[];g.action('move',[1,0]);const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:70});`,
 'range-flash':`const g=L.arena();L.enemy(g,'rifleman',19,10);return L.shot(g,R=>{R.flashRange();},{at:40});`,
 'glitch-burst':`const g=L.arena();L.enemy(g,'rifleman',13,10,{affixes:['fast']});return L.shot(g,R=>{R.glitchBurst({amp:4,ms:400});},{at:120});`,
 'extraction-beam':`const g=L.arena();return L.shot(g,R=>{R.extraction={start:R.time-900,at:${at(10,10)}};});`,
 'corpses-items':`const g=L.floor('loyalist',1,1);const p=g.player;for(const e of g.enemies.slice(0,4)){e.hp=0;e.x=p.x+1+g.enemies.indexOf(e)%2;e.y=p.y+(g.enemies.indexOf(e)<2?-1:1);}g.items.push({type:'ammo',x:p.x-1,y:p.y,amount:12},{type:'med',x:p.x,y:p.y+1,amount:1});return L.shot(g);`,
 'elite-suppressed-stunned':`const g=L.arena();L.enemy(g,'rifleman',13,9,{state:{elite:true}});L.enemy(g,'rifleman',13,11,{state:{suppression:3}});L.enemy(g,'raider',8,11,{state:{control:{disabled:2}}});const d=L.enemy(g,'rifleman',11,12,{state:{elite:true}});d.hp=0;L.enemy(g,'rifleman',8,9,{state:{keycard:true}});return L.shot(g,null,{at:700});`,
 'boss-turn-swarm':`const g=L.arena({faction:'swarm'});L.enemy(g,'hive_beast',15,10,{faction:'swarm'});L.enemy(g,'hive_matriarch',15,13,{faction:'swarm'});g.effects=[];g.action('wait');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:180});`,
 'boss-turn-rebel':`const g=L.arena({faction:'rebel'});L.enemy(g,'arsonist',14,10,{faction:'rebel',state:{heat:3}});L.enemy(g,'burnline',14,13,{faction:'rebel'});g.effects=[];g.action('wait');g.action('wait');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:180});`,
 'boss-turn-loyalist':`const g=L.arena({faction:'loyalist'});L.enemy(g,'designator',15,10,{faction:'loyalist'});L.enemy(g,'gunline',15,13,{faction:'loyalist'});g.effects=[];g.action('wait');g.action('wait');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:180});`,
 'flamethrower':`const g=L.arena(),slot=g.addWeapon(L.E.WEAPONS.findIndex(w=>w.id==='flamer'));if(slot!==false)g.player.weapon=slot;L.enemy(g,'rifleman',13,10,{hp:40});g.effects=[];g.action('launch',${at(13,10)});const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:200});`,
 'feature-pit':`const g=L.feature(g=>{for(let y=1;y<g.grid.length-1;y++)for(let x=1;x<g.grid.length-1;x++)if(g.grid[y][x]===1&&[[1,0],[0,1],[-1,0],[0,-1]].some(([dx,dy])=>g.grid[y+dy][x+dx]===L.E.VOID))return {x,y};return null;});return L.shot(g);`,
 'feature-vault':`const g=L.feature(g=>{const b=g.barriers.find(b=>b.vault);return b&&{x:Math.floor(b.x),y:Math.floor(b.y)};});return L.shot(g);`,
 'feature-terminal':`const g=L.feature(g=>g.props.find(o=>o.type==='terminal'));return L.shot(g);`,
 'feature-hazard':`const g=L.feature(g=>g.hazards.find(h=>h.type!=='fire'));return L.shot(g,null,{at:300});`,
 'feature-fixed-fire':`const g=L.feature(g=>g.hazards.find(h=>h.type==='fire'));return L.shot(g,null,{at:300});`,
 'feature-nest':`const g=L.feature(g=>g.props.find(o=>o.type==='nest'));return L.shot(g);`,
 'feature-lamps':`const g=L.feature(g=>g.lamps?.[0]);if(g.lamps[1])g.lamps[1].hp=0;return L.shot(g);`,
 'feature-exit':`const g=L.feature(g=>g.exitPoint);return L.shot(g,null,{at:450});`,
 'feature-module':`const g=L.feature(g=>g.props.find(o=>o.type==='module'));return L.shot(g);`,
 'callout':`const g=L.arena(),e=L.enemy(g,'rifleman',13,10);g.effects=[];g.enemyCallout(e,'telegraph',{action:'aim'});const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:200});`,
 // 3.207.0 delisted operatives (src/delisted-operatives.js): each class in its class art, the soldier's scan, the recon's
 // warned smoke and its cloud, the engineer's drones, the berserker's grapple, the ninja hidden, as noise and in haze,
 // the bodies, and the last words over one.
 'op-soldier-scan':`const g=L.arena({faction:'loyalist'}),e=L.enemy(g,'delisted_soldier',14,10,{faction:'loyalist',state:{code:'R-0317'}});g.effects=[];g.enemyAct(e);const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:150});`,
 'op-recon-smoke':`const g=L.arena({faction:'loyalist'});L.enemy(g,'delisted_recon',15,10,{faction:'loyalist',state:{code:'R-0317',smokeIntent:{origin:${at(15,10)},point:${at(12,10)}},smokeCooldown:7}});return L.shot(g,null,{at:120});`,
 'op-recon-cloud':`const g=L.arena({faction:'loyalist'}),e=L.enemy(g,'delisted_recon',15,10,{faction:'loyalist',state:{code:'R-0317',smokeIntent:{origin:${at(15,10)},point:${at(13,10)}},smokeCooldown:7}});g.effects=[];g.enemyAct(e);const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:500});`,
 'op-engineer':`const g=L.arena({faction:'loyalist'});L.enemy(g,'delisted_engineer',15,10,{faction:'loyalist',state:{code:'R-0317',droneCooldown:2}});L.enemy(g,'drone',15,9,{faction:'loyalist',state:{id:'s0-drone-0'}});L.enemy(g,'munition',13,12,{faction:'loyalist',hp:10,state:{id:'s0-drone-1'}});return L.shot(g);`,
 'op-berserker-grapple':`const g=L.arena({faction:'rebel'});L.enemy(g,'delisted_berserker',14,10,{faction:'rebel',state:{code:'R-0317',tongueIntent:{origin:${at(14,10)},target:${at(10,10)},point:${at(13,10)}},tongueCooldown:1}});return L.shot(g);`,
 'op-ninja-hidden':`const g=L.arena({faction:'rebel'});L.enemy(g,'delisted_ninja',14,10,{faction:'rebel',state:{code:'R-0317'}});return L.shot(g);`,
 'op-ninja-noise':`const g=L.arena({faction:'rebel'});L.enemy(g,'delisted_ninja',13,10,{faction:'rebel',state:{code:'R-0317',decloaked:true}});return L.shot(g,null,{at:210});`,
 'op-ninja-haze':`const g=L.arena({faction:'rebel'});g.smoke.push({kind:'haze',expires:g.turn+2,cells:[${at(14,10)},${at(15,10)},${at(14,11)},${at(15,11)}]});L.enemy(g,'delisted_ninja',14,10,{faction:'rebel',state:{code:'R-0317'}});return L.shot(g,null,{at:500});`,
 'op-classes':`const g=L.arena({faction:'loyalist'});['soldier','recon','engineer','berserker','ninja'].forEach((c,i)=>L.enemy(g,'delisted_'+c,8+i*2,13,{faction:'loyalist',state:{code:'R-0317',decloaked:true}}));['soldier','recon','engineer','berserker','ninja'].forEach((c,i)=>{const e=L.enemy(g,'delisted_'+c,8+i*2,8,{faction:'loyalist',state:{code:'R-0317'}});e.hp=0;});return L.shot(g,null,{at:300});`,
 'op-last-words':`const g=L.arena({faction:'loyalist'}),e=L.enemy(g,'delisted_soldier',13,10,{faction:'loyalist',hp:1,state:{code:'R-0317'}});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});g.effects=[];g.action('fire');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:1200});`,
 // 3.210.0: your own stealth on your sprite (src/actor-visuals.js stealthLook): the recon under 訊號斷層 nearly gone with a
 // bright outline, the ninja under its camouflage half there with the same outline; the ninja's hook blade — the pull's
 // preview to the tile beside the locked enemy, and the line reeling it in mid-strike; a hit the bulwark's plates took whole.
 'stealth-recon':`const g=L.arena({character:'recon'});g.player.skillState.signal_break={remaining:3,cooldown:6};L.enemy(g,'rifleman',14,11);return L.shot(g);`,
 'stealth-ninja':`const g=L.arena({character:'ninja'});g.player.skillState.camouflage={remaining:4,cooldown:0};const e=L.enemy(g,'rifleman',13,10);g.target=e.id;return L.shot(g,R=>{R.grapplePreview={from:${at(10,10)},point:${at(12,10)},dash:true,hook:true};});`,
 'hook-blade':`const g=L.arena({character:'ninja'});g.player.weapon=g.player.owned[0];g.player.skillState.camouflage={remaining:4,cooldown:0};const e=L.enemy(g,'rifleman',14,10,{hp:500});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});g.enemyAct=()=>{};g.effects=[];const at0=g.turn;g.action('fire');if(g.turn!==at0+1)throw Error('no hook');const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:110});`,
 // 3.211.0 (docs/MELEE_CLASSES.md 天誅, docs/KILL_GORE.md 近戰的甩出血光、屍體圖層): Tenchu from range and through an
 // adjacent enemy, each with its shout; melee kills flinging their gore (a slash's arc to the kill's side, a heavy axe's
 // wider one, a spear's line, a chainsaw's spray) mid-swing and once it has landed, with the body on the corpse layer; a
 // rifle kill to compare; a point-blank shotgun and a grenade throwing the body (the grenade's against a wall); bodies
 // laid down from their ids (no fall known).
 'tenchu-range':`const g=L.arena({character:'ninja'});g.player.weapon=g.player.owned[0];g.player.skillState.camouflage={remaining:4,cooldown:0};const e=L.enemy(g,'rifleman',14,10,{hp:500});L.enemy(g,'rifleman',12,10,{hp:500});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:160});`,
 'tenchu-through':`const g=L.arena({character:'ninja'});g.player.weapon=g.player.owned[0];g.player.skillState.camouflage={remaining:4,cooldown:0};const e=L.enemy(g,'rifleman',11,10,{hp:500});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('usePrepared',{category:'skill'}));if(g.player.x!==12)throw Error('no swap');return L.shot(g,R=>L.replay(R,k.events),{at:200});`,
 'kill-rifle':`const g=L.arena(),e=L.enemy(g,'rifleman',13,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+150});`,
 'kill-katana':`const g=L.arena({character:'ninja'});g.player.weapon=g.player.owned[0];const e=L.enemy(g,'rifleman',11,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+110});`,
 'kill-katana-rest':`const g=L.arena({character:'ninja'});g.player.weapon=g.player.owned[0];const e=L.enemy(g,'rifleman',11,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+1500});`,
 'kill-axe':`const g=L.arena({character:'berserker'});g.player.weapon=g.player.owned.find(s=>L.E.WEAPONS[g.player.weaponBases[s]]?.id==='axe')??g.player.owned[0];const e=L.enemy(g,'brute',10,11,{hp:30});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+110});`,
 'kill-axe-rest':`const g=L.arena({character:'berserker'});g.player.weapon=g.player.owned.find(s=>L.E.WEAPONS[g.player.weaponBases[s]]?.id==='axe')??g.player.owned[0];const e=L.enemy(g,'brute',10,11,{hp:30});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+1500});`,
 'kill-spear':`const g=L.wield(L.arena(),'spear'),e=L.enemy(g,'rifleman',11,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+140});`,
 'kill-spear-rest':`const g=L.wield(L.arena(),'spear'),e=L.enemy(g,'rifleman',11,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+1500});`,
 'kill-chainsaw':`const g=L.wield(L.arena(),'chainsaw'),e=L.enemy(g,'raider',11,10,{hp:40,faction:'swarm'});g.target=e.id;g.rng=Object.assign(()=>.5,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+260});`,
 'kill-shotgun-point-blank':`const g=L.wield(L.arena(),'shotgun'),e=L.enemy(g,'rifleman',11,10,{hp:20});g.target=e.id;g.rng=Object.assign(()=>0,{state:()=>1});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});const k=L.play(g,()=>g.action('fire'));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+1500});`,
 'kill-grenade-wall':`const g=L.arena();for(let y=7;y<=12;y++)g.grid[y][15]=0;g.reveal();L.enemy(g,'rifleman',13,10,{hp:20});L.enemy(g,'rifleman',14,11,{hp:20});const k=L.play(g,()=>g.action('grenade',${at(13,11)}));return L.shot(g,R=>L.replay(R,k.events),{at:k.fall+1500});`,
 'corpses-rest-poses':`const g=L.arena();[[12,9],[13,10],[11,12],[8,11],[9,8],[14,13]].forEach(([x,y],i)=>{const e=L.enemy(g,i%2?'raider':'rifleman',x,y,{state:i===2?{elite:true}:{}});e.hp=0;});g.items.push({type:'ammo',x:13,y:10,amount:12},{type:'med',x:11,y:12,amount:1});return L.shot(g);`,
 'bulwark-plates-hit':`const g=L.arena({character:'bulwark'}),e=L.enemy(g,'rifleman',13,10);g.effects=[];g.damagePlayer(30,'qa',e);const fx=g.effects;g.effects=[];return L.shot(g,R=>{R.addEffects(structuredClone(fx),0);},{at:260});`,
};

// Screens reached through the real UI; each step returns the HTML to keep (or nothing).
const DOM_STEPS=[
 ['title',`return H('#modal');`],
 ['title-settings',`click('[data-modal="settings"]');await wait(200);return H('#modal');`],
 ...['general','display','sound','controls'].map(tab=>['title-settings-'+tab,`click('[data-settings-tab="${tab}"]');await wait(150);return H('#modal');`]),
 ...['unlocks','help','about','killhouse'].map(m=>['title-'+m,`document.querySelector('#modal').close();await wait(100);__rsIntro();await wait(100);openModal('${m}');await wait(200);return H('#modal');`]),
 ['deploy-gate',`click('[data-modal="close"]')||document.querySelector('#modal').close();await wait(100);__rsIntro();await wait(150);click('[data-modal="deploy"]');await wait(200);return H('#modal');`],
 ['deploy',`click('[data-modal="khSkip"]');await wait(200);return H('#modal');`],
 ['deploy-mission',`click('[data-modal="deployNormal"]');await wait(200);return H('#modal');`],
 ['deploy-operator',`document.querySelector('input[name="mission"]').click();click('[data-modal="deployOperator"]');await wait(200);return H('#modal');`],
 ['deploy-difficulty',`document.querySelector('input[name="character"][value="soldier"]').click();click('[data-modal="deployDifficulty"]');await wait(200);return H('#modal');`],
 ['run-start',`click('[data-modal="new"]');await wait(600);return H('#modal')+H('.tactical-panel');`],
 ['run-hud',`for(let i=0;i<4&&document.querySelector('#modal').open;i++){click('#modal [data-modal="close"]')||click('#modal [data-modal="enter"]')||click('#modal button');await wait(250);}return H('.tactical-panel')+H('.control-deck')+H('#target-card')+H('#level');`],
 ['run-move',`const g=__ashSim.game,p=g.player;for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]])if(g.passable(p.x+dx,p.y+dy)){__ashSim.act('move',[dx,dy]);break;}await settle();return H('.tactical-panel')+H('#field-messages');`],
 ['run-fire',`const g=__ashSim.game,p=g.player,e=g.enemies.find(e=>e.hp>0&&!e.boss);const spot=[[3,0],[-3,0],[0,3],[0,-3],[2,0],[-2,0],[0,2],[0,-2]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(o=>o.hp>0&&o.x===q.x&&o.y===q.y)&&(Object.assign(e,q),g.reveal(),g.visibleEnemies.includes(e)));
   g.target=e.id;__ashSim.update();await wait(100);click('[data-action="fire"]');await settle();return H('.tactical-panel')+H('#target-card');`],
 ['run-settings',`click('[data-action="settings"]');await wait(200);return H('#modal');`],
 ...['general','display','sound','controls','run'].map(tab=>['run-settings-'+tab,`click('[data-settings-tab="${tab}"]');await wait(150);return H('#modal');`]),
 ['run-pack',`document.querySelector('#modal').close();await wait(100);click('[data-action="bag"]');await wait(200);return H('#modal');`],
 ['run-pack-tabs',`let out='';for(const b of [...document.querySelectorAll('[data-inventory-tab]')].map(b=>b.dataset.inventoryTab)){click('[data-inventory-tab="'+b+'"]');await wait(120);out+=H('#modal');}return out;`],
 ['run-weapons',`document.querySelector('#modal').close();await wait(100);click('[data-action="weapons"]');await wait(200);return H('#modal');`],
 ['run-map',`document.querySelector('#modal').close();await wait(100);click('[data-action="map"]');await wait(300);const c=document.querySelector('#modal canvas');return H('#modal')+(c?'<!--canvas '+c.width+'x'+c.height+' '+(await __rsHash(c))+'-->':'');`],
 ...['log','mission','journal','help','hotkeys','deckEditor'].map(m=>['run-'+m,`document.querySelector('#modal').close();await wait(100);openModal('${m}');await wait(200);return H('#modal');`]),
 ['run-terminal',`document.querySelector('#modal').close();await wait(100);const g=__ashSim.game,term=g.props.find(o=>o.type==='terminal'&&!o.used);if(!term)return 'no terminal';
   const spot=[[0,1],[1,0],[0,-1],[-1,0]].map(([dx,dy])=>({x:term.x+dx,y:term.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.hp>0&&e.x===q.x&&e.y===q.y));Object.assign(g.player,spot);g.reveal();__ashSim.update();await wait(100);
   click('[data-action="interact"]');await wait(250);let out=H('#modal');const pick=document.querySelector('#modal [data-context^="terminal"]');if(pick){pick.click();await wait(250);out+=H('#modal');}
   const deal=document.querySelector('#modal [data-terminal-pick]');if(deal){deal.click();await wait(200);out+=H('#modal');}return out;`],
 ['comms-strip',`document.querySelector('#modal').close();await wait(100);__ashComms.say('QA 通訊測試');await wait(700);return H('.comms-layer');`],
 ['run-descend',`const g=__ashSim.game,x=g.exitPoint;const spot=[[0,1],[1,0],[0,-1],[-1,0],[0,0]].map(([dx,dy])=>({x:x.x+dx,y:x.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.hp>0&&e.x===q.x&&e.y===q.y));
   Object.assign(g.player,spot);g.reveal();__ashSim.update();await wait(100);click('[data-action="interact"]');await wait(250);let out=H('#modal');const go=document.querySelector('#modal [data-context="descend"]');if(go){go.click();await settle();}
   for(let i=0;i<3&&document.querySelector('#modal').open;i++){out+=H('#modal');click('#modal [data-modal="close"]')||click('#modal button');await wait(300);}return out+'floor '+__ashSim.game.floor+H('#level');`],
 ['boss-intro',`return await __rsBoss();`],
 ['operative-intro',`return 'operative';`],   // 3.207.0: a delisted operative's two-line intro (operativeIntro below)
 ['swarm-card',`return 'swarm';`],   // 3.208.0: a swarm unit's traits on the target card and in the database (swarmCard below)
];

// Helpers for the screens, loaded again after every page load. The build number is written as BUILD so a version
// bump between two runs is not a difference.
const DOM_HELPERS=`(async()=>{const {VERSION}=await import('./src/version.js');
 window.H=s=>{const e=document.querySelector(s);return e?e.outerHTML.split(VERSION).join('BUILD'):'(none '+s+')';};
 window.click=s=>{const e=document.querySelector(s);if(!e)return false;e.click();return true;};window.wait=ms=>new Promise(r=>setTimeout(r,ms));
 window.settle=async()=>{for(let i=0;i<60;i++){await wait(100);if(!document.querySelector('.control-deck button[disabled]')||i>30)break;}await wait(300);};
 window.__rsIntro=()=>{const b=document.querySelector('#modal [data-modal="intro"]');if(b)b.click();};
 // A screen opened the way its menu button opens it: a button with that data-modal, through the controller's click handler.
 window.openModal=name=>{const b=document.createElement('button');b.dataset.modal=name;document.body.append(b);b.click();b.remove();};
 window.__rsHash=async c=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);})()`;

async function cdp(port){
 const dir=await mkdtemp(join(tmpdir(),'ash-render-'));
 const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${port}`,`--user-data-dir=${dir}`,'--hide-scrollbars','--no-first-run','--no-default-browser-check','--window-size=390,844','about:blank'],{stdio:'ignore'});
 let target;for(let i=0;i<60&&!target;i++){await sleep(250);try{target=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='page');}catch{}}
 if(!target)throw Error('Chrome did not start');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let seq=0;const pending=new Map(),errors=[];
 ws.onmessage=m=>{const d=JSON.parse(m.data);
  if(d.id&&pending.has(d.id)){const {ok,no}=pending.get(d.id);pending.delete(d.id);d.error?no(Error(d.error.message)):ok(d.result);return;}
  if(d.method==='Runtime.exceptionThrown')errors.push('exception: '+(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text).split('\n')[0]);
  if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error')errors.push('console.error: '+d.params.args.map(a=>a.value??a.description).join(' ').split('\n')[0]);
 };
 const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;pending.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 return {send,evaluate,errors,close:async()=>{ws.close();chrome.kill();await sleep(500);await rm(dir,{recursive:true,force:true}).catch(()=>{});}};
}

async function startServer(){
 const port=await freePort(),server=spawn(process.execPath,['server.mjs'],{cwd:ROOT,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const base=`http://localhost:${port}`;
 for(let i=0;i<80;i++){await sleep(250);try{if((await fetch(base+'/src/version.js')).ok)return {base,stop:()=>server.kill()};}catch{}}
 server.kill();throw Error('dev server did not start');
}

const server=BASE_ARG?{base:BASE_ARG.replace(/\/$/,''),stop:()=>{}}:await startServer();
const {send,evaluate,errors,close}=await cdp(await freePort());
const result={canvas:{},dom:{},errors:[]};
async function load(){
 await send('Page.navigate',{url:server.base+'/?test=1'});
 for(let i=0;i<80;i++){await sleep(250);if(await evaluate(`Boolean(window.__ashSim&&!document.body.classList.contains('booting'))`).catch(()=>false))break;}
 await sleep(800);
}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*fonts.googleapis.com*','*fonts.gstatic.com*']});
 await send('Network.setBypassServiceWorker',{bypass:true});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:SHIM});
 await send('Page.navigate',{url:server.base+'/?test=1'});await sleep(1500);
 await evaluate(`localStorage.clear();localStorage.setItem('qa-ash-language','zh-TW');`);
 if(ONLY!=='dom'){
  await load();
  await evaluate(`__ashSim.start({mode:'tutorial'})`);await sleep(800);
  await evaluate(LIB);
  // Draw every scene once and let the lazily loaded sheets (fx, smoke fields) arrive before anything is recorded.
  for(let pass=0;pass<2;pass++){
   for(const [name,body] of Object.entries(CANVAS)){
    try{const h=await evaluate(`(async()=>{const L=__rs,R=L.R;${body}})()`);if(pass)result.canvas[name]=h;
     if(pass&&PNG){const url=await evaluate(name.startsWith('map-')?`''`:`__rs.R.canvas.toDataURL('image/png')`);if(url){await mkdir(PNG,{recursive:true});await writeFile(join(PNG,name+'.png'),Buffer.from(url.split(',')[1],'base64'));}}}
    catch(error){if(pass)result.canvas[name]='ERROR '+String(error.message).split('\n')[0];}
   }
   if(!pass){for(let i=0;i<40;i++){await sleep(250);if(await evaluate(`[...performance.getEntriesByType('resource')].length`)===await (sleep(500).then(()=>evaluate(`[...performance.getEntriesByType('resource')].length`))))break;}await sleep(500);}
  }
  console.log(`canvas: ${Object.keys(result.canvas).length} scenes`);
 }
 if(ONLY!=='canvas'){
  await evaluate(`localStorage.clear();localStorage.setItem('qa-ash-language','zh-TW');`);
  await load();await evaluate(DOM_HELPERS);
  for(const [name,body] of DOM_STEPS){
   if(name==='boss-intro'){result.dom[name]=await bossIntro();continue;}
   if(name==='operative-intro'){result.dom[name]=await operativeIntro();continue;}
   if(name==='swarm-card'){result.dom[name]=await swarmCard();continue;}
   try{result.dom[name]=await evaluate(`(async()=>{${body}})()`);}catch(error){result.dom[name]='ERROR '+String(error.message).split('\n')[0];}
  }
  console.log(`dom: ${Object.keys(result.dom).length} screens`);
 }
 result.errors=[...errors];
}finally{await close();server.stop();}

// A boss intro locks the controls: a campaign save on a boss floor with the boss in view, continued from the title
// screen; then waits until the officer's line starts the scene, and records the lock. The save is written from another
// page of the same origin, since leaving the game saves the run in progress over it.
async function bossIntro(){
 const save=await evaluate(`(async()=>{const E=await import('./src/engine.js');const g=new E.Game(1,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});g.floor=3;g.loadFloor();
  const b=g.enemies.find(e=>/designator|gunline/.test(e.type));const spots=[];for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid.length;x++)if(g.grid[y][x]===1&&!g.solid(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&E.distance({x,y},b)>=3&&E.distance({x,y},b)<=5)spots.push({x,y});
  const spot=spots.find(q=>{Object.assign(g.player,q);g.reveal();return g.visibleEnemies.includes(b);})||spots[0];
  Object.assign(g.player,spot,{hp:900,maxHp:900});b.alert=true;g.reveal();return g.serialize();})()`);
 await send('Page.navigate',{url:server.base+'/manifest.webmanifest'});await sleep(800);
 await evaluate(`localStorage.setItem('qa-ash-save',${JSON.stringify(save)})`);
 await load();await evaluate(DOM_HELPERS);
 return evaluate(`(async()=>{click('[data-modal="enter"]');await wait(300);let tries=0;
  // Poll right after each wait: the officer's line is captured as it comes up, before its own timer closes it.
  while(!__ashSim.bossScene&&tries<6){__ashSim.act('wait');tries++;for(let i=0;i<60&&!__ashSim.bossScene;i++)await wait(50);}
  const s=__ashSim.bossScene,refused=__ashSim.act('wait')===false;
  return JSON.stringify({scene:s?{kind:s.kind,at:s.at}:null,tries,refused,modal:document.querySelector('#modal').open,deck:[...document.querySelectorAll('.control-deck button')].map(b=>b.disabled?1:0).join('')})+H('.comms-layer');})()`).catch(error=>'ERROR '+error.message);
}

// 3.207.0: a delisted operative's intro is two lines (its serial, then its class), and the controls stay locked through
// both: a save on a loyalist floor 6 whose boss post the draw gave to a soldier (src/operative-draw.js's QA hook, in the
// page that writes the save), the operative in view. Records the first line, then the second once it has replaced it.
async function operativeIntro(){
 const save=await evaluate(`(async()=>{const E=await import('./src/engine.js'),D=await import('./src/operative-draw.js');D.setOperativeDraw(()=>'soldier');
  const g=new E.Game(1,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});g.floor=6;g.loadFloor();D.setOperativeDraw(null);
  const b=g.enemies.find(e=>e.type==='delisted_soldier');const spots=[];for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid.length;x++)if(g.grid[y][x]===1&&!g.solid(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&E.distance({x,y},b)>=3&&E.distance({x,y},b)<=5)spots.push({x,y});
  const spot=spots.find(q=>{Object.assign(g.player,q);g.reveal();return g.visibleEnemies.includes(b);})||spots[0];
  Object.assign(g.player,spot,{hp:900,maxHp:900});b.alert=true;g.reveal();return g.serialize();})()`);
 await send('Page.navigate',{url:server.base+'/manifest.webmanifest'});await sleep(800);
 await evaluate(`localStorage.setItem('qa-ash-save',${JSON.stringify(save)})`);
 await load();await evaluate(DOM_HELPERS);
 return evaluate(`(async()=>{click('[data-modal="enter"]');await wait(300);let tries=0;
  while(!__ashSim.bossScene&&tries<6){__ashSim.act('wait');tries++;for(let i=0;i<60&&!__ashSim.bossScene;i++)await wait(50);}
  const s=__ashSim.bossScene,first=H('.comms-layer'),line=()=>document.querySelector('.comms-layer .comms-line')?.textContent||'';const was=line();
  for(let i=0;i<200&&line()===was;i++)await wait(50);
  const second=H('.comms-layer'),refused=__ashSim.act('wait')===false,held=Boolean(__ashSim.bossScene);
  return JSON.stringify({scene:s?{kind:s.kind,at:s.at}:null,tries,refused,held,deck:[...document.querySelectorAll('.control-deck button')].map(b=>b.disabled?1:0).join('')})+first+second;})()`).catch(error=>'ERROR '+error.message);
}

// 3.208.0: the swarm's own traits where traits are listed — a hunter bug on the target card (近戰壓制 2 階) and the
// hostile database as a swarm facility lists its cards (蟲群幼體 · 敏捷 · 近戰壓制 1 階). A save of a swarm floor 1 with
// a hunter bug two tiles off, continued from the title screen. With --png, a picture of the screen with the card.
async function swarmCard(){
 const save=await evaluate(`(async()=>{const E=await import('./src/engine.js');const g=new E.Game(1,[],0,'soldier','onyx','extraction',{facilityFaction:'swarm'}),p=g.player;
  const spot=[[2,0],[-2,0],[0,2],[0,-2],[3,0],[-3,0],[0,3],[0,-3]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.solid(q.x,q.y)&&!g.enemies.some(e=>e.hp>0&&e.x===q.x&&e.y===q.y)&&g.shotClear(p,q));
  const e=g.spawnEnemy('crawler',spot.x,spot.y,'qa-hunter');g.enemies.push(e);g.target=e.id;g.reveal();return g.serialize();})()`);
 await send('Page.navigate',{url:server.base+'/manifest.webmanifest'});await sleep(800);
 await evaluate(`localStorage.setItem('qa-ash-save',${JSON.stringify(save)})`);
 await load();await evaluate(DOM_HELPERS);
 const card=await evaluate(`(async()=>{click('[data-modal="enter"]');await wait(400);for(let i=0;i<4&&document.querySelector('#modal').open;i++){click('#modal [data-modal="close"]')||click('#modal button');await wait(250);}
  const g=__ashSim.game;g.target='qa-hunter';__ashSim.update();await wait(200);return H('#target-card');})()`).catch(error=>'ERROR '+error.message);
 if(PNG){const shot=await send('Page.captureScreenshot',{format:'png'});await mkdir(PNG,{recursive:true});await writeFile(join(PNG,'swarm-card.png'),Buffer.from(shot.data,'base64'));}
 const book=await evaluate(`(async()=>{openModal('bestiary');await wait(250);return H('#modal');})()`).catch(error=>'ERROR '+error.message);
 return card+book;
}

await writeFile(OUT,JSON.stringify(result,null,1));
const bad=Object.entries(result.canvas).filter(([,h])=>String(h).startsWith('ERROR'));
for(const [name,h] of bad)console.log(`canvas ${name}: ${h}`);
if(result.errors.length)console.log('page errors:\n  '+result.errors.join('\n  '));
let same=true;
if(AGAINST){
 const old=JSON.parse(await readFile(AGAINST,'utf8'));
 for(const part of ['canvas','dom'])for(const name of new Set([...Object.keys(old[part]||{}),...Object.keys(result[part])])){
  if(ONLY&&ONLY!==part||!Object.keys(old[part]||{}).length||!Object.keys(result[part]).length)continue;   // a half one of the runs skipped
  const a=result[part][name],b=old[part]?.[name];if(a===b)continue;same=false;
  if(part==='canvas'||typeof a!=='string'||typeof b!=='string'){console.log(`${part} ${name}: now ${a} was ${b}`);continue;}
  let i=0;while(i<a.length&&a[i]===b[i])i++;
  console.log(`dom ${name} differs at ${i}:\n  now …${a.slice(Math.max(0,i-80),i+160)}\n  was …${b.slice(Math.max(0,i-80),i+160)}`);
 }
 if(!ONLY&&JSON.stringify(old.errors)!==JSON.stringify(result.errors)){same=false;console.log('page errors differ from',AGAINST);}
 console.log(same?`identical to ${AGAINST}: ${Object.keys(result.canvas).length} canvas scenes, ${Object.keys(result.dom).length} screens`:`DIFFERS from ${AGAINST}`);
}
process.exit(same&&!bad.length?0:1);
