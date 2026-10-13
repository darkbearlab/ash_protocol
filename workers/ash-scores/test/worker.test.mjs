// The whole API against an in-memory D1 (node:sqlite) and the real game engine (.engines/, built by scripts/engines.mjs),
// with a ranked run the clear bot played under the ranked-daily rules (fixtures/: day 2026-10-13, seed 14, loyalist).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {memoryD1} from './d1-sqlite.mjs';
import * as db from '../src/db.js';

const NOW=Date.parse('2026-10-13T06:00:00Z');let clock=NOW;Date.now=()=>clock;
const worker=(await import('../src/index.js')).default;
const {ENGINES}=await import('../src/engines.generated.js');
const migrations=fileURLToPath(new URL('../migrations',import.meta.url));
const fixtureGz=readFileSync(new URL('./fixtures/ranked-3.224.0-bulwark-dead-f2.json.gz',import.meta.url));
const fixture=JSON.parse(gunzipSync(fixtureGz).toString());
const version=fixture.log.build;
const skip=ENGINES[version]?false:`no engine ${version} in engines.json`;
const ITCH='https://html-classic.itch.zone',KEY='k'.repeat(30),OTHER='o'.repeat(30);

function setup(vars={}){
 clock=NOW;
 const DB=memoryD1(migrations),s=fixture.spec;
 DB.raw.prepare('INSERT INTO days (day,variant,spec,seed,mission,facility,difficulty,created_at) VALUES (?,?,?,?,?,?,?,?)').run(s.day,s.variant,JSON.stringify(s),s.seed,s.mission,s.facility,s.difficulty,0);
 return {DB,DAILY_SECRET:'test-secret',ALLOWED_ORIGINS:`https://darkbearlab.github.io,${ITCH}`,VARIANTS:'standard',MIN_MS_PER_OP:'0',SUBMIT_GRACE_HOURS:'6',...vars};
}
const call=async(env,method,path,body,origin=ITCH)=>{
 const res=await worker.fetch(new Request(`https://ash-scores.test${path}`,{method,headers:{'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':'203.0.113.7'},body:body?JSON.stringify(body):undefined}),env);
 const text=await res.text();
 return {status:res.status,cors:res.headers.get('Access-Control-Allow-Origin'),data:text?JSON.parse(text):null};
};
const b64=obj=>gzipSync(JSON.stringify(obj)).toString('base64');
const ticket=async(env,playerKey=KEY)=>(await call(env,'POST','/v1/daily/tickets',{playerKey})).data.ticket;
const submit=(env,t,over={})=>call(env,'POST','/v1/daily/runs',{ticket:t,playerKey:KEY,name:'abc',version,channel:'itch',language:fixture.language,log:b64(fixture.log),...over});

test('CORS answers only the game pages',async()=>{
 const env=setup();
 const ok=await call(env,'GET','/v1/health');
 assert.equal(ok.status,200);assert.equal(ok.cors,ITCH);assert.equal(ok.data.origin,ITCH);assert.equal(ok.data.originAllowed,true);
 assert.equal((await call(env,'GET','/v1/health',null,'https://darkbearlab.github.io')).cors,'https://darkbearlab.github.io');
 const evil=await call(env,'GET','/v1/health',null,'https://evil.example');
 assert.equal(evil.cors,null);assert.equal(evil.data.originAllowed,false);
 assert.equal((await call(env,'OPTIONS','/v1/daily/runs',null)).status,204);
 assert.equal((await call(env,'OPTIONS','/v1/daily/runs',null,'https://evil.example')).status,403);
});

test('the day spec is the stored one, and an unset secret stops everything',async()=>{
 const env=setup();
 const r=await call(env,'GET','/v1/daily');
 assert.deepEqual(r.data.spec,fixture.spec);
 assert.equal((await call({...env,DAILY_SECRET:''},'GET','/v1/daily')).status,503);
});

test('a played run is replayed, ranked and kept as the player\'s best',{skip},async()=>{
 const env=setup();
 const r=await submit(env,await ticket(env));
 assert.equal(r.status,200,JSON.stringify(r.data));
 assert.deepEqual({status:r.data.result.status,deepest:r.data.result.deepest,character:r.data.result.character},{status:'dead',deepest:2,character:'bulwark'});
 assert.equal(r.data.best.rank,1);assert.equal(r.data.best.name,'ABC');assert.equal(r.data.newBest,true);
 const board=await call(env,'GET',`/v1/daily/leaderboard?day=2026-10-13&version=${version}`);
 assert.equal(board.data.entries.length,1);assert.equal(board.data.entries[0].verified,true);assert.equal(board.data.entries[0].tag.length,4);
 const boards=await call(env,'GET','/v1/daily/boards?day=2026-10-13');
 assert.deepEqual(boards.data.boards,[{version,players:1}]);
 const stored=env.DB.raw.prepare('SELECT ops,length(log) AS bytes,verified FROM runs').get();
 assert.equal(stored.ops,fixture.log.ops.length);assert.ok(stored.bytes>1000);assert.equal(stored.verified,1);
});

test('one ticket, one run, one player',{skip},async()=>{
 const env=setup();
 const t=await ticket(env);
 assert.equal((await submit(env,t,{playerKey:OTHER})).status,403);
 assert.equal((await submit(env,t)).status,200);
 clock+=60000;
 assert.equal((await submit(env,t)).status,409);
});

test('altered logs are refused, and so are runs made too fast',{skip},async()=>{
 const env=setup();
 const startHp=structuredClone(fixture.log);const s=JSON.parse(startHp.start);s.data.player.hp+=50;startHp.start=JSON.stringify(s);
 assert.equal((await submit(env,await ticket(env),{log:b64(startHp)})).data.reason,'start');
 clock+=60000;
 const op=structuredClone(fixture.log);const i=op.ops.findIndex(o=>o.op==='action'&&o.type==='move');op.ops[i]={...op.ops[i],arg:op.ops[i].arg.map(v=>-v)};
 assert.equal((await submit(env,await ticket(env),{log:b64(op)})).data.reason,'replay');
 clock+=60000;
 const params=structuredClone(fixture.log);params.params.seed+=1;
 assert.equal((await submit(env,await ticket(env),{log:b64(params)})).data.reason,'params');
 clock+=60000;
 const cut=structuredClone(fixture.log);cut.ops=cut.ops.slice(0,100);
 assert.equal((await submit(env,await ticket(env),{log:b64(cut)})).data.reason,'unfinished');
 clock+=60000;
 const lang=await submit(env,await ticket(env),{language:fixture.language==='en'?'zh-TW':'en'});
 assert.equal(lang.data.reason,'start');
 const slow=setup({MIN_MS_PER_OP:'1000'});
 assert.equal((await submit(slow,await ticket(slow))).data.error,'too-fast');
});

test('requests that are malformed or out of time are refused',async()=>{
 const env=setup();
 const t=await ticket(env);
 assert.equal((await submit(env,t,{name:'ABCD'})).data.error,'name');
 assert.equal((await submit(env,t,{version:'9.9.9'})).data.error,'version');
 assert.equal((await submit(env,t,{channel:'steam'})).data.error,'channel');
 assert.equal((await submit(env,'x.y')).data.error,'ticket');
 assert.equal((await call(env,'POST','/v1/daily/tickets',{playerKey:'short'})).data.error,'playerKey');
 clock=Date.parse('2026-10-14T00:00:01Z');   // the day ended at 16:00Z, the six-hour grace at 22:00Z
 assert.equal((await submit(env,t)).data.error,'closed');
 assert.equal((await call(env,'GET','/v1/daily/leaderboard?day=2026-13-01&version=1.0.0')).data.error,'day');
});

test('a player may open thirty runs a day',async()=>{
 const env=setup();
 for(let i=0;i<30;i++)assert.equal((await call(env,'POST','/v1/daily/tickets',{playerKey:KEY})).status,200,`ticket ${i}`);
 assert.equal((await call(env,'POST','/v1/daily/tickets',{playerKey:KEY})).data.error,'rate');
});

test('a worse run never replaces the best; hidden players leave the board',async()=>{
 const env=setup(),board={day:'2026-10-13',variant:'standard',version};
 for(const [id,p,key] of [[1,'a'.repeat(32),500],[2,'a'.repeat(32),400],[3,'b'.repeat(32),450]]){
  env.DB.raw.prepare(`INSERT INTO runs (id,day,variant,version,player_id,ticket_id,name,channel,language,character,status,deepest,turns,kills,level,score_key,duration_s,ops,log_sha256,verified,created_at)
   VALUES (?,?,?,?,?,?,'AAA','web','en','soldier','dead',1,1,1,1,?,1,1,'x',1,?)`).run(id,board.day,board.variant,board.version,p,`t${id}`,key,id);
  env.DB.raw.prepare('INSERT OR IGNORE INTO players (id,name,created_at,last_seen) VALUES (?,?,0,0)').run(p,'AAA');
  await db.keepBest(env,{...board,player:p,runId:id,scoreKey:key,createdAt:id});
 }
 assert.deepEqual((await db.board(env,{...board,limit:10})).map(r=>r.score_key),[500,450]);
 env.DB.raw.prepare('UPDATE players SET hidden=1 WHERE id=?').run('a'.repeat(32));
 assert.deepEqual((await db.board(env,{...board,limit:10})).map(r=>r.score_key),[450]);
 assert.equal((await db.standing(env,{...board,player:'b'.repeat(32)})).rank,1);
});
