import {enemyDef} from './enemy-data.js';
// Nodes return true when they consume the opportunity; sequences retain state on actors.
export const selector=(nodes,context)=>nodes.some(node=>node(context)===true);
export const sequence=(nodes,context)=>nodes.every(node=>node(context)!==false);
export const UNIT_TREES={};
export const AFFIX_BRANCHES=[];
export function registerUnitTree(id,tree){UNIT_TREES[id]=Object.freeze(tree);}
export function registerAffixBranch(branch){AFFIX_BRANCHES.push(Object.freeze(branch));}
export const unitTree=e=>UNIT_TREES[enemyDef(e)?.behavior??e.type]||{};
export function runAffixBranches(context){return selector(AFFIX_BRANCHES.map(branch=>ctx=>branch.applies(ctx)&&branch.trigger(ctx)&&((branch.pending?.(ctx))||ctx.g.rng()<branch.chance)&&branch.run(ctx)),context);}
