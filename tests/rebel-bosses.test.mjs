import {setOperativeDraw} from '../src/operative-draw.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,ENEMY_TYPES,SAVE_VERSION,scaleEnemy,floorDamageBonus,makeBarrier,VOID,giveEnemyAffix,reachable,rollEnemyAffixes,ENEMY_AFFIXES} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {FACTIONS,factionBoss} from '../src/faction-catalog.js';
import {REBEL_BOSS_TUNING,wallPlan,ringPlan,ringTiles,sealsOff,burnCells,burnFlank,inBurn,liveFireIntent,liveBurn,dropStaleRebelIntents,validRebelBosses} from '../src/rebel-bosses.js';
import {DESIGNATED,designated} from '../src/loyalist-bosses.js';
import {FIRE_TUNING,FLAMETHROWER,ignite,sprayFlame,flameCells,validFires} from '../src/fire.js';
import {enemyArmor} from '../src/enemy-affixes.js';
import {fireproof} from '../src/enemy-data.js';
import {hazardTile} from '../src/hazard-paths.js';
import {interruptEnemyIntent} from '../src/enemy-intents.js';
import {applyDisruption} from '../src/throwables.js';
import {addAlly} from '../src/allies.js';
import {giveOrder} from '../src/orders.js';
import {targetDetails} from '../src/target-card.js';
import {PROTOCOL_REWARDS} from '../src/progression.js';
import {ENEMY_BLUEPRINTS} from '../src/workshop.js';
import {enemyBand} from '../src/range-band.js';
import {inCone} from '../src/shotgun.js';
import {edgeCells} from '../src/barriers.js';

// 3.206.0 (user design 2026-09-29, docs/BOSSES.md section 3): 縱火者 sets walls and rings of fire and sprays between them,
// overheating after three fires; 焚線官 is 火線官 with fire for the machine gun. Both are fireproof.
const A=REBEL_BOSS_TUNING.arsonist,B=REBEL_BOSS_TUNING.burn;
function field(){
  const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];g.facilityFaction='rebel';
  Object.assign(g.player,{hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();
  return g;
}
const boss=(g,type,x,y,id=type)=>{const e=makeEnemy(type,x,y,id,type==='burnline'?6:3,0,'rebel');e.alert=true;g.enemies.push(e);g.reveal();return e;};
const foe=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,3,0,'rebel');e.alert=true;e.hp=e.maxHp=500;g.enemies.push(e);g.reveal();return e;};
const pet=(g,x,y)=>{const a=addAlly(g,'pet','crawler',{point:{x,y}});a.hp=a.maxHp=300;g.reveal();return a;};
const fixed=(g,v)=>{g.rng=Object.assign(()=>v,{state:()=>1});};
const noDice=g=>{g.rng=Object.assign(()=>{throw new Error('combat dice rolled');},{state:()=>1});};
const wall=(g,x,y)=>{g.grid[y][x]=0;g.lighting[y][x]=0;};
const k=q=>`${q.x},${q.y}`;
const set=list=>list.map(k).sort().join(' ');
const burning=(g,q)=>Boolean(g.fires?.some(f=>f.x===q.x&&f.y===q.y));
const logged=(g,text)=>g.logs.some(l=>l.text.includes(text));
// An independent check of "never sealed in": with the fire already burning and the boss's body as walls, lighting `cells`
// must leave every floor tile you reach now reachable (locked doors counted open).
function cutsOff(g,e,cells,from=g.player){
  const map=list=>({grid:g.grid,barriers:g.barriers||[],props:[...g.props,...list.map(q=>({type:'cover',hp:1,x:q.x,y:q.y}))]});
  const base=[...(g.fires||[]),{x:e.x,y:e.y}],before=reachable(map(base),from,{keys:true}),after=reachable(map([...base,...cells]),from,{keys:true});
  return [...before].filter(q=>!after.has(q)&&!cells.some(c=>k(c)===q)&&q!==k(from));
}

test('the catalog: the rebels get 縱火者 and 焚線官; the legacy mix, the loyalists and the swarm keep theirs; the numbers',()=>{
  assert.deepEqual(FACTIONS.rebel.bosses,{3:'arsonist',6:'burnline'});
  assert.deepEqual(FACTIONS.legacy.bosses,{3:'warden',6:'boss'});assert.deepEqual(FACTIONS.loyalist.bosses,{3:'designator',6:'gunline'});assert.deepEqual(FACTIONS.swarm.bosses,{3:'hive_beast',6:'hive_matriarch'});
  assert.equal(factionBoss('rebel',3),'arsonist');assert.equal(factionBoss('rebel',6),'burnline');
  const {arsonist:a,burnline:l,warden:w,boss:b}=ENEMY_TYPES;
  // The chassis (Claude's call: stats like the warden and the core guard, as the loyalist pair).
  assert.deepEqual([a.hp,a.armor,l.hp,l.armor],[180,5,280,7]);assert.deepEqual([a.hp,a.armor],[w.hp,w.armor]);assert.deepEqual([l.hp,l.armor,l.damage,l.range],[b.hp,b.armor,b.damage,b.range]);
  for(const c of [a,l]){assert.ok(c.tags.includes('boss'));assert.equal(c.reinforcement,'drone');assert.ok(c.mechanical);assert.equal(c.fireproof,true);assert.deepEqual(c.barredAffixes,['fast','infrared']);assert.deepEqual(c.traits,['suppression_resistance']);}
  assert.deepEqual(a.specials,['wall','ring']);assert.equal(a.flameOnly,true);assert.equal(a.range,5,'its reach is the flamethrower\'s');
  assert.deepEqual(l.specials,['mark','burn']);assert.equal(l.flameOnly,undefined);
  assert.deepEqual([a.intro,l.intro],['introRebel3','introRebel6']);
  for(const c of [w,b])assert.ok(!c.fireproof&&!c.specials&&!c.intro,'the warden and the core guard are untouched');
  assert.deepEqual(w.traits,['infrared','suppression_resistance']);
  assert.equal(PROTOCOL_REWARDS.arsonist,PROTOCOL_REWARDS.warden);assert.equal(PROTOCOL_REWARDS.burnline,PROTOCOL_REWARDS.boss);
  assert.equal(ENEMY_BLUEPRINTS.arsonist,'unit_warden');assert.equal(ENEMY_BLUEPRINTS.burnline,'unit_boss');
  assert.deepEqual(enemyBand('burnline'),enemyBand('boss'));assert.equal(enemyBand('arsonist'),null,'no gun, no band');
  assert.deepEqual(A,{reach:6,heat:3,vent:2,wall:{offset:1,half:2,min:3},ring:{radius:2,gaps:2,min:4}});
  assert.deepEqual(B,{halfAngle:30,range:5,sweeps:3,packUp:2,damage:12,flank:15});
  // No 快速 or 紅外線 on either; the draw is still spent.
  const fast=ENEMY_AFFIXES.find(x=>x.id==='fast'),infrared=ENEMY_AFFIXES.find(x=>x.id==='infrared');
  for(const type of ['arsonist','burnline']){const e=makeEnemy(type,5,5,'x',6,0,'rebel');assert.equal(fast.applies(e),false);assert.equal(infrared.applies(e),false);}
  for(let seed=1;seed<=16;seed++)for(const floor of [3,6,9,12])for(const e of generate(seed,floor,[],0,'rebel').enemies)if(['arsonist','burnline'].includes(e.type))assert.ok(!e.affixes.some(x=>['fast','infrared'].includes(x.id)),`${seed}:${floor}`);
  // Generated floors: rebel 3, 6 and 9 hold them; the legacy mix never does. 3.207.0: with the delisted operatives' draw
  // off (src/operative-draw.js); 30% of floors 6, 9, 12... meet one instead.
  setOperativeDraw(()=>null);
  try{for(const seed of [3,11]){
    for(const [floor,type] of [[3,'arsonist'],[6,'burnline'],[9,'arsonist'],[12,'burnline']])assert.ok(generate(seed,floor,[],0,'rebel').enemies.some(e=>e.type===type),`${seed}:${floor}`);
    const three=generate(seed,3,[],0,'legacy').enemies,six=generate(seed,6,[],0,'legacy').enemies;
    assert.ok(three.some(e=>e.type==='warden')&&six.some(e=>e.type==='boss'));assert.ok(![...three,...six].some(e=>['arsonist','burnline'].includes(e.type)));
  }}finally{setOperativeDraw(null);}
});

test('fireproof: burning floor, a spray, your flamethrower and the fixed fire do nothing to them; a blast still does',()=>{
  for(const type of ['arsonist','burnline']){
    const g=field(),b=boss(g,type,16,10),r=foe(g,'rifleman',16,14,'r');b.markReady=999;b.special='mark';
    g.fires=[{x:16,y:10,age:1},{x:16,y:14,age:1}];assert.equal(fireproof(b),true);assert.equal(fireproof(r),false);
    assert.equal(hazardTile(g,16,10,b),false,'fire is no hazard to it');assert.equal(hazardTile(g,16,14,r),true);
    const hp=b.hp,rhp=r.hp;g.environmentTurn();assert.equal(b.hp,hp,`${type}: the floor does not burn it`);assert.equal(r.hp,rhp-FIRE_TUNING.damage,'a rifleman on fire burns');
    g.hazards=[{x:16,y:10,type:'fire'},{x:16,y:14,type:'acid'}];assert.equal(hazardTile(g,16,10,b),false);g.environmentTurn();assert.equal(b.hp,hp,'nor the fixed fire of floors 5-6');
    g.hazards=[{x:16,y:10,type:'acid'}];assert.equal(hazardTile(g,16,10,b),true,'acid is still acid');
    // A flamer's spray washes over it and burns the rifleman beside it.
    const f=field(),c=boss(f,type,14,10),o=foe(f,'rifleman',14,11,'o'),fl=foe(f,'rifleman',17,10,'fl');giveEnemyAffix(fl,'flamer');fixed(f,0);
    const chp=c.hp,ohp=o.hp;sprayFlame(f,fl,{x:13,y:10},()=>20);assert.equal(c.hp,chp,`${type}: a spray does nothing`);assert.ok(o.hp<ohp,'the rifleman beside it burns');
    // Your flamethrower: nothing, and you are told so.
    const y=field(),d=boss(y,type,13,10),slot=y.addWeapon(FLAMETHROWER);y.player.weapon=slot;const dhp=d.hp;
    assert.ok(y.action('launch',{x:13,y:10}));assert.equal(d.hp,dhp);assert.ok(logged(y,`${ENEMY_TYPES[type].name}不怕火`),'it shrugs it off');
    // A blast is a blast.
    const z=field(),e=boss(z,type,13,10),ehp=e.hp;z.explode({x:13,y:11},1,30);assert.ok(e.hp<ehp,'a blast hurts it');
  }
});

test('火牆: a line of three to five right behind you, warned a round; its next turn the whole line goes up',()=>{
  const g=field(),b=boss(g,'arsonist',15,10);
  g.enemyAct(b);
  assert.equal(b.fireIntent.kind,'wall');assert.deepEqual(b.fireIntent.origin,{x:15,y:10});assert.ok(liveFireIntent(b));
  assert.equal(set(b.fireIntent.cells),set([{x:9,y:8},{x:9,y:9},{x:9,y:10},{x:9,y:11},{x:9,y:12}]),'across your back, away from it');
  assert.equal(g.fires,undefined,'only a warning');assert.equal(b.special,'ring','the ring is next');assert.ok(logged(g,'潑出一道燃料'));
  assert.equal(b.flameIntent,undefined,'and no spray marked with it');
  // Anyone standing on the line as it goes up is burned (no hit roll); you, in front of it, are not.
  const a=pet(g,9,11),ahp=a.hp,you=g.player.hp;fixed(g,0);
  g.enemyAct(b);
  assert.equal(b.fireIntent,undefined);assert.ok(b.fireIntent===undefined&&[{x:9,y:8},{x:9,y:9},{x:9,y:10},{x:9,y:11},{x:9,y:12}].every(q=>burning(g,q)),'the whole line burns');
  assert.ok(g.fires.every(f=>f.age===1));assert.equal(g.fires.length,5);assert.ok(a.hp<ahp,'burned where it stood');assert.equal(g.player.hp,you);
  assert.equal(b.heat,1,'one fire');assert.ok(logged(g,'點燃火牆'));
  // With a wall at your back it goes to your side, as long as it fits (three at least); in a one-tile corridor, nowhere.
  const h=field(),c=boss(h,'arsonist',15,10);for(let y=0;y<27;y++)wall(h,9,y);h.reveal();h.enemyAct(c);
  assert.equal(c.fireIntent?.kind,'wall');const side=c.fireIntent.cells;
  assert.ok(side.length>=A.wall.min&&side.length<=5&&side.every(q=>Math.abs(q.y-10)===1&&q.x>=10&&q.x<=12),JSON.stringify(side));
  const n=field(),d=boss(n,'arsonist',15,10);for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(y!==10||x<2||x>24)wall(n,x,y);n.reveal();
  assert.equal(wallPlan(n,d,n.player),null,'no room for three');
  // A closed door or a partition across the line stops it there.
  const q=field(),e=boss(q,'arsonist',15,10);q.barriers=[makeBarrier('partition',{x:9,y:9},{x:9,y:8},'p1')];
  assert.equal(set(wallPlan(q,e,q.player)),set([{x:9,y:9},{x:9,y:10},{x:9,y:11},{x:9,y:12}]));
  // It never takes the exit or the way in.
  const s=field(),f=boss(s,'arsonist',15,10);s.end={x:9,y:10};const plan=wallPlan(s,f,s.player);assert.ok(plan&&!plan.some(q=>k(q)==='9,10'),'not on the exit');
});

test('火牆 never cuts you off: across a narrow corridor it goes to your side, and fire already burning counts as a wall',()=>{
  // A three-wide corridor: a line behind you would close it, so the line runs along your side instead.
  const g=field(),b=boss(g,'arsonist',15,10);for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(y<9||y>11)wall(g,x,y);g.reveal();
  const plan=wallPlan(g,b,g.player);assert.ok(plan,'a wall still fits');
  assert.ok(plan.every(q=>q.y===plan[0].y)&&plan[0].y!==10,'along the corridor, at your side');assert.deepEqual(cutsOff(g,b,plan),[]);
  // Fire already burning in the other side lane: that one would close you in, so there is no wall at all.
  const h=field(),c=boss(h,'arsonist',15,10);for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(y<9||y>11)wall(h,x,y);h.fires=[{x:8,y:11,age:1},{x:8,y:9,age:1}];h.reveal();
  const p2=wallPlan(h,c,h.player);assert.ok(!p2||cutsOff(h,c,p2).length===0,JSON.stringify(p2));
  assert.equal(sealsOff(h,c,[{x:9,y:10}]),true,'the one gap left would be closed');
});

test('圍困: the tiles two steps from you, gaps square to the boss\'s line; next turn the ring goes up and the gaps lead out',()=>{
  const g=field(),b=boss(g,'arsonist',15,10);b.special='ring';
  g.enemyAct(b);
  const s=b.fireIntent;assert.equal(s.kind,'ring');assert.deepEqual(s.center,{x:10,y:10});
  assert.equal(set(s.gaps),set([{x:10,y:8},{x:10,y:12}]),'the way out is to the side');
  assert.equal(set(s.cells),set([{x:8,y:10},{x:12,y:10},{x:9,y:9},{x:11,y:9},{x:9,y:11},{x:11,y:11}]));
  assert.ok([...s.cells,...s.gaps].every(q=>Math.abs(q.x-10)+Math.abs(q.y-10)===2));assert.equal(b.special,'wall');assert.ok(logged(g,'留了缺口'));
  fixed(g,0);g.enemyAct(b);
  assert.ok(s.cells.every(q=>burning(g,q))&&!s.gaps.some(q=>burning(g,q)),'the ring burns, the gaps do not');
  // Out through a gap without touching fire.
  const blocked=[...g.fires,{x:b.x,y:b.y}];const r=reachable({grid:g.grid,barriers:[],props:blocked.map(q=>({type:'cover',hp:1,x:q.x,y:q.y}))},g.player);
  assert.ok(r.has('10,6')&&r.has('3,3'),'you walk out');
  // Nobody's tile is a gap (a body in it would close it), and fewer than four tiles alight is no ring.
  const h=field(),c=boss(h,'arsonist',15,10);foe(h,'rifleman',10,8,'in-gap');const p=ringPlan(h,c,h.player);
  assert.ok(!p.gaps.some(q=>k(q)==='10,8'),'not the occupied tile');assert.equal(p.gaps.length,A.ring.gaps);
  const n=field(),d=boss(n,'arsonist',15,10);for(let y=0;y<27;y++)for(let x=0;x<27;x++)if(y!==10||x<2||x>24)wall(n,x,y);n.reveal();assert.equal(ringPlan(n,d,n.player),null,'a corridor holds no ring');
  // Behind a wall is not part of it: two steps away by a straight-enough walk only.
  const w=field();wall(w,11,10);wall(w,11,9);wall(w,11,11);w.reveal();assert.ok(!ringTiles(w,w.player,2).some(q=>k(q)==='12,10'));
  const e2=field();e2.barriers=[makeBarrier('partition',{x:11,y:10},{x:12,y:10},'p')];assert.ok(!ringTiles(e2,e2.player,2).some(q=>k(q)==='12,10'),'nor across a partition');assert.ok(ringTiles(e2,e2.player,2).some(q=>k(q)==='11,11'));
});

test('圍困 and 火牆 never seal you in, near walls, pits, corners and doors (random floors)',()=>{
  let rings=0,walls=0;
  for(let seed=1;seed<=160;seed++){
    let s=seed*2654435761>>>0;const rnd=()=>((s=Math.imul(s^s>>>15,2246822507)+seed>>>0)/4294967296);
    const g=field();for(let y=0;y<27;y++)for(let x=0;x<27;x++){const v=rnd();if(x<1||y<1||x>25||y>25||v<.14)wall(g,x,y);else if(v<.2)g.grid[y][x]=VOID;}
    g.player.x=6+Math.floor(rnd()*14);g.player.y=6+Math.floor(rnd()*14);g.grid[g.player.y][g.player.x]=1;
    if(rnd()<.4)g.barriers=[makeBarrier('partition',{x:g.player.x+1,y:g.player.y},{x:g.player.x+1,y:g.player.y+1},'p'),{...makeBarrier('door',{x:g.player.x,y:g.player.y-1},{x:g.player.x,y:g.player.y-2},'d')}];
    if(rnd()<.3)g.fires=[{x:g.player.x+2,y:g.player.y,age:2}].filter(q=>g.grid[q.y]?.[q.x]===1);
    const bx=g.player.x+3+Math.floor(rnd()*3),by=g.player.y+Math.floor(rnd()*3)-1;if(g.grid[by]?.[bx]!==1)continue;
    g.reveal();const b=boss(g,'arsonist',bx,by);
    const w=wallPlan(g,b,g.player),r=ringPlan(g,b,g.player);
    if(w){walls++;assert.deepEqual(cutsOff(g,b,w),[],`seed ${seed}: the wall`);assert.ok(w.length>=3&&w.length<=5);assert.ok(w.every(q=>g.grid[q.y][q.x]===1&&!(q.x===g.player.x&&q.y===g.player.y)));}
    if(r){rings++;assert.deepEqual(cutsOff(g,b,r.cells),[],`seed ${seed}: the ring`);assert.ok(r.cells.length>=A.ring.min);
      assert.ok([...r.cells,...r.gaps].every(q=>g.grid[q.y][q.x]===1&&Math.abs(q.x-g.player.x)+Math.abs(q.y-g.player.y)===2),'floor, two steps off');
      assert.ok(!r.gaps.some(q=>r.cells.some(c=>k(c)===k(q))));}
  }
  assert.ok(rings>25&&walls>60,`${rings} rings, ${walls} walls tried`);
});

test('a vault door is never cut off: locked doors count as open (generated rebel floors)',()=>{
  let checked=0;
  for(const seed of [9,10,12,16,18,22,24,25]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});g.floor=3;g.loadFloor();
    const door=g.barriers.find(b=>b.vault);assert.ok(door,`${seed}`);const b=g.enemies.find(e=>e.type==='arsonist');assert.ok(b,`${seed}`);
    const reach=reachable(g,g.start),front=edgeCells(door).map(c=>({x:Math.round(c.x),y:Math.round(c.y)})).find(c=>reach.has(k(c)));
    for(const dx of [-2,-1,0,1,2])for(const dy of [-2,-1,0,1,2]){
      const p={x:front.x+dx,y:front.y+dy};if(g.grid[p.y]?.[p.x]!==1||g.solid(p.x,p.y)||(p.x===b.x&&p.y===b.y))continue;Object.assign(g.player,p);
      for(const plan of [wallPlan(g,b,g.player),ringPlan(g,b,g.player)?.cells]){if(!plan)continue;checked++;assert.deepEqual(cutsOff(g,b,plan),[],`seed ${seed} at ${k(p)}`);}
    }
  }
  assert.ok(checked>20,`${checked}`);
});

test('the ignition checks again: a tile that can no longer burn or would now close you in stays out, and the log says so',()=>{
  const g=field(),b=boss(g,'arsonist',15,10);b.special='ring';g.enemyAct(b);const s=b.fireIntent;
  // Since the warning fire has spread into both gaps and a crate has landed on the ring: all of it alight would shut you
  // in, so one more tile stays out, and the crate's tile cannot catch.
  g.fires=[{x:10,y:8,age:2},{x:10,y:12,age:2}];g.props.push({id:'crate-x',type:'cover',x:8,y:10,hp:65,maxHp:65});fixed(g,0);
  g.enemyAct(b);
  const lit=s.cells.filter(q=>burning(g,q));assert.ok(!burning(g,{x:8,y:10}),'the crate tile does not catch');
  assert.equal(lit.length,s.cells.length-2,'one tile stays out so you are not shut in');
  const r=reachable({grid:g.grid,barriers:[],props:[...g.props,...g.fires.map(q=>({type:'cover',hp:1,x:q.x,y:q.y})),{type:'cover',hp:1,x:b.x,y:b.y}]},g.player);
  assert.ok(r.has('3,3'),'still a way out');assert.ok(logged(g,'有 2 格沒燒起來'),'the tiles that did not catch are logged');
  assert.equal(b.heat,1,'still one fire');
  // Hemmed in by old fire already (it dies down; the boss's may outlast it): the new ring alone must leave a way out too.
  const h=field(),c=boss(h,'arsonist',15,10);h.fires=[{x:9,y:10,age:1},{x:11,y:10,age:1},{x:10,y:9,age:1},{x:10,y:11,age:1}];
  const all=ringTiles(h,h.player,2);assert.equal(sealsOff(h,c,all),true,'the full ring, gaps and all, would shut you in once the old fire is out');
  const p=ringPlan(h,c,h.player);assert.ok(p&&p.gaps.length>=1);h.fires=undefined;assert.deepEqual(cutsOff(h,c,p.cells),[]);
});

test('過熱: the third fire sends it venting two of its turns — no fire, armour 0 — and a wall or ring only on heat 0 or 2',()=>{
  const g=field(),b=boss(g,'arsonist',14,10),seen=[];fixed(g,0);
  for(let i=0;i<14;i++){const before={heat:b.heat||0,over:b.overheat||0};g.enemyAct(b);
    seen.push([b.fireIntent?b.fireIntent.kind:b.flameIntent?'spray':b.overheat?'vent':'-',before.heat,before.over]);
    if(b.fireIntent)assert.equal(before.heat%2,0,`a special on heat ${before.heat}`);
    if(before.over)assert.ok(!b.fireIntent&&!b.flameIntent,'no fire while venting');}
  const kinds=seen.map(s=>s[0]).join(' ');
  assert.match(kinds,/^wall - spray - ring vent vent - wall - spray - ring vent/,kinds);   // the round after a mark it goes off ('-')
  // The numbers on the vent: armour 0 for both turns, back after the second; the target card and the log say so.
  const h=field(),c=boss(h,'arsonist',14,10);c.heat=2;c.fireIntent={kind:'wall',origin:{x:14,y:10},cells:[{x:9,y:9},{x:9,y:10},{x:9,y:11}]};fixed(h,0);
  h.enemyAct(c);assert.equal(c.overheat,A.vent);assert.equal(c.heat,undefined);assert.equal(enemyArmor(c),0);assert.ok(logged(h,'過熱！2 回合不能噴火'));
  h.target=c.id;assert.match(targetDetails(h).state,/過熱：裝甲 0 · 2 回合/);assert.doesNotMatch(targetDetails(h).hp,/護甲/,'no armour shown');
  const hit=(e,g2)=>{const before=e.hp;g2.hitTarget(e,20,g2.player,0,{id:'test',ammoType:'pistol'});return before-e.hp;};
  const cool=field(),cc=boss(cool,'arsonist',14,10);assert.ok(hit(c,h)>hit(cc,cool),'a pistol round bites deeper while it vents');
  h.enemyAct(c);assert.equal(c.overheat,1);assert.equal(enemyArmor(c),0);assert.equal(c.fireIntent,undefined);assert.equal(c.flameIntent,undefined);
  h.enemyAct(c);assert.equal(c.overheat,undefined);assert.equal(enemyArmor(c),5,'armour back');assert.ok(logged(h,'散熱完畢'));
  h.enemyAct(c);assert.ok(c.fireIntent||c.flameIntent,'and fire again');
  // Venting it walks toward you (as 火線官 packs up), and does nothing else.
  const w=field(),d=boss(w,'arsonist',20,10);d.overheat=2;w.enemyAct(w.enemies[0]);assert.ok(d.x<20,'it walked');assert.equal(d.fireIntent,undefined);assert.equal(d.flameIntent,undefined);
  // The heat on the target card.
  const t=field(),e=boss(t,'arsonist',14,10);e.heat=1;t.target=e.id;assert.match(targetDetails(t).state,/熱度 1\/3/);
});

test('its spray in between: the 火焰兵\'s cone, marked a round, sprayed from where it was marked, a fire toward overheating',()=>{
  const g=field(),b=boss(g,'arsonist',14,10);b.heat=1;
  g.enemyAct(b);assert.deepEqual(b.flameIntent,{origin:{x:14,y:10},aim:{x:10,y:10}});assert.equal(b.fireIntent,undefined,'odd heat: no wall or ring');
  const hp=g.player.hp;fixed(g,0);g.enemyAct(b);
  assert.ok(g.player.hp<hp,'sprayed');assert.ok(burning(g,g.player),'your tile catches');assert.equal(b.heat,2);assert.equal(b.flameIntent,undefined);
  // It never fires a gun: a decoy is walked to, a mine it saw is left alone.
  const d=field(),c=boss(d,'arsonist',18,10);c.heat=1;d.mines=[{id:'mine-1-1',x:18,y:14,seen:[c.id]}];d.mineSerial=1;d.decoy={x:18,y:12,hp:30,maxHp:30,expires:d.turn+3,fooled:[c.id]};fixed(d,0);
  d.enemyAct(c);assert.equal(d.mines.length,1,'no shot at the mine');assert.equal(d.decoy.hp,30,'none at the decoy');
  // Your units are fair game: a pet in the cone burns.
  const h=field(),e=boss(h,'arsonist',14,10);e.heat=1;h.enemyAct(e);const a=pet(h,12,10),ahp=a.hp;fixed(h,0);h.enemyAct(e);assert.ok(a.hp<ahp);
  // Its fire burning one of its own is not yours: no kill, no damage count, and the log says who did it.
  const o=field(),f=boss(o,'arsonist',14,10);f.heat=1;o.enemyAct(f);const r=foe(o,'rifleman',12,10,'r');r.hp=5;const kills=o.player.kills,dmg=o.player.stats.damage,xp=o.player.xp;fixed(o,0);o.enemyAct(f);
  assert.ok(r.hp<=0);assert.equal(o.player.kills,kills);assert.equal(o.player.stats.damage,dmg);assert.equal(o.player.xp,xp);assert.ok(logged(o,'縱火者傷到'));
});

test('the floor\'s 30 tiles: a boss\'s fire makes room — the oldest go out — and says so; your own fire still stops at 30',()=>{
  const g=field(),b=boss(g,'arsonist',15,10);g.enemyAct(b);
  const old=[];for(let i=0;i<30;i++)old.push({x:1+i%25,y:20+Math.floor(i/25)*2,age:1+i%5});g.fires=old.map(f=>({...f}));
  fixed(g,0);g.enemyAct(b);
  assert.equal(g.fires.length,FIRE_TUNING.maxTiles,'never more than 30');
  assert.ok([8,9,10,11,12].every(y=>burning(g,{x:9,y})),'the whole wall burns');
  const gone=old.filter(f=>!burning(g,f));assert.equal(gone.length,5);assert.ok(gone.every(f=>f.age===5),'the oldest went out');
  assert.deepEqual(gone.map(k),old.filter(f=>f.age===5).slice(0,5).map(k),'the first in reading order among equals');
  assert.ok(logged(g,'最早燒起的 5 格熄滅'),'the log says so');
  // Without makeRoom (your flamethrower, a flamer, a tank): nothing new past 30.
  const h=field();h.fires=old.map(f=>({...f}));assert.equal(ignite(h,[{x:5,y:5}]),0);assert.equal(h.fires.length,30);
  assert.deepEqual(ignite(h,[{x:5,y:5}],{makeRoom:true}),{lit:1,displaced:1});assert.ok(burning(h,{x:5,y:5}));
  // Relighting what burns already needs no room.
  assert.deepEqual(ignite(h,[{x:5,y:5}],{makeRoom:true}),{lit:1,displaced:0});
  // The arsonist's spray and 焚線官's sweep make room the same way.
  const s=field(),a=boss(s,'arsonist',14,10);a.flameIntent={origin:{x:14,y:10},aim:{x:10,y:10}};s.fires=old.map(f=>({...f}));fixed(s,0);s.enemyAct(a);
  assert.equal(s.fires.length,30);assert.ok(flameCells(s,{x:14,y:10},{x:10,y:10}).every(q=>burning(s,q)),'the whole spray caught');assert.ok(logged(s,'最早燒起的'));
  const w=field(),l=boss(w,'burnline',15,10);l.burn={stage:'sweep',origin:{x:15,y:10},aim:{x:10,y:10},left:2};w.fires=old.map(f=>({...f}));fixed(w,0);w.enemyAct(l);
  assert.equal(w.fires.length,30);assert.ok(burnCells(w,{x:15,y:10},{x:10,y:10}).every(q=>burning(w,q)),'the whole cone caught');
});

test('焚線官: marks you like the Designator; a cone of 30 degrees and 5, three sweeps of fire, then two rounds packing up',()=>{
  const g=field(),b=boss(g,'burnline',15,10);
  g.enemyAct(b);assert.ok(b.markIntent,'the mark first');assert.equal(b.special,'burn');
  g.enemyAct(b);assert.equal(designated(g.player),true,'the mark lands');
  const h=field(),c=boss(h,'burnline',15,10);c.special='burn';
  h.enemyAct(c);assert.deepEqual(c.burn,{stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}});assert.ok(liveBurn(c));assert.equal(c.special,'mark');
  const cells=burnCells(h,c.burn.origin,c.burn.aim);
  assert.ok(cells.length>0&&cells.every(q=>{const d=Math.abs(q.x-15)+Math.abs(q.y-10);return d>=1&&d<=B.range&&inCone(c.burn.origin,c.burn.aim,q,B.halfAngle);}));
  assert.ok(cells.some(q=>k(q)==='10,10')&&!cells.some(q=>k(q)==='9,10'),'range 5');assert.ok(!cells.some(q=>k(q)==='13,7'),'narrower than the machine gun');
  assert.equal(h.fires,undefined,'the warning burns nothing');
  // Sweeps: no dice at all; the same damage every time; the cone catches; it neither moves nor turns.
  const dmg=scaleEnemy(B.damage+floorDamageBonus(h.floor,h.difficultySpec),h.floor,'damage',h.difficultySpec);noDice(h);
  const hp=h.player.hp;h.enemyAct(c);assert.equal(hp-h.player.hp,dmg,'one sweep');assert.ok(cells.filter(q=>h.grid[q.y][q.x]===1).every(q=>burning(h,q)));
  assert.deepEqual(c.burn,{stage:'sweep',origin:{x:15,y:10},aim:{x:10,y:10},left:B.sweeps-1});
  h.player.x=19;h.player.y=10;h.reveal();
  for(let i=1;i<B.sweeps;i++){h.enemyAct(c);assert.deepEqual([c.x,c.y],[15,10]);if(c.burn?.aim)assert.deepEqual(c.burn.aim,{x:10,y:10});}
  assert.deepEqual(c.burn,{stage:'pack',left:B.packUp});assert.ok(logged(h,'收起火焰發射器'));
  // Packing up it walks, and does nothing else (not even with the mark ready).
  fixed(h,0);h.player.x=4;h.player.y=10;h.reveal();c.markReady=0;const php=h.player.hp;
  h.enemyAct(c);assert.ok(c.x<15,'it walks');assert.deepEqual(c.burn,{stage:'pack',left:1});assert.equal(c.markIntent,undefined);
  h.enemyAct(c);assert.equal(c.burn,undefined);assert.equal(c.markIntent,undefined);assert.equal(h.player.hp,php,'no shot, no fire');
  // Set up, it is +15 from outside the cone (the angle alone).
  const f=field(),e=boss(f,'burnline',16,10);e.burn={stage:'sweep',origin:{x:16,y:10},aim:{x:10,y:10},left:2};e.moved=true;e.evasive=true;
  f.player.x=12;f.reveal();const front=f.accuracy(f.player,e).chance;assert.equal(burnFlank(f,f.player,e),0);
  f.player.x=20;f.reveal();assert.equal(burnFlank(f,f.player,e),B.flank);assert.equal(f.accuracy(f.player,e).chance-front,B.flank);assert.equal(f.accuracy(f.player,e).gunFlankBonus,15);
  f.player.x=4;assert.equal(burnFlank(f,f.player,e),0,'straight ahead out of reach is still in front');
  assert.equal(f.meleeAccuracy(f.player,e,60)-(()=>{const s=e.burn;delete e.burn;const v=f.meleeAccuracy(f.player,e,60);e.burn=s;return v;})(),0,'in front (x 4): no bonus to a blow either');
  f.player.x=17;assert.equal(f.meleeAccuracy(f.player,e,60)-(()=>{const s=e.burn;delete e.burn;const v=f.meleeAccuracy(f.player,e,60);e.burn=s;return v;})(),B.flank,'a blow from behind');
  f.target=e.id;assert.match(targetDetails(f).state,/架起火焰發射器：不能移動/);assert.match(targetDetails(f).state,/扇形外 \+15/);
});

test('焚線官 takes turns (mark, then fire), sweeps anyone in the cone, and calls drones at half health',()=>{
  const g=field(),b=boss(g,'burnline',15,10),seen=[];
  for(let i=0;i<16;i++){const had={mark:Boolean(b.markIntent),set:b.burn?.stage==='set'};g.action('wait');if(b.markIntent&&!had.mark)seen.push('mark');if(b.burn?.stage==='set'&&!had.set)seen.push('burn');}
  assert.deepEqual(seen.slice(0,4),['mark','burn','mark','burn'],JSON.stringify(seen));
  // Everyone in the cone burns, its own side too (not your kill), your pet too; outside it, nobody.
  const h=field(),c=boss(h,'burnline',15,10);c.burn={stage:'sweep',origin:{x:15,y:10},aim:{x:10,y:10},left:2};
  const r=foe(h,'rifleman',12,10,'r'),o=foe(h,'rifleman',15,4,'out'),a=pet(h,11,10),kills=h.player.kills,dmg=h.player.stats.damage,rhp=r.hp,ohp=o.hp,ahp=a.hp;fixed(h,0);
  h.enemyAct(c);assert.ok(r.hp<rhp&&a.hp<ahp);assert.equal(o.hp,ohp);assert.equal(h.player.kills,kills);assert.equal(h.player.stats.damage,dmg);assert.ok(logged(h,'焚線官傷到'));
  // Half health: drones, unannounced, also on a turn the sweep takes.
  const k2=field(),e=boss(k2,'burnline',16,10);e.burn={stage:'sweep',origin:{x:16,y:10},aim:{x:10,y:10},left:2};e.hp=Math.floor(e.maxHp/2)-1;const before=k2.enemies.length;fixed(k2,0);
  k2.enemyAct(e);assert.ok(e.reinforced);assert.ok(k2.enemies.length>before&&k2.enemies.slice(before).every(d=>d.type==='drone'));
  const k3=field(),z=boss(k3,'arsonist',14,10);z.hp=Math.floor(z.maxHp/2)-1;fixed(k3,0);k3.enemyAct(z);assert.ok(z.reinforced,'the arsonist too');
  // Never on the round a mark lands.
  const m=field(),w=boss(m,'burnline',15,10);for(let i=0;i<12;i++){const before=Boolean(w.markIntent);m.action('wait');if(before&&!w.markIntent)assert.notEqual(w.burn?.stage,'set');}
});

test('interruptions: an EMP (they are machines; a stun grenade does nothing), a pull or death drop what is warned',()=>{
  for(const stop of [(g,b)=>applyDisruption(b,'mechanical'),(g,b)=>interruptEnemyIntent(b,'displaced'),(g,b)=>g.hurt(b,b.hp,g.player)]){
    const g=field(),b=boss(g,'arsonist',15,10);g.enemyAct(b);assert.ok(b.fireIntent);stop(g,b);assert.equal(b.fireIntent,undefined);
    fixed(g,0);g.enemyAct(b);assert.equal(g.fires,undefined,'nothing goes up');assert.equal(b.heat,undefined,'no fire, no heat');
    const h=field(),c=boss(h,'arsonist',14,10);c.heat=1;h.enemyAct(c);assert.ok(c.flameIntent);stop(h,c);assert.equal(c.flameIntent,undefined,'the marked spray too');
    const s=field(),d=boss(s,'burnline',15,10);d.special='burn';s.enemyAct(d);assert.equal(d.burn.stage,'set');stop(s,d);assert.equal(d.burn,undefined,'dropped while it sets up');
    if(stop.toString().includes('hurt'))continue;
    const w=field(),e=boss(w,'burnline',15,10);e.special='burn';w.enemyAct(e);fixed(w,0);w.enemyAct(e);assert.equal(e.burn.stage,'sweep');stop(w,e);assert.deepEqual(e.burn,{stage:'pack',left:B.packUp},'sweeping: packs up at once');
  }
  const g=field(),b=boss(g,'arsonist',15,10);g.enemyAct(b);assert.equal(applyDisruption(b,'biological'),false);assert.ok(b.fireIntent,'a stun grenade: nothing');
  interruptEnemyIntent(b,'target_lost');interruptEnemyIntent(b,'suppressed');assert.ok(b.fireIntent,'losing you or being suppressed changes nothing');
  // Moved off the tile it warned from outside its own turn, with nothing to stop it: the warning is gone, nothing burns.
  const mv=field(),mb=boss(mv,'arsonist',15,10);mv.enemyAct(mb);mb.x=16;fixed(mv,0);mv.enemyAct(mb);
  assert.ok(![8,9,10,11,12].some(y=>burning(mv,{x:9,y})),'no wall from elsewhere');assert.equal(mb.heat,undefined,'and no fire used');
  const mw=field(),ml=boss(mw,'burnline',15,10);ml.burn={stage:'sweep',origin:{x:15,y:10},aim:{x:10,y:10},left:2};ml.x=16;fixed(mw,0);const mhp=mw.player.hp;mw.enemyAct(ml);
  assert.equal(mw.fires,undefined,'no sweep from off its mount');assert.equal(mw.player.hp,mhp);assert.notEqual(ml.burn?.stage,'sweep');
  // Out of sight when it goes off: it goes off all the same (a warning is a promise).
  for(let y=0;y<27;y++)wall(g,13,y);g.reveal();assert.equal(g.sight(b,g.player),false);fixed(g,0);g.enemyAct(b);assert.ok(burning(g,{x:9,y:10}));
  // Killed in its own sweep (a bomber on fire blows up beside it): it stops, and nothing is left to pack up.
  const k2=field(),e=boss(k2,'burnline',15,10);e.burn={stage:'sweep',origin:{x:15,y:10},aim:{x:10,y:10},left:2};e.hp=5;foe(k2,'bomber_bot',14,10,'bot').hp=1;fixed(k2,0);
  k2.enemyAct(e);assert.ok(e.hp<=0,'burned down by the blast');assert.equal(e.burn,undefined,'no pack-up on a dead boss');
  // The arsonist killed as its wall goes up: the fire is out already (one instant), but no heat is counted on the dead.
  const k3=field(),f=boss(k3,'arsonist',15,10);f.fireIntent={kind:'wall',origin:{x:15,y:10},cells:[{x:14,y:9},{x:14,y:10},{x:14,y:11}]};f.hp=5;f.heat=2;foe(k3,'bomber_bot',14,10,'bot').hp=1;fixed(k3,0);
  k3.enemyAct(f);assert.ok(f.hp<=0);assert.equal(f.overheat,undefined);assert.ok(burning(k3,{x:14,y:9}));
});

test('priority: a warned wall, ring or sweep goes off first — no decoy, mine, order or fire underfoot puts it off',()=>{
  const cases=[
    ['decoy',(g,b)=>{g.decoy={x:b.x,y:b.y+2,hp:30,maxHp:30,expires:g.turn+3,fooled:[b.id]};}],
    ['mine',(g,b)=>{g.mines=[{id:'mine-1-1',x:b.x,y:b.y+4,seen:[b.id]}];g.mineSerial=1;}],
    ['order',(g,b)=>{assert.ok(giveOrder(g,b,{kind:'retreat',by:'self',at:{x:22,y:20}}));}],
    ['acid',(g,b)=>{g.hazards=[{x:b.x,y:b.y,type:'acid'}];}],
  ];
  for(const [name,setup] of cases){
    const g=field(),b=boss(g,'arsonist',15,10);g.enemyAct(b);setup(g,b);fixed(g,0);g.enemyAct(b);
    assert.deepEqual([b.x,b.y],[15,10],`${name}: from where it warned`);assert.ok(burning(g,{x:9,y:10}),`${name}: the wall went up`);
    const h=field(),c=boss(h,'burnline',15,10);c.burn={stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}};setup(h,c);fixed(h,.999);h.enemyAct(c);
    assert.deepEqual([c.x,c.y],[15,10],`${name}: the sweep from its mount`);assert.equal(c.burn?.stage,'sweep',`${name}: swept on schedule`);
    if(name==='decoy')assert.equal(h.decoy.hp,30,'no shot at the decoy');if(name==='mine')assert.equal(h.mines.length,1,'nor at the mine');
  }
  // Packing up, it does not shoot at a mine or a decoy either.
  const p=field(),d=boss(p,'burnline',16,10);d.burn={stage:'pack',left:2};p.mines=[{id:'mine-1-1',x:16,y:14,seen:[d.id]}];p.mineSerial=1;fixed(p,0);p.enemyAct(d);assert.equal(p.mines.length,1);
});

test('saves: walls, rings, heat, venting, a marked spray and a set-up flamethrower come back; bad ones are refused',()=>{
  assert.equal(SAVE_VERSION,88);
  const g=field(),b=boss(g,'arsonist',15,10,'ars'),l=boss(g,'burnline',16,16,'burn');
  b.special='ring';g.enemyAct(b);b.heat=2;l.burn={stage:'sweep',origin:{x:16,y:16},aim:{x:12,y:16},left:2};l.special='mark';l.markReady=g.turn+3;
  const raw=g.serialize(),back=Game.restore(raw);assert.ok(back,'loads');
  const bb=back.enemies.find(e=>e.id==='ars'),ll=back.enemies.find(e=>e.id==='burn');
  assert.deepEqual(bb.fireIntent,b.fireIntent);assert.equal(bb.heat,2);assert.equal(bb.special,'wall');assert.deepEqual(ll.burn,l.burn);assert.equal(ll.special,'mark');
  fixed(back,0);back.enemyAct(bb);assert.ok(b.fireIntent.cells.every(q=>burning(back,q)),'it goes up after the load');assert.equal(bb.overheat,A.vent);
  const vent=field(),v=boss(vent,'arsonist',15,10,'v');v.overheat=1;const vb=Game.restore(vent.serialize());assert.ok(vb);assert.equal(vb.enemies[0].overheat,1);assert.equal(enemyArmor(vb.enemies[0]),0);
  const spray=field(),s=boss(spray,'arsonist',14,10,'s');s.heat=1;spray.enemyAct(s);assert.ok(s.flameIntent);const sb=Game.restore(spray.serialize());assert.ok(sb,'a marked spray on the arsonist');assert.deepEqual(sb.enemies[0].flameIntent,s.flameIntent);assert.ok(validFires(sb));
  for(const burn of [{stage:'pack',left:2},{stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}}]){const pack=field(),pk=boss(pack,'burnline',15,10);pk.burn=burn;const pb=Game.restore(pack.serialize());assert.ok(pb,burn.stage);assert.deepEqual(pb.enemies[0].burn,burn);}
  const bad=[
    d=>{d.enemies.find(e=>e.id==='ars').fireIntent.kind='cross';},
    d=>{d.enemies.find(e=>e.id==='ars').fireIntent.extra=1;},
    d=>{delete d.enemies.find(e=>e.id==='ars').fireIntent.center;},
    d=>{d.enemies.find(e=>e.id==='ars').fireIntent.cells=[];},
    d=>{const s=d.enemies.find(e=>e.id==='ars').fireIntent;s.cells.push({...s.cells[0]});},
    d=>{const s=d.enemies.find(e=>e.id==='ars').fireIntent;s.gaps.push({...s.cells[0]});},
    d=>{const s=d.enemies.find(e=>e.id==='ars').fireIntent;d.grid[s.cells[0].y][s.cells[0].x]=0;},
    d=>{d.enemies.find(e=>e.id==='ars').fireIntent.cells[0]={x:1.5,y:2};},
    d=>{d.enemies.find(e=>e.id==='ars').heat=0;},d=>{d.enemies.find(e=>e.id==='ars').heat=1.5;},d=>{d.enemies.find(e=>e.id==='ars').heat='2';},
    d=>{d.enemies.find(e=>e.id==='ars').overheat=0;},d=>{d.enemies.find(e=>e.id==='ars').special='mark';},
    d=>{d.enemies.find(e=>e.id==='burn').special='wall';},d=>{d.enemies.find(e=>e.id==='burn').heat=1;},d=>{d.enemies.find(e=>e.id==='burn').overheat=1;},
    d=>{d.enemies.find(e=>e.id==='burn').fireIntent={kind:'wall',origin:{x:16,y:16},cells:[{x:3,y:3}]};},
    d=>{d.enemies.find(e=>e.id==='ars').burn={stage:'pack',left:1};},
    d=>{d.enemies.find(e=>e.id==='burn').burn.stage='aim';},d=>{d.enemies.find(e=>e.id==='burn').burn.left=0;},d=>{d.enemies.find(e=>e.id==='burn').burn.extra=1;},
    d=>{d.enemies.find(e=>e.id==='burn').burn.aim={x:16,y:16};},d=>{d.enemies.find(e=>e.id==='burn').burn.aim={x:-1,y:3};},
    d=>{d.enemies.find(e=>e.id==='burn').gun={stage:'pack',left:1};},
  ];
  for(const change of bad){const d=JSON.parse(raw);change(d.data);assert.equal(Game.restore(JSON.stringify(d)),null,change.toString());}
  // Only the cards that do it may carry it.
  const r=field(),rifle=foe(r,'rifleman',14,10,'rf');rifle.heat=1;assert.equal(Game.restore(r.serialize()),null);delete rifle.heat;rifle.special='wall';assert.equal(Game.restore(r.serialize()),null);delete rifle.special;
  rifle.burn={stage:'pack',left:1};assert.equal(Game.restore(r.serialize()),null);delete rifle.burn;assert.ok(Game.restore(r.serialize()));
  assert.equal(validRebelBosses(g),true);
});

test('saves: stale warnings are dropped and numbers longer than today\'s tuning are cut to it, never refused',()=>{
  const g=field(),b=boss(g,'arsonist',15,10,'ars'),l=boss(g,'burnline',16,16,'burn');g.enemyAct(b);l.burn={stage:'set',origin:{x:16,y:16},aim:{x:12,y:16}};
  const raw=g.serialize();
  const stale=(change,check)=>{const d=JSON.parse(raw);change(d.data);const s=Game.restore(JSON.stringify(d));assert.ok(s,change.toString());check(s.enemies.find(e=>e.id==='ars'),s.enemies.find(e=>e.id==='burn'));};
  stale(d=>{d.enemies.find(e=>e.id==='ars').x=14;},a=>assert.equal(a.fireIntent,undefined,'moved outside its turn'));
  stale(d=>{d.enemies.find(e=>e.id==='ars').hp=0;},a=>assert.equal(a.fireIntent,undefined,'fallen'));
  stale(d=>{d.enemies.find(e=>e.id==='ars').control={disabled:1,immune:0};},a=>assert.equal(a.fireIntent,undefined,'stunned'));
  stale(d=>{d.enemies.find(e=>e.id==='burn').y=15;},(a,l)=>assert.equal(l.burn,undefined));
  stale(d=>{d.enemies.find(e=>e.id==='burn').control={disabled:1,immune:0};},(a,l)=>assert.equal(l.burn,undefined));
  stale(d=>{const a=d.enemies.find(e=>e.id==='ars');delete a.fireIntent;a.overheat=1;a.flameIntent={origin:{x:15,y:10},aim:{x:10,y:10}};},a=>{assert.equal(a.flameIntent,undefined,'no spray while venting');assert.equal(a.overheat,1);});
  // Tuning: a save from before the user retunes keeps loading.
  stale(d=>{const a=d.enemies.find(e=>e.id==='ars');a.heat=7;},a=>assert.equal(a.heat,A.heat-1));
  stale(d=>{const a=d.enemies.find(e=>e.id==='ars');delete a.fireIntent;a.overheat=9;},a=>assert.equal(a.overheat,A.vent));
  stale(d=>{d.enemies.find(e=>e.id==='burn').burn={stage:'sweep',origin:{x:16,y:16},aim:{x:12,y:16},left:9};},(a,l)=>assert.equal(l.burn.left,B.sweeps-1));
  stale(d=>{d.enemies.find(e=>e.id==='burn').burn={stage:'pack',left:9};},(a,l)=>assert.deepEqual(l.burn,{stage:'pack',left:B.packUp}));
  // A long wall or ring (the user may shorten them) is still read as it was drawn.
  stale(d=>{const s=d.enemies.find(e=>e.id==='ars').fireIntent;for(let y=0;y<9;y++)s.cells.push({x:20,y});},a=>assert.equal(a.fireIntent.cells.length,14));
  const frame={enemies:[{...structuredClone(b),x:3}],floorStates:{}};dropStaleRebelIntents(frame);assert.equal(frame.enemies[0].fireIntent,undefined);
});

test('SAVE 84: a save from 83 loads unchanged (a rebel floor keeps its warden); a kept floor on a round trip keeps a boss\'s fire',()=>{
  const g=field(),w=makeEnemy('warden',16,10,'old-warden',3,0,'rebel');g.enemies.push(w);
  const raw=JSON.parse(g.serialize());raw.version=83;const loaded=Game.restore(JSON.stringify(raw));assert.ok(loaded);assert.equal(loaded.enemies.find(e=>e.id==='old-warden').type,'warden');
  const run=new Game(51,[],0,'soldier','onyx','extraction',{facilityFaction:'rebel'});run.floor=3;run.loadFloor();assert.ok(run.enemies.some(e=>e.type==='arsonist'));
  const old=JSON.parse(run.serialize());old.version=83;for(const e of old.data.enemies)if(e.type==='arsonist')e.type='warden';
  const kept=Game.restore(JSON.stringify(old));assert.ok(kept);assert.ok(kept.enemies.some(e=>e.type==='warden')&&!kept.enemies.some(e=>e.type==='arsonist'),'no conversion');
  // A round trip: floor 1 kept with an arsonist mid-warning and a burnline packing up, checked with its own grid.
  const r=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'rebel'});Object.assign(r.player,r.exitPoint);assert.equal(r.exitBlocked,'');assert.ok(r.descend());
  const frame=r.floorStates[1],free=frame.grid.flatMap((row,y)=>row.map((v,x)=>({x,y,v}))).filter(q=>q.v===1&&!frame.props.some(o=>o.x===q.x&&o.y===q.y)&&!frame.enemies.some(e=>e.x===q.x&&e.y===q.y)&&!(q.x===frame.start.x&&q.y===frame.start.y)&&!(q.x===frame.end.x&&q.y===frame.end.y));
  const [a,c,d,e,f]=free;const ars=makeEnemy('arsonist',a.x,a.y,'kept-ars',1,0,'rebel');ars.alert=true;ars.heat=1;ars.fireIntent={kind:'wall',origin:{x:a.x,y:a.y},cells:[{x:c.x,y:c.y},{x:d.x,y:d.y}]};
  const bl=makeEnemy('burnline',e.x,e.y,'kept-burn',1,0,'rebel');bl.burn={stage:'pack',left:1};bl.special='burn';frame.enemies.push(ars,bl);
  const back=Game.restore(r.serialize());assert.ok(back,'the archived floor is checked with its own grid');
  const kb=back.floorStates[1].enemies.find(x=>x.id==='kept-ars');assert.deepEqual(kb.fireIntent,ars.fireIntent);assert.equal(kb.heat,1);assert.deepEqual(back.floorStates[1].enemies.find(x=>x.id==='kept-burn').burn,{stage:'pack',left:1});
  const bad=JSON.parse(r.serialize());bad.data.floorStates[1].enemies.find(x=>x.id==='kept-ars').fireIntent.kind='x';assert.equal(Game.restore(JSON.stringify(bad)),null,'a bad kept one is refused');
  const stale=JSON.parse(r.serialize());stale.data.floorStates[1].enemies.find(x=>x.id==='kept-ars').hp=0;const s=Game.restore(JSON.stringify(stale));
  assert.ok(s,'a wall left by a fallen arsonist is dropped');assert.equal(s.floorStates[1].enemies.find(x=>x.id==='kept-ars').fireIntent,undefined);
  const clamp=JSON.parse(r.serialize());clamp.data.floorStates[1].enemies.find(x=>x.id==='kept-burn').burn.left=9;const cl=Game.restore(JSON.stringify(clamp));assert.ok(cl);assert.equal(cl.floorStates[1].enemies.find(x=>x.id==='kept-burn').burn.left,B.packUp);
  void f;
});

test('the telegraphs on the card and in the text tool; the burnline\'s mark is the Designator\'s',()=>{
  const g=field(),b=boss(g,'arsonist',15,10);g.enemyAct(b);g.target=b.id;assert.match(targetDetails(g).state,/火牆預告/);
  const h=field(),c=boss(h,'arsonist',15,10);c.special='ring';h.enemyAct(c);h.target=c.id;assert.match(targetDetails(h).state,/圍困預告/);
  const p=field(),d=boss(p,'burnline',15,10);d.burn={stage:'pack',left:2};p.target=d.id;assert.match(targetDetails(p).state,/收起火焰發射器 2 回合/);
  assert.ok(inBurn(g,{burn:{stage:'set',origin:{x:15,y:10},aim:{x:10,y:10}}},{x:11,y:10}));
  const m=field(),e=boss(m,'burnline',15,10);m.enemyAct(e);m.enemyAct(e);assert.ok(m.player.traits.some(t=>t.id===DESIGNATED),'the same mark');
});

// ---- 3.206.0 independent review: each finding's repro (qa/results/2026-09-29-claude-3.206.0-rebel-bosses.md) -------
import {suppressiveReason,suppressiveFire} from '../src/suppressive-fire.js';
test('review 1: a ring or wall never cuts you off from what lies behind the boss (it steps away later); a gap it stands in is still no gap',()=>{
  // The repro: a room, a one-tile corridor east whose mouth the arsonist stands in, the exit beyond.
  const g=field();for(let y=0;y<27;y++)for(let x=0;x<27;x++){const room=x>=4&&x<=12&&y>=6&&y<=14,corridor=y===10&&x>=13&&x<=20,east=x>=21&&x<=25&&y>=5&&y<=15;if(!(room||corridor||east))wall(g,x,y);}
  g.start={x:5,y:7};g.end={x:24,y:14};const b=boss(g,'arsonist',13,10);b.special='ring';
  const open=list=>reachable({grid:g.grid,barriers:[],props:list.map(q=>({type:'cover',hp:1,x:q.x,y:q.y}))},g.player,{keys:true});
  const plan=ringPlan(g,b,g.player);assert.ok(!plan||open(plan.cells).has('24,14'),'no ring that closes the corridor mouth');
  g.enemyAct(b);assert.ok(!b.fireIntent?.cells.some(q=>k(q)==='12,10'),'the mouth is not part of what it warns');
  fixed(g,0);g.enemyAct(b);assert.ok(open(g.fires||[]).has('24,14'),'with the boss gone from the mouth, the exit is still reachable');
  // Its own tile is no way out while it stands there: the ring around you with only its tile open is refused.
  const h=field(),c=boss(h,'arsonist',12,10),rest=ringTiles(h,h.player,2).filter(q=>k(q)!=='12,10');
  assert.equal(sealsOff(h,c,rest),true,'the only opening is the boss');assert.equal(sealsOff(h,c,rest.filter(q=>k(q)!=='10,8')),false,'another opening is enough');
});

test('review 2: suppressive fire with a flamethrower is refused (it would fire rounds past the fire rules and burn a fireproof boss)',()=>{
  const g=field(),b=boss(g,'arsonist',13,10),slot=g.addWeapon(FLAMETHROWER);g.player.weapon=slot;g.player.ammo[slot]=8;
  if(!g.player.skills.includes('suppressive_fire'))g.player.skills.push('suppressive_fire');g.player.prepared.skill='suppressive_fire';g.player.skillState.suppressive_fire={remaining:0,cooldown:0};
  assert.equal(suppressiveReason(g,{x:13,y:10}),'壓制射擊需要槍械。');const hp=b.hp;assert.equal(g.action('suppressiveFire',{x:13,y:10}),false);
  assert.equal(b.hp,hp);assert.equal(g.player.ammo[slot],8,'no fuel spent');
  assert.equal(suppressiveFire(g,{x:13,y:10}),false,'nor when called past the check');assert.equal(b.hp,hp);assert.equal(g.player.ammo[slot],8);
  // Another gun still can (the rule is unchanged for them).
  g.player.weapon=0;assert.equal(suppressiveReason(g,{x:13,y:10}),'');
});

test('review 4: the gaps the first round missed — sight and reach, no wall toward it, no set-up on acid, no shot while packing, not on the way in',()=>{
  // A wall or a ring only on a boss that sees you within 6: at 7 it walks; at 6 it warns; through smoke it cannot.
  const far=field(),a=boss(far,'arsonist',17,10);far.enemyAct(a);assert.equal(a.fireIntent,undefined,'7 tiles: out of reach');
  const six=field(),b=boss(six,'arsonist',16,10);six.enemyAct(b);assert.ok(b.fireIntent,'6 tiles: in reach');
  const sm=field(),c=boss(sm,'arsonist',14,10);sm.smoke=[{expires:sm.turn+3,cells:[{x:12,y:9},{x:12,y:10},{x:12,y:11}]}];sm.reveal();assert.equal(sm.sight(c,sm.player),false);
  sm.enemyAct(c);assert.equal(c.fireIntent,undefined,'smoke before the warning: no wall or ring');assert.equal(c.flameIntent,undefined,'nor a spray');
  const sp=field(),d=boss(sp,'arsonist',14,10);d.heat=1;sp.smoke=[{expires:sp.turn+3,cells:[{x:12,y:9},{x:12,y:10},{x:12,y:11}]}];sp.reveal();sp.enemyAct(d);assert.equal(d.flameIntent,undefined,'a spray needs sight too');
  // Never toward it: behind and both sides cannot take a line (a terminal on each middle tile: walkable, but nothing is
  // set alight under an object), the line toward it would fit and shut nothing off, and it is not drawn.
  const tw=field(),e=boss(tw,'arsonist',15,10);for(const [x,y] of [[9,10],[10,9],[10,11]])tw.props.push({id:`t-${x}-${y}`,type:'terminal',x,y,used:false});tw.reveal();
  assert.equal(wallPlan(tw,e,tw.player),null,'no wall between you and it');
  // 焚線官 on acid steps off before it sets up.
  const ac=field(),f=boss(ac,'burnline',15,10);f.special='burn';ac.hazards=[{x:15,y:10,type:'acid'}];ac.enemyAct(f);assert.equal(f.burn,undefined,'no set-up on acid');assert.notDeepEqual([f.x,f.y],[15,10],'it stepped off');
  // Packing up, a decoy is not shot at.
  const dc=field(),l=boss(dc,'burnline',16,10);l.burn={stage:'pack',left:2};dc.decoy={x:16,y:13,hp:30,maxHp:30,expires:dc.turn+3,fooled:[l.id]};fixed(dc,0);dc.enemyAct(l);assert.equal(dc.decoy.hp,30,'no shot at the decoy while packing up');
  // Never on the way in: the start tile is left out of a wall and a ring.
  const st=field(),s=boss(st,'arsonist',15,10);st.start={x:9,y:10};const w=wallPlan(st,s,st.player);assert.ok(w&&!w.some(q=>k(q)==='9,10'),'not on the start');
  st.start={x:10,y:8};const r=ringPlan(st,s,st.player);assert.ok(r&&![...r.cells,...r.gaps].some(q=>k(q)==='10,8'),'nor in a ring');
});
