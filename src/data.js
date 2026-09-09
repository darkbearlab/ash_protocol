// Content and balance live here. IDs are persisted in saves: append, never reorder.
export const SIZE = 27;
export const SAVE_VERSION = 10;
export const PACK_LIMIT = 3;
export const PLATE_CAPACITY = 30;
export const SUPPLY_ROOMS={ammo:{name:'彈藥庫',color:'#d9bd7b'},medical:{name:'醫療室',color:'#a9d9ac'},armor:{name:'裝甲庫',color:'#92c4df'}};
export const ENEMY_LOOT={rifleman:{weapon:0,chance:.12,ammo:'ammo'},raider:{weapon:2,chance:.18,ammo:'pistol'},gunner:{weapon:1,chance:.14,ammo:'shell'},sniper:{weapon:3,chance:.2,ammo:'ammo'},drone:{ammo:'energy'},warden:{weapon:4,chance:1,ammo:'energy'},boss:{ammo:'ordnance'}};
export const WEAPONS = [
  { id:'rifle', weaponClass:'rifle', name:'餘燼突擊步槍', type:'ASSAULT RIFLE', code:'AR–09', min:22, max:28, range:7, mag:8, file:'rifle', ammoType:'rifle', desc:'可靠的中距離主力，適合多數交戰。' },
  { id:'shotgun', weaponClass:'shotgun', name:'破門者霰彈槍', type:'COMBAT SHOTGUN', code:'SG–12', min:42, max:54, range:4, mag:4, file:'shotgun', ammoType:'shell', splash:1, desc:'近距離高傷害。目標鄰格受到 45% 濺射傷害。' },
  { id:'smg', weaponClass:'smg', name:'蜂群衝鋒槍', type:'SUBMACHINE GUN', code:'SM–24', min:13, max:17, range:5, mag:18, file:'smg', ammoType:'pistol', burst:2, desc:'每回合射擊兩發。適合清理近距離輕裝敵人。' },
  { id:'sniper', weaponClass:'sniper', name:'寂靜精準步槍', type:'PRECISION RIFLE', code:'SR–07', min:52, max:66, range:10, mag:3, file:'sniper', ammoType:'rifle', pierce:0.7, desc:'長距離單發重擊，穿透 70% 裝甲與掩體減傷。' },
  { id:'plasma', weaponClass:'plasma', name:'極光電漿步槍', type:'PLASMA CARBINE', code:'PL–08', min:35, max:44, range:7, mag:6, file:'plasma', ammoType:'energy', pierce:0.5, desc:'消耗能量電池，穿透 50% 防護並擅長對抗機械。' },
  { id:'launcher', weaponClass:'launcher', name:'日蝕榴彈發射器', type:'GRENADE LAUNCHER', code:'GL–03', min:54, max:64, range:6, mag:2, file:'launcher', ammoType:'ordnance', explosive:true, desc:'爆炸半徑 1 格。無視掩體，會傷害自己與引爆油桶。' },
];
export const FLOORS = ['軌道轉運站','污染冷卻區','軍械封鎖區','生化培養艙','高壓熔爐','深淵反應核心'];
export const FLOOR_INFO = [
  { color:'#a4b484', subtitle:'TRANSIT HUB', text:'轉運站仍有備用物資。熟悉掩體，收集裝備。', hazard:null },
  { color:'#73b8a0', subtitle:'COOLANT WORKS', text:'綠色污染格會造成傷害。保持距離，別踩進毒液。', hazard:'acid' },
  { color:'#cead71', subtitle:'ARMORY LOCKDOWN', text:'擊敗封鎖官才能開啟電梯。軍械箱內有新式武器。', hazard:null, boss:'warden' },
  { color:'#bc89b6', subtitle:'BIO CULTURE', text:'自爆單位會引爆周遭油桶，並留下危險區域。', hazard:'acid' },
  { color:'#de885a', subtitle:'THERMAL FORGE', text:'熔爐地板炙熱。重裝單位與狙擊手守住長廊。', hazard:'fire' },
  { color:'#d56e60', subtitle:'ABYSS CORE', text:'摧毀核心守衛。避開紅色轟炸標記，再啟動撤離。', hazard:'fire', boss:'boss' },
];
export const ENEMY_TYPES = {
  rifleman:{name:'斷訊槍兵',hp:22,damage:17,range:7,armor:0,color:'#9fba81',xp:1,fragile:true,rapid:true,seekCover:true,role:'低耐久、自動步槍連續壓制。先找牆角或掩體，再優先擊殺。'},
  raider:{name:'破口突擊兵',hp:18,damage:21,range:5,armor:0,color:'#d4b185',xp:1,fragile:true,rapid:true,seekCover:true,role:'近距離高傷害、低生命。與槍兵交叉火力，勿停在暴露通道。'},
  crawler:{ name:'裂隙獵犬', hp:32, damage:9, range:1, armor:0, color:'#bd9667', xp:1, role:'接近後蓄勢撕咬。拉開一格即可避開攻擊。' },
  gunner:{ name:'叛變哨兵', hp:42, damage:11, range:6, armor:0, color:'#92a480', xp:1, role:'中距離槍擊。牆壁阻擋射線，掩體可減傷。' },
  drone:{ name:'巡弋無人機', hp:28, damage:9, range:5, armor:0, color:'#85c4c0', xp:1, mechanical:true, role:'可飛越地形傷害與掩體，但無法穿牆。' },
  brute:{ name:'鐵殼破壞者', hp:90, damage:20, range:1, armor:7, color:'#b99573', xp:2, role:'重裝近戰。用狙擊、電漿或爆炸穿透護甲。' },
  sniper:{ name:'盲眼狙擊手', hp:45, damage:23, range:10, armor:1, color:'#b3adcb', xp:2, role:'射程 10 格；瞄準需要兩回合，利用牆角打斷。' },
  bomber:{ name:'孢子自爆體', hp:30, damage:30, range:1, armor:0, color:'#b8bc67', xp:1, role:'死亡或近身蓄勢後爆炸。保持至少 2 格距離。' },
  warden:{ name:'封鎖官', hp:180, damage:19, range:6, armor:5, color:'#d9aa70', xp:4, mechanical:true, role:'軍械區頭目。每次攻擊需要蓄勢，掉落稀有軍械。' },
  boss:{ name:'核心守衛', hp:280, damage:22, range:7, armor:7, color:'#df785f', xp:6, mechanical:true, role:'反應核心頭目。交替槍擊與延遲轟炸，離開紅色標記。' },
};
export const PERKS = [
  {id:'damage',name:'高壓彈藥',text:'武器每發傷害 +6。'},
  {id:'health',name:'生存本能',text:'最大生命 +25，立即回復 40 生命。'},
  {id:'armor',name:'複合裝甲',text:'每次直接受傷減少 3 點。'},
  {id:'med',name:'戰地補給',text:'獲得 2 醫療包、2 手榴彈與分類備彈。'},
  {id:'blast',name:'爆破專家',text:'手榴彈與爆炸武器傷害 +18。'},
  {id:'scavenger',name:'資源回收',text:'之後獲得的廢料 +50%，立即獲得 15 廢料。'},
  {id:'medic',name:'急救訓練',text:'醫療包回復量 +20；立即獲得 1 醫療包。'},
  {id:'hazmat',name:'密封防護',text:'環境與中毒傷害 −5，立即解除中毒。'},
];
export const SUPPLY_NAMES = {ammo:'步槍彈',pistol:'手槍彈',shell:'霰彈',energy:'能量電池',ordnance:'榴彈彈藥',med:'醫療包',armor:'護甲板',grenade:'手榴彈',scrap:'廢料',weapon:'武器箱',lore:'資料片段'};
export const LORE = [
  '最後一班運輸船沒有離港紀錄。有人從內部取消了撤離。',
  '冷卻液樣本呈現活動性。請勿接觸管道內的綠色沉積物。',
  '軍械封鎖由指揮部遠端啟動。授權者的生命訊號已消失三天。',
  '培養槽裡的生物不是入侵者。這裡是牠們的出生地。',
  '反應爐每次脈衝，都會讓失蹤人員的識別器重新亮起。',
  '訊號一直存在。它在等待有人打開那扇門。',
];
