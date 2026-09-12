// Effects derive only from saved perk ranks; no additional persistent state.
export const CLASS_PERK_TUNING={salvage:2,salvageGrant:15,frameHp:20,frameArmor:1,fireAccuracy:8,fireDamage:3,horde:1,haste:1,blades:4,plating:.08,recoveryChance:.15,recoveryAmount:5,anchor:.1,fury:1,endureDelay:2,endureInterval:1,thirst:.08};
export const classPerkRank=(actor,id)=>Math.max(0,Math.min(3,Number.isSafeInteger(actor?.perks?.[id])?actor.perks[id]:0));
