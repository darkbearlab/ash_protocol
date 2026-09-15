import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {makeEnemy,distance} from '../src/world.js';
import {ENEMY_UNIT_TUNING,allyWeapon,allyAct,bombardDamage,departAllies} from '../src/allies.js';
import {BOSS_DISRUPT_TURNS} from '../src/throwables.js';
import {UNIT_BLUEPRINTS,deployedUnits} from '../src/workshop.js';
import {FACTIONS} from '../src/faction-catalog.js';

// Boss blueprints, engineer workshop phase 5 (docs/ENGINEER.md 4.2, 3.95.0).
function arena(character='engineer'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.enemyAct=()=>{};g.reveal();return g;
}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});
// Deploys a unit of an acquired (and, for boss blueprints, built) blueprint from a line; it may act from the next turn.
const unit=(g,blueprint,point={x:11,y:10})=>{const p=g.player;p.blueprints=[...new Set([...p.blueprints,blueprint])];if(UNIT_BLUEPRINTS[blueprint].once)p.usedBlueprints=[...new Set([...p.usedBlueprints,blueprint])];p.productionLines=[{blueprint}];assert.ok(g.action('deployUnit',{line:0,...point}));const a=g.allies.find(x=>x.sourceId===blueprint);a.bornTurn=1;return a;};

test('destroying a warden or a core guard gives its boss blueprint; swarm bosses give none',()=>{
 const g=arena(),p=g.player;
 const w=enemy(g,14,10,'warden');g.hurt(w,w.hp,p);const b=enemy(g,14,15,'boss');g.hurt(b,b.hp,null);
 assert.deepEqual(p.blueprints,['unit_warden','unit_boss']);assert.deepEqual(p.usedBlueprints,[]);
 for(const [i,type] of Object.values(FACTIONS.swarm.bosses).entries()){const e=enemy(g,3,4+5*i,type);g.hurt(e,e.hp,p);}
 assert.deepEqual(p.blueprints,['unit_warden','unit_boss']);assert.ok(Game.restore(g.serialize()));
});

test('boss blueprints cost scrap only, take no weapon, can be built once per run, and saves track the built ones',()=>{
 const g=arena(),p=g.player;p.productionLines=[];p.scrap=600;p.blueprints=['unit_warden','unit_boss'];const pistol=p.pistol,energy=p.energy;
 assert.equal(g.action('buildUnit',{blueprint:'unit_warden',weapon:p.owned[0]}),false);assert.match(g.logs[0].text,/不能裝武器/);assert.equal(g.turn,1);
 assert.ok(g.action('buildUnit',{blueprint:'unit_warden'}));assert.equal(p.scrap,600-UNIT_BLUEPRINTS.unit_warden.cost);assert.deepEqual(p.usedBlueprints,['unit_warden']);assert.equal(p.pistol,pistol);assert.equal(p.energy,energy);assert.ok(Game.restore(g.serialize()));
 for(const change of [d=>d.player.usedBlueprints=[],d=>d.player.usedBlueprints=['unit_warden','unit_warden'],d=>d.player.usedBlueprints=['unit_warden','unit_drone'],d=>d.player.usedBlueprints='unit_warden',d=>d.player.blueprints=['unit_boss']]){
  const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 assert.ok(g.action('deployUnit',{line:0}));const deployed=JSON.parse(g.serialize());deployed.data.player.productionLines=[{blueprint:'unit_warden'}];assert.equal(Game.restore(JSON.stringify(deployed)),null);
 g.allies=[];assert.ok(Game.restore(g.serialize()));
 assert.equal(g.action('buildUnit',{blueprint:'unit_warden'}),false);assert.match(g.logs[0].text,/只能製作一次/);assert.deepEqual(p.productionLines,[]);
 const old=JSON.parse(arena().serialize());delete old.data.player.usedBlueprints;old.version=49;const restored=Game.restore(JSON.stringify(old));assert.ok(restored);assert.deepEqual(restored.player.usedBlueprints,[]);
});

test('the modified warden charges one action before each shot, needs no ammunition, and loses its charge without a target or to an EMP',()=>{
 const g=arena(),p=g.player,a=unit(g,'unit_warden'),t=ENEMY_UNIT_TUNING.warden;
 assert.equal(a.type,'warden');assert.equal(a.maxHp,t.hp);assert.equal(a.armor,t.armor);assert.ok(!a.traits.some(x=>x.id==='no_cover'));assert.equal(a.ammo,0);
 const w=allyWeapon(a,p);assert.equal(w.mag,0);assert.equal(w.range,t.range);assert.equal(w.min,t.damage);assert.equal(deployedUnits(g).length,1);assert.ok(Game.restore(g.serialize()));
 const e=enemy(g,11,14);zero(g);g.reveal();
 allyAct(g,a);assert.equal(a.primed,true);assert.equal(e.hp,500);assert.match(g.logs[0].text,/蓄力/);assert.ok(Game.restore(g.serialize()));
 allyAct(g,a);assert.equal(a.primed,undefined);assert.ok(e.hp<500);assert.equal(a.ammo,0);
 allyAct(g,a);assert.equal(a.primed,true);g.enemies=[];allyAct(g,a);assert.equal(a.primed,undefined);
 const h=arena(),b=unit(h,'unit_warden');enemy(h,11,14);zero(h);h.reveal();allyAct(h,b);assert.equal(b.primed,true);
 h.applyThrowable('emp',{x:b.x,y:b.y},0,null);assert.ok(b.control.disabled>0);assert.equal(b.primed,undefined);
 // It hunts inside the tether: 7 tiles from the unit, 6 from the player.
 const k=arena(),c=unit(k,'unit_warden'),far=enemy(k,10,4);k.reveal();const before=distance(c,far);allyAct(k,c);assert.ok(c.moved);assert.ok(distance(c,far)<before);
});

test('the modified core guard alternates a shot with a bombardment mark that explodes two actions later',()=>{
 const g=arena(),p=g.player,a=unit(g,'unit_boss'),t=ENEMY_UNIT_TUNING.boss;
 assert.equal(a.type,'boss');assert.equal(a.maxHp,t.hp);assert.equal(a.armor,t.armor);assert.equal(allyWeapon(a,p).min,t.damage);
 const e=enemy(g,11,14);zero(g);g.reveal();
 allyAct(g,a);assert.ok(e.hp<500);assert.equal(a.bombard,true);assert.equal(g.marks.length,0);
 const hp=e.hp;allyAct(g,a);assert.equal(e.hp,hp);assert.equal(a.bombard,undefined);
 assert.deepEqual(g.marks.map(m=>[m.kind,m.sourceId,m.x,m.y,m.radius,m.damage,m.due]),[['ally',a.id,11,14,1,bombardDamage(p),g.turn+2]]);assert.ok(Game.restore(g.serialize()));
 allyAct(g,a);assert.ok(e.hp<hp);assert.equal(a.bombard,true);assert.equal(g.marks.length,1);
 // An enemy beside the unit is shot instead, and the bombardment stays pending.
 const h=arena(),b=unit(h,'unit_boss'),near=enemy(h,12,10);zero(h);h.reveal();b.bombard=true;allyAct(h,b);assert.equal(h.marks.length,0);assert.ok(near.hp<500);assert.equal(b.bombard,true);
 // The mark resolves at the end of a later round, like the enemy core guard's.
 const k=arena(),c=unit(k,'unit_boss'),far=enemy(k,11,14);zero(k);k.reveal();c.bombard=true;
 assert.ok(k.action('wait'));assert.equal(k.marks.length,1);k.allies=[];const before=far.hp;
 for(let i=0;i<4&&k.marks.length;i++)assert.ok(k.action('wait'));
 assert.equal(k.marks.length,0);assert.equal(far.hp,before-bombardDamage(k.player));assert.equal(k.player.hp,500);
});

test('saves reject a misplaced charge, bombardment or allied mark, and wrecks lose their charge',()=>{
 const g=arena(),a=unit(g,'unit_warden');a.primed=true;assert.ok(Game.restore(g.serialize()));
 const mark=(d,extra)=>d.marks=[{kind:'ally',sourceId:'ally-1',x:12,y:12,radius:1,damage:40,due:d.turn+1,...extra}];
 for(const change of [d=>d.allies[0].primed=false,d=>d.allies[0].bombard=true,d=>mark(d,{damage:0}),d=>mark(d,{radius:2}),d=>mark(d,{sourceId:'foe-1'}),d=>mark(d,{due:d.turn+3})]){
  const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 const ok=JSON.parse(g.serialize());mark(ok.data,{});assert.ok(Game.restore(JSON.stringify(ok)));
 g.damageAlly(a,999);assert.equal(a.status,'destroyed');assert.equal(a.primed,undefined);assert.ok(Game.restore(g.serialize()));
 const h=arena(),b=unit(h,'unit_boss');b.bombard=true;assert.ok(Game.restore(h.serialize()));
 const raw=JSON.parse(h.serialize());raw.data.allies[0].primed=true;assert.equal(Game.restore(JSON.stringify(raw)),null);
 h.damageAlly(b,999);assert.equal(b.bombard,undefined);assert.ok(Game.restore(h.serialize()));
});

test('a warden loses its charge when it changes floors or trades places, and boss chassis sit out the boss EMP count',()=>{
 const g=arena(),a=unit(g,'unit_warden');a.primed=true;
 departAllies(g);assert.equal(a.primed,undefined);
 a.primed=true;assert.ok(g.action('move',[1,0]));assert.equal(a.primed,undefined);assert.ok(Game.restore(g.serialize()));
 const h=arena(),b=unit(h,'unit_boss');h.applyThrowable('emp',{x:b.x,y:b.y},0,null);assert.equal(b.control.disabled,BOSS_DISRUPT_TURNS);
});
