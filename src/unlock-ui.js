import {CHARACTERS} from './characters.js';
import {STORIES,RETIRED_STORY_IDS} from './story-data.js';
import {UNLOCK_SETTINGS,CHARACTER_IDS,unlocked,unlockEntry} from './unlock-catalog.js';
import {FACTIONS} from './faction-catalog.js';

// Unlock page, locked rows and unlock presentation (docs/UNLOCKS.md section 8, Claude, 3.90.1).
// Purchases and corpse finds are written by storage.grantUnlock and Game.recoverOperator; this module only lays them out.
// Story titles and bodies come from user-maintained Markdown, so every piece of story text is escaped.

const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=body=>escapeHTML(body).split(/(?:\r?\n){2,}/).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`).join('');
const characterLabel=id=>CHARACTERS[id]?.label||id;
const factionName=id=>id==='any'?'任何設施':FACTIONS[id]?.name||id;
const floorsLabel=([from,to])=>from===to?`第 ${from} 層`:`第 ${from}–${to} 層`;

export const UNLOCK_TABS={characters:'職業',stories:'設施紀錄'};
export const CORPSE_HINT='無盡第 8 層起可能發現遺體，回收即解鎖。';
export const UNLOCK_HELP='主選單 UNLOCKS 用協定點數解鎖職業與設施紀錄。無盡模式第 8 層起，樓層可能有失聯幹員的遺體，進入樓層時會提示識別訊號；靠近後按右下互動回收，不耗回合，立即解鎖，這局陣亡也會保留。沒回收就換層，這一局不會再出現同一個職業。戰役的資料物件會帶回一份設施紀錄，成功撤離才解鎖，陣亡或放棄就遺失。';
export const storyHint=s=>`戰役 · ${factionName(s.faction)} · ${floorsLabel(s.floors)}的資料物件，撤離後解鎖。`;
export const operatorSignal=g=>g.operatorCorpse&&!g.operatorCorpse.recovered?' 偵測到失聯幹員的識別訊號。':'';

// Mirrors the refusals in unlock-catalog.grantUnlock so a disabled button can say why; the write still decides.
export function purchaseReason(profile,entry,{settings=UNLOCK_SETTINGS,available=true}={}){
  if(settings.demo)return '試玩版不開放購買';
  if(entry.retired)return '已封存';
  if(unlocked(profile,entry.id))return '已解鎖';
  if(!available)return '本機儲存無法使用';
  if(profile.protocol.balance<entry.price)return `還差 ${entry.price-profile.protocol.balance} 點`;
  return '';
}

function characterCard(profile,id,options){
  const c=CHARACTERS[id],entry=unlockEntry(id),owned=unlocked(profile,id),reason=purchaseReason(profile,entry,options);
  const tier=entry.starting?'起始職業':owned?'已解鎖':`${entry.price} 點`;
  return `<article class="upgrade-card unlock-card${owned?' unlocked':''}"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas><h3>${c.label}</h3><span class="upgrade-tier">${tier}</span>${owned?`<p>${c.name.toUpperCase()}</p>`:`<p>${options.settings.demo?'正式版開放。':CORPSE_HINT}</p><button data-unlock-buy="${id}"${reason?' disabled':''}>${reason||'解鎖'}</button>`}</article>`;
}
function storyEntry(profile,s,options){
  if(unlocked(profile,s.id))return `<details class="upgrade-section story-entry"><summary><span class="story-title">${escapeHTML(s.title)}</span><small>已解鎖</small></summary><div class="lore-entry">${paragraphs(s.body)}</div></details>`;
  const reason=purchaseReason(profile,{...s,kind:'story'},options);
  return `<div class="story-entry locked"><h3>${escapeHTML(s.title)}</h3><p>${storyHint(s)}</p><button data-unlock-buy="${escapeHTML(s.id)}"${reason?' disabled':''}>${reason||`${s.price} 點解鎖`}</button></div>`;
}

export function unlockPageMarkup(profile,{tab='characters',message='',settings=UNLOCK_SETTINGS,available=true}={}){
  const options={settings,available},classes=CHARACTER_IDS.filter(id=>CHARACTERS[id]);
  const stories=STORIES; // Already sorted by order, then id, by npm run stories.
  const archived=RETIRED_STORY_IDS.filter(id=>profile.unlocks.stories?.includes(id));
  const tabs=`<div class="inventory-tabs unlock-tabs" role="tablist" aria-label="解鎖分類">${Object.entries(UNLOCK_TABS).map(([id,label])=>`<button role="tab" aria-selected="${id===tab}" data-unlock-tab="${id}">${label}</button>`).join('')}</div>`;
  const panel=tab==='stories'
    ?`<div class="story-list">${stories.map(s=>storyEntry(profile,s,options)).join('')}${archived.map(()=>'<div class="story-entry archived"><h3>已封存</h3><p>這段紀錄已從資料庫移除，解鎖紀錄保留。</p></div>').join('')}${stories.length||archived.length?'':'<p>尚無設施紀錄。</p>'}</div>`
    :`<div class="upgrade-grid unlock-grid">${classes.map(id=>characterCard(profile,id,options)).join('')}</div>`;
  return `<div class="eyebrow">PROTOCOL / UNLOCKS</div><h2>解鎖</h2>
<p>協定點數 <b>${profile.protocol.balance}</b> · 職業 ${classes.filter(id=>unlocked(profile,id)).length}/${classes.length} · 紀錄 ${stories.filter(s=>unlocked(profile,s.id)).length}/${stories.length}<br>${settings.demo?'試玩版只開放起始三個職業。':'點數在任務中累積，陣亡也保留。職業也能在無盡深處回收，設施紀錄也能從戰役撤離帶回。'}</p>
${tabs}${message?`<p role="status">${escapeHTML(message)}</p>`:''}<section role="tabpanel">${panel}</section>
<button class="modal-button secondary" data-modal="intro">← 返回主選單</button>`;
}

export function purchaseConfirmMarkup(profile,id){
  const entry=unlockEntry(id),story=entry.kind==='story',name=story?`設施紀錄「${escapeHTML(entry.title)}」`:`職業「${characterLabel(id)}」`;
  return `<div class="eyebrow">PROTOCOL / CONFIRM</div><h2>解鎖${name}？</h2><p>花費 ${entry.price} 協定點數，剩餘 ${profile.protocol.balance-entry.price}。解鎖永久保留。</p>
<button class="modal-button" data-unlock-confirm="${escapeHTML(id)}">確認解鎖</button><button class="modal-button secondary" data-unlock-tab="${story?'stories':'characters'}">取消</button>`;
}

export function operatorRecoveredMarkup(id,{newly=true}={}){
  const label=characterLabel(id);
  return `<div class="eyebrow">PERSONNEL RECORD / RECOVERED</div><div class="operator-identity unlock-reveal"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas><div><h2>${newly?`解鎖職業：${label}`:`${label}的識別資料`}</h2><p>${newly?'遺體上的識別資料已上傳協定。之後的新任務可以選擇這個職業，這局陣亡也會保留。':'這個職業已經解鎖，資料已歸檔。'}</p></div></div>
<button class="modal-button" data-modal="close">返回戰場 →</button>`;
}

// Read the profile after the result is written: only stories that were actually saved count as unlocked.
export function resultStoriesMarkup(game,profile){
  const pending=game.pendingStories||[];if(!pending.length)return '';
  const title=id=>escapeHTML(STORIES.find(s=>s.id===id)?.title||'已封存的紀錄');
  if(game.status==='won'){const saved=pending.filter(id=>profile.unlocks.stories?.includes(id));
    return `<section class="result-unlocks"><h3>解鎖設施紀錄 ${saved.length}</h3><p>${saved.length?`${saved.map(title).join('、')}<br>可到主選單 UNLOCKS 的設施紀錄頁閱讀。`:'撤離紀錄沒有寫入，這次的設施紀錄暫時沒有解鎖。'}</p></section>`;}
  return `<section class="result-unlocks lost"><h3>資料遺失 ${pending.length}</h3><p>沒有撤離，這次帶著的資料沒有解鎖：${pending.map(title).join('、')}。</p></section>`;
}

export function lockedOperatorRow(id,settings=UNLOCK_SETTINGS){
  const c=CHARACTERS[id],price=unlockEntry(id)?.price;
  return `<div class="term-row locked"><div class="term-pick" aria-disabled="true"><span class="term-caret" aria-hidden="true">×</span><span class="term-face" aria-hidden="true"></span><span class="term-sprite"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas></span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">LOCKED · ${settings.demo?'試玩版未開放':`${price} 點`}</span></span></div><p class="term-note">${settings.demo?'試玩版只開放起始三個職業。':`${CORPSE_HINT}也可在主選單 UNLOCKS 用 ${price} 點購買。`}</p></div>`;
}
