import {approved,materialSprite} from './materials.js';
// Semantic roles decouple room/module layout from sprite sheets. Cosmetic only.
const atlas=new URL('../assets/pixel/terrain-v1/atlas.png',import.meta.url).href;
const roles={floor:0,grate:1,toilet:4,sink:5,counter:6,scanner:7,locker:8,bench:9,cover:10,barrel:11,terminal:12,case:13,door:14,partition:15};
export const THEMES={
  industrial:{atlas,tile:32,columns:4,roles},
  sanitary:{atlas,tile:32,columns:4,roles:{...roles,floor:2}},
  security:{atlas,tile:32,columns:4,roles:{...roles,floor:3}},
  utility:{atlas,tile:32,columns:4,roles:{...roles,floor:1}}
};
const moduleTheme={restroom:'sanitary',checkpoint:'security',guardpost:'utility'};
export function themeAt(game,point){
  const m=game.props.find(p=>p.type==='module'&&point.x>=p.x&&point.x<p.x+2&&point.y>=p.y&&point.y<p.y+2);
  const r=game.rooms?.find(r=>point.x>=r.x&&point.x<r.x+r.w&&point.y>=r.y&&point.y<r.y+r.h);
  const id=m?.visualTheme||moduleTheme[m?.theme]||r?.visualTheme||'industrial';
  return Object.hasOwn(THEMES,id)?id:'industrial';
}
export function resolveSprite(theme,role){
  const requested=Object.hasOwn(THEMES,theme)?THEMES[theme]:THEMES.industrial;
  const def=Object.hasOwn(requested.roles,role)?requested:THEMES.industrial,index=def.roles[role];
  if(role==='floor'&&Number.isInteger(index))return materialSprite(approved('floor','T'+String(index+1).padStart(2,'0')));
  return Number.isInteger(index)?{url:def.atlas,x:index%def.columns*def.tile,y:Math.floor(index/def.columns)*def.tile,size:def.tile}:null;
}
