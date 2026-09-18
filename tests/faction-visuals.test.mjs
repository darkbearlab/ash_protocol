import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,ENEMY_TYPES} from '../src/engine.js';
import {FACTIONS,factionDef} from '../src/factions.js';
import {enemyTint,factionTag,ELITE_VISUAL} from '../src/enemy-visuals.js';
import {calloutVoice,VOICE_LINES} from '../src/callout-ui.js';
import {targetDetails} from '../src/target-card.js';
import {affixArena,sceneEnemy} from '../qa/enemy-affix-scenes.mjs';

// A throwaway faction and card let the presentation hooks be tested before any real faction uses them.
function withQaFaction(run){
 FACTIONS.qa_faction={...FACTIONS.legacy,name:'測試派系',tag:true,voice:'machine',overrides:{rifleman:{tint:'#123456'}}};
 ENEMY_TYPES.qa_tinted={...ENEMY_TYPES.rifleman,sprite:{key:'rifleman',tint:'#abcdef'}};
 try{run();}finally{delete FACTIONS.qa_faction;delete ENEMY_TYPES.qa_tinted;}
}

test('legacy enemies have no tint and no faction tag',()=>{
 const d=factionDef('legacy'),legacyTypes=new Set([...Object.values(d.roster).flat().map(([type])=>type),...Object.values(d.bosses),d.scout,...d.retreatWave,d.fodder,d.nestChild]);
 for(const type of legacyTypes){assert.equal(enemyTint({type,faction:'legacy'}),null,type);assert.equal(factionTag({type,faction:'legacy'}),'',type);}
 assert.equal(enemyTint({type:'rifleman'}),null,'a missing faction reads as legacy');
});

test('a faction override tint wins over the card tint, and a tagged faction shows its name',()=>withQaFaction(()=>{
 assert.equal(enemyTint({type:'qa_tinted',faction:'legacy'}),'#abcdef');
 assert.equal(enemyTint({type:'rifleman',faction:'qa_faction'}),'#123456');
 assert.equal(enemyTint({type:'raider',faction:'qa_faction'}),null);
 assert.equal(factionTag({type:'raider',faction:'qa_faction'}),'測試派系');
}));

test('the target card leads its tag row with the faction and a display-only elite label; real mode hides the row',()=>withQaFaction(()=>{
 const g=new Game(1);const standard=affixArena(),e=sceneEnemy(standard,'rifleman');
 assert.ok(!targetDetails(standard).traits.includes(ELITE_VISUAL.label));
 e.elite=true;assert.ok(targetDetails(standard).traits.startsWith(`${ELITE_VISUAL.label} · `));
 e.faction='qa_faction';assert.ok(targetDetails(standard).traits.startsWith(`測試派系 · ${ELITE_VISUAL.label} · `));
 const raw=JSON.parse(affixArena().serialize());raw.data.realMode=true;const real=Game.restore(JSON.stringify(raw));const r=sceneEnemy(real,'rifleman');r.elite=true;
 assert.equal(targetDetails(real).traits,'');assert.ok(g);
}));

test('callout voices: machines and creatures keep their card voice, others and heard lines use the faction voice',()=>withQaFaction(()=>{
 const seen=(enemyType,faction)=>({type:'callout',cue:'move',category:'tactical',priority:'medium',visibility:'visible',enemyType,faction});
 const heard=faction=>({type:'callout',cue:'move',category:'tactical',priority:'medium',visibility:'heard',direction:'east',faction});
 assert.equal(calloutVoice(seen('rifleman','legacy')),'human');assert.equal(calloutVoice(heard('legacy')),'human');assert.equal(calloutVoice(heard()),'human');
 assert.equal(calloutVoice(seen('rifleman','qa_faction')),'machine');assert.equal(calloutVoice(heard('qa_faction')),'machine');
 assert.equal(calloutVoice(seen('crawler','qa_faction')),'creature');assert.equal(calloutVoice(seen('drone','legacy')),'machine');
 FACTIONS.qa_faction.voice='not_a_voice';assert.equal(calloutVoice(seen('rifleman','qa_faction')),'human','an unknown voice falls back to human');
 assert.deepEqual(Object.keys(VOICE_LINES).sort(),['civilian','conscript','enforcer','human','infected','loyalist','machine','rebel']);
}));
