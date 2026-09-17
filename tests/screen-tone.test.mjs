import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SCREEN_BRIGHTNESS,OPERATOR_TINT,screenBrightnessPercent,operatorTintPercent} from '../src/screen-tone.js';
import {tintPixels,OPERATOR_COLORS} from '../src/operator-color.js';
import {pixelTextLayout,PIXEL_GLYPHS,GLYPH_W,GLYPH_H} from '../src/pixel-text.js';

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
  assert.ok(source.includes("renderer.operatorTint=operatorTintPercent(read('ash-operator-tint'))/100;"));
  assert.ok(source.includes('tintedSprite(image,r,color,renderer.tintCache,renderer.operatorTint)'),'the deploy preview matches the battlefield');
  assert.ok(colour.includes('const key=`${rect.x},${rect.y},${id},${strength}`;'),'a new strength never reuses a cached tint');
  assert.ok(html.includes('<div class="tone-layer" aria-hidden="true"></div><div class="vhs-layer" aria-hidden="true"></div>\n<dialog'),'over the app, under the VHS layer');
  assert.ok(html.includes('<div id="modal-content"></div><div class="tone-layer" aria-hidden="true"></div><div class="vhs-layer"'),'and inside the dialog, which a root filter cannot reach');
  assert.ok(css.includes('backdrop-filter:brightness(var(--screen-brightness))'));
  assert.ok(css.includes('html.toned body:has(#modal[open])>.tone-layer{display:none}'),'never applied twice');
  assert.ok(css.includes('0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1.7 -.45'),'dark grain specks');
  assert.ok(css.includes('0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1.7 -.75'),'and sparse light ones');
  assert.ok(!css.includes("0 0 0 1.7 -.35'"),'the old all-white grain is gone');
});

test('the transmission heading is laid out in the bitmap face',()=>{
  const {width,height,cells}=pixelTextLayout(['INCOMING','TRANSMISSION']);
  assert.equal(width,12*(GLYPH_W+1));assert.equal(height,2*GLYPH_H+3+1);
  for(const ch of 'INCOMINGTRANSMISSION')assert.ok(PIXEL_GLYPHS[ch],ch);
  for(const glyph of Object.values(PIXEL_GLYPHS)){assert.equal(glyph.length,GLYPH_H);assert.ok(glyph.every(row=>row.length===GLYPH_W));}
  assert.ok(cells.every(c=>c.x>=0&&c.x<width-1&&c.y>=0&&c.y<height-1),'the shadow column and row stay free');
  const top=cells.filter(c=>c.y<GLYPH_H),left=Math.min(...top.map(c=>c.x));
  assert.equal(left,Math.floor((71-47)/2),'the shorter line is centred');
  assert.equal(pixelTextLayout(['I?I']).cells.length,pixelTextLayout(['I I']).cells.length,'an unknown character is a gap');
});
