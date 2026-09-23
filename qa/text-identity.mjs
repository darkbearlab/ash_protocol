// Text identity check for the translation work (Claude, 2026-09-23; docs/TEXT_INVENTORY.md). Moving a sentence into the
// language table must not change a single character of what the player reads. This records the text the game produces:
// every log line and refusal from bot runs of all classes, the text helpers sampled along the way, and the static rule
// texts. qa/enemy-data-identity.mjs proves the rules; this proves the words.
//   node qa/text-identity.mjs --write <file>     record before the change (keep the file outside the repo)
//   node qa/text-identity.mjs --compare <file>   compare after the change; prints the first differences, exit 1 on any
import {readFileSync,writeFileSync} from 'node:fs';
import {Game} from '../src/engine.js';
import {CHARACTERS} from '../src/characters.js';
import {play} from '../tools/balance.mjs';
import {SKILLS,skillText,skillStatus} from '../src/skills.js';
import {timedStatuses} from '../src/status-timers.js';
import {suppressionStatus,suppressionTag,traitRuleLines,suppressionHelp} from '../src/suppression-ui.js';
import {meleeSummary} from '../src/melee-ui.js';
import {targetDetails} from '../src/target-card.js';
import {missionSummary,missionProgress,MISSIONS} from '../src/missions.js';
import {endlessRules,levelCapRules,endlessFloorText} from '../src/endless-ui.js';
import {decoyReason,mineReason} from '../src/field-gear.js';
import {flareReason} from '../src/flares.js';
import {blindReason} from '../src/blind-fire.js';
import {suppressiveReason} from '../src/suppressive-fire.js';
import {learningReason} from '../src/learning.js';
import {LEARNING_ITEMS} from '../src/learning-data.js';
import {DIFFICULTY_OPTIONS,difficultyMeta,realModeMeta} from '../src/deploy-ui.js';
import {GRENADES} from '../src/throwables.js';
import {floorTraitNote} from '../src/enemy-visuals.js';
import {ENEMY_TYPES} from '../src/data.js';
import {TRAITS} from '../src/traits.js';
import {PLAYER_LINES} from '../src/callout-ui.js';

const quietly=fn=>{try{const v=fn();return v===undefined?null:typeof v==='string'?v:JSON.stringify(v);}catch(error){return `!${error?.message||error}`;}};
const near=p=>[[0,0],[1,0],[0,1],[-1,0],[0,-1],[3,0],[0,3],[-3,0],[0,-3],[6,2]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));

// What the player can read at one moment of a run.
function sample(g,out){
 const p=g.player;
 out.push(quietly(()=>timedStatuses(g)),quietly(()=>targetDetails(g)),quietly(()=>missionSummary(g)),quietly(()=>missionProgress(g)),quietly(()=>meleeSummary(p)));
 for(const actor of [p,...(g.visibleEnemies||[])])out.push(quietly(()=>suppressionStatus(actor)),quietly(()=>suppressionTag(actor)),quietly(()=>traitRuleLines(actor)));
 for(const id of Object.keys(SKILLS))out.push(quietly(()=>skillText(p,id)),quietly(()=>skillStatus(p,id)));
 for(const q of near(p))out.push(quietly(()=>decoyReason(g,q)),quietly(()=>mineReason(g,q)),quietly(()=>flareReason(g,q)),quietly(()=>blindReason(g,q)),quietly(()=>suppressiveReason(g,q)));
 for(const id of Object.keys(LEARNING_ITEMS))out.push(quietly(()=>learningReason(g,id)),quietly(()=>learningReason(g,id,true)));
}

function recorder(texts,options={}){
 return class Recording extends Game{
  constructor(seed,unlocks,carrying,character,portrait,mission,more={}){super(seed,unlocks,carrying,character,portrait,mission,{...more,...options});}
  log(text,danger=false,realText=null){texts.push(`log ${text}`);if(realText!==null)texts.push(`real ${realText}`);return super.log(text,danger,realText);}
  fail(text,...rest){texts.push(`fail ${text}`);return super.fail(text,...rest);}
  action(...args){const r=super.action(...args);this.textActions=(this.textActions||0)+1;if(this.textActions%15===0)sample(this,texts);return r;}
 };
}

function capture(){
 const runs={};
 for(const character of Object.keys(CHARACTERS))for(let seed=1;seed<=4;seed++){
  const texts=[];quietly(()=>play(seed,1200,character,recorder(texts)));runs[`${character}:${seed}`]=texts;
 }
 // Every facility faction (squads, rebels, swarm fields only appear there) and real mode (its own log wording).
 for(const facilityFaction of ['legacy','loyalist','rebel','swarm'])for(const character of ['soldier','scout','engineer','bulwark','berserker','ninja'])for(let seed=1;seed<=2;seed++){
  const texts=[];quietly(()=>play(seed,1200,character,recorder(texts,{facilityFaction,realMode:seed===2})));runs[`${facilityFaction}:${character}:${seed}`]=texts;
 }
 for(const mission of Object.keys(MISSIONS))for(let seed=1;seed<=2;seed++){
  const texts=[];const g=quietly(()=>{const game=new (recorder(texts))(seed,[],0,'soldier','onyx',mission);sample(game,texts);return game.logs.map(l=>l.text);});
  texts.push(g);runs[`mission:${mission}:${seed}`]=texts;
 }
 const statics=[quietly(()=>endlessRules()),quietly(()=>endlessRules({intro:false})),quietly(()=>levelCapRules()),quietly(()=>suppressionHelp()),quietly(()=>realModeMeta()),JSON.stringify(PLAYER_LINES)];
 for(const d of DIFFICULTY_OPTIONS)statics.push(quietly(()=>difficultyMeta(d)));
 for(let floor=1;floor<=30;floor++)statics.push(quietly(()=>endlessFloorText(floor)));
 for(const g of Object.values(GRENADES))statics.push(quietly(()=>JSON.stringify(g)));
 for(const type of Object.keys(ENEMY_TYPES))statics.push(quietly(()=>floorTraitNote(type,TRAITS)));
 runs.static=statics;
 return runs;
}

const mode=process.argv.includes('--write')?'write':process.argv.includes('--compare')?'compare':null;
const file=process.argv[process.argv.indexOf(mode==='write'?'--write':'--compare')+1];
if(!mode||!file){console.log('usage: node qa/text-identity.mjs --write <file> | --compare <file>');process.exit(2);}
const now=capture(),lines=Object.values(now).reduce((n,t)=>n+t.length,0);
if(mode==='write'){writeFileSync(file,JSON.stringify(now));console.log('text baseline written',Object.keys(now).length,'runs',lines,'texts');}
else{
 const before=JSON.parse(readFileSync(file,'utf8')),diffs=[];
 for(const key of new Set([...Object.keys(before),...Object.keys(now)])){
  const a=before[key]||[],b=now[key]||[];
  for(let i=0;i<Math.max(a.length,b.length);i++)if(a[i]!==b[i]){diffs.push({key,i,before:a[i],after:b[i]});break;}
 }
 if(!diffs.length)console.log('text identical to baseline',Object.keys(now).length,'runs',lines,'texts');
 else{for(const d of diffs.slice(0,12))console.log(d.key,'#'+d.i,'\n  before:',d.before?.slice(0,200),'\n  after: ',d.after?.slice(0,200));console.log(diffs.length,'runs differ');process.exitCode=1;}
}
