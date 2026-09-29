// Fire and smoke sprites (3.202.0, user 2026-09-29): Codex draws them from docs/FX_SPRITES_BRIEF.md, and without them the
// game keeps drawing the procedural versions it always had. A sheet is used only once it is listed in FX_SHEETS and has
// loaded, and while FX_SPRITES is on: turned off, missing or broken, every cloud, vent and flame is drawn by code as before.
export const FX_SPRITES=true;
// name → {src (relative to this module), cell, frames, rows: {kind: row}}. 3.202.0: Codex's first set arrived
// (docs/FX_SPRITES_HANDOFF.md); smoke, the vent grates and the fixed fire are drawn from it, the flame burst and the
// ground flamethrower wait for 3.203.0.
const FX_DIR='../assets/pixel/fx-v1/';
export const FX_SHEETS=Object.freeze({
 smoke:Object.freeze({src:FX_DIR+'smoke.png',cell:32,frames:4,rows:Object.freeze({smoke:0,haze:1,steam:2,toxic:3,spore:4})}),
 vent:Object.freeze({src:FX_DIR+'vent.png',cell:32,frames:5,rows:Object.freeze({smoke:0,haze:1,steam:2,toxic:3})}),
 fire:Object.freeze({src:FX_DIR+'fire.png',cell:32,frames:4,rows:Object.freeze({ignite:0,steady:1,embers:2})}),
});
// Smoke as one field (3.202.0, user 2026-09-29; art/smoke-field-v1): a large wrap-around texture per kind, not a sprite
// per tile. The renderer shows each cloud tile the part of the texture under its map position and feathers only the
// cloud's outer edge (src/renderer.js cloudField). Two qualities, picked in the settings (user: keep both):
// - 'layers' (default): layers.png, the five kinds' 256px textures side by side, stacked three times at run time;
// - 'baked': baked-<kind>.png, the same stack composited ahead of time into one texture per kind, drawn once.
// Until a texture has loaded, clouds fall back to the per-tile `smoke` sheet above, then to the procedural drawing.
const FIELD_DIR='../assets/pixel/smoke-field-v1/',FIELD_KINDS=Object.freeze(['smoke','haze','steam','toxic','spore']);
export const SMOKE_QUALITIES=Object.freeze(['layers','baked']);
export const smokeQuality=value=>value==='baked'?'baked':'layers';
export const FX_FIELD=Object.freeze({size:256,kinds:FIELD_KINDS,layers:FIELD_DIR+'layers.png',baked:Object.freeze(Object.fromEntries(FIELD_KINDS.map(k=>[k,FIELD_DIR+`baked-${k}.png`])))});
export const FIELD_FILES=Object.freeze(['layers.png',...FIELD_KINDS.map(k=>`baked-${k}.png`)].map(f=>'./assets/pixel/smoke-field-v1/'+f));
const fieldImages=new Map(),fields=new Map();
function fieldImage(src){
 const url=new URL(src,import.meta.url).href;let img=fieldImages.get(url);
 if(!img){img=new Image();img.src=url;fieldImages.set(url,img);}
 return img.complete&&img.naturalWidth?img:null;
}
// True once a quality's file for this kind has failed to load (the renderer then tries the other quality).
export function fxFieldFailed(kind,quality='layers'){
 const img=fieldImages.get(new URL(quality==='baked'?FX_FIELD.baked[kind]||'':FX_FIELD.layers,import.meta.url).href);
 return Boolean(img?.complete&&!img.naturalWidth);
}
// One kind's texture for one quality, padded by a tile of its own wrapped edge so any 32px window starting inside it
// is cut in one draw; null until it has loaded.
export function fxField(kind,quality='layers'){
 const col=FIELD_KINDS.indexOf(kind);
 if(!FX_SPRITES||col<0||typeof Image==='undefined'||typeof document==='undefined')return null;
 const key=quality+':'+kind;let tile=fields.get(key);if(tile)return tile;
 const img=fieldImage(quality==='baked'?FX_FIELD.baked[kind]:FX_FIELD.layers),n=FX_FIELD.size,sx=quality==='baked'?0:col*n;
 if(!img||img.naturalWidth<sx+n||img.naturalHeight<n)return null;
 tile=document.createElement('canvas');tile.width=tile.height=n+32;const tc=tile.getContext('2d');
 for(const [x,y] of [[0,0],[n,0],[0,n],[n,n]])tc.drawImage(img,sx,0,n,n,x,y,n,n);
 fields.set(key,tile);return tile;
}
// The offline cache lists these (sw.js); previews, the GIF and the sources in art/fx-v1 stay out.
export const FX_FILES=Object.freeze(['fire.png','smoke.png','vent.png','flame-burst.png','loot-flamer.png'].map(f=>'./assets/pixel/fx-v1/'+f));
// How opaque each cloud is drawn over the floor (the sheets have hard alpha; the brief, section 3).
export const FX_SMOKE_ALPHA=Object.freeze({smoke:.85,haze:.5,steam:.6,toxic:.55,spore:.6});
const images=new Map();
export function fxSheet(name){
 const sheet=FX_SPRITES&&FX_SHEETS[name];
 if(!sheet||typeof Image==='undefined')return null;
 let img=images.get(name);
 if(!img){img=new Image();img.src=new URL(sheet.src,import.meta.url).href;images.set(name,img);}
 return img.complete&&img.naturalWidth?{img,...sheet}:null;
}
// Six frames a second; neighbouring tiles start on different frames so a cloud does not pulse as one block.
export const fxFrame=(time,x,y,frames=4,fps=6)=>(Math.floor(time*fps/1000)+x*3+y*5)%frames;
