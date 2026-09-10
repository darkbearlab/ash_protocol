import {allSupplies} from '../src/containers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy,ENEMY_TYPES} from '../src/engine.js';
import {activeTrait,grantTrait} from '../src/traits.js';
import {GRENADES,grenadeTotal,applyDisruption,areaCells} from '../src/throwables.js';
import {captureAction,planPresentation} from '../src/presentation.js';
import {makeBackup,decodeBackup} from '../src/backup.js';
import {normalizeProfile} from '../src/progression.js';

function arena(character='soldier'){
  const g=new Game(315,[],0,character);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));
  Object.assign(g.player,{x:10,y:10,grenades:0,hp:500,maxHp:500});
  g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.rooms=[];
  g.rng=Object.assign(()=>0,{state:()=>0});g.reveal();return g;
}
function enemy(g,type='rifleman',x=14,y=10){const e=makeEnemy(type,x,y,`${type}-${g.enemies.length}`);e.hp=e.maxHp=500;e.alert=true;e.charge=true;e.windup=1;g.enemies.push(e);g.reveal();return e;}
function equip(g,id){g.player[GRENADES[id].resource]++;g.action('prepare',{category:'grenade',id});}
const toss=(g,x=14,y=10)=>g.action('usePrepared',{category:'grenade',target:{x,y}});

test('body keywords classify all starters and enemies; both can coexist without implicit traits',()=>{
  for(const id of ['soldier','recon','bulwark']){const p=arena(id).player;assert.ok(activeTrait(p,'biological'));assert.equal(activeTrait(p,'mechanical'),false);}
  for(const type of Object.keys(ENEMY_TYPES)){const e=makeEnemy(type,1,1,'body');assert.equal(activeTrait(e,'mechanical'),['drone','warden','boss'].includes(type));assert.equal(activeTrait(e,'biological'),!['drone','warden','boss'].includes(type));}
  const p={traits:[]};grantTrait(p,'biological','test');grantTrait(p,'mechanical','test');assert.ok(activeTrait(p,'biological')&&activeTrait(p,'mechanical'));assert.equal(activeTrait(p,'large'),false);
});
test('plasma reactions follow mechanical keyword, even on a different species',()=>{
  const g=arena(),e=enemy(g);g.player.owned.push(4);g.player.weapon=4;e.traits=[];
  g.hitTarget(e,20,g.player);assert.equal(e.hp,480);grantTrait(e,'mechanical','test');g.hitTarget(e,20,g.player);assert.equal(e.hp,456);
  const d=enemy(g,'drone');d.traits=[];g.hitTarget(d,20,g.player);assert.equal(d.hp,480);
});
test('EMP hits machines only and stun hits biology only; neither damages HP, cover or barrels',()=>{
  for(const [id,type,other]of [['emp','drone','rifleman'],['stun','rifleman','drone']]){
    const g=arena(),a=enemy(g,type),b=enemy(g,other,14,11);g.props=[{type:'barrel',id:'barrel',x:15,y:10,hp:18}];equip(g,id);
    assert.ok(toss(g));assert.equal(a.control.disabled,1);assert.equal(a.charge,false);assert.equal(b.control.disabled,0);assert.equal(a.hp,500);assert.equal(b.hp,500);assert.equal(g.props[0].hp,18);assert.equal(g.player[GRENADES[id].resource],0);assert.equal(g.player.stats.grenades,1);
    assert.equal(g.effects.some(f=>f.type==='blast'),false);
  }
});
test('two lost opportunities are preserved across every player and enemy speed combination',()=>{
  for(const ps of [null,'fast','slow'])for(const es of [null,'fast','slow']){
    const g=arena(),e=enemy(g,'drone');if(ps)grantTrait(g.player,ps,'test');if(es)grantTrait(e,es,'test');
    let acts=0;g.enemyAct=()=>acts++;equip(g,'emp');toss(g);g.action('wait');g.action('wait');g.action('wait');
    assert.equal(acts,2,`${ps}/${es}`);assert.equal(e.control.disabled,0);
  }
});
test('recovery immunity prevents refreshing, including alternating EMP and stun on a cyborg',()=>{
  const g=arena(),e=enemy(g,'drone');grantTrait(e,'biological','test');assert.ok(applyDisruption(e,'mechanical'));
  assert.equal(applyDisruption(e,'biological'),false);g.action('wait');g.action('wait');assert.deepEqual(e.control,{disabled:0,immune:2});
  for(const remaining of [1,0]){assert.equal(applyDisruption(e,'biological'),false);g.action('wait');assert.equal(e.control.immune,remaining);}
  assert.ok(applyDisruption(e,'biological'));
});
test('bosses lose one opportunity and previously marked bombardments are not cancelled',()=>{
  for(const type of ['warden','boss']){const g=arena(),e=enemy(g,type);g.marks=[{x:10,y:10,due:2}];equip(g,'emp');toss(g);assert.deepEqual(e.control,{disabled:0,immune:2});assert.equal(e.charge,false);assert.ok(g.player.hp<500);assert.ok(g.effects.some(f=>f.type==='blast'));}
});
test('self-stun requires paid waits, cancels defensive bonuses, and cannot softlock a Recon',()=>{
  const g=arena('recon');g.player.ammo[2]=1;equip(g,'stun');assert.ok(toss(g,10,10));assert.equal(g.player.control.disabled,2);assert.equal(g.player.hp,500);
  const before=g.turn;assert.equal(g.action('reload'),false);assert.ok(g.action('prepare',{category:'grenade',id:'smoke'}));assert.equal(g.turn,before);
  for(const remaining of [1,0]){assert.ok(g.action('wait'));assert.equal(g.player.control.disabled,remaining);assert.equal(g.player.guard,false);}
  assert.ok(g.action('reload'));assert.equal(g.turn,before+2);assert.ok(g.player.ammo[2]>1);
});
test('disruption prevents execution, but smoke before the player phase still spends committed ammunition',()=>{
  const g=arena(),e=enemy(g);grantTrait(e,'fast','test');const mag=g.player.ammo[0];g.enemyAct=()=>applyDisruption(g.player,'biological');
  assert.ok(g.action('fire'));assert.equal(g.player.ammo[0],mag);assert.equal(g.turn,2);assert.equal(g.player.control.disabled,1);
  const fog=arena(),hider=enemy(fog);grantTrait(hider,'fast','test');fog.enemyAct=()=>{fog.smoke=[{cells:areaCells(fog.grid,{x:12,y:10}),expires:fog.turn+2}];};
  const ammo=fog.player.ammo[0];assert.ok(fog.action('fire'));assert.equal(fog.player.ammo[0],ammo-1);assert.equal(hider.hp,500);assert.ok(fog.effects.some(f=>f.type==='shot'&&f.miss));
});
test('blast footprints respect walls, with no disable or smoke leaking through a solid partition',()=>{
  const g=arena(),e=enemy(g,'drone',14,10);for(let y=0;y<SIZE;y++)g.grid[y][13]=0;equip(g,'emp');g.reveal();assert.ok(toss(g,12,10));assert.equal(e.control.disabled,0);
  assert.equal(areaCells(g.grid,{x:12,y:10}).some(p=>p.x>=14),false);
});
test('smoke blocks symmetric sight and adjacency still works, with wall corners preserved',()=>{
  const g=arena(),e=enemy(g,'rifleman',15,10);equip(g,'smoke');assert.ok(toss(g,13,10));
  assert.equal(g.visible(e),false);assert.equal(g.sight(e,g.player),false);assert.equal(g.targeted,undefined);
  for(let y=8;y<=12;y++)for(let x=9;x<=17;x++){const a={x,y};assert.equal(g.sight(g.player,a),g.sight(a,g.player));}
  assert.equal(g.sight({x:12,y:10},{x:13,y:10}),true);assert.equal(g.sight({x:12,y:10},{x:14,y:10}),false);
  g.grid[10][12]=0;assert.equal(g.sight({x:12,y:10},{x:13,y:10}),false);
});
test('smoke lasts casting round plus four paid rounds, survives free actions and creates no damage reduction',()=>{
  const g=arena('recon');equip(g,'smoke');toss(g,10,10);const expiry=g.smoke[0].expires;g.player.ammo[2]=1;
  assert.ok(g.action('reload'));g.action('prepare',{category:'grenade',id:'emp'});assert.equal(g.smoke[0].expires,expiry);assert.equal(g.turn,2);
  const hp=g.player.hp;g.explode(g.player,1,20);assert.equal(g.player.hp,hp-20);
  for(let i=0;i<3;i++){g.action('wait');assert.equal(g.smoke.length,1);}g.action('wait');assert.equal(g.smoke.length,0);
});
test('ordinary shooters stop tracking live coordinates through smoke; a sniper keeps its marked shot',()=>{
  const g=arena(),e=enemy(g);equip(g,'smoke');toss(g,12,10);assert.equal(g.effects.some(f=>f.type==='enemyShot'),false);const last={...e.lastKnown};
  g.action('move',[0,1]);assert.deepEqual(e.lastKnown,last);
  const s=arena(),sniper=enemy(s,'sniper');sniper.aim={x:10,y:10};equip(s,'smoke');const hp=s.player.hp;toss(s,12,10);assert.ok(s.player.hp<hp);assert.ok(s.effects.some(f=>f.type==='enemyShot'));
  const interrupted=arena(),aim=enemy(interrupted,'sniper');aim.aim={x:10,y:10};equip(interrupted,'stun');toss(interrupted);assert.equal(aim.aim,null);assert.equal(interrupted.effects.some(f=>f.type==='enemyShot'),false);
});
test('all grenade stocks share upgradeable capacity, and overflow keeps its original type',()=>{
  const g=arena();for(const id of Object.keys(GRENADES))assert.equal(g.receiveGrenade(id,1),1);assert.equal(grenadeTotal(g.player),4);
  assert.equal(g.receiveGrenade('emp',2),0);assert.equal(g.items.find(i=>i.type==='emp').amount,2);
  g.setCarryLevel({grenade:2});g.pickup();assert.equal(g.player.emp,3);assert.equal(grenadeTotal(g.player),6);assert.equal(g.items.length,0);
  g.setCarryLevel(0);assert.equal(grenadeTotal(g.player),4);assert.equal(g.items.reduce((n,i)=>n+i.amount,0),2);
  const restored=Game.restore(g.serialize());assert.ok(restored);assert.deepEqual(restored.player,g.player);assert.deepEqual(restored.items,g.items);
});
test('each utility has a reachable floor cache and terminal purchase rejects full inventory for free',()=>{
  for(let floor=1;floor<=6;floor++){const g=new Game(315);g.floor=floor;g.loadFloor();for(const id of ['smoke','emp','stun']){const item=allSupplies(g).find(i=>i.type===id);assert.ok(item);assert.ok(g.passable(item.x,item.y));}}
  for(const id of ['smoke','emp','stun']){const g=arena();g.props=[{type:'terminal',x:10,y:11,used:false}];g.player.scrap=50;assert.ok(g.action('terminal',id));assert.equal(g.player[id],1);assert.equal(g.player.scrap,50-GRENADES[id].cost);g.props[0].used=false;g.player.grenades=3;const turn=g.turn;assert.equal(g.action('terminal',id),false);assert.equal(g.turn,turn);assert.equal(g.props[0].used,false);}
});
test('new fields roundtrip through full backup; legacy v11 receives tags but preserves its campaign',()=>{
  const g=arena(),e=enemy(g,'drone');equip(g,'smoke');toss(g,12,10);applyDisruption(e,'mechanical');
  const restored=decodeBackup(JSON.stringify(makeBackup(g,normalizeProfile(),'qa')),'qa').game;
  assert.deepEqual(restored.smoke,g.smoke);assert.deepEqual(restored.player,g.player);assert.deepEqual(restored.enemies,g.enemies);
  const old=JSON.parse(arena('bulwark').serialize());old.version=11;delete old.data.smoke;for(const k of ['control','smoke','emp','stun'])delete old.data.player[k];old.data.player.traits=old.data.player.traits.filter(t=>t.id!=='biological');old.data.player.ammo[6]=7;
  const migrated=Game.restore(JSON.stringify(old));assert.ok(migrated);assert.equal(migrated.player.ammo[6],7);assert.equal(migrated.player.character,'bulwark');assert.ok(activeTrait(migrated.player,'biological'));assert.equal(migrated.player.hp,500);
  const full=JSON.parse(arena().serialize());full.version=11;full.data.player.traits=Array.from({length:64},(_,i)=>({id:'fast',source:`old:${i}`}));const preserved=Game.restore(JSON.stringify(full));assert.ok(preserved);assert.equal(preserved.player.traits.length,65);assert.ok(activeTrait(preserved.player,'biological'));
  for(const mutate of [d=>d.player.control.disabled=99,d=>delete d.player.control,d=>d.player.control.immune=1,d=>d.player.emp=-1,d=>d.smoke[0].cells[0].x=-9,d=>d.smoke[0].expires=9999,d=>d.enemies[0].lastKnown={x:-1,y:0}]){const bad=JSON.parse(g.serialize());mutate(bad.data);if(bad.data.player.control?.immune===1)bad.data.player.control.disabled=1;assert.equal(Game.restore(JSON.stringify(bad)),null);}
});
test('utility visuals arrive before smoke/status changes, and descending clears floor-local effects',()=>{
  const g=arena();equip(g,'smoke');const {steps}=captureAction(g,()=>toss(g,12,10));const plan=planPresentation(steps);
  assert.equal(plan.events[0].state.smoke.length,0);assert.equal(plan.events[1].state.smoke.length,1);assert.ok(plan.events[1].time>0);assert.ok(plan.events[1].effects.some(e=>e.type==='pulse'));
  g.end={x:10,y:10};assert.ok(g.action('interact'));assert.equal(g.floor,2);assert.deepEqual(g.smoke,[]);assert.deepEqual(g.player.control,{disabled:0,immune:0});
});
