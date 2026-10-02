import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,makeEnemy,generate,enemyDisplayName} from '../src/engine.js';
import {affixArena} from '../qa/enemy-affix-scenes.mjs';
import {clearGeneratedMap} from './helpers/arena.mjs';
import {AFFIX_TUNING,ENEMY_AFFIXES,giveEnemyAffix,disarms,disarmChance,validEnemyAffixes} from '../src/enemy-affixes.js';
import {tickDisarms,disarmSpot,canAimDisarm} from '../src/disarm.js';
import {specialDef,ORDER,topCarriers} from '../src/enemy-specials.js';
import {distance} from '../src/world.js';
import {t} from '../src/i18n.js';
import {addAlly} from '../src/allies.js';
import {makeBarrier} from '../src/barriers.js';
import {grantTrait} from '../src/traits.js';

// 3.215.0 繳械 (user 2026-09-30, docs/ENEMY_VARIETY.md section 4): a marksman that sees you warns one round that it aims at
// your weapon, then fires its usual attack; a round that lands hurts you and knocks the weapon in your hand onto the floor
// one or two tiles away, the side away from it first; you switch to the next. At most once every five rounds.
const T=AFFIX_TUNING;
const hard={curve:'hard',offset:0},standard={curve:'standard',offset:0},easy={curve:'easy',offset:0};
function field(character='soldier'){const g=affixArena(character);clearGeneratedMap(g);g.fires=[];g.flares=[];Object.assign(g.player,{x:10,y:10,hp:999,maxHp:999,plates:0,armor:0,guard:false});g.reveal();return g;}
function marksman(g,type='rifleman',x=15,y=10){const e=makeEnemy(type,x,y,'dz',6,hard,'loyalist');giveEnemyAffix(e,'disarm');e.alert=true;g.enemies.push(e);g.rng=Object.assign(()=>0,{state:()=>1});g.reveal();return e;}
const round=(g,e)=>{g.turn++;tickDisarms(g);g.enemyAct(e);};
const knocked=g=>g.items.filter(i=>i.type==='weapon');

// 3.218.0 (user 2026-10-02: 「有槍的大家都可以抽」): any gun that is not a boss or a fixed turret.
test('who: any gun but a boss or a fixed turret; never a flamer, grenadier, lockdown or fast unit',()=>{
 const def=ENEMY_AFFIXES.find(a=>a.id==='disarm'),of=(type,faction='loyalist')=>makeEnemy(type,1,1,'x',6,hard,faction);
 assert.equal(def.special,true);
 for(const type of ['rifleman','rifleman_armored','sniper','raider','gunner','enforcer','squad_leader'])assert.ok(def.applies(of(type)),type);
 assert.ok(def.applies(of('rifleman_infected','swarm')),'infected riflemen too');
 for(const type of ['turret','crawler'])assert.equal(def.applies(of(type,type==='crawler'?'swarm':'loyalist')),false,type);
 for(const type of ['designator','warden','delisted_soldier'])assert.equal(def.applies(of(type)),false,`${type}: no boss`);
 for(const id of ['flamer','grenadier','lockdown','fast']){const u=of('rifleman');giveEnemyAffix(u,id);assert.equal(def.applies(u),false,id);}
 const d=of('rifleman');giveEnemyAffix(d,'disarm');
 for(const id of ['grenadier','fast'])assert.equal(ENEMY_AFFIXES.find(a=>a.id===id).applies(d),false,`no ${id} top-up`);
 assert.deepEqual(topCarriers(d),['disarm']);assert.ok(validEnemyAffixes(d));
 for(const id of ['grenadier','fast','lockdown']){const u=of('rifleman');giveEnemyAffix(u,'disarm');u.affixes.push({id,revealed:false});assert.equal(validEnemyAffixes(u),false,id);}
});

test('start floors: hard from floor 3, standard from floor 5, never in the easy campaign; deterministic',()=>{
 assert.equal(disarmChance(2,hard),0);assert.equal(disarmChance(3,hard),T.disarmPerDepth);
 assert.equal(disarmChance(4,standard),0);assert.equal(disarmChance(5,standard),T.disarmPerDepth);
 for(let f=1;f<=6;f++)assert.equal(disarmChance(f,easy),0);
 const count=(d,floor,faction)=>{let n=0;for(let seed=1;seed<=25;seed++){const ids=m=>m.enemies.filter(disarms).map(e=>e.id),a=generate(seed,floor,[],d,faction);assert.deepEqual(ids(a),ids(generate(seed,floor,[],d,faction)));n+=ids(a).length;}return n;};
 assert.equal(count(hard,2,'loyalist'),0);assert.ok(count(hard,6,'loyalist')>0);assert.ok(count(hard,6,'swarm')>0,'infected riflemen');
 assert.equal(count(standard,4,'rebel'),0);assert.equal(count(easy,6,'loyalist'),0);
});

test('it warns one round, then a round that lands hurts you and knocks your weapon away; you switch to the next',()=>{
 const g=field(),p=g.player,e=marksman(g);const held=p.weapon,next=p.owned.find(s=>s!==held);
 assert.match(enemyDisplayName(e),/？$/);
 e.charge=true;e.aim={x:10,y:10};e.windup=1;   // a shot wound up for it is let go
 round(g,e);
 assert.deepEqual(e.disarmIntent,{origin:{x:15,y:10}});assert.equal(e.disarmCooldown,T.disarmCooldown);assert.equal(e.charge,false);assert.equal(e.aim,null);
 assert.equal(p.hp,999,'the warning round');assert.equal(g.logs[0].text,t('disarm.aim',{enemy:enemyDisplayName(e),weapon:g.weaponAt(held).name}));
 assert.deepEqual(specialDef('disarm').card(g,e),[t('target-card.disarm')]);
 p.fireChain={target:'x',count:2};round(g,e);
 assert.ok(p.hp<999,'it still hurts');assert.equal(p.fireChain,null,'a new weapon starts its own chain');assert.equal(e.disarmIntent,undefined);
 assert.equal(p.weapon,next,'switched');assert.deepEqual(p.owned,[next]);
 const [w]=knocked(g);assert.equal(w.slot,held);assert.deepEqual({x:w.x,y:w.y},{x:8,y:10},'behind you, away from it');
 assert.ok(g.logs.some(l=>l.text===t('disarm.knocked',{enemy:enemyDisplayName(e),weapon:g.weaponAt(held).name,next:g.weaponAt(next).name})));
 // Picked up again, it is the same weapon: its slot keeps its affix, upgrades and magazine.
 const before={affix:p.affixes[held],upgrades:p.upgrades[held],ammo:p.ammo[held]};
 p.x=8;p.y=10;g.pickup();assert.ok(p.owned.includes(held),'picked up');
 assert.deepEqual({affix:p.affixes[held],upgrades:p.upgrades[held],ammo:p.ammo[held]},before);
});

test('a miss knocks nothing; out of its sight or its line when it fires, the shot is wasted',()=>{
 const g=field(),p=g.player,e=marksman(g);round(g,e);g.rng=Object.assign(()=>.999,{state:()=>1});
 const held=p.weapon;round(g,e);assert.equal(p.weapon,held,'missed');assert.equal(knocked(g).length,0);
 const k=field(),q=k.player,f=marksman(k);round(k,f);
 for(let y=0;y<k.grid.length;y++)k.grid[y][12]=0;k.reveal();assert.equal(k.sight(f,q),false);
 round(k,f);assert.equal(q.hp,999);assert.equal(knocked(k).length,0);assert.ok(k.logs.some(l=>l.text===t('disarm.lost',{enemy:enemyDisplayName(f)})));
 assert.equal(f.disarmCooldown,T.disarmCooldown-1,'the cooldown runs on: it was spent');
 // Smoke on you during the warning: it cannot see you (its line is still clear), so the shot is wasted too.
 const m=field(),r=m.player,h=marksman(m);round(m,h);m.smoke=[{cells:[{x:10,y:10},{x:11,y:10},{x:9,y:10},{x:10,y:9},{x:10,y:11}],expires:m.turn+6}];m.reveal();
 assert.equal(m.sight(h,r),false);assert.ok(m.shotClear(h,r),'the line is clear');round(m,h);assert.equal(r.hp,999);assert.equal(knocked(m).length,0);
});

test('the weapon in hand when it fires is the one knocked: switch to the one you can spare',()=>{
 const g=field(),p=g.player,e=marksman(g);round(g,e);
 const spare=p.owned.find(s=>s!==p.weapon),kept=p.weapon;p.weapon=spare;
 round(g,e);assert.equal(knocked(g)[0]?.slot,spare);assert.equal(p.weapon,kept);
});

test('with your last weapon or a class weapon in hand it fights as usual; a run with a knocked weapon still saves',()=>{
 const g=field(),p=g.player,e=marksman(g);p.owned=[p.weapon];assert.equal(canAimDisarm(g,e),false);
 round(g,e);assert.equal(e.disarmIntent,undefined);
 // 3.215.0 review: a class weapon (the ninja's katana, the berserker's axe, the bulwark's gauntlet) is never knocked — the
 // game keeps those in your pack, and a save with one on the floor is refused.
 for(const character of ['ninja','berserker','bulwark']){
  const n=field(character),q=n.player;const locked=q.owned.find(s=>n.weaponAt(s).locked);assert.ok(locked!==undefined,character);
  q.weapon=locked;const f=marksman(n);assert.equal(canAimDisarm(n,f),false,`${character}: no aim at a class weapon`);
  // Switched to it during the warning: the shot still hurts, nothing is knocked, and the run saves.
  q.weapon=q.owned.find(s=>s!==locked);round(n,f);assert.ok(f.disarmIntent,character);q.weapon=locked;n.effects=[];round(n,f);
  assert.ok(n.effects.some(x=>x.type==='enemyShot'&&!x.miss&&x.attackerType===f.type),`${character}: the shot lands`);assert.equal(knocked(n).length,0,`${character}: kept`);assert.ok(q.owned.includes(locked));
  n.rng=new Game(1,[],0,character,'onyx').rng;assert.ok(Game.restore(n.serialize()),`${character}: saves`);
 }
 const k=field(),f=marksman(k);round(k,f);round(k,f);assert.equal(knocked(k).length,1);k.rng=new Game(1,[],0,'soldier','onyx').rng;assert.ok(Game.restore(k.serialize()),'a knocked gun on the floor saves');
});

test('review: no aim round a corner, out of reach or pinned; a door shut before the shot wastes it; the third weapon order',()=>{
 // Round a corner (it sees you lean, no shot), out of its reach, pinned: no aim.
 const c=field(),ce=marksman(c,'rifleman',12,11);for(let y=1;y<=10;y++)c.grid[y][11]=0;Object.assign(c.player,{x:10,y:10});c.reveal();
 assert.ok(c.sight(ce,c.player)&&!c.shotClear(ce,c.player),'a corner');assert.equal(canAimDisarm(c,ce),false);
 const far=field(),fe=marksman(far,'rifleman',18,10);far.reveal();assert.ok(far.sight(fe,far.player));assert.equal(canAimDisarm(far,fe),false,'8 tiles: out of reach');
 const pin=field(),pe=marksman(pin);pe.suppression=3;assert.equal(canAimDisarm(pin,pe),false,'pinned');
 // A door shut between them before the shot: wasted.
 const d=field(),de=marksman(d);round(d,de);d.barriers.push(makeBarrier('door',{x:12,y:10},{x:13,y:10},'edge-dz'));d.reveal();
 round(d,de);assert.equal(knocked(d).length,0);assert.equal(d.player.hp,999);
 // Stepped round a corner after the aim: it still sees you lean but has no shot, so the shot is wasted.
 const cr=field(),crp=cr.player,cre=marksman(cr,'rifleman',12,11);for(let y=1;y<=10;y++)cr.grid[y][11]=0;Object.assign(crp,{x:10,y:11});cr.reveal();
 assert.ok(canAimDisarm(cr,cre),'in the open');round(cr,cre);assert.ok(cre.disarmIntent);crp.y=10;cr.reveal();
 assert.ok(cr.sight(cre,crp)&&!cr.shotClear(cre,crp),'leaning at the corner');round(cr,cre);assert.equal(knocked(cr).length,0);assert.equal(crp.hp,999);
 // Three weapons: the knocked one's place goes to the next in the pack.
 const w=field(),wp=w.player,we=marksman(w);const third=w.registerWeapon({weapon:3}).slot;wp.owned=[wp.owned[0],wp.owned[1],third];wp.weapon=wp.owned[1];
 round(w,we);round(w,we);assert.equal(wp.weapon,third,'the next after the knocked one');
});

test('review: made fast after it aims, the shot is let go; never fast when it aims (lockdown too)',()=>{
 const g=field(),e=marksman(g);grantTrait(e,'fast','squad:bound');assert.equal(canAimDisarm(g,e),false);
 const k=field(),f=marksman(k);round(k,f);assert.ok(f.disarmIntent);grantTrait(f,'fast','squad:bound');round(k,f);
 assert.equal(f.disarmIntent,undefined);assert.equal(knocked(k).length,0,'no knock before you could answer');
});

test('review: the weapon lands where you can walk to it, never beyond a wall or a shut door, never under someone',()=>{
 const g=field(),e=marksman(g);for(let y=0;y<g.grid.length;y++)g.grid[y][9]=0;g.reveal();
 const q=disarmSpot(g,e);assert.ok(q.x>=10,`not beyond the wall: ${q.x},${q.y}`);
 const d=field(),de=marksman(d);d.barriers.push(makeBarrier('door',{x:10,y:10},{x:9,y:10},'edge-a'),makeBarrier('door',{x:10,y:9},{x:9,y:9},'edge-b'),makeBarrier('door',{x:10,y:11},{x:9,y:11},'edge-c'));d.reveal();
 const r=disarmSpot(d,de);assert.ok(r.x>=10,`not beyond a shut door: ${r.x},${r.y}`);
 const u=field(),ue=marksman(u);const o=makeEnemy('raider',8,10,'under',6,hard,'loyalist');u.enemies.push(o);u.reveal();
 assert.notDeepEqual(disarmSpot(u,ue),{x:8,y:10},'not under a unit');
 // The shot that kills you knocks nothing.
 const k=field(),kp=k.player,kf=marksman(k);round(k,kf);kp.hp=1;round(k,kf);assert.ok(kp.hp<=0);assert.equal(knocked(k).length,0);
});

test('at most once every five rounds; dropped when it is pinned, stunned, moved or falls',()=>{
 // Each knocked weapon goes straight back into the pack (as if picked up), so it always has one to aim at.
 const g=field(),p=g.player,e=marksman(g);
 const aims=[];for(let r=0;r<14;r++){const had=Boolean(e.disarmIntent);round(g,e);if(!had&&e.disarmIntent)aims.push(g.turn);for(const w of knocked(g))p.owned.push(w.slot);g.items=g.items.filter(i=>i.type!=='weapon');}
 assert.ok(aims.length>=2,`${aims}`);for(let i=1;i<aims.length;i++)assert.equal(aims[i]-aims[i-1],T.disarmCooldown,`${aims}`);
 for(const [why,hit] of [['pinned',e=>{e.suppression=3;}],['stunned',e=>{e.control={disabled:1,immune:0};}],['moved',e=>{e.x=14;}],['dead',e=>{e.hp=0;}]]){
  const k=field(),f=marksman(k);round(k,f);assert.ok(f.disarmIntent);hit(f);k.reveal();k.turn++;tickDisarms(k);k.enemyAct(f);
  assert.equal(f.disarmIntent,undefined,why);assert.equal(knocked(k).length,0,why);
 }
 // Pinned after the round start (your suppressive fire mid-round): the shot is dropped, not fired.
 const m=field(),h=marksman(m);round(m,h);h.suppression=3;m.enemyAct(h);assert.equal(knocked(m).length,0);assert.equal(m.player.hp,999);
});

test('where it lands: away from the shooter, never on a wall, pit or hazard; your own tile when boxed in',()=>{
 // Acid on the tile straight behind you (the farthest from it): the next farthest, (9,9) before (9,11) in reading order.
 const g=field(),e=marksman(g);g.hazards.push({x:8,y:10,type:'acid'});g.reveal();
 assert.deepEqual(disarmSpot(g,e),{x:9,y:9});
 for(let y=8;y<=12;y++)for(let x=8;x<=12;x++)if(x!==10||y!==10)g.grid[y][x]=0;g.reveal();
 assert.deepEqual(disarmSpot(g,e),{x:10,y:10},'boxed in');
});

test('saves: the aim and the cooldown round-trip; a stale aim is dropped, a malformed one refused, a long cooldown cut',()=>{
 assert.ok(ORDER.ids.includes('disarm')&&ORDER.top.includes('disarm'));
 const g=field(),e=marksman(g);round(g,e);g.rng=new Game(1,[],0,'soldier','onyx').rng;
 const raw=g.serialize(),back=Game.restore(raw);assert.ok(back);
 assert.deepEqual(back.enemies.find(x=>x.id==='dz').disarmIntent,e.disarmIntent);
 const tamper=fn=>{const d=JSON.parse(raw);fn(d.data.enemies.find(x=>x.id==='dz'));return Game.restore(JSON.stringify(d));};
 const moved=tamper(x=>{x.x=14;});assert.ok(moved);assert.equal(moved.enemies.find(x=>x.id==='dz').disarmIntent,undefined);
 for(const [why,fn] of [['not an object',x=>{x.disarmIntent='aim';}],['extra keys',x=>{x.disarmIntent.tile={x:1,y:1};}],['on a unit without the affix',x=>{x.affixes=x.affixes.filter(a=>a.id!=='disarm');}],['a fractional cooldown',x=>{x.disarmCooldown=1.5;}]])
  assert.equal(tamper(fn),null,why);
 const cut=tamper(x=>{delete x.disarmIntent;x.disarmCooldown=40;});assert.ok(cut);assert.equal(cut.enemies.find(x=>x.id==='dz').disarmCooldown,T.disarmCooldown);
 // A knocked weapon on the floor saves as any dropped weapon.
 const k=field(),f=marksman(k);round(k,f);round(k,f);k.rng=new Game(1,[],0,'soldier','onyx').rng;const kb=Game.restore(k.serialize());
 assert.ok(kb);assert.deepEqual(knocked(kb).map(i=>i.slot),knocked(k).map(i=>i.slot));
});

test('only when you are the target of its turn; a decoy waits for the warned shot',()=>{
 const g=field(),e=marksman(g,'rifleman',15,12);const drone=addAlly(g,'drone','drone',{point:{x:15,y:14},sourceId:'drone_follow'});assert.ok(drone);g.reveal();
 assert.ok(g.shotClear(e,drone));round(g,e);assert.equal(e.disarmIntent,undefined,'it takes on the drone in the open beside it');
 assert.equal(specialDef('disarm').blocks.decoy,true);
});
