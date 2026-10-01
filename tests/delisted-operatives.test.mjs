import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFamily} from './helpers/source.mjs';
import {Game,makeEnemy,generate,ENEMY_TYPES,SAVE_VERSION,scaleEnemy,floorDamageBonus,isBossClass,enemyDisplayName} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {FACTIONS} from '../src/faction-catalog.js';
import {OPERATIVE_CLASSES,OPERATIVE_DRAW,drawFloor,drawnOperative,operativeCode,operativeType,setOperativeDraw,validOperativeCode} from '../src/operative-draw.js';
import {OPERATIVE_TUNING,SCANNED,LAST_WORDS,smokePoint,smokeTelegraphs,droneKind,ownDrones,cloaked,scanAccuracy,scanDamage,tickOperatives} from '../src/delisted-operatives.js';
import {cloneDesignation} from '../src/purge-review.js';
import {PROTOCOL_REWARDS} from '../src/progression.js';
import {applyDisruption,SMOKE_DURATION} from '../src/throwables.js';
import {interruptEnemyIntent} from '../src/enemy-intents.js';
import {blocked,ORDER} from '../src/enemy-specials.js';
import {addAlly} from '../src/allies.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {bossIntroLines,bossKillLine} from '../src/boss-scenes.js';
import {CalloutBoard,calloutLine} from '../src/callout-ui.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {targetDetails} from '../src/target-card.js';
import {enemyBand} from '../src/range-band.js';
import {t} from '../src/i18n.js';
import {detectors} from '../src/detection.js';
import {timedStatuses} from '../src/status-timers.js';
import en from '../src/text-en.js';

// 3.207.0 (user design 2026-09-29, docs/BOSSES.md section 5): the delisted operatives. The draw, the five classes, their
// serials, the intro and kill lines, the last words, the cloak alert and their saves.
const T=OPERATIVE_TUNING;
function field(character='soldier'){
  const g=affixArena(character);clearGeneratedMap(g);g.fires=undefined;g.flares=[];g.facilityFaction='loyalist';
  Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();
  return g;
}
const op=(g,cls,x,y,id=`op-${cls}`)=>{const e=makeEnemy(operativeType(cls),x,y,id,6,0,'loyalist');e.alert=true;e.code='R-0317';g.enemies.push(e);g.reveal();return e;};
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};
const wall=(g,x,y)=>{g.grid[y][x]=0;g.lighting[y][x]=0;};
const logged=(g,id,vars={})=>g.logs.some(l=>l.text===t(id,vars));
const k=q=>`${q.x},${q.y}`;
const withDraw=(fn,body)=>{setOperativeDraw(fn);try{return body();}finally{setOperativeDraw(null);}};

test('the cards: five classes, the user\'s hit points and armour, human bosses with no 快速 or 紅外線',()=>{
  assert.deepEqual(OPERATIVE_CLASSES,['soldier','recon','engineer','berserker','ninja'],'no heavy (bulwark) for now');
  const table=Object.fromEntries(OPERATIVE_CLASSES.map(c=>{const d=ENEMY_TYPES[operativeType(c)];return [c,[d.hp,d.armor]];}));
  assert.deepEqual(table,{soldier:[320,0],recon:[240,0],engineer:[240,0],berserker:[380,3],ninja:[200,0]});
  for(const c of OPERATIVE_CLASSES){const d=ENEMY_TYPES[operativeType(c)];
    assert.ok(isBossClass(operativeType(c)));assert.equal(d.operative,c);assert.ok(!d.mechanical,'flesh');assert.equal(d.reinforcement,undefined,'no drones at half health');
    assert.deepEqual(d.barredAffixes,['fast','infrared']);assert.equal(PROTOCOL_REWARDS[operativeType(c)],PROTOCOL_REWARDS.gunline);
    const e=makeEnemy(operativeType(c),1,1,'x',6,0,'loyalist');assert.ok(e.traits.some(s=>s.id==='biological'),'a stun grenade works on it');}
  assert.ok(ENEMY_TYPES.delisted_recon.traits.includes('infrared'),'the recon sees through smoke (its class rule)');
  assert.ok(!ENEMY_TYPES.delisted_soldier.traits.includes('infrared'));
  assert.equal(ENEMY_TYPES.delisted_soldier.grenades,true);assert.deepEqual(ENEMY_TYPES.delisted_berserker.specials,['charge','tongue']);assert.equal(ENEMY_TYPES.delisted_berserker.grapple,true);
  assert.equal(ENEMY_TYPES.delisted_ninja.knife,36);assert.deepEqual(enemyBand('delisted_ninja'),[1,4],'it closes in');
  // Guns (Claude's, docs/BOSSES.md section 5: about four of its turns to kill you in the open, eight or so behind cover).
  assert.deepEqual(OPERATIVE_CLASSES.map(c=>[ENEMY_TYPES[operativeType(c)].damage,ENEMY_TYPES[operativeType(c)].range,ENEMY_TYPES[operativeType(c)].rounds]),[[42,7,4],[42,8,3],[20,5,4],[32,1,1],[28,5,4]]);
});

test('the draw: 30% of loyalist and rebel floor 6, then every boss floor in endless; a hash of the seed, no dice',()=>{
  assert.deepEqual([3,5,6,7,9,12,15,18].map(drawFloor),[false,false,true,false,true,true,true,true]);
  assert.deepEqual(Object.keys(FACTIONS).filter(f=>FACTIONS[f].delisted),['loyalist','rebel']);
  for(const f of ['legacy','swarm'])for(let s=1;s<=50;s++)assert.equal(drawnOperative(s,6,f),null,f);
  for(const floor of [6,9,12]){
    let n=0;const seen=new Set();for(let s=1;s<=2000;s++){const c=drawnOperative(s,floor,'loyalist');if(c){n++;seen.add(c);}assert.equal(c,drawnOperative(s,floor,'rebel'));}
    assert.ok(n/2000>OPERATIVE_DRAW.chance-.04&&n/2000<OPERATIVE_DRAW.chance+.04,`${floor}: ${n/2000}`);assert.equal(seen.size,5);
  }
  for(let s=1;s<=40;s++)assert.equal(drawnOperative(s,3,'loyalist'),null,'floor 3 keeps its boss');
  // A drawn floor holds the operative at the boss's post, with its serial; everything else is what the undrawn floor holds.
  for(let seed=1;seed<=6;seed++)for(const faction of ['loyalist','rebel']){
    const plain=withDraw(()=>null,()=>generate(seed,6,[],0,faction)),drawn=withDraw(()=>'ninja',()=>generate(seed,6,[],0,faction));
    const boss=plain.enemies.find(e=>isBossClass(e)),o=drawn.enemies.find(e=>isBossClass(e));
    assert.equal(o.type,'delisted_ninja');assert.equal(o.id,boss.id);assert.deepEqual([o.x,o.y],[boss.x,boss.y]);
    assert.equal(o.code,operativeCode(seed,6,o.id));assert.ok(validOperativeCode(o.code));assert.equal(o.hp,200,'no floor hit-point bonus, as the other bosses');
    const rest=m=>JSON.stringify({...m,enemies:m.enemies.filter(e=>e.id!==boss.id)});assert.equal(rest(drawn),rest(plain),`${faction} ${seed}`);
    assert.ok(!o.affixes.some(a=>['fast','infrared'].includes(a.id)));
  }
  // The live draw: seed 1 floor 6 meets a berserker, the same run after run.
  assert.equal(drawnOperative(1,6,'loyalist'),'berserker');assert.equal(generate(1,6,[],0,'loyalist').enemies.find(e=>isBossClass(e)).type,'delisted_berserker');
  assert.equal(JSON.stringify(generate(1,6,[],0,'loyalist')),JSON.stringify(generate(1,6,[],0,'loyalist')));
});

test('the serial: the clone format, fixed by the seed, floor and id; the name is the class and the serial',()=>{
  assert.equal(operativeCode(7,6,'6-2-0'),cloneDesignation('7:6:6-2-0:delisted-v1'));
  for(let s=1;s<=200;s++)assert.ok(/^[A-Z]-\d{4}$/.test(operativeCode(s,6,'6-2-0'))&&validOperativeCode(operativeCode(s,6,'6-2-0')));
  assert.ok(!validOperativeCode('I-0001')&&!validOperativeCode('R-317')&&!validOperativeCode(3170));
  const g=field(),e=op(g,'soldier',14,10);
  assert.equal(enemyDisplayName(e),'士兵 R-0317');e.code='K-0472';assert.equal(enemyDisplayName(e),'士兵 K-0472');
  assert.equal(en['operatives.unitName'],'{label} {code}');
  for(const [c,label] of [['recon','偵察兵'],['engineer','工程師'],['berserker','狂戰士'],['ninja','忍者']])assert.equal(enemyDisplayName(op(field(),c,14,10)),`${label} R-0317`,'the glossary\'s class labels');
  // Review: a card on its own (the hostile database) has no serial: it keeps the card's name.
  for(const c of OPERATIVE_CLASSES)assert.equal(enemyDisplayName({type:operativeType(c),faction:'loyalist'}),ENEMY_TYPES[operativeType(c)].name);
  assert.equal(enemyDisplayName({type:'delisted_soldier',faction:'rebel'}),'除名士兵');
});

test('士兵: early warning through walls every five rounds — its shots at the scanned get +10 and +10%, and it knows where you are',()=>{
  const g=field(),e=op(g,'soldier',16,10),p=g.player;wall(g,13,10);wall(g,13,9);wall(g,13,11);g.reveal();
  assert.equal(g.sight(e,p),false,'a wall between');
  const pet=addAlly(g,'pet','crawler',{point:{x:10,y:12}});pet.hp=pet.maxHp=300;
  g.enemyAct(e);
  assert.ok(p.traits.some(s=>s.id===SCANNED&&s.turns===T.scan.turns&&s.source==='boss:scan'));assert.ok(pet.traits.some(s=>s.id===SCANNED),'your units in reach too');
  assert.deepEqual(e.lastKnown,{x:10,y:10});assert.equal(e.scanCooldown,T.scan.cooldown);assert.ok(timedStatuses(g).includes(t('status-timers.scanned',{n:2,accuracy:10,damage:10})),'the status line');assert.ok(logged(g,'operatives.scan',{enemy:enemyDisplayName(e)}));
  assert.deepEqual(T.scan,{radius:8,cooldown:5,turns:2,accuracy:10,damage:.1});
  // Its own shots only (your early warning helps only you).
  const other=makeEnemy('rifleman',16,12,'r',6,0,'loyalist');g.enemies.push(other);
  assert.equal(scanAccuracy(g,e,p),10);assert.equal(scanAccuracy(g,other,p),0);assert.ok(Math.abs(scanDamage(g,e,p)-1.1)<1e-9);assert.equal(scanDamage(g,other,p),1);
  const bare=field(),b=op(bare,'soldier',14,10);assert.equal(bare.accuracy(b,bare.player).scanBonus,0);
  grantTrait(bare.player,SCANNED,'boss:scan',2);assert.equal(bare.accuracy(b,bare.player).scanBonus,10);
  const hurt=scanned=>{const h=field(),s=op(h,'soldier',14,10);if(scanned)grantTrait(h.player,SCANNED,'boss:scan',2);h.damagePlayer(100,'x',s);return 999-h.player.hp;};
  assert.equal(hurt(true),Math.round(hurt(false)*1.1));
  // It lasts this round and the next; nobody within eight steps, no scan (and the cooldown is kept).
  g.action('wait');assert.equal(p.traits.find(s=>s.id===SCANNED)?.turns,1);g.action('wait');assert.ok(!p.traits.some(s=>s.id===SCANNED));
  const far=field(),f=op(far,'soldier',19,10);far.enemyAct(f);assert.ok(!far.player.traits.some(s=>s.id===SCANNED));assert.equal(f.scanCooldown,undefined);
  // The status line says so; another floor ends it.
  const r=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'loyalist'});grantTrait(r.player,SCANNED,'boss:scan',2);
  assert.ok(r.player.traits.some(s=>s.id===SCANNED));Object.assign(r.player,r.exitPoint);assert.equal(r.exitBlocked,'');assert.ok(r.descend());assert.equal(r.floor,2);
  assert.ok(!r.player.traits.some(s=>s.id===SCANNED),'another floor ends it');
});

test('士兵: too close, it readies a grenade (the grenadier\'s throw) instead of its shot, then not again for four rounds',()=>{
  const g=field(),e=op(g,'soldier',12,10);Object.assign(e,{scanCooldown:5,charge:true,aim:{x:10,y:10},windup:1});
  g.enemyAct(e);
  assert.deepEqual(e.grenadeIntent,{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:12,y:10}});assert.equal(e.grenadeCooldown,T.grenade.cooldown);
  assert.equal(e.charge,false,'no shot left wound up');assert.ok(g.effects.some(f=>f.type==='enemyTelegraph'&&f.phase==='prepare'));
  g.effects=[];g.enemyAct(e);
  assert.equal(e.grenadeIntent,undefined);assert.ok(g.marks.some(m=>m.kind==='grenade'&&m.sourceId===e.id&&m.x===10&&m.y===10&&m.damage>0));
  // Still close, still cooling down: it shoots instead.
  e.grenadeCooldown=2;g.enemyAct(e);assert.equal(e.grenadeIntent,undefined);
  // At a middle distance it never readies one.
  const mid=field(),m=op(mid,'soldier',14,10);m.scanCooldown=5;mid.enemyAct(m);assert.equal(m.grenadeIntent,undefined);
  assert.deepEqual(T.grenade,{near:2,reach:3,cooldown:4});
  // Review: never beside you, where the blast (radius 1 on your tile) would reach it too; it shoots instead.
  const side=field(),b=op(side,'soldier',11,10);b.scanCooldown=5;side.enemyAct(b);
  assert.equal(b.grenadeIntent,undefined);assert.equal(b.charge,true,'it winds up its rifle');assert.equal(b.grenadeCooldown,undefined);
});

test('偵察兵: smoke between you, a round of warning, eight rounds from throw to throw; it sees and shoots you through it',()=>{
  const g=field(),e=op(g,'recon',16,10),p=g.player;
  assert.deepEqual(smokePoint(g,e,p),{x:13,y:10},'halfway along the line');
  g.enemyAct(e);
  assert.deepEqual(e.smokeIntent,{origin:{x:16,y:10},point:{x:13,y:10}});assert.equal(e.charge,false);
  assert.deepEqual(smokeTelegraphs(g).map(s=>[s.sourceId,s.cells.length]),[[e.id,13]]);assert.ok(targetDetails(Object.assign(g,{target:e.id}))?.state?.includes(t('target-card.smokeReady')));
  assert.ok(blocked(e,'decoy')&&blocked(e,'mine')&&blocked(e,'stepOff'),'warned, it goes off first');
  g.enemyAct(e);
  const cloud=g.smoke.at(-1);assert.equal(e.smokeIntent,undefined);assert.equal(e.smokeCooldown,T.smoke.cooldown);
  assert.equal(cloud.cells.length,13);assert.equal(cloud.expires,g.turn+SMOKE_DURATION-1);assert.ok(cloud.cells.some(q=>q.x===13&&q.y===10));
  assert.equal(g.sight(e,p),true,'it sees you through its smoke');assert.equal(g.sight(p,e),false,'you do not see it');assert.ok(!g.visibleEnemies.includes(e));
  // It fires through the smoke once its shot is wound up.
  fixed(g,0);g.enemyAct(e);g.enemyAct(e);assert.ok(p.hp<999,'shot through the smoke');
  // Throw to throw: eight rounds (cooldown 7 plus the round of warning).
  const r=field(),c=op(r,'recon',16,10);r.player.hp=r.player.maxHp=1e6;const thrown=[];
  for(let i=0;i<20;i++){const before=r.smoke.length;r.action('wait');if(r.smoke.length>before||r.logs.some(l=>l.turn===r.turn&&l.text===t('operatives.smokeThrown',{enemy:enemyDisplayName(c)})))thrown.push(r.turn);r.player.hp=1e6;}
  const throws=[...new Set(thrown)].filter(n=>r.logs.some(l=>l.turn===n&&l.text===t('operatives.smokeThrown',{enemy:enemyDisplayName(c)})));
  assert.ok(throws.length>=2,JSON.stringify(throws));for(let i=1;i<throws.length;i++)assert.equal(throws[i]-throws[i-1],8);
  // Too close to bother, or it cannot see you: no smoke.
  const near=field(),n=op(near,'recon',12,10);near.enemyAct(n);assert.equal(n.smokeIntent,undefined);
  // Review: a save whose throw reaches farther than today's tuning (the user shortened it since) loads, the warning dropped.
  {const s=field(),u=op(s,'recon',20,10);u.smokeIntent={origin:{x:20,y:10},point:{x:20-T.smoke.range-2,y:10}};u.smokeCooldown=2;
   const back=Game.restore(s.serialize());assert.ok(back,'not refused');const w=back.enemies.find(x=>x.id===u.id);assert.equal(w.smokeIntent,undefined);assert.equal(w.smokeCooldown,T.smoke.cooldown);
   u.smokeIntent.point={x:20-T.smoke.range,y:10};assert.deepEqual(Game.restore(s.serialize()).enemies.find(x=>x.id===u.id).smokeIntent,u.smokeIntent,'within reach it stays');}
  // Stunned while it warns: the throw is dropped and the cooldown restarts.
  const s=field(),u=op(s,'recon',16,10);s.enemyAct(u);assert.ok(u.smokeIntent);assert.ok(applyDisruption(u,'biological'));assert.equal(u.smokeIntent,undefined);assert.equal(u.smokeCooldown,T.smoke.cooldown);
  assert.deepEqual(T.smoke,{cooldown:7,range:6,near:3,radius:2});
});

test('工程師: after its turn, a drone every second round — a changing kind, never more than three of its own at once',()=>{
  // Far from you (its suicide bots and munitions would otherwise spend themselves on you and make room).
  const g=field(),e=op(g,'engineer',24,24);Object.assign(g.player,{x:2,y:2,hp:1e6,maxHp:1e6});g.reveal();
  const alive=[];for(let i=0;i<10;i++){g.action('wait');g.player.hp=1e6;alive.push(ownDrones(g,e).filter(d=>d.hp>0).length);}
  assert.deepEqual(alive,[1,1,2,2,3,3,3,3,3,3],'one every second round, and never a fourth');
  const drones=ownDrones(g,e);assert.deepEqual(drones.map(d=>d.id),['op-engineer-drone-0','op-engineer-drone-1','op-engineer-drone-2']);
  assert.ok(drones.every(d=>d.alert&&T.drones.kinds.includes(d.type)));assert.deepEqual(drones.map(d=>d.type),[0,1,2].map(n=>droneKind(g,e,n)));
  // Review (Claude's call): they pay nothing — no xp, scrap or drops, as the matriarch's brood — so it is no farm.
  assert.ok(drones.every(d=>d.expendable===true&&d.reinforcement===true));
  {const p=g.player,before={xp:p.xp,scrap:p.scrap,items:g.items.length,protocol:g.protocol.earned};for(const d of drones){d.hp=1;g.hurt(d,5,p);}
   assert.deepEqual({xp:p.xp,scrap:p.scrap,items:g.items.length,protocol:g.protocol.earned},before);assert.ok(drones.every(d=>d.hp<=0));
   const back=Game.restore(g.serialize());assert.ok(back);assert.ok(ownDrones(back,e).every(d=>d.expendable&&d.reinforcement));
   for(const d of drones)d.hp=d.maxHp;}
  // One falls: the next comes with a new id.
  drones[0].hp=0;g.action('wait');g.player.hp=1e6;g.action('wait');assert.ok(ownDrones(g,e).some(d=>d.id==='op-engineer-drone-3'&&d.hp>0));
  // The kinds vary over a floor (a hash, not the dice).
  assert.equal(new Set(Array.from({length:12},(_,n)=>droneKind(g,e,n))).size,3);
  assert.deepEqual(ORDER.end,['drones']);
});

test('狂戰士: the giant bug\'s charge and a grapple that cuts; each cut on you heals it, the ram does not',()=>{
  const g=field(),e=op(g,'berserker',11,10);e.hp=100;fixed(g,0);Object.assign(e,{charge:true,windup:1,aim:{x:10,y:10},tongueCooldown:4,chargeCooldown:3});
  const before=g.player.hp;g.enemyAct(e);const dealt=before-g.player.hp;
  assert.ok(dealt>0);assert.equal(e.hp,100+Math.floor(dealt*T.lifesteal),'heals half the cut');assert.ok(logged(g,'operatives.lifesteal',{enemy:enemyDisplayName(e),n:Math.floor(dealt*T.lifesteal)}));
  // The grapple: the swarm tongue's rules, its own words and colours.
  const h=field(),b=op(h,'berserker',15,10);b.hp=100;fixed(h,0);b.chargeCooldown=3;
  h.enemyAct(b);assert.ok(b.tongueIntent);assert.ok(logged(h,'operatives.grappleTaut'));assert.ok(h.effects.some(f=>f.type==='tongueTelegraph'&&f.grapple));
  h.effects=[];const hp=h.player.hp;h.enemyAct(b);assert.ok(logged(h,'operatives.grapplePulled'));assert.ok(h.effects.some(f=>f.type==='tonguePull'&&f.grapple));
  assert.equal(b.hp,100+Math.floor((hp-h.player.hp)*T.lifesteal),'its grapple\'s cut heals it too');
  // The ram is not a cut.
  const r=field(),c=op(r,'berserker',15,10);c.hp=100;fixed(r,0);c.chargeIntent={origin:{x:15,y:10},dir:{x:-1,y:0}};c.tongueCooldown=4;
  r.enemyAct(c);assert.ok(r.player.hp<999);assert.equal(c.hp,100);
  // Only you: a pet it cuts does not feed it.
  const q=field(),d=op(q,'berserker',14,10);d.hp=100;fixed(q,0);q.player.x=3;const pet=addAlly(q,'pet','crawler',{point:{x:13,y:10}});pet.hp=pet.maxHp=300;q.reveal();Object.assign(d,{charge:true,windup:1,focusTarget:pet.id,tongueCooldown:4,chargeCooldown:3});
  q.enemyAct(d);assert.ok(pet.hp<300);assert.equal(d.hp,100);
});

test('忍者: unseen but in thin smoke, in your thick cloud, beside you, just after it strikes, to your early warning or infrared',()=>{
  const g=field(),e=op(g,'ninja',15,10),p=g.player;g.target=e.id;
  assert.equal(g.visible(e),false);assert.ok(!g.visibleEnemies.includes(e));assert.equal(g.targeted,undefined,'nothing to aim at');assert.equal(cloaked(g,p,e),true);
  const show=(label,tweak,undo)=>{tweak();g.reveal();assert.equal(g.visible(e),true,label);undo();g.reveal();assert.equal(g.visible(e),false,`${label} (undone)`);};
  show('beside you',()=>{e.x=11;},()=>{e.x=15;});
  show('in light smoke',()=>{g.smoke=[{kind:'haze',cells:[{x:15,y:10}],expires:g.turn+1}];},()=>{g.smoke=[];});
  show('in steam',()=>{g.smoke=[{kind:'steam',cells:[{x:15,y:10}],expires:g.turn+1}];},()=>{g.smoke=[];});
  show('on burning floor',()=>{g.fires=[{x:15,y:10,age:1}];},()=>{g.fires=undefined;});
  show('your early warning',()=>{grantTrait(e,'exposed','skill:early_warning',1);},()=>{e.traits=e.traits.filter(s=>s.id!=='exposed');});
  show('just struck',()=>{e.decloaked=true;},()=>{delete e.decloaked;});
  // The same thick cloud as you: its outline shows, though the smoke hides it otherwise. Another cloud does not.
  e.x=12;show('in your cloud',()=>{g.smoke=[{cells:[{x:10,y:10},{x:11,y:10},{x:12,y:10}],expires:g.turn+1}];},()=>{g.smoke=[];});
  g.smoke=[{cells:[{x:12,y:10}],expires:g.turn+1},{cells:[{x:10,y:10}],expires:g.turn+1}];g.reveal();assert.equal(g.visible(e),false,'two clouds');g.smoke=[];e.x=15;g.reveal();
  // Your units cannot pick it out either: a drone beside you does not fire on it until it shows.
  const d=field('engineer'),hid=op(d,'ninja',15,10),unit=addAlly(d,'drone','drone',{point:{x:11,y:10}});unit.hp=unit.maxHp=500;d.reveal();fixed(d,0);
  assert.equal(d.teamVisible(hid),false);d.action('wait');assert.equal(hid.hp,hid.maxHp,'no shot at the cloaked ninja');
  hid.decloaked=true;hid.x=14;d.reveal();assert.equal(d.teamVisible(hid),true);
  // Review: nor does suppressive fire track it: the rounds go to the point you chose.
  {const s=field('soldier'),hidden=op(s,'ninja',15,10),p=s.player;p.skills.push('suppressive_fire');p.prepared.skill='suppressive_fire';p.ammo[p.weapon]=30;fixed(s,0);
   assert.ok(s.action('suppressiveFire',{x:15,y:11}));assert.equal(hidden.hp,hidden.maxHp);assert.ok(s.effects.filter(f=>f.type==='shot').every(f=>f.to.x===15&&f.to.y===11&&f.miss));
   const seen=field('soldier'),shown=op(seen,'ninja',15,10),q=seen.player;shown.decloaked=true;seen.reveal();q.skills.push('suppressive_fire');q.prepared.skill='suppressive_fire';q.ammo[q.weapon]=30;fixed(seen,0);
   assert.ok(seen.action('suppressiveFire',{x:15,y:11}));assert.ok(shown.hp<shown.maxHp,'a ninja you see is tracked as anyone');}
  // Infrared eyes (a recon's, a ninja's) see it all along.
  for(const c of ['recon','ninja']){const r=field(c),n=op(r,'ninja',15,10);assert.equal(r.visible(n),true,c);}
  // It shows the round it strikes, until its next turn begins.
  fixed(g,0);Object.assign(e,{charge:true,windup:1,aim:{x:10,y:10}});g.enemyAct(e);assert.equal(e.decloaked,true);assert.equal(g.visible(e),true);
  e.charge=false;e.x=15;g.enemyAct(e);assert.equal(e.decloaked,undefined,'its next turn: out of its band it walks, and fades again');assert.equal(g.visible(e),false);
  // Its fall clears it (a save could not keep it on a body).
  const f=field(),m=op(f,'ninja',13,10);m.decloaked=true;m.hp=1;f.hurt(m,5,f.player);assert.equal(m.decloaked,undefined);
  // Its knife beside you, its SMG further out.
  const k=field(),n=op(k,'ninja',11,10);fixed(k,0);Object.assign(n,{charge:true,windup:1,aim:{x:10,y:10}});k.effects=[];k.enemyAct(n);
  assert.ok(k.effects.some(f=>f.type==='enemyShot'&&f.style==='slash'));const knife=999-k.player.hp;
  assert.equal(knife,scaleEnemy(36+floorDamageBonus(k.floor,k.difficultySpec),k.floor,'damage',k.difficultySpec),'the knife, one blow');
  assert.equal(n.charge,true,'rapid: ready again next turn');
});

test('the sensors: a hidden ninja near you raises the officer\'s alert, then not again for eight rounds',()=>{
  assert.deepEqual(detectors().map(d=>[d.kind,d.event,d.range,d.cooldown]),[['cloak','cloakAlert',6,8]]);
  const g=field(),e=op(g,'ninja',18,10),memory=newCommsMemory(g.runId),alerts=()=>commsEvents({game:g,memory}).filter(v=>v.type==='cloakAlert').length;
  assert.equal(alerts(),0,'eight steps away');
  e.x=15;assert.equal(alerts(),1);assert.equal(alerts(),0,'cooling down');g.turn+=8;assert.equal(alerts(),1);
  g.turn+=8;e.decloaked=true;assert.equal(alerts(),0,'not while you see it');delete e.decloaked;e.hp=0;assert.equal(alerts(),0,'nor a body');
  for(const s of ['egret','wren'])assert.ok(bossIntroLines(s,'rifleman').length===1);
});

test('the intro is two lines, serial then class; the kill line reads the serial whatever the exit; the overseer has his',()=>{
  const at=r=>({random:()=>r});
  for(const c of OPERATIVE_CLASSES){
    const brief=`opBrief${c[0].toUpperCase()}${c.slice(1)}`;
    for(const s of ['egret','wren']){const lines=bossIntroLines(s,operativeType(c),{code:'R-0317'},at(0));assert.deepEqual(lines.map(m=>m.line),[`comms.${s}.opId.1`,`comms.${s}.${brief}.1`]);assert.equal(lines[0].vars.code,'R-0317');}
    assert.deepEqual(bossIntroLines('overseer',operativeType(c),{code:'R-0317'}).map(m=>m.line),['comms.overseer.opId.1'],'the overseer only names it');
  }
  assert.equal(t('comms.egret.opId.1',{code:'R-0317'}),'訊號比對：R-0317。……已除名的幹員。');
  assert.equal(t('comms.egret.opKill.1',{code:'R-0317'}),'R-0317……確認銷毀。');
  const dead={type:'delisted_soldier',id:'x',code:'K-0472'};
  for(const s of ['egret','wren','overseer'])for(const open of [true,false]){const m=bossKillLine(s,open,at(0),dead);assert.equal(m.line,`comms.${s}.opKill.1`);assert.equal(m.vars.code,'K-0472');}
  assert.equal(bossKillLine('egret',false,at(0),{type:'gunline'}),null,'the other bosses still wait for the exit');assert.equal(bossKillLine('overseer',true,at(0),{type:'gunline'}),null);
  // The boss event carries the serial.
  const g=field(),e=op(g,'soldier',14,10),event=commsEvents({game:g,memory:newCommsMemory(g.runId)}).find(v=>v.type==='boss');
  assert.deepEqual(event.vars,{name:enemyDisplayName(e),code:'R-0317'});assert.equal(event.actor.type,'delisted_soldier');
  // The controller holds the camera until the last line has closed (src/controller-comms.js).
  const source=sourceFamily('controller');assert.ok(source.includes('const messages=bossIntroLines(speaker,actor.type,event.vars);'));
});

test('last words: a bubble rises at the body a moment after it falls, one of its class\'s two lines by its serial',()=>{
  for(const c of OPERATIVE_CLASSES){
    const g=field(),e=op(g,c,13,10);e.hp=1;e.decloaked=true;g.reveal();g.target=e.id;fixed(g,0);const {steps}=captureAction(g,()=>g.action('fire'));assert.ok(e.hp<=0,c);
    const words=g.effects.find(f=>f.lastWords);assert.ok(words,c);
    assert.deepEqual(words.position,{x:13,y:10});assert.ok(LAST_WORDS[c].includes(words.line));assert.equal(words.delayMs,T.lastWordsMs);assert.equal(words.visibility,'visible');
    const {events}=planPresentation(steps),fall=events.find(v=>v.effects.some(f=>f.type==='fall'&&f.actorId===e.id));assert.ok(fall.effects.some(f=>f.lastWords),'it comes with the fall');
    const board=new CalloutBoard(),item=board.add(words,1000);assert.equal(board.active(1000).length,0,'not yet');assert.equal(board.active(1000+T.lastWordsMs).length,1);
    assert.equal(item.text,t(words.line));assert.equal(calloutLine(words),t(words.line));
    // Review: it belongs to its floor; another floor drops it at once and leaves every other bubble alone.
    assert.equal(words.floor,g.floor);const other={type:'callout',cue:'hold',category:'tactical',priority:'medium',visibility:'visible',actorId:'x',position:{x:1,y:1}};board.add(other,1000);
    board.dropOtherFloors(g.floor);assert.equal(board.active(2000).length,2);board.dropOtherFloors(g.floor+1);assert.deepEqual(board.active(2000).map(i=>i.event.cue),['hold']);
  }
  assert.equal(t('operatives.last.soldier.1'),'……叛徒……');assert.equal(en['operatives.last.ninja.2'],'You too... only a number, right?');
  const g=field(),r=makeEnemy('rifleman',13,10,'r',6,0,'loyalist');r.hp=1;g.enemies.push(r);g.hurt(r,5,g.player);assert.ok(!g.effects.some(f=>f.lastWords),'only an operative');
  const source=sourceFamily('renderer');assert.ok(source.includes("speaker=own?g.player:e.lastWords?null:"),'drawn at the body, not silenced by the fall');
  assert.ok(source.includes('.dropOtherFloors(g.floor);'),'the renderer drops last words from another floor');
});

test('saves: operatives, their serials, cooldowns and warnings come back; stale warnings are dropped and long numbers cut, never refused',()=>{
  const g=field(),s=op(g,'soldier',16,10),r=op(g,'recon',16,14),n=op(g,'ninja',18,6),en2=op(g,'engineer',20,10);
  Object.assign(s,{scanCooldown:3,grenadeCooldown:2,grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:16,y:10}}});
  Object.assign(r,{smokeIntent:{origin:{x:16,y:14},point:{x:13,y:12}},smokeCooldown:4});n.decloaked=true;en2.droneCooldown=1;grantTrait(g.player,SCANNED,'boss:scan',2);
  const raw=g.serialize(),copy=Game.restore(raw);assert.ok(copy);assert.deepEqual(copy.enemies,g.enemies);assert.equal(JSON.parse(raw).version,SAVE_VERSION);assert.equal(SAVE_VERSION,88);
  const load=change=>{const d=JSON.parse(raw);change(d.data);return Game.restore(JSON.stringify(d));};
  const find=(c,id)=>c.enemies.find(e=>e.id===id);
  // Stale: moved, fallen, stunned, pinned while it warned: the throw is dropped and its cooldown restarts.
  for(const tweak of [e=>{e.y+=1;},e=>{e.hp=0;},e=>{e.control={disabled:1,immune:0};},e=>{e.suppression=3;}]){const c=load(d=>tweak(d.enemies.find(e=>e.id===r.id)));assert.ok(c);assert.equal(find(c,r.id).smokeIntent,undefined);assert.equal(find(c,r.id).smokeCooldown,T.smoke.cooldown);}
  // Longer than today's tuning: cut to it.
  const long=load(d=>{Object.assign(d.enemies.find(e=>e.id===s.id),{scanCooldown:99,grenadeCooldown:99});d.enemies.find(e=>e.id===r.id).smokeCooldown=99;d.enemies.find(e=>e.id===en2.id).droneCooldown=99;d.player.traits.find(x=>x.id===SCANNED).turns=99;});
  assert.ok(long);assert.deepEqual([find(long,s.id).scanCooldown,find(long,s.id).grenadeCooldown,find(long,r.id).smokeCooldown,find(long,en2.id).droneCooldown,long.player.traits.find(x=>x.id===SCANNED).turns],[5,4,7,2,2]);
  // A fallen ninja's reveal is dropped.
  assert.equal(find(load(d=>{d.enemies.find(e=>e.id===n.id).hp=0;}),n.id).decloaked,undefined);
  // Broken: refused.
  for(const [label,change] of [
    ['a serial on a rifleman',d=>{d.enemies.push({...structuredClone(d.enemies.find(e=>e.id===s.id)),id:'x',type:'rifleman',scanCooldown:undefined,grenadeCooldown:undefined,grenadeIntent:undefined});}],
    ['a malformed serial',d=>{d.enemies.find(e=>e.id===s.id).code='R317';}],
    ['smoke on a soldier',d=>{d.enemies.find(e=>e.id===s.id).smokeIntent={origin:{x:16,y:10},point:{x:13,y:10}};}],
    ['smoke with an extra key',d=>{d.enemies.find(e=>e.id===r.id).smokeIntent.extra=1;}],
    ['smoke at no tile',d=>{d.enemies.find(e=>e.id===r.id).smokeIntent.point={x:13.5,y:14};}],   // (farther than the reach is dropped, not refused: review)
    ['a reveal on a recon',d=>{d.enemies.find(e=>e.id===r.id).decloaked=true;}],
    ['a reveal that is not true',d=>{d.enemies.find(e=>e.id===n.id).decloaked=1;}],
    ['a scan from nowhere',d=>{d.player.traits.find(x=>x.id===SCANNED).source='nowhere';}],
    ['a drone clock on a soldier',d=>{d.enemies.find(e=>e.id===s.id).droneCooldown=1;}],
  ])assert.equal(load(change),null,label);
  // SAVE 85: a save from 84 loads as it is.
  const old=JSON.parse(field().serialize());old.version=84;assert.ok(Game.restore(JSON.stringify(old)));
  // A round trip: a kept floor with an operative on it comes back.
  withDraw(()=>'recon',()=>{
    const run=new Game(331,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});run.floor=6;run.loadFloor();const o=run.enemies.find(e=>isBossClass(e));assert.equal(o.type,'delisted_recon');assert.ok(validOperativeCode(o.code));
    o.smokeIntent={origin:{x:o.x,y:o.y},point:{x:o.x,y:o.y}};o.smokeCooldown=3;
    const back=Game.restore(run.serialize());assert.ok(back);assert.deepEqual(find(back,o.id),o);
  });
  // A floor kept on a round trip: an operative left on it comes back from a save, serial and warning and all.
  const trip=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'rebel'});Object.assign(trip.player,trip.exitPoint);assert.equal(trip.exitBlocked,'');assert.ok(trip.descend());
  const kept=trip.floorStates[1],spot=(()=>{for(let y=1;y<kept.grid.length-1;y++)for(let x=1;x<kept.grid.length-4;x++)if([0,1,2,3].every(n=>kept.grid[y][x+n]===1&&!kept.enemies.some(o=>o.x===x+n&&o.y===y)&&!kept.props.some(o=>o.x===x+n&&o.y===y)))return {x,y};})();
  const left=makeEnemy('delisted_recon',spot.x+3,spot.y,'kept-op',1,0,'rebel');Object.assign(left,{alert:true,code:'R-0317',smokeIntent:{origin:{x:spot.x+3,y:spot.y},point:{x:spot.x,y:spot.y}},smokeCooldown:2});kept.enemies.push(left);
  const tripBack=Game.restore(trip.serialize());assert.ok(tripBack);assert.deepEqual(tripBack.floorStates[1].enemies.find(e=>e.id==='kept-op'),left);
  const moved=JSON.parse(trip.serialize());moved.data.floorStates[1].enemies.find(e=>e.id==='kept-op').x-=1;const movedBack=Game.restore(JSON.stringify(moved));assert.ok(movedBack,'moved off its mark on a kept floor: dropped, not refused');
  assert.equal(movedBack.floorStates[1].enemies.find(e=>e.id==='kept-op').smokeIntent,undefined);
  const badCode=JSON.parse(trip.serialize());badCode.data.floorStates[1].enemies.find(e=>e.id==='kept-op').code='bad';assert.equal(Game.restore(JSON.stringify(badCode)),null,'a kept floor is checked too');
});

test('the round start counts the cooldowns down with the other specials; a special that goes off leaves no shot wound up',()=>{
  const g=field(),s=op(g,'soldier',16,10),r=op(g,'recon',16,14),e=op(g,'engineer',20,10);Object.assign(s,{scanCooldown:2,grenadeCooldown:1});r.smokeCooldown=3;e.droneCooldown=2;
  tickOperatives(g);assert.deepEqual([s.scanCooldown,s.grenadeCooldown,r.smokeCooldown,e.droneCooldown],[1,0,2,1]);
  const h=field(),c=op(h,'recon',16,10);c.smokeIntent={origin:{x:16,y:10},point:{x:13,y:10}};Object.assign(c,{charge:true,aim:{x:10,y:10},windup:2});h.enemyAct(c);assert.equal(c.charge,false);assert.ok(h.smoke.length);
  const w=field(),d=op(w,'soldier',12,10);Object.assign(d,{scanCooldown:5,grenadeIntent:{stage:'prepare',targetId:'player',x:10,y:10,origin:{x:12,y:10}},charge:true,aim:{x:10,y:10},windup:2});w.enemyAct(d);assert.equal(d.charge,false);assert.ok(w.marks.length);
  interruptEnemyIntent(c,'death');
});
