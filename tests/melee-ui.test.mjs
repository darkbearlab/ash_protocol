// 3.47.1 melee-class interface (Claude): button words, status line, bag header, target card and texts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {TRAITS} from '../src/traits.js';
import {SKILLS} from '../src/skills.js';
import {MELEE_TUNING,GRAPPLE_RANGE,GRAPPLE_COOLDOWN,CAMO_DURATION,CAMO_COOLDOWN} from '../src/melee-classes.js';
import {grappleLabel,spiritFadeIn,meleeStatus,meleeSummary} from '../src/melee-ui.js';
import {targetDetails} from '../src/target-card.js';

function arena(character='berserker'){
 const g=new Game(3470,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function enemy(g,type,x,y,alert=true){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp:1000,maxHp:1000,alert});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
const noEnemyActions=g=>{Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});};

test('grapple button word: pull, dash, too far, no landing, no target',()=>{
 const pull=arena();enemy(pull,'rifleman',12,12);assert.equal(grappleLabel(pull),'拉近');
 const dash=arena();enemy(dash,'warden',13,10);assert.equal(grappleLabel(dash),'衝刺');
 const far=arena();enemy(far,'rifleman',10+GRAPPLE_RANGE+1,10);assert.equal(grappleLabel(far),'太遠');
 const boxed=arena();for(const [x,y] of [[10,9],[10,11],[9,10],[11,10]])enemy(boxed,'drone',x,y);const t=enemy(boxed,'rifleman',14,10);boxed.target=t.id;assert.equal(grappleLabel(boxed),'無落點');
 const none=arena();none.target=null;assert.equal(grappleLabel(none),'無目標');
});

test('battle-spirit countdown matches when the stack actually drops',()=>{
 const g=arena();noEnemyActions(g);g.player.battleSpirit={stacks:3,lastKill:g.turn};
 for(let i=0;i<9;i++){const stacks=g.player.battleSpirit.stacks,left=spiritFadeIn(g);
  for(let k=1;k<left;k++){g.action('wait');assert.equal(g.player.battleSpirit.stacks,stacks,`still ${stacks} after ${k} of ${left}`);}
  g.action('wait');assert.equal(g.player.battleSpirit.stacks,stacks-1,`drops after ${left}`);if(!g.player.battleSpirit.stacks)break;}
 assert.equal(g.player.battleSpirit.stacks,0);assert.deepEqual(meleeStatus(g),[]);
});

test('status line lists spirit, camouflage, ambush and duel only when they hold',()=>{
 const b=arena();b.player.battleSpirit={stacks:2,lastKill:b.turn};assert.deepEqual(meleeStatus(b),[`戰意 2（${MELEE_TUNING.spiritDelay} 回合後 −1）`]);
 const n=arena('ninja');const e=enemy(n,'rifleman',11,10);assert.deepEqual(meleeStatus(n),[`單挑 +${MELEE_TUNING.duelist}`]);
 n.player.skillState.camouflage={remaining:3,cooldown:0};n.lighting[10][10]=0;n.reveal();
 assert.deepEqual(meleeStatus(n),['迷彩 3',`伏擊 ×${MELEE_TUNING.ambush}`,`單挑 +${MELEE_TUNING.duelist}`]);
 enemy(n,'rifleman',10,13);n.target=e.id;assert.ok(!meleeStatus(n).some(s=>s.startsWith('單挑')),'two viewers break the duel');
});

test('bag header shows blade stash and battle-spirit values; other classes show nothing',()=>{
 const b=arena();assert.deepEqual(meleeSummary(b.player),['刃藏 1 把 · 攻擊 +10% · 受傷 −10%']);
 b.player.battleSpirit={stacks:4,lastKill:b.turn};assert.equal(meleeSummary(b.player)[1],'戰意 4 層 · 受傷 −20%');
 assert.deepEqual(meleeSummary(arena('soldier').player),[]);assert.deepEqual(meleeSummary(arena('ninja').player),[]);
});

test('target card names the grapple mode and a ready ambush',()=>{
 const pull=arena();enemy(pull,'rifleman',12,12);assert.ok(targetDetails(pull).state.includes('鉤鎖 · 拉近'));
 const dash=arena();enemy(dash,'warden',13,10);assert.ok(targetDetails(dash).state.includes('鉤鎖 · 衝刺'));
 dash.player.skillState.grapple.cooldown=2;assert.ok(!targetDetails(dash).state.includes('鉤鎖'),'no hint while cooling down');
 const n=arena('ninja');enemy(n,'rifleman',11,10);assert.ok(!targetDetails(n).state.includes(`伏擊 ×${MELEE_TUNING.ambush}`));
 n.lighting[10][10]=0;n.reveal();assert.ok(targetDetails(n).state.includes(`伏擊 ×${MELEE_TUNING.ambush}`));
});

test('melee passive and skill texts quote the live tuning numbers',()=>{
 const pct=v=>`${Math.round(v*100)}%`,T=MELEE_TUNING;
 assert.ok(TRAITS.bloodlust.text.includes(pct(T.bloodlust)));
 assert.match(TRAITS.battle_spirit.text,new RegExp(`最多 ${T.spiritMax} 層.*−${pct(T.spiritReduction)}.*${T.spiritDelay} 回合.*每 ${T.spiritInterval} 回合`));
 assert.match(TRAITS.blade_stash.text,new RegExp(`\\+${pct(T.bladeDamage)}.*−${pct(T.bladeReduction)}`));
 assert.match(TRAITS.ambush.text,new RegExp(`×${T.ambush}.*−${T.ambushCooldown}`));
 assert.ok(TRAITS.duelist.text.includes(`+${T.duelist}`));
 assert.match(SKILLS.grapple.text,new RegExp(`${GRAPPLE_RANGE} 格.*冷卻 ${GRAPPLE_COOLDOWN}`));
 assert.match(SKILLS.camouflage.text,new RegExp(`${CAMO_DURATION} 次.*−${T.camoEvasion}.*冷卻 ${CAMO_COOLDOWN}`));
});

test('ninja starts with smoke in the throw slot; berserker keeps frag',()=>{
 assert.equal(arena('ninja').player.prepared.grenade,'smoke');assert.equal(arena('berserker').player.prepared.grenade,'frag');
});
