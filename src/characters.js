import {t} from './i18n.js';
import {grantTrait} from './traits.js';
import {PACK_LIMIT,PLATE_CAPACITY} from './data.js';
export const BASE_SUPPLIES={meds:2,grenades:2,smoke:0,emp:0,stun:0,pistol:24,reserve:48,shell:12,energy:18,ordnance:4};
const defaults={hp:100,armor:0,plates:0,weaponCapacity:PACK_LIMIT,plateCapacity:PLATE_CAPACITY};
// Stable IDs. Starter characters are free; no profile currency is spent.
export const CHARACTERS={
  engineer:{...defaults,plates:10,name:'Engineer',label:t('characters.engineer.label'),text:t('characters.engineer.text'),traits:['biological'],weapons:[2,1],skills:['workshop'],prepared:{skill:'workshop'},supplies:{pistol:72,reserve:0}},
  druid:{...defaults,name:'Druid',label:'德魯伊',text:'與伴生獵獸同行。免費指揮位置；相鄰餵養獵獸，投資資源使其成長；死亡後自動重生，換層必定同行。',traits:['biological'],weapons:[0,1],skills:['pet_command'],prepared:{skill:'pet_command'}},
  necromancer:{...defaults,name:'Necromancer',label:'死靈法師',text:'本層倒下過的非機械敵人會定期自動起身為召喚物；技能免費集結，把牠們叫回身邊。',traits:['biological','difficult_healing'],weapons:[2,1],skills:['raise_dead'],prepared:{skill:'raise_dead'}},
  soldier:{...defaults,skills:['early_warning'],prepared:{skill:'early_warning'},combat:{rangedAccuracy:8},plates:10,name:'Soldier',label:t('characters.soldier.label'),text:t('characters.soldier.text'),traits:['biological','braced','correction'],weapons:[0,1]},
  bulwark:{...defaults,name:'Bulwark',label:t('characters.bulwark.label'),text:t('characters.bulwark.text'),traits:['suppression_resistance','biological','large','clumsy','slow','heavy_armor','difficult_healing'],weapons:[6,7],skills:['anchor'],prepared:{skill:'anchor'},hp:200,armor:6,plates:30},
  recon:{...defaults,combat:{rangedEvasion:10},carryBonus:{grenade:2},supplies:{grenades:0,smoke:2,stun:2},skills:['signal_break'],prepared:{grenade:'smoke',skill:'signal_break'},name:'Recon',label:t('characters.recon.label'),text:t('characters.recon.text'),traits:['biological','sidestep','quick_reload','night_vision','infrared','extended_burst','tactical_supply'],weapons:[2,1]},
  berserker:{...defaults,name:'Berserker',label:t('characters.berserker.label'),text:t('characters.berserker.text'),hp:160,armor:3,combat:{rangedAccuracy:-10},traits:['suppression_resistance','biological','poison_resistance','bloodlust','battle_spirit','blade_stash'],weapons:[9,1],skills:['grapple'],prepared:{skill:'grapple'}},
  ninja:{...defaults,name:'Ninja',label:t('characters.ninja.label'),text:t('characters.ninja.text'),combat:{rangedEvasion:10},carryBonus:{grenade:2},traits:['biological','sidestep','night_vision','infrared','ambush','duelist','point_blank','close_throw'],weapons:[10,2],skills:['camouflage'],prepared:{grenade:'smoke',skill:'camouflage'},supplies:{grenades:0,smoke:4,stun:1,decoys:5,mines:5,escapeLines:5,redeployLines:5}},
};
export const validCharacter=id=>typeof id==='string'&&Object.hasOwn(CHARACTERS,id);
export const characterName=id=>{const c=CHARACTERS[id]||CHARACTERS.soldier;return t('characters.nameLine',{name:c.name,label:c.label});};
// `cap` (3.158.0): on load a save may already sit at the trait cap, so re-deriving never pushes it over.
export function grantCharacterTraits(player,cap=Infinity){const own=CHARACTERS[player.character].traits,source=`character:${player.character}`;
 // 3.160.0: a passive the class no longer has (the berserker's 毒無效) leaves with the class source; learned copies stay.
 player.traits=(player.traits||[]).filter(t=>t.source!==source||own.includes(t.id));
 for(const id of own)if(!player.traits.some(t=>t.id===id&&t.source===source)&&player.traits.length<cap)grantTrait(player,id,source);}

export const startingSupplies=id=>({...BASE_SUPPLIES,...CHARACTERS[id]?.supplies});
export const classCarryBonus=(id,type)=>CHARACTERS[id]?.carryBonus?.[type]||0;
