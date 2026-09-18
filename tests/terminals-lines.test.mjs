import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {activeTrait} from '../src/traits.js';
import {TERMINAL_KINDS,KIND_ROOMS,terminalSells,offerKind,offerReason,floorTerminalKinds} from '../src/terminal.js';
import {LINE_TUNING,lineReason,lineDrop,goggleDrop} from '../src/lines.js';
import {UNKNOWN_LOOT} from '../src/learning-data.js';

// 3.135.0 (user decisions 2026-09-18, docs/ITEMS.md 道具與終端第二次改版).
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=999;g.reveal();return g;
}

test('each floor has two of the three terminal kinds, each in the supply room of its theme',()=>{
  const seen=new Set();
  for(let seed=1;seed<=30;seed++)for(const floor of [1,2,3]){
    const g=new Game(seed,[],0,'soldier','onyx','extraction'),terms=g.props.filter(p=>p.type==='terminal');
    assert.equal(terms.length,2);assert.deepEqual(terms.map(t=>t.kind).sort(),[...floorTerminalKinds(seed,g.floor)].sort());
    for(const t of terms){seen.add(t.kind);const room=g.rooms.find(r=>t.x>=r.x&&t.x<r.x+r.w&&t.y>=r.y&&t.y<r.y+r.h);assert.equal(room?.supply,KIND_ROOMS[t.kind]);}
    if(floor===1)break;
  }
  assert.equal(seen.size,3,'every kind turns up');
});

test('a terminal sells only its kind; one from an older save sells everything; goggles are sold nowhere',()=>{
  assert.equal(offerKind('upgrade:0'),'arms');assert.equal(offerKind('rifle'),'arms');assert.equal(offerKind('ammo'),'arms');
  assert.equal(offerKind('heal'),'medical');assert.equal(offerKind('med'),'medical');assert.equal(offerKind('spray'),'medical');
  assert.equal(offerKind('smoke'),'gear');assert.equal(offerKind('flare'),'gear');assert.equal(offerKind('adrenaline'),'gear');
  const g=open();g.player.scrap=999;
  for(const kind of Object.keys(TERMINAL_KINDS)){
    g.props=[{id:'t',type:'terminal',x:g.player.x,y:g.player.y,used:false,kind}];
    assert.equal(!offerReason(g,'med'),kind==='medical',kind);assert.equal(!offerReason(g,'smoke'),kind==='gear',kind);
    assert.match(offerReason(g,'nvg'),/沒有這項補給/);
  }
  g.props=[{id:'t',type:'terminal',x:g.player.x,y:g.player.y,used:false}];
  assert.ok(!offerReason(g,'med')&&!offerReason(g,'smoke')&&terminalSells(g.props[0],'upgrade:0'),'no kind: everything, as before');
});

test('goggles: a sniper may drop a pair; one pair is all you carry; unidentified crates can hold them',()=>{
  assert.ok(UNKNOWN_LOOT.some(x=>x.type==='nvg'));
  const g=open();let id=0;while(!goggleDrop(g.seed,g.floor,`s${id}`))id++;
  const s=makeEnemy('sniper',10,12,`s${id}`,1,0,'loyalist');g.enemies.push(s);g.hurt(s,s.hp,g.player);
  const pair=g.items.find(i=>i.type==='nvg');assert.ok(pair,'dropped');
  Object.assign(g.player,{x:pair.x,y:pair.y});g.pickup();assert.deepEqual(g.player.wearables,['nvg']);
  g.items.push({x:g.player.x,y:g.player.y,type:'nvg'});g.pickup();assert.equal(g.items.filter(i=>i.type==='nvg').length,1,'a second pair stays on the floor');
});

test('lines: six tiles in one straight sweep; the escape line is free, the redeploy line costs a turn; one use each',()=>{
  const g=open();g.player.escapeLines=1;g.player.redeployLines=1;
  assert.match(lineReason(g,{x:10,y:9,item:'escape_line'}),/格以內/,'seven tiles is too far');
  g.grid=g.grid.map(r=>[...r]);g.grid[13][10]=0;g.reveal();
  assert.match(lineReason(g,{x:10,y:11,item:'escape_line'})||'',/擋住|視線/,'a wall in the way');
  const brood=makeEnemy('brood',11,15,'y',1,0,'swarm');g.enemies.push(brood);
  assert.equal(lineReason(g,{x:12,y:14,item:'escape_line'}),'','brood never stop a straight line');
  const turn=g.turn;assert.ok(g.action('rope',{x:12,y:14,item:'escape_line'}));
  assert.deepEqual([g.player.x,g.player.y],[12,14]);assert.equal(g.turn,turn,'no turn spent');assert.equal(g.player.escapeLines,0);
  assert.equal(g.action('rope',{x:12,y:12,item:'escape_line'}),false,'used up');
  assert.ok(g.action('rope',{x:12,y:10,item:'redeploy_line'}));assert.equal(g.turn,turn+1,'a turn spent');assert.equal(g.player.redeployLines,0);
});

test('an armed enemy may drop a line: one escape line or three redeploy lines, on a roll of its own',()=>{
  let esc=null,red=null;
  for(let i=0;i<5000&&(!esc||!red);i++){const d=lineDrop(7,1,`e${i}`);if(d?.type==='escape_line')esc=`e${i}`;if(d?.type==='redeploy_line')red=`e${i}`;}
  assert.ok(esc&&red);assert.deepEqual(lineDrop(7,1,esc),{type:'escape_line',amount:1});assert.deepEqual(lineDrop(7,1,red),{type:'redeploy_line',amount:3});
  const g=open();g.seed=7;const e=makeEnemy('rifleman',10,12,red,1,0,'loyalist');g.enemies.push(e);g.hurt(e,e.hp,g.player);
  const drop=g.items.find(i=>i.type==='redeploy_line');assert.ok(drop);Object.assign(g.player,{x:drop.x,y:drop.y});g.pickup();assert.equal(g.player.redeployLines,3);
  const crawler=makeEnemy('crawler',10,12,esc,1,0,'loyalist');assert.equal(g.hurt(crawler,crawler.hp,g.player),undefined);
  assert.ok(!g.items.some(i=>i.type==='escape_line'),'a hound is not armed');
});

test('heavy armour learned makes you slow, like the bulwark',()=>{
  const g=open();g.player.learningItems={trait_heavy_armor:1};assert.ok(g.action('learn','trait_heavy_armor'));
  assert.ok(activeTrait(g.player,'heavy_armor')&&activeTrait(g.player,'slow'));
});

test('lines survive a save; older saves carry none; bad counts are refused',()=>{
  const g=new Game(7);g.player.escapeLines=1;g.player.redeployLines=3;
  const back=Game.restore(g.serialize());assert.equal(back.player.escapeLines,1);assert.equal(back.player.redeployLines,3);
  const old=JSON.parse(g.serialize());old.version=61;delete old.data.player.escapeLines;delete old.data.player.redeployLines;
  const older=Game.restore(JSON.stringify(old));assert.ok(older);assert.equal(older.player.escapeLines,0);
  const bad=JSON.parse(g.serialize());bad.data.player.redeployLines=-1;assert.equal(Game.restore(JSON.stringify(bad)),null);
});
