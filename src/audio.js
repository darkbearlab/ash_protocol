// Synthesised cues, no audio files. hit / miss / kill added in 3.76.4; the older cues keep their original shapes.
export class AudioFX{
 constructor(){this.enabled=true;this.ctx=null;}
 play(type){if(!this.enabled)return;try{
  this.ctx??=new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume();
  const ctx=this.ctx,t=ctx.currentTime,gain=ctx.createGain();gain.connect(ctx.destination);
  const envelope=(peak,length)=>{gain.gain.setValueAtTime(peak,t);gain.gain.exponentialRampToValueAtTime(.001,t+length);};
  const noise=(length,cutoff)=>{const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*length),ctx.sampleRate),d=buffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/d.length*5);const n=ctx.createBufferSource();n.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=cutoff;n.connect(filter);filter.connect(gain);n.start(t);};
  const tone=(wave,from,to,length,ramp=length*.8)=>{const o=ctx.createOscillator();o.type=wave;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(to,t+ramp);o.connect(gain);o.start(t);o.stop(t+length);};
  if(type==='fire'){envelope(.065,.16);noise(.15,1600);}
  else if(type==='hit'){envelope(.09,.11);noise(.09,650);tone('sine',150,70,.1);}
  else if(type==='miss'){envelope(.03,.1);tone('sine',1300,750,.1);}
  else if(type==='kill'){envelope(.07,.28);tone('square',320,90,.28);noise(.12,420);}
  else{envelope(.065,.16);tone(type==='heal'?'sine':'triangle',type==='reload'?430:type==='heal'?650:type==='move'?100:240,type==='heal'?900:60,.17,.13);}
 }catch{}}
}
