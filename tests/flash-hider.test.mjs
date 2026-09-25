import {clearGeneratedMap} from './helpers/arena.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {WEAPONS} from '../src/data.js';
import {AFFIXES,weaponStats,rollAffix} from '../src/weapons.js';
import {LIGHT_MODEL,lightAt} from '../src/lighting.js';
import {projectileVisuals} from '../src/presentation.js';

// 3.179.0 (user request 2026-09-25): 消焰, a flash hider for every gun but the shotgun and the plasma rifle — weaker,
// but its shots make no muzzle flash (docs/WEAPONS.md, docs/LIGHTING.md).
const base=id=>WEAPONS.findIndex(w=>w.id===id);
function blackArena(affix){
  const g=new Game(316,[],0,'soldier','onyx');g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.lighting=g.grid.map(r=>r.map(()=>0));
  Object.assign(g,{barriers:[],props:[],items:[],hazards:[],marks:[],smoke:[],enemies:[],allies:[],flares:[],gunFlashes:[]});
  clearGeneratedMap(g);g.lightModel=LIGHT_MODEL;g.lamps=[];
  const p=g.player,slot=p.owned.find(i=>WEAPONS[p.weaponBases?.[i]??i]?.id==='rifle')??0;
  Object.assign(p,{x:10,y:10,weapon:slot});p.affixes[slot]=affix;p.ammo[slot]=8;
  const e=makeEnemy('rifleman',13,10,'e');Object.assign(e,{hp:500,maxHp:500,alert:false});g.enemies.push(e);
  g.glowsticks=[{x:13,y:11}];   // the target stands dim, the shooter in the black
  Object.defineProperty(g,'enemyAct',{value:()=>{},configurable:true});g.reveal();g.target=e.id;return {g,p,e};
}

test('the numbers: −15% base damage, no flash, never on the shotgun or the plasma rifle',()=>{
  assert.equal(AFFIXES.flashhider.damage,.85);assert.equal(AFFIXES.flashhider.noFlash,true);
  assert.deepEqual(AFFIXES.flashhider.notOn,['shotgun','plasma']);assert.equal(AFFIXES.flashhider.dropOnly,undefined,'an ordinary affix');
  const rifle=WEAPONS[base('rifle')],w=weaponStats(base('rifle'),'flashhider');
  assert.deepEqual([w.min,w.max,w.noFlash],[Math.round(rifle.min*.85),Math.round(rifle.max*.85),true]);
  assert.equal(weaponStats(base('rifle'),'stable').noFlash,undefined);
  const seen=new Set();
  for(let seed=0;seed<4000;seed++){
    for(const id of ['shotgun','plasma'])assert.notEqual(rollAffix(base(id),seed),'flashhider',`${id} ${seed}`);
    for(const id of ['rifle','smg','sniper','lmg','launcher'])if(rollAffix(base(id),seed)==='flashhider')seen.add(id);
  }
  assert.deepEqual([...seen].sort(),['launcher','lmg','rifle','smg','sniper'],'every other gun can roll it');
});

test('fired from the black, it leaves your tile black; the same gun without it lights it dim',()=>{
  for(const [affix,level] of [['flashhider',0],[null,1]]){
    const {g,p,e}=blackArena(affix);assert.ok(g.visibleEnemies.includes(e));assert.equal(lightAt(g,p),0);
    assert.ok(g.action('fire'));
    const shots=g.effects.filter(x=>x.type==='shot'&&x.weaponId==='rifle');assert.ok(shots.length>0);
    assert.equal(shots.every(x=>Boolean(x.suppressed)),affix==='flashhider');
    assert.equal(lightAt(g,p),level,`${affix}: the tile it was fired from`);
    assert.equal(g.gunFlashes.length,level,'kept for the reply round, or not at all');
  }
});

test('no flash is drawn for it, and the affix survives a save',()=>{
  const shot={type:'shot',weaponId:'rifle',style:'bullet',from:{x:1,y:1},to:{x:3,y:1},damage:0};
  assert.ok(projectileVisuals(shot).some(v=>v.flash));
  assert.ok(projectileVisuals({...shot,suppressed:true}).every(v=>!v.flash));
  const {g,p}=blackArena('flashhider'),back=Game.restore(g.serialize());assert.ok(back);assert.equal(back.player.affixes[p.weapon],'flashhider');
  assert.equal(back.weapon.noFlash,true);
});
