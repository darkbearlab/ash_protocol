// ash-scores: the ranked-daily leaderboard (README.md). Routes:
//   GET  /v1/health                         the Origin the server saw, the game versions it can check, today's day
//   GET  /v1/daily?variant=                 today's spec
//   POST /v1/daily/tickets                  {playerKey, variant?} → a run ticket and the spec
//   POST /v1/daily/runs                     {ticket, playerKey, name, version, channel, language, log} → rank
//   GET  /v1/daily/leaderboard?day=&variant=&version=&limit=&player=
//   GET  /v1/daily/boards?day=&variant=     the versions with a board that day
// A submitted run is played back with the game engine of its version (src/engines.generated.js) from a start rebuilt
// from the day's spec, and ranked by what the playback says.
import {json,fail,corsHeaders,allowedOrigin} from './http.js';
import {dayKey,dayEnd,validDay,VARIANTS,LIMITS,normalName,validName,validPlayerKey,validPlayerId,validVersion,CHANNELS,LANGUAGES,scoreKey,MAX_LOG_GZ,MAX_LOG_JSON,MAX_BODY} from './rules.js';
import {signTicket,readTicket} from './tickets.js';
import {sha256,hex,b64Decode,randomId,gunzipText} from './crypto.js';
import * as db from './db.js';
import {ENGINES} from './engines.generated.js';

const playerIdOf=async key=>hex(await sha256(`ash-player|${key}`)).slice(0,32);
// The engine copy for a version and language. The game reads ASH_LANGUAGE when its modules first load (src/i18n.js), so
// copies load one at a time with it set, and stay loaded for the isolate's life.
const engines=new Map();let loading=Promise.resolve();
function engineFor(version,language){
 const entry=ENGINES[version]?.[language];if(!entry)return null;
 const key=`${version}|${language}`;
 if(!engines.has(key)){
  const p=loading.then(async()=>{
   const env=((globalThis.process??={}).env??={}),before=env.ASH_LANGUAGE;env.ASH_LANGUAGE=language;
   try{return await entry();}finally{if(before===undefined)delete env.ASH_LANGUAGE;else env.ASH_LANGUAGE=before;}
  });
  loading=p.catch(()=>{});engines.set(key,p);
 }
 return engines.get(key);
}
const variantOf=(env,v)=>{const allowed=(env.VARIANTS||'standard').split(',').map(s=>s.trim());const id=v||'standard';return allowed.includes(id)&&VARIANTS[id]?id:null;};
async function body(request){
 const size=Number(request.headers.get('Content-Length')||0);if(size>MAX_BODY)return null;
 const text=await request.text();if(text.length>MAX_BODY)return null;
 try{const v=JSON.parse(text);return v&&typeof v==='object'?v:null;}catch{return null;}
}
const ipKey=async(env,request)=>hex(await sha256(`${request.headers.get('CF-Connecting-IP')||'none'}|${dayKey()}|${env.DAILY_SECRET}`)).slice(0,24);
const publicRow=(r,i)=>({rank:r.rank??i+1,name:r.name,tag:r.player.slice(0,4),character:r.character,status:r.status,deepest:r.deepest,turns:r.turns,kills:r.kills,level:r.level,channel:r.channel,verified:r.verified===1});

async function health(env,request){
 return json(env,request,200,{ok:true,service:'ash-scores',origin:request.headers.get('Origin'),originAllowed:Boolean(allowedOrigin(env,request.headers.get('Origin'))),versions:Object.keys(ENGINES),day:dayKey(),time:Date.now()});
}
async function daily(env,request,url){
 const variant=variantOf(env,url.searchParams.get('variant'));if(!variant)return fail(env,request,400,'variant');
 const day=dayKey(),spec=await db.daySpec(env,day,variant);
 return json(env,request,200,{ok:true,spec,endsAt:dayEnd(day),versions:Object.keys(ENGINES)});
}
async function tickets(env,request){
 const b=await body(request);if(!b)return fail(env,request,400,'body');
 if(!validPlayerKey(b.playerKey))return fail(env,request,400,'playerKey');
 const variant=variantOf(env,b.variant);if(!variant)return fail(env,request,400,'variant');
 const player=await playerIdOf(b.playerKey),now=Date.now(),day=dayKey(now);
 if(!await db.hit(env,await ipKey(env,request),LIMITS.ipMinute,now)||!await db.hit(env,`${player}:${day}`,LIMITS.ticketsPerDay,now))return fail(env,request,429,'rate');
 const spec=await db.daySpec(env,day,variant),t={id:randomId(),player,day,variant,iat:now};
 await db.addTicket(env,t);
 return json(env,request,200,{ok:true,ticket:await signTicket(env.DAILY_SECRET,t),spec,endsAt:dayEnd(day),submitBy:dayEnd(day)+Number(env.SUBMIT_GRACE_HOURS||6)*3600000});
}
async function runs(env,request){
 const b=await body(request);if(!b)return fail(env,request,400,'body');
 if(!validPlayerKey(b.playerKey))return fail(env,request,400,'playerKey');
 const name=normalName(b.name);if(!validName(name))return fail(env,request,400,'name');
 if(!validVersion(b.version))return fail(env,request,400,'version');
 if(!CHANNELS.includes(b.channel))return fail(env,request,400,'channel');
 if(!LANGUAGES.includes(b.language))return fail(env,request,400,'language');
 if(typeof b.log!=='string'||b.log.length>MAX_LOG_GZ*4/3+8)return fail(env,request,400,'log');
 const t=await readTicket(env.DAILY_SECRET,b.ticket);if(!t)return fail(env,request,400,'ticket');
 const player=await playerIdOf(b.playerKey),now=Date.now();
 if(t.player!==player)return fail(env,request,403,'ticket');
 if(now>dayEnd(t.day)+Number(env.SUBMIT_GRACE_HOURS||6)*3600000)return fail(env,request,410,'closed');
 if(!await db.hit(env,await ipKey(env,request),LIMITS.ipMinute,now)||!await db.hit(env,player,LIMITS.submitBurst,now)||!await db.hit(env,`${player}:${t.day}`,LIMITS.submitsPerDay,now))return fail(env,request,429,'rate');
 const load=engineFor(b.version,b.language);if(!load)return fail(env,request,400,'version',{versions:Object.keys(ENGINES)});
 let gz,log;
 try{gz=b64Decode(b.log);if(gz.length>MAX_LOG_GZ)throw 0;log=JSON.parse(await gunzipText(gz,MAX_LOG_JSON));}catch{return fail(env,request,400,'log');}
 if(!log||!Array.isArray(log.ops))return fail(env,request,400,'log');
 if(!await db.claimTicket(env,t,now))return fail(env,request,409,'ticket-used');
 // A run takes time to play by hand: refuse logs far faster than anyone plays (MIN_MS_PER_OP per step).
 const durationS=Math.round((now-t.iat)/1000);
 if(now-t.iat<log.ops.length*Number(env.MIN_MS_PER_OP||150))return fail(env,request,422,'too-fast');
 const spec=await db.daySpec(env,t.day,t.variant),engine=await load;
 const check=engine.verifyRankedRun(spec,log,{language:b.language});
 if(!check.ok)return fail(env,request,422,'rejected',{reason:check.reason});
 const r=check.result,key=scoreKey(r);
 await db.touchPlayer(env,player,name,now);
 const runId=await db.addRun(env,{day:t.day,variant:t.variant,version:b.version,player,ticket:t.id,name,channel:b.channel,language:b.language,character:r.character,
  status:r.status,deepest:r.deepest,turns:r.turns,kills:r.kills,level:r.level,scoreKey:key,durationS,ops:log.ops.length,logSha256:hex(await sha256(gz)),log:gz,createdAt:now});
 const board={day:t.day,variant:t.variant,version:b.version};
 await db.keepBest(env,{...board,player,runId,scoreKey:key,createdAt:now});
 const me=await db.standing(env,{...board,player});
 return json(env,request,200,{ok:true,board,result:r,best:me&&publicRow(me),newBest:Boolean(me)&&me.score_key===key&&me.created_at===now});
}
async function leaderboard(env,request,url){
 const day=url.searchParams.get('day')||dayKey(),variant=variantOf(env,url.searchParams.get('variant')),version=url.searchParams.get('version');
 if(!validDay(day))return fail(env,request,400,'day');
 if(!variant)return fail(env,request,400,'variant');
 if(!validVersion(version))return fail(env,request,400,'version');
 const limit=Math.max(1,Math.min(100,Number(url.searchParams.get('limit'))||50)),player=url.searchParams.get('player');
 const rows=await db.board(env,{day,variant,version,limit});
 const me=validPlayerId(player)?await db.standing(env,{day,variant,version,player}):null;
 return json(env,request,200,{ok:true,board:{day,variant,version},entries:rows.map(publicRow),me:me&&publicRow(me)});
}
async function boards(env,request,url){
 const day=url.searchParams.get('day')||dayKey(),variant=variantOf(env,url.searchParams.get('variant'));
 if(!validDay(day))return fail(env,request,400,'day');
 if(!variant)return fail(env,request,400,'variant');
 return json(env,request,200,{ok:true,day,variant,boards:await db.boards(env,{day,variant})});
}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:allowedOrigin(env,request.headers.get('Origin'))?204:403,headers:corsHeaders(env,request)});
  if(!env.DAILY_SECRET)return fail(env,request,503,'not-configured');
  try{
   const route=`${request.method} ${url.pathname}`;
   if(route==='GET /v1/health')return await health(env,request);
   if(route==='GET /v1/daily')return await daily(env,request,url);
   if(route==='POST /v1/daily/tickets')return await tickets(env,request);
   if(route==='POST /v1/daily/runs')return await runs(env,request);
   if(route==='GET /v1/daily/leaderboard')return await leaderboard(env,request,url);
   if(route==='GET /v1/daily/boards')return await boards(env,request,url);
   return fail(env,request,404,'not-found');
  }catch(error){
   console.error('ash-scores',error?.stack||error);
   return fail(env,request,500,'server');
  }
 },
 async scheduled(event,env){await db.sweep(env);},
};
