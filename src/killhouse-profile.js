import {validCharacter} from './characters.js';
export const emptyKillhouse=()=>({tutorial:{completed:false,skipped:false},best:null,byCharacter:{}});
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const count=n=>Number.isSafeInteger(n)&&n>=0;
const record=r=>r===null||obj(r)&&Number.isFinite(r.score)&&r.score>=0&&r.score<=Number.MAX_SAFE_INTEGER&&Number.isFinite(r.rate)&&r.rate>=0&&r.rate<=1&&count(r.turns)&&validCharacter(r.character)&&typeof r.formula==='string'&&/^[\w-]{1,40}$/.test(r.formula);
export function validKillhouseProfile(k){return Boolean(obj(k)&&obj(k.tutorial)&&typeof k.tutorial.completed==='boolean'&&typeof k.tutorial.skipped==='boolean'&&record(k.best)&&obj(k.byCharacter)&&Object.entries(k.byCharacter).every(([id,r])=>validCharacter(id)&&r!==null&&record(r)&&r.character===id));}
export const normalizeKillhouse=raw=>validKillhouseProfile(raw)?structuredClone(raw):emptyKillhouse();
export const tutorialRequired=p=>!p.killhouse?.tutorial?.completed&&!p.killhouse?.tutorial?.skipped;
export function recordTutorial(p,outcome){if(!['completed','skipped'].includes(outcome))throw Error('Invalid tutorial outcome');p.killhouse.tutorial[outcome]=true;}
// The UI owns weighting. It passes the score and a formula ID; this layer only keeps the high-water mark.
export function recordArcade(p,result,score,{scope='shared',formula='v1'}={}){
 const r={score,rate:result?.rate,turns:result?.turns,character:result?.character,formula};
 if(result?.mode!=='arcade'||result?.outcome!=='won'||!record(r)||!['shared','character'].includes(scope))throw Error('Invalid arcade result');
 const target=scope==='shared'?p.killhouse:p.killhouse.byCharacter,key=scope==='shared'?'best':r.character,old=target[key];
 if(!old||r.score>old.score){target[key]=r;return true;}return false;
}

export const tutorialGate=p=>({required:tutorialRequired(p),canSkip:true,mode:'tutorial',character:'soldier'});
