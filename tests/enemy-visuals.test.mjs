import test from 'node:test';
import assert from 'node:assert/strict';
import {ENEMY_TYPES} from '../src/engine.js';
import {TRAITS} from '../src/traits.js';
import {unitTree} from '../src/behavior-tree.js';
import {calloutVoice} from '../src/callout-ui.js';
import {projectileVisuals,WEAPON_VISUALS} from '../src/presentation.js';
import {SPRITE_NAMES,AFTERMATH_NAMES,DRAWING_SHAPES,ENEMY_PROJECTILES,enemySprite,enemyDrawing,enemyProjectile,enemyMeleeStyle,enemyGlyph,enemyVoice,floorTraitNote} from '../src/enemy-visuals.js';

// The hard-coded mappings as they stood in 3.77.0 (renderer, presentation, controller, callout-ui, enemy-behavior).
const OLD={
 sprite:id=>id==='gunner'||id==='fodder'?'rifleman':id==='brood'?'crawler':id,
 size:id=>id==='brood'?.65:id==='fodder'?.8:1,
 scale:id=>id==='boss'||id==='warden'?1.15:1,
 corpse:id=>({fodder:'rifleman',brood:'crawler',gunner:'rifleman'})[id]||id,
 critter:id=>id==='crawler'||id==='bomber',
 heavy:id=>id==='brute'||id==='boss'||id==='warden',
 projectile:{fodder:'melee',brood:'melee',rifleman:'rifle',raider:'smg',gunner:'shotgun',sniper:'sniper',drone:'plasma',warden:'plasma',boss:'plasma',crawler:'melee',brute:'melee'},
 casing:{rifleman:'rifle',raider:'pistol',gunner:'shell',sniper:'rifle'},
 glyph:id=>id==='boss'?'Ω':id==='drone'?'◇':'!',
 creature:new Set(['fodder','brood','crawler','bomber']),
};

test('appearance data reproduces every pre-migration visual mapping',()=>{
 for(const id of [...Object.keys(OLD.projectile),'bomber']){
  const look=enemySprite(id),drawing=enemyDrawing(id);
  assert.deepEqual([look.key,look.size,look.scale,look.corpse],[OLD.sprite(id),OLD.size(id),OLD.scale(id),OLD.corpse(id)],id);
  assert.equal(drawing.shape==='critter',OLD.critter(id),id);assert.equal(drawing.shape==='drone',id==='drone',id);
  assert.equal(Boolean(drawing.heavy),OLD.heavy(id),id);assert.equal(Boolean(drawing.longBarrel),id==='sniper',id);
  if(OLD.critter(id)){assert.equal(drawing.color,id==='bomber'?'#aabb71':'#ba966d',id);assert.equal(drawing.glow,id==='bomber'?'#e9d24c33':undefined,id);}
  assert.equal(enemyProjectile(id),OLD.projectile[id],id);assert.equal(enemyMeleeStyle(id),id==='crawler'?'claw':'slash',id);
  assert.equal(ENEMY_TYPES[id].casing,OLD.casing[id],id);assert.equal(enemyGlyph(id),OLD.glyph(id),id);
  assert.equal(floorTraitNote(id,TRAITS),id==='crawler'?'（第 4 層起：快速）':'',id);
  assert.equal(enemyVoice(id)==='creature',OLD.creature.has(id),id);
  assert.equal(calloutVoice({visibility:'visible',enemyType:id}),ENEMY_TYPES[id].mechanical?'machine':OLD.creature.has(id)?'creature':'human',id);
 }
 assert.deepEqual(Object.keys(ENEMY_TYPES).filter(id=>unitTree({type:id}).fixedTile),['sniper'],'the sniper countdown, aim line and threat check follow fixed-tile trees');
});

test('appearance data only names atlas cells, shapes and projectiles that exist',()=>{
 for(const [id,d] of Object.entries(ENEMY_TYPES)){
  const look=enemySprite(id);
  assert.ok(SPRITE_NAMES.includes(look.key),id);assert.ok(AFTERMATH_NAMES.includes(`dead-${look.corpse}`),id);
  assert.ok(look.size>0&&look.scale>0,id);assert.ok(DRAWING_SHAPES.includes(enemyDrawing(id).shape),id);
  if(d.projectile!==undefined)assert.ok(ENEMY_PROJECTILES.includes(d.projectile)&&WEAPON_VISUALS[d.projectile],id);
  if(d.glyph!==undefined)assert.equal([...d.glyph].length,1,id);
  if(d.voice!==undefined)assert.ok(d.tags.includes('noncombatant')?d.voice==='civilian':['creature','infected'].includes(d.voice),id);
 }
 assert.equal(enemySprite('player').key,'player');assert.equal(enemyDrawing('player').shape,'humanoid');assert.equal(enemyGlyph('unknown'),'!');
});

test('enemy projectiles keep their visuals and the crawler still claws',()=>{
 const shot=type=>({type:'enemyShot',attackerType:type,from:{x:0,y:0},to:{x:3,y:0},damage:0});
 assert.equal(projectileVisuals(shot('crawler'))[0].style,'claw');assert.equal(projectileVisuals(shot('brute'))[0].style,'slash');
 assert.equal(projectileVisuals(shot('gunner')).length,5,'three tiles out, buckshot throws five pellets (3.185.0)');
 assert.equal(projectileVisuals(shot('bomber')).length,WEAPON_VISUALS.rifle.count,'a type without a projectile falls back to the rifle');
});
