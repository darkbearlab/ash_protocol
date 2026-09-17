// Revision 2: preserve timbres/harmony, establish an audible quarter-note grid. Offline Mega Drive approximation;
// no game integration. Run from any directory: node art/audio/generators/md-menu-theme.mjs
import {fileURLToPath} from 'node:url';
import {OUT,NOTE,op,fmVoice,psg,mix,wav,writeFileSync,mkdirSync} from './md-engine.mjs';

const dir=fileURLToPath(new URL('../music/',import.meta.url));
mkdirSync(dir,{recursive:true});
const beat=60/88,bar=beat*4,parts=[],score=[];
const silent=()=>op(1,96,.01,0,0,0,240);
// Five independent FM parts maximum: bass, two sustained notes, sequence, lead.
// The sixth FM channel is unused. PSG supplies sparse radio/static ticks.
const patches={
 bass:{alg:4,fb:1,ops:[op(1,20,.015,45,24,2,180),op(1,0,.018,12,8,2,160),op(2,34,.012,35,30,8,190),op(1,12,.02,18,12,3,160)]},
 pad:{alg:4,fb:0,ops:[op(1,30,.2,10,18,1,85),op(1,0,.24,6,5,1,85),silent(),silent()]},
 sequence:{alg:4,fb:1,ops:[op(3,24,.006,120,38,12,220),op(1,0,.009,36,24,12,210),silent(),silent()]},
 lead:{alg:4,fb:0,ops:[op(2,28,.01,40,25,4,160),op(1,0,.012,12,7,3,150),op(1,38,.012,22,20,5,160),op(1,15,.015,12,8,3,150)]},
};
function note(part,n,start,duration,level){
 score.push({part,note:n,beat:start,duration,attenuationDb:level});
 parts.push(fmVoice({...patches[part],pitch:NOTE(n),start:start*beat,length:duration*beat,level}));
}
function staticTick(start,vol=13,long=false){
 parts.push(psg({start:start*beat,frames:Array.from({length:long?12:3},(_,i)=>({noise:{hz:long?1665:3330,white:true,vol:Math.min(15,vol+Math.floor(i/3))}}))}));
}

// 28 bars: A(8), B(8), sparse bridge(4), A-return(8). Integer beat onsets.
const loopSamples=Math.round(28*bar*OUT),loopSeconds=loopSamples/OUT;
const harmony=[['E3','B3'],['F3','C4'],['E3','G3'],['D3','A3'],['F3','B3'],['E3','B3'],['D3','A3'],['E3','B3']];
const melody=[['E4',4,.8,15],['F4',5,.8,17],['B3',6,1.7,17],['E4',8,2.7,16],['G4',12,.8,20],['F4',13,.8,20],['E4',14,1.7,18],['B3',20,1.7,19],['E4',22,1.7,16],['F4',24,.8,18],['B3',25,.8,18],['E4',26,2.7,17]];
for(let m=0;m<28;m++){
 const t=m*4,bridge=m>=16&&m<20,[a,b]=harmony[(m>=20?m-20:m)%8];
 note('pad',a,t,3.5,25);note('pad',b,t,3.5,29);
 const bass=['D3'].includes(a)?'D3':'E3';
 note('bass',bass,t,.95,bridge?20:16);if(!bridge)note('bass',bass,t+2,.7,20);
 if(m%8!==4){note('sequence',b,t+1,.25,bridge?29:25);note('sequence',a,t+3,.25,28);}
 if(m%2===1)staticTick(t+3,14);
}
for(const [n,t,d,l] of melody)note('lead',n,t,d,l);
for(const [n,t,d,l] of melody)note('lead',n==='G4'?'B4':n,t+32,d,l+2);
for(const [n,t,d,l] of melody)note('lead',n,t+80,d,l);
staticTick(67,14,true);staticTick(75,14,true);
// Repeat before filtering, then extract a steady-state cycle. Tails cross the seam
// rather than fading to silence. Same sample period used for scheduling and slicing.
const cycle=parts.splice(0),tripled=[];
for(let i=0;i<3;i++)for(const p of cycle)tripled.push({...p,start:p.start+i*loopSeconds});
const steady=mix(tripled).slice(loopSamples,loopSamples*2);
if(steady.length!==loopSamples)throw Error('Incomplete loop');
// Intro is separate; the master includes intro once followed by the loop.
score.length=0;
note('pad','E3',0,3.6,22);staticTick(0,12,true);staticTick(3,13);
note('sequence','E4',1,.3,21);note('sequence','F4',2,.25,24);note('sequence','B3',3,.5,23);
const introN=Math.round(bar*OUT),intro=mix(parts),master=new Float64Array(introN+loopSamples);
master.set(intro.subarray(0,introN));master.set(steady,introN);
// Fade only the final 10 ms of the one-time intro; repeat region is exact.
for(let i=0;i<Math.round(.01*OUT);i++)master[introN-1-i]*=i/(.01*OUT);
const peak=master.reduce((m,x)=>Math.max(m,Math.abs(x)),0);
const rms=Math.sqrt(steady.reduce((m,x)=>m+x*x,0)/loopSamples),gain=Math.min(.84/peak,.115/rms);
writeFileSync(dir+'menu-theme.wav',wav(master,gain));
writeFileSync(dir+'menu-theme-loop.wav',wav(steady,gain));
const seam=Math.abs(steady[0]-steady.at(-1))*gain;
if(!Number.isFinite(gain)||seam>.02)throw Error('Unexpected loop seam');
const info={bpm:88,loopStartSample:introN,loopEndSample:master.length,loopStartSeconds:introN/OUT,loopEndSeconds:master.length/OUT,loopDuration:loopSeconds,loopSamples,rate:OUT,seamDelta:seam,gain,structure:'A8 / B8 / bridge4 / A-return8',motif:'E F B E',source:'md-menu-theme.mjs; md-engine.mjs',note:'Standalone loop WAV is the exact repeat region; intro-only tail fade is 10 ms. Not a register-exact hardware export.'};
writeFileSync(dir+'menu-theme-loop.json',JSON.stringify(info,null,2)+'\n');
writeFileSync(dir+'menu-theme-loop.txt',Object.entries(info).map(([k,v])=>`${k}: ${v}`).join('\n')+'\n');
console.log(info);
