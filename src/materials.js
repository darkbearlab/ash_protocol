// Stable art-review IDs, independent of their approved rendering role.
import {MATERIAL_SELECTION} from './material-selection.js';
export const TERRAIN_ATLAS=new URL('../assets/pixel/terrain-v1/atlas.png',import.meta.url).href;
export const WALL_ATLAS=new URL('../assets/pixel/walls-v1/atlas.png',import.meta.url).href;
const terrainNames=['金屬地板','格柵地板','衛浴地板','門禁地板'];
const wallNames=['裝甲板','鉚接板','混凝土塊','肋板','管線','通風格','警戒面板','設備面板','鋼板','橄欖鋼板','混凝土平板','格柵','線槽','網格','警戒鋼板','分段鋼板'];
export const MATERIALS=Object.fromEntries([...terrainNames.map((name,i)=>['T'+String(i+1).padStart(2,'0'),{name,url:TERRAIN_ATLAS,index:i}]),...wallNames.map((name,i)=>['W'+String(i+1).padStart(2,'0'),{name,url:WALL_ATLAS,index:i}])]);
export function validateSelection(value){
  if(!value||value.version!==1)throw Error('素材設定版本必須為 1。');
  const result={version:1};
  for(const role of ['floor','face','cap']){
    const ids=value[role];if(!Array.isArray(ids)||!ids.length||ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!Object.hasOwn(MATERIALS,id)))throw Error(role+' 至少要選一張，且只能包含不重複的 T01–T04／W01–W16。');
    result[role]=[...ids];
  }
  return result;
}
export function approved(role,preferred,selection=MATERIAL_SELECTION){const ids=selection[role];return ids.includes(preferred)?preferred:ids[0];}
export function materialSprite(id){const m=MATERIALS[id];return m?{id,url:m.url,x:m.index%4*32,y:Math.floor(m.index/4)*32,size:32}:null;}
export {MATERIAL_SELECTION};
