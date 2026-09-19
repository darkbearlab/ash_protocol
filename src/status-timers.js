// Timed states on the player, each with how long it still lasts (3.151.0, user: one place shows remaining durations).
// The status line shows these right after the exo, and the text client prints the same strings.
import {SWARM_TUNING} from './swarm-tuning.js';
import {decayedStacks,suppressionStacks} from './suppression.js';
import {TRAITS} from './traits.js';

// Poison drops one stack every poisonDecayTurns environment turns; poisonClock counts toward the next drop.
export const poisonTurns=p=>p.poison>0?p.poison*SWARM_TUNING.poisonDecayTurns-(p.poisonClock||0):0;
// Suppression halves (rounding up, 1 becomes 0) after each of the unit's own turns: 5 lasts 5→3→2→1, four turns.
export function suppressionTurns(actor){let n=suppressionStacks(actor),turns=0;while(n>0){n=decayedStacks(n);turns++;}return turns;}
// Clouds count down with the round: `expires` is the last round they stand, so expires−turn rounds are left, like the decoy.
const CLOUD_NAMES={toxic:'毒霧中',spore:'孢子煙中'};
export function cloudTurns(g,kind){const p=g.player;return Math.max(0,...(g.smoke||[]).filter(s=>(s.kind||'smoke')===kind&&s.cells.some(c=>c.x===p.x&&c.y===p.y)).map(s=>s.expires-g.turn));}

export function timedStatuses(g){
  const p=g.player,skill=id=>p.skillState?.[id]?.remaining||0;
  return [
    g.shadowSteps?`免費移動 ${g.shadowSteps} 步`:'',
    p.poison?`中毒 ${p.poison} 層 · ${poisonTurns(p)} 回合`:'',
    p.control?.disabled?`失能 ${p.control.disabled} 回合 · 按等待`:'',
    p.control?.immune?`失能免疫 ${p.control.immune} 回合`:'',
    skill('signal_break')?`斷層 ${skill('signal_break')} 回合`:'',
    skill('camouflage')?`迷彩 ${skill('camouflage')} 回合`:'',
    ...(p.traits||[]).filter(t=>t.turns>0&&TRAITS[t.id]).map(t=>`${TRAITS[t.id].name} ${t.turns} 回合`),
    ...['smoke','toxic','spore'].map(kind=>{const turns=cloudTurns(g,kind);return turns?`${CLOUD_NAMES[kind]||'煙霧中'} ${turns} 回合`:'';}),
  ].filter(Boolean);
}
