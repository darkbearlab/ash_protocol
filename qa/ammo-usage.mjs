// Ammunition consumption baseline (Claude, 2026-09-14). Runs the headless balance bot and records per class and floor:
// rounds fired and their terminal-price value (1 = one scrap of buying power), ammunition gained through receiveAmmo,
// total stock at floor end, and the end reserve against carry capacity for the class's most-fired ammo type.
// Fired value is counted from shots at the held weapon's ammo type, so picking up weapons (whose magazines enter the
// stock without receiveAmmo) no longer distorts consumption. Ally auto-reloads are not in "fired".
// The bot is a regression agent, not a human: it never uses skills and cannot operate melee classes.
// Usage: node qa/ammo-usage.mjs [seeds=40] [classes=soldier,recon,...]
import {Game} from '../src/engine.js';
import {play} from '../tools/balance.mjs';
import {AMMUNITION,TERMINAL_AMMO,AMMO_IDS} from '../src/ammunition.js';
const args=Object.fromEntries(process.argv.slice(2).map(a=>a.split('=')));
const SEEDS=Number(args.seeds||40);
const CLASSES=(args.classes||'soldier,recon,engineer,druid,necromancer,bulwark').split(',');
const value=(id,rounds)=>TERMINAL_AMMO[id]?rounds*TERMINAL_AMMO[id].cost/TERMINAL_AMMO[id].amount:0;
function stock(g){
 const p=g.player;let v=0;
 for(const id of AMMO_IDS)v+=value(id,p[AMMUNITION[id].key]||0);
 for(const slot of p.owned){const w=g.weaponAt(slot);if(w?.ammoType)v+=value(w.ammoType,p.ammo[slot]||0);}
 return v;
}
class Probe extends Game{
 floorRecord(){
  this.__rec||=(this.__rec={});
  return this.__rec[this.floor]||=(this.__rec[this.floor]={end:stock(this),gained:0,shots0:this.player.stats.shots,shots:0,turn0:this.turn,turns:0,firedValue:0,fired:{},reserves:{},caps:{}});
 }
 action(type,arg){
  const rec=this.floorRecord(),p=this.player,shots0=p.stats.shots,ammoType=this.weaponAt(p.weapon)?.ammoType;
  const ok=super.action(type,arg),delta=p.stats.shots-shots0;
  if(delta>0&&ammoType){rec.fired[ammoType]=(rec.fired[ammoType]||0)+delta;rec.firedValue+=value(ammoType,delta);}
  rec.end=stock(this);rec.shots=p.stats.shots-rec.shots0;rec.turns=this.turn-rec.turn0;
  for(const id of AMMO_IDS){rec.reserves[id]=p[AMMUNITION[id].key]||0;rec.caps[id]=this.ammoCapacity(id);}
  this.floorRecord();return ok;
 }
 receiveAmmo(id,amount,opts){
  const got=super.receiveAmmo(id,amount,opts);
  if(this.__rec&&got>0)this.floorRecord().gained+=value(id,got);
  return got;
 }
}
const f=(n,d=1)=>Number(n).toFixed(d);
for(const character of CLASSES){
 const floors={},firedTotal={};let deepest=0;
 const runs=[];
 for(let seed=1;seed<=SEEDS;seed++){
  let game=null;
  class Capture extends Probe{constructor(...a){super(...a);game=this;}}
  play(seed,1800,character,Capture);
  deepest+=game.floor;runs.push(game.__rec||{});
  for(const r of Object.values(game.__rec||{}))for(const [id,n] of Object.entries(r.fired))firedTotal[id]=(firedTotal[id]||0)+n;
 }
 const main=Object.entries(firedTotal).sort((a,b)=>b[1]-a[1])[0]?.[0]||'rifle';
 for(const rec of runs)for(const [floor,r] of Object.entries(rec)){
  const a=floors[floor]||=(floors[floor]={runs:0,turns:0,shots:0,firedValue:0,gained:0,end:0,mainReserve:0,mainCap:0,low:0});
  a.runs++;a.turns+=r.turns;a.shots+=r.shots;a.firedValue+=r.firedValue;a.gained+=r.gained;a.end+=r.end;
  const res=r.reserves[main]??0,cap=r.caps[main]??1;a.mainReserve+=res;a.mainCap+=cap;if(res<cap*.25)a.low++;
 }
 console.log(`\n${character} (avg deepest ${f(deepest/SEEDS,2)}, main ammo ${AMMUNITION[main].name})`);
 console.log('floor runs turns shots firedVal gained endStock mainReserve/cap lowRuns');
 for(const [floor,a] of Object.entries(floors).sort((x,y)=>x[0]-y[0])){
  const n=a.runs;console.log(`${String(floor).padStart(5)} ${String(n).padStart(4)} ${f(a.turns/n,0).padStart(5)} ${f(a.shots/n,0).padStart(5)} ${f(a.firedValue/n).padStart(8)} ${f(a.gained/n).padStart(6)} ${f(a.end/n).padStart(8)} ${`${f(a.mainReserve/n,0)}/${f(a.mainCap/n,0)}`.padStart(15)} ${`${Math.round(a.low/n*100)}%`.padStart(7)}`);
 }
}
