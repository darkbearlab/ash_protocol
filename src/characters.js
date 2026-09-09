import {grantTrait} from './traits.js';
// Stable IDs. Starter characters are free; no profile currency is spent.
export const CHARACTERS={
  soldier:{name:'Soldier',label:'士兵',text:'利用掩體穩定射擊，持續壓制同一目標。',traits:['braced','correction'],weapons:[0,1]},
  bulwark:{name:'Bulwark',label:'重裝兵',text:'厚重動力裝甲承受火力，以輕機槍壓制、動力拳破陣。普通敵人先行動。',traits:['large','clumsy','slow','heavy_armor'],weapons:[6,7],hp:200,armor:6,plates:30},
  recon:{name:'Recon',label:'偵察兵',text:'橫向移動避開射線，以衝鋒槍快速裝填維持攻勢。',traits:['sidestep','quick_reload'],weapons:[2,1]},
};
export const validCharacter=id=>typeof id==='string'&&Object.hasOwn(CHARACTERS,id);
export const characterName=id=>{const c=CHARACTERS[id]||CHARACTERS.soldier;return `${c.name} · ${c.label}`;};
export function grantCharacterTraits(player){for(const id of CHARACTERS[player.character].traits)if(!player.traits.some(t=>t.id===id&&t.source===`character:${player.character}`))grantTrait(player,id,`character:${player.character}`);}
