import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,CALLOUT_CUES} from '../src/engine.js';
import {calloutVoice,calloutLine,VOICE_LINES} from '../src/callout-ui.js';
import {spriteToneRole,SPRITE_NAMES,NONCOMBATANT_LABEL} from '../src/enemy-visuals.js';
import {targetDetails} from '../src/target-card.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';

// Presentation for the 3.82.0 civilians (docs/CIVILIANS.md 5): their voice, the target card tag and the actor tone.
const CIVILIAN_CUES=['scream','flee','hit','wounded','critical','suppressed','pinned'];

test('civilians speak with their own voice whether seen or heard, with lines for every cue the rules send them',()=>{
 for(const visibility of ['visible','heard']){
  const event={type:'callout',voice:'civilian',faction:'loyalist',cue:'flee',category:'tactical',priority:'medium',visibility,...(visibility==='visible'?{actorId:'noncombatant-1-0',enemyType:'civilian'}:{direction:'east'})};
  assert.equal(calloutVoice(event),'civilian',visibility);assert.ok(calloutLine(event).length>0,visibility);
 }
 assert.equal(calloutVoice({type:'callout',voice:'not_a_voice',faction:'loyalist',cue:'move',visibility:'heard',direction:'east'}),'loyalist','an unknown voice falls back to the faction voice');
 for(const cue of CIVILIAN_CUES){
  assert.ok(Object.hasOwn(CALLOUT_CUES,cue),cue);
  const lines=VOICE_LINES.civilian[cue];assert.ok(lines?.length,cue);
  for(const line of lines)assert.ok(!/[0-9%×]/.test(line),line);
 }
});

test('the target card tags civilians as non-combatants after the faction name; soldiers are not tagged; real mode hides the row',()=>{
 const plain=affixArena();sceneEnemy(plain,'rifleman');assert.ok(!targetDetails(plain).traits.includes(NONCOMBATANT_LABEL));
 const g=affixArena(),e=sceneEnemy(g,'civilian');assert.ok(targetDetails(g).traits.startsWith(NONCOMBATANT_LABEL));
 e.faction='loyalist';assert.ok(targetDetails(g).traits.startsWith(`忠誠者 · ${NONCOMBATANT_LABEL}`));
 const raw=JSON.parse(affixArena().serialize());raw.data.realMode=true;const real=Game.restore(JSON.stringify(raw));sceneEnemy(real,'civilian');
 assert.equal(targetDetails(real).traits,'');
});

test('sprite tone roles follow the name: appended actor cells get the unit tone, the original cells keep their old roles',()=>{
 assert.equal(spriteToneRole('civilian'),'unit');
 for(const [index,name] of SPRITE_NAMES.slice(0,16).entries())assert.equal(spriteToneRole(name),index<10?'unit':'prop',name);
});
