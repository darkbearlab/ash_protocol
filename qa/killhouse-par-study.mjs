// Kill house par study (Claude, 3.89.3; docs/KILLHOUSE.md section 10). An invincible bot kills any purge target it can
// see within weapon range in one turn (100% hit, near-infinite damage). Otherwise it commits to the target with the
// shortest walk to a firing position, sets it aside after 20 turns without progress, and finally walks onto the exit.
// It measures how many arcade turns a near-perfect run needs; the 130-turn full speed bonus comes from these numbers.
//   node qa/killhouse-par-study.mjs [root=.] [seeds=30] [character=soldier]   DEBUG_SEED=n prints one seed's decisions
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.'),seeds=Number(process.argv[3]||30),character=process.argv[4]||'soldier';
const url=p=>pathToFileURL(resolve(root,p)).href;
const {createKillhouse}=await import(url('src/killhouse.js'));
const {distance}=await import(url('src/world.js'));
const {barrierBetween}=await import(url('src/barriers.js'));
const DEBUG=process.env.DEBUG_SEED===undefined?null:Number(process.env.DEBUG_SEED);

const key=p=>`${p.x},${p.y}`;
function route(g,from,goals,blockedEdges,blockedTiles){
 const goalSet=new Set(goals.map(key));if(goalSet.has(key(from)))return [];
 const prev=new Map([[key(from),null]]),queue=[from];
 while(queue.length){
  const c=queue.shift();
  if(goalSet.has(key(c))){const path=[];for(let n=c;n&&key(n)!==key(from);n=prev.get(key(n)))path.unshift(n);return path;}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const n={x:c.x+dx,y:c.y+dy},k=key(n);
   if(g.grid[n.y]?.[n.x]!==1||prev.has(k)||blockedTiles.has(k)||blockedEdges.has(`${key(c)}>${k}`))continue;
   prev.set(k,c);queue.push(n);
  }
 }
 return null;
}
function firingTiles(g,t,range,blockedTiles){
 const out=[];
 for(let y=t.y-range;y<=t.y+range;y++)for(let x=t.x-range;x<=t.x+range;x++){const q={x,y};if(g.grid[y]?.[x]!==1||blockedTiles.has(key(q))||distance(q,t)>range)continue;if(g.sight(q,t))out.push(q);}
 return out;
}

function run(seed,debug=false){
 const g=createKillhouse({mode:'arcade',seed,character});Object.assign(g.player,g.end);g.descend();
 const p=g.player,ids=new Set(g.purge.floors['2'].ids),start=g.turn;
 let blockedEdges=new Set(),clearedAt=null,iterations=0,reason='won',commit=null,bestLen=Infinity,noProgress=0,edgeClock=0;
 const setAside=new Map();
 const alive=()=>g.enemies.filter(e=>e.hp>0&&ids.has(e.id));
 const log=(...a)=>{if(debug&&iterations<120)console.log(`it${iterations} t${g.turn-start}`,...a);};
 while(g.status==='playing'){
  if(++iterations>6000){reason='iterations';break;}
  if(g.turn-start>800){reason='turn cap';break;}
  if(++edgeClock>25){blockedEdges=new Set();edgeClock=0;}
  p.hp=p.maxHp=999999;
  const targets=alive(),range=g.weapon?.range??7;
  if(!targets.length&&clearedAt===null)clearedAt=g.turn-start;
  const shot=targets.filter(e=>distance(p,e)<=range&&g.sight(p,e)).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(shot){log('shoot',shot.type,key(shot));g.hurt(shot,1e9,p);g.action('wait');if(shot===commit)commit=null;continue;}
  const blockedTiles=new Set(g.enemies.filter(e=>e.hp>0).map(key));if(targets.length)blockedTiles.add(key(g.end));
  let path;
  if(!targets.length)path=route(g,{x:p.x,y:p.y},[{x:g.end.x,y:g.end.y}],blockedEdges,blockedTiles);
  else{
   if(!commit||commit.hp<=0){
    const pool=targets.filter(t=>!(setAside.get(t.id)>g.turn)),choices=(pool.length?pool:targets).sort((a,b)=>distance(p,a)-distance(p,b)).slice(0,8);
    let best=null;for(const t of choices){const r=route(g,{x:p.x,y:p.y},firingTiles(g,t,range,blockedTiles),blockedEdges,blockedTiles);if(r&&(!best||r.length<best.r.length))best={t,r};}
    commit=best?.t||null;bestLen=best?best.r.length:Infinity;noProgress=0;path=best?.r||null;log('commit',commit?.type,commit&&key(commit),'len',bestLen);
   }else path=route(g,{x:p.x,y:p.y},firingTiles(g,commit,range,blockedTiles),blockedEdges,blockedTiles);
   if(path&&path.length<bestLen){bestLen=path.length;noProgress=0;}else if(++noProgress>20&&commit){setAside.set(commit.id,g.turn+30);commit=null;}
  }
  if(!path||!path.length){g.action('wait');if(!path&&!targets.length&&++noProgress>80){reason='no path to exit';break;}if(!path)commit=null;continue;}
  const next=path[0],from={x:p.x,y:p.y},turn=g.turn,ok=g.action('move',[next.x-p.x,next.y-p.y]);
  log('move',key(from),'->',key(next),'ok',ok,'now',key(p));
  if(!ok&&g.turn===turn){blockedEdges.add(`${key(from)}>${key(next)}`);continue;}
  const edge=barrierBetween(g.barriers,from,next);
  if(key(p)===key(from)&&g.status==='playing'&&!(edge?.type==='door'&&edge.open))blockedEdges.add(`${key(from)}>${key(next)}`);
 }
 const r=g.simulationResult,won=g.status==='won';
 return {seed,recipe:g.killhouseRecipe,quota:ids.size,clear:clearedAt,total:won?r.turns:null,status:g.status,reason:won?'won':reason,left:alive().length};
}

if(DEBUG!==null){console.log(JSON.stringify(run(DEBUG,true)));process.exit(0);}
const rows=[];for(let s=0;s<seeds;s++)rows.push(run(s));
const ok=rows.filter(r=>r.status==='won'&&r.left===0);
const pct=(arr,q)=>{const a=[...arr].sort((x,y)=>x-y);return a[Math.min(a.length-1,Math.floor(q*(a.length-1)))];};
console.log(JSON.stringify(rows.filter(r=>!(r.status==='won'&&r.left===0))));
console.log(`full clears ${ok.length}/${rows.length}`);
if(ok.length){
 const per=ok.map(r=>r.total/r.quota);
 console.log('total turns  min/median/p75/p90/max',Math.min(...ok.map(r=>r.total)),pct(ok.map(r=>r.total),.5),pct(ok.map(r=>r.total),.75),pct(ok.map(r=>r.total),.9),Math.max(...ok.map(r=>r.total)));
 console.log('clear turns  min/median/p75/max',Math.min(...ok.map(r=>r.clear)),pct(ok.map(r=>r.clear),.5),pct(ok.map(r=>r.clear),.75),Math.max(...ok.map(r=>r.clear)));
 console.log('turns per target min/median/p75/p90/max',Math.min(...per).toFixed(2),pct(per,.5).toFixed(2),pct(per,.75).toFixed(2),pct(per,.9).toFixed(2),Math.max(...per).toFixed(2));
 const byRecipe={};for(const r of ok){(byRecipe[r.recipe]??=[]).push(r);}
 for(const [k,v] of Object.entries(byRecipe))console.log(k,'n',v.length,'median total',pct(v.map(r=>r.total),.5),'max',Math.max(...v.map(r=>r.total)),'median per target',pct(v.map(r=>r.total/r.quota),.5).toFixed(2));
}
