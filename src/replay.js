// Operation logs (3.124.0, user request): a run is its starting save plus every call the player made into the rules, in
// order. The text client (tools/text-play.mjs) writes them, and the test-mode replayer in the browser plays the same file
// back through the real controller with the full presentation, so one log reproduces one run in both.
// Rules for the log:
// - The start is a save, not constructor arguments, so a log does not depend on the profile that created it.
// - Refused calls are kept: a refusal still writes a log line into the save.
// - Each op carries the state hash after it, so the first step where two playbacks part ways can be named.
// - The browser replay does not connect the profile, so a replayed run never grants unlocks or stories.
import {Game} from './game.js';
import {SAVE_VERSION} from './data.js';
import {VERSION} from './version.js';

export const REPLAY_FORMAT='ash-replay',REPLAY_VERSION=1;
export const REPLAY_OPS=Object.freeze(['action','target','perk','recover']);

// Two 32-bit FNV-style lanes: the same answer in Node and in the browser, without an async digest.
export function textHash(text){
 let a=0x811c9dc5,b=0x9e3779b9;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,0x5bd1e995);b^=b>>>15;}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
// Key order is not state: a restored game adds a field the save omitted (undefined) later than a fresh game did, so the
// hash reads the save with its keys sorted.
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`:JSON.stringify(value);
export const stateHash=game=>textHash(canonical(JSON.parse(game.serialize())));

// Both playbacks begin from Game.restore(start), never from the object that produced the start.
export function startReplay(start){
 const game=typeof start==='string'?Game.restore(start):null;
 if(!game)throw new Error('操作紀錄的起始存檔無法載入。');
 return game;
}
export function createReplay(game,params={}){
 const start=game.serialize(),first=startReplay(start);
 return {log:{format:REPLAY_FORMAT,version:REPLAY_VERSION,build:VERSION,save:SAVE_VERSION,params,start,startHash:stateHash(first),ops:[]},game:first};
}

export function validReplay(log){
 if(!log||log.format!==REPLAY_FORMAT||log.version!==REPLAY_VERSION)return '不是操作紀錄。';
 if(typeof log.start!=='string'||!Array.isArray(log.ops))return '操作紀錄缺少起始存檔或步驟。';
 const bad=log.ops.findIndex(op=>!op||!REPLAY_OPS.includes(op.op)||(op.op==='action'&&typeof op.type!=='string'));
 return bad<0?'':`第 ${bad+1} 步格式不正確。`;
}

// JSON keeps the argument as the rules saw it; undefined stays undefined (the weapon action treats it as "next").
const plainArg=arg=>arg===undefined?undefined:JSON.parse(JSON.stringify(arg));
export function makeOp(op,type,arg){
 if(op==='action'){const entry={op,type};if(arg!==undefined)entry.arg=plainArg(arg);return entry;}
 if(op==='target')return {op,id:type??null};
 if(op==='perk')return {op,id:type};
 return {op};
}
export function applyOp(game,op){
 switch(op.op){
  case 'action':return game.action(op.type,plainArg(op.arg));
  case 'target':game.target=op.id??null;return true;
  case 'perk':return game.choosePerk(op.id);
  case 'recover':return game.recoverOperator();
  default:throw new Error(`未知的操作：${op.op}`);
 }
}

// Plays a log headlessly. Returns where it stopped and the first hash that differs, if any.
export function replayLog(log,{until=log.ops.length,onStep}={}){
 const reason=validReplay(log);if(reason)throw new Error(reason);
 const game=startReplay(log.start);
 if(log.startHash&&stateHash(game)!==log.startHash)return {game,step:0,mismatch:{step:0,expected:log.startHash,actual:stateHash(game)}};
 for(let i=0;i<Math.min(until,log.ops.length);i++){
  const op=log.ops[i],result=applyOp(game,op),hash=stateHash(game);
  onStep?.(i,op,result,game);
  if(op.h&&op.h!==hash)return {game,step:i+1,mismatch:{step:i+1,op,expected:op.h,actual:hash}};
 }
 return {game,step:Math.min(until,log.ops.length),mismatch:null};
}

// Records calls made on a live game, for callers that drive the rules directly (the balance bot, the browser controller).
// The locked target is plain state the caller writes, so a change is logged just before the next call that could use it.
export function recordReplay(game,log){
 let target=game.target??null,depth=0;
 const push=entry=>{entry.h=stateHash(game);log.ops.push(entry);};
 const syncTarget=()=>{if((game.target??null)!==target){target=game.target??null;push(makeOp('target',target));}};
 const wrap=(name,entry)=>{
  const original=game[name];
  Object.defineProperty(game,name,{configurable:true,enumerable:false,writable:true,value(...args){
   if(depth)return original.apply(game,args);
   syncTarget();const op=entry(...args);depth++;
   try{return original.apply(game,args);}finally{depth--;target=game.target??null;push(op);}
  }});
 };
 wrap('action',(type,arg)=>makeOp('action',type,arg));
 wrap('choosePerk',id=>makeOp('perk',id));
 wrap('recoverOperator',()=>makeOp('recover'));
 return {flush:syncTarget};
}
