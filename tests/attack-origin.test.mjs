import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {WEAPONS} from '../src/data.js';
import {LIGHT_MODEL,lightAt,carriesFlashlight} from '../src/lighting.js';
import {ATTACK_ORIGIN_TUNING} from '../src/game-damage.js';
import {detonateMine} from '../src/field-gear.js';
import {SQUAD_TUNING,makeReady} from '../src/squad.js';
import {chargeLineTarget} from '../src/renderer-telegraphs.js';
import {isCowering} from '../src/rebels.js';
import {munitionAct,bomberAct} from '../src/workshop.js';

// 3.209.0 (user decisions 2026-09-30, docs/CORE_RULES.md 受到攻擊): an enemy hurt by your side learns where the attack came
// from even when it cannot see you; the enemies that see it hit go alert toward it; a squad member radios the origin to its
// leader; an unseen unit of yours on the tile an enemy knows about is attacked blind. What they learn lands once the
// attacker's step is over (review of 3.209.0), so direct calls below settle it themselves (Game.settleAttackNotes).
const base=id=>WEAPONS.findIndex(w=>w.id===id);
// An open floor on the real light model, all black but for a glowstick (dim within 3 tiles) at `stick`.
function arena({character='soldier',faction='loyalist',stick={x:15,y:11},walls=[],keepAllies=false}={}){
  const g=new Game(316,[],0,character,'onyx','extraction',{facilityFaction:faction});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));for(const w of walls)g.grid[w.y][w.x]=0;
  g.lighting=g.grid.map(r=>r.map(()=>0));
  Object.assign(g,{allies:keepAllies?g.allies:[],barriers:[],props:[],items:[],hazards:[],marks:[],smoke:[],enemies:[],flares:[],glowsticks:stick?[stick]:[],gunFlashes:[],traces:[],fires:[],mines:[]});
  clearGeneratedMap(g);g.lightModel=LIGHT_MODEL;g.lamps=[];
  Object.assign(g.player,{x:10,y:10,facing:[1,0],flashlight:false});g.player.hp=g.player.maxHp=5000;
  g.reveal();return g;
}
function arm(g,id,affix=null){
  const p=g.player;let slot=p.owned.find(i=>WEAPONS[p.weaponBases[i]]?.id===id);
  if(slot===undefined){slot=p.weaponBases.findIndex(b=>b===base(id));if(slot<0)slot=g.registerWeapon({weapon:base(id)}).slot;p.owned=[slot,...p.owned.filter(s=>s!==slot)].slice(0,2);}
  p.weapon=slot;p.affixes[slot]=affix;p.ammo[slot]=99;return slot;
}
function foe(g,type,x,y,id,extra={}){const e=makeEnemy(type,x,y,id,1,g.difficultySpec,g.facilityFaction);Object.assign(e,{hp:400,maxHp:400,alert:false,lastKnown:null,affixes:[]},extra);g.enemies.push(e);return e;}
const at=q=>q&&{x:q.x,y:q.y};
const hit=(g,e,damage,attacker)=>{g.hurt(e,damage,attacker);g.settleAttackNotes();};
const flashlightIds=(g,want=true)=>Array.from({length:400},(_,i)=>'f'+i).filter(id=>carriesFlashlight(g,{type:'rifleman',id,faction:'loyalist'})===want);
const flashlightId=(g,want=true)=>flashlightIds(g,want)[0];
const quiet=g=>Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});

test('the victim: shot from the black with a flash hider, it knows where the shots came from and comes for you',()=>{
  const g=arena(),p=g.player;arm(g,'rifle','flashhider');
  const e=foe(g,'rifleman',15,10,'e');g.reveal();g.target=e.id;
  assert.equal(lightAt(g,p),0);assert.equal(g.sight(e,p),false,'it cannot see you in the black');
  assert.ok(g.action('fire'));assert.ok(e.hp<400);
  assert.equal(g.sight(e,p),false,'still unseen: no muzzle flash');
  assert.equal(e.alert,true);assert.deepEqual(at(e.lastKnown),{x:10,y:10},'the shooter\'s tile');
  assert.ok(e.x<15,'alert once your step was over, it took its turn and walked toward your tile');
});

test('the rest of the same attack resolves as it would have: no flashlight switched on, no ambush lost halfway through',()=>{
  // A recon (unseen perk 3) bursts from the black at V; W, behind V with a flashlight, sees V hit. Its beam would reach
  // you if it went alert mid-burst and cost rounds 2-4 the unseen bonus (review of 3.209.0).
  for(const victimLight of [false,true]){
    const g=arena({character:'recon',stick:{x:14,y:12}}),p=g.player;Object.assign(p,{x:11,y:10});p.perks.recon_unseen=3;arm(g,'smg','flashhider');
    const lit=flashlightIds(g,true),v=foe(g,'rifleman',13,10,victimLight?lit[0]:flashlightId(g,false),{hp:4000,maxHp:4000}),w=foe(g,'rifleman',15,10,lit[1],{hp:4000,maxHp:4000});
    g.reveal();g.target=v.id;g.rng=()=>0;quiet(g);
    const rounds=[],hurt=g.hurt.bind(g);g.hurt=(t,d,a,c)=>{rounds.push({d,light:lightAt(g,p)});return hurt(t,d,a,c);};
    assert.equal(g.sight(w,v),true);assert.ok(g.action('fire'));
    assert.equal(rounds.length,4);assert.ok(rounds.every(r=>r.d===rounds[0].d&&r.light===0),JSON.stringify(rounds));
    assert.equal(v.alert,true);assert.equal(w.alert,true,'they learn it once your step is over');
  }
  // A ninja's spear thrust through two unaware enemies: both take the ambush damage.
  const n=new Game(3470,[],0,'ninja','onyx');n.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));n.lighting=n.grid.map(r=>r.map(()=>1));
  Object.assign(n,{barriers:[],props:[],items:[],hazards:[],marks:[],enemies:[],allies:[],smoke:[]});n.end={x:20,y:20};Object.assign(n.player,{x:10,y:10});n.rng=Object.assign(()=>0,{state:()=>0});
  const spear={x:10,y:10,type:'weapon',weapon:base('spear')};n.registerWeapon(spear);n.collectWeapon(spear);n.player.weapon=spear.slot;quiet(n);
  const near=makeEnemy('rifleman',11,10,'near'),back=makeEnemy('rifleman',12,10,'back');
  for(const e of [near,back]){Object.assign(e,{hp:1000,maxHp:1000,alert:false,lastKnown:null});n.enemies.push(e);}
  n.target=back.id;assert.ok(n.action('fire'));
  assert.ok(near.hp<1000);assert.equal(1000-back.hp,1000-near.hp,'the second body keeps its ambush');
});

test('your units\' attacks teach the same: the unit\'s tile, whether or not the unit is still on the ally list',()=>{
  const g=arena({character:'druid',keepAllies:true}),pet=g.allies.find(a=>a.kind==='pet');
  Object.assign(pet,{x:14,y:10,floor:g.floor,status:'active'});
  const e=foe(g,'gunner',15,10,'e');g.reveal();
  hit(g,e,5,pet);assert.equal(e.alert,true);assert.deepEqual(at(e.lastKnown),{x:14,y:10});
  const other=foe(g,'gunner',20,20,'c');hit(g,other,5,null);assert.equal(other.alert,false,'damage nobody dealt teaches nothing');
  // The engineer's units: a munition and a primed bot leave the ally list before they go off; they still count.
  const unit=(eng,extra)=>{const a={id:'u'+eng.allies.length,kind:'drone',floor:eng.floor,status:'active',traits:[],hp:45,maxHp:45,...extra};eng.allies.push(a);return a;};
  for(const payload of ['frag','stun']){
    const eng=arena({character:'engineer',stick:{x:13,y:10}}),m=unit(eng,{sourceId:'drone_munition',payload,x:11,y:10,bornTurn:0}),v=foe(eng,'gunner',12,10,'v'),w=foe(eng,'gunner',12,13,'w');eng.reveal();
    for(const x of [v,w])Object.assign(x,{alert:false,lastKnown:null});
    munitionAct(eng,m);eng.settleAttackNotes();assert.ok(!eng.allies.includes(m),'it left the list first');
    assert.equal(v.alert,true,payload);assert.deepEqual(at(v.lastKnown),{x:11,y:10},`${payload}: where it went off`);
    if(payload==='frag'){assert.ok(v.hp<400);assert.equal(w.alert,true,'the witness too');}
  }
  const eng=arena({character:'engineer',stick:{x:13,y:10}}),bot=unit(eng,{sourceId:'unit_bomber',x:11,y:10,primed:true}),v=foe(eng,'gunner',12,10,'v');eng.reveal();
  Object.assign(v,{alert:false,lastKnown:null});bomberAct(eng,bot);eng.settleAttackNotes();
  assert.ok(v.hp<400);assert.deepEqual(at(v.lastKnown),{x:11,y:10},'a primed bot');
  const eng2=arena({character:'engineer',stick:{x:13,y:10}}),bot2=unit(eng2,{sourceId:'unit_bomber',x:11,y:10,hp:5}),v2=foe(eng2,'gunner',12,10,'v');eng2.reveal();
  Object.assign(v2,{alert:false,lastKnown:null});eng2.damageAlly(bot2,50,null,true);eng2.settleAttackNotes();
  assert.ok(v2.hp<400);assert.deepEqual(at(v2.lastKnown),{x:11,y:10},'a bot destroyed by damage, as before');
});

test('a converted core guard\'s bombardment is your side\'s: the centre, with no attacker and no kill of yours changed',()=>{
  const g=arena({faction:'rebel',stick:{x:13,y:11}}),v=foe(g,'gunner',12,10,'v',{faction:'rebel'}),w=foe(g,'raider',12,13,'w',{faction:'rebel'});
  g.reveal();for(const x of [v,w])Object.assign(x,{alert:false,lastKnown:null});
  g.marks.push({kind:'ally',sourceId:'ally-boss',x:12,y:11,radius:1,damage:40,due:g.turn+1});
  const kills=g.player.kills;assert.ok(g.action('wait'));
  assert.ok(v.hp<400);assert.equal(v.alert,true);assert.deepEqual(at(v.lastKnown),{x:12,y:11},'the centre of the bombardment');
  assert.equal(w.alert,true,'and the witness');assert.equal(g.player.kills,kills);
  // An enemy bombardment teaches nothing, as before.
  const h=arena(),e=foe(h,'gunner',12,10,'e');h.reveal();Object.assign(e,{alert:false,lastKnown:null});
  h.marks.push({x:12,y:11,radius:1,damage:40,due:h.turn+1});quiet(h);assert.ok(h.action('wait'));assert.ok(e.hp<400);assert.equal(e.lastKnown,null);
});

test('blasts: a thrown frag, a mine, a barrel and a rigged case teach their centre; a gun\'s own burst, your tile',()=>{
  // Each enemy stands a tile from the blast, so it survives and can be read.
  const frag=arena({stick:{x:15,y:10}}),f=foe(frag,'gunner',15,10,'f');frag.reveal();frag.player.grenades=2;frag.player.prepared.grenade='frag';
  assert.ok(frag.action('grenade',{x:14,y:10}));assert.ok(f.hp<400);assert.deepEqual(at(f.lastKnown),{x:14,y:10},'where the grenade came down');
  const mine=arena(),m=foe(mine,'gunner',15,10,'m');mine.mines=[{id:'mine-1-1',x:14,y:10,seen:[]}];
  detonateMine(mine,mine.mines[0]);mine.settleAttackNotes();assert.ok(m.hp<400);assert.deepEqual(at(m.lastKnown),{x:14,y:10},'not your tile: you may be anywhere');
  const barrel=arena();arm(barrel,'rifle','flashhider');barrel.props.push({id:'b1',type:'barrel',x:14,y:10,hp:1});
  const b=foe(barrel,'gunner',15,10,'b');barrel.reveal();barrel.target='b1';
  assert.ok(barrel.action('fire'));assert.ok(b.hp<400);assert.deepEqual(at(b.lastKnown),{x:14,y:10},'the barrel, not the shooter');
  const rig=arena(),r=foe(rig,'gunner',15,10,'r');rig.detonateCase({x:14,y:10,contents:[],hp:1,opened:false},rig.player);rig.settleAttackNotes();
  assert.ok(r.hp<400);assert.deepEqual(at(r.lastKnown),{x:14,y:10});
  const gl=arena();arm(gl,'launcher','flashhider');const l=foe(gl,'gunner',15,10,'l');gl.reveal();
  assert.ok(gl.action('launch',{x:14,y:10}));assert.ok(l.hp<400);assert.deepEqual(at(l.lastKnown),{x:10,y:10},'the launcher fired from your tile');
  // The origin lives only while the blast resolves: the next hit is back to the attacker's tile, and nothing is saved.
  hit(gl,l,1,gl.player);assert.deepEqual(at(l.lastKnown),{x:10,y:10});
  assert.doesNotMatch(gl.serialize(),/firstHand|attackNotes|"origin"|"pending":\[/);
});

test('witnesses: within 8 tiles and seeing the victim hit, alert toward the victim; first-hand knowledge outranks it',()=>{
  const g=arena({stick:{x:15,y:12},walls:[{x:17,y:14},{x:18,y:14},{x:16,y:14},{x:19,y:14}]}),p=g.player;
  const v=foe(g,'rifleman',15,10,'v'),w=foe(g,'gunner',15,13,'w'),far=foe(g,'gunner',15,10+ATTACK_ORIGIN_TUNING.witnessRadius+1,'far');
  const walled=foe(g,'gunner',17,15,'walled'),civ=foe(g,'civilian',16,11,'civ');g.reveal();
  assert.equal(ATTACK_ORIGIN_TUNING.witnessRadius,8);
  g.newAttackNotes();g.hurt(v,5,p);
  assert.equal(v.alert,false,'nothing lands before the attacker\'s step is over');assert.equal(w.alert,false);
  g.settleAttackNotes();
  assert.deepEqual(at(v.lastKnown),{x:10,y:10});
  assert.equal(w.alert,true);assert.deepEqual(at(w.lastKnown),{x:15,y:10},'the witness goes toward the victim');
  assert.equal(far.alert,false,'nine tiles away');assert.equal(g.sight(walled,v),false);assert.equal(walled.alert,false,'behind the wall');
  assert.equal(civ.alert,false,'a researcher is no witness');
  // First-hand wins, whatever the order: w is hit after it witnessed v (its own origin replaces what it saw), and v,
  // hit first, keeps its origin when it then witnesses w's hit.
  hit(g,w,5,p);assert.deepEqual(at(w.lastKnown),{x:10,y:10});assert.deepEqual(at(v.lastKnown),{x:10,y:10},'first-hand wins');
  // Within one step too: witness first, hit after, settled together.
  g.newAttackNotes();const a=foe(g,'gunner',14,12,'a'),b=foe(g,'gunner',16,12,'b');g.reveal();
  g.hurt(a,5,p);g.hurt(b,5,p);g.settleAttackNotes();
  assert.deepEqual(at(a.lastKnown),{x:10,y:10});assert.deepEqual(at(b.lastKnown),{x:10,y:10});
  // A new action: what a witness sees may move it again.
  g.newAttackNotes();const x=foe(g,'gunner',15,11,'x');hit(g,x,5,p);assert.deepEqual(at(v.lastKnown),{x:15,y:11});
});

test('witnesses in a real burst: overpenetration hits two, each keeps the shooter\'s tile',()=>{
  const g=arena();arm(g,'rifle','flashhider');g.rng=()=>0;
  const v=foe(g,'rifleman',15,10,'v'),behind=foe(g,'raider',16,10,'behind'),w=foe(g,'gunner',15,12,'w');
  const seer=foe(g,'sniper',13,13,'seer');g.reveal();g.target=v.id;quiet(g);
  assert.equal(g.sight(seer,g.player),true,'night vision: it sees you in the black');assert.equal(g.sight(seer,v),true);
  assert.ok(g.action('fire'));assert.ok(behind.hp<400,'the rounds went through');
  assert.deepEqual(at(v.lastKnown),{x:10,y:10},'not the tile of the one hit behind it');assert.deepEqual(at(behind.lastKnown),{x:10,y:10});
  assert.equal(w.alert,true);assert.notDeepEqual(at(w.lastKnown),{x:10,y:10},'the witness only saw them hit');
  assert.deepEqual(at(seer.lastKnown),{x:10,y:10},'one that sees you knows your tile: what it saw of the hit lands before it looks');
});

test('a rebel who sees a comrade gunned down from the black runs for cover from where it fell, not from your live tile',()=>{
  const run=shooter=>{
    const g=arena({faction:'rebel'});Object.assign(g.player,shooter);arm(g,'rifle','flashhider');g.rng=()=>0;quiet(g);
    for(const [x,y] of [[16,13],[18,11],[14,12],[17,9]])g.props.push({id:`c${x}${y}`,type:'cover',x,y,hp:50,maxHp:50});
    const v=foe(g,'rifleman',15,10,'v',{hp:5,maxHp:22}),b=foe(g,'raider',16,11,'b',{faction:'rebel'});g.reveal();g.target=v.id;
    assert.equal(g.sight(b,g.player),false);assert.ok(g.action('fire'));assert.ok(v.hp<=0);
    assert.equal(isCowering(b),true);assert.equal(b.alert,true,'alert, so its retreat order runs');assert.equal(b.order?.kind,'retreat');
    return b.order.at;
  };
  assert.deepEqual(run({x:10,y:10}),run({x:15,y:4}),'the same knowledge picks the same cover wherever you are');
});

test('a decoy: the ones it held take the attack\'s origin, not the decoy\'s tile; your units and a stun do not break it',()=>{
  const g=arena({character:'ninja'}),p=g.player;
  const v=foe(g,'gunner',15,10,'v'),w=foe(g,'gunner',16,12,'w');g.reveal();p.decoys=2;
  assert.ok(g.action('decoy',{x:12,y:13}));assert.deepEqual(g.decoy.fooled.sort(),['v','w']);quiet(g);
  const smg=p.owned.find(i=>!g.weaponAt(i).melee);p.weapon=smg;p.affixes[smg]='flashhider';p.ammo[smg]=99;g.target=v.id;g.rng=()=>0;
  assert.ok(g.action('fire'));assert.deepEqual(g.decoy?.fooled??[],[]);
  assert.deepEqual(at(v.lastKnown),{x:10,y:10});assert.deepEqual(at(w.lastKnown),{x:10,y:10},'the witness it held too');
  // A fooled enemy bitten by your unit keeps going for the decoy (3.144.0: fooled enemies still fight your units).
  const h=arena({character:'druid',keepAllies:true}),pet=h.allies.find(a=>a.kind==='pet');Object.assign(pet,{x:16,y:10,floor:h.floor,status:'active'});
  const f=foe(h,'gunner',15,10,'f');h.reveal();h.player.decoys=1;assert.ok(h.action('decoy',{x:12,y:12}));
  const held=at(f.lastKnown);hit(h,f,5,pet);assert.deepEqual(at(f.lastKnown),held,'what the decoy told it stands');assert.ok(h.decoy.fooled.includes('f'));
  // Nor does a stun grenade landing on it (review of 3.209.0): stunned, still held, still going for the decoy.
  const s=arena({character:'ninja'}),e=foe(s,'rifleman',14,10,'s');s.lighting=s.grid.map(r=>r.map(()=>1));s.reveal();quiet(s);
  s.player.decoys=2;assert.ok(s.action('decoy',{x:13,y:12}));s.player.stun=2;s.player.prepared.grenade='stun';
  assert.ok(s.action('grenade',{x:14,y:10}));assert.ok(e.control.disabled>0);
  assert.deepEqual(s.decoy.fooled,['s']);assert.deepEqual(at(e.lastKnown),{x:13,y:12});
});

test('訊號斷層: while it runs a hit only alerts; nothing moves what an enemy knows of you, witnesses and squads included',()=>{
  const g=arena({character:'recon'}),p=g.player;
  const v=foe(g,'gunner',15,10,'v'),w=foe(g,'gunner',15,12,'w');g.reveal();
  p.prepared.skill='signal_break';assert.ok(g.action('skill','signal_break'));
  g.newAttackNotes();hit(g,v,5,p);
  assert.equal(v.alert,true);assert.equal(v.lastKnown,null);assert.equal(w.alert,true);assert.equal(w.lastKnown,null);
  const drone={id:'ally',kind:'drone',x:14,y:11,hp:10,maxHp:10,floor:g.floor,status:'active',traits:[]};g.allies.push(drone);
  hit(g,v,5,drone);assert.deepEqual(at(v.lastKnown),{x:14,y:11},'it hides you, not your units');
});

test('squad radio: a hit member reports the origin; the squad holds its aim there, never on your live tile',()=>{
  const walls=[8,9,10,11,12].map(y=>({x:17,y}));
  const g=arena({stick:{x:14,y:12},walls}),p=g.player;arm(g,'rifle','flashhider');
  const L=foe(g,'squad_leader',19,10,'L',{alert:true,lastKnown:{x:14,y:4}});
  const m=[foe(g,'rifleman',14,10,'m0',{alert:true,lastKnown:{x:14,y:4}}),foe(g,'gunner',15,11,'m1',{alert:true,lastKnown:{x:14,y:4}})];
  for(const x of m){x.squad={leader:'L',suppressed:0};x.order={kind:'post',by:'L',at:{x:x.x,y:x.y},set:true,patience:null,breakOn:[],since:1};}
  L.squad={weapon:'rifle',state:'patience',suppressTurn:0,answer:'standard',set:true,since:1,at:{x:14,y:4},last:{x:14,y:4},patience:3,blind:false};
  g.reveal();assert.equal(g.sight(L,p),false,'the leader cannot see you');
  // Blind, the squad aims where it last had you, however you move.
  makeReady(g,L,m);assert.deepEqual(at(m[0].aim),{x:14,y:4});
  p.y=11;makeReady(g,L,m);assert.deepEqual(at(m[0].aim),{x:14,y:4},'the aim does not follow you');p.y=10;
  // The telegraph line: to the held tile while it cannot see you, to you once it can.
  assert.deepEqual(at(chargeLineTarget(g,m[0])),{x:14,y:4});
  g.newAttackNotes();hit(g,m[0],5,p);
  assert.deepEqual(L.squad.last,{x:10,y:10},'reported');assert.equal(L.squad.patience,SQUAD_TUNING.patience,'new information restarts the wait');
  L.squad.patience=2;hit(g,m[0],5,p);assert.equal(L.squad.patience,2,'the same tile again is no news');
  makeReady(g,L,m);assert.deepEqual(at(m[1].aim),{x:10,y:10},'the squad holds its aim on the origin');
  g.glowsticks.push({x:10,y:10});g.reveal();assert.equal(g.sight(m[0],p),true);
  assert.equal(chargeLineTarget(g,m[0]),p,'in sight, the line is on you');
  // In a real round: the squad searches toward the origin, not the stale tile.
  const h=arena({stick:{x:14,y:12},walls});arm(h,'rifle','flashhider');
  const L2=foe(h,'squad_leader',19,10,'L',{alert:true,lastKnown:{x:14,y:4}}),s=foe(h,'rifleman',14,10,'s',{alert:true,lastKnown:{x:14,y:4}});
  s.squad={leader:'L',suppressed:0};s.order={kind:'post',by:'L',at:{x:14,y:10},set:true,patience:null,breakOn:[],since:1};
  L2.squad={weapon:'rifle',state:'search',suppressTurn:0,answer:'standard',set:true,since:1,at:{x:14,y:4},last:{x:14,y:4},patience:0,blind:false};
  h.reveal();h.target=s.id;h.rng=()=>0;assert.ok(h.action('fire'));
  assert.deepEqual(L2.squad.last,{x:10,y:10});assert.ok(s.order?.kind==='bound'&&s.order.at.x<14,'bounding toward where the shots came from');
});

test('an unseen pet on the tile the enemy knows about is attacked blind, as you would be — in the same round it bit',()=>{
  const g=arena({character:'druid',stick:{x:18,y:10},keepAllies:true}),pet=g.allies.find(a=>a.kind==='pet');
  Object.assign(pet,{x:14,y:10,floor:g.floor,status:'active',hp:500,maxHp:500});
  const e=foe(g,'gunner',15,10,'e');g.reveal();
  assert.equal(lightAt(g,pet),0);assert.equal(g.sight(e,pet),false,'the pet is in the black');
  assert.ok(g.action('wait'));assert.ok(e.hp<400,'the pet bit it');assert.deepEqual(at(e.lastKnown),{x:14,y:10});
  const shots=[...g.effects.filter(f=>f.type==='enemyShot'&&f.to.x===14&&f.to.y===10)];
  assert.ok(shots.length>0,'it answered in the same round, once the pet had acted');
  for(let i=0;i<2;i++){g.action('wait');shots.push(...g.effects.filter(f=>f.type==='enemyShot'&&f.to.x===14&&f.to.y===10));}
  assert.ok(shots.length>0,'it attacks the tile blind');assert.equal(e.x,15,'instead of standing beside it doing nothing, or walking off');
});

test('a stun grenade from out of sight: stunned, alert, and it knows where it came down',()=>{
  const g=arena({stick:{x:15,y:11}}),p=g.player;p.stun=2;p.prepared.grenade='stun';
  const e=foe(g,'gunner',15,10,'e');g.reveal();assert.equal(g.sight(e,p),false);
  assert.ok(g.action('grenade',{x:14,y:10}));
  assert.ok(e.control.disabled>0);assert.equal(e.alert,true);assert.deepEqual(at(e.lastKnown),{x:14,y:10},'the landing tile, not yours');
});

test('suppressive fire: every target in the area learns your tile, hit or not, as before; only alert while 訊號斷層 runs',()=>{
  for(const jammed of [false,true]){
    const g=arena({character:jammed?'recon':'soldier'}),p=g.player;arm(g,'rifle','flashhider');
    p.skills.push('suppressive_fire');
    const a=foe(g,'gunner',14,10,'a'),b=foe(g,'gunner',14,11,'b');g.reveal();quiet(g);
    if(jammed){p.prepared.skill='signal_break';assert.ok(g.action('skill','signal_break'));}
    p.prepared.skill='suppressive_fire';g.rng=()=>.999;
    assert.equal(g.action('suppressiveFire',{x:14,y:10}),true);assert.match(g.logs[0].text,/壓制射擊/);
    assert.equal(a.alert&&b.alert,true);
    for(const e of [a,b])assert.deepEqual(at(e.lastKnown),jammed?null:{x:10,y:10});
  }
});

test('a flashlight turns to where the shots came from, and finds you',()=>{
  const g=arena();arm(g,'rifle','flashhider');
  const e=foe(g,'rifleman',14,10,flashlightId(g));g.reveal();g.target=e.id;g.rng=()=>.5;
  assert.ok(g.action('fire'));assert.deepEqual(at(e.lastKnown),{x:10,y:10});
  assert.ok(lightAt(g,g.player)>0,'its beam lights your tile');assert.equal(g.sight(e,g.player),true);
});
