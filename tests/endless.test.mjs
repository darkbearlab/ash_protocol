import {dailyMission} from '../src/daily.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,MAX_LEVEL,CAP_SUPPLY,ENDLESS_TUNING,extraEnemies,scaleEnemy,eliteChance,ENDLESS_MAX_FLOOR,PROTOCOL_EVENT_LIMIT,generate,reachable,key,floorInfo,FLOOR_INFO,FLOORS,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {MISSIONS,RANDOM_MISSION_IDS,missionProgress} from '../src/missions.js';
import {normalizeProfile,PROFILE_VERSION,recordEndless} from '../src/progression.js';
import {makeBackup,decodeBackup,validateProfile} from '../src/backup.js';
import {captureAction,presentStep,planPresentation,DEATH_MS} from '../src/presentation.js';
const run=(floor=1,character='soldier')=>{const g=new Game(349,[],0,character,'onyx','endless');if(floor!==1){g.floor=floor;g.loadFloor();}return g;};
const rank=(g,level)=>{g.player.level=level;g.player.xp=0;g.perkPicks=Math.min(level-1,19);g.player.perks={med:g.perkPicks};g.pendingPerks=0;g.perkDraft=null;};
const kill=g=>{const e=makeEnemy('rifleman',g.player.x,g.player.y,'xp-victim');g.enemies.push(e);g.hurt(e,e.hp);};

test('levels 2–20 grant exactly nineteen picks; past the cap the level freezes and every 22 experience grants capped resources, no RNG reroll or paid turn',()=>{
 const g=run();rank(g,19);g.player.xp=20;kill(g);assert.equal(g.player.level,20);assert.equal(g.pendingPerks,1);assert.ok(g.choosePerk(g.perkChoices[0].id));assert.equal(g.perkPicks,19);
 const before=g.player.meds,turn=g.turn;g.player.xp=22+23+24-1;kill(g);assert.equal(g.player.level,20);assert.equal(g.pendingPerks,0);assert.deepEqual(g.perkChoices,[]);assert.equal(g.player.meds,before+CAP_SUPPLY.meds*3);assert.equal(g.turn,turn);
 assert.equal(g.logs.filter(l=>l.text.includes('獲得封頂補給')).length,3);assert.equal(g.effects.filter(e=>e.type==='capSupply').length,3);
 g.pendingPerks=1;g.perkDraft={index:19,ids:['med']};assert.equal(g.choosePerk('med'),false);
});
test('cap supplies use existing overflow rules, never add perk ranks, and reload does not award again',()=>{
 const g=run(25);rank(g,25);g.player.xp=26;
 const before={...g.player.perks},turn=g.turn;for(const [id,field]of [['rifle','reserve'],['pistol','pistol'],['shell','shell']])g.player[field]=g.ammoCapacity(id);g.player.grenades=g.ammoCapacity('grenade');
 const totals=type=>g.items.filter(i=>i.type===type&&key(i)===key(g.player)).reduce((s,i)=>s+(i.amount||0),0),shell=totals('shell'),grenade=totals('grenade');kill(g);
 assert.equal(totals('shell'),shell+CAP_SUPPLY.shell);assert.equal(totals('grenade'),grenade+CAP_SUPPLY.grenade);assert.deepEqual(g.player.perks,before);assert.equal(g.turn,turn);
 const h=Game.restore(g.serialize());assert.ok(h);assert.deepEqual(h.player,g.player);assert.equal(h.player.level,25,'a number above the cap survives but never grows');
});
test('cap reward presentation waits until the kill settles; rule resources are already committed',()=>{
 const g=run();rank(g,20);g.player.xp=21;const meds=g.player.meds;
 const target=makeEnemy('rifleman',g.player.x,g.player.y,'present-victim');g.enemies.push(target);const {steps}=captureAction(g,()=>presentStep(g,()=>g.hurt(target,target.hp)));const plan=planPresentation(steps);
 const impact=plan.events.find(e=>e.effects.some(f=>f.type==='fall')),reward=plan.events.find(e=>e.effects.some(f=>f.type==='capSupply'));
 assert.ok(impact&&reward);assert.ok(reward.time>=impact.time+DEATH_MS);assert.equal(impact.state.player.meds,meds);assert.equal(reward.state.player.meds,meds+2);assert.equal(g.player.meds,meds+2);assert.ok(!impact.state.logs.some(l=>l.text.includes('封頂補給')));
});
test('endless is appended, has no objectives, never extracts, and gates every repeating boss elevator',()=>{
 assert.equal(Object.keys(MISSIONS).at(-1),'endless');
 for(const f of [3,6,9,12,15,18]){const g=run(f);assert.equal(g.enemies.filter(e=>e.type===floorInfo(f).boss).length,1);Object.assign(g.player,g.end);assert.equal(g.descend(),false);for(const e of g.enemies)e.hp=0;assert.ok(g.descend());assert.equal(g.floor,f+1);assert.equal(g.status,'playing');assert.equal(g.exitLabel,'下樓');assert.deepEqual(missionProgress(g),{done:0,total:0});assert.ok(!g.protocol.events.some(e=>e.startsWith('extraction:')));}
 const g=new Game(349);g.floor=6;g.loadFloor();g.enemies.forEach(e=>e.hp=0);Object.assign(g.player,g.end);assert.ok(g.descend());assert.equal(g.status,'won');
});
test('floors 7–60 generate accessible unique enemy posts and cyclic hazards, bosses, lore and guaranteed weapons',()=>{
 for(let floor=7;floor<=60;floor++)for(const seed of [1,349]){
  const map=generate(seed,floor),info=floorInfo(floor),access=reachable(map,map.start),expected=(floor-1)%6;
  assert.equal(info.name,FLOORS[expected]);assert.equal(info.color,FLOOR_INFO[expected].color);assert.equal(info.hazard,FLOOR_INFO[expected].hazard);assert.ok(access.has(key(map.end)),`${seed}:${floor}:exit`);
  assert.equal(new Set(map.enemies.map(key)).size,map.enemies.length);assert.ok(map.enemies.every(e=>access.has(key(e))),`${seed}:${floor}:enemy`);
  assert.ok(map.hazards.every(h=>h.type===info.hazard));assert.ok(!map.items.some(i=>i.type==='lore'));assert.ok(map.items.some(i=>i.type==='weapon'&&i.weapon===info.weapon));
  assert.equal(map.enemies.filter(e=>['boss','warden'].includes(e.type)).length,info.boss?1:0);
  assert.ok(map.enemies.length>=1+8*(3+extraEnemies(floor)));assert.ok(map.enemies.length<=1+8*(4+extraEnemies(floor)));
 }
});
test('endless floors 1–6 retain the ordinary map exactly and drawing helpers never run out of floor settings',()=>{
 for(let f=1;f<=6;f++){const a=run(f),b=new Game(349,[],0,'soldier','onyx');if(f!==1){b.floor=f;b.loadFloor();}for(const key of ['grid','enemies','items','hazards','props'])assert.deepEqual(a[key],b[key]);}
 assert.equal(floorInfo(60).cycleFloor,6);assert.equal(extraEnemies(6),0);assert.equal(extraEnemies(7),1);assert.equal(extraEnemies(13),2);assert.equal(extraEnemies(19),3);assert.equal(extraEnemies(60),3);
});
test('growth rounds once after old scaling and includes bosses; generated elites are unique and deterministic',()=>{
 for(const floor of [6,7,18,60])for(const type of ['rifleman','brute','warden','boss']){const def=ENEMY_TYPES[type],base=def.hp+(['boss','warden'].includes(type)?0:Math.max(0,floor-2)*(def.fragile?2:4));assert.equal(makeEnemy(type,1,1,'x',floor).maxHp,Math.round(base*1.07**Math.max(0,floor-6)));assert.equal(scaleEnemy(def.damage+floor*2,floor,'damage'),Math.round((def.damage+floor*2)*1.04**Math.max(0,floor-6)));}
 let elites=0,total=0;for(let seed=0;seed<20;seed++){const a=generate(seed,60),b=generate(seed,60);assert.deepEqual(a.enemies,b.enemies);for(const e of a.enemies){const ts=e.traits.filter(t=>t.source==='endless:elite');assert.ok(ts.length<=1);if(['boss','warden'].includes(e.type)){assert.equal(ts.length,0);continue;}total++;if(ts.length){elites++;assert.ok(ENDLESS_TUNING.eliteTraits.includes(ts[0].id));assert.equal(e.traits.filter(t=>t.id===ts[0].id).length,1);}}}assert.ok(elites/total>.4&&elites/total<.6);assert.equal(eliteChance(7),.04);assert.equal(eliteChance(60),.5);
});
test('current save rejects excess picks, wrong floor mode, corrupt legacy allowance; old over-cap history is preserved once',()=>{
 const g=run(25);rank(g,25);const raw=JSON.parse(g.serialize());assert.ok(Game.restore(JSON.stringify(raw)));
 for(const mutate of [d=>d.pendingPerks=1,d=>d.legacyPerkPicks=-1,d=>delete d.legacyPerkPicks,d=>d.floor=ENDLESS_MAX_FLOOR+1,d=>d.mission.id='extraction']){const v=structuredClone(raw);mutate(v.data);assert.equal(Game.restore(JSON.stringify(v)),null);}
 const legacy=JSON.parse(new Game(9).serialize());legacy.version=29;Object.assign(legacy.data.player,{level:25,perks:{med:22}});Object.assign(legacy.data,{perkPicks:22,pendingPerks:2,perkDraft:{index:22,ids:['med']}});delete legacy.data.legacyPerkPicks;
 const h=Game.restore(JSON.stringify(legacy));assert.ok(h);assert.equal(h.perkPicks,22);assert.equal(h.pendingPerks,0);assert.equal(h.legacyPerkPicks,22);assert.deepEqual(h.player.perks,{med:22});assert.ok(Game.restore(h.serialize()));assert.deepEqual(h.perkChoices,[]);
 const ordinary=JSON.parse(new Game(4).serialize());ordinary.version=29;delete ordinary.data.legacyPerkPicks;assert.equal(Game.restore(JSON.stringify(ordinary)).legacyPerkPicks,0);
});
test('large protocol ledgers remain deduplicated and roundtrip in full backups with deep allies',()=>{
 const g=run(60,'druid');rank(g,25);for(const a of g.allies){a.floor=60;a.status='packed';}
 for(let f=1;f<150;f++)g.awardProtocol('floor',f);const earned=g.protocol.earned;for(let f=1;f<150;f++)g.awardProtocol('floor',f);assert.equal(g.protocol.earned,earned);
 const h=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;assert.ok(h);assert.equal(h.floor,60);assert.equal(h.protocol.events.length,149);assert.equal(h.allies[0].floor,60);
 const raw=JSON.parse(g.serialize());raw.data.protocol.events=Array(PROTOCOL_EVENT_LIMIT+1).fill('floor:1');assert.equal(Game.restore(JSON.stringify(raw)),null);
});
test('profile v5 keeps endless overall and class records separate from ordinary depth and validates backups',()=>{
 const old=normalizeProfile();old.version=4;delete old.endless;const p=validateProfile(old);assert.equal(p.version,PROFILE_VERSION);assert.deepEqual(p.endless,{best:null,byCharacter:{}});
 const g=run(25,'ninja');rank(g,25);g.player.kills=201;g.status='dead';recordEndless(p,g);assert.equal(p.bestFloor,1);assert.deepEqual(p.endless.best,{floor:25,level:25,kills:201});assert.deepEqual(p.endless.byCharacter.ninja,p.endless.best);
 assert.deepEqual(decodeBackup(JSON.stringify(makeBackup(null,p,'qa')),'qa').snapshot.profile,p);
 for(const mutate of [v=>v.endless.best.floor=1000,v=>v.endless.best.level=-1,v=>v.endless.byCharacter.unknown={floor:1,level:1,kills:0},v=>v.bestFloor=7]){const v=structuredClone(p);mutate(v);assert.throws(()=>validateProfile(v));}
});
test('death storage records endless once and migrates profile v4 without touching live keys',async()=>{
 const old=normalizeProfile();old.version=4;delete old.endless;const original=JSON.stringify(old),memory=new Map([['qa-ash-profile',original],['ash-profile','live']]);globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const s=await import('../src/storage.js?endless');assert.equal(s.profile().version,5);assert.equal(memory.get('qa-ash-profile-v4-backup'),original);
 const g=run(20);rank(g,25);g.status='dead';g.player.hp=0;s.recordResult(g);s.recordResult(g);const p=s.profile();assert.equal(p.runs,1);assert.equal(p.bestFloor,1);assert.equal(p.endless.best.floor,20);assert.equal(p.history[0].mission,'endless');assert.equal(p.history[0].level,25);assert.equal(p.history[0].floor,20);assert.ok(validateProfile(p));assert.equal(memory.get('ash-profile'),'live');delete globalThis.location;delete globalThis.localStorage;
});

test('daily and quick pools remain the original six missions',()=>{
 const original=['extraction','hunt','sweep','retrieval','roundtrip','archive'];assert.deepEqual(RANDOM_MISSION_IDS,original);
 for(let seed=0;seed<100;seed++)assert.equal(dailyMission(seed,RANDOM_MISSION_IDS),dailyMission(seed,original));
});
test('actual ranged and melee enemy attacks use deep-floor growth before defenses',()=>{
 for(const type of ['rifleman','brute','boss']){
  const g=run(18);g.grid=g.grid.map(r=>r.map(()=>1));g.lighting=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.allies=[];g.hazards=[];Object.assign(g.player,{x:10,y:10});const e=makeEnemy(type,10,11,'attack',18);Object.assign(e,{alert:true,charge:true,windup:1,aim:{x:10,y:10}});g.enemies=[e];g.reveal();g.rng=()=>0;let raw;g.damagePlayer=n=>{raw=n;};g.executeEnemy(e);assert.equal(raw,Math.round((ENEMY_TYPES[type].damage+36)*1.04**12));
 }
});
test('all modes limit a full level progression to nineteen choices',()=>{
 for(const mission of Object.keys(MISSIONS)){
  const g=new Game(349,[],0,'soldier','onyx',mission);g.enemies=[];
  for(let level=2;level<=MAX_LEVEL;level++){g.player.xp=g.player.level+1;kill(g);assert.equal(g.player.level,level);assert.equal(g.pendingPerks,1);assert.ok(g.choosePerk(g.perkChoices[0].id));}
  // Past the cap the number stops; each MAX_LEVEL+2 experience buys supplies instead of a choice.
  for(let extra=1;extra<=2;extra++){const meds=g.player.meds;g.player.xp=MAX_LEVEL+1;kill(g);
   assert.equal(g.player.level,MAX_LEVEL);assert.equal(g.pendingPerks,0);assert.equal(g.player.meds,meds+CAP_SUPPLY.meds);}
  assert.equal(g.perkPicks,19);
 }
});
