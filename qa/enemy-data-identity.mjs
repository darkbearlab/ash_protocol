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
// Faction framework fields (docs/FACTION_DATA.md) change data shape, not behaviour. They are stripped before hashing
// so the pre-faction baseline still proves the rules are unchanged; drop this once a faction split changes content.
// The purge ledger (docs/PURGE_REVIEW.md, 3.86.0) is narrative bookkeeping on the same terms, as are the unlock
// holdings of 3.90.0 (docs/UNLOCKS.md). An absent corpse (operatorCorpse null) and empty production lines (3.91.0,
// docs/ENGINEER.md) are dropped too, so only runs that actually carry them hash differently.
//   node qa/enemy-data-identity.mjs --candidate  also writes qa/enemy-data-candidate.json (untracked) to copy single entries
const IGNORED_KEYS=new Set(['faction','facilityFaction','purge','unlockedCharacters','unlockedStories','pendingStories','encounteredCharacters','factionOverride']);
const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key,item])=>!IGNORED_KEYS.has(key)&&!(key==='operatorCorpse'&&item===null)&&!(key==='productionLines'&&Array.isArray(item)&&item.length===0)).map(([key,item])=>[key,normalize(item)])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex').slice(0,16);
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
if(process.argv.includes('--candidate')){
 writeFileSync(new URL('./enemy-data-candidate.json',import.meta.url),JSON.stringify(now,null,1)+'\n');
}
if(process.argv.includes('--write')){
 writeFileSync(BASELINE,JSON.stringify({note:'Pre-refactor behaviour for docs/ENEMY_DATA.md. Do not rewrite during the refactor.',...now},null,1)+'\n');
 console.log('baseline written',counts);
}else{
 if(!existsSync(BASELINE)){console.error('No baseline: record it with --write on the pre-refactor commit.');process.exit(1);}
 const diff=differences(JSON.parse(readFileSync(BASELINE,'utf8')),now);
 if(diff.length){console.error(`${diff.length} differences from the baseline:`);for(const d of diff)console.error(`  ${d.group} ${d.key}: ${d.a} -> ${d.b}`);process.exit(1);}
 console.log('identical to baseline',counts);
}
