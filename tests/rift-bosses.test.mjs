import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {generate} from '../src/world.js';
import {anchorWard} from '../src/rift-bosses.js';
import {beamTelegraphs,BEAM_TUNING} from '../src/rift-beam.js';
import {anchorProps,drawWeights,bindAnchors,drainAura,tickDrain,RIFT_TUNING} from '../src/rift.js';
import {topCarriers} from '../src/enemy-specials.js';
import {tickNests} from '../src/runtime-enemies.js';
import {distance,key} from '../src/world.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

// 3.232.0 (docs/FACTIONS.md 5.10; user 2026-11-17): the rift bosses — the drifting anchor (floor 3) and the rift core
// (floor 6), both anchors drawing from their own lists, both warded by standing anchors.
function open(){
  const g=new Game(4242,[],0,'soldier','onyx','extraction',{facilityFaction:'rift'});
  g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.smoke=[];g.flares=[];g.enemies=[];g.openings=[];clearGeneratedMap(g);
  Object.assign(g.player,{x:10,y:16});g.player.hp=g.player.maxHp=9999;g.reveal();return g;
}
const unit=(g,type,x,y,id)=>{const e=makeEnemy(type,x,y,id,3,0,'rift');e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);return e;};
const anchor=(g,x,y,n,guard=false)=>{const p={id:`anchor-3-${n}`,type:'nest',x,y,hp:60,maxHp:60,anchor:{active:true,serial:0,next:999,...(guard?{guard:true}:{})}};g.props.push(p);return p;};

test('the rift floors: the drifting anchor on floor 3, the core on floor 6 with four guard anchors round it',()=>{
  for(const seed of [11,12,13]){
    const three=generate(seed,3,[],0,'rift'),w=three.enemies.find(e=>e.type==='rift_wanderer');assert.ok(w,`seed ${seed}`);assert.ok(w.anchor,'an anchor itself');
    const six=generate(seed,6,[],0,'rift'),c=six.enemies.find(e=>e.type==='rift_core');assert.ok(c);
    const guards=six.props.filter(p=>p.anchor?.guard);assert.equal(guards.length,RIFT_TUNING.guards,`seed ${seed}`);
    for(const p of guards){const d=distance(p,c);assert.ok(d>=2&&d<=5);}
  }
  for(const id of ['rift_wanderer','rift_core']){const e=makeEnemy(id,1,1,id,3,0,'rift');assert.equal(drainAura(e),3,id);assert.deepEqual(topCarriers(e),['riftBoss'],id);assert.ok(ENEMY_TYPES[id].tags.includes('boss'));}
});

test('standing anchors ward a boss: the drifting anchor by every rift anchor on the floor, the core by its guards only',()=>{
  const g=open(),w=unit(g,'rift_wanderer',10,10,'w');anchor(g,2,2,0);anchor(g,20,2,1);
  assert.equal(anchorWard(g,w),.3);
  const hp=w.hp;g.hurt(w,100,g.player);assert.equal(hp-w.hp,70,'two anchors: 30% off');
  g.props[0].hp=0;assert.equal(anchorWard(g,w),.15);
  const h=open(),c=unit(h,'rift_core',10,10,'c');anchor(h,2,2,0);for(const [x,y,n] of [[10,7,1],[13,10,2],[10,13,3],[7,10,4]])anchor(h,x,y,n,true);
  assert.equal(anchorWard(h,c),.8,'four guards: 80% off; a map anchor does not count');
  h.props[1].hp=0;assert.equal(anchorWard(h,c),.6);
  for(const p of h.props)p.hp=0;const before=c.hp;h.hurt(c,100,h.player);assert.equal(before-c.hp,100,'no guards: the whole hit');
});

test('the drifting anchor walks every other turn, strikes beside you, and pulls you in if you stay put',()=>{
  const g=open(),w=unit(g,'rift_wanderer',10,9,'w');w.warpCooldown=99;
  const start={x:w.x,y:w.y},steps=[];for(let i=0;i<4;i++){g.action('wait');steps.push(distance(w,start));}
  assert.ok(steps[3]>=1&&steps[3]<=2,`slow: ${steps}`);
  const p=open(),b=unit(p,'rift_wanderer',10,12,'b');
  p.action('wait');assert.ok(b.warpIntent,'marked');assert.ok(distance(b.warpIntent.point,b)<=2);
  p.action('wait');assert.ok(distance(p.player,b)<=2,'pulled beside it');assert.equal(b.warpIntent,undefined);
});

test('the core never moves; its beam fans wider as its guards fall',()=>{
  const lines=broken=>{
    const g=open(),c=unit(g,'rift_core',10,9,'c');c.warpCooldown=99;
    const guards=[[10,5],[14,9],[6,9],[13,6]].map(([x,y],n)=>anchor(g,x,y,n,true));for(let i=0;i<broken;i++)guards[i].hp=0;
    g.action('wait');assert.deepEqual([c.x,c.y],[10,9],'it stays');assert.ok(c.beamIntent,`marked (${broken} down)`);
    return 1+(c.beamIntent.spread?.length||0);
  };
  assert.equal(lines(0),1);assert.equal(lines(1),2);assert.equal(lines(2),3);assert.equal(lines(4),1+BEAM_TUNING.maxSpread);
  // Every line hits: stand on a side line and it still finds you.
  const g=open(),c=unit(g,'rift_core',10,9,'c');c.warpCooldown=99;for(let n=0;n<4;n++)anchor(g,2+n,2,n,true).hp=0;
  g.action('wait');const tiles=beamTelegraphs(g)[0].lane;assert.ok(tiles.length>BEAM_TUNING.range);
  const side=c.beamIntent.spread[0],lane=tiles.find(q=>distance(q,side)===0)||tiles.find(q=>key(q)!==key(g.player)&&distance(q,g.player)>1);
  Object.assign(g.player,{x:lane.x,y:lane.y});g.reveal();const hp=g.player.hp;g.action('wait');assert.ok(g.player.hp<hp,'hit on a side line');
});

test('a boss draws from its own list, and its bodies dissipate when it falls',()=>{
  const g=open(),w=unit(g,'rift_wanderer',10,10,'w'),a=unit(g,'wisp',4,4,'a');
  bindAnchors({props:g.props,enemies:g.enemies});assert.equal(a.anchorId,'w');assert.equal(w.anchorId,undefined,'a boss is not bound to itself');
  assert.deepEqual(drawWeights(g,w),ENEMY_TYPES.rift_wanderer.anchorDraw.weights);
  g.hurt(w,99999,g.player);assert.equal(a.dissipated,true);
});

test('流逝 counts only a source your side can see',()=>{
  const g=open(),s=unit(g,'shade',10,14,'s');anchor(g,2,2,0);
  tickDrain(g);assert.equal(g.player.drain,1);
  const h=open();anchor(h,2,2,0);for(let x=0;x<SIZE;x++)h.grid[15][x]=0;h.reveal();const t=unit(h,'shade',10,14,'t');h.reveal();
  assert.equal(h.teamVisible(t),false,'behind a wall');tickDrain(h);assert.equal(h.player.drain,undefined);void s;
});

test('saves: a fanned beam round-trips; a malformed fan refuses',()=>{
  const g=open(),c=unit(g,'rift_core',10,9,'c');c.warpCooldown=99;for(let n=0;n<4;n++)anchor(g,2+n,2,n,true).hp=0;g.action('wait');assert.ok(c.beamIntent?.spread);
  const copy=Game.restore(g.serialize());assert.ok(copy);assert.deepEqual(copy.enemies.find(e=>e.id==='c').beamIntent,c.beamIntent);
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='c').beamIntent.spread=[{x:1,y:1},{x:2,y:2},{x:3,y:3}];assert.equal(Game.restore(JSON.stringify(raw)),null);}
  {const raw=JSON.parse(g.serialize());raw.data.enemies.find(e=>e.id==='c').beamIntent.spread=[{x:'a',y:1}];assert.equal(Game.restore(JSON.stringify(raw)),null);}
});

test('the core\'s guards ward and bind, but draw nothing',()=>{
  const g=open(),c=unit(g,'rift_core',10,9,'c');c.anchor={active:true,serial:0,next:999};const p=anchor(g,10,5,0,true);
  assert.equal(drawWeights(g,p).length,0,'a budget of nothing');
  const before=g.enemies.length;for(let i=0;i<3;i++){p.anchor.next=g.turn;tickNests(g);g.turn++;}
  assert.equal(g.enemies.length,before);
});
