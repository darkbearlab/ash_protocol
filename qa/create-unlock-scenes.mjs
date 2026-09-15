// Import only in ?test=1. These are full backups, replacing only the QA namespace.
import {mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {normalizeProfile} from '../src/progression.js';
import {makeBackup} from '../src/backup.js';
import {carryLevels} from '../src/ammunition.js';
import {collectStory} from '../src/run-unlocks.js';
const out='qa/fixtures/unlocks';mkdirSync(out,{recursive:true});
const profile=()=>{const p=normalizeProfile();p.protocol={balance:1200,earned:1200};return p;};
const write=(name,b)=>{writeFileSync(`${out}/${name}.json`,JSON.stringify(b,null,2));console.log(name);};
const old=makeBackup(null,profile(),'qa');old.profile.version=6;old.profile.upgrades.carrying=carryLevels(3);old.profile.protocol.balance=420;old.profile.unlocks.characters=['operator','ninja'];delete old.profile.unlocks.stories;write('v6-refund',old);
const locked=new Game(17,[],0,'bulwark'),b=makeBackup(locked,profile(),'qa');b.campaign.version=44;b.campaign.data.carryLevel=carryLevels(3);b.campaign.data.player.reserve=120;write('locked-run-overflow',b);
const endless=new Game(1,[],0,'soldier','onyx','endless');for(let f=8;f<=60;f++){endless.floor=f;endless.loadFloor();if(endless.operatorCorpse){Object.assign(endless.player,{x:endless.operatorCorpse.x,y:endless.operatorCorpse.y});endless.reveal();write('corpse',makeBackup(endless,profile(),'qa'));break;}}
const story=new Game(3);story.floor=6;story.loadFloor();const item=story.items.find(i=>i.type==='lore');if(item)collectStory(story,item);for(const e of story.enemies)e.hp=0;Object.assign(story.player,story.end);story.reveal();write('extraction-story',makeBackup(story,profile(),'qa'));
