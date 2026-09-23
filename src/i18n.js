// Language table core (3.166.0, docs/TEXT_INVENTORY.md step 2). A player-facing sentence lives in a table under an id and
// is written whole, with named slots: t('common.pickup',{item:'醫療包'}) reads '拾取{item}。' from the table. Code never
// glues words around a slot, so another language can reorder the sentence freely.
//
// Slots: {name} prints the value exactly as a template literal would. {name|one|other} prints a word chosen by count,
// one when the value is 1 and other otherwise: '{n} {n|turn|turns}'. Chinese has no plural and writes {n} alone.
// A sentence whose subject may be the player ("你…") has its own id; English conjugates "You miss" and "It misses"
// differently, so the choice between the two is made in code, not by pasting "你" into a slot.
import ZH_TW from './text-zh-tw.js';

const TABLES={'zh-TW':ZH_TW};
let table=ZH_TW;
export const LANGUAGES=Object.freeze(Object.keys(TABLES));
export const language=()=>Object.keys(TABLES).find(code=>TABLES[code]===table);
export function setLanguage(code){table=TABLES[code]||ZH_TW;return language();}

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
