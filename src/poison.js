import {SWARM_TUNING as T} from './swarm-tuning.js';
export function clearPoison(p){p.poison=0;delete p.poisonClock;}
export function addPoison(p,amount=T.poisonHitStacks){p.poison=Math.min(T.poisonCap,(p.poison||0)+amount);}
export function tickPoison(g){const p=g.player;if(!p.poison){delete p.poisonClock;return;}const damage=Math.max(0,p.poison*T.poisonDamage-(p.hazmat||0));p.hp-=damage;
 if(damage)g.log(`中毒傷害 −${damage}。`,true,'中毒造成傷害。');
 p.poisonClock=(p.poisonClock||0)+1;if(p.poisonClock>=T.poisonDecayTurns){delete p.poisonClock;p.poison--;}
}
export function migratePoison(p){if(!Number.isSafeInteger(p.poison)||p.poison<0||p.poison>6)return false;p.poison=Math.min(T.poisonCap,Math.ceil(p.poison/2));delete p.poisonClock;return true;}
export const validPoison=p=>Number.isSafeInteger(p.poison)&&p.poison>=0&&p.poison<=T.poisonCap&&(p.poisonClock===undefined||p.poison>0&&Number.isSafeInteger(p.poisonClock)&&p.poisonClock>0&&p.poisonClock<T.poisonDecayTurns);
