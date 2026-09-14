// Enemy data refactor identity check (Claude, 2026-09-14; docs/ENEMY_DATA.md section 6). Records what a
// behaviour-neutral refactor must not change: generated floors, mission set-up and bot replays.
//   node qa/enemy-data-identity.mjs          compare with qa/enemy-data-baseline.json (exit 1 on any difference)
//   node qa/enemy-data-identity.mjs --write  record the baseline; only when a rule change is intended
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {Game,generate,generateLegacy} from '../src/engine.js';
import {MISSIONS} from '../src/missions.js';
import {CHARACTERS} from '../src/characters.js';
import {play} from '../tools/balance.mjs';

const BASELINE=new URL('./enemy-data-baseline.json',import.meta.url);
const GROUPS=['generation','missions','bots'];
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,16);
// Errors are recorded rather than thrown, so a floor that fails the same way before and after still matches.
const quietly=fn=>{try{return fn();}catch(error){return {error:String(error?.message||error)};}};

function capture(){
 const generation={},missions={},bots={};
 for(let seed=1;seed<=40;seed++){
  for(let floor=1;floor<=12;floor++)generation[`current:${seed}:${floor}`]=hash(quietly(()=>generate(seed,floor)));
  for(let floor=1;floor<=6;floor++)generation[`legacy:${seed}:${floor}`]=hash(quietly(()=>generateLegacy(seed,floor)));
 }
 for(let seed=1;seed<=10;seed++)for(let floor=1;floor<=6;floor++)generation[`offset6:${seed}:${floor}`]=hash(quietly(()=>generate(seed,floor,[],6)));
 for(const mission of Object.keys(MISSIONS))for(let seed=1;seed<=5;seed++){
  for(const floor of mission==='endless'?[1,3,6,12]:[1,3,6])missions[`${mission}:${seed}:${floor}`]=hash(quietly(()=>{
   const g=new Game(seed,[],0,'soldier','onyx',mission);if(floor!==1){g.floor=floor;g.loadFloor();}
   // runId is a random ledger key for protocol settlement, not game state; the save version may change by design.
   const data=JSON.parse(g.serialize());delete data.version;delete data.data?.runId;return data;
  }));
 }
 for(const character of Object.keys(CHARACTERS))for(let seed=1;seed<=3;seed++)bots[`${character}:${seed}`]=quietly(()=>{
  const {status,floor,turn,hp,kills,actions,invalid}=play(seed,1800,character);return {status,floor,turn,hp,kills,actions,invalid};
 });
 return {generation,missions,bots};
}

function differences(before,after){
 const out=[];
 for(const group of GROUPS){
  const keys=new Set([...Object.keys(before[group]||{}),...Object.keys(after[group]||{})]);
  for(const key of keys){const a=JSON.stringify(before[group]?.[key]),b=JSON.stringify(after[group]?.[key]);if(a!==b)out.push({group,key,a,b});}
 }
 return out;
}

const now=capture(),counts=Object.fromEntries(GROUPS.map(g=>[g,Object.keys(now[g]).length]));
if(process.argv.includes('--write')){
 writeFileSync(BASELINE,JSON.stringify({note:'Pre-refactor behaviour for docs/ENEMY_DATA.md. Do not rewrite during the refactor.',...now},null,1)+'\n');
 console.log('baseline written',counts);
}else{
 if(!existsSync(BASELINE)){console.error('No baseline: record it with --write on the pre-refactor commit.');process.exit(1);}
 const diff=differences(JSON.parse(readFileSync(BASELINE,'utf8')),now);
 if(diff.length){console.error(`${diff.length} differences from the baseline:`);for(const d of diff.slice(0,30))console.error(`  ${d.group} ${d.key}: ${d.a} -> ${d.b}`);process.exit(1);}
 console.log('identical to baseline',counts);
}
