// Captures the training course's card pictures (3.198.0, src/course-script.js) from the running dev server, with
// headless Chrome over the DevTools protocol (no packages). Each scene stages the live game through the test-mode hook
// (__ashSim, src/controller.js) and captures one or more clips; tools/course-art.py joins and writes assets/course/.
//   node server.mjs            (in another terminal: the dev server on :5173)
//   node tools/course-shots.mjs [rawDir] [scene ...]
import {spawn} from 'node:child_process';
import {mkdir,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CHROME=process.env.CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',PORT=9333,URL_BASE='http://localhost:5173/?test=1';
const [out='qa/course-shots',...only]=process.argv.slice(2);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// In-page helpers: quiet the course, stand the player somewhere, and turn tiles into screen rectangles.
const HELPERS=`window.__shot={
 g:()=>__ashSim.game,R:()=>__ashSim.renderer,
 async quiet(){for(let i=0;i<40;i++){const c=document.querySelector('.comms-layer .comms'),d=document.querySelector('[data-course-done]');if(c)c.click();if(d)d.click();await new Promise(r=>setTimeout(r,200));if(!c&&!d)break;}
  const g=this.g();g.course.fired=[...new Set([...g.course.fired,${JSON.stringify(['moved','cover','doorGo','door','box','pickup','boxDone','s2Enter','s2Lock','s2Ready','s2Windup','s2Dodge','s2Reload','s2Down','s3Before','s3See','s3Aim','s3Throw','s3All','s3Missed','s3Down','s4Enter','s4Dim','s4Black','s4Spot','s4Kill','s4Noticed','s4Clear','s5Enter','s5Scream','s5Down','s5Combat','s5Hurt','s5Clear','s6Clear','s6Elevator'])}])];g.course.beats=[];
  for(const s of ['.comms-layer','#field-messages','.effects-panel','.map-tools','.tactical-panel','.vitals-bar','.mobile-health'])document.querySelector(s)?.style.setProperty('visibility','hidden');},
 reset(){const g=this.g(),R=this.R();R.mode=null;R.aim=null;R.zoom=1;R.targetingEnabled=true;g.target=null;g.gunFlashes=[];Object.assign(g.player,{flashlight:false,lightLingers:false});__ashSim.update();},
 // A ring for the picture (tools/course-art.py draws it): around a tile, or the wind-up mark over an enemy's shoulder.
 ring(x,y,r=.55){const R=this.R(),c=R.canvas.getBoundingClientRect(),a=R.project(x,y),t=R.tile*r;return {x:c.left+a.x-t,y:c.top+a.y-t,width:t*2,height:t*2};},
 bang(e){const R=this.R(),c=R.canvas.getBoundingClientRect(),a=R.project(e.x,e.y);return {x:c.left+a.x+R.tile*.38-11,y:c.top+a.y-9-17,width:22,height:24};},
 at(x,y,target=null){const g=this.g();Object.assign(g.player,{x,y});g.reveal();g.target=target;__ashSim.update();},
 enemy(id){return this.g().enemies.find(e=>e.id===id);},
 // A screen rectangle (CSS px) covering tiles x0..x1, y0..y1 inclusive, clipped to the battlefield.
 tiles(x0,y0,x1,y1){const R=this.R(),c=R.canvas.getBoundingClientRect(),t=R.tile,a=R.project(x0,y0),b=R.project(x1,y1);
  const l=Math.max(c.left,c.left+a.x-t/2),tp=Math.max(c.top,c.top+a.y-t/2),r=Math.min(c.right,c.left+b.x+t/2),bt=Math.min(c.bottom,c.top+b.y+t/2);return {x:l,y:tp,width:r-l,height:bt-tp};},
 el(sel,pad=2){const r=document.querySelector(sel).getBoundingClientRect();return {x:r.left-pad,y:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};},
 union(...rs){const x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y)),r=Math.max(...rs.map(r=>r.x+r.width)),b=Math.max(...rs.map(r=>r.y+r.height));return {x,y,width:r-x,height:b-y};}
};`;
// Each scene stages the floor (`stage`, run once), then after the camera settles lists its clips (`clips`, page
// rectangles; `marks` on a clip become rings). `localized` scenes are captured in both languages. `steps` stage and
// capture one clip at a time (the cover chip in three states).
const S=`const s=__shot,g=s.g(),p=g.player,R=s.R();`,C=S;
const SCENES={
 move:{localized:true,stage:`${S}s.reset();s.at(3,5);`,clips:`${C}return [s.el('.direction-pad',6)];`},
 'cover-status':{steps:[
  [`${S}s.reset();Object.assign(s.enemy('kh-guard-0'),{alert:true,x:3,y:3});s.at(7,3);`,`${C}return [s.el('#status-effects > :first-child',3)];`],
  [`${S}Object.assign(s.enemy('kh-guard-0'),{alert:true,x:5,y:5});s.at(7,3);`,`${C}return [s.el('#status-effects > :first-child',3)];`],
  [`${S}Object.assign(s.enemy('kh-guard-0'),{alert:true,x:7,y:6});s.at(7,3);`,`${C}return [s.el('#status-effects > :first-child',3)];`]],
  after:`Object.assign(__shot.enemy('kh-guard-0'),{x:19,y:20,alert:false});`},
 'cover-line':{stage:`${S}s.reset();R.zoom=1.6;s.at(6,2);`,clips:`${C}return [s.tiles(5,1,7,3)];`},
 door:{localized:true,stage:`${S}s.reset();R.zoom=1.3;g.barriers.find(b=>b.id==='edge-kh-compartment').open=false;s.at(12,5);`,clips:`${C}return [s.tiles(11,4,14,6),s.el('#interact',4)];`},
 box:{localized:true,stage:`${S}s.reset();R.zoom=1.3;g.barriers.find(b=>b.id==='edge-kh-compartment').open=true;s.at(14,3);`,clips:`${C}return [s.tiles(13,2,16,4),s.el('#interact',4)];`},
 'target-card':{localized:true,stage:`${S}s.reset();s.at(18,5,'kh-drone');`,clips:`${C}return [s.union(s.tiles(17,3,23,7),s.el('#target-card',6))];`},
 windup:{stage:`${S}s.reset();R.zoom=1.3;R.targetingEnabled=false;const d=s.enemy('kh-drone');s.at(19,5);Object.assign(d,{alert:true,charge:true,windup:1,aim:{x:19,y:5}});__ashSim.update();`,
  clips:`${C}const c=s.tiles(18,4,23,6);c.marks=[s.bang(s.enemy('kh-drone'))];return [c];`},
 reload:{localized:true,stage:`${S}s.reset();s.enemy('kh-drone').charge=false;s.at(19,5,'kh-drone');p.ammo[p.weapon]=0;__ashSim.update();`,
  clips:`${C}return [s.union(s.el('[data-action="fire"]',4),s.el('[data-action="reload"]',4))];`,after:`__shot.g().player.ammo[__shot.g().player.weapon]=30;__ashSim.update();`},
 blast:{stage:`${S}s.reset();R.zoom=.7;R.targetingEnabled=false;s.enemy('kh-drone').hp=0;s.at(21,10,'kh-target-1');R.mode='grenade';R.aim={x:21,y:15};__ashSim.update();`,
  clips:`${C}const c=s.tiles(18,9,24,17);c.marks=[s.ring(21,15)];return [c];`},
 'throw-steps':{localized:true,stage:`${S}s.reset();s.at(21,10,'kh-target-1');R.mode='grenade';R.aim={x:21,y:15};__ashSim.update();`,
  clips:`${C}return [s.union(s.el('[data-action="grenade"]',4),s.el('#interact',4))];`},
 light:{stage:`${S}s.reset();R.zoom=.6;R.targetingEnabled=false;for(const b of g.barriers)if(b.type==='door')b.open=true;s.at(9,13);`,clips:`${C}return [s.tiles(2,10,16,16)];`},
 // A real shot from the dark: the kill's muzzle flash lights the player's tile and the other rifleman winds up.
 flash:{stage:`${S}s.reset();R.zoom=.75;R.targetingEnabled=false;const a=s.enemy('kh-dark-0'),b=s.enemy('kh-dark-1');s.at(8,13,a.id);for(let i=0;i<6&&a.hp>0;i++){g.target=a.id;if(!g.action('fire'))g.action('reload');}
  if(!b.charge)Object.assign(b,{alert:true,charge:true,windup:1,aim:{x:p.x,y:p.y}});g.target=b.id;__ashSim.update();`,
  clips:`${C}const c=s.tiles(1,10,10,16);c.marks=[s.ring(p.x,p.y),s.bang(s.enemy('kh-dark-1'))];return [c];`},
 flashlight:{stage:`${S}s.reset();R.zoom=1.2;R.targetingEnabled=false;const b=s.enemy('kh-dark-1');Object.assign(b,{hp:22,alert:true,charge:false,x:6,y:14});s.at(8,13);p.flashlight=true;g.reveal();__ashSim.update();`,
  clips:`${C}return [s.tiles(5,10,11,16),s.el('[data-action="flashlight"]',4)];`},
 civilian:{stage:`${S}s.reset();R.zoom=1.2;const c=s.enemy('kh-civ');Object.assign(c,{x:9,y:20});s.at(5,19);g.enemyCallout(c,'telegraph',{action:'scream'});__ashSim.update();`,
  clips:`${C}const k=s.tiles(4,17,11,22);k.marks=[s.ring(9,20)];return [k];`},
 exit:{localized:true,stage:`${S}s.reset();R.zoom=1.3;for(const e of g.enemies)e.hp=0;s.at(23,21);`,clips:`${C}return [s.tiles(21,19,24,23),s.el('#interact',4)];`}
};

async function cdp(){
 const dir=await mkdtemp(join(tmpdir(),'ash-shots-'));
 const chrome=spawn(CHROME,['--headless=new',`--remote-debugging-port=${PORT}`,`--user-data-dir=${dir}`,'--hide-scrollbars','--window-size=390,844','about:blank'],{stdio:'ignore'});
 let target;for(let i=0;i<50&&!target;i++){await sleep(200);try{target=(await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t=>t.type==='page');}catch{}}
 if(!target)throw Error('Chrome did not start');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.onopen=ok;ws.onerror=no;});
 let seq=0;const pending=new Map();
 ws.onmessage=m=>{const d=JSON.parse(m.data);if(d.id&&pending.has(d.id)){const {ok,no}=pending.get(d.id);pending.delete(d.id);d.error?no(Error(d.error.message)):ok(d.result);}};
 const send=(method,params={})=>new Promise((ok,no)=>{const id=++seq;pending.set(id,{ok,no});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 return {send,evaluate,close:()=>{ws.close();chrome.kill();}};
}

const {send,evaluate,close}=await cdp();
try{
 await mkdir(out,{recursive:true});
 await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 for(const lang of ['zh-TW','en']){
  await send('Page.navigate',{url:URL_BASE});await sleep(1500);
  await evaluate(`localStorage.setItem('qa-ash-language','${lang}')`);
  await send('Page.navigate',{url:URL_BASE});await sleep(2500);
  await evaluate(`__ashSim.start({mode:'tutorial'})`);await sleep(800);
  await evaluate(HELPERS);await evaluate('__shot.quiet()');
  for(const [name,scene] of Object.entries(SCENES)){
   if(only.length&&!only.includes(name))continue;
   if(lang==='en'&&!scene.localized)continue;
   const steps=scene.steps||[[scene.stage,scene.clips]];let n=0;
   for(const [stage,clipsCode] of steps){
    await evaluate(`(async()=>{${stage}})()`);await sleep(1600);   // the camera eases its zoom (src/camera.js)
    const clips=await evaluate(`(async()=>{${clipsCode}})()`);
    for(const clip of clips){
     const file=`${name}${lang==='en'?'.en':''}-${n++}`,{data}=await send('Page.captureScreenshot',{format:'png',clip:{x:clip.x,y:clip.y,width:clip.width,height:clip.height,scale:1}});
     await writeFile(join(out,file+'.png'),Buffer.from(data,'base64'));
     // Rings in the picture's own pixels (the page is captured at 2x).
     if(clip.marks?.length)await writeFile(join(out,file+'.json'),JSON.stringify(clip.marks.map(m=>[m.x-clip.x,m.y-clip.y,m.width,m.height].map(v=>Math.round(v*2)))));
    }
   }
   if(scene.after)await evaluate(scene.after);
   console.log(lang,name,n);
  }
 }
}finally{close();}
