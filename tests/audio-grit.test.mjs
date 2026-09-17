import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GRIT_LEVELS,GRIT_DEFAULT,gritLevel,gritPlan,popShape,noiseBurst,POP_SHAPES} from '../src/audio-grit.js';

// 3.118.0 trial: random signal noise on sound (user request). Off by default until the user has heard it in the game.
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}

test('the noise is off by default, and an unknown saved value falls back to off',()=>{
  assert.equal(GRIT_DEFAULT,'off');
  assert.equal(gritPlan(.2,'off'),null);
  for(const value of [null,undefined,'','loud','constructor','__proto__'])assert.equal(gritLevel(value),'off',String(value));
  assert.equal(gritLevel('heavy'),'heavy');
});

test('every drawn plan stays inside its level, and heavy is rougher than light',()=>{
  const counts={};
  for(const level of ['light','heavy']){
    const spec=GRIT_LEVELS[level],rand=seeded(7),seen=counts[level]={pops:0,statics:0,dropouts:0,cents:0};
    for(let i=0;i<4000;i++){
      const duration=.05+i%9*.05,plan=gritPlan(duration,level,rand),length=duration/plan.rate,cents=Math.abs(1200*Math.log2(plan.rate));
      assert.ok(cents<=spec.cents+1e-9&&plan.delay>=0&&plan.delay<=spec.jitterMs/1000);
      assert.ok(plan.pops.length<=spec.maxPops);
      for(const pop of plan.pops){
        assert.ok(pop.at>=0&&pop.at<=length+.04,'a pop lands while the sound is heard');
        assert.ok(Math.abs(pop.gain)>=spec.popGain[0]&&Math.abs(pop.gain)<=spec.popGain[1]);
        assert.ok(Number.isInteger(pop.shape)&&pop.shape>=0&&pop.shape<POP_SHAPES);
      }
      for(const s of plan.statics)assert.ok(s.at>=0&&s.at<=length&&s.gain<=spec.staticGain[1]&&s.length<=.12&&s.freq>=1200&&s.freq<=4200);
      for(const d of plan.dropouts)assert.ok(d.at+d.length<=length*.8+.06&&d.depth>=spec.dropoutDepth[0]&&d.depth<=spec.dropoutDepth[1],'a dropout dips, never mutes');
      seen.pops+=plan.pops.length;seen.statics+=plan.statics.length;seen.dropouts+=plan.dropouts.length;seen.cents+=cents;
    }
  }
  for(const key of ['pops','statics','dropouts','cents'])assert.ok(counts.heavy[key]>counts.light[key]*1.8,key);
  assert.ok(counts.light.pops>0&&counts.light.statics>0&&counts.light.dropouts>0,'light still does something');
});

test('pop shapes and the static source are fixed, so the audition and the game use the same clicks',()=>{
  for(let i=0;i<POP_SHAPES;i++){
    const a=popShape(i,48000),b=popShape(i,48000);
    assert.deepEqual(a,b);assert.equal(a[0],1,'each pop starts on a full click');
    assert.ok(a.every(x=>Math.abs(x)<=1),'no pop clips on its own');
    assert.ok(a.length>=96&&a.length<=48000*.0071,'2 to 7 ms');
    assert.ok(Math.abs(a.at(-1))<.2,'it dies away');
  }
  assert.notDeepEqual(popShape(0,44100),popShape(5,44100));
  const noise=noiseBurst(44100);assert.equal(noise.length,8820);assert.deepEqual(noise,noiseBurst(44100));assert.ok(noise.every(x=>x>=-1&&x<1));
});

test('the engine plays the plan through each voice, the music wobbles, and the setting is saved',async()=>{
  const engine=await read('../src/audio.js'),source=await read('../src/controller.js'),worker=await read('../sw.js');
  assert.ok(engine.includes('const plan=gritPlan(buffer.duration,this.grit);\n      if(plan)source.start(this.roughen(voice,plan));else{source.connect(this.sfxBus);source.start();}'));
  assert.ok(engine.includes('try{voice.gain?.disconnect();}catch{}'),'a stolen voice takes its scheduled pops with it');
  assert.ok(engine.includes('Object.assign(token,{pending:false,source,gain});this.wobble(token);'));
  assert.ok(engine.includes('for(const {oscillator} of track.wobble||[])oscillator.stop('),'the wobble stops with its track');
  assert.ok(source.includes("audio.setGrit(gritLevel(read('ash-audio-grit')));"));
  assert.ok(source.includes("audio.setGrit(next);write('ash-audio-grit',next);settings();"));
  assert.ok(source.includes('data-modal="audioGrit"'));
  assert.ok(worker.includes('./src/audio-grit.js'));
  assert.ok(!(await read('../src/audio-grit.js')).includes('g.rng'),'never the game rng');
});
