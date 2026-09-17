// Mega Drive-style sound effect samples for ASH PROTOCOL (2026-09-17, user request: a 16-bit round to set beside the NES one).
// An offline approximation of the console's sound hardware, not a register-exact emulator:
//  - YM2612 FM: four sine operators per voice, the eight algorithms, operator-1 feedback, envelopes that fall linearly in
//    decibels (attack, decay to a sustain level, sustain decay, release), running at the chip's 53,267 Hz; each voice is
//    quantised to the 9-bit DAC with a small step at zero (the Model 1 "ladder effect").
//  - Channel 6 as a DAC: short 8-bit sample-like sounds played back at 8-16 kHz with no smoothing, the gritty drums and
//    gunshots of the era.
//  - SN76489 PSG: 50% square tones and the 16-bit noise register, volumes in 2 dB steps, changes on 60 Hz frames.
//  - Output: a gentle low-pass near 3.4 kHz like a Model 1 console, then resampled to 44.1 kHz.
// Numbering and names match the NES round (../nes-sfx) so the two can be compared one to one.
import {writeFileSync,mkdirSync} from 'node:fs';

const YM=53267,OUT=44100,TAU=Math.PI*2;
const NOTE=name=>{const m=/^([A-G])(#?)(\d)$/.exec(name),i={C:-9,D:-7,E:-5,F:-4,G:-2,A:0,B:2}[m[1]]+(m[2]?1:0);return 440*2**((i+(Number(m[3])-4)*12)/12);};
const dB=x=>10**(-x/20);

// ---------- deterministic noise
let seed=0x2612;const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return ((seed>>>0)/4294967296)*2-1;};

// ---------- FM voice
// pitch: number, or {from,to,time} (exponential glide), or {steps:[[t,hz],...]}; optional vibrato {rate,cents,delay}.
function pitchAt(p,t){
  let hz=typeof p==='number'?p:p.steps?p.steps.filter(([at])=>at<=t).at(-1)?.[1]??p.steps[0][1]:p.from*(p.to/p.from)**Math.min(1,t/p.time);
  if(p.vibrato&&t>(p.vibrato.delay||0))hz*=2**(p.vibrato.cents*Math.sin(TAU*p.vibrato.rate*(t-(p.vibrato.delay||0)))/1200);
  return hz;
}
// Operator envelope in decibels of attenuation: tl + the ADSR curve. ar in seconds; dr, sr, rr in dB per second; sl in dB.
function envDb(op,t,keyOff){
  const curve=u=>{if(u<op.ar)return -20*Math.log10(Math.max(1e-5,u/op.ar));const d=(u-op.ar)*op.dr;if(!op.dr||d<op.sl)return d;return op.sl+(u-op.ar-op.sl/op.dr)*(op.sr||0);};   // a decay rate of 0 holds the level
  let level=t<keyOff?curve(t):curve(keyOff)+(t-keyOff)*op.rr;
  return Math.min(96,op.tl+level);
}
const ALGORITHMS=[
  (o,m)=>o[3](m(o[2](m(o[1](m(o[0](0))))))),
  (o,m)=>o[3](m(o[2](m(o[0](0)+o[1](0))))),
  (o,m)=>o[3](m(o[0](0)+o[2](m(o[1](0))))),
  (o,m)=>o[3](m(o[1](m(o[0](0)))+o[2](0))),
  (o,m)=>o[1](m(o[0](0)))+o[3](m(o[2](0))),
  (o,m)=>{const a=m(o[0](0));return o[1](a)+o[2](a)+o[3](a);},
  (o,m)=>o[1](m(o[0](0)))+o[2](0)+o[3](0),
  (o,m)=>o[0](0)+o[1](0)+o[2](0)+o[3](0),
];
function fmVoice({start=0,length,pitch,alg,fb=0,ops,level=0}){
  const tail=Math.max(...ops.map(op=>96/Math.max(1,op.rr)));
  const n=Math.ceil((length+tail)*YM),out=new Float64Array(n),phase=[0,0,0,0];let fb1=0,fb2=0;
  for(let i=0;i<n;i++){
    const t=i/YM,hz=pitchAt(pitch,t);
    const amps=ops.map(op=>envDb(op,t,length)>=96?0:dB(envDb(op,t,length)+level));
    if(t>length&&amps.every(a=>a<1e-4))break;
    const calls=ops.map((op,k)=>mod=>{
      let pm=mod;if(k===0&&fb)pm+=(fb1+fb2)*Math.PI*2**(fb-7);
      const v=Math.sin(TAU*phase[k]+pm)*amps[k];if(k===0){fb2=fb1;fb1=v;}
      phase[k]=(phase[k]+hz*(op.mul||1)*2**((op.cents||0)/1200)/YM)%1;return v;
    });
    let y=ALGORITHMS[alg](calls,x=>x*4*Math.PI);
    if(!Number.isFinite(y))throw new Error(`non-finite FM output at ${t}s`);
    // Average over the carriers that actually sound, so a patch that switches operators off is not made quieter.
    const carriers=[[3],[3],[3],[3],[1,3],[1,2,3],[1,2,3],[0,1,2,3]][alg].filter(k=>ops[k].tl<96).length||1;y/=carriers;
    // 9-bit DAC with the Model 1 step at zero.
    let q=Math.round(y*255);if(q)q+=Math.sign(q)*2;out[i]=q/255;
  }
  return {start,samples:out};
}

// ---------- DAC sample playback
function biquad(type,freq,q,rate){const w=TAU*freq/rate,a=Math.sin(w)/(2*q),c=Math.cos(w);let b0,b1,b2,a0=1+a,a1=-2*c,a2=1-a;
  if(type==='lp'){b0=(1-c)/2;b1=1-c;b2=(1-c)/2;}else if(type==='hp'){b0=(1+c)/2;b1=-(1+c);b2=(1+c)/2;}else{b0=a;b1=0;b2=-a;}
  let x1=0,x2=0,y1=0,y2=0;return x=>{const y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;return y;};}
// A source sound built at 44.1 kHz, then taken down to the DAC rate by dropping samples and to 8 bits, then held.
function dac({start=0,rate,length,build,gain=1}){
  const src=Array.from({length:Math.ceil(length*OUT)},(_,i)=>build(i/OUT));
  const peak=Math.max(...src.map(Math.abs))||1;
  const low=Array.from({length:Math.ceil(length*rate)},(_,i)=>Math.round((src[Math.floor(i*OUT/rate)]??0)/peak*127*gain)/127);
  const out=new Float64Array(Math.ceil(length*YM));
  for(let i=0;i<out.length;i++)out[i]=low[Math.floor(i*rate/YM)]??0;
  return {start,samples:out};
}
const shaped=(filters,envelope,extra=()=>0)=>t=>{let x=rand();for(const f of filters)x=f(x);return x*envelope(t)+extra(t);};

// ---------- PSG
function psg({start=0,frames,rate=YM}){
  const n=Math.ceil(frames.length/60*YM),out=new Float64Array(n);let ph=0,lfsr=0x8000,noiseAcc=0;
  for(let i=0;i<n;i++){
    const f=frames[Math.floor(i*60/YM)]||{};let y=0;
    if(f.tone){ph=(ph+f.tone.hz/YM)%1;y+=(ph<.5?1:-1)*(f.tone.vol>=15?0:dB(f.tone.vol*2))*.5;}
    if(f.noise){noiseAcc+=f.noise.hz/YM;while(noiseAcc>=1){noiseAcc--;const bit=f.noise.white?((lfsr&1)^((lfsr>>3)&1)):(lfsr&1);lfsr=(lfsr>>1)|(bit<<15);}y+=((lfsr&1)?1:-1)*(f.noise.vol>=15?0:dB(f.noise.vol*2))*.5;}
    out[i]=y;
  }
  return {start,samples:out};
}

// ---------- patches (operator order 1..4; tl and sl in dB, ar in s, dr/sr/rr in dB/s)
const op=(mul,tl,ar,dr,sl,sr,rr,cents=0)=>({mul,tl,ar,dr,sl,sr,rr,cents});
const THUMP=(from,to,time,length)=>({pitch:{from,to,time},length,alg:0,fb:3,ops:[op(1,30,.001,400,40,200,400),op(1,24,.001,500,50,200,400),op(.5,20,.001,300,60,100,300),op(1,0,.001,160,30,120,300)]});
const METAL=(hz,length,level=0)=>({pitch:hz,length,level,alg:4,fb:5,ops:[op(7,6,.0005,600,40,300,600),op(1,0,.0005,500,50,300,600),op(13,10,.0005,900,50,400,800),op(3,6,.0005,700,60,400,800)]});
const LASER=(from,to,time,length,level=0,cents=0)=>({pitch:{from,to,time},length,level,alg:4,fb:5,ops:[op(1,8,.001,120,30,60,300,cents),op(1,0,.001,40,24,40,200,cents),op(2,14,.001,160,40,80,300,cents),op(1,6,.001,50,30,40,200,cents)]});
const BELL=(pitch,length,level=0)=>({pitch,length,level,alg:4,fb:0,ops:[op(14,18,.0005,60,40,20,120),op(1,0,.0005,18,30,10,60),op(3,20,.0005,50,40,20,120),op(1,8,.0005,24,36,12,80)]});
const BRASS=(pitch,length,level=0)=>({pitch,length,level,alg:4,fb:4,ops:[op(1,10,.015,30,12,10,120),op(1,0,.008,20,10,8,100),op(2,22,.02,40,20,10,120),op(1,8,.01,24,14,8,100)]});
const NOISEFM=(pitch,length,level=0,ar=.002,dr=260)=>({pitch,length,level,alg:7,fb:7,ops:[op(1,0,ar,dr,60,200,400),op(1,96,.001,0,0,0,400),op(1,96,.001,0,0,0,400),op(1,96,.001,0,0,0,400)]});
const GRIND=(hz,length,level=0)=>({pitch:{...{from:hz,to:hz*.8,time:length}},length,level,alg:6,fb:6,ops:[op(1,4,.02,20,12,20,200),op(1,0,.02,20,10,15,200),op(.5,18,.02,30,20,20,200),op(2,26,.02,30,24,20,200)]});

// DAC sources
const gunshot=(len,body=900,thump=95)=>{const hp=biquad('hp',1500,.7,OUT),bp=biquad('bp',body,1.2,OUT);return shaped([],()=>0,t=>hp(rand())*Math.exp(-t/.012)*1.2+bp(rand())*Math.exp(-t/(len*.35))*2.2+Math.sin(TAU*thump*(1-t*2)*t)*Math.exp(-t/.05)*.8);};
const boom=(len)=>{const lp=biquad('lp',700,.8,OUT),lp2=biquad('lp',180,.9,OUT);return t=>lp(rand())*Math.exp(-t/(len*.18))*1.6+lp2(rand())*Math.exp(-t/(len*.45))*3+Math.sin(TAU*60*(1-t)*t)*Math.exp(-t/.12)*.7;};
const click=(freq,decay=.006)=>{const bp=biquad('bp',freq,6,OUT);return t=>bp(rand())*Math.exp(-t/decay)*6;};
const scrape=(len)=>{const bp=biquad('bp',1100,2,OUT);return t=>bp(rand())*(.6+.4*Math.sin(TAU*23*t)*Math.sin(TAU*7*t))*Math.min(1,t/.03)*Math.exp(-t/(len*.6))*3;};
const soft=()=>{const lp=biquad('lp',380,.7,OUT);return t=>lp(rand())*Math.exp(-t/.012)*4;};

const S=[
  ['01-rifle-a','突擊步槍開火 A：粗糙的 8 位元槍聲取樣加 FM 低音砰',[dac({rate:11025,length:.2,build:gunshot(.2)}),fmVoice(THUMP(130,50,.06,.05))]],
  ['02-rifle-b','突擊步槍開火 B：FM 回授噪音加金屬點擊與 PSG 雜訊',[fmVoice(NOISEFM({from:2400,to:900,time:.08},.05,2)),fmVoice(METAL(420,.02,6)),psg({frames:[{noise:{hz:7000,white:true,vol:2}},{noise:{hz:7000,white:true,vol:5}},{noise:{hz:3500,white:true,vol:8}},{noise:{hz:3500,white:true,vol:11}}]})]],
  ['03-smg','衝鋒槍三連發：三發短取樣，每發取樣率略不同',[0,.075,.15].map((start,k)=>dac({start,rate:[8000,8600,7600][k],length:.07,build:gunshot(.07,1100,120)}))],
  ['04-shotgun','霰彈槍：長的低取樣率爆裂加 FM 重低音下滑',[dac({rate:8000,length:.38,build:gunshot(.38,650,70)}),fmVoice(THUMP(95,34,.2,.12))]],
  ['05-sniper','精準步槍：FM 金屬爆裂加兩次取樣迴音',[fmVoice(METAL(900,.03)),dac({rate:11025,length:.12,build:gunshot(.12,1400,110)}),dac({start:.16,rate:8000,length:.18,build:gunshot(.18,800,0),gain:.45}),dac({start:.34,rate:8000,length:.18,build:gunshot(.18,700,0),gain:.2})]],
  ['06-plasma','電漿步槍：FM 雷射下滑，高八度副聲部稍微走音',[fmVoice(LASER(2200,180,.24,.12)),fmVoice({...LASER(4400,360,.24,.08,10,14),start:.012})]],
  ['07-hit','命中：FM 悶響下沉加 PSG 雜訊點擊',[fmVoice(THUMP(190,70,.09,.04)),psg({frames:[{noise:{hz:3500,white:true,vol:1}},{noise:{hz:1750,white:true,vol:6}}]})]],
  ['08-miss','落空：FM 回授噪音的呼嘯',[fmVoice(NOISEFM({from:5200,to:1400,time:.16},.09,2,.03,180))]],
  ['09-kill','擊殺：FM 銅管下行短奏加低音與取樣重擊',[fmVoice({...BRASS({steps:[[0,NOTE('E4')],[.09,NOTE('C4')],[.18,NOTE('A3')]]},.3,2)}),fmVoice({...THUMP(NOTE('A2'),NOTE('A2')*.97,.3,.25),level:6}),dac({rate:8000,length:.12,build:gunshot(.12,500,80),gain:.7})]],
  ['10-reload','裝填：兩下取樣金屬聲，第二下加 FM 鈴聲',[dac({rate:16000,length:.04,build:click(3400)}),dac({start:.12,rate:16000,length:.05,build:click(2200,.009)}),fmVoice({...BELL(NOTE('A6'),.02,14),start:.12})]],
  ['11-grenade','爆炸：8 kHz 8 位元爆炸取樣加 FM 隆隆聲',[dac({rate:8000,length:.95,build:boom(.95)}),fmVoice({...THUMP(75,28,.55,.35),fb:6})]],
  ['12-footstep','腳步：很輕的取樣',[dac({rate:8000,length:.05,build:soft(),gain:.35})]],
  ['13-heal','治療：FM 電鈴上行琶音',['C5','E5','G5','C6'].map((note,k)=>fmVoice({...BELL(NOTE(note),.09,k===3?2:6),start:k*.085}))],
  ['14-transmission','升級通訊：FM 資料嗶聲與 PSG 方波，接兩音警示',[fmVoice({pitch:{steps:Array.from({length:12},(_,k)=>[k*.03,[1760,2349,1976,2637,1568,2093][(k*7)%6]])},length:.34,level:10,alg:4,fb:2,ops:[op(2,26,.001,20,20,10,500),op(1,0,.001,10,10,5,500),op(1,96,.001,0,0,0,500),op(1,96,.001,0,0,0,500)]}),psg({frames:Array.from({length:20},(_,k)=>k%3===0?{tone:{hz:[2093,2637,1760][k%9/3|0]||2093,vol:9}}:{})}),fmVoice({...BRASS({steps:[[0,NOTE('A5')],[.15,NOTE('E5')]],vibrato:{rate:6,cents:18,delay:.16}},.4,4),start:.4})]],
  ['15-ui-select','選單確認：FM 電鈴兩聲',[fmVoice(BELL(NOTE('B5'),.04,6)),fmVoice({...BELL(NOTE('E6'),.08,4),start:.05})]],
  ['16-door','開門：FM 低音嘎吱加取樣摩擦聲',[fmVoice(GRIND(62,.3,6)),dac({rate:11025,length:.36,build:scrape(.36),gain:.6})]],
];

// ---------- mix, filter, resample, write
function mix(parts){
  const n=Math.max(...parts.map(p=>Math.round(p.start*YM)+p.samples.length))+Math.round(.05*YM),buf=new Float64Array(n);
  for(const p of parts){const o=Math.round(p.start*YM);for(let i=0;i<p.samples.length;i++)buf[o+i]+=p.samples[i];}
  // Model 1-like low-pass (first order, 3.4 kHz) and DC removal.
  const a=TAU*3400/(YM+TAU*3400),h=YM/(YM+TAU*20);let lp=0,hp=0,hx=0;
  for(let i=0;i<n;i++){lp+=a*(buf[i]-lp);hp=h*(hp+lp-hx);hx=lp;buf[i]=hp;}
  const out=new Float64Array(Math.floor(n*OUT/YM));
  for(let i=0;i<out.length;i++){const x=i*YM/OUT,k=Math.floor(x),f=x-k;out[i]=(buf[k]||0)*(1-f)+(buf[k+1]||0)*f;}
  // Trim the inaudible end of long release tails (below -60 dB of this sound's own peak), keeping 50 ms.
  const top=out.reduce((m,v)=>Math.max(m,Math.abs(v)),0);let end=out.length;while(end>0&&Math.abs(out[end-1])<top*.001)end--;
  return out.slice(0,Math.min(out.length,end+Math.round(.05*OUT)));
}
function wav(samples,gain){
  const data=Buffer.alloc(samples.length*2);
  for(let i=0;i<samples.length;i++)data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*gain*32767))),i*2);
  const h=Buffer.alloc(44);
  h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);
  h.writeUInt32LE(OUT,24);h.writeUInt32LE(OUT*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
  return Buffer.concat([h,data]);
}
const dir=new URL('./out/',import.meta.url);mkdirSync(dir,{recursive:true});
const rendered=S.map(([id,label,parts])=>({id,label,samples:mix(parts)}));
const peak=Math.max(...rendered.map(r=>r.samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0))),gain=.89/peak;
for(const r of rendered)writeFileSync(new URL(`md-${r.id}.wav`,dir),wav(r.samples,gain));
const gap=Math.round(.7*OUT),index=[];let cursor=Math.round(.3*OUT);const chunks=[new Float64Array(cursor)];
for(const r of rendered){index.push(`${(cursor/OUT).toFixed(1).padStart(4)}s  ${r.label}`);chunks.push(r.samples,new Float64Array(gap));cursor+=r.samples.length+gap;}
const all=new Float64Array(cursor);let o=0;for(const c of chunks){all.set(c,o);o+=c.length;}
writeFileSync(new URL('md-00-sampler.wav',dir),wav(all,gain));
writeFileSync(new URL('md-00-index.txt',dir),index.join('\n')+'\n');
console.log(index.join('\n'));console.log('peak',peak.toFixed(4),'gain',gain.toFixed(2),'sampler seconds',(cursor/OUT).toFixed(1));
