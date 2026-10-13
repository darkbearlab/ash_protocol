import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,dayStart,dayEnd,validDay,deriveSpec,scoreKey,validName,normalName,validPlayerKey} from '../src/rules.js';
import {signTicket,readTicket} from '../src/tickets.js';
import {gunzipText} from '../src/crypto.js';
import {rankedSpecProblem} from '../../../src/ranked-daily.js';

test('a day runs midnight to midnight in Taipei',()=>{
 assert.equal(dayKey(Date.parse('2026-10-12T15:59:59Z')),'2026-10-12');
 assert.equal(dayKey(Date.parse('2026-10-12T16:00:00Z')),'2026-10-13');
 assert.equal(dayStart('2026-10-13'),Date.parse('2026-10-12T16:00:00Z'));
 assert.equal(dayEnd('2026-10-13')-dayStart('2026-10-13'),86400000);
 assert.ok(validDay('2026-02-28'));assert.ok(!validDay('2026-02-30'));assert.ok(!validDay('20261013'));
});

test('the daily spec comes from the secret, is valid for the game and differs day to day',async()=>{
 const a=await deriveSpec('s1','2026-10-13','standard'),b=await deriveSpec('s1','2026-10-13','standard');
 assert.deepEqual(a,b);
 assert.equal(rankedSpecProblem(a),'');
 assert.deepEqual({mission:a.mission,difficulty:a.difficulty,realMode:a.realMode},{mission:'extraction',difficulty:'hard',realMode:true});
 const seeds=new Set();for(let d=1;d<=28;d++)seeds.add((await deriveSpec('s1',`2026-11-${String(d).padStart(2,'0')}`,'standard')).seed);
 assert.equal(seeds.size,28);
 assert.notEqual((await deriveSpec('s2','2026-10-13','standard')).seed,a.seed);
 await assert.rejects(deriveSpec('s1','2026-10-13','nope'));
});

test('board order: extracted, then deeper, then fewer turns, then more kills',()=>{
 const k=(status,deepest,turns,kills)=>scoreKey({status,deepest,turns,kills});
 assert.ok(k('won',6,3000,10)>k('dead',6,500,300));
 assert.ok(k('dead',5,3000,0)>k('dead',4,100,300));
 assert.ok(k('won',6,1800,100)>k('won',6,1900,300));
 assert.ok(k('won',6,1800,101)>k('won',6,1800,100));
 assert.ok(Number.isSafeInteger(k('won',99,0,99999)));
});

test('names are three characters, A-Z and 0-9',()=>{
 assert.ok(validName(normalName(' abc ')));assert.ok(validName('A1Z'));
 for(const n of ['AB','ABCD','A B','ÄBC','ab!',''])assert.ok(!validName(normalName(n)),n);
 assert.ok(validPlayerKey('a'.repeat(22)));assert.ok(!validPlayerKey('short'));assert.ok(!validPlayerKey('x'.repeat(23)+'!'));
});

test('tickets: signed, and refused when altered or signed with another secret',async()=>{
 const t={id:'abc',player:'0'.repeat(32),day:'2026-10-13',variant:'standard',iat:1};
 const s=await signTicket('k',t);
 assert.deepEqual(await readTicket('k',s),{v:1,...t});
 assert.equal(await readTicket('other',s),null);
 const [body,sig]=s.split('.');
 assert.equal(await readTicket('k',`${body}x.${sig}`),null);
 assert.equal(await readTicket('k',`${body}.${sig.slice(0,-1)}A`),null);
 assert.equal(await readTicket('k','nonsense'),null);
});

test('gunzip stops at its ceiling',async()=>{
 const gz=new Uint8Array(await new Response(new Blob(['x'.repeat(100000)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 assert.equal((await gunzipText(gz,200000)).length,100000);
 await assert.rejects(gunzipText(gz,1000));
});
