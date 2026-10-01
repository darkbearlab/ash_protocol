// 3.210.0 (user decision 2026-10-01, docs/BULWARK.md 改版：裝甲板就是生命): option C. The bulwark is an ordinary soldier's
// 100 health inside 120 plates; the plates take all of a direct hit after armour, the floor's fire, steam and acid hit
// them first (after hazmat), they are one more rank of poison resistance while any are left, and 難以治療 is gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {CHARACTERS} from '../src/characters.js';
import {activeTrait,grantTrait,TRAITS} from '../src/traits.js';
import {poisonResistance,tickPoison} from '../src/poison.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {VENT_TUNING} from '../src/vent-map.js';
import {FIRE_TUNING} from '../src/fire.js';

function arena(character='bulwark'){
 const g=new Game(3210,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke','rooms','traces'])g[k]=[];clearGeneratedMap(g);
 g.fires=undefined;g.vents=undefined;Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
const rifleman=(g,x=13,y=10)=>{const e=makeEnemy('rifleman',x,y,'qa-'+g.enemies.length);Object.assign(e,{hp:500,maxHp:500,alert:true});g.enemies.push(e);g.reveal();return e;};

test('the class: 100 health, armor 6, 120 plates of 120, plate_life; slow, large, clumsy, heavy armor and suppression resistance stay',()=>{
 const c=CHARACTERS.bulwark;assert.deepEqual([c.hp,c.armor,c.plates,c.plateCapacity],[100,6,120,120]);
 for(const id of ['suppression_resistance','large','clumsy','slow','heavy_armor','plate_life'])assert.ok(c.traits.includes(id),id);
 assert.ok(!c.traits.includes('difficult_healing'));assert.ok(CHARACTERS.necromancer.traits.includes('difficult_healing'),'the necromancer keeps it');
 for(const id of Object.keys(CHARACTERS).filter(id=>id!=='bulwark'))assert.ok(!CHARACTERS[id].traits.includes('plate_life'),`${id} has no plate_life`);
 assert.ok(TRAITS.plate_life.name&&TRAITS.plate_life.text.includes('1 層抗毒'));
});

test('the plates take every point of a direct hit that armour leaves; the body only takes what they cannot',()=>{
 const g=arena(),p=g.player;
 g.damagePlayer(19,'test');assert.equal(p.plates,110,'ceil((19−6)×0.75)=10, all on the plates');assert.equal(p.hp,100);
 assert.match(g.logs[0].text,/護甲板吸收 10，生命沒有損失/);
 p.plates=4;g.damagePlayer(19,'test');assert.equal(p.plates,0);assert.equal(p.hp,94,'4 on the plates, 6 on the body');
 g.damagePlayer(19,'test');assert.equal(p.hp,84,'no plates left: the full 10');
 // A blast too (the same armour path), and a wait halves before the plates take it.
 p.plates=50;p.guard=true;g.damagePlayer(30,'blast',null,true);assert.equal(p.plates,41,'ceil((30−6)×0.75)=18, a wait halves it to 9, all on the plates');assert.equal(p.hp,84);
});

test('only the bulwark: anyone else\'s plates still take half, and an exoskeleton still takes its share first',()=>{
 const s=arena('soldier'),q=s.player;q.plates=30;s.damagePlayer(30,'test');assert.equal(q.plates,15);assert.equal(q.hp,85,'half on the plates');
 // plate_life on someone wearing a frame: the frame takes half first, the plates all the rest.
 const r=arena('recon'),w=r.player;grantTrait(w,'plate_life','test');grantTrait(w,'exoskeleton','test');w.exoPlates=10;w.plates=30;r.damagePlayer(30,'test');
 assert.equal(w.exoPlates,0,'the frame takes its half, up to what it has');assert.equal(w.plates,10,'the plates take all of the rest');assert.equal(w.hp,100);
});

test('fire, steam and acid floor hit the plates first, after hazmat, and spill onto the body once they are gone',()=>{
 const g=arena(),p=g.player;
 g.hazards=[{x:10,y:10,type:'heat'}];g.environmentTurn();assert.deepEqual([p.plates,p.hp],[108,100]);assert.match(g.logs[0].text,/全由護甲板吸收（−12）/);
 p.hazmat=5;g.environmentTurn();assert.deepEqual([p.plates,p.hp],[101,100],'hazmat first: 12 − 5');
 p.hazmat=0;g.hazards=[{x:10,y:10,type:'acid'}];p.plates=3;g.environmentTurn();assert.deepEqual([p.plates,p.hp],[0,94],'acid 8: 3 plates, 5 body, then its first poison tick of 1 with no plate rank left');assert.equal(p.poison,1,'acid still poisons');
 assert.match(g.logs.find(l=>l.text.includes('污染液')).text,/−5（護甲板吸收 3）/);
 // Everyone else: the floor never touches their plates.
 const s=arena('soldier');s.player.plates=10;s.hazards=[{x:10,y:10,type:'heat'}];s.environmentTurn();assert.deepEqual([s.player.plates,s.player.hp],[10,88]);
});

test('steam and burning floor go through the plates as well',()=>{
 const g=arena(),p=g.player;g.smoke=[{kind:'steam',cells:[{x:10,y:10}],expires:g.turn}];g.environmentTurn();
 assert.deepEqual([p.plates,p.hp],[120-VENT_TUNING.damage,100]);assert.match(g.logs[0].text,/蒸氣的傷害全由護甲板吸收/);
 const b=arena();b.fires=[{x:10,y:10,age:0}];b.player.plates=4;b.environmentTurn();
 assert.deepEqual([b.player.plates,b.player.hp],[0,100-(FIRE_TUNING.damage-4)]);assert.match(b.logs[0].text,/火焰燒傷 −6（護甲板吸收 4）/);
});

test('one more rank of poison resistance while any plate is left; none once they are gone; nobody else gets it',()=>{
 const g=arena(),p=g.player;assert.equal(poisonResistance(p),1);
 p.poison=3;delete p.poisonClock;tickPoison(g);assert.equal(p.hp,98,'3 stacks − 1 rank');
 p.plates=0;assert.equal(poisonResistance(p),0);p.poison=3;delete p.poisonClock;tickPoison(g);assert.equal(p.hp,95);
 p.plates=1;p.hazmat=5;assert.equal(poisonResistance(p),2,'stacks with 密封防護');
 const s=arena('soldier');s.player.plates=10;assert.equal(poisonResistance(s.player),0);
});

test('healing is no longer halved, and the hit the plates take whole shows its number in presentation',()=>{
 const g=arena(),p=g.player;p.hp=20;assert.ok(g.action('heal'));assert.equal(p.hp,65,'a medkit\'s full 45');
 const h=arena(),e=rifleman(h,11,10);e.charge=true;h.player.plates=120;
 const {steps}=captureAction(h,()=>h.action('wait')),hits=steps.flatMap(s=>s.effects).filter(f=>f.type==='enemyShot'&&!f.miss);
 assert.ok(hits.length,'the rifleman fires');assert.ok(hits.every(f=>f.damage===0&&f.plates>0),'nothing reached the body; the plates took it');
 const impacts=planPresentation(steps).events.flatMap(ev=>ev.effects).filter(f=>f.type==='impact'&&f.plates>0);assert.ok(impacts.length,'an impact carries the plate number');
});

test('a save keeps the plates; a count over the cap is cut to it on load, not refused',()=>{
 const g=arena();g.player.plates=77;const back=Game.restore(g.serialize());assert.equal(back.player.plates,77);
 const raw=JSON.parse(g.serialize());raw.data.player.plates=500;assert.equal(Game.restore(JSON.stringify(raw)).player.plates,120);
});
