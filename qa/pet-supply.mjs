// Druid growth-line supply estimate (Claude, 2026-09-13). Counts what each generated floor offers —
// ground items, container contents and expected regular-enemy drops — in the units each growth line eats.
// It is an upper bound for a thorough run: the druid also needs these resources for itself.
// Usage: node qa/pet-supply.mjs [seeds=40] [floors=12]
import {generate} from '../src/world.js';
import {ENEMY_TYPES,WEAPONS,RARE_ARMORY,ENEMY_LOOT} from '../src/data.js';
import {weaponUnlocked} from '../src/progression.js';
import {TERMINAL_AMMO,AMMUNITION} from '../src/ammunition.js';
import {PLATE_DROP} from '../src/perks.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.split('=')));
const SEEDS=Number(args.seeds||40),FLOORS=Number(args.floors||12);
// Amounts pickup() grants when an item carries none: ammo uses AMMUNITION[id].pickup, plates 20, scrap 15.
const DEFAULT_AMOUNT={ammo:AMMUNITION.rifle.pickup,pistol:AMMUNITION.pistol.pickup,shell:AMMUNITION.shell.pickup,energy:AMMUNITION.energy.pickup,ordnance:AMMUNITION.ordnance.pickup,armor:20,scrap:15,med:1,grenade:1,emp:1,stun:1,smoke:1};
const AMMO_OF={ammo:'rifle',pistol:'pistol',shell:'shell',energy:'energy',ordnance:'ordnance'};
const THROWN=new Set(['grenade','emp','stun','smoke']);
const fuelOf=(id,rounds)=>rounds*TERMINAL_AMMO[id].cost/TERMINAL_AMMO[id].amount;
const DROP_AMOUNT={energy:6,ordnance:2,pistol:18,shell:4};
const rows=[];
for(let floor=1;floor<=FLOORS;floor++){
 const acc={plates:0,thrown:0,fuel:0,meds:0,scrap:0,weapons:0,dropPlates:0,dropFuel:0,dropWeapons:0,killScrap:0,enemies:0,terminals:0,noAmount:{}};
 for(let seed=1;seed<=SEEDS;seed++){
  const g=generate(seed,floor,[]);
  const loot=[...g.items,...g.props.filter(p=>p.type==='container').flatMap(c=>c.contents||[])];
  for(const it of loot){
   let n=Number.isFinite(it.amount)?it.amount:DEFAULT_AMOUNT[it.type];
   if(n==null&&it.type in DEFAULT_AMOUNT){acc.noAmount[it.type]=(acc.noAmount[it.type]||0)+1;n=0;}
   if(it.type==='weapon')acc.weapons++;
   else if(it.type==='armor')acc.plates+=n;
   else if(THROWN.has(it.type))acc.thrown+=n;
   else if(AMMO_OF[it.type])acc.fuel+=fuelOf(AMMO_OF[it.type],n);
   else if(it.type==='med')acc.meds+=n;
   else if(it.type==='scrap')acc.scrap+=n;
   else if(it.type==='lore')acc.scrap+=10;
  }
  acc.terminals+=g.props.filter(p=>p.type==='terminal').length;
  for(const e of g.enemies){
   if(e.expendable)continue;acc.enemies++;
   const def=ENEMY_TYPES[e.type],l=ENEMY_LOOT[e.type];
   if((def?.armor||0)>0)acc.dropPlates+=PLATE_DROP.base*PLATE_DROP.amount;
   const ammoType=l?.ammo||'ammo';acc.dropFuel+=.35*fuelOf(AMMO_OF[ammoType],DROP_AMOUNT[ammoType]??10);
   if(l?.weapon!==undefined&&weaponUnlocked(WEAPONS[l.weapon],[]))acc.dropWeapons+=l.chance||0;
   if(floor>=RARE_ARMORY.minFloor&&l?.rareWeapon!==undefined&&weaponUnlocked(WEAPONS[l.rareWeapon],[]))acc.dropWeapons+=l.rareChance;
   acc.killScrap+=e.type==='boss'||e.type==='warden'?35:3;
  }
 }
 const avg=k=>acc[k]/SEEDS;
 rows.push({floor,enemies:avg('enemies'),terminals:avg('terminals'),plates:avg('plates')+avg('dropPlates'),platesCases:avg('plates'),thrown:avg('thrown'),weapons:avg('weapons')+avg('dropWeapons'),weaponsGround:avg('weapons'),fuel:avg('fuel')+avg('dropFuel'),fuelCases:avg('fuel'),meds:avg('meds'),scrap:avg('scrap')+avg('killScrap'),noAmount:acc.noAmount});
}
const f=(n,d=1)=>n.toFixed(d);
console.log(`seeds=${SEEDS}, per-floor averages (drops are expected values, all regular enemies killed, no perks)`);
console.log('floor enemies plates(cases) thrown weapons(ground) fuel(cases) meds scrap terminals');
for(const r of rows)console.log(`${String(r.floor).padStart(5)} ${f(r.enemies).padStart(7)} ${`${f(r.plates)}(${f(r.platesCases)})`.padStart(13)} ${f(r.thrown).padStart(6)} ${`${f(r.weapons)}(${f(r.weaponsGround)})`.padStart(15)} ${`${f(r.fuel)}(${f(r.fuelCases)})`.padStart(12)} ${f(r.meds).padStart(4)} ${f(r.scrap).padStart(5)} ${f(r.terminals).padStart(9)}`);
const sum=(a,b)=>rows.filter(r=>r.floor>=a&&r.floor<=b).reduce((s,r)=>({plates:s.plates+r.plates,thrown:s.thrown+r.thrown,weapons:s.weapons+r.weapons,fuel:s.fuel+r.fuel,meds:s.meds+r.meds,scrap:s.scrap+r.scrap}),{plates:0,thrown:0,weapons:0,fuel:0,meds:0,scrap:0});
for(const [a,b]of [[1,6],[1,Math.min(FLOORS,12)]]){const s=sum(a,b);console.log(`floors ${a}-${b}: plates ${f(s.plates)} · thrown ${f(s.thrown)} · weapons ${f(s.weapons)} (value ${f(s.weapons*20,0)}) · fuel ${f(s.fuel)} · meds ${f(s.meds)} · scrap ${f(s.scrap,0)}`);}
const flagged=Object.fromEntries(Object.entries(rows.reduce((m,r)=>{for(const[k,v]of Object.entries(r.noAmount))m[k]=(m[k]||0)+v;return m;},{})));
console.log('items without amount (default not yet applied):',JSON.stringify(flagged));
