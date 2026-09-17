// Audition-only sound design, not adopted game assets. Original procedural sources.
import {OUT,TAU,rand,biquad,dac,fmVoice,psg,op,THUMP,mix,wav,writeFileSync,mkdirSync} from './md-engine.mjs';
const dir=new URL('../round3/',import.meta.url);mkdirSync(dir,{recursive:true});
const off=()=>op(1,96,.001,0,0,0,500);
const tone=(hz,len,level=0)=>fmVoice({pitch:hz,length:len,level,alg:4,fb:0,ops:[op(1,32,.003,80,30,10,250),op(1,0,.006,25,14,10,220),off(),off()]});
const shot=(len,body,crack)=>{const b=biquad('bp',body,1.1,OUT),h=biquad('hp',crack,.7,OUT);return t=>b(rand())*Math.exp(-t/(len*.22))*2+h(rand())*Math.exp(-t/.0025)*.9+Math.sin(TAU*170*t)*Math.exp(-t/.016)*.35;};
const mech=(hz,decay)=>{const b=biquad('bp',hz,2,OUT);return t=>b(rand())*Math.exp(-t/decay)*2+Math.sin(TAU*hz*.38*t)*Math.exp(-t/.004)*.15;};
const air=(len,hz)=>{const b=biquad('bp',hz,.65,OUT);return t=>b(rand())*Math.min(1,t/.035)*Math.min(1,(len-t)/.045)*(.65+.35*Math.sin(Math.PI*t/len));};
const D=(start,len,build,gain=1)=>dac({start,rate:11025,length:len,build,gain});
const S=[];
// Three deterministic shot variations for audition; the first is also exported alone below.
S.push(['01-smg','衝鋒槍：乾短爆裂，三發試聽',[0,.09,.18].map(t=>D(t,.09,shot(.09,1800,3400),.65))]);
S.push(['02-precision','精準步槍：尖銳前緣、胸腔衝擊與短室內尾音',[D(0,.28,shot(.28,950,2200)),{...fmVoice({...THUMP(190,90,.05,.05),level:12}),start:0},D(.045,.11,shot(.11,800,2600),.12)]]);
S.push(['03-plasma','電漿：固定音高的能量鼓動，不做雷射滑音',[fmVoice({pitch:210,length:.24,level:9,alg:4,fb:3,ops:[op(2,18,.018,30,15,10,180),op(1,0,.012,15,8,12,160),op(3,26,.02,30,20,10,200),op(1,12,.012,15,10,12,160)]})]]);
S.push(['04-kill','擊殺：乾重擊加短促截止，無旋律',[D(0,.12,shot(.12,420,1800),.65),D(.022,.035,mech(1700,.004),.35),fmVoice({...THUMP(190,70,.065,.06),level:8})]]);
S.push(['05-reload','裝填：卡榫、摩擦、入座、槍機；不加鈴聲',[D(0,.045,mech(2600,.007),.45),D(.09,.1,air(.1,1800),.1),D(.27,.06,mech(950,.014),.7),D(.44,.1,air(.1,2600),.16),D(.54,.05,mech(1800,.01),.65)]]);
S.push(['06-heal','治療：封包撕開、短噴注、扣回',[D(0,.12,air(.12,2800),.22),D(.15,.25,air(.25,1300),.3),D(.42,.035,mech(1700,.004),.2)]]);
S.push(['07-transmission','通訊：兩聲同音短呼叫，悶、無琶音',[{...tone(440,.07,13),start:.04},{...tone(440,.1,15),start:.22},D(0,.028,air(.028,1900),.09)]]);
S.push(['08-door','氣動門：壓力起動、連續滑動、短制動',[D(0,.15,air(.15,1050),.34),D(.09,.5,air(.5,650),.25),D(.6,.045,mech(650,.011),.4)]]);
const gain=.89/1.6243,index=[];let cursor=.4;const sampler=[];
for(const [id,label,p] of S){const samples=mix(p),peak=samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0);const g=Math.min(gain,.85/peak);
if(id==='01-smg'){
 const single=mix([p[0]]),adopted=new URL('../adopted/',import.meta.url);mkdirSync(adopted,{recursive:true});
 // Reuse burst gain and its already generated first shot: no extra RNG, no crop,
 // full filter tail, no normalization change and no second/third impulse.
 writeFileSync(new URL('md3-01-smg-single.wav',adopted),wav(single,g));
}
const scaled=Float64Array.from(samples,x=>x*g);writeFileSync(new URL(id+'.wav',dir),wav(scaled,1));index.push({id,label,seconds:cursor});sampler.push({at:Math.round(cursor*OUT),samples:scaled});cursor+=samples.length/OUT+1.1;}
const all=new Float64Array(Math.ceil(cursor*OUT));for(const p of sampler)all.set(p.samples,p.at);
writeFileSync(new URL('sfx-round3-sampler.wav',dir),wav(all,1));writeFileSync(new URL('index.json',dir),JSON.stringify(index,null,2)+'\n');
// Two non-musical facility beds. Seeded noise + periodic machinery, no threat cues.
// Fold a tail into the beginning with complementary weights for a continuous seam.
for(const [id,desc,hz,level] of [['ambience-vent','通風設施',135,.12],['ambience-reactor','機械設施',180,.15]]){
 const N=20*OUT,overlap=OUT,buffer=new Float64Array(N+overlap),lp=biquad('lp',id==='ambience-vent'?850:1200,.7,OUT),hp=biquad('hp',100,.7,OUT);
 for(let i=0;i<buffer.length;i++){const t=i/OUT;buffer[i]=hp(lp(rand()))*level*(.8+.2*Math.cos(TAU*t/10))+.012*Math.sin(TAU*hz*t)*(1+.15*Math.cos(TAU*t/5))+.005*Math.sin(TAU*hz*2*t);}
 for(let i=0;i<overlap;i++){const w=i/overlap;buffer[i]=buffer[N+i]*(1-w)+buffer[i]*w;}
 const loop=buffer.slice(0,N);writeFileSync(new URL(id+'.wav',dir),wav(loop,1));
 index.push({id,label:desc,loopSamples:N,rate:OUT,duration:20,peak:loop.reduce((m,x)=>Math.max(m,Math.abs(x)),0),status:'audition; quieter than music and weapons'});
}
writeFileSync(new URL('index.json',dir),JSON.stringify(index,null,2)+'\n');console.log(index);
