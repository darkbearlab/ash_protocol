import test from 'node:test';
import assert from 'node:assert/strict';
import {t} from '../src/i18n.js';
import {commsEvents,commsSnapshot,newCommsMemory,COMMS_EVENT_TUNING} from '../src/comms-events.js';
import {commsLine,resolveComms,COMMS_LINES} from '../src/comms.js';

// 3.169.0 (user decision, docs/STORY.md 8): what the officer on duty remarks on, and how often.
const at=(id,type,x,y)=>({id,type,x,y,hp:10,affixes:[],faction:'legacy'});
const run=(visible,{turn=5,floor=1,target=null}={})=>({turn,floor,target,player:{x:10,y:10},visibleEnemies:visible});
const types=events=>events.map(e=>e.type);

test('squad orders speak a few turns apart; grenade warnings every time',()=>{
 const memory=newCommsMemory('r'),deploy={text:t('squad.identified',{enemy:'甲',weapon:'步槍'})},ready={text:t('squad.ready',{enemy:'甲'})},grenade={text:t('enemy-behavior.grenadeReady',{enemy:'乙'})};
 assert.deepEqual(types(commsEvents({game:run([],{turn:5}),logs:[grenade,ready,deploy],memory})),['squadDeploy','squadReady','grenade']);
 assert.deepEqual(types(commsEvents({game:run([],{turn:6}),logs:[grenade,ready,deploy],memory})),['grenade'],'squad hints wait out their cooldown');
 const later=5+COMMS_EVENT_TUNING.squadDeploy.cooldown;
 assert.deepEqual(types(commsEvents({game:run([],{turn:later}),logs:[deploy],memory})),['squadDeploy']);
 assert.deepEqual(types(commsEvents({game:run([],{turn:later}),logs:[grenade,grenade],memory})),['grenade'],'one warning per action');
});

test('first contact and researchers once per floor; each boss once, by name',()=>{
 const memory=newCommsMemory('r');
 assert.deepEqual(types(commsEvents({game:run([at('1-1','civilian',12,10)]),memory})),['researcher'],'a researcher is not contact');
 assert.deepEqual(types(commsEvents({game:run([at('1-1','civilian',12,10),at('1-2','rifleman',9,10)]),memory})),['contact']);
 assert.deepEqual(types(commsEvents({game:run([at('1-2','rifleman',9,10)]),memory})),[]);
 const boss=commsEvents({game:run([at('3-9','boss',10,14)],{floor:3}),memory});
 assert.deepEqual(types(boss),['contact','boss']);
 assert.ok(boss[1].vars.name.length>0);
 assert.deepEqual(types(commsEvents({game:run([at('3-9','boss',10,14),at('3-1','civilian',11,10)],{floor:3}),memory})),['researcher'],'the boss is announced once; a new floor has its own researcher');
});

test('a new enemy more than 90 degrees from the one you are fighting is a flank, every time',()=>{
 const memory=newCommsMemory('r');memory.contactFloors.push(1);
 const front=at('1-1','rifleman',10,5),behind=at('1-2','rifleman',10,14),side=at('1-3','rifleman',13,9);
 const before=commsSnapshot(run([front]));
 assert.deepEqual(types(commsEvents({game:run([front,behind]),before,memory})),['flank']);
 assert.deepEqual(types(commsEvents({game:run([front,side]),before,memory})),[],'within 90 degrees is not a flank');
 assert.deepEqual(types(commsEvents({game:run([front,behind]),before,memory})),['flank'],'no cooldown');
 assert.deepEqual(types(commsEvents({game:run([behind]),before:commsSnapshot(run([])),memory})),[],'nobody to be flanked from');
 // side is the nearer enemy; the newcomer at (13,12) is behind the front one but beside the side one.
 const newcomer=at('1-4','rifleman',13,12);
 assert.deepEqual(types(commsEvents({game:run([front,side,newcomer]),before:commsSnapshot(run([front,side],{target:'1-1'})),memory})),['flank'],'measured from the locked target');
 assert.deepEqual(types(commsEvents({game:run([front,side,newcomer]),before:commsSnapshot(run([front,side])),memory})),[],'with nothing locked, from the nearest enemy');
});

test('Egret and Wren (3.171.0) have lines for every full-support event; the overseer is a hook that stays quiet',()=>{
 for(const event of ['briefing','squadDeploy','squadReady','grenade','boss','flank','researcher']){
  for(const speaker of ['egret','wren']){
   const lines=COMMS_LINES[speaker][event];
   for(let i=0;i<lines.length;i++){
    const message=commsLine(speaker,event,{name:'核心守衛'},{random:()=>i/lines.length});
    assert.equal(message.speaker,speaker);
    assert.ok(resolveComms(message).text.length>0,`${speaker} ${event} ${i+1}`);
   }
  }
  assert.equal(commsLine('overseer',event),null);
 }
 for(const speaker of ['egret','wren']){
  assert.equal(commsLine(speaker,'contact'),null,'contact is the overseer\'s cue');
  for(const n of [1,2])assert.match(resolveComms(commsLine(speaker,'boss',{name:'核心守衛'},{random:()=>(n-1)/2})).text,/核心守衛/);
 }
 assert.deepEqual(Object.keys(COMMS_LINES),['egret','wren','overseer']);
});
