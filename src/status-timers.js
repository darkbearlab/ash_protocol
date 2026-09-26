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
const CLOUD_NAMES={toxic:t('status-timers.inToxic'),spore:t('status-timers.inSpore')};
export function cloudTurns(g,kind){const p=g.player;return Math.max(0,...(g.smoke||[]).filter(s=>(s.kind||'smoke')===kind&&s.cells.some(c=>c.x===p.x&&c.y===p.y)).map(s=>s.expires-g.turn));}

export function timedStatuses(g){return timedStatusChips(g).map(chip=>chip.text);}
// 3.193.0 (user): the loadout bar shows each as an icon and a number (src/ui-icons.js); the text stays for its label, the
// effects panel and the text client. tone: good, bad or neutral ('').
export function timedStatusChips(g){
  const p=g.player,skill=id=>p.skillState?.[id]?.remaining||0,out=[],add=(icon,n,tone,text)=>out.push({icon,n,tone,text});
  if(g.shadowSteps)add('steps',g.shadowSteps,'good',t('status-timers.freeSteps',{n:g.shadowSteps}));
  if(p.poison)add('drop',p.poison,'bad',t('status-timers.poison',{stacks:p.poison,turns:poisonTurns(p)}));
  if(p.control?.disabled)add('bolt',p.control.disabled,'bad',t('status-timers.disabled',{n:p.control.disabled}));
  if(p.control?.immune)add('shieldCheck',p.control.immune,'good',t('status-timers.immune',{n:p.control.immune}));
  if(skill('signal_break'))add('antenna',skill('signal_break'),'good',t('status-timers.signalBreak',{n:skill('signal_break')}));
  if(skill('camouflage'))add('ghost',skill('camouflage'),'good',t('status-timers.camouflage',{n:skill('camouflage')}));
  for(const s of (p.traits||[]).filter(s=>s.turns>0&&TRAITS[s.id]))add('hourglass',s.turns,'',t('status-timers.trait',{name:TRAITS[s.id].name,turns:s.turns}));
  for(const kind of ['smoke','toxic','spore']){const turns=cloudTurns(g,kind);if(turns)add('cloud',turns,kind==='smoke'?'':'bad',t('status-timers.cloud',{name:CLOUD_NAMES[kind]||t('status-timers.inSmoke'),turns}));}
  return out;
}
