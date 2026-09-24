import test from 'node:test';
import assert from 'node:assert/strict';
import {t,setLanguage} from '../src/i18n.js';
import {logSlots,commsForLogs,commsDuration,commsMarkup,COMMS_HOOKS,COMMS_TUNING} from '../src/comms.js';

// 3.168.1 (user request, docs/STORY.md 8): the controller speaks when a hooked log line appears. The hooks name
// language-table sentences, so a line is recognised in either language and hands its slot values to her line.
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

test('hooks answer in log order and fill her line from the slots; none are set yet',()=>{
 const logs=[{text:t('game.reloaded',{n:2})},{text:t('enemy-behavior.munitionLaunch',{name:'甲'})}];   // newest first, as the game keeps them
 const hooks=[{log:'enemy-behavior.munitionLaunch',line:slots=>`launch:${slots.name}`},{log:'game.reloaded',line:slots=>`reload:${slots.n}`}];
 assert.deepEqual(commsForLogs(logs,hooks),['launch:甲','reload:2']);
 assert.deepEqual(commsForLogs(logs,[{log:'game.reloaded',line:'common.pickupAmount'}]),[t('common.pickupAmount',{n:'2'})],'a table id takes the slots');
 assert.deepEqual(COMMS_HOOKS,[],'which lines trigger her is still to be decided');
 assert.deepEqual(commsForLogs(logs),[]);
});

test('the box carries its hairline, and longer lines stay longer within the limits',()=>{
 assert.match(commsMarkup('x'),/class="comms-timer"/);
 assert.doesNotMatch(commsMarkup('x',{timer:false}),/comms-timer/);
 assert.equal(commsDuration(''),COMMS_TUNING.minMs);
 assert.equal(commsDuration('x'.repeat(500)),COMMS_TUNING.maxMs);
 assert.ok(commsDuration('x'.repeat(40))>commsDuration('x'.repeat(20)));
});
