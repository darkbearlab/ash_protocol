import test from 'node:test';
import assert from 'node:assert/strict';
import {t,setLanguage} from '../src/i18n.js';
import {logSlots,commsForLogs,commsDuration,commsMarkup,resolveComms,dutySpeaker,COMMS_HOOKS,COMMS_SPEAKERS,COMMS_TUNING,DEFAULT_EXPRESSION} from '../src/comms.js';

// 3.168.1 (user request, docs/STORY.md 8): someone speaks when a hooked log line appears. The hooks name
// language-table sentences, so a line is recognised in either language and hands its slot values to the message.
test('a log line is recognised by its sentence id, with its slot values, in Chinese and in English',()=>{
 const zh=t('game.reloaded',{n:3});
 assert.deepEqual(logSlots(zh,'game.reloaded'),{n:'3'});
 assert.equal(logSlots('Some other line.','game.reloaded'),null);
 assert.equal(logSlots(zh,'no.such.sentence'),null);
 try{
  setLanguage('en');
  assert.deepEqual(logSlots(t('game.reloaded',{n:1}),'game.reloaded'),{n:'1'},'the singular word matches');
  assert.deepEqual(logSlots(t('game.reloaded',{n:4}),'game.reloaded'),{n:'4'},'and so does the plural');
  const launch=t('enemy-behavior.munitionLaunch',{name:'Rogue Drone'});
  assert.deepEqual(logSlots(launch,'enemy-behavior.munitionLaunch'),{name:'Rogue Drone'});
 }finally{setLanguage('zh-TW');}
});

// 3.168.2 (user request): a message carries who speaks, with which expression, and what (a table id with slots, or
// text). Leaving the speaker out reaches whoever is on duty, so a stand-in can take a mission without the callers
// changing.
test('a message names its speaker, expression and line; the speaker defaults to whoever is on duty',()=>{
 assert.equal(dutySpeaker(),'controller','only the controller is written so far');
 const plain=resolveComms('連線測試。');
 assert.deepEqual(plain,{speaker:'controller',name:t('comms.speaker.controller'),expression:DEFAULT_EXPRESSION,portrait:null,text:'連線測試。'});
 const flagged=resolveComms({line:'game.reloaded',vars:{n:2},expression:'worried'});
 assert.equal(flagged.text,t('game.reloaded',{n:2}));
 assert.equal(flagged.expression,'worried');
 assert.equal(resolveComms({speaker:'nobody-yet',text:'x'}).speaker,'controller','an unwritten speaker falls back to the one on duty');
 assert.equal(resolveComms({name:'臨時',text:'x'}).name,'臨時','a message may carry its own name');
 const speakers={controller:COMMS_SPEAKERS.controller,stand_in:{name:'代理',portraits:{neutral:'./assets/pixel/comms/stand_in-neutral.png'}}};
 const stand=resolveComms({speaker:'stand_in',text:'接手。'},{},speakers);
 assert.deepEqual([stand.speaker,stand.name,stand.portrait],['stand_in','代理','./assets/pixel/comms/stand_in-neutral.png']);
 const markup=commsMarkup({speaker:'stand_in',expression:'neutral',text:'接手。'},{speakers});
 assert.match(markup,/data-speaker="stand_in"/);
 assert.match(markup,/data-expression="neutral"/);
 assert.match(markup,/<img class="comms-portrait" src="\.\/assets\/pixel\/comms\/stand_in-neutral\.png"/);
 assert.match(commsMarkup('x'),/SOUND<\/span><span>ONLY/,'no portrait yet: the SOUND ONLY plate');
});

test('hooks answer in log order with messages that carry the slots; none are set yet',()=>{
 const logs=[{text:t('game.reloaded',{n:2})},{text:t('enemy-behavior.munitionLaunch',{name:'甲'})}];   // newest first, as the game keeps them
 const hooks=[{log:'enemy-behavior.munitionLaunch',say:slots=>({expression:'alarmed',text:`launch:${slots.name}`})},{log:'game.reloaded',speaker:'controller',line:'common.pickupAmount'}];
 const messages=commsForLogs(logs,hooks);
 assert.deepEqual(messages[0],{expression:'alarmed',text:'launch:甲'});
 assert.deepEqual(messages[1],{speaker:'controller',line:'common.pickupAmount',vars:{n:'2'}});
 assert.equal(resolveComms(messages[1]).text,t('common.pickupAmount',{n:'2'}),'the table id takes the slots');
 assert.deepEqual(COMMS_HOOKS,[],'which lines trigger someone is still to be decided');
 assert.deepEqual(commsForLogs(logs),[]);
});

test('the box carries its hairline, and longer lines stay longer within the limits',()=>{
 assert.match(commsMarkup('x'),/class="comms-timer"/);
 assert.doesNotMatch(commsMarkup('x',{timer:false}),/comms-timer/);
 assert.equal(commsDuration(''),COMMS_TUNING.minMs);
 assert.equal(commsDuration('x'.repeat(500)),COMMS_TUNING.maxMs);
 assert.ok(commsDuration('x'.repeat(40))>commsDuration('x'.repeat(20)));
});
