import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HOTKEY_ACTIONS,HOTKEY_SLOTS,HOTKEY_BUTTONS,normalizeKey,validHotkey,keyLabel,parseBindings,defaultBindings,bindKey,clearKey,keyLookup,primaryKey} from '../src/hotkeys.js';

// 3.121.0 (user request): keyboard bindings in the settings, and key hints on the main buttons.
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');

test('the defaults keep every key the game already had, and add skill, map, camera and zoom',()=>{
  const lookup=keyLookup(defaultBindings());
  const old={ArrowUp:'moveUp',w:'moveUp',ArrowDown:'moveDown',s:'moveDown',ArrowLeft:'moveLeft',a:'moveLeft',ArrowRight:'moveRight',d:'moveRight',' ':'fire',r:'reload',h:'item',e:'interact',f:'wait','.':'wait',q:'toggleTargeting',Tab:'cycleTarget',g:'grenade',b:'bag'};
  for(const [key,id] of Object.entries(old))assert.equal(lookup.get(key),id,key);
  assert.deepEqual(['v','m','c','=','-'].map(key=>lookup.get(key)),['skill','map','center','zoomIn','zoomOut']);
  assert.equal(new Set(HOTKEY_ACTIONS.flatMap(a=>a.defaults)).size,HOTKEY_ACTIONS.flatMap(a=>a.defaults).length,'no default key is shared');
  assert.ok(HOTKEY_ACTIONS.every(a=>a.defaults.length<=HOTKEY_SLOTS));
});

test('keys: letters ignore Shift, Escape and modifiers cannot be bound, labels are short',()=>{
  assert.equal(normalizeKey('W'),'w');assert.equal(normalizeKey('ArrowUp'),'ArrowUp');
  for(const key of [' ','w','1','.','-','Tab','Enter','F5','ArrowLeft'])assert.ok(validHotkey(key),key);
  for(const key of ['Escape','Shift','Control','Alt','Meta','Dead','Process','','ab',null,undefined,'\t'])assert.ok(!validHotkey(key),String(key));
  assert.deepEqual([' ','ArrowUp','w','Tab',null,'Escape'].map(keyLabel),['Space','↑','W','Tab','—','Esc']);
  assert.equal(primaryKey(defaultBindings(),'menu'),'Escape','the settings button always shows Esc');
});

test('binding a key moves it from the command that had it; clearing leaves the slot empty',()=>{
  let {bindings,displaced,error}=bindKey(defaultBindings(),'fire',1,'W');
  assert.equal(error,'');assert.deepEqual(bindings.fire,[' ','w']);assert.deepEqual(bindings.moveUp,['ArrowUp',null]);assert.deepEqual(displaced,['moveUp']);
  assert.equal(keyLookup(bindings).get('w'),'fire');
  ({bindings,displaced}=bindKey(bindings,'fire',0,'w'));assert.deepEqual(bindings.fire,['w',null],'the same key in the other slot moves too');assert.deepEqual(displaced,[]);
  assert.equal(bindKey(bindings,'fire',0,'Escape').error,'這個按鍵不能用。');
  assert.equal(bindKey(bindings,'nonsense',0,'x').error,'這個按鍵不能用。');assert.equal(bindKey(bindings,'fire',2,'x').error,'這個按鍵不能用。');
  const cleared=clearKey(bindings,'fire',0);assert.deepEqual(cleared.fire,[null,null]);assert.equal(keyLookup(cleared).get('w'),undefined);
  assert.deepEqual(bindings.fire,['w',null],'bindings are never changed in place');
});

test('a saved value is trusted key by key: broken entries fall back, a key claimed twice stays with the first command',()=>{
  assert.deepEqual(parseBindings(null),defaultBindings());assert.deepEqual(parseBindings('{broken'),defaultBindings());assert.deepEqual(parseBindings('[1,2]'),defaultBindings());
  const saved={...defaultBindings(),fire:['x',null],reload:['X','Escape'],wait:'nope',bag:['q',null]};
  const parsed=parseBindings(JSON.stringify(saved));
  assert.deepEqual(parsed.fire,['x',null]);assert.deepEqual(parsed.reload,[null,null],'x is already fire\'s, and Escape is fixed');
  assert.deepEqual(parsed.wait,['f','.'],'an unreadable entry uses its default');
  assert.deepEqual(parsed.toggleTargeting,['q',null]);assert.deepEqual(parsed.bag,[null,null],'q stays with the command listed first');
});

test('the controller runs bindings through the same functions as the buttons and draws hints from attributes',async()=>{
  const source=await read('../src/controller.js'),css=await read('../expansion.css'),html=await read('../index.html');
  assert.ok(source.includes("const key=normalizeKey(e.key),command=key==='Escape'?'menu':hotkeyMap.get(key);"));
  assert.ok(source.includes("if(hotkeyCapture&&$('#modal').open){captureHotkey(e);return;}"),'waiting for a key comes before everything else');
  assert.ok(source.includes("e.preventDefault();HOTKEY_RUN[command]?.();"));
  for(const id of HOTKEY_ACTIONS.map(a=>a.id))assert.ok(new RegExp(`[{,\\s]${id}:\\(\\)=>`).test(source),`${id} runs something`);
  assert.ok(source.includes("case 'zoomIn':zoomBy(.15);break;")&&source.includes("case 'center':centerCamera();break;"),'the map buttons and the keys share one implementation');
  assert.ok(source.includes("write('ash-hotkey-hints',hotkeyHints?'on':'off');applyHotkeyHints();"));
  assert.ok(source.includes("button.dataset.hotkey=keyLabel(key)"));
  assert.ok(css.includes('html.hotkey-hints [data-hotkey]::before{content:attr(data-hotkey);'));
  for(const selector of Object.keys(HOTKEY_BUTTONS))assert.ok(html.includes(selector.slice(1,-1))||selector==='[data-action="interact"]'&&html.includes('id="interact" data-action="interact"'),`${selector} is a real button`);
});
