import {SFX_FILES} from './sound-cues.js';
import {GRIT_LEVELS,GRIT_DEFAULT,gritLevel,gritPlan,popShape,noiseBurst,POP_SHAPES,STATIC_Q,STATIC_ATTACK,DROPOUT_RAMP,WOW_HZ,FLUTTER_HZ} from './audio-grit.js';
// Sound playback (3.117.0): the adopted Mega Drive-style effects and music (docs/AUDIO.md, files in assets/audio/).
// Web Audio only. The context is created on the first user gesture, as browsers require. Every failure (no Web Audio,
// a blocked context, a missing or undecodable file) is swallowed: sound must never be able to interrupt a turn.

// Loop points in samples at 44.1 kHz, copied from art/audio/music/menu-theme-loop.json and faction-loops.json (a test
// keeps them equal). The menu theme plays its intro once; the faction loops repeat whole.
export const MUSIC_TRACKS=Object.freeze({
  menu:{file:'menu-theme',loopStart:120273,loopEnd:3487909},
  'loyalist-explore':{file:'loyalist-explore',loopStart:0,loopEnd:1176000},
  'loyalist-combat':{file:'loyalist-combat',loopStart:0,loopEnd:814154},
  'rebel-explore':{file:'rebel-explore',loopStart:0,loopEnd:1176000},
  'rebel-combat':{file:'rebel-combat',loopStart:0,loopEnd:756000},
  'swarm-explore':{file:'swarm-explore',loopStart:0,loopEnd:1176000},
  'swarm-combat':{file:'swarm-combat',loopStart:0,loopEnd:705600},
});
export const MUSIC_RATE=44100;
// Music is lossless FLAC so the loop points land on exact samples; AAC is the fallback where FLAC does not decode.
export const MUSIC_FORMATS=Object.freeze(['flac','m4a']);
export const AUDIO_TUNING=Object.freeze({voices:10,voicesPerCue:3,crossfade:1.2,musicDefault:60,sfxDefault:80});
export const volumePercent=(value,initial)=>{
  if(value===null||value===undefined||value===''||!['number','string'].includes(typeof value))return initial;
  const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n/5)*5)):initial;
};

export class AudioEngine{
  constructor(base=new URL('../assets/audio/',import.meta.url)){
    this.base=base;this.enabled=true;this.musicVolume=AUDIO_TUNING.musicDefault/100;this.sfxVolume=AUDIO_TUNING.sfxDefault/100;
    this.ctx=null;this.buffers=new Map();this.pending=new Map();this.voices=[];this.track=null;this.wanted=null;this.hidden=false;
    this.grit=GRIT_DEFAULT;this.gritSources=null;
  }
  // Called from a user gesture. Safe to call repeatedly.
  unlock(){
    if(!this.enabled)return;
    try{
      if(!this.ctx){
        const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;
        const ctx=this.ctx=new Context();
        this.compressor=ctx.createDynamicsCompressor();this.compressor.threshold.value=-10;this.compressor.ratio.value=4;this.compressor.connect(ctx.destination);
        this.sfxBus=ctx.createGain();this.sfxBus.connect(this.compressor);
        this.musicBus=ctx.createGain();this.musicBus.connect(ctx.destination);
        this.applyVolumes();
        for(const cue of Object.keys(SFX_FILES))this.load(`sfx:${cue}`);
      }
      if(this.ctx.state==='suspended'&&!this.hidden)this.ctx.resume().catch(()=>{});
      this.startWanted();
    }catch{}
  }
  applyVolumes(){if(!this.ctx)return;this.sfxBus.gain.value=this.sfxVolume;this.musicBus.gain.value=this.musicVolume;}
  // Signal noise (src/audio-grit.js). Takes effect on the next sound; the music's wow follows at once.
  setGrit(level){this.grit=gritLevel(level);this.applyWobble(this.track);}
  setVolumes({music=this.musicVolume,sfx=this.sfxVolume}={}){this.musicVolume=music;this.sfxVolume=sfx;this.applyVolumes();}
  setEnabled(on){
    this.enabled=on;
    try{if(!this.ctx){if(on)this.unlock();return;}if(on){if(!this.hidden)this.ctx.resume().catch(()=>{});this.startWanted();}else this.ctx.suspend().catch(()=>{});}catch{}
  }
  // A page in the background stops making sound and picks up where it was when it returns.
  background(hidden){
    this.hidden=hidden;
    try{if(!this.ctx)return;if(hidden)this.ctx.suspend().catch(()=>{});else if(this.enabled)this.ctx.resume().catch(()=>{});}catch{}
  }
  async decode(url){
    const response=await fetch(url);if(!response.ok)throw new Error(`${url}: ${response.status}`);
    const data=await response.arrayBuffer();
    return await new Promise((resolve,reject)=>{const p=this.ctx.decodeAudioData(data,resolve,reject);if(p?.then)p.then(resolve,reject);});
  }
  load(key){
    if(this.buffers.has(key))return Promise.resolve(this.buffers.get(key));
    if(this.pending.has(key))return this.pending.get(key);
    const [kind,id]=key.split(':');
    const job=(async()=>{
      if(kind==='sfx')return this.decode(new URL(`sfx/${SFX_FILES[id]}`,this.base));
      let last;for(const format of MUSIC_FORMATS){try{return await this.decode(new URL(`music/${MUSIC_TRACKS[id].file}.${format}`,this.base));}catch(error){last=error;}}
      throw last;
    })().then(buffer=>{this.buffers.set(key,buffer);this.pending.delete(key);return buffer;},()=>{this.pending.delete(key);return null;});
    this.pending.set(key,job);return job;
  }
  // A sound that is not decoded yet is skipped rather than played late, so it never lands after the moment it belongs to.
  play(cue){
    try{
      if(!this.enabled||!this.ctx||this.ctx.state!=='running'||!SFX_FILES[cue])return;
      const buffer=this.buffers.get(`sfx:${cue}`);if(!buffer){this.load(`sfx:${cue}`);return;}
      this.voices=this.voices.filter(v=>!v.ended);
      const same=this.voices.filter(v=>v.cue===cue);
      if(same.length>=AUDIO_TUNING.voicesPerCue)this.stopVoice(same[0]);
      if(this.voices.filter(v=>!v.ended).length>=AUDIO_TUNING.voices)this.stopVoice(this.voices.find(v=>!v.ended));
      const source=this.ctx.createBufferSource(),voice={cue,source,ended:false,gain:null};
      source.buffer=buffer;source.onended=()=>{voice.ended=true;};
      const plan=gritPlan(buffer.duration,this.grit);
      if(plan)source.start(this.roughen(voice,plan));else{source.connect(this.sfxBus);source.start();}
      this.voices.push(voice);
    }catch{}
  }
  stopVoice(voice){if(!voice)return;voice.ended=true;try{voice.source.stop();}catch{}try{voice.gain?.disconnect();}catch{}}
  // Plays a sound through its own gain so the pops, static and dropouts drawn for it stop with it. Returns the start time.
  roughen(voice,plan){
    const ctx=this.ctx,start=ctx.currentTime+plan.delay,gain=voice.gain=ctx.createGain();
    this.gritSources??={pops:Array.from({length:POP_SHAPES},(_,i)=>this.bufferOf(popShape(i,ctx.sampleRate))),noise:this.bufferOf(noiseBurst(ctx.sampleRate))};
    voice.source.playbackRate.value=plan.rate;voice.source.connect(gain);gain.connect(this.sfxBus);
    for(const pop of plan.pops){
      const source=ctx.createBufferSource(),level=ctx.createGain();source.buffer=this.gritSources.pops[pop.shape];level.gain.value=pop.gain;
      source.connect(level);level.connect(gain);source.start(start+pop.at);
    }
    for(const burst of plan.statics){
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),level=ctx.createGain(),at=start+burst.at;
      source.buffer=this.gritSources.noise;filter.type='bandpass';filter.frequency.value=burst.freq;filter.Q.value=STATIC_Q;
      level.gain.setValueAtTime(0,at);level.gain.linearRampToValueAtTime(burst.gain,at+STATIC_ATTACK);level.gain.linearRampToValueAtTime(0,at+burst.length);
      source.connect(filter);filter.connect(level);level.connect(gain);source.start(at,0,burst.length+.01);
    }
    for(const dropout of plan.dropouts){
      const at=start+dropout.at;
      gain.gain.setValueAtTime(1,at);gain.gain.linearRampToValueAtTime(dropout.depth,at+DROPOUT_RAMP);
      gain.gain.setValueAtTime(dropout.depth,at+dropout.length);gain.gain.linearRampToValueAtTime(1,at+dropout.length+DROPOUT_RAMP);
    }
    return start;
  }
  bufferOf(samples){const buffer=this.ctx.createBuffer(1,samples.length,this.ctx.sampleRate);buffer.getChannelData(0).set(samples);return buffer;}
  // Tape wow and flutter on the music: two slow oscillators on the track's detune, silent while the noise is off.
  wobble(track){
    try{
      if(!track.source.detune)return;
      track.wobble=[WOW_HZ,FLUTTER_HZ].map(hz=>{const oscillator=this.ctx.createOscillator(),depth=this.ctx.createGain();oscillator.frequency.value=hz;oscillator.connect(depth);depth.connect(track.source.detune);oscillator.start();return {oscillator,depth};});
      this.applyWobble(track);
    }catch{}
  }
  applyWobble(track){
    try{
      if(!track?.wobble)return;
      const spec=GRIT_LEVELS[this.grit],[wow,flutter]=track.wobble;
      wow.depth.gain.value=spec?.wowCents??0;flutter.depth.gain.value=spec?.flutterCents??0;
    }catch{}
  }
  // The wanted track is remembered even before the first gesture, so the right music starts as soon as sound can.
  setMusic(id){
    const next=id&&MUSIC_TRACKS[id]?id:null;
    if(next===this.wanted)return;
    this.wanted=next;this.startWanted();
  }
  startWanted(){
    try{
      if(!this.ctx||!this.enabled)return;
      const id=this.wanted;if(this.track?.id===id)return;
      this.fadeOut(this.track);this.track=null;
      if(!id)return;
      const token=this.track={id,pending:true};
      this.load(`music:${id}`).then(buffer=>{
        if(this.track!==token||!buffer||!this.ctx)return;
        const spec=MUSIC_TRACKS[id],source=this.ctx.createBufferSource(),gain=this.ctx.createGain(),now=this.ctx.currentTime;
        source.buffer=buffer;source.loop=true;source.loopStart=spec.loopStart/MUSIC_RATE;source.loopEnd=Math.min(buffer.duration,spec.loopEnd/MUSIC_RATE);
        gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+AUDIO_TUNING.crossfade);
        source.connect(gain);gain.connect(this.musicBus);source.start(now);
        Object.assign(token,{pending:false,source,gain});this.wobble(token);
      });
    }catch{}
  }
  fadeOut(track){
    try{
      if(!track||track.pending||!this.ctx)return;
      const now=this.ctx.currentTime;track.gain.gain.cancelScheduledValues(now);track.gain.gain.setValueAtTime(track.gain.gain.value,now);
      track.gain.gain.linearRampToValueAtTime(0,now+AUDIO_TUNING.crossfade);track.source.stop(now+AUDIO_TUNING.crossfade+.05);
      for(const {oscillator} of track.wobble||[])oscillator.stop(now+AUDIO_TUNING.crossfade+.05);
    }catch{}
  }
}
