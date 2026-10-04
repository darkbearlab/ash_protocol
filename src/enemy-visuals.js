// Enemy appearance and interface lookups (3.77.1, Claude; docs/ENEMY_DATA.md 4.5). Only presentation reads these;
// rules keep reading enemy-data.js. Missing fields fall back to the type's own sprite and a humanoid drawing.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {factionDef,enemyFaction,factionOverride} from './factions.js';

// Atlas cell order is the image layout: append only, never reorder.
// 3.223.0: the units that used to borrow another's cell (docs/UNIT_SPRITES_HANDOFF.md; Codex's art, outlines cleaned by
// the user), appended in this order to both atlases by tools/append_units_v2.py.
export const UNIT_SPRITES_V2=Object.freeze(['designator','gunline','arsonist','burnline','hive_beast','hive_matriarch','dog','fodder','brood','giant_bug','turret','munition','bomber_bot','heavy_flamer','enforcer','squad_leader','gunner','rifleman_infected','raider_infected','pet','rifleman_armored','raider_armored']);
export const SPRITE_NAMES=Object.freeze(['player','rifleman','raider','sniper','brute','drone','warden','boss','crawler','bomber','cover','barrel','med','ammo','grenade','terminal','civilian','spitter',...UNIT_SPRITES_V2]);
export const AFTERMATH_NAMES=Object.freeze(['dead-player','dead-rifleman','dead-raider','dead-sniper','dead-brute','dead-drone','dead-warden','dead-boss','dead-crawler','dead-bomber','muzzle','bullet','plasma','slash','claw','impact','dead-civilian','dead-spitter',...UNIT_SPRITES_V2.map(id=>`dead-${id}`)]);
// Tone role per atlas cell (3.82.1): props are dimmed, actors brightened. Keyed by name, so cells appended after the
// original sixteen (civilian) keep the actor tone; the original cells map exactly as the old index<10 rule did.
export const PROP_SPRITE_NAMES=Object.freeze(['cover','barrel','med','ammo','grenade','terminal']);
export const spriteToneRole=name=>PROP_SPRITE_NAMES.includes(name)?'prop':'unit';
export const DRAWING_SHAPES=Object.freeze(['humanoid','critter','drone']);
export const ENEMY_PROJECTILES=Object.freeze(['melee','rifle','smg','shotgun','sniper','plasma','venom']);

// key: atlas cell; corpse: aftermath cell (defaults to key); size: sprite multiplier; scale: fallback drawing scale.
// 3.223.0: given the unit itself, who it is can pick another cell than its card (its size stays the card's): a faction's
// own look (`sprite` in the faction's override: the loyalist and rebel crawler card is a military dog, the swarm's keeps the
// bug), the engineer's sentry and munition (their rules type is the drone), and the druid's companion beast (its rules
// base is the crawler card).
const ALLY_SPRITES=Object.freeze({drone_sentry:'turret',drone_munition:'munition'});
const unitSprite=a=>a.kind==='pet'?'pet':a.kind==='drone'?ALLY_SPRITES[a.sourceId]||null:factionOverride(a).sprite||null;
export function enemySprite(type,actor=null){const s=enemyDef(type)?.sprite||{},own=actor?unitSprite(actor):null,key=own||s.key||type;return {key,corpse:own||s.corpse||key,size:s.size??1,scale:s.scale??1};}
// Canvas fallback when the atlas is missing: shape plus optional colour, glow, shoulder plates and long barrel.
export const enemyDrawing=type=>({shape:'humanoid',...enemyDef(type)?.drawing});
export const enemyProjectile=type=>enemyDef(type)?.projectile;
export const enemyMeleeStyle=type=>enemyDef(type)?.attackStyle==='claw'?'claw':'slash';
export const enemyGlyph=type=>enemyDef(type)?.glyph||'!';
export const enemyVoice=type=>enemyDef(type)?.voice;
// Bestiary note for traits gained deeper, e.g. 「（第 4 層起：快速）」. TRAITS is passed in to keep this module rule-free.
export const floorTraitNote=(type,traits)=>(enemyDef(type)?.floorTraits||[]).map(f=>t('enemy-visuals.floorTrait',{floor:f.minFloor,trait:traits[f.id].name})).join('');

// Faction reskins and elites (3.79.1; docs/FACTION_DATA.md 9, docs/ELITE_ENEMIES.md 3). A faction override tint wins over
// the card tint; legacy and plain cards have none, so they draw exactly as before. Elites keep their colours and gain a
// gold outline, and a display-only label that is not a trait. Corpses use a dimmer gold so the ring fades with the body (3.80.1).
export const ELITE_VISUAL=Object.freeze({outline:'#f2c45a',corpseOutline:'#8f7438',label:t('enemy-visuals.elite')});
// Display-only tag for units that never fight (civilians, 3.82.1); like the elite label it is not a trait.
export const NONCOMBATANT_LABEL=t('enemy-visuals.noncombatant');
// Swarm presentation (3.84.1, docs/SWARM.md 8): venom blobs and the tongue pull. The rules only announce them (SWARM 6.4).
export const VENOM_VISUAL=Object.freeze({blob:'#a8c93f',rim:'#e4f59a',drop:'#8fb33a'});
export const TONGUE_VISUAL=Object.freeze({line:'#e27aa6d0',fill:'#d97aa033',edge:'#f0a3c4',landing:'#f0a3c4aa',flesh:'#c95c86',tip:'#f2b3cf',lane:'#d97aa02c',label:t('enemy-visuals.tongueWindup')});
// 3.207.0 delisted operatives (src/delisted-operatives.js): the berserker's grapple draws as the tongue does in steel and
// rope colours; the recon's warned smoke is the cloud's tiles in smoke grey with a dashed arc from the thrower; the class
// art is tinted `tint` (the cards' own colour); the ninja, when it shows, is a silhouette of dense grey noise.
export const GRAPPLE_VISUAL=Object.freeze({line:'#c9d2d8d0',fill:'#b8c4cc2e',edge:'#dfe8ee',landing:'#dfe8eeaa',flesh:'#9aa6ae',tip:'#eef4f8',lane:'#b8c4cc26'});
export const OPERATIVE_VISUAL=Object.freeze({smokeFill:'#a9bbcb2a',smokeEdge:'#c9d6e0aa',smokeLine:'#c9d6e0aa',noiseMs:70,noiseDensity:.82,noiseAlpha:.9});
export const tongueVisual=fx=>fx?.grapple?GRAPPLE_VISUAL:TONGUE_VISUAL;
// 3.205.0 swarm bosses (src/swarm-bosses.js): the charge lane — rust red with chevrons down it and a red bar where it hits
// a wall — and the matriarch's egg sac, in the tongue's pink family so the swarm's warnings read as one set.
export const CHARGE_VISUAL=Object.freeze({fill:'#e0703c26',edge:'#f0905caa',chevron:'#ffb27ae0',wall:'#ff4a3aee',dust:'#c9a27a'});
export const EGG_VISUAL=Object.freeze({fill:'#b0609a22',edge:'#e79ad0cc',sac:'#c78ab0',vein:'#7a3a68',glow:'#ffd6f0'});
// 3.206.0 rebel bosses (src/rebel-bosses.js): a warned wall or ring of fire — fuel-orange tiles with a hot edge and, for
// the wall, a line through them; the ring's gaps are the cool green of your own units' marks with an arrow pointing the
// way out — and 焚線官's set-up flamethrower, 火線官's cone in fire colours (amber-orange while it sets up, red-orange
// while it sweeps). An overheated arsonist sheds pale steam with a cool-blue count of its venting rounds; its heat shows
// as orange pips before that.
export const REBEL_FIRE_VISUAL=Object.freeze({fill:'#ff6a2a2e',edge:'#ff9a4acc',line:'#ffb05add',gap:'#9df4d5',gapFill:'#9df4d51c',set:Object.freeze(['#ff9a3c26','#ffc07acc']),sweep:Object.freeze(['#ff4a2a36','#ff7a3add']),setText:'#ffc07a',sweepText:'#ff8a5c',steam:'#dfe9f0',vent:'#8fd3ff',heat:'#ff8a3a',heatOff:'#5a3a2a'});
// Kill house humanoids draw as holograms (docs/KILLHOUSE.md section 10); campaign enemies keep their colours.
export const SIMULATION_VISUAL={tint:'#5fd6ea'};
// 3.134.0: a swarm bomber's sac shows in its colour — green mist, yellow acid, brown spore (docs/SWARM_FIELDS.md).
const SAC_TINTS={payload_toxic:'#8fcf45',payload_acid:'#d8d24a',payload_spore:'#b8905c'};
const sacTint=e=>SAC_TINTS[e?.traits?.find(t=>SAC_TINTS[t.id])?.id]??null;
export const enemyTint=e=>e?.simulation?SIMULATION_VISUAL.tint:sacTint(e)??factionOverride(e).tint??enemyDef(e)?.sprite?.tint??null;
export const factionTag=e=>{const d=factionDef(enemyFaction(e));return d?.tag?d.name:'';};
