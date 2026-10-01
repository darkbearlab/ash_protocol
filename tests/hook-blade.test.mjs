// 3.210.0 (user decisions 2026-10-01, docs/MELEE_CLASSES.md 迷彩中的連斬): the ninja's own melee lands at a fixed 99%
// (穩刃); while the optical camouflage is on its melee deals ×1.5 (with the ambush's ×1.5 on top) and the blade carries
// the hook blade (鉤刃): a short grapple line that pulls only the ninja, in one straight sweep, beside a visible enemy up
// to four tiles away, and strikes — one action, from the skill button or a blade swing at range.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,makeBarrier} from '../src/engine.js';
import {grantTrait,activeTrait} from '../src/traits.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {HOOK_BLADE_RANGE,MELEE_TUNING,SURE_BLADE,hookBladePlan} from '../src/melee-classes.js';
import {hookBladeFire,hookBladeLabel} from '../src/melee-ui.js';
import {targetDetails} from '../src/target-card.js';
import {SKILLS} from '../src/skills.js';
import {TRAITS} from '../src/traits.js';
import {clearGeneratedMap} from './helpers/arena.mjs';

function arena(character='ninja',{blade=true}={}){
 const g=new Game(3210,[],0,character,'onyx');if(blade)g.player.weapon=g.player.owned[0];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
 for(const k of ['barriers','props','items','hazards','marks','enemies','allies','smoke','rooms','traces'])g[k]=[];clearGeneratedMap(g);g.fires=undefined;
 Object.assign(g.player,{x:10,y:10});g.end={x:20,y:20};g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function enemy(g,x=13,y=10,type='rifleman',hp=1000){const e=makeEnemy(type,x,y,'qa-'+g.enemies.length);Object.assign(e,{hp,maxHp:hp,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
const quiet=g=>{Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});return g;};
const camo=g=>{assert.ok(g.action('usePrepared',{category:'skill'}),'camouflage on');return g;};
const KATANA=10;

test('穩刃: the ninja\'s own melee is a fixed 99% whatever the modifiers; nobody else\'s, and not against the ninja',()=>{
 const g=arena(),p=g.player,e=enemy(g,11,10);assert.ok(activeTrait(p,'sure_blade'));
 grantTrait(e,'small','test');grantTrait(e,'agile','test');e.moved=true;p.suppression=3;g.lighting[10][10]=0;
 assert.equal(g.meleeAccuracy(p,e,95),SURE_BLADE);assert.equal(g.meleeAccuracy(p,e,40),SURE_BLADE,'a blind swing too');assert.equal(g.fireChance(e),99);assert.equal(g.accuracy(p,e).chance,99);
 const b=arena('berserker'),f=enemy(b,11,10);b.player.suppression=3;assert.ok(b.meleeAccuracy(b.player,f,92)<99,'the berserker still rolls the modifiers');
 assert.ok(g.meleeAccuracy(e,p)<99,'an enemy striking the ninja is untouched');
 // The rolls: 0.985 hits at 99, 0.995 misses.
 quiet(g);p.suppression=0;g.lighting[10][10]=1;g.rng=Object.assign(()=>.985,{state:()=>0});const hp=e.hp;assert.ok(g.action('fire'));assert.ok(e.hp<hp,'a 98.5 roll lands');
 g.rng=Object.assign(()=>.995,{state:()=>0});const hp2=e.hp;assert.ok(g.action('fire'));assert.equal(e.hp,hp2,'a 99.5 roll misses');
 assert.match(TRAITS.sure_blade.text,new RegExp(`${SURE_BLADE}%`));
});

test('camouflage: melee ×1.5 on its own, ×2.25 with an ambush; nothing once it ends',()=>{
 const g=quiet(arena()),e=enemy(g,11,10);g.action('fire');assert.equal(1000-e.hp,30,'no camouflage: the katana\'s 30');
 camo(g);const a=e.hp;g.action('fire');assert.equal(a-e.hp,Math.round(30*MELEE_TUNING.camoMelee),'×1.5');
 g.lighting[10][10]=0;const b=e.hp;g.action('fire');assert.equal(b-e.hp,Math.round(30*MELEE_TUNING.camoMelee*MELEE_TUNING.ambush),'×2.25 in the dark');
 g.player.skillState.camouflage={remaining:0,cooldown:5};g.lighting[10][10]=1;const c=e.hp;g.action('fire');assert.equal(c-e.hp,30);
 // A bump while camouflaged, with the gun in hand, is the blade's ×1.5 too.
 const h=quiet(arena('ninja',{blade:false})),f=enemy(h,11,10);camo(h);assert.ok(h.action('move',[1,0]));assert.equal(1000-f.hp,45);assert.ok(!h.weapon.melee,'the gun stays in hand');
});

test('the hook blade from a blade swing: one action pulls the ninja beside the target along the line and strikes',()=>{
 const g=quiet(camo(arena())),p=g.player,e=enemy(g,14,10),turn=g.turn,left=p.skillState.camouflage.remaining;
 const {success,steps}=captureAction(g,()=>g.action('fire'));assert.ok(success);
 assert.equal(g.turn,turn+1,'one action');assert.deepEqual([p.x,p.y],[13,10],'beside it, on the straight line');assert.equal(e.hp,1000-45,'and struck with the camouflage bonus');
 assert.equal(p.skillState.camouflage.remaining,left-1,'a paid action of the camouflage');assert.equal(p.moved,true);assert.equal(g.weapon.id,'katana');
 const moved=steps.findIndex(s=>s.before.player.x!==s.after.player.x),hit=steps.findIndex(s=>s.after.enemies[0].hp<s.before.enemies[0].hp);assert.ok(moved>=0&&hit>moved,'the pull shows before the blow');
 const line=steps.flatMap(s=>s.effects).find(f=>f.type==='tonguePull');assert.ok(line&&line.grapple,'drawn as the grapple lines are');assert.deepEqual(line.origin,{x:14,y:10});assert.deepEqual(line.from,{x:10,y:10});
 assert.ok(g.logs.some(l=>/鉤刃射出/.test(l.text)));assert.ok(Game.restore(g.serialize()),'and the run saves');
 assert.ok(planPresentation(steps).events.length);
});

test('the hook blade from the skill button: the bump blade strikes and the gun stays in hand; next to the target it strikes in place',()=>{
 const g=quiet(camo(arena('ninja',{blade:false}))),p=g.player,e=enemy(g,10,13),gun=p.weapon;
 assert.equal(hookBladeLabel(g),'鉤刃');assert.ok(g.action('usePrepared',{category:'skill'}));
 assert.deepEqual([p.x,p.y],[10,12]);assert.equal(e.hp,1000-45);assert.equal(p.weapon,gun);assert.equal(p.skillState.camouflage.cooldown,0,'still on');
 const t=g.turn;assert.ok(g.action('usePrepared',{category:'skill'}),'adjacent: a strike where it stands');assert.equal(g.turn,t+1);assert.deepEqual([p.x,p.y],[10,12]);assert.equal(e.hp,1000-90);
 // Pinned, it still strikes what stands beside it: only the pull needs to move.
 p.suppression=3;const t2=g.turn;assert.ok(g.action('usePrepared',{category:'skill'}));assert.equal(g.turn,t2+1);assert.equal(e.hp,1000-135);
});

test('the line is the grapple lines\': walls, solid props and other units stop it, brood do not; it must reach and land',()=>{
 // A corridor: the only straight way to the target runs along row 10.
 const corridor=g=>{for(let x=11;x<=15;x++){g.grid[9][x]=0;g.grid[11][x]=0;}g.reveal();return g;};
 const refused=(g,why)=>{const turn=g.turn,at=[g.player.x,g.player.y];assert.equal(hookBladePlan(g).why,why);assert.equal(g.action('fire'),false,why);assert.equal(g.turn,turn,'refused for free');assert.deepEqual([g.player.x,g.player.y],at);};
 const off=arena();enemy(off,13,10);assert.equal(hookBladePlan(off).why,'camo');assert.equal(off.action('fire'),false,'no camouflage: out of the blade reach as before');assert.equal(off.turn,1);
 assert.equal(HOOK_BLADE_RANGE,4,'the starting number in docs/MELEE_CLASSES.md');
 const four=camo(arena());enemy(four,14,10);assert.ok(!hookBladePlan(four).reason,'four tiles: in reach');
 const far=camo(arena());enemy(far,15,10);refused(far,'target');const bent=camo(arena());enemy(bent,13,12);refused(bent,'target');
 const wall=camo(arena());enemy(wall,14,10);wall.grid[10][12]=0;wall.grid[9][13]=0;wall.grid[11][13]=0;wall.reveal();refused(wall,'target');
 const unit=corridor(camo(arena()));const t=enemy(unit,14,10);enemy(unit,12,10,'rifleman');unit.target=t.id;refused(unit,'line');
 const prop=corridor(camo(arena()));enemy(prop,14,10);prop.props=[{id:'crate',type:'cover',x:12,y:10,hp:60,maxHp:60}];prop.reveal();refused(prop,'line');
 const boxed=camo(arena());const b=enemy(boxed,14,10);for(const [x,y] of [[13,10],[15,10],[14,9],[14,11]])enemy(boxed,x,y,'drone');boxed.target=b.id;assert.equal(hookBladePlan(boxed).why,'room');
 const pinned=camo(arena());enemy(pinned,13,10);pinned.player.suppression=3;refused(pinned,'fixed');
 // 矮小 brood on the line do not stop it (3.133.0), as for the grapple lines.
 const brood=quiet(corridor(camo(arena())));const target=enemy(brood,14,10);const small=enemy(brood,12,10,'brood',20);grantTrait(small,'underfoot','test');brood.target=target.id;
 assert.ok(!hookBladePlan(brood).reason);assert.ok(brood.action('fire'));assert.deepEqual([brood.player.x,brood.player.y],[13,10]);
 // A spear is no blade for it.
 assert.equal(SKILLS.camouflage.text.includes(`${HOOK_BLADE_RANGE} 格`),true);
});

test('committed to its target: a target that moves but stays in reach is struck where it stands; one gone out of reach costs the action',()=>{
 const g=camo(arena()),e=enemy(g,14,10);grantTrait(e,'fast','test');g.enemyAct=()=>{e.x=13;e.y=11;};assert.ok(g.action('fire'));
 assert.equal(Math.abs(g.player.x-13)+Math.abs(g.player.y-11),1,'beside its new tile');assert.ok(e.hp<1000);
 const h=camo(arena()),f=enemy(h,13,10);grantTrait(f,'fast','test');h.enemyAct=()=>{f.x=20;};const turn=h.turn;h.action('fire');
 assert.equal(h.turn,turn+1,'the action is spent');assert.deepEqual([h.player.x,h.player.y],[10,10],'no pull');assert.equal(f.hp,1000);
});

test('the interface reads the plan: the button word, the fire label, the target card and its chance',()=>{
 const g=camo(arena()),e=enemy(g,13,10);
 assert.equal(hookBladeFire(g),true);const card=targetDetails(g);assert.ok(card.withinRange,'in reach through the hook');assert.match(card.chance,/鉤刃 · 命中 99%/);assert.ok(card.state.includes('鉤刃 · 可衝到旁邊'));assert.ok(card.state.includes(`迷彩 近戰 ×${MELEE_TUNING.camoMelee}`));
 e.x=10+HOOK_BLADE_RANGE+1;g.reveal();assert.equal(hookBladeLabel(g),'太遠');assert.equal(hookBladeFire(g),false);assert.ok(!targetDetails(g).withinRange);
 e.x=13;g.player.suppression=3;assert.equal(hookBladeLabel(g),'固定');g.player.suppression=0;
 for(let x=11;x<=15;x++){g.grid[9][x]=0;g.grid[11][x]=0;}enemy(g,12,10,'rifleman');g.target=e.id;g.reveal();assert.equal(hookBladeLabel(g),'受阻');
 const off=arena();enemy(off,13,10);assert.equal(hookBladeFire(off),false,'no camouflage: a plain out-of-reach swing');assert.ok(!targetDetails(off).state.includes('鉤刃 · 可衝到旁邊'));
});

// Independent review of 3.210.0: beyond the hook's reach a blade swing is the ordinary out-of-range refusal, so the
// interface flashes the range and says its callout as it does without the camouflage.
test('review: a blade swing beyond the hook\'s reach is refused with the out-of-range cue; nearer refusals keep their reason',()=>{
 for(const on of [false,true]){const g=arena();if(on)camo(g);enemy(g,16,10);const turn=g.turn;assert.equal(g.action('fire'),false);assert.equal(g.turn,turn);assert.equal(g.refusal?.cue,'out_of_range',on?'camouflaged':'plain');}
 const g=camo(arena());enemy(g,14,10);for(let x=11;x<=15;x++){g.grid[9][x]=0;g.grid[11][x]=0;}enemy(g,12,10);g.target=g.enemies[0].id;g.reveal();
 assert.equal(g.action('fire'),false);assert.equal(g.refusal,null,'in reach but blocked: no range flash');assert.match(g.logs[0].text,/直線上有牆/);
});
