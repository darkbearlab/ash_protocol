// 3.163.0 (user decision 2026-09-23): the operator says an invalid input out loud, and warns before the next one.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,WEAPONS} from '../src/engine.js';
import {makeBarrier} from '../src/barriers.js';
import {PLAYER_LINES,playerLine,calloutLine,CalloutBoard,CALLOUT_UI_TUNING} from '../src/callout-ui.js';
import {PLAYER_CUES,playerCalloutEvent} from '../src/callouts.js';
function arena(character='soldier'){
 const g=new Game(3163,[],0,character,'onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>1));g.barriers=[];g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.allies=[];g.smoke=[];g.end={x:20,y:20};Object.assign(g.player,{x:10,y:10});g.rng=Object.assign(()=>0,{state:()=>0});Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});g.reveal();return g;
}
function enemy(g,x,y){const e=makeEnemy('rifleman',x,y,'qa-'+g.enemies.length);Object.assign(e,{hp:1000,maxHp:1000,alert:true});g.enemies.push(e);g.target=e.id;g.reveal();return e;}
// A refused action says its line, changes nothing and leaves the combat log as it was.
function refused(g,type,arg,cue,item){
 const logs=g.logs.length,first=g.logs[0],turn=g.turn;
 assert.equal(g.action(type,arg),false,`${type} is refused`);assert.equal(g.refusal?.cue,cue,`${type} says ${cue}`);if(item)assert.equal(g.refusal.item,item);
 assert.equal(g.turn,turn);assert.equal(g.logs.length,logs,'not logged');assert.equal(g.logs[0],first);
}
const spoken=(g,cue)=>g.effects.filter(e=>e.type==='callout'&&e.speaker==='player').map(e=>e.cue).includes(cue);

test('the lines are the user\'s words, never a number, and cover every code the rules send',()=>{
 assert.deepEqual(PLAYER_LINES,{blocked:'被擋住了',locked:'上鎖了',pinned:'被壓制了',anchor_on:'下錨！',anchor_off:'解除下錨！',anchored:'下錨中！',reload_needed:'需要裝填',last_magazine:'最後一個彈匣',no_ammo:'沒彈藥了',out_of_range:'目標在射程外',no_target:'沒有目標',chambered:'已上膛',not_needed:'不需要',fatal:'會死！'});
 for(const cue of PLAYER_CUES)assert.ok(playerLine({cue,item:'醫療包'}),cue);
 assert.equal(playerLine({cue:'empty',item:'醫療包'}),'醫療包沒了');assert.equal(calloutLine(playerCalloutEvent('blocked')),'被擋住了');
 assert.ok(Object.values(PLAYER_LINES).every(line=>!/[0-9０-９]/.test(line)));
});
test('movement: a wall, a partition, an enemy or a friend in the way is 被擋住了; the vault door is 上鎖了',()=>{
 const g=arena();g.grid[10][11]=0;refused(g,'move',[1,0],'blocked');
 const h=arena();h.barriers=[makeBarrier('partition',{x:10,y:10},{x:11,y:10},'edge')];refused(h,'move',[1,0],'blocked');assert.equal(h.target,'edge','the partition is still locked on so you can shoot it');
 const k=arena(),e=enemy(k,11,10);k.grid[9][10]=0;k.lighting[10][11]=1;k.props=[{id:'c',type:'cover',x:12,y:10,hp:65,maxHp:65}];Object.defineProperty(k,'shotClear',{value:()=>false,configurable:true});refused(k,'move',[1,0],'blocked');assert.ok(e.hp>0);
 const v=arena();v.barriers=[{...makeBarrier('door',{x:10,y:10},{x:11,y:10},'vault'),locked:true}];refused(v,'move',[1,0],'locked');
});
test('pinned, anchored: 被壓制了 and 下錨中！ for walking and for changing floors',()=>{
 const g=arena();g.player.suppression=3;refused(g,'move',[0,1],'pinned');Object.assign(g.player,g.end);refused(g,'interact',undefined,'pinned');
 const b=arena('bulwark');assert.ok(b.action('skill','anchor'));assert.ok(spoken(b,'anchor_on'),'下錨！');
 refused(b,'move',[0,1],'anchored');Object.assign(b.player,b.end);refused(b,'interact',undefined,'anchored');
 Object.assign(b.player,{x:10,y:10});assert.ok(b.action('skill','anchor'));assert.ok(spoken(b,'anchor_off'),'解除下錨！');
});
test('shooting and reloading: 沒有目標, 目標在射程外, 需要裝填, 已上膛, 沒彈藥了, 不需要',()=>{
 const g=arena(),p=g.player;g.target=null;refused(g,'fire',undefined,'no_target');
 const far=enemy(g,10+WEAPONS[p.weapon].range+2,10);refused(g,'fire',undefined,'out_of_range');
 far.x=13;g.reveal();p.ammo[p.weapon]=0;refused(g,'fire',undefined,'reload_needed');
 p.ammo[p.weapon]=WEAPONS[p.weapon].mag;refused(g,'reload',undefined,'chambered');
 p.ammo[p.weapon]=0;p[g.reserveKey()]=0;refused(g,'reload',undefined,'no_ammo');
 const m=arena('berserker');m.player.weapon=m.player.owned[0];refused(m,'reload',undefined,'not_needed');refused(m,'weapon',m.player.weapon,'not_needed');
});
test('items: X沒了, 不需要 at full health or plates, 會死！ for an adrenaline shot that would kill',()=>{
 const g=arena(),p=g.player;p.meds=0;p.hp=50;refused(g,'heal',undefined,'empty','醫療包');
 p.meds=2;p.hp=p.maxHp;p.poison=0;refused(g,'heal',undefined,'not_needed');
 p.adrenaline=1;p.hp=10;refused(g,'surge',undefined,'fatal');
});
test('warnings: the shot that empties the magazine says 需要裝填, the reload that spends the last reserve 最後一個彈匣',()=>{
 const g=arena(),p=g.player;enemy(g,12,10);p.ammo[p.weapon]=1;assert.ok(g.action('fire'));assert.equal(p.ammo[p.weapon],0);assert.ok(spoken(g,'reload_needed'));
 p[g.reserveKey()]=3;assert.ok(g.action('reload'));assert.equal(p[g.reserveKey()],0);assert.ok(spoken(g,'last_magazine'));
 p[g.reserveKey()]=40;p.ammo[p.weapon]=0;assert.ok(g.action('reload'));assert.ok(!spoken(g,'last_magazine'),'reserve left: no warning');
 p.ammo[p.weapon]=5;assert.ok(g.action('fire'));assert.ok(!spoken(g,'reload_needed'),'rounds left: no warning');
});
test('refusals the operator does not voice still log; the refusal is never saved',()=>{
 const g=arena();assert.equal(g.action('openContainer','none'),false);assert.equal(g.refusal,null);assert.match(g.logs[0].text,/附近沒有可開啟的補給箱/);
 g.grid[10][11]=0;g.action('move',[1,0]);assert.equal(g.refusal.cue,'blocked');assert.ok(!('refusal' in JSON.parse(g.serialize()).data));
});
test('the operator\'s bubble: 1.5 s, a repeat extends it, a new line replaces it, the cap of four never drops it',()=>{
 const board=new CalloutBoard();const a=board.add(playerCalloutEvent('blocked'),0);assert.equal(a.expires,CALLOUT_UI_TUNING.playerMs);assert.equal(a.text,'被擋住了');
 assert.equal(board.add(playerCalloutEvent('blocked'),1000),a);assert.equal(a.expires,1000+CALLOUT_UI_TUNING.playerMs);
 const b=board.add(playerCalloutEvent('empty',{item:'醫療包'}),1100);assert.equal(b.text,'醫療包沒了');const c=board.add(playerCalloutEvent('empty',{item:'煙霧彈'}),1200);assert.equal(c.text,'煙霧彈沒了');
 assert.equal(board.active(1200).filter(i=>i.event.speaker==='player').length,1,'one bubble on the operator');
 for(let i=0;i<6;i++)board.add({type:'callout',cue:'grenade',category:'danger',priority:'high',visibility:'visible',actorId:'e'+i,position:{x:i,y:0}},1300+i);
 const shown=board.active(1310);assert.equal(shown.filter(i=>i.event.speaker!=='player').length,CALLOUT_UI_TUNING.maxOnScreen);assert.ok(shown.some(i=>i.event.speaker==='player'));
});

// 3.177.5 (user): out of ammo altogether, firing says 沒彈藥了 as reloading does; 需要裝填 only while a reload would work.
test('with no reserve, firing an empty or short magazine says 沒彈藥了, and so does the shot that empties it',()=>{
 const g=arena(),p=g.player;enemy(g,12,10);p[g.reserveKey()]=0;
 p.ammo[p.weapon]=0;refused(g,'fire',undefined,'no_ammo');refused(g,'reload',undefined,'no_ammo');
 p.ammo[p.weapon]=1;assert.ok(g.action('fire'));assert.ok(spoken(g,'no_ammo'),'the last round, nothing to reload');assert.ok(!spoken(g,'reload_needed'));
 p[g.reserveKey()]=5;p.ammo[p.weapon]=0;refused(g,'fire',undefined,'reload_needed');
 assert.equal(g.emptyCue(),'reload_needed');p[g.reserveKey()]=0;assert.equal(g.emptyCue(),'no_ammo');
});
