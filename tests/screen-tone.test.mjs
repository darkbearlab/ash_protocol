import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SCREEN_BRIGHTNESS,OPERATOR_TINT,screenBrightnessPercent,operatorTintPercent} from '../src/screen-tone.js';
import {tintPixels,OPERATOR_COLORS} from '../src/operator-color.js';
import {hardenText,TINY_TEXT} from '../src/pixel-text.js';

// 3.116.0 (user requests): screen brightness, operator colour strength, the VHS grain no longer brightening, pixel lettering.
const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('brightness and colour strength settle on their steps and fall back to the original look',()=>{
  assert.equal(screenBrightnessPercent(null),100);assert.equal(screenBrightnessPercent('abc'),100);
  assert.equal(screenBrightnessPercent('40'),SCREEN_BRIGHTNESS.min);assert.equal(screenBrightnessPercent(200),SCREEN_BRIGHTNESS.max);assert.equal(screenBrightnessPercent('87'),85);
  assert.equal(operatorTintPercent(undefined),100);assert.equal(operatorTintPercent(-5),OPERATOR_TINT.min);assert.equal(operatorTintPercent('62'),60);
});

test('colour strength mixes the tinted art back towards the grey, and full strength is the old tint',()=>{
  const hex=OPERATOR_COLORS.find(c=>c.hex).hex,grey=[90,90,90,255];
  const full=new Uint8ClampedArray(grey);tintPixels(full,hex);
  const same=new Uint8ClampedArray(grey);tintPixels(same,hex,1);assert.deepEqual([...same],[...full]);
  const off=new Uint8ClampedArray(grey);tintPixels(off,hex,0);assert.deepEqual([...off],grey);
  const half=new Uint8ClampedArray(grey);tintPixels(half,hex,.5);
  for(let k=0;k<3;k++)assert.ok(Math.abs(half[k]-(90+full[k])/2)<=1,`channel ${k}`);
});

test('the controller, page and styles wire brightness, colour strength and the quieter VHS grain',async()=>{
  const source=await read('../src/controller.js'),html=await read('../index.html'),css=await read('../expansion.css'),colour=await read('../src/operator-color.js');
  assert.ok(source.includes("let screenBrightness=screenBrightnessPercent(read('ash-brightness'));"));
  assert.ok(source.includes("document.documentElement.classList.toggle('toned',screenBrightness!==SCREEN_BRIGHTNESS.initial)"),'nothing is drawn at 100%');
  // 3.139.1 (user, 2026-09-19): the strength slider left the settings while the colour picker is redesigned; the colour
  // is drawn at full strength and the saved strength is not read.
  assert.ok(source.includes('renderer.operatorTint=1;')&&!source.includes("read('ash-operator-tint')")&&!source.includes('id="operator-tint"'));
  // 3.140.0: the previews keep their own cache while the colour wheel is dragged, at the battlefield's strength.
  assert.ok(source.includes('tintedSprite(image,r,color,previewTints.cache,renderer.operatorTint)'),'the deploy preview matches the battlefield');
  assert.ok(colour.includes('const key=`${rect.x},${rect.y},${id},${strength}`;'),'a new strength never reuses a cached tint');
  // 3.118.0: a filter on the app and on the dialog's content, not backdrop-filter layers, which froze still menus in a
  // phone home-screen app (user report).
  assert.ok(css.includes('html.toned :is(.app,.boot-screen,#modal-content){filter:brightness(var(--screen-brightness))}'),'the app, and the dialog content a root filter cannot reach');
  assert.ok(!css.includes('backdrop-filter:brightness')&&!html.includes('tone-layer'),'no backdrop snapshot layer is left');
  const fixed=[...css.matchAll(/([^{}]+)\{[^}]*position:fixed/g)].map(m=>m[1].trim());
  // 3.177.0: the dark shade at the end of a run is appended to <body>, outside the app.
  assert.deepEqual(fixed,['#orientation-guard','body.booting .boot-screen','html.scroll-locked body','html.vhs .vhs-layer','.outro-shade'],'a filter re-anchors fixed-position descendants, so nothing fixed may live inside the app or the dialog content');
  assert.ok(css.includes('0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.7 -.45'),'dark grain specks');
  assert.ok(css.includes('0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.7 -.75'),'and sparse light ones');
  assert.ok(!css.includes("0 0 0 1.7 -.35'"),'the old all-white grain is gone');
});

test('the transmission heading is tiny real text with hard pixels and a one-pixel shadow (3.117.0 correction)',()=>{
  assert.ok(TINY_TEXT.px<=10,'small');assert.match(TINY_TEXT.font,/Plex Mono/,'the game font, not a bitmap face');
  // A 3x2 render: one solid pixel, one half-covered below the cut, one just above it.
  const data=new Uint8ClampedArray(3*2*4);data[3]=255;data[7]=TINY_TEXT.alphaCut-1;data[11]=TINY_TEXT.alphaCut;
  const lit=hardenText(data,3,2,{color:'#f0c27a',shadow:'#3a2412'});
  assert.equal(lit,2);
  assert.deepEqual([...data.slice(0,4)],[240,194,122,255],'covered pixels become solid');
  assert.equal(data[7],0,'faint anti-aliasing is dropped');
  assert.deepEqual([...data.slice(16,20)],[58,36,18,255],'the shadow sits down and right of a lit pixel');
  assert.equal(data[23],0,'a shadow never wraps past the right edge');assert.equal(data[15],0,'nothing below-left');
});
