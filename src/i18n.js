// Language table core (3.166.0, docs/TEXT_INVENTORY.md). A player-facing sentence lives in a table under an id and
// is written whole, with named slots: t('common.pickup',{item:'醫療包'}) reads '拾取{item}。' from the table. Code never
// glues words around a slot, so another language can reorder the sentence freely.
//
// Slots: {name} prints the value exactly as a template literal would. {name|one|other} prints a word chosen by count,
// one when the value is 1 and other otherwise: '{n} {n|turn|turns}'. Chinese has no plural and writes {n} alone.
// A sentence whose subject may be the player ("你…") has its own id; English conjugates "You miss" and "It misses"
// differently, so the choice between the two is made in code, not by pasting "你" into a slot.
//
// 3.167.0: Chinese and English. The language is chosen once, when the page loads: data tables resolve their names
// while their modules load, so switching language saves the choice and reloads the page (languageChoice below).
import ZH_TW from './text-zh-tw.js';
import EN from './text-en.js';

const TABLES={'zh-TW':ZH_TW,en:EN};
export const LANGUAGES=Object.freeze(Object.keys(TABLES));
export const LANGUAGE_NAMES=Object.freeze({'zh-TW':'中文',en:'English'});
// Browser QA keeps its own copy of every setting (src/storage.js); this module cannot import storage.js, which imports
// modules that need the table, so it reads the key the same way.
const TEST_MODE=typeof location!=='undefined'&&new URLSearchParams(location.search).get('test')==='1';
export const LANGUAGE_KEY=`${TEST_MODE?'qa-':''}ash-language`;
function initialLanguage(){
 // Node: tests and tools read Chinese unless ASH_LANGUAGE=en asks for English (qa/english-scan.mjs).
 if(typeof document==='undefined')return globalThis.process?.env?.ASH_LANGUAGE==='en'?'en':'zh-TW';
 try{const saved=localStorage.getItem(LANGUAGE_KEY);if(Object.hasOwn(TABLES,saved))return saved;}catch{}
 const preferred=[...(navigator.languages||[]),navigator.language].filter(Boolean);
 return preferred.some(code=>/^zh\b/i.test(code))||!preferred.length?'zh-TW':'en';
}
let current=initialLanguage(),table=TABLES[current];
export const language=()=>current;
export function setLanguage(code){current=Object.hasOwn(TABLES,code)?code:'zh-TW';table=TABLES[current];return current;}
// Saves the choice for the next load. The caller reloads the page.
export function languageChoice(code){
 if(!Object.hasOwn(TABLES,code))return false;
 try{localStorage.setItem(LANGUAGE_KEY,code);return true;}catch{return false;}
}

const SLOT=/\{(\w+)(?:\|([^{}|]*)\|([^{}|]*))?\}/g;
// An unknown slot stays visible as written, so a missing value shows up in the text-identity check instead of vanishing.
export function format(pattern,vars={}){
 return pattern.replace(SLOT,(whole,name,one,other)=>{
  if(!Object.hasOwn(vars,name))return whole;
  const value=vars[name];
  return one===undefined?`${value}`:Number(value)===1?one:other;
 });
}

// A missing id falls back to the Chinese table, then to the id itself.
export function t(id,vars){
 const pattern=table[id]??ZH_TW[id];
 if(pattern===undefined)return id;
 return vars?format(pattern,vars):pattern;
}
export const hasText=id=>Object.hasOwn(ZH_TW,id);
// A reason phrase shown as a sentence: '超出射程' becomes '超出射程。'. The full stop belongs to the language.
export const sentence=text=>t('common.sentence',{text});
// A list in the language's own separator: 、 in Chinese, a comma in English.
export const list=items=>items.join(t('common.listSeparator'));
// Whole sentences placed one after another: Chinese runs them together, English puts a space between them.
export const sentences=(...parts)=>parts.filter(Boolean).join(t('common.sentenceGap'));
