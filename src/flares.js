import {t} from './i18n.js';
import {distance,lineOfSight} from './world.js';
import {objectSightGrid} from './scenery.js';
import {coverEffects} from './cover.js';

// Flares (3.123.0; user decisions of 2026-09-17, docs/ITEMS.md 照明彈). A consumable item thrown like a grenade. For
// its duration, dark tiles near it count as lit, so anyone standing there, player or enemy, loses the dark tile's
// −40 to be hit. Player only for now.
// A tile is lit when all three hold, judged with the flare as if it were a shooter:
// - within the radius (Manhattan, like every thrown area);
// - the flare can see it: walls and closed doors cast shadows, exactly as a blast's area is traced;
// - it does not get FULL cover from the flare (under 45°, docs/COVER_RULES.md). Half cover is lit, and what kind of
//   cover it is does not matter (user decision).
// Cover is judged live, so a destroyed crate or an opened door lets the light in at once.
export const FLARE_TUNING=Object.freeze({range:5,radius:3,duration:8,maxActive:16});

export function flareLights(game,flare,point){
  if(!flare||!point||distance(flare,point)>FLARE_TUNING.radius)return false;
  if(game.grid?.[point.y]?.[point.x]!==1)return false;
  if(!lineOfSight(objectSightGrid(game,flare,point),flare,point,game.barriers||[],'blast'))return false;
  const target={x:point.x,y:point.y},source={x:flare.x,y:flare.y};
  const cover=typeof game.protectingCover==='function'?game.protectingCover(target,source):null;
  return coverEffects(cover,target,source).efficiency<1;
}
// Every tile a flare at `center` would light now; used for the aiming preview and tests.
export function flareCells(game,center){
  const cells=[],r=FLARE_TUNING.radius;
  for(let y=center.y-r;y<=center.y+r;y++)for(let x=center.x-r;x<=center.x+r;x++)if(flareLights(game,center,{x,y}))cells.push({x,y});
  return cells;
}
export function flareReason(game,pos){
  const p=game.player;
  if(!(p.flares>0))return '沒有照明彈';
  if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||game.grid[pos.y]?.[pos.x]!==1)return '先選擇可見地板作為落點';
  if(distance(p,pos)>FLARE_TUNING.range||!game.visible(pos))return t('common.landingRange',{range:FLARE_TUNING.range});
  return '';
}
export const validFlares=(flares,grid,turn)=>Array.isArray(flares)&&flares.length<=FLARE_TUNING.maxActive&&flares.every(f=>f&&Number.isInteger(f.x)&&Number.isInteger(f.y)&&grid[f.y]?.[f.x]===1&&Number.isInteger(f.expires)&&f.expires>turn&&f.expires<=turn+FLARE_TUNING.duration-1);
