import {Game} from './engine.js';
export const storage={available:true};
// Browser QA uses a separate namespace, never the user's campaign.
export const TEST_MODE=typeof location!=='undefined'&&new URLSearchParams(location.search).get('test')==='1';
const storageKey=key=>TEST_MODE?`qa-${key}`:key;
export function read(key){try{return localStorage.getItem(storageKey(key));}catch{storage.available=false;return null;}}
export function write(key,value){try{localStorage.setItem(storageKey(key),value);return true;}catch{storage.available=false;return false;}}
export function loadGame(){const raw=read('ash-save');if(raw){try{const version=JSON.parse(raw).version;if([1,2].includes(version)&&!read(`ash-save-v${version}-backup`))write(`ash-save-v${version}-backup`,raw);}catch{}}return Game.restore(raw);}
export function saveGame(game){if(game.status==='playing')write('ash-save',game.serialize());else try{localStorage.removeItem(storageKey('ash-save'));}catch{storage.available=false;}}
export function profile(){try{return JSON.parse(read('ash-profile'))||{runs:0,wins:0,bestFloor:1,bestKills:0,history:[]};}catch{return {runs:0,wins:0,bestFloor:1,bestKills:0,history:[]};}}
export function recordResult(game){const p=profile();const id=`${game.seed}-${game.turn}-${game.status}`;if(p.history.some(r=>r.id===id))return p;p.runs++;p.wins+=Number(game.status==='won');p.bestFloor=Math.max(p.bestFloor,game.floor);p.bestKills=Math.max(p.bestKills,game.player.kills);p.history.unshift({id,seed:game.seed,floor:game.floor,kills:game.player.kills,turn:game.turn,won:game.status==='won',date:new Date().toISOString()});p.history=p.history.slice(0,10);write('ash-profile',JSON.stringify(p));return p;}
