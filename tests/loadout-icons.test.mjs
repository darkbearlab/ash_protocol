import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../src/engine.js';
import {UI_ICONS,iconSvg} from '../src/ui-icons.js';
import {timedStatuses,timedStatusChips} from '../src/status-timers.js';

// 3.193.0 (user): the loadout bar is pixel icons only, the same in every language; the status line is icon chips whose
// words unfold above the bar on a tap.
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('every icon is a clean pixel map, and every icon the status line asks for exists',()=>{
 const source=read('../src/ui-icons.js');
 for(const [,name,body] of source.matchAll(/ ([a-zA-Z]+):\[([^\]]+)\]/g)){const rows=body.split(',').map(r=>r.trim().replace(/'/g,''));assert.ok(rows.every(r=>r.length===rows[0].length&&/^[.#]+$/.test(r)),name);}
 for(const name of UI_ICONS)assert.match(iconSvg(name),/^<svg class="px-icon" viewBox="0 0 \d+ \d+"[^>]*shape-rendering="crispEdges"[^>]*><path fill="currentColor" d="(M\d+ \d+h\d+v1h-\d+z)+"\/><\/svg>$/,name);
 assert.equal(iconSvg('nope'),'');
 const names=(path,pattern)=>[...read(path).matchAll(pattern)].flatMap(m=>m.slice(1).filter(Boolean));
 const asked=[...names('../src/controller.js',/chip\('([a-zA-Z]+)'/g),...names('../src/status-timers.js',/add\('([a-zA-Z]+)'/g),...names('../src/suppression-ui.js',/icon:s\.immobile\?'([a-zA-Z]+)':'([a-zA-Z]+)'/g),...names('../src/melee-ui.js',/icon:'([a-zA-Z]+)'/g)];
 assert.ok(asked.length>25);for(const name of asked)assert.ok(UI_ICONS.includes(name),name);
});

test('the chips carry the same words the text client prints',()=>{
 const g=new Game(3);Object.assign(g.player,{poison:2});g.player.control.disabled=2;g.player.control.immune=1;g.shadowSteps=3;
 const chips=timedStatusChips(g);assert.deepEqual(timedStatuses(g),chips.map(c=>c.text));
 assert.deepEqual(chips.map(c=>[c.icon,c.n,c.tone]),[['steps',3,'good'],['drop',2,'bad'],['bolt',2,'bad'],['shieldCheck',1,'good']]);
});

test('the bar has no words in it: icons, labels for the reader, and a strip that unfolds instead of a dialog',()=>{
 const html=read('../index.html'),bar=html.slice(html.indexOf('<div class="loadout-bar">'),html.indexOf('<div class="control-deck">'));
 assert.doesNotMatch(bar,/data-i18n="/,'no text labels on the buttons');
 for(const action of ['weapons','cycleTarget','toggleTargeting','flashlight','bag'])assert.match(bar,new RegExp(`data-action="${action}" aria-label="[^"]+"[^>]*title="[^"]+"`),action);
 assert.match(html,/<div id="effects-panel" class="effects-panel" role="region"[^>]*hidden><\/div><div class="loadout-bar"><button class="loadout-status" data-effects aria-expanded="false"/);
 const controller=read('../src/controller.js');
 assert.match(controller,/if\(b\.dataset\.effects!==undefined\)\{effectsOpen=!effectsOpen;renderEffects\(\);return;\}/);
 assert.match(controller,/\[\['weapons','list'\],\['cycleTarget','target'\],\['toggleTargeting','eye'\],\['bag','pack'\]\]/);
 const css=read('../expansion.css');assert.match(css,/\.loadout-bar \[data-action="toggleTargeting"\]\[aria-pressed="false"\],\.loadout-bar \[data-action="flashlight"\]\[aria-pressed="false"\]\{color:/,'off is darker');
});
