import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// 3.115.0 (user request): level-ups open with an incoming transmission, and a VHS filter can cover the whole screen.
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('a level-up shows the transmission first, once per level of a run, and confirming opens the choices',async()=>{
  const source=await read('../src/controller.js');
  assert.ok(source.includes("else if(entered&&game.pendingPerks&&game.status==='playing')showLevelUp();"),'the battle raises the transmission, not the list');
  assert.ok(source.includes('if(game.pendingPerks){showLevelUp();return;}'),'closing a menu with a choice pending comes back to it');
  assert.ok(source.includes('const transmissionKey=()=>`${game.runId}:${game.player.level}`;'),'keyed per run, so a new run at the same level still sees it');
  assert.ok(source.includes("case 'transmission':transmissionSeen=transmissionKey();showPerks();break;"));
  assert.ok(source.includes("drawPixelText(heading,['INCOMING','TRANSMISSION']"),'3.116.0: the heading is pixel lettering');
  assert.ok(source.includes('<span class="visually-hidden">INCOMING TRANSMISSION</span>'),'and still readable by a screen reader');
  assert.ok(source.includes("if($('#modal').open&&$('#modal-content .transmission'))return;"),'a redraw does not restart the card');
  assert.equal((source.match(/showPerks\(\)/g)||[]).length,3,'the list opens only from showLevelUp, the confirm button, and its own definition');
  const css=await read('../expansion.css');
  assert.ok(css.includes('#modal.transmission:not(.title){margin:auto;width:calc(100% - 64px);max-width:252px;height:fit-content;'),'a small centred card sized to its content, not the stretched bottom sheet');
  assert.ok(css.includes('#modal.transmission::backdrop{background:#030607c7;backdrop-filter:blur(2px)'),'3.116.0: a lighter blur and a darker veil');
  assert.ok(css.includes('.transmission-pixels{display:block;margin:0 auto;max-width:100%;image-rendering:pixelated'));
  assert.ok(css.includes('@media (prefers-reduced-motion:reduce){.transmission-title{animation:none}}'),'reduced motion stops the flicker');
});

test('the VHS filter is off by default, remembered, and covers the page and any open dialog',async()=>{
  const source=await read('../src/controller.js');
  assert.ok(source.includes("let vhsFilter=read('ash-vhs')==='on';document.documentElement.classList.toggle('vhs',vhsFilter);"));
  assert.ok(source.includes("write('ash-vhs',vhsFilter?'on':'off')"));
  assert.ok(source.includes('data-modal="vhs"'));
  const html=await read('../index.html');
  assert.ok(html.includes('</section></main></div>\n<div class="tone-layer" aria-hidden="true"></div><div class="vhs-layer" aria-hidden="true"></div>'),'one layer above the app');
  assert.ok(html.includes('<dialog id="modal"><div id="modal-content"></div><div class="tone-layer" aria-hidden="true"></div><div class="vhs-layer" aria-hidden="true"></div></dialog>'),'one inside the dialog, which sits above everything');
  const css=await read('../expansion.css');
  assert.ok(css.includes('.vhs-layer{display:none}'));
  assert.ok(css.includes('pointer-events:none'),'the layer never takes a tap');
  assert.ok(css.includes('html.vhs body:has(#modal[open])>.vhs-layer{display:none}'),'no doubled scanlines under a dialog');
  assert.ok(/prefers-reduced-motion:reduce\)\{html\.vhs \.vhs-layer::before\{animation:none\}/.test(css));
});
