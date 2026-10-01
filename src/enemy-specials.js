// Enemy specials (3.206.1; docs/CHECKLIST.md 2): every telegraphed enemy action declares here, once, what the shared
// rules need to know of it — the fields it owns, who may carry it, what interrupts it, which cooldown the round start
// counts down, what it keeps a unit from doing (turning on a decoy, shooting a mine, stepping off a hazard, being pinned
// out of it), and how a save is trimmed and checked. The turn (src/enemy-behavior.js), the round start and the loader
// (Game: src/game-actions.js, src/game-enemies.js, src/game-save.js since 3.206.3), the decoy and the mine
// (src/field-gear.js), the hazard step (src/hazard-paths.js), suppression,
// interruptions (src/enemy-intents.js) and the target card ask here instead of keeping lists of their own.
// A leaf, like src/behavior-tree.js: it imports nothing. The module that owns a special registers it, beside the
// wrappers it exports (src/fire.js the flame, src/swarm.js the tongue, and so on); steps are that module's functions,
// run at a fixed point of the turn. All ordering lives in ORDER, never in import order.
// Changing ORDER or a declaration is a rule change: the special matrices (qa/special-matrix.mjs) and the save-fuzz trace
// move with it.
const F=Object.freeze;
export const INTERRUPT_REASONS=F(['death','disabled','displaced','target_lost','suppressed']);
export const ORDER=F({
 // Every special, in the order an interruption clears them and a save is trimmed. 3.212.0: 'deploy', a deployer's kind
 // and charges (src/enemy-behavior.js; state only, it neither interrupts nor ticks).
 ids:F(['grenade','flame','tongue','pounce','lob','charge','nest','mark','gun','fire','burn','vent','scan','toss','smoke','drones','cloak','deploy']),
 // Game.enemyAct, before the decoy and the mine: each runs (a mark landing, an egg hatching; 3.207.0: a delisted soldier's
 // early warning, a delisted ninja fading back into its camouflage); none is the unit's action.
 start:F(['mark','nest','scan','cloak']),
 // executeEnemyTree, before an order, a survival walk or anything else can move the unit: the first that acts ends the
 // turn. 'rebel' and 'swarm' are the bosses' own steps (src/rebel-bosses.js, src/swarm-bosses.js), each covering several;
 // 'smoke' the delisted recon's throw (3.207.0, src/delisted-operatives.js).
 top:F(['flame','grenade','rebel','gun','swarm','pounce','lob','smoke']),
 // After the orders, in place of the affix branches and the shot.
 attack:F(['flame']),
 // The enforcer's rally (src/rebels.js advanceCharge): a special primed to go off early.
 rally:F(['grenade']),
 // 3.207.0: Game.enemyAct, after the unit's turn (whatever took it: its tree, a decoy, a mine): each runs (a delisted
 // engineer's drone); none is the unit's action.
 end:F(['drones']),
 // The round start (Game.action): one pass over the enemies per group, cooldowns first, then the drops.
 tick:F([F(['tongue']),F(['charge','nest']),F(['pounce']),F(['lob']),F(['scan','toss','smoke','drones'])]),
 // The target card's lines, after 「即將攻擊」 (3.206.2: the grenade, the marked cone, the pounce and the lob first).
 card:F(['grenade','flame','pounce','lob','mark','gun','tongue','charge','nest','fire','vent','burn','smoke','cloak']),
});
// A declaration (registerSpecial):
//  id, intent (the field that holds the warning), carries(e) (the cards or affixes that may hold it),
//  fields: {name: {valid(value,e,frame,turn)} | {count:{max(),min,carrier,clamp}} | {scope:'actor',valid(value,actor,point)}}
//    — each field has one owner; `count` is a whole number from min (0) to max(), only on a carrier when `carrier`;
//    `clamp`: a save's number past today's tuning is cut to it ('cut'), or dropped when the tuning is under 1 ('drop').
//  interrupt: {on:[reasons], cooldown:'field' (dropped only when set, and the cooldown restarts at its max), run(actor,reason)}
//  tick: {cooldown:'field', drop(e) → the reason to interrupt, or null}
//  blocks: {decoy, mine, stepOff, pin}: true (while the intent is set) or a function of the unit
//  load: {clamp(e), stale(e) → drop the intent, restart:'cooldown field', enemy(e,frame,turn), game(g)}
//  rotation: the values `special` may take on its carriers; lock(e): the target id it holds the unit to;
//  gunless(e): no gun to hold on anyone (squads, the ambush watch, the rally); card(g,e,aim): target-card lines.
// A step (registerStep): the owning module's function run at its point of the turn, and for a top step the units it can
// act for (`carries`: tests/enemy-specials.test.mjs checks that no unit is carried by two top steps).
const SPECIALS=new Map(),STEPS=Object.fromEntries(['start','top','attack','rally','end'].map(k=>[k,new Map()])),CARRIERS=new Map();
// 3.206.2: a declaration holds only what the registry reads, so a number of its own (the lob's old literal 10) cannot hide in it.
const KEYS=F({'':['id','intent','carries','fields','interrupt','tick','blocks','load','rotation','lock','gunless','card'],interrupt:['on','cooldown','run'],tick:['cooldown','drop'],blocks:['decoy','mine','stepOff','pin'],load:['clamp','stale','restart','enemy','game'],field:['valid','count','scope'],count:['max','min','carrier','clamp']});
const unknown=(o,kind)=>Object.keys(o||{}).filter(k=>!KEYS[kind].includes(k));
export function registerSpecial(s){
 if(!ORDER.ids.includes(s.id)||SPECIALS.has(s.id))throw new Error(`special ${s.id}: not in ORDER.ids, or declared twice`);
 const extra=[...unknown(s,''),...['interrupt','tick','blocks','load'].flatMap(k=>unknown(s[k],k).map(x=>`${k}.${x}`)),...Object.entries(s.fields||{}).flatMap(([k,d])=>[...unknown(d,'field'),...unknown(d.count,'count')].map(x=>`${k}.${x}`))];
 if(extra.length)throw new Error(`special ${s.id}: unknown ${extra.join(', ')}`);
 for(const o of SPECIALS.values())for(const k in s.fields||{})if(k in o.fields)throw new Error(`${k}: owned by ${o.id} and ${s.id}`);
 if(s.interrupt&&!s.interrupt.on.every(r=>INTERRUPT_REASONS.includes(r)))throw new Error(`${s.id}: unknown interrupt reason`);
 if(s.interrupt?.cooldown&&!s.fields?.[s.interrupt.cooldown]?.count)throw new Error(`${s.id}: interrupt cooldown is not a count field`);
 SPECIALS.set(s.id,F({fields:{},...s}));
}
export function registerStep(step,id,run,carries){if(!ORDER[step]?.includes(id)||STEPS[step].has(id))throw new Error(`step ${step} ${id}: not in ORDER, or registered twice`);if(step==='top'&&typeof carries!=='function')throw new Error(`top step ${id}: say whom it carries`);STEPS[step].set(id,run);if(carries)CARRIERS.set(id,carries);}
export const topCarriers=e=>ORDER.top.filter(id=>CARRIERS.get(id)?.(e));
// What is registered (tests/enemy-specials.test.mjs checks it against ORDER).
export const registered=()=>({specials:[...SPECIALS.keys()],steps:Object.fromEntries(Object.entries(STEPS).map(([k,m])=>[k,[...m.keys()]]))});
export const specialDef=id=>SPECIALS.get(id)||null;
export const pick=(ids=ORDER.ids)=>ids.map(id=>SPECIALS.get(id)).filter(Boolean);
export const specialsOf=e=>pick().filter(s=>s.carries?.(e));
export const countMax=(s,k)=>s.fields[k].count.max();

// ---- the turn ------------------------------------------------------------------------------------------------------
export function startSpecials(g,e){for(const id of ORDER.start)STEPS.start.get(id)?.(g,e);}
export function endSpecials(g,e){for(const id of ORDER.end)STEPS.end.get(id)?.(g,e);}
// The first step that takes the turn ends it (the steps short-circuit as `||` did).
export const runStep=(step,ctx)=>ORDER[step].some(id=>STEPS[step].get(id)?.(ctx));
export function rallySpecial(g,e){for(const id of ORDER.rally){const r=STEPS.rally.get(id)?.(g,e);if(r)return r;}return null;}
export const lockedTarget=e=>{for(const s of pick()){const id=s.lock?.(e);if(id)return id;}return undefined;};
// Does any special the unit holds keep it from `what` (decoy, mine, stepOff, pin)?
export const blocked=(e,what)=>pick().some(s=>{const b=s.blocks?.[what];return b===true?Boolean(e[s.intent]):typeof b==='function'&&Boolean(b(e));});
export const gunless=e=>pick().some(s=>Boolean(s.gunless?.(e)));
// 3.206.2 (docs/CHECKLIST.md 2): a special that goes off in place of the shot leaves no shot wound up behind it — one
// held for it by a squad's 已就緒 or a watch order would otherwise stay (a lasting 「!」, or the enforcer's rally firing it).
export const dropAttack=e=>{e.charge=false;e.aim=null;e.windup=1;};

// ---- saves ---------------------------------------------------------------------------------------------------------
// This floor and every kept one; a kept floor's turn is the one it was left on.
export const frames=g=>[g,...Object.values(g.floorStates||{})];
const turnOf=(g,f)=>f===g?g.turn:Number.isSafeInteger(f.savedTurn)?f.savedTurn:g.turn;
const counted=(c,v,e,s)=>(!c.carrier||Boolean(s.carries(e)))&&Number.isSafeInteger(v)&&v>=(c.min??0)&&v<=c.max();
// Before the checks: numbers past today's tuning are cut to it, then a warning its unit could no longer give (fallen,
// stunned, moved outside its own turn) is dropped, as the unit itself would drop it — never a reason to refuse the run.
export function dropStaleSpecials(g,ids){
 const list=pick(ids);
 for(const f of frames(g))for(const e of f.enemies||[]){
  for(const s of list){
   for(const k in s.fields){const c=s.fields[k].count;if(!c?.clamp||!Number.isSafeInteger(e[k])||e[k]<=c.max())continue;if(c.clamp==='cut'||c.max()>=1)e[k]=c.max();else delete e[k];}
   s.load?.clamp?.(e);
  }
  for(const s of list)if(s.load?.stale?.(e)){delete e[s.intent];const k=s.load.restart;if(k)e[k]=countMax(s,k);}
 }
}
export function validSpecials(g,ids){
 const list=pick(ids),rotating=list.some(s=>s.rotation);
 for(const f of frames(g)){
  const turn=turnOf(g,f);
  for(const e of f.enemies||[]){
   for(const s of list){
    for(const k in s.fields){const d=s.fields[k],v=e[k];if(v===undefined||d.scope==='actor')continue;if(!(d.count?counted(d.count,v,e,s):d.valid(v,e,f,turn)))return false;}
    if(s.load?.enemy&&!s.load.enemy(e,f,turn))return false;
   }
   if(rotating&&e.special!==undefined&&!specialsOf(e).some(s=>s.rotation?.includes(e.special)))return false;
  }
 }
 return list.every(s=>!s.load?.game||s.load.game(g));
}
// A unit's own fields checked as the loader reads them (Game.restore's early actor pass: the player, this floor's
// enemies, the allies), with the loader's own point check.
export const validActorSpecials=(a,point)=>pick().every(s=>Object.entries(s.fields).every(([k,d])=>d.scope!=='actor'||a[k]===undefined||d.valid(a[k],a,point)));

// ---- the target card -----------------------------------------------------------------------------------------------
export const specialCard=(g,e,aim)=>ORDER.card.flatMap(id=>SPECIALS.get(id)?.card?.(g,e,aim)||[]);
