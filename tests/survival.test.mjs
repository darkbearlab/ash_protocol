import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {SURVIVAL_TUNING as T,isSurvival,turnsLeft} from '../src/survival.js';
import {MISSIONS,RANDOM_MISSION_IDS,OFFERED_MISSION_IDS,exitBlocked} from '../src/missions.js';
import {roomContains} from '../src/map-geometry.js';
import {isNoncombatant} from '../src/enemy-data.js';
import {resultCopy} from '../src/result-copy.js';
import {terminalRun} from '../src/real-mode.js';
import {lightAt,LIGHT} from '../src/lighting.js';

// 3.189.0 (user design; docs/SURVIVAL.md): the survival mission.
const survival=(seed=11,faction='loyalist')=>{const g=new Game(seed,[],0,'soldier','onyx','survival',{facilityFaction:faction});g.enemies=g.enemies.filter(e=>!isNoncombatant(e));Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});return g;};
const foe=(g,x,y,id=`qa-${g.enemies.length}`)=>{const e=makeEnemy('rifleman',x,y,id,1,g.difficultySpec,g.facilityFaction);e.alert=true;g.enemies.push(e);return e;};
const next=(g,pt)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:pt.x+dx,y:pt.y+dy})).find(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.x===q.x&&e.y===q.y)&&!(q.x===g.player.x&&q.y===g.player.y));
function walk(g,from){const out=new Map([[`${from.x},${from.y}`,0]]),q=[from];for(let i=0;i<q.length;i++){const c=q[i],d=out.get(`${c.x},${c.y}`);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy},k=`${n.x},${n.y}`;if(out.has(k)||!g.passable(n.x,n.y)||!g.canRoute(c,n))continue;out.set(k,d+1);q.push(n);}}return out;}

test('a survival floor: a lit point in every room, no starting fighters, the exit shut until the turns are up',()=>{
  const g=new Game(11,[],0,'soldier','onyx','survival',{facilityFaction:'swarm'});
  assert.ok(isSurvival(g));assert.equal(MISSIONS.survival.depth,1);assert.ok(OFFERED_MISSION_IDS.includes('survival'));assert.ok(!RANDOM_MISSION_IDS.includes('survival'));
  assert.ok(g.enemies.every(isNoncombatant));assert.equal(g.swarmWaves,undefined);assert.ok(!g.props.some(o=>o.type==='nest'));
  const s=g.survival;assert.deepEqual([s.integrity,s.wave,s.nextWave,s.open,s.turns],[T.integrity,0,T.firstWave,false,T.turns]);
  assert.equal(s.points.length,g.rooms.filter(r=>s.points.some(pt=>roomContains(r,pt))).length);
  for(const pt of s.points){assert.equal(pt.hp,T.pointHp);assert.equal(g.grid[pt.y][pt.x],1);assert.equal(lightAt(g,pt),LIGHT.lit,'its own light');}
  assert.match(exitBlocked(g),new RegExp(String(turnsLeft(g))));
});

test('a point held at the end of a round costs it and the facility one each, once however many hold it; a fall costs 20 more',()=>{
  const g=survival(),[a,b,c]=g.survival.points;g.survival.nextWave=1e6;
  const onA=next(g,a);foe(g,onA.x,onA.y);const onA2=next(g,a);foe(g,onA2.x,onA2.y);foe(g,b.x,b.y);
  const far=[[2,0],[0,2],[-2,0],[0,-2]].map(([dx,dy])=>({x:c.x+dx,y:c.y+dy})).find(q=>g.passable(q.x,q.y));if(far)foe(g,far.x,far.y);
  assert.ok(g.action('wait'));
  assert.deepEqual([a.hp,b.hp,c.hp,g.survival.integrity],[T.pointHp-1,T.pointHp-1,T.pointHp,T.integrity-2]);assert.equal(a.pressed,true);assert.equal(c.pressed,false);
  a.hp=1;const before=g.survival.integrity;assert.ok(g.action('wait'));
  assert.equal(a.hp,0);assert.equal(g.survival.integrity,before-2-T.pointLoss);assert.ok(g.logs.some(l=>/失守/.test(l.text)));
  const after=g.survival.integrity;assert.ok(g.action('wait'));assert.equal(g.survival.integrity,after-1,'only B still counts');
});

test('integrity at 0 fails the mission: its own result, no death',()=>{
  const g=survival(),pt=g.survival.points[0];g.survival.nextWave=1e6;g.survival.integrity=1;const q=next(g,pt);foe(g,q.x,q.y);
  assert.ok(g.action('wait'));assert.equal(g.status,'failed');assert.ok(g.player.hp>0);
  assert.equal(resultCopy(g).eyebrow,'FACILITY LOST');assert.ok(terminalRun(g));assert.equal(g.action('wait'),false);
  const h=survival(),last=h.survival.points.at(-1);h.survival.nextWave=1e6;for(const pt of h.survival.points)pt.hp=pt===last?1:0;const r=next(h,last);foe(h,r.x,r.y);
  assert.ok(h.action('wait'));assert.equal(h.status,'failed','every point fallen ends it, integrity or not');
});

test('waves come on schedule whoever is left; groups start far from their target, not in its room; at most 40 alive',()=>{
  const g=survival(21);const s=g.survival;
  while(g.turn<T.firstWave)g.action('wait');
  assert.equal(s.wave,1);const first=g.enemies.filter(e=>e.survival);assert.ok(first.some(e=>e.survival.role==='point')&&first.some(e=>e.survival.role==='hunter'));
  for(const e of first){
    if(e.survival.role==='point'){const pt=s.points.find(p=>p.id===e.survival.target),home=g.rooms.find(r=>roomContains(r,pt));assert.ok(walk(g,pt).get(`${e.x},${e.y}`)>=T.spawnDistance);assert.ok(!roomContains(home,e));}
    assert.ok((walk(g,g.player).get(`${e.x},${e.y}`)??99)>=T.spawnDistance,'never at your side');
    assert.ok(s.points.filter(p=>p.hp>0).every(p=>Math.abs(p.x-e.x)+Math.abs(p.y-e.y)>2),'never holding a point on arrival');
  }
  const alive=g.enemies.length;while(g.turn<T.firstWave+T.waveInterval)g.action('wait');assert.equal(s.wave,2,'no waiting for the last to die');assert.ok(g.enemies.length>alive);
  while(g.enemies.length<T.liveLimit){const p=[...walk(g,g.player).keys()].map(k=>k.split(',').map(Number)).find(([x,y])=>!g.enemies.some(e=>e.x===x&&e.y===y)&&!(x===g.player.x&&y===g.player.y));foe(g,p[0],p[1]);}
  s.nextWave=g.turn+1;const full=g.enemies.length;g.action('wait');assert.equal(g.enemies.length,full,'the cap holds');
});

test('a point group walks to its point and holds it; a hunter far off still comes',()=>{
  const g=new Game(21,[],0,'soldier','onyx','survival',{facilityFaction:'loyalist'}),s=g.survival;s.nextWave=1e6;g.enemies=[];
  const pt=[...s.points].sort((a,b)=>Math.abs(b.x-g.player.x)+Math.abs(b.y-g.player.y)-Math.abs(a.x-g.player.x)-Math.abs(a.y-g.player.y))[0],start=[...walk(g,pt).entries()].find(([,d])=>d===6)[0].split(',').map(Number);
  const e=foe(g,start[0],start[1],'walker');e.survival={role:'point',target:pt.id};
  for(let i=0;i<10&&Math.abs(e.x-pt.x)+Math.abs(e.y-pt.y)>1;i++)g.action('wait');
  assert.ok(Math.abs(e.x-pt.x)+Math.abs(e.y-pt.y)<=1,'arrived');const held={x:e.x,y:e.y};
  for(let i=0;i<3;i++)g.action('wait');assert.deepEqual({x:e.x,y:e.y},held,'and stays');
  const h=new Game(21,[],0,'soldier','onyx','survival',{facilityFaction:'loyalist'});h.survival.nextWave=1e6;h.enemies=[];
  const spot=[...walk(h,h.player).keys()].map(k=>k.split(',').map(Number)).sort((a,b)=>Math.abs(b[0]-h.player.x)+Math.abs(b[1]-h.player.y)-Math.abs(a[0]-h.player.x)-Math.abs(a[1]-h.player.y))[0],hunter=foe(h,spot[0],spot[1],'hunter');hunter.survival={role:'hunter'};
  const d0=Math.abs(hunter.x-h.player.x)+Math.abs(hunter.y-h.player.y);assert.ok(d0>16);h.action('wait');h.action('wait');
  assert.ok(Math.abs(hunter.x-h.player.x)+Math.abs(hunter.y-h.player.y)<d0,'closing in');
});

test('when the turns are up the exit opens and the points lock; leaving wins',()=>{
  const g=survival(),s=g.survival,pt=s.points[0];s.nextWave=1e6;s.turns=g.turn+1;const q=next(g,pt);foe(g,q.x,q.y);
  assert.ok(g.action('wait'));assert.equal(s.open,true);assert.equal(exitBlocked(g),'');const locked=[pt.hp,s.integrity];
  assert.ok(g.action('wait'));assert.deepEqual([pt.hp,s.integrity],locked);
  g.enemies=[];Object.assign(g.player,g.end);assert.ok(g.action('interact'));assert.equal(g.status,'won');
});

test('saves keep a survival run; bad state is refused, and so is survival state on another mission',()=>{
  const g=survival(21);while(g.turn<T.firstWave+1)g.action('wait');const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.survival,g.survival);
  for(const bad of [d=>d.survival.integrity=T.integrity+1,d=>d.survival.points[0].id='point-9',d=>d.survival.points[0].hp=T.pointHp+1,d=>d.survival.turns=0,d=>d.enemies.find(e=>e.survival?.role==='point').survival.target='point-99',d=>d.enemies.find(e=>e.survival).survival.role='boss']){const raw=JSON.parse(g.serialize());bad(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
  const other=JSON.parse(new Game(4).serialize());other.data.survival=structuredClone(g.survival);assert.equal(Game.restore(JSON.stringify(other)),null);
});
