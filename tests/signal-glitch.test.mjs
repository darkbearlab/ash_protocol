import test from 'node:test';
import assert from 'node:assert/strict';
import {GLITCH_TUNING as T,effectGlitches,stateGlitches,screenStrength,liveGlitches,affixed} from '../src/signal-glitch.js';
import {shakeImpulses} from '../src/screen-shake.js';

// 3.149.0 (user request 2026-09-19): signal interference, apart from the shake. Presentation only; these are its pure parts.
const P={x:10,y:10};
const withRandom=(value,fn)=>{const old=Math.random;Math.random=()=>value;try{return fn();}finally{Math.random=old;}};
const view=(extra={})=>({player:{...P,hp:100,maxHp:100,control:{disabled:0},suppression:0},enemies:[],...extra});

test('your shot, a blast and a hit still glitch the screen, now on their own terms',()=>{
 const effects=[{type:'shot',weaponId:'shotgun',from:P,to:{x:14,y:10}}],kicks=shakeImpulses(effects,P,0);
 const r=effectGlitches(effects,view(),0,kicks);assert.equal(r.screen.length,1);assert.equal(r.screen[0].amp,kicks[0].amp*T.fromShake);
 assert.ok(screenStrength(r.screen,10)>0);assert.equal(screenStrength(r.screen,1000),0,'and it passes');
 const hit=effectGlitches([{type:'enemyShot',from:{x:10,y:4},to:P,damage:12}],view(),0);assert.equal(hit.hit,true,'the controls glitch on a hit');
 assert.equal(effectGlitches([{type:'enemyShot',from:{x:10,y:4},to:P,damage:12,miss:true}],view(),0).hit,false);
});

test('scans glitch; moving glitches you sometimes; affixed enemies glitch when they move or attack, only once revealed',()=>{
 assert.equal(effectGlitches([{type:'pulse',skill:'signal_break'}],view(),0).screen.length,1);
 assert.equal(effectGlitches([{type:'pulse',skill:'anchor'}],view(),0).screen.length,0,'not every skill');
 const move=[{type:'move',actorId:'player',to:{x:11,y:10}}];
 assert.equal(withRandom(0,()=>effectGlitches(move,view(),0)).objects[0].key,'player');
 assert.equal(withRandom(.99,()=>effectGlitches(move,view(),0)).objects.length,0,'only sometimes');
 const hidden={id:'h',x:14,y:10,hp:9,affixes:[{id:'fast',revealed:false}]},shown={id:'s',x:15,y:10,hp:9,affixes:[{id:'fast',revealed:true}]};
 assert.ok(!affixed(hidden)&&affixed(shown));
 const v=view({enemies:[hidden,shown]});
 const r=withRandom(0,()=>effectGlitches([{type:'move',actorId:'h',to:{x:13,y:10}},{type:'move',actorId:'s',to:{x:15,y:11}},{type:'enemyShot',from:{x:15,y:10},to:{x:3,y:3},damage:0,miss:true}],v,0));
 assert.deepEqual(r.objects.map(o=>o.key),['s','s'],'an unrevealed affix gives nothing away');
});

test('disabled, pinned and nearly dead: bursts and pulses while it lasts; affixed enemies idle-glitch; ambient picks objects',()=>{
 const state={},v=view(),visible={enemies:[],keys:[]};v.player.control.disabled=2;
 const first=stateGlitches(state,v,0,visible);assert.equal(first.screen[0].amp,T.disabled.amp,'a burst when it starts');
 assert.equal(stateGlitches(state,v,10,visible).screen.length,0);assert.equal(stateGlitches(state,v,T.disabled.pulse.every[1]+1,visible).screen[0].amp,T.disabled.pulse.amp,'then pulses');
 v.player.control.disabled=0;v.player.suppression=3;v.player.hp=10;
 const s2={};stateGlitches(s2,v,0,visible);const later=stateGlitches(s2,v,9000,visible).screen.map(g=>g.amp).sort();
 assert.deepEqual(later,[T.pinned.amp,T.lowHp.amp].sort(),'pinned and low health each pulse');
 const foe={id:'s',affixes:[{id:'fast',revealed:true}]},s3={};stateGlitches(s3,view(),0,{enemies:[foe],keys:['a','b','c']});
 const o=stateGlitches(s3,view(),20000,{enemies:[foe],keys:['a','b','c']}).objects;
 assert.ok(o.some(g=>g.key==='s'),'the affixed enemy');assert.ok(o.filter(g=>g.key!=='s').length>=1,'and something ambient');
 assert.equal(liveGlitches(o,20000+1000).length,0);
});
