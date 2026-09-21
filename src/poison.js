import {SWARM_TUNING as T} from './swarm-tuning.js';
import {activeTrait} from './traits.js';
export function clearPoison(p){p.poison=0;delete p.poisonClock;}
// 3.158.0 (user decision, NetHack's barbarian): an immune actor never gains a stack, and one poisoned before it gained the
// passive (a save from an older build) is cleared on its next tick. The answer tells callers which message to write.
export const poisonImmune=p=>activeTrait(p,'poison_immunity');
export function addPoison(p,amount=T.poisonHitStacks){if(poisonImmune(p))return false;p.poison=Math.min(T.poisonCap,(p.poison||0)+amount);return true;}
export function tickPoison(g){const p=g.player;if(p.poison&&poisonImmune(p))clearPoison(p);if(!p.poison){delete p.poisonClock;return;}
 // Sealed protection blunts poison by one point per tier (user decision, 3.85.2); floor hazards keep the full hazmat value.
 const damage=Math.max(0,p.poison*T.poisonDamage-Math.floor((p.hazmat||0)/T.hazmatPerPoisonPoint));p.hp-=damage;
 if(damage)g.log(`中毒傷害 −${damage}。`,true,'中毒造成傷害。');
 p.poisonClock=(p.poisonClock||0)+1;if(p.poisonClock>=T.poisonDecayTurns){delete p.poisonClock;p.poison--;}
}
export function migratePoison(p){if(!Number.isSafeInteger(p.poison)||p.poison<0||p.poison>6)return false;p.poison=Math.min(T.poisonCap,Math.ceil(p.poison/2));delete p.poisonClock;return true;}
export const validPoison=p=>Number.isSafeInteger(p.poison)&&p.poison>=0&&p.poison<=T.poisonCap&&(p.poisonClock===undefined||p.poison>0&&Number.isSafeInteger(p.poisonClock)&&p.poisonClock>0&&p.poisonClock<T.poisonDecayTurns);
