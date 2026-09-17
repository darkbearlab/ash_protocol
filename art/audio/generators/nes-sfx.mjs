// NES-style sound effect samples for ASH PROTOCOL (2026-09-17, user request: "try a few, do not wire them into the game").
// A small offline model of the 2A03 APU: two pulse channels (duty 12.5/25/50/75%), a 32-step triangle, a 15-bit LFSR
// noise channel with the NTSC period table and its short "metallic" mode, 4-bit volumes, register changes only on 60 Hz
// frames, the nonlinear APU mixer, and the console's output filters (high-pass 90 Hz and 440 Hz, low-pass 14 kHz).
// Every sound is a list of per-frame register states, so the same data could later drive a runtime synth.
import {writeFileSync,mkdirSync} from 'node:fs';

const CPU=1789773,RATE=44100,OVER=8,FRAME=1/60;
const DUTY=[[0,1,0,0,0,0,0,0],[0,1,1,0,0,0,0,0],[0,1,1,1,1,0,0,0],[1,0,0,1,1,1,1,1]];
const TRI=[15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15];
const NOISE=[4,8,16,32,64,96,127,160,202,254,380,508,762,1016,2034,4068];
const pulsePeriod=hz=>Math.max(8,Math.min(0x7ff,Math.round(CPU/(16*hz)-1)));
const triPeriod=hz=>Math.max(2,Math.min(0x7ff,Math.round(CPU/(32*hz)-1)));
const NOTE=name=>{const m=/^([A-G])(#?)(\d)$/.exec(name),i={C:-9,D:-7,E:-5,F:-4,G:-2,A:0,B:2}[m[1]]+(m[2]?1:0);return 440*2**((i+(Number(m[3])-4)*12)/12);};

// frames: array of {p1:{hz,duty,vol}, p2:{...}, tri:{hz}, noise:{index,mode,vol}}; a missing channel is silent.
function render(frames){
  const total=Math.ceil((frames.length*FRAME+.12)*RATE),out=new Float64Array(total);
  const st={p1:0,p2:0,tri:0,triOut:0,lfsr:1,noisePos:0};
  let hp1=0,hp1x=0,hp2=0,hp2x=0,lp=0;
  const a90=RATE/(RATE+2*Math.PI*90),a440=RATE/(RATE+2*Math.PI*440),lpA=(2*Math.PI*14000)/(RATE+2*Math.PI*14000);
  for(let s=0;s<total;s++){
    const f=frames[Math.floor(s/RATE/FRAME)]||{};let acc=0;
    for(let k=0;k<OVER;k++){
      const dt=1/(RATE*OVER);
      const pulse=(key,c)=>{if(!c||!c.vol)return 0;const period=pulsePeriod(c.hz),hz=CPU/(16*(period+1));st[key]=(st[key]+hz*dt)%1;return DUTY[c.duty??2][Math.floor(st[key]*8)]*c.vol;};
      const p=pulse('p1',f.p1)+pulse('p2',f.p2);
      if(f.tri){const period=triPeriod(f.tri.hz);st.tri=(st.tri+CPU/(32*(period+1))*dt)%1;st.triOut=TRI[Math.floor(st.tri*32)];}
      let n=0;
      if(f.noise&&f.noise.vol){
        st.noisePos+=CPU/NOISE[f.noise.index]*dt;
        while(st.noisePos>=1){st.noisePos--;const bit=(st.lfsr^(st.lfsr>>(f.noise.mode?6:1)))&1;st.lfsr=(st.lfsr>>1)|(bit<<14);}
        n=(st.lfsr&1)?0:f.noise.vol;
      }
      const pulseOut=p?95.88/(8128/p+100):0,tnd=st.triOut/8227+n/12241,tndOut=tnd?159.79/(1/tnd+100):0;
      acc+=pulseOut+tndOut;
    }
    const x=acc/OVER;
    hp1=a90*(hp1+x-hp1x);hp1x=x;hp2=a440*(hp2+hp1-hp2x);hp2x=hp1;lp+=lpA*(hp2-lp);
    out[s]=lp;
  }
  return out;
}

// Helpers that build frame lists.
const seq=(n,fn)=>Array.from({length:n},(_,i)=>fn(i));
const merge=(...tracks)=>seq(Math.max(...tracks.map(t=>t.length)),i=>Object.assign({},...tracks.map(t=>t[i]||{})));
const at=(offset,track)=>[...Array(offset).fill({}),...track];
const vols=(list,fn)=>list.map((vol,i)=>fn(vol,i));
const slide=(from,to,n,i)=>from*(to/from)**(Math.min(i,n-1)/Math.max(1,n-1));

const SOUNDS=[
  ['01-rifle-a','突擊步槍開火 A：噪音爆發加低音砰',merge(
    vols([15,12,9,7,5,3,2,1],(vol,i)=>({noise:{index:[3,4,5,6,6,7,7,8][i],mode:0,vol}})),
    vols([12,8,4,2],(vol,i)=>({p1:{hz:slide(110,55,4,i),duty:2,vol}})))],
  ['02-rifle-b','突擊步槍開火 B：金屬感短循環噪音',merge(
    [...vols([15,10,6,3],(vol)=>({noise:{index:4,mode:1,vol}})),...vols([4,3,2,1],(vol)=>({noise:{index:7,mode:0,vol}}))])],
  ['03-smg','衝鋒槍三連發',merge(
    seq(12,i=>{const k=i%4;return k===3?{}:{noise:{index:2+(i>>2),mode:0,vol:[13,8,3][k]},p1:k===0?{hz:180-(i>>2)*20,duty:1,vol:6}:undefined};}))],
  ['04-shotgun','霰彈槍：長噪音加三角波重擊',merge(
    vols([15,15,13,11,9,8,7,6,5,4,3,3,2,2,1,1],(vol,i)=>({noise:{index:i<3?5:i<8?7:9,mode:0,vol}})),
    seq(6,i=>({tri:{hz:slide(90,40,6,i)}})))],
  ['05-sniper','精準步槍：高音爆裂加迴音尾巴',merge(
    vols([15,13,9],(vol,i)=>({p1:{hz:slide(1600,400,3,i),duty:0,vol}})),
    [...vols([15,11],(vol)=>({noise:{index:2,mode:0,vol}})),...vols([9,8,7,6,6,5,5,4,4,3,3,3,2,2,2,1,1,1],(vol)=>({noise:{index:10,mode:0,vol}}))])],
  ['06-plasma','電漿步槍：雙方波下滑',merge(
    vols([15,14,13,12,11,10,9,7,5,3,2,1],(vol,i)=>({p1:{hz:slide(1800,220,12,i),duty:0,vol}})),
    at(1,vols([8,8,7,6,5,4,3,2,1],(vol,i)=>({p2:{hz:slide(1850,230,9,i),duty:1,vol}}))),
    vols([6,3,1],(vol)=>({noise:{index:1,mode:1,vol}})))],
  ['07-hit','命中：噪音點擊加低音下沉',merge(
    vols([15,9,4,1],(vol)=>({noise:{index:8,mode:0,vol}})),
    seq(5,i=>({tri:{hz:slide(220,100,5,i)}})))],
  ['08-miss','落空：短促的呼嘯',merge(
    vols([8,7,5,3,2,1],(vol,i)=>({p1:{hz:slide(1400,800,6,i),duty:1,vol}})))],
  ['09-kill','擊殺：下行琶音加低音',merge(
    ['E4','E4','E4','C4','C4','C4','A3','A3','A3','A3','A3','A3'].map((note,i)=>({p1:{hz:NOTE(note),duty:2,vol:[12,10,8,11,9,7,10,8,6,4,2,1][i]}})),
    seq(10,()=>({tri:{hz:NOTE('A2')}})),
    vols([8,6,4,2],(vol)=>({noise:{index:10,mode:0,vol}})))],
  ['10-reload','裝填：兩下金屬扣合',merge(
    [...vols([12,6,2],(vol)=>({noise:{index:1,mode:1,vol}})),{},{},{},{},...vols([15,8,3,1],(vol)=>({noise:{index:0,mode:1,vol}}))],
    at(7,[{p1:{hz:2800,duty:0,vol:6}}]))],
  ['11-grenade','爆炸：低頻噪音長衰減加隆隆聲',merge(
    seq(48,i=>({noise:{index:i<6?11:i<20?12:13,mode:0,vol:Math.max(0,15-Math.floor(i/3.4))}})),
    seq(14,i=>({tri:{hz:slide(60,28,14,i)}})))],
  ['12-footstep','腳步：很輕的一聲',merge(
    vols([5,2],(vol)=>({noise:{index:11,mode:0,vol}})))],
  ['13-heal','治療：上行琶音加回聲',merge(
    ['C5','C5','C5','E5','E5','E5','G5','G5','G5','C6','C6','C6','C6','C6'].map((note,i)=>({p1:{hz:NOTE(note),duty:2,vol:[9,8,7,9,8,7,9,8,7,9,8,6,4,2][i]}})),
    at(2,['C5','C5','C5','E5','E5','E5','G5','G5','G5','C6','C6','C6'].map((note,i)=>({p2:{hz:NOTE(note),duty:1,vol:[4,3,3,4,3,3,4,3,3,4,2,1][i]}}))))],
  ['14-transmission','升級通訊：資料嗶聲加兩音警示',merge(
    [...seq(18,i=>({p1:{hz:[1760,2349,1976,2637,1568,2093][(i*7)%6],duty:0,vol:i%2?5:7}})),{},{},
     ...seq(8,i=>({p1:{hz:NOTE('A5'),duty:2,vol:[11,11,10,9,8,7,6,5][i]}})),...seq(12,i=>({p1:{hz:NOTE('E5'),duty:2,vol:[11,11,10,9,8,7,6,5,4,3,2,1][i]}}))],
    seq(18,i=>(i%3===0?{noise:{index:0,mode:1,vol:3}}:{})))],
  ['15-ui-select','選單確認：短嗶兩聲',merge(
    [...seq(3,()=>({p1:{hz:NOTE('B5'),duty:1,vol:10}})),...seq(6,i=>({p1:{hz:NOTE('E6'),duty:1,vol:[10,9,7,5,3,1][i]}}))])],
  ['16-door','開門：摩擦噪音加低音嘎吱',merge(
    vols([6,7,8,8,8,7,7,6,5,4,3,2,1],(vol)=>({noise:{index:13,mode:0,vol}})),
    seq(12,i=>({p1:{hz:i%2?92:84,duty:3,vol:Math.max(0,4-(i>>3))}})))],
];

const dir=new URL('./out-nes/',import.meta.url);mkdirSync(dir,{recursive:true});
function wav(samples,gain){
  const data=Buffer.alloc(samples.length*2);
  for(let i=0;i<samples.length;i++)data.writeInt16LE(Math.max(-32768,Math.min(32767,Math.round(samples[i]*gain*32767))),i*2);
  const h=Buffer.alloc(44);
  h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);
  h.writeUInt32LE(RATE,24);h.writeUInt32LE(RATE*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
  return Buffer.concat([h,data]);
}
const rendered=SOUNDS.map(([id,label,frames])=>({id,label,samples:render(frames)}));
// One gain for every sound, so their loudness relative to each other stays as designed; the loudest peak is -1 dBFS.
const peak=Math.max(...rendered.map(r=>Math.max(...r.samples.map(Math.abs)))),gain=.89/peak;
for(const r of rendered)writeFileSync(new URL(`${r.id}.wav`,dir),wav(r.samples,gain));
// A sampler: every sound in order with 0.7 s between, and a list of where each one starts.
const gap=Math.round(.7*RATE),parts=[],index=[];let cursor=Math.round(.3*RATE);parts.push(new Float64Array(cursor));
for(const r of rendered){index.push(`${(cursor/RATE).toFixed(1).padStart(4)}s  ${r.label}`);parts.push(r.samples,new Float64Array(gap));cursor+=r.samples.length+gap;}
const all=new Float64Array(cursor);let o=0;for(const p of parts){all.set(p,o);o+=p.length;}
writeFileSync(new URL('00-sampler.wav',dir),wav(all,gain));
writeFileSync(new URL('00-index.txt',dir),index.join('\n')+'\n');
console.log(index.join('\n'));console.log('peak',peak.toFixed(4),'gain',gain.toFixed(2),'sampler seconds',(cursor/RATE).toFixed(1));
