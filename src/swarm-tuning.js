// 3.133.0 撲擊 (user decision): a hunter bug within three tiles crouches for a turn, then leaps beside you and bites;
// three turns before it can crouch again.
export const SWARM_TUNING={pounceRange:3,pounceCooldown:3,poisonHitStacks:1,poisonCap:4,poisonDamage:1,poisonDecayTurns:2,hazmatPerPoisonPoint:5,acidStacks:1,hordeMinFloor:3,hordeTriggerRadius:6,hordeWaves:4,hordeWaveSize:4,hordeInterval:3,hordeWarningTurns:2,hordeLiveLimit:12,hordeSpawnRadius:4,tongueRange:5,tongueCooldown:4,burstMin:1,burstMax:2};
// 3.205.0 swarm bosses (user design 2026-09-29, docs/BOSSES.md section 4; src/swarm-bosses.js). The user tunes these after
// playtesting. The tongue keeps tongueRange and tongueCooldown above; its bite is the boss card's own damage.
// charge (巨獸衝鋒; the matriarch below `below` of her health): a lane of up to `lane` tiles; whoever is on it is knocked a
// tile aside for `damage`, or takes `crush` when neither side is free, and loses `disabled` rounds; crashing into a wall
// leaves the boss stunned for a round with +`crashBonus` to hit it (the vault penalty's number, src/combat.js).
// nest (母后產蟲巢): an egg sac `near`-`far` tiles from you hatches into a nest the round after; at most `live` of her nests
// stand at once, each with `brood` larvae to give; `cooldown` rounds after a hatch before the next sac.
export const SWARM_BOSS_TUNING=Object.freeze({
 charge:Object.freeze({lane:8,damage:15,crush:30,disabled:1,crashBonus:20,cooldown:3,below:.5}),
 nest:Object.freeze({near:3,far:4,live:2,brood:3,cooldown:6}),
});
