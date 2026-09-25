// Ground loot icons (3.154.0; art by Codex and the user, spec in docs/LOOT_ICONS_HANDOFF.md).
// One 128×32 atlas, eight 16×16 columns by two rows. Weapons take row 0 and ammunition row 1 of their ammo type's
// column; the throwables, the ordinary gear and the scrap have one column each. The colours are baked into the art, so
// nothing here tints a cell — except a melee weapon, which has no ammo type (see MELEE below).
// The classification follows the pack (user decision 2026-09-20): PREPARED_CATALOG.grenade is the throwable class, so the
// flare, the decoy and the mine are gear, not throwables, exactly as the pack lists them.
import {MELEE_TINT} from './ammunition.js';
export const LOOT_ATLAS=new URL('../assets/pixel/loot-icons-v1/atlas.png',import.meta.url).href;
// size: how wide the icon is drawn on a full-size tile (38px); it shrinks with itemScale like the old icons did.
// The user tuned both in qa/loot-icon-lab.html on 2026-09-20: 21px, and the atlas itself was re-exported at
// brightness 0.8, saturate 1.4, contrast 1.09, so nothing is filtered at runtime.
// dim (3.177.6, user): the opacity of a ground item you could not take any of right now (Game.canTake).
export const LOOT_ICON=Object.freeze({cell:16,columns:8,rows:2,size:21,dim:.45});

const AMMO_COLUMN=Object.freeze({pistol:0,ammo:1,shell:2,energy:3,ordnance:4});   // ground item type → column
const WEAPON_COLUMN=Object.freeze({pistol:0,rifle:1,shell:2,energy:3,ordnance:4});   // weapon ammoType → column
const THROWN=Object.freeze(['grenade','smoke','emp','stun']);
const GEAR=Object.freeze(['med','armor','spray','adrenaline','barricade','flare','escape_line','redeploy_line','irg','nvg','decoy','mine','exo']);
// Keep their own marks (handoff, 接入範圍 4): the keycard has its beam, the data and the learning chips their own glow.
export const SPECIAL_LOOT=Object.freeze(['key','lore','learning']);

// A melee weapon has no ammo type and the atlas has no cell for it. The pack already shows those weapons in MELEE_TINT,
// so the shared weapon silhouette is recoloured to the same tint; this is the one place a cell is tinted.
export function lootCell(item,weapon=null){
  if(!item||SPECIAL_LOOT.includes(item.type))return null;
  if(item.type==='weapon'){
    if(weapon?.melee)return {col:0,row:0,tint:MELEE_TINT};
    const col=WEAPON_COLUMN[weapon?.ammoType];
    return col===undefined?null:{col,row:0};
  }
  if(AMMO_COLUMN[item.type]!==undefined)return {col:AMMO_COLUMN[item.type],row:1};
  if(THROWN.includes(item.type))return {col:5,row:0};
  if(item.type==='scrap')return {col:7,row:0};
  if(GEAR.includes(item.type))return {col:6,row:0};
  return null;
}

// Tinted cells are cached per colour: one 16×16 canvas, the silhouette kept and its colour shifted over the shading.
const tinted=new WeakMap();   // per source image, so the tuning lab's adjusted copy never reads the shipped atlas' cache
function tintedCell(image,cell){
  let cache=tinted.get(image);if(!cache)tinted.set(image,cache=new Map());
  const key=`${cell.col},${cell.row},${cell.tint}`;let canvas=cache.get(key);
  if(canvas)return canvas;
  const size=LOOT_ICON.cell;canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(image,cell.col*size,cell.row*size,size,size,0,0,size,size);
  c.globalCompositeOperation='source-atop';c.globalAlpha=.62;c.fillStyle=cell.tint;c.fillRect(0,0,size,size);
  cache.set(key,canvas);return canvas;
}

export function drawLootIcon(c,image,cell,a,size){
  // `image` is the atlas, or any canvas holding it: the tuning lab (qa/loot-icon-lab.html) passes an adjusted copy.
  if(!cell||!image||(image.naturalWidth??image.width??0)===0)return false;
  const source=LOOT_ICON.cell,draw=Math.max(4,Math.round(size)),x=Math.round(a.x-draw/2),y=Math.round(a.y-draw/2);
  const smooth=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
  if(cell.tint)c.drawImage(tintedCell(image,cell),0,0,source,source,x,y,draw,draw);
  else c.drawImage(image,cell.col*source,cell.row*source,source,source,x,y,draw,draw);
  c.imageSmoothingEnabled=smooth;return true;
}
