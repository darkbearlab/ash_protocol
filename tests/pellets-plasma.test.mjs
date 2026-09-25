import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {WEAPONS} from '../src/data.js';
import {AFFIXES,weaponStats,rollAffix,affixAllowed,DROP_ONLY_CHANCE} from '../src/weapons.js';
import {pelletsAt,pelletChance} from '../src/shotgun.js';
import {lancePath} from '../src/lance.js';
import {targetDetails} from '../src/target-card.js';
import {addAlly} from '../src/allies.js';

// 3.141.0 (user decisions 2026-09-19, docs/WEAPONS.md): the player's shotgun fires pellets; the plasma rifle hits like an
// unaimed precision rifle and pierces fully; 貫穿 and 爆裂 are drop-only plasma affixes costing two rounds a shot.
const SG=WEAPONS.findIndex(w=>w.id==='shotgun'),PL=WEAPONS.findIndex(w=>w.id==='plasma'),RIFLE=0;
function lane(){
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));p.x=5;p.y=15;p.shell=99;p.energy=99;
 return {g,p};
}
const hold=(g,base,affix=null)=>{const p=g.player,item=g.registerWeapon({type:'weapon',weapon:base});p.affixes[item.slot]=affix;p.ammo[item.slot]=weaponStats(base,affix).mag;p.owned=[item.slot];p.weapon=item.slot;return item.slot;};
const foe=(g,type,dx,dy,id)=>{const e=makeEnemy(type,g.player.x+dx,g.player.y+dy,id,1);e.alert=false;g.enemies.push(e);g.reveal();return e;};
const pellet=(armor,cover=0)=>Math.max(1,Math.round(10*(1-cover)-armor));

test('pellets by distance, a flat 95% each; only the weapon\'s own affix and toxic mist change it',()=>{
 const w=weaponStats(SG);
 assert.deepEqual([1,2,3,4,5,6].map(d=>pelletsAt(w,d)),[6,6,5,4,3,2]);
 assert.deepEqual([w.pelletMin,w.pelletMax,w.pelletHit,w.pelletCover],[10,12,95,.6]);
 assert.equal(pelletsAt(weaponStats(SG,'longbarrel'),8),1,'a long barrel reaches one pellet past the table');
 assert.equal(pelletChance(w),95);assert.equal(pelletChance(weaponStats(SG,'stable')),99);assert.equal(pelletChance(weaponStats(SG,'extended')),87);assert.equal(pelletChance(w,true),48);
 assert.equal(pelletsAt(weaponStats(RIFLE),3),0,'only the shotgun has pellets');
});

test('armour counts against every pellet, cover cuts 60%, and darkness and movement do not matter',()=>{
 for(const type of ['brute','raider']){
  const {g}=lane();hold(g,SG);const e=foe(g,type,1,0,'e'),hp=e.hp;g.target=e.id;g.rng=()=>0;
  assert.equal(g.action('fire'),true);assert.equal(hp-e.hp,6*pellet(ENEMY_TYPES[type].armor),type);
 }
 const {g}=lane();hold(g,SG);const e=foe(g,'raider',3,0,'e');g.props=[{id:'crate',type:'cover',x:e.x-1,y:e.y,hp:500,maxHp:500}];g.reveal();
 assert.ok(g.protectingCover(e,g.player),'the crate covers it');g.target=e.id;g.rng=()=>0;const hp=e.hp;
 g.action('fire');assert.equal(hp-e.hp,5*pellet(ENEMY_TYPES.raider.armor,.6),'five pellets, each cut by 60%');
 // A dark tile and a target that just moved: every roll under .95 still lands, every roll at .95 misses.
 for(const [roll,landed] of [[.9499,true],[.95,false]]){
  const {g}=lane();hold(g,SG);const e=foe(g,'raider',2,0,'e');g.lighting[e.y][e.x]=0;e.moved=true;g.target=e.id;const hp=e.hp;
  g.rng=()=>roll;g.action('fire');assert.equal(e.hp<hp,landed,`roll ${roll}`);
 }
});

test('the target card shows the pellets instead of one chance',()=>{
 const {g}=lane();hold(g,SG);const e=foe(g,'raider',4,0,'e');g.target=e.id;g.lighting[e.y][e.x]=0;
 const card=targetDetails(g);assert.equal(card.chance,'4 顆 × 10–12 · 每顆 95%');
 assert.ok(card.state.includes('暗區（彈丸不受影響）')&&!card.state.includes('暗區 −40'));
});

test('the plasma rifle hits like a precision rifle without aiming, over the rifle\'s range, through armour and cover',()=>{
 const w=weaponStats(PL);assert.deepEqual([w.min,w.max,w.range,w.pierce,w.mag],[52,66,7,1,6]);
 assert.equal(weaponStats(PL,'piercing').pierce,1);assert.equal(weaponStats(WEAPONS.findIndex(x=>x.id==='sniper'),'piercing').pierce,.95,'the precision rifle keeps its cap');
 const {g,p}=lane();hold(g,PL);const e=foe(g,'brute',3,0,'e');g.props=[{id:'crate',type:'cover',x:e.x-1,y:e.y,hp:500,maxHp:500}];g.reveal();
 const hp=e.hp;g.hitTarget(e,60,p,weaponStats(PL).pierce,weaponStats(PL));
 assert.equal(hp-e.hp,ENEMY_TYPES.brute.mechanical?72:60,'neither armour 7 nor the crate takes anything off');
});

// 3.155.0: 短管 joins the ordinary pool, so which tradeoff a gun carries is drawn from seven instead of six. How often a
// gun carries one at all, and the drop-only rolls, are untouched — that is what this pins now.
test('貫穿 and 爆裂 come only on dropped plasma rifles, 15% each, and the ordinary pool is the seven tradeoffs',()=>{
 for(const id of ['lance','burst']){assert.deepEqual(AFFIXES[id].dropOnly,['plasma']);assert.equal(AFFIXES[id].shotCost,2);assert.equal(AFFIXES[id].damage,.85);}
 assert.ok(affixAllowed(PL,'lance')&&!affixAllowed(RIFLE,'lance')&&!affixAllowed(SG,'burst')&&affixAllowed(RIFLE,'stable')&&affixAllowed(RIFLE,null));
 // The rolls before 3.141.0, for comparison.
 const fnv=seed=>{let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
 const old=(base,seed)=>{const h=fnv(seed);if(h%100>=65)return null;const ids=['stable','piercing','extended','powerful','longbarrel','shortbarrel','tracking'].filter(id=>id!=='piercing'||!WEAPONS[base].explosive);return ids[Math.floor(h/100)%ids.length];};
 const count={lance:0,burst:0,rapid:0};let same=0,plain=0;   // 3.142.0: 速射 joins them
 for(let seed=0;seed<4000;seed++){
  assert.equal(rollAffix(RIFLE,seed),old(RIFLE,seed));
  // 3.141.1: a shotgun that would have rolled 追獵 re-picks one of the other five; every other shotgun roll is the old one.
  if(old(SG,seed)==='tracking')assert.ok(['stable','piercing','extended','powerful','longbarrel','shortbarrel'].includes(rollAffix(SG,seed)));else assert.equal(rollAffix(SG,seed),old(SG,seed));
  const a=rollAffix(PL,seed);if(a in count)count[a]++;else{plain++;same+=a===old(PL,seed);}
 }
 assert.equal(same,plain,'a plasma rifle that rolls neither keeps its old roll');
 for(const n of Object.values(count))assert.ok(Math.abs(n/4000-DROP_ONLY_CHANCE)<.02,String(n));
 // A save cannot carry one on another weapon.
 const g=new Game(5),raw=JSON.parse(g.serialize());raw.data.player.affixes[RIFLE]='lance';assert.equal(Game.restore(JSON.stringify(raw)),null);
 raw.data.player.affixes[RIFLE]=null;raw.data.player.affixes[PL]='burst';assert.ok(Game.restore(JSON.stringify(raw)));
 raw.data.player.affixes[SG]='tracking';assert.ok(Game.restore(JSON.stringify(raw)),'a 追獵 shotgun from before 3.141.1 still loads');
});

test('a two-round affix spends two a shot and will not fire on one',()=>{
 const {g,p}=lane(),slot=hold(g,PL,'burst'),e=foe(g,'raider',4,0,'e');g.target=e.id;g.rng=()=>.99;
 assert.equal(g.weapon.name,'爆裂・電漿步槍');assert.equal(g.weapon.min,Math.round(52*.85));
 assert.equal(g.action('fire'),true);assert.equal(p.ammo[slot],4);
 p.ammo[slot]=1;const turn=g.turn;assert.equal(g.action('fire'),false);assert.equal(g.turn,turn);assert.equal(g.refusal.cue,'reload_needed');assert.match(g.refusal.text,/彈匣不足 2 發/);   // 3.163.0: spoken, not logged
});

test('貫穿 hits every visible unit on the line, friends too, and stops at the first crate past the target',()=>{
 const {g,p}=lane();hold(g,PL,'lance');
 const near=foe(g,'raider',1,0,'near'),aim=foe(g,'raider',2,0,'aim'),far=foe(g,'raider',4,0,'far'),hidden=foe(g,'raider',6,0,'hidden');
 g.props=[{id:'crate',type:'cover',x:p.x+5,y:p.y,hp:500,maxHp:500}];g.reveal();
 const path=lancePath(g,p,aim,7);assert.deepEqual(path.units.map(o=>o.id),['near','aim','far']);assert.equal(path.stop.id,'crate');
 g.target=aim.id;g.rng=()=>0;const hp=[near,aim,far,hidden].map(e=>e.hp),crate=g.props[0].hp;
 assert.equal(g.action('fire'),true);
 assert.deepEqual([near,aim,far,hidden].map((e,i)=>e.hp<hp[i]),[true,true,true,false],'the crate stops it before the last one');
 assert.ok(g.props[0].hp<crate,'the crate takes the hit');
 assert.equal(p.ammo[p.weapon],4);
 // A wall past the target ends it too, and the card warns about a friend on the line.
 const second=lane();hold(second.g,PL,'lance');const t=foe(second.g,'raider',2,0,'t');second.g.grid[second.p.y][second.p.x+3]=0;
 assert.deepEqual(lancePath(second.g,second.p,t,7).units.map(o=>o.id),['t']);assert.equal(lancePath(second.g,second.p,t,7).stop,null);
 const friend=addAlly(second.g,'survivor','rifleman',{point:{x:second.p.x+1,y:second.p.y}});assert.ok(friend);second.g.target=t.id;
 assert.deepEqual(lancePath(second.g,second.p,t,7).units.map(o=>o===friend?'friend':o.id),['friend','t']);
 assert.ok(targetDetails(second.g).state.includes('⚠ 含友軍 1'));
 const friendHp=friend.hp;second.g.rng=()=>0;assert.equal(second.g.action('fire'),true);assert.ok(friend.hp<friendHp,'the beam does not spare a friend');
});

test('爆裂 bursts where it hits: neighbours take about half, the target only its hit, and it can reach you',()=>{
 const {g,p}=lane();hold(g,PL,'burst');const e=foe(g,'raider',1,0,'e'),next=foe(g,'raider',2,0,'next');
 g.target=e.id;g.rng=()=>0;const hp=[e.hp,next.hp],me=p.hp,hit=Math.round(52*.85);
 assert.equal(g.action('fire'),true);
 assert.equal(hp[0]-e.hp,Math.max(1,hit-ENEMY_TYPES.raider.armor),'the target takes only its hit');
 assert.equal(hp[1]-next.hp,Math.round(hit*.5),'one tile away: half the hit');
 assert.ok(p.hp<me,'you stood next to it');
});

// 3.142.0 (playtest fixes, user proposal).
test('full piercing goes through cover without claiming it absorbed anything; a normal shot still says so',()=>{
 for(const [base,absorbed] of [[PL,false],[RIFLE,true]]){
  const {g,p}=lane();hold(g,base);const e=foe(g,'raider',3,0,'e');g.props=[{id:'crate',type:'cover',x:e.x-1,y:e.y,hp:500,maxHp:500}];g.reveal();
  g.hitTarget(e,40,p,weaponStats(base).pierce,weaponStats(base));assert.equal(g.logs.some(l=>l.text.includes('掩體吸收')),absorbed,WEAPONS[base].id);
 }
});

test('the shotgun card shows what a pellet really does after armour and cover; 爆裂 warns about its blast; short magazines say so',()=>{
 const {g}=lane();hold(g,SG);const e=foe(g,'brute',1,0,'e');g.target=e.id;const armor=ENEMY_TYPES.brute.armor;
 assert.equal(targetDetails(g).chance,`6 顆 × ${Math.max(1,10-armor)}–${Math.max(1,12-armor)}（原 10–12） · 每顆 95%`);
 const plain=lane();hold(plain.g,SG);const r=foe(plain.g,'raider',1,0,'r');plain.g.target=r.id;
 if(!ENEMY_TYPES.raider.armor)assert.equal(targetDetails(plain.g).chance,'6 顆 × 10–12 · 每顆 95%','no note when nothing changes');
 const second=lane();hold(second.g,PL,'burst');const t=foe(second.g,'raider',1,0,'t');second.g.target=t.id;
 assert.ok(targetDetails(second.g).state.includes('⚠ 爆炸波及自己'));
 second.p.ammo[second.p.weapon]=1;assert.equal(targetDetails(second.g).chance,'彈匣不足 2 發');
});

test('速射: one battery fires three ordinary rounds at half piercing, and a volley that lands suppresses',()=>{
 const w=weaponStats(PL,'rapid');assert.deepEqual([w.name,w.min,w.max,w.pierce,w.burst,w.volleyCost,w.mag],['速射・電漿步槍',18,22,.5,3,1,6]);
 assert.deepEqual(AFFIXES.rapid.dropOnly,['plasma']);assert.ok(!affixAllowed(RIFLE,'rapid'));
 const {g,p}=lane(),slot=hold(g,PL,'rapid'),e=foe(g,'raider',3,0,'e');e.hp=e.maxHp=500;g.target=e.id;g.rng=()=>0;
 const shots=p.stats.shots,hp=e.hp;assert.equal(g.action('fire'),true);
 assert.equal(p.ammo[slot],5,'one battery for the volley');assert.equal(p.stats.shots-shots,3,'three rounds');
 assert.equal(hp-e.hp,3*Math.max(1,Math.round(18-ENEMY_TYPES.raider.armor*.5)));
 // Suppression lands with the volley and the enemy's own turn then halves it, so look before that turn (fire, not action).
 for(const [affix,suppressed] of [['rapid',true],[null,false]]){
  const s=lane();hold(s.g,PL,affix);const t=foe(s.g,'raider',3,0,'t');t.hp=t.maxHp=500;s.g.target=t.id;s.g.rng=()=>0;
  s.g.fire();assert.equal((t.suppression||0)>=1,suppressed,affix?'the three-round volley suppresses':'a single plasma shot does not');
 }
 const b=lane();hold(b.g,PL,'rapid');const brute=foe(b.g,'brute',3,0,'b');brute.hp=brute.maxHp=500;b.g.target=brute.id;b.g.rng=()=>0;const bhp=brute.hp;
 b.g.action('fire');assert.equal(bhp-brute.hp,3*Math.max(1,Math.round(18-ENEMY_TYPES.brute.armor*.5)),'armour 7 takes 3.5 off each round');
 p.ammo[slot]=0;assert.equal(g.action('fire'),false,'empty is empty');
});

test('the lance names which unit on the beam it missed',()=>{
 const {g}=lane();hold(g,PL,'lance');const a=foe(g,'raider',1,0,'a'),b=foe(g,'raider',2,0,'b');g.target=b.id;g.rng=()=>.999;
 g.action('fire');assert.ok(g.logs.some(l=>l.text.startsWith('光束沒打中第 1 個：'))&&g.logs.some(l=>l.text.startsWith('光束沒打中第 2 個：')));
});

// 3.142.1 (user, after the playtest).
test('every unit on the lance beam rolls against the locked target\'s chance, however dark it stands',()=>{
 const {g,p}=lane();hold(g,PL,'lance');const aim=foe(g,'raider',2,0,'aim'),dark=foe(g,'raider',4,0,'dark');g.lighting[dark.y][dark.x]=0;g.target=aim.id;
 const own=g.accuracy(p,dark).chance,shared=g.fireChance(aim);assert.ok(own<shared,'the dark one would have been harder to hit on its own');
 const roll=(own+1)/100;g.rng=()=>roll;const hp=dark.hp;g.action('fire');
 assert.ok(dark.hp<hp,`a roll of ${Math.round(roll*100)} hits it at the target's ${shared}%`);
});

test('a hazard underfoot says what hurt the enemy instead of 命中',()=>{
 const {g}=lane();const e=foe(g,'raider',3,0,'e');e.hp=e.maxHp=500;g.hazards=[{type:'acid',x:e.x,y:e.y}];g.environmentTurn();
 assert.ok(g.logs.some(l=>l.text.includes('踩到污染液，受到 6 傷害')));assert.ok(!g.logs.some(l=>l.text.startsWith('命中')));
});

