// Display helpers for the melee classes (3.47.1, Claude). Pure reads of a game or presentation view, so tests can reach them without the DOM.
import {t} from './i18n.js';
import {MELEE_TUNING,GRAPPLE_RANGE,bladeCount,ambushReady,duelActive} from './melee-classes.js';
import {distance} from './world.js';

// Skill-button word for the hook against the locked target; the refusal reason itself stays the rules layer's.
export function grappleLabel(view){
  const plan=view.grapplePlan(),locked=view.enemies.find(e=>e.id===view.target&&e.hp>0);
  if(!plan.reason)return plan.dash?t('melee-ui.charge'):t('melee-ui.pull');
  return plan.why==='landing'?t('melee-ui.noLanding'):locked&&distance(view.player,locked)>GRAPPLE_RANGE?t('melee-ui.tooFar'):t('melee-ui.noTarget');
}
// Paid turns until the next battle-spirit stack fades. Stacks tick at the end of a paid turn (tickSpirit), so the
// first loss lands spiritDelay turns after the kill and then every spiritInterval turns.
export function spiritFadeIn(view){
  const s=view.player.battleSpirit,{spiritDelay,spiritInterval}=MELEE_TUNING,next=view.turn+1-s.lastKill;
  return next<spiritDelay?s.lastKill+spiritDelay-view.turn:(next-spiritDelay)%spiritInterval===0?1:spiritInterval;
}
// Status-line entries. The controller puts them first so a narrow screen does not cut them.
export function meleeStatus(view){
  const p=view.player,out=[];
  if(p.battleSpirit?.stacks)out.push(t('melee-ui.spiritFade',{stacks:p.battleSpirit.stacks,turns:spiritFadeIn(view)}));
  if(view.targeted&&ambushReady(view,view.targeted))out.push(`${t('melee-ui.ambush',{ambush:MELEE_TUNING.ambush})}`);
  if(duelActive(view))out.push(`${t('melee-ui.duelist',{duelist:MELEE_TUNING.duelist})}`);
  return out;
}
// Bag header lines: what the blade stash and battle spirit are worth right now.
export function meleeSummary(p){
  const blades=bladeCount(p),stacks=p.battleSpirit?.stacks||0,pct=v=>Math.round(v*100);
  return [blades?t('melee-ui.blades',{n:blades,attack:pct(blades*MELEE_TUNING.bladeDamage),defense:pct(blades*MELEE_TUNING.bladeReduction)}):'',
    stacks?t('melee-ui.spirit',{n:stacks,defense:pct(stacks*MELEE_TUNING.spiritReduction)}):''].filter(Boolean);
}
