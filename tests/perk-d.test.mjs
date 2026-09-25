import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,PERKS,makeEnemy} from '../src/engine.js';
import {eligiblePerks,hasRegularAffix} from '../src/perks.js';
import {PERK_D,WEAPONS} from '../src/data.js';
import {weaponStats} from '../src/weapons.js';
import {infraredDrop} from '../src/lines.js';
import {activeTrait} from '../src/traits.js';
import {UNKNOWN_LOOT} from '../src/learning-data.js';

// 3.148.0 升級 D (user decisions 2026-09-19, docs/PERK_GROWTH.md): new runs trade 精準射擊, 戰術閃避, 武器增幅 and 複合裝甲
// for 沉著, 游擊, 改裝精通 and 加掛板架. Older runs keep the old four.
function arena(){
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.enemies=[];g.smoke=[];
 g.lighting=g.grid.map(r=>r.map(()=>1));Object.assign(p,{x:10,y:10});g.end={x:25,y:25};g.reveal();return g;
}
const foe=(g,x=14,y=10)=>{const e=makeEnemy('rifleman',x,y,'e',1);Object.assign(e,{hp:500,maxHp:500,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;};
const pick=(g,id)=>{g.pendingPerks=1;g.player.level=Math.max(g.player.level,g.perkPicks+2);g.perkDraft={index:g.perkPicks,ids:[id]};return g.choosePerk(id);};
const NEW=['steady','skirmish','mod_mastery','plate_rack'],OLD=['damage','armor','accuracy','evasion'];

test('new runs draw the four new perks, older runs the four old ones; the rest are shared',()=>{
 const g=arena();assert.equal(g.perkRules,3);g.player.affixes[g.player.owned[0]]='stable';
 const ids=eligiblePerks(g).map(o=>o.id);
 assert.ok(NEW.every(id=>ids.includes(id)));assert.ok(!OLD.some(id=>ids.includes(id)));
 for(const id of ['health','blast','med','plating','melee'])assert.ok(ids.includes(id),`${id} stays`);
 g.perkRules=2;const old=eligiblePerks(g).map(o=>o.id);
 assert.ok(OLD.every(id=>old.includes(id)));assert.ok(!NEW.some(id=>old.includes(id)));
 assert.equal(pick(g,'steady'),false,'an old run cannot take a new perk');
});

test('沉著: each rank adds 8 to what waiting adds to your next shot, and nothing without the wait',()=>{
 const g=arena(),p=g.player,e=foe(g);p.combatModifiers={rangedAccuracy:-60};
 p.focus=true;const waited=g.accuracy(p,e).chance;p.focus=false;const plain=g.accuracy(p,e).chance;
 assert.ok(pick(g,'steady'));assert.ok(pick(g,'steady'));
 assert.equal(g.accuracy(p,e).chance,plain,'no wait, no bonus');
 p.focus=true;assert.equal(g.accuracy(p,e).chance,waited+2*PERK_D.steady);
});

test('游擊: each rank adds 6 to the penalty for shooting you after you moved, and nothing while you stand',()=>{
 const g=arena(),p=g.player,e=foe(g);e.combatModifiers={rangedAccuracy:-30};
 p.moved=true;const moving=g.accuracy(e,p).chance;p.moved=false;const still=g.accuracy(e,p).chance;
 assert.ok(still<99&&moving-3*PERK_D.skirmish>10,`${still}/${moving}: inside the 10-99 bounds`);
 for(let i=0;i<3;i++)assert.ok(pick(g,'skirmish'));
 assert.equal(g.accuracy(e,p).chance,still);
 p.moved=true;assert.equal(g.accuracy(e,p).chance,moving-3*PERK_D.skirmish);
});

test('改裝精通: only with a regular affix; the upside grows a quarter a rank, the downside and drop-only affixes stay',()=>{
 const g=arena(),p=g.player,slot=p.owned[0];p.affixes[slot]=null;
 assert.equal(hasRegularAffix(p),false);assert.ok(!eligiblePerks(g).some(o=>o.id==='mod_mastery'),'not offered without one');
 p.affixes[slot]='lance';assert.equal(hasRegularAffix(p),false,'drop-only affixes do not count');
 p.affixes[slot]='stable';assert.ok(eligiblePerks(g).some(o=>o.id==='mod_mastery'));
 const base=g.weaponAt(slot);for(let i=0;i<3;i++)assert.ok(pick(g,'mod_mastery'));const w=g.weaponAt(slot);
 assert.equal(base.accuracyBonus,10);assert.equal(w.accuracyBonus,17,'命中 +10 → +17');
 assert.deepEqual([w.min,w.max],[base.min,base.max],'傷害 −10% unchanged');
 const R=WEAPONS.findIndex(x=>x.id==='rifle'),PL=WEAPONS.findIndex(x=>x.id==='plasma'),me={perks:{mod_mastery:3}};
 assert.equal(weaponStats(R,'longbarrel',me).range,WEAPONS[R].range+3,'range +2 → +3, rounded down');
 assert.equal(weaponStats(R,'tracking',me).tracking,21,'moving penalty 22 → 1');
 assert.equal(weaponStats(R,'extended',me).mag,56);assert.equal(weaponStats(R,'extended',me).accuracyBonus,-8);
 assert.equal(weaponStats(R,'powerful',me).min,14);assert.equal(weaponStats(R,'powerful',me).mag,22,'彈匣 −25% unchanged');
 assert.deepEqual(weaponStats(PL,'lance',me),weaponStats(PL,'lance'),'drop-only untouched');
});

test('加掛板架: +10 plate capacity a rank and 10 plates at once; sprays and pickups fill to the new cap',()=>{
 const g=arena(),p=g.player;p.plates=30;assert.equal(g.plateCapacity,30);
 assert.ok(pick(g,'plate_rack'));assert.equal(g.plateCapacity,40);assert.equal(p.plates,40);
 assert.ok(pick(g,'plate_rack'));p.plates=0;assert.ok(pick(g,'plate_rack'));assert.equal(g.plateCapacity,60);assert.equal(p.plates,10);
 p.sprays=1;assert.ok(g.action('plate'));assert.equal(p.plates,30);
});

test('disruption resistance and agile are learning data now, found in unidentified crates',()=>{
 for(const id of ['trait_disruption_resistant','trait_agile'])assert.ok(UNKNOWN_LOOT.some(x=>x.learningId===id),id);
 const g=arena(),p=g.player;p.learningItems.trait_agile=1;p.learningItems.trait_disruption_resistant=1;
 assert.ok(g.action('learn','trait_agile'));assert.ok(activeTrait(p,'agile'));
 assert.ok(g.action('learn','trait_disruption_resistant'));assert.ok(activeTrait(p,'disruption_resistant'));
});

test('infrared goggles: squad leaders drop them on a fixed roll; worn, they give infrared; one pair is all you carry',()=>{
 const g=arena(),p=g.player;let id=null;for(let i=0;i<200&&!id;i++)if(infraredDrop(g.seed,g.floor,`sl-${i}`))id=`sl-${i}`;assert.ok(id);
 const e=makeEnemy('squad_leader',12,10,id,1);g.enemies.push(e);g.hurt(e,9999,p);
 const item=g.items.find(i=>i.type==='irg');assert.ok(item,'dropped');
 Object.assign(p,{x:item.x,y:item.y});g.pickup();assert.ok(p.wearables.includes('irg'));
 g.items.push({x:p.x,y:p.y,type:'irg'});g.pickup();assert.equal(g.items.filter(i=>i.type==='irg').length,1,'a second pair stays');
 g.enemies=[];assert.ok(g.action('prepare',{category:'item',id:'irg'}));assert.ok(activeTrait(p,'infrared'));
 const back=Game.restore(g.serialize());assert.ok(back);assert.ok(back.player.wearables.includes('irg'));assert.ok(activeTrait(back.player,'infrared'));
});

test('saves keep the run\'s rules and the new ranks; older saves keep theirs',()=>{
 const g=arena();g.player.affixes[g.player.owned[0]]='stable';for(const id of NEW)assert.ok(pick(g,id));
 const back=Game.restore(g.serialize());assert.ok(back);assert.equal(back.perkRules,3);
 assert.deepEqual(NEW.map(id=>back.player.perks[id]),[1,1,1,1]);assert.equal(back.plateCapacity,40);
 const raw=JSON.parse(g.serialize());raw.data.perkRules=5;assert.equal(Game.restore(JSON.stringify(raw)),null);
 const old=new Game(3);old.perkRules=2;assert.equal(Game.restore(old.serialize()).perkRules,2);
});
