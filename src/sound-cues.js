import {enemyProjectile} from './enemy-visuals.js';
// Which adopted sound a presentation event plays (3.117.0; the files and decisions are in docs/AUDIO.md). Pure, so it can
// be tested without a browser. Anything not listed is silent until its own sound is made; the gaps are listed in
// docs/AUDIO.md and briefed for the next production round.
export const SFX_FILES=Object.freeze({
  rifle:'rifle.wav',shotgun:'shotgun.wav',smg:'smg.wav',precision:'precision.wav',plasma:'plasma.wav',
  hit:'hit.wav',kill:'kill.wav',enemyMiss:'enemy-miss.wav',blast:'blast.wav',footstep:'footstep.wav',
  reload:'reload.wav',heal:'heal.wav',transmission:'transmission.wav',door:'door.wav',select:'select.wav',
  // Round four, P1 (3.118.0).
  lmg:'lmg.wav',creatureAttack:'creature-attack.wav',throw:'throw.wav',pickup:'pickup.wav',openCase:'open-case.wav',hurt:'hurt.wav',
});
// Firing sounds by the id a shot already carries: weaponId for the player and allies, the projectile for an enemy.
export const WEAPON_SFX=Object.freeze({rifle:'rifle',shotgun:'shotgun',smg:'smg',sniper:'precision',plasma:'plasma',lmg:'lmg'});
// A thrown object flies as a grenade; the launcher and the thunder gun borrow that flight but are fired, not thrown.
const FIRED_GRENADES=new Set(['launcher','thunder']);
// The miss sound is a bullet striking the wall beside the player (user decision), so only bullets fired at the player use it.
const BALLISTIC=new Set(['rifle','smg','shotgun','sniper']);
const weaponOf=effect=>effect.weaponId||enemyProjectile(effect.attackerType);
const at=(point,actor)=>Boolean(point&&actor&&point.x===actor.x&&point.y===actor.y);

// A shot is heard once: projectileVisuals marks the first of its cosmetic rounds as primary, and a shotgun cone, which
// sends one trace per target from the same muzzle, still makes one blast.
export function eventSounds(effects=[],state=null){
  const cues=[],shooters=new Set();
  for(const e of effects){
    if((e.type!=='shot'&&e.type!=='enemyShot')||!e.primary)continue;
    const thrown=e.style==='grenade'&&!FIRED_GRENADES.has(e.weaponId),creature=e.type==='enemyShot'&&enemyProjectile(e.attackerType)==='melee';
    const cue=thrown?'throw':creature?'creatureAttack':WEAPON_SFX[weaponOf(e)],key=`${cue}:${e.from?.x},${e.from?.y}`;
    if(cue&&!shooters.has(key)){shooters.add(key);cues.push(cue);}
  }
  // One result per event: a kill outranks a hit, and a hit outranks a bullet missing the player. The player's own misses
  // make no sound (user decision).
  // A hit landing on the player's own tile is the player being hurt (3.118.0), heard alongside anything else.
  const kill=effects.some(e=>e.type==='fall'&&e.actorType!=='player'&&(!state||state.enemies?.some(x=>x.hp<=0&&x.x===e.from?.x&&x.y===e.from?.y)));
  const impacts=effects.filter(e=>e.type==='impact'),hurt=impacts.some(e=>at(e.from,state?.player));
  if(kill)cues.push('kill');
  else if(impacts.some(e=>!at(e.from,state?.player)))cues.push('hit');
  else if(!hurt&&effects.some(e=>e.type==='miss'&&e.attackerType&&BALLISTIC.has(enemyProjectile(e.attackerType))&&at(e.from,state?.player)))cues.push('enemyMiss');
  if(hurt)cues.push('hurt');
  if(effects.some(e=>e.type==='blast'))cues.push('blast');
  if(effects.some(e=>e.type==='unpack'&&e.container))cues.push('openCase');
  if(effects.some(e=>e.type==='pickup'))cues.push('pickup');
  if(effects.some(e=>e.type==='gate'))cues.push('door');
  return cues;
}
// Sounds that belong to the player's own action rather than to a presented event. `action` is the resolved kind, so a
// medkit used from the prepared slot is 'heal' too.
export function actionSound(action){
  return action==='move'?'footstep':action==='reload'?'reload':action==='heal'?'heal':null;
}
