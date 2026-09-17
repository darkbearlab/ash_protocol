// Signal damage on sound (3.118.0 trial, user request "隨機爆音或偏移"): every sound effect plays back with a slightly
// different pitch and a little timing slip, and sometimes picks up a pop, a burst of static or a dropout, so repeated
// shots never sound identical and the audio sits with the VHS picture. Music gets tape wow and flutter.
// Pure: the plan is drawn here and played by src/audio.js (and rendered offline for auditions). Cosmetic only; the random
// source defaults to Math.random and is never the game's rng.
export const GRIT_LEVELS=Object.freeze({
  off:null,
  light:Object.freeze({cents:25,jitterMs:6,popChance:.3,maxPops:1,popGain:[.12,.3],staticChance:.12,staticGain:[.03,.08],dropoutChance:.08,dropoutDepth:[.35,.6],wowCents:5,flutterCents:1.5}),
  heavy:Object.freeze({cents:70,jitterMs:20,popChance:.75,maxPops:3,popGain:[.25,.6],staticChance:.4,staticGain:[.06,.16],dropoutChance:.3,dropoutDepth:[.1,.4],wowCents:14,flutterCents:4}),
});
export const GRIT_DEFAULT='off';
export const gritLevel=value=>Object.hasOwn(GRIT_LEVELS,value)?value:GRIT_DEFAULT;
// Tape wow and flutter: two slow sines on the music's pitch, in cents.
export const WOW_HZ=.6,FLUTTER_HZ=6.1;
export const POP_SHAPES=6;
export const STATIC_Q=1.2;

// duration: the sound's length in seconds at normal speed. Times in the plan are seconds after the sound starts.
export function gritPlan(duration,level,rand=Math.random){
  const spec=GRIT_LEVELS[gritLevel(level)];if(!spec)return null;
  const between=([low,high])=>low+(high-low)*rand();
  const rate=2**((rand()*2-1)*spec.cents/1200),length=duration/rate,delay=rand()*spec.jitterMs/1000;
  const pops=[];
  if(rand()<spec.popChance){
    const count=1+Math.floor(rand()*spec.maxPops);
    for(let i=0;i<count;i++)pops.push({at:rand()*(length+.04),gain:between(spec.popGain)*(rand()<.5?-1:1),shape:Math.floor(rand()*POP_SHAPES)});
  }
  const statics=rand()<spec.staticChance?[{at:rand()*length,length:.03+rand()*.09,gain:between(spec.staticGain),freq:1200+rand()*3000}]:[];
  const dropouts=rand()<spec.dropoutChance?[{at:rand()*length*.8,length:.015+rand()*.045,depth:between(spec.dropoutDepth)}]:[];
  return {rate,delay,pops,statics,dropouts};
}

// A pop is a click that dies away within a few milliseconds; the six shapes differ in length and in how dull they are.
// Deterministic by index, so the offline audition and the game use the same clicks.
export function popShape(index,sampleRate){
  let seed=(index+1)*2654435761>>>0;
  const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const length=Math.max(8,Math.round(sampleRate*(.002+.001*index))),dull=.15+.13*index,out=new Float32Array(length);
  let low=0;
  for(let i=0;i<length;i++){
    const raw=i===0?1:(next()*2-1)*Math.exp(-i/(length*.28));
    low+=(raw-low)*(1-dull);out[i]=i===0?1:low;
  }
  return out;
}
export function noiseBurst(sampleRate,seconds=.2){
  let seed=0x9e3779b9;
  const out=new Float32Array(Math.round(sampleRate*seconds));
  for(let i=0;i<out.length;i++){seed=(seed*1664525+1013904223)>>>0;out[i]=seed/2147483648-1;}
  return out;
}
// A static burst swells in over 3 ms and fades out over the rest of its length; a dropout dips over 5 ms, holds, and
// recovers over 5 ms. Shared so the game's automation and the offline render agree.
export const STATIC_ATTACK=.003,DROPOUT_RAMP=.005;
