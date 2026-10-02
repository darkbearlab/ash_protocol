import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {ENEMY_AFFIXES,giveEnemyAffix} from '../src/enemy-affixes.js';
import {ALARM_TUNING} from '../src/enemy-behavior.js';
import {FEIGN_TUNING,downed} from '../src/concealed.js';
import {applySuppression} from '../src/suppression.js';
import {commsEvents,newCommsMemory} from '../src/comms-events.js';
import {t} from '../src/i18n.js';
import {mineReason} from '../src/field-gear.js';

// 3.219.0 (user 2026-10-01, docs/ENEMY_VARIETY.md 10.2-10.4): three ordinary affixes any fighter can draw.
// 通報 calls your position out on sight; 殉爆 leaves a marked blast where it falls; 裝死 falls as a body once and gets up.
const hard={curve:'hard',offset:0};
function field(){const g=affixArena();clearGeneratedMap(g);g.fires=[];g.flares=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return g;}
function unit(g,type,x,y=10,affix=null,faction='loyalist',id=`u${g.enemies.length}`){const e=makeEnemy(type,x,y,id,6,hard,faction);if(affix)giveEnemyAffix(e,affix);e.alert=true;e.lastKnown={x:g.player.x,y:g.player.y};g.enemies.push(e);g.reveal();return e;}
const turn=(g,e)=>{g.turn++;g.enemyAct(e);g.settleAttackNotes();};
const def=id=>ENEMY_AFFIXES.find(a=>a.id===id);

test('who: any fighter but a boss; 殉爆 and 裝死 never on a suicide unit; all three are ordinary affixes',()=>{
 const of=(type,faction='loyalist')=>makeEnemy(type,1,1,'x',6,hard,faction);
 for(const id of ['alarm','volatile','feign']){assert.ok(!def(id).special&&!def(id).infection,id);for(const type of ['rifleman','raider','sniper'])assert.ok(def(id).applies(of(type)),`${id} ${type}`);assert.ok(def(id).applies(of('crawler','swarm')),`${id} crawler`);assert.equal(def(id).applies(of('designator')),false,`${id} boss`);}
 for(const id of ['volatile','feign'])assert.equal(def(id).applies(of('bomber_bot')),false,`${id} bomber`);
});

test('通報: seeing you, it spends its turn calling your position to everyone within ten tiles; then a cooldown',()=>{
 const g=field(),p=g.player,e=unit(g,'rifleman',14,10,'alarm'),near=unit(g,'rifleman',20,14,null,'loyalist','near'),far=unit(g,'rifleman',26,10,null,'loyalist','far');
 for(const o of [near,far]){o.alert=false;o.lastKnown=null;}
 turn(g,e);
 assert.equal(p.hp,999,'no shot');assert.equal(e.charge,false,'no wind-up either');assert.deepEqual([e.x,e.y],[14,10],'no step');
 assert.ok(g.logs.some(l=>l.text===t('alarm.radio',{enemy:enemyDisplayName(e)})));assert.ok(e.affixes.find(a=>a.id==='alarm').revealed);
 assert.ok(near.alert);assert.deepEqual(near.lastKnown,{x:10,y:10},'within ten: it knows where you stood');assert.equal(far.alert,false,'beyond ten: nothing');
 assert.equal(e.callCooldown,ALARM_TUNING.cooldown);turn(g,e);assert.ok(e.charge,'cooling down, it fights as usual');
 const s=field(),bug=unit(s,'giant_bug',14,10,'alarm','swarm');turn(s,bug);assert.ok(s.logs.some(l=>l.text===t('alarm.screech',{enemy:enemyDisplayName(bug)})),'a bug shrieks');
 const k=field(),pinnedOne=unit(k,'rifleman',14,10,'alarm');applySuppression(pinnedOne,5);turn(k,pinnedOne);assert.ok(!(pinnedOne.callCooldown>0),'pinned, no call');
});

test("殉爆: where it falls a blast (the enemy grenade's) is marked; it goes off after your next action and hurts everyone in it",()=>{
 const g=field(),p=g.player,e=unit(g,'rifleman',11,10,'volatile'),other=unit(g,'rifleman',11,11,null,'loyalist','other');e.hp=1;other.hp=other.maxHp=500;g.enemyAct=()=>{};g.target=e.id;
 const at=g.turn;assert.ok(g.action('fire'));assert.ok(e.hp<=0);
 const mark=g.marks.find(m=>m.kind==='volatile');assert.ok(mark);assert.deepEqual([mark.x,mark.y,mark.radius,mark.due],[11,10,1,at+2]);
 assert.ok(e.affixes.find(a=>a.id==='volatile').revealed);assert.ok(g.logs.some(l=>l.text===t('volatile.belt',{enemy:enemyDisplayName(e)})));
 assert.equal(p.hp,999,'not yet');const raw=g.serialize(),back=Game.restore(raw);assert.ok(back,'the mark saves');assert.deepEqual(back.marks,g.marks);
 const bad=JSON.parse(raw);bad.data.marks=[{...mark,radius:2}];assert.equal(Game.restore(JSON.stringify(bad)),null,'a wrong blast is refused');
 g.action('wait');assert.ok(p.hp<999,'stayed in the ring: hurt');assert.ok(other.hp<500,'its own side too');assert.ok(!g.marks.some(m=>m.kind==='volatile'));
 const k=field(),f=unit(k,'rifleman',11,10,'volatile');f.hp=1;k.enemyAct=()=>{};k.target=f.id;k.action('fire');k.action('move',[-1,0]);k.action('wait');assert.equal(k.player.hp,999,'stepped out: safe');
});

test('裝死: at its first 0 hp it lies as a body (a kill in the log, nothing paid), locks like a rigged case, and gets up',()=>{
 const g=field(),p=g.player,e=unit(g,'rifleman',13,10,'feign');e.hp=1;g.target=e.id;const kills=p.kills,xp=p.xp;
 g.enemyAct=()=>{};assert.ok(g.action('fire'));delete g.enemyAct;
 assert.equal(e.hp,1);assert.ok(downed(e));assert.equal(p.kills,kills,'no kill yet');assert.equal(p.xp,xp,'no xp yet');
 assert.ok(g.logs.some(l=>l.text===t('game.killed',{target:enemyDisplayName(e)})),'it reads as a kill');
 assert.equal(g.visibleEnemies.includes(e),false,'no enemy you see');assert.equal(g.sight(p,e),true,'you see the body');g.target=e.id;assert.equal(g.targeted,e,'and it locks');
 assert.ok(!commsEvents({game:g,memory:newCommsMemory('r')}).map(x=>x.type).includes('hiddenThreat'),'no hidden-threat line for a body');
 const back=Game.restore(g.serialize());assert.ok(back);assert.deepEqual(back.enemies.find(x=>x.id===e.id).concealed,{as:'corpse',turns:FEIGN_TUNING.turns});
 g.action('wait');assert.ok(downed(e),'one turn down');assert.equal(p.hp,999);
 g.action('wait');assert.equal(downed(e),false,'it gets up');assert.ok(e.affixes.find(a=>a.id==='feign').revealed);
 assert.ok(g.logs.some(l=>l.text===t('feign.rise',{enemy:enemyDisplayName(e)})));assert.equal(p.hp,999,'getting up is its turn');
 // Once only: down to 0 again, it dies.
 g.hurt(e,e.hp,p);assert.ok(e.hp<=0);assert.equal(p.kills,kills+1);
});

test('裝死: any damage on the body kills it for real, and pays then; a broken body is refused',()=>{
 const g=field(),p=g.player,e=unit(g,'rifleman',13,10,'feign');e.hp=1;const kills=p.kills;g.hurt(e,5,p);assert.ok(downed(e));
 g.hurt(e,0,p);assert.ok(downed(e),'no damage, still down');g.hurt(e,1,p);assert.ok(e.hp<=0,'dead');assert.ok(!g.logs.some(l=>l.text===t('feign.rise',{enemy:enemyDisplayName(e)})),'it never got up');assert.equal(p.kills,kills+1,'the kill counts now');assert.ok(e.affixes.find(a=>a.id==='feign').revealed);
 const k=field(),f=unit(k,'rifleman',13,10,'feign');f.hp=1;k.hurt(f,5,k.player);k.rng=new Game(1,[],0,'soldier','onyx').rng;const raw=k.serialize();
 const tamper=fn=>{const d=JSON.parse(raw);fn(d.data.enemies.find(x=>x.id===f.id));return Game.restore(JSON.stringify(d));};
 for(const [why,fn] of [['too long down',x=>{x.concealed.turns=FEIGN_TUNING.turns+1;}],['the affix already shown',x=>{x.affixes.find(a=>a.id==='feign').revealed=true;}],['without the affix',x=>{x.affixes=x.affixes.filter(a=>a.id!=='feign');}]])assert.equal(tamper(fn),null,why);
});

// 3.219.0 review: the body can be finished with any gun; the lock lets go of it as of a kill; no hunt target or keycard
// carrier feigns; a flamer never carries 殉爆; a mine goes on a body as on any body.
test('review: finishing the body, the lock, the keycard carrier, the flamer, the mine',()=>{
 const g=field(),p=g.player,e=unit(g,'rifleman',13,10,'feign'),next=unit(g,'rifleman',15,12,null,'loyalist','next');e.hp=1;g.target=e.id;g.enemyAct=()=>{};
 g.action('fire');assert.ok(downed(e));assert.notEqual(g.target,e.id,'the lock moves on, as for a kill');
 g.target=e.id;const kills=p.kills;assert.ok(g.action('fire'));assert.ok(e.hp<=0,'a rifle finishes the body');assert.equal(p.kills,kills+1);
 const k=field(),c=unit(k,'rifleman',13,10,'feign');c.keycard=true;c.hp=1;k.hurt(c,5,k.player);assert.ok(c.hp<=0,'the keycard carrier dies for real');
 const flamer=ENEMY_AFFIXES.find(a=>a.id==='flamer'),u=makeEnemy('rifleman',1,1,'x',6,hard,'rebel');giveEnemyAffix(u,'volatile');assert.equal(flamer.applies(u),false,'no flamer on a volatile unit');
 const m=field(),b=unit(m,'rifleman',12,10,'feign');b.hp=1;m.hurt(b,5,m.player);m.player.mines=1;assert.equal(mineReason(m,{x:12,y:10}),'','a mine goes on the body');
});
