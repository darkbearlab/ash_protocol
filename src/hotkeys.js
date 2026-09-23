// Keyboard bindings (3.121.0, user request): every battle command can take two keys, set in the settings, and the main
// buttons can show their key in the top-left corner, like the key overlays of a mobile game emulator. A local
// preference, never part of a save. Escape is fixed to the menu and cancelling, so a bad binding can always be undone.
import {t} from './i18n.js';
export const HOTKEY_SLOTS=2;
export const HOTKEY_ACTIONS=Object.freeze([
 {id:'moveUp',group:t('hotkeyActions.moveUp.group'),label:t('hotkeyActions.moveUp.label'),defaults:['ArrowUp','w']},
 {id:'moveLeft',group:t('hotkeyActions.moveLeft.group'),label:t('hotkeyActions.moveLeft.label'),defaults:['ArrowLeft','a']},
 {id:'moveDown',group:t('hotkeyActions.moveDown.group'),label:t('hotkeyActions.moveDown.label'),defaults:['ArrowDown','s']},
 {id:'moveRight',group:t('hotkeyActions.moveRight.group'),label:t('hotkeyActions.moveRight.label'),defaults:['ArrowRight','d']},
 {id:'wait',group:t('hotkeyActions.wait.group'),label:t('hotkeyActions.wait.label'),defaults:['f','.']},
 {id:'fire',group:t('hotkeyActions.fire.group'),label:t('hotkeyActions.fire.label'),defaults:[' ']},
 {id:'reload',group:t('hotkeyActions.reload.group'),label:t('hotkeyActions.reload.label'),defaults:['r']},
 {id:'grenade',group:t('hotkeyActions.grenade.group'),label:t('hotkeyActions.grenade.label'),defaults:['g']},
 {id:'item',group:t('hotkeyActions.item.group'),label:t('hotkeyActions.item.label'),defaults:['h']},
 {id:'skill',group:t('hotkeyActions.skill.group'),label:t('hotkeyActions.skill.label'),defaults:['v']},
 {id:'interact',group:t('hotkeyActions.interact.group'),label:t('hotkeyActions.interact.label'),defaults:['e']},
 {id:'cycleTarget',group:t('hotkeyActions.cycleTarget.group'),label:t('hotkeyActions.cycleTarget.label'),defaults:['Tab']},
 {id:'toggleTargeting',group:t('hotkeyActions.toggleTargeting.group'),label:t('hotkeyActions.toggleTargeting.label'),defaults:['q']},
 {id:'bag',group:t('hotkeyActions.bag.group'),label:t('hotkeyActions.bag.label'),defaults:['b']},
 {id:'weapons',group:t('hotkeyActions.weapons.group'),label:t('hotkeyActions.weapons.label'),defaults:['i']},
 {id:'map',group:t('hotkeyActions.map.group'),label:t('hotkeyActions.map.label'),defaults:['m']},
 {id:'center',group:t('hotkeyActions.center.group'),label:t('hotkeyActions.center.label'),defaults:['c']},
 {id:'zoomIn',group:t('hotkeyActions.zoomIn.group'),label:t('hotkeyActions.zoomIn.label'),defaults:['=']},
 {id:'zoomOut',group:t('hotkeyActions.zoomOut.group'),label:t('hotkeyActions.zoomOut.label'),defaults:['-']},
]);
const IDS=HOTKEY_ACTIONS.map(action=>action.id);
// Which button shows which command's key. The settings button shows the fixed Escape.
export const HOTKEY_BUTTONS=Object.freeze({
 '[data-move="0,-1"]':'moveUp','[data-move="-1,0"]':'moveLeft','[data-move="0,1"]':'moveDown','[data-move="1,0"]':'moveRight',
 '[data-action="wait"]':'wait','[data-action="fire"]':'fire','[data-action="reload"]':'reload','[data-action="grenade"]':'grenade',
 '[data-action="item"]':'item','[data-action="skill"]':'skill','[data-action="interact"]':'interact',
 '[data-action="cycleTarget"]':'cycleTarget','[data-action="toggleTargeting"]':'toggleTargeting','[data-action="bag"]':'bag','[data-action="weapons"]':'weapons',
 '[data-action="map"]':'map','[data-action="center"]':'center','[data-action="zoomIn"]':'zoomIn','[data-action="zoomOut"]':'zoomOut',
 '[data-action="settings"]':'menu',
});

const NAMED=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter','Backspace','Delete','Insert','Home','End','PageUp','PageDown',...Array.from({length:12},(_,i)=>`F${i+1}`)]);
// Letters are stored lower case, so Shift or Caps Lock does not change which command a key runs.
export const normalizeKey=key=>typeof key==='string'&&[...key].length===1?key.toLowerCase():key;
export const validHotkey=key=>typeof key==='string'&&(([...key].length===1&&key.trim()===key)||key===' '||NAMED.has(key));
const LABELS={' ':'Space',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Escape:'Esc',Backspace:'⌫',Delete:'Del',Insert:'Ins',PageUp:'PgUp',PageDown:'PgDn'};
export const keyLabel=key=>!key?'—':LABELS[key]||([...key].length===1?key.toUpperCase():key);

export const defaultBindings=()=>Object.fromEntries(HOTKEY_ACTIONS.map(action=>[action.id,Array.from({length:HOTKEY_SLOTS},(_,i)=>action.defaults[i]??null)]));
// A saved value is trusted only key by key: anything unreadable falls back to the default for that command, and a key
// claimed twice stays with the first command in the list.
export function parseBindings(raw){
 const defaults=defaultBindings();let saved=null;
 try{saved=typeof raw==='string'?JSON.parse(raw):raw;}catch{saved=null;}
 if(!saved||typeof saved!=='object'||Array.isArray(saved))return defaults;
 const out={},taken=new Set();
 for(const id of IDS){
  const slots=Array.isArray(saved[id])&&saved[id].length===HOTKEY_SLOTS?saved[id]:defaults[id];
  out[id]=slots.map(key=>{const k=key===null?null:normalizeKey(key);if(k===null||!validHotkey(k)||taken.has(k))return null;taken.add(k);return k;});
 }
 return out;
}
// Binding a key takes it away from whichever command had it. Returns the new bindings and the commands that lost it.
export function bindKey(bindings,id,slot,key){
 const k=normalizeKey(key);
 if(!IDS.includes(id)||!Number.isInteger(slot)||slot<0||slot>=HOTKEY_SLOTS||!validHotkey(k))return {bindings,displaced:[],error:'這個按鍵不能用。'};
 const next=Object.fromEntries(Object.entries(bindings).map(([action,slots])=>[action,[...slots]])),displaced=[];
 for(const [action,slots] of Object.entries(next))slots.forEach((existing,i)=>{if(existing===k&&!(action===id&&i===slot)){slots[i]=null;if(action!==id)displaced.push(action);}});
 next[id][slot]=k;
 return {bindings:next,displaced,error:''};
}
export function clearKey(bindings,id,slot){
 const next=Object.fromEntries(Object.entries(bindings).map(([action,slots])=>[action,[...slots]]));
 if(next[id]&&slot>=0&&slot<HOTKEY_SLOTS)next[id][slot]=null;
 return next;
}
export function keyLookup(bindings){
 const map=new Map();
 for(const id of IDS)for(const key of bindings[id]||[])if(key&&!map.has(key))map.set(key,id);
 return map;
}
export const actionLabel=id=>HOTKEY_ACTIONS.find(action=>action.id===id)?.label||id;
export const primaryKey=(bindings,id)=>id==='menu'?'Escape':(bindings[id]||[]).find(Boolean)||null;
