// First-bullet pursuit (3.208.0, user decision 2026-09-30; docs/CORE_RULES.md 3.69, docs/MAPGEN.md 5.3). A kill earns
// the pursuit token (Game.hurt) only on the first round of the attack that made it. Every player attack that can fire
// more than one round per action — a burst from fire() (blind fire goes through it, the launcher's rounds too), the
// suppressive fire skill, a chainsaw's cuts — runs each round through `attackRound`; the rounds after the first are
// follow-ups, and whatever a round does belongs to it: its splash, its over-penetration, its blast, a barrel it sets off.
// A single-projectile attack never calls it, so it is always the first: a shotgun shell (all its pellets), a lance beam,
// a grenade, a mine, a flamethrower spray, a blow or a thrust. An anchored bulwark's second attack is an attack of its
// own, with a first round of its own. Import-free; the scope is never serialized (like the shot scope in suppression.js).
const followUps=new WeakSet();
export function attackRound(g,index,fn){
 const outer=followUps.has(g);if(index>0)followUps.add(g);
 try{return fn();}finally{if(!outer)followUps.delete(g);}
}
// True while a round after an attack's first is being resolved.
export const followUpRound=g=>followUps.has(g);
