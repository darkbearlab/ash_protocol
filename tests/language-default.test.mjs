import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// 3.199.2 (user, 2026-09-28): the first visit opens in English even in a Chinese browser; a saved choice still wins.
// The language is chosen when src/i18n.js loads, so each case runs in its own process with a stand-in browser.
const firstLanguage=({saved=null,search=''})=>{
 const browser=`globalThis.document={};globalThis.location={search:${JSON.stringify(search)}};
 Object.defineProperty(globalThis,'navigator',{value:{languages:['zh-TW','zh'],language:'zh-TW'},configurable:true});
 const store=new Map(${JSON.stringify(saved?[saved]:[])});globalThis.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)};`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',`${browser}const {language}=await import('./src/i18n.js');console.log(language());`],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
};

test('a first visit opens in English, even in a Chinese browser',()=>{
 assert.equal(firstLanguage({}),'en');
 assert.equal(firstLanguage({search:'?test=1'}),'en');
});
test('a saved language choice wins, in its own storage key',()=>{
 assert.equal(firstLanguage({saved:['ash-language','zh-TW']}),'zh-TW');
 assert.equal(firstLanguage({saved:['qa-ash-language','zh-TW'],search:'?test=1'}),'zh-TW');
 assert.equal(firstLanguage({saved:['ash-language','zh-TW'],search:'?test=1'}),'en','browser QA keeps its own copy');
 assert.equal(firstLanguage({saved:['ash-language','xx']}),'en','an unknown saved value falls back to the default');
});
