import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,generate} from '../src/engine.js';
import {isDark} from '../src/lighting.js';
import {shotChance} from '../src/combat.js';
import {FLARE_TUNING,flareCells,flareLights} from '../src/flares.js';
import {terminalCost,tradeHoldings,offerReason} from '../src/terminal.js';
import {archiveFloor,resumedFloor} from '../src/retreat.js';
import {makeEnemy} from '../src/world.js';

// 3.123.0: flares, as the user decided on 2026-09-17 (docs/ITEMS.md 照明彈).
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function darkArena(){
  const g=new Game(42);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>0));
  Object.assign(g.player,{x:10,y:10,flares:3});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.flares=[];g.reveal();return g;
}
const lit=(g,x,y)=>!isDark(g,{x,y});

test('the numbers the user set: thrown 5, radius 3, and 8 rounds',()=>{
  assert.deepEqual([FLARE_TUNING.range,FLARE_TUNING.radius,FLARE_TUNING.duration],[5,3,8]);
});

test('light reaches the radius the flare can see; walls cast shadows and full cover stays dark, half cover does not',()=>{
  const g=darkArena();g.flares=[{x:12,y:10,expires:g.turn+7}];
  assert.ok(lit(g,12,10)&&lit(g,15,10)&&lit(g,12,13),'three tiles away is lit');
  assert.ok(!lit(g,16,10)&&!lit(g,13,13),'four is not');
  assert.equal(flareCells(g,{x:12,y:10}).length,25,'a radius-3 diamond in the open');
  g.grid[10][13]=0;assert.ok(!lit(g,15,10),'behind a wall, not next to it');g.grid[10][13]=1;
  g.props=[{id:'crate',type:'cover',x:12,y:12,hp:65,maxHp:65}];
  assert.ok(!lit(g,12,13),'straight behind a crate is full cover');
  g.props=[{id:'crate',type:'cover',x:12,y:11,hp:65,maxHp:65}];
  assert.ok(lit(g,13,11),'at a half-cover angle the light gets in');
  g.props=[{id:'crate',type:'cover',x:12,y:12,hp:65,maxHp:65}];g.props[0].hp=0;
  assert.ok(lit(g,12,13),'judged live: a destroyed crate hides nothing');
  assert.equal(flareLights(g,{x:12,y:10},{x:12,y:10}),true,'the flare lights its own tile');
});

test('on a lit tile both sides lose the dark penalty; outside the light it still applies',()=>{
  const g=darkArena(),enemy=makeEnemy('rifleman',12,12,'e');enemy.hp=enemy.maxHp=500;g.enemies=[enemy];g.reveal();
  assert.equal(g.accuracy(g.player,enemy).darkPenalty,40);
  assert.equal(shotChance(g,enemy,g.player).darkPenalty,40);
  g.flares=[{x:11,y:11,expires:g.turn+7}];
  assert.equal(g.accuracy(g.player,enemy).darkPenalty,0,'the enemy is lit');
  assert.equal(shotChance(g,enemy,g.player).darkPenalty,0,'and so is the player standing in it');
  g.flares=[{x:12,y:15,expires:g.turn+7}];
  assert.equal(shotChance(g,enemy,g.player).darkPenalty,40,'the player outside the light keeps it');
  assert.equal(g.accuracy(g.player,enemy).darkPenalty,0);
});

test('throwing: from the pack or the prepared slot, one turn, range and sight checked, and it burns for 8 rounds',()=>{
  const g=darkArena(),p=g.player;
  for(const pos of [{x:16,y:10},null,{x:10.5,y:10}]){const turn=g.turn;assert.equal(g.action('flare',pos),false);assert.equal(p.flares,3);assert.equal(g.turn,turn);}
  const turn=g.turn;assert.ok(g.action('flare',{x:13,y:10}));
  // The round has already advanced when the flare lands, as with smoke, so it expires on the turn it now shows plus 7.
  assert.deepEqual([p.flares,g.turn,g.flares],[2,turn+1,[{x:13,y:10,expires:g.turn+FLARE_TUNING.duration-1}]]);
  p.prepared.item='flare';assert.ok(g.action('usePrepared',{category:'item',target:{x:9,y:10}}),'the prepared slot works too');
  assert.equal(g.flares.length,2);
  // Rounds with the first flare burning: its throw, the second throw, then waits.
  let rounds=2;g.flares=[g.flares[0]];while(g.flares.length&&rounds<20){g.action('wait');rounds++;}
  assert.equal(rounds,FLARE_TUNING.duration,'counted like smoke: the throwing round and seven more');
  assert.ok(isDark(g,{x:13,y:10}),'dark again');
  p.flares=0;assert.equal(g.action('flare',{x:11,y:10}),false);
});

test('saves keep burning flares and reject broken ones; older saves have none',()=>{
  const g=darkArena();g.action('flare',{x:12,y:10});
  const back=Game.restore(g.serialize());assert.deepEqual(back.flares,g.flares);assert.equal(back.player.flares,2);
  for(const broken of [{x:12,y:10,expires:g.turn+FLARE_TUNING.duration},{x:12,y:10,expires:g.turn},{x:-1,y:10,expires:g.turn+2},{x:12,y:10}]){
    const raw=JSON.parse(g.serialize());raw.data.flares=[broken];assert.equal(Game.restore(JSON.stringify(raw)),null,JSON.stringify(broken));
  }
  const raw=JSON.parse(g.serialize());raw.data.player.flares=-1;assert.equal(Game.restore(JSON.stringify(raw)),null);
  const old=JSON.parse(new Game(7).serialize());old.version=55;delete old.data.flares;delete old.data.player.flares;
  const migrated=Game.restore(JSON.stringify(old));assert.deepEqual([migrated.player.flares,migrated.flares],[0,[]]);
});

test('a floor left on a return trip keeps its own flares, shifted in time; an older frame without them resumes with none',()=>{
  const g=darkArena();g.flares=[{x:12,y:10,expires:g.turn+5},{x:13,y:10,expires:g.turn}];
  const frame=archiveFloor(g);assert.deepEqual(frame.flares,[{x:12,y:10,expires:g.turn+5}],'an expired one does not come back');
  const later=resumedFloor(frame,g.turn+10);assert.deepEqual(later.flares,[{x:12,y:10,expires:g.turn+15}]);
  delete frame.flares;assert.deepEqual(resumedFloor(frame,g.turn+10).flares,[]);
});

test('found in the armour room case, sold at terminals for 15, traded in for 9',()=>{
  const map=generate(4242,1),armour=map.props.find(p=>p.type==='container'&&p.kind==='armor');
  assert.ok(armour.contents.some(i=>i.type==='flare'&&i.amount===1),'one flare next to the armour');
  const g=darkArena();g.player.flares=0;g.items=[{x:10,y:10,type:'flare',amount:1}];g.pickup();assert.equal(g.player.flares,1);
  g.props=[{id:'term',type:'terminal',x:11,y:10,used:false}];g.player.scrap=15;
  assert.equal(terminalCost('flare'),15);assert.equal(offerReason(g,'flare'),'');
  assert.ok(g.action('terminal','flare'));assert.equal(g.player.flares,2);
  assert.equal(tradeHoldings(g).find(r=>r.id==='item:flare').value,9);
});

test('the aim shows the tiles it would light and the item button confirms or cancels it',async()=>{
  const source=await read('../src/controller.js'),renderer=await read('../src/renderer.js');
  // 3.135.0: throw-aimed items go through startThrowAim, which sends a flare to startFlareAim (lines to startRopeAim).
  assert.ok(source.includes("if(entry.aim==='throw'){startThrowAim(game.player.prepared.item);return;}"));
  assert.ok(source.includes("if(entry.aim==='throw'){close();startThrowAim(id);return;}"),'the pack’s use button aims too');
  assert.ok(source.includes("function startThrowAim(id){if(PREPARED_CATALOG.item[id]?.action==='rope')startRopeAim(id);else startFlareAim();}"));
  assert.ok(source.includes("if(renderer.mode==='flare'){act('flare',renderer.aim);return;}"),'confirmed as a flare whatever is prepared');
  assert.ok(renderer.includes("if(this.mode==='flare'&&this.aim){const t=this.tile;for(const {x,y} of flareCells(g,this.aim))"));
  assert.ok(renderer.includes('for(const flare of g.flares||[])if(g.seen?.[flare.y]?.[flare.x])'));
});
