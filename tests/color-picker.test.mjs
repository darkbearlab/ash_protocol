import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OPERATOR_COLORS,validOperatorColor,operatorColor,hsvToHex,hexToHsv,hsvToRgb,softStop,BRIGHTNESS_STOP,tintPixels} from '../src/operator-color.js';
import {colorPickerMarkup,presetFor} from '../src/color-picker.js';

// 3.140.0 (user decisions 2026-09-19, docs/OPERATOR_COLOR.md): a hue wheel and a brightness slider with a soft stop at
// 40%; the swatches stay and move the cursors to their colour.

test('any colour from the picker is a valid choice, kept as lower-case #rrggbb',()=>{
 assert.ok(validOperatorColor('#12abef'));
 for(const bad of ['#12ABEF','#12abe','12abef','#12abeg','rgb(1,2,3)',42])assert.equal(validOperatorColor(bad),false,String(bad));
 assert.deepEqual(operatorColor('#12abef'),{id:'#12abef',label:'自訂',hex:'#12abef',custom:true});
 for(const c of OPERATOR_COLORS)assert.equal(operatorColor(c.id),c,'presets unchanged');
 const data=new Uint8ClampedArray([90,90,90,255]);tintPixels(data,operatorColor('#12abef').hex);assert.notDeepEqual([...data],[90,90,90,255]);
});

test('HSV round trips within one step, and every preset lands back on its own swatch',()=>{
 for(const [h,s,v] of [[0,100,100],[120,50,40],[240,100,20],[300,10,90],[359,100,100],[45,0,0]]){
  const back=hexToHsv(hsvToHex(h,s,v));assert.ok(Math.abs(back.v-v)<=1,`v ${h},${s},${v}`);
  if(v>=20&&s>=10)assert.ok(Math.min(Math.abs(back.h-h),360-Math.abs(back.h-h))<=2&&Math.abs(back.s-s)<=1,`h/s ${h},${s},${v}`);
 }
 assert.deepEqual(hsvToRgb(0,1,1),[255,0,0]);assert.deepEqual(hsvToRgb(120,1,1),[0,255,0]);assert.deepEqual(hsvToRgb(240,1,1),[0,0,255]);
 for(const c of OPERATOR_COLORS.filter(c=>c.hex)){const {h,s,v}=hexToHsv(c.hex);assert.equal(presetFor(h,s,v),c.id,c.id);}
 assert.equal(presetFor(200,33,50),null);
});

test('the brightness slider stops once at 40%: the next gesture goes past, and it never blocks going up',()=>{
 assert.equal(BRIGHTNESS_STOP,40);
 assert.equal(softStop(70,20),40,'a drag from above stops at the mark');
 assert.equal(softStop(40,20),20,'the next drag, starting at the mark, goes past');
 assert.equal(softStop(41,39),40);assert.equal(softStop(30,10),10,'already below');assert.equal(softStop(20,60),60,'going up');assert.equal(softStop(70,45),45);
});

test('the picker keeps the swatches, starts on the saved colour and carries a custom colour in a hidden radio',()=>{
 const preset=colorPickerMarkup('blue','soldier'),blue=hexToHsv(operatorColor('blue').hex);
 for(const c of OPERATOR_COLORS)assert.ok(preset.includes(`name="operator-color" value="${c.id}"`),c.id);
 assert.ok(preset.includes(`value="blue" aria-label="鈷藍" checked`));
 assert.ok(preset.includes(`data-h="${blue.h}" data-s="${blue.s}" data-v="${blue.v}" data-off="0"`));
 assert.ok(preset.includes('id="operator-value" type="range" min="0" max="100" step="1" value="'+blue.v+'"'));
 assert.ok(preset.includes('class="color-stop"')&&preset.includes('class="color-wheel"'));
 const custom=colorPickerMarkup('#336699','soldier');
 assert.ok(custom.includes('value="#336699" data-custom-color hidden tabindex="-1" aria-hidden="true" checked'));
 assert.ok(!/value="(amber|red|blue|cyan|green|violet|white|none)" aria-label="[^"]+" checked/.test(custom),'no swatch checked for a custom colour');
 assert.ok(colorPickerMarkup('none','soldier').includes('data-off="1"'));
});

test('the deploy screen mounts the picker, the settings stay free of colour controls, and it is cached offline',()=>{
 const source=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8'),sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8'),css=readFileSync(new URL('../expansion.css',import.meta.url),'utf8');
 assert.ok(source.includes("mountColorPicker($('#modal .color-list'),drawOperatorSprites);"));
 assert.ok(source.includes('return colorPickerMarkup(selected,character);'));
 assert.ok(!source.includes('id="operator-tint"')&&!source.includes('id="operator-value"'),'no colour control in the settings; the slider lives in the picker module');
 assert.ok(sw.includes('./src/color-picker.js'));
 assert.ok(css.includes('.color-stop{position:absolute;top:5px;bottom:5px;left:calc(7px + (100% - 14px)*.4)'),'the mark sits at 40% of the thumb travel');
});
