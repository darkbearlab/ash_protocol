import test from 'node:test';
import assert from 'node:assert/strict';
import {DUTY_SPEAKERS,DEFAULT_DUTY,validDuty,localDateKey,dateDigit,dutyFor,validDutyRecord,nextDuty} from '../src/duty.js';
import {Game} from '../src/engine.js';
import {SAVE_VERSION} from '../src/data.js';
import {normalizeProfile} from '../src/progression.js';
import {validateProfile} from '../src/backup.js';

// 3.169.0 (user decision, docs/STORY.md 8): the day's comms officer comes from the last digit of the local date's
// hash — 0-5 Egret, 6-8 Wren, 9 the overseer — and the overseer only takes the day's first mission.
const dayWithDigit=digit=>{for(let d=0;d<4000;d++){const key=localDateKey(new Date(2026,0,1+d));if(dateDigit(key)===digit)return key;}throw new Error(`no day with digit ${digit}`);};

test('the date digit picks the officer, and the overseer only takes the first mission of his day',()=>{
 assert.deepEqual(DUTY_SPEAKERS,['egret','wren','overseer']);
 for(let digit=0;digit<=9;digit++){
  const key=dayWithDigit(digit);
  assert.equal(dutyFor(key,0),digit<=5?'egret':digit<=8?'wren':'overseer',`digit ${digit}`);
  assert.equal(dutyFor(key,3),digit<=5?'egret':digit<=8?'wren':'egret',`digit ${digit}, a later mission`);
 }
 assert.equal(localDateKey(new Date(2026,8,4)),'2026-09-04','the local date, zero padded');
});

test('the day record counts deployments and starts over on a new day or when damaged',()=>{
 const overseerDay=dayWithDigit(9),[y,m,d]=overseerDay.split('-').map(Number),at=new Date(y,m-1,d,20,0);
 const first=nextDuty(undefined,at);
 assert.deepEqual(first,{duty:'overseer',record:{date:overseerDay,count:1}});
 const second=nextDuty(first.record,at);
 assert.deepEqual(second,{duty:'egret',record:{date:overseerDay,count:2}},'deploying counted; he does not come back that day');
 const nextDay=nextDuty(second.record,new Date(y,m-1,d+1,9,0));
 assert.equal(nextDay.record.count,1,'a new day starts at one');
 assert.equal(nextDuty({date:'bad',count:-1},at).record.count,1,'a damaged record starts the day over');
 assert.ok(validDutyRecord({date:'2026-09-24',count:0}));
 for(const bad of [null,[],{date:'2026-9-24',count:1},{date:'2026-09-24',count:1.5},{date:'2026-09-24',count:-1}])assert.equal(validDutyRecord(bad),false);
});

test('a run keeps its officer through a save, and runs from SAVE 70 are Egret\'s',()=>{
 assert.equal(SAVE_VERSION,71);
 assert.equal(new Game(3).duty,DEFAULT_DUTY,'bare games and fixtures default to Egret');
 const g=new Game(3,[],0,'soldier','onyx','extraction',{duty:'wren'});
 assert.equal(g.duty,'wren');
 assert.equal(Game.restore(g.serialize()).duty,'wren');
 const old=JSON.parse(g.serialize());old.version=70;delete old.data.duty;
 assert.equal(Game.restore(JSON.stringify(old)).duty,'egret');
 const damaged=JSON.parse(g.serialize());damaged.data.duty='nobody';
 assert.equal(Game.restore(JSON.stringify(damaged))?.duty,'egret','a damaged officer does not cost the run');
 assert.equal(new Game(3,[],0,'soldier','onyx','extraction',{duty:'nobody'}).duty,'egret');
 assert.ok(validDuty('overseer')&&!validDuty('controller'));
});

test('the profile keeps a valid day record, drops a damaged one, and backups check it',()=>{
 const p=normalizeProfile();
 assert.equal(p.duty,undefined);
 assert.deepEqual(normalizeProfile({...p,duty:{date:'2026-09-24',count:2}}).duty,{date:'2026-09-24',count:2});
 assert.equal(normalizeProfile({...p,duty:{date:'x',count:2}}).duty,undefined);
 const saved=JSON.parse(JSON.stringify(normalizeProfile()));
 assert.deepEqual(validateProfile({...saved,duty:{date:'2026-09-24',count:1}}).duty,{date:'2026-09-24',count:1});
 assert.throws(()=>validateProfile({...saved,duty:{date:'x',count:1}}));
});

test('deploying picks the officer, counts toward the day and honours a forced officer',async()=>{
 const memory=new Map();
 globalThis.location={search:''};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 try{
  const s=await import('../src/storage.js?duty-rota');
  memory.set('ash-profile',JSON.stringify(normalizeProfile()));
  const today=localDateKey();
  const first=s.startCampaign({seed:4});
  assert.ok(validDuty(first.duty));
  assert.deepEqual(JSON.parse(memory.get('ash-profile')).duty,{date:today,count:1});
  const second=s.startCampaign({seed:5});
  assert.equal(second.duty,dutyFor(today,1));
  assert.equal(JSON.parse(memory.get('ash-profile')).duty.count,2);
  assert.equal(s.startCampaign({seed:6,duty:'overseer'}).duty,'overseer','test mode can force the officer');
  assert.equal(JSON.parse(memory.get('ash-profile')).duty.count,3,'a forced officer still counts the deployment');
 }finally{delete globalThis.localStorage;delete globalThis.location;}
});
