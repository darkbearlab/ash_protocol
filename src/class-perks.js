// Effects derive only from saved perk ranks; no additional persistent state.
export const CLASS_PERK_TUNING={overwatchRadius:2,overwatchCooldown:1,markedDamage:.1,markedAccuracy:6,markAccuracy:10,markDamage:.1,markDuration:1,markDurationCap:5,unseen:.12,blackoutDuration:1,blackoutCooldown:1,sidestep:6,shadowCooldown:3,shadowDuration:1,ambush:.15,overloadDuration:1,overloadCooldown:2,salvage:2,salvageGrant:15,frameHp:20,frameArmor:1,fireAccuracy:8,fireDamage:3,beastHp:25,beastRegen:3,clawDamage:4,clawAccuracy:5,symbiosisHeal:4,horde:1,haste:1,blades:4,plating:.08,recoveryChance:.15,recoveryAmount:5,anchor:.1,fury:1,endureDelay:2,endureInterval:1,thirst:.08};
export const classPerkRank=(actor,id)=>Math.max(0,Math.min(3,Number.isSafeInteger(actor?.perks?.[id])?actor.perks[id]:0));
// 3.159.0 (user decision): 預警 marks what it finds, from rank 0. The mark's numbers come from the soldier's two mark
// lines — 標定壓制 (soldier_hunter) deepens your damage on the marked, 標定弱化 (soldier_marked) blunts their aim at
// you — and every rank of either adds a turn, up to the cap. `actor` may be null for the base values.
export function markValues(actor){
 const hunter=classPerkRank(actor,'soldier_hunter'),marked=classPerkRank(actor,'soldier_marked'),t=CLASS_PERK_TUNING;
 return {duration:Math.min(t.markDurationCap,t.markDuration+hunter+marked),accuracy:t.markAccuracy,damage:Math.round((t.markDamage+hunter*t.markedDamage)*100)/100,evasion:marked*t.markedAccuracy};
}
