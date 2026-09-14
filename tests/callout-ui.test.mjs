import test from 'node:test';
import assert from 'node:assert/strict';
import {CALLOUT_CUES} from '../src/engine.js';
import {CalloutBoard,CALLOUT_UI_TUNING as T,calloutLine,calloutVoice,bubbleText,bubbleAlpha,edgePoint,DIRECTION_ARROWS} from '../src/callout-ui.js';
import {impactSound} from '../src/combat-sounds.js';

const seen=(cue,actorId='a1',enemyType='rifleman')=>({type:'callout',cue,...CALLOUT_CUES[cue],visibility:'visible',actorId,enemyType,name:'x',position:{x:1,y:1}});
const heard=(cue,direction='east')=>({type:'callout',cue,...CALLOUT_CUES[cue],visibility:'heard',direction});

test('every cue has number-free lines in each voice, picked without randomness',()=>{
 for(const cue of Object.keys(CALLOUT_CUES))for(const type of ['rifleman','drone','crawler']){
  const event=seen(cue,'a1',type),line=calloutLine(event);
  assert.ok(line.length>0,`${cue}/${type}`);assert.ok(!/[0-9%×]/.test(line),line);assert.equal(calloutLine(event),line,'same event, same line');
 }
 for(const cue of Object.keys(CALLOUT_CUES))assert.ok(calloutLine(heard(cue)).length>0,cue);
 assert.equal(calloutVoice(seen('move','d','drone')),'machine');assert.equal(calloutVoice(seen('move','c','crawler')),'creature');
 assert.equal(calloutVoice({...heard('move'),enemyType:'drone'}),'human','heard bubbles never reveal the unit type');
});

test('lifetimes are 2.5s general, 4s danger and shorter when only heard; timing starts when the board receives the event',()=>{
 const b=new CalloutBoard(),general=b.add(seen('move'),1000),danger=b.add(seen('grenade','a2'),1000),far=b.add(heard('search','west'),1000);
 assert.equal(general.expires,1000+T.generalMs);assert.equal(danger.expires,1000+T.dangerMs);assert.equal(far.expires,1000+Math.round(T.generalMs*T.heardFactor));
 const later=b.active(1000+T.generalMs);assert.ok(!later.includes(general));assert.ok(later.includes(danger));
});

test('one bubble per unit: a repeat only extends it without any ×N, louder lines replace quieter ones',()=>{
 const b=new CalloutBoard(),first=b.add(seen('move'),0);
 assert.equal(b.add(seen('move'),100),first);assert.equal(first.expires,100+T.generalMs,'a repeat extends the bubble');
 assert.equal(bubbleText(first),first.text);assert.ok(!bubbleText(first).includes('×'));
 const loud=b.add(seen('attack'),200);assert.deepEqual(b.active(200),[loud]);
 assert.equal(b.add(seen('move'),300),null,'a quieter line does not cover a live danger bubble');
});

test('the same quieter cue from other units waits out the cooldown; danger lines always show',()=>{
 const b=new CalloutBoard(),a=b.add(seen('spotted','a1'),0);
 assert.equal(b.add(seen('spotted','a2'),500),null);assert.deepEqual(b.active(500),[a]);
 const later=b.add(seen('spotted','a3'),T.cooldownMs+1);assert.ok(later&&later!==a,'after the cooldown another unit may say it');
 const g1=b.add(seen('grenade','a4'),0),g2=b.add(seen('grenade','a5'),10);assert.ok(g1&&g2&&g1!==g2);
 const h=new CalloutBoard(),west=h.add(heard('search','west'),0);assert.equal(h.add(heard('search','west'),10),west,'a heard repeat from one direction extends its bubble');
});

test('the screen cap drops the quietest, oldest bubble; a quiet line cannot push out danger',()=>{
 const b=new CalloutBoard();['move','cover','hold','flank'].forEach((cue,i)=>b.add(seen(cue,`m${i}`),i));
 const danger=b.add(seen('grenade','g'),10),live=b.active(10);
 assert.equal(live.length,T.maxOnScreen);assert.ok(live.includes(danger));assert.ok(!live.some(i=>i.event.actorId==='m0'));
 const full=new CalloutBoard();for(let i=0;i<T.maxOnScreen;i++)full.add(seen('grenade',`h${i}`),i);
 assert.equal(full.add(seen('search','s'),5),null);
});

test('heard bubbles sit on the screen edge in their direction and render fainter; all bubbles fade out',()=>{
 for(const direction of Object.keys(DIRECTION_ARROWS)){const p=edgePoint(direction,360,600);assert.ok(p.x>=0&&p.x<=360&&p.y>=0&&p.y<=600,direction);}
 assert.deepEqual(edgePoint('east',360,600),{x:360-T.edgeMargin,y:300});assert.deepEqual(edgePoint('north',360,600),{x:180,y:T.edgeMargin});
 const b=new CalloutBoard(),far=b.add(heard('lost','north'),0),near=b.add(seen('lost','v'),0);
 assert.ok(bubbleAlpha(far,0)<1);assert.equal(bubbleAlpha(near,0),1);assert.equal(bubbleAlpha(near,near.expires),0);
});

test('impact sounds: kill beats hit beats miss; the player or an ally falling is not a kill',()=>{
 assert.equal(impactSound([{type:'miss'}]),'miss');assert.equal(impactSound([{type:'miss'},{type:'impact'}]),'hit');
 const state={enemies:[{x:3,y:4,hp:0}]};
 assert.equal(impactSound([{type:'impact'},{type:'fall',actorType:'rifleman',from:{x:3,y:4}}],state),'kill');
 assert.equal(impactSound([{type:'fall',actorType:'player',from:{x:1,y:1}}],state),null);
 assert.equal(impactSound([{type:'fall',actorType:'drone',from:{x:9,y:9}}],state),null,'an allied drone going down is not a kill');
 assert.equal(impactSound([{type:'shot'}]),null);
});
