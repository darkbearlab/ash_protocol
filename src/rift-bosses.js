// 裂隙頭目 (3.232.0, docs/FACTIONS.md 5.10; user 2026-11-17: 遊蕩錨的方向「可以」、第 6 層「錨點給減傷」).
// Both are anchors themselves (`anchorHolder`, src/rift.js): energy bodies are bound to them and they draw from their own
// weighted list (`anchorDraw`) on their own clock; when one falls, its bodies dissipate. Both carry 流逝光環 3 (the rift's
// override, src/faction-catalog.js). Numbers are Claude's, to be tuned after play.
// - 遊蕩錨 (floor 3, `riftBoss:'wanderer'`): a large body that comes for you slowly — it walks only every other turn, but
//   beside you it strikes every turn. Its pull (`warp:'pull'`, src/rift-warp.js): it marks a tile beside itself and the
//   tile you stand on; stay and you are put beside it. The rift anchors standing on the floor ward it: each takes
//   `per` off every hit it takes.
// - 裂隙本體 (floor 6, `riftBoss:'core'`): it never moves. Four guard anchors stand round it (placed with the floor,
//   src/rift.js placeAnchors); each standing guard takes `per` off every hit. Its beam (`beam:'spread'`, src/rift-beam.js)
//   fans wider as the guards fall: one line with all four standing, two lines with one down, three with two or more down.
//   Between beams it pulls you in, as the wanderer does. Beside it, it strikes.
// Its own top step, as the swarm and rebel bosses have theirs: a warning given last round goes off first.
import {enemyDef} from './enemy-data.js';
import {registerStep} from './enemy-specials.js';
import {warpAction} from './rift-warp.js';
import {beamAction} from './rift-beam.js';
import {anchorProps} from './rift.js';
import {distance} from './world.js';

export const RIFT_BOSS_TUNING=Object.freeze({wardMax:.8});
export const riftBoss=e=>enemyDef(e)?.riftBoss||null;
// The share of each hit the standing anchors take off (Game.hurt).
export function anchorWard(g,e){
 const w=enemyDef(e)?.anchorWard;if(!w||e.hp<=0)return 0;
 const standing=anchorProps(g).filter(p=>!w.guards||p.anchor.guard).length;
 return Math.round(Math.min(RIFT_BOSS_TUNING.wardMax,standing*w.per)*100)/100;
}
export function riftBossAction(ctx){
 const {g,e}=ctx,kind=riftBoss(e);if(!kind)return false;
 if(e.warpIntent)return warpAction(ctx);
 if(e.beamIntent)return beamAction(ctx);
 const beside=distance(e,g.player)<=1&&g.canCross(e,g.player);
 if(kind==='core'){
  if(beamAction(ctx)||warpAction(ctx))return true;
  return !beside;   // it never moves; beside you, its blow (the rest of the turn)
 }
 if(!beside&&warpAction(ctx))return true;
 return !beside&&g.turn%2===1;   // a walking turn every other turn
}
registerStep('top','riftBoss',riftBossAction,e=>Boolean(riftBoss(e)));
