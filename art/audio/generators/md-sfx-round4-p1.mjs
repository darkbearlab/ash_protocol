// Six adopted P1 sounds. Original creature attack adopted after wet revision was declined.
import {OUT,TAU,rand,biquad,dac,fmVoice,op,mix,wav,writeFileSync,mkdirSync} from './md-engine.mjs';
const dir=new URL('../candidates/round4-p1-adopted/',import.meta.url),G=.89/1.6243;
const off=()=>op(1,96,.001,0,0,0,500);
const body=(hz,len,level=12)=>fmVoice({pitch:{from:hz,to:hz*.65,time:len*.6},length:len*.4,level,alg:4,fb:2,ops:[op(2,24,.001,180,40,90,500),op(1,0,.002,140,40,100,500),off(),off()]});
const noise=(hz,q,env)=>{const f=biquad('bp',hz,q,OUT);return t=>f(rand())*env(t);};
const D=(start,len,build,gain)=>dac({start,rate:11025,length:len,build,gain});
const hit=(hz,decay)=>noise(hz,1.1,t=>Math.exp(-t/decay));
const sweep=(len)=>{const f=biquad('bp',1500,.8,OUT);return t=>f(rand())*Math.sin(Math.PI*t/len)**2*(.65+.35*Math.cos(TAU*38*t));};
const S=[
 ['lmg','輕機槍單發',.12,[D(0,.09,hit(700,.014),.75),D(0,.025,hit(2300,.003),.19),body(180,.09,15)]],
 ['creature-attack','生物撲咬／爪擊',.25,[D(0,.1,sweep(.1),.24),D(.05,.13,noise(850,.7,t=>Math.exp(-t/.04)*(.5+.5*Math.cos(TAU*60*t))),.48),body(230,.12,24)]],
 ['throw','投擲出手',.15,[D(0,.09,sweep(.09),.12),D(.01,.025,hit(550,.006),.055)]],
 ['pickup','拾取',.15,[D(0,.025,hit(1750,.004),.075),D(.027,.02,hit(900,.005),.035)]],
 ['open-case','箱子卡榫',.3,[D(0,.055,hit(1900,.008),.25),D(.065,.08,noise(900,2,t=>Math.exp(-t/.014)),.29),body(250,.07,29)]],
 ['hurt','玩家受傷',.2,[D(0,.09,hit(380,.024),.55),D(.012,.09,noise(900,.8,t=>Math.exp(-t/.022)*Math.cos(TAU*83*t)),.18),body(160,.11,15)]],
];

mkdirSync(dir,{recursive:true});
for(const [id,label,limit,parts] of S){
 const raw=mix(parts),n=Math.min(raw.length,Math.round(limit*OUT)),samples=raw.slice(0,n);
 for(let i=0;i<n;i++)samples[i]*=G*Math.min(1,i/(OUT*.0004),(n-1-i)/(OUT*.012));
 if(samples.some(v=>Math.abs(v)>10**(-1/20)))throw Error(id+' peak exceeded');
 writeFileSync(new URL(id+'.wav',dir),wav(samples,1));
}
