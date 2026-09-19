import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game,makeEnemy} from '../src/engine.js';
import {SKILLS} from '../src/skills.js';

// 3.143.0 (user, 2026-09-19): the soldier's 預警 no longer gives your position away; feeding the druid's pet keeps you in
// the pack unless an enemy is in view.
test('預警 finds the enemies around you without alerting them or telling them where you are',()=>{
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.enemies=[];g.hazards=[];g.items=[];
 for(let y=p.y-4;y<=p.y+4;y++)g.grid[y][p.x+2]=0;   // a wall between you, so only the scan could have given you away
 const e=makeEnemy('raider',p.x+4,p.y,'e',1);e.alert=false;e.lastKnown=null;g.enemies.push(e);
 assert.equal(g.action('skill','early_warning'),true);
 assert.deepEqual(g.sensorContacts,[{x:e.x,y:e.y}],'the scan still marks it');
 assert.equal(e.lastKnown,null,'it was not told where you are');
 assert.ok(!g.logs.some(l=>l.text.includes('得知你的位置')));
 assert.ok(!SKILLS.early_warning.text.includes('得知你的位置')&&SKILLS.early_warning.text.includes('不會讓敵人發現你'));
});

test('feeding the pet reopens the pack on the same tab unless an enemy is in view',()=>{
 const source=readFileSync(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.ok(source.includes("if(b.dataset.feedOption){feedAction({optionId:b.dataset.feedOption});return;}"));
 assert.ok(source.includes("feedAction({optionId:'weapon',weaponSlot:Number(b.dataset.confirmFeedWeapon)})"));
 assert.ok(source.includes("!game.visibleEnemies.some(e=>!isNoncombatant(e))")&&source.includes('!game.pendingPerks'),'an enemy in view, a level-up or another screen wins');
});
