import {STORIES,RETIRED_STORY_IDS} from './story-data.js';
export const UNLOCK_SETTINGS={demo:false,consecutiveFactions:true,fixedFactionOverride:true,corpseStart:5,corpseStep:.1,corpseMax:.5,corpsePity:4};
export const STARTING_CHARACTERS=['soldier','recon','engineer'];
export const CHARACTER_IDS=[...STARTING_CHARACTERS,'necromancer','druid','bulwark','berserker','ninja'];
// 3.156.0 (user decision 2026-09-20): the druid and the necromancer are shelved until their redesigns are done — no
// selecting, no buying, no corpse. They stay in CHARACTER_IDS so a profile or a save that already holds one still loads.
export const SHELVED_CHARACTERS=['druid','necromancer'];
export const shelvedCharacter=id=>SHELVED_CHARACTERS.includes(id);
// 3.156.0: every operator costs the same 100 points a story does, so the whole roster is reachable in a few runs.
export const CHARACTER_PRICE=100;
export const UNLOCK_CATALOG=[...CHARACTER_IDS.filter(id=>!shelvedCharacter(id)).map(id=>({id,kind:'character',price:STARTING_CHARACTERS.includes(id)?0:CHARACTER_PRICE,starting:STARTING_CHARACTERS.includes(id),sources:['corpse']})),...STORIES.map(s=>({...s,kind:'story',sources:['extraction']}))];
export const unlockEntry=id=>UNLOCK_CATALOG.find(e=>e.id===id)||(RETIRED_STORY_IDS.includes(id)?{id,kind:'story',retired:true,sources:['extraction']}:null);
export const unlocked=(p,id)=>{const e=unlockEntry(id);return !!e&&(e.starting||p?.unlocks?.[e.kind==='character'?'characters':'stories']?.includes(id));};
export const availableCharacters=(p,settings=UNLOCK_SETTINGS)=>CHARACTER_IDS.filter(id=>!shelvedCharacter(id)&&(STARTING_CHARACTERS.includes(id)||!settings.demo&&unlocked(p,id)));
export const validStoryId=id=>STORIES.some(s=>s.id===id)||RETIRED_STORY_IDS.includes(id);
// Pure transaction preparation. The storage adapter publishes this copy with one write.
export function grantUnlock(p,id,source,{simulation=false,settings=UNLOCK_SETTINGS}={}){
 const e=unlockEntry(id);if(simulation||!e||unlocked(p,id)||(settings.demo&&(source==='purchase'||e.kind==='character'))||!['purchase',...e.sources].includes(source))return false;
 if(source==='purchase'&&(e.retired||p.protocol.balance<e.price))return false;
 const next=structuredClone(p),key=e.kind==='character'?'characters':'stories';
 next.unlocks[key]??=[];next.unlocks[key].push(id);if(source==='purchase')next.protocol.balance-=e.price;
 next.unlockLedger={characters:[...(next.unlocks.characters||[])],stories:[...(next.unlocks.stories||[])]};return next;
}
