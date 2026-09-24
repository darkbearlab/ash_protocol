import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {t,setLanguage} from '../src/i18n.js';
import {logSlots,commsForLogs,commsDuration,commsMarkup,resolveComms,dutySpeaker,commsLine,COMMS_HOOKS,COMMS_SPEAKERS,COMMS_TUNING,COMMS_LINES,COMMS_EXPRESSIONS,DEFAULT_EXPRESSION} from '../src/comms.js';

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
 assert.equal(dutySpeaker(),'egret','Egret when no run says otherwise');
 assert.equal(dutySpeaker({game:{duty:'wren'}}),'wren','the officer saved with the run');
 const plain=resolveComms('連線測試。');
 assert.deepEqual(plain,{speaker:'egret',name:t('comms.speaker.egret'),expression:DEFAULT_EXPRESSION,portrait:{sheet:'./assets/pixel/comms-v1/egret.png',cell:0},text:'連線測試。'});
 const flagged=resolveComms({line:'game.reloaded',vars:{n:2},expression:'worried'});
 assert.equal(flagged.text,t('game.reloaded',{n:2}));
 assert.equal(flagged.expression,'worried');
 assert.equal(resolveComms({speaker:'nobody-yet',text:'x'}).speaker,'egret','an unknown speaker falls back to the one on duty');
 assert.equal(resolveComms({text:'x'},{game:{duty:'overseer'}}).name,t('comms.speaker.overseer'));
 assert.equal(resolveComms({name:'臨時',text:'x'}).name,'臨時','a message may carry its own name');
 const speakers={egret:COMMS_SPEAKERS.egret,stand_in:{name:'代理',sheet:'./assets/pixel/comms-v1/stand_in.png',expressions:{neutral:0,worried:6}}};
 const stand=resolveComms({speaker:'stand_in',text:'接手。'},{},speakers);
 assert.deepEqual([stand.speaker,stand.name,stand.portrait],['stand_in','代理',{sheet:'./assets/pixel/comms-v1/stand_in.png',cell:0}]);
 const markup=commsMarkup({speaker:'stand_in',expression:'worried',text:'接手。'},{speakers});
 assert.match(markup,/data-speaker="stand_in"/);
 assert.match(markup,/data-expression="worried"/);
 assert.match(markup,/<span class="comms-portrait" style="background-image:url\('\.\/assets\/pixel\/comms-v1\/stand_in\.png'\);background-position:-128px -64px"><\/span>/,'cell 6 is the third column of the second row');
 assert.equal(resolveComms({speaker:'stand_in',expression:'never-drawn',text:'x'},{},speakers).portrait.cell,0,'an expression she was not drawn with shows her neutral face');
 assert.match(commsMarkup('x',{context:{game:{duty:'overseer'}}}),/SOUND<\/span><span>ONLY/,'the overseer has no face: the SOUND ONLY plate');
});

// 3.170.0: Egret and Wren each have a 4x4 sheet of 64x64 faces (art/comms-v1). Hand edits go into the installed
// sheets, so the check is the format a hand edit must keep, not the file's hash: 256x256 indexed, one palette of at
// most 16 colours, every channel on a Mega Drive level.
test('the drawn speakers have a face for every expression, on a 16-colour Mega Drive sheet that ships offline',()=>{
 const levels=new Set([0,52,87,116,144,172,206,255]);
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
 assert.match(server,/comms-v1/,'the dev server serves the sheets');
 for(const id of ['egret','wren']){
  const {sheet,expressions}=COMMS_SPEAKERS[id];
  assert.equal(sheet,`./assets/pixel/comms-v1/${id}.png`);
  assert.ok(sw.includes(sheet),`${id}: cached for offline play`);
  assert.deepEqual(Object.values(expressions),[...Array(16).keys()],`${id}: sixteen expressions, one per cell`);
  assert.equal(expressions[DEFAULT_EXPRESSION],0);
  const png=readFileSync(new URL(`../${sheet}`,import.meta.url));
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);assert.equal(png[25],3,'indexed colour');
  let pos=8,palette=null;
  while(pos<png.length){const len=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8);if(type==='PLTE')palette=[...png.subarray(pos+8,pos+8+len)];pos+=12+len;}
  assert.ok(palette&&palette.length<=48,`${id}: at most 16 colours`);
  assert.ok(palette.every(c=>levels.has(c)),`${id}: every colour is a Mega Drive colour`);
 }
 assert.equal(COMMS_SPEAKERS.overseer.sheet,undefined);
});

test('each of Egret\'s events names a face she was drawn with; a line may carry its own',()=>{
 for(const [event,ids] of Object.entries(COMMS_LINES.egret)){
  assert.ok(Object.hasOwn(COMMS_SPEAKERS.egret.expressions,COMMS_EXPRESSIONS.egret[event]),event);
  for(let i=0;i<ids.length;i++){
   const message=commsLine('egret',event,{name:'核心守衛'},{random:()=>i/ids.length});
   assert.ok(Object.hasOwn(COMMS_SPEAKERS.egret.expressions,message.expression),`${event} ${i+1}`);
   assert.equal(typeof message.line,'string');
  }
 }
 assert.equal(commsLine('egret','briefing',{},{random:()=>0}).expression,'speaking');
 assert.equal(commsLine('egret','boss',{name:'甲'},{random:()=>.99}).expression,'worried','the second boss line is her worried face');
 assert.equal(commsLine('egret','boss',{name:'甲'},{random:()=>0}).expression,'serious');
 assert.equal(commsLine('x','y',{},{lines:{x:{y:['comms.aria']}},expressions:{}}).expression,undefined,'no face named: the box shows neutral');
});

test('hooks answer in log order with messages that carry the slots; none are set yet',()=>{
 const logs=[{text:t('game.reloaded',{n:2})},{text:t('enemy-behavior.munitionLaunch',{name:'甲'})}];   // newest first, as the game keeps them
 const hooks=[{log:'enemy-behavior.munitionLaunch',say:slots=>({expression:'alarmed',text:`launch:${slots.name}`})},{log:'game.reloaded',speaker:'egret',line:'common.pickupAmount'}];
 const messages=commsForLogs(logs,hooks);
 assert.deepEqual(messages[0],{expression:'alarmed',text:'launch:甲'});
 assert.deepEqual(messages[1],{speaker:'egret',line:'common.pickupAmount',vars:{n:'2'}});
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

// 3.170.0 fix: #modal takes the class of what it shows (briefing, transmission...). A bare class rule with a display
// also matched the closed dialog and outranked the browser's hiding of it, so the closed briefing stayed over the
// field and took its taps.
test('a closed dialog stays hidden whatever it last showed',()=>{
 const controller=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8');
 const css=['../style.css','../expansion.css'].map(f=>readFileSync(new URL(f,import.meta.url),'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
 const classes=[...controller.matchAll(/\$\('#modal'\)\.classList\.toggle\('([\w-]+)'/g)].map(m=>m[1]);
 assert.ok(classes.includes('briefing'));
 for(const [,selectors,body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){
  if(!/(^|;)\s*display\s*:/.test(body))continue;
  for(const selector of selectors.split(',').map(s=>s.trim()))
   for(const name of classes)assert.doesNotMatch(selector,new RegExp(`^\\.${name}(?![\\w-])[^\\s>+~]*$`),`${selector} would show the closed dialog`);
 }
 assert.match(css,/dialog:not\(\[open\]\)\{display:none!important\}/);
});
