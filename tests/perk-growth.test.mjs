import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,PERKS} from '../src/engine.js';
import {levelCost,perkDef} from '../src/perks.js';
import {MAX_LEVEL} from '../src/endless.js';

// 3.138.0 (user decisions 2026-09-19, docs/PERK_GROWTH.md): picks come at 2L+3 experience a level, the direct-number
// perks give less per rank, and draws lean on owned perks 30% of the time. Runs started earlier keep the classic rules.
const costToCap=g=>{let n=0;for(let l=1;l<MAX_LEVEL;l++)n+=levelCost(g,l);return n;};
const pick=(g,id)=>{g.pendingPerks=1;g.player.level=Math.max(g.player.level,g.perkPicks+2);g.perkDraft={index:g.perkPicks,ids:[id]};return g.choosePerk(id);};

test('a new run levels at 2L+3 experience; a run from before 3.138.0 keeps L+2',()=>{
 const g=new Game(3);assert.equal(g.perkRules,2);assert.deepEqual([1,2,5,19].map(l=>levelCost(g,l)),[5,7,13,41]);assert.equal(costToCap(g),437);
 const raw=JSON.parse(g.serialize());raw.version=64;delete raw.data.perkRules;const old=Game.restore(JSON.stringify(raw));
 assert.equal(old.perkRules,1);assert.deepEqual([1,2,5,19].map(l=>levelCost(old,l)),[3,4,7,21]);assert.equal(costToCap(old),228);
 const bad=JSON.parse(g.serialize());bad.data.perkRules=3;assert.equal(Game.restore(JSON.stringify(bad)),null);
 assert.equal(Game.restore(g.serialize()).perkRules,2);
});

test('the direct-number perks give less per rank; the utility perks are unchanged',()=>{
 const want={damage:[4,6],health:[20,25],armor:[2,3],blast:[12,18],accuracy:[5,8],evasion:[5,8]};
 const now=new Game(3),old=new Game(3);old.perkRules=1;
 for(const [id,[a,b]] of Object.entries(want)){const o=PERKS.find(x=>x.id===id);assert.equal(perkDef(now,o).amount,a,id);assert.equal(perkDef(old,o).amount,b,id);assert.notEqual(perkDef(now,o).text,perkDef(old,o).text,`${id} text follows the rules`);}
 assert.equal(perkDef(now,PERKS.find(x=>x.id==='health')).heal,30);assert.equal(perkDef(old,PERKS.find(x=>x.id==='health')).heal,40);
 for(const id of ['med','scavenger','medic','hazmat','melee','plating'])assert.equal(PERKS.find(x=>x.id===id).classic,undefined,`${id} is a utility perk`);
});

test('a pick applies the run\'s own rules, and the offered card shows the matching text',()=>{
 const now=new Game(3),old=new Game(3);old.perkRules=1;
 const armor=[now,old].map(g=>g.player.armor);assert.ok(pick(now,'armor'));assert.ok(pick(old,'armor'));
 assert.equal(now.player.armor-armor[0],2);assert.equal(old.player.armor-armor[1],3);
 const card=g=>{g.pendingPerks=1;g.player.level=Math.max(g.player.level,g.perkPicks+2);g.perkDraft={index:g.perkPicks,ids:['evasion']};return g.perkChoices[0].text;};
 assert.match(card(now),/5 個百分點/);assert.match(card(old),/8 個百分點/);
});
