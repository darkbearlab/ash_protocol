// One aggregate application per attack, after all source contributions are known.
export const SUPPRESSION_TUNING={max:5,pinned:3,accuracy:8,weaponRounds:3,weaponStacks:1,skillRounds:3,skillStacks:1,skillAccuracy:20,rapidAccuracy:10};
const mechanical=a=>a?.traits?.some(t=>t.id==='mechanical');
export const suppressionStacks=a=>mechanical(a)?0:(a?.suppression||0);
export const suppressionPenalty=a=>suppressionStacks(a)*SUPPRESSION_TUNING.accuracy;
export const pinned=a=>suppressionStacks(a)>=SUPPRESSION_TUNING.pinned;
export function applySuppression(actor,stacks){
 if(mechanical(actor)){actor.suppression=0;return 0;}
 if(actor.hp<=0)return 0;
 const amount=Math.max(0,stacks-(['boss','warden'].includes(actor.type)?1:0)),before=suppressionStacks(actor);
 if(!amount)return 0;
 actor.suppression=Math.min(SUPPRESSION_TUNING.max,before+amount);return actor.suppression-before;
}
export function finishSuppression(targets,hits,rounds,skillStacks=0){
 for(const actor of new Set([...targets,...hits]))applySuppression(actor,(targets.includes(actor)?skillStacks:0)+(rounds>=SUPPRESSION_TUNING.weaponRounds&&hits.has(actor)?SUPPRESSION_TUNING.weaponStacks:0));
}
export function tickSuppression(actor){if(actor.suppression!==undefined)actor.suppression=Math.floor(suppressionStacks(actor)/2);}
export const validSuppression=a=>a.petSuppressed===undefined&&(a.suppression===undefined||(Number.isInteger(a.suppression)&&a.suppression>=0&&a.suppression<=5&&(!mechanical(a)||a.suppression===0)));
export const suppressionState=a=>({stacks:suppressionStacks(a),max:5,accuracyPenalty:suppressionPenalty(a),immobile:pinned(a),immune:Boolean(mechanical(a))});
export function migrateSuppression(data){
 for(const actor of [data.player,...data.enemies,...(data.allies||[]),...Object.values(data.floorStates||{}).flatMap(f=>f.enemies||[])]){delete actor.petSuppressed;delete actor.suppression;}
 data.player.learningItems={};
}
// Transient shot scope also covers barrel chain reactions; never serialized.
const damageScopes=new WeakMap();
export function withShotTargets(g,targets,fn){const previous=damageScopes.get(g);damageScopes.set(g,new Set(targets));try{return fn();}finally{if(previous)damageScopes.set(g,previous);else damageScopes.delete(g);}}
export const shotDamageAllowed=(g,target)=>!damageScopes.has(g)||damageScopes.get(g).has(target);
