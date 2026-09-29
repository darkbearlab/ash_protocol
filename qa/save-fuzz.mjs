// Save fuzz (3.206.1, from the 3.205.0 reviewer's script): random play on real generated floors, and after every
// action three checks: the save from before the action loads (Game.restore), a restored copy given the same action
// ends in exactly the same state as the original, and the save after the action loads. This is the check that found
// the worst bugs of 3.203–3.205 (saves refused after a telegraph, stale intents, tuning changes), so run it before
// handing off anything that adds persisted state or enemy specials. docs/CHECKLIST.md lists when.
//   node qa/save-fuzz.mjs                                 every faction, floors 1-6, 4 seeds, 3 classes, 80 actions
//   node qa/save-fuzz.mjs --faction swarm --floors 3,6 --seeds 10 --steps 150 --classes soldier,ninja
//   node qa/save-fuzz.mjs --near-boss                     start boss floors 4-6 tiles from the boss
//   node qa/save-fuzz.mjs --seed-from 3 --seeds 3         only seed 3, to reproduce one run
//   node qa/save-fuzz.mjs --out <dir>                     write each failing save there as JSON to reproduce it
// Several factions run as parallel child processes (one each). Exits 1 on any refused save or divergence.
// Deterministic: the same arguments play the same actions.
import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Game,distance} from '../src/engine.js';
import {random} from '../src/world.js';

const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const list=(name,fallback)=>String(arg(name,fallback)).split(',').map(s=>s.trim()).filter(Boolean);
const FACTIONS=list('faction','loyalist,rebel,swarm,legacy'),FLOORS=list('floors','1,2,3,4,5,6').map(Number);
const SEEDS=Number(arg('seeds',4)),FROM=Number(arg('seed-from',1)),STEPS=Number(arg('steps',80)),CLASSES=list('classes','soldier,recon,engineer');
const NEAR_BOSS=process.argv.includes('--near-boss'),OUT=arg('out',null);
const stats={runs:0,steps:0,refusedBefore:0,refusedAfter:0,diverged:0,skipped:0};
if(FACTIONS.length>1&&!process.argv.includes('--child')){
 // One child per faction, in parallel; each prints its failures and a last line of JSON stats.
 const rest=process.argv.slice(2).filter((a,i,all)=>a!=='--faction'&&all[i-1]!=='--faction');
 const runs=await Promise.all(FACTIONS.map(f=>new Promise(done=>{
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),...rest,'--faction',f,'--child']);let out='';
  child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>out+=d);child.on('close',code=>done({code,out}));
 })));
 for(const {out} of runs){const lines=out.trim().split(/\r?\n/);for(const l of lines.slice(0,-1))console.log(l);try{const s=JSON.parse(lines.at(-1));for(const k of Object.keys(stats))stats[k]+=s[k]||0;}catch{console.log(out);stats.skipped++;}}
 console.log(JSON.stringify(stats));
 process.exit(runs.some(r=>r.code!==0)?1:0);
}
const failures=[];
// Compare values, not key order: a restored game can hold the same fields in a different insertion order.
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const strip=json=>{const s=JSON.parse(json);delete s.data.logs;return JSON.stringify(canon(s));};
function fail(kind,ctx,save){
 stats[kind]++;failures.push({kind,...ctx});
 if(failures.length<=8)console.log(kind.toUpperCase(),JSON.stringify(ctx));
 if(OUT&&save){mkdirSync(OUT,{recursive:true});writeFileSync(join(OUT,`${kind}-${ctx.faction}-f${ctx.floor}-s${ctx.seed}-${ctx.cls}-${ctx.step}.json`),save);}
}
function pickAction(g,rng){
 const p=g.player,seen=g.visibleEnemies||[],r=rng();
 if(r<.40){const d=[[0,1],[1,0],[0,-1],[-1,0]][Math.floor(rng()*4)];return ['move',d];}
 if(r<.72&&seen.length){const e=seen[Math.floor(rng()*seen.length)];g.target=e.id;return ['fire',{x:e.x,y:e.y}];}
 if(r<.78&&seen.length&&p.prepared?.grenade){const e=seen[Math.floor(rng()*seen.length)];return ['grenade',{x:e.x,y:e.y}];}
 if(r<.82&&p.prepared?.skill)return ['skill',p.prepared.skill];
 if(r<.86&&p.owned?.length>1)return ['weapon'];
 if(r<.93)return ['reload'];
 return ['wait'];
}
for(const faction of FACTIONS)for(const floor of FLOORS)for(let seed=FROM;seed<=SEEDS;seed++)for(const cls of CLASSES){
 let g;
 try{g=new Game(seed,[],0,cls,'onyx','extraction',{facilityFaction:faction});g.floor=floor;g.loadFloor();}
 catch{stats.skipped++;continue;}
 stats.runs++;
 Object.assign(g.player,{hp:5000,maxHp:5000});
 if(NEAR_BOSS){
  const boss=g.enemies.find(e=>e.boss||e.isBoss||/boss|warden|hive_|designator|gunline|arsonist/.test(e.type));
  if(boss){
   const spots=[];for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid.length;x++)if(g.grid[y][x]===1&&!g.solid(x,y)&&!g.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)&&distance({x,y},boss)>=4&&distance({x,y},boss)<=6)spots.push({x,y});
   if(spots.length){Object.assign(g.player,spots[0]);boss.alert=true;g.reveal();}
  }
 }
 const rng=random(seed*7919+floor*31+cls.length);
 for(let step=0;step<STEPS&&g.status==='playing';step++){
  stats.steps++;
  const ctx={faction,floor,seed,cls,step};
  const before=g.serialize(),clone=Game.restore(before);
  if(!clone){fail('refusedBefore',ctx,before);break;}
  const act=pickAction(g,rng);ctx.action=act;
  clone.target=g.target;
  try{g.action(...act);clone.action(...act);}catch(error){fail('diverged',{...ctx,error:String(error?.message||error)},before);break;}
  const a=g.serialize();
  if(strip(a)!==strip(clone.serialize())){fail('diverged',ctx,before);break;}
  if(!Game.restore(a)){fail('refusedAfter',ctx,a);break;}
  if(g.player.hp<1000)g.player.hp=5000;
 }
}
console.log(JSON.stringify(stats));
process.exit(failures.length?1:0);
