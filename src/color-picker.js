// Operator colour picker (3.140.0, user decisions 2026-09-19; docs/OPERATOR_COLOR.md): a hue wheel (hue around the
// circle, saturation growing outwards) and a brightness slider with a soft stop at 40%, above the preset swatches. A
// swatch moves the cursors to its colour so it can be fine-tuned from there. Display only: the choice is a local
// preference like the rest of the operator colour (src/operator-color.js), never part of a save or the rules.
import {OPERATOR_COLORS,DEFAULT_OPERATOR_COLOR,operatorColor,hsvToRgb,hsvToHex,hexToHsv,softStop,BRIGHTNESS_STOP} from './operator-color.js';

// The rounded form of a preset, so a wheel position that lands on a preset selects its swatch again.
const PRESET_HEX=new Map(OPERATOR_COLORS.filter(c=>c.hex).map(c=>{const {h,s,v}=hexToHsv(c.hex);return [hsvToHex(h,s,v),c.id];}));
export const presetFor=(h,s,v)=>PRESET_HEX.get(hsvToHex(h,s,v))||null;

// The fieldset: preview sprite and wheel, brightness slider, readout, swatches (radios named operator-color, plus a
// hidden one carrying a custom colour), note. `selected` is a preset id, 'none' or '#rrggbb'.
export function colorPickerMarkup(selected,character){
  const current=operatorColor(selected),start=hexToHsv(current.hex||operatorColor(DEFAULT_OPERATOR_COLOR).hex),custom=current.custom?current.hex:'';
  return `<fieldset class="term-list color-list" data-h="${start.h}" data-s="${start.s}" data-v="${start.v}" data-off="${current.hex?'0':'1'}"><legend>OPERATOR COLOR · 機體塗裝</legend>`+
   `<div class="color-row"><canvas class="color-preview" data-class-sprite="${character}" data-color-preview width="32" height="32" aria-hidden="true"></canvas>`+
   `<div class="color-wheel-wrap"><canvas class="color-wheel" tabindex="0" aria-label="色輪：左右鍵換色相，上下鍵調彩度" aria-describedby="color-readout"></canvas><i class="color-cursor" aria-hidden="true"></i></div></div>`+
   `<label class="color-value" for="operator-value">明度<span class="color-value-track"><input id="operator-value" type="range" min="0" max="100" step="1" value="${start.v}" aria-describedby="color-readout"><i class="color-stop" aria-hidden="true"></i></span></label>`+
   `<p id="color-readout" class="color-readout" aria-live="polite"></p>`+
   `<div class="color-swatches">${OPERATOR_COLORS.map(c=>`<label class="color-swatch"><input type="radio" name="operator-color" value="${c.id}" aria-label="${c.label}" ${c.id===current.id?'checked':''}><span${c.hex?` style="--swatch:${c.hex}"`:' class="swatch-none"'}></span><small>${c.label}</small></label>`).join('')}`+
   `<input type="radio" name="operator-color" value="${custom||'#000000'}" data-custom-color hidden tabindex="-1" aria-hidden="true" ${custom?'checked':''}></div>`+
   `<p class="color-note">點色票會把色輪和明度移到那個顏色，可以接著微調。只改地圖上的人物與倒地圖像，不影響規則；之後的任務沿用這個顏色。</p></fieldset>`;
}

// Draws the wheel at full brightness, sized to the element and the screen's pixel ratio.
export function paintWheel(canvas){
  const css=canvas.getBoundingClientRect().width||168,size=Math.max(32,Math.round(css*Math.min(3,globalThis.devicePixelRatio||1)));
  canvas.width=canvas.height=size;const c=canvas.getContext('2d'),image=c.createImageData(size,size),d=image.data,R=size/2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=x+.5-R,dy=y+.5-R,dist=Math.hypot(dx,dy);if(dist>R)continue;
    const [r,g,b]=hsvToRgb((Math.atan2(dy,dx)*180/Math.PI+360)%360,Math.min(1,dist/R),1),i=(y*size+x)*4;
    d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=Math.round(255*Math.min(1,R-dist));
  }
  c.putImageData(image,0,0);
}

// Wires one picker. redraw() repaints the sprite previews; it runs at most once a frame while dragging.
export function mountColorPicker(root,redraw){
  if(!root)return;
  const wheel=root.querySelector('.color-wheel'),cursor=root.querySelector('.color-cursor'),slider=root.querySelector('#operator-value'),stop=root.querySelector('.color-stop');
  const readout=root.querySelector('.color-readout'),custom=root.querySelector('input[data-custom-color]');
  let h=Number(root.dataset.h)||0,s=Number(root.dataset.s)||0,v=Number(root.dataset.v)||0,off=root.dataset.off==='1',gesture=null,frame=0;
  const sync=()=>{
    const a=h*Math.PI/180,r=s/100*50;cursor.style.left=`${50+Math.cos(a)*r}%`;cursor.style.top=`${50+Math.sin(a)*r}%`;cursor.style.background=hsvToHex(h,s,v);
    slider.value=String(v);root.style.setProperty('--color-full',hsvToHex(h,s,100));
    root.classList.toggle('color-off',off);root.classList.toggle('color-dim',v<BRIGHTNESS_STOP);
    readout.textContent=off?'原色：不上色。碰色輪或明度就會改用那個顏色。':`色相 ${h}° · 彩度 ${s}% · 明度 ${v}%${v<BRIGHTNESS_STOP?'（低於 40%：暗房裡可能看不清楚）':''}`;
  };
  const repaint=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;redraw();});};
  // The wheel or slider moved: pick the matching swatch, or carry the colour in the hidden custom radio.
  const commit=()=>{
    off=false;const preset=presetFor(h,s,v),radio=preset?root.querySelector(`input[name="operator-color"][value="${preset}"]`):custom;
    if(!preset)custom.value=hsvToHex(h,s,v);radio.checked=true;sync();repaint();
  };
  const pick=e=>{
    const r=wheel.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
    h=Math.round((Math.atan2(dy,dx)*180/Math.PI+360)%360)%360;s=Math.round(Math.min(1,Math.hypot(dx,dy)/(r.width/2))*100);commit();
  };
  wheel.addEventListener('pointerdown',e=>{e.preventDefault();wheel.setPointerCapture?.(e.pointerId);wheel.focus({preventScroll:true});pick(e);});
  wheel.addEventListener('pointermove',e=>{if(wheel.hasPointerCapture?.(e.pointerId))pick(e);});
  wheel.addEventListener('keydown',e=>{
    const step=e.shiftKey?15:5,keys={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,step],ArrowDown:[0,-step]}[e.key];if(!keys)return;
    e.preventDefault();h=(h+keys[0]+360)%360;s=Math.max(0,Math.min(100,s+keys[1]));commit();
  });
  // Brightness: one gesture is a press (or a key press, not its repeats) until release; it may not cross the stop
  // downwards if it began above it.
  slider.addEventListener('pointerdown',()=>{gesture=v;});
  slider.addEventListener('keydown',e=>{if(!e.repeat)gesture=v;});
  for(const type of ['pointerup','pointercancel','keyup','change'])slider.addEventListener(type,()=>{gesture=null;});
  slider.addEventListener('input',()=>{
    const wanted=Number(slider.value),next=softStop(gesture??v,wanted);
    if(next!==wanted){stop.classList.remove('bump');void stop.offsetWidth;stop.classList.add('bump');}
    v=next;commit();
  });
  // A swatch moves the cursors to its colour; 原色 keeps them where they are and greys the picker out.
  root.addEventListener('change',e=>{
    if(e.target.name!=='operator-color'||e.target.hasAttribute('data-custom-color'))return;
    const c=operatorColor(e.target.value);if(c.hex)({h,s,v}=hexToHsv(c.hex));off=!c.hex;sync();
  });
  paintWheel(wheel);sync();
}
