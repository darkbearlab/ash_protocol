import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {SURVIVAL_TUNING as T,isSurvival,turnsLeft,pointBlocks,pointStatus,pointTargeted} from '../src/survival.js';
import {MISSIONS,RANDOM_MISSION_IDS,OFFERED_MISSION_IDS,exitBlocked} from '../src/missions.js';
import {roomContains} from '../src/map-geometry.js';
import {isNoncombatant} from '../src/enemy-data.js';
import {resultCopy} from '../src/result-copy.js';
import {terminalRun} from '../src/real-mode.js';
import {lightAt,LIGHT} from '../src/lighting.js';
import {t} from '../src/i18n.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {commsLine} from '../src/comms.js';

// 3.189.0 (user design; docs/SURVIVAL.md): the survival mission. 3.191.0 (user, after playing): the map is known from the
// start, a point is held only by an enemy standing on it, enemies walk around the other points, waves are announced ahead.
const survival=(seed=11,faction='loyalist')=>{const g=new Game(seed,[],0,'soldier','onyx','survival',{facilityFaction:faction});g.enemies=g.enemies.filter(e=>!isNoncombatant(e));Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});return g;};
const foe=(g,x,y,id=`qa-${g.enemies.length}`)=>{const e=makeEnemy('rifleman',x,y,id,1,g.difficultySpec,g.facilityFaction);e.alert=true;g.enemies.push(e);return e;};
const around=(g,pt)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:pt.x+dx,y:pt.y+dy})).filter(q=>g.passable(q.x,q.y)&&!g.enemies.some(e=>e.x===q.x&&e.y===q.y)&&!(q.x===g.player.x&&q.y===g.player.y));
function walk(g,from){const out=new Map([[`${from.x},${from.y}`,0]]),q=[from];for(let i=0;i<q.length;i++){const c=q[i],d=out.get(`${c.x},${c.y}`);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy},k=`${n.x},${n.y}`;if(out.has(k)||!g.passable(n.x,n.y)||!g.canRoute(c,n))continue;out.set(k,d+1);q.push(n);}}return out;}
const far=(g,from,d)=>[...walk(g,from).entries()].find(([,n])=>n===d)[0].split(',').map(Number);

test('a survival floor: a lit point in every room, the whole map known, no starting fighters, the exit shut',()=>{
 const g=new Game(11,[],0,'soldier','onyx','survival',{facilityFaction:'swarm'});
 assert.ok(isSurvival(g));assert.equal(MISSIONS.survival.depth,1);assert.ok(OFFERED_MISSION_IDS.includes('survival'));assert.ok(!RANDOM_MISSION_IDS.includes('survival'));
 assert.ok(g.enemies.every(isNoncombatant));assert.equal(g.swarmWaves,undefined);assert.ok(!g.props.some(o=>o.type==='nest'));
 const s=g.survival;assert.deepEqual([s.integrity,s.wave,s.nextWave,s.open,s.turns,s.incoming],[T.integrity,0,T.firstWave,false,T.turns,[]]);
 assert.equal(s.points.length,g.rooms.filter(r=>s.points.some(pt=>roomContains(r,pt))).length);
 for(const pt of s.points){assert.equal(pt.hp,T.pointHp);assert.equal(g.grid[pt.y][pt.x],1);assert.equal(lightAt(g,pt),LIGHT.lit,'its own light');}
 assert.match(exitBlocked(g),new RegExp(String(turnsLeft(g))));
 assert.ok(g.grid.every((row,y)=>row.every((_,x)=>g.mapped(x,y))),'the layout is known everywhere');
 assert.ok(g.grid.some((row,y)=>row.some((v,x)=>v===1&&!g.seen[y][x])),'what lies loose is still only seen up close');
 const plain=new Game(11);assert.ok(plain.grid.some((row,y)=>row.some((v,x)=>v===1&&!plain.mapped(x,y))),'other missions are unchanged');
});

test('only an enemy standing on a point holds it: one a round, beside it does not count, you on it keep it; a fall costs 20 more',()=>{
 const g=survival(),[a,b,c]=g.survival.points;g.survival.nextWave=1e6;
 foe(g,a.x,a.y);for(const q of around(g,a))foe(g,q.x,q.y);   // one on A, the rest round it
 for(const q of around(g,c).slice(0,2))foe(g,q.x,q.y);          // round C only
 Object.assign(g.player,{x:b.x,y:b.y});for(const q of around(g,b).slice(0,2))foe(g,q.x,q.y);   // you on B
 assert.ok(g.action('wait'));
 assert.deepEqual([a.hp,b.hp,c.hp,g.survival.integrity],[T.pointHp-1,T.pointHp,T.pointHp,T.integrity-1]);
 assert.deepEqual([a.pressed,b.pressed,c.pressed],[true,false,false]);assert.equal(pointStatus(g,a),'pressed');
 assert.ok(g.logs.some(l=>l.text===t('survival.pointPressed',{point:t('survival.pointName',{letter:'A'})})));
 a.hp=1;const before=g.survival.integrity;assert.ok(g.action('wait'));
 assert.equal(a.hp,0);assert.equal(g.survival.integrity,before-1-T.pointLoss);assert.equal(pointStatus(g,a),'fallen');
 const after=g.survival.integrity;assert.ok(g.action('wait'));assert.equal(g.survival.integrity,after,'a fallen point costs nothing more');
});

test('integrity at 0 fails the mission: its own result, no death; so does losing every point',()=>{
 const g=survival(),pt=g.survival.points[0];g.survival.nextWave=1e6;g.survival.integrity=1;foe(g,pt.x,pt.y);
 assert.ok(g.action('wait'));assert.equal(g.status,'failed');assert.ok(g.player.hp>0);
 assert.equal(resultCopy(g).eyebrow,'FACILITY LOST');assert.ok(terminalRun(g));assert.equal(g.action('wait'),false);
 const h=survival(),last=h.survival.points.at(-1);h.survival.nextWave=1e6;for(const p of h.survival.points)p.hp=p===last?1:0;foe(h,last.x,last.y);
 assert.ok(h.action('wait'));assert.equal(h.status,'failed','every point fallen ends it, integrity or not');
});

test('a wave is announced lead turns ahead with its targets and entries, arrives on schedule whoever is left, never too close',()=>{
 const g=survival(21),s=g.survival;
 while(g.turn<T.firstWave-T.lead)g.action('wait');
 assert.equal(s.wave,1);assert.ok(s.incoming.length>=2);assert.ok(s.incoming.every(i=>i.due===T.firstWave));
 assert.ok(s.incoming.some(i=>i.role==='point')&&s.incoming.some(i=>i.role==='hunter'));
 assert.ok(!g.enemies.some(e=>e.survival),'nobody yet');
 const target=s.points.find(p=>p.id===s.incoming.find(i=>i.role==='point').target);assert.ok(pointTargeted(g,target),'framed while a group is after it');assert.equal(pointStatus(g,target),'quiet');assert.ok(s.points.filter(p=>!s.incoming.some(i=>i.target===p.id)).every(p=>!pointTargeted(g,p)));
 assert.ok(g.logs.some(l=>l.text.startsWith(t('survival.warning',{wave:1,n:T.lead,groups:''}).slice(0,-1))&&l.text.includes(t('survival.pointName',{letter:String.fromCharCode(65+Number(target.id.slice(6)))}))));
 for(const i of s.incoming){const to=i.role==='point'?s.points.find(p=>p.id===i.target):g.player,d=walk(g,to).get(`${i.x},${i.y}`);assert.ok(d>=T.spawnDistance&&d<=T.spawnDistance+T.spawnBand);if(i.role==='point')assert.ok(!roomContains(g.rooms.find(r=>roomContains(r,to)),i));}
 const entries=s.incoming.map(i=>({...i}));
 while(g.turn<T.firstWave)g.action('wait');
 const arrived=g.enemies.filter(e=>e.survival);assert.ok(arrived.length>=4);assert.deepEqual(s.incoming,[]);
 assert.ok(g.logs.some(l=>l.text.startsWith(t('survival.wave',{wave:1,groups:''}).slice(0,-1))));
 for(const e of arrived){
  const entry=entries.find(i=>i.role===e.survival.role&&(i.target??null)===(e.survival.target??null));assert.ok(entry);assert.ok(walk(g,entry).get(`${e.x},${e.y}`)<=3,'comes in at its entry');
  const fromYou=walk(g,g.player).get(`${e.x},${e.y}`)??99;assert.ok(fromYou>=(e.survival.role==='hunter'?T.spawnDistance:T.pointClearance));
  assert.ok(s.points.filter(p=>p.hp>0).every(p=>Math.abs(p.x-e.x)+Math.abs(p.y-e.y)>2),'never holding a point on arrival');
  if(e.survival.role==='point'){const pt=s.points.find(p=>p.id===e.survival.target);assert.ok(walk(g,pt).get(`${e.x},${e.y}`)>=T.spawnDistance);assert.ok(!roomContains(g.rooms.find(r=>roomContains(r,pt)),e));}
 }
 while(g.turn<T.firstWave+T.waveInterval-T.lead)g.action('wait');assert.equal(s.wave,2,'the next one is announced on time');
 while(g.enemies.filter(e=>e.hp>0&&!isNoncombatant(e)).length<T.liveLimit){const p=[...walk(g,g.player).keys()].map(k=>k.split(',').map(Number)).find(([x,y])=>!g.enemies.some(e=>e.x===x&&e.y===y)&&!(x===g.player.x&&y===g.player.y)&&!s.points.some(pt=>pt.x===x&&pt.y===y));foe(g,p[0],p[1]);}
 const full=g.enemies.length;while(g.turn<T.firstWave+T.waveInterval)g.action('wait');assert.equal(g.enemies.length,full,'the cap holds');
});

test('point groups of one wave go for different points; a group whose point fell meanwhile picks another',()=>{
 const g=survival(21),s=g.survival;s.wave=5;s.nextWave=g.turn+T.lead;g.action('wait');
 const targets=s.incoming.filter(i=>i.role==='point').map(i=>i.target);assert.equal(targets.length,2);assert.notEqual(targets[0],targets[1]);
 const doomed=s.points.find(p=>p.id===targets[0]);doomed.hp=0;s.nextWave=1e6;
 while(s.incoming.length)g.action('wait');
 const sent=g.enemies.filter(e=>e.survival?.role==='point').map(e=>e.survival.target);assert.ok(sent.length);assert.ok(!sent.includes(doomed.id));
});

test('enemies walk around every point but the one they are sent to hold, until the exit opens',()=>{
 const g=survival(),[a,b]=g.survival.points,hunter={id:'h',survival:{role:'hunter'}},holder={id:'p',survival:{role:'point',target:a.id}};
 assert.ok(pointBlocks(g,hunter,a.x,a.y)&&pointBlocks(g,hunter,b.x,b.y));
 assert.ok(!pointBlocks(g,holder,a.x,a.y)&&pointBlocks(g,holder,b.x,b.y));
 assert.ok(!pointBlocks(g,g.player,a.x,a.y),'you walk anywhere');assert.ok(g.passable(a.x,a.y)&&!g.passable(a.x,a.y,hunter));
 b.hp=0;assert.ok(!pointBlocks(g,hunter,b.x,b.y),'a fallen point is floor again');
 g.survival.open=true;assert.ok(!pointBlocks(g,hunter,a.x,a.y));
});

test('a point group stands on its point, the next one guards beside it; you on the point keep it; a far hunter still comes',()=>{
 const g=new Game(21,[],0,'soldier','onyx','survival',{facilityFaction:'loyalist'}),s=g.survival;s.nextWave=1e6;g.enemies=[];g.player.maxHp=g.player.hp=5000;
 const pt=[...s.points].sort((a,b)=>Math.abs(b.x-g.player.x)+Math.abs(b.y-g.player.y)-Math.abs(a.x-g.player.x)-Math.abs(a.y-g.player.y))[0],start=far(g,pt,6);
 const e=foe(g,start[0],start[1],'walker');e.survival={role:'point',target:pt.id};
 for(let i=0;i<12&&(e.x!==pt.x||e.y!==pt.y);i++)g.action('wait');
 assert.deepEqual({x:e.x,y:e.y},{x:pt.x,y:pt.y},'stands on it');
 const next=far(g,pt,5),guard=foe(g,next[0],next[1],'guard');guard.survival={role:'point',target:pt.id};
 for(let i=0;i<10;i++)g.action('wait');
 assert.deepEqual({x:e.x,y:e.y},{x:pt.x,y:pt.y},'and stays');assert.equal(Math.abs(guard.x-pt.x)+Math.abs(guard.y-pt.y),1,'the other guards beside it');
 const h=new Game(21,[],0,'soldier','onyx','survival',{facilityFaction:'loyalist'});h.survival.nextWave=1e6;h.enemies=[];h.player.maxHp=h.player.hp=5000;
 const mine=[...h.survival.points].sort((a,b)=>Math.abs(b.x-h.player.x)+Math.abs(b.y-h.player.y)-Math.abs(a.x-h.player.x)-Math.abs(a.y-h.player.y))[0];Object.assign(h.player,{x:mine.x,y:mine.y});h.reveal();
 const from=far(h,mine,6),w=foe(h,from[0],from[1],'walker');w.survival={role:'point',target:mine.id};
 for(let i=0;i<12;i++){h.action('wait');assert.ok(w.hp<=0||w.x!==mine.x||w.y!==mine.y);}
 assert.equal(mine.hp,T.pointHp,'held by you, it loses nothing');
 const k=new Game(21,[],0,'soldier','onyx','survival',{facilityFaction:'loyalist'});k.survival.nextWave=1e6;k.enemies=[];
 const spot=[...walk(k,k.player).keys()].map(q=>q.split(',').map(Number)).sort((a,b)=>Math.abs(b[0]-k.player.x)+Math.abs(b[1]-k.player.y)-Math.abs(a[0]-k.player.x)-Math.abs(a[1]-k.player.y))[0],hunter=foe(k,spot[0],spot[1],'hunter');hunter.survival={role:'hunter'};
 const d0=Math.abs(hunter.x-k.player.x)+Math.abs(hunter.y-k.player.y);assert.ok(d0>16);k.action('wait');k.action('wait');
 assert.ok(Math.abs(hunter.x-k.player.x)+Math.abs(hunter.y-k.player.y)<d0,'closing in');
});

test('the controller names the targets of a wave, a point being held and a point lost',()=>{
 const g=survival(21),s=g.survival,memory=newCommsMemory(g.runId);
 while(g.turn<T.firstWave-T.lead)g.action('wait');
 const wave=commsEvents({game:g,logs:g.logs.slice(0,3),memory}).find(e=>e.type==='survivalWave');assert.ok(wave);
 const aimed=s.points.find(p=>p.id===s.incoming.find(i=>i.role==='point').target);assert.ok(wave.vars.points.includes(t('survival.pointName',{letter:String.fromCharCode(65+Number(aimed.id.slice(6)))})));assert.equal(wave.vars.n,T.lead);
 s.incoming=[];s.nextWave=1e6;const pt=s.points[1];foe(g,pt.x,pt.y);g.action('wait');
 const held=commsEvents({game:g,logs:g.logs.slice(0,2),memory}).find(e=>e.type==='survivalPressed');assert.equal(held.vars.point,t('survival.pointName',{letter:'B'}));
 pt.hp=1;g.action('wait');const lost=commsEvents({game:g,logs:g.logs.slice(0,3),memory}).find(e=>e.type==='survivalLost');assert.equal(lost.vars.point,t('survival.pointName',{letter:'B'}));
 for(const speaker of ['egret','wren'])for(const event of ['survivalWave','survivalPressed','survivalLost'])assert.ok(commsLine(speaker,event,{})?.line,`${speaker} ${event}`);
});

test('when the turns are up the exit opens and the points lock; leaving wins',()=>{
 const g=survival(),s=g.survival,pt=s.points[0];s.nextWave=1e6;s.turns=g.turn+1;foe(g,pt.x,pt.y);
 assert.ok(g.action('wait'));assert.equal(s.open,true);assert.equal(exitBlocked(g),'');const locked=[pt.hp,s.integrity];
 assert.ok(g.action('wait'));assert.deepEqual([pt.hp,s.integrity],locked);
 g.enemies=[];Object.assign(g.player,g.end);assert.ok(g.action('interact'));assert.equal(g.status,'won');
});

test('saves keep a survival run and its announced waves; bad state is refused; a 3.189 run loads with none waiting',()=>{
 const g=survival(21);while(g.turn<T.firstWave-T.lead)g.action('wait');const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.survival,g.survival);assert.ok(copy.survival.incoming.length);
 for(const bad of [d=>d.survival.integrity=T.integrity+1,d=>d.survival.points[0].id='point-9',d=>d.survival.points[0].hp=T.pointHp+1,d=>d.survival.turns=0,d=>d.survival.incoming[0].target='point-99',d=>d.survival.incoming[0].role='boss',d=>d.survival.incoming[0].extra=1,d=>d.survival.incoming=null]){const raw=JSON.parse(g.serialize());bad(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
 while(g.turn<T.firstWave+1)g.action('wait');
 for(const bad of [d=>d.enemies.find(e=>e.survival?.role==='point').survival.target='point-99',d=>d.enemies.find(e=>e.survival).survival.role='boss']){const raw=JSON.parse(g.serialize());bad(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);}
 const other=JSON.parse(new Game(4).serialize());other.data.survival=structuredClone(g.survival);assert.equal(Game.restore(JSON.stringify(other)),null);
 const old=JSON.parse(g.serialize());old.version=78;delete old.data.survival.incoming;const back=Game.restore(JSON.stringify(old));assert.ok(back);assert.deepEqual(back.survival.incoming,[]);
});
