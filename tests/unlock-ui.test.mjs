import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile} from '../src/progression.js';
import {STORIES} from '../src/story-data.js';
import {UNLOCK_CATALOG,UNLOCK_SETTINGS} from '../src/unlock-catalog.js';
import {unlockPageMarkup,purchaseReason,purchaseConfirmMarkup,resultStoriesMarkup,lockedOperatorRow,operatorSignal,operatorRecoveredMarkup} from '../src/unlock-ui.js';
import {killhouseMenuMarkup} from '../src/killhouse-ui.js';

// Stories come from an in-memory fixture so adding or deleting content files never changes these tests.
function withStory(story,run){
  const original=STORIES.splice(0);STORIES.push(story);UNLOCK_CATALOG.push(story);
  try{run();}finally{STORIES.splice(0,STORIES.length,...original);UNLOCK_CATALOG.splice(UNLOCK_CATALOG.indexOf(story),1);}
}

test('unlock page shows prices, refusal reasons and hints; story text is escaped and bodies stay hidden until owned',()=>{
  withStory({id:'qa-ui-story',title:'<b>QA</b>',body:'first line\n\nsecond <i>',faction:'rebel',floors:[2,4],price:100,order:0,kind:'story',sources:['extraction']},()=>{
    const p=normalizeProfile();p.protocol={balance:500,earned:500};
    const classes=unlockPageMarkup(p,{tab:'characters'});
    assert.match(classes,/data-unlock-buy="ninja">解鎖<\/button>/,'3.156.0: an operator costs the same 100 a record does');
    assert.doesNotMatch(classes,/data-unlock-buy="druid"|data-unlock-buy="necromancer"/,'3.156.0: the shelved two are not for sale');
    const poor=normalizeProfile();poor.protocol={balance:40,earned:40};
    assert.match(unlockPageMarkup(poor,{tab:'characters'}),/data-unlock-buy="ninja" disabled>還差 60 點<\/button>/);
    assert.doesNotMatch(classes,/data-unlock-buy="soldier"/);assert.match(classes,/起始職業/);assert.match(classes,/無盡第 5 層起/);
    const stories=unlockPageMarkup(p,{tab:'stories',settings:{...UNLOCK_SETTINGS,storiesWip:false}});   // 3.190.0: buying as it works once the stories return
    assert.match(stories,/&lt;b&gt;QA&lt;\/b&gt;/);assert.doesNotMatch(stories,/<b>QA/);assert.match(stories,/叛軍 · 第 2–4 層/);
    assert.match(stories,/data-unlock-buy="qa-ui-story">100 點解鎖<\/button>/);assert.doesNotMatch(stories,/first line/);
    p.unlocks.stories.push('qa-ui-story');
    const owned=unlockPageMarkup(p,{tab:'stories'});assert.match(owned,/<p>first line<\/p><p>second &lt;i&gt;<\/p>/);assert.doesNotMatch(owned,/data-unlock-buy="qa-ui-story"/);
    assert.match(purchaseConfirmMarkup(p,'ninja'),/花費 100 協定點數，剩餘 400/);
  });
  const rich=normalizeProfile();rich.protocol={balance:5000,earned:5000};const ninja=UNLOCK_CATALOG.find(e=>e.id==='ninja');
  assert.equal(purchaseReason(rich,ninja),'');
  assert.equal(purchaseReason(rich,ninja,{available:false}),'本機儲存無法使用');
  assert.equal(purchaseReason(rich,ninja,{settings:{demo:true}}),'試玩版不開放購買');
  assert.match(unlockPageMarkup(rich,{settings:{demo:true}}),/試玩版只開放起始三個職業/);
});

test('results list only stories the profile saved, death lists lost data, and locked classes show in deploy and kill house',()=>{
  const p=normalizeProfile();p.unlocks.stories.push('qa-saved');
  assert.match(resultStoriesMarkup({status:'won',pendingStories:['qa-saved','qa-unsaved']},p),/解鎖設施紀錄 1/);
  assert.match(resultStoriesMarkup({status:'won',pendingStories:['qa-unsaved']},p),/沒有寫入/);
  assert.match(resultStoriesMarkup({status:'dead',pendingStories:['qa-unsaved']},p),/資料遺失 1/);
  assert.equal(resultStoriesMarkup({status:'won',pendingStories:[]},p),'');
  assert.match(lockedOperatorRow('ninja'),/LOCKED · 100 點/);assert.match(lockedOperatorRow('ninja',{demo:true}),/試玩版未開放/);
  const menu=killhouseMenuMarkup({killhouse:null},['soldier'],['ninja']);
  assert.match(menu,/data-character="soldier"/);assert.doesNotMatch(menu,/data-character="ninja"/);
  assert.match(menu,/<button class="title-entry" data-modal="khArcade" disabled>.*?ARCADE · [^<]+<\/span><span class="title-note">未解鎖/);
  assert.equal(operatorSignal({operatorCorpse:null}),'');assert.equal(operatorSignal({operatorCorpse:{recovered:true}}),'');assert.match(operatorSignal({operatorCorpse:{recovered:false}}),/生命訊號/);
  assert.match(operatorRecoveredMarkup('ninja'),/解鎖職業：/);assert.match(operatorRecoveredMarkup('ninja',{newly:false}),/已經解鎖/);
});
