import test from 'node:test';
import assert from 'node:assert/strict';
import {t} from '../src/i18n.js';
import {KIA_TUNING,kiaTimes,kiaTimeScale,kiaZoom,kiaSeconds,killingBlow,kiaBurst,burstReach} from '../src/kia.js';
import {commsDuration,commsLine,armComms,COMMS_LINES,COMMS_SPEAKERS} from '../src/comms.js';
import {planPresentation} from '../src/presentation.js';

// 3.174.0 (user design, tuned on the preview page): freeze 210 ms, world at x0.2 for 1.2 s, the body falls in 300 ms
// of world time, 0.7 s later the officer speaks. The preview's timeline read 0.18 s hit, 0.39 s burst, 1.59 s normal
// speed, 1.65 s body down, 2.35 s voice.
test('the scene keeps the timings the user picked',()=>{
 assert.deepEqual({zoom:KIA_TUNING.zoom,freezeMs:KIA_TUNING.freezeMs,slowScale:KIA_TUNING.slowScale,slowMs:KIA_TUNING.slowMs,holdMs:KIA_TUNING.holdMs,voiceScale:KIA_TUNING.voiceScale},
  {zoom:1.4,freezeMs:210,slowScale:.2,slowMs:1200,holdMs:700,voiceScale:1.4});
 const hit=180,{normalAt,fallEnd,voiceAt}=kiaTimes();
 assert.equal(hit+KIA_TUNING.freezeMs,390);
 assert.equal(hit+normalAt,1590);
 assert.equal(hit+fallEnd,1650,'1.2 s at x0.2 is 240 ms of world time; the last 60 ms of the fall play at normal speed');
 assert.equal(hit+voiceAt,2350);
 const slowEnough=kiaTimes({...KIA_TUNING,slowScale:.5});
 assert.equal(slowEnough.fallEnd,KIA_TUNING.freezeMs+600,'a fall that ends inside the slow motion ends there');
});

test('the world stops, slows and comes back; the camera pushes in on the hit and pulls back when she speaks',()=>{
 assert.equal(kiaTimeScale(-1),1);
 assert.equal(kiaTimeScale(0),0);
 assert.equal(kiaTimeScale(209),0);
 assert.equal(kiaTimeScale(210),.2);
 assert.equal(kiaTimeScale(1409),.2);
 assert.equal(kiaTimeScale(1410),1);
 const {voiceAt}=kiaTimes();
 assert.equal(kiaZoom(-1,voiceAt),1);
 assert.equal(kiaZoom(0,voiceAt),1);
 assert.equal(kiaZoom(KIA_TUNING.zoomInMs,voiceAt),1.4);
 assert.equal(kiaZoom(voiceAt-1,voiceAt),1.4,'held until the officer speaks');
 assert.ok(kiaZoom(voiceAt+KIA_TUNING.zoomOutMs/2,voiceAt)<1.4);
 assert.equal(kiaZoom(voiceAt+KIA_TUNING.zoomOutMs,voiceAt),1);
});

test('the burst flies away from the killing blow; a death with no direction has no burst',()=>{
 const at={x:5,y:5};
 assert.deepEqual(killingBlow([{type:'enemyShot',from:{x:5,y:2},to:at,damage:12}],at),{dx:0,dy:1},'shot from above: the burst goes down');
 assert.deepEqual(killingBlow([{type:'enemyShot',from:{x:1,y:5},to:at,damage:3},{type:'enemyShot',from:{x:9,y:5},to:at,damage:5}],at),{dx:-1,dy:0},'the last shot that hurt wins');
 assert.equal(killingBlow([{type:'enemyShot',from:{x:1,y:5},to:at,damage:0,miss:true}],at),null,'a miss is not a blow');
 assert.equal(killingBlow([{type:'enemyShot',from:{x:1,y:5},to:{x:4,y:5},damage:9}],at),null,'a shot at another tile is not a blow');
 assert.deepEqual(killingBlow([{type:'blast',from:{x:3,y:5},to:{x:3,y:5},damage:0,radius:2}],at),{dx:1,dy:0},'a blast counts from its origin');
 assert.equal(killingBlow([{type:'blast',from:at,to:at,damage:0,radius:1}],at),null,'a blast on the tile itself has no direction');
 assert.equal(killingBlow([],at),null,'poison, fire, acid: no direction');
 const diagonal=killingBlow([{type:'enemyShot',from:{x:2,y:2},to:at,damage:4}],at);
 assert.ok(Math.abs(Math.hypot(diagonal.dx,diagonal.dy)-1)<1e-9);
 assert.equal(kiaBurst(7,null),null);
 const a=kiaBurst(7,{dx:1,dy:0}),b=kiaBurst(7,{dx:1,dy:0});
 assert.deepEqual(a,b,'the same seed and blow give the same burst');
 assert.equal(a.pop,1-KIA_TUNING.drift);
 assert.equal(a.drops.length,46);assert.equal(a.mist.length,12);assert.equal(a.sparks.length,16);
 for(const p of [...a.drops,...a.mist,...a.sparks])assert.ok(Math.abs(p.a-a.away)<=.65,'every piece leaves on the far side');
 assert.ok(a.drops.every(d=>d.land>0&&d.land<1),'drops land within a second of world time');
 assert.equal(burstReach(.7,2,0,.15),1.4,'most of the way out at once');
 assert.ok(burstReach(.7,2,.24,.15)<2,'only the rest drifts during the slow motion');
});

test('the operative\'s fall on the presentation carries the killing blow',()=>{
 const player=(hp,x=5,y=5)=>({x,y,hp,character:'soldier'});
 const state=hp=>({player:player(hp),enemies:[{id:'1-1',type:'rifleman',x:5,y:1,hp:20}],allies:[],items:[],logs:[],visible:()=>true});
 const {events}=planPresentation([{before:state(4),after:state(0),effects:[{type:'enemyShot',from:{x:5,y:1},to:{x:5,y:5},damage:6}]}]);
 const fall=events.flatMap(e=>e.effects).find(e=>e.type==='fall'&&e.actorType==='player');
 assert.deepEqual(fall.blow,{dx:0,dy:1});
 const quiet=planPresentation([{before:state(4),after:state(0),effects:[]}]).events.flatMap(e=>e.effects).find(e=>e.type==='fall'&&e.actorType==='player');
 assert.equal(quiet.blow,null);
});

test('each officer has a call, a loss report, an extraction approval and line; the overseer only an ellipsis; the call stays long and cannot be tapped away',()=>{
 for(const speaker of ['egret','wren','overseer'])for(const event of ['kia','lossReport','extractApproved','extracted']){
  const message=commsLine(speaker,event,{},{random:()=>0});
  assert.ok(message,`${speaker} ${event}`);
  if(speaker==='overseer')assert.equal(t(message.line),'……');
  else assert.ok(Object.hasOwn(COMMS_SPEAKERS[speaker].expressions,message.expression));
 }
 assert.deepEqual(Object.keys(COMMS_LINES.overseer),['kia','lossReport','extractApproved','extracted','executed']);
 assert.equal(t(commsLine('overseer','executed').line),'……');
 // The user's picks on the review page (2026-09-24): Egret 2 calls and 3 reports, Wren 3 calls and 2 reports.
 assert.deepEqual(['egret','wren'].map(who=>[COMMS_LINES[who].kia.length,COMMS_LINES[who].lossReport.length]),[[2,3],[3,2]]);
 assert.equal(t('comms.wren.lossReport.1'),'……任務失敗。損失報告，提交。','her revision');
 // 3.177.0 (user design): the end of a run has an approval on the field and a line on the dark screen; drafts, three each.
 assert.deepEqual(['egret','wren'].map(who=>[COMMS_LINES[who].extractApproved.length,COMMS_LINES[who].extracted.length]),[[3,3],[3,3]]);
 // 3.177.1: the user's picks keep all twelve; one is her revision.
 assert.equal(t('comms.wren.extractApproved.2'),'撤離批准！路線確認，回來吧！','her revision');
 const text=t('comms.egret.kia.1');
 assert.equal(kiaSeconds(text),Math.round(commsDuration(text)*1.4)/1000);
 const listeners={},classes=new Set();
 const box={dataset:{ms:'1000'},classList:{add:c=>classes.add(c)},addEventListener:(type,fn)=>{listeners[type]=fn;},querySelector:s=>s==='.comms-timer'?{style:{}}:null};
 armComms(box,()=>{},{tap:false});
 assert.equal(listeners.click,undefined);
 assert.ok(classes.has('held'));
});

// 3.176.0 (user calibration): every fallen sprite reads as knocked down from the left; a blow from the right mirrors it.
test('the fallen sprites are all drawn as if hit from the left, and the scene mirrors them for a blow from the right',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createHash}=await import('node:crypto');
 const root=new URL('../assets/pixel/classes-v1/',import.meta.url),meta=JSON.parse(await readFile(new URL('atlas.json',root),'utf8'));
 assert.equal(meta.fallen_facing.from,'left');
 assert.deepEqual(Object.keys(meta.fallen_facing.flipped).sort(),['bulwark','druid','engineer','necromancer','recon','soldier'],'the six the user found drawn from the right');
 for(const [name,{after}] of Object.entries(meta.fallen_facing.flipped))assert.equal(createHash('sha256').update(await readFile(new URL(`dead-${name}.png`,root))).digest('hex'),after,name);
 const {drawKiaBody}=await import('../src/kia-art.js');
 const draw=blow=>{const calls=[];const ctx={save(){},restore(){},translate(){},rotate(){},scale:(x,y)=>calls.push(['scale',x,y]),drawImage(){}};
  const r={tile:34,ctx,kia:{start:0,blow,frozen:false},classSprite:(a,size,c,dead)=>calls.push(['sprite',dead])};
  drawKiaBody(r,{x:100,y:100},'soldier',KIA_TUNING.fallMs+10);return calls;};
 assert.deepEqual(draw({dx:-1,dy:0}),[['scale',-1,1],['sprite',true]],'from the right: mirrored');
 assert.deepEqual(draw({dx:1,dy:0}),[['sprite',true]],'from the left: as drawn');
 assert.deepEqual(draw(null),[['sprite',true]],'no direction: as drawn');
});

