import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,receiveCallout,CALLOUT_TUNING,protocolSettlement,finishSuppression} from '../src/engine.js';
import {normalizeProfile,creditProtocol} from '../src/progression.js';
import {makeBackup,decodeBackup,validateProfile} from '../src/backup.js';
import {BARRIER_TYPES} from '../src/barriers.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {captureAction,presentStep,planPresentation} from '../src/presentation.js';
const arena=(realMode=false)=>{const raw=JSON.parse(affixArena().serialize());raw.data.realMode=realMode;return Game.restore(JSON.stringify(raw));};
const clear=g=>{g.logs=[];g.effects=[];};
test('1: deployment locks mode, both modes restore and backup; v38 migrates to standard',()=>{
 for(const realMode of [false,true]){const g=new Game(95,[],0,'soldier','onyx','extraction',{realMode});assert.throws(()=>g.realMode=!realMode,TypeError);assert.throws(()=>Object.defineProperty(g,'realMode',{value:!realMode}),TypeError);const h=Game.restore(g.serialize());assert.equal(h.realMode,realMode);assert.throws(()=>h.realMode=!realMode,TypeError);const b=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa');assert.equal(b.game.realMode,realMode);}
 const raw=JSON.parse(new Game(95).serialize());raw.version=38;delete raw.data.realMode;assert.equal(Game.restore(JSON.stringify(raw)).realMode,false);raw.version=39;assert.equal(Game.restore(JSON.stringify(raw)),null);raw.data.realMode='yes';assert.equal(Game.restore(JSON.stringify(raw)),null);
});
test('2: actual hits, misses, enemy damage, disruption and hazards log without numbers in real mode',()=>{
 const g=arena(true),e=sceneEnemy(g,'rifleman');clear(g);g.hurt(e,17);g.damagePlayer(14,'槍擊',e);g.rng=Object.assign(()=>.999,{state:()=>1});g.fire();e.charge=true;e.windup=1;g.enemyAct(e);g.hazards=[{x:g.player.x,y:g.player.y,type:'acid'}];g.environmentTurn();
 assert.ok(g.logs.some(l=>l.text.includes('命中')));assert.ok(g.logs.some(l=>l.text.includes('未命中')));assert.ok(g.logs.every(l=>!/[0-9%]/.test(l.text)),g.logs.map(l=>l.text).join('|'));assert.ok(g.logs.every(l=>Object.keys(l).sort().join(',')==='danger,text,turn'));
 const normal=arena(),n=sceneEnemy(normal);clear(normal);normal.hurt(n,17);assert.ok(normal.logs.some(l=>l.text.includes('17')));
});
test('3: marks, combat state and RNG are identical in both modes; callout belongs to the causing step',()=>{
 const results=[];for(const mode of [false,true]){const g=arena(mode),e=sceneEnemy(g,'boss');e.attackCount=1;clear(g);const state=g.rng.state(),steps=captureAction(g,()=>presentStep(g,()=>g.enemyAct(e)));assert.equal(g.rng.state(),state);assert.equal(g.marks.length,1);assert.ok(steps.steps.some(s=>s.effects.some(f=>f.type==='callout'&&f.cue==='bombard')));results.push({marks:g.marks,hp:g.player.hp});}assert.deepEqual(...results);
});
test('4: heard events and observers contain only direction, never actor IDs, names, rooms or precise positions',()=>{
 const g=arena(),e=sceneEnemy(g);g.teamVisible=()=>false;clear(g);let seen;g.onEnemyCallout=x=>seen=x;const event=receiveCallout(g,e,'telegraph',{action:'grenade',x:99,actorId:'secret',damage:700});assert.equal(event.visibility,'heard');assert.equal(event.direction,'east');assert.deepEqual(Object.keys(event).sort(),['category','cue','direction','faction','priority','type','visibility']);assert.deepEqual(seen,event);assert.ok(!JSON.stringify(event).includes('secret'));assert.equal(g.logs.length,0,'callouts never write the combat log');
});
test('4/5: outside hearing range, unknown cues and player/allied speakers emit nothing; visible events are safe copies',()=>{
 const g=arena(),e=sceneEnemy(g);clear(g);e.x=g.player.x+CALLOUT_TUNING.hearingRadius+1;assert.equal(receiveCallout(g,e,'telegraph',{action:'aim'}),null);e.x=14;for(const [kind,detail] of [['bogus',{}],['telegraph',{action:'damage:999'}],['state',{state:'grenade'}]])assert.equal(receiveCallout(g,e,kind,detail),null);assert.equal(receiveCallout(g,g.player,'injury',{cue:'hit'}),null);assert.equal(receiveCallout(g,{...e,kind:'pet'},'injury',{cue:'hit'}),null);assert.equal(g.effects.length,0);assert.equal(g.logs.length,0);
 const event=receiveCallout(g,e,'telegraph',{action:'aim'});assert.equal(event.actorId,e.id);event.position.x=1;assert.equal(e.x,14);assert.equal(g.logs.length,0,'visible callouts do not log either');
});
test('5: injury thresholds and suppression emit semantic cues without persisted actor counters or RNG use',()=>{
 const g=arena(),e=sceneEnemy(g),before=Object.keys(e).sort(),rng=g.rng.state();clear(g);g.hurt(e,1);g.hurt(e,105);g.hurt(e,50);assert.deepEqual(g.effects.filter(f=>f.type==='callout'&&f.category==='injury').map(f=>f.cue),['hit','wounded','critical']);finishSuppression([e],new Set([e]),5,1,g);finishSuppression([e],new Set(),1,1,g);assert.ok(g.effects.some(f=>f.cue==='suppressed'));assert.ok(g.effects.some(f=>f.cue==='pinned'));assert.equal(g.rng.state(),rng);assert.deepEqual(Object.keys(e).filter(k=>k!=='suppression').sort(),before);const h=Game.restore(g.serialize());assert.ok(h);assert.deepEqual(h.effects,[]);
});
test('6: terminal bonus rounds down once, live credit stays base and replay/older saves cannot credit again',()=>{
 const g=arena(true),p=normalizeProfile();g.protocol.earned=29;assert.equal(creditProtocol(p,g),29);assert.equal(p.protocol.balance,29);assert.equal(protocolSettlement(g).bonus,0);g.status='dead';assert.deepEqual(protocolSettlement(g),{realMode:true,base:29,bonus:2,total:31});assert.equal(creditProtocol(p,g),2);assert.equal(creditProtocol(p,g),0);assert.equal(p.protocol.balance,31);g.status='playing';g.protocol.earned=10;assert.equal(creditProtocol(p,g),0);g.status='dead';assert.equal(creditProtocol(p,g),0);assert.equal(p.protocol.balance,31);assert.ok(validateProfile(p));
 for(const status of ['won','dead','abandoned']){const n=arena(),q=normalizeProfile();n.protocol.earned=29;n.status=status;assert.equal(creditProtocol(q,n),29);assert.equal(protocolSettlement(n).bonus,0);}
 const restored=decodeBackup(JSON.stringify(makeBackup(null,p,'qa')),'qa').snapshot.profile;assert.equal(creditProtocol(restored,g),0);
});
test('result history carries mode and actual bonus, repeated storage settlement is idempotent',async()=>{
 const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};const {recordResult}=await import('../src/storage.js');const g=arena(true);g.protocol.earned=47;g.status='won';const p=recordResult(g);assert.equal(p.history[0].realMode,true);assert.equal(p.history[0].protocol,51);assert.equal(p.history[0].protocolBonus,4);assert.equal(recordResult(g).protocol.balance,51);assert.equal(recordResult(g).history.length,1);assert.ok(validateProfile(p));
});

test('callout timing follows impact and never adds an animation pause',()=>{
 const g=arena(true),e=sceneEnemy(g);const {steps}=captureAction(g,()=>presentStep(g,()=>{g.effects.push({type:'shot',weaponId:'rifle',from:{x:10,y:10},to:{x:14,y:10},damage:0});g.hurt(e,1);}));
 const plan=planPresentation(steps),silent=planPresentation(steps.map(s=>({...s,effects:s.effects.filter(f=>f.type!=='callout')})));
 assert.equal(plan.duration,silent.duration);assert.ok(!plan.events[0].effects.some(f=>f.type==='callout'));assert.ok(plan.events[1].effects.some(f=>f.type==='callout'));assert.ok(plan.events[1].time>0);
 const only=planPresentation([{before:steps[0].before,after:steps[0].before,effects:[{type:'callout',cue:'search'}]}]);assert.equal(only.duration,0);
});

test('suppression outside projectile steps still reaches captured playback exactly once',()=>{
 const g=arena(),e=sceneEnemy(g);clear(g);const {steps}=captureAction(g,()=>finishSuppression([e],new Set(),0,1,g));
 assert.equal(steps.flatMap(s=>s.effects).filter(f=>f.cue==='suppressed').length,1);assert.equal(planPresentation(steps).duration,0);
});

// 3.76.1 user decisions (REAL_MODE section 6): callouts are presentation only, durability is hidden, backups ignore tuning.
test('7: an enemy turn that calls out still logs only its rules line',()=>{
 for(const mode of [false,true]){const g=arena(mode),e=sceneEnemy(g,'boss');e.attackCount=1;clear(g);presentStep(g,()=>g.enemyAct(e));
  assert.ok(g.effects.some(f=>f.type==='callout'&&f.cue==='bombard'));assert.equal(g.logs.filter(l=>l.text.includes('轟炸')).length,1,g.logs.map(l=>l.text).join('|'));}
});
test('real mode hides barrier durability in the log; standard keeps the number',()=>{
 const type=Object.keys(BARRIER_TYPES).find(t=>BARRIER_TYPES[t].destructible),barrier=mode=>{const g=arena(mode);clear(g);return {g,b:{id:`qa-${type}`,type,x:12,y:10,axis:'x',hp:40,maxHp:40}};};
 const real=barrier(true);real.g.damageProp(real.b,10);assert.ok(real.g.logs[0].text.endsWith('受損。'));assert.ok(!/[0-9]/.test(real.g.logs[0].text),real.g.logs[0].text);
 real.g.damageProp(real.b,99);assert.ok(real.g.logs[0].text.endsWith('已摧毀，通道打開。'));
 const normal=barrier(false);normal.g.damageProp(normal.b,10);assert.ok(normal.g.logs[0].text.includes('耐久剩 30'));
});
test('backup validation bounds the real-mode bonus by its base, not by the current percentage',()=>{
 const q=normalizeProfile(),run=arena(true);run.protocol.earned=29;run.status='dead';creditProtocol(q,run);const [id]=Object.keys(q.protocolRuns);assert.equal(q.protocolRuns[id].realBonus,2);
 const raise=n=>{q.protocolRuns[id].realBonus+=n;q.protocol.earned+=n;q.protocol.balance+=n;};
 raise(3);assert.ok(validateProfile(q),'a bonus from a higher future percentage still imports');
 raise(q.protocolRuns[id].earned-q.protocolRuns[id].realBonus+1);assert.throws(()=>validateProfile(q),'a bonus above its base is corrupt');
});
