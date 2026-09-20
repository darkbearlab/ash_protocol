// 有效距離 (3.152.0, user decision 2026-09-20): every shooter has a band it shoots best at, near edge and far edge.
// Outside it each tile costs BAND_TUNING.perTile accuracy, at most BAND_TUNING.cap — for the player, the enemies and the
// player's units alike. Too close is as bad as too far, so a rifle wants to back off and a raider wants to close in.
// The shotgun (its own distance bands) and the grenade launcher (a point target) have no band; neither does melee.
// Enemies use the same numbers to decide where to stand (src/enemy-behavior.js), so they walk into their band and only
// shoot from a bad distance when they cannot move.
// settle: after a unit steps to fix its distance it shoots for this many turns from where it stands, even at a penalty.
// Without it a player could walk at a rifleman forever: it would back off every turn and never fire.
export const BAND_TUNING={perTile:4,cap:12,settle:3};

// By weapon id (src/data.js WEAPONS), which ally weapons share (src/allies.js hands out 'rifle' and 'plasma').
export const WEAPON_BANDS=Object.freeze({rifle:[3,5],smg:[2,4],sniper:[4,10],plasma:[2,6],lmg:[3,6],thunder:[2,4]});
// By enemy type; a variant (rifleman_armored) falls back to its base type.
export const ENEMY_BANDS=Object.freeze({rifleman:[3,5],raider:[1,3],gunner:[2,4],drone:[2,4],sniper:[4,10],warden:[2,4],boss:[3,6],squad_leader:[2,5],enforcer:[4,10]});

export const weaponBand=weapon=>weapon?.band??(weapon?.melee?null:WEAPON_BANDS[weapon?.id]??null);
export const enemyBand=type=>ENEMY_BANDS[type]??ENEMY_BANDS[String(type).split('_')[0]]??null;
// The long barrel and the recon's extended burst push the far edge out; nothing moves the near edge (3.152.0 proposal).
export const shiftedBand=(band,reach)=>band?[band[0],band[1]+(reach||0)]:null;
export const inBand=(band,distance)=>!band||distance>=band[0]&&distance<=band[1];
export const bandPenalty=(band,distance)=>band?Math.min(BAND_TUNING.cap,BAND_TUNING.perTile*Math.max(0,band[0]-distance,distance-band[1])):0;
export const bandLabel=band=>band?`${band[0]}–${band[1]}`:'不限';
