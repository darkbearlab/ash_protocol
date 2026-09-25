import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Game,SIZE,LEARNING_SCRAP} from '../src/engine.js';
import {TERMINAL_TUNING,TERMINAL_MIN_PRICE,terminalCost,terminalRemaining,terminalDeal,tradeHoldings,ammoLot,offerReason} from '../src/terminal.js';
import {salvageValue} from '../src/weapons.js';

// 3.120.0: the supply terminal economy the user decided on 2026-09-17 (docs/ITEMS.md, 終端經濟改版).
const read=async path=>(await readFile(new URL(path,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
function arena(character='soldier'){
  const g=new Game(42,[],0,character);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));
  Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.hazards=[];g.marks=[];
  g.props=[{id:'term',x:11,y:10,type:'terminal',used:false}];g.reveal();return g;
}
const row=(g,id)=>tradeHoldings(g).find(r=>r.id===id);

test('trade-in values: ammunition in whole-scrap lots at 60%, dismantle values, a cheap medkit, and no armour plates',()=>{
  assert.deepEqual(['rifle','pistol','shell','energy','ordnance'].map(id=>ammoLot(id)),[{lot:4,value:1},{lot:6,value:1},{lot:8,value:3},{lot:5,value:2},{lot:5,value:12}]);
  const g=arena(),p=g.player;
  Object.assign(p,{reserve:50,pistol:0,shell:12,grenades:2,smoke:1,emp:1,stun:1,meds:3,sprays:1,adrenaline:1,barricades:1,plates:20});
  p.wearables=['nvg'];p.learningItems={trait_braced:2};
  const value=id=>row(g,id)?.value;
  assert.equal(value('ammo:rifle'),1);assert.equal(row(g,'ammo:rifle').max,12,'50 rounds are twelve lots of four');
  assert.equal(row(g,'ammo:pistol').max,0);
  assert.deepEqual(['throw:frag','throw:smoke','throw:emp','throw:stun'].map(value),[7,7,9,9]);   // 3.150.0: the frag is priced like the smoke
  assert.equal(value('med'),10,'low on purpose: medkits pile up (user decision)');
  assert.deepEqual(['item:spray','item:adrenaline','item:barricade','wear:nvg'].map(value),[9,12,15,24]);
  assert.equal(value('learning:trait_braced'),LEARNING_SCRAP);assert.equal(row(g,'learning:trait_braced').max,2);
  assert.equal(value(`weapon:${p.owned[1]}`),20,'a weapon is worth what dismantling it gives');
  assert.ok(!tradeHoldings(g).some(r=>/plate|armor/.test(r.id)),'armour plates cannot be traded');
  p.prepared.item='nvg';assert.equal(row(g,'wear:nvg').max,0,'take it off first');assert.equal(row(g,'wear:nvg').reason,'戴著的要先脫下');
});

test('the engineer dismantles for half again as much, everywhere the value is used',()=>{
  const g=arena('engineer'),p=g.player,slot=p.owned[1];
  assert.equal(salvageValue(p,slot),30);p.upgrades[slot]=2;assert.equal(salvageValue(p,slot),60);
  assert.equal(row(g,`weapon:${slot}`).value,60);
  const scrap=p.scrap;assert.ok(g.action('salvage',slot));assert.equal(p.scrap,scrap+60);
  const soldier=arena();assert.equal(salvageValue(soldier.player,soldier.player.owned[1]),20);
});

test('a deal: trade-ins first, scrap for the rest, overpaying is lost, and it must add up',()=>{
  const g=arena(),p=g.player;Object.assign(p,{scrap:3,reserve:0,pistol:60,meds:2});
  let deal=terminalDeal(g,'rifle',{});assert.equal(deal.reason,'終端需要 10 廢料。');
  deal=terminalDeal(g,'rifle',{'ammo:pistol':7});assert.deepEqual([deal.pool,deal.scrap,deal.waste,deal.reason],[7,3,0,'']);
  deal=terminalDeal(g,'rifle',{'ammo:pistol':5});assert.equal(deal.reason,'還差 2 廢料。');
  deal=terminalDeal(g,'rifle',{'med':2});assert.deepEqual([deal.pool,deal.scrap,deal.waste,deal.reason],[20,0,10,''],'overpaying is lost, never change');
  for(const trade of [{'ammo:pistol':11},{'med':-1},{'med':1.5},{'nonsense':1},[],null])assert.ok(terminalDeal(g,'rifle',trade).reason,JSON.stringify(trade));
  const turn=g.turn;assert.ok(g.action('terminal',{buy:'rifle',trade:{'ammo:pistol':7}}));
  assert.deepEqual([p.scrap,p.pistol,p.reserve,g.turn],[0,18,24,turn+1],'42 pistol rounds and all 3 scrap for 24 rifle rounds, one turn');
  assert.equal(g.props[0].spent,10,'the credit is spent by the price, however it was paid');
});

test('weapons as payment: one must stay, the one being modified cannot go, and a traded magazine returns to the reserve',()=>{
  const g=arena(),p=g.player,[rifle,shotgun]=p.owned;p.scrap=0;p.shell=0;p.ammo[shotgun]=3;
  assert.equal(terminalDeal(g,`upgrade:${shotgun}`,{[`weapon:${shotgun}`]:1}).reason,'不能用正要改裝的武器抵價。');
  assert.equal(terminalDeal(g,`upgrade:${rifle}`,{[`weapon:${rifle}`]:1,[`weapon:${shotgun}`]:1}).reason.length>0,true);
  p.weapon=shotgun;
  assert.ok(g.action('terminal',{buy:`upgrade:${rifle}`,trade:{[`weapon:${shotgun}`]:1,'med':1}}),g.logs[0]?.text);
  assert.deepEqual(p.owned,[rifle]);assert.equal(p.weapon,rifle);assert.equal(p.shell,3);assert.equal(p.upgrades[rifle],1);
  assert.equal(row(g,`weapon:${rifle}`).reason,'至少保留一把');
});

test('modifications: any weapon in the pack, only at a terminal, up to +3; each takes a turn and credit',()=>{
  const g=arena(),p=g.player,spare=p.owned[1];p.scrap=500;
  assert.notEqual(p.weapon,spare);
  assert.equal(g.action('upgrade'),false);assert.match(g.logs[0].text,/補給終端/);
  assert.equal(terminalCost(`upgrade:${spare}`,g),25);assert.ok(g.action('terminal',`upgrade:${spare}`));assert.equal(p.upgrades[spare],1);
  assert.equal(terminalCost(`upgrade:${spare}`,g),40);assert.ok(offerReason(g,`upgrade:${spare}`).includes('剩餘額度 35'));
  g.props=[{id:'fresh',x:11,y:10,type:'terminal',used:false}];assert.ok(g.action('terminal',`upgrade:${spare}`));
  g.props=[{id:'fresh2',x:11,y:10,type:'terminal',used:false}];assert.ok(g.action('terminal',`upgrade:${spare}`));assert.equal(p.upgrades[spare],3);
  g.props=[{id:'fresh3',x:11,y:10,type:'terminal',used:false}];assert.equal(offerReason(g,`upgrade:${spare}`),'此武器已達最高改裝等級。');
  assert.equal(offerReason(g,'upgrade:999'),'背包裡沒有這把武器。');
});

test('the credit: 60 a terminal, shown as it drops, worn out below the cheapest price, and old saves keep their state',()=>{
  assert.equal(TERMINAL_TUNING.credit,60);assert.equal(TERMINAL_MIN_PRICE,5);   // 3.178.0: a glowstick costs 5
  const g=arena(),p=g.player,t=g.props[0];p.scrap=500;p.pistol=0;p.reserve=0;
  assert.equal(terminalRemaining(t),60);
  for(const id of ['rifle','rifle','pistol','pistol','pistol'])assert.ok(g.action('terminal',id));
  assert.equal(terminalRemaining(t),10);assert.equal(t.used,false);
  assert.equal(offerReason(g,'heal').length>0,true);
  assert.ok(g.action('terminal','shell'));assert.equal(t.used,true);assert.equal(terminalRemaining(t),0);assert.equal(g.nearbyTerminal,undefined);
  assert.equal(terminalRemaining({type:'terminal',used:true}),0,'a pre-3.120.0 used terminal has nothing left');
  assert.equal(terminalRemaining({type:'terminal',used:false}),60,'and an unused one is full');
  const saved=arena();saved.props[0].spent=25;const restored=Game.restore(saved.serialize());assert.equal(restored.props[0].spent,25);
  for(const bad of [-1,61,1.5,'10'])assert.equal(Game.restore(saved.serialize().replace('"spent":25',`"spent":${JSON.stringify(bad)}`)),null,String(bad));
});

test('learning data and medkits: traded at a terminal, not dismantled in the pack; medkits are also sold',()=>{
  const g=arena(),p=g.player;p.learningItems={trait_braced:1};p.scrap=5;p.meds=0;
  assert.equal(g.action('dismantleLearning','trait_braced'),false);
  assert.equal(terminalCost('med'),20);
  assert.ok(g.action('terminal',{buy:'med',trade:{'learning:trait_braced':1}}),g.logs[0]?.text);
  assert.deepEqual([p.meds,p.learningItems,p.scrap],[1,{},0],'15 of data and 5 scrap for a 20 medkit');
});

test('the terminal screen reads every price, reason and value from the rules; the battlefield shows a spent terminal',async()=>{
  const source=await read('../src/controller.js'),renderer=await read('../src/renderer.js');
  assert.ok(source.includes("const reason=offerReason(game,row.id)||terminalAffordable(row.id);"));
  assert.ok(source.includes("modalAction('terminal',{buy,trade});"));
  assert.ok(source.includes('data-trade-step="${row.id}"'));
  assert.ok(source.includes("{label:`${t('controller.act.terminal',{v:terminalRemaining(view.nearbyTerminal)})}`,action:'terminal'}"),'the interact button shows the credit');
  assert.ok(!source.includes('data-upgrade=')&&!source.includes('data-dismantle-learning='),'no modification or data dismantling in the pack');
  assert.ok(renderer.includes("terminalCredit(p,a){if(p.used||!p.spent)return;"));
});

test('a kill house simulation still refuses the terminal',async()=>{
  const {createKillhouse}=await import('../src/killhouse.js');
  const g=createKillhouse({mode:'arcade',character:'soldier'}),p=g.player;p.scrap=100;p.reserve=0;
  const spot=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy})).find(q=>g.grid[q.y]?.[q.x]===1&&!g.props.some(o=>o.x===q.x&&o.y===q.y));
  g.props.push({id:'sim-term',x:spot.x,y:spot.y,type:'terminal',used:false});
  // As before 3.120.0 the refusal comes after validation, so the turn is spent; nothing is bought or paid.
  g.action('terminal','rifle');assert.equal(p.scrap,100);assert.equal(p.reserve,0);assert.ok(g.logs.some(l=>l.text==='模擬戰場不提供終端補給。'));
  assert.equal(g.props.at(-1).spent,undefined);
});
