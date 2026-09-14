// Enemy appearance and interface lookups (3.77.1, Claude; docs/ENEMY_DATA.md 4.5). Only presentation reads these;
// rules keep reading enemy-data.js. Missing fields fall back to the type's own sprite and a humanoid drawing.
import {enemyDef} from './enemy-data.js';

// Atlas cell order is the image layout: append only, never reorder.
export const SPRITE_NAMES=Object.freeze(['player','rifleman','raider','sniper','brute','drone','warden','boss','crawler','bomber','cover','barrel','med','ammo','grenade','terminal']);
export const AFTERMATH_NAMES=Object.freeze(['dead-player','dead-rifleman','dead-raider','dead-sniper','dead-brute','dead-drone','dead-warden','dead-boss','dead-crawler','dead-bomber','muzzle','bullet','plasma','slash','claw','impact']);
export const DRAWING_SHAPES=Object.freeze(['humanoid','critter','drone']);
export const ENEMY_PROJECTILES=Object.freeze(['melee','rifle','smg','shotgun','sniper','plasma']);

// key: atlas cell; corpse: aftermath cell (defaults to key); size: sprite multiplier; scale: fallback drawing scale.
export function enemySprite(type){const s=enemyDef(type)?.sprite||{},key=s.key||type;return {key,corpse:s.corpse||key,size:s.size??1,scale:s.scale??1};}
// Canvas fallback when the atlas is missing: shape plus optional colour, glow, shoulder plates and long barrel.
export const enemyDrawing=type=>({shape:'humanoid',...enemyDef(type)?.drawing});
export const enemyProjectile=type=>enemyDef(type)?.projectile;
export const enemyMeleeStyle=type=>enemyDef(type)?.attackStyle==='claw'?'claw':'slash';
export const enemyGlyph=type=>enemyDef(type)?.glyph||'!';
export const enemyVoice=type=>enemyDef(type)?.voice;
// Bestiary note for traits gained deeper, e.g. 「（第 4 層起：快速）」. TRAITS is passed in to keep this module rule-free.
export const floorTraitNote=(type,traits)=>(enemyDef(type)?.floorTraits||[]).map(t=>`（第 ${t.minFloor} 層起：${traits[t.id].name}）`).join('');
