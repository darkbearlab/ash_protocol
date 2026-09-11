// Endless difficulty wall estimate (3.49.1, Claude). Closed form, no RNG, no browser storage.
// Run: node qa/endless-limit.mjs [hp=0.06] [dmg=0.04] [density=3]
// Arguments override ENDLESS_TUNING for this run only, to see where the wall moves before changing the real constants.
//
// Question: from which floor can a capped (LV20, 19 picks) build no longer expect to advance?
// Model (every assumption leans toward the player, so the floors are optimistic):
// - Builds at the cap, all defensive picks taken, plus 30 armour plates counted as extra HP.
// - Damage intake follows Game.damagePlayer: cover (−45%) → armour (min 1) → berserker blade/spirit → heavy armour.
// - To advance you fight through ROUTE_ROOMS rooms of regular enemies, one enemy at a time; every living enemy in
//   the room attacks every second turn; full heal between rooms. Boss floors add the boss fight: warden fires every
//   2nd turn, core guardian every 3rd; boss-summoned drones ignored.
// - Enemy hit chance is the rule floor 10% (perfect cover/evasion) or a more typical 25%.
// - Strictly, nothing becomes impossible: the 10% floor means any shot can miss and melee never runs out.
//   So the "wall" is the first floor where the chance to clear it drops below 1%.
import {ENEMY_TYPES} from '../src/data.js';
import {scaleEnemy,extraEnemies,ENDLESS_TUNING} from '../src/endless.js';

const ROUTE_ROOMS=3;
for(const arg of process.argv.slice(2)){const [k,v]=arg.split('=');const key={hp:'hpGrowth',dmg:'damageGrowth',density:'densityMax'}[k];if(key&&Number.isFinite(Number(v)))ENDLESS_TUNING[key]=Number(v);}
const hpOf=(type,f)=>{const d=ENEMY_TYPES[type],boss=type==='boss'||type==='warden';return scaleEnemy(d.hp+(boss?0:Math.max(0,f-2)*(d.fragile?2:4)),f,'hp');};
const hitOf=(type,f)=>scaleEnemy(ENEMY_TYPES[type].damage+f*2,f,'damage');
const BUILDS=[
 {id:'一般職業',hp:175,armor:9,mult:1,heavy:false,dps:92,note:'精準步槍 +3 改裝、武器增幅 3 階，每回合約 92'},
 {id:'狂戰士',hp:235,armor:12,mult:.675,heavy:false,dps:90,note:'斧頭約 90；刃藏 ×0.9、戰意滿層 ×0.75'},
 {id:'重裝兵',hp:275,armor:15,mult:1,heavy:true,dps:220,note:'下錨動力拳兩擊約 220；重裝防護 ×0.75'},
];
const intake=(b,raw,cover)=>{let d=raw*(cover?.55:1);d=Math.max(1,Math.round(d-b.armor));d=Math.max(1,Math.ceil(d*b.mult));if(b.heavy)d=Math.ceil(d*.75);return d;};
const hitsToDie=(b,raw,cover)=>Math.ceil((b.hp+30)/intake(b,raw,cover));
const survive=(n,k,p)=>{let s=0,c=1;for(let i=0;i<k&&i<=n;i++){s+=c*p**i*(1-p)**(n-i);c=c*(n-i)/(i+1);}return Math.min(1,s);};
const POOL=['rifleman','rifleman','raider','raider','gunner','drone','brute','sniper','bomber',...ENDLESS_TUNING.heavyExtra];
const meanHP=f=>POOL.reduce((a,t)=>a+hpOf(t,f),0)/POOL.length;
// Bombers explode once instead of attacking every second turn, so they are left out of the average hit.
const attackers=POOL.filter(t=>t!=='bomber');
const meanHit=f=>attackers.reduce((a,t)=>a+hitOf(t,f),0)/attackers.length;
const roomShots=(n,s)=>{let shots=0;for(let alive=n;alive>0;alive--)shots+=alive*s/2;return Math.round(shots);};
function bossChance(b,f,p){const cyc=((f-1)%6)+1;if(cyc!==3&&cyc!==6)return 1;const type=cyc===3?'warden':'boss',turns=Math.ceil(hpOf(type,f)/b.dps);return survive(Math.floor(turns/(type==='warden'?2:3)),hitsToDie(b,hitOf(type,f),true),p);}
function clearChance(b,f,p){const n=Math.round(3+extraEnemies(f)+.45),s=Math.max(1,Math.ceil(meanHP(f)/b.dps));return survive(roomShots(n,s),hitsToDie(b,meanHit(f),true),p)**ROUTE_ROOMS*bossChance(b,f,p);}
const firstBelow=(b,p,limit)=>{for(let f=7;f<=200;f++)if(clearChance(b,f,p)<limit)return f;return null;};
const oneShot=(b,cover)=>{for(let f=7;f<=200;f++)if(hitsToDie(b,hitOf('rifleman',f),cover)===1)return f;return null;};

console.log(`ENDLESS_TUNING hp ×${1+ENDLESS_TUNING.hpGrowth}/層、攻擊 ×${1+ENDLESS_TUNING.damageGrowth}/層、密度每 ${ENDLESS_TUNING.densityEvery} 層 +1（上限 +${ENDLESS_TUNING.densityMax}）`);
console.log('職業 | 通過率<50%（命中25% / 10%） | 通過率<1%（25% / 10%） | 步槍兵一槍斃命（開闊 / 掩體）');
for(const b of BUILDS)console.log(`${b.id} | ${firstBelow(b,.25,.5)} / ${firstBelow(b,.1,.5)} | ${firstBelow(b,.25,.01)} / ${firstBelow(b,.1,.01)} | ${oneShot(b,false)} / ${oneShot(b,true)}   (${b.note})`);
console.log('\n一般職業逐層（命中 10% / 25%）：');
for(let f=9;f<=36;f+=3){const b=BUILDS[0],n=Math.round(3+extraEnemies(f)+.45),s=Math.max(1,Math.ceil(meanHP(f)/b.dps));
 console.log(`F${f}: 平均生命 ${Math.round(meanHP(f))}、每名 ${s} 回合、每房 ${n} 名約 ${roomShots(n,s)} 發、${hitsToDie(b,meanHit(f),true)} 發致死 → ${(clearChance(b,f,.1)*100).toFixed(1)}% / ${(clearChance(b,f,.25)*100).toFixed(1)}%`);}
