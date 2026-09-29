import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mixin} from '../src/mixin.js';
import {Game} from '../src/game.js';
import {Renderer} from '../src/renderer.js';
import {familyFiles} from './helpers/source.mjs';

// 3.206.3: src/game.js and src/renderer.js keep their class; topic files hold the rest of its methods (src/mixin.js).
test('mixin copies methods, getters and statics the way class syntax defines them, and refuses a second definition',()=>{
 class Target{own(){return 'own';}}
 class Topic{get twice(){return this.n*2;}add(k){return this.n+k;}static make(n){const t=new Target();t.n=n;return t;}}
 mixin(Target,Topic);
 const t=Target.make(4);
 assert.equal(t.add(1),5);assert.equal(t.twice,8);assert.ok(t instanceof Target);
 for(const key of ['add','twice']){const d=Object.getOwnPropertyDescriptor(Target.prototype,key),own=Object.getOwnPropertyDescriptor(Target.prototype,'own');assert.equal(d.enumerable,false,key);assert.equal(d.configurable,own.configurable,key);}
 assert.equal(Object.getOwnPropertyDescriptor(Target.prototype,'add').writable,true);
 assert.equal(Object.getOwnPropertyDescriptor(Target,'make').enumerable,false);
 assert.deepEqual(Object.keys(t),['n'],'methods stay off for-in and Object.keys');
 class Clash{own(){}}
 assert.throws(()=>mixin(Target,Clash),/Target\.prototype\.own is defined twice/);
 class StaticClash{static make(){}}
 assert.throws(()=>mixin(Target,StaticClash),/Target\.make is defined twice/);
});

test('the split classes: every method on the prototype, none enumerable, Game.restore static',()=>{
 for(const [Class,names] of [[Game,['action','validateAction','fire','hurt','enemyAct','pickup','descend','serialize']],[Renderer,['draw','drawGround','drawTelegraphs','drawActors','drawTargeting','drawEffects','drawWalls','drawOverlays','actor','cloudField','drawMap','addEffects']]]){
  for(const name of names)assert.equal(typeof Object.getOwnPropertyDescriptor(Class.prototype,name)?.value,'function',`${Class.name}.${name}`);
  for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(Class.prototype)))assert.equal(d.enumerable,false,`${Class.name}.${key}`);
 }
 assert.equal(typeof Object.getOwnPropertyDescriptor(Game,'restore')?.value,'function');
 const g=new Game(3,[],0,'soldier','onyx');g.action('wait');
 assert.ok(Game.restore(g.serialize()) instanceof Game,'a save still loads through the static on Game');
});

test('each family is its entry and its topic files',()=>{
 assert.deepEqual(familyFiles('game'),['game.js','game-actions.js','game-attacks.js','game-damage.js','game-enemies.js','game-floors.js','game-items.js','game-save.js']);
 assert.deepEqual(familyFiles('renderer'),['renderer.js','renderer-actors.js','renderer-clouds.js','renderer-effects.js','renderer-map.js','renderer-telegraphs.js']);
 assert.deepEqual(familyFiles('controller'),['controller.js','controller-aim.js','controller-comms.js','controller-deploy.js','controller-hud.js','controller-pack.js','controller-screens.js','controller-settings.js']);
});

// The browser half of the proof (qa/render-snapshots.mjs) needs Chrome; without arguments it only prints its usage.
test('the render snapshot tool explains itself without starting a browser',()=>{
 const run=spawnSync(process.execPath,['qa/render-snapshots.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
 assert.equal(run.status,2);assert.match(run.stdout,/usage: node qa\/render-snapshots\.mjs --out <file>/);
});
