// Grapple lines (3.135.0, user decision 2026-09-18, docs/ITEMS.md): the straight-line move behind the berserker's
// grapple (src/line-move.js), handed to everyone as a dropped item — never a build.
// - 逃命繩索 (escape line): costs no turn; a drop gives one.
// - 重部署鉤索 (redeploy line): costs a turn; a drop gives three.
// - Either pulls you to a floor tile you can see within six tiles, in one straight sweep: walls, solid props and other
//   units stop it, brood do not. One line, one use.
// - Not sold, not upgradeable, and no perk or passive touches it (user: 不該成為 build 的一部份).
// - Any armed enemy may drop one, on a fixed roll of its own so nothing else about the floor shifts.
import {t} from './i18n.js';
import {sweptClear} from './line-move.js';
import {distance} from './world.js';

export const LINE_TUNING=Object.freeze({range:6,dropChance:.04,escapeShare:.5,escapeAmount:1,redeployAmount:3});
export const LINE_ITEMS=Object.freeze({escape_line:{resource:'escapeLines',free:true},redeploy_line:{resource:'redeployLines',free:false}});
export const isLineItem=id=>Object.hasOwn(LINE_ITEMS,id);
export function lineReason(g,arg){
 const p=g.player,item=LINE_ITEMS[arg?.item];
 if(!item)return '沒有這種繩索';
 if(!(p[item.resource]>0))return '繩索已用盡';
 const to={x:arg.x,y:arg.y};
 if(!Number.isInteger(to.x)||!Number.isInteger(to.y)||g.grid[to.y]?.[to.x]!==1)return '先選擇看得見的地板';
 if(distance(p,to)===0)return '選一格你不在的地板';
 if(distance(p,to)>LINE_TUNING.range||!g.visible(to))return t('common.landingRange',{range:LINE_TUNING.range});
 if(!g.passable(to.x,to.y)||!sweptClear(g,p,to))return '繩索的直線被擋住了';
 return '';
}
// A dead armed enemy's line, if any: a fixed roll of the kill itself (not the game's dice), then which kind.
export function lineDrop(seed,floor,id){
 let h=2166136261;for(const ch of `${seed}:${floor}:${id}:line-v1`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 const roll=(h>>>0)/4294967296;if(roll>=LINE_TUNING.dropChance)return null;
 return roll<LINE_TUNING.dropChance*LINE_TUNING.escapeShare?{type:'escape_line',amount:LINE_TUNING.escapeAmount}:{type:'redeploy_line',amount:LINE_TUNING.redeployAmount};
}
// Night-vision goggles from a sniper (3.135.0): the same kind of fixed roll.
export const NVG_DROP=.25;
// Infrared goggles from a squad leader (3.148.0), on a roll of their own.
export const IRG_DROP=.25;
export function infraredDrop(seed,floor,id){
 let h=2166136261;for(const ch of `${seed}:${floor}:${id}:irg-v1`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return (h>>>0)/4294967296<IRG_DROP;
}
export function goggleDrop(seed,floor,id){
 let h=2166136261;for(const ch of `${seed}:${floor}:${id}:nvg-v1`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 return (h>>>0)/4294967296<NVG_DROP;
}
