// Full backups for external QA only; use ?test=1. No browser or localStorage access.
import {mkdir,writeFile} from 'node:fs/promises';
import {Game,SIZE} from '../src/engine.js';
import {AMMUNITION} from '../src/ammunition.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
const output=new URL('./fixtures/3.9/',import.meta.url);await mkdir(output,{recursive:true});
function arena(){const g=new Game(390);g.runId=`qa-independent-${Date.now()}`;g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.rooms=[];g.end={x:20,y:20};g.reveal();return g;}
async function save(name,b){const raw=JSON.stringify(b,null,2);decodeBackup(raw,'qa');await writeFile(new URL(`${name}.json`,output),raw);}
const g=arena(),p=normalizeProfile();p.protocol={balance:800,earned:800};await save('individual-upgrades',makeBackup(g,p,'qa'));
const old=arena();old.setCarryLevel(3);for(const [id,info]of Object.entries(AMMUNITION))old.player[info.key]=old.ammoCapacity(id);
const campaign=JSON.parse(old.serialize());campaign.version=5;campaign.data.carryLevel=3;
const legacy={...normalizeProfile(),version:3,upgrades:{carrying:3},protocol:{balance:70,earned:200}};
await save('legacy-group-refund',{format:'ash-protocol-backup',version:1,namespace:'qa',createdAt:new Date().toISOString(),profile:legacy,campaign});
console.log('Created two QA-only full backups in qa/fixtures/3.9/. Use Restore Backup, not Import Campaign.');
