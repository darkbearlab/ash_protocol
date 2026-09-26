import {t} from './i18n.js';
import {CHARACTERS} from './characters.js';
import {STORIES,RETIRED_STORY_IDS} from './story-data.js';
import {UNLOCK_SETTINGS,CHARACTER_IDS,unlocked,unlockEntry,shelvedCharacter} from './unlock-catalog.js';
import {FACTIONS} from './faction-catalog.js';

// Unlock page, locked rows and unlock presentation (docs/UNLOCKS.md section 8, Claude, 3.90.1).
// Purchases and corpse finds are written by storage.grantUnlock and Game.recoverOperator; this module only lays them out.
// Story titles and bodies come from user-maintained Markdown, so every piece of story text is escaped.

const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=body=>escapeHTML(body).split(/(?:\r?\n){2,}/).map(p=>`<p>${p.replace(/\r?\n/g,'<br>')}</p>`).join('');
const characterLabel=id=>CHARACTERS[id]?.label||id;
const factionName=id=>id==='any'?t('unlock-ui.anyFacility'):FACTIONS[id]?.name||id;
const floorsLabel=([from,to])=>from===to?`${t('unlock-ui.fromFloor',{from})}`:`${t('unlock-ui.floorRange',{from,to})}`;

export const UNLOCK_TABS={characters:t('unlock-ui.tabClasses'),stories:t('unlock-ui.tabStories')};
export const CORPSE_HINT=t('unlock-ui.corpseHint');
export const UNLOCK_HELP=t('unlock-ui.help');
export const storyHint=s=>`${t('unlock-ui.storySource',{v:factionName(s.faction),v2:floorsLabel(s.floors)})}`;
export const operatorSignal=g=>g.operatorCorpse&&!g.operatorCorpse.recovered?t('unlock-ui.lifeSignal'):'';

// Mirrors the refusals in unlock-catalog.grantUnlock so a disabled button can say why; the write still decides.
export function purchaseReason(profile,entry,{settings=UNLOCK_SETTINGS,available=true}={}){
  if(settings.demo)return t('unlock-ui.demoLocked');
  if(entry.retired)return t('unlock-ui.archived');
  if(settings.storiesWip&&entry.kind==='story'&&!unlocked(profile,entry.id))return t('unlock-ui.storiesWip');   // 3.190.0
  if(unlocked(profile,entry.id))return t('unlock-ui.unlocked');
  if(!available)return t('unlock-ui.noStorage');
  if(profile.protocol.balance<entry.price)return `${t('unlock-ui.shortBy',{v:entry.price-profile.protocol.balance})}`;
  return '';
}

function characterCard(profile,id,options){
  const c=CHARACTERS[id],entry=unlockEntry(id),owned=unlocked(profile,id),reason=purchaseReason(profile,entry,options);
  const tier=entry.starting?t('unlock-ui.starter'):owned?t('unlock-ui.unlocked'):`${t('unlock-ui.price',{price:entry.price})}`;
  return `<article class="upgrade-card unlock-card${owned?' unlocked':''}"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas><h3>${c.label}</h3><span class="upgrade-tier">${tier}</span>${owned?(c.label.toLowerCase()===c.name.toLowerCase()?'':`<p>${c.name.toUpperCase()}</p>`):`<p>${options.settings.demo?t('unlock-ui.fullRelease'):CORPSE_HINT}</p><button data-unlock-buy="${id}"${reason?' disabled':''}>${reason||t('unlock-ui.unlock')}</button>`}</article>`;
}
function storyEntry(profile,s,options){
  if(unlocked(profile,s.id))return `<details class="upgrade-section story-entry"><summary><span class="story-title">${escapeHTML(s.title)}</span><small>${t('unlock-ui.unlocked')}</small></summary><div class="lore-entry">${paragraphs(s.body)}</div></details>`;
  const reason=purchaseReason(profile,{...s,kind:'story'},options);
  return `<div class="story-entry locked"><h3>${escapeHTML(s.title)}</h3><p>${storyHint(s)}</p><button data-unlock-buy="${escapeHTML(s.id)}"${reason?' disabled':''}>${reason||`${t('unlock-ui.unlockFor',{price:s.price})}`}</button></div>`;
}

export function unlockPageMarkup(profile,{tab='characters',message='',settings=UNLOCK_SETTINGS,available=true}={}){
  const options={settings,available},classes=CHARACTER_IDS.filter(id=>CHARACTERS[id]&&!shelvedCharacter(id));
  const stories=STORIES; // Already sorted by order, then id, by npm run stories.
  const archived=RETIRED_STORY_IDS.filter(id=>profile.unlocks.stories?.includes(id));
  const tabs=`<div class="inventory-tabs unlock-tabs" role="tablist" aria-label="${t('unlock-ui.tabsAria')}">${Object.entries(UNLOCK_TABS).map(([id,label])=>`<button role="tab" aria-selected="${id===tab}" data-unlock-tab="${id}">${label}</button>`).join('')}</div>`;
  const panel=tab==='stories'
    ?`${settings.storiesWip?`<p class="story-wip-note">${t('unlock-ui.storiesWipNote')}</p>`:''}<div class="story-list${settings.storiesWip?' wip':''}">${settings.storiesWip?'<div class="story-stamp" aria-hidden="true"><span>DECRYPTION<br>IN PROGRESS</span></div>':''}${stories.map(s=>storyEntry(profile,s,options)).join('')}${archived.map(()=>t('unlock-ui.archivedEntry')).join('')}${stories.length||archived.length?'':t('unlock-ui.noStories')}</div>`
    :`<div class="upgrade-grid unlock-grid">${classes.map(id=>characterCard(profile,id,options)).join('')}</div>`;
  return `<div class="eyebrow">PROTOCOL / UNLOCKS</div><h2>${t('unlock-ui.title')}</h2>
<p>${t('unlock-ui.protocol')} <b>${profile.protocol.balance}</b> ${t('unlock-ui.summary',{v:classes.filter(id=>unlocked(profile,id)).length,classesLength:classes.length,v2:stories.filter(s=>unlocked(profile,s.id)).length,storiesLength:stories.length})}<br>${settings.demo?t('unlock-ui.demoNote'):t('unlock-ui.note')}</p>
${tabs}${message?`<p role="status">${escapeHTML(message)}</p>`:''}<section role="tabpanel">${panel}</section>
<button class="modal-button secondary" data-modal="intro">${t('controller.backToTitle')}</button>`;
}

export function purchaseConfirmMarkup(profile,id){
  const entry=unlockEntry(id),story=entry.kind==='story',name=story?`${t('unlock-ui.storyName',{v:escapeHTML(entry.title)})}`:`${t('unlock-ui.className',{v:characterLabel(id)})}`;
  return `<div class="eyebrow">PROTOCOL / CONFIRM</div><h2>${t('unlock-ui.confirmTitle',{name})}</h2><p>${t('unlock-ui.confirmBody',{price:entry.price,v:profile.protocol.balance-entry.price})}</p>
<button class="modal-button" data-unlock-confirm="${escapeHTML(id)}">${t('unlock-ui.confirm')}</button><button class="modal-button secondary" data-unlock-tab="${story?'stories':'characters'}">${t('controller.cancel')}</button>`;
}

export function operatorRecoveredMarkup(id,{newly=true}={}){
  const label=characterLabel(id);
  return `<div class="eyebrow">PERSONNEL RECORD / RECOVERED</div><div class="operator-identity unlock-reveal"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas><div><h2>${newly?`${t('unlock-ui.recoveredTitle',{label})}`:`${t('unlock-ui.recoveredId',{label})}`}</h2><p>${newly?t('unlock-ui.recoveredBody'):t('unlock-ui.alreadyUnlocked')}</p></div></div>
<button class="modal-button" data-modal="close">${t('controller.backToField')}</button>`;
}

// Read the profile after the result is written: only stories that were actually saved count as unlocked.
export function resultStoriesMarkup(game,profile){
  const pending=game.pendingStories||[];if(!pending.length)return '';
  const title=id=>escapeHTML(STORIES.find(s=>s.id===id)?.title||t('unlock-ui.archivedRecord'));
  if(game.status==='won'){const saved=pending.filter(id=>profile.unlocks.stories?.includes(id));
    return `<section class="result-unlocks"><h3>${t('unlock-ui.storiesUnlocked',{savedLength:saved.length})}</h3><p>${saved.length?`${saved.map(title).join(t('common.listSeparator'))}<br>${t('unlock-ui.storiesWhere')}`:t('unlock-ui.storiesNotSaved')}</p></section>`;}
  return `<section class="result-unlocks lost"><h3>${t('unlock-ui.storiesLost',{pendingLength:pending.length})}</h3><p>${t('unlock-ui.noExtraction',{v:pending.map(title).join(t('common.listSeparator'))})}</p></section>`;
}

export function lockedOperatorRow(id,settings=UNLOCK_SETTINGS){
  const c=CHARACTERS[id],price=unlockEntry(id)?.price;
  return `<div class="term-row locked"><div class="term-pick" aria-disabled="true"><span class="term-caret" aria-hidden="true">×</span><span class="term-face" aria-hidden="true"></span><span class="term-sprite"><canvas data-class-sprite="${id}" width="32" height="32" aria-hidden="true"></canvas></span><span class="term-body"><span class="term-name">${c.label}</span><span class="term-meta">LOCKED · ${settings.demo?t('unlock-ui.demoClosed'):`${t('unlock-ui.price',{price})}`}</span></span></div><p class="term-note">${settings.demo?t('unlock-ui.demoNote'):`${t('unlock-ui.orBuy',{CORPSE_HINT,price})}`}</p></div>`;
}
