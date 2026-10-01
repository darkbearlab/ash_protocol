// Enemy special matrices (3.206.1): what the shared rules do with every telegraphed special, recorded as goldens so a
// refactor of the specials (src/enemy-specials.js, docs/CHECKLIST.md 2) can prove it changed nothing, and a rule change
// shows exactly which cells it moves. Each cell is a short JSON of the unit's special fields afterwards.
// - interrupt: interruptEnemyIntent on each special's state (as its card carries it) × each reason, and one it does not know.
// - blocks: each state × a decoy (and the same unit beside you), a mine it watched go down, a hazard under it, a pin
//   (applySuppression), and its own turn (fit, pinned, stunned) with the effects and the dice spent.
// - tick: the round start on units holding intents and cooldowns, fit, stunned, pinned and dead, through the old tick
//   exports and through the game's own round (a wait, the units unalerted).
// - load: tampered saves of each (moved, dead, stunned, pinned, an extra key, malformed, the wrong card, numbers past
//   today's tuning; a player or an ally carrying one) → refused, or what loads; `archived`: the same on a floor kept on a
//   round trip (checked with that floor's own grid and turn).
//   node qa/special-matrix.mjs           compare with tests/fixtures/special-matrix.json (exit 1, listing the cells)
//   node qa/special-matrix.mjs --write   record it: only for an intended rule change, never during a refactor
// tests/enemy-specials.test.mjs runs the same comparison with the full test suite.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Game,makeEnemy,giveEnemyAffix,applySuppression,interruptEnemyIntent} from '../src/engine.js';
import {affixArena} from './enemy-affix-scenes.mjs';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
import {decoyAct,mineAct} from '../src/field-gear.js';
import {stepOffHazard} from '../src/hazard-paths.js';
import {pinned} from '../src/suppression.js';
import {occupied,addAlly} from '../src/allies.js';
import {tickTongues} from '../src/swarm.js';
import {tickSwarmBosses} from '../src/swarm-bosses.js';
import {tickPounces} from '../src/pounce.js';
import {tickLockdowns} from '../src/lockdown.js';
import {tickFields} from '../src/swarm-fields.js';
import {tickOperatives} from '../src/delisted-operatives.js';

export const MATRIX_FIXTURE=new URL('../tests/fixtures/special-matrix.json',import.meta.url);
const REASONS=['death','disabled','displaced','target_lost','suppressed','bogus'];
const FIELDS=['grenadeIntent','flameIntent','tongueIntent','tongueCooldown','pounceIntent','pounceCooldown','lobIntent','lobCooldown','chargeIntent','chargeCooldown','crashed','nestIntent','nestCooldown','markIntent','markReady','gun','special','fireIntent','heat','overheat','burn','scanCooldown','grenadeCooldown','smokeIntent','smokeCooldown','droneCooldown','decloaked','deployKind','deployCharges','lockIntent','lockCooldown','charge','aim','windup','fireChain','x','y','hp','control','suppression','vaultExposed'];   // 3.207.0: the delisted operatives' fields; 3.212.0: a deployer's
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const fields=u=>canon(Object.fromEntries(FIELDS.filter(k=>u?.[k]!==undefined).map(k=>[k,u[k]])));
const cell=v=>JSON.stringify(canon(v));
const at=q=>({x:q.x,y:q.y});

// Each special as its card carries it, valid with the unit at E and its target at T three tiles west on the same row;
// N is a spare floor tile (an egg sac). `main` is the field a tampered save breaks, `count` a number past the tuning.
const SPECIALS={
 grenade:{card:'raider',affixes:['grenadier'],main:'grenadeIntent',state:(E,T)=>({grenadeIntent:{stage:'prepare',targetId:'player',x:T.x,y:T.y,origin:at(E)}})},
 stun:{card:'raider',affixes:['grenadier'],main:'grenadeIntent',state:(E,T)=>({grenadeIntent:{stage:'prepare',targetId:'player',x:T.x,y:T.y,origin:at(E),stun:true}})},
 flame:{card:'rifleman',affixes:['flamer'],main:'flameIntent',state:(E,T)=>({flameIntent:{origin:at(E),aim:at(T)}})},
 spray:{card:'arsonist',faction:'rebel',main:'flameIntent',count:'heat',state:(E,T)=>({flameIntent:{origin:at(E),aim:at(T)},heat:1})},
 tongue:{card:'hive_beast',faction:'swarm',main:'tongueIntent',count:'tongueCooldown',state:(E,T)=>({tongueIntent:{origin:at(E),target:at(T),point:{x:E.x-1,y:E.y}},tongueCooldown:1})},
 pounce:{card:'crawler',faction:'swarm',main:'pounceIntent',count:'pounceCooldown',state:(E,T)=>({pounceIntent:{origin:at(E),target:at(T),point:{x:T.x+1,y:T.y}},pounceCooldown:1})},
 lob:{card:'spitter',faction:'swarm',main:'lobIntent',count:'lobCooldown',state:(E,T)=>({lobIntent:{origin:at(E),point:at(T)},lobCooldown:1})},
 charge:{card:'hive_beast',faction:'swarm',main:'chargeIntent',count:'chargeCooldown',state:E=>({chargeIntent:{origin:at(E),dir:{x:-1,y:0}},chargeCooldown:1})},
 crashed:{card:'hive_beast',faction:'swarm',main:'crashed',count:'chargeCooldown',state:()=>({crashed:true,vaultExposed:true,chargeCooldown:3})},
 nest:{card:'hive_matriarch',faction:'swarm',main:'nestIntent',count:'nestCooldown',state:(E,T,N)=>({nestIntent:at(N),nestCooldown:1})},
 mark:{card:'designator',faction:'loyalist',main:'markIntent',state:(E,T,N,turn)=>({markIntent:{since:turn}})},
 markReady:{card:'designator',faction:'loyalist',main:'markReady',count:'markReady',state:(E,T,N,turn)=>({markReady:turn+3})},
 gunSet:{card:'gunline',faction:'loyalist',main:'gun',count:'special',state:(E,T)=>({gun:{stage:'set',origin:at(E),aim:at(T)},special:'mark'})},
 gunSweep:{card:'gunline',faction:'loyalist',main:'gun',count:'gun.left',state:(E,T)=>({gun:{stage:'sweep',origin:at(E),aim:at(T),left:2},special:'mark'})},
 gunPack:{card:'gunline',faction:'loyalist',main:'gun',count:'gun.left',state:()=>({gun:{stage:'pack',left:1},special:'mark'})},
 wall:{card:'arsonist',faction:'rebel',main:'fireIntent',count:'special',state:(E,T)=>({fireIntent:{kind:'wall',origin:at(E),cells:[{x:T.x-1,y:T.y},{x:T.x-2,y:T.y}]},special:'ring'})},
 ring:{card:'arsonist',faction:'rebel',main:'fireIntent',count:'heat',state:(E,T)=>({fireIntent:{kind:'ring',origin:at(E),cells:[{x:T.x-2,y:T.y}],center:at(T),gaps:[{x:T.x-1,y:T.y}]},special:'wall',heat:2})},
 vent:{card:'arsonist',faction:'rebel',main:'overheat',count:'overheat',state:()=>({overheat:2})},
 burnSet:{card:'burnline',faction:'rebel',main:'burn',count:'special',state:(E,T)=>({burn:{stage:'set',origin:at(E),aim:at(T)},special:'mark'})},
 burnSweep:{card:'burnline',faction:'rebel',main:'burn',count:'burn.left',state:(E,T)=>({burn:{stage:'sweep',origin:at(E),aim:at(T),left:2},special:'mark'})},
 burnPack:{card:'burnline',faction:'rebel',main:'burn',count:'burn.left',state:()=>({burn:{stage:'pack',left:2},special:'burn'})},
 // 3.207.0 delisted operatives (src/delisted-operatives.js): the soldier's grenade (its card's, not an affix) and its two
 // cooldowns, the recon's warned smoke, the engineer's drone clock, the ninja showing itself, the berserker's grapple.
 opGrenade:{card:'delisted_soldier',main:'grenadeIntent',count:'grenadeCooldown',state:(E,T)=>({grenadeIntent:{stage:'prepare',targetId:'player',x:T.x,y:T.y,origin:at(E)},grenadeCooldown:3})},
 scan:{card:'delisted_soldier',main:'scanCooldown',count:'scanCooldown',state:()=>({scanCooldown:2})},
 smoke:{card:'delisted_recon',main:'smokeIntent',count:'smokeCooldown',state:(E,T)=>({smokeIntent:{origin:at(E),point:{x:T.x+1,y:T.y}},smokeCooldown:1})},
 drones:{card:'delisted_engineer',main:'droneCooldown',count:'droneCooldown',state:()=>({droneCooldown:1})},
 cloak:{card:'delisted_ninja',main:'decloaked',state:()=>({decloaked:true})},
 grapple:{card:'delisted_berserker',main:'tongueIntent',count:'tongueCooldown',state:(E,T)=>({tongueIntent:{origin:at(E),target:at(T),point:{x:E.x-1,y:E.y}},tongueCooldown:1})},
 // 3.212.0: a deployer's kind and charges left (state only; src/enemy-behavior.js).
 deploy:{card:'rifleman',affixes:['deployer'],main:'deployKind',count:'deployCharges',state:()=>({deployKind:'turret',deployCharges:1})},
 // 3.213.0: a lockdown gunman's aimed tile beside its target and its cooldown (src/lockdown.js).
 lockdown:{card:'rifleman',affixes:['lockdown'],main:'lockIntent',count:'lockCooldown',state:(E,T)=>({lockIntent:{origin:at(E),tile:{x:T.x,y:T.y+1}},lockCooldown:1})},
};
// Units with no special state: what the specials' checks must leave alone. 3.212.0: the fixed turret.
const PLAIN={turret:{card:'turret'},opSoldier:{card:'delisted_soldier'},opRecon:{card:'delisted_recon'},opEngineer:{card:'delisted_engineer'},opBerserker:{card:'delisted_berserker'},opNinja:{card:'delisted_ninja'},rifleman:{card:'rifleman'},aiming:{card:'rifleman',extra:{charge:true,windup:1,aim:{x:10,y:10}}},flamer:{card:'rifleman',affixes:['flamer']},grenadier:{card:'raider',affixes:['grenadier']},arsonist:{card:'arsonist',faction:'rebel'},beast:{card:'hive_beast',faction:'swarm'},crawler:{card:'crawler',faction:'swarm'},spitter:{card:'spitter',faction:'swarm'},gunline:{card:'gunline',faction:'loyalist'}};

const E0={x:13,y:10},T0={x:10,y:10},N0={x:10,y:13};
function arena(){const g=affixArena();clearGeneratedMap(g);g.fires=undefined;g.flares=[];Object.assign(g.player,{hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function unit(g,spec,id='u',E=E0,T=T0,N=N0,turn=g.turn){
 const e=makeEnemy(spec.card,E.x,E.y,id,3,0,spec.faction||'loyalist');e.hp=e.maxHp=500;
 for(const a of spec.affixes||[]){giveEnemyAffix(e,a);e.affixes.find(x=>x.id===a).revealed=true;}
 Object.assign(e,structuredClone(spec.state?.(E,T,N,turn)||{}),structuredClone(spec.extra||{}));
 return e;
}
function scene(spec,{alert=false}={}){const g=arena(),e=unit(g,spec);e.alert=alert;g.enemies.push(e);g.reveal();return {g,e};}
const rows={...SPECIALS,...PLAIN};

// ---- interrupt -----------------------------------------------------------------------------------------------------
function interruptTable(){
 const out={};
 const all={hp:1,charge:true,aim:{x:1,y:1},windup:2,fireChain:{count:1}};
 for(const [id,spec] of Object.entries(SPECIALS))Object.assign(all,structuredClone(spec.state(E0,T0,N0,1)));
 const g=arena(),subjects={...Object.fromEntries(Object.entries(rows).map(([id,spec])=>{const u=unit(g,spec);return [id,()=>structuredClone(u)];})),
  everything:()=>structuredClone(all),gunPackSpent:()=>({gun:{stage:'pack',left:0}}),burnPackSpent:()=>({burn:{stage:'pack',left:0}}),falsyIntents:()=>({grenadeIntent:null,flameIntent:0,tongueIntent:null,chargeIntent:null,nestIntent:null,markIntent:null,fireIntent:null})};
 for(const [id,make] of Object.entries(subjects)){out[id]={};for(const reason of REASONS){const u=make();const ret=interruptEnemyIntent(u,reason);out[id][reason]=cell({ret,...fields(u)});}}
 return out;
}

// ---- blocks --------------------------------------------------------------------------------------------------------
// `bare:<id>`: the state alone on a plain rifleman (the shared checks read the fields, whatever the card), and
// `everything`: every state at once on one.
const BARE=Object.fromEntries(Object.entries(SPECIALS).map(([id,spec])=>[`bare:${id}`,{card:'rifleman',state:spec.state,bare:true}]));
BARE.everything={card:'rifleman',bare:true,state:(...a)=>Object.assign({},...Object.values(SPECIALS).map(s=>s.state(...a)))};
function blocksTable(){
 const out={};
 for(const [id,spec] of Object.entries({...rows,...BARE})){
  const r=out[id]={};
  {const {g,e}=scene(spec);g.decoy={x:13,y:11,hp:30,maxHp:30,expires:g.turn+3,fooled:[e.id]};const ret=decoyAct(g,e);r.decoy=cell({ret,decoy:g.decoy,rng:g.rng.state()});}
  {const {g,e}=scene(spec);g.player.x=12;g.reveal();g.decoy={x:13,y:11,hp:30,maxHp:30,expires:g.turn+3,fooled:[e.id]};const ret=decoyAct(g,e);r.decoyBeside=cell({ret,decoy:g.decoy,rng:g.rng.state()});}
  {const {g,e}=scene(spec);g.mines=[{id:'mine-1-1',x:13,y:13,seen:[e.id]}];const ret=mineAct(g,e);r.mine=cell({ret,mines:g.mines,rng:g.rng.state()});}
  {const {g,e}=scene(spec);g.hazards.push({x:e.x,y:e.y,type:'acid'});const ret=stepOffHazard(g,e,{x:10,y:10},{pinned,occupied});r.stepOff=cell({ret,x:e.x,y:e.y});}
  {const {g,e}=scene(spec);const ret=applySuppression(e,5);r.pin=cell({ret,...fields(e)});}
  if(spec.bare)continue;
  for(const [col,tweak] of [['turn',()=>{}],['turnPinned',e=>{e.suppression=3;}],['turnStunned',e=>{e.control={disabled:1,immune:0};}]]){
   const {g,e}=scene(spec,{alert:true});tweak(e);g.enemyAct(e);
   r[col]=cell({...fields(e),fx:g.effects.map(f=>f.type+(f.kind?':'+f.kind:'')),logs:g.logs.length,rng:g.rng.state(),marks:g.marks,fires:g.fires,player:{x:g.player.x,y:g.player.y,hp:g.player.hp,traits:g.player.traits.map(t=>t.id)}});
  }
 }
 return out;
}

// ---- tick ----------------------------------------------------------------------------------------------------------
const TICKS={
 matriarch:{card:'hive_matriarch',faction:'swarm',state:(E,T,N)=>({tongueIntent:{origin:at(E),target:at(T),point:{x:E.x-1,y:E.y}},chargeIntent:{origin:at(E),dir:{x:-1,y:0}},nestIntent:at(N),tongueCooldown:2,chargeCooldown:2,nestCooldown:2})},
 matriarchIdle:{card:'hive_matriarch',faction:'swarm',state:()=>({tongueCooldown:2,chargeCooldown:1,nestCooldown:3})},
 beast:{card:'hive_beast',faction:'swarm',state:(E,T)=>({tongueIntent:{origin:at(E),target:at(T),point:{x:E.x-1,y:E.y}},tongueCooldown:1,chargeCooldown:2})},
 charger:{card:'hive_beast',faction:'swarm',state:E=>({chargeIntent:{origin:at(E),dir:{x:-1,y:0}},tongueCooldown:2})},
 crawler:{card:'crawler',faction:'swarm',state:(E,T)=>({pounceIntent:{origin:at(E),target:at(T),point:{x:T.x+1,y:T.y}},pounceCooldown:2})},
 crawlerIdle:{card:'crawler',faction:'swarm',state:()=>({pounceCooldown:1})},
 spitter:{card:'spitter',faction:'swarm',state:(E,T)=>({lobIntent:{origin:at(E),point:at(T)},lobCooldown:4})},
 grenadier:SPECIALS.grenade,flamer:SPECIALS.flame,designator:SPECIALS.mark,gunline:SPECIALS.gunSweep,arsonist:SPECIALS.wall,burnline:SPECIALS.burnSweep,
 // 3.207.0: the delisted operatives' cooldowns and warnings.
 opSoldier:{card:'delisted_soldier',state:(E,T)=>({grenadeIntent:{stage:'prepare',targetId:'player',x:T.x,y:T.y,origin:at(E)},grenadeCooldown:2,scanCooldown:2})},
 lockdown:SPECIALS.lockdown,   // 3.213.0
 opRecon:SPECIALS.smoke,opEngineer:SPECIALS.drones,opNinja:SPECIALS.cloak,opBerserker:{card:'delisted_berserker',state:(E,T)=>({tongueIntent:{origin:at(E),target:at(T),point:{x:E.x-1,y:E.y}},tongueCooldown:1,chargeCooldown:2})},
};
function tickTable(){
 const out={};
 const states={fit:()=>{},stunned:e=>{e.control={disabled:1,immune:0};},pinned:e=>{e.suppression=3;},dead:e=>{e.hp=0;}};
 for(const [id,spec] of Object.entries(TICKS))for(const [state,tweak] of Object.entries(states)){
  const r=out[`${id}:${state}`]={};
  {const {g,e}=scene(spec);tweak(e);tickTongues(g);tickSwarmBosses(g);tickPounces(g);tickFields(g);tickOperatives(g);tickLockdowns(g);r.exports=cell(fields(e));}
  {const {g,e}=scene(spec);tweak(e);g.action('wait');r.round=cell({...fields(g.enemies.find(u=>u.id===e.id)||e),props:g.props.filter(o=>o.type==='nest').length});}
 }
 return out;
}

// ---- load ----------------------------------------------------------------------------------------------------------
const setPath=(o,path,v)=>{const keys=path.split('.'),last=keys.pop();let t=o;for(const k of keys){if(!t[k]||typeof t[k]!=='object')return false;t=t[k];}t[last]=v;return true;};
const VARIANTS={
 asIs:()=>{},moved:e=>{e.y+=2;},dead:e=>{e.hp=0;},stunned:e=>{e.control={disabled:1,immune:0};},pinned:e=>{e.suppression=3;},
 extraKey:(e,s)=>{if(e[s.main]&&typeof e[s.main]==='object')e[s.main].extra=1;else e.extraField=1;},
 nulled:(e,s)=>{e[s.main]=null;},number:(e,s)=>{e[s.main]=5;},
 badOrigin:(e,s)=>{if(e[s.main]&&typeof e[s.main]==='object')e[s.main].origin=null;},numOrigin:(e,s)=>{if(e[s.main]&&typeof e[s.main]==='object')e[s.main].origin=5;},
 overMax:(e,s)=>{if(s.count)setPath(e,s.count,99);},negative:(e,s)=>{if(s.count)setPath(e,s.count,-1);},zero:(e,s)=>{if(s.count)setPath(e,s.count,0);},
 wrongCard:e=>{e.type='raider';delete e.affixes;e.traits=(e.traits||[]).filter(t=>!t.source?.startsWith('affix:'));},
 hiddenAffix:e=>{for(const a of e.affixes||[])a.revealed=false;},
};
const outcome=(raw,find)=>{const s=Game.restore(raw);if(!s)return 'refused';return cell(fields(find(s)));};
function loadTable(){
 const out={};
 for(const [id,spec] of Object.entries(SPECIALS)){
  const {g,e}=scene(spec),raw=g.serialize();out[id]={};
  for(const [v,change] of Object.entries(VARIANTS)){const d=JSON.parse(raw);change(d.data.enemies.find(u=>u.id===e.id),spec);out[id][v]=outcome(JSON.stringify(d),s=>s.enemies.find(u=>u.id===e.id));}
 }
 // Only enemies carry a grenade; a player or an ally with one is refused. The rest are checked on enemies only.
 const actors={};
 for(const [id,spec] of Object.entries({grenade:SPECIALS.grenade,flame:SPECIALS.flame,tongue:SPECIALS.tongue,mark:SPECIALS.mark,gunSet:SPECIALS.gunSet,smoke:SPECIALS.smoke,cloak:SPECIALS.cloak})){
  const g=arena(),a=addAlly(g,'pet','crawler',{point:{x:11,y:11}});a.hp=a.maxHp=300;g.reveal();const raw=g.serialize(),state=spec.state(T0,E0,N0,g.turn);
  {const d=JSON.parse(raw);Object.assign(d.data.player,structuredClone(state));actors[`player:${id}`]=outcome(JSON.stringify(d),s=>s.player);}
  {const d=JSON.parse(raw);Object.assign(d.data.allies[0],structuredClone(state));actors[`ally:${id}`]=outcome(JSON.stringify(d),s=>s.allies[0]);}
 }
 out.actors=actors;
 return out;
}
// A floor kept on a round trip: the unit sits on floor 1 while you are on floor 2.
function lane(frame){
 const free=(x,y)=>frame.grid[y]?.[x]===1&&!frame.props.some(o=>o.x===x&&o.y===y)&&!frame.enemies.some(o=>o.x===x&&o.y===y)&&!(frame.start.x===x&&frame.start.y===y)&&!(frame.end.x===x&&frame.end.y===y)&&!(frame.hazards||[]).some(o=>o.x===x&&o.y===y);
 for(let y=1;y<frame.grid.length-1;y++)for(let x=1;x<frame.grid.length-5;x++)if([0,1,2,3,4].every(n=>free(x+n,y)))return {T:{x,y},N:{x:x+1,y},E:{x:x+3,y}};
 throw new Error('no lane on the kept floor');
}
function archivedTable(){
 const r=new Game(331,[],0,'soldier','onyx','roundtrip',{facilityFaction:'rebel'});Object.assign(r.player,r.exitPoint);if(r.exitBlocked!==''||!r.descend())throw new Error('no round trip');
 const raw=r.serialize(),base=JSON.parse(raw),frame=base.data.floorStates[1],{E,T,N}=lane(frame),turn=frame.savedTurn,out={};
 for(const [id,spec] of Object.entries(SPECIALS)){
  out[id]={};
  for(const v of ['asIs','moved','dead','stunned','extraKey','overMax','wrongCard']){
   const d=JSON.parse(raw),e=unit(null,spec,`kept-${id}`,E,T,N,turn);e.alert=true;VARIANTS[v](e,spec);d.data.floorStates[1].enemies.push(JSON.parse(JSON.stringify(e)));
   out[id][v]=outcome(JSON.stringify(d),s=>s.floorStates[1].enemies.find(u=>u.id===e.id));
  }
 }
 return out;
}

export function specialMatrices(){return {interrupt:interruptTable(),blocks:blocksTable(),tick:tickTable(),load:loadTable(),archived:archivedTable()};}
export function matrixDifferences(before,after){
 const out=[];
 for(const table of new Set([...Object.keys(before),...Object.keys(after)]))for(const row of new Set([...Object.keys(before[table]||{}),...Object.keys(after[table]||{})]))
  for(const col of new Set([...Object.keys(before[table]?.[row]||{}),...Object.keys(after[table]?.[row]||{})])){const a=before[table]?.[row]?.[col],b=after[table]?.[row]?.[col];if(a!==b)out.push({table,row,col,a,b});}
 return out;
}
const count=m=>Object.values(m).reduce((n,t)=>n+Object.values(t).reduce((k,r)=>k+Object.keys(r).length,0),0);

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const now=specialMatrices();
 if(process.argv.includes('--write')){writeFileSync(MATRIX_FIXTURE,JSON.stringify(now,null,1)+'\n');console.log(`special matrices written: ${count(now)} cells`);process.exit(0);}
 const base=JSON.parse(readFileSync(MATRIX_FIXTURE,'utf8')),diff=matrixDifferences(base,now);
 if(diff.length){console.error(`${diff.length} cells differ from tests/fixtures/special-matrix.json:`);for(const d of diff.slice(0,40))console.error(`  ${d.table} ${d.row} ${d.col}:\n    ${d.a}\n -> ${d.b}`);process.exit(1);}
 console.log(`special matrices identical: ${count(now)} cells`);
}
