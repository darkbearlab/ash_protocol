import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {Game} from '../src/game.js';
import {t} from '../src/i18n.js';
import {STORIES,STORY_IDS} from '../src/story-data.js';
import {normalizeProfile} from '../src/progression.js';
import {grantUnlock,UNLOCK_SETTINGS} from '../src/unlock-catalog.js';
import {unlockPageMarkup,purchaseReason} from '../src/unlock-ui.js';
import {parseStory} from '../tools/stories.mjs';

// 3.190.0 (user, before the version freeze): the unfinished story fragments leave the game. Their drafts wait in
// content/story-drafts; the game keeps every id with an ENCRYPTED placeholder, in both languages.
const drafts=new URL('../content/story-drafts/',import.meta.url);

test('every record is an ENCRYPTED placeholder, and every draft is kept outside the game under the same id',()=>{
 assert.equal(STORIES.length,22);
 for(const s of STORIES){assert.equal(s.title,'ENCRYPTED');assert.equal(s.body,'TO BE DECRYPTED');}
 assert.doesNotMatch(JSON.stringify(STORIES),/[一-鿿]/,'no Chinese left in the shipped story data');
 const kept=readdirSync(drafts).filter(n=>n.endsWith('.md')&&n!=='README.md').map(n=>parseStory(readFileSync(new URL(n,drafts),'utf8'),n));
 assert.deepEqual(kept.map(s=>s.id).sort(),[...STORY_IDS].sort());
 for(const s of kept){const live=STORIES.find(x=>x.id===s.id);assert.notEqual(s.title,'ENCRYPTED');assert.deepEqual([live.faction,live.floors,live.price,live.order],[s.faction,s.floors,s.price,s.order],`${s.id} keeps where it drops`);}
});

test('while the stories are rewritten they cannot be bought, but extraction still brings them back',()=>{
 assert.equal(UNLOCK_SETTINGS.storiesWip,true);
 const p=normalizeProfile();p.protocol={balance:5000,earned:5000};const id=STORIES[0].id;
 assert.equal(grantUnlock(p,id,'purchase'),false);
 assert.ok(grantUnlock(p,id,'extraction').unlocks.stories.includes(id));
 assert.ok(grantUnlock(p,'ninja','purchase'),'classes are still for sale');
 assert.equal(purchaseReason(p,{...STORIES[0],kind:'story'}),t('unlock-ui.storiesWip'));
 const page=unlockPageMarkup(p,{tab:'stories'});
 assert.match(page,/class="story-stamp" aria-hidden="true"><span>DECRYPTION<br>IN PROGRESS<\/span>/);
 assert.ok(page.includes(t('unlock-ui.storiesWipNote')));
 assert.equal((page.match(/data-unlock-buy="[^"]+" disabled>尚未開放<\/button>/g)||[]).length,STORIES.length);
 p.unlocks.stories.push(id);
 assert.match(unlockPageMarkup(p,{tab:'stories'}),/<span class="story-title">ENCRYPTED<\/span>.*<p>TO BE DECRYPTED<\/p>/s,'a record already brought back shows the placeholder');
 assert.doesNotMatch(unlockPageMarkup(p,{tab:'characters'}),/story-stamp/);
 assert.doesNotMatch(unlockPageMarkup(p,{tab:'stories',settings:{...UNLOCK_SETTINGS,storiesWip:false}}),/story-stamp|尚未開放/);
});

test('picking up data says the record is encrypted instead of printing the placeholder',()=>{
 const g=new Game(3,[],0,'soldier','onyx','extraction',{facilityFaction:'loyalist'}),item=g.items.find(i=>i.type==='lore');Object.assign(g.player,{x:item.x,y:item.y});g.pickup();
 assert.equal(g.pendingStories.length,1);
 assert.ok(g.logs.some(l=>l.text===t('game.storyEncrypted')));
 assert.ok(!g.logs.some(l=>/TO BE DECRYPTED/.test(l.text)));
});
