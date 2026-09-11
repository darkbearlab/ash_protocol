import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,makeBarrier,WEAPONS,SAVE_VERSION} from '../src/engine.js';
import {grantTrait,activeTrait,initiative,healActor} from '../src/traits.js';
import {canUseSkill} from '../src/skills.js';
import {captureAction,snapshot} from '../src/presentation.js';
import {bladeCount,ambushReady,freshSpirit} from '../src/melee-classes.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';
function arena(character='berserker'){
 const g=new Game(3470,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function enemy(g,type='rifleman',x=11,y=10,hp=1000){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp,maxHp:hp,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
const skill=g=>g.action('usePrepared',{category:'skill'});
const noEnemyActions=g=>{Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});};
test('new classes start with bound integrated melee, correct stats/supplies and prepared skill',()=>{
 for(const [id,slot,skillId] of [['berserker',9,'grapple'],['ninja',10,'camouflage']]){
  const g=arena(id);assert.equal(g.player.weapon,slot);assert.equal(g.weapon.melee,true);assert.equal(g.weapon.locked,true);assert.equal(g.player.ammo[slot],0);assert.equal(g.player.prepared.skill,skillId);assert.equal(initiative(g.player),0);
  const turn=g.turn;assert.ok(g.action('weapon',g.player.owned[1]));assert.ok(g.action('weapon',slot));assert.equal(g.turn,turn);assert.equal(g.action('salvage',slot),false);
  assert.ok(Game.restore(g.serialize()));
 }
 const b=arena(),n=arena('ninja');assert.equal(b.player.maxHp,160);assert.equal(b.player.armor,3);assert.equal(n.player.grenades,0);assert.equal(n.player.smoke,2);assert.equal(n.player.stun,1);
});
test('bump melee keeps equipped gun and position, earns lifesteal only on actual post-mitigation HP loss',()=>{
 const g=arena();noEnemyActions(g);g.player.weapon=1;g.player.hp=40;const e=enemy(g,'rifleman',11,10,10);assert.ok(g.action('move',[1,0]));assert.equal(g.player.weapon,1);assert.equal(g.player.x,10);assert.equal(g.player.hp,42);assert.equal(e.hp<=0,true);assert.equal(g.player.battleSpirit.stacks,1);
});
test('lifesteal uses healActor modifier and does not trigger for ranged kills or props',()=>{
 const g=arena();noEnemyActions(g);grantTrait(g.player,'difficult_healing','test:heal');g.player.hp=30;enemy(g,'rifleman',11,10,10);g.action('fire');assert.equal(g.player.hp,31);
 const h=arena();noEnemyActions(h);h.player.hp=30;h.player.weapon=1;enemy(h,'rifleman',11,10,10);h.action('fire');assert.equal(h.player.hp,30);assert.equal(h.player.battleSpirit.stacks,0);
 const k=arena();k.player.hp=30;k.props=[{id:'box',type:'cover',x:11,y:10,hp:1,maxHp:1}];k.target='box';k.action('fire');assert.equal(k.player.hp,30);assert.equal(k.player.battleSpirit.stacks,0);
});
test('war spirit caps, decays at fifth then seventh paid turn, and free actions do not age it',()=>{
 const g=arena();noEnemyActions(g);for(let i=0;i<7;i++){enemy(g,'rifleman',11,10,1);g.pendingPerks=0;g.action('fire');}g.pendingPerks=0;g.perkDraft=null;
 assert.equal(g.player.battleSpirit.stacks,5);const last=g.player.battleSpirit.lastKill;g.action('weapon',1);g.action('weapon',9);assert.equal(g.turn,last);
 for(let i=0;i<4;i++)g.action('wait');assert.equal(g.player.battleSpirit.stacks,5);g.action('wait');assert.equal(g.player.battleSpirit.stacks,4);g.action('wait');assert.equal(g.player.battleSpirit.stacks,4);g.action('wait');assert.equal(g.player.battleSpirit.stacks,3);
 enemy(g,'rifleman',11,10,1);g.action('fire');assert.equal(g.player.battleSpirit.stacks,4);assert.equal(g.player.battleSpirit.lastKill,g.turn);
});
test('blade damage and multiplicative direct defense scale with carried melee count but not environment',()=>{
 const g=arena();g.player.battleSpirit={stacks:5,lastKill:g.turn};g.player.hp=160;g.damagePlayer(103,'test');assert.equal(g.player.hp,92); // (103-3)*.9*.75 => ceil 68
 const e=enemy(g);const before=e.hp;g.hitTarget(e,100,g.player,0,g.weapon);assert.equal(before-e.hp,110);
 const slot=g.registerWeapon({type:'weapon',weapon:9,x:0,y:0}).slot;g.player.owned.push(slot);assert.equal(bladeCount(g.player),2);g.player.hp=160;g.damagePlayer(103,'test');assert.equal(g.player.hp,100);
 g.hazards=[{type:'heat',x:10,y:10}];g.environmentTurn();assert.equal(g.player.hp,88);
});
test('grapple pulls diagonal target to nearest cardinal cell, interrupts charge, attacks, and presents movement before impact',()=>{
 const g=arena();noEnemyActions(g);const e=enemy(g,'rifleman',12,12);Object.assign(e,{charge:true,aim:{x:10,y:10},windup:2,focusTarget:'player'});const hp=e.hp;
 const {success,steps}=captureAction(g,()=>skill(g));assert.ok(success);assert.equal(g.turn,2);assert.equal(g.player.x,10);assert.equal(e.x,11);assert.equal(e.y,10);assert.equal(e.charge,false);assert.equal(e.aim,null);assert.ok(e.hp<hp);assert.equal(g.player.skillState.grapple.cooldown,3);
 const moved=steps.findIndex(s=>s.before.enemies[0].x!==s.after.enemies[0].x),hit=steps.findIndex(s=>s.after.enemies[0].hp<s.before.enemies[0].hp);assert.ok(moved>=0&&hit>moved);assert.ok(Game.restore(g.serialize()));
});
test('large brute and both boss types cause dash, without adding large to bosses',()=>{
 for(const type of ['brute','warden','boss']){const g=arena();noEnemyActions(g);const e=enemy(g,type,13,10);assert.ok(skill(g));assert.equal(g.player.x,12);assert.equal(e.x,13);if(type!=='brute')assert.equal(activeTrait(e,'large'),false);assert.equal(g.player.moved,true);assert.ok(Game.restore(g.serialize()));}
});
test('blocked/no landing grapple is free to reject; walls, closed edges and occupied swept path cannot be crossed',()=>{
 const g=arena();enemy(g,'rifleman',13,10);for(const [dx,dy]of[[0,-1],[1,0],[0,1],[-1,0]])g.grid[10+dy][10+dx]=0;assert.equal(skill(g),false);assert.equal(g.turn,1);
 const h=arena();enemy(h,'rifleman',14,10);h.props=[{id:'block',type:'cover',x:12,y:10,hp:50}];h.grid[9][10]=0;h.grid[11][10]=0;h.grid[10][9]=0;assert.equal(skill(h),false);assert.equal(h.turn,1);
 const k=arena();enemy(k,'rifleman',12,10);k.barriers=[makeBarrier('partition',{x:10,y:10},{x:11,y:10},'edge')];k.grid[9][10]=0;k.grid[11][10]=0;k.grid[10][9]=0;assert.equal(skill(k),false);
});
test('grapple commits original identity and recomputes legal position after fast actor movement',()=>{
 const g=arena();const e=enemy(g,'rifleman',13,10);grantTrait(e,'fast','test:fast');g.enemyAct=()=>{e.x=13;e.y=11;g.target='other';};assert.ok(skill(g));assert.equal(e.x,11);assert.equal(e.y,10);assert.equal(g.target,e.id);
 const h=arena();const lost=enemy(h,'rifleman',13,10);grantTrait(lost,'fast','test:fast');h.enemyAct=()=>{lost.x=20;};assert.ok(skill(h));assert.equal(h.turn,2);assert.equal(h.player.x,10);assert.equal(h.player.skillState.grapple.cooldown,0);
});
test('grapple skipped on player death or disability, without teleport or cooldown',()=>{
 for(const dead of [false,true]){const g=arena(),e=enemy(g,'rifleman',13,10);grantTrait(e,'fast','test:fast');g.enemyAct=()=>{if(dead)g.player.hp=0;else g.player.control.disabled=1;};assert.ok(skill(g));assert.equal(e.x,13);assert.equal(g.player.skillState.grapple.cooldown,0);}
});
test('camouflage free activation preserves turn/RNG and perception, lasts five paid actions, then ten cooldown actions',()=>{
 const g=arena('ninja');noEnemyActions(g);const e=enemy(g);const turn=g.turn;assert.ok(skill(g));assert.equal(g.turn,turn);assert.equal(g.rng.state(),0);assert.equal(g.sight(e,g.player),true);assert.equal(g.player.skillState.camouflage.cooldown,0);
 g.action('weapon',2);g.action('weapon',10);assert.equal(g.player.skillState.camouflage.remaining,5);
 for(let i=4;i>=0;i--){g.action('wait');assert.equal(g.player.skillState.camouflage.remaining,i);}
 assert.equal(g.player.skillState.camouflage.cooldown,10);assert.equal(canUseSkill(g.player,'camouflage'),false);
 for(let i=0;i<10;i++)g.action('wait');assert.equal(canUseSkill(g.player,'camouflage'),true);
});
test('camouflage and duel affect both hit channels, duel uses currently visible alerted enemies, floor remains 10%',()=>{
 const g=arena('ninja'),e=enemy(g),p=g.player;const before=g.meleeAccuracy(e,p);assert.equal(before,82);assert.equal(g.defensiveEvasion(e,p),15);skill(g);assert.equal(g.meleeAccuracy(e,p),52);assert.equal(g.defensiveEvasion(e,p),45);
 const e2=enemy(g,'rifleman',13,10);assert.equal(g.defensiveEvasion(e,p),30);e2.hp=0;assert.equal(g.defensiveEvasion(e,p),45);assert.equal(g.meleeAccuracy(e,p,20),10);
 const ranged=g.accuracy(e,p);assert.equal(ranged.specialEvasion,45);assert.ok(ranged.chance>=10);
});
test('ambush conditions are ORed, camo alone never triggers, and a miss still shortens inactive cooldown',()=>{
 const g=arena('ninja');noEnemyActions(g);const e=enemy(g);assert.equal(ambushReady(g,e),false);skill(g);assert.equal(ambushReady(g,e),false);g.player.skillState.camouflage={remaining:0,cooldown:7};
 e.control.disabled=1;assert.equal(ambushReady(g,e),true);g.rng=Object.assign(()=>.999,{state:()=>0});g.action('fire');assert.equal(g.player.skillState.camouflage.cooldown,5);assert.equal(e.hp,1000);
 e.control.disabled=0;g.lighting[10][10]=0;assert.equal(ambushReady(g,e),true);g.lighting[10][10]=1;g.sight=()=>false;assert.equal(ambushReady(g,e),true);
});
test('ambush scales a melee hit by 1.5 and attacks do not break active camouflage',()=>{
 const g=arena('ninja');noEnemyActions(g);const e=enemy(g);g.lighting[10][10]=0;skill(g);assert.ok(g.action('fire'));assert.equal(e.hp,955);assert.equal(g.player.skillState.camouflage.remaining,4);assert.equal(g.player.skillState.camouflage.cooldown,0);
});
test('v28 defaults, new state and bound weapon validation, and backup roundtrip',()=>{
 const old=new Game(3470);const raw=JSON.parse(old.serialize());raw.version=28;delete raw.data.player.battleSpirit;const h=Game.restore(JSON.stringify(raw));assert.ok(h);assert.deepEqual(h.player.battleSpirit,freshSpirit());assert.equal(h.player.hp,old.player.hp);
 const g=arena('ninja');skill(g);const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile({}),'qa')),'qa').game;assert.equal(restored.player.skillState.camouflage.remaining,5);
 for(const edit of [p=>delete p.battleSpirit,p=>p.battleSpirit={stacks:6,lastKill:1},p=>p.battleSpirit={stacks:1,lastKill:999},p=>p.owned=p.owned.filter(i=>i!==10),p=>p.skillState.camouflage={remaining:3,cooldown:10}]){const v=JSON.parse(g.serialize());edit(v.data.player);assert.equal(Game.restore(JSON.stringify(v)),null);}
});
test('camouflage and spirit survive floor transition without resets; the paid action still ticks',()=>{
 const g=arena('ninja');skill(g);Object.assign(g.player,g.end);assert.ok(g.action('interact'));assert.equal(g.player.skillState.camouflage.remaining,4);assert.equal(g.player.skillState.camouflage.cooldown,0);
 const b=arena();b.player.battleSpirit={stacks:3,lastKill:1};Object.assign(b.player,b.end);assert.ok(b.action('interact'));assert.equal(b.player.battleSpirit.stacks,3);assert.equal(b.player.battleSpirit.lastKill,1);assert.ok(Game.restore(b.serialize()));
});
test('camouflage protects the entire fifth enemy phase; disability still consumes a paid turn',()=>{
 const g=arena('ninja'),e=enemy(g),observed=[];Object.defineProperty(g,'enemyAct',{value:()=>observed.push(g.player.skillState.camouflage.remaining)});skill(g);
 g.player.control.disabled=1;g.action('wait');assert.equal(g.player.skillState.camouflage.remaining,4);
 for(let i=0;i<4;i++)g.action('wait');assert.deepEqual(observed,[5,4,3,2,1]);assert.equal(g.player.skillState.camouflage.cooldown,10);
 const bad=JSON.parse(g.serialize());bad.data.player.skillState.camouflage.cooldown=-1;assert.equal(Game.restore(JSON.stringify(bad)),null);
});
test('blade stash buffs thrown blast damage once and does not turn ranged/throw kills into melee rewards',()=>{
 const g=arena();noEnemyActions(g);g.player.hp=100;const e=enemy(g,'rifleman',13,10,500);g.player.prepared.grenade='frag';assert.ok(g.action('grenade',{x:13,y:10}));assert.equal(e.hp,439);assert.equal(g.player.hp,100);assert.equal(g.player.battleSpirit.stacks,0);
});
test('grapple dash may land on hazards, spends cooldown, and does not alter boss size rules',()=>{
 const g=arena();noEnemyActions(g);enemy(g,'brute',13,10);g.hazards=[{x:12,y:10,type:'heat'}];const hp=g.player.hp;assert.ok(skill(g));assert.equal(g.player.hp,hp-12); // Lifesteal at full health precedes landing hazard damage.
 assert.equal(skill(g),false);const turn=g.turn;for(let i=0;i<3;i++)g.action('wait');assert.equal(g.turn,turn+3);assert.equal(g.player.skillState.grapple.cooldown,0);
});
test('bound weapons cannot be exchanged or imported on a different class; normal slot upgrades remain available',()=>{
 for(const id of ['berserker','ninja']){const g=arena(id),slot=g.player.weapon;g.player.scrap=100;const min=g.weaponDamage().min;assert.ok(g.action('upgrade'));assert.equal(g.weaponDamage().min,min+5);
 const item=g.registerWeapon({type:'weapon',weapon:0,x:10,y:10});g.items.push(item);assert.equal(g.action('replaceWeapon',{take:item.slot,leave:slot}),false);
 const raw=JSON.parse(g.serialize());raw.data.player.character='soldier';assert.equal(Game.restore(JSON.stringify(raw)),null);
 }
});
test('a bomber killed in melee cannot revive its killer through lifesteal after lethal explosion',()=>{
 const g=arena();noEnemyActions(g);g.player.hp=1;enemy(g,'bomber',11,10,1);g.action('fire');assert.equal(g.player.hp,0);assert.equal(g.status,'dead');
});
