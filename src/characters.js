import {grantTrait} from './traits.js';
import {PACK_LIMIT,PLATE_CAPACITY} from './data.js';
export const BASE_SUPPLIES={meds:2,grenades:2,smoke:0,emp:0,stun:0,pistol:24,reserve:48,shell:12,energy:18,ordnance:4};
const defaults={hp:100,armor:0,plates:0,weaponCapacity:PACK_LIMIT,plateCapacity:PLATE_CAPACITY};
// Stable IDs. Starter characters are free; no profile currency is spent.
export const CHARACTERS={
  engineer:{...defaults,name:'Engineer',label:'工程師',text:'部署追隨或放置型僚機；共用一台機體，靠近時自己以步槍備彈換彈，受傷收納後以廢料維修，損毀後以廢料生產新機。',traits:['biological'],weapons:[2,1],skills:['drone_follow','drone_sentry'],prepared:{skill:'drone_follow'}},
  druid:{...defaults,name:'Druid',label:'德魯伊',text:'與伴生獵獸同行。免費指揮位置；獵獸倒地後相鄰回收，收納中自行回血並歸隊。',traits:['biological'],weapons:[0,1],skills:['pet_command'],prepared:{skill:'pet_command'}},
  necromancer:{...defaults,name:'Necromancer',label:'死靈法師',text:'本層倒下過的非機械敵人會定期自動起身為召喚物；技能免費集結，把牠們叫回身邊。',traits:['biological','difficult_healing'],weapons:[2,1],skills:['raise_dead'],prepared:{skill:'raise_dead'}},
  soldier:{...defaults,skills:['early_warning'],prepared:{skill:'early_warning'},combat:{rangedAccuracy:8},name:'Soldier',label:'士兵',text:'天生射擊命中 +8，利用掩體穩定壓制同一目標。',traits:['biological','braced','correction'],weapons:[0,1]},
  bulwark:{...defaults,name:'Bulwark',label:'重裝兵',text:'厚重動力裝甲承受火力，以輕機槍壓制、動力拳破陣。普通敵人先行動；可下錨固定位置，在普通與緩速各攻擊一次。',traits:['biological','large','clumsy','slow','heavy_armor','difficult_healing'],weapons:[6,7],skills:['anchor'],prepared:{skill:'anchor'},hp:200,armor:6,plates:30},
  recon:{...defaults,combat:{rangedEvasion:10},carryBonus:{grenade:2},supplies:{grenades:0,smoke:2,emp:2},skills:['signal_break'],prepared:{grenade:'smoke',skill:'signal_break'},name:'Recon',label:'偵察兵',text:'天生射擊迴避 +10、投擲容量 +2，煙霧／EMP 各兩顆；夜視與紅外線支援側身作戰。',traits:['biological','sidestep','quick_reload','night_vision','infrared'],weapons:[2,1]},
  berserker:{...defaults,name:'Berserker',label:'狂戰士',text:'血厚的近戰職業。鉤鎖把敵人拉到身邊，大型與頭目則衝過去，到位後補一刀；近戰吸血，連續斬殺疊減傷，攜帶的近戰武器越多越強。射擊較不準。',hp:160,armor:3,combat:{rangedAccuracy:-10},traits:['biological','bloodlust','battle_spirit','blade_stash'],weapons:[9,1],skills:['grapple'],prepared:{skill:'grapple'}},
  ninja:{...defaults,name:'Ninja',label:'忍者',text:'偵察兵的近戰變體。光學迷彩讓敵人難以命中；目標失能、看不到他或他身在暗處時伏擊加傷，只剩一名敵人看得到他時更難被打中。副武器是精準步槍，投擲容量 +2，開局四顆煙霧彈與一顆震撼彈。',combat:{rangedEvasion:10},carryBonus:{grenade:2},traits:['biological','sidestep','night_vision','ambush','duelist'],weapons:[10,3],skills:['camouflage'],prepared:{grenade:'smoke',skill:'camouflage'},supplies:{grenades:0,smoke:4,stun:1}},
};
export const validCharacter=id=>typeof id==='string'&&Object.hasOwn(CHARACTERS,id);
export const characterName=id=>{const c=CHARACTERS[id]||CHARACTERS.soldier;return `${c.name} · ${c.label}`;};
export function grantCharacterTraits(player){for(const id of CHARACTERS[player.character].traits)if(!player.traits.some(t=>t.id===id&&t.source===`character:${player.character}`))grantTrait(player,id,`character:${player.character}`);}

export const startingSupplies=id=>({...BASE_SUPPLIES,...CHARACTERS[id]?.supplies});
export const classCarryBonus=(id,type)=>CHARACTERS[id]?.carryBonus?.[type]||0;
