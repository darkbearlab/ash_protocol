import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {ENEMY_AFFIXES,giveEnemyAffix} from '../src/enemy-affixes.js';
import {HOOK_TUNING} from '../src/swarm.js';
import {SPAWN_TUNING,laidNests} from '../src/swarm-bosses.js';
import {ACID_BLOOD} from '../src/swarm-fields.js';
import {t} from '../src/i18n.js';
import {makeBarrier} from '../src/barriers.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';

// 3.220.0 (user 2026-10-01, docs/ENEMY_VARIETY.md 10.5-10.7): three ordinary affixes for the swarm's own.
// 產卵 lays a sac that hatches larvae; 鉤舌 hooks you in from four tiles; 酸血 spills acid where it dies.
const hard={curve:'hard',offset:0};
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=[];g.flares=[];g.facilityFaction='swarm';Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return g;}
function bug(g,type,x,y=10,affix=null,id=`b${g.enemies.length}`){const e=makeEnemy(type,x,y,id,6,hard,'swarm');if(affix)giveEnemyAffix(e,affix);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);g.reveal();return e;}
const turn=(g,e)=>{g.turn++;g.enemyAct(e);};
const def=id=>ENEMY_AFFIXES.find(a=>a.id===id);

test('who: the swarm\'s own that bleed — 鉤舌 the biters, 產卵 no infected, 酸血 the infected too; never a boss, larva or suicide bug',()=>{
 const of=(type,faction='swarm')=>makeEnemy(type,1,1,'x',6,hard,faction),fits=id=>['crawler','giant_bug','spitter','rifleman_infected','raider_infected','bomber','fodder','hive_beast'].filter(k=>def(id).applies(of(k)));
 assert.deepEqual(fits('hook'),['crawler','giant_bug']);
 assert.deepEqual(fits('spawn'),['crawler','giant_bug','spitter']);
 assert.deepEqual(fits('acid_blood'),['crawler','giant_bug','spitter','rifleman_infected','raider_infected']);
 for(const id of ['hook','spawn','acid_blood']){assert.ok(!def(id).special,id);assert.equal(def(id).applies(of('rifleman','loyalist')),false,`${id}: not a human floor`);}
});

test('鉤舌: within four tiles in a clear line it warns a round, then pulls you beside it — no bite; then its cooldown',()=>{
 const g=field(),p=g.player,e=bug(g,'giant_bug',14,10,'hook');
 turn(g,e);assert.ok(e.tongueIntent,'the warning');assert.ok(e.affixes.find(a=>a.id==='hook').revealed);assert.ok(g.logs.some(l=>l.text===t('hook.taut',{enemy:enemyDisplayName(e)})),'its own name, not the boss');
 turn(g,e);assert.deepEqual([p.x,p.y],[13,10],'pulled beside it');assert.equal(p.hp,999,'no bite');assert.equal(e.tongueCooldown,HOOK_TUNING.cooldown);
 const far=field(),f=bug(far,'giant_bug',15,10,'hook');turn(far,f);assert.ok(!f.tongueIntent,'five tiles: out of reach');
 const plain=field(),q=bug(plain,'giant_bug',14,10);turn(plain,q);assert.ok(!q.tongueIntent,'no affix, no tongue');
 const back=Game.restore((()=>{const s=field(),h=bug(s,'giant_bug',14,10,'hook');turn(s,h);s.rng=new Game(1,[],0,'soldier','onyx').rng;return s.serialize();})());assert.ok(back,'the warning saves');
});

test('產卵: seeing you within seven it lays a sac that hatches into a nest of two; one standing, two in all',()=>{
 const g=field(),p=g.player,e=bug(g,'giant_bug',16,10,'spawn');
 turn(g,e);assert.ok(e.nestIntent,'the sac');assert.equal(Math.abs(e.nestIntent.x-e.x)+Math.abs(e.nestIntent.y-e.y),1,'beside the bug');assert.ok(e.affixes.find(a=>a.id==='spawn').revealed);assert.ok(g.logs.some(l=>l.text===t('swarmBosses.eggLaid',{enemy:enemyDisplayName(e)})));
 turn(g,e);const nests=laidNests(g,e);assert.equal(nests.length,1,'hatched');assert.equal(nests[0].nest.total,SPAWN_TUNING.brood);
 g.rng=new Game(1,[],0,'soldier','onyx').rng;assert.ok(Game.restore(g.serialize()),'a nest of its own saves');
 g.rng=Object.assign(()=>0,{state:()=>1});e.nestCooldown=0;turn(g,e);assert.ok(!e.nestIntent,'one standing at a time');
 nests[0].hp=0;e.nestCooldown=0;turn(g,e);assert.ok(e.nestIntent,'the second, once the first is gone');turn(g,e);
 for(const n of laidNests(g,e))n.hp=0;e.nestCooldown=0;turn(g,e);assert.ok(!e.nestIntent,`only ${SPAWN_TUNING.charges} in all`);
 const far=field(),f=bug(far,'giant_bug',18,10,'spawn');turn(far,f);assert.ok(!f.nestIntent,'eight tiles: too far');
});

test('酸血: where it dies, acid on its tile and the four beside it, for a few rounds',()=>{
 const g=field(),e=bug(g,'crawler',13,10,'acid_blood');g.enemyAct=()=>{};g.hurt(e,e.hp,g.player);
 const acid=g.hazards.filter(h=>h.type==='acid');assert.equal(acid.length,5);assert.ok(acid.every(h=>h.expires===g.turn+ACID_BLOOD.turns));
 assert.ok(e.affixes.find(a=>a.id==='acid_blood').revealed);assert.ok(g.logs.some(l=>l.text===t('acid.spill',{enemy:enemyDisplayName(e)})));
 for(let i=0;i<ACID_BLOOD.turns;i++)g.action('wait');assert.equal(g.hazards.filter(h=>h.type==='acid').length,0,'dried up');
 const k=field();k.hazards.push({x:12,y:10,type:'acid'});k.enemyAct=()=>{};for(let i=0;i<6;i++)k.action('wait');assert.equal(k.hazards.length,1,"a spitter's pool stays");
});

// 3.220.0 review: acid does not run under a closed door; on a floor you leave it waits with the floor.
test('review: acid stops at a door; a kept floor keeps its acid',()=>{
 const g=field(),e=bug(g,'crawler',11,10,'acid_blood');g.barriers.push(makeBarrier('door',{x:11,y:10},{x:12,y:10},'edge-acid'));g.hurt(e,e.hp,g.player);
 assert.ok(!g.hazards.some(h=>h.x===12&&h.y===10),'not behind the door');assert.ok(g.hazards.some(h=>h.x===11&&h.y===9));
 const archive=archiveFloor(g),back=resumedFloor(archive,g.turn+30);assert.ok(back.hazards.every(h=>h.expires===g.turn+30+ACID_BLOOD.turns),'the clock waited');
});
