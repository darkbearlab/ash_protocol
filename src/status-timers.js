// Timed states on the player, each with how long it still lasts (3.151.0, user: one place shows remaining durations).
// The status line shows these right after the exo, and the text client prints the same strings.
import {t} from './i18n.js';
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
    g.shadowSteps?t('status-timers.freeSteps',{n:g.shadowSteps}):'',
    p.poison?t('status-timers.poison',{stacks:p.poison,turns:poisonTurns(p)}):'',
    p.control?.disabled?t('status-timers.disabled',{n:p.control.disabled}):'',
    p.control?.immune?t('status-timers.immune',{n:p.control.immune}):'',
    skill('signal_break')?t('status-timers.signalBreak',{n:skill('signal_break')}):'',
    skill('camouflage')?t('status-timers.camouflage',{n:skill('camouflage')}):'',
    ...(p.traits||[]).filter(s=>s.turns>0&&TRAITS[s.id]).map(s=>t('status-timers.trait',{name:TRAITS[s.id].name,turns:s.turns})),
    ...['smoke','toxic','spore'].map(kind=>{const turns=cloudTurns(g,kind);return turns?t('status-timers.cloud',{name:CLOUD_NAMES[kind]||'煙霧中',turns}):'';}),
  ].filter(Boolean);
}
