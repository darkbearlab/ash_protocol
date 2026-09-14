// Shared rules/tuning. No RNG or imports: safe for world, saves and UI to consume.
export const MAX_LEVEL=20;
export const ENDLESS_MAX_FLOOR=999;
// Display only (user call, 3.49.1): the UI shows endless runs as "of 666 floors". Not a rule; ENDLESS_MAX_FLOOR is the limit.
export const ENDLESS_DISPLAY_FLOORS=666;
export const PROTOCOL_EVENT_LIMIT=4096;
export const CAP_SUPPLY={meds:2,grenade:2,rifle:24,pistol:24,shell:6};
// Player-facing contents of one cap supply (3.49.1, Claude); names kept local so this module stays import-free.
const SUPPLY_NAMES={meds:'醫療包',grenade:'手榴彈',rifle:'步槍彈',pistol:'手槍彈',shell:'霰彈',energy:'能量電池',ordnance:'發射器榴彈'};
export const capSupplyText=(times=1)=>Object.entries(CAP_SUPPLY).map(([id,n])=>`${SUPPLY_NAMES[id]||id} +${n*times}`).join('、');
export const ENDLESS_TUNING={hpGrowth:.07,damageGrowth:.04,densityEvery:6,densityMax:3,heavyExtra:['brute','sniper','bomber']};
export const isEndless=g=>g.mission?.id==='endless';
export const floorLimit=g=>isEndless(g)?ENDLESS_MAX_FLOOR:6;
export const perkLimit=level=>Math.max(0,Math.min(level,MAX_LEVEL)-1);
export const extraEnemies=floor=>Math.min(ENDLESS_TUNING.densityMax,Math.max(0,Math.ceil((floor-6)/ENDLESS_TUNING.densityEvery)));
export const DIFFICULTY_TUNING={defaultOffset:0,minOffset:-6,maxOffset:60};
export const validDifficultyOffset=n=>Number.isInteger(n)&&n>=DIFFICULTY_TUNING.minOffset&&n<=DIFFICULTY_TUNING.maxOffset;
export const effectiveDepth=(floor,offset=DIFFICULTY_TUNING.defaultOffset)=>Math.max(1,floor+offset);
export const scaleEnemy=(base,floor,kind,offset=0)=>Math.round(base*(1+ENDLESS_TUNING[kind==='hp'?'hpGrowth':'damageGrowth'])**Math.max(0,effectiveDepth(floor,offset)-6));
export function giveCapSupply(g){
  const beforeSupply={resources:Object.fromEntries(['meds','grenades','reserve','pistol','shell','energy','ordnance'].map(k=>[k,g.player[k]])),items:structuredClone(g.items),logs:structuredClone(g.logs)};
  const {meds,...ammo}=CAP_SUPPLY;
  g.player.meds+=meds;g.supplyPack(ammo);
  g.log(`獲得封頂補給（${capSupplyText()}；超量彈藥留在腳下）。`);
  g.effects.push({type:'capSupply',beforeSupply,level:g.player.level,from:{x:g.player.x,y:g.player.y},to:{x:g.player.x,y:g.player.y},damage:0});
}
