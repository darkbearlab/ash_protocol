// 繳械 Disarm (3.215.0; user 2026-09-30, docs/ENEMY_VARIETY.md section 4): 「打掉槍就只能打掉裝備中的」, and
// 「繳械打中還是要扣血」.
// - Who: a marksman — the sniper, or a rifleman-type gun with reach 7 or more and no behaviour card of its own — never a
//   flamer, a grenadier, a lockdown gunman or a fast one (src/enemy-affixes.js); a special affix from the curve's
//   varietyStart.
// - When: it sees you, you are in its reach and in its line, you hold a weapon and carry another (Claude's call: with your
//   last weapon in hand it fights as usual — an empty hand is not a state the game supports), and its cooldown is done:
//   at most once every five rounds (`disarmCooldown`, set as it aims).
// - What: it warns one round that it aims at your weapon (log, callout, a marked line, the target card), then fires its
//   usual attack at you, at its usual hit chance (cover, smoke, movement all count). If any round lands it hurts you as
//   usual and the weapon in your hand, magazine and all, drops on the floor one or two tiles from you, the side away from
//   it first; you switch to the next weapon in your pack. Out of its sight or its line when it fires: the shot is wasted.
// - Picking it up: the ground-weapon rules (step on it, or take it from beside it); its affix, upgrades and magazine are
//   the slot's, so they stay.
// - Dropped when it falls, is stunned, pinned or moved (src/enemy-specials.js); a save drops one it could no longer fire.
// The aim starts as an affix branch (disarmBranch, registered in src/enemy-behavior.js after the lockdown's), after the
// unit's orders and its hazard step, and only when you are the turn's target; the shot alone goes off at the top of the
// turn (ORDER.top), from where it aimed.
import {t} from './i18n.js';
import {ENEMY_TYPES} from './data.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {AFFIX_TUNING,disarms,revealEnemyAffix,enemyDisplayName} from './enemy-affixes.js';
import {distance,key,DIRECTIONS} from './world.js';
import {activeTrait} from './traits.js';
import {occupied} from './allies.js';
import {hazardTile} from './hazard-paths.js';
import {registerSpecial,registerStep,validSpecials,dropAttack} from './enemy-specials.js';

let shoot=null;
// The gunman's own attack lives in enemy-behavior.js, which hands it over so the two files never import each other.
export const useDisarmHooks=({attack})=>{shoot=attack;};
const live=e=>e?.hp>0&&!e.control?.disabled;
// Your weapon in hand and another to switch to. 3.215.0 review: never a class weapon (`locked`: the ninja's katana, the
// berserker's axe, the bulwark's gauntlet) — the game keeps those in your pack (a save with one on the floor is refused),
// so with one in hand it fights as usual, as with your last weapon.
export const disarmable=g=>{const p=g.player;return p.hp>0&&p.owned.includes(p.weapon)&&p.owned.length>=2&&!g.weaponAt(p.weapon).locked;};
export function canAimDisarm(g,e){
 const p=g.player,reach=ENEMY_TYPES[e.type]?.range||0;
 return disarms(e)&&live(e)&&!pinned(e)&&!activeTrait(e,'fast')&&!e.disarmIntent&&!(e.disarmCooldown>0)&&disarmable(g)&&g.sight(e,p)&&distance(e,p)<=reach&&g.shotClear(e,p);
}
// Where the weapon lands: a floor tile you could walk to in one or two steps (3.215.0 review: never beyond a wall, a shut
// door or a partition), the farthest from the shooter in a straight line first, then the fewer steps, then reading
// order. No hazard, no pit, nothing solid, nobody standing there; your own tile when there is no other.
export function disarmSpot(g,e){
 const p=g.player,steps=new Map();
 const open=(a,b)=>g.passable(b.x,b.y)&&g.canCross(a,b);
 for(const [dx,dy] of DIRECTIONS){const a={x:p.x+dx,y:p.y+dy};if(!open(p,a))continue;steps.set(key(a),{q:a,d:1});
  for(const [ex,ey] of DIRECTIONS){const b={x:a.x+ex,y:a.y+ey};if(key(b)!==key(p)&&!steps.has(key(b))&&open(a,b))steps.set(key(b),{q:b,d:2});}}
 const spots=[...steps.values()].filter(({q})=>!hazardTile(g,q.x,q.y)&&!occupied(g,q));
 const far=q=>(q.x-e.x)**2+(q.y-e.y)**2;   // straight-line distance, so 'away' is behind you, not beside you
 spots.sort((a,b)=>far(b.q)-far(a.q)||a.d-b.d||a.q.y-b.q.y||a.q.x-b.q.x);
 return spots[0]?.q||{x:p.x,y:p.y};
}
export function knockWeapon(g,e){
 const p=g.player,slot=p.weapon;if(!disarmable(g))return false;   // 3.215.0 review: not with the shot that kills you (disarmable asks for you alive), nor a class weapon
 const at=p.owned.indexOf(slot),spot=disarmSpot(g,e);
 p.owned=p.owned.filter(s=>s!==slot);p.weapon=p.owned[at%p.owned.length];p.fireChain=null;   // a new weapon starts its own chain
 g.items.push({x:spot.x,y:spot.y,type:'weapon',weapon:p.weaponBases[slot],slot});
 g.log(t('disarm.knocked',{enemy:enemyDisplayName(e),weapon:g.weaponAt(slot).name,next:g.weaponAt(p.weapon).name}),true);
 g.effects.push({type:'pulse',from:{x:p.x,y:p.y},to:{...spot},radius:.5,color:'#e6c07a',damage:0});   // the weapon lands (the pounce's pulse)
 return true;
}
function fire(ctx){
 const {g,e}=ctx,p=g.player;
 delete e.disarmIntent;dropAttack(e);e.attackCount=(e.attackCount||0)+1;
 if(!(g.sight(e,p)&&g.shotClear(e,p)&&distance(e,p)<=(ENEMY_TYPES[e.type]?.range||0))){
  g.log(t('disarm.lost',{enemy:enemyDisplayName(e)}));g.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0,miss:true});
  return;
 }
 const at=g.effects.length,slot=p.weapon;
 shoot?.({...ctx,p,los:true,d:distance(e,p)});
 // A round that landed (Game.damagePlayer's shot, not a miss) knocks the weapon still in your hand away.
 if(p.weapon===slot&&g.effects.slice(at).some(f=>f.type==='enemyShot'&&!f.miss&&f.attackerType===e.type&&f.to?.x===p.x&&f.to?.y===p.y))knockWeapon(g,e);
}
// The top step: an aim warned last round goes off from where it was warned; pinned or moved off, it is dropped.
export function disarmAction(ctx){
 const {e}=ctx;
 if(!disarms(e)||!e.disarmIntent)return false;
 if(pinned(e)){interruptEnemyIntent(e,'suppressed');return false;}
 if(key(e.disarmIntent.origin)!==key(e)){interruptEnemyIntent(e,'displaced');return false;}
 // 3.215.0 review: made fast since it aimed (a squad's bound, a rebel taunt), it would fire before you could answer the
 // warning: the aim is let go and it fights as usual this turn.
 if(activeTrait(e,'fast')){delete e.disarmIntent;return false;}
 fire(ctx);return true;
}
// The affix branch: no dice (`pending`) — it aims whenever it can and you are the turn's target.
export const disarmBranch=Object.freeze({id:'disarm',reveal:'effect',applies:({e})=>disarms(e),
 trigger:({g,e,p})=>p===g.player&&canAimDisarm(g,e),pending:()=>true,run:startAim});
function startAim(ctx){
 const {g,e}=ctx;if(!canAimDisarm(g,e))return false;
 dropAttack(e);e.disarmIntent={origin:{x:e.x,y:e.y}};e.disarmCooldown=AFFIX_TUNING.disarmCooldown;revealEnemyAffix(g,e,'disarm');
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{x:g.player.x,y:g.player.y},damage:0});
 enemyCallout(g,e,'telegraph',{action:'aim'});
 g.log(t('disarm.aim',{enemy:enemyDisplayName(e),weapon:g.weapon.name}),true);
 return true;
}
// The shared rules (src/enemy-specials.js): aiming, it turns on no decoy, shoots no mine, steps off no hazard, and a pin
// drops it; the round start counts the cooldown down and drops the aim for a fall, a stun or a pin. Saves (CHECKLIST 3):
// an aim its gunman could no longer fire (fallen, stunned, pinned, moved off its tile) is dropped and the cooldown
// restarts; a cooldown past the tuning is cut; a malformed aim is refused.
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleAim=e=>{const s=e.disarmIntent;return Boolean(s&&typeof s==='object'&&whole(s.origin)&&!(live(e)&&!pinned(e)&&key(s.origin)===key(e)));};
registerSpecial({id:'disarm',intent:'disarmIntent',carries:disarms,
 fields:{
  disarmIntent:{valid:(s,e,f)=>Boolean(s&&typeof s==='object'&&Object.keys(s).length===1&&disarms(e)&&whole(s.origin)&&f.grid?.[s.origin.y]?.[s.origin.x]===1&&key(e)===key(s.origin))},
  disarmCooldown:{count:{max:()=>AFFIX_TUNING.disarmCooldown,carrier:true,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled','displaced','suppressed'],cooldown:'disarmCooldown'},
 tick:{cooldown:'disarmCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:staleAim,restart:'disarmCooldown'},
 card:(g,e)=>[e.disarmIntent?t('target-card.disarm'):''],
});
registerStep('top','disarm',disarmAction,disarms);
export const tickDisarms=g=>tickSpecials(g,[['disarm']]);
export const validDisarm=g=>validSpecials(g,['disarm']);
