import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {projectileVisuals,WEAPON_VISUALS} from '../src/presentation.js';
import {TONGUE_VISUAL,VENOM_VISUAL} from '../src/enemy-visuals.js';
import {targetDetails} from '../src/target-card.js';
import {Renderer} from '../src/renderer.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';

// Presentation for the 3.84.0 swarm rules (docs/SWARM.md 8): venom shots, the tongue telegraph and the pull.

test('venom shots keep their own projectile style instead of a bullet',()=>{
 assert.equal(WEAPON_VISUALS.venom.style,'venom');
 const shots=projectileVisuals({type:'enemyShot',attackerType:'spitter',style:'venom',from:{x:1,y:1},to:{x:4,y:1},damage:0});
 assert.ok(shots.length>0&&shots.every(s=>s.style==='venom'));
 assert.ok(Object.values(VENOM_VISUAL).every(color=>/^#[0-9a-f]{6}$/i.test(color)));
});

test('the target card warns about a tongue wind-up; real mode hides the state row',()=>{
 const g=affixArena(),boss=sceneEnemy(g,'hive_beast');assert.ok(!targetDetails(g).state.includes(TONGUE_VISUAL.label));
 boss.tongueIntent={origin:{x:boss.x,y:boss.y},target:{x:g.player.x,y:g.player.y},point:{x:boss.x+1,y:boss.y}};
 assert.ok(targetDetails(g).state.includes(TONGUE_VISUAL.label));
 const raw=JSON.parse(affixArena().serialize());raw.data.realMode=true;
 const real=Game.restore(JSON.stringify(raw)),other=sceneEnemy(real,'hive_beast');
 other.tongueIntent={origin:{x:other.x,y:other.y},target:{x:real.player.x,y:real.player.y},point:{x:other.x+1,y:other.y}};
 assert.equal(targetDetails(real).state,'');
});

// The effects loop sits inside the frame render, which needs a canvas; the browser check covers the pixels. This guards
// the dispatch order: an unhandled tongue effect or venom shot would fall through to the generic bullet branch.
test('tongue and venom effects are handled before the generic projectile branch, and the telegraph reads the rules',()=>{
 const source=Renderer.toString(),at=s=>source.indexOf(s);
 const generic=at("fx.style==='claw'||fx.style==='slash'");
 for(const branch of ["fx.type==='tongueTelegraph'","fx.type==='tonguePull'","fx.style==='venom'"]){assert.ok(at(branch)>0,branch);assert.ok(at(branch)<generic,branch);}
 assert.ok(at('tongueTelegraphs(g)')>0);
});
