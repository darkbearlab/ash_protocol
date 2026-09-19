import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy} from '../src/engine.js';
import {TERMINAL_ITEMS,terminalReason,tradeHoldings} from '../src/terminal.js';
import {PREPARED_CATALOG,CAPPED_ITEMS} from '../src/prepared.js';
import {FIELD_ITEMS} from '../src/containers.js';
import {actorStat} from '../src/actor-stats.js';
import {suppressionStacks} from '../src/suppression.js';
import {activeTrait} from '../src/traits.js';
import {DECOY_TUNING,MINE_TUNING,EXO_TUNING,fooled,decoyAct,checkMines,knownMine,mineAt} from '../src/field-gear.js';
import {scream} from '../src/civilians.js';
import {soundAlarm} from '../src/rebels.js';

// 3.144.0 (user decisions 2026-09-19, docs/ITEMS.md 誘餌、地雷、外骨骼): three player-only field items.
function arena(character='soldier'){
 const g=new Game(3,[],0,character,undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];g.flares=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(p,{x:10,y:10,decoys:3,mines:5,plates:0});g.end={x:25,y:25};g.reveal();
 return g;
}
const foe=(g,type,x,y,id,hp=500)=>{const e=makeEnemy(type,x,y,id,1);Object.assign(e,{hp,maxHp:hp,alert:true});g.enemies.push(e);g.reveal();return e;};
const still=g=>{Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});return g;};
const wall=(g,cells)=>{for(const [x,y] of cells)g.grid[y][x]=0;g.reveal();};

test('the numbers the user set',()=>{
 assert.deepEqual([DECOY_TUNING.range,DECOY_TUNING.radius,DECOY_TUNING.duration,DECOY_TUNING.hp],[5,6,4,30]);
 assert.deepEqual([MINE_TUNING.range,MINE_TUNING.radius,MINE_TUNING.damage,MINE_TUNING.max],[3,1,60,3]);
 assert.deepEqual([EXO_TUNING.plates,EXO_TUNING.accuracy,EXO_TUNING.melee,EXO_TUNING.suppression],[50,10,1.2,5]);
 assert.ok(CAPPED_ITEMS.includes('decoy')&&CAPPED_ITEMS.includes('mine'));
 assert.ok(FIELD_ITEMS.includes('decoy')&&FIELD_ITEMS.includes('mine'),'both turn up in cases');
 assert.equal(PREPARED_CATALOG.item.exo.wear,true);
});

test('the decoy draws every ordinary enemy within 6 tiles: they cannot see you and go for it instead',()=>{
 const g=still(arena()),p=g.player;
 const a=foe(g,'rifleman',16,10,'a'),far=foe(g,'rifleman',21,10,'far'),boss=foe(g,'boss',15,12,'boss'),munition=foe(g,'munition',14,12,'munition');
 assert.ok(g.sight(a,p),'in the open it sees you');
 assert.equal(g.action('decoy',{x:15,y:11}),false,'five tiles is the reach');
 assert.equal(g.action('decoy',{x:14,y:10}),true);
 assert.equal(p.decoys,2);
 assert.ok(fooled(g,a));assert.deepEqual(a.lastKnown,{x:14,y:10});
 assert.equal(g.sight(a,p),false,'fooled, it does not see you');
 assert.ok(!fooled(g,far),'seven tiles from where it landed is out of reach');
 assert.ok(!fooled(g,boss),'bosses see through it');
 assert.ok(!fooled(g,munition),'suicide units have nothing to spend on it');
 assert.ok(g.sight(far,p));
});

test('attacking one snaps it and every fooled enemy watching it out of it; the rest stay fooled',()=>{
 const g=still(arena()),p=g.player;
 const a=foe(g,'rifleman',16,10,'a'),b=foe(g,'rifleman',16,12,'b'),c=foe(g,'rifleman',15,6,'c');
 wall(g,[...Array(13).keys()].map(i=>[i+10,8]));
 assert.equal(g.sight(c,a),false,'the wall hides the shot from c');
 assert.ok(g.action('decoy',{x:14,y:10}));
 assert.ok([a,b,c].every(e=>fooled(g,e)));
 g.target=a.id;g.rng=()=>0;assert.ok(g.action('fire'));
 assert.ok(!fooled(g,a),'the target');assert.ok(!fooled(g,b),'a witness');assert.ok(fooled(g,c),'one that saw nothing');
 assert.ok(g.sight(a,p));
});

test('next to you it sees through it; in reach of the decoy it attacks the decoy, not you',()=>{
 const g=arena(),p=g.player;
 const near=foe(g,'rifleman',11,10,'near'),e=foe(g,'rifleman',15,10,'e');
 Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});
 assert.ok(g.action('decoy',{x:14,y:10}));
 assert.ok(fooled(g,near));assert.ok(g.sight(near,p),'adjacent, the decoy does not hide you');
 assert.equal(decoyAct(g,near),false,'its ordinary turn runs');assert.ok(!fooled(g,near));
 g.rng=()=>0;const hp=p.hp;
 assert.equal(decoyAct(g,e),true,'it spent its turn on the decoy');
 assert.equal(p.hp,hp);
 assert.ok(!g.decoy||g.decoy.hp<DECOY_TUNING.hp,'the decoy took the hit');
});

test('a scream or a rebel alarm does not point a fooled enemy back at you; only an attack does',()=>{
 const g=still(arena());
 const a=foe(g,'rifleman',16,10,'a'),civ=makeEnemy('civilian',12,11,'civ',1);g.enemies.push(civ);g.reveal();
 assert.ok(g.action('decoy',{x:14,y:10}));assert.ok(fooled(g,a));
 civ.screamCooldown=0;assert.ok(scream(g,civ));
 assert.deepEqual(a.lastKnown,{x:14,y:10},'still heading for the decoy');
 const r=foe(g,'rifleman',15,11,'r');r.alarmCooldown=0;soundAlarm(g,r);
 assert.deepEqual(a.lastKnown,{x:14,y:10});assert.ok(fooled(g,a));
});

test('the decoy fades after 4 turns, and a blast can destroy it',()=>{
 const g=arena();
 assert.ok(g.action('decoy',{x:13,y:10}));
 for(let i=0;i<2;i++){g.action('wait');assert.ok(g.decoy,`still up after ${i+1} waits`);}
 g.action('wait');assert.equal(g.decoy,null,'the enemies got four rounds with it: the throw and three waits');
 assert.ok(g.action('decoy',{x:13,y:10}));
 g.explode({x:13,y:10},1,50,g.player);
 assert.equal(g.decoy,null,'50 is more than its 30');
});

test('mines: within 3 visible tiles, on an empty tile, at most 3 on a floor, never on the exit',()=>{
 const g=still(arena()),p=g.player;foe(g,'rifleman',12,12,'e');
 assert.equal(g.action('mine',{x:14,y:10}),false,'four tiles is too far');
 assert.equal(g.action('mine',{x:12,y:12}),false,'an enemy stands there');
 g.props=[{id:'crate',type:'cover',x:11,y:11,hp:50,maxHp:50}];
 assert.equal(g.action('mine',{x:11,y:11}),false,'nor on a crate');
 g.end={x:10,y:12};assert.equal(g.action('mine',{x:10,y:12}),false,'nor on the exit');
 for(const x of [11,12,13])assert.equal(g.action('mine',{x,y:10}),true);
 assert.equal(g.action('mine',{x:10,y:9}),false,'the fourth');
 assert.equal(g.mines.length,3);assert.equal(p.mines,2);
});

test('a walking enemy sets it off; flyers pass over; you and your allies walk on it safely but not through the blast',()=>{
 const g=still(arena()),p=g.player;
 assert.ok(g.action('mine',{x:11,y:10}));
 assert.ok(g.action('move',[1,0]));assert.ok(mineAt(g,11,10),'you do not set it off');
 assert.ok(g.action('move',[-1,0]));
 const drone=foe(g,'drone',13,13,'drone');Object.assign(drone,{x:11,y:10});checkMines(g);
 assert.ok(mineAt(g,11,10),'a flyer passes over');g.enemies=[];
 const e=foe(g,'rifleman',13,13,'e'),hp=e.hp,mine=p.hp;Object.assign(e,{x:11,y:10});checkMines(g);
 assert.equal(mineAt(g,11,10),null,'it went off');
 assert.ok(hp-e.hp>=MINE_TUNING.damage-8,'the centre takes the full charge, less its armour');
 assert.equal(mine-p.hp,MINE_TUNING.damage-10,'a tile away you take 50');
});

test('one blast sets off the next, and a grenade sets them off too',()=>{
 const g=still(arena());
 for(const x of [12,13])assert.ok(g.action('mine',{x,y:10}));
 const e=foe(g,'rifleman',13,13,'e');Object.assign(e,{x:12,y:10});checkMines(g);
 assert.equal(g.mines.length,0,'both went');
 assert.ok(g.action('mine',{x:13,y:10}));g.explode({x:13,y:11},1,50,g.player);
 assert.equal(g.mines.length,0);
});

test('enemies cannot see a mine, except one that watched it go down, which walks around it',()=>{
 const g=still(arena());
 const watcher=foe(g,'rifleman',16,10,'watcher'),blind=foe(g,'rifleman',16,6,'blind');
 wall(g,[...Array(13).keys()].map(i=>[i+8,8]));
 assert.ok(g.action('mine',{x:12,y:10}));
 assert.ok(knownMine(g,watcher,12,10));assert.equal(g.passable(12,10,watcher),false);
 assert.ok(!knownMine(g,blind,12,10));assert.ok(g.passable(12,10,blind));
 const late=foe(g,'rifleman',16,12,'late');assert.ok(g.passable(12,10,late),'one that arrives later does not know');
});

test('mines left behind are gone on the next floor',()=>{
 const g=new Game(1,[],0,'soldier','onyx','roundtrip');g.player.mines=2;g.mines=[{id:'mine-1-1',x:g.player.x,y:g.player.y,seen:[]}];g.mineSerial=1;
 Object.assign(g.player,g.exitPoint);assert.ok(g.descend());
 assert.deepEqual(g.mines,[]);assert.equal(g.decoy,null);assert.equal(g.player.mines,2,'the ones in the pack stay');
});

test('the exoskeleton: bought with full plates, not for the bulwark, and never traded back',()=>{
 const g=arena(),p=g.player;p.scrap=999;g.props.push({type:'terminal',x:p.x,y:p.y,used:false});
 assert.equal(TERMINAL_ITEMS.exo.wear,'exo');
 assert.equal(g.useTerminal('exo'),true);
 assert.ok(p.wearables.includes('exo'));assert.equal(p.exoPlates,EXO_TUNING.plates);
 assert.ok(!tradeHoldings(g).some(r=>r.id==='wear:exo'),'a worn-down frame would otherwise sell for new');
 const big=arena('bulwark');big.player.scrap=999;big.props.push({type:'terminal',x:10,y:10,used:false});
 assert.match(terminalReason(big,'exo'),/穿不下/);
 big.player.wearables.push('exo');big.player.exoPlates=50;
 assert.equal(big.action('prepare',{category:'item',id:'exo'}),false,'nor can it put one on');
});

test('worn: +10 to hit, +20% melee, and its plates take their share before yours',()=>{
 const g=still(arena()),p=g.player;p.wearables.push('exo');p.exoPlates=50;
 const aim=actorStat(p,'rangedAccuracy');
 assert.equal(g.action('prepare',{category:'item',id:'exo'}),true);
 assert.ok(activeTrait(p,'exoskeleton'));
 assert.equal(actorStat(p,'rangedAccuracy'),aim+EXO_TUNING.accuracy);
 p.plates=10;const hp=p.hp;
 g.damagePlayer(40,'test');
 assert.equal(p.exoPlates,30,'half the hit, all of it into the frame');assert.equal(p.plates,10);assert.equal(p.hp,hp-20);
 const bare=arena();bare.player.plates=10;const bareHp=bare.player.hp;bare.damagePlayer(40,'test');
 assert.equal(bare.player.hp,bareHp-30,'without it your own 10 plates take what they can');
 // Melee: the same bump with and without it.
 const hit=wear=>{const m=still(arena('berserker'));if(wear){m.player.wearables.push('exo');m.player.exoPlates=50;m.action('prepare',{category:'item',id:'exo'});}
  const e=foe(m,'rifleman',11,10,'e',1000);m.target=e.id;m.rng=()=>.5;m.action('move',[1,0]);return 1000-e.hp;};
 assert.ok(hit(true)>hit(false),'melee hits harder');
});

test('when its plates run out it breaks, is gone, and pins you: 5 stacks; nothing repairs it',()=>{
 const g=still(arena()),p=g.player;p.wearables.push('exo');p.exoPlates=6;p.sprays=2;
 assert.ok(g.action('prepare',{category:'item',id:'exo'}));
 assert.ok(g.action('plate'));assert.equal(p.exoPlates,6,'the spray patches your plates, not the frame');
 const plates=p.plates,hp=p.hp;
 g.damagePlayer(40,'test');
 assert.equal(p.plates,plates-14,'your plates take the rest of the half');assert.equal(p.hp,hp-20);
 assert.equal(p.exoPlates,0);assert.ok(!p.wearables.includes('exo'));assert.equal(p.prepared.item,null);
 assert.ok(!activeTrait(p,'exoskeleton'));
 assert.equal(suppressionStacks(p),EXO_TUNING.suppression);
});

test('saves carry the decoy, the mines and the frame, and refuse forged ones',()=>{
 const g=still(arena()),p=g.player;foe(g,'rifleman',16,10,'a');p.wearables.push('exo');p.exoPlates=42;
 assert.ok(g.action('decoy',{x:14,y:10}));assert.ok(g.action('mine',{x:12,y:10}));
 const back=Game.restore(g.serialize());assert.ok(back);
 assert.deepEqual(back.decoy,g.decoy);assert.deepEqual(back.mines,g.mines);assert.equal(back.mineSerial,g.mineSerial);
 assert.equal(back.player.exoPlates,42);assert.equal(back.player.decoys,2);assert.equal(back.player.mines,4);
 const forge=f=>{const raw=JSON.parse(g.serialize());f(raw.data);return Game.restore(JSON.stringify(raw));};
 assert.equal(forge(d=>{d.decoy.hp=99;}),null,'a decoy tougher than any decoy');
 assert.equal(forge(d=>{d.mines.push({id:'x',x:1,y:1,seen:[]},{id:'y',x:2,y:1,seen:[]},{id:'z',x:3,y:1,seen:[]});}),null,'four mines');
 assert.equal(forge(d=>{d.player.exoPlates=80;}),null,'more plates than the frame has');
 assert.equal(forge(d=>{d.player.wearables=[];}),null,'plates with no frame');
 const legacy=JSON.parse(g.serialize());legacy.version=65;
 for(const k of ['decoys','mines','exoPlates'])delete legacy.data.player[k];
 legacy.data.player.wearables=[];delete legacy.data.decoy;delete legacy.data.mines;delete legacy.data.mineSerial;
 const old=Game.restore(JSON.stringify(legacy));assert.ok(old);
 assert.deepEqual([old.player.decoys,old.player.mines,old.player.exoPlates,old.decoy,old.mines.length,old.mineSerial],[0,0,0,null,0,0]);
});
