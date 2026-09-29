// Loyalist bosses (3.204.0, user design 2026-09-29; docs/BOSSES.md sections 1-2): the soldier's early warning turned
// on you, and a machine gun. The warning stays, being caught costs a lot, and each has an answer in where you stand.
// 標定 (the mark), 標定官 on floor 3 and 火線官 on floor 6:
// - The boss paints you with a laser when it sees you (`markIntent`; the line from it to you is drawn from the game state).
//   The round after, on its turn, the mark lands wherever you are — smoke and breaking its sight do not help (user):
//   the `designated` trait on you for the rest of that round and the next three. Meanwhile every enemy's shot or blow at
//   you gets +15 to hit and +20% damage (blasts and fire roll nothing and stay as they are: Claude's call). The mark
//   outlives the boss and ends on another floor.
// - Disabled (an EMP: both are machines, a stun grenade does nothing), pulled or killed while painting, the boss drops
//   it (src/enemy-intents.js, like any telegraph); losing sight of you does not.
// - It paints again from the second round after a mark ends (`markReady`; Claude's cooldown: two clear rounds).
// 架槍 (the machine gun), 火線官 only, taking turns with the mark (`special` names the one it tries first):
// - One round of warning: a 90-degree cone, range 7, toward its target (`gun` stage 'set'). Then three rounds sweeping
//   it (stage 'sweep', `left` sweeps to come): every target in the cone the gun can see takes a low-damage burst of
//   five rounds, and everyone in the cone takes a suppression stack each round, hit or not (a hit adds the belt's usual
//   stack; three stacks pin, docs/SUPPRESSION.md).
// - Set up, it cannot move or turn, and a shot or blow from outside the cone gets +15 on it. After the third sweep it
//   packs up for two rounds (stage 'pack': no shot, no mark, no new gun), and only then can it set up again. 3.205.0 (user
//   2026-09-29, 收槍的冷卻時間可以移動): while it packs up it may walk, as any unit walks (3.204.0 had it stand still).
// - Disabled, pulled or killed while it sets up, the gun is dropped; during the sweep it packs up at once.
// - Neither special starts in the round a mark lands or while a shot is charged, so between them both attack as the
//   chassis they share (the warden's, the core guard's). Both call drones at half health, unannounced, as before.
import {t} from './i18n.js';
import {distance,lineOfSight} from './world.js';
import {seeThrough} from './data.js';
import {objectSightGrid} from './scenery.js';
import {inCone} from './shotgun.js';
import {grantTrait,hasTrait,removeTraitSource} from './traits.js';
import {finishSuppression} from './suppression.js';
import {scaleEnemy,floorDamageBonus} from './endless.js';
import {enemyDef} from './enemy-data.js';
import {enemyDisplayName as enemyName} from './enemy-affixes.js';
import {hazardTile} from './hazard-paths.js';

// The user tunes these after playtesting (docs/BOSSES.md section 2).
export const BOSS_TUNING=Object.freeze({
 mark:Object.freeze({accuracy:15,damage:.2,turns:3,cooldown:2}),
 gun:Object.freeze({halfAngle:45,range:7,sweeps:3,packUp:2,rounds:5,damage:12,flank:15,stacks:1}),
});
export const DESIGNATED='designated',MARK_SOURCE='boss:mark';
const specials=e=>enemyDef(e)?.specials||[];
export const marksYou=e=>specials(e).includes('mark');
export const setsGun=e=>specials(e).includes('gun');
const live=e=>e?.hp>0&&!e.control?.disabled;

// ---- the mark ------------------------------------------------------------------------------------------------------
export const liveMarkIntent=e=>Boolean(e?.markIntent&&live(e));
export const designated=p=>hasTrait(p,DESIGNATED);
// The rounds it still holds, as the status line shows them (the landing round's rest is not counted).
export const designatedTurns=p=>Math.min(BOSS_TUNING.mark.turns,(p?.traits||[]).find(s=>s.id===DESIGNATED)?.turns||0);
// A mark that landed this round set the cooldown this round (so nothing else starts on the landing turn).
// 3.206.0: exported for the rebel floor-6 boss, which marks the same way (src/rebel-bosses.js).
export const landedNow=(g,e)=>e.markReady===g.turn+BOSS_TUNING.mark.turns+BOSS_TUNING.mark.cooldown+1;
// Enemies at a marked you (src/combat.js shotChance, Game.meleeAccuracy, Game.damagePlayer).
export const markAccuracy=(g,attacker,target)=>target===g.player&&attacker!==target&&Boolean(g.enemies?.includes(attacker))&&designated(target)?BOSS_TUNING.mark.accuracy:0;
export const markDamage=(g,attacker)=>attacker&&g.enemies?.includes(attacker)&&designated(g.player)?1+BOSS_TUNING.mark.damage:1;
export function paintMark(g,e){
 const p=g.player;e.markIntent={since:g.turn};
 g.effects.push({type:'bossTelegraph',kind:'mark',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});
 g.enemyCallout(e,'telegraph',{action:'aim'});g.log(t('bosses.markPaint',{enemy:enemyName(e)}),true);
}
// On the boss's turn, before anything else it does (Game.enemyAct, so a decoy cannot put it off): the mark lands on you
// wherever you are. The boss goes on with its turn.
export function landMark(g,e){
 if(!e.markIntent)return false;
 delete e.markIntent;
 const p=g.player,M=BOSS_TUNING.mark;if(!live(e)||p.hp<=0)return false;
 removeTraitSource(p,MARK_SOURCE);grantTrait(p,DESIGNATED,MARK_SOURCE,M.turns+1);
 e.markReady=g.turn+M.turns+M.cooldown+1;
 g.effects.push({type:'bossTelegraph',kind:'marked',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});
 g.log(t('bosses.marked',{enemy:enemyName(e),turns:M.turns,accuracy:M.accuracy,damage:Math.round(M.damage*100)}),true);
 return true;
}
// Another floor ends it (Game.descend).
export const clearDesignation=p=>removeTraitSource(p,MARK_SOURCE);

// ---- the machine gun -----------------------------------------------------------------------------------------------
export const gunDeployed=e=>Boolean(e?.gun&&(e.gun.stage==='set'||e.gun.stage==='sweep'));
export const liveGun=e=>Boolean(gunDeployed(e)&&live(e)&&e.gun.origin?.x===e.x&&e.gun.origin?.y===e.y);
// The cone: out to the range (the game's step distance), within 45 degrees of the aim, along a line a bullet would
// pass (walls, closed doors and partitions stop it; crates and low partitions do not — cover still counts on the roll).
export function gunCells(g,from,aim){
 const T=BOSS_TUNING.gun,out=[];if(!aim||(aim.x===from.x&&aim.y===from.y))return out;
 for(let y=from.y-T.range;y<=from.y+T.range;y++)for(let x=from.x-T.range;x<=from.x+T.range;x++){
  const q={x,y},d=distance(from,q);
  if(!d||d>T.range||!seeThrough(g.grid[y]?.[x])||!inCone(from,aim,q,T.halfAngle))continue;
  if(lineOfSight(objectSightGrid(g,from,q),from,q,g.barriers||[],'shot'))out.push(q);
 }
 return out.sort((a,b)=>distance(from,a)-distance(from,b)||a.y-b.y||a.x-b.x);
}
export const inGun=(g,e,q)=>gunDeployed(e)&&gunCells(g,e.gun.origin,e.gun.aim).some(c=>c.x===q.x&&c.y===q.y);
// Outside the cone is the angle alone: a shooter straight ahead but out of the gun's reach is still in front of it.
export const gunFlank=(g,attacker,target)=>gunDeployed(target)&&attacker&&attacker!==target&&(attacker.x!==target.x||attacker.y!==target.y)&&!inCone(target.gun.origin,target.gun.aim,attacker,BOSS_TUNING.gun.halfAngle)?BOSS_TUNING.gun.flank:0;
// Both bonuses, for the melee roll (Game.meleeAccuracy); shotChance adds them one by one.
export const bossAccuracy=(g,attacker,target)=>markAccuracy(g,attacker,target)+gunFlank(g,attacker,target);
function deployGun(g,e,target){
 e.gun={stage:'set',origin:{x:e.x,y:e.y},aim:{x:target.x,y:target.y}};
 e.charge=false;e.aim=null;e.windup=1;   // no aimed shot is left standing on the bipod
 g.effects.push({type:'bossTelegraph',kind:'gun',from:{x:e.x,y:e.y},to:{x:target.x,y:target.y},damage:0});
 g.enemyCallout(e,'telegraph',{action:'attack'});g.log(t('bosses.gunSet',{enemy:enemyName(e)}),true);
}
const shotFx=(e,u,miss)=>({type:'enemyShot',attackerType:e.type,weaponId:'lmg',style:'bullet',from:{x:e.x,y:e.y},to:{x:u.x,y:u.y},damage:0,...(miss?{miss:true}:{})});
// One sweep: a burst at every target in the cone the gun can see, then a stack for everyone in it.
export function sweepGun(g,e){
 const T=BOSS_TUNING.gun,{origin,aim}=e.gun,cells=new Set(gunCells(g,origin,aim).map(q=>`${q.x},${q.y}`));
 const inside=[g.player,...g.activeAllies].filter(u=>u.hp>0&&cells.has(`${u.x},${u.y}`)),hits=new Set();
 const total=scaleEnemy(T.damage+floorDamageBonus(g.floor,g.difficultySpec),g.floor,'damage',g.difficultySpec);
 g.log(t('bosses.gunSweep',{enemy:enemyName(e)}),true);
 for(const u of inside){
  if(!g.sight(e,u))continue;   // unseen (smoke, the dark): pinned down all the same, but not shot
  g.recordExposure(e,u);
  for(let n=0;n<T.rounds&&u.hp>0;n++){
   const before=u.hp,damage=Math.max(1,Math.floor(total/T.rounds)+(n<total%T.rounds?1:0));
   if(g.rng()*100<g.accuracy(e,u).chance){
    if(u===g.player){const at=g.effects.length;g.damagePlayer(damage,t('enemy-behavior.attackSource',{enemy:enemyName(e)}),e);for(const fx of g.effects.slice(at))if(fx.type==='enemyShot')Object.assign(fx,{weaponId:'lmg',style:'bullet'});}
    else{g.effects.push(shotFx(e,u,false));g.damageAlly(u,damage,e);}
   }else g.effects.push(shotFx(e,u,true));
   if(u.hp<before)hits.add(u);
  }
 }
 finishSuppression(inside,hits,T.rounds,T.stacks,g);
}
// The gun's part of the boss's turn: sweeping, or packing up (3.205.0: `walk`, the tree's own walk, takes it where it
// would go — off a hazard first — and nothing else). False when there is nothing to do with it.
function gunTurn(g,e,walk){
 const gun=e.gun,T=BOSS_TUNING.gun;
 if(gun.stage==='pack'){if(gun.left>1)gun.left--;else delete e.gun;walk?.();return true;}
 if(e.x!==gun.origin.x||e.y!==gun.origin.y){delete e.gun;return false;}   // off its mount without being stopped: gone
 sweepGun(g,e);
 const left=(gun.stage==='set'?T.sweeps:gun.left)-1;
 if(left>0)e.gun={stage:'sweep',origin:gun.origin,aim:gun.aim,left};
 else if(T.packUp>0){e.gun={stage:'pack',left:T.packUp};g.log(t('bosses.gunPack',{enemy:enemyName(e),n:T.packUp}),true);}
 else delete e.gun;
 return true;
}
// What stops a telegraph stops these (src/enemy-intents.js): the paint is dropped, a gun being set up is dropped, a
// sweeping gun packs up; losing sight of you (and being suppressed, which a boss resists) changes nothing.
export function interruptBoss(actor,reason){
 if(reason==='target_lost'||reason==='suppressed')return;
 delete actor.markIntent;
 if(reason==='death'||actor.gun?.stage==='set')delete actor.gun;
 else if(actor.gun?.stage==='sweep')actor.gun={stage:'pack',left:BOSS_TUNING.gun.packUp};
 if(actor.gun?.stage==='pack'&&!(actor.gun.left>0))delete actor.gun;
}

// ---- the turn (src/enemy-behavior.js: the trees' `special` step, after the boss has looked around) --------------------
const order=e=>setsGun(e)?(e.special==='gun'?['gun','mark']:['mark','gun']):specials(e);
export const canPaint=(g,e)=>marksYou(e)&&!e.markIntent&&g.turn>=(e.markReady??0)&&g.player.hp>0&&g.sight(e,g.player);
const canDeploy=(g,e,p,los)=>setsGun(e)&&!e.gun&&!landedNow(g,e)&&los&&p.hp>0&&distance(e,p)<=BOSS_TUNING.gun.range&&gunCells(g,e,p).some(q=>q.x===p.x&&q.y===p.y);
// `after` is the tree's own after-step (the drone call), run when the special took the turn; `walk` (3.205.0) is its
// plain walk, for the pack-up rounds.
export function bossSpecial(ctx,after,walk){
 const {g,e,p,los}=ctx;
 if(e.gun&&gunTurn(g,e,()=>walk?.(ctx))){if(e.hp>0)after?.(ctx);return true;}
 if(e.charge||hazardTile(g,e.x,e.y,e))return false;   // a charged shot goes first; off a hazard before anything
 for(const kind of order(e)){
  if(kind==='mark'&&canPaint(g,e))paintMark(g,e);
  else if(kind==='gun'&&canDeploy(g,e,p,los))deployGun(g,e,p);
  else continue;
  if(setsGun(e))e.special=kind==='mark'?'gun':'mark';
  if(e.hp>0)after?.(ctx);return true;
 }
 return false;
}

// ---- saves ---------------------------------------------------------------------------------------------------------
// A paint or a set-up gun left on a boss that has since fallen, been stunned or been moved outside its own turn is
// dropped when a save loads, as the boss itself would drop it (the 3.203.0 lesson: never refuse a run over one).
export function dropStaleBossIntents(g){
 for(const f of [g,...Object.values(g.floorStates||{})])for(const e of f.enemies||[]){
  if(e.markIntent!==undefined&&!live(e))delete e.markIntent;
  const s=e.gun;
  if(s&&typeof s==='object'&&(s.stage==='set'||s.stage==='sweep')&&s.origin&&typeof s.origin==='object'&&!(live(e)&&s.origin.x===e.x&&s.origin.y===e.y))delete e.gun;
 }
}
const exactly=(o,keys)=>Boolean(o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join()===keys);
const cell=(q,grid)=>exactly(q,'x,y')&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&seeThrough(grid?.[q.y]?.[q.x]);
function validGun(e,grid){
 const s=e.gun,T=BOSS_TUNING.gun;if(!setsGun(e))return false;
 if(s?.stage==='pack')return exactly(s,'left,stage')&&Number.isInteger(s.left)&&s.left>=1&&s.left<=T.packUp;
 const set=s?.stage==='set';
 return (set||s?.stage==='sweep')&&exactly(s,set?'aim,origin,stage':'aim,left,origin,stage')&&cell(s.origin,grid)&&cell(s.aim,grid)&&(s.aim.x!==s.origin.x||s.aim.y!==s.origin.y)&&
  s.origin.x===e.x&&s.origin.y===e.y&&live(e)&&(set||Number.isInteger(s.left)&&s.left>=1&&s.left<T.sweeps);
}
// This floor and every kept one (their own turn is the one they were left on); the mark only ever sits on you.
export function validLoyalistBosses(g){
 const M=BOSS_TUNING.mark;
 for(const f of [g,...Object.values(g.floorStates||{})]){
  const turn=f===g?g.turn:Number.isSafeInteger(f.savedTurn)?f.savedTurn:g.turn;
  for(const e of f.enemies||[]){
   if(e.markIntent!==undefined&&!(marksYou(e)&&exactly(e.markIntent,'since')&&Number.isSafeInteger(e.markIntent.since)&&e.markIntent.since>=1&&e.markIntent.since<=turn&&live(e)))return false;
   if(e.markReady!==undefined&&!(marksYou(e)&&Number.isSafeInteger(e.markReady)&&e.markReady>=1&&e.markReady<=turn+M.turns+M.cooldown+1))return false;
   // 3.206.0: `special` on a card without the gun is the rebel bosses' to check (src/rebel-bosses.js validRebelBosses).
   if(e.special!==undefined&&setsGun(e)&&!(e.special==='mark'||e.special==='gun'))return false;
   if(e.gun!==undefined&&!validGun(e,f.grid))return false;
   if(e.traits?.some(s=>s.id===DESIGNATED))return false;
  }
 }
 if((g.allies||[]).some(a=>a.traits?.some(s=>s.id===DESIGNATED)))return false;
 const marks=(g.player?.traits||[]).filter(s=>s.id===DESIGNATED);
 return marks.length<=1&&marks.every(s=>s.source===MARK_SOURCE&&Number.isInteger(s.turns)&&s.turns>=1&&s.turns<=M.turns+1);
}
