import {STORIES,RETIRED_STORY_IDS} from './story-data.js';
export const UNLOCK_SETTINGS={demo:false,consecutiveFactions:true,fixedFactionOverride:true,corpseStart:8,corpseStep:.04,corpseMax:.5};
export const STARTING_CHARACTERS=['soldier','recon','engineer'];
export const CHARACTER_IDS=[...STARTING_CHARACTERS,'necromancer','druid','bulwark','berserker','ninja'];
export const UNLOCK_CATALOG=[...CHARACTER_IDS.map(id=>({id,kind:'character',price:STARTING_CHARACTERS.includes(id)?0:1000,starting:STARTING_CHARACTERS.includes(id),sources:['corpse']})),...STORIES.map(s=>({...s,kind:'story',sources:['extraction']}))];
export const unlockEntry=id=>UNLOCK_CATALOG.find(e=>e.id===id)||(RETIRED_STORY_IDS.includes(id)?{id,kind:'story',retired:true,sources:['extraction']}:null);
export const unlocked=(p,id)=>{const e=unlockEntry(id);return !!e&&(e.starting||p?.unlocks?.[e.kind==='character'?'characters':'stories']?.includes(id));};
export const availableCharacters=(p,settings=UNLOCK_SETTINGS)=>CHARACTER_IDS.filter(id=>STARTING_CHARACTERS.includes(id)||!settings.demo&&unlocked(p,id));
export const validStoryId=id=>STORIES.some(s=>s.id===id)||RETIRED_STORY_IDS.includes(id);
// Pure transaction preparation. The storage adapter publishes this copy with one write.
export function grantUnlock(p,id,source,{simulation=false,settings=UNLOCK_SETTINGS}={}){
 const e=unlockEntry(id);if(simulation||!e||unlocked(p,id)||(settings.demo&&(source==='purchase'||e.kind==='character'))||!['purchase',...e.sources].includes(source))return false;
 if(source==='purchase'&&(e.retired||p.protocol.balance<e.price))return false;
 const next=structuredClone(p),key=e.kind==='character'?'characters':'stories';
 next.unlocks[key]??=[];next.unlocks[key].push(id);if(source==='purchase')next.protocol.balance-=e.price;return next;
}
