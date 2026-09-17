// Mega Drive round 2 (2026-09-17): only the sounds the user asked to change, with variants where the brief allows more than
// one reading. Adopted from round 1 and not re-rendered: rifle A, shotgun, hit (for now), grenade, footstep.
// Same engine (md-engine.mjs) and the same output gain as round 1, so loudness compares directly with the adopted sounds.
import {YM,OUT,TAU,NOTE,rand,fmVoice,dac,psg,biquad,op,THUMP,METAL,BELL,NOISEFM,gunshot,mix,wav,writeFileSync,mkdirSync} from './md-engine.mjs';

const ROUND1_GAIN=.89/1.6243;

// ---------- sample sources (built at 44.1 kHz, then reduced by dac())
const env=(t,attack,decay)=>Math.min(1,t/Math.max(1e-4,attack))*Math.exp(-Math.max(0,t-attack)/decay);
const crispShot=len=>{const hp=biquad('hp',2600,.7,OUT),bp=biquad('bp',1900,1.5,OUT),tick=biquad('bp',4200,4,OUT);
  return t=>hp(rand())*Math.exp(-t/.005)*1.0+bp(rand())*Math.exp(-t/(len*.3))*2.6+tick(rand())*Math.exp(-t/.003)*2.2+Math.sin(TAU*150*t)*Math.exp(-t/.02)*.9;};
const bigShot=len=>{const hp=biquad('hp',1800,.7,OUT),body=biquad('bp',650,.9,OUT),low=biquad('lp',160,.8,OUT);
  return t=>hp(rand())*Math.exp(-t/.008)*1.6+body(rand())*Math.exp(-t/(len*.35))*2.8+low(rand())*Math.exp(-t/.16)*4+Math.sin(TAU*70*(1-t*1.5)*t)*Math.exp(-t/.09)*1.1;};
const tailNoise=(cut,decay)=>{const lp=biquad('lp',cut,.7,OUT);return t=>lp(rand())*Math.exp(-t/decay)*3;};
const metalClick=(freq,decay,ring=0)=>{const bp=biquad('bp',freq,8,OUT),hp=biquad('hp',3000,.7,OUT);
  return t=>bp(rand())*Math.exp(-t/decay)*7+hp(rand())*Math.exp(-t/.002)*1.5+(ring?Math.sin(TAU*ring*t)*Math.exp(-t/(decay*3))*.35:0);};
const slideScrape=(from,to,len)=>{let f=biquad('bp',from,3,OUT),last=from;
  return t=>{const hz=from+(to-from)*Math.min(1,t/len);if(Math.abs(hz-last)>40){f=biquad('bp',hz,3,OUT);last=hz;}return f(rand())*env(t,.008,len*.5)*(.7+.3*Math.sin(TAU*90*t))*4;};};
const impactConcrete=()=>{const hp=biquad('hp',3000,.7,OUT),bp=biquad('bp',1250,2,OUT),grit=biquad('bp',3800,3,OUT);
  return t=>hp(rand())*Math.exp(-t/.004)*1.4+bp(rand())*Math.exp(-t/.028)*2.4+(rand()>.93?grit(rand()*6):grit(0))*Math.exp(-t/.07)*1.2;};
const whoosh=(from,to,len)=>{let f=biquad('bp',from,2.5,OUT),last=from;
  return t=>{const hz=from*(to/from)**Math.min(1,t/len);if(Math.abs(hz-last)>60){f=biquad('bp',hz,2.5,OUT);last=hz;}return f(rand())*env(t,len*.35,len*.3)*4;};};
const bodyImpact=()=>{const lp=biquad('lp',420,.8,OUT),mid=biquad('bp',900,1.2,OUT);
  return t=>lp(rand())*Math.exp(-t/.06)*3.5+mid(rand())*Math.exp(-t/.02)*1.6+Math.sin(TAU*95*(1-t*2.5)*t)*Math.exp(-t/.07)*1.2;};
const hiss=(cut,attack,decay)=>{const hp=biquad('hp',cut,.7,OUT);return t=>hp(rand())*env(t,attack,decay)*2;};
const tapeRip=len=>{const bp=biquad('bp',2100,1.5,OUT);let gate=1;
  return t=>{if(rand()>.86)gate=.25+Math.abs(rand());return bp(rand())*gate*env(t,.01,len*.45)*4;};};
const rumble=(cut,len)=>{const lp=biquad('lp',cut,.9,OUT);return t=>lp(rand())*(.65+.35*Math.sin(TAU*31*t))*env(t,.03,len*.55)*4;};
const clunk=()=>{const lp=biquad('lp',260,.9,OUT),bp=biquad('bp',1400,3,OUT);return t=>lp(rand())*Math.exp(-t/.045)*4+bp(rand())*Math.exp(-t/.01)*1.5;};
const squelch=(decay)=>{const hp=biquad('hp',900,.7,OUT);return t=>hp(rand())*Math.exp(-t/decay)*2;};

// ---------- FM helpers for this round
const SOFT_TONE=(pitch,length,level=0,rr=160)=>({pitch,length,level,alg:4,fb:0,ops:[op(1,34,.004,20,20,10,rr),op(1,0,.006,12,12,6,rr),op(1,96,.001,0,0,0,rr),op(1,96,.001,0,0,0,rr)]});
const TICK=(hz,length,level=0)=>({pitch:hz,length,level,alg:4,fb:1,ops:[op(3,22,.0003,900,60,600,1200),op(1,0,.0003,700,60,500,1200),op(1,96,.001,0,0,0,1200),op(1,96,.001,0,0,0,1200)]});
const PLASMA=(from,to,time,length,{index=22,fb=0,level=0,cents=0,vibrato}={})=>({pitch:{from,to,time,...(vibrato?{vibrato}:{})},length,level,alg:4,fb,
  ops:[op(1,index,.004,90,30,40,260,cents),op(1,0,.004,30,18,30,200,cents),op(1,96,.001,0,0,0,200),op(1,96,.001,0,0,0,200)]});

const S=[
  ['03-smg-a','衝鋒槍 A：更短更亮的取樣，每發加一下 FM 金屬聲',[0,.062,.124].flatMap((start,k)=>[dac({start,rate:11025,length:.05,build:crispShot(.05)}),fmVoice({...METAL(1100+k*40,.008,5),start})])],
  ['03-smg-b','衝鋒槍 B：16 kHz 更清脆的取樣，輸出濾波放寬到 6 kHz（接近二代機）',[0,.058,.116].map((start,k)=>dac({start,rate:16000,length:.04,build:crispShot(.04),gain:[1,.92,.96][k]})),6000],
  ['05-sniper-a','精準步槍 A：厚實的槍聲取樣、重低音下滑、金屬爆裂、兩次明顯迴音',[dac({rate:11025,length:.3,build:bigShot(.3)}),fmVoice(THUMP(115,36,.22,.16)),fmVoice(METAL(1250,.02,4)),dac({start:.2,rate:8000,length:.26,build:tailNoise(900,.08),gain:.6}),dac({start:.44,rate:8000,length:.3,build:tailNoise(700,.1),gain:.35})]],
  ['05-sniper-b','精準步槍 B：更低更長的爆裂與 FM 回授噪音衝擊',[dac({rate:8000,length:.45,build:bigShot(.45)}),fmVoice({...THUMP(95,30,.3,.22),fb:5}),fmVoice(NOISEFM({from:1600,to:500,time:.12},.06,0,.001,300)),dac({start:.3,rate:8000,length:.35,build:tailNoise(600,.12),gain:.4})]],
  ['06-plasma-a','電漿步槍 A：掃頻範圍縮窄（900→420 Hz），調變變淺，沒有高八度聲部',[fmVoice(PLASMA(900,420,.18,.14,{level:4})),fmVoice({...PLASMA(905,423,.18,.12,{level:13,cents:12}),start:.006})]],
  ['06-plasma-b','電漿步槍 B：更窄（700→520 Hz）、慢一點、帶一點能量顫動',[fmVoice(PLASMA(700,520,.26,.2,{index:18,fb:2,level:4,vibrato:{rate:28,cents:22,delay:0}})),dac({rate:8000,length:.08,build:hiss(1500,.005,.03),gain:.35})]],
  ['07-hit-b','命中 B（對照用）：COD 式的命中提示「噠」',[fmVoice(TICK(2600,.03)),psg({frames:[{noise:{hz:7000,white:true,vol:6}}]})]],
  ['08-miss-a','落空 A：子彈打進牆面，碎屑聲',[dac({rate:11025,length:.2,build:impactConcrete()})]],
  ['08-miss-b','落空 B：跳彈，撞擊後一聲短的呼嘯',[dac({rate:11025,length:.06,build:impactConcrete(),gain:.8}),fmVoice({...SOFT_TONE({from:3100,to:1750,time:.26,vibrato:{rate:17,cents:35,delay:.02}},.2,9,220),start:.03})]],
  ['08-miss-c','落空 C：子彈擦身而過的破空聲',[dac({rate:16000,length:.012,build:hiss(4000,.0005,.003),gain:.9}),dac({start:.005,rate:11025,length:.16,build:whoosh(3200,900,.16),gain:.8})],6000],
  ['09-kill-a','擊殺 A：肉體重擊加重低音，兩下金屬確認聲',[dac({rate:8000,length:.14,build:bodyImpact()}),fmVoice({...THUMP(140,40,.18,.14),fb:4}),fmVoice(TICK(2400,.03,1)),fmVoice({...TICK(1800,.05,2),start:.07})]],
  ['09-kill-b','擊殺 B：更粗糙的 6 kHz 重擊、次低音與一個低音銅管短擊',[dac({rate:6000,length:.18,build:bodyImpact()}),fmVoice({...THUMP(90,30,.3,.2),fb:5}),fmVoice({pitch:NOTE('A2'),length:.12,level:4,alg:4,fb:5,ops:[op(1,6,.002,60,20,40,220),op(1,0,.002,40,16,30,200),op(2,18,.002,80,30,40,220),op(1,8,.002,50,24,30,200)]})]],
  ['10-reload-a','裝填 A（完整）：退彈匣、彈匣滑出、插入彈匣、拉槍機、槍機回位',[
    dac({rate:16000,length:.03,build:metalClick(3000,.004)}),
    dac({start:.05,rate:11025,length:.12,build:slideScrape(1300,900,.12),gain:.55}),
    dac({start:.3,rate:16000,length:.06,build:metalClick(1700,.012,180)}),dac({start:.3,rate:8000,length:.05,build:clunk(),gain:.55}),
    dac({start:.5,rate:11025,length:.09,build:slideScrape(1900,2600,.09),gain:.7}),
    dac({start:.62,rate:16000,length:.07,build:metalClick(2300,.016,240)}),fmVoice({...METAL(1300,.01,12),start:.62})]],
  ['10-reload-b','裝填 B（短）：插入彈匣接拉放槍機',[
    dac({rate:16000,length:.06,build:metalClick(1700,.012,180)}),dac({rate:8000,length:.05,build:clunk(),gain:.55}),
    dac({start:.16,rate:11025,length:.08,build:slideScrape(1900,2600,.08),gain:.7}),
    dac({start:.27,rate:16000,length:.07,build:metalClick(2300,.016,240)}),fmVoice({...METAL(1300,.01,12),start:.27})]],
  ['13-heal-a','治療 A：注射器，喀一聲、加壓噴出、兩下很輕的心跳',[
    dac({rate:16000,length:.03,build:metalClick(2800,.004)}),
    dac({start:.07,rate:16000,length:.3,build:hiss(3200,.02,.12),gain:.7}),
    fmVoice({...SOFT_TONE({from:98,to:110,time:.4},.35,10,120),start:.1}),
    fmVoice({...THUMP(70,45,.08,.04),level:10,start:.42}),fmVoice({...THUMP(66,42,.08,.04),level:13,start:.56})]],
  ['13-heal-b','治療 B：撕開貼片，加一聲低沉的柔和音',[
    dac({rate:11025,length:.2,build:tapeRip(.2),gain:.8}),
    fmVoice({...SOFT_TONE(NOTE('A3'),.2,8,140),start:.18})]],
  ['14-transmission-a','升級通訊 A：無線電雜訊開、兩個低音嗶（向下半音）、雜訊關',[
    dac({rate:11025,length:.05,build:squelch(.015),gain:.6}),
    fmVoice({...SOFT_TONE(660,.09,9,400),start:.06}),fmVoice({...SOFT_TONE(622,.12,9,300),start:.21}),
    dac({start:.38,rate:11025,length:.07,build:squelch(.025),gain:.45})]],
  ['14-transmission-b','升級通訊 B：三個短促的低音嗶，尾巴帶一點靜電',[
    ...[0,.13,.26].map(start=>fmVoice({...SOFT_TONE(523,.06,10,500),start})),
    psg({start:0,frames:[{tone:{hz:1046,vol:12}},{},{},{},{},{},{},{tone:{hz:1046,vol:12}},{},{},{},{},{},{},{},{tone:{hz:1046,vol:12}}]}),
    dac({start:.34,rate:8000,length:.14,build:squelch(.05),gain:.3})]],
  ['15-ui-select','選單確認：同樣兩聲，整段壓短',[fmVoice({...BELL(NOTE('B5'),.02,6),ops:BELL(0,0).ops.map(o=>({...o,rr:420}))}),fmVoice({...BELL(NOTE('E6'),.035,4),ops:BELL(0,0).ops.map(o=>({...o,rr:300})),start:.028})]],
  ['16-door-a','開門 A：氣動門，洩氣聲、滑動、到位的悶響、餘氣',[
    dac({rate:16000,length:.34,build:hiss(1800,.01,.1)}),
    dac({start:.05,rate:8000,length:.38,build:rumble(600,.38),gain:.6}),
    dac({start:.42,rate:8000,length:.1,build:clunk(),gain:.9}),fmVoice({...THUMP(90,50,.06,.04),level:6,start:.42}),
    dac({start:.46,rate:16000,length:.22,build:hiss(3500,.005,.06),gain:.35})]],
  ['16-door-b','開門 B：短版，「噗嘶」一聲接「咚」',[
    dac({rate:16000,length:.18,build:hiss(2000,.006,.05)}),
    dac({start:.16,rate:8000,length:.1,build:clunk(),gain:.9}),fmVoice({...THUMP(95,50,.06,.04),level:6,start:.16})]],
];

const dir=new URL('./out-v2/',import.meta.url);mkdirSync(dir,{recursive:true});
const rendered=S.map(([id,label,parts,cutoff])=>({id,label,samples:mix(parts,cutoff||3400)}));
const peak=Math.max(...rendered.map(r=>r.samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0)));
// Round 1 gain for everything, so loudness compares with the adopted sounds; a sound that would pass -1 dBFS is turned down alone.
const gain=ROUND1_GAIN;
for(const r of rendered){const top=r.samples.reduce((m,v)=>Math.max(m,Math.abs(v)),0);if(top*gain>.89){const k=.89/(top*gain);for(let i=0;i<r.samples.length;i++)r.samples[i]*=k;console.log(`limited ${r.id} by ${(20*Math.log10(k)).toFixed(1)} dB`);}writeFileSync(new URL(`md2-${r.id}.wav`,dir),wav(r.samples,gain));}
const gap=Math.round(.7*OUT),index=[];let cursor=Math.round(.3*OUT);const chunks=[new Float64Array(cursor)];
for(const r of rendered){index.push(`${(cursor/OUT).toFixed(1).padStart(4)}s  ${r.label}`);chunks.push(r.samples,new Float64Array(gap));cursor+=r.samples.length+gap;}
const all=new Float64Array(cursor);let o=0;for(const c of chunks){all.set(c,o);o+=c.length;}
writeFileSync(new URL('md2-00-sampler.wav',dir),wav(all,gain));
writeFileSync(new URL('md2-00-index.txt',dir),index.join('\n')+'\n');
console.log(index.join('\n'));console.log('peak',peak.toFixed(4),'gain',gain.toFixed(3),'(round 1 gain',ROUND1_GAIN.toFixed(3)+')','sampler seconds',(cursor/OUT).toFixed(1));
