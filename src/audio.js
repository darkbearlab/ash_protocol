import {SFX_FILES} from './sound-cues.js';
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
      const source=this.ctx.createBufferSource(),voice={cue,source,ended:false};
      source.buffer=buffer;source.connect(this.sfxBus);source.onended=()=>{voice.ended=true;};source.start();
      this.voices.push(voice);
    }catch{}
  }
  stopVoice(voice){if(!voice)return;voice.ended=true;try{voice.source.stop();}catch{}}
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
        Object.assign(token,{pending:false,source,gain});
      });
    }catch{}
  }
  fadeOut(track){
    try{
      if(!track||track.pending||!this.ctx)return;
      const now=this.ctx.currentTime;track.gain.gain.cancelScheduledValues(now);track.gain.gain.setValueAtTime(track.gain.gain.value,now);
      track.gain.gain.linearRampToValueAtTime(0,now+AUDIO_TUNING.crossfade);track.source.stop(now+AUDIO_TUNING.crossfade+.05);
    }catch{}
  }
}
