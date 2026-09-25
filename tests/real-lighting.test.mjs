import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy,generate,createKillhouse} from '../src/engine.js';
import {killhouseMap} from '../src/killhouse-maps.js';
import {makeBarrier} from '../src/barriers.js';
import {LIGHT,LIGHT_MODEL,LIGHT_TUNING,lightAt,isDark,isBlack,hiddenInDark,seesInDark,recordGunFlashes,placeLamps,ENEMY_FLASHLIGHT,carriesFlashlight,enemyFlashlightOn} from '../src/lighting.js';
import {FLARE_TUNING} from '../src/flares.js';
import {terminalCost} from '../src/terminal.js';
import {BASE_SUPPLIES} from '../src/characters.js';
import {PREPARED_CATALOG,CAPPED_ITEMS} from '../src/prepared.js';
import {roomTiles} from '../src/map-geometry.js';
import {SAVE_VERSION} from '../src/data.js';
import {resumedFloor} from '../src/retreat.js';
import {BLIND_TUNING} from '../src/blind-fire.js';
import {grantTrait} from '../src/traits.js';
import {targetDetails} from '../src/target-card.js';

// 3.178.0: real lighting, as the user decided on 2026-09-25 (docs/LIGHTING.md 真光照).
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
// An open floor on the new light model: unpowered (black) unless `power` says otherwise, no lamps unless given. The
// terrain is cached against, so walls go in through `walls` before the first look.
function arena({power=()=>0,lamps=[],walls=[],character='soldier'}={}){
  const g=new Game(316,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  for(const w of walls)g.grid[w.y][w.x]=0;
  g.lighting=g.grid.map((row,y)=>row.map((_,x)=>power(x,y)));
  Object.assign(g,{barriers:[],props:[],items:[],hazards:[],marks:[],smoke:[],enemies:[],allies:[],flares:[],glowsticks:[],gunFlashes:[]});
  clearGeneratedMap(g);g.lightModel=LIGHT_MODEL;g.lamps=lamps;
  Object.assign(g.player,{x:10,y:10,facing:[1,0],flashlight:false,glowsticks:3});
  Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});g.reveal();return g;
}
const foe=(g,type,x,y,id=type,faction)=>{const e=makeEnemy(type,x,y,id,1,0,faction);Object.assign(e,{hp:300,maxHp:300,alert:false});g.enemies.push(e);g.reveal();return e;};
const at=(g,x,y)=>lightAt(g,{x,y});

test('the numbers the user set',()=>{
  assert.deepEqual(LIGHT,{black:0,dim:1,lit:2});
  assert.deepEqual([LIGHT_TUNING.lampCore,LIGHT_TUNING.lampFade,LIGHT_TUNING.spill,LIGHT_TUNING.flareFade],[2,1,1,2]);
  assert.deepEqual([LIGHT_TUNING.glowstickRadius,LIGHT_TUNING.glowstickRange,LIGHT_TUNING.flashlightCore,LIGHT_TUNING.flashlightFade,LIGHT_TUNING.flashlightHalfAngle],[3,5,3,1,45]);
  assert.deepEqual([FLARE_TUNING.range,FLARE_TUNING.radius],[7,3],'a flare is thrown farther, its lit radius unchanged');
  assert.equal(terminalCost('glowstick'),5);assert.equal(BASE_SUPPLIES.glowsticks,2);assert.ok(CAPPED_ITEMS.includes('glowstick'));
  assert.equal(PREPARED_CATALOG.item.glowstick.resource,'glowsticks');assert.equal(PREPARED_CATALOG.item.glowstick.aim,'throw');
  assert.equal(SAVE_VERSION,76);
});

test('each source is lit in its core and one level darker per tile past it; the brightest wins, nothing stacks',()=>{
  const g=arena({lamps:[{id:'lamp-1-0',x:10,y:4,hp:1}]});
  assert.deepEqual([at(g,10,4),at(g,10,6),at(g,10,7),at(g,10,8)],[2,2,1,0],'a lamp: lit within 2, dim at 3');
  assert.deepEqual([at(g,12,4),at(g,11,5),at(g,13,4)],[2,2,1],'distance is counted in steps, like a throw');
  g.glowsticks=[{x:20,y:20},{x:21,y:20}];
  assert.deepEqual([at(g,20,20),at(g,21,20),at(g,23,20),at(g,24,20),at(g,25,20)],[1,1,1,1,0],'glowsticks only ever make dim, however many');
  g.glowsticks=[{x:10,y:9}];assert.equal(at(g,10,7),1,'a dim lamp edge and a glowstick are still dim');
  g.flares=[{x:16,y:16,expires:g.turn+5}];
  assert.deepEqual([at(g,19,16),at(g,20,16),at(g,21,16),at(g,22,16)],[2,1,1,0],'a flare: lit within 3, dim for 2 more');
  // Walls stop light; the lamp beyond this one lights nothing past it.
  const walled=arena({lamps:[{id:'lamp-1-0',x:10,y:4,hp:1}],walls:[{x:11,y:4}]});
  assert.equal(at(walled,12,4),0,'behind a wall stays black');assert.equal(at(walled,10,5),2);
});

test('a powered area spills one tile into an unpowered one, dim, and a closed door stops it',()=>{
  const g=arena({power:x=>x<5?1:0});
  assert.deepEqual([at(g,4,12),at(g,5,12),at(g,6,12)],[2,1,0]);
  const door=makeBarrier('door',{x:4,y:12},{x:5,y:12},'edge-light');g.barriers.push(door);
  assert.equal(at(g,5,12),0,'the closed door keeps the light in');
  door.open=true;assert.equal(at(g,5,12),1,'open, it spills again');
});

test('the black hides people, not tiles: next to you, only night vision, infrared on the warm, or the swarm see them',()=>{
  const g=arena(),p=g.player,e=foe(g,'rifleman',11,10);
  assert.ok(isBlack(g,e)&&isBlack(g,p));
  assert.equal(g.visibleEnemies.includes(e),false,'adjacent and unseen');
  assert.equal(g.sight(e,p),false,'and it cannot see you either');
  assert.equal(g.visible({x:15,y:10}),true,'sight passes through the black to the tiles beyond');
  const sniper=foe(g,'sniper',12,10,'sn');assert.ok(seesInDark(g,sniper));assert.equal(g.sight(sniper,p),true,'night vision sees you');
  const warden=foe(g,'warden',10,12,'w'),drone=foe(g,'drone',9,10,'d');
  assert.equal(hiddenInDark(g,warden,p),false,'infrared finds the living');
  assert.equal(hiddenInDark(g,warden,drone),true,'but not a machine');
  const crawler=foe(g,'crawler',10,8,'c','swarm');assert.equal(g.sight(crawler,p),true,'the swarm is never in the dark');
  // A player with night vision sees them all.
  const recon=arena({character:'recon'}),r=foe(recon,'rifleman',11,10);assert.ok(recon.visibleEnemies.includes(r));
});

test('dim shows people at −40 to hit; the flashlight lights 2 all around you and shows you (3.182.0)',()=>{
  const g=arena(),p=g.player,e=foe(g,'rifleman',14,10);
  g.glowsticks=[{x:14,y:11}];g.reveal();
  assert.ok(g.visibleEnemies.includes(e));assert.equal(g.accuracy(p,e).darkPenalty,40);
  g.glowsticks=[];e.hp=0;const turn=g.turn;assert.ok(g.action('flashlight'));assert.equal(g.turn,turn,'free');assert.equal(p.flashlight,true);
  assert.deepEqual([at(g,10,10),at(g,12,10),at(g,13,10),at(g,14,10)],[2,2,1,0],'lit within 2 (you included), dim at 3');
  assert.deepEqual([at(g,8,10),at(g,10,12),at(g,9,11),at(g,10,7)],[2,2,2,1],'the same every way: no direction to turn');
  const near=foe(g,'rifleman',10,12,'near');assert.ok(g.visibleEnemies.includes(near));assert.equal(g.accuracy(p,near).darkPenalty,0);
  assert.equal(g.sight(near,p),true,'and it sees you in turn');
  const back=Game.restore(g.serialize());assert.equal(back.player.flashlight,true,'kept in the save');
});

test('switched off, the flashlight burns to the end of the round: a look around always shows you to that round (3.182.0)',()=>{
  const g=arena(),p=g.player,e=foe(g,'rifleman',14,10),seen=[];e.alert=true;
  assert.ok(g.action('flashlight'));assert.ok(g.action('flashlight'),'off again at once, free');
  assert.deepEqual([p.flashlight,p.lightLingers,at(g,11,10)],[false,true,2],'switched off, still burning');
  const back=Game.restore(g.serialize());assert.equal(back.player.lightLingers,true,'kept in the save');assert.equal(lightAt(back,{x:11,y:10}),2);
  Object.defineProperty(g,'enemyAct',{value:x=>seen.push(g.sight(x,p)),configurable:true});
  assert.ok(g.action('wait'));assert.deepEqual(seen,[true],'the enemies of that round still see you');
  assert.deepEqual([p.lightLingers,at(g,11,10),at(g,10,10)],[false,0,0],'then it is dark');
  for(let i=0;i<3;i++)assert.ok(g.action('flashlight'));assert.deepEqual([p.flashlight,p.lightLingers],[true,false],'back on cancels the fade');
  const raw=JSON.parse(g.serialize());raw.version=73;delete raw.data.player.lightLingers;assert.equal(Game.restore(JSON.stringify(raw)).player.lightLingers,false,'older saves carry no fading light');
  raw.version=74;raw.data.player.lightLingers='yes';assert.equal(Game.restore(JSON.stringify(raw)),null);
});

test('a gun fired lights its tile, dim, through the next round, and a save agrees with the live game',()=>{
  const g=arena(),p=g.player,e=foe(g,'rifleman',14,10),seen=[];
  assert.equal(g.visibleEnemies.includes(e),false);
  g.effects.push({type:'enemyShot',style:'bullet',attackerType:'rifleman',from:{x:14,y:10},to:{x:10,y:10}});
  assert.equal(at(g,14,10),1,'the flash shows the shooter');g.reveal();assert.ok(g.visibleEnemies.includes(e));
  g.effects.push({type:'shot',weaponId:'knife',style:'slash',from:{x:10,y:10},to:{x:11,y:10}});
  assert.equal(at(g,10,10),0,'a blade makes no flash');
  recordGunFlashes(g);assert.deepEqual(g.gunFlashes,[{x:14,y:10}]);
  const back=Game.restore(g.serialize());assert.equal(lightAt(back,{x:14,y:10}),1,'restored, it is still lit for the reply');
  // The next round: the rifleman, acting in it, still sees where you fired from; after it the flash is gone.
  g.effects.push({type:'shot',weaponId:'rifle',style:'bullet',from:{x:10,y:10},to:{x:14,y:10}});recordGunFlashes(g);
  e.alert=true;Object.defineProperty(g,'enemyAct',{value:x=>seen.push(g.sight(x,p)),configurable:true});
  assert.ok(g.action('wait'));assert.deepEqual(seen,[true],'seen through the next round');
  assert.deepEqual([at(g,10,10),at(g,14,10)],[0,0],'then gone');assert.deepEqual(g.gunFlashes,[]);
  for(const broken of [[{x:1,y:1,turn:3}],[{x:-1,y:1}],Array.from({length:65},(_,i)=>({x:i%SIZE,y:1}))]){
    const raw=JSON.parse(g.serialize());raw.data.gunFlashes=broken;assert.equal(Game.restore(JSON.stringify(raw)),null,JSON.stringify(broken).slice(0,40));
  }
});

test('the glowstick: thrown within 5 onto visible floor, one turn, it stays; refused without one',()=>{
  const g=arena(),p=g.player;
  for(const pos of [{x:16,y:10},null,{x:10.5,y:10}]){const turn=g.turn;assert.equal(g.action('glowstick',pos),false);assert.equal(p.glowsticks,3);assert.equal(g.turn,turn);}
  const turn=g.turn;assert.ok(g.action('glowstick',{x:13,y:10}));
  assert.deepEqual([p.glowsticks,g.turn,g.glowsticks],[2,turn+1,[{x:13,y:10}]]);
  for(let i=0;i<20;i++)g.action('wait');assert.equal(at(g,13,10),1,'no time limit');
  p.prepared.item='glowstick';assert.ok(g.action('usePrepared',{category:'item',target:{x:10,y:12}}),'the prepared slot throws it too');
  assert.equal(g.glowsticks.length,2);
  const back=Game.restore(g.serialize());assert.deepEqual(back.glowsticks,g.glowsticks);assert.equal(back.player.glowsticks,1);
  for(const broken of [[{x:-1,y:1}],[{x:1,y:1,t:1}],'x']){const raw=JSON.parse(g.serialize());raw.data.glowsticks=broken;assert.equal(Game.restore(JSON.stringify(raw)),null);}
  p.glowsticks=0;assert.equal(g.action('glowstick',{x:11,y:10}),false);
});

test('every floor lights its unpowered rooms with wall lamps, the same way each time, off the map stream',()=>{
  for(let seed=1;seed<=6;seed++)for(let floor=1;floor<=4;floor++){
    const map=generate(seed,floor);assert.equal(map.lightModel,LIGHT_MODEL);assert.deepEqual(map.lamps,generate(seed,floor).lamps);
    for(const lamp of map.lamps)assert.equal(map.grid[lamp.y][lamp.x],1);
    for(const room of map.rooms){
      const dark=roomTiles(room).filter(q=>map.grid[q.y]?.[q.x]===1&&map.lighting[q.y][q.x]===0);if(!dark.length)continue;
      const inside=map.lamps.filter(l=>dark.some(q=>q.x===l.x&&q.y===l.y));
      assert.ok(inside.length>=Math.max(1,Math.round(dark.length/LIGHT_TUNING.lampTiles)),`${seed}/${floor} room ${room.id}: about one lamp per 20 tiles`);
    }
    const again=placeLamps(structuredClone({...map,lamps:undefined}),seed,floor);assert.deepEqual(again.lamps,map.lamps);
    const crate=map.props.find(o=>o.contents?.some(i=>i.type==='glowstick'));
    assert.ok(crate&&crate.contents.find(i=>i.type==='glowstick').amount>=2,'two or three glowsticks in the armour room case');
  }
});

test('older saves keep the old rule on the floors they carry; a new floor brings the new one',()=>{
  const g=new Game(7,[],0,'soldier','onyx');const raw=JSON.parse(g.serialize());
  raw.version=72;delete raw.data.lamps;delete raw.data.lightModel;delete raw.data.glowsticks;delete raw.data.gunFlashes;delete raw.data.player.glowsticks;delete raw.data.player.flashlight;
  const old=Game.restore(JSON.stringify(raw));assert.ok(old);
  assert.deepEqual([old.player.glowsticks,old.player.flashlight,old.glowsticks,old.lightModel],[0,false,[],undefined]);
  const unpowered=[];for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(old.grid[y][x]===1&&old.lighting[y][x]===0)unpowered.push({x,y});
  assert.ok(unpowered.length>0);assert.ok(unpowered.every(q=>isDark(old,q)&&!isBlack(old,q)),'unpowered is dim, never black');
  Object.assign(old.player,old.exitPoint);assert.ok(old.descend());assert.equal(old.lightModel,LIGHT_MODEL,'the next floor is lit for real');
  const bad=JSON.parse(g.serialize());bad.data.lamps=undefined;assert.equal(Game.restore(JSON.stringify(bad)),null,'a light model without its lamps is refused');
});

test('a floor kept for the way back from before 3.178.0 stays on the old rule and does not borrow this floor’s lamps',()=>{
  const g=new Game(1,[],0,'soldier','onyx','roundtrip');Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
  const frame=g.floorStates[1];assert.ok(frame.lamps.length>0&&frame.lightModel===LIGHT_MODEL,'kept with its lamps');
  // What a kept floor saved by 3.177 looks like: no lamps, light model, glowsticks.
  delete frame.lamps;delete frame.lightModel;delete frame.glowsticks;
  assert.ok(g.lamps.length>0,'while this floor has lamps');
  const back=Game.restore(g.serialize());assert.ok(back,'the save still loads');
  assert.equal(back.floorStates[1].lamps,undefined);
  const resumed=resumedFloor(back.floorStates[1],back.turn);assert.deepEqual([resumed.lightModel,resumed.lamps,resumed.glowsticks],[undefined,undefined,[]]);
});

test('walking into someone you cannot see is a blind melee at −40, both ways (3.180.0)',()=>{
  const miss=g=>{g.rng=Object.assign(()=>.99,{state:()=>0});return g;};
  // The player: the move becomes a swing at the unseen rifleman, one turn, 40 below the usual chance.
  const g=miss(arena()),p=g.player,e=foe(g,'rifleman',11,10),w=g.weaponAt(g.bumpMeleeSlot());
  assert.equal(g.visibleEnemies.includes(e),false);
  const expected=g.meleeAccuracy(p,e,w.hitChance-BLIND_TUNING.penalty),turn=g.turn;
  assert.ok(g.action('move',[1,0]));assert.equal(g.turn,turn+1);assert.deepEqual([p.x,p.y],[10,10]);
  assert.ok(g.logs.some(l=>l.text.includes('憑感覺出手')));assert.ok(g.logs.some(l=>l.text.includes(`（${expected}%）`)),'the miss names the blind chance');
  // An enemy: heading for where it last saw you, its next step is your tile, so it attacks, 40 below its usual chance.
  // A brute swings (melee off its melee chance); a gunner in the same spot takes a blind shot instead.
  const h=miss(arena()),brute=makeEnemy('brute',11,10,'b',1,0);Object.assign(brute,{hp:300,maxHp:300,alert:true,lastKnown:{x:10,y:10}});
  delete h.enemyAct;h.enemies.push(brute);h.reveal();assert.equal(h.sight(brute,h.player),false);
  assert.ok(h.action('wait'));const chance=h.meleeAccuracy(brute,h.player,97-BLIND_TUNING.penalty);   // read after the wait, whose evasion counts
  assert.ok(h.logs.some(l=>l.text.includes(`（${chance}%）`)),'it swung blind');assert.deepEqual([brute.x,brute.y],[11,10],'and did not walk through you');
});

test('an enemy the soldier has marked is one level brighter for the player: lockable in the black, dim counts as lit (3.180.0)',()=>{
  const g=arena(),p=g.player,e=foe(g,'rifleman',13,10);
  assert.equal(g.visibleEnemies.includes(e),false);
  grantTrait(e,'exposed','skill:early_warning',3);g.reveal();
  assert.ok(g.visibleEnemies.includes(e),'marked, it can be locked in the black');assert.equal(g.accuracy(p,e).darkPenalty,40,'at the dim penalty');
  g.glowsticks=[{x:13,y:11}];assert.equal(g.accuracy(p,e).darkPenalty,0,'dim counts as lit');
  const other=foe(g,'rifleman',13,12,'other');assert.equal(g.accuracy(p,other).darkPenalty,40,'an unmarked one keeps the penalty');
  assert.equal(g.sight(e,p),false,'the mark shows it to you, not you to it');
});

test('enemy flashlights: a third of the humans, squad leaders and enforcers always, none for machines or the swarm (3.181.0)',()=>{
  const game={seed:77,floor:2,enemies:[]},count=type=>{let n=0;for(let i=0;i<600;i++)n+=carriesFlashlight(game,makeEnemy(type,1,1,`e${i}`))?1:0;return n;};
  assert.equal(ENEMY_FLASHLIGHT.share,1/3);
  for(const type of ['squad_leader','enforcer'])assert.equal(count(type),600,type);
  for(const type of ['drone','crawler','bomber_bot','rifleman_infected'])assert.equal(count(type),0,type);
  for(const type of ['rifleman','raider','brute'])assert.ok(Math.abs(count(type)/600-1/3)<.06,type);
  assert.equal(carriesFlashlight(game,makeEnemy('rifleman',1,1,'e0',1,0,'swarm')),false,'nothing that fights for the swarm');
});

test('an alerted enemy lights its cone toward where it last saw you, and shows itself; asleep it keeps it off (3.181.0)',()=>{
  const g=arena(),p=g.player,e=foe(g,'enforcer',14,10);
  assert.equal(enemyFlashlightOn(g,e),false,'not alert');assert.equal(g.visibleEnemies.includes(e),false);
  Object.assign(e,{alert:true,lastKnown:{x:10,y:10}});g.reveal();
  assert.ok(enemyFlashlightOn(g,e));
  assert.deepEqual([at(g,13,10),at(g,11,10),at(g,10,10),at(g,14,10)],[2,2,1,1],'lit 3 toward you, dim at 4, and its own tile');
  assert.equal(g.sight(e,p),true,'your tile in its beam: it sees you');assert.ok(g.visibleEnemies.includes(e),'and you see it');
  g.target=e.id;assert.ok(targetDetails(g).state.includes('手電筒開著'),'the target card says so');
  e.hp=0;assert.equal(at(g,13,10),0,'a dead one drops it');
});

test('machines find the living in the black, as infrared does; the player still cannot see them (3.181.0)',()=>{
  const g=arena(),p=g.player,d=foe(g,'drone',12,10);
  assert.equal(g.sight(d,p),true);assert.equal(g.visibleEnemies.includes(d),false);
  const legacy=arena();legacy.lightModel=undefined;legacy.lamps=undefined;const e=foe(legacy,'enforcer',14,10);Object.assign(e,{alert:true,lastKnown:{x:10,y:10}});
  assert.equal(enemyFlashlightOn(legacy,e),false,'no enemy flashlights on floors from before real lighting');
});

test('the kill house is on real lighting too: the combat map keeps its unpowered rooms and gets their lamps (3.184.0)',()=>{
  for(const phase of ['combat','tutorial','armory']){
    const m=killhouseMap(7,phase,'soldier',{armory:'all'});assert.equal(m.lightModel,LIGHT_MODEL,phase);
    const unpowered=m.grid.flatMap((row,y)=>row.map((v,x)=>v===1&&m.lighting[y][x]===0)).filter(Boolean).length;
    assert.equal(m.lamps.length>0,unpowered>0,`${phase}: lamps exactly where there are unpowered rooms`);
  }
  const g=createKillhouse({mode:'arcade',seed:7,character:'soldier'});g.floor=2;g.simulation.phase='combat';g.loadFloor();g.reveal();
  assert.ok(g.grid.some((row,y)=>row.some((v,x)=>v===1&&isBlack(g,{x,y}))),'the black is there to practise in');
});

test('the controls: a switch beside the aim switch, the L key, and throwing aims like a decoy',async()=>{
  const source=await read('../src/controller.js'),html=await read('../index.html'),keys=await read('../src/hotkeys.js'),renderer=await read('../src/renderer.js');
  assert.ok(html.includes('data-action="flashlight"'));
  assert.ok(keys.includes("{id:'flashlight',group:t('hotkeyActions.flashlight.group'),label:t('hotkeyActions.flashlight.label'),defaults:['l']}"));
  assert.ok(source.includes("else if(action==='decoy'||action==='mine'||action==='glowstick')startPlaceAim(action);"));
  assert.ok(source.includes("case 'flashlight':act('flashlight');break;"));
  assert.ok(renderer.includes("const shown=!isBlack(g,{x,y})||seesInDark(g,p);"),'what lies in the black is not drawn');
  assert.ok(renderer.includes("if(shown)for(const weapon of [false,true])")&&renderer.includes("if(shown)for(const dead of g.enemies)"));
});
