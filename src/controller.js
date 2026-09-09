import {captureAction,planPresentation,Playback} from './presentation.js';
import {Game,WEAPONS,FLOORS,FLOOR_INFO,PERKS,PACK_LIMIT,ENEMY_TYPES,LORE,enemyName,distance} from './engine.js';
import {Renderer} from './render.js';
import {AudioFX} from './audio.js';
import {landscapeTouch} from './layout.js';
import {BACKUP_LIMIT} from './backup.js';
import {targetDetails} from './target-card.js';
import {read,write,loadGame,saveGame,storage,profile,recordResult,TEST_MODE,exportBackup,previewBackup,restoreBackup} from './storage.js';

const $=s=>document.querySelector(s),audio=new AudioFX();
const savedGame=loadGame();
let playback=null,entered=false,orientationBlocked=false,pendingBackup=null,resumable=Boolean(savedGame);
let game=savedGame||new Game(undefined,profile().unlocks.weapons),renderer=new Renderer($('#battle'),game),lockUntil=0,lastStatus='playing',previousFloor=game.floor,noticeTimer;
renderer.targetingEnabled=read('ash-targeting')!=='off';
renderer.targetUI={card:$('#target-card'),link:$('#target-link'),path:$('#target-link path'),dirty:true};
document.fonts?.ready.then(()=>{renderer.targetUI.dirty=true;});
audio.enabled=read('ash-sound')!=='off';
const notice=document.createElement('div');notice.className='battle-notice';notice.setAttribute('role','status');$('#field-messages').append(notice);
const pad=n=>String(n).padStart(2,'0');
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text){notice.textContent=text;notice.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('show'),2700);}
function update(view=renderer.game) {
  const p=view.player,w=view.weapon,reserve=p[view.reserveKey()];
  $('#sector-title').textContent=`${pad(view.floor)} / ${FLOORS[view.floor-1]}`;
  $('#turn').textContent=String(view.turn).padStart(3,'0');
  $('#mobile-hp-bar').style.width=`${Math.max(0,p.hp)/p.maxHp*100}%`;$('#mobile-hp').textContent=`${Math.max(0,p.hp)} / ${p.maxHp}`;
  $('#level').textContent=`LV.${pad(p.level)}`;$('#level').title=`經驗 ${p.xp} / ${p.level+2}`;
  $('#med-count').textContent=p.meds;
  $('[data-action="reload"] strong').textContent=`裝填 ${p.ammo[p.weapon]}/${w.mag}`;
  $('#quick-weapon').textContent=`${w.code} · ${p.ammo[p.weapon]} / ${reserve}`;
  const threats=view.visibleEnemies.filter(e=>ENEMY_TYPES[e.type].range>1&&distance(e,p)<=ENEMY_TYPES[e.type].range);
  const exposed=threats.filter(e=>!view.protectingCover(p,e)).length;
  $('#status-effects').textContent=[exposed?`暴露 ${exposed}`:threats.length?'掩護':view.cover.length?'牆 / 箱旁':'',p.moved?'移動':'',p.guard?'減傷 50%':'',p.plates?`護甲板 ${p.plates}`:'',p.focus?'瞄準 +15':'',p.evasive?'閃避 +15':'',p.poison?`中毒 ${p.poison}`:''].filter(Boolean).join(' · ');
  $('#status-effects').style.color=exposed?'#f3a182':'#b6d5b0';$('#status-effects').title=exposed?`${exposed} 名射手對你有無掩護射線；應立即尋找牆角或箱體。`:'掩體有方向性，注意側翼。';
  const aimingButton=$('[data-action="toggleTargeting"]');
  aimingButton.setAttribute('aria-pressed',String(renderer.targetingEnabled));
  aimingButton.setAttribute('aria-label',renderer.targetingEnabled?'關閉瞄準資訊':'開啟瞄準資訊');
  aimingButton.textContent=renderer.targetingEnabled?'瞄準 開':'瞄準 關';
  aimingButton.classList.toggle('enemy-alert',!renderer.targetingEnabled&&view.visibleEnemies.length>0&&view.status==='playing');
  const details=renderer.targetingEnabled?targetDetails(view):null,card=$('#target-card');card.hidden=!details;
  if(details){$('#target-name').textContent=details.name;$('#target-detail').textContent=details.hp;$('#target-range').textContent=details.chance;$('#target-distance').textContent=details.distance;$('#target-cover').textContent=details.cover;$('#target-state').textContent=details.state;card.classList.toggle('out-of-range',!details.withinRange);}
  renderer.targetUI.dirty=true;renderer.placeTargetCard();
  for(const b of document.querySelectorAll('.control-deck button'))b.disabled=Boolean(playback)||view.status!=='playing'||b.dataset.action==='skill';
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
    saveGame(game);lockUntil=performance.now()+120;if(type!=='fire')audio.play(type);
    if(steps.length){
      renderer.effects=[];
      playback=new Playback(planPresentation(steps,{reduceMotion:renderer.reduceMotion}),event=>{
        renderer.game=event.state;renderer.addEffects(event.effects);update();
        if(event.effects.some(e=>e.type==='enemyShot'||(e.type==='shot'&&e.style!=='grenade')))audio.play('fire');
        if(navigator.vibrate&&event.effects.some(e=>e.type==='impact'||e.type==='blast'))navigator.vibrate(25);
      });
      playback.advance(0);
    }
  }
  if(!playback&&game.logs[0]!==oldLog)notify(game.logs[0].text);
  if(success||type!=='grenade')cancelAim();update();return success;
}
function move(dx,dy){if(renderer.mode==='grenade'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else act('move',[dx,dy]);}
function floorToast(){notify(`第 ${game.floor} 層 · ${FLOORS[game.floor-1]}：${FLOOR_INFO[game.floor-1].text}`);}
function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
function setAim(pos){if(distance(pos,game.player)<=5&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify('投擲落點需在視線內 5 格以內。');}
function interactions(view=renderer.game){return [...(view.groundWeapon?[{label:'拾取',action:'bag'}]:[]),...(view.nearbyTerminal?[{label:'終端',action:'terminal'}]:[]),...(distance(view.player,view.end)<=1?[{label:view.bossAlive?'電梯鎖定':view.floor===FLOORS.length?'撤離':'下樓',action:'descend'}]:[])];}
function updateAim(view=renderer.game){const aiming=renderer.mode==='grenade',b=$('#interact'),options=interactions(view);
  $('#grenade-label').textContent=aiming?'取消投擲':`手榴彈 ${view.player.grenades}`;
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=Boolean(playback)||(view.status==='playing'&&!aiming&&!options.length);
  b.querySelector('strong').textContent=view.status!=='playing'?'結果':aiming?'確認投擲':options.length>1?'互動':options[0]?.label||'互動';
  b.classList.toggle('aiming',aiming);
}
function interact(){if(game.status!=='playing'){showResult();return;}if(renderer.mode==='grenade'){act('grenade',renderer.aim);return;}
  const options=interactions();if(options.length>1){modal('<h2>附近互動</h2>'+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+'<button class="modal-button" data-modal="close">返回戰場</button>');return;}
  if(options[0]?.action==='bag')showInventory();else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');
}
function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}if(game.player.grenades<=0){notify('手榴彈已用盡。');return;}renderer.mode='grenade';const e=game.targeted;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify('附近沒有可見敵人。');return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
function modal(html,wide=false){cancelAim();$('#modal').classList.toggle('wide',wide);$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();updateOrientation(true);}
function close(){if(!entered){showIntro();return;}if(game.pendingPerks){showPerks();return;}if(game.status!=='playing'){$('#modal').close();return;}$('#modal').close();$('#battle').focus({preventScroll:true});}
function modalAction(type,arg){close();act(type,arg);}

function showIntro(){modal(`<div class="eyebrow">ASH PROTOCOL / 灰燼協定</div><h2>深入寂靜。<br>活著回來。</h2><p>木星邊境的厄瑞玻斯設施停止回傳訊號。你是最後一名接近它的行動員。</p><p>深入六層設施，擊敗封鎖官與核心守衛，帶著紀錄撤離。只有你採取行動，敵人才會行動。</p><p>協定點數 ${profile().protocol.balance} · 探索資料、擊敗頭目與完成樓層可累積，死亡仍保留。兌換功能將於後續開放。</p><div class="intro-rules"><span>↑ 四方向探索</span><span>⌖ 掩體與命中率</span><span>◷ 等待觀察</span><span>▣ 搜刮與換裝</span></div><p>${resumable||entered?`任務 ${game.seed} · 第 ${game.floor} 層 · ${game.turn} 回合`:'新任務已就緒。先尋找牆角，避免暴露在交叉火力中。'}</p><button class="modal-button" data-modal="enter">${resumable||entered?'繼續任務':'開始行動'} →</button><button class="modal-button secondary" data-modal="help">閱讀作戰指南</button>`);}
function showMap(){modal(`<div class="eyebrow">SECTOR ${pad(game.floor)} / ${FLOORS[game.floor-1]}</div><h2>樓層地圖</h2><canvas id="overview" width="324" height="324" aria-label="已探索地圖，橙色為角色、紅色為可見敵人、綠色為已發現電梯"></canvas><p>橙：角色 · 紅：敵人 · 綠：電梯 · 方框：鎖定目標<br>金色小點：已發現補給。只顯示已探索區域，查看不耗回合。</p><button class="modal-button" data-modal="close">返回戰場 →</button>`);renderer.drawMap($('#overview'));}

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

function showInventory() {
  const p=game.player,ground=game.items.filter(o=>o.type==='weapon'&&distance(o,p)<=1);
  modal(`<div class="eyebrow">FIELD PACK / ${p.owned.length} OF ${PACK_LIMIT}</div><h2>帶走你需要的。</h2>
    <div class="pack-resources"><span>✚ 醫療 <b>${p.meds}</b></span><span>◉ 手榴彈 <b>${p.grenades}</b></span><span>◇ 廢料 <b>${p.scrap}</b></span><span>▣ 護甲板 <b>${p.plates}/30</b></span></div>
    <p class="ammo-summary">實彈 ${p.reserve} · 電池 ${p.energy} · 榴彈 ${p.ordnance}<br>護甲板吸收直接傷害的至多一半，消耗後可拾取修復；不擋毒液或高熱。<br>換裝、拆解、改裝與補給各消耗 1 回合。查看背包不耗時。</p>
    <div class="pack-weapons">${p.owned.map(index=>{const w=WEAPONS[index],d=game.weaponDamage(index),active=index===p.weapon,level=p.upgrades[index],cost=25+level*15;return `<article class="pack-weapon ${active?'equipped':''}"><img src="./assets/${w.file}.svg" alt="${w.name}"><div><small>${active?'已裝備':'備用'} / ${w.code}</small><h3>${w.name}${level?` +${level}`:''}</h3><p>${w.desc}</p><span>傷害 ${d.min}–${d.max}${w.burst?' ×2':''} · 射程 ${w.range} · 彈匣 ${p.ammo[index]}/${w.mag}</span><div class="pack-actions"><button data-equip="${index}" ${active?'disabled':''}>裝備</button><button data-salvage="${index}" ${p.owned.length<=1?'disabled':''}>拆解 +${20+level*10}</button>${active?`<button data-bag-action="upgrade" ${p.scrap<cost||level>=3?'disabled':''}>${level>=3?'改裝已滿':`改裝 ${cost} 廢料`}</button>`:''}</div></div></article>`;}).join('')}</div>
    ${ground.map(item=>`<div class="ground-loot"><strong>附近軍械：${WEAPONS[item.weapon].name}</strong><button data-take="${item.weapon}" ${p.owned.length>=PACK_LIMIT||p.owned.includes(item.weapon)?'disabled':''}>拾取武器</button><small>${p.owned.length>=PACK_LIMIT?'武器欄已滿；拆解一把後，再次打開背包拾取。':'拾取後不會自動換裝。'}</small></div>`).join('')}
    <div class="modal-row"><button class="modal-button secondary" data-bag-action="heal" ${!p.meds?'disabled':''}>使用醫療包</button><button class="modal-button secondary" data-modal="journal">資料與紀錄</button></div><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);
}
function showTerminal(){const p=game.player;modal(`<div class="eyebrow">SUPPLY TERMINAL / ONE USE</div><h2>戰場上的喘息。</h2><p>此終端只能使用一次。交易耗費 1 回合。持有廢料：${p.scrap}</p><button class="perk" data-terminal="heal" ${p.scrap<15?'disabled':''}><strong>醫療修復 · 15 廢料</strong><span>回復 60 生命並清除中毒。</span></button><button class="perk" data-terminal="ammo" ${p.scrap<15?'disabled':''}><strong>混合彈藥 · 15 廢料</strong><span>子彈 +24、電池 +12、榴彈 +3。</span></button><button class="perk" data-terminal="grenade" ${p.scrap<12?'disabled':''}><strong>爆破補給 · 12 廢料</strong><span>手榴彈 +2。</span></button><button class="modal-button secondary" data-modal="close">返回戰場</button>`);}
function showPerks(){modal(`<div class="eyebrow">UPGRADE AVAILABLE / LV. ${game.player.level}</div><h2>適應，然後生存。</h2><p>強化生效至本次任務結束。${game.pendingPerks>1?`還有 ${game.pendingPerks} 次選擇。`:''}</p>${game.perkChoices.map(p=>`<button class="perk" data-perk="${p.id}"><strong>＋ ${p.name}</strong><span>${p.text}</span></button>`).join('')}`);}
function showJournal(){const p=game.player,records=profile();modal(`<div class="eyebrow">ARCHIVE / FIELD INTELLIGENCE</div><h2>留下你的足跡。</h2><div class="journal-tabs"><button data-modal="journal">任務紀錄</button><button data-modal="bestiary">敵人圖鑑</button><button data-modal="help">操作指南</button></div><div class="result-stats"><div><b>${records.runs}</b>完成任務</div><div><b>${records.wins}</b>成功撤離</div><div><b>${records.bestFloor}/6</b>最深紀錄</div></div><h3>協定點數 ${records.protocol.balance}</h3><p>本次累積 ${game.protocol.earned} · 死亡仍保留。之後用於解鎖武器掉落池與角色，目前尚未開放兌換。</p><h3>本次收集 ${p.lore.length} / 6</h3>${p.lore.length?p.lore.map(f=>`<p class="lore-entry"><strong>${pad(f)} / ${FLOORS[f-1]}</strong><br>${LORE[f-1]}</p>`).join(''):'<p>探索各層紫色資料片段，拼湊設施的秘密。</p>'}<h3>最近任務</h3>${records.history.length?records.history.slice(0,5).map(r=>`<p>RUN ${r.seed} · ${r.won?'撤離':'陣亡'} · ${r.floor} 層 · ${r.kills} 擊殺 · ${r.turn} 回合</p>`).join(''):'<p>第一次任務紀錄尚未完成。</p>'}<button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function bestiary(){modal(`<div class="eyebrow">HOSTILE DATABASE / 10</div><h2>了解你的敵人。</h2><div class="bestiary">${Object.entries(ENEMY_TYPES).map(([id,e])=>`<article><span class="enemy-token" style="--enemy:${e.color}">${id==='boss'?'Ω':id==='drone'?'◇':'!'}</span><div><h3>${e.name}</h3><small>基礎生命 ${e.hp} · 射程 ${e.range} · 護甲 ${e.armor}</small><p>${e.role}</p></div></article>`).join('')}</div><button class="modal-button" data-modal="close">返回戰場 →</button>`,true);}
function showHelp(){modal(`<div class="eyebrow">FIELD MANUAL / BUILD 3.6.1</div><h2>每一步，都要算數。</h2><p>穿越六層設施。第 3 層擊敗封鎖官，第 6 層摧毀核心守衛，從綠色電梯撤離。</p><div class="help-grid"><b>四方向</b><span>↑ ↓ ← → 就是畫面上的上下左右。方向鈕、鍵盤 WASD / 方向鍵或點相鄰格移動。</span><b>射擊</b><span>點敵人、掩體或油桶鎖定，再按開火 / Space。目標鈕 / Tab 輪換敵人。瞄準鈕 / Q 收起或顯示浮卡、鎖定框及目標取景，關閉時仍可開火，視野如同沒有鎖定目標；點擊敵人會重新開啟瞄準。有敵人時會閃爍提醒。</span><b>掩體</b><span>牆角可探身互射，也能提供掩護。箱體與牆角均降低命中率並減傷；爆炸無視箱體。</span><b>命中率</b><span>暴露且靜止 97%；移動 −22%。箱體 −35%、牆角 −42%，敵我規則相同。目標旁的半透明卡片顯示名稱、HP、命中率、距離與掩體；卡片不攔截觸控。</span><b>手榴彈</b><span>按 G 或手榴彈，點地板選落點，再按右下「確認投擲」；原手榴彈按鈕可取消。射程 5、爆炸半徑 2，會自傷和連鎖引爆。</span><b>背包</b><span>B 開啟背包，可帶 3 把武器。在背包直接選擇武器換裝（1 回合）。Q 開關瞄準資訊（不耗回合）、R 裝填、H 醫療、F / 句點 / 中央鈕等待：本回合直接傷害減半、被射擊命中率 −15，下次行動射擊命中 +15（最高 99%）。加成不疊加；任何有效行動後失效。</span><b>補給</b><span>走上道具即可拾取；護甲板滿額時留在原地。彈藥庫有三類備彈，醫療室與裝甲庫提供專用補給，探索地圖可查看已發現的補給。靠近終端以廢料交易。武器可拆解回收、改裝增傷至 +3。</span><b>危險</b><span>! 代表敵人蓄勢。紅色轟炸格兩回合後爆炸；綠色毒液與橘色高熱格會傷害站在上面的單位。</span><b>撤離</b><span>到綠色電梯鄰格，按電梯按鈕或 E。頭目未死時電梯鎖定。</span><b>存檔</b><span>每步自動儲存在目前瀏覽器。設定可匯出 / 匯入存檔，避免換裝置失去進度。</span></div><button class="modal-button" data-modal="close">收到，返回戰場 →</button>`,true);}
function settings(){modal(`<div class="eyebrow">SYSTEM / BUILD 3.6.1</div><h2>作戰設定</h2><p>任務 ${game.seed} · 第 ${game.floor} 層 · ${game.turn} 回合<br>${storage.available?'進度已自動儲存。':'本機儲存不可用，請匯出存檔保留進度。'}</p><div class="modal-row"><button class="modal-button secondary" data-modal="sound">音效：${audio.enabled?'開啟':'關閉'}</button><button class="modal-button secondary" data-modal="help">作戰指南</button></div><div class="modal-row"><button class="modal-button secondary" data-modal="backupExport">完整備份</button><button class="modal-button secondary" data-modal="backupImport">還原備份</button></div>${read('ash-backup-before-restore')?'<button class="modal-button secondary" data-modal="backupPrevious">下載還原前備份</button>':''}<p>完整備份包含點數、解鎖、任務歷史與目前任務。下方僅匯出／匯入單局任務。</p><div class="modal-row"><button class="modal-button secondary" data-modal="export">匯出任務</button><button class="modal-button secondary" data-modal="import">匯入任務</button></div><button class="modal-button secondary" data-modal="journal">任務紀錄與敵人圖鑑</button><button class="modal-button secondary" data-modal="intro">任務簡介</button><button class="modal-button secondary" data-modal="restart">重新部署新任務</button><button class="modal-button" data-modal="close">繼續任務 →</button>`);}
function showResult(){const won=game.status==='won',p=game.player;modal(`<div class="eyebrow">${won?'SIGNAL RESTORED':'SIGNAL LOST'} / RUN ${game.seed}</div><h2>${won?'灰燼之中，仍有回音。':'這次的訊號，到此為止。'}</h2><p>${won?'核心已沉默。你帶著設施的秘密，搭上最後一班撤離電梯。':'你留下的紀錄將協助下一位行動員。掩體、補給與適時撤退，都能改變下一次任務。'}</p><div class="result-stats"><div><b>${pad(game.floor)}</b>抵達樓層</div><div><b>${p.kills}</b>消滅敵人</div><div><b>${game.turn}</b>行動回合</div></div><p>本次協定點數 +${game.protocol.earned} · 累計持有 ${profile().protocol.balance}<br>死亡仍保留，未來可解鎖武器與角色。</p><p>總傷害 ${p.stats.damage} · 投擲 ${p.stats.grenades} · 資料 ${p.lore.length}/6</p><button class="modal-button secondary" data-modal="lastBattle">查看最後戰場</button><button class="modal-button" data-modal="new">重新部署 →</button>`);}
function newGame(seed){entered=true;game=new Game(seed,profile().unlocks.weapons);playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];cancelAim();lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();floorToast();}
function exportSave(){const blob=new Blob([game.serialize()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ash-protocol-${game.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('存檔已匯出。');}
function downloadJSON(raw,name){const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function backupError(error){modal(`<h2>備份操作未完成</h2><p>${escapeHTML(error.message)}</p><button class="modal-button" data-modal="backupCancel">返回設定</button>`);}
function applyBackup(){
  if(!pendingBackup)return;
  try{
    const next=restoreBackup(pendingBackup,game);pendingBackup=null;
    game=next.game||new Game(undefined,profile().unlocks.weapons);entered=Boolean(next.game);resumable=Boolean(next.game);
    playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];cancelAim();lastStatus='playing';previousFloor=game.floor;
    $('#modal').close();update();if(!entered)showIntro();notify('完整備份已還原；原資料可在設定下載。');
  }catch(error){backupError(error);}
}

$('#import-backup').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;pendingBackup=null;
  try{
    if(file.size>BACKUP_LIMIT)throw new Error('備份檔案超過 5 MB 限制。');
    const raw=await file.text(),next=previewBackup(raw),p=next.snapshot.profile;pendingBackup=raw;
    modal(`<div class="eyebrow">RESTORE BACKUP</div><h2>還原這份完整備份？</h2><p>${escapeHTML(file.name)}<br>${escapeHTML(new Date(next.snapshot.createdAt).toLocaleString('zh-TW'))}</p><p>協定點數：${profile().protocol.balance} → ${p.protocol.balance}<br>任務紀錄：${p.runs} 次 · 解鎖武器 ${p.unlocks.weapons.length} · 角色 ${p.unlocks.characters.length}<br>${next.game?`備份任務 ${next.game.seed} · 第 ${next.game.floor} 層 · ${next.game.turn} 回合`:'備份沒有進行中的任務，還原後可開始新任務。'}</p><p>點數、紀錄與目前任務會以備份快照替換。還原前會自動保存原資料，可回設定下載。</p><button class="modal-button" data-modal="backupConfirm">確認還原</button><button class="modal-button secondary" data-modal="backupCancel">取消</button>`);
  }catch(error){backupError(error);}e.target.value='';
});

document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(playback||orientationBlocked||!b||b.disabled)return;
  if(b.dataset.context){close();if(b.dataset.context==='bag')showInventory();else if(b.dataset.context==='terminal')showTerminal();else act('interact');return;}
  if(b.dataset.move){move(...b.dataset.move.split(',').map(Number));return;}
  if(b.dataset.perk){game.choosePerk(b.dataset.perk);$('#modal').close();audio.play('heal');update();return;}
  if(b.dataset.equip!==undefined){modalAction('weapon',Number(b.dataset.equip));return;}
  if(b.dataset.take!==undefined){modalAction('takeWeapon',Number(b.dataset.take));return;}
  if(b.dataset.salvage!==undefined){const index=Number(b.dataset.salvage);modal(`<div class="eyebrow">SALVAGE WEAPON</div><h2>拆解${WEAPONS[index].name}？</h2><p>回收彈匣內的備彈與廢料。武器將從背包移除，耗費 1 回合。</p><button class="modal-button" data-confirm-salvage="${index}">確認拆解</button><button class="modal-button secondary" data-modal="bag">返回背包</button>`);return;}
  if(b.dataset.confirmSalvage!==undefined){modalAction('salvage',Number(b.dataset.confirmSalvage));return;}
  if(b.dataset.bagAction){modalAction(b.dataset.bagAction);return;}
  if(b.dataset.terminal){modalAction('terminal',b.dataset.terminal);return;}
  if(b.dataset.modal){switch(b.dataset.modal){
    case 'lastBattle':$('#modal').close();break;case 'enter':entered=true;$('#modal').close();update();floorToast();break;case 'intro':showIntro();break;case 'close':close();break;case 'bag':showInventory();break;case 'journal':showJournal();break;case 'bestiary':bestiary();break;case 'help':showHelp();break;
    case 'sound':audio.enabled=!audio.enabled;write('ash-sound',audio.enabled?'on':'off');settings();break;
    case 'backupExport':try{downloadJSON(exportBackup(game),'ash-protocol-backup.json');notify('完整備份已匯出。');}catch(error){backupError(error);}break;
    case 'backupImport':$('#import-backup').click();break;
    case 'backupPrevious':{const raw=read('ash-backup-before-restore');if(raw)downloadJSON(raw,'ash-protocol-before-restore.json');break;}
    case 'backupConfirm':applyBackup();break;case 'backupCancel':pendingBackup=null;settings();break;
    case 'export':exportSave();break;case 'import':$('#import-save').click();break;
    case 'restart':modal('<div class="eyebrow">REDEPLOY</div><h2>重新部署？</h2><p>目前任務將結束。可先在設定匯出存檔。</p><label class="seed-field">地圖種子（留空隨機）<input id="new-seed" type="number" min="0" max="999999999" placeholder="例：2026" inputmode="numeric"></label><button class="modal-button" data-modal="new">確認，開始新任務</button><button class="modal-button secondary" data-modal="close">返回目前任務</button>');break;
    case 'new':{const value=$('#new-seed')?.value,seed=value!==undefined&&value!==''?Number(value):undefined;if(seed!==undefined&&(!Number.isInteger(seed)||seed<0||seed>999999999)){notify('種子需為 0–999999999 的整數。');return;}newGame(seed);break;}
  }return;}
  switch(b.dataset.action){
    case 'interact':interact();break;case 'result':showResult();break;case 'map':showMap();break;case 'game':$('#battle').focus();break;case 'help':showHelp();break;case 'settings':settings();break;case 'bag':showInventory();break;case 'terminal':showTerminal();break;
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
  const target=[...game.visibleEnemies,...game.props.filter(p=>p.hp>0&&game.visible(p))].find(o=>distance(o,pos)===0);
  if(target){game.target=target.id;if(game.enemies.includes(target)&&!renderer.targetingEnabled)toggleTargeting();else update();return;}
  if(distance(pos,game.end)===0&&distance(game.player,pos)<=1){act('interact');return;}
  if(game.props.some(o=>o.type==='terminal'&&!o.used&&distance(o,pos)===0&&distance(o,game.player)<=1)){showTerminal();return;}
  if(distance(pos,game.player)===1)move(pos.x-game.player.x,pos.y-game.player.y);
  else notify('點相鄰格移動，或在戰場滑動一步。');
});
$('#battle').addEventListener('pointercancel',()=>{pointerStart=null;});
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(playback){if(e.key.length===1||e.key.startsWith('Arrow')||e.key==='Tab')e.preventDefault();return;}
  if(orientationBlocked||$('#modal').open||e.target.matches('input,textarea,select'))return;
  const moves={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]},actions={' ':'fire',r:'reload',h:'heal',e:'interact',f:'wait','.':'wait'},key=e.key.length===1?e.key.toLowerCase():e.key;
  if(moves[key]){e.preventDefault();move(...moves[key]);}
  else if(actions[key]){e.preventDefault();if(key==='e')interact();else act(actions[key]);}
  else if(key==='q'){e.preventDefault();toggleTargeting();}
  else if(key==='Tab'){e.preventDefault();cycleTarget();}
  else if(key==='g'){e.preventDefault();grenade();}
  else if(key==='b'){e.preventDefault();showInventory();}
  else if(key==='Escape'){if(renderer.mode)cancelAim();else settings();}
});
$('#import-save').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>1000000)throw new Error('存檔超過大小限制。');const imported=Game.restore(await file.text());if(!imported)throw new Error('存檔格式不相容或任務已結束。');write('ash-save-before-import',game.serialize());game=imported;playback=null;renderer.game=game;renderer.camera={x:game.player.x,y:game.player.y};renderer.effects=[];lastStatus='playing';previousFloor=game.floor;$('#modal').close();update();notify('存檔已匯入；原進度已在本機備份。'); }catch(error){modal('<h2>無法匯入存檔</h2><p>'+escapeHTML(error.message)+'</p><button class="modal-button" data-modal="close">返回戰場</button>');}e.target.value='';
});
document.addEventListener('selectstart',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(!target?.closest('input,textarea'))e.preventDefault();});
document.addEventListener('contextmenu',e=>{const target=e.target instanceof Element?e.target:e.target.parentElement;if(target?.closest('.battle-panel'))e.preventDefault();});
window.addEventListener('pagehide',()=>{if(entered)saveGame(game);});update();showIntro();
if('serviceWorker'in navigator)navigator.serviceWorker.register(new URL('../sw.js',import.meta.url)).catch(()=>{});
