import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {createKillhouse} from '../src/killhouse.js';
import {killhouseMap,armoryWeapons} from '../src/killhouse-maps.js';
import {KILLHOUSE_OPTIONS} from '../src/killhouse-policy.js';
import {CHARACTERS} from '../src/characters.js';
import {WEAPONS} from '../src/data.js';
import {AMMO_IDS,AMMUNITION} from '../src/ammunition.js';
import {reachable,key} from '../src/world.js';
import {purgeReview} from '../src/purge-review.js';
import {normalizeProfile,creditProtocol,PROFILE_VERSION} from '../src/progression.js';
import {tutorialRequired,recordTutorial,recordArcade} from '../src/killhouse-profile.js';
import {makeBackup,decodeBackup,validateProfile} from '../src/backup.js';
import {captureAction} from '../src/presentation.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';

const enterCombat=g=>{Object.assign(g.player,g.end);assert.equal(g.descend(),true);return g;};
test('tutorial is fixed soldier, fixed geometry/population/supplies and sequential reachable rooms',()=>{
 const a=createKillhouse({seed:5,character:'recon'}),b=createKillhouse({seed:999,character:'ninja'});
 assert.equal(a.player.character,'soldier');assert.deepEqual(a.grid,b.grid);assert.deepEqual(a.enemies,b.enemies);assert.deepEqual(a.items,b.items);assert.equal(a.rooms.length,6);
 assert.ok(a.enemies.every(e=>['rifleman','raider','sniper','gunner','civilian'].includes(e.type)&&e.simulation&&!e.affixes&&!e.elite));
 // 3.88.1 (user report): the second researcher fled right and opened room 5's door, so only the left one stays.
 assert.equal(a.enemies.filter(e=>e.type==='civilian').length,1);assert.ok(a.items.some(i=>i.type==='grenade'));
 for(const b of a.barriers)b.open=true;const path=reachable(a,a.start);assert.ok(path.has(key(a.end)));assert.ok(a.rooms.every(r=>path.has(key({x:r.x+1,y:r.cy}))));
 assert.equal(a.takeRoomEvents().length,1);a.observeRoom();assert.equal(a.takeRoomEvents().length,0);
 Object.assign(a.player,{x:17,y:5});a.observeRoom();assert.equal(a.takeRoomEvents()[0].roomId,1);a.observeRoom();assert.equal(a.takeRoomEvents().length,0);
});
test('all classes use tiny enemy-free armory; all ammo and unbound weapons supplied without random mods',()=>{
 for(const character of Object.keys(CHARACTERS)){
  const g=createKillhouse({mode:'arcade',character});assert.equal(g.player.character,character);assert.equal(g.enemies.length,0);assert.equal(g.rooms[0].w*g.rooms[0].h,49);
  assert.deepEqual(g.items.filter(i=>i.type==='weapon').map(i=>i.weapon),WEAPONS.flatMap((w,i)=>w.locked?[]:[i]));
  assert.ok(g.items.filter(i=>i.type==='weapon').every(i=>g.player.affixes[i.slot]===null));assert.ok(AMMO_IDS.every(id=>g.items.some(i=>i.type===AMMUNITION[id].item)));
  const restricted=armoryWeapons(character,'class');assert.ok(restricted.every(i=>CHARACTERS[character].weapons.some(n=>WEAPONS[n].weaponClass===WEAPONS[i].weaponClass)));
 }
});
test('arcade transitions preserve loadout, do not resupply, and only combat paid turns are scored',()=>{
 const g=createKillhouse({mode:'arcade'});for(let i=0;i<7;i++)g.action('wait');g.player.hp=70;g.player.reserve=5;const before=g.turn;
 enterCombat(g);assert.equal(g.player.hp,70);assert.equal(g.player.reserve,5);assert.equal(g.simulationResult.turns,0);assert.equal(g.floor,2);assert.equal(g.simulation.battleStartTurn,before);
 for(const e of g.enemies)e.hp=0;g.action('wait');assert.equal(g.simulationResult.turns,1);const {rate}=purgeReview(g);assert.equal(g.simulationResult.rate,rate);
 g.action('prepare',{category:'item',id:null});assert.equal(g.simulationResult.turns,1);
 Object.assign(g.player,{x:g.end.x-1,y:g.end.y});const playback=captureAction(g,()=>g.action('move',[1,0]));assert.equal(playback.success,true);assert.equal(g.status,'won');assert.equal(g.simulationResult.turns,2);assert.equal(g.protocol.earned,0);
});
test('arcade recipes reachable, no runtime sources/bosses/rewards/upgrades, civilians count in purge',()=>{
 const recipes=new Set();for(let seed=0;seed<12;seed++){
  const g=enterCombat(createKillhouse({mode:'arcade',seed}));recipes.add(g.killhouseRecipe);
  for(const b of g.barriers)b.open=true;assert.ok(reachable(g,g.start).has(key(g.end)));assert.ok(!g.swarmWaves);assert.deepEqual(g.reinforcements,[]);assert.ok(g.props.every(p=>p.type==='cover'));assert.equal(g.items.length,0);
  const n=g.enemies.length,before=g.rng.state();for(const e of g.enemies)g.hurt(e,e.hp,g.player);
  assert.equal(g.enemies.length,n);assert.equal(g.player.xp,0);assert.equal(g.pendingPerks,0);assert.equal(g.player.scrap,0);assert.equal(g.items.length,0);assert.equal(g.rng.state(),before);assert.equal(purgeReview(g).rate,1);assert.equal(purgeReview(g).quota,n);
  assert.equal(g.openContainer('fake'),false);assert.equal(g.useTerminal('ammo'),false);assert.equal(g.choosePerk('damage'),false);
 }assert.equal(recipes.size,2);
});
test('walking into exit settles at the player step, before later enemies can retaliate',()=>{
 const g=enterCombat(createKillhouse({mode:'arcade'}));Object.assign(g.player,{x:g.end.x-1,y:g.end.y});for(const e of g.enemies)e.alert=true;
 let enemyActions=0;g.enemyAct=()=>{enemyActions++;g.player.hp=0;};assert.ok(g.action('move',[1,0]));assert.equal(g.status,'won');assert.equal(enemyActions,0);assert.equal(g.simulationResult.turns,1);
});
test('tutorial upgrade/drop switches are independent; default remains fixed and deaths do not restart in rules',()=>{
 const g=createKillhouse({options:{tutorialUpgrades:true,tutorialDrops:false,tutorialDeath:'menu'}});for(const e of g.enemies)g.hurt(e,e.hp,g.player);assert.ok(g.pendingPerks>0);assert.equal(g.player.scrap,0);
 const normal=createKillhouse();for(const e of normal.enemies)normal.hurt(e,e.hp,normal.player);assert.equal(normal.pendingPerks,0);assert.equal(normal.player.scrap,0);
 const dead=createKillhouse({options:{tutorialDeath:'menu'}});dead.player.hp=0;dead.action('wait');assert.equal(dead.status,'dead');assert.equal(dead.simulationResult.deathDestination,'menu');
 assert.throws(()=>createKillhouse({mode:'bad'}));assert.throws(()=>createKillhouse({options:{armory:'bad'}}));
});
test('profile v5 migrates, flags and scoped score high-water marks survive complete backups',()=>{
 const old=normalizeProfile();old.version=5;delete old.killhouse;const p=validateProfile(old);assert.equal(PROFILE_VERSION,6);assert.ok(tutorialRequired(p));recordTutorial(p,'skipped');assert.equal(tutorialRequired(p),false);
 const r={mode:'arcade',outcome:'won',rate:.8,turns:50,character:'recon'};assert.equal(recordArcade(p,r,500),true);assert.equal(recordArcade(p,r,400),false);assert.equal(recordArcade(p,r,300,{scope:'character'}),true);
 recordTutorial(p,'completed');const b=makeBackup(null,p,'qa');assert.deepEqual(decodeBackup(JSON.stringify(b),'qa').snapshot.profile,p);
 for(const mutate of [p=>p.killhouse.best.score=-1,p=>p.killhouse.best.rate=2,p=>p.killhouse.tutorial.skipped=1,p=>p.killhouse.byCharacter.invalid=p.killhouse.best]){const raw=structuredClone(p);mutate(raw);assert.throws(()=>validateProfile(raw));}
});
test('map style is floor owned, old archived floors fall back and new campaigns stay unstyled',()=>{
 const g=new Game(1);g.mapStyle='killhouse';const frame=archiveFloor(g);assert.equal(frame.mapStyle,'killhouse');assert.equal(resumedFloor(frame,g.turn+5).mapStyle,'killhouse');delete frame.mapStyle;assert.equal(resumedFloor(frame,g.turn+5).mapStyle,undefined);
 g.loadFloor();assert.equal(g.mapStyle,undefined);assert.equal(Game.restore(g.serialize()).mapStyle,undefined);
});
test('simulation save/result/abandon/export never overwrites campaign or rewards, even when dead or won',async()=>{
 const memory=new Map();globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const s=await import('../src/storage.js');const campaign=new Game(120);s.saveGame(campaign);const save=memory.get('qa-ash-save'),p=JSON.stringify(s.profile());const g=createKillhouse({mode:'arcade'});
 for(const status of ['playing','dead','won']){g.status=status;assert.equal(s.saveGame(g),true);s.recordResult(g);assert.equal(memory.get('qa-ash-save'),save);assert.equal(JSON.stringify(s.profile()),p);}
 g.status='playing';assert.equal(s.abandonRun(g),true);assert.equal(memory.get('qa-ash-save'),save);assert.equal(JSON.stringify(s.profile()),p);
 const exportData=JSON.parse(s.exportBackup(g));assert.equal(exportData.campaign.data.runId,campaign.runId);assert.throws(()=>makeBackup(g,normalizeProfile(),'qa'));assert.throws(()=>g.serialize());assert.throws(()=>s.resetProgress(g));assert.throws(()=>s.purchaseCarrying(g,'pistol',0));
 const before=normalizeProfile();g.protocol.earned=100;assert.equal(creditProtocol(before,g),0);assert.deepEqual(before.protocolRuns,{});
 const raw=JSON.parse(save);raw.data.simulation={kind:'killhouse'};assert.equal(Game.restore(JSON.stringify(raw)),null);
 assert.equal(s.saveTutorialOutcome('skipped'),true);assert.equal(s.profile().killhouse.tutorial.skipped,true);assert.equal(memory.get('qa-ash-save'),save);
});
