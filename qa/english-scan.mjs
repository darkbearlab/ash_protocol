// English coverage scan (3.167.0, docs/TEXT_INVENTORY.md). Runs bot games of every active class in every facility
// faction with the English table and reports any Chinese left in what the player reads: log lines, refusals, operator
// and enemy callouts, sampled interface text and every exported data table.
//   ASH_LANGUAGE=en node qa/english-scan.mjs [--quiet]      (the script sets the variable itself when run directly)
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.env.ASH_LANGUAGE!=='en'){
 const r=spawnSync(process.execPath,[fileURLToPath(import.meta.url),...process.argv.slice(2)],{env:{...process.env,ASH_LANGUAGE:'en'},stdio:'inherit'});
 process.exit(r.status??1);
}
const {readdirSync}=await import('node:fs');
const {Game}=await import('../src/engine.js');
const {play}=await import('../tools/balance.mjs');
const {language}=await import('../src/i18n.js');
const {SKILLS,skillText,skillStatus}=await import('../src/skills.js');
const {timedStatuses}=await import('../src/status-timers.js');
const {suppressionStatus,suppressionTag,traitRuleLines,suppressionHelp}=await import('../src/suppression-ui.js');
const {targetDetails}=await import('../src/target-card.js');
const {missionSummary,missionProgress,MISSIONS}=await import('../src/missions.js');
const {endlessRules,levelCapRules}=await import('../src/endless-ui.js');
const {calloutLine,playerLine}=await import('../src/callout-ui.js');

const CJK=/[一-鿿　-〿＀-￯]/;
// Shelved classes and save-upgrade notices are not translated (docs/TEXT_INVENTORY.md 4).
const SHELVED=/德魯伊|死靈|獵獸|寵物|召喚物|伴生|飽食|飢餓|共生|群葬|速葬|亡者|餵|排出|起身|集結|^指揮$|存檔已升級|戰術更新|備彈已分類|武器已升級為獨立|語言/;
// 3.190.0: the story fragments are ENCRYPTED placeholders in both languages while the user rewrites them
// (content/story-drafts), so they are scanned like everything else. Put the exceptions back only if Chinese-only
// stories return (content/story-drafts/README.md).
const found=new Map();
// Chinese joins sentences with nothing between them; English needs a space. A sentence end glued to the next word
// ("yet.Arcade") means two table sentences were concatenated in code.
const GLUED=/[a-z)\]][.!?;:][A-Z]/;
const glued=new Map();
const note=(where,text)=>{if(typeof text!=='string')return;if(GLUED.test(text.replace(/<[^>]*>/g,' '))&&!glued.has(text.slice(0,120)))glued.set(text.slice(0,120),where);if(!CJK.test(text)||SHELVED.test(text))return;const key=text.slice(0,120);if(!found.has(key))found.set(key,where);};
const quietly=fn=>{try{return fn();}catch{return null;}};
function sample(g,where){
 const p=g.player;
 for(const v of [timedStatuses(g),targetDetails(g),missionSummary(g),missionProgress(g)].flat())note(where,typeof v==='string'?v:JSON.stringify(v));
 for(const a of [p,...(g.visibleEnemies||[])])for(const v of [quietly(()=>suppressionStatus(a)),quietly(()=>suppressionTag(a)),...(quietly(()=>traitRuleLines(a))||[])])note(where,v);
 for(const id of Object.keys(SKILLS))note(where,quietly(()=>skillText(p,id))),note(where,quietly(()=>skillStatus(p,id)));
}
class Scan extends Game{
 log(text,danger,realText=null){note('log',text);note('log(real)',realText);return super.log(text,danger,realText);}
 fail(text,...rest){note('refusal',text);return super.fail(text,...rest);}
 action(...args){const r=super.action(...args);this.n=(this.n||0)+1;if(this.n%10===0){sample(this,'sample');for(const e of this.effects||[])if(e.type==='callout')note('callout',quietly(()=>e.player?playerLine(e):calloutLine(e)));}return r;}
}
const classes=['soldier','recon','engineer','bulwark','berserker','ninja'];
for(const facilityFaction of ['legacy','loyalist','rebel','swarm'])for(const character of classes)for(let seed=1;seed<=2;seed++){
 class Run extends Scan{constructor(s,u,c,ch,po,m,o={}){super(s,u,c,ch,po,m,{...o,facilityFaction,realMode:seed===2});}}
 quietly(()=>play(seed,900,character,Run));
}
for(const mission of Object.keys(MISSIONS)){const g=quietly(()=>new Scan(3,[],0,'soldier','onyx',mission));if(g){sample(g,`mission ${mission}`);for(const l of g.logs)note('mission log',l.text);}}
for(const v of [endlessRules(),levelCapRules(),suppressionHelp()])note('rules',v);
// 3.168.0: the results screen. Its loss report was written as escaped Chinese and no bot run reached it; build finished
// games at several depths (campaign and endless) and read the report the screen shows.
const {resultCopy}=await import('../src/result-copy.js');
for(const [mission,status] of [['extraction','dead'],['endless','dead'],['extraction','won'],['extraction','abandoned'],['survival','failed']])for(const floor of [1,2,5,8,14]){
 const g=quietly(()=>new Game(4,[],0,'soldier','onyx',mission));if(!g)continue;
 g.status=status;g.floor=floor;const copy=quietly(()=>resultCopy(g));
 if(copy)for(const v of [copy.title,copy.body])note(`result ${mission} ${status} ${floor}`,v);
}
const SKIP=new Set(['text-zh-tw.js','voices-zh-tw.js','pet-growth.js','pet-ui.js','material-review.js','materials.js','replay.js','world.js','personality.js','map-recipes-data.js','map-merging.js','killhouse-maps.js','controller.js','main.js','i18n.js']);
for(const file of readdirSync(new URL('../src/',import.meta.url)).filter(f=>f.endsWith('.js')&&!SKIP.has(f))){
 const mod=await import(`../src/${file}`).catch(()=>null);if(!mod)continue;
 for(const [name,value] of Object.entries(mod)){if(typeof value==='function')continue;let text;try{text=JSON.stringify(value);}catch{continue;}
  if(text&&CJK.test(text))for(const m of text.matchAll(/"((?:[^"\\]|\\.)*)"/g))note(`export ${file}:${name}`,JSON.parse(`"${m[1]}"`));}
}
if(language()!=='en')throw new Error('the scan did not run in English');
if(glued.size){console.log(`${glued.size} texts with sentences glued together:`);for(const [text,where] of glued)console.log(` [${where}] ${text}`);process.exitCode=1;}
if(found.size){console.log(`${found.size} Chinese texts in English mode:`);for(const [text,where] of [...found].slice(0,process.argv.includes('--quiet')?10:200))console.log(` [${where}] ${text}`);process.exitCode=1;}
else if(!glued.size)console.log('english scan clean: no Chinese and no glued sentences in logs, refusals, callouts, sampled interface text or exported tables');
