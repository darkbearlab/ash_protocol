// D1 queries (migrations/0001_init.sql).
import {deriveSpec} from './rules.js';

// The day's spec: stored on its first request, read back afterwards.
export async function daySpec(env,day,variant){
 const row=await env.DB.prepare('SELECT spec FROM days WHERE day=? AND variant=?').bind(day,variant).first();
 if(row)return JSON.parse(row.spec);
 const s=await deriveSpec(env.DAILY_SECRET,day,variant);
 await env.DB.prepare('INSERT INTO days (day,variant,spec,seed,mission,facility,difficulty,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
  .bind(day,variant,JSON.stringify(s),s.seed,s.mission,s.facility,s.difficulty,Date.now()).run();
 const kept=await env.DB.prepare('SELECT spec FROM days WHERE day=? AND variant=?').bind(day,variant).first();
 return JSON.parse(kept.spec);
}

// One more request on a counter; true while the window's limit holds.
export async function hit(env,key,[name,seconds,limit],now=Date.now()){
 const slot=Math.floor(now/1000/seconds)*seconds;
 const row=await env.DB.prepare('INSERT INTO rate (key,slot,count) VALUES (?,?,1) ON CONFLICT(key,slot) DO UPDATE SET count=count+1 RETURNING count')
  .bind(`${name}:${key}`,slot).first();
 return row.count<=limit;
}

export async function touchPlayer(env,id,name,now=Date.now()){
 await env.DB.prepare('INSERT INTO players (id,name,created_at,last_seen) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,last_seen=excluded.last_seen')
  .bind(id,name,now,now).run();
}
export async function playerHidden(env,id){
 const row=await env.DB.prepare('SELECT hidden FROM players WHERE id=?').bind(id).first();
 return Boolean(row?.hidden);
}

export async function addTicket(env,{id,player,day,variant,iat}){
 await env.DB.prepare('INSERT INTO tickets (id,player_id,day,variant,issued_at) VALUES (?,?,?,?,?)').bind(id,player,day,variant,iat).run();
}
// Marks the ticket used; false when it is unknown, someone else's, or already used.
// A claim whose run was never stored (the request died during the replay, or the run was refused) can be claimed again
// after RECLAIM_MS; a stored run keeps its ticket for good.
export const RECLAIM_MS=3*60000;
export async function claimTicket(env,t,now=Date.now()){
 const r=await env.DB.prepare(`UPDATE tickets SET used_at=? WHERE id=? AND player_id=? AND day=? AND variant=? AND issued_at=?
  AND (used_at IS NULL OR (used_at<? AND NOT EXISTS (SELECT 1 FROM runs WHERE runs.ticket_id=tickets.id)))`)
  .bind(now,t.id,t.player,t.day,t.variant,t.iat,now-RECLAIM_MS).run();
 return r.meta.changes===1;
}
// The run already stored for a ticket, if any (a sender whose answer was lost asks again).
export const runForTicket=(env,ticket)=>env.DB.prepare('SELECT * FROM runs WHERE ticket_id=?').bind(ticket).first();

export async function addRun(env,r){
 const res=await env.DB.prepare(`INSERT INTO runs (day,variant,version,player_id,ticket_id,name,channel,language,character,status,deepest,turns,kills,level,
  score_key,duration_s,ops,log_sha256,log,verified,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`)
  .bind(r.day,r.variant,r.version,r.player,r.ticket,r.name,r.channel,r.language,r.character,r.status,r.deepest,r.turns,r.kills,r.level,
   r.scoreKey,r.durationS,r.ops,r.logSha256,r.log,1,r.createdAt).first();
 return res.id;
}
// Keeps the player's best run on the board; a run that is not better changes nothing.
export async function keepBest(env,{day,variant,version,player,runId,scoreKey,createdAt}){
 await env.DB.prepare(`INSERT INTO best (day,variant,version,player_id,run_id,score_key,created_at) VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(day,variant,version,player_id) DO UPDATE SET run_id=excluded.run_id,score_key=excluded.score_key,created_at=excluded.created_at
  WHERE excluded.score_key>best.score_key`).bind(day,variant,version,player,runId,scoreKey,createdAt).run();
}

const BOARD_ROW=`SELECT b.player_id AS player, b.score_key, b.created_at, r.name, r.character, r.status, r.deepest, r.turns, r.kills, r.level, r.channel, r.verified
 FROM best b JOIN runs r ON r.id=b.run_id JOIN players p ON p.id=b.player_id
 WHERE b.day=? AND b.variant=? AND b.version=? AND p.hidden=0`;
export async function board(env,{day,variant,version,limit}){
 const {results}=await env.DB.prepare(`${BOARD_ROW} ORDER BY b.score_key DESC, b.created_at ASC LIMIT ?`).bind(day,variant,version,limit).all();
 return results;
}
export async function standing(env,{day,variant,version,player}){
 const me=await env.DB.prepare(`${BOARD_ROW} AND b.player_id=?`).bind(day,variant,version,player).first();
 if(!me)return null;
 const ahead=await env.DB.prepare(`SELECT COUNT(*) AS n FROM best b JOIN players p ON p.id=b.player_id
  WHERE b.day=? AND b.variant=? AND b.version=? AND p.hidden=0 AND (b.score_key>? OR (b.score_key=? AND b.created_at<?))`)
  .bind(day,variant,version,me.score_key,me.score_key,me.created_at).first();
 return {...me,rank:ahead.n+1};
}
export async function boards(env,{day,variant}){
 const {results}=await env.DB.prepare(`SELECT b.version, COUNT(*) AS players FROM best b JOIN players p ON p.id=b.player_id
  WHERE b.day=? AND b.variant=? AND p.hidden=0 GROUP BY b.version ORDER BY b.version DESC`).bind(day,variant).all();
 return results;
}

// The nightly sweep (wrangler.toml [triggers]).
export async function sweep(env,now=Date.now()){
 const day=86400000;
 await env.DB.batch([
  env.DB.prepare('DELETE FROM rate WHERE slot<?').bind(Math.floor((now-2*day)/1000)),
  env.DB.prepare('DELETE FROM tickets WHERE used_at IS NULL AND issued_at<?').bind(now-3*day),
  env.DB.prepare('UPDATE runs SET log=NULL WHERE log IS NOT NULL AND created_at<?').bind(now-30*day),
 ]);
}
