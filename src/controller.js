import {DRONE_REPAIR_COST,DRONE_REPAIR_FRACTION,DRONE_BUILD_COST,droneRepairReason,ALLY_SKILLS,allySkillState,canAllySkill,allyName,allyWeapon,PET_REGEN,droneCells,defaultDroneCell,dronePlaces} from './allies.js';
import {SKILLS,skillActive,skillStatus,canUseSkill} from './skills.js';
import {boundaryOpacityPercent} from './movement-boundaries.js';
import {actorStat,clampHit,combatStatSummary} from './actor-stats.js';
import {isDark} from './lighting.js';
import {missionDepth,returning,MISSIONS,validMissionId,missionDefinition,missionProgress} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {ammoName,magazineLabel} from './weapons.js';
import {deploymentPortraits,portraitMarkup,validPortrait} from './portraits.js';
import {CHARACTERS,validCharacter,characterName,startingSupplies,classCarryBonus} from './characters.js';
import {PREPARED_CATEGORIES,preparedOptions,preparedEntry} from './prepared.js';
import {isBarrier,barrierFace} from './barriers.js';
import {GRENADES,grenadeTotal} from './throwables.js';
import {TRAITS,traitLabels,startingTraits,initiative} from './traits.js';
import {AMMUNITION,AMMO_IDS,CARRY_COSTS,capacity,TERMINAL_AMMO,carryingSpent} from './ammunition.js';
import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,WEAPONS,FLOORS,FLOOR_INFO,PERKS,ENEMY_TYPES,LORE,enemyName,distance} from './engine.js';
import {Renderer} from './render.js';
import {AudioFX} from './audio.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {targetDetails} from './target-card.js';
import {read,write,loadGame,saveGame,storage,profile,recordResult,TEST_MODE,purchaseCarrying,exportBackup,previewBackup,restoreBackup,abandonRun,resetProgress,resetCarrying} from './storage.js';

const $=s=>document.querySelector(s),audio=new AudioFX();
const savedGame=loadGame();
let inventoryTab='weapon',deploymentFaces={};
let playback=null,entered=false,orientationBlocked=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor,noticeTimer;
renderer.targetingEnabled=read('ash-targeting')!=='off';
renderer.movementBoundaries=read('ash-movement-boundaries')==='on';
renderer.boundaryOpacity=boundaryOpacityPercent(read('ash-boundary-opacity'));
renderer.targetUI={card:$('#target-card'),link:$('#target-link'),path:$('#target-link path'),dirty:true};
document.fonts?.ready.then(()=>{renderer.targetUI.dirty=true;});
audio.enabled=read('ash-sound')!=='off';
const notice=document.createElement('div');notice.className='battle-notice';notice.setAttribute('role','status');$('#field-messages').append(notice);
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2700);}
// Half health or less: the battlefield edges pulse red, deeper and faster as health falls (3.43).
function lowHealth(p){
  const glow=$('#low-health'),ratio=Math.max(0,p.hp)/p.maxHp,on=ratio<=.5;glow.classList.toggle('on',on);if(!on)return;
  const danger=Math.min(1,(.5-ratio)/.5); // 0 at half health, 1 at zero; the glow's depth scales with the board in CSS.
  glow.style.setProperty('--danger',danger.toFixed(2));glow.style.setProperty('--edge',(.45+.35*danger).toFixed(2));glow.style.setProperty('--pulse',`${(1.6-.7*danger).toFixed(2)}s`);
}
function update(view=renderer.game) {
  const p=view.player,w=view.weapon,reserve=p[view.reserveKey()]??0;
  const progress=missionProgress(view);$('#sector-title').textContent=`${pad(view.floor)} / ${returning(view)?'回程 · ':''}${missionDefinition(view).name}${view.floor===missionDepth(view)?' '+progress.done+'/'+progress.total:''}`;
  $('#sector-title').title=`${FLOORS[view.floor-1]} · ${view.missionSummary}；點此查看任務`;$('#sector-title').setAttribute('aria-label',$('#sector-title').title);
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#mobile-plates-bar').style.width=`${(p.plates||0)/view.plateCapacity*100}%`;$('#mobile-plates').textContent=`${p.plates||0} / ${view.plateCapacity}`;lowHealth(p);
  $('#level').textContent=`LV.${pad(p.level)}`;$('#level').title=`經驗 ${p.xp} / ${p.level+2}`;
  for(const category of Object.keys(PREPARED_CATEGORIES)){
    const entry=preparedEntry(p,category),button=$(`[data-action="${category}"]`),count=entry?.resource?p[entry.resource]:null;
    button.querySelector('.action-icon').textContent=entry?.icon||'◇';
    if(category!=='grenade')button.querySelector('strong').textContent=entry?`${entry.short}${category==='skill'?' '+(ALLY_SKILLS.includes(p.prepared.skill)?allySkillState(view,p.prepared.skill):skillStatus(p,p.prepared.skill)):count===null?'':` ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`;
    button.title=entry?`${entry.name}：${entry.text}${category==='skill'?(ALLY_SKILLS.includes(p.prepared.skill)?' 目前'+allySkillState(view,p.prepared.skill)+'。':' 目前'+skillStatus(p,p.prepared.skill)+'；冷卻剩餘 '+(p.skillState[p.prepared.skill]?.cooldown||0)+'。'):''}`:`到背包預備${PREPARED_CATEGORIES[category]}`;
    if(category==='skill'){if(entry?.toggle)button.setAttribute('aria-pressed',String(skillActive(p,p.prepared.skill)));else button.removeAttribute('aria-pressed');}
    button.setAttribute('aria-label',entry?`使用預備${PREPARED_CATEGORIES[category]}：${entry.name}${category==='skill'?'，'+(ALLY_SKILLS.includes(p.prepared.skill)?allySkillState(view,p.prepared.skill):skillStatus(p,p.prepared.skill)):''}${count===null?'':`，剩餘 ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`);
  }
  $('[data-action="reload"] strong').textContent=w.melee?'近戰 ∞':`${view.actionCost('reload')===0?'快填':'裝填'} ${p.ammo[p.weapon]}/${w.mag}`;
  $('[data-action="reload"]').title=w.melee?'動力拳無須裝填':`裝填：${view.actionCost('reload')} 回合`;
  $('#quick-weapon').textContent=w.melee?`${w.code} · ∞`:`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;$('#quick-weapon').title=w.melee?w.desc:`${ammoName(w)}：備彈 ${reserve}/${view.ammoCapacity(w.ammoType)}`;
  const threats=view.visibleEnemies.filter(e=>ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range&&(view.sight(e,p)||(e.type==='sniper'&&e.charge&&e.aim&&distance(e.aim,p)===0)));
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  $('#status-effects').textContent=[skillActive(p,'anchor')?'下錨 · 攻擊×2 · 無法移動':'',p.vaultExposed?'翻越破綻 +20':'',skillActive(p,'early_warning')?'預警快照':'',skillActive(p)?`斷層 ${p.skillState.signal_break.remaining}`:'',isDark(view,p)?'暗區':'',exposed?`暴露 ${exposed}`:threats.length?(threats.some(e=>view.accuracy(e,p).coverEfficiency===.5)?'半效掩護':'掩護'):view.cover.length?'牆 / 箱旁':'',p.moved?'移動':'',threats.some(e=>view.accuracy(e,p).sidePenalty)?`側身 ${threats.filter(e=>view.accuracy(e,p).sidePenalty).length}`:'',p.guard?'減傷 50%':'',p.plates?`護甲板 ${p.plates}`:'',p.focus?'瞄準 +15':'',p.evasive?'閃避 +15':'',p.poison?`中毒 ${p.poison}`:'',p.control.disabled?`失能 ${p.control.disabled} · 按等待`:'',p.control.immune?`失能免疫 ${p.control.immune}`:'',view.smoke.some(s=>s.cells.some(c=>c.x===p.x&&c.y===p.y))?'煙霧中':'',initiative(p)<0?'快速':initiative(p)>0?'緩速':''].filter(Boolean).join(' · ');
  $('#status-effects').style.color=exposed?'#f3a182':'#b6d5b0';$('#status-effects').title=exposed?`${exposed} 名射手對你有無掩護射線；應立即尋找牆角或箱體。`:'掩體有方向性，注意側翼。';
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?'關閉瞄準資訊':'開啟瞄準資訊');
  aimingButton.textContent=renderer.targetingEnabled?'瞄準 開':'瞄準 關';
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;$('#target-traits').textContent=details.traits;$('#target-order').textContent=details.order;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  for(const b of document.querySelectorAll('.control-deck button'))b.disabled=Boolean(playback)||view.status!=='playing'||(b.dataset.action==='skill'&&(!(ALLY_SKILLS.includes(p.prepared.skill)?canAllySkill(view,p.prepared.skill):canUseSkill(p,p.prepared.skill))||p.control.disabled))||(b.dataset.action==='reload'&&w.melee)||(Object.hasOwn(PREPARED_CATEGORIES,b.dataset.action)&&(!preparedEntry(p,b.dataset.action)||(preparedEntry(p,b.dataset.action).resource&&p[preparedEntry(p,b.dataset.action).resource]<=0)));
  $('[data-action="fire"] strong').textContent=w.melee?'揮拳':'開火';
  updateAim(view);
  if(playback)return;
  if(view.floor!==previousFloor){previousFloor=view.floor;floorToast();}
  if(entered)saveGame(game);
  if(game.status!=='playing'&&lastStatus==='playing'){lastStatus=game.status;recordResult(game);showResult();}
  else if(entered&&game.pendingPerks&&game.status==='playing')showPerks();
}
renderer.isPaused=()=>orientationBlocked;
renderer.onFrame=dt=>{
  if(!playback)return;
  playback.advance(dt);
  if(playback.done){playback=null;renderer.game=game;update();if(game.logs[0])notify(game.logs[0].text);}
};
function act(type,arg) {
  if(playback||orientationBlocked||!entered||$('#modal').open||performance.now()<lockUntil)return false;
  pointerStart=null;
  const oldLog=game.logs[0],{success,steps}=captureAction(game,()=>game.action(type,arg));
  if(success){
    // Persist the fully resolved turn before presenting any of its snapshots.
    saveGame(game);lockUntil=performance.now()+120;if(type!=='fire')audio.play(type==='usePrepared'?preparedEntry(game.player,arg.category)?.action:type);
    if(steps.length){
      renderer.effects=[];
      playback=new Playback(planPresentation(steps,{reduceMotion:renderer.reduceMotion}),event=>{
        renderer.game=event.state;renderer.addEffects(event.effects);update();
        if(event.effects.some(e=>['slash','claw'].includes(e.style)))audio.play('melee');
        else if(event.effects.some(e=>e.type==='enemyShot'||(e.type==='shot'&&e.style!=='grenade')))audio.play('fire');
        if(navigator.vibrate&&event.effects.some(e=>e.type==='impact'||e.type==='blast'))navigator.vibrate(25);
      });
      playback.advance(0);
    }
  }
  if(!playback&&game.logs[0]!==oldLog)notify(game.logs[0].text);
  if(success||(type!=='grenade'&&!(type==='usePrepared'&&arg?.category==='grenade')))cancelAim();update();return success;
}
function move(dx,dy){if(renderer.mode==='pet'){setPetAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='drone'){setDroneAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='grenade'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else act('move',[dx,dy]);}
function floorToast(){notify(`第 ${game.floor} 層 · ${FLOORS[game.floor-1]}：${returning(game)?game.missionSummary:game.floor===missionDepth(game)?missionDefinition(game).text:FLOOR_INFO[game.floor-1].text}`);}
function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
function setAim(pos){if(distance(pos,game.player)<=5&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify('投擲落點需在視線內 5 格以內。');}
function interactions(view=renderer.game){return [...view.nearbyObjectives.map(t=>({label:'回收機密',action:`objective:${t.id}`})),...view.nearbyContainers.map(c=>({label:`開${view.containerLabel(c)}`,action:`case:${c.id}`})),...view.nearbyDoors.map(b=>({label:view.doorLabel(b),action:`door:${b.id}`})),...(view.groundWeapon?[{label:'拾取',action:'bag'}]:[]),...(view.nearbyTerminal?[{label:'終端',action:'terminal'}]:[]),...(view.canTouch(view.exitPoint)?[{label:view.exitBlocked?'電梯鎖定':view.exitLabel+(view.allyTravelSummary?' · '+view.allyTravelSummary:''),action:'descend'}]:[])];}
function updateAim(view=renderer.game){const commanding=renderer.mode==='pet'||renderer.mode==='drone',aiming=renderer.mode==='grenade',b=$('#interact'),options=interactions(view);
  const entry=preparedEntry(view.player,'grenade');
  $('#grenade-label').textContent=aiming?'取消投擲':entry?`${entry.short} ${view.player[entry.resource]}`:'手榴彈未預備';
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=Boolean(playback)||(view.status==='playing'&&!aiming&&!commanding&&!options.length);
  b.querySelector('strong').textContent=view.status!=='playing'?'結果':commanding?(renderer.mode==='drone'?'確認部署':'確認指揮'):aiming?'確認投擲':options.length>1?'互動':options[0]?.label||'互動';
  b.classList.toggle('aiming',aiming||commanding);b.title=view.allyTravelSummary||'';
}
function interact(){if(renderer.mode==='pet'){act('commandPet',renderer.aim);return;}if(renderer.mode==='drone'){act('placeDrone',{id:game.player.prepared.skill,x:renderer.aim.x,y:renderer.aim.y});return;}if(game.status!=='playing'){showResult();return;}if(renderer.mode==='grenade'){act('usePrepared',{category:'grenade',target:renderer.aim});return;}
  const options=interactions();if(options.length>1){modal('<h2>附近互動</h2>'+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+'<button class="modal-button" data-modal="close">返回戰場</button>');return;}
  if(options[0]?.action.startsWith('objective:'))act('recoverObjective',options[0].action.slice(10));
  else if(options[0]?.action.startsWith('case:'))act('openContainer',options[0].action.slice(5));
  else if(options[0]?.action.startsWith('door:')){const b=game.nearbyDoors.find(b=>b.id===options[0].action.slice(5));if(b)act('door',{id:b.id,open:!b.open});}
  else if(options[0]?.action==='bag')showInventory('weapon');else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');
}
function setPetAim(pos){if(game.seen[pos.y]?.[pos.x]&&game.passable(pos.x,pos.y)&&distance(pos,game.player)<=6){renderer.aim=pos;updateAim();}else notify('指揮位置需在已探索的 6 格內。');}
// Drone skills that put a chassis down open a placement cursor; the default tile faces the way the player looks.
function setDroneAim(pos){if(droneCells(game).some(q=>q.x===pos.x&&q.y===pos.y)){renderer.aim={x:pos.x,y:pos.y};updateAim();}else notify('部署位置需在你 2 步內、走得到的空格。');}
function skill(){if(renderer.mode==='pet'||renderer.mode==='drone'){cancelAim();return;}const id=game.player.prepared.skill;if(id==='pet_command'&&game.activeAllies.some(a=>a.kind==='pet')){renderer.mode='pet';renderer.aim={x:game.player.x,y:game.player.y};notify('點目的地後按右下確認；點自己代表召回。');updateAim();}else if(dronePlaces(game,id)&&canAllySkill(game,id)&&defaultDroneCell(game)){renderer.mode='drone';renderer.aim=defaultDroneCell(game);notify('點身邊 2 步內的空格，按右下確認部署；再按技能取消。');updateAim();}else act('usePrepared',{category:'skill'});}
function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}const entry=preparedEntry(game.player,'grenade');if(!entry){notify('請先在背包預備手榴彈。');return;}if(game.player[entry.resource]<=0){notify(`${entry.name}已用盡。`);return;}renderer.mode='grenade';const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,game.player):locked;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify('附近沒有可見敵人。');return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
function modal(html,wide=false,title=false){cancelAim();$('#modal').classList.toggle('wide',wide);$('#modal').classList.toggle('title',title);$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
function close(){if(!entered){showIntro();return;}if(game.pendingPerks){showPerks();return;}if(game.status!=='playing'){$('#modal').close();return;}$('#modal').close();$('#battle').focus({preventScroll:true});}
function modalAction(type,arg){close();act(type,arg);}

function showIntro(){
  const canContinue=game.status==='playing'&&(resumable||entered);
  const entry=(action,label,note,disabled=false)=>`<button class="title-entry" data-modal="${action}"${disabled?' disabled':''}><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="title-screen">
    <div class="title-mark" aria-hidden="true"><svg viewBox="0 0 128 128"><path d="M23 99 58 24h15l34 75H85L65 50 44 99Z" fill="currentColor"/><path d="m56 85 9-21 9 21Z" fill="#0d1211"/></svg></div>
    <h2 class="title-word">ASH PROTOCOL</h2>
    <nav class="title-menu">
      ${entry('enter','CONTINUE',canContinue?`${characterName(game.player.character).split(' · ').pop()} · 第 ${game.floor} 層`:'無進行中的任務',!canContinue)}
      ${entry('deploy','NEW GAME','選擇角色與合約')}
      ${entry('carrying','UPGRADES',`協定點數 ${profile().protocol.balance}`)}
      ${entry('help','MANUAL','規則與操作')}
      ${entry('settings','SETTING','備份 · 顯示 · 音效')}
    </nav>
  </div>`,false,true);
}
// Deployment is a three-step flow. The draft carries the mission and seed
// between screens; newGame() itself is unchanged.
let deployDraft={mode:null,mission:null,seed:undefined};
const MISSION_IDS=Object.keys(MISSIONS);
const orderedCharacters=()=>[...OPERATOR_ORDER.filter(id=>CHARACTERS[id]),...Object.keys(CHARACTERS).filter(id=>!OPERATOR_ORDER.includes(id))];
const dailySeed=(d=new Date())=>d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();
const scatter=n=>{let x=n>>>0;x=Math.imul(x^(x>>>16),2246822519);x=Math.imul(x^(x>>>13),3266489917);return (x^(x>>>16))>>>0;};
const dailyMission=seed=>MISSION_IDS[scatter(seed)%MISSION_IDS.length];
const randomSeed=()=>Math.floor(Math.random()*1000000000);
const pick=list=>list[Math.floor(Math.random()*list.length)];
const runIsLive=()=>game.status==='playing'&&(entered||resumable);
const deployNotice=()=>runIsLive()?'<p class="deploy-warning">! 目前有進行中的任務。確認後才會放棄，已賺點數與永久進度保留。</p>':'';
const seedLabel=seed=>seed===undefined?'隨機':String(seed);
// Deployment-list additions, split from the old shared paragraph. MISSIONS[].text
// is also the mission-floor toast, so floor-3 reminders stay out of the data.
const MISSION_NOTES={
  hunt:'第 3 層仍需擊敗封鎖官。指定目標以青色菱形標記。',
  sweep:'第 3 層仍需擊敗封鎖官；核心守衛不是必要目標。指定目標以青色菱形標記。',
  retrieval:'第 3 層仍需擊敗封鎖官；核心守衛不是必要目標。回收耗 1 回合，不占背包容量。',
  roundtrip:'回收耗 1 回合，不占背包容量。',
  archive:'第 3 層仍需擊敗封鎖官；核心守衛不是必要目標。回收耗 1 回合，不占背包容量。'
};

function startQuick(){
  const seed=randomSeed(),mission=pick(MISSION_IDS);
  deployDraft={mode:'quick',mission,seed};
  newGame(seed,pick(Object.keys(CHARACTERS)),mission);
}
function showDeployment(){
  deploymentFaces=deploymentPortraits(Object.keys(CHARACTERS));
  deployDraft={mode:null,mission:null,seed:undefined};
  const row=(action,label,note)=>`<button class="title-entry" data-modal="${action}"><span class="title-caret" aria-hidden="true">&gt;</span><span class="title-label">${label}</span><span class="title-note">${note}</span></button>`;
  modal(`<div class="eyebrow">DEPLOYMENT</div><h2>新任務</h2>${deployNotice()}
<nav class="title-menu deploy-menu">
${row('deployNormal','NORMAL GAME','自選任務與種子')}
${row('deployDaily','DAILY GAME',`每日固定 · 種子 ${dailySeed()}`)}
${row('deployQuick','QUICK GAME','全隨機 · 直接開始')}
</nav>
<button class="modal-button secondary" data-modal="${runIsLive()?'settings':'intro'}">取消</button>`,true);
}

function showDeployMission(){
  const selected=game.mission.id;
  modal(`<div class="eyebrow">DEPLOYMENT / 1 OF 2</div><h2>選擇任務</h2>${deployNotice()}
<fieldset class="term-list mission-list"><legend>SELECT CONTRACT</legend>${Object.entries(MISSIONS).map(([id,m])=>`<div class="term-row"><label class="term-pick"><input type="radio" name="mission" value="${id}" ${id===selected?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-body"><span class="term-name">${m.name}</span><span class="term-meta">${(m.depth||6)}F</span></span></label></div>`).join('')}</fieldset>
<div class="mission-brief" aria-live="polite">${Object.entries(MISSIONS).map(([id,m])=>`<p data-mission="${id}"${id===selected?' class="active"':''}>${m.text}${MISSION_NOTES[id]||''}</p>`).join('')}</div>
<details class="term-detail seed-advanced"><summary>進階</summary><label class="seed-field">地圖種子（留空隨機）<input id="new-seed" type="number" min="0" max="999999999" placeholder="例：2026" inputmode="numeric"></label></details>
<button class="modal-button" data-modal="deployOperator">下一步：選擇行動員 →</button>
<button class="modal-button secondary" data-modal="deploy">← 返回</button>`,true);
}

function showDeployOperator(){
  const {mission,seed,mode}=deployDraft,label={normal:'NORMAL',daily:'DAILY',quick:'QUICK'}[mode]||'NORMAL';
  modal(`<div class="eyebrow">DEPLOYMENT / 2 OF 2</div><h2>選擇行動員</h2>
<p>${label} · ${MISSIONS[mission].name} · 種子 ${seedLabel(seed)}</p>${deployNotice()}
<fieldset class="term-list"><legend>SELECT OPERATOR</legend>${orderedCharacters().map(id=>{const c=CHARACTERS[id];return `<div class="term-row"><label class="term-pick"><input type="radio" name="character" value="${id}" ${id===game.player.character?'checked':''}><span class="term-caret" aria-hidden="true">&gt;</span><span class="term-face">${portraitMarkup(deploymentFaces[id])}</span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">${c.name.toUpperCase()} · ${c.hp||100}/${c.armor||0}</span></span></label><p class="term-note">${c.text}</p><details class="term-detail"><summary>詳細資料</summary><div class="term-detail-body"><small>${c.weapons.map(slot=>WEAPONS[slot].name).join('／')}</small><small>護甲板 ${c.plates||0} · ${combatStatSummary({character:id})} · 基礎投擲容量 ${capacity('grenade')+classCarryBonus(id,'grenade')}</small><small>醫療包 ×${startingSupplies(id).meds} · ${Object.values(GRENADES).filter(g=>startingSupplies(id)[g.resource]>0).map(g=>g.short+' ×'+startingSupplies(id)[g.resource]).join('／')}</small>${(c.skills||[]).map(sid=>`<small><b>${SKILLS[sid].name}</b>：${SKILLS[sid].text}</small>`).join('')}${c.traits.map(t=>`<small><b>${TRAITS[t].name}</b>：${TRAITS[t].text}</small>`).join('')}</div></details></div>`;}).join('')}</fieldset>
<button class="modal-button" data-modal="new">${runIsLive()?'確認放棄並部署':'開始新任務'} →</button>
<button class="modal-button secondary" data-modal="${mode==='normal'?'deployNormal':'deploy'}">← 返回</button>`,true);
}
function missionDetails(){
  const def=missionDefinition(game);
  const targets=game.floor===missionDepth(game)?game.mission.targets.map((t,i)=>{
    const e=game.enemies.find(e=>e.id===t.id),done=def.kind==='recover'?t.done:e?.hp<=0;
    const known=def.kind==='recover'?game.seen[t.y]?.[t.x]:e&&game.visible(e);
    return `<p>${done?'✓':'◇'} ${i+1}. ${done?'已完成':known?def.kind==='recover'?'已發現機密資料匣':enemyName(e):'尚未定位'}${!done&&known?'（查看樓層地圖）':''}</p>`;
  }).join(''):'';
  return `<p><strong>${game.missionSummary}</strong><br>${def.text}</p>${targets}`;
}
function showMission(){modal(`<div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2>${FLOORS[game.floor-1]}</h2>${missionDetails()}<p>回收：靠近青色 D 資料匣後，按右下互動，耗 1 回合。爆炸不會毀掉任務資料；收下後不占容量。指定殲滅：青色菱形敵人，任何原因死亡都計入；普通敵人不代替指定目標。原路回收需沿各層入口上樓，到第 1 層入口撤離；其他任務完成後前往綠色電梯。</p><button class="modal-button" data-modal="close">返回戰場</button>`);}
function showMap(){modal(`<div class="eyebrow">SECTOR ${pad(game.floor)} / ${FLOORS[game.floor-1]}</div><h2>樓層地圖</h2>${missionDetails()}<canvas id="overview" width="324" height="324" aria-label="已探索地圖，橙色為角色、紅色為可見敵人、綠色為已發現電梯"></canvas><p>橙：角色 · 紅：敵人 · 綠：電梯 · 青：任務目標 · 方框：鎖定目標<br>金色小點：已發現補給；彩色方框：未開補給箱；金線／青色門框：關門／開門，灰線：隔板。淡色地框：生活模組；亮綠小方塊：補給站（使用後暗綠）。只顯示已探索區域，查看不耗回合。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`);renderer.drawMap($('#overview'));}

function updateOrientation(raise=false){
  orientationBlocked=landscapeTouch({coarse:matchMedia('(any-pointer: coarse)').matches,type:screen.orientation?.type,angle:window.orientation,width:innerWidth,height:innerHeight,editing:document.activeElement?.matches('input,textarea')});
  const guard=$('#orientation-guard');
  if(orientationBlocked){if(raise&&guard.open)guard.close();if(!guard.open)guard.showModal();}
  else if(guard.open)guard.close();
}
// Reserve external HUD height; battlefield remains square in the portrait column.
function fitLayout(){const panel=$('.battle-panel'),hud=$('.tactical-panel'),width=panel.clientWidth,style=getComputedStyle($('.app')),height=window.innerHeight-2-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
  const hudHeight=[...hud.children].reduce((n,el)=>n+el.getBoundingClientRect().height,0);
  const side=Math.min(width,height-hudHeight);
  panel.style.setProperty('--board-size',`${Math.max(128,Math.floor(side))}px`);updateOrientation();
}
const layoutObserver=new ResizeObserver(()=>requestAnimationFrame(fitLayout));
for(const el of [$('.workspace'),...$('.tactical-panel').children])layoutObserver.observe(el);
window.addEventListener('orientationchange',fitLayout);screen.orientation?.addEventListener('change',fitLayout);window.addEventListener('resize',fitLayout);window.visualViewport?.addEventListener('resize',fitLayout);fitLayout();

const INVENTORY_TABS={weapon:'武器',...PREPARED_CATEGORIES};
function droneMaintenance(){
  const a=game.allies.find(a=>a.kind==='drone');if(!a)return '';
  if(a.status!=='packed')return `<p>${a.status==='destroyed'?`機體已毀：按僚機技能花 ${DRONE_BUILD_COST} 廢料生產新機。`:'請先回收機體，才能在此修復。'}</p>`;
  const reason=droneRepairReason(game,a.id),amount=Math.min(a.maxHp-a.hp,Math.ceil(a.maxHp*DRONE_REPAIR_FRACTION));
  return `<div class="ground-loot"><strong>${a.hp?'機體收納中':'殘骸已收納 · 待修復'}</strong><small>HP ${a.hp}/${a.maxHp} · 修復 +${amount} 生命，最多補滿；不補彈藥。</small><button data-repair-drone="${a.id}" ${reason?'disabled':''}>${reason||`修復 · ${DRONE_REPAIR_COST} 廢料 · 1 回合`}</button>${reason&&a.hp<a.maxHp?`<small>需要 ${DRONE_REPAIR_COST} 廢料 · 1 回合</small>`:''}</div>`;
}
function showInventory(tab=inventoryTab,message='') {
  inventoryTab=Object.hasOwn(INVENTORY_TABS,tab)?tab:'weapon';
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1),category=inventoryTab;
  let content='';
  if(category==='weapon')content=`    <div class="pack-ammo">${AMMO_IDS.map(id=>`<span>${AMMUNITION[id].name}<b>${p[AMMUNITION[id].key]} / ${game.ammoCapacity(id)}</b></span>`).join('')}</div><p class="ammo-summary">備彈上限與彈匣分開計算。拾取只補到上限，多出的留在地上。<br>護甲板吸收直接傷害的至多一半，消耗後可拾取修復；不擋毒液或高熱。<br>換裝所需回合標於各武器按鈕；交換、拾取、拆解、改裝與補給各消耗 1 回合。比較不耗時；走上武器會在有空格時收下，相同槍種不再自動拆解。</p>
    <div class="pack-weapons">${p.owned.map(index=>{const w=game.weaponAt(index),d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index],cost=25+level*15;return `<article class="pack-weapon ${active?'equipped':''}"><img src="./assets/${w.file}.svg" alt="${w.name}"><div><small>${active?'已裝備':'備用'} / ${w.code}</small><h3>${w.name}${level?` +${level}`:''}</h3><p>${w.affixText}</p><span>傷害 ${d.min}–${d.max}${w.closeRange?` · 1–2 格 ${game.weaponDamage(index,{x:p.x+1,y:p.y}).min}–${game.weaponDamage(index,{x:p.x+1,y:p.y}).max}／命中 +15`:''}${w.burst?` ×${w.burst}`:''} · 射程 ${w.range} · ${ammoName(w)} · ${magazineLabel(w,p.ammo[index])}${w.locked?' · 固定裝備':''}</span><div class="pack-actions"><button data-equip="${index}" ${active?'disabled':''}>裝備 · ${game.actionCost('weapon',index)} 回合</button><button data-salvage="${index}" ${p.owned.length<=1||w.locked?'disabled':''}>${w.locked?'固定裝備':`拆解 +${20+level*10}`}</button>${active?`<button data-bag-action="upgrade" ${p.scrap<cost||level>=3?'disabled':''}>${level>=3?'改裝已滿':`改裝 ${cost} 廢料`}</button>`:''}</div></div></article>`;}).join('')}</div>
    ${ground.map(item=>{const w=game.weaponAt(item.slot);return `<div class="ground-loot"><strong>附近：${w.name}${p.upgrades[item.slot]?` +${p.upgrades[item.slot]}`:''}</strong><small>${w.affixText} · 彈匣 ${p.ammo[item.slot]}/${w.mag}</small><button data-compare="${item.slot}">比較／拾取／交換</button></div>`;}).join('')}
`;
  else {
    const selected=preparedEntry(p,category),options=preparedOptions(p,category);
    content=`${category==='grenade'?`<p>投擲物共用容量：<strong>${grenadeTotal(p)} / ${game.ammoCapacity('grenade')}</strong>。全部種類合計，永久手榴彈攜行升級可提高此上限。使用消耗 1 回合。</p>`:''}<p>目前預備：<strong>${selected?.name||'無'}</strong>。預備／取消預備不耗回合；回到戰場後按對應按鈕使用。</p>
      <div class="prepared-list">${options.map(([id,entry])=>`<article class="prepared-entry ${p.prepared[category]===id?'equipped':''}"><h3>${entry.icon} ${entry.name}</h3><p>${entry.text}${id==='medkit'?` 目前回復 ${45+p.healBonus} 生命。`:''}</p><span>${entry.resource?`持有 ${p[entry.resource]}`:category==='skill'?(ALLY_SKILLS.includes(id)?allySkillState(game,id):skillStatus(p,id)+' · 冷卻剩餘 '+(p.skillState[id]?.cooldown||0)):'已學會'}</span><button class="modal-button secondary" data-prepare-category="${category}" data-prepare-id="${id}" ${p.prepared[category]===id?'disabled':''}>${p.prepared[category]===id?'已預備':'預備 · 不耗回合'}</button></article>`).join('')}</div>
      ${!options.length?'<p class="pack-empty">尚未學會主動技能。</p>':''}
      ${selected?`<button class="modal-button secondary" data-prepare-category="${category}" data-prepare-id="">取消預備 · 不耗回合</button>`:''}
      ${category==='skill'?`<h3>同行與留置友軍</h3><p>${game.allies.length?game.allies.map(a=>`${allyName(a)} · ${a.status==='packed'?(a.kind==='pet'?(a.hp<a.maxHp?`收納回血中（每回合 +${PET_REGEN}）`:'滿血，等空位歸隊'):a.hp?'收納中':'收納中／待修復'):a.status==='down'?'倒地':a.status==='destroyed'?'已毀':'活動'} · 第 ${a.floor} 層 · HP ${a.hp}/${a.maxHp}${a.kind==='drone'?` · ${a.ammo}/${allyWeapon(a).mag} 發`:''}`).join('<br>'):'無'}。</p>${droneMaintenance()}<h3>目前被動規則</h3><p>${traitLabels(p).join(' · ')||'無'}。<br>${(p.traits||[]).map(t=>`${TRAITS[t.id].name}${t.turns?`（剩 ${t.turns} 回合）`:''}：${TRAITS[t.id].text}`).join('<br>')}</p><p>被動自動生效，不占主動技能預備欄。</p>`:''}`;
  }
  modal(`<div class="eyebrow">FIELD PACK / ${p.owned.length} OF ${game.weaponCapacity}</div><div class="operator-identity">${portraitMarkup(p.portrait)}<div><h2>作戰背包</h2><p>${characterName(p.character)} · 裝甲 ${p.armor}<br>${combatStatSummary(p)}<br>${game.missionSummary}</p></div></div>
    <div class="inventory-tabs" role="tablist" aria-label="背包分類">${Object.entries(INVENTORY_TABS).map(([id,label])=>`<button id="pack-tab-${id}" role="tab" aria-controls="pack-panel" aria-selected="${id===category}" tabindex="${id===category?0:-1}" data-inventory-tab="${id}">${label}</button>`).join('')}</div>
    ${message?`<p role="status">${escapeHTML(message)}</p>`:''}
    <section id="pack-panel" role="tabpanel" aria-labelledby="pack-tab-${category}" tabindex="0">${content}</section>
    <div class="pack-resources"><span>◇ 廢料 <b>${p.scrap}</b></span><span>▣ 護甲板 <b>${p.plates}/${game.plateCapacity}</b></span></div>
    <button class="modal-button secondary" data-modal="journal">資料與紀錄</button><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);
}
function showWeaponComparison(take,against=game.player.weapon){
  const p=game.player,item=game.nearbyWeapon(take);if(!item||!p.owned.includes(against)){showInventory();return;}
  const old=game.weaponAt(against),next=game.weaponAt(take),a=game.weaponDamage(against),b=game.weaponDamage(take);
  const shot=w=>clampHit(w.melee?w.hitChance+actorStat(p,'meleeAccuracy'):97+w.accuracyBonus+actorStat(p,'rangedAccuracy')),pierce=w=>`${Math.round(w.pierce*100)}%`;
  const close=slot=>{const w=game.weaponAt(slot),d=game.weaponDamage(slot,{x:p.x+1,y:p.y});return w.closeRange?`${d.min}–${d.max}／命中 +${w.closeAccuracy}`:'同一般傷害';};
  const rows=[['1–2 格特效',close(against),close(take)],['單次傷害',`${a.min}–${a.max}`,`${b.min}–${b.max}`],['每次攻擊發數',old.burst||1,next.burst||1],['靜止裸露命中',`${shot(old)}%`,`${shot(next)}%`],['移動目標命中',`${shot({...old,accuracyBonus:old.accuracyBonus-22+old.tracking})}%`,`${shot({...next,accuracyBonus:next.accuracyBonus-22+next.tracking})}%`],['射程',old.range,next.range],['彈匣',magazineLabel(old,p.ammo[against]),magazineLabel(next,p.ammo[take])],['彈種',ammoName(old),ammoName(next)],['穿透',pierce(old),pierce(next)],['改裝等級',`+${p.upgrades[against]}`,`+${p.upgrades[take]}`]];
  modal(`<div class="eyebrow">WEAPON COMPARISON</div><h2>${next.name}</h2><p>${next.affixText}<br>${next.desc}</p><p>比較對象：${old.name} ${against===p.weapon?'（已裝備）':'（備用）'}<br>${old.affixText}</p><div class="pack-actions">${p.owned.map(slot=>`<button data-compare="${take}" data-against="${slot}" ${slot===against?'disabled':''}>${game.weaponAt(slot).name} +${p.upgrades[slot]} · ${magazineLabel(game.weaponAt(slot),p.ammo[slot])}</button>`).join('')}</div><table class="weapon-comparison"><thead><tr><th>能力</th><th>持有</th><th>地面</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th>${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}</tbody></table><p>命中欄含天生命中修正，未計入條件被動／等待／掩體／目標迴避；傷害含本局模組與改裝，未扣目標護甲。穿透減少護甲與掩體減傷，不提高命中率。</p>${p.owned.length<game.weaponCapacity?`<button class="modal-button" data-take="${take}">收進空格 · 1 回合</button>`:''}${old.locked?'<p>裝甲內建武器不能交換或拆解，切換進出不耗回合。</p>':`<p>交換會將${old.name}連同剩餘彈匣、詞條與改裝放在腳下。${against===p.weapon?'新武器立即裝備。':'目前裝備不變。'}</p><button class="modal-button" data-replace="${take}" data-leave="${against}">交換此武器 · 1 回合</button>`}<button class="modal-button secondary" data-modal="bag">返回背包</button>`,true);
}
function showTerminal(){const p=game.player;modal(`<div class="eyebrow">SUPPLY TERMINAL / ONE USE</div><h2>選擇需要的補給。</h2><p>此終端只能交易一次，耗費 1 回合。持有廢料：${p.scrap}。容量不足時，多出的補給留在腳下。</p><button class="perk" data-terminal="heal" ${p.scrap<15||p.hp===p.maxHp&&!p.poison?'disabled':''}><strong>醫療修復 · 15 廢料</strong><span>回復 60 生命並清除中毒。</span></button>${AMMO_IDS.map(id=>{const offer=TERMINAL_AMMO[id],info=AMMUNITION[id];return `<button class="perk" data-terminal="${id}" ${p.scrap<offer.cost||p[info.key]>=game.ammoCapacity(id)?'disabled':''}><strong>${info.name} +${offer.amount} · ${offer.cost} 廢料</strong><span>目前 ${p[info.key]} / ${game.ammoCapacity(id)}</span></button>`;}).join('')}${Object.entries(GRENADES).map(([id,entry])=>`<button class="perk" data-terminal="${entry.item}" ${p.scrap<entry.cost||grenadeTotal(p)>=game.ammoCapacity('grenade')?'disabled':''}><strong>${entry.name} +${entry.amount} · ${entry.cost} 廢料</strong><span>持有 ${p[entry.resource]} · 共用容量 ${grenadeTotal(p)} / ${game.ammoCapacity('grenade')}</span></button>`).join('')}<button class="modal-button secondary" data-modal="close">返回戰場</button>`);}
function carryingSummary(levels){return Object.entries(AMMUNITION).map(([id,info])=>`${info.short} ${levels[id]}`).join('／');}
// Operator order is the user's preferred reading order; skills follow the
// operator that owns them, so a class without a skill simply contributes none.
const OPERATOR_ORDER=['soldier','recon','engineer','necromancer','druid','bulwark'];
function showCarrying(message=''){
  const p=profile(),spent=Object.keys(AMMUNITION).reduce((sum,t)=>sum+carryingSpent(p.upgrades.carrying[t]),0);
  const card=({name,hint,tier,cap,button,attrs='',locked=false})=>`<article class="upgrade-card${locked?' unlocked':''}"><span class="upgrade-tier">${tier} / ${cap}</span><h3>${name}</h3><p>${hint}</p><button ${attrs} ${locked?'disabled':''}>${button}</button></article>`;
  const section=(label,cards,open=false)=>`<details class="upgrade-section"${open?' open':''}><summary><span class="eyebrow">${label}</span><small>${cards.length}</small></summary><div class="upgrade-grid">${cards.join('')}</div></details>`;
  // Placeholder tiles: unlock gating is not implemented yet, so everything reads as unlocked.
  const shown=(name,hint)=>card({name,hint,tier:1,cap:1,button:'已解鎖',locked:true});

  const carry=Object.entries(AMMUNITION).map(([id,info])=>{
    const level=p.upgrades.carrying[id],cost=CARRY_COSTS[level],bonus=classCarryBonus(game.player.character,id);
    return card({name:info.name,hint:`容量 ${capacity(id,level)+bonus}${cost!==undefined?` → ${capacity(id,level+1)+bonus}`:''}`,
      tier:level,cap:CARRY_COSTS.length,button:cost===undefined?'已滿階':`升級 · ${cost} 點`,
      attrs:`data-buy-carry="${id}" data-carry-level="${level}"${cost===undefined||p.protocol.balance<cost||!storage.available||storage.recoveryPending?' disabled':''}`});
  });
  const order=orderedCharacters();
  const operators=order.map(id=>{const c=CHARACTERS[id];return shown(c.label,c.skills?.length?SKILLS[c.skills[0]].name:`生命 ${c.hp} · 裝甲 ${c.armor}`);});
  const owned=order.flatMap(id=>CHARACTERS[id].skills||[]);
  const skillOrder=[...owned,...Object.keys(SKILLS).filter(k=>!owned.includes(k))];
  const guns=WEAPONS.filter(w=>!w.locked).map(w=>shown(w.name,`${w.code} · 傷害 ${w.min}–${w.max}`));
  const throwables=Object.values(GRENADES).map(g=>shown(g.name,`射程 5 · 半徑 2`));
  const skills=skillOrder.map(id=>{const k=SKILLS[id];return shown(k.name,`${k.cost?`耗 ${k.cost} 回合`:'免費啟動'}${k.cooldown?` · 冷卻 ${k.cooldown}`:''}`);});

  modal(`<div class="eyebrow">PERMANENT EQUIPMENT</div><h2>永久升級</h2>
${message?`<p role="status">${escapeHTML(message)}</p>`:''}
<p>協定點數 <strong>${p.protocol.balance}</strong>${spent?` · 已投入 ${spent}`:''}</p>
${section('攜行容量',carry,true)}
${section('幹員',operators)}
${section('武器',guns)}
${section('投擲物',throwables)}
${section('技能',skills)}
<div class="eyebrow settings-section">重置</div>
<p>${spent?`清除全部攜行等級並退還已投入的 ${spent} 點。`:'目前沒有已投入的攜行升級。'}重置免費，不影響解鎖、任務與紀錄。</p>
<button class="modal-button secondary" data-modal="resetCarrying" ${spent&&storage.available&&!storage.recoveryPending?'':'disabled'}>重置所有升級</button>
<button class="modal-button secondary" data-modal="close">返回</button>`,true);
}
function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>適應，然後生存。</h2><p>強化生效至本次任務結束。${game.pendingPerks>1?`還有 ${game.pendingPerks} 次選擇。`:''}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>＋ ${p.name}</strong><span>${p.text}</span></button>`).join('')}`);}
function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>留下你的足跡。</h2><div class="journal-tabs"><button data-modal="journal">任務紀錄</button><button data-modal="bestiary">敵人圖鑑</button><button data-modal="help">操作指南</button></div><p>${game.missionSummary}</p><div class="result-stats"><div><b>${records.runs}</b>完成任務</div><div><b>${records.wins}</b>成功撤離</div><div><b>${records.bestFloor}/6</b>最深紀錄</div></div><h3>協定點數 ${records.protocol.balance}</h3><p>本次累積 ${game.protocol.earned} · 死亡仍保留。可用於永久攜行升級；Soldier／Recon／Bulwark 基礎角色免費，新武器掉落池與更多角色解鎖尚未開放。</p><h3>本次收集 ${p.lore.length} / 6</h3>${p.lore.length?p.lore.map(f=>`<p class="lore-entry"><strong>${pad(f)} / ${FLOORS[f-1]}</strong><br>${LORE[f-1]}</p>`).join(''):'<p>探索各層紫色資料片段，拼湊設施的秘密。</p>'}<h3>最近任務</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>${MISSIONS[r.mission]?.name||MISSIONS.extraction.name} · ${characterName(r.character)} · RUN ${r.seed} · ${r.outcome==='abandoned'?'放棄':r.won?'撤離':'陣亡'} · ${r.floor} 層 · ${r.kills} 擊殺 · ${r.turn} 回合</p>`).join(''):'<p>第一次任務紀錄尚未完成。</p>'}<button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function bestiary(){modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>了解你的敵人。</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${id==='boss'?'Ω':id==='drone'?'◇':'!'}</span><div><h3>${e.name}</h3><small>基礎生命 ${e.hp} · 射程 ${e.range} · 護甲 ${e.armor}</small><p>${e.role}</p><p>${traitLabels({traits:startingTraits(id,game.floor)}).join(' · ')||'無被動規則'}${id==='crawler'?'（第 4 層起：快速）':''}</p></div></article>`).join('')}</div><h3>被動規則</h3>${Object.values(TRAITS).map(t=>`<p><strong>${t.name}</strong>：${t.text}</p>`).join('')}<p>相反規則互相抵銷，同名多個來源不疊加。快速 → 普通 → 緩速，各階玩家優先，每人每回合行動一次。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD 3.43.0</div><h2>每一步，都要算數。</h2><p>部署時選擇六層深入或三層往返任務。原路回收：第 3 層取件、擊敗封鎖官，再沿入口上樓回第 1 層撤離；回程不補給，每層至多兩名增援，預告兩次行動後傳送，抵達當輪不攻擊。第 3 層擊敗封鎖官；第 6 層依簡報完成核心殲滅、指定殲滅或機密回收，再從綠色電梯撤離。點上方任務標題查看進度；地圖只標出已探索資料匣與當前可見指定敵人。</p><div class="help-grid"><b>四方向</b><span>↑ ↓ ← → 就是畫面上的上下左右。方向鈕、鍵盤 WASD / 方向鍵或點相鄰格移動。</span><b>射擊</b><span>點敵人、掩體或油桶鎖定，再按開火 / Space。目標鈕 / Tab 輪換敵人。瞄準鈕 / Q 收起或顯示浮卡、鎖定框及目標取景，關閉時仍可開火，視野如同沒有鎖定目標；點擊敵人會重新開啟瞄準。有敵人時會閃爍提醒。</span><b>友軍與職業</b><span>工程師兩種僚機技能共用一台 90 HP 機體，都用你的步槍彈；部署／近距回收各耗一回合，切模式先回收；部署或生產時會進入選點，點你身邊 2 步內的空格後按右下確認，再按技能取消。追隨模式閒置時貼在你身邊，可隨時換位。機體在你 3 步內會自己換彈（打空，或閒著時剩一半以下），用牠自己的行動。追隨模式射程 7；哨兵模式裝甲 5、可利用掩體。受傷時回收後在背包技能頁修復，每次 ${DRONE_REPAIR_COST} 廢料／1 回合，恢復 50% 最大生命。損毀或留在別層時，按任一僚機技能花 ${DRONE_BUILD_COST} 廢料、1 回合生產新機，直接部署在你身邊。德魯伊技能指定已探索六格內目的地，右下確認，點自己召回；指令免費，下次寵物行動執行。寵物會追擊離你九格內的敵人。倒地後走到同格或相鄰格按技能，花一回合回收，不耗醫療包；收納中每回合回五點生命，回滿且技能預備中會自行回到你身邊，收納時按技能可花一個醫療包立刻回半血。死靈法師不用施法：本層倒下過的非頭目敵人每四回合自動有一隻起身為召喚物，倒下越多的種類越常出現，屍體不消耗，最多三隻；召喚物 HP 與傷害同原敵人，會主動追擊離你九格內的敵人。按技能免費集結，三回合內召喚物回到你身邊，換層前記得用。友軍六格繩索，附近提供視線，敵人會攻擊牠們；爆炸與失能同樣有效。有目標時友軍在繩索內持續交戰，沒有目標才跟回身邊。朝友軍移動會與牠交換位置，照常花 1 回合，友軍放棄一次行動；哨兵、失能或隔著矮隔板時不能換。窄路上友軍之間也會互換位置讓路，但不會打斷正在攻擊的友軍。換層時三格可通路內活友軍同行，保留 HP／彈藥，太遠召喚物消失，寵物與機體留在原層。回程才能重新會合。</span><b>新增戰術</b><span>士兵預警：免費啟動，8 格內敵人位置以光點穿牆顯示，持續至下一次耗回合行動結束；不追蹤移動、不提供射線，同時向被掃描敵人暴露你的位置。冷卻 5 次行動。矮隔板耐久 60、不擋視線或爆炸，提供箱體等級掩護；朝它移動直接翻越、耗 1 回合，至下次自己行動前被射擊命中 +20，敵我相同，落點有人不能翻。霰彈槍 1–2 格基礎傷害 60–72、命中 +15；更遠維持 42–54。走廊沿用連接其中一房的照明，畫面柔化不改各格明暗與視線規則。</span><b>門與隔板</b><span>障礙物在兩格之間，不占地板。朝關門移動：花 1 回合開門，人留原地；再移動才通過。正面或斜角可從右下互動鍵開／關，皆花 1 回合、人留原地；斜角與同側門前格之間不能有牆或障礙阻隔。點門板或隔板邊界可鎖定破壞：門耐久 60、隔板 90。關閉時阻擋通行、視線與爆炸，並提供方向性掩體；打開或摧毀後讓出通道。人型／一般機械會開門，獸類與重型近戰敵人破門。敵人記得最後看見你的位置，關門不會讓它忘記你。</span><b>掩體</b><span>掩體朝向與來火偏角小於 45° 為完整，45° 起半效，約 63.4°（側向是正向兩倍）起無效。半效命中懲罰與減傷減半，多個掩體取最強、不疊加。牆角仍可探身，但平行來火不提供掩護；爆炸傷害不吃掩體減傷。</span><b>行動順序</b><span>快速 → 普通 → 緩速，同速玩家先行動。選定有效行動後不能重選；射擊追蹤原目標，目標先移出視線／射程仍向最後確認位置開火落空，消耗彈藥與回合。等待防護從自己行動後生效，維持到下次自己行動前。移動閃避維持到自己的下次行動；狙擊手的蓄勢鎖定仍射向原落點。回合末才結算轟炸與地形。</span><b>角色被動</b><span>士兵：自己相對目標有掩體時命中 +12；連續回合射擊同一敵人，後續每次 +8、最高 +24。未命中仍累積，耗回合的其他動作中斷；同輪連發只算一次。偵察兵：相對攻擊者主要橫向移動時，被射擊命中額外 −20，暴露時移動與側身合計至少 −42；手槍彈種武器免費裝填，仍扣備彈。免費動作不消耗等待或中斷連射。</span><b>重裝兵</b><span>大型、笨拙、緩速：普通敵人先行動，每回合仍移動一格。生命 200、裝甲 6、直接傷害再減 25%（不擋環境與中毒）。輕機槍三連發使用步槍彈；動力拳相鄰一格、基礎命中 99%、無限使用，無視掩體。朝相鄰敵人移動會使用背包最前、切入切出皆免費的近戰武器攻擊，耗 1 回合、留在原地且保留目前槍械；門關閉時先開門。固有技能「下錨」：啟動／解除各 1 回合，下錨時不能移動或換層、套用笨拙；自己的武器射擊與近戰在普通及緩速各執行一次，分別消耗彈藥。第二次射擊仍追蹤原目標；投擲物與友軍不加倍，投擲仍在原本速度使用一次。動力拳不能拆解或交換，可改裝；切換進出不耗回合，實際攻擊才耗回合。</span><b>兵種配給</b><span>Soldier 射擊命中 +8。Recon 射擊迴避 +10，基礎投擲容量 6；開局煙霧／EMP 各 2 顆，預備煙霧。永久投擲升級另加容量。生命／裝甲：士兵與偵察兵 100／0，重裝兵 200／6。近戰有獨立命中／迴避修正，三兵種初值均 0。被動自動生效。Recon 起始學會並預備「訊號斷層」，免費啟動，持續 3 次耗回合行動、冷卻 6 次（啟動起算）。敵人暫時無法更新你的位置，但會搜索最後目擊處；已鎖定的狙擊與轟炸仍會落下。免費裝填／預備不倒數，下樓結束效果、保留冷卻。</span><b>照明與感知</b><span>部分房間停電，目標在暗區時射擊命中 −40 個百分點，可與移動／掩體疊加，不額外減傷。夜視消除此懲罰；紅外線看穿煙霧但不穿牆、不自帶夜視。Recon 起始兩者都有；狙擊手有夜視、封鎖官有紅外線。生物或有任一感知被動者都會被震撼彈失能，機械也不例外；多條符合不重複結算。</span><b>命中率</b><span>暴露且靜止 97%；移動 −22%。完整箱體 −35、牆／隔板 −42 個百分點；半效為 −18／−21。完整減傷 45%、半效 22.5%，敵我規則相同。角落的半透明卡片顯示名稱、HP、命中率、距離與掩體；卡片不攔截觸控。</span><b>手榴彈</b><span>先在背包的手榴彈分頁預備，再按 G 或投擲物按鈕，點地板選落點，再按右下「確認投擲」；原手榴彈按鈕可取消。四種投擲物共用容量，射程 5、半徑 2。破片會自傷與連鎖引爆；EMP 對機械、震撼彈對生物或有夜視／紅外線者，跳過 4 次自身行動（頭目 2 次；投擲當回合還沒行動的，當回合就算第 1 次），恢復後免疫 2 次行動；震撼彈會影響自己，失能時按中央等待恢復。煙霧持續 5 輪（含投擲當輪），阻擋無紅外線者的視線、煙內只見相鄰格，不擋爆炸與已鎖定落點的狙擊。</span><b>背包</b><span>B 開啟背包，分為武器／手榴彈／道具／技能。投擲物、道具與技能各有獨立預備欄，預備不耗回合；使用成本依項目，訊號斷層免費啟動。被動自動生效。可帶 3 把武器。在背包直接選擇武器換裝，所需回合顯示於按鈕。Q 開關瞄準資訊（不耗回合）、R 裝填、H 使用預備道具、F / 句點 / 中央鈕等待：自己行動後至下次行動前，直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15（最高 99%）。加成不疊加；任何有效行動後失效。</span><b>補給</b><span>低矮補給箱可走過、不提供掩體且不會被破壞。靠近後用右下互動開箱，花 1 回合；內容固定，落地後走上去拾取。箱內物資不會直接進背包，空箱留下。武器、資料片與敵人掉落仍在地上。走上道具即可拾取；護甲板滿額時留在原地。彈藥庫有五類備彈，醫療室與裝甲庫提供專用補給，探索地圖可查看已發現的補給。五類備彈與手榴彈各有上限，多出的留在地上；可用協定點數永久提高容量。靠近終端以廢料選購指定彈種。武器可帶一種詞條，背包可比較並交換；同類武器分別保留彈匣與改裝，不會自動拆解。拆解回收備彈／廢料，改裝增傷至 +3。</span><b>生活區與補給站</b><span>新樓層有 1–2 處衛浴間、門禁櫃檯或值勤哨站；家具可破壞，和箱體一樣提供掩體。衛浴間以門與隔板圍合，標記 WC／ACCESS／POST。地板標線沒有額外互動或保證獎勵。每層補給站縮為兩座：主路一座、探索支路一座；各只能購買一次，價格不變，已發現站可在地圖查看。</span><b>危險</b><span>! 代表敵人蓄勢。紅色轟炸格兩回合後爆炸；綠色毒液與橘色高熱格會傷害站在上面的單位。</span><b>撤離</b><span>到綠色電梯鄰格，按電梯按鈕或 E。本層頭目或最終任務要求未完成時電梯鎖定。</span><b>存檔</b><span>每步自動儲存在目前瀏覽器。設定可匯出 / 匯入存檔，避免換裝置失去進度。</span></div><button class="modal-button" data-modal="close">收到，返回戰場 →</button>`,true);}
function settings(){
  // 主選單進來只顯示全域設定；局內功能（指南、升級、簡介、放棄、重新部署）留在遊戲中的選單。
  const inRun=entered,sec=label=>`<div class="eyebrow settings-section">${label}</div>`;
  modal(`<div class="eyebrow">SYSTEM / BUILD 3.43.0</div><h2>${inRun?'作戰設定':'系統設定'}</h2>
<p>${inRun?`${characterName(game.player.character)} · 任務 ${game.seed} · 第 ${game.floor} 層 · ${game.turn} 回合`:`協定點數 ${profile().protocol.balance}`}<br>${storage.available?'進度已自動儲存。':'本機儲存不可用，請匯出存檔保留進度。'}</p>
${sec('顯示')}
${inRun?`<div class="modal-row"><button class="modal-button secondary" data-modal="sound">音效：${audio.enabled?'開啟':'關閉'}</button><button class="modal-button secondary" data-modal="help">作戰指南</button></div>`:`<button class="modal-button secondary" data-modal="sound">音效：${audio.enabled?'開啟':'關閉'}</button>`}
<button class="modal-button secondary" data-modal="movementBoundaries" aria-pressed="${renderer.movementBoundaries}">移動邊界白線：${renderer.movementBoundaries?'開啟':'關閉'}</button>
<p>沿可見牆與障礙物標示輪廓；斷點不延伸。門另以綠線表示關閉、兩側綠點表示開啟。</p>
<label class="boundary-opacity" for="boundary-opacity">白線不透明度 <output id="boundary-opacity-value" for="boundary-opacity">${renderer.boundaryOpacity}%</output><input id="boundary-opacity" type="range" min="0" max="100" step="5" value="${renderer.boundaryOpacity}" aria-describedby="boundary-opacity-help"></label>
<p id="boundary-opacity-help">0% 完全透明，100% 不透明；只調整白線，綠色門提示不受影響。</p>
${sec('存檔')}
<div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">完整備份</button><button class="modal-button secondary" data-modal="backupImport">還原備份</button></div>
${read('ash-backup-before-restore')?'<button class="modal-button secondary" data-modal="backupPrevious">下載還原前備份</button>':''}
<p>完整備份包含點數、攜行等級、解鎖、任務歷史與目前任務。下方僅匯出／匯入單局任務。</p>
<div class="modal-row"><button class="modal-button secondary" data-modal="export">匯出任務</button><button class="modal-button secondary" data-modal="import">匯入任務</button></div>
${sec('紀錄')}
<button class="modal-button secondary" data-modal="journal">任務紀錄與敵人圖鑑</button>
${inRun?`${sec('本局')}<button class="modal-button secondary" data-modal="carrying">永久攜行升級</button><button class="modal-button secondary" data-modal="mission">任務簡介</button><button class="modal-button secondary" data-modal="abandon" ${game.status!=='playing'?'disabled':''}>放棄本局（保留永久進度）</button><button class="modal-button secondary" data-modal="restart">重新部署新任務</button>`:''}
${sec('危險')}
<button class="modal-button secondary" data-modal="resetProgress">重置遊戲進度</button>
<button class="modal-button" data-modal="close">${inRun?'繼續任務 →':'← 返回主選單'}</button>`);
}
function showResult(){const won=game.status==='won',abandoned=game.status==='abandoned',p=game.player;modal(`<div class="eyebrow">${abandoned?'MISSION ABANDONED':won?'SIGNAL RESTORED':'SIGNAL LOST'} / RUN ${game.seed}</div><h2>${abandoned?'任務已放棄。':won?'灰燼之中，仍有回音。':'這次的訊號，到此為止。'}</h2><p>${abandoned?'已賺取的協定點數與永久升級保留，這次任務已結束。':won?'任務目標已完成。你搭上最後一班撤離電梯。':'你留下的紀錄將協助下一位行動員。掩體、補給與適時撤退，都能改變下一次任務。'}</p><p>${game.missionSummary}</p><div class="result-stats"><div><b>${pad(game.deepestFloor)}</b>最深樓層</div><div><b>${p.kills}</b>消滅敵人</div><div><b>${game.turn}</b>行動回合</div></div><p>本次協定點數 +${game.protocol.earned} · 累計持有 ${profile().protocol.balance}<br>死亡仍保留，可購買永久攜行升級。</p><div class="operator-identity result-identity">${portraitMarkup(p.portrait,game.status)}<p>${characterName(p.character)}<br>總傷害 ${p.stats.damage} · 投擲 ${p.stats.grenades} · 資料 ${p.lore.length}/6</p></div><button class="modal-button secondary" data-modal="lastBattle">查看最後戰場</button><button class="modal-button secondary" data-modal="carrying">永久攜行升級</button><button class="modal-button" data-modal="deploy">重新部署 →</button>`);}
function newGame(seed,character,mission){const portrait=deploymentFaces[character];if(!validCharacter(character)||!validPortrait(portrait)||!validMissionId(mission)){notify('請選擇有效角色。');return;}if(game.status==='playing'&&(entered||resumable)){try{abandonRun(game);}catch(error){backupError(error);return;}}entered=true;resumable=false;game=new Game(seed,profile().unlocks.weapons,profile().upgrades.carrying,character,portrait,mission);playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();floorToast();}
function exportSave(){const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ash-protocol-${game.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('存檔已匯出。');}
function downloadJSON(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function backupError(error){modal(`<h2>備份操作未完成</h2><p>${escapeHTML(error.message)}</p><button class="modal-button" data-modal="backupCancel">返回設定</button>`);}
function adoptSnapshot(next){
  game=next.game||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying);entered=Boolean(next.game);resumable=Boolean(next.game);
  playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];cancelAim();lastStatus='playing';previousFloor=game.floor;
  $('#modal').close();update();if(!entered)showIntro();
}
function applyBackup(){
  if(!pendingBackup)return;
  try{
    const next=restoreBackup(pendingBackup,game);pendingBackup=null;
    adoptSnapshot(next);notify('完整備份已還原；原資料可在設定下載。');
  }catch(error){backupError(error);}
}

$('#import-backup').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;pendingBackup=null;
  try{
    if(file.size>BACKUP_LIMIT)throw new Error('備份檔案超過 5 MB 限制。');
    const raw=await file.text(),next=previewBackup(raw),p=next.snapshot.profile;pendingBackup=raw;
    modal(`<div class="eyebrow">RESTORE BACKUP</div><h2>還原這份完整備份？</h2><p>${escapeHTML(file.name)}<br>${escapeHTML(new Date(next.snapshot.createdAt).toLocaleString('zh-TW'))}</p><p>協定點數：${profile().protocol.balance} → ${p.protocol.balance}<br>攜行等級：${carryingSummary(profile().upgrades.carrying)}<br>→ ${carryingSummary(p.upgrades.carrying)}<br>任務紀錄：${p.runs} 次 · 解鎖武器 ${p.unlocks.weapons.length} · 角色 ${p.unlocks.characters.length}<br>${next.game?`備份任務 ${next.game.seed} · 第 ${next.game.floor} 層 · ${next.game.turn} 回合`:'備份沒有進行中的任務，還原後可開始新任務。'}</p><p>點數、紀錄與目前任務會以備份快照替換。還原前會自動保存原資料，可回設定下載。</p><button class="modal-button" data-modal="backupConfirm">確認還原</button><button class="modal-button secondary" data-modal="backupCancel">取消</button>`);
  }catch(error){backupError(error);}e.target.value='';
});

document.addEventListener('change',e=>{
  if(e.target.name!=='mission'||!e.target.closest('.mission-list'))return;
  for(const p of document.querySelectorAll('.mission-brief>p'))p.classList.toggle('active',p.dataset.mission===e.target.value);
});
document.addEventListener('input',e=>{
  if(e.target.id!=='boundary-opacity')return;
  renderer.boundaryOpacity=boundaryOpacityPercent(e.target.value);write('ash-boundary-opacity',String(renderer.boundaryOpacity));
  const output=$('#boundary-opacity-value');if(output)output.textContent=renderer.boundaryOpacity+'%';
});

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(playback||orientationBlocked||!b||b.disabled)return;
  if(b.dataset.inventoryTab){showInventory(b.dataset.inventoryTab);$(`[data-inventory-tab="${inventoryTab}"]`).focus({preventScroll:true});return;}
  if(b.dataset.prepareCategory){
    const category=b.dataset.prepareCategory,id=b.dataset.prepareId||null;
    if(game.action('prepare',{category,id})){update();showInventory(category,id?'已預備，不耗回合。':'已取消預備，不耗回合。');$(`[data-inventory-tab="${category}"]`).focus({preventScroll:true});}return;
  }
  if(b.dataset.buyCarry!==undefined){try{purchaseCarrying(game,b.dataset.buyCarry,Number(b.dataset.carryLevel));update();showCarrying(`${AMMUNITION[b.dataset.buyCarry].name}攜帶上限已升級。`);}catch(error){showCarrying(error.message);}return;}
  if(b.dataset.context){close();if(b.dataset.context.startsWith('objective:')){act('recoverObjective',b.dataset.context.slice(10));return;}if(b.dataset.context.startsWith('case:')){act('openContainer',b.dataset.context.slice(5));return;}if(b.dataset.context.startsWith('door:')){const door=game.nearbyDoors.find(d=>d.id===b.dataset.context.slice(5));if(door)act('door',{id:door.id,open:!door.open});}else if(b.dataset.context==='bag')showInventory('weapon');else if(b.dataset.context==='terminal')showTerminal();else act('interact');return;}
  if(b.dataset.move){move(...b.dataset.move.split(',').map(Number));return;}
  if(b.dataset.perk){game.choosePerk(b.dataset.perk);$('#modal').close();audio.play('heal');update();return;}
  if(b.dataset.equip!==undefined){modalAction('weapon',Number(b.dataset.equip));return;}
  if(b.dataset.compare!==undefined){showWeaponComparison(Number(b.dataset.compare),b.dataset.against===undefined?game.player.weapon:Number(b.dataset.against));return;}
  if(b.dataset.replace!==undefined){modalAction('replaceWeapon',{take:Number(b.dataset.replace),leave:Number(b.dataset.leave)});return;}
  if(b.dataset.take!==undefined){modalAction('takeWeapon',Number(b.dataset.take));return;}
  if(b.dataset.salvage!==undefined){const index=Number(b.dataset.salvage);modal(`<div class="eyebrow">SALVAGE WEAPON</div><h2>拆解${game.weaponAt(index).name}？</h2><p>回收彈匣內的備彈與廢料。武器將從背包移除，耗費 1 回合。</p><button class="modal-button" data-confirm-salvage="${index}">確認拆解</button><button class="modal-button secondary" data-modal="bag">返回背包</button>`);return;}
  if(b.dataset.confirmSalvage!==undefined){modalAction('salvage',Number(b.dataset.confirmSalvage));return;}
  if(b.dataset.repairDrone){modalAction('repairDrone',b.dataset.repairDrone);return;}
  if(b.dataset.bagAction){modalAction(b.dataset.bagAction);return;}
  if(b.dataset.terminal){modalAction('terminal',b.dataset.terminal);return;}
  if(b.dataset.modal){switch(b.dataset.modal){
    case 'lastBattle':$('#modal').close();break;case 'enter':entered=true;$('#modal').close();update();floorToast();break;case 'intro':showIntro();break;case 'mission':showMission();break;case 'close':close();break;case 'bag':showInventory();break;case 'journal':showJournal();break;case 'bestiary':bestiary();break;case 'help':showHelp();break;
    case 'carrying':showCarrying();break;case 'resetCarrying':modal('<h2>重置所有升級？</h2><p>清除全部攜行等級並退還已投入的協定點數。解鎖、任務與紀錄不受影響；超出新容量的備彈會留在腳下。</p><button class="modal-button" data-modal="resetCarryingConfirm">確認重置並退還</button><button class="modal-button secondary" data-modal="carrying">取消</button>');break;case 'resetCarryingConfirm':try{const n=resetCarrying(game);update();showCarrying(`已重置攜行升級，退還 ${n} 點協定點數。`);}catch(error){showCarrying(error.message);}break;
    case 'abandon':modal('<h2>放棄本局？</h2><p>結束目前任務，保留已賺的協定點數、永久升級與紀錄。這不算成功撤離。確認前會自動保存完整備份。</p><button class="modal-button" data-modal="abandonConfirm">確認放棄本局</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'abandonConfirm':try{if(abandonRun(game)){cancelAim();update();}}catch(error){backupError(error);}break;
    case 'resetProgress':modal('<h2>重置遊戲進度？</h2><p>清除目前任務、全部協定點數、六類攜行升級、解鎖與任務紀錄，從零開始。只影響目前正式／測試區。</p><p>會先保存完整備份，之後可在設定下載「還原前備份」。音效與瞄準偏好不變；再次放棄任務、還原或重置會覆寫這份備份，請先下載留存。</p><button class="modal-button secondary" data-modal="backupExport">先下載目前完整備份</button><button class="modal-button" data-modal="resetConfirm">確認清空遊戲進度</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'resetConfirm':try{adoptSnapshot(resetProgress(game));notify('遊戲進度已重置；原資料可從設定下載。');}catch(error){backupError(error);}break;
    case 'settings':settings();break;
    case 'movementBoundaries':renderer.movementBoundaries=!renderer.movementBoundaries;write('ash-movement-boundaries',renderer.movementBoundaries?'on':'off');settings();break;
    case 'sound':audio.enabled=!audio.enabled;write('ash-sound',audio.enabled?'on':'off');settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify('完整備份已匯出。');}catch(error){backupError(error);}break;
    case 'backupImport':$('#import-backup').click();break;
    case 'backupPrevious':{const raw=read('ash-backup-before-restore');if(raw)downloadJSON(raw,'ash-protocol-before-restore.json');break;}
    case 'backupConfirm':applyBackup();break;case 'backupCancel':pendingBackup=null;settings();break;
    case 'export':exportSave();break;case 'import':$('#import-save').click();break;
    case 'restart':case 'deploy':showDeployment();break;
    case 'deployNormal':deployDraft={mode:'normal',mission:null,seed:undefined};showDeployMission();break;
    case 'deployOperator':{const value=$('#new-seed')?.value,seed=value!==undefined&&value!==''?Number(value):undefined;
      if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>999999999)){const advanced=$('.seed-advanced');if(advanced)advanced.open=true;notify('種子需為 0–999999999 的整數。');return;}
      const mission=$('input[name="mission"]:checked')?.value;
      if(!validMissionId(mission)){notify('請選擇有效任務。');return;}
      deployDraft={mode:'normal',mission,seed};showDeployOperator();break;}
    case 'deployDaily':{const seed=dailySeed();deployDraft={mode:'daily',mission:dailyMission(seed),seed};showDeployOperator();break;}
    case 'deployQuick':if(runIsLive()){modal('<div class="eyebrow">QUICK GAME</div><h2>放棄目前任務？</h2><p>快速任務會立即隨機決定任務、種子與行動員並開始。已賺點數與永久進度保留。</p><button class="modal-button" data-modal="deployQuickStart">確認放棄並開始 →</button><button class="modal-button secondary" data-modal="deploy">← 返回</button>');}else startQuick();break;
    case 'deployQuickStart':startQuick();break;
    case 'new':{const character=$('input[name="character"]:checked')?.value;
      if(!validMissionId(deployDraft.mission)){notify('請先選擇任務。');showDeployment();return;}
      newGame(deployDraft.seed,character,deployDraft.mission);break;}
  }return;}
  switch(b.dataset.action){
    case 'mission':showMission();break;case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'settings':settings();break;case 'bag':showInventory();break;case 'terminal':showTerminal();break;
    case 'item':act('usePrepared',{category:'item'});break;case 'skill':skill();break;
    case 'toggleTargeting':toggleTargeting();break;case 'cycleTarget':cycleTarget();break;case 'grenade':grenade();break;case 'cancelAim':cancelAim();break;
    case 'zoomIn':renderer.zoom=Math.min(1.6,renderer.zoom+.15);renderer.resize();break;
    case 'zoomOut':renderer.zoom=Math.max(.65,renderer.zoom-.15);renderer.resize();break;
    case 'center':renderer.zoom=1;renderer.resize();renderer.camera={x:game.player.x,y:game.player.y};break;
    default:act(b.dataset.action);
  }
});
$('#orientation-guard').addEventListener('cancel',e=>e.preventDefault());
$('#modal').addEventListener('cancel',e=>{if(!entered||game.pendingPerks||game.status!=='playing')e.preventDefault();});
let pointerStart=null;
$('#battle').addEventListener('pointerdown',e=>{pointerStart=playback||orientationBlocked?null:{x:e.clientX,y:e.clientY};});
$('#battle').addEventListener('pointerup',e=>{
  if(playback||orientationBlocked||$('#modal').open||!pointerStart){pointerStart=null;return;}
  const dx=e.clientX-pointerStart.x,dy=e.clientY-pointerStart.y;pointerStart=null;
  // One swipe = one cardinal step. No hidden pathfinding or multi-turn tap movement.
  if(Math.hypot(dx,dy)>24){if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx),0);else move(0,Math.sign(dy));return;}
  const r=$('#battle').getBoundingClientRect(),pos=renderer.unproject(e.clientX-r.left,e.clientY-r.top);
  if(renderer.mode==='pet'){setPetAim(pos);return;}
  if(renderer.mode==='drone'){setDroneAim(pos);return;}
  if(renderer.mode==='grenade'){setAim(pos);return;}
  const ally=game.localAllies.find(a=>distance(a,pos)===0);if(ally){notify(`${allyName(ally)} · ${ally.status==='down'?'倒地，走到相鄰格以技能回收':ally.status==='destroyed'?`已毀，按僚機技能花 ${DRONE_BUILD_COST} 廢料生產新機`:`HP ${ally.hp}/${ally.maxHp}${ally.kind==='drone'?` · 彈藥 ${ally.ammo}/${allyWeapon(ally).mag}`:''}`}。`);return;}
  const edge=renderer.hitBarrier(e.clientX-r.left,e.clientY-r.top);
  if(edge){game.target=edge.id;if(!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const supply=game.props.find(o=>isContainer(o)&&!o.opened&&distance(o,pos)===0&&game.visible(o));
  if(supply){notify(`${containerName(supply)}：${game.canTouch(supply)?'按右下互動開啟（1 回合）':'靠近後以右下互動開啟'}。`);return;}
  if(distance(pos,game.exitPoint)===0&&game.canTouch(pos)){act('interact');return;}
  if(game.props.some(o=>o.type==='terminal'&&!o.used&&distance(o,pos)===0&&game.canTouch(o))){showTerminal();return;}
  if(distance(pos,game.player)===1)move(pos.x-game.player.x,pos.y-game.player.y);
  else notify('點相鄰格移動，或在戰場滑動一步。');
});
$('#battle').addEventListener('pointercancel',()=>{pointerStart=null;});
document.addEventListener('keydown',e=>{
  if(!playback&&!orientationBlocked&&e.target.matches?.('[data-inventory-tab]')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
    e.preventDefault();const ids=Object.keys(INVENTORY_TABS),i=ids.indexOf(inventoryTab),next=e.key==='Home'?0:e.key==='End'?ids.length-1:(i+(e.key==='ArrowRight'?1:-1)+ids.length)%ids.length;
    showInventory(ids[next]);$(`[data-inventory-tab="${inventoryTab}"]`).focus({preventScroll:true});return;
  }
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(playback){if(e.key.length===1||e.key.startsWith('Arrow')||e.key==='Tab')e.preventDefault();return;}
  if(orientationBlocked||$('#modal').open||e.target.matches('input,textarea,select'))return;
  const moves={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]},actions={' ':'fire',r:'reload',h:'item',e:'interact',f:'wait','.':'wait'},key=e.key.length===1?e.key.toLowerCase():e.key;
  if(moves[key]){e.preventDefault();move(...moves[key]);}
  else if(actions[key]){e.preventDefault();if(key==='e')interact();else if(key==='h')act('usePrepared',{category:'item'});else act(actions[key]);}
  else if(key==='q'){e.preventDefault();toggleTargeting();}
  else if(key==='Tab'){e.preventDefault();cycleTarget();}
  else if(key==='g'){e.preventDefault();grenade();}
  else if(key==='b'){e.preventDefault();showInventory();}
  else if(key==='Escape'){if(renderer.mode)cancelAim();else settings();}
});
$('#import-save').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>1000000)throw new Error('存檔超過大小限制。');const imported=Game.restore(await file.text());if(!imported)throw new Error('存檔格式不相容或任務已結束。');write('ash-save-before-import',game.serialize());game=imported;entered=true;resumable=true;game.setCarryLevel(profile().upgrades.carrying);playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();notify('存檔已匯入；原進度已在本機備份。'); }catch(error){modal('<h2>無法匯入存檔</h2><p>'+escapeHTML(error.message)+'</p><button class="modal-button" data-modal="close">返回戰場</button>');}e.target.value='';
});
document.addEventListener('selectstart',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(!target?.closest('input,textarea'))e.preventDefault();});
document.addEventListener('contextmenu',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(target?.closest('.battle-panel'))e.preventDefault();});
window.addEventListener('pagehide',()=>{if(entered)saveGame(game);});update();showIntro();
// The title modal is open by now, so revealing the shell cannot flash the battle UI.
document.body.classList.remove('booting');
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
