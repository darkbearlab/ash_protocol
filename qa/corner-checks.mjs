// Independent verification of 3.70.0 corner exposure (Claude). Not committed.
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {makeEnemy,key} from '../src/world.js';
import {clearGeneratedMap} from '../tests/helpers/arena.mjs';
import {cornerRay,CORNER_TURNS} from '../src/corner.js';
import {SAVE_VERSION} from '../src/data.js';

let pass=0,fail=0;
const check=(name,fn)=>{try{fn();pass++;console.log('  ok  '+name);}catch(e){fail++;console.log('  FAIL '+name+' :: '+e.message);}};

function arena(character='soldier'){
  const g=new Game(1,[],0,character);clearGeneratedMap(g);
  g.grid=Array.from({length:27},(_,y)=>Array.from({length:27},(_,x)=>x&&y&&x<26&&y<26?1:0));
  for(const k of ['props','barriers','items','hazards','marks','smoke','traces','rooms','enemies','allies'])g[k]=[];
  g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
  g.start={x:2,y:2};g.end={x:23,y:23};Object.assign(g.player,{x:9,y:10});
  g.rng=Object.assign(()=>.99,{state:()=>7});g.reveal();return g;
}
const foe=(g,x,y,type='rifleman')=>{const e=makeEnemy(type,x,y,'qa-'+g.enemies.length,g.floor);e.alert=true;g.enemies.push(e);return e;};

// --- brute-force a real corner: centre-to-centre blocked, but both still see each other
const SHAPES=[
  {name:'L 角', cells:[[0,0],[1,0],[2,0],[0,1],[0,2]]},
  {name:'短牆', cells:[[0,0],[1,0],[2,0]]},
  {name:'柱',   cells:[[0,0]]},
  {name:'T',    cells:[[0,0],[1,0],[2,0],[1,1]]},
];
let FOUND=null;
function cornerCase(){
  if(FOUND){
    const g=arena();
    for(const [dx,dy]of FOUND.cells)g.grid[FOUND.wy+dy][FOUND.wx+dx]=0;
    g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
    Object.assign(g.player,FOUND.p);g.enemies=[];foe(g,FOUND.e.x,FOUND.e.y);g.reveal();
    return {g,e:g.enemies[0]};
  }
  const wx=12,wy=12;
  for(const shape of SHAPES){
    const g=arena();
    for(const [dx,dy]of shape.cells)g.grid[wy+dy][wx+dx]=0;
    g.lighting=g.grid.map(r=>r.slice());g.seen=g.grid.map(r=>r.map(()=>true));
    const spots=[];
    for(let y=wy-3;y<=wy+4;y++)for(let x=wx-3;x<=wx+4;x++)if(g.grid[y]?.[x]===1)spots.push({x,y});
    for(const p of spots)for(const q of spots){
      if(p.x===q.x&&p.y===q.y)continue;
      Object.assign(g.player,p);g.enemies=[];const en=foe(g,q.x,q.y);g.reveal();
      const st=g.attackStatus(g.player,en);
      if(st.visible&&!st.attackable&&st.reason==='target_corner_hidden'){
        FOUND={wx,wy,cells:shape.cells,p,e:q,shape:shape.name};
        console.log(`geometry: ${shape.name} wall at ${wx},${wy}; player ${p.x},${p.y}; enemy ${q.x},${q.y}`);
        return cornerCase();
      }
    }
  }
  throw new Error('no corner geometry found');
}
const {g,e}=cornerCase();


check('A1 看得到但打不到（目標未暴露）',()=>{
  const st=g.attackStatus(g.player,e);
  assert.equal(st.visible,true);assert.equal(st.attackable,false);
  assert.equal(st.reason,'target_corner_hidden');assert.equal(st.targetExposed,false);
});
check('A2 設計確認：只有一方躲在轉角時，暴露在外的一方仍可被攻擊',()=>{
  const st=g.attackStatus(e,g.player);
  assert.equal(st.visible,true);
  assert.equal(st.attackable,true,'玩家站在開闊處，中心本來就可射');
  assert.equal(st.targetExposed,false,'不是靠暴露探身，而是直接射中心');
});
check('A2b 雙方都躲在轉角後時互相不可攻擊',()=>{
  const g2=arena();
  for(const [dx,dy]of FOUND.cells)g2.grid[FOUND.wy+dy][FOUND.wx+dx]=0;
  g2.lighting=g2.grid.map(r=>r.slice());g2.seen=g2.grid.map(r=>r.map(()=>true));
  const spots=[];
  for(let y=FOUND.wy-3;y<=FOUND.wy+4;y++)for(let x=FOUND.wx-3;x<=FOUND.wx+4;x++)if(g2.grid[y]?.[x]===1)spots.push({x,y});
  let found=null;
  for(const a of spots){for(const b of spots){
    if(a.x===b.x&&a.y===b.y)continue;
    Object.assign(g2.player,a);g2.enemies=[];const en=foe(g2,b.x,b.y);g2.reveal();
    const f=g2.attackStatus(g2.player,en),r=g2.attackStatus(en,g2.player);
    if(f.reason==='target_corner_hidden'&&r.reason==='target_corner_hidden'){found={a,b};break;}
  }if(found)break;}
  assert.ok(found,'應存在雙方互相不可攻擊的轉角對峙');
  console.log(`        對峙點：${found.a.x},${found.a.y} vs ${found.b.x},${found.b.y}`);
});
check('A3 sight() 不受影響：仍然互相看得見',()=>{
  assert.equal(g.sight(g.player,e),true);assert.equal(g.sight(e,g.player),true);
});
check('B1 開火後立刻可被還擊，剩餘回合=CORNER_TURNS',()=>{
  g.recordExposure(e,g.player);
  const st=g.attackStatus(g.player,e);
  assert.equal(st.attackable,true,'exposed target should be attackable');
  assert.equal(st.targetExposed,true);
  assert.equal(st.exposureRemaining,CORNER_TURNS);
});
check('B2 倒數逐回合遞減，到期後恢復不可攻擊',()=>{
  const seen=[];
  for(let i=0;i<=CORNER_TURNS+1;i++){
    const st=g.attackStatus(g.player,e);seen.push([g.turn,st.attackable,st.exposureRemaining]);
    g.turn++;
  }
  assert.equal(seen[0][1],true);
  assert.equal(seen[CORNER_TURNS][1],true,`still attackable at +${CORNER_TURNS}`);
  assert.equal(seen[CORNER_TURNS+1][1],false,`must lapse after +${CORNER_TURNS}`);
});
check('C1 目標換格即清除暴露',()=>{
  const g2=cornerCase().g,e2=g2.enemies[0];
  g2.recordExposure(e2,g2.player);
  assert.equal(g2.attackStatus(g2.player,e2).attackable,true);
  e2.x+=0;e2.y+=1;                                  // moved one tile
  assert.equal(g2.attackStatus(g2.player,e2).attackable,false,'moving must drop the exposure');
});
check('D1 方向各自獨立：朝另一邊開火不抹掉先前暴露',()=>{
  const g3=cornerCase().g,e3=g3.enemies[0];
  g3.recordExposure(e3,g3.player);
  const before=JSON.parse(JSON.stringify(e3.cornerExposure.until));
  const other=foe(g3,e3.x,e3.y+4);
  g3.recordExposure(e3,other);
  for(const d of Object.keys(before))assert.equal(e3.cornerExposure.until[d],before[d],`direction ${d} preserved`);
});
check('E1 非單位目標不受轉角限制（物件仍可射）',()=>{
  const g4=cornerCase().g;
  const prop={id:'qa-barrel',x:g4.enemies[0].x,y:g4.enemies[0].y,type:'barrel',hp:18,maxHp:18};
  g4.enemies=[];g4.props.push(prop);
  assert.equal(cornerRay(g4,g4.player,prop,{tile:true}).clear,true,'tile ray must ignore exposure');
});
check('F1 attackStatus 不消耗亂數',()=>{
  const g5=cornerCase().g;let calls=0;
  g5.rng=Object.assign(()=>{calls++;return .5;},{state:()=>7});
  g5.attackStatus(g5.player,g5.enemies[0]);
  assert.equal(calls,0);
});
check('F2 reason 只出現在文件列出的集合',()=>{
  const g6=cornerCase().g,e6=g6.enemies[0];
  const allowed=new Set([null,'not_visible','target_corner_hidden','blocked']);
  const seen=new Set();
  seen.add(g6.attackStatus(g6.player,e6).reason);
  g6.recordExposure(e6,g6.player);seen.add(g6.attackStatus(g6.player,e6).reason);
  const far=foe(g6,24,24);g6.seen[24][24]=false;seen.add(g6.attackStatus(g6.player,far).reason);
  for(const r of seen)assert.ok(allowed.has(r),`unexpected reason ${r}`);
});
check('G1 存檔往返保留暴露與到期回合',()=>{
  const g7=cornerCase().g,e7=g7.enemies[0];
  g7.recordExposure(e7,g7.player);
  const raw=g7.serialize();
  assert.equal(JSON.parse(raw).version,SAVE_VERSION);
  const back=Game.restore(raw);
  assert.ok(back,'restore must succeed');
  const r=back.enemies.find(x=>x.id===e7.id);
  assert.deepEqual(r.cornerExposure,e7.cornerExposure);
});
check('G2 舊檔（無 cornerExposure）可載入且視為未暴露',()=>{
  const g8=cornerCase().g,e8=g8.enemies[0];
  const parsed=JSON.parse(g8.serialize());
  for(const en of parsed.data.enemies)delete en.cornerExposure;
  delete parsed.data.player.cornerExposure;
  const back=Game.restore(JSON.stringify(parsed));
  assert.ok(back,'old-shaped save must still load');
  const r=back.enemies.find(x=>x.id===e8.id);
  assert.ok(!r.cornerExposure);
  assert.equal(back.attackStatus(back.player,r).attackable,false);
});
check('G3 損毀的暴露資料會被拒絕',()=>{
  const g9=cornerCase().g,e9=g9.enemies[0];
  g9.recordExposure(e9,g9.player);
  const parsed=JSON.parse(g9.serialize());
  parsed.data.enemies.find(x=>x.id===e9.id).cornerExposure={origin:{x:-5,y:'x'},until:{north:'soon'}};
  assert.equal(Game.restore(JSON.stringify(parsed)),null,'invalid exposure must be rejected');
});
check('H1 端到端：探身開火 → 自己被暴露 → 對方可以還擊',()=>{
  const build=()=>{
    const gx=arena();
    for(const [dx,dy]of FOUND.cells)gx.grid[FOUND.wy+dy][FOUND.wx+dx]=0;
    gx.lighting=gx.grid.map(r=>r.slice());gx.seen=gx.grid.map(r=>r.map(()=>true));
    return gx;
  };
  const probe=build();
  const spots=[];
  for(let y=FOUND.wy-3;y<=FOUND.wy+4;y++)for(let x=FOUND.wx-3;x<=FOUND.wx+4;x++)if(probe.grid[y]?.[x]===1)spots.push({x,y});
  let hit=null;
  for(const a of spots){for(const b of spots){
    if(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)>probe.weapon.range)continue;
    Object.assign(probe.player,a);probe.enemies=[];const en=foe(probe,b.x,b.y);probe.reveal();
    const fwd=probe.attackStatus(probe.player,en),back=probe.attackStatus(en,probe.player);
    if(fwd.attackable&&fwd.peekDirection&&back.reason==='target_corner_hidden'){hit={a,b};break;}
  }if(hit)break;}
  assert.ok(hit,'需要一個「玩家探身打得到、對方打不到玩家」的位置');
  const g10=build();Object.assign(g10.player,hit.a);g10.enemies=[];
  const e10=foe(g10,hit.b.x,hit.b.y);g10.reveal();
  assert.equal(g10.attackStatus(e10,g10.player).attackable,false,'開火前對方不能還擊');
  g10.target=e10.id;
  const ok=g10.action('fire');
  assert.ok(ok!==false,'開火應該成立，log='+JSON.stringify(g10.logs.slice(-2)));
  assert.ok(g10.player.cornerExposure,'玩家開火後必須留下暴露方向');
  assert.equal(g10.attackStatus(e10,g10.player).attackable,true,'開火後對方可以還擊');
  console.log(`        玩家 ${hit.a.x},${hit.a.y} 探身射 ${hit.b.x},${hit.b.y}；暴露方向 ${Object.keys(g10.player.cornerExposure.until)}`);
});
check('H1b 互相躲在轉角時雙方都無法開火（僵持只能靠移動解開）',()=>{
  const g12=arena();
  for(const [dx,dy]of FOUND.cells)g12.grid[FOUND.wy+dy][FOUND.wx+dx]=0;
  g12.lighting=g12.grid.map(r=>r.slice());g12.seen=g12.grid.map(r=>r.map(()=>true));
  Object.assign(g12.player,{x:12,y:11});g12.enemies=[];
  const e12=foe(g12,12,15);g12.reveal();
  g12.recordExposure(e12,g12.player);
  assert.ok(!e12.cornerExposure,'射線不通時不應記錄暴露');
  assert.equal(g12.attackStatus(g12.player,e12).attackable,false);
  assert.equal(g12.attackStatus(e12,g12.player).attackable,false);
});
check('H2 暴露只在「用到探身」時記錄：中心直射不留痕跡',()=>{
  const g11=arena();Object.assign(g11.player,{x:10,y:10});g11.enemies=[];
  const e11=foe(g11,10,13);g11.reveal();          // 開闊處，中心直接可射
  g11.target=e11.id;
  const ok=g11.action('fire');
  assert.ok(ok!==false,'開闊處開火應成立，log='+JSON.stringify(g11.logs.slice(-2)));
  assert.ok(!g11.player.cornerExposure,'沒有用到探身就不應記錄暴露');
});
check('SAVE_VERSION 是 34',()=>assert.equal(SAVE_VERSION,34));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
