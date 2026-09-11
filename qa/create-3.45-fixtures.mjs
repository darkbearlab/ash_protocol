import {mkdir,writeFile} from 'node:fs/promises';
import {Game,PERKS} from '../src/engine.js';
const folder=new URL('./fixtures/3.45/',import.meta.url);await mkdir(folder,{recursive:true});
async function save(name,g,legacy=false){const value=JSON.parse(g.serialize());if(legacy){value.version=27;delete value.data.player.perks;delete value.data.player.perkWeaponBonus;delete value.data.perkPicks;delete value.data.perkDraft;}const raw=JSON.stringify(value);if(!Game.restore(raw))throw Error(name);await writeFile(new URL(name+'.json',folder),raw);}
const g=new Game(3450);g.runId='qa-perks-multi';g.player.level=4;g.pendingPerks=3;await save('three-picks',g);
const h=new Game(3451);h.runId='qa-perks-rank';h.player.level=3;h.player.perks={accuracy:2};h.player.combatModifiers={rangedAccuracy:16};h.pendingPerks=1;h.perkDraft={index:2,ids:['accuracy','health','armor']};h.perkPicks=2;await save('rank-three',h);
const full=new Game(3452);full.runId='qa-perks-full';full.pendingPerks=2;for(const o of PERKS)if(o.cap!==null)full.player.perks[o.id]=o.cap;await save('supply-fallback',full);
const old=new Game(3453);old.runId='qa-perks-legacy';Object.assign(old.player,{level:10,bonus:24,maxHp:150,hp:70,armor:3});old.pendingPerks=2;await save('legacy-v27',old,true);
console.log('Four isolated 3.45 fixtures generated; rank/full are artificial UI scenarios, not balance evidence.');
