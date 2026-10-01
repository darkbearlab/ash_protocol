// Delisted operatives (3.207.0, user design 2026-09-29; docs/BOSSES.md section 5): clone operatives who slipped the
// victors' control and went back over to the spark — "delisted" by the company that drives you, not by the spark. One
// may stand in for a loyalist or rebel floor-6 boss (src/operative-draw.js). Five classes, each with the player class's
// own trick turned on you; the numbers are OPERATIVE_TUNING and the cards (src/data.js):
// - 士兵 soldier: every few rounds, as its turn begins, early warning like yours (no warning, through walls): you and your
//   units within 8 steps are scanned for this round and the next — its shots at you get +10 to hit and +10% damage, and
//   it learns where you are. Come too close and it readies a grenade (the grenadier's throw, src/enemy-behavior.js), a
//   few rounds apart; keep to a middle distance.
// - 偵察兵 recon: a real smoke grenade thrown between itself and you, the spitter's lob with smoke in it (a round of
//   warning, then the cloud), eight rounds from one throw to the next; it sees through smoke (its card's infrared) and
//   shoots you through it.
// - 工程師 engineer: after its turn, every second round, a drone of a changing kind (a drone, a suicide bot or a
//   loitering munition) beside it, at most three of its own at once. Unannounced, as the bosses' drones always were.
// - 狂戰士 berserker: the giant bug's charge and a grapple that drags you in and cuts (the swarm bosses' charge and
//   tongue, src/swarm-bosses.js, src/swarm.js), and each cut on you heals it (the player berserker's bloodlust).
// - 忍者 ninja: optical camouflage. Nobody sees it unless it stands in thin smoke (vent haze, steam, burning floor), in the
//   same thick cloud as the one looking, right beside them, or has just attacked; your early warning's mark and infrared
//   (a recon's or a ninja's eyes, thermal goggles) see it too. It fights up close: an SMG, and a knife beside you.
//   Hidden near you, the officer's sensors notice it (src/detection.js).
// Each has a serial (`code`, the player clone's format); the officer names it when it comes into view and confirms it
// destroyed; its last words rise from where it fell (lastWords). No dog tag drops.
import {t} from './i18n.js';
import {enemyDef} from './enemy-data.js';
import {distance,key,DIRECTIONS} from './world.js';
import {activeTrait,grantTrait,removeTraitSource,healActor} from './traits.js';
import {pinned} from './suppression.js';
import {interruptEnemyIntent,enemyCallout,tickSpecials} from './enemy-intents.js';
import {enemyDisplayName as enemyName} from './enemy-affixes.js';
import {areaCells,SMOKE_DURATION,GRENADES} from './throwables.js';
import {lineCells} from './swarm-fields.js';
import {HAZE_KINDS} from './vents.js';
import {occupied} from './allies.js';
import {enemyRoom} from './runtime-enemies.js';
import {hazardTile} from './hazard-paths.js';
import {registerSpecial,registerStep,dropAttack,frames} from './enemy-specials.js';
import {registerDetector} from './detection.js';
import {validOperativeCode,unitCode,OPERATIVE_CLASSES} from './operative-draw.js';
export {OPERATIVE_CLASSES};

// The user tunes these after playtesting (docs/BOSSES.md section 5).
// scan: reach in steps, rounds between scans, how long a scan lasts (the rest of its round and the next), and what it
// gives the soldier's shots. grenade: the distances at which it readies one (3.207.0 review: never beside you, where its
// own blast would reach it), rounds from one to the next.
// smoke: rounds of cooldown after a throw (plus the round of warning: eight from throw to throw), how far it throws, the
// least distance to you it bothers at, the cloud's radius. drones: rounds between two, how many of its own at once, the
// kinds it cycles through. lifesteal: the share of a cut on you the berserker heals. lastWordsMs: world time from the
// fall to its last words. alert: how near a hidden ninja sets off the officer's sensors, and rounds between two alerts.
export const OPERATIVE_TUNING=Object.freeze({
 scan:Object.freeze({radius:8,cooldown:5,turns:2,accuracy:10,damage:.1}),
 grenade:Object.freeze({near:2,reach:3,cooldown:4}),
 smoke:Object.freeze({cooldown:7,range:6,near:3,radius:2}),
 drones:Object.freeze({every:2,live:3,kinds:Object.freeze(['drone','bomber_bot','munition'])}),
 lifesteal:.5,
 lastWordsMs:900,
 alert:Object.freeze({range:6,cooldown:8}),
});
const T=OPERATIVE_TUNING;
export const operativeClass=e=>enemyDef(e)?.operative||null;
export const isOperative=e=>Boolean(operativeClass(e));
const is=cls=>e=>operativeClass(e)===cls;
export const scans=is('soldier'),throwsSmoke=is('recon'),deploysDrones=is('engineer'),drinksBlood=is('berserker'),cloaks=is('ninja');
const live=e=>e?.hp>0&&!e.control?.disabled;
const at=(e,q)=>Boolean(q&&typeof q==='object'&&q.x===e.x&&q.y===e.y);
const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const operativeCodeOf=e=>unitCode(e);   // the serial the officer reads out (src/operative-draw.js)

// ---- 士兵: early warning and the grenade ----------------------------------------------------------------------------
export const SCANNED='scanned',SCAN_SOURCE='boss:scan';
export const scanned=u=>activeTrait(u,SCANNED);
// As its turn begins (src/enemy-specials.js ORDER.start, not its action): when the cooldown is done and someone of yours
// is within reach — walls do not matter — they are scanned and it knows where you are. Nobody in reach: it keeps it.
export function scanNow(g,e){
 const S=T.scan;if(!scans(e)||!live(e)||(e.scanCooldown||0)>0||g.player.hp<=0)return false;
 const caught=[g.player,...g.activeAllies].filter(u=>u.hp>0&&distance(e,u)<=S.radius);if(!caught.length)return false;
 for(const u of caught){removeTraitSource(u,SCAN_SOURCE);grantTrait(u,SCANNED,SCAN_SOURCE,S.turns);}
 if(caught.includes(g.player))e.lastKnown={x:g.player.x,y:g.player.y};
 e.scanCooldown=S.cooldown;
 g.effects.push({type:'pulse',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},radius:S.radius,color:'#e9c27d',damage:0});
 g.log(t('operatives.scan',{enemy:enemyName(e)}),true);
 return true;
}
// Its shots at someone it scanned (src/combat.js shotChance, Game.damagePlayer and damageAlly); only its own, as your
// early warning helps only you (同玩家版; Claude's call).
const scanning=(g,attacker,target)=>Boolean(attacker&&target&&attacker!==target&&scans(attacker)&&g.enemies?.includes(attacker)&&scanned(target));
export const scanAccuracy=(g,attacker,target)=>scanning(g,attacker,target)?T.scan.accuracy:0;
export const scanDamage=(g,attacker,target)=>scanning(g,attacker,target)?1+T.scan.damage:1;
// Another floor ends it (Game.descend), as the mark.
export const clearScan=u=>removeTraitSource(u,SCAN_SOURCE);
registerStep('start','scan',scanNow);
// The tree's `special` step (src/enemy-behavior.js): too close, it readies a grenade instead of its shot — the
// grenadier's throw, which goes off at the top of its next turn (the 'grenade' step) — and not again for a few rounds.
export function soldierSpecial(ctx){
 const {g,e,p,los,d}=ctx;
 if(!enemyDef(e)?.grenades||e.grenadeIntent||(e.grenadeCooldown||0)>0||!los||!p||p.hp<=0||d<T.grenade.near||d>T.grenade.reach||hazardTile(g,e.x,e.y,e))return false;
 dropAttack(e);   // the throw is this round's attack (docs/CHECKLIST.md 2)
 e.grenadeIntent={stage:'prepare',targetId:p.id||'player',x:p.x,y:p.y,origin:{x:e.x,y:e.y}};e.grenadeCooldown=T.grenade.cooldown;
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});
 enemyCallout(g,e,'telegraph',{action:'grenade'});g.log(t('enemy-behavior.grenadeReady',{enemy:enemyName(e)}),true);
 return true;
}

// ---- 偵察兵: smoke between you ---------------------------------------------------------------------------------------
const thick=s=>s.kind===undefined||s.kind==='smoke';
const inThick=(g,q)=>(g.smoke||[]).some(s=>thick(s)&&s.cells.some(c=>c.x===q.x&&c.y===q.y));
// The floor tile on the straight line from it to you nearest halfway (the nearer to it on a tie), within its throw and
// in its sight, not already in thick smoke.
export function smokePoint(g,e,p){
 const S=T.smoke,d=distance(e,p);if(d<S.near)return null;
 const line=lineCells(e,p).filter(q=>g.grid[q.y]?.[q.x]===1&&!at(e,q)&&!at(p,q)&&distance(e,q)<=S.range);
 line.sort((a,b)=>Math.abs(distance(e,a)*2-d)-Math.abs(distance(e,b)*2-d)||distance(e,a)-distance(e,b));
 return line.find(q=>g.sight(e,q)&&!inThick(g,q))||null;
}
export const smokeCells=(g,point)=>areaCells(g.grid,point,T.smoke.radius,g.barriers,g).filter(q=>g.grid[q.y]?.[q.x]===1);   // smoke lies on the floor (3.164.0)
function throwSmoke(g,e,point){
 const cells=smokeCells(g,point),to={x:point.x,y:point.y};
 g.effects.push({type:'shot',style:'grenade',color:GRENADES.smoke.color,from:{x:e.x,y:e.y},to,damage:0});
 if(cells.length)g.smoke=[...g.smoke,{cells,expires:g.turn+SMOKE_DURATION-1}];
 g.effects.push({type:'pulse',from:to,to,radius:T.smoke.radius,color:GRENADES.smoke.color,damage:0});
 g.log(t('operatives.smokeThrown',{enemy:enemyName(e)}),true);g.reveal();
}
// At the top of its turn (ORDER.top): a warned throw goes out from where it warned; otherwise, cooldown done and seeing
// you at a fair distance, it warns (the throw is its action). A pin drops the warning, as the lob's.
export function smokeAction(ctx){
 const {g,e,p,los}=ctx;
 if(!throwsSmoke(e))return false;
 if(pinned(e)){if(e.smokeIntent)interruptEnemyIntent(e,'suppressed');return false;}
 if(e.smokeIntent){
  const s=e.smokeIntent;delete e.smokeIntent;e.smokeCooldown=T.smoke.cooldown;
  if(!at(e,s.origin))return false;
  throwSmoke(g,e,s.point);dropAttack(e);if(los&&p?.hp>0)e.lastKnown={x:p.x,y:p.y};return true;
 }
 if((e.smokeCooldown||0)>0||!los||p!==g.player||p.hp<=0||hazardTile(g,e.x,e.y,e))return false;
 const point=smokePoint(g,e,p);if(!point)return false;
 interruptEnemyIntent(e,'target_lost');   // readying the throw is this round's action: no shot is left wound up
 e.smokeIntent={origin:{x:e.x,y:e.y},point};e.lastKnown={x:p.x,y:p.y};
 g.effects.push({type:'enemyTelegraph',phase:'prepare',from:{x:e.x,y:e.y},to:{...point},damage:0});
 enemyCallout(g,e,'telegraph',{action:'grenade'});g.log(t('operatives.smokeReady',{enemy:enemyName(e)}),true);
 return true;
}
registerStep('top','smoke',smokeAction,throwsSmoke);
export const liveSmokeIntent=e=>Boolean(e?.smokeIntent&&live(e)&&at(e,e.smokeIntent.origin));
// The throws to draw: every warning recon's, the cloud's tiles as the floor stands now.
export const smokeTelegraphs=g=>g.enemies.filter(liveSmokeIntent).map(e=>({sourceId:e.id,origin:{...e.smokeIntent.origin},point:{...e.smokeIntent.point},cells:smokeCells(g,e.smokeIntent.point)}));

// ---- 工程師: drones ------------------------------------------------------------------------------------------------
// Its drones are ordinary enemies with ids of its own (`<its id>-drone-<n>`), never reused, marked expendable
// reinforcements (they pay nothing when they fall); the kind is a hash of the seed, floor, engineer and count, never the
// combat dice.
const dronePrefix=e=>`${e.id}-drone-`;
export const ownDrones=(g,e)=>(g.enemies||[]).filter(d=>d.id.startsWith(dronePrefix(e)));
export const droneKind=(g,e,n)=>T.drones.kinds[hash(`${g.seed}:${g.floor}:${e.id}:${n}:drone-v1`)%T.drones.kinds.length];
// After its turn (ORDER.end; not its action): cooldown done, fewer than `live` of its own up, room on the floor, and a
// free tile beside it.
export function deployDrone(g,e){
 if(!deploysDrones(e)||!live(e)||!e.alert||(e.droneCooldown||0)>0||g.player.hp<=0||enemyRoom(g)<=0)return false;
 const mine=ownDrones(g,e);if(mine.filter(d=>d.hp>0).length>=T.drones.live)return false;
 const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(q=>g.passable(q.x,q.y)&&g.canCross(e,q)&&!occupied(g,q)&&!hazardTile(g,q.x,q.y));if(!spot)return false;
 // 3.207.0 review (Claude's call): an engineer that launches forever must not be a farm. Its drones pay nothing — no
 // xp, scrap, drops or protocol — as the matriarch's brood (expendable reinforcements, Game.hurt). 3.212.0 review: marked
 // before the rolls, so a drone never rolls elite.
 const n=mine.length,d=g.spawnEnemy(droneKind(g,e,n),spot.x,spot.y,`${dronePrefix(e)}${n}`,{expendable:true,reinforcement:true});
 d.alert=true;d.lastKnown=e.lastKnown?{...e.lastKnown}:{x:g.player.x,y:g.player.y};if(enemyDef(d)?.behavior==='munition')d.spawnTurn=g.turn;
 g.enemies.push(d);e.droneCooldown=T.drones.every;
 g.effects.push({type:'enemyTelegraph',phase:'flight',from:{x:e.x,y:e.y},to:{...spot},damage:0});
 g.log(t('operatives.droneLaunch',{enemy:enemyName(e),drone:enemyName(d)}),true);g.reveal();
 return true;
}
registerStep('end','drones',deployDrone);

// ---- 狂戰士: the cut that heals ----------------------------------------------------------------------------------------
// A blow of its own that took hit points off you (src/enemy-behavior.js attack; the grapple's cut goes through it too)
// heals it by a share of them. Only you (user: 砍中玩家時回血); the charge is a ram, not a cut.
export function drinkBlood(g,e,dealt){
 if(!drinksBlood(e)||e.hp<=0||!(dealt>0))return 0;
 const healed=healActor(e,Math.floor(dealt*T.lifesteal));
 if(healed>0){g.effects.push({type:'pulse',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},radius:.6,color:'#e05a5a',damage:0});g.log(t('operatives.lifesteal',{enemy:enemyName(e),n:healed}),true);}
 return healed;
}

// ---- 忍者: optical camouflage --------------------------------------------------------------------------------------
const has=(s,q)=>s.cells.some(c=>c.x===q.x&&c.y===q.y);
// Thin smoke: a vent's light smoke or steam, or a burning tile (it smokes like light smoke, src/vents.js hazeShot).
export const inHaze=(g,q)=>(g.fires||[]).some(f=>f.x===q.x&&f.y===q.y)||(g.smoke||[]).some(s=>HAZE_KINDS.includes(s.kind)&&has(s,q));
export const sameCloud=(g,a,b)=>(g.smoke||[]).some(s=>thick(s)&&has(s,a)&&has(s,b));
// Hidden from `watcher` (you or one of your units; Game.revealed, so drawing, targeting and the allies all obey it).
export function cloaked(g,watcher,e){
 if(!cloaks(e)||!(e.hp>0)||!watcher||e.decloaked)return false;
 if(activeTrait(e,'exposed')||distance(watcher,e)<=1||activeTrait(watcher,'infrared'))return false;
 return !inHaze(g,e)&&!sameCloud(g,watcher,e);
}
// Sharing a thick cloud with the one looking, it shows though the smoke hides everyone else there (Game.visible).
export const outlined=(g,watcher,e)=>Boolean(watcher&&cloaks(e)&&e.hp>0&&sameCloud(g,watcher,e));
// It shows the round it attacks, until its next turn begins (src/enemy-behavior.js attack sets it; the start step here
// clears it).
export const decloak=e=>{if(cloaks(e))e.decloaked=true;};
registerStep('start','cloak',(g,e)=>{if(e.decloaked)delete e.decloaked;});
// The officer's sensors: a living ninja your side cannot see, near you.
registerDetector({kind:'cloak',event:'cloakAlert',range:T.alert.range,cooldown:T.alert.cooldown,contacts:g=>(g.enemies||[]).filter(e=>cloaks(e)&&e.hp>0&&!g.teamVisible(e))});

// ---- last words ----------------------------------------------------------------------------------------------------
// After it falls, a speech bubble rises from where it lies (user; callouts otherwise only come from the living): one of
// its class's two lines, fixed by its serial. Presentation only (src/callout-ui.js shows it a moment after the fall).
export const LAST_WORDS=Object.freeze({
 soldier:['operatives.last.soldier.1','operatives.last.soldier.2'],recon:['operatives.last.recon.1','operatives.last.recon.2'],
 engineer:['operatives.last.engineer.1','operatives.last.engineer.2'],berserker:['operatives.last.berserker.1','operatives.last.berserker.2'],
 ninja:['operatives.last.ninja.1','operatives.last.ninja.2'],
});
export const lastWordsLine=e=>{const lines=LAST_WORDS[operativeClass(e)];return lines?lines[hash(`${operativeCodeOf(e)}:last-v1`)%lines.length]:null;};
export function lastWords(g,e){
 const line=lastWordsLine(e);if(!line)return null;
 const event={type:'callout',speaker:'operative',lastWords:true,actorId:e.id,enemyType:e.type,cue:'last_words',line,category:'last',priority:'high',visibility:'visible',position:{x:e.x,y:e.y},floor:g.floor,delayMs:T.lastWordsMs};   // floor: 3.207.0 review, it stays on its own floor
 g.effects.push(event);return event;
}

// ---- the shared rules and saves (src/enemy-specials.js) ------------------------------------------------------------
const exactly=(o,keys)=>Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys);
const tile=(q,grid)=>exactly(q,'x,y')&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&grid?.[q.y]?.[q.x]===1;
// The soldier's scan and grenade cooldowns: state only, counted down as each round starts; past today's tuning a save's
// number is cut to it (docs/CHECKLIST.md 3).
registerSpecial({id:'scan',intent:'scanCooldown',carries:scans,
 fields:{scanCooldown:{count:{max:()=>T.scan.cooldown,carrier:true,clamp:'cut'}}},
 tick:{cooldown:'scanCooldown',drop:()=>null},
});
registerSpecial({id:'toss',intent:'grenadeCooldown',carries:e=>Boolean(enemyDef(e)?.grenades),
 fields:{grenadeCooldown:{count:{max:()=>T.grenade.cooldown,carrier:true,clamp:'cut'}}},
 tick:{cooldown:'grenadeCooldown',drop:()=>null},
});
// The recon's throw, as the lob: warned, it turns on no decoy, shoots no mine, does not step off a hazard, and a pin
// drops it; a fall, a stun, a pin or being moved drops it and restarts the cooldown. Saves: a warning its recon could no
// longer give, or one past today's reach, is dropped (never refused), and a cooldown past the tuning is cut to it.
// 3.207.0 review: a throw farther than today's reach (a save from before the user shortened it) is dropped the same way.
const whole=q=>Boolean(q&&typeof q==='object'&&Number.isInteger(q.x)&&Number.isInteger(q.y));
const staleSmoke=e=>{const s=e.smokeIntent;return Boolean(s&&typeof s==='object'&&s.origin&&typeof s.origin==='object'&&(!(live(e)&&!pinned(e)&&at(e,s.origin))||whole(s.origin)&&whole(s.point)&&distance(s.origin,s.point)>T.smoke.range));};
registerSpecial({id:'smoke',intent:'smokeIntent',carries:throwsSmoke,
 fields:{
  smokeIntent:{valid:(s,e,f)=>throwsSmoke(e)&&live(e)&&exactly(s,'origin,point')&&tile(s.origin,f.grid)&&tile(s.point,f.grid)&&at(e,s.origin)},   // the reach is today's tuning: load.stale
  smokeCooldown:{count:{max:()=>T.smoke.cooldown,carrier:true,clamp:'cut'}},
 },
 interrupt:{on:['death','disabled','displaced','suppressed'],cooldown:'smokeCooldown'},
 tick:{cooldown:'smokeCooldown',drop:e=>e.hp<=0?'death':e.control?.disabled?'disabled':pinned(e)?'suppressed':null},
 blocks:{decoy:true,mine:true,stepOff:true,pin:true},
 load:{stale:staleSmoke,restart:'smokeCooldown'},
 card:(g,e)=>[e.smokeIntent?t('target-card.smokeReady'):''],
});
// The engineer's drone clock: state only; its drones are ordinary enemies, checked with the rest (validOperatives).
registerSpecial({id:'drones',intent:'droneCooldown',carries:deploysDrones,
 fields:{droneCooldown:{count:{max:()=>T.drones.every,carrier:true,clamp:'cut'}}},
 tick:{cooldown:'droneCooldown',drop:()=>null},
});
// The ninja just showed itself (it attacked this round); its fall clears it. Saves: only on a ninja, only while it stands.
registerSpecial({id:'cloak',intent:'decloaked',carries:cloaks,
 fields:{decloaked:{valid:(v,e)=>v===true&&cloaks(e)&&e.hp>0}},
 interrupt:{on:['death']},   // gone with the body (a save could not keep it: the loader drops it on a fallen ninja)
 load:{stale:e=>e.decloaked!==undefined&&!(e.hp>0)},
 card:(g,e)=>[cloaks(e)?t(e.decloaked?'target-card.decloaked':'target-card.cloaked'):''],
});
// Game.restore: the specials above are trimmed and checked with every other (dropStaleSpecials, validSpecials); besides,
// a scan on you or your units longer than today's tuning is cut to it (never refused), and a serial sits only on an
// operative, in the clone format — on this floor and every one kept on a round trip. The engineer's drones need no check
// of their own (ordinary enemies with unique ids: src/runtime-enemies.js validRuntime).
export function dropStaleOperatives(g){
 for(const u of [g.player,...(g.allies||[])])for(const s of u?.traits||[])if(s.id===SCANNED&&Number.isSafeInteger(s.turns)&&s.turns>T.scan.turns)s.turns=T.scan.turns;
}
export function validOperatives(g){
 for(const f of frames(g))for(const e of f.enemies||[])if(e.code!==undefined&&!(isOperative(e)&&validOperativeCode(e.code)))return false;
 return [g.player,...(g.allies||[])].every(u=>!(u?.traits||[]).some(s=>s.id===SCANNED&&(s.source!==SCAN_SOURCE||!Number.isInteger(s.turns))));
}
export const tickOperatives=g=>tickSpecials(g,[['scan','toss','smoke','drones']]);
