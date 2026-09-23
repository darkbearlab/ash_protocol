import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {t,format,sentence,setLanguage,language,LANGUAGES} from '../src/i18n.js';
import ZH from '../src/text-zh-tw.js';
import EN from '../src/text-en.js';
import {VOICES as ZH_VOICES,CREATURE as ZH_CREATURE} from '../src/voices-zh-tw.js';
import {VOICES as EN_VOICES,CREATURE as EN_CREATURE} from '../src/voices-en.js';

// 3.166.0 (docs/TEXT_INVENTORY.md step 2): the language table core and the rules that keep sentences whole.
const SRC=new URL('../src/',import.meta.url);
const sources=Object.fromEntries(readdirSync(SRC).filter(f=>f.endsWith('.js')).map(f=>[f,readFileSync(new URL(f,SRC),'utf8')]));
const slots=pattern=>[...pattern.matchAll(/\{(\w+)(?:\|[^{}|]*\|[^{}|]*)?\}/g)].map(m=>m[1]);
// Ids built at run time, with every value they can take.
const DYNAMIC={
 'dir.':['none','e','w','s','n','es','en','ws','wn'],
 'game.stepped.':['acid','acidReal','heat','heatReal'],
 'missions.exit.':['down','up','extract','enter'],
 'manual.class.':['soldier','recon','engineer','bulwark','berserker','ninja'],
 'sceneryFurniture.':['rover.cockpit','rover.part','shuttle.cockpit','shuttle.part'],
};

test('slots print like a template literal, pick a word by count, and stay visible when missing',()=>{
 assert.equal(format('拾取{item} +{n}。',{item:'醫療包',n:2}),'拾取醫療包 +2。');
 assert.equal(format('{n} {n|turn|turns}',{n:1}),'1 turn');
 assert.equal(format('{n} {n|turn|turns}',{n:3}),'3 turns');
 assert.equal(format('{a}{b}',{a:undefined,b:null}),'undefinednull','same as `${undefined}${null}`');
 assert.equal(format('{price}',{price:'$&$1'}),'$&$1','replacement patterns are not interpreted');
 assert.equal(format('{missing} 格',{}),'{missing} 格');
});

test('an unknown id falls back to itself; a phrase becomes a sentence in the language',()=>{
 assert.equal(t('no.such.id'),'no.such.id');
 assert.equal(t('common.pickup',{item:'煙霧彈'}),'拾取煙霧彈。');
 assert.equal(sentence('超出射程'),'超出射程。');
 assert.deepEqual(LANGUAGES,['zh-TW','en']);assert.equal(language(),'zh-TW');
 assert.equal(setLanguage('xx'),'zh-TW','an unknown language keeps Chinese');
});

test('every id the code asks for is in the Chinese table, and every table entry is used',()=>{
 const asked=new Set(),groups=new Set(Object.keys(ZH).map(id=>id.split('.')[0]));
 for(const src of Object.values(sources))for(const m of src.matchAll(/(?<![\w.$])t\(\s*'([^']+)'/g))asked.add(m[1]);
 for(const [prefix,values] of Object.entries(DYNAMIC))for(const v of values)asked.add(prefix+v);
 // Ids chosen by a condition, t(cond?'a':'b'): any quoted string shaped like an id of a table group counts.
 for(const src of Object.values(sources))for(const m of src.matchAll(/'([a-z][\w-]*)\.([A-Za-z][\w.]*)'/g))if(groups.has(m[1]))asked.add(`${m[1]}.${m[2]}`);
 // The static page marks its text with ids (src/localize-dom.js).
 for(const m of readFileSync(new URL('../index.html',import.meta.url),'utf8').matchAll(/data-i18n(?:-aria|-title)?="([^"]+)"/g))asked.add(m[1]);
 const missing=[...asked].filter(id=>!Object.hasOwn(ZH,id));
 assert.deepEqual(missing,[],'ids missing from src/text-zh-tw.js');
 const unused=Object.keys(ZH).filter(id=>!asked.has(id));
 assert.deepEqual(unused,[],'table entries no code asks for');
});

test('every literal call passes each slot its sentence uses',()=>{
 const problems=[];
 for(const [file,src] of Object.entries(sources))for(const m of src.matchAll(/(?<![\w.$])t\('([^']+)'(?:,\{)?/g)){
  const id=m[1],pattern=ZH[id];if(pattern===undefined)continue;
  let keys=[];
  if(m[0].endsWith('{')){
   // the object literal's top-level keys
   let i=m.index+m[0].length,depth=1,part='',parts=[];
   while(depth){const c=src[i++];if('{[('.includes(c))depth++;else if('}])'.includes(c))depth--;if(!depth)break;if(c===','&&depth===1){parts.push(part);part='';}else part+=c;}
   parts.push(part);keys=parts.map(p=>p.trim().split(':')[0].trim()).filter(Boolean);
  }
  for(const slot of slots(pattern))if(!keys.includes(slot))problems.push(`${file}: ${id} needs {${slot}}`);
 }
 assert.deepEqual(problems,[]);
});

test('no rule reads Chinese text to decide what to do',()=>{
 // Comparing a sentence's characters breaks the moment the sentence is translated (3.166.0 removed seven of these).
 const cjk='[\\u4e00-\\u9fff\\u3000-\\u303f\\uff00-\\uffef]';
 const pattern=new RegExp(`(===|!==)\\s*'[^']*${cjk}[^']*'|'[^']*${cjk}[^']*'\\s*(===|!==)|\\.(startsWith|endsWith|includes|indexOf)\\(\\s*'[^']*${cjk}`,'g');
 const shelved=new Set(['pet-growth.js','pet-ui.js','material-review.js']);
 const found=[];
 for(const [file,src] of Object.entries(sources)){
  if(shelved.has(file))continue;
  const code=src.replace(/\/\/.*$/gm,'');
  for(const m of code.matchAll(pattern))found.push(`${file}: ${m[0]}`);
 }
 assert.deepEqual(found,[]);
});

test('the floor exit label and stencil read one exit code',async()=>{
 const {Game}=await import('../src/engine.js');
 const g=new Game(3);
 assert.equal(g.exitKind,'down');assert.equal(g.exitLabel,'下樓');
});

test('the English table covers every sentence with the same slots and no Chinese',()=>{
 const missing=Object.keys(ZH).filter(id=>!Object.hasOwn(EN,id));
 assert.deepEqual(missing,[],'Chinese ids without English');
 assert.deepEqual(Object.keys(EN).filter(id=>!Object.hasOwn(ZH,id)),[],'English ids the Chinese table does not have');
 // English may leave out a slot only where it says the same thing once: the class line would read "Soldier · Soldier"
 // and the kill-house note would repeat the class code under its own name.
 const DROPPED={'characters.nameLine':['name'],'killhouse-ui.noScore':['code']};
 const slotSet=text=>[...new Set(slots(text))].sort();
 const slotMismatch=Object.keys(EN).filter(id=>JSON.stringify(slotSet(EN[id]))!==JSON.stringify(slotSet(ZH[id]).filter(name=>!DROPPED[id]?.includes(name))));
 assert.deepEqual(slotMismatch,[],'English sentences whose slots differ from the Chinese');
 // The language button names both languages on purpose, so either reader can find it.
 const bilingual=new Set(['settings.languageSection','settings.languageLabel']);
 const cjk=/[一-鿿　-〿＀-￯]/;
 assert.deepEqual(Object.keys(EN).filter(id=>!bilingual.has(id)&&cjk.test(EN[id])),[],'English sentences with Chinese in them');
});

test('English voices answer the same cues as the Chinese ones',()=>{
 const gaps=[];
 for(const [voice,cues] of Object.entries(ZH_VOICES)){
  for(const cue of Object.keys(cues))if(!EN_VOICES[voice]?.[cue]?.length)gaps.push(`${voice}.${cue}`);
  for(const cue of Object.keys(EN_VOICES[voice]||{}))if(!cues[cue])gaps.push(`extra ${voice}.${cue}`);
 }
 for(const category of Object.keys(ZH_CREATURE))if(!EN_CREATURE[category]?.length)gaps.push(`creature.${category}`);
 assert.deepEqual(gaps,[]);
});

