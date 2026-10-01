// The title screen and deployment: mission, operator (with the colour picker) and difficulty screens, quick and
// daily games, and the kill house menu.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {sentences,t} from './i18n.js';
import {CHARACTER_IDS,availableCharacters,shelvedCharacter} from './unlock-catalog.js';
import {profile,storage} from './storage.js';
import {lockedOperatorRow} from './unlock-ui.js';
import {TRAITS} from './traits.js';
import {SKILLS} from './skills.js';
import {combatStatSummary} from './actor-stats.js';
import {CAMPAIGN_MISSION_IDS,MISSIONS,OFFERED_MISSION_IDS,offeredMission} from './missions.js';
import {deploymentPortraits,portraitMarkup} from './portraits.js';
import {CHARACTERS,characterName,classCarryBonus,startingSupplies} from './characters.js';
import {GRENADES} from './throwables.js';
import {tintedSprite} from './operator-color.js';
import {colorPickerMarkup,mountColorPicker} from './color-picker.js';
import {classSpriteRect} from './class-art.js';
import {ENDLESS_DISPLAY_FLOORS} from './endless.js';
import {WEAPONS,isSimulation} from './engine.js';
import {killhouseMenuMarkup,simulationLabel} from './killhouse-ui.js';
import {dailySeed} from './daily.js';
import {capacity} from './ammunition.js';
import {DIFFICULTY_OPTIONS,FACILITY_OPTIONS,REAL_MODE_NOTE,difficultyMeta,difficultyOption,facilityOption,realModeMeta} from './deploy-ui.js';
import {SURVIVAL_TUNING} from './survival.js';
import {$,deployDraft,deploymentFaces,entered,exitSimulation,game,modal,newGame,renderer,resumable,setDeployDraft,setDeploymentFaces,setTitleFlow,titleFlow} from './controller.js';
import {startingKit} from './controller-screens.js';
export function showIntro(){
  setTitleFlow(true);
  if(isSimulation(game)&&game.status!=='playing')exitSimulation();
  const canContinue=game.status==='playing'&&(resumable||entered),simulating=isSimulation(game);
  const entry=(action,label,note,disabled=false)=>`<button class="title-entry" data-modal="${action}"${disabled?' disabled':''}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="title-screen">
    <div class="title-mark" aria-hidden="true"><svg viewBox="0 0 128 128"><path d="M23 99 58 24h15l34 75H85L65 50 44 99Z" fill="currentColor"/><path d="m56 85 9-21 9 21Z" fill="#0d1211"/></svg></div>
    <h2 class="title-word">ASH PROTOCOL</h2>
    <nav class="title-menu">
      ${entry('enter','CONTINUE',simulating?simulationLabel(game):canContinue?`${t('controller.title.continueMeta',{v:characterName(game.player.character).split(' · ').pop(),floor:game.floor})}`:t('controller.title.noRun'),!canContinue)}
      ${simulating?entry('khMenu','EXIT SIMULATION',t('controller.title.exitSim')):entry('deploy','NEW GAME',t('controller.title.newGame'))}
      ${simulating?'':entry('killhouse','KILL HOUSE',t('controller.title.killhouse'))}
      ${simulating?'':entry('unlocks','UNLOCKS',`${t('controller.title.unlocks',{v:profile().protocol.balance})}`)}
      ${entry('help','MANUAL',t('controller.title.manual'))}
      ${entry('settings','SETTING',t('controller.title.settings'))}
      ${entry('about','ABOUT',t('controller.title.about'))}
    </nav>
    ${storage.available?'':t('controller.title.storageWarning')}${storage.droppedRun?t(storage.droppedRun.rewarded?'controller.title.oldRunAbandoned':'controller.title.oldRunUnreadable',{version:storage.droppedRun.version,copy:t(storage.droppedRun.kept?'controller.title.oldRunCopy':'controller.title.oldRunNoCopy')}):''}
  </div>`,false,true);
}
export const MISSION_IDS=CAMPAIGN_MISSION_IDS;   // 3.177.11: quick and daily games roll only what is still offered
const orderedCharacters=()=>[...OPERATOR_ORDER.filter(id=>CHARACTERS[id]),...Object.keys(CHARACTERS).filter(id=>!OPERATOR_ORDER.includes(id))].filter(id=>availableCharacters(profile()).includes(id));
const lockedCharacters=()=>CHARACTER_IDS.filter(id=>CHARACTERS[id]&&!shelvedCharacter(id)&&!orderedCharacters().includes(id));
const randomSeed=()=>Math.floor(Math.random()*1000000000);
const pick=list=>list[Math.floor(Math.random()*list.length)];
export const runIsLive=()=>game.status==='playing'&&(entered||resumable);
const deployNotice=()=>runIsLive()?t('controller.deploy.liveWarning'):'';
const seedLabel=seed=>seed===undefined?t('controller.deploy.random'):String(seed);
// Deployment-list additions, split from the old shared paragraph. MISSIONS[].text
// is also the mission-floor toast, so floor-3 reminders stay out of the data.
export const MISSION_NOTES={
  hunt:t('controller.mission.note.hunt'),
  sweep:t('controller.mission.note.sweep'),
  retrieval:t('controller.mission.note.retrieval'),
  roundtrip:t('controller.mission.note.roundtrip'),
  archive:t('controller.mission.note.retrieval'),
  endless:t('controller.mission.note.endless')
};
export function startQuick(){
  const seed=randomSeed(),mission=pick(MISSION_IDS);
  setDeployDraft({mode:'quick',mission,seed});
  newGame(seed,pick(availableCharacters(profile())),mission);
}
export function showDeployment(){
  setDeploymentFaces(deploymentPortraits(Object.keys(CHARACTERS)));
  setDeployDraft({mode:null,mission:null,seed:undefined});
  const row=(action,label,note)=>`<button class="title-entry" data-modal="${action}"><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="eyebrow">DEPLOYMENT</div><h2>${t('controller.deploy.newMission')}</h2>${deployNotice()}
<nav class="title-menu deploy-menu">
${row('deployNormal','NORMAL GAME',t('controller.deploy.custom'))}
${row('deployDaily','DAILY GAME',`${t('controller.deploy.daily',{dailySeed:dailySeed()})}`)}
${row('deployQuick','QUICK GAME',t('controller.deploy.quick'))}
</nav>
<button class="modal-button secondary" data-modal="${runIsLive()?'settings':'intro'}">${t('controller.cancel')}</button>`,true);
}
export function showDeployMission(){
  const selected=offeredMission(game.mission.id),offered=OFFERED_MISSION_IDS.map(id=>[id,MISSIONS[id]]);
  modal(`<div class="eyebrow">DEPLOYMENT / 1 OF 3</div><h2>${t('controller.deploy.pickMission')}</h2>${deployNotice()}
<fieldset class="term-list mission-list"><legend>SELECT MISSION</legend>${offered.map(([id,m])=>`<div class="term-row"><label class="term-pick"><input type="radio" name="mission" value="${id}" ${id===selected?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${m.name}</span><span class="term-meta">${id==='survival'?t('missions.survivalMeta',{turns:SURVIVAL_TUNING.turns}):`${id==='endless'?ENDLESS_DISPLAY_FLOORS:(m.depth||6)}F`}</span></span></label></div>`).join('')}</fieldset>
<div class="mission-brief" aria-live="polite">${offered.map(([id,m])=>`<p data-mission="${id}"${id===selected?' class="active"':''}>${sentences(m.text,MISSION_NOTES[id])}</p>`).join('')}</div>
<details class="term-detail seed-advanced"><summary>${t('controller.deploy.advanced')}</summary><label class="seed-field">${t('controller.deploy.seedLabel')}<input id="new-seed" type="number" min="0" max="999999999" placeholder="${t('controller.deploy.seedExample')}" inputmode="numeric"></label></details>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deploy">${t('controller.back')}</button><button class="modal-button" data-modal="deployOperator">${t('controller.deploy.nextOperator')}</button></div>`,true);
}
export function showDeployOperator(){
  const {mission,seed,mode}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK',retry:'REDEPLOY'}[mode]||'NORMAL',retry=mode==='retry';
  modal(`<div class="eyebrow">${retry?'REDEPLOYMENT / SAME SEED':'DEPLOYMENT / 2 OF 3'}</div><h2>${t('controller.deploy.pickOperator')}</h2>
<p>${t('controller.deploy.summary',{label,missionName:MISSIONS[mission].name,v:seedLabel(seed)})}</p>${deployNotice()}
<fieldset class="term-list operator-list"><legend>SELECT OPERATOR</legend>${orderedCharacters().map(id=>{const c=CHARACTERS[id];return `<div class="term-row"><label class="term-pick"><input type="radio" name="character" value="${id}" ${id===(deployDraft.character||game.player.character)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-face">${portraitMarkup(deploymentFaces[id])}</span><span class="term-sprite"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas></span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">${c.name.toUpperCase()} · ${c.hp||100}/${c.armor||0}</span></span></label><p class="term-note">${c.text}</p><details class="term-detail"><summary>${t('controller.deploy.details')}</summary><div class="term-detail-body"><small>${c.weapons.map(slot=>WEAPONS[slot].name).join(t('controller.slash'))}</small><small>${t('controller.deploy.stats1',{v:c.plates||0,v2:combatStatSummary({character:id}),v3:capacity('grenade')+classCarryBonus(id,'grenade')})}</small><small>${t('controller.deploy.stats2',{v:startingSupplies(id).meds,v2:Object.values(GRENADES).filter(g=>startingSupplies(id)[g.resource]>0).map(g=>g.short+' ×'+startingSupplies(id)[g.resource]).join(t('controller.slash')),v3:startingKit(id)})}</small>${(c.skills||[]).map(sid=>`<small><b>${SKILLS[sid].name}</b>${t('controller.deploy.skillText',{sidText:SKILLS[sid].text})}</small>`).join('')}${c.traits.map(tid=>`<small><b>${TRAITS[tid].name}</b>${t('controller.deploy.traitText',{tidText:TRAITS[tid].text})}</small>`).join('')}</div></details></div>`;}).join('')}${lockedCharacters().map(id=>lockedOperatorRow(id)).join('')}</fieldset>
${operatorColorPicker()}
<div class="modal-footer"><button class="modal-button secondary" data-modal="${retry?'result':mode==='normal'?'deployNormal':'deploy'}">${t('controller.back')}</button><button class="modal-button" data-modal="${retry?'retryStart':'deployDifficulty'}">${retry?t('controller.deploy.go'):t('controller.deploy.nextDifficulty')}</button></div>`,true);
  mountColorPicker($('#modal .color-list'),drawOperatorSprites);drawOperatorSprites();
}
// Step 3 (3.76.2): the difficulty knob's reserved slot and the real-mode switch, which locks when the run starts.
export function showDeployDifficulty(){
  const {mission,seed,mode,character}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK'}[mode]||'NORMAL',chosen=difficultyOption(deployDraft.difficulty);
  modal(`<div class="eyebrow">DEPLOYMENT / 3 OF 3</div><h2>${t('controller.deploy.pickDifficulty')}</h2>
<p>${t('controller.deploy.summary2',{label,missionName:MISSIONS[mission].name,v:characterName(character),v2:seedLabel(seed)})}</p>${deployNotice()}
<fieldset class="term-list difficulty-list"><legend>SELECT DIFFICULTY</legend>${DIFFICULTY_OPTIONS.map(d=>`<div class="term-row"><label class="term-pick"><input type="radio" name="difficulty" value="${d.id}" ${d===chosen?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${d.name}</span><span class="term-meta">${difficultyMeta(d)}</span></span></label></div>`).join('')}</fieldset>
<p class="term-note difficulty-note">${t('controller.deploy.difficultyNote')}</p>
<fieldset class="term-list facility-list"><legend>${t('controller.deploy.facility')}</legend>${FACILITY_OPTIONS.map(o=>`<div class="term-row"><label class="term-pick"><input type="radio" name="facility" value="${o.id}" ${o===facilityOption(deployDraft.facility)?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${o.name}</span><span class="term-meta">${o.meta}</span></span></label></div>`).join('')}</fieldset>
<fieldset class="term-list mode-list"><legend>MODE</legend><div class="term-row"><label class="term-pick term-toggle"><input type="checkbox" name="real-mode" ${deployDraft.realMode?'checked':''}><span class="term-caret" aria-hidden="true"></span><span class="term-body"><span class="term-name">${t('controller.deploy.realMode')}</span><span class="term-meta">${realModeMeta()}</span></span></label><p class="term-note">${REAL_MODE_NOTE}</p></div></fieldset>
<div class="modal-footer"><button class="modal-button secondary" data-modal="deployBackOperator">${t('controller.back')}</button><button class="modal-button" data-modal="new">${runIsLive()?t('controller.deploy.abandonAndGo'):t('controller.deploy.start')} →</button></div>`,true);
}
// Operator colour (3.48.2; wheel, brightness and swatches since 3.140.0, src/color-picker.js): a large preview of the
// picked class; saved only when the mission starts.
function operatorColorPicker(){
  const selected=deployDraft.color||renderer.operatorColor,character=orderedCharacters().includes(game.player.character)?game.player.character:orderedCharacters()[0];
  return colorPickerMarkup(selected,character);
}
// Redraw every class-sprite canvas on the deploy screen in the colour currently checked.
// While the wheel is dragged every step is a new colour, so the previews keep their own small cache for the colour on
// screen instead of filling the battlefield's.
let previewTints={color:null,cache:new Map()};
export function drawOperatorSprites(){
  const image=renderer.classSprites,color=$('input[name="operator-color"]:checked')?.value||renderer.operatorColor;
  if(!image.complete||!image.naturalWidth){image.addEventListener('load',drawOperatorSprites,{once:true});return;}
  if(previewTints.color!==color)previewTints={color,cache:new Map()};
  for(const canvas of document.querySelectorAll('#modal canvas[data-class-sprite]')){const r=classSpriteRect(canvas.dataset.classSprite),tinted=tintedSprite(image,r,color,previewTints.cache,renderer.operatorTint),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,32,32);c.drawImage(tinted||image,tinted?0:r.x,tinted?0:r.y,32,32,0,0,32,32);}
}
// Operator order is the user's preferred reading order; skills follow the
// operator that owns them, so a class without a skill simply contributes none.
const OPERATOR_ORDER=['soldier','recon','engineer','necromancer','druid','bulwark','berserker','ninja'];
export function showKillhouseMenu(){modal(killhouseMenuMarkup(profile(),orderedCharacters(),lockedCharacters()));}
