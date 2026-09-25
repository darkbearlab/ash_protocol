import {t} from './i18n.js';
import {bandLabel} from './range-band.js';
import {enemyDisplayName} from './enemy-affixes.js';
import {cardEnemyName} from './affix-ui.js';
import {factionTag,ELITE_VISUAL,NONCOMBATANT_LABEL,TONGUE_VISUAL} from './enemy-visuals.js';
import {isNoncombatant} from './enemy-data.js';
import {suppressionTag} from './suppression-ui.js';
import {nestStyle,NEST_STYLES} from './runtime-enemies.js';
import {lightingEffects,enemyFlashlightOn} from './lighting.js';
import {missionTarget} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {FURNITURE} from './modules.js';
import {isBarrier,barrierName} from './barriers.js';
import {initiative,activeTrait,traitLabels} from './traits.js';
import {ENEMY_TYPES,distance,bracingBonus} from './engine.js';
import {coneTargets,pelletChance} from './shotgun.js';
import {lancePath} from './lance.js';
import {toxicShot} from './swarm-fields.js';
import {coverEffects} from './cover.js';
import {fooled} from './field-gear.js';
import {grapplePlan,ambushReady,MELEE_TUNING} from './melee-classes.js';
// Melee-class hints on the card (3.47.1): the hook's pull or dash, and whether an ambush would land.
const meleeHints=(game,target)=>{const p=game.player,hints=[];
  if(p.prepared.skill==='grapple'&&!p.skillState.grapple?.cooldown){const plan=grapplePlan(game,target.id);if(!plan.reason)hints.push(plan.dash?t('target-card.grappleCharge'):t('target-card.grapplePull'));}
  if(ambushReady(game,target))hints.push(`${t('melee-ui.ambush',{ambush:MELEE_TUNING.ambush})}`);return hints;};

// 3.112.0: a cone weapon says how many targets one shell reaches, which damage band the locked one is in, and warns
// when a friend stands in the cone.
// 3.141.0: the damage band gave way to the pellet count, which the chance line shows; 貫穿 says how many units its beam
// crosses and warns about friends on it too.
function coneNotes(game,target,withinRange){
  const w=game.weapon;
  if(!(w.cone||w.lance)||!withinRange||!game.enemies.includes(target))return [];
  const reached=w.cone?coneTargets(game,game.player,target,w):lancePath(game,game.player,target,w.range).units,friends=reached.filter(o=>!game.enemies.includes(o)).length;
  return [`${t('target-card.reached',{v:w.cone?t('target-card.cone'):t('target-card.lance'),reachedLength:reached.length})}`,friends?`${t('target-card.friendsInCone',{friends})}`:''];
}
// 3.141.0 (docs/WEAPONS.md): a shotgun aimed at an enemy shows its pellets instead of one chance: how many reach at this
// distance, each pellet's damage and its flat chance. 3.142.0 (playtest): the damage is what a pellet really does to
// this target, after its armour, its cover and toxic mist, with the raw figure beside it when they differ.
function pelletLine(game,target){
  const w=game.weapon,p=game.player;if(!w.cone||!game.enemies.includes(target))return null;
  const {count,min,max}=game.pelletDamage(p.weapon,target),toxic=toxicShot(game,p,target,w),pierce=w.pierce||0;
  const cover=game.protectingCover(target,p),cut=cover?w.pelletCover*coverEffects(cover,target,p).efficiency*(1-pierce):0,armor=(ENEMY_TYPES[target.type]?.armor||0)*(1-pierce);
  const real=d=>Math.max(1,Math.round(d*(1-cut)*(toxic?.5:1)-armor)),low=real(min),high=real(max);
  return t('target-card.pellets',{count,low,high,base:low!==min||high!==max?t('target-card.pelletsBase',{min,max}):'',chance:pelletChance(w,toxic)});
}
// 3.142.0 (playtest): 爆裂 warns when its burst would reach you or a friend standing next to the target.
function blastNotes(game,target){
  const w=game.weapon;if(!w.blast||!game.enemies.includes(target))return [];
  const friends=game.activeAllies.filter(a=>a.hp>0&&distance(a,target)<=1).length;
  return [distance(game.player,target)<=1?t('target-card.blastSelf'):'',friends?`${t('target-card.blastFriends',{friends})}`:''];
}
export function targetDetails(game){
  const target=game.targeted;if(!target)return null;
  const displayTarget={...target,traits:(target.traits||[]).filter(t=>!t.source.startsWith('affix:')||target.affixes?.some(a=>a.revealed&&t.source===`affix:${a.id}`))};
  const melee=game.weapon.melee,enemy=ENEMY_TYPES[target.type],aim=enemy?game.accuracy(game.player,target):{chance:game.fireChance(target),bracedBonus:bracingBonus(game,game.player,target)};
  const light=lightingEffects(game,game.player,target),attack=game.attackStatus?.(game.player,target);
  // 3.142.0: a gun that spends more than one round a shot says so while the magazine cannot pay for it.
  const short=!melee&&(game.weapon.shotCost||1)>1&&game.player.ammo[game.player.weapon]<game.weapon.shotCost;
  const pellets=pelletLine(game,target),range=distance(game.player,target),withinDistance=range<=game.weapon.range,withinRange=withinDistance&&game.shotClear(game.player,target)&&(!melee||isBarrier(target)||game.canCross(game.player,target));
  const details={name:(enemy?(missionTarget(game,target)?'◇ ':'')+cardEnemyName(target):null)||(isBarrier(target)?barrierName(target):target.type==='nest'?NEST_STYLES[nestStyle(target,game.facilityFaction)].name:isContainer(target)?containerName(target):target.type==='barrel'?t('target-card.barrel'):FURNITURE[target.style]?.name||t('target-card.breakableCover')),fullName:enemy?enemyDisplayName(target):'',hp:`${isBarrier(target)?t('target-card.durability'):'HP'} ${Math.max(0,target.hp)} / ${target.maxHp??target.hp}${enemy?.armor>0?`${t('target-card.armor',{armor:enemy.armor})}`:''}`,
    chance:withinRange?(short?t('target-card.magShort',{n:game.weapon.shotCost}):game.weapon.pointTarget?t('target-card.launcherSure'):pellets||t('target-card.hit',{chance:aim.chance})):melee?t('target-card.noMelee'):t('target-card.noShot'),distance:t('target-card.distance',{range,weaponRange:game.weapon.range,band:aim.band?t('target-card.band',{band:bandLabel(aim.band)}):'',burst:game.weapon.burstRange!==undefined&&withinDistance?(range>game.weapon.burstRange?t('target-card.single'):t('target-card.double')):''}),
    traits:enemy?[factionTag(target),target.elite?ELITE_VISUAL.label:'',isNoncombatant(target)?NONCOMBATANT_LABEL:'',...traitLabels(target)].filter(Boolean).join(' · '):'',
    order:enemy&&(initiative(displayTarget)!==0||initiative(game.player)!==0)?(initiative(displayTarget)<initiative(game.player)?t('target-card.actsBefore'):initiative(displayTarget)>initiative(game.player)?t('target-card.actsAfter'):t('target-card.actsSame')):'',
    cover:melee?t('target-card.meleeIgnoresCover'):enemy?(activeTrait(target,'no_cover')?t('target-card.noCoverUse'):aim.cover?(aim.coverEfficiency===.5?t('target-card.half'):'')+(aim.cover.type==='low_partition'?t('target-card.coverLowPartition'):isBarrier(aim.cover)?t('target-card.coverPartition'):aim.cover.type==='wall'?t('target-card.coverCorner'):aim.cover.style?t('target-card.coverFurniture'):t('target-card.coverCrate')):t('target-card.coverNone')):t('target-card.breakable'),
    attack,
    state:[attack?.targetExposed?t('target-card.cornerExposed'):'',enemy&&enemyFlashlightOn(game,target)?t('target-card.flashlight'):'',enemy&&fooled(game,target)?t('target-card.decoyed'):'',enemy&&target.keycard?t('target-card.keycard'):'',enemy?suppressionTag(target):'',...(enemy?meleeHints(game,target):[]),aim.closeBonus&&!pellets?`${t('target-card.closeBonus',{closeBonus:aim.closeBonus})}`:'',aim.aimPenalty?`${t('target-card.aimPenalty',{aimPenalty:aim.aimPenalty})}`:'',aim.rangePenalty?`${range>aim.band[1]?t('target-card.tooFar'):t('target-card.tooClose')} −${aim.rangePenalty}`:'',...coneNotes(game,target,withinRange),...(withinRange?blastNotes(game,target):[]),aim.vaultBonus?`${t('target-card.vaultBonus',{vaultBonus:aim.vaultBonus})}`:'',!melee&&light.dark?(light.nightVision?t('target-card.nightVision'):pellets?t('target-card.darkPellets'):t('target-card.dark')):'',isBarrier(target)?target.type==='door'?(target.open?t('target-card.doorOpen'):t('target-card.doorClosed')):target.type==='low_partition'?t('target-card.climbable'):t('target-card.fixedPartition'):'',withinRange?'':withinDistance?(attack?.reason==='target_corner_hidden'?t('target-card.cornerHidden'):t('target-card.obstacle')):t('target-card.outOfRange'),aim.bracedBonus?`${t('target-card.braced',{bracedBonus:aim.bracedBonus})}`:'',aim.trackingBonus?`${t('target-card.tracking',{trackingBonus:aim.trackingBonus})}`:'',aim.sidePenalty?`${t('target-card.sidestep',{sidePenalty:aim.sidePenalty})}`:'',target.control?.disabled?`${t('target-card.disabled',{disabled:target.control.disabled})}`:'',target.control?.immune?`${t('target-card.immune',{immune:target.control.immune})}`:'',target.moved?t('target-card.moving'):'',target.charge?t('target-card.aboutToAttack'):'',target.tongueIntent?TONGUE_VISUAL.label:''].filter(Boolean).join(' · '),withinRange};
  return game.realMode?realModeCard(details):details;
}
// Real mode (3.76.3): aiming shows only the name and distance. "Cannot fire" stays because it carries no number.
export function realModeCard(details){return {...details,hp:'',chance:details.withinRange?'':details.chance,cover:'',traits:'',order:'',state:''};}

const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
// Sprites follow the tile size (3.50.0). The old 32/16 step made actors jump out of scale when the camera
// zoomed out for a distant target.
export const spriteSize=tile=>Math.max(12,Math.round(tile*.84));
// Include sprite, health bar and charge marker at every rendered zoom.
export function actorObstacle(point,tile,fallback=false){
  const size=spriteSize(tile);
  const extent=fallback?tile*.8:0;
  const rx=Math.max(18,size/2+3,tile*.38+10,extent),top=Math.max(24,size/2+3,tile*.45+5,extent),bottom=Math.max(20,size/2+3,tile*.58+4,extent);
  return {x:point.x-rx,y:point.y-top,w:rx*2,h:top+bottom};
}
// Only three screen corners. The target is a hard exclusion; other enemies are
// a preference so crowds cannot force the card back into the middle of the map.
export function targetCardPlacement({target,player,tile,width,height,cardWidth,cardHeight,obstacles=[],blockers=[],fallbackActors=false,bottomInset=0,previousCorner=null}){
  const pad=5,w=cardWidth,h=cardHeight,bottom=height-h-pad-bottomInset;
  if(w>width-pad*2||h>height-pad*2)return null;
  const targetBox=actorObstacle(target,tile,fallbackActors),playerBox=actorObstacle(player,tile,fallbackActors);
  const candidates=[{corner:'top-right',x:width-w-pad,y:pad},{corner:'bottom-right',x:width-w-pad,y:bottom},{corner:'bottom-left',x:pad,y:bottom}];
  let best=null;
  for(const [index,candidate]of candidates.entries()){
    if(candidate.y<pad)continue;
    const r={...candidate,x:Math.round(candidate.x),y:Math.round(candidate.y),w,h};
    if(overlap(r,targetBox)>0)continue;
    const areas=blockers.map(b=>overlap(r,b));
    const link={x:Math.max(r.x,Math.min(r.x+w,target.x)),y:Math.max(r.y,Math.min(r.y+h,target.y))};
    // Once enemy occlusion is equal, shorten the actual connector before other
    // soft preferences; the previous corner only settles otherwise equal ties.
    const linkDistance=(target.x-link.x)**2+(target.y-link.y)**2;
    const rank=[areas.filter(a=>a>0).length,areas.reduce((a,b)=>a+b,0),linkDistance,overlap(r,playerBox),obstacles.reduce((sum,o)=>sum+overlap(r,o)*(o.weight||25),0),r.corner===previousCorner?0:1,index];
    if(!best||rank.some((n,i)=>n<best.rank[i]&&rank.slice(0,i).every((v,k)=>v===best.rank[k])))best={...r,link,rank};
  }
  return best;
}
