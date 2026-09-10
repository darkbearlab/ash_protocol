import {MISSIONS,validMissionId,missionDefinition,missionProgress} from './missions.js';
import {isContainer,containerName} from './containers.js';
import {ammoName,magazineLabel} from './weapons.js';
import {deploymentPortraits,portraitMarkup,validPortrait} from './portraits.js';
import {CHARACTERS,validCharacter,characterName} from './characters.js';
import {PREPARED_CATEGORIES,preparedOptions,preparedEntry} from './prepared.js';
import {isBarrier,barrierFace} from './barriers.js';
import {GRENADES,grenadeTotal} from './throwables.js';
import {TRAITS,traitLabels,startingTraits,initiative} from './traits.js';
import {AMMUNITION,AMMO_IDS,CARRY_COSTS,capacity,TERMINAL_AMMO} from './ammunition.js';
import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,WEAPONS,FLOORS,FLOOR_INFO,PERKS,PACK_LIMIT,ENEMY_TYPES,LORE,enemyName,distance} from './engine.js';
import {Renderer} from './render.js';
import {AudioFX} from './audio.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {targetDetails} from './target-card.js';
import {read,write,loadGame,saveGame,storage,profile,recordResult,TEST_MODE,purchaseCarrying,exportBackup,previewBackup,restoreBackup,abandonRun,resetProgress} from './storage.js';

const $=s=>document.querySelector(s),audio=new AudioFX();
const savedGame=loadGame();
let inventoryTab='weapon',deploymentFaces={};
let playback=null,entered=false,orientationBlocked=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons,profile().upgrades.carrying),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor,noticeTimer;
renderer.targetingEnabled=read('ash-targeting')!=='off';
renderer.targetUI={card:$('#target-card'),link:$('#target-link'),path:$('#target-link path'),dirty:true};
document.fonts?.ready.then(()=>{renderer.targetUI.dirty=true;});
audio.enabled=read('ash-sound')!=='off';
const notice=document.createElement('div');notice.className='battle-notice';notice.setAttribute('role','status');$('#field-messages').append(notice);
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2700);}
function update(view=renderer.game) {
  const p=view.player,w=view.weapon,reserve=p[view.reserveKey()]??0;
  const progress=missionProgress(view);$('#sector-title').textContent=`${pad(view.floor)} / ${missionDefinition(view).name}${view.floor===FLOORS.length?' '+progress.done+'/'+progress.total:''}`;
  $('#sector-title').title=`${FLOORS[view.floor-1]} · ${view.missionSummary}；點此查看任務`;$('#sector-title').setAttribute('aria-label',$('#sector-title').title);
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#level').textContent=`LV.${pad(p.level)}`;$('#level').title=`經驗 ${p.xp} / ${p.level+2}`;
  for(const category of Object.keys(PREPARED_CATEGORIES)){
    const entry=preparedEntry(p,category),button=$(`[data-action="${category}"]`),count=entry?.resource?p[entry.resource]:null;
    button.querySelector('.action-icon').textContent=entry?.icon||'◇';
    if(category!=='grenade')button.querySelector('strong').textContent=entry?`${entry.short}${count===null?'':` ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`;
    button.title=entry?`${entry.name}：${entry.text}`:`到背包預備${PREPARED_CATEGORIES[category]}`;
    button.setAttribute('aria-label',entry?`使用預備${PREPARED_CATEGORIES[category]}：${entry.name}${count===null?'':`，剩餘 ${count}`}`:`${PREPARED_CATEGORIES[category]}未預備`);
  }
  $('[data-action="reload"] strong').textContent=w.melee?'近戰 ∞':`${view.actionCost('reload')===0?'快填':'裝填'} ${p.ammo[p.weapon]}/${w.mag}`;
  $('[data-action="reload"]').title=w.melee?'動力拳無須裝填':`裝填：${view.actionCost('reload')} 回合`;
  $('#quick-weapon').textContent=w.melee?`${w.code} · ∞`:`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;$('#quick-weapon').title=w.melee?w.desc:`${ammoName(w)}：備彈 ${reserve}/${view.ammoCapacity(w.ammoType)}`;
  const threats=view.visibleEnemies.filter(e=>ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range);
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  $('#status-effects').textContent=[exposed?`暴露 ${exposed}`:threats.length?(threats.some(e=>view.accuracy(e,p).coverEfficiency===.5)?'半效掩護':'掩護'):view.cover.length?'牆 / 箱旁':'',p.moved?'移動':'',threats.some(e=>view.accuracy(e,p).sidePenalty)?`側身 ${threats.filter(e=>view.accuracy(e,p).sidePenalty).length}`:'',p.guard?'減傷 50%':'',p.plates?`護甲板 ${p.plates}`:'',p.focus?'瞄準 +15':'',p.evasive?'閃避 +15':'',p.poison?`中毒 ${p.poison}`:'',p.control.disabled?`失能 ${p.control.disabled} · 按等待`:'',p.control.immune?`失能免疫 ${p.control.immune}`:'',view.smoke.some(s=>s.cells.some(c=>c.x===p.x&&c.y===p.y))?'煙霧中':'',initiative(p)<0?'快速':initiative(p)>0?'緩速':''].filter(Boolean).join(' · ');
  $('#status-effects').style.color=exposed?'#f3a182':'#b6d5b0';$('#status-effects').title=exposed?`${exposed} 名射手對你有無掩護射線；應立即尋找牆角或箱體。`:'掩體有方向性，注意側翼。';
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?'關閉瞄準資訊':'開啟瞄準資訊');
  aimingButton.textContent=renderer.targetingEnabled?'瞄準 開':'瞄準 關';
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;$('#target-traits').textContent=details.traits;$('#target-order').textContent=details.order;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  for(const b of document.querySelectorAll('.control-deck button'))b.disabled=Boolean(playback)||view.status!=='playing'||(b.dataset.action==='reload'&&w.melee)||(Object.hasOwn(PREPARED_CATEGORIES,b.dataset.action)&&(!preparedEntry(p,b.dataset.action)||(preparedEntry(p,b.dataset.action).resource&&p[preparedEntry(p,b.dataset.action).resource]<=0)));
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
function move(dx,dy){if(renderer.mode==='grenade'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else act('move',[dx,dy]);}
function floorToast(){notify(`第 ${game.floor} 層 · ${FLOORS[game.floor-1]}：${game.floor===FLOORS.length?missionDefinition(game).text:FLOOR_INFO[game.floor-1].text}`);}
function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
function setAim(pos){if(distance(pos,game.player)<=5&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify('投擲落點需在視線內 5 格以內。');}
function interactions(view=renderer.game){return [...view.nearbyObjectives.map(t=>({label:'回收機密',action:`objective:${t.id}`})),...view.nearbyContainers.map(c=>({label:`開${view.containerLabel(c)}`,action:`case:${c.id}`})),...view.nearbyDoors.map(b=>({label:view.doorLabel(b),action:`door:${b.id}`})),...(view.groundWeapon?[{label:'拾取',action:'bag'}]:[]),...(view.nearbyTerminal?[{label:'終端',action:'terminal'}]:[]),...(view.canTouch(view.end)?[{label:view.exitBlocked?'電梯鎖定':view.floor===FLOORS.length?'撤離':'下樓',action:'descend'}]:[])];}
function updateAim(view=renderer.game){const aiming=renderer.mode==='grenade',b=$('#interact'),options=interactions(view);
  const entry=preparedEntry(view.player,'grenade');
  $('#grenade-label').textContent=aiming?'取消投擲':entry?`${entry.short} ${view.player[entry.resource]}`:'手榴彈未預備';
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=Boolean(playback)||(view.status==='playing'&&!aiming&&!options.length);
  b.querySelector('strong').textContent=view.status!=='playing'?'結果':aiming?'確認投擲':options.length>1?'互動':options[0]?.label||'互動';
  b.classList.toggle('aiming',aiming);
}
function interact(){if(game.status!=='playing'){showResult();return;}if(renderer.mode==='grenade'){act('usePrepared',{category:'grenade',target:renderer.aim});return;}
  const options=interactions();if(options.length>1){modal('<h2>附近互動</h2>'+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+'<button class="modal-button" data-modal="close">返回戰場</button>');return;}
  if(options[0]?.action.startsWith('objective:'))act('recoverObjective',options[0].action.slice(10));
  else if(options[0]?.action.startsWith('case:'))act('openContainer',options[0].action.slice(5));
  else if(options[0]?.action.startsWith('door:')){const b=game.nearbyDoors.find(b=>b.id===options[0].action.slice(5));if(b)act('door',{id:b.id,open:!b.open});}
  else if(options[0]?.action==='bag')showInventory('weapon');else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');
}
function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}const entry=preparedEntry(game.player,'grenade');if(!entry){notify('請先在背包預備手榴彈。');return;}if(game.player[entry.resource]<=0){notify(`${entry.name}已用盡。`);return;}renderer.mode='grenade';const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,game.player):locked;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify('附近沒有可見敵人。');return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
function modal(html,wide=false){cancelAim();$('#modal').classList.toggle('wide',wide);$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
function close(){if(!entered){showIntro();return;}if(game.pendingPerks){showPerks();return;}if(game.status!=='playing'){$('#modal').close();return;}$('#modal').close();$('#battle').focus({preventScroll:true});}
function modalAction(type,arg){close();act(type,arg);}

function showIntro(){modal(`<div class="eyebrow">ASH PROTOCOL / 灰燼協定</div><h2>深入寂靜。<br>活著回來。</h2><p>木星邊境的厄瑞玻斯設施停止回傳訊號。你是最後一名接近它的行動員。</p><p>深入六層設施，執行核心撤離、指定殲滅或機密回收。只有你採取行動，敵人才會行動。</p><p>協定點數 ${profile().protocol.balance} · 探索資料、擊敗頭目與完成樓層可累積，死亡仍保留。現在可用於永久攜行升級。</p><div class="intro-rules"><span>↑ 四方向探索</span><span>⌖ 掩體與命中率</span><span>◷ 等待觀察</span><span>▣ 搜刮與換裝</span></div><div class="operator-identity">${resumable||entered?portraitMarkup(game.player.portrait,game.status):''}<p>${resumable||entered?`${characterName(game.player.character)} · 任務 ${game.seed} · 第 ${game.floor} 層 · ${game.turn} 回合<br>${game.missionSummary}`:'新任務可選 Soldier 士兵、Recon 偵察兵或 Bulwark 重裝兵，三者免費。'}</p></div><button class="modal-button" data-modal="${game.status==='playing'&&(resumable||entered)?'enter':'deploy'}">${game.status!=='playing'?'開始新任務':resumable||entered?'繼續任務':'開始行動'} →</button><button class="modal-button secondary" data-modal="carrying">永久攜行升級</button><button class="modal-button secondary" data-modal="help">閱讀作戰指南</button><button class="modal-button secondary" data-modal="settings">備份與設定</button>`);}
function showDeployment(){
  const live=game.status==='playing'&&(entered||resumable);
  deploymentFaces=deploymentPortraits(Object.keys(CHARACTERS));
  modal(`<div class="eyebrow">DEPLOYMENT</div><h2>選擇行動員</h2><p>${live?'確認後會放棄目前任務，保留已賺點數與永久進度。':'三名基礎角色皆免費。角色只在新任務開始時選擇，頭像隨機配發並隨本局保存。'}</p>
    <fieldset class="character-choices"><legend>角色</legend>${Object.entries(CHARACTERS).map(([id,c])=>`<label class="character-choice"><input type="radio" name="character" value="${id}" ${id===game.player.character?'checked':''}><span class="character-copy"><span class="operator-identity">${portraitMarkup(deploymentFaces[id])}<strong>${c.name} · ${c.label}</strong></span><small>${c.text}</small><small>生命 ${c.hp||100} · 裝甲 ${c.armor||0} · ${c.weapons.map(slot=>WEAPONS[slot].name).join('／')}</small>${c.traits.map(t=>`<small><b>${TRAITS[t].name}</b>：${TRAITS[t].text}</small>`).join('')}</span></label>`).join('')}</fieldset>
    <fieldset class="character-choices mission-choices"><legend>任務 · 全部六層</legend>${Object.entries(MISSIONS).map(([id,m])=>`<label class="character-choice"><input type="radio" name="mission" value="${id}" ${id===game.mission.id?'checked':''}><span><strong>${m.name}</strong><small>${m.text}</small></span></label>`).join('')}</fieldset><p>所有任務第 3 層仍需擊敗封鎖官。新任務的核心守衛依然在場，可以迴避；指定殲滅目標以青色菱形標記。回收耗 1 回合，不占背包容量。</p>
    <label class="seed-field">地圖種子（留空隨機）<input id="new-seed" type="number" min="0" max="999999999" placeholder="例：2026" inputmode="numeric"></label>
    <button class="modal-button" data-modal="new">${live?'確認放棄並部署':'開始新任務'} →</button><button class="modal-button secondary" data-modal="${live?'settings':'intro'}">取消</button>`,true);
}
function missionDetails(){
  const def=missionDefinition(game);
  const targets=game.floor===FLOORS.length?game.mission.targets.map((t,i)=>{
    const e=game.enemies.find(e=>e.id===t.id),done=def.kind==='recover'?t.done:e?.hp<=0;
    const known=def.kind==='recover'?game.seen[t.y]?.[t.x]:e&&game.visible(e);
    return `<p>${done?'✓':'◇'} ${i+1}. ${done?'已完成':known?def.kind==='recover'?'已發現機密資料匣':enemyName(e):'尚未定位'}${!done&&known?'（查看樓層地圖）':''}</p>`;
  }).join(''):'';
  return `<p><strong>${game.missionSummary}</strong><br>${def.text}</p>${targets}`;
}
function showMission(){modal(`<div class="eyebrow">MISSION / SECTOR ${pad(game.floor)}</div><h2>${FLOORS[game.floor-1]}</h2>${missionDetails()}<p>回收：靠近青色 D 資料匣後，按右下互動，耗 1 回合。爆炸不會毀掉任務資料；收下後不占容量。指定殲滅：青色菱形敵人，任何原因死亡都計入；普通敵人不代替指定目標。完成目標後仍需前往綠色電梯互動撤離。</p><button class="modal-button" data-modal="close">返回戰場</button>`);}
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
function showInventory(tab=inventoryTab,message='') {
  inventoryTab=Object.hasOwn(INVENTORY_TABS,tab)?tab:'weapon';
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1),category=inventoryTab;
  let content='';
  if(category==='weapon')content=`    <div class="pack-ammo">${AMMO_IDS.map(id=>`<span>${AMMUNITION[id].name}<b>${p[AMMUNITION[id].key]} / ${game.ammoCapacity(id)}</b></span>`).join('')}</div><p class="ammo-summary">備彈上限與彈匣分開計算。拾取只補到上限，多出的留在地上。<br>護甲板吸收直接傷害的至多一半，消耗後可拾取修復；不擋毒液或高熱。<br>換裝所需回合標於各武器按鈕；交換、拾取、拆解、改裝與補給各消耗 1 回合。比較不耗時；走上武器會在有空格時收下，相同槍種不再自動拆解。</p>
    <div class="pack-weapons">${p.owned.map(index=>{const w=game.weaponAt(index),d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index],cost=25+level*15;return `<article class="pack-weapon ${active?'equipped':''}"><img src="./assets/${w.file}.svg" alt="${w.name}"><div><small>${active?'已裝備':'備用'} / ${w.code}</small><h3>${w.name}${level?` +${level}`:''}</h3><p>${w.affixText}</p><span>傷害 ${d.min}–${d.max}${w.burst?` ×${w.burst}`:''} · 射程 ${w.range} · ${ammoName(w)} · ${magazineLabel(w,p.ammo[index])}${w.locked?' · 固定裝備':''}</span><div class="pack-actions"><button data-equip="${index}" ${active?'disabled':''}>裝備 · ${game.actionCost('weapon',index)} 回合</button><button data-salvage="${index}" ${p.owned.length<=1||w.locked?'disabled':''}>${w.locked?'固定裝備':`拆解 +${20+level*10}`}</button>${active?`<button data-bag-action="upgrade" ${p.scrap<cost||level>=3?'disabled':''}>${level>=3?'改裝已滿':`改裝 ${cost} 廢料`}</button>`:''}</div></div></article>`;}).join('')}</div>
    ${ground.map(item=>{const w=game.weaponAt(item.slot);return `<div class="ground-loot"><strong>附近：${w.name}${p.upgrades[item.slot]?` +${p.upgrades[item.slot]}`:''}</strong><small>${w.affixText} · 彈匣 ${p.ammo[item.slot]}/${w.mag}</small><button data-compare="${item.slot}">比較／拾取／交換</button></div>`;}).join('')}
`;
  else {
    const selected=preparedEntry(p,category),options=preparedOptions(p,category);
    content=`${category==='grenade'?`<p>投擲物共用容量：<strong>${grenadeTotal(p)} / ${game.ammoCapacity('grenade')}</strong>。全部種類合計，永久手榴彈攜行升級可提高此上限。使用消耗 1 回合。</p>`:''}<p>目前預備：<strong>${selected?.name||'無'}</strong>。預備／取消預備不耗回合；回到戰場後按對應按鈕使用。</p>
      <div class="prepared-list">${options.map(([id,entry])=>`<article class="prepared-entry ${p.prepared[category]===id?'equipped':''}"><h3>${entry.icon} ${entry.name}</h3><p>${entry.text}${id==='medkit'?` 目前回復 ${45+p.healBonus} 生命。`:''}</p><span>${entry.resource?`持有 ${p[entry.resource]}`:'已學會'}</span><button class="modal-button secondary" data-prepare-category="${category}" data-prepare-id="${id}" ${p.prepared[category]===id?'disabled':''}>${p.prepared[category]===id?'已預備':'預備 · 不耗回合'}</button></article>`).join('')}</div>
      ${!options.length?'<p class="pack-empty">尚未學會主動技能。</p>':''}
      ${selected?`<button class="modal-button secondary" data-prepare-category="${category}" data-prepare-id="">取消預備 · 不耗回合</button>`:''}
      ${category==='skill'?`<h3>目前被動規則</h3><p>${traitLabels(p).join(' · ')||'無'}。<br>${(p.traits||[]).map(t=>`${TRAITS[t.id].name}${t.turns?`（剩 ${t.turns} 回合）`:''}：${TRAITS[t.id].text}`).join('<br>')}</p><p>被動自動生效，不占主動技能預備欄。</p>`:''}`;
  }
  modal(`<div class="eyebrow">FIELD PACK / ${p.owned.length} OF ${PACK_LIMIT}</div><div class="operator-identity">${portraitMarkup(p.portrait)}<div><h2>作戰背包</h2><p>${characterName(p.character)} · 裝甲 ${p.armor}<br>${game.missionSummary}</p></div></div>
    <div class="inventory-tabs" role="tablist" aria-label="背包分類">${Object.entries(INVENTORY_TABS).map(([id,label])=>`<button id="pack-tab-${id}" role="tab" aria-controls="pack-panel" aria-selected="${id===category}" tabindex="${id===category?0:-1}" data-inventory-tab="${id}">${label}</button>`).join('')}</div>
    ${message?`<p role="status">${escapeHTML(message)}</p>`:''}
    <section id="pack-panel" role="tabpanel" aria-labelledby="pack-tab-${category}" tabindex="0">${content}</section>
    <div class="pack-resources"><span>◇ 廢料 <b>${p.scrap}</b></span><span>▣ 護甲板 <b>${p.plates}/30</b></span></div>
    <button class="modal-button secondary" data-modal="journal">資料與紀錄</button><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);
}
function showWeaponComparison(take,against=game.player.weapon){
  const p=game.player,item=game.nearbyWeapon(take);if(!item||!p.owned.includes(against)){showInventory();return;}
  const old=game.weaponAt(against),next=game.weaponAt(take),a=game.weaponDamage(against),b=game.weaponDamage(take);
  const shot=w=>w.melee?w.hitChance:Math.max(10,Math.min(99,97+w.accuracyBonus)),pierce=w=>`${Math.round(w.pierce*100)}%`;
  const rows=[['單次傷害',`${a.min}–${a.max}`,`${b.min}–${b.max}`],['每次攻擊發數',old.burst||1,next.burst||1],['靜止裸露命中',`${shot(old)}%`,`${shot(next)}%`],['移動目標命中',`${shot({...old,accuracyBonus:old.accuracyBonus-22+old.tracking})}%`,`${shot({...next,accuracyBonus:next.accuracyBonus-22+next.tracking})}%`],['射程',old.range,next.range],['彈匣',magazineLabel(old,p.ammo[against]),magazineLabel(next,p.ammo[take])],['彈種',ammoName(old),ammoName(next)],['穿透',pierce(old),pierce(next)],['改裝等級',`+${p.upgrades[against]}`,`+${p.upgrades[take]}`]];
  modal(`<div class="eyebrow">WEAPON COMPARISON</div><h2>${next.name}</h2><p>${next.affixText}<br>${next.desc}</p><p>比較對象：${old.name} ${against===p.weapon?'（已裝備）':'（備用）'}<br>${old.affixText}</p><div class="pack-actions">${p.owned.map(slot=>`<button data-compare="${take}" data-against="${slot}" ${slot===against?'disabled':''}>${game.weaponAt(slot).name} +${p.upgrades[slot]} · ${magazineLabel(game.weaponAt(slot),p.ammo[slot])}</button>`).join('')}</div><table class="weapon-comparison"><thead><tr><th>能力</th><th>持有</th><th>地面</th></tr></thead><tbody>${rows.map(([label,left,right])=>`<tr><th>${label}</th><td>${left}</td><td>${right}</td></tr>`).join('')}</tbody></table><p>命中欄未計入等待／掩體／閃避；傷害含本局模組與改裝，未扣目標護甲。穿透減少護甲與掩體減傷，不提高命中率。</p>${p.owned.length<PACK_LIMIT?`<button class="modal-button" data-take="${take}">收進空格 · 1 回合</button>`:''}${old.locked?'<p>裝甲內建武器不能交換或拆解，切換進出不耗回合。</p>':`<p>交換會將${old.name}連同剩餘彈匣、詞條與改裝放在腳下。${against===p.weapon?'新武器立即裝備。':'目前裝備不變。'}</p><button class="modal-button" data-replace="${take}" data-leave="${against}">交換此武器 · 1 回合</button>`}<button class="modal-button secondary" data-modal="bag">返回背包</button>`,true);
}
function showTerminal(){const p=game.player;modal(`<div class="eyebrow">SUPPLY TERMINAL / ONE USE</div><h2>選擇需要的補給。</h2><p>此終端只能交易一次，耗費 1 回合。持有廢料：${p.scrap}。容量不足時，多出的補給留在腳下。</p><button class="perk" data-terminal="heal" ${p.scrap<15||p.hp===p.maxHp&&!p.poison?'disabled':''}><strong>醫療修復 · 15 廢料</strong><span>回復 60 生命並清除中毒。</span></button>${AMMO_IDS.map(id=>{const offer=TERMINAL_AMMO[id],info=AMMUNITION[id];return `<button class="perk" data-terminal="${id}" ${p.scrap<offer.cost||p[info.key]>=game.ammoCapacity(id)?'disabled':''}><strong>${info.name} +${offer.amount} · ${offer.cost} 廢料</strong><span>目前 ${p[info.key]} / ${game.ammoCapacity(id)}</span></button>`;}).join('')}${Object.entries(GRENADES).map(([id,entry])=>`<button class="perk" data-terminal="${entry.item}" ${p.scrap<entry.cost||grenadeTotal(p)>=game.ammoCapacity('grenade')?'disabled':''}><strong>${entry.name} +${entry.amount} · ${entry.cost} 廢料</strong><span>持有 ${p[entry.resource]} · 共用容量 ${grenadeTotal(p)} / ${game.ammoCapacity('grenade')}</span></button>`).join('')}<button class="modal-button secondary" data-modal="close">返回戰場</button>`);}
function carryingSummary(levels){return Object.entries(AMMUNITION).map(([id,info])=>`${info.short} ${levels[id]}`).join('／');}
function showCarrying(message=''){
  const p=profile();modal(`<div class="eyebrow">PERMANENT EQUIPMENT</div><h2>各彈種攜行升級</h2>${message?`<p role="status">${escapeHTML(message)}</p>`:''}<p>協定點數 <strong>${p.protocol.balance}</strong>。每種獨立購買三階，費用依序 20／40／70 點，只提高選定彈種的容量；手榴彈為四種投擲物共用上限。永久保留，不耗回合、不補充彈藥。</p>${Object.entries(AMMUNITION).map(([id,info])=>{const level=p.upgrades.carrying[id],cost=CARRY_COSTS[level];return `<div class="ground-loot carry-upgrade"><strong>${info.name} · ${level} / ${CARRY_COSTS.length} 階</strong><small>容量 ${capacity(id,level)}${cost!==undefined?` → ${capacity(id,level+1)}`:''}</small><button data-buy-carry="${id}" data-carry-level="${level}" ${cost===undefined||p.protocol.balance<cost||!storage.available||storage.recoveryPending?'disabled':''}>${cost===undefined?'已滿階':`升級 · ${cost} 點`}</button></div>`;}).join('')}<p>舊版整組升級已退還已花點數，各彈種從 0 階重新分配；任務保留，超額備彈留在腳下。彈匣不受影響。</p><button class="modal-button secondary" data-modal="close">返回</button>`);
}

function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>適應，然後生存。</h2><p>強化生效至本次任務結束。${game.pendingPerks>1?`還有 ${game.pendingPerks} 次選擇。`:''}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>＋ ${p.name}</strong><span>${p.text}</span></button>`).join('')}`);}
function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>留下你的足跡。</h2><div class="journal-tabs"><button data-modal="journal">任務紀錄</button><button data-modal="bestiary">敵人圖鑑</button><button data-modal="help">操作指南</button></div><p>${game.missionSummary}</p><div class="result-stats"><div><b>${records.runs}</b>完成任務</div><div><b>${records.wins}</b>成功撤離</div><div><b>${records.bestFloor}/6</b>最深紀錄</div></div><h3>協定點數 ${records.protocol.balance}</h3><p>本次累積 ${game.protocol.earned} · 死亡仍保留。可用於永久攜行升級；Soldier／Recon／Bulwark 基礎角色免費，新武器掉落池與更多角色解鎖尚未開放。</p><h3>本次收集 ${p.lore.length} / 6</h3>${p.lore.length?p.lore.map(f=>`<p class="lore-entry"><strong>${pad(f)} / ${FLOORS[f-1]}</strong><br>${LORE[f-1]}</p>`).join(''):'<p>探索各層紫色資料片段，拼湊設施的秘密。</p>'}<h3>最近任務</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>${MISSIONS[r.mission]?.name||MISSIONS.extraction.name} · ${characterName(r.character)} · RUN ${r.seed} · ${r.outcome==='abandoned'?'放棄':r.won?'撤離':'陣亡'} · ${r.floor} 層 · ${r.kills} 擊殺 · ${r.turn} 回合</p>`).join(''):'<p>第一次任務紀錄尚未完成。</p>'}<button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function bestiary(){modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>了解你的敵人。</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${id==='boss'?'Ω':id==='drone'?'◇':'!'}</span><div><h3>${e.name}</h3><small>基礎生命 ${e.hp} · 射程 ${e.range} · 護甲 ${e.armor}</small><p>${e.role}</p><p>${traitLabels({traits:startingTraits(id,game.floor)}).join(' · ')||'無被動規則'}${id==='crawler'?'（第 4 層起：快速）':''}</p></div></article>`).join('')}</div><h3>被動規則</h3>${Object.values(TRAITS).map(t=>`<p><strong>${t.name}</strong>：${t.text}</p>`).join('')}<p>相反規則互相抵銷，同名多個來源不疊加。快速 → 普通 → 緩速，各階玩家優先，每人每回合行動一次。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD 3.23.0</div><h2>每一步，都要算數。</h2><p>部署時選擇任務，全部穿越六層設施。第 3 層擊敗封鎖官；第 6 層依簡報完成核心殲滅、指定殲滅或機密回收，再從綠色電梯撤離。點上方任務標題查看進度；地圖只標出已探索資料匣與當前可見指定敵人。</p><div class="help-grid"><b>四方向</b><span>↑ ↓ ← → 就是畫面上的上下左右。方向鈕、鍵盤 WASD / 方向鍵或點相鄰格移動。</span><b>射擊</b><span>點敵人、掩體或油桶鎖定，再按開火 / Space。目標鈕 / Tab 輪換敵人。瞄準鈕 / Q 收起或顯示浮卡、鎖定框及目標取景，關閉時仍可開火，視野如同沒有鎖定目標；點擊敵人會重新開啟瞄準。有敵人時會閃爍提醒。</span><b>門與隔板</b><span>障礙物在兩格之間，不占地板。朝關門移動：花 1 回合開門，人留原地；再移動才通過。相鄰時右下互動鍵可開／關，皆花 1 回合。點門板或隔板邊界可鎖定破壞：門耐久 60、隔板 90。關閉時阻擋通行、視線與爆炸，並提供方向性掩體；打開或摧毀後讓出通道。人型／一般機械會開門，獸類與重型近戰敵人破門。敵人記得最後看見你的位置，關門不會讓它忘記你。</span><b>掩體</b><span>掩體朝向與來火偏角小於 45° 為完整，45° 起半效，約 63.4°（側向是正向兩倍）起無效。半效命中懲罰與減傷減半，多個掩體取最強、不疊加。牆角仍可探身，但平行來火不提供掩護；爆炸傷害不吃掩體減傷。</span><b>行動順序</b><span>快速 → 普通 → 緩速，同速玩家先行動。選定有效行動後不能重選；射擊追蹤原目標，目標先移出視線／射程仍向最後確認位置開火落空，消耗彈藥與回合。等待防護從自己行動後生效，維持到下次自己行動前。移動閃避維持到自己的下次行動；狙擊手的蓄勢鎖定仍射向原落點。回合末才結算轟炸與地形。</span><b>角色被動</b><span>士兵：自己相對目標有掩體時命中 +12；連續回合射擊同一敵人，後續每次 +8、最高 +24。未命中仍累積，耗回合的其他動作中斷；同輪連發只算一次。偵察兵：相對攻擊者主要橫向移動時，被射擊命中額外 −20，暴露時移動與側身合計至少 −42；手槍彈種武器免費裝填，仍扣備彈。免費動作不消耗等待或中斷連射。</span><b>重裝兵</b><span>大型、笨拙、緩速：普通敵人先行動，每回合仍移動一格。生命 200、裝甲 6、直接傷害再減 25%（不擋環境與中毒）。輕機槍三連發使用步槍彈；動力拳相鄰一格、命中 99%、無限使用，無視掩體。動力拳不能拆解或交換，可改裝；切換進出不耗回合，實際攻擊才耗回合。</span><b>命中率</b><span>暴露且靜止 97%；移動 −22%。完整箱體 −35、牆／隔板 −42 個百分點；半效為 −18／−21。完整減傷 45%、半效 22.5%，敵我規則相同。目標旁的半透明卡片顯示名稱、HP、命中率、距離與掩體；卡片不攔截觸控。</span><b>手榴彈</b><span>先在背包的手榴彈分頁預備，再按 G 或投擲物按鈕，點地板選落點，再按右下「確認投擲」；原手榴彈按鈕可取消。四種投擲物共用容量，射程 5、半徑 2。破片會自傷與連鎖引爆；EMP 對機械、震撼彈對生物，跳過 2 次自身行動（頭目 1 次），恢復後免疫 2 次行動；震撼彈會影響自己，失能時按中央等待恢復。煙霧持續 3 輪（含投擲當輪），阻擋敵我視線、煙內只見相鄰格，不擋爆炸與已鎖定落點的狙擊。</span><b>背包</b><span>B 開啟背包，分為武器／手榴彈／道具／技能。投擲物、道具與技能各有獨立預備欄，預備不耗回合；使用才結算。被動自動生效。可帶 3 把武器。在背包直接選擇武器換裝，所需回合顯示於按鈕。Q 開關瞄準資訊（不耗回合）、R 裝填、H 使用預備道具、F / 句點 / 中央鈕等待：自己行動後至下次行動前，直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15（最高 99%）。加成不疊加；任何有效行動後失效。</span><b>補給</b><span>低矮補給箱可走過、不提供掩體且不會被破壞。靠近後用右下互動開箱，花 1 回合；內容固定，落地後走上去拾取。箱內物資不會直接進背包，空箱留下。武器、資料片與敵人掉落仍在地上。走上道具即可拾取；護甲板滿額時留在原地。彈藥庫有五類備彈，醫療室與裝甲庫提供專用補給，探索地圖可查看已發現的補給。五類備彈與手榴彈各有上限，多出的留在地上；可用協定點數永久提高容量。靠近終端以廢料選購指定彈種。武器可帶一種詞條，背包可比較並交換；同類武器分別保留彈匣與改裝，不會自動拆解。拆解回收備彈／廢料，改裝增傷至 +3。</span><b>生活區與補給站</b><span>新樓層有 1–2 處衛浴間、門禁櫃檯或值勤哨站；家具可破壞，和箱體一樣提供掩體。衛浴間以門與隔板圍合，標記 WC／ACCESS／POST。地板標線沒有額外互動或保證獎勵。每層補給站縮為兩座：主路一座、探索支路一座；各只能購買一次，價格不變，已發現站可在地圖查看。</span><b>危險</b><span>! 代表敵人蓄勢。紅色轟炸格兩回合後爆炸；綠色毒液與橘色高熱格會傷害站在上面的單位。</span><b>撤離</b><span>到綠色電梯鄰格，按電梯按鈕或 E。本層頭目或最終任務要求未完成時電梯鎖定。</span><b>存檔</b><span>每步自動儲存在目前瀏覽器。設定可匯出 / 匯入存檔，避免換裝置失去進度。</span></div><button class="modal-button" data-modal="close">收到，返回戰場 →</button>`,true);}
function settings(){modal(`<div class="eyebrow">SYSTEM / BUILD 3.23.0</div><h2>作戰設定</h2><p>${characterName(game.player.character)} · 任務 ${game.seed} · 第 ${game.floor} 層 · ${game.turn} 回合<br>${storage.available?'進度已自動儲存。':'本機儲存不可用，請匯出存檔保留進度。'}</p><div class="modal-row"><button class="modal-button secondary" data-modal="sound">音效：${audio.enabled?'開啟':'關閉'}</button><button class="modal-button secondary" data-modal="help">作戰指南</button></div><div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">完整備份</button><button class="modal-button secondary" data-modal="backupImport">還原備份</button></div>${read('ash-backup-before-restore')?'<button class="modal-button secondary" data-modal="backupPrevious">下載還原前備份</button>':''}<p>完整備份包含點數、攜行等級、解鎖、任務歷史與目前任務。下方僅匯出／匯入單局任務。</p><div class="modal-row"><button class="modal-button secondary" data-modal="export">匯出任務</button><button class="modal-button secondary" data-modal="import">匯入任務</button></div><button class="modal-button secondary" data-modal="carrying">永久攜行升級</button><button class="modal-button secondary" data-modal="journal">任務紀錄與敵人圖鑑</button><button class="modal-button secondary" data-modal="intro">任務簡介</button><button class="modal-button secondary" data-modal="abandon" ${game.status!=='playing'?'disabled':''}>放棄本局（保留永久進度）</button><button class="modal-button secondary" data-modal="restart">重新部署新任務</button><button class="modal-button secondary" data-modal="resetProgress">重置遊戲進度</button><button class="modal-button" data-modal="close">繼續任務 →</button>`);}
function showResult(){const won=game.status==='won',abandoned=game.status==='abandoned',p=game.player;modal(`<div class="eyebrow">${abandoned?'MISSION ABANDONED':won?'SIGNAL RESTORED':'SIGNAL LOST'} / RUN ${game.seed}</div><h2>${abandoned?'任務已放棄。':won?'灰燼之中，仍有回音。':'這次的訊號，到此為止。'}</h2><p>${abandoned?'已賺取的協定點數與永久升級保留，這次任務已結束。':won?'任務目標已完成。你搭上最後一班撤離電梯。':'你留下的紀錄將協助下一位行動員。掩體、補給與適時撤退，都能改變下一次任務。'}</p><p>${game.missionSummary}</p><div class="result-stats"><div><b>${pad(game.floor)}</b>抵達樓層</div><div><b>${p.kills}</b>消滅敵人</div><div><b>${game.turn}</b>行動回合</div></div><p>本次協定點數 +${game.protocol.earned} · 累計持有 ${profile().protocol.balance}<br>死亡仍保留，可購買永久攜行升級。</p><div class="operator-identity result-identity">${portraitMarkup(p.portrait,game.status)}<p>${characterName(p.character)}<br>總傷害 ${p.stats.damage} · 投擲 ${p.stats.grenades} · 資料 ${p.lore.length}/6</p></div><button class="modal-button secondary" data-modal="lastBattle">查看最後戰場</button><button class="modal-button secondary" data-modal="carrying">永久攜行升級</button><button class="modal-button" data-modal="deploy">重新部署 →</button>`);}
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
  if(b.dataset.bagAction){modalAction(b.dataset.bagAction);return;}
  if(b.dataset.terminal){modalAction('terminal',b.dataset.terminal);return;}
  if(b.dataset.modal){switch(b.dataset.modal){
    case 'lastBattle':$('#modal').close();break;case 'enter':entered=true;$('#modal').close();update();floorToast();break;case 'intro':showIntro();break;case 'close':close();break;case 'bag':showInventory();break;case 'journal':showJournal();break;case 'bestiary':bestiary();break;case 'help':showHelp();break;
    case 'carrying':showCarrying();break;
    case 'abandon':modal('<h2>放棄本局？</h2><p>結束目前任務，保留已賺的協定點數、永久升級與紀錄。這不算成功撤離。確認前會自動保存完整備份。</p><button class="modal-button" data-modal="abandonConfirm">確認放棄本局</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'abandonConfirm':try{if(abandonRun(game)){cancelAim();update();}}catch(error){backupError(error);}break;
    case 'resetProgress':modal('<h2>重置遊戲進度？</h2><p>清除目前任務、全部協定點數、六類攜行升級、解鎖與任務紀錄，從零開始。只影響目前正式／測試區。</p><p>會先保存完整備份，之後可在設定下載「還原前備份」。音效與瞄準偏好不變；再次放棄任務、還原或重置會覆寫這份備份，請先下載留存。</p><button class="modal-button secondary" data-modal="backupExport">先下載目前完整備份</button><button class="modal-button" data-modal="resetConfirm">確認清空遊戲進度</button><button class="modal-button secondary" data-modal="settings">取消</button>');break;
    case 'resetConfirm':try{adoptSnapshot(resetProgress(game));notify('遊戲進度已重置；原資料可從設定下載。');}catch(error){backupError(error);}break;
    case 'settings':settings();break;
    case 'sound':audio.enabled=!audio.enabled;write('ash-sound',audio.enabled?'on':'off');settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify('完整備份已匯出。');}catch(error){backupError(error);}break;
    case 'backupImport':$('#import-backup').click();break;
    case 'backupPrevious':{const raw=read('ash-backup-before-restore');if(raw)downloadJSON(raw,'ash-protocol-before-restore.json');break;}
    case 'backupConfirm':applyBackup();break;case 'backupCancel':pendingBackup=null;settings();break;
    case 'export':exportSave();break;case 'import':$('#import-save').click();break;
    case 'restart':case 'deploy':showDeployment();break;
    case 'new':{const value=$('#new-seed')?.value,seed=value!==undefined&&value!==''?Number(value):undefined;if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>999999999)){notify('種子需為 0–999999999 的整數。');return;}newGame(seed,$('input[name="character"]:checked')?.value,$('input[name="mission"]:checked')?.value);break;}
  }return;}
  switch(b.dataset.action){
    case 'mission':showMission();break;case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'settings':settings();break;case 'bag':showInventory();break;case 'terminal':showTerminal();break;
    case 'item':act('usePrepared',{category:'item'});break;case 'skill':act('usePrepared',{category:'skill'});break;
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
  if(renderer.mode==='grenade'){setAim(pos);return;}
  const edge=renderer.hitBarrier(e.clientX-r.left,e.clientY-r.top);
  if(edge){game.target=edge.id;if(!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  const supply=game.props.find(o=>isContainer(o)&&!o.opened&&distance(o,pos)===0&&game.visible(o));
  if(supply){notify(`${containerName(supply)}：${game.canTouch(supply)?'按右下互動開啟（1 回合）':'靠近後以右下互動開啟'}。`);return;}
  if(distance(pos,game.end)===0&&game.canTouch(pos)){act('interact');return;}
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
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
