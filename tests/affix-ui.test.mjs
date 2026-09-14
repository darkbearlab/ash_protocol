import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,ENEMY_TYPES,makeEnemy,enemyDisplayName,grenadeTelegraphs} from '../src/engine.js';
import {traitLabels} from '../src/traits.js';
import {learningInventory} from '../src/learning.js';
import {cardEnemyName,grenadeMarkers,CARD_AFFIX_FRAGMENTS} from '../src/affix-ui.js';
import {learningEntries,traitRuleLines} from '../src/suppression-ui.js';
import {targetDetails} from '../src/target-card.js';
import {affixArena,sceneEnemy,affixScenes} from '../qa/enemy-affix-scenes.mjs';

const reveal=(e,...ids)=>{for(const a of e.affixes)if(ids.includes(a.id))a.revealed=true;};

test('card names keep two revealed fragments, then an ellipsis, and never name hidden affixes',()=>{
 const g=affixArena(),e=sceneEnemy(g,'raider',['fast','infrared','suppressor','grenadier']),base=ENEMY_TYPES.raider.name;
 assert.equal(CARD_AFFIX_FRAGMENTS,2);
 assert.equal(cardEnemyName(e),`${base}？`);
 reveal(e,'grenadier','fast');assert.equal(cardEnemyName(e),enemyDisplayName(e));assert.equal(cardEnemyName(e),`${base}・快速・擲彈兵？`);
 reveal(e,'suppressor');assert.equal(cardEnemyName(e),`${base}・快速・壓制者…？`);
 reveal(e,'infrared');assert.equal(cardEnemyName(e),`${base}・快速・紅外線…`);
 const d=targetDetails(g);assert.ok(d.name.endsWith(`${base}・快速・紅外線…`));assert.equal(d.fullName,`${base}・快速・紅外線・壓制者・擲彈兵`);
});

test('grenade markers show the landing tile, then the blast countdown, and only draw lines from seen tiles',()=>{
 const {prepare,flight}=affixScenes();
 const [p]=grenadeMarkers(prepare);
 assert.deepEqual({phase:p.phase,x:p.x,y:p.y,radius:p.radius,line:p.line,label:p.label},{phase:'prepare',x:10,y:10,radius:0,line:true,label:'投擲'});
 const [f]=grenadeMarkers(flight);
 assert.equal(f.phase,'flight');assert.equal(f.radius,1);assert.equal(f.label,`爆炸 ${Math.max(1,grenadeTelegraphs(flight)[0].countdown)}`);
 assert.equal(f.damage,undefined,'damage stays in the rules layer');
 flight.enemies[0].hp=0;assert.equal(grenadeMarkers(flight).length,1,'a dead thrower still leaves its blast');
 const unseen=Game.restore(prepare.serialize());unseen.visible=()=>false;
 assert.equal(grenadeMarkers(unseen)[0].line,false,'no throw line points at a grenadier the player cannot see');
});

test('suppression resistance reads as ranks on labels, rule lines and learning data',()=>{
 const g=new Game(375,[],0,'bulwark','onyx');g.player.learningItems={trait_suppression_resistance:3};
 assert.ok(traitLabels(g.player).includes('壓制抗性 1 階'));
 assert.ok(traitLabels(makeEnemy('brute',1,1,'qa-brute')).includes('壓制抗性 1 階'));
 const entry=()=>learningEntries(learningInventory(g)).find(e=>e.id==='trait_suppression_resistance');
 assert.match(entry().detail,/目前 1\/3 階/);assert.equal(entry().maxRank,3);
 g.action('learn','trait_suppression_resistance');g.action('learn','trait_suppression_resistance');
 assert.ok(traitLabels(g.player).includes('壓制抗性 3 階'));
 const lines=traitRuleLines(g.player).filter(line=>line.startsWith('壓制抗性'));
 assert.equal(lines.length,1,'stacked sources collapse into one row');assert.match(lines[0],/3\/3 階/);
 assert.match(entry().detail,/目前 3\/3 階/);assert.ok(entry().useReason);
});

test('rule lines keep the longest timer and drop it when any source is permanent',()=>{
 assert.deepEqual(traitRuleLines({traits:[{id:'fast',source:'a',turns:2},{id:'fast',source:'b',turns:5}]}).map(l=>l.split('：')[0]),['快速（剩 5 回合）']);
 assert.deepEqual(traitRuleLines({traits:[{id:'fast',source:'a',turns:2},{id:'fast',source:'b'}]}).map(l=>l.split('：')[0]),['快速']);
});
