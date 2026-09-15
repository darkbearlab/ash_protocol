import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE,ENEMY_TYPES} from '../src/data.js';
import {makeEnemy,distance} from '../src/world.js';
import {ENEMY_UNIT_TUNING,allyWeapon,allyAct,allySkillState,departAllies,validAllies} from '../src/allies.js';
import {UNIT_BLUEPRINTS,ENEMY_BLUEPRINTS,deployedUnits,bomberAct} from '../src/workshop.js';
import {FACTIONS,factionPool} from '../src/faction-catalog.js';

// Enemy blueprints, engineer workshop phase 4 (docs/ENGINEER.md 4.2, 3.94.0).
function arena(character='engineer'){
 const g=new Game(330,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['allies','enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);g.allySerial=0;g.player.petBond=null;Object.assign(g.player,{x:10,y:10,hp:500,maxHp:500});g.start={x:5,y:5};g.end={x:20,y:20};g.enemyAct=()=>{};g.reveal();return g;
}
const enemy=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'foe-'+g.enemies.length);e.hp=e.maxHp=500;g.enemies.push(e);return e;};
const zero=g=>g.rng=Object.assign(()=>0,{state:()=>1});
const acquired=g=>g.logs.filter(l=>l.text.startsWith('取得藍圖')).length;
// Deploys a unit of an acquired enemy blueprint from a line (one paid turn); it may act from the next turn.
const unit=(g,blueprint,point={x:11,y:10})=>{g.player.blueprints=[...new Set([...g.player.blueprints,blueprint])];g.player.productionLines=[{blueprint}];assert.ok(g.action('deployUnit',{line:0,...point}));const a=g.allies.find(x=>x.sourceId===blueprint);a.bornTurn=1;return a;};
const blastDamage=ENEMY_UNIT_TUNING.bomber.damage-10; // explode() takes 10 per tile from the centre.

test('destroying a drone or a suicide bot gives the engineer that blueprint once; other classes and self-destructs give none',()=>{
 const g=arena(),p=g.player;assert.deepEqual(p.blueprints,[]);
 const d=enemy(g,14,10,'drone');g.hurt(d,d.hp,p);assert.deepEqual(p.blueprints,['unit_drone']);assert.equal(acquired(g),1);assert.match(g.logs.map(l=>l.text).join('\n'),/取得藍圖：改造無人機/);
 const again=enemy(g,14,13,'drone');g.hurt(again,again.hp,null);assert.deepEqual(p.blueprints,['unit_drone']);assert.equal(acquired(g),1);
 const self=enemy(g,14,16,'bomber_bot');g.hurt(self,self.hp,self);assert.deepEqual(p.blueprints,['unit_drone']);
 const blown=enemy(g,4,16,'bomber_bot');g.hurt(blown,blown.hp,null);assert.deepEqual(p.blueprints,['unit_drone','unit_bomber']);assert.equal(acquired(g),2);
 assert.ok(Game.restore(g.serialize()));
 const s=arena('soldier'),e=enemy(s,14,10,'drone');s.hurt(e,e.hp,s.player);assert.deepEqual(s.player.blueprints,[]);assert.equal(acquired(s),0);
});

test('an enemy suicide bot that primes and blows itself up leaves no blueprint',()=>{
 const g=arena(),p=g.player;delete g.enemyAct;const e=makeEnemy('bomber_bot',11,10,'foe-0');e.alert=true;g.enemies.push(e);g.reveal();
 for(let i=0;i<5&&e.hp>0;i++)assert.ok(g.action('wait'));
 assert.ok(e.hp<=0);assert.ok(p.hp<500);assert.deepEqual(p.blueprints,[]);
});

test('swarm floors field no blueprint source; the human factions field drones, and only rebels field suicide bots',()=>{
 const types=id=>{const f=FACTIONS[id];return new Set([...Array.from({length:12},(_,i)=>factionPool(id,i+1)).flat(),...Object.values(f.bosses),f.scout,...f.retreatWave,f.fodder,f.nestChild].filter(Boolean));};
 const sources=id=>[...types(id)].filter(t=>Object.hasOwn(ENEMY_BLUEPRINTS,t)).sort();
 assert.deepEqual(sources('swarm'),[]);assert.deepEqual(sources('legacy'),['drone']);assert.deepEqual(sources('loyalist'),['drone']);assert.deepEqual(sources('rebel'),['bomber_bot','drone']);
 const g=arena(),p=g.player;
 for(const [i,type] of [...types('swarm')].entries()){const e=enemy(g,2+2*(i%8),2+2*Math.floor(i/8),type);g.hurt(e,e.hp,p);}
 assert.deepEqual(p.blueprints,[]);assert.equal(acquired(g),0);
});

test('enemy blueprints can be built only once acquired, carry no weapon or payload, and saves check the acquired list',()=>{
 const g=arena(),p=g.player;p.productionLines=[];p.scrap=200;
 assert.equal(g.action('buildUnit',{blueprint:'unit_drone'}),false);assert.match(g.logs[0].text,new RegExp(`尚未取得藍圖.*${ENEMY_TYPES.drone.name}`));assert.equal(g.turn,1);
 p.blueprints=['unit_drone','unit_bomber'];
 assert.equal(g.action('buildUnit',{blueprint:'unit_drone',weapon:p.owned[0]}),false);assert.match(g.logs[0].text,/不能裝武器/);
 assert.equal(g.action('buildUnit',{blueprint:'unit_bomber',payload:'frag'}),false);assert.equal(g.turn,1);
 assert.ok(g.action('buildUnit',{blueprint:'unit_drone'}));assert.equal(p.scrap,200-UNIT_BLUEPRINTS.unit_drone.cost);assert.deepEqual(p.productionLines,[{blueprint:'unit_drone'}]);assert.ok(Game.restore(g.serialize()));
 for(const change of [d=>d.player.blueprints=['unit_bomber'],d=>d.player.blueprints=['unit_drone','unit_drone'],d=>d.player.blueprints=['drone_follow','unit_drone'],d=>d.player.blueprints='unit_drone',d=>d.player.blueprints=['constructor'],d=>d.player.productionLines=[{blueprint:'unit_drone',weapon:99}]]){
  const raw=JSON.parse(g.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
 p.productionLines=[];assert.ok(g.action('buildUnit',{blueprint:'unit_bomber'}));assert.deepEqual(p.productionLines,[{blueprint:'unit_bomber'}]);assert.ok(Game.restore(g.serialize()));
 const soldier=JSON.parse(arena('soldier').serialize());soldier.data.player.blueprints=['unit_drone'];assert.equal(Game.restore(JSON.stringify(soldier)),null);
 const old=JSON.parse(arena().serialize());delete old.data.player.blueprints;old.version=48;const restored=Game.restore(JSON.stringify(old));assert.ok(restored);assert.deepEqual(restored.player.blueprints,[]);
});

test('the modified drone flies without cover, loads energy cells, fires its plasma gun and chases enemies inside the tether',()=>{
 const g=arena(),p=g.player,energy=p.energy,a=unit(g,'unit_drone'),t=ENEMY_UNIT_TUNING.drone;
 assert.equal(a.type,'drone');assert.equal(a.maxHp,t.hp);assert.equal(a.hp,t.hp);assert.ok(a.traits.some(x=>x.id==='no_cover'));
 const w=allyWeapon(a,p);assert.equal(w.ammoType,'energy');assert.equal(w.range,t.range);assert.equal(w.min,t.damage);assert.equal(a.ammo,t.mag);assert.equal(p.energy,energy-t.mag);
 assert.equal(deployedUnits(g).length,1);assert.ok(validAllies(g));assert.ok(Game.restore(g.serialize()));
 const e=enemy(g,11,14);zero(g);g.reveal();
 allyAct(g,a);assert.ok(e.hp<500);assert.equal(a.ammo,t.mag-1);assert.ok(g.effects.some(x=>x.type==='shot'&&x.style==='plasma'));
 // Out of range 5 from the drone (7 tiles) but inside the tether from the player (6 tiles, Manhattan distance).
 const h=arena(),b=unit(h,'unit_drone'),far=enemy(h,9,15);h.reveal();const before=distance(b,far);
 allyAct(h,b);assert.ok(b.moved);assert.ok(distance(b,far)<before);assert.equal(far.hp,500);
 const saved=JSON.parse(h.serialize());saved.data.allies[0].weapon=1;assert.equal(Game.restore(JSON.stringify(saved)),null);
});

test('the modified suicide bot walks up, primes beside an enemy and explodes on its next action; it is outside the deploy limit',()=>{
 const g=arena(),p=g.player,a=unit(g,'unit_bomber');
 assert.equal(a.type,'bomber_bot');assert.equal(a.maxHp,ENEMY_UNIT_TUNING.bomber.hp);assert.ok(!a.traits.some(x=>x.id==='no_cover'));assert.equal(a.ammo,0);
 assert.equal(deployedUnits(g).length,0);assert.equal(allySkillState(g,'workshop'),'序列 0/1 · 部署 0/1');
 p.x=3;const e=enemy(g,14,10);g.reveal();
 assert.ok(bomberAct(g,a));assert.deepEqual([a.x,a.y],[12,10]);assert.equal(a.primed,undefined);
 assert.ok(bomberAct(g,a));assert.equal(distance(a,e),1);assert.equal(a.primed,undefined);
 assert.ok(bomberAct(g,a));assert.equal(a.primed,true);assert.equal(e.hp,500);assert.match(g.logs[0].text,/蓄勢/);
 const saved=Game.restore(g.serialize());assert.ok(saved);assert.equal(saved.allies.find(x=>x.sourceId==='unit_bomber').primed,true);
 assert.ok(bomberAct(g,a));assert.ok(!g.allies.includes(a));assert.equal(e.hp,500-blastDamage);assert.equal(p.hp,500);assert.ok(Game.restore(g.serialize()));
});

test('a suicide bot destroyed by damage still explodes, the player is not protected, and it never swaps, follows between floors or loads a bad save',()=>{
 const g=arena(),p=g.player,a=unit(g,'unit_bomber'),e=enemy(g,12,10);g.reveal();
 g.damageAlly(a,999);assert.equal(a.status,'destroyed');assert.equal(a.primed,undefined);assert.equal(e.hp,500-blastDamage);assert.ok(p.hp<500);assert.ok(validAllies(g));assert.ok(Game.restore(g.serialize()));
 const h=arena(),b=unit(h,'unit_bomber');
 assert.equal(h.action('move',[1,0]),false);assert.match(h.logs[0].text,/改造自爆機器人不會和你換位/);assert.ok(!departAllies(h).includes(b.id));
 h.player.x=3;h.reveal();assert.ok(bomberAct(h,b));assert.equal(distance(b,h.player),7);
 h.player.x=b.x-1;assert.equal(bomberAct(h,b),false);
 for(const change of [d=>d.allies[0].primed=false,d=>d.allies[0].type='drone',d=>d.allies[0].payload='frag',d=>Object.assign(d.allies[0],{sourceId:'unit_drone',type:'drone',primed:true}),d=>d.player.blueprints=[]]){
  const raw=JSON.parse(h.serialize());change(raw.data);assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
});

test('the turn loop runs suicide bots: a primed bot explodes during a paid wait, and a drone it destroys gives that blueprint',()=>{
 const g=arena(),a=unit(g,'unit_bomber');g.player.x=3;const e=enemy(g,12,10),d=enemy(g,11,11,'drone');d.hp=5;g.reveal();
 a.primed=true;assert.ok(g.action('wait'));assert.ok(!g.allies.includes(a));assert.equal(e.hp,500-blastDamage);assert.ok(d.hp<=0);
 assert.deepEqual(g.player.blueprints,['unit_bomber','unit_drone']);assert.ok(Game.restore(g.serialize()));
});

test('an EMP cancels a primed suicide bot: it sits out the disable, then primes again instead of exploding',()=>{
 const g=arena(),a=unit(g,'unit_bomber');g.player.x=3;const e=enemy(g,12,10);g.reveal();
 a.primed=true;g.applyThrowable('emp',{x:a.x,y:a.y},0,null);assert.ok(a.control.disabled>0);assert.equal(a.primed,undefined);assert.ok(Game.restore(g.serialize()));
 for(let i=0;i<10&&a.control.disabled>0;i++){assert.ok(g.action('wait'));assert.ok(g.allies.includes(a));assert.equal(e.hp,500);}
 assert.ok(g.action('wait'));assert.ok(g.allies.includes(a));assert.equal(a.primed,true);assert.equal(e.hp,500);
});

test('an enemy killed by a suicide bot blast during its own attack does not act further (no warden reinforcements)',()=>{
 const g=arena(),a=unit(g,'unit_bomber');g.player.x=3;a.hp=1;zero(g);
 const w=makeEnemy('warden',12,10,'foe-w');w.hp=5;Object.assign(w,{alert:true,charge:true,windup:1,aim:{x:a.x,y:a.y},focusTarget:a.id});g.enemies.push(w);g.reveal();
 g.executeEnemy(w);assert.equal(a.status,'destroyed');assert.ok(w.hp<=0);assert.equal(g.enemies.length,1);
});
