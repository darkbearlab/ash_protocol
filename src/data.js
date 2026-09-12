// Content and balance live here. IDs are persisted in saves: append, never reorder.
export const SIZE = 27;
export const SAVE_VERSION = 31;
// Every earlier save version stays loadable (and is backed up before migrating). Derived, so bumping SAVE_VERSION
// can never silently drop the previous one from the list (3.44).
export const LEGACY_SAVE_VERSIONS = Array.from({length: SAVE_VERSION - 1}, (_, i) => i + 1);
export const PACK_LIMIT = 3;
export const PLATE_CAPACITY = 30;
export const SUPPLY_ROOMS={ammo:{name:'彈藥庫',color:'#d9bd7b'},medical:{name:'醫療室',color:'#a9d9ac'},armor:{name:'裝甲庫',color:'#92c4df'}};
export const RARE_ARMORY={weapon:8,minFloor:3,chance:.2};
export const ENEMY_LOOT={rifleman:{weapon:0,chance:.20,ammo:'ammo'},raider:{weapon:2,chance:.18,ammo:'pistol'},gunner:{weapon:1,chance:.14,ammo:'shell'},sniper:{weapon:3,chance:.2,ammo:'ammo'},drone:{ammo:'energy'},brute:{rareWeapon:8,rareChance:.1},warden:{weapon:4,chance:1,ammo:'energy',rareWeapon:8,rareChance:.15},boss:{ammo:'ordnance'}};
export const WEAPONS = [
  { id:'rifle', weaponClass:'rifle', name:'餘燼突擊步槍', type:'ASSAULT RIFLE', code:'AR–09', min:22, max:28, range:7, mag:8, file:'rifle', ammoType:'rifle', desc:'可靠的中距離主力，適合多數交戰。' },
  { id:'shotgun', weaponClass:'shotgun', name:'破門者霰彈槍', type:'COMBAT SHOTGUN', code:'SG–12', min:42, max:54, closeRange:2, closeMin:60, closeMax:72, closeAccuracy:15, range:4, mag:4, file:'shotgun', ammoType:'shell', splash:1, desc:'1–2 格傷害 60–72、命中 +15；更遠傷害 42–54。目標鄰格受到 45% 濺射傷害。' },
  { id:'smg', weaponClass:'smg', name:'蜂群衝鋒槍', type:'SUBMACHINE GUN', code:'SM–24', min:13, max:17, range:5, mag:18, file:'smg', ammoType:'pistol', burst:2, desc:'每回合射擊兩發。適合清理近距離輕裝敵人。' },
  { id:'sniper', weaponClass:'sniper', name:'寂靜精準步槍', type:'PRECISION RIFLE', code:'SR–07', min:52, max:66, range:10, mag:3, file:'sniper', ammoType:'rifle', pierce:0.7, desc:'長距離單發重擊，穿透 70% 裝甲與掩體減傷。' },
  { id:'plasma', weaponClass:'plasma', name:'極光電漿步槍', type:'PLASMA CARBINE', code:'PL–08', min:35, max:44, range:7, mag:6, file:'plasma', ammoType:'energy', pierce:0.5, desc:'消耗能量電池，穿透 50% 防護並擅長對抗機械。' },
  { id:'launcher', weaponClass:'launcher', name:'日蝕榴彈發射器', type:'GRENADE LAUNCHER', code:'GL–03', min:54, max:64, range:6, mag:2, file:'launcher', ammoType:'ordnance', explosive:true, desc:'爆炸半徑 1 格。無視掩體，會傷害自己與引爆油桶。' },
  {id:'lmg',weaponClass:'lmg',name:'堡壘輕機槍',type:'LIGHT MACHINE GUN',code:'LM–30',min:18,max:22,range:7,mag:30,file:'lmg',ammoType:'rifle',burst:3,desc:'使用步槍彈，每次三連發，適合持續壓制。'},
  {id:'powerfist',weaponClass:'melee',name:'震擊動力拳',type:'POWER GAUNTLET',code:'PF–01',min:70,max:90,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,hitChance:99,pierce:.5,desc:'相鄰一格近戰，命中 99%，無限使用、無須裝填。無視掩體，穿透 50% 裝甲。裝甲內建，雙向切換免費；不能拆解或交換，可改裝至 +3。'},
  {id:'thunder',weaponClass:'burst_launcher',name:'雷鳴爆彈槍',type:'BURST GRENADE RIFLE',code:'TB–09',min:24,max:30,range:6,mag:9,file:'thunder',ammoType:'ordnance',burst:3,explosive:true,lootOnly:true,desc:'三連發爆彈，每發命中後爆炸半徑 1 格；會自傷及引爆油桶。使用榴彈彈藥，僅能探索拾取。'},
  {id:'axe',weaponClass:'melee',name:'狂戰斧',type:'BOUND AXE',code:'AX–01',min:44,max:54,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,boundCharacter:'berserker',hitChance:92,pierce:.3,desc:'狂戰士綁定近戰武器，不能拆解或交換。相鄰一格，命中 92%，穿透 30% 裝甲，無限使用。'},
  {id:'katana',weaponClass:'melee',name:'忍刀',type:'BOUND BLADE',code:'KT–01',min:30,max:36,range:1,mag:0,file:'powerfist',ammoType:null,melee:true,locked:true,integrated:true,boundCharacter:'ninja',hitChance:95,desc:'忍者綁定近戰武器，不能拆解或交換。相鄰一格，命中 95%，無限使用。'},
];
export const FLOORS = ['軌道轉運站','污染冷卻區','軍械封鎖區','生化培養艙','高壓熔爐','深淵反應核心'];
export const FLOOR_INFO = [
  { color:'#a4b484', subtitle:'TRANSIT HUB', text:'轉運站仍有備用物資。熟悉掩體，收集裝備。', hazard:null },
  { color:'#73b8a0', subtitle:'COOLANT WORKS', text:'綠色污染格會造成傷害。保持距離，別踩進毒液。', hazard:'acid' },
  { color:'#cead71', subtitle:'ARMORY LOCKDOWN', text:'擊敗封鎖官才能開啟電梯。軍械箱內有新式武器。', hazard:null, boss:'warden' },
  { color:'#bc89b6', subtitle:'BIO CULTURE', text:'自爆單位會引爆周遭油桶；地面散布綠色毒液。', hazard:'acid' },
  { color:'#de885a', subtitle:'THERMAL FORGE', text:'熔爐地板炙熱。重裝單位與狙擊手守住長廊。', hazard:'fire' },
  { color:'#d56e60', subtitle:'ABYSS CORE', text:'摧毀核心守衛。避開紅色轟炸標記，再啟動撤離。', hazard:'fire', boss:'boss' },
];
export function floorInfo(floor){const index=((floor-1)%FLOORS.length+FLOORS.length)%FLOORS.length;return {...FLOOR_INFO[index],name:FLOORS[index],cycleFloor:index+1,weapon:[2,3,4,5,3,4][index]};}
export const ENEMY_TYPES = {
  rifleman:{name:'斷訊槍兵',hp:22,damage:17,range:7,armor:0,color:'#9fba81',xp:1,fragile:true,rapid:true,seekCover:true,role:'低耐久、自動步槍連續壓制。先找牆角或掩體，再優先擊殺。'},
  raider:{name:'破口突擊兵',hp:18,damage:21,range:5,armor:0,color:'#d4b185',xp:1,fragile:true,rapid:true,seekCover:true,role:'近距離高傷害、低生命。與槍兵交叉火力，勿停在暴露通道。'},
  crawler:{ name:'裂隙獵犬', hp:32, damage:9, range:1, armor:0, color:'#bd9667', xp:1, role:'接近後蓄勢撕咬。拉開一格即可避開攻擊。' },
  gunner:{ name:'叛變哨兵', hp:42, damage:11, range:6, armor:0, color:'#92a480', xp:1, role:'中距離槍擊。牆壁阻擋射線，掩體可減傷。' },
  drone:{ name:'巡弋無人機', hp:28, damage:9, range:5, armor:0, color:'#85c4c0', xp:1, mechanical:true, role:'可飛越地形傷害與掩體，但無法穿牆。' },
  brute:{ name:'鐵殼破壞者', hp:90, damage:20, range:1, armor:7, color:'#b99573', xp:2, role:'重裝近戰。用狙擊、電漿或爆炸穿透護甲。' },
  sniper:{ name:'盲眼狙擊手', hp:45, damage:23, range:10, armor:1, color:'#b3adcb', xp:2, role:'具夜視，忽略暗區懲罰；射程 10 格，瞄準需要兩回合。' },
  bomber:{ name:'孢子自爆體', hp:30, damage:30, range:1, armor:0, color:'#b8bc67', xp:1, role:'死亡或近身蓄勢後爆炸。保持至少 2 格距離。' },
  warden:{ name:'封鎖官', hp:180, damage:19, range:6, armor:5, color:'#d9aa70', xp:4, mechanical:true, role:'具紅外線可穿煙，但也怕震撼彈。攻擊需蓄勢，掉落稀有軍械。' },
  boss:{ name:'核心守衛', hp:280, damage:22, range:7, armor:7, color:'#df785f', xp:6, mechanical:true, role:'反應核心頭目。交替槍擊與延遲轟炸，離開紅色標記。' },
};
// Stable IDs; append content without changing saved offers. null cap means consumable reward.
export const PERKS = [
  {id:'damage',name:'武器增幅',cap:3,effect:'weapon',amount:6,text:'每次完整武器攻擊傷害合計 +6，連發分攤；每次近戰 +6。'},
  {id:'health',name:'生存本能',cap:3,effect:'health',amount:25,heal:40,text:'最大生命 +25，立即回復 40 生命。'},
  {id:'armor',name:'複合裝甲',cap:3,effect:'stat',stat:'armor',amount:3,text:'每次直接受傷減少 3 點。'},
  {id:'med',name:'戰地補給',cap:null,effect:'supply',text:'獲得 2 醫療包、2 手榴彈與分類備彈；超量彈藥留在腳下。'},
  {id:'blast',name:'爆破專家',cap:3,effect:'stat',stat:'blastBonus',amount:18,text:'破片手榴彈與爆炸武器傷害 +18。'},
  {id:'scavenger',name:'資源回收',cap:3,effect:'scavenger',amount:1,text:'擊殺與撿到的廢料 +50%，立即獲得 15 廢料。'},
  {id:'medic',name:'急救訓練',cap:3,effect:'medic',amount:20,text:'醫療包回復量 +20；立即獲得 1 醫療包。'},
  {id:'hazmat',name:'密封防護',cap:3,effect:'hazmat',amount:5,text:'環境與中毒傷害 −5，立即解除中毒；第 3 階免疫現有環境傷害。'},
  {id:'accuracy',name:'精準射擊',cap:3,effect:'combat',stats:['rangedAccuracy'],amount:8,text:'射擊命中 +8 個百分點。'},
  {id:'evasion',name:'戰術閃避',cap:3,effect:'combat',stats:['rangedEvasion'],amount:8,text:'被射擊命中 −8 個百分點。'},
  {id:'melee',name:'格鬥訓練',cap:3,effect:'combat',stats:['meleeAccuracy','meleeEvasion'],amount:8,text:'近戰命中與近戰迴避各 +8 個百分點。'},
  {id:'plating',name:'裝甲回收',cap:3,effect:'plating',amount:10,text:'有裝甲的敵人掉落護甲板的機率 +15 個百分點（基礎 20%），一般敵人也有 6% 機率掉落 5 點；立即獲得 10 護甲板。'},
  {id:'bulwark_plating',name:'板甲護持',characters:['bulwark'],cap:3,effect:'passive',text:'護甲板還有剩時，直接傷害額外 −8%；每階累加。'},
  {id:'bulwark_recovery',name:'板材回收',characters:['bulwark'],cap:3,effect:'passive',text:'敵人掉落護甲板機率 +15 個百分點、每份 +5 點；可與裝甲回收疊加。'},
  {id:'bulwark_anchor',name:'下錨強化',characters:['bulwark'],cap:3,effect:'passive',text:'下錨中受到的直接傷害 −10%；第 3 階解除下錨不耗回合。'},
  {id:'berserker_fury',name:'狂怒堆疊',characters:['berserker'],cap:3,effect:'passive',text:'戰意層數上限 +1。'},
  {id:'berserker_endure',name:'血怒不退',characters:['berserker'],cap:3,effect:'passive',text:'戰意開始衰減的延遲 +2 回合、每層衰減間隔 +1 回合。'},
  {id:'berserker_thirst',name:'嗜血狂歡',characters:['berserker'],cap:3,effect:'passive',text:'近戰吸血 +8 個百分點（基礎 20%）。'},
  {id:'necro_horde',name:'群葬',characters:['necromancer'],cap:3,effect:'passive',text:'同時存在的召喚物上限 +1（基礎 3）。'},
  {id:'necro_haste',name:'速葬',characters:['necromancer'],cap:3,effect:'passive',text:'自動起身間隔 −1 次付費行動（基礎 4，下限 1）；目前倒數同步縮短。'},
  {id:'necro_blades',name:'亡者利刃',characters:['necromancer'],cap:3,effect:'passive',text:'所有召喚物的近戰與射擊傷害 +4；不增加耐久。'},
  {id:'engineer_salvage',name:'戰場回收',characters:['engineer'],cap:3,effect:'passive',text:'每次擊殺額外 +2 廢料；立即獲得 15 廢料。'},
  {id:'engineer_frame',name:'機體強化',characters:['engineer'],cap:3,effect:'passive',text:'無人機最大生命 +20、裝甲 +1。已有機體立即增加上限，不直接修復。'},
  {id:'engineer_firecontrol',name:'火控校準',characters:['engineer'],cap:3,effect:'passive',text:'無人機射擊命中 +8 個百分點、傷害 +3。'},
  {id:'druid_beast',name:'獵獸體質',characters:['druid'],cap:3,effect:'passive',text:'寵物最大生命 +25、收納時每回合額外回復 3。'},
  {id:'druid_claws',name:'獵獸利爪',characters:['druid'],cap:3,effect:'passive',text:'寵物傷害 +4、近戰命中 +5 個百分點。'},
  {id:'druid_symbiosis',name:'共生',characters:['druid'],cap:3,effect:'passive',text:'寵物每次擊殺敵人，你回復 4 生命；每階累加。'},
];
export const SUPPLY_NAMES = {ammo:'步槍彈',pistol:'手槍彈',shell:'霰彈',energy:'能量電池',ordnance:'榴彈彈藥',med:'醫療包',armor:'護甲板',grenade:'破片手榴彈',smoke:'煙霧彈',emp:'EMP 彈',stun:'震撼彈',scrap:'廢料',weapon:'武器箱',lore:'資料片段'};
export const LORE = [
  '最後一班運輸船沒有離港紀錄。有人從內部取消了撤離。',
  '冷卻液樣本呈現活動性。請勿接觸管道內的綠色沉積物。',
  '軍械封鎖由指揮部遠端啟動。授權者的生命訊號已消失三天。',
  '培養槽裡的生物不是入侵者。這裡是牠們的出生地。',
  '反應爐每次脈衝，都會讓失蹤人員的識別器重新亮起。',
  '訊號一直存在。它在等待有人打開那扇門。',
];
