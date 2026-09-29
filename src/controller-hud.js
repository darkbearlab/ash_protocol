// The battle HUD: update() redraws the panel, status line, target card and buttons from the game in view; notices,
// the floor toast and the effects strip.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {t} from './i18n.js';
import {recordResult} from './storage.js';
import {operatorSignal} from './unlock-ui.js';
import {isNoncombatant} from './enemy-data.js';
import {initiative} from './traits.js';
import {isBlueprintLog} from './workshop.js';
import {ALLY_SKILLS,allySkillState,canAllySkill} from './allies.js';
import {suppressionChip} from './suppression-ui.js';
import {canUseSkill,skillActive,skillStatus,skillText} from './skills.js';
import {timedStatusChips} from './status-timers.js';
import {iconSvg} from './ui-icons.js';
import {isBlack,isDark} from './lighting.js';
import {missionDefinition,missionDepth,missionProgress,returning} from './missions.js';
import {ammoName} from './weapons.js';
import {PREPARED_CATEGORIES,preparedEntry} from './prepared.js';
import {levelCost} from './perks.js';
import {grappleLabel,meleeChips} from './melee-ui.js';
import {isEndless} from './endless.js';
import {depthLabel,endlessFloorText,growthLabel,levelLabel,levelTitle} from './endless-ui.js';
import {ENEMY_TYPES,distance,floorInfo,isSimulation} from './engine.js';
import {promptDue,simulationLabel} from './killhouse-ui.js';
import {courseActive} from './course.js';
import {EXO_TUNING} from './field-gear.js';
import {targetDetails} from './target-card.js';
import {unitTree} from './behavior-tree.js';
import {trackRun} from './run-log.js';
import {turnsLeft} from './survival.js';
import {$,effectsOpen,entered,escapeHTML,game,lastActionLogs,lastStatus,logButton,notice,pad,persist,playback,previousFloor,renderer,replay,resumable,saveWarningDue,setLastStatus,setPreviousFloor,showSaveWarning,skipEnabled,syncMusic} from './controller.js';
import {updateAim} from './controller-aim.js';
import {bossScene,endRun,kia,playCourse,sayCommsEvents} from './controller-comms.js';
import {promptLog,showLevelUp,showRoomPrompt} from './controller-screens.js';
let noticeTimer;
// 3.104.0 (user request): the bar is not empty when quiet — it falls back to the floor and mission line that used to
// live in this row, so a message only borrows the space for a couple of seconds.
const missionLine=view=>isSimulation(view)?simulationLabel(view):isEndless(view)?`${depthLabel(view.floor)} · ${missionDefinition(view).name}`
 :`${pad(view.floor)} / ${returning(view)?t('controller.returnPrefix'):''}${missionDefinition(view).name}${view.floor===missionDepth(view)?` ${missionProgress(view).done}/${missionProgress(view).total}`:''}`;
function restNotice(){const view=renderer.game;if(!view)return;notice.textContent=missionLine(view);notice.classList.remove('danger');notice.classList.add('resting','show');logButton.textContent='';logButton.classList.remove('more');}
// 3.193.0 (user): the loadout bar is pixel icons only (src/ui-icons.js); the aim and flashlight switches read on/off by
// brightness (expansion.css). Tapping the status line unfolds the effects in words above the bar, over the edge of the
// field, and a second tap folds them away (no dialog).
let effectChips=[],effectNote='';
export function renderEffects(){
  const panel=$('#effects-panel'),toggle=$('.loadout-status');if(!panel)return;
  panel.hidden=!effectsOpen;toggle?.setAttribute('aria-expanded',String(effectsOpen));if(!effectsOpen)return;
  panel.innerHTML=`<div class="effects-inner">${effectChips.length?effectChips.map(c=>`<p class="fx-row${c.tone?` ${c.tone}`:''}">${iconSvg(c.icon)}<span>${escapeHTML(c.text)}</span></p>`).join(''):`<p class="fx-row">${t('controller.effects.none')}</p>`}<p class="fx-note">${escapeHTML(effectNote)}</p></div>`;
}
export function notify(text,{extra=0,danger=false}={}){notice.textContent=text;notice.classList.remove('resting');notice.classList.add('show');notice.classList.toggle('danger',danger);logButton.textContent=extra>0?`+${extra}`:'';logButton.classList.toggle('more',extra>0);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{notice.classList.remove('show');noticeTimer=setTimeout(restNotice,600);},2700);}
// A new blueprint is announced with the action's latest line even when later logs would cover it (docs/ENGINEER.md
// section 7); the latest line keeps its danger colour.
export const notifyLatest=()=>{sayCommsEvents(game.logs.slice(0,lastActionLogs));const latest=game.logs[0],blueprint=game.logs.slice(0,Math.max(1,lastActionLogs)).find(l=>isBlueprintLog(l.text));if(latest)notify(blueprint&&blueprint!==latest?`${blueprint.text} ${latest.text}`:latest.text,{extra:lastActionLogs-1,danger:latest.danger});};
// Half health or less: the battlefield edges pulse red, deeper and faster as health falls (3.43).
function lowHealth(p){
  const glow=$('#low-health'),ratio=Math.max(0,p.hp)/p.maxHp,on=ratio<=.5;glow.classList.toggle('on',on);if(!on)return;
  const danger=Math.min(1,(.5-ratio)/.5); // 0 at half health, 1 at zero; the glow's depth scales with the board in CSS.
  glow.style.setProperty('--danger',danger.toFixed(2));glow.style.setProperty('--edge',(.45+.35*danger).toFixed(2));glow.style.setProperty('--pulse',`${(1.6-.7*danger).toFixed(2)}s`);
}
// Skill button text. Grapple shows what it would do to the locked target (3.47.1); others keep their state text.
function skillLabel(view,id){
  if(ALLY_SKILLS.includes(id))return allySkillState(view,id);
  if(id==='grapple'&&!view.player.skillState.grapple?.cooldown)return grappleLabel(view);
  return skillStatus(view.player,id);
}
export function update(view=renderer.game) {
  syncMusic();
  const p=view.player,w=view.weapon,reserve=p[view.reserveKey()]??0;
  const sectorLabel=isSimulation(view)?t('controller.hud.simulation'):view.survival?(view.survival.open?t('controller.hud.survivalOpen',{integrity:view.survival.integrity}):t('controller.hud.survival',{integrity:view.survival.integrity,turns:turnsLeft(view)})):isEndless(view)?depthLabel(view.floor):`${t('controller.hud.floors',{v:pad(view.floor)})}`;
  if(notice.classList.contains('resting'))restNotice();
  // The mission summary moved into the ☰ menu (3.104.0, user request): most runs just push deeper, and the row
  // it used to occupy is worth more as the message bar.
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#mobile-plates-bar').style.width=`${(p.plates||0)/view.plateCapacity*100}%`;$('#mobile-plates').textContent=`${p.plates||0} / ${view.plateCapacity}`;lowHealth(p);
  $('#level').textContent=`${sectorLabel} · ${levelLabel(p.level)}`;$('#level').title=`${t('controller.hud.levelTitle',{sectorLabel,v:levelTitle(p.level,p.xp,levelCost(game,p.level))})}`;
  // One spelling of a prepared slot's label, so a mode that borrows the button can put it back exactly (3.109.0).
  // 3.161.0 (user report): the three prepared-slot buttons act on the live game — a tap skips the presentation first —
  // so their readiness, labels and counts come from it, not from the snapshot being animated. Skill cooldowns tick
  // after the enemy phase, so during the animation the snapshots still read 冷卻 1 (dim) while the live game read 就緒.
  const lp=game?.player||p,lv=game||view;
  for(const category of Object.keys(PREPARED_CATEGORIES)){
    const entry=preparedEntry(lp,category),button=$(`[data-action="${category}"]`),count=entry?.resource?lp[entry.resource]:null;
    button.querySelector('.action-icon').textContent=entry?.icon||'◇';
    if(category!=='grenade')button.querySelector('strong').textContent=slotLabel(lv,category);
    button.title=entry?`${t('controller.prep.title',{entryName:entry.name,v:category==='skill'?skillText(lp,lp.prepared.skill):entry.text,v2:category==='skill'?(ALLY_SKILLS.includes(lp.prepared.skill)?t('controller.prep.now')+allySkillState(lv,lp.prepared.skill)+t('controller.period'):t('controller.prep.now')+skillStatus(lp,lp.prepared.skill)+t('controller.prep.cooldownLeft')+(lp.skillState[lp.prepared.skill]?.cooldown||0)+t('controller.period')):''})}`:`${t('controller.prep.readyInPack',{v:PREPARED_CATEGORIES[category]})}`;
    if(category==='skill'){if(entry?.toggle)button.setAttribute('aria-pressed',String(skillActive(lp,lp.prepared.skill)));else button.removeAttribute('aria-pressed');}
    button.setAttribute('aria-label',entry?`${t('controller.prep.aria',{v:PREPARED_CATEGORIES[category],entryName:entry.name,v2:category==='skill'?t('controller.prep.comma')+skillLabel(lv,lp.prepared.skill):'',v3:count===null?'':`${t('controller.prep.remaining',{count})}`})}`:`${t('controller.prep.notReady',{v:PREPARED_CATEGORIES[category]})}`);
  }
  // 3.203.0: a flamethrower's tank is never refilled, so it shows what is left of the tank and has no reserve.
  $('[data-action="reload"] strong').textContent=w.melee?t('controller.reload.melee'):w.tank?t('controller.reload.tank',{n:p.ammo[p.weapon],mag:w.mag}):`${view.actionCost('reload')===0?t('controller.reload.quick'):t('controller.reload.label')} ${p.ammo[p.weapon]}/${w.mag}`;
  $('[data-action="reload"]').title=w.melee?`${t('controller.reload.meleeTitle',{wName:w.name})}`:w.tank?t('controller.reload.tankTitle',{wName:w.name}):`${t('controller.reload.title',{v:view.actionCost('reload')})}`;
  $('#quick-weapon').textContent=w.melee?`${w.code} · ∞`:w.tank?`${w.code} · ${p.ammo[p.weapon]}/${w.mag}`:`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;$('#quick-weapon').title=w.melee?w.desc:w.tank?t('controller.reload.tankTitle',{wName:w.name}):`${t('controller.weaponTitle',{v:ammoName(w),reserve,v2:view.ammoCapacity(w.ammoType)})}`;
  const threats=view.visibleEnemies.filter(e=>!isNoncombatant(e)&&ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range&&(view.sight(e,p)||(unitTree(e).fixedTile&&e.charge&&e.aim&&distance(e.aim,p)===0)));
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  // 3.193.0 (user): the status line is icons and numbers (src/ui-icons.js), the same in every language; each chip keeps its
  // text as a label, and tapping the line unfolds them in words (renderEffects).
  const chip=(icon,n,tone,text)=>({icon,n,tone,text}),sidestep=threats.filter(e=>view.accuracy(e,p).sidePenalty).length;
  effectChips=[view.pursuit&&chip('chevrons','','good',t('controller.status.pursuit')),p.wearables?.includes('exo')&&chip('exo',`${p.exoPlates}/${EXO_TUNING.plates}`,'',t('controller.status.exo',{exoPlates:p.exoPlates,plates:EXO_TUNING.plates})),view.decoy&&chip('decoy',Math.max(1,view.decoy.expires-view.turn),'',t('controller.status.decoy',{hp:view.decoy.hp,v:Math.max(1,view.decoy.expires-view.turn)})),...timedStatusChips(view),view.weapon?.aimPenalty&&!p.focus&&chip('reticle',`−${view.weapon.aimPenalty}`,'bad',t('controller.status.unaimed',{aimPenalty:view.weapon.aimPenalty})),suppressionChip(p),...meleeChips(view),p.recovery&&chip('skip','','bad',t('controller.status.chainsaw')),skillActive(p,'anchor')&&chip('anchor','','',t('controller.status.anchor')),p.vaultExposed&&chip('hurdle','+20','bad',t('controller.status.vault')),skillActive(p,'early_warning')&&chip('radar','','good',t('controller.status.warning')),isBlack(view,p)?chip('dark','','',t('controller.status.black')):isDark(view,p)&&chip('moon','','',t('controller.status.dark')),exposed?chip('alert',exposed,'bad',t('controller.status.exposed',{exposed})):threats.length?(threats.some(e=>view.accuracy(e,p).coverEfficiency===.5)?chip('halfWall','','',t('controller.status.halfCover')):chip('wall','','good',t('controller.status.cover'))):view.cover.length&&chip('wall','','dim',t('controller.status.byWall')),p.moved&&chip('arrow','','',t('controller.status.moved')),sidestep&&chip('swap',sidestep,'good',t('controller.status.sidestep',{v:sidestep})),p.guard&&chip('shield','50%','good',t('controller.status.guard')),p.plates&&chip('plates',p.plates,'good',t('controller.status.plates',{plates:p.plates})),p.focus&&chip('reticle','+15','good',t('controller.status.focus')),p.evasive&&chip('dodge','+15','good',t('controller.status.evasive')),initiative(p)<0?chip('up','','good',t('controller.status.fast')):initiative(p)>0&&chip('down','','bad',t('controller.status.slow'))].filter(Boolean);
  effectNote=exposed?t('controller.status.exposedTitle',{exposed}):t('controller.status.coverTitle');
  $('#status-effects').innerHTML=effectChips.map(c=>`<span class="fx${c.tone?` ${c.tone}`:''}" title="${escapeHTML(c.text)}">${iconSvg(c.icon)}${c.n===''?'':`<b>${escapeHTML(String(c.n))}</b>`}</span>`).join('');
  $('#status-effects').setAttribute('aria-label',effectChips.map(c=>c.text).join(t('common.listSeparator'))||t('controller.effects.none'));
  renderEffects();
  // Grapple preview: only while the hook is ready and the locked target is a legal pull or dash.
  renderer.grapplePreview=null;
  if(p.prepared.skill==='grapple'&&!p.skillState.grapple?.cooldown&&!p.control.disabled&&view.status==='playing'){const plan=view.grapplePlan();if(!plan.reason)renderer.grapplePreview={from:{x:plan.mover.x,y:plan.mover.y},point:plan.point,dash:plan.dash};}
  // 3.178.0: the flashlight switch shows whether it is on.
  const lightButton=$('[data-action="flashlight"]');if(lightButton){lightButton.setAttribute('aria-pressed',String(Boolean(p.flashlight)));lightButton.setAttribute('aria-label',p.flashlight?t('controller.flashlight.off'):t('controller.flashlight.on'));}
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?t('controller.aim.off'):t('controller.aim.on'));
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-name').setAttribute('aria-label',details.fullName||details.name);$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;$('#target-traits').textContent=details.traits;$('#target-order').textContent=details.order;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  // The grenade, item and skill buttons stay pressable when unusable (3.97.0): with nothing prepared a tap opens that
  // backpack tab, and a long press always does. They only look unavailable.
  for(const b of document.querySelectorAll('.control-deck button')){
    const slot=Object.hasOwn(PREPARED_CATEGORIES,b.dataset.action);
    const unusable=(b.dataset.action==='skill'&&(!(ALLY_SKILLS.includes(lp.prepared.skill)?canAllySkill(lv,lp.prepared.skill):canUseSkill(lp,lp.prepared.skill))||lp.control.disabled))||(b.dataset.action==='reload'&&w.melee)||(slot&&(!preparedEntry(lp,b.dataset.action)||!preparedEntry(lp,b.dataset.action).action||(preparedEntry(lp,b.dataset.action).resource&&lp[preparedEntry(lp,b.dataset.action).resource]<=0)));
    b.disabled=(Boolean(playback)&&!skipEnabled())||view.status!=='playing'||(!slot&&unusable);
    // 3.161.0: a skill has no `resource`, so for it `unusable` came out undefined rather than false — and toggle() with
    // no second argument flips the class on every redraw. That was the dim-but-working skill button.
    b.classList.toggle('unavailable',Boolean(slot&&unusable));
  }
  $('[data-action="fire"] strong').textContent=w.melee?t('controller.fire.punch'):t('controller.fire.label');
  updateAim(view);
  if(playback)return;
  if(view.floor!==previousFloor){setPreviousFloor(view.floor);floorToast();}
  // 3.186.0 (src/run-log.js): the run on screen is recorded, except simulations and test-mode replays.
  if(!replay&&!isSimulation(game)&&game.status==='playing'&&(entered||resumable))trackRun(game);
  if(entered)persist();
  if(game.status!=='playing'&&lastStatus==='playing'){setLastStatus(game.status);if(!replay)recordResult(game);if(kia)kia.resultPending=true;else endRun();}
  else if(entered&&courseActive(game)&&game.status==='playing'){if(!$('#modal').open)playCourse();}
  else if(entered&&isSimulation(game)&&game.status==='playing'&&!$('#modal').open&&promptDue(game,promptLog(game)))showRoomPrompt();
  else if(entered&&game.pendingPerks&&game.status==='playing'&&!bossScene)showLevelUp();   // 3.204.0: a level-up waits for a boss scene
  else if(entered&&saveWarningDue&&!$('#modal').open)showSaveWarning();
}
export function floorToast(){if(isSimulation(game))return;if(isEndless(game)){const growth=growthLabel(game.floor,game.difficultySpec);notify(`${t('controller.floorNoticeFull',{v:depthLabel(game.floor),v2:floorInfo(game.floor).name,v3:growth?growth+t('controller.period'):'',v4:endlessFloorText(game.floor),v5:operatorSignal(game)})}`);return;}notify(`${t('controller.floorNotice',{floor:game.floor,v:floorInfo(game.floor).name,v2:returning(game)?game.missionSummary:game.floor===missionDepth(game)?missionDefinition(game).text:floorInfo(game.floor).text})}`);}
export const slotLabel=(view,category)=>{const p=view.player,entry=preparedEntry(p,category),count=entry?.resource?p[entry.resource]:null;
  return entry?`${entry.short}${category==='skill'?' '+skillLabel(view,p.prepared.skill):count===null?'':` ${count}`}`:`${t('controller.prep.notReady',{v:PREPARED_CATEGORIES[category]})}`;};
