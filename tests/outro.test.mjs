import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {t} from '../src/i18n.js';
import {OUTRO_TUNING,outroPlan} from '../src/outro.js';
import {kiaSeconds} from '../src/kia.js';

// 3.177.0 (user design): the end of a run in three parts — the approval on the field, the officer alone on the dark
// screen (and the overseer's silence when the unit is to be executed), then the results.
const run=(status,{duty='egret',alive=null}={})=>({status,duty,runId:'r-1',floor:3,turn:40,
 purge:alive===null?null:{floors:{'1':{quota:10,alive,ids:null}}}});
const first=()=>0;

test('an extraction: the approval on the field, then her line in the middle',()=>{
 const plan=outroPlan(run('won',{alive:3}),{random:first});   // 70% purged: redeployed
 assert.equal(plan.field.line,'comms.egret.extractApproved.1');
 // 3.177.10 (user): a win keeps the same pace as a death: the same length rule for every line.
 assert.equal(plan.field.seconds,kiaSeconds(t(plan.field.line)));
 assert.equal(plan.field.tap,undefined,'the approval can be tapped away');
 assert.deepEqual(plan.channel.map(m=>m.line),['comms.egret.extracted.1']);
 assert.equal(plan.channel[0].seconds,kiaSeconds(t(plan.channel[0].line)));
});

test('a unit to be executed: the overseer cuts in after her with a silence that holds',()=>{
 const plan=outroPlan(run('won',{duty:'wren',alive:8}),{random:first});   // 20% purged: executed
 assert.deepEqual(plan.channel.map(m=>[m.speaker,m.line]),[['wren','comms.wren.extracted.1'],['overseer','comms.overseer.executed.1']]);
 const silence=plan.channel[1];
 assert.deepEqual([silence.seconds,silence.tap,silence.cutIn],[OUTRO_TUNING.overseerSeconds,false,true]);
 assert.equal(t(silence.line),'……');
 assert.equal(outroPlan(run('won',{alive:0}),{random:first}).channel.length,1,'an asset archived: no overseer');
 assert.equal(outroPlan(run('won'),{random:first}).channel.length,1,'no purge record (an old save): no verdict, no overseer');
});

test('the overseer on duty does not cut in on himself',()=>{
 const plan=outroPlan(run('won',{duty:'overseer',alive:8}),{random:first});
 assert.deepEqual(plan.channel.map(m=>m.line),['comms.overseer.extracted.1']);
 assert.equal(plan.field.line,'comms.overseer.extractApproved.1');
});

test('a death has its scene on the field, so only the loss report; an abandoned run and a replay say nothing',()=>{
 const dead=outroPlan(run('dead'),{random:first});
 assert.equal(dead.field,null);
 assert.deepEqual(dead.channel.map(m=>m.line),['comms.egret.lossReport.1']);
 assert.equal(dead.channel[0].seconds,kiaSeconds(t(dead.channel[0].line)),'the same rule as a win');
 assert.deepEqual(outroPlan(run('abandoned'),{random:first}),{field:null,channel:[]});
 assert.deepEqual(outroPlan(run('won',{alive:8}),{voiced:false}),{field:null,channel:[]});
});

test('the controller plays the end of a run instead of opening the results at once',async()=>{
 const source=await readFile(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.match(source,/if\(kia\)kia\.resultPending=true;else endRun\(\);/,'the run ends into the sequence');
 assert.match(source,/kia\.shown=true;renderer\.pace=null;renderer\.kia\.frozen=false;endRun\(\);/,'so does the death scene');
 assert.match(source,/function showResult\(\)\{endOutro\(\);/,'the results stop what is left of it');
 assert.doesNotMatch(source,/result-comms/,'the results no longer carry a box of their own');
 assert.match(source,/if\(game\.status!=='playing'\)\{if\(!ending\(\)\)showResult\(\);return;\}/,'interact waits for the end to play');
});
