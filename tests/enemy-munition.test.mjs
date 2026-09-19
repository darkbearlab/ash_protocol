import test from 'node:test';
import assert from 'node:assert/strict';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';
import {ENEMY_TYPES} from '../src/data.js';
import {ENEMY_AFFIXES,AFFIX_TUNING,deployerChance} from '../src/enemy-affixes.js';
import {distance} from '../src/world.js';

const STRIKE=ENEMY_TYPES.munition.range;
// A launcher far enough away that the munition has room to appear between it and the player.
function scene(){
 const g=affixArena(),p=g.player;
 const e=sceneEnemy(g,'rifleman',['deployer'],p.x+AFFIX_TUNING.deployerRange,p.y);
 e.alert=true;e.lastKnown={x:p.x,y:p.y};
 return {g,p,e};
}
const munitions=g=>g.enemies.filter(e=>e.type==='munition'&&e.hp>0);

test('投放 only lands on enemies that already fight at range',()=>{
 const def=ENEMY_AFFIXES.find(a=>a.id==='deployer');
 assert.ok(def.special,'must stay out of the ordinary affix pool');
 for(const type of ['rifleman','sniper','gunner'])assert.ok(def.applies({type,traits:[],tags:ENEMY_TYPES[type].tags}));
 for(const type of ['raider','raider_armored','civilian','bomber'])assert.equal(Boolean(def.applies({type,traits:[],tags:ENEMY_TYPES[type].tags})),false);
 // 3.137.0: from depth 8 on easy (as before), 7 on standard.
 assert.equal(deployerChance(7,{curve:'easy',offset:0}),0);assert.ok(deployerChance(8,{curve:'easy',offset:0})>0);
 assert.equal(deployerChance(6),0);assert.ok(deployerChance(7)>0&&deployerChance(20)<=AFFIX_TUNING.deployerCap);
});

test('the launch puts the munition at exactly strike range, in sight of the player',()=>{
 const {g,p,e}=scene();
 g.rng=()=>0; // the branch rolls for the launch; take it this turn
 g.enemyAct(e);
 const [m]=munitions(g);
 assert.ok(m,'a munition should have been launched');
 assert.equal(distance(m,p),STRIKE);
 assert.ok(g.visible(m),'the player must be able to see it appear');
 assert.equal(e.munitionSpent,true);
 assert.ok(e.affixes.find(a=>a.id==='deployer').revealed,'launching reveals the affix');
 // One each: a second turn does not produce a second munition.
 g.turn++;g.enemyAct(e);
 assert.equal(munitions(g).length,1);
});

test('it hovers the turn it appears, then hooks in and detonates',()=>{
 const {g,p,e}=scene();
 g.rng=()=>0;g.enemyAct(e);
 const [m]=munitions(g);
 const hp=p.hp;
 g.enemyAct(m);
 assert.equal(distance(m,p),STRIKE,'no strike on the turn it arrived');
 assert.equal(p.hp,hp);
 g.turn++;
 g.enemyAct(m);
 assert.equal(m.hp,0,'it destroys itself in the blast');
 assert.ok(p.hp<hp,'standing still costs health');
});

test('stepping out of its reach buys the turn back',()=>{
 const {g,p,e}=scene();
 g.rng=()=>0;g.enemyAct(e);
 const [m]=munitions(g);
 const hp=p.hp;
 g.turn++;
 // Step directly away from it; one tile is enough because it lands at exactly its range.
 p.x-=Math.sign(m.x-p.x)||1;
 g.enemyAct(m);
 assert.ok(m.hp>0,'it must not strike from outside its range');
 assert.equal(p.hp,hp);
 assert.ok(distance(m,p)>STRIKE||m.moved,'it should close the distance instead');
});

test('shooting it down sets it off where it stands, out of reach of the player',()=>{
 const {g,p,e}=scene();
 g.rng=()=>0;g.enemyAct(e);
 const [m]=munitions(g);
 const hp=p.hp;
 assert.ok(m.maxHp<=12,'it has to die to a single solid hit');
 g.hurt(m,m.maxHp,p);
 assert.equal(m.hp,0);
 assert.equal(p.hp,hp,'at strike range the blast cannot reach the player');
});

test('the munition is only visible from inside its own hook range',()=>{
 assert.equal(ENEMY_TYPES.munition.revealRange,ENEMY_TYPES.munition.range,'seen exactly when it can reach you');
 const {g,p,e}=scene();
 g.rng=()=>0;g.enemyAct(e);
 const [m]=munitions(g);
 assert.equal(distance(m,p),STRIKE);
 assert.ok(g.visible(m),'it shows itself the moment it arrives');
 assert.ok(g.visibleEnemies.includes(m));
 // One step back and it is gone: no sprite, no target, no exposure count.
 p.x-=Math.sign(m.x-p.x)||1;
 assert.ok(distance(m,p)>STRIKE);
 assert.equal(g.visible(m),false);
 assert.equal(g.visibleEnemies.includes(m),false);
 assert.equal(g.teamVisible(m),false);
 // The launcher itself has no reveal range, so it stays visible at the same distance.
 assert.ok(g.visible(e));
});
