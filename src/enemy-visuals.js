// Enemy appearance and interface lookups (3.77.1, Claude; docs/ENEMY_DATA.md 4.5). Only presentation reads these;
// rules keep reading enemy-data.js. Missing fields fall back to the type's own sprite and a humanoid drawing.
import {enemyDef} from './enemy-data.js';
import {factionDef,enemyFaction,factionOverride} from './factions.js';

// Atlas cell order is the image layout: append only, never reorder.
export const SPRITE_NAMES=Object.freeze(['player','rifleman','raider','sniper','brute','drone','warden','boss','crawler','bomber','cover','barrel','med','ammo','grenade','terminal','civilian','spitter']);
export const AFTERMATH_NAMES=Object.freeze(['dead-player','dead-rifleman','dead-raider','dead-sniper','dead-brute','dead-drone','dead-warden','dead-boss','dead-crawler','dead-bomber','muzzle','bullet','plasma','slash','claw','impact','dead-civilian','dead-spitter']);
// Tone role per atlas cell (3.82.1): props are dimmed, actors brightened. Keyed by name, so cells appended after the
// original sixteen (civilian) keep the actor tone; the original cells map exactly as the old index<10 rule did.
export const PROP_SPRITE_NAMES=Object.freeze(['cover','barrel','med','ammo','grenade','terminal']);
export const spriteToneRole=name=>PROP_SPRITE_NAMES.includes(name)?'prop':'unit';
export const DRAWING_SHAPES=Object.freeze(['humanoid','critter','drone']);
export const ENEMY_PROJECTILES=Object.freeze(['melee','rifle','smg','shotgun','sniper','plasma','venom']);

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

// Faction reskins and elites (3.79.1; docs/FACTION_DATA.md 9, docs/ELITE_ENEMIES.md 3). A faction override tint wins over
// the card tint; legacy and plain cards have none, so they draw exactly as before. Elites keep their colours and gain a
// gold outline, and a display-only label that is not a trait. Corpses use a dimmer gold so the ring fades with the body (3.80.1).
export const ELITE_VISUAL=Object.freeze({outline:'#f2c45a',corpseOutline:'#8f7438',label:'精英'});
// Display-only tag for units that never fight (civilians, 3.82.1); like the elite label it is not a trait.
export const NONCOMBATANT_LABEL='非戰鬥人員';
export const enemyTint=e=>factionOverride(e).tint??enemyDef(e)?.sprite?.tint??null;
export const factionTag=e=>{const d=factionDef(enemyFaction(e));return d?.tag?d.name:'';};
