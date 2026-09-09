// Synthetic campaigns, imported only through ?test=1 -> 匯入任務.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {grantTrait} from '../src/traits.js';
const folder=new URL('./fixtures/3.12/',import.meta.url);await mkdir(folder,{recursive:true});
function arena(name,character='soldier'){const g=new Game(3120,[],0,character);g.runId=`qa-character-${name}-${Date.now()}`;g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10,hp:200,maxHp:200});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};return g;}
function add(g,x,y,id){const e=makeEnemy('rifleman',x,y,id);Object.assign(e,{hp:1000,maxHp:1000,alert:true,charge:true,windup:1});g.enemies.push(e);return e;}
async function save(name,g,legacy=false){g.reveal();const data=JSON.parse(g.serialize());if(legacy){data.version=8;delete data.data.player.character;delete data.data.player.moveDelta;delete data.data.player.fireChain;data.data.player.traits=data.data.player.traits.filter(t=>!t.source.startsWith('character:'));for(const e of data.data.enemies){delete e.moveDelta;delete e.fireChain;}}const raw=JSON.stringify(data);if(!Game.restore(raw))throw Error(`Invalid ${name}`);await writeFile(new URL(`${name}.json`,folder),raw);}
const soldier=arena('soldier');add(soldier,14,10,'covered');soldier.props=[{id:'own',type:'cover',x:11,y:10,hp:10000,maxHp:10000},{id:'enemy',type:'cover',x:13,y:10,hp:10000,maxHp:10000}];soldier.target='covered';await save('soldier-cover-chain',soldier);
const recon=arena('recon','recon');add(recon,14,10,'east');add(recon,10,14,'south');await save('recon-crossfire',recon);
const reload=arena('reload','recon');const fast=add(reload,14,10,'fast');grantTrait(fast,'fast','qa:fast');reload.player.ammo[2]=3;Object.assign(reload.player,{guard:true,focus:true,evasive:true});await save('recon-reload',reload);
const old=arena('legacy');old.player.hp=150;old.player.ammo[0]=3;old.player.upgrades[0]=2;old.player.prepared.item=null;grantTrait(old.player,'small','qa:legacy',2);await save('legacy-v8',old,true);
console.log('Created four QA-only campaigns in qa/fixtures/3.12/.');
