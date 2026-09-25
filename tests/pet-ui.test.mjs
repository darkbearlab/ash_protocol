import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SIZE} from '../src/data.js';
import {petActor,petFeedingState,fitPet,PET_FEEDING_TUNING as T} from '../src/pet-growth.js';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {feedingView,petStatusLine,petOutputLine,lineEffects,lineProgress,rankDots,formatFuel,petHelpText,nodeSymbol,nextNode,unlockedMajors,abilityChips} from '../src/pet-ui.js';

function druid(){
 const g=new Game(372,[],0,'druid','onyx');
 g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
 for(const k of ['enemies','props','items','barriers','hazards','marks','rooms','traces','smoke'])g[k]=[];clearGeneratedMap(g);
 Object.assign(g.player,{x:10,y:10});const a=petActor(g);Object.assign(a,{x:11,y:10,floor:g.floor});g.reveal();return {g,a,b:g.player.petBond};
}

test('feeding view groups every quote into fuel, growth and heal, with quote-driven labels',()=>{
 const {g}=druid();g.player.reserve=72;
 const {gate,groups}=feedingView(petFeedingState(g),{weaponName:slot=>g.weaponAt(slot).name});
 assert.equal(gate,null);
 const [fuel,growth,heal]=groups;
 assert.deepEqual([fuel.id,growth.id,heal.id],['fuel','growth','heal']);
 assert.equal(fuel.options.length,5);
 assert.equal(growth.options.length,2+g.player.owned.length+4);
 assert.equal(heal.options.length,1);
 const rifle=fuel.options.find(o=>o.id==='ammo:rifle');
 assert.equal(rifle.allowed,true);assert.equal(rifle.title,'步槍彈');assert.match(rifle.detail,/36 發 → 燃料 \+5$/);   // 3.185.0: three times the rounds, the same fuel
 const weapon=growth.options.find(o=>o.id==='weapon');assert.equal(weapon.title,g.weaponAt(weapon.weaponSlot).name);
 assert.equal(heal.options[0].allowed,false,'a full-health pet cannot take a medkit');assert.ok(heal.options[0].detail.length>0);
});

test('a shared gate is shown once and blanks every button detail',()=>{
 const {g,a}=druid();a.x=14;
 const {gate,groups}=feedingView(petFeedingState(g));
 assert.equal(gate,'需要相鄰且沒有阻隔');
 for(const group of groups)for(const o of group.options){assert.equal(o.allowed,false);assert.equal(o.detail,'');}
});

test('status lines cover the reforming countdown, waiting for a tile, and an active pet',()=>{
 const {g,a}=druid();
 assert.match(petStatusLine(petFeedingState(g)),/^活動中 · HP \d+\/\d+$/);
 g.damageAlly(a,999);
 const line=petStatusLine(petFeedingState(g));
 assert.match(line,new RegExp(`${T.reviveTurns} 個付費回合後`));assert.match(line,/重生前不能餵/);
 assert.match(petStatusLine({status:'arriving'}),/等候落點/);
});

test('the output line never reports production when only the timer is ready',()=>{
 const {g,a,b}=druid();
 assert.equal(petOutputLine(petFeedingState(g)),null,'no extrusion rank, no line');
 b.growth.extrusion=T.thresholds.extrusion[0];b.fedThrowables.smoke=b.growth.extrusion;fitPet(g,a);
 b.outputRemaining=5;assert.match(petOutputLine(petFeedingState(g)),/5 個付費回合後/);
 b.outputRemaining=0;b.fuel=0;
 const ready=petOutputLine(petFeedingState(g));
 assert.match(ready,/燃料不足/);assert.doesNotMatch(ready,/已排出/);
});

test('effect and help text read the tuning table and no longer mention packing',()=>{
 assert.ok(lineEffects('vitality')[0].includes(String(T.baseHp+T.extraHp)));
 assert.ok(lineEffects('extrusion')[0].includes(String(T.outputIntervals[0])));
 assert.ok(lineEffects('turret')[2].includes(String(T.turret[2].range)));
 const help=petHelpText();
 assert.ok(help.includes(String(T.reviveTurns)));assert.ok(help.includes(`${Math.round(T.reviveFraction*100)}%`));
 assert.doesNotMatch(help,/收納|回收/);
});

test('small formatters: rank dots, fuel in whole scrap units, per-line progress units',()=>{
 assert.equal(rankDots(0),'○○○○○○');assert.equal(rankDots(2),'◉◉○○○○');
 assert.equal(formatFuel(T.fuelScale*5),'5');assert.equal(formatFuel(90),'1.3');
 assert.equal(lineProgress('armor',{progress:12,nextThreshold:25,capped:false}),'12 / 25 板');
 assert.equal(lineProgress('turret',{progress:120,nextThreshold:null,capped:true}),'已滿六節點');
});

test('node symbols separate major from minor and unlocked from locked',()=>{
 assert.equal(nodeSymbol({major:true,unlocked:true}),'◆');assert.equal(nodeSymbol({major:true,unlocked:false}),'◇');
 assert.equal(nodeSymbol({major:false,unlocked:true}),'●');assert.equal(nodeSymbol({major:false,unlocked:false}),'○');
});

test('next node and unlocked majors read the rules-layer node list',()=>{
 const {g,a,b}=druid();
 let armor=petFeedingState(g).growth.armor;
 assert.equal(nextNode(armor).index,1);assert.deepEqual(unlockedMajors(armor),[]);
 b.growth.armor=T.thresholds.armor[3];fitPet(g,a);armor=petFeedingState(g).growth.armor;
 assert.equal(nextNode(armor).index,5);assert.equal(unlockedMajors(armor).length,2);
 for(const [line,ns] of Object.entries(T.thresholds))b.growth[line]=ns.at(-1);fitPet(g,a);
 const s=petFeedingState(g);
 for(const line of Object.keys(s.growth)){assert.equal(nextNode(s.growth[line]),null);assert.equal(unlockedMajors(s.growth[line]).length,3);}
});

test('ability chips only restate reported ability states',()=>{
 const {g,a,b}=druid();
 assert.deepEqual(abilityChips(petFeedingState(g)),[]);
 b.growth.armor=T.thresholds.armor[3];fitPet(g,a);
 assert.match(abilityChips(petFeedingState(g)).find(c=>c.id==='sense').text,/^感知 \d+ 格 · \d+ 回合後掃描/);
 const texts=abilityChips({growth:{armor:{rank:6}},abilities:{steadfast:true,vision:false,criticalSmoke:{unlocked:true,used:true},guardianSmoke:{unlocked:true,used:false},sense:{unlocked:true,active:false,remaining:3,radius:4,contacts:[]}}}).map(c=>c.text);
 assert.ok(texts.includes('堅守中'));
 assert.ok(texts.some(t=>t.startsWith('共享視覺中斷')));
 assert.ok(texts.includes('感知暫停：獵獸未活動'));
 assert.ok(texts.includes('危急煙霧：本層已用'));assert.ok(texts.includes('守護煙霧：待命'));
});

