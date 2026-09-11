import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,PERKS} from '../src/engine.js';
import {drawPerks,eligiblePerks} from '../src/perks.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
const ready=(seed=12)=>{const g=new Game(seed);g.pendingPerks=2;return g;};
const offer=(g,id)=>{g.pendingPerks=Math.max(1,g.pendingPerks);g.perkDraft={index:g.perkPicks,ids:[id]};return g.choosePerk(id);};
test('offers are distinct, reproducible, frozen across reads and reloads, and independent from battle RNG',()=>{
 const g=ready(),state=g.rng.state(),ids=g.perkChoices.map(o=>o.id);assert.equal(new Set(ids).size,3);
 const h=ready();for(let i=0;i<50;i++)h.rng();assert.deepEqual(h.perkChoices.map(o=>o.id),ids);
 assert.equal(g.rng.state(),state);assert.deepEqual(Game.restore(g.serialize()).perkChoices.map(o=>o.id),ids);
 const before=g.serialize();assert.equal(g.choosePerk(PERKS.find(o=>!ids.includes(o.id)).id),false);assert.equal(g.serialize(),before);
 assert.equal(g.choosePerk('__proto__'),false);
});
test('each pending pick advances its own index, re-evaluates caps, and takes no world turn or RNG',()=>{
 const g=ready(),turn=g.turn,state=g.rng.state();g.player.perks.accuracy=2;g.player.combatModifiers={rangedAccuracy:16};
 assert.ok(offer(g,'accuracy'));assert.equal(g.pendingPerks,1);assert.equal(g.perkPicks,1);assert.equal(g.perkDraft.index,1);
 assert.ok(!g.perkChoices.some(o=>o.id==='accuracy'));assert.equal(g.player.combatModifiers.rangedAccuracy,24);
 assert.ok(g.choosePerk(g.perkChoices[0].id));assert.equal(g.pendingPerks,0);assert.equal(g.perkDraft,null);assert.equal(g.turn,turn);assert.equal(g.rng.state(),state);
 assert.equal(g.choosePerk('med'),false);
});
test('seed samples exceed the old eight combinations and repeat bias favors unfinished permanent perks only',()=>{
 const sets=new Set();let repeat=0,plain=0;
 for(let seed=0;seed<2500;seed++){
  const g={seed,perkPicks:0,player:{character:'soldier',perks:{accuracy:1}}};const ids=drawPerks(g).ids;
  sets.add([...ids].sort().join(','));repeat+=ids.includes('accuracy');g.player.perks={med:10};plain+=drawPerks(g).ids.includes('med');
 }
 assert.ok(sets.size>100);assert.ok(repeat/2500>.65&&repeat/2500<.8);assert.ok(plain/2500>.2&&plain/2500<.35);
});
test('all permanent ranks capped; only supply remains and repeated resource rewards cannot softlock',()=>{
 const g=ready();for(const o of PERKS)if(o.cap!==null)g.player.perks[o.id]=o.cap;
 assert.deepEqual(g.perkChoices.map(o=>o.id),['med']);const meds=g.player.meds;assert.ok(g.choosePerk('med'));assert.ok(g.choosePerk('med'));assert.equal(g.player.meds,meds+4);
 g.pendingPerks=1;g.perkDraft={index:g.perkPicks,ids:['damage']};assert.equal(g.choosePerk('damage'),false);
});
test('new damage bonus is shared by burst while old per-bullet bonuses remain intact',()=>{
 const g=ready();g.player.bonus=12;const before=[0,2,6,7,8].map(i=>g.weaponDamage(i).min);assert.ok(offer(g,'damage'));
 assert.deepEqual([0,2,6,7,8].map((i,n)=>g.weaponDamage(i).min-before[n]),[6,3,2,6,2]);assert.equal(g.player.bonus,12);
});
test('health and armor are separate; melee changes only melee; max rank hazard protection reaches immunity',()=>{
 const g=ready(),p=g.player;const armor=p.armor,hp=p.maxHp;offer(g,'health');assert.equal(p.maxHp,hp+25);assert.equal(p.armor,armor);
 offer(g,'armor');assert.equal(p.armor,armor+3);offer(g,'melee');assert.deepEqual(p.combatModifiers,{meleeAccuracy:8,meleeEvasion:8});
 offer(g,'hazmat');offer(g,'hazmat');offer(g,'hazmat');assert.equal(p.hazmat,15);assert.ok(!eligiblePerks(g).some(o=>o.id==='hazmat'));
});
test('v27 migration infers exact historical ranks without replaying rewards, clamps neither stats nor over-cap history',()=>{
 const g=ready();Object.assign(g.player,{level:12,bonus:24,maxHp:150,hp:73,armor:3,blastBonus:18});
 const raw=JSON.parse(g.serialize());raw.version=27;delete raw.data.player.perks;delete raw.data.player.perkWeaponBonus;delete raw.data.perkPicks;delete raw.data.perkDraft;
 const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.deepEqual(h.player.perks,{damage:4,health:2,armor:1,blast:1});assert.equal(h.perkPicks,9);
 for(const k of ['bonus','maxHp','hp','armor','blastBonus','meds','scrap','reserve'])assert.equal(h.player[k],g.player[k]);
 assert.equal(h.rng.state(),g.rng.state());assert.equal(h.player.perkWeaponBonus,0);assert.ok(!h.perkChoices.some(o=>o.id==='damage'));
 assert.deepEqual(Game.restore(h.serialize()).player,h.player);
});
test('legacy custom stats exceeding available picks are not treated as known perk history',()=>{
 const g=new Game(9);g.player.maxHp=500;const raw=JSON.parse(g.serialize());raw.version=27;
 const h=Game.restore(JSON.stringify(raw));assert.deepEqual(h.player.perks,{});assert.equal(h.player.maxHp,500);
});
test('malformed current counters, rank IDs, duplicate/unknown offers and missing fields are rejected',()=>{
 const raw=JSON.parse(ready().serialize());
 for(const mutate of [d=>delete d.player.perks,d=>delete d.player.perkWeaponBonus,d=>d.player.perks={fake:1},d=>d.player.perks={damage:-1},d=>d.perkPicks=-1,d=>d.pendingPerks=-1,d=>d.perkDraft.ids=['med','med'],d=>d.perkDraft.ids=['fake'],d=>d.perkDraft.index++,d=>d.player.perkWeaponBonus=-1]){
  const x=structuredClone(raw);mutate(x.data);assert.equal(Game.restore(JSON.stringify(x)),null);
 }
});
test('full backup retains pending draft, ranks and new weapon bonus without reroll or duplicate effects',()=>{
 const g=ready();offer(g,'damage');const before=g.serialize(),b=makeBackup(g,normalizeProfile({}),'qa'),h=decodeBackup(JSON.stringify(b),'qa').game;
 assert.ok(h);assert.deepEqual(h.player.perks,g.player.perks);assert.equal(h.player.perkWeaponBonus,6);assert.deepEqual(h.perkChoices,g.perkChoices);assert.equal(g.serialize(),before);
});

test('accuracy and evasion ranks affect actual shared hit chances without changing melee channel',()=>{
 const g=ready(),p=g.player,e=g.enemies[0];p.x=5;p.y=5;e.x=6;e.y=5;
 p.combatModifiers={rangedAccuracy:-30};const before=g.accuracy(p,e).chance,melee=g.meleeAccuracy(p,e,70);offer(g,'accuracy');assert.equal(g.accuracy(p,e).chance,before+8);assert.equal(g.meleeAccuracy(p,e,70),melee);
 e.combatModifiers={rangedAccuracy:-30};const incoming=g.accuracy(e,p).chance;offer(g,'evasion');assert.equal(g.accuracy(e,p).chance,incoming-8);
});
test('v27 first local load backs up exact bytes and preserves the prepared offer on the next load',async()=>{
 const g=ready();const value=JSON.parse(g.serialize());value.version=27;delete value.data.player.perks;delete value.data.player.perkWeaponBonus;delete value.data.perkPicks;delete value.data.perkDraft;
 const raw=JSON.stringify(value),memory=new Map([['qa-ash-save',raw]]);globalThis.location={search:'?test=1'};globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const storage=await import('../src/storage.js?perks345');const h=storage.loadGame();assert.ok(h);assert.equal(memory.get('qa-ash-save-v27-backup'),raw);storage.saveGame(h);assert.deepEqual(storage.loadGame().perkChoices,h.perkChoices);assert.equal(memory.get('qa-ash-save-v27-backup'),raw);assert.equal(memory.has('ash-save'),false);
});
