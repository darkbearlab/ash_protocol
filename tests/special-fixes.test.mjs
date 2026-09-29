import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Game,makeEnemy,giveEnemyAffix} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {targetDetails} from '../src/target-card.js';
import {setLanguage} from '../src/i18n.js';
import {FIELD_TUNING} from '../src/swarm-fields.js';
import {SWARM_TUNING} from '../src/swarm-tuning.js';
import {BOSS_TUNING} from '../src/loyalist-bosses.js';
import {makeReady,suppressFrom} from '../src/squad.js';
import {advanceCharge} from '../src/rebels.js';
import {interruptEnemyIntent} from '../src/enemy-intents.js';
import {createReplay} from '../src/replay.js';

// 3.206.2: the gaps the 3.206.1 refactor listed, fixed as rule changes (qa/results/2026-09-30-claude-3.206.2-special-fixes.md).
const root=fileURLToPath(new URL('../',import.meta.url));
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];Object.assign(g.player,{hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function unit(g,type,x,y,{id=type,faction='loyalist',affixes=[],state={}}={}){
 const e=makeEnemy(type,x,y,id,3,0,faction);e.hp=e.maxHp=500;e.alert=true;
 for(const a of affixes){giveEnemyAffix(e,a);e.affixes.find(x=>x.id===a).revealed=true;}
 Object.assign(e,structuredClone(state));g.enemies.push(e);g.reveal();return e;
}
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};

// A survival group's walk to its point (src/survival.js) runs before the orders and the affix branches: it used to take a
// grenadier with a grenade primed, or a gunline with its gun set up, off the tile they had warned from.
const survivalPoint=(g,x,y)=>{g.survival={open:false,points:[{id:'pt-1',x,y,hp:10}]};};
test('1. a primed grenade goes off first, from where it was primed: a survival walk no longer takes the thrower away',()=>{
 const g=field();survivalPoint(g,20,10);
 const e=unit(g,'raider',13,10,{id:'gr',faction:'rebel',affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:13,y:10}},survival:{role:'point'}}});
 g.enemyAct(e);
 assert.deepEqual([e.x,e.y],[13,10],'it threw from its tile');
 assert.ok(g.marks.some(m=>m.kind==='grenade'&&m.sourceId==='gr'&&m.x===10&&m.y===10),'the grenade is in the air');
 assert.equal(e.grenadeIntent,undefined);
 // Moved off its tile outside its turn, it still gives the throw up (and spends the turn), as before.
 const h=field(),f=unit(h,'raider',13,10,{id:'gr',affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:13,y:10}}}});
 f.x=14;h.reveal();h.enemyAct(f);assert.equal(f.grenadeIntent,undefined);assert.ok(!h.marks.some(m=>m.kind==='grenade'),'moved off its tile: dropped, not thrown');
});

test('2. a set-up machine gun sweeps first: a survival walk no longer takes it off its mount',()=>{
 const g=field();survivalPoint(g,3,20);
 const e=unit(g,'gunline',15,10,{id:'gun',state:{gun:{stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}},special:'mark',survival:{role:'point'}}});
 g.enemyAct(e);
 assert.deepEqual([e.x,e.y],[15,10],'still on its mount');
 assert.equal(e.gun?.stage,'sweep','it swept on schedule');
});

test('3. shot down in its own sweep, the gunline leaves no gun behind',()=>{
 const g=field(),e=unit(g,'gunline',15,10,{id:'gun',state:{gun:{stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}},special:'mark'}});fixed(g,0);
 const hit=g.damagePlayer.bind(g);g.damagePlayer=(...a)=>{if(e.hp>0)g.hurt(e,e.hp,g.player);return hit(...a);};   // a blast it set off
 g.enemyAct(e);
 assert.ok(e.hp<=0);assert.equal(e.gun,undefined,'no gun on the fallen boss');
});

test('4. saves: a pounce or a lob its unit could no longer finish is dropped, numbers past the tuning are cut; bad ones are still refused',()=>{
 const g=field();
 const bug=unit(g,'crawler',13,10,{id:'bug',faction:'swarm',state:{pounceIntent:{origin:{x:13,y:10},target:{x:10,y:10},point:{x:11,y:10}},pounceCooldown:1}});
 const spit=unit(g,'spitter',13,12,{id:'spit',faction:'swarm',state:{lobIntent:{origin:{x:13,y:12},point:{x:10,y:10}},lobCooldown:1}});
 const gun=unit(g,'gunline',16,16,{id:'gun',state:{gun:{stage:'sweep',origin:{x:16,y:16},aim:{x:12,y:16},left:2},special:'mark'}});
 const raw=g.serialize();
 const load=change=>{const d=JSON.parse(raw);change(d.data.enemies);return Game.restore(JSON.stringify(d));};
 const by=(s,id)=>s.enemies.find(e=>e.id===id);
 for(const [what,change] of [['moved',es=>{by({enemies:es},'bug').y=14;by({enemies:es},'spit').y=15;}],['fallen',es=>{by({enemies:es},'bug').hp=0;by({enemies:es},'spit').hp=0;}],['stunned',es=>{by({enemies:es},'bug').control={disabled:1,immune:0};by({enemies:es},'spit').control={disabled:1,immune:0};}],['pinned',es=>{by({enemies:es},'bug').suppression=3;by({enemies:es},'spit').suppression=3;}]]){
  const s=load(change);assert.ok(s,`${what}: the run loads`);
  assert.equal(by(s,'bug').pounceIntent,undefined,`${what}: the pounce is dropped`);assert.equal(by(s,'bug').pounceCooldown,SWARM_TUNING.pounceCooldown);
  assert.equal(by(s,'spit').lobIntent,undefined,`${what}: the lob is dropped`);assert.equal(by(s,'spit').lobCooldown,FIELD_TUNING.lobCooldown);
 }
 const cut=load(es=>{by({enemies:es},'bug').pounceCooldown=99;by({enemies:es},'spit').lobCooldown=99;by({enemies:es},'gun').gun.left=9;});
 assert.ok(cut,'numbers past the tuning load');
 assert.equal(by(cut,'bug').pounceCooldown,SWARM_TUNING.pounceCooldown);assert.equal(by(cut,'spit').lobCooldown,FIELD_TUNING.lobCooldown);
 assert.equal(by(cut,'gun').gun.left,BOSS_TUNING.gun.sweeps-1);assert.ok(by(cut,'bug').pounceIntent,'a live crouch is kept');
 const pack=load(es=>{by({enemies:es},'gun').gun={stage:'pack',left:9};});assert.deepEqual(by(pack,'gun').gun,{stage:'pack',left:BOSS_TUNING.gun.packUp});
 assert.equal(load(es=>{by({enemies:es},'bug').pounceIntent.origin=null;}),null,'a malformed crouch is refused');
 assert.equal(load(es=>{by({enemies:es},'spit').lobIntent.point=5;}),null,'a malformed lob is refused');
 assert.equal(load(es=>{by({enemies:es},'bug').pounceCooldown=-1;}),null,'a negative cooldown is refused');
});

test('5. an interrupted lob restarts the tuned cooldown, and a declaration cannot carry a number of its own',async()=>{
 const g=field(),e=unit(g,'spitter',13,10,{faction:'swarm',state:{lobIntent:{origin:{x:13,y:10},point:{x:10,y:10}}}});
 interruptEnemyIntent(e,'disabled');assert.equal(e.lobCooldown,FIELD_TUNING.lobCooldown);
 const fresh=await import('../src/enemy-specials.js?declaration-keys');
 assert.throws(()=>fresh.registerSpecial({id:'lob',intent:'lobIntent',fields:{lobCooldown:{count:{max:()=>10}}},interrupt:{on:['death'],cooldown:'lobCooldown',to:()=>10}}),/unknown interrupt\.to/);
 assert.throws(()=>fresh.registerSpecial({id:'pounce',intent:'pounceIntent',blok:{}}),/unknown blok/);
});

test('6. the target card names a primed grenade, a marked cone, a crouch and a swelling sac, in both languages',()=>{
 const card=(g,e)=>{g.target=e.id;return targetDetails(g).state;};
 const g=field();
 const gr=unit(g,'raider',13,10,{id:'gr',affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:13,y:10}}}});
 const st=unit(g,'raider',13,12,{id:'st',affixes:['grenadier'],state:{grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:13,y:12},stun:true}}});
 const fl=unit(g,'rifleman',13,8,{id:'fl',affixes:['flamer'],state:{flameIntent:{origin:{x:13,y:8},aim:{x:10,y:10}}}});
 const bug=unit(g,'crawler',12,13,{id:'bug',faction:'swarm',state:{pounceIntent:{origin:{x:12,y:13},target:{x:10,y:10},point:{x:11,y:10}}}});
 const sp=unit(g,'spitter',8,13,{id:'sp',faction:'swarm',state:{lobIntent:{origin:{x:8,y:13},point:{x:10,y:10}}}});
 assert.match(card(g,gr),/準備投彈/);assert.match(card(g,st),/準備投震撼彈/);assert.match(card(g,fl),/已標出火焰範圍/);assert.match(card(g,bug),/伏低準備撲擊/);assert.match(card(g,sp),/毒囊鼓起/);
 fl.y=7;assert.doesNotMatch(card(g,fl),/已標出火焰範圍/,'a cone it no longer stands at is not named');fl.y=8;
 try{setLanguage('en');assert.match(card(g,gr),/Grenade ready/);assert.match(card(g,st),/Stun grenade ready/);assert.match(card(g,fl),/Flame cone marked/);assert.match(card(g,bug),/Crouched to pounce/);assert.match(card(g,sp),/Toxic sac swelling/);}
 finally{setLanguage('zh-TW');}
});

test('6. the text client marks a crouch\'s tile, a lob\'s mist and an egg sac as danger, and lists them',()=>{
 const g=field();Object.assign(g.player,{x:10,y:10});
 unit(g,'crawler',12,11,{id:'bug',faction:'swarm',state:{pounceIntent:{origin:{x:12,y:11},target:{x:10,y:11},point:{x:11,y:11}}}});
 unit(g,'spitter',4,4,{id:'sp',faction:'swarm',state:{lobIntent:{origin:{x:4,y:4},point:{x:6,y:6}}}});
 unit(g,'hive_matriarch',16,16,{id:'mom',faction:'swarm',state:{nestIntent:{x:13,y:16}}});g.reveal();
 const dir=mkdtempSync(join(tmpdir(),'ash-textplay-')),file=join(dir,'log.json');
 try{
  writeFileSync(file,JSON.stringify(createReplay(g,{tool:'text-play'}).log));
  const run=spawnSync(process.execPath,['tools/text-play.mjs',file],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  // The map's columns: two header lines give each column's tens and ones digits, from the first column shown.
  const rows=run.stdout.split(/\r?\n/),head=rows.findIndex(r=>/^ {4}\d( \d)+ *$/.test(r));
  const column=x=>{for(let i=4;i<rows[head+1].length;i+=2)if(Number(rows[head][i])*10+Number(rows[head+1][i])===x)return i;return -1;};
  const at=(x,y)=>rows.find(r=>/^[ \d]{3} /.test(r)&&Number(r.slice(0,3))===y)?.[column(x)];
  assert.equal(at(10,11),'!','the tile the bug will land on');
  for(const [x,y] of [[6,5],[5,6],[6,6],[7,6],[6,7]])assert.equal(at(x,y),'!',`the mist at ${x},${y}`);
  assert.equal(at(13,16),'!','the egg sac');
  assert.match(run.stdout,/撲擊：bug/);assert.match(run.stdout,/毒霧：sp/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('8. squads, the watch and the rally hold no gun on the arsonist either',()=>{
 const g=field(),leader=unit(g,'squad_leader',15,15,{id:'lead',faction:'rebel'}),plain=unit(g,'rifleman',16,15,{id:'m1',faction:'rebel'}),ars=unit(g,'arsonist',17,15,{id:'ars',faction:'rebel'});
 makeReady(g,leader,[plain,ars]);assert.equal(plain.charge,true);assert.equal(ars.charge,false,'no aim held for a gun it does not have');
 assert.equal(suppressFrom(g,ars,g.player,leader),false,'no covering fire');
 ars.charge=true;ars.aim={x:10,y:10};ars.windup=1;assert.equal(advanceCharge(g,ars),null,'the rally fires nothing');
});
