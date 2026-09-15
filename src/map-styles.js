import {MATERIAL_SELECTION} from './material-selection.js';
const atlas=new URL('../assets/pixel/terrain-v1/atlas.png',import.meta.url).href;
const roles={floor:0,grate:1,toilet:4,sink:5,counter:6,scanner:7,locker:8,bench:9,cover:10,barrel:11,terminal:12,case:13,door:14,partition:15};
const facilityThemes={
  industrial:{atlas,tile:32,columns:4,roles},
  sanitary:{atlas,tile:32,columns:4,roles:{...roles,floor:2}},
  security:{atlas,tile:32,columns:4,roles:{...roles,floor:3}},
  utility:{atlas,tile:32,columns:4,roles:{...roles,floor:1}},
  platform:{atlas,tile:32,columns:4,roles:{...roles,floor:1}},
  dock:{atlas,tile:32,columns:4,roles:{...roles,floor:3}},
  balcony:{atlas,tile:32,columns:4,roles:{...roles,floor:2}}
};

export const KILLHOUSE_ATLAS=new URL('../assets/pixel/killhouse-v1/atlas.png',import.meta.url).href;
export const KILLHOUSE_PROPS_ATLAS=new URL('../assets/pixel/killhouse-v2/atlas.png',import.meta.url).href;
const extraRoles=['partitionFace','partitionCap','lowFace','lowCap','case','barrel','terminal','toilet','sink','counter','scanner','locker','bench','desk','pallet','grate','rover_0','rover_1','shuttle_0','shuttle_1','rover_2','rover_3','shuttle_2','shuttle_3','rover_4','rover_5','shuttle_4','shuttle_5'];
export const MAP_STYLES={facility:{themes:facilityThemes,materials:null,selection:MATERIAL_SELECTION},killhouse:{themes:{industrial:{atlas:KILLHOUSE_ATLAS,tile:32,columns:4,roles:{floor:0,cover:7}}},materials:{floor:0,face:1,cap:2,doorClosed:3,doorBroken:4,doorFrame:5,doorCap:6,cover:7,...Object.fromEntries(extraRoles.map((role,index)=>[role,{index,url:KILLHOUSE_PROPS_ATLAS}]))}}};
export const mapStyle=g=>Object.hasOwn(MAP_STYLES,g?.mapStyle)?g.mapStyle:'facility';
export function styleSprite(style,role){const def=MAP_STYLES[typeof style==='string'?style:mapStyle(style)],entry=def?.materials?.[role],index=typeof entry==='object'?entry.index:entry;return Number.isInteger(index)?{url:entry?.url||def.themes.industrial.atlas,x:index%4*32,y:Math.floor(index/4)*32,size:32}:null;}
export const mapStyleAtlases=()=>[...new Set(Object.values(MAP_STYLES).flatMap(s=>[...Object.values(s.themes).map(t=>t.atlas),...Object.values(s.materials||{}).flatMap(v=>v?.url?[v.url]:[])]))];
