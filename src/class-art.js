// Visual IDs only; never reorder gameplay character or weapon data for atlas layout.
export const CLASS_ART_IDS=['soldier','recon','engineer','druid','necromancer','bulwark','berserker','ninja'];
export const CLASS_ATLAS=new URL('../assets/pixel/classes-v1/atlas.png',import.meta.url).href;
export function classSpriteRect(character,dead=false){
  const found=CLASS_ART_IDS.indexOf(character),index=(found<0?0:found)+(dead?8:0);
  return {x:index%4*32,y:Math.floor(index/4)*32,w:32,h:32};
}
