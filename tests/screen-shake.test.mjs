import test from 'node:test';
import assert from 'node:assert/strict';
import {SHAKE_TUNING as T,shakeImpulses,shakeOffset,liveImpulses} from '../src/screen-shake.js';

// 3.147.0 (user request 2026-09-19): screen shake is presentation only; these are its pure parts.
const P={x:10,y:10};
const at=(impulses,ms)=>shakeOffset(impulses,ms);

test('your shot kicks the view away from where you fire, harder for heavier guns',()=>{
 const [rifle]=shakeImpulses([{type:'shot',weaponId:'rifle',from:P,to:{x:15,y:10}}],P,0);
 assert.equal(rifle.kind,'kick');assert.deepEqual(rifle.dir,{x:-1,y:-0});
 const peak=at([rifle],T.recoilMs*.2);assert.ok(peak.x<-2&&Math.abs(peak.y)<1e-9,'firing east pushes the view west');
 const [shotgun]=shakeImpulses([{type:'shot',weaponId:'shotgun',from:P,to:{x:10,y:6}}],P,0);
 assert.ok(shotgun.amp>rifle.amp);assert.ok(at([shotgun],T.recoilMs*.2).y>0,'firing north pushes it south');
 assert.deepEqual(at([rifle],T.recoilMs),{x:0,y:0,strength:0},'and settles');
});

test('melee jabs toward the target; the chainsaw buzzes; enemy shots elsewhere do nothing',()=>{
 const [jab]=shakeImpulses([{type:'shot',weaponId:'katana',style:'slash',from:P,to:{x:11,y:10}}],P,0);
 assert.equal(jab.kind,'kick');assert.deepEqual(jab.dir,{x:1,y:0});
 const [saw]=shakeImpulses([{type:'shot',weaponId:'chainsaw',style:'slash',from:P,to:{x:11,y:10}}],P,0);assert.equal(saw.kind,'buzz');
 assert.deepEqual(shakeImpulses([{type:'enemyShot',from:{x:3,y:3},to:{x:4,y:3},damage:9}],P,0),[],'not aimed at you');
 assert.deepEqual(shakeImpulses([{type:'shot',weaponId:'rifle',from:{x:4,y:4},to:P}],P,0),[],'an ally or a pet firing');
});

test('a blast shakes by its size and fades with distance; a hit on you knocks the view away from the shooter',()=>{
 const near=shakeImpulses([{type:'blast',from:{x:11,y:10},radius:1}],P,0)[0],far=shakeImpulses([{type:'blast',from:{x:16,y:10},radius:1}],P,0)[0];
 assert.ok(near.amp>far.amp&&far.amp>0);
 assert.deepEqual(shakeImpulses([{type:'blast',from:{x:25,y:25},radius:1}],P,0),[],'out of reach');
 const [hit]=shakeImpulses([{type:'enemyShot',from:{x:10,y:4},to:P,damage:20}],P,0);
 assert.equal(hit.kind,'kick');assert.deepEqual(hit.dir,{x:0,y:1},'shot from the north: knocked south');assert.equal(hit.start,T.hitDelay);
 assert.deepEqual(shakeImpulses([{type:'enemyShot',from:{x:10,y:4},to:P,damage:20,miss:true}],P,0),[],'a miss does not');
 assert.equal(shakeImpulses([{type:'impact',from:P,to:P,damage:12,player:true}],P,0)[0].kind,'jolt','harm without a shooter');
});

test('the shift is capped and expired impulses are dropped',()=>{
 const pile=Array.from({length:6},()=>({kind:'kick',start:0,duration:200,amp:9,dir:{x:1,y:0}}));
 assert.ok(at(pile,40).strength<=T.maxShift+1e-9);
 assert.equal(liveImpulses(pile,250).length,0);
});
