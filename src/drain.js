// 流逝 (3.228.0, docs/FACTIONS.md 5.2; user 2026-11-16): life drains away near the rift's larger bodies. Each stack
// takes 5% off the maximum health, down to half at ten stacks; only health drops (user: 「先只降生命」), plates and
// everything else stay. The saved `maxHp` never changes: the maximum in play is derived here from the stacks
// (`drain` on the actor), so upgrades, backups and load checks keep reading the real one. Every place that caps or
// shows health in play reads `maxHpOf`.
// A leaf: it imports nothing, so traits.js (healing) and the HUD can use it without a cycle.
export const DRAIN_TUNING=Object.freeze({perStack:.05,maxStacks:10});
export const drainStacks=a=>Number.isInteger(a?.drain)&&a.drain>0?Math.min(a.drain,DRAIN_TUNING.maxStacks):0;
// Rounded up, so a stack never costs more than its 5% and ten stacks leave exactly half (rounded up).
export const maxHpOf=a=>{const max=a?.maxHp??0,n=drainStacks(a);return n?Math.max(1,Math.ceil(max*(1-DRAIN_TUNING.perStack*n))):max;};
// Health above the new maximum is cut (5.2: 「目前生命超過新上限的部分直接截掉」).
export const cutToDrain=a=>{if(a&&a.hp>maxHpOf(a))a.hp=maxHpOf(a);};
