import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {t,setLanguage} from '../src/i18n.js';
import {COMMS_SPEAKERS} from '../src/comms.js';
import {STORIES,STORY_IDS} from '../src/story-data.js';
import {storyText} from '../src/story-text.js';
import {normalizeProfile} from '../src/progression.js';
import {grantUnlock,UNLOCK_SETTINGS} from '../src/unlock-catalog.js';
import {unlockPageMarkup,purchaseReason,storyReaderMarkup} from '../src/unlock-ui.js';

// 3.200.0 (user, 2026-09-29): the 22 facility records return, rewritten as bare documents, with the controllers'
// remarks for the comms bar and an English version of everything (the itch.io build stays frozen at 3.199.x).
const CJK=/[一-鿿　-〿＀-￯]/;

test('every record has its Chinese original, the English and the controllers\' remarks',()=>{
 assert.equal(STORIES.length,22);assert.equal(STORY_IDS.length,22);
 for(const s of STORIES){
  assert.ok(s.comms.length>=1,`${s.id} has remarks`);
  for(const c of s.comms){const who=COMMS_SPEAKERS[c.speaker];assert.ok(who,`${s.id}: ${c.speaker}`);assert.ok(c.expression?Object.hasOwn(who.expressions||{},c.expression):!who.expressions,`${s.id}: ${c.speaker}/${c.expression}`);assert.ok([...c.text].length<=40,`${s.id}: a remark fits the slim comms bar`);}
  assert.ok(s.en?.title&&s.en.body,`${s.id} has English`);assert.equal(s.en.comms.length,s.comms.length);
  for(const text of [s.en.title,s.en.body,...s.en.comms])assert.doesNotMatch(text,CJK,`${s.id}: no Chinese in the English`);
 }
});

test('a record reads in the reader\'s language, speakers and faces unchanged',()=>{
 const s=STORIES.find(x=>x.id==='rebel-roster');
 assert.equal(storyText(s).title,'強徵名冊');
 try{setLanguage('en');const en=storyText(s);assert.equal(en.title,'Conscription Roster');assert.deepEqual(en.comms.map(c=>[c.speaker,c.expression]),s.comms.map(c=>[c.speaker,c.expression]));assert.equal(en.comms[1].text,'Denied.');}
 finally{setLanguage('zh-TW');}
 assert.deepEqual(storyText({id:'x',title:'只有中文',body:'內文'}),{title:'只有中文',body:'內文',comms:[]},'a record without remarks or English still reads');
});

test('every faction line runs from the first floor to the sixth, counting the any-facility records',()=>{
 for(const faction of ['loyalist','rebel','swarm']){
  const floors=new Set(STORIES.filter(s=>s.faction===faction||s.faction==='any').flatMap(s=>Array.from({length:s.floors[1]-s.floors[0]+1},(_,i)=>s.floors[0]+i)));
  assert.deepEqual([...floors].sort(),[1,2,3,4,5,6],faction);
  assert.ok(STORIES.some(s=>s.faction===faction&&s.floors[0]===1),`${faction} has its own first-floor record`);
 }
});

test('records are for sale again and open from their title, ready for the remarks',()=>{
 assert.equal(UNLOCK_SETTINGS.storiesWip,false);
 const p=normalizeProfile();p.protocol={balance:5000,earned:5000};const s=STORIES[0];
 assert.equal(purchaseReason(p,{...s,kind:'story'}),'');
 const bought=grantUnlock(p,s.id,'purchase');assert.ok(bought.unlocks.stories.includes(s.id));assert.equal(bought.protocol.balance,5000-s.price);
 const page=unlockPageMarkup(bought,{tab:'stories'});
 assert.doesNotMatch(page,/story-stamp|尚未開放/);
 assert.match(page,new RegExp(`<details class="upgrade-section story-entry" data-story="${s.id}"><summary><span class="story-title">${s.title}</span>`));
 assert.equal((page.match(/data-unlock-buy="[^"]+">解鎖 · 100 點<\/button>|data-unlock-buy="[^"]+">[^<]*100[^<]*<\/button>/g)||[]).length,STORIES.length-1,'the rest can be bought');
 assert.match(storyReaderMarkup(s,''),/<div class="lore-entry"><p>來源：中繼點（已失效）。<br>主旨：/,'field lines stay on their own lines');
});

test('picking up data names the record; its text waits in the archive',()=>{
 const g=new Game(3,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'}),item=g.items.find(i=>i.type==='lore');Object.assign(g.player,{x:item.x,y:item.y});g.pickup();
 assert.equal(g.pendingStories.length,1);
 const s=STORIES.find(x=>x.id===g.pendingStories[0]);
 assert.ok(g.logs.some(l=>l.text===t('game.storyDecrypted',{title:s.title})));
 assert.ok(!g.logs.some(l=>l.text.includes(s.body.split('\n')[0])),'the body is not printed into the log');
});
