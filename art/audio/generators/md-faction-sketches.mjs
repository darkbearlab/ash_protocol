// Original faction underscore sketches. Audition only, deterministic, no game RNG.
// node art/audio/generators/md-faction-sketches.mjs
import {OUT,NOTE,op,fmVoice,psg,mix,wav,writeFileSync,mkdirSync,dac,biquad,rand,TAU} from './md-engine.mjs';
const dir=new URL('../faction-sketches/',import.meta.url);mkdirSync(dir,{recursive:true});
const off=()=>op(1,96,.01,0,0,0,200);
const patches={
 mist:{alg:4,fb:1,ops:[op(2,29,.32,7,10,1,70),op(1,0,.4,4,6,1,70),op(3,35,.3,9,15,2,70),op(1,13,.35,5,8,1,70)]},
 metal:{alg:4,fb:2,ops:[op(3,20,.006,55,30,8,170),op(1,0,.012,25,20,7,170),off(),off()]},
 bass:{alg:4,fb:3,ops:[op(1,17,.006,65,23,6,230),op(1,0,.009,24,12,6,230),op(2,27,.008,45,25,8,230),op(1,15,.01,28,18,8,230)]},
 thread:{alg:4,fb:2,ops:[op(3,21,.02,20,16,5,140),op(1,0,.035,9,8,3,140),op(1,32,.03,16,16,5,140),op(1,13,.035,12,12,4,140)]},
 pulse:{alg:4,fb:2,ops:[op(2,20,.003,65,22,14,280),op(1,0,.006,40,26,16,280),off(),off()]},
};
const factions=[
 {id:'loyalist',name:'忠誠者',bpm:104,roots:['E3','E3','F3','E3','E3','D3','F3','E3'],upper:['B3','F4','B3','G4'],pattern:[0,1,2,3],motif:['E4','F4','B3','E4']},
 {id:'rebel',name:'叛軍',bpm:112,roots:['D3','D3','G3','D3','F3','D3','C3','D3'],upper:['A3','D4','G#3','F4'],pattern:[0,1.5,2,3.5],motif:['D4','G#4','G4','D4']},
 {id:'swarm',name:'蟲族',bpm:120,roots:['F3','F3','F#3','F3','D#3','F3','F#3','F3'],upper:['C4','F#4','B3','G#4'],pattern:[0,.5,1.5,2,2.5,3.5],motif:['F4','F#4','C4','B3']},
];
const manifest=[];
for(const f of factions)for(const mode of ['explore','combat']){
 const battle=mode==='combat',bpm=battle?f.bpm:72,beat=60/bpm,parts=[],events=[];
 const add=(part,n,b,d,level)=>{events.push({part,n,beat:b,duration:d,level});parts.push(fmVoice({...patches[part],pitch:NOTE(n),start:b*beat,length:d*beat,level}));};
 const tick=(b,vol=12,frames=3)=>parts.push(psg({start:b*beat,frames:Array.from({length:frames},(_,i)=>({noise:{hz:f.id==='swarm'?3330:1665,white:true,vol:Math.min(15,vol+Math.floor(i/2))}}))}));
 for(let m=0;m<8;m++){
  const t=m*4,root=f.roots[m];
  add('mist',root,t,3.35,battle?31:24);
  // Sparse, unresolved intervals; not a functional chord progression or fanfare.
  if(m%2===0)add('mist',f.upper[(m/2)%4],t+1,2.4,battle?34:31);
  if(battle){
   for(const b of f.pattern)add('bass',root,t+b,.3,18+(b%1?4:0));
   for(const b of [1,3])tick(t+b,11,4);
   // A low FM impact on beat 1; no modern sub-bass dependency.
   parts.push(fmVoice({pitch:{from:175,to:95,time:.07},start:t*beat,length:.055,level:22,alg:4,fb:0,ops:[op(1,27,.001,100,40,60,400),op(1,0,.003,120,40,50,400),off(),off()]}));
   if(m!==3&&m!==7){for(const [i,b] of [0,1,2,3].entries())add(f.id==='swarm'?'pulse':'metal',f.motif[(i+m)%4],t+b+.5,.22,28);}
   if(m===2||m===6){add('thread',f.motif[0],t,1.55,22);add('thread',f.motif[1],t+2,.65,25);add('thread',f.motif[2],t+3,.7,25);}
  }else{
   // Silence between gestures is the main material. No imitation footsteps,
   // warning signals, weapon noises or jump scares to confuse combat information.
   if(m===1||m===5)add('thread',f.motif[m===1?0:2],t+1,1.7,31);
   if(m===3||m===7)add('metal',f.upper[m===3?1:3],t+2,.6,36);
   if(f.id==='rebel'&&m%3===0)tick(t+3,14,5);
   if(f.id==='swarm'&&m%2===1){add('pulse','F3',t+1,.6,32);add('pulse','F#3',t+2,.55,36);}
  }
 }
 const n=Math.round(32*beat*OUT),period=n/OUT,repeated=[];
 for(let k=0;k<3;k++)for(const p of parts)repeated.push({...p,start:p.start+k*period});
 const samples=mix(repeated).slice(n,n*2),peak=samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0);
 const rms=Math.sqrt(samples.reduce((m,x)=>m+x*x,0)/samples.length),gain=Math.min(.79/peak,(battle?.105:.061)/rms);
 if(samples.length!==n||!Number.isFinite(gain))throw Error('Invalid loop');
 const id=f.id+'-'+mode;writeFileSync(new URL(id+'.wav',dir),wav(samples,gain));
 manifest.push({id,faction:f.id,name:f.name,mode,bpm,loopStartSample:0,loopEndSample:n,sampleRate:OUT,seconds:period,peakDbFS:20*Math.log10(peak*gain),seamDelta:Math.abs(samples[0]-samples.at(-1))*gain,score:events});
}
// Plasma alternatives: broadband energy discharge rather than a pitched alert.
for(const [id,body,len] of [['plasma-a',780,.24],['plasma-b',1150,.17]]){
 const bp=biquad('bp',body,.8,OUT),hp=biquad('hp',2200,.7,OUT);
 const src=t=>bp(rand())*Math.exp(-t/(len*.23))*2.5*(.7+.3*Math.cos(TAU*75*t))+hp(rand())*Math.exp(-t/.003)*.5;
 const parts=[dac({start:0,rate:11025,length:len,build:src,gain:.85}),fmVoice({pitch:{from:150,to:100,time:.03},length:.045,level:18,alg:4,fb:6,ops:[op(3,10,.001,200,45,120,400),op(1,0,.002,100,40,100,400),off(),off()]})];
 const samples=mix(parts),peak=samples.reduce((m,x)=>Math.max(m,Math.abs(x)),0),gain=Math.min(.89/1.6243,.85/peak);
 writeFileSync(new URL(id+'.wav',dir),wav(samples,gain));
}
writeFileSync(new URL('manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
console.log(manifest.map(({score,...m})=>m));
