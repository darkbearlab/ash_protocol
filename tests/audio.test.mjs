import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {eventSounds,actionSound,SFX_FILES,WEAPON_SFX} from '../src/sound-cues.js';
import {engagementHeard,freshCombat,stepCombat,musicTrack,musicFaction,MUSIC_TUNING} from '../src/music-state.js';
import {MUSIC_TRACKS,MUSIC_RATE,MUSIC_FORMATS,volumePercent} from '../src/audio.js';

// 3.117.0: the adopted Mega Drive-style audio (docs/AUDIO.md). Decisions by the user: combat music starts on an enemy's
// engagement line and ends after ten turns with no enemy in view; kill house is human; the player's own misses are silent.
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');   // a Windows checkout may have CRLF
const sha=async path=>createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');
function arena(){
  const g=new Game(51);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();return g;
}
const allSounds=plan=>plan.events.flatMap(event=>eventSounds(event.effects,event.state));

test('a shot is heard once per actual shot, with its weapon family, from the player or an enemy',()=>{
  const g=arena(),e=makeEnemy('brute',13,10,'b');e.hp=900;e.maxHp=900;g.enemies.push(e);g.reveal();
  g.rng=Object.assign(()=>.99,{state:()=>0});      // every roll misses, so only the firing sound is in play
  g.target='b';
  assert.deepEqual(allSounds(planPresentation(captureAction(g,()=>g.action('fire')).steps)).filter(c=>c!=='hit'),['rifle'],'three cosmetic rounds, one rifle shot, and a player miss is silent');
  const shotgun=[0,1,2,3,4,5].map(i=>({type:'shot',weaponId:'shotgun',from:{x:1,y:1},to:{x:5,y:i},primary:true}));
  assert.deepEqual(eventSounds(shotgun),['shotgun'],'a cone sends one trace per target but is one blast');
  assert.deepEqual(eventSounds([{type:'enemyShot',attackerType:'raider',from:{x:3,y:3},primary:true},{type:'enemyShot',attackerType:'raider',from:{x:3,y:3},primary:false}]),['smg']);
  assert.deepEqual(eventSounds([{type:'enemyShot',attackerType:'drone',from:{x:3,y:3},primary:true},{type:'enemyShot',attackerType:'sniper',from:{x:6,y:3},primary:true}]),['plasma','precision'],'two shooters, two sounds');
  for(const id of ['lmg','launcher','powerfist','thunder','unarmed'])assert.deepEqual(eventSounds([{type:'shot',weaponId:id,from:{x:1,y:1},primary:true}]),[],`${id} waits for its own sound`);
  assert.deepEqual(Object.values(WEAPON_SFX).filter(cue=>!SFX_FILES[cue]),[]);
});

test('results: a kill outranks a hit, and only a bullet missing the player makes the miss sound',()=>{
  const state={player:{x:2,y:2},enemies:[{x:3,y:4,hp:0}]};
  assert.deepEqual(eventSounds([{type:'impact'},{type:'fall',actorType:'rifleman',from:{x:3,y:4}}],state),['kill']);
  assert.deepEqual(eventSounds([{type:'impact'}],state),['hit']);
  assert.deepEqual(eventSounds([{type:'fall',actorType:'drone',from:{x:9,y:9}}],state),[],'an ally falling is not a kill');
  assert.deepEqual(eventSounds([{type:'miss',attackerType:'rifleman',from:{x:2,y:2}}],state),['enemyMiss'],'an enemy bullet into the wall beside the player');
  assert.deepEqual(eventSounds([{type:'miss',weaponId:'rifle',from:{x:3,y:4}}],state),[],"the player's own miss is silent");
  for(const type of ['crawler','drone','spitter'])assert.deepEqual(eventSounds([{type:'miss',attackerType:type,from:{x:2,y:2}}],state),[],`${type}: not a bullet`);
  assert.deepEqual(eventSounds([{type:'miss',attackerType:'rifleman',from:{x:7,y:7}}],state),[],'a bullet aimed at an ally');
  assert.deepEqual(eventSounds([{type:'blast'},{type:'gate'}],state),['blast','door']);
  assert.equal(actionSound('move'),'footstep');assert.equal(actionSound('reload'),'reload');assert.equal(actionSound('heal'),'heal');assert.equal(actionSound('wait'),null);
});

test('combat music starts on an engagement line and ends after ten quiet turns in a row',()=>{
  assert.ok(engagementHeard([{type:'callout',category:'danger',cue:'attack'}]));
  assert.ok(!engagementHeard([{type:'callout',category:'perception',cue:'spotted'}]),'spotting someone is not engaging');
  assert.ok(!engagementHeard([{type:'callout',category:'danger',cue:'scream'}]),'a civilian scream is not an engagement');
  let s=stepCombat(freshCombat(),{turn:5,enemiesInView:0});assert.equal(s.combat,false,'enemies alone never start it');
  s=stepCombat(s,{turn:6,enemiesInView:3});assert.equal(s.combat,false);
  s=stepCombat(s,{engaged:true});assert.equal(s.combat,true);
  for(let t=7;t<16;t++)s=stepCombat(s,{turn:t,enemiesInView:0});
  assert.equal(s.combat,true,'nine quiet turns keep it');
  s=stepCombat(s,{turn:16,enemiesInView:1});assert.equal(s.quiet,0,'an enemy in view resets the count');
  for(let t=17;t<=26;t++)s=stepCombat(s,{turn:t,enemiesInView:0});
  assert.equal(s.combat,false,`${MUSIC_TUNING.quietTurns} quiet turns end it`);
  let long=stepCombat(stepCombat(freshCombat(),{turn:1}),{engaged:true});long=stepCombat(long,{turn:11,enemiesInView:0});
  assert.equal(long.combat,false,'an action that takes many turns counts them all');
});

test('the menu theme before deployment, the facility faction inside, kill house and the mixed facility as human',()=>{
  assert.equal(musicTrack({menu:true,playing:true,faction:'swarm'}),'menu');
  assert.equal(musicTrack({menu:false,playing:false,faction:'swarm'}),null,'viewing the last battlefield after the result is silent');
  assert.equal(musicTrack({menu:false,playing:true,faction:'rebel'}),'rebel-explore');
  assert.equal(musicTrack({menu:false,playing:true,faction:'swarm',combat:true}),'swarm-combat');
  assert.equal(musicFaction({simulation:true,faction:'swarm'}),'loyalist');
  assert.equal(musicFaction({faction:'legacy'}),'loyalist');
  for(const id of ['menu','loyalist-explore','loyalist-combat','rebel-explore','rebel-combat','swarm-explore','swarm-combat'])assert.ok(MUSIC_TRACKS[id],id);
  assert.equal(volumePercent(null,60),60);assert.equal(volumePercent('33',60),35);assert.equal(volumePercent(140,60),100);assert.equal(volumePercent(-3,60),0);
});

test('game audio files are the adopted ones, byte for byte, and the loop points match their sources',async()=>{
  const sums=JSON.parse(await read('../art/audio/audio-checksums.json')).files;
  const sources={rifle:'md-01-rifle-a',shotgun:'md-04-shotgun',smg:'md3-01-smg-single',precision:'md3-02-precision',plasma:'md3-03-plasma-a',hit:'md-07-hit',kill:'md3-04-kill',enemyMiss:'md2-08-miss-a',blast:'md-11-grenade',footstep:'md-12-footstep',reload:'md3-05-reload',heal:'md3-06-heal',transmission:'md3-07-transmission',door:'md3-08-door',select:'md2-15-ui-select'};
  for(const [cue,file] of Object.entries(SFX_FILES)){
    assert.equal(await sha(`../assets/audio/sfx/${file}`),sums[`adopted/${sources[cue]}.wav`].sha256,cue);
  }
  assert.deepEqual((await readdir(new URL('../assets/audio/sfx/',import.meta.url))).sort(),Object.values(SFX_FILES).sort(),'no stray files');
  const menu=JSON.parse(await read('../art/audio/music/menu-theme-loop.json')),loops=JSON.parse(await read('../art/audio/music/faction-loops.json'));
  assert.equal(MUSIC_RATE,menu.rate);
  assert.deepEqual([MUSIC_TRACKS.menu.loopStart,MUSIC_TRACKS.menu.loopEnd],[menu.loopStartSample,menu.loopEndSample]);
  for(const loop of loops)assert.deepEqual([MUSIC_TRACKS[loop.id].loopStart,MUSIC_TRACKS[loop.id].loopEnd],[loop.loopStartSample,loop.loopEndSample],loop.id);
  for(const {file} of Object.values(MUSIC_TRACKS))for(const format of MUSIC_FORMATS)assert.ok((await stat(new URL(`../assets/audio/music/${file}.${format}`,import.meta.url))).size>50000,`${file}.${format}`);
});

test('the controller plays from events, keeps sound failures away from turns, and saves the audio settings',async()=>{
  const source=await read('../src/controller.js'),worker=await read('../sw.js'),engine=await read('../src/audio.js');
  assert.ok(source.includes('for(const cue of eventSounds(event.effects,event.state))audio.play(cue);'));
  assert.ok(source.includes('if(engagementHeard(event.effects))noteCombat(true);\n        if(playback.skipping)return;'),'a skipped animation still counts its engagement line but plays nothing');
  assert.ok(source.includes("audio.setVolumes({music:volumePercent(read('ash-music-volume'),AUDIO_TUNING.musicDefault)/100,sfx:volumePercent(read('ash-sfx-volume'),AUDIO_TUNING.sfxDefault)/100});"));
  assert.ok(source.includes("audio.enabled=read('ash-sound')!=='off';"),'the old switch keeps working');
  assert.ok(source.includes("for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>{audio.unlock();syncMusic();},{capture:true});"));
  assert.ok(source.includes("document.addEventListener('visibilitychange',()=>audio.background(document.hidden));"));
  assert.ok(source.includes("menu:!entered||(titleFlow&&$('#modal').open),playing:game.status==='playing'"),'a title-flow menu counts only while it is open');
  assert.ok(!source.includes("audio.play('fire')")&&!source.includes('impactSound'),'the old synthesised cues are gone');
  assert.equal((engine.match(/catch\{\}/g)||[]).length>=6,true,'every playback path swallows its errors');
  for(const file of Object.values(SFX_FILES))assert.ok(worker.includes(`./assets/audio/sfx/${file}`),`${file} is cached for offline play`);
  for(const module of ['sound-cues','music-state'])assert.ok(worker.includes(`./src/${module}.js`),module);
});
