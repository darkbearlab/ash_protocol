// 埋伏 Concealed (3.217.0; user 2026-09-30, docs/ENEMY_VARIETY.md section 6). A unit that hides until you come close.
// - Human (loyalists, rebels): an ordinary armed soldier disguised as one of the floor's supply cases. Its only tell is the
//   rigged case's (docs/CONTAINERS.md): tapping it locks it, where a real case cannot be locked; auto-target and ⌖ never
//   pick it. It can be shot while disguised; it fills its tile (a real case can be walked over).
//   Claude's call against the draft: supply cases only — a cover crate is breakable, so lockable, and a disguise as one
//   would have no tell at all.
// - Swarm: a biter (hunter bug, giant bug, the infected fodder) under the floor — unseen and untargetable by anyone. The
//   soldier's early warning marks it (`exposed`), and then you can see it and shoot it; a blast or burning floor that
//   reaches it flushes it out (any damage does).
// - Reveal: you come within its reach (4 tiles for a human, 2 for a bug) where it sees you, or it takes any damage, or you
//   walk into it. Coming close, it acts at once on that enemy turn, unwarned (the user's design: 「到一定距離後會無預告
//   直接射擊」「破土就咬」): a gunman fires, a bug lunges a step and bites if that puts it beside you. Hit or bumped, it
//   only shows itself and fights from its next turn.
// - One or two a floor, from the curve's varietyStart, on a hash of the floor's own (src/world.js calls concealSpecial
//   after the affix rolls), so nothing else on any floor shifts. The affix shows when it reveals.
// - 裝死 Feigning (3.219.0; docs/ENEMY_VARIETY.md 10.4) is the third shape, `{as:'corpse',turns}`: at its first 0 hp a unit
//   with the unshown affix falls as a body instead (hp 1; feignDown, called by Game.hurt, which logs it as a kill — no
//   xp, scrap or kill until it really dies). Drawn as a body; the rigged case's tell (the body locks). Any damage kills
//   it; after FEIGN_TUNING.turns of its own turns it gets up where it lies (that is the turn) and the affix shows.
// - Until it reveals it does nothing: no turn, no squad, no order, no decoy or mine, no step off fire. Nothing gives it
//   away either (3.217.0 review): no spotting call, no torch, no aim preview, no log line, no move hint left out.
// - A stun grenade or EMP that catches it shows it (and it is stunned), as any grenade flushes it out.
import {t} from './i18n.js';
import {ENEMY_TYPES} from './data.js';
import {hasEnemyTag,isBossClass,isNoncombatant} from './enemy-data.js';
import {giveEnemyAffix,revealEnemyAffix,isFlamer,enemyDisplayName} from './enemy-affixes.js';
import {CONTAINER_KINDS,RIG_TUNING} from './containers.js';
import {effectiveDepth,curveOf,scaledChance} from './endless.js';
import {activeTrait} from './traits.js';
import {distance,key} from './world.js';
import {enemyCallout,interruptEnemyIntent} from './enemy-intents.js';
import {registerSpecial} from './enemy-specials.js';

export const CONCEAL_TUNING=Object.freeze({perDepth:.25,cap:.75,perFloor:2,humanReach:4,bugReach:2});
export const FEIGN_TUNING=Object.freeze({turns:2});
// Read when used, not at load: containers.js sits in an import cycle with the map modules that load this one.
export const disguiseKinds=()=>Object.keys(CONTAINER_KINDS).filter(k=>k!=='vault');
export const concealChance=(floor,d)=>scaledChance(d,CONCEAL_TUNING.cap,CONCEAL_TUNING.perDepth,effectiveDepth(floor,d)-curveOf(d).varietyStart+1);
const fnv=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
// The infected (fodder) are an expendable crowd on a card of their own, so they never hide (3.217.0 review).
const BITERS=Object.freeze(['crawler','giant_bug']);
// Who may hide: on a human floor an ordinary armed soldier (no behaviour card, no boss, not a flamer, not infected); on a
// swarm floor a hunter bug or a giant bug.
export function canConceal(e,faction){
 const d=ENEMY_TYPES[e?.type];if(!d||isBossClass(e)||isNoncombatant(e)||d.expendable)return false;
 if(faction==='swarm')return BITERS.includes(e.type);
 return hasEnemyTag(e,'armed')&&!d.behavior&&!isFlamer(e)&&!hasEnemyTag(e,'infected');
}
export const isConcealed=e=>Boolean(e?.concealed);
export const burrowed=e=>e?.concealed?.as==='burrow';
export const disguised=e=>e?.concealed?.as==='case';
export const downed=e=>e?.concealed?.as==='corpse';
export const feigns=e=>Boolean(e?.affixes?.some(a=>a.id==='feign'&&!a.revealed));
// What you can know of it: a disguise is a case you see where you see its tile; a burrowed bug only once marked.
export const concealedSeen=e=>disguised(e)||downed(e)||burrowed(e)&&Boolean(activeTrait(e,'exposed'));
// An enemy you know as one (Game.visibleEnemies, aim previews, the volley's targets): not hidden, or a bug the early
// warning marked. A disguise is a case to you until it shows.
export const knownEnemy=e=>!e?.concealed||burrowed(e)&&concealedSeen(e);
// What a round, a pellet or the lance can strike: a disguise is a body in the line (a stray round shows it); a burrowed
// bug is under the floor, out of every line, until the early warning marks it.
export const inLineOfFire=e=>!burrowed(e)||concealedSeen(e);
// The case it looks like, for the map and the target card: a rigged case, hp and all (it is never hurt while disguised).
export const disguiseProp=e=>({id:e.id,type:'container',kind:e.concealed.kind,x:e.x,y:e.y,contents:[],hp:RIG_TUNING.hp,maxHp:RIG_TUNING.hp,rigged:true,opened:false});
// A disguise is one of the floor's own kinds of supply case (3.217.0 review); a floor without one hides no soldier.
const floorKinds=map=>[...new Set(map.props.filter(o=>o.type==='container'&&disguiseKinds().includes(o.kind)).map(o=>o.kind))].sort();
export function concealSpecial(map,seed,floor,difficulty,faction){
 const chance=concealChance(floor,difficulty),scout=`${floor}-scout`,kinds=faction==='swarm'?[]:floorKinds(map);
 if(faction!=='swarm'&&!kinds.length)return map;
 for(let i=0;i<CONCEAL_TUNING.perFloor;i++){
  if(fnv(`${seed}:${floor}:conceal-v1:${i}`)/4294967296>=chance)continue;
  const eligible=map.enemies.filter(e=>e.id!==scout&&!e.concealed&&canConceal(e,faction));if(!eligible.length)return map;
  const e=eligible[fnv(`${seed}:${floor}:conceal-pick-v1:${i}`)%eligible.length];
  giveEnemyAffix(e,'concealed');
  e.concealed=faction==='swarm'?{as:'burrow'}:{as:'case',kind:kinds[fnv(`${seed}:${floor}:${e.id}:conceal-kind-v1`)%kinds.length]};
 }
 return map;
}
// 裝死: down instead of dead (Game.hurt, at 0 hp, before any reward). False when it has no unshown feign to use.
export function feignDown(g,e){
 if(!feigns(e))return false;
 interruptEnemyIntent(e,'death');e.hp=1;e.concealed={as:'corpse',turns:FEIGN_TUNING.turns};e.charge=false;e.aim=null;e.windup=1;
 return true;
}
// call: false when it shows because it was stunned or jammed — it has no attack to call out.
export function revealConcealed(g,e,{quiet=false,call=true}={}){
 if(!e?.concealed)return false;
 const was=e.concealed.as;delete e.concealed;e.alert=true;revealEnemyAffix(g,e,was==='corpse'?'feign':'concealed');
 g.effects.push({type:'pulse',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},radius:.6,color:was==='burrow'?'#c9a36a':'#e8b26a',damage:0});
 if(!quiet)g.log(t(was==='burrow'?'concealed.burst':was==='corpse'?'feign.rise':'concealed.drop',{enemy:enemyDisplayName(e)}),true);
 if(call&&was!=='corpse')enemyCallout(g,e,'telegraph',{action:'attack'});   // a body getting up has no blow wound up
 return true;
}
let strike=null,step=null;
// The unit's own attack and walk live in enemy-behavior.js, which hands them over so the two files never import each other.
export const useConcealedHooks=({attack,walk})=>{strike=attack;step=walk;};
// Its turn while hidden (Game.enemyAct): nothing, unless you came within its reach where it sees you — then it shows
// itself and acts at once, unwarned.
export function concealedTurn(g,e){
 const p=g.player;if(p.hp<=0||e.hp<=0||e.control?.disabled)return true;
 if(downed(e)){if(--e.concealed.turns<=0)revealConcealed(g,e);return true;}   // 裝死: it gets up, and that is its turn
 const reach=burrowed(e)?CONCEAL_TUNING.bugReach:CONCEAL_TUNING.humanReach,d=distance(e,p);
 if(d>reach||!g.sight(e,p))return true;
 revealConcealed(g,e);e.lastKnown={x:p.x,y:p.y};
 const def=ENEMY_TYPES[e.type],ctx={g,e,p,def,los:true,d};
 if(def.range>1){if(d<=def.range&&g.shotClear(e,p))strike?.(ctx);}
 else{
  if(d>1)step?.({...ctx,stepOnly:true});
  const near=distance(e,p);if(near<=1&&g.canCross(e,p))strike?.({...ctx,d:near});
 }
 e.charge=false;e.aim=null;e.windup=1;
 return true;
}
// Saves: a hidden unit carries the unrevealed affix, and the shape of its hiding.
export function validConcealed(e){
 const c=e.concealed;if(c===undefined)return true;
 if(!c||typeof c!=='object')return false;
 if(c.as==='corpse')return Object.keys(c).length===2&&Number.isInteger(c.turns)&&c.turns>=1&&c.turns<=FEIGN_TUNING.turns&&feigns(e)&&e.hp>0;
 if(!e.affixes?.some(a=>a.id==='concealed'&&a.revealed===false))return false;
 if(c.as==='burrow')return Object.keys(c).length===1;
 return c.as==='case'&&Object.keys(c).length===2&&disguiseKinds().includes(c.kind);
}
export const concealedAt=(g,q)=>g.enemies.find(e=>e.hp>0&&e.concealed&&key(e)===key(q));
// The registry (src/enemy-specials.js) holds the field for the loader: no warning, no turn of its own there.
// stepOff: it never flinches off steam or a burning tile while hidden, so the fire reaches it and flushes it out.
registerSpecial({id:'conceal',carries:e=>Boolean(e?.affixes?.some(a=>a.id==='concealed'||a.id==='feign')),fields:{concealed:{valid:(v,e)=>validConcealed(e)}},blocks:{stepOff:e=>Boolean(e.concealed)}});
