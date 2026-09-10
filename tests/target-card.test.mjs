import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,makeEnemy} from '../src/engine.js';
import {targetDetails,targetCardPlacement,actorObstacle} from '../src/target-card.js';
import {Renderer} from '../src/renderer.js';

function arena(){const g=new Game(51);g.barriers=[];g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));Object.assign(g.player,{x:10,y:10});g.enemies=[];g.items=[];g.props=[];g.hazards=[];g.marks=[];g.reveal();return g;}
test('target card reports actual health, shot chance, distance, cover and target state',()=>{
  const g=arena(),e=makeEnemy('rifleman',14,10,'e');g.enemies=[e];g.props=[{x:13,y:10,type:'cover',hp:65,maxHp:65}];g.reveal();
  let details=targetDetails(g);assert.equal(details.name,'斷訊槍兵');assert.equal(details.hp,'HP 22 / 22');assert.equal(details.chance,'命中 70%');assert.equal(details.cover,'箱體掩護');assert.equal(details.distance,'距離 4 格\n射程 7 格');
  e.moved=true;e.charge=true;details=targetDetails(g);assert.equal(details.chance,'命中 48%');assert.match(details.state,/移動中/);assert.match(details.state,/即將攻擊/);
  e.x=19;g.reveal();details=targetDetails(g);assert.equal(details.withinRange,false);assert.equal(details.chance,'無法射擊');assert.match(details.state,/超出射程/);
  g.enemies=[];g.target=null;assert.equal(targetDetails(g),null);
});
test('destructible targets show health without claiming enemy cover or movement',()=>{
  const g=arena();g.props=[{id:'barrel',type:'barrel',x:11,y:10,hp:18,maxHp:18}];g.target='barrel';const d=targetDetails(g);assert.equal(d.name,'爆裂油桶');assert.equal(d.hp,'HP 18 / 18');assert.equal(d.cover,'可破壞物');assert.equal(d.chance,'命中 99%');
});
test('target cards use only three corners, stay inside viewport edges and keep the target clear',()=>{
  for(const side of [262,320,388,480])for(const target of [{x:20,y:20},{x:side-20,y:20},{x:20,y:side-20},{x:side-20,y:side-20},{x:side/2+35,y:side/2}]){
    const player={x:side/2,y:side/2},p=targetCardPlacement({target,player,tile:32,width:side,height:side,cardWidth:160,cardHeight:94});
    assert.ok(p);assert.ok(['top-right','bottom-right','bottom-left'].includes(p.corner));assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=side&&p.y+p.h<=side);
    for(const point of [target])assert.ok(!(point.x>=p.x&&point.x<=p.x+p.w&&point.y>=p.y&&point.y<=p.y+p.h),JSON.stringify({side,target,p}));
  }
});
test('waiting combines reduction, evasion and next-shot aim, without stacking or spending on invalid input',()=>{
  const g=arena(),e=makeEnemy('rifleman',14,10,'e');e.charge=true;e.windup=1;g.enemies=[e];g.reveal();g.rng=Object.assign(()=>0,{state:()=>0});
  g.action('wait');assert.equal(g.player.hp,90);assert.equal(g.accuracy(e,g.player).chance,82);assert.equal(g.accuracy(g.player,e).chance,99);
  const turn=g.turn;assert.equal(g.action('move',[1,1]),false);assert.equal(g.turn,turn);assert.equal(g.player.guard,true);
  g.action('wait');assert.equal(g.player.hp,80);assert.equal(g.player.guard,true);
  const restored=Game.restore(g.serialize());assert.equal(restored.player.guard,true);assert.equal(restored.player.evasive,true);assert.equal(restored.player.focus,true);
  restored.action('move',[0,1]);assert.equal(restored.player.guard,false);assert.equal(restored.player.focus,false);assert.equal(restored.player.evasive,false);
});
test('waiting reduction does not carry into the next player grenade and does not protect against fire',()=>{
  const g=arena();g.action('wait');g.action('grenade',{x:10,y:10});assert.equal(g.player.hp,45);assert.equal(g.player.guard,false);
  const other=arena();other.hazards=[{x:10,y:10,type:'fire'}];other.action('wait');assert.equal(other.player.hp,88);assert.equal(other.player.guard,true);
});

test('dense layouts keep the target clear but may overlap other enemies in one of the three corners',()=>{
  const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  let shown=0,omitted=0;
  for(const width of [128,200,262,320,480])for(const tile of [16,32,45,72])for(let seed=0;seed<20;seed++){
    const fallbackActors=seed%2===0;
    const target={x:width*.7,y:width*.5},player={x:width/2,y:width/2};
    const blockers=Array.from({length:seed},(_,i)=>actorObstacle({x:(i*83+seed*31)%width,y:(i*47+seed*17)%width},tile,fallbackActors));
    const card=targetCardPlacement({target,player,tile,width,height:width,cardWidth:120,cardHeight:78,blockers,fallbackActors});
    if(!card){omitted++;continue;}shown++;
    assert.ok(card.x>=5&&card.y>=5&&card.x+card.w<=width-5&&card.y+card.h<=width-5);
    assert.equal(overlaps(card,actorObstacle(target,tile,fallbackActors)),false);assert.ok(['top-right','bottom-right','bottom-left'].includes(card.corner));
  }
  assert.ok(shown>0);assert.ok(omitted>0);
  assert.equal(targetCardPlacement({target:{x:64,y:64},player:{x:32,y:32},tile:32,width:128,height:128,cardWidth:120,cardHeight:200}),null,'never clamp the measured height and accidentally overflow into enemies');
});

test('renderer invalidates placement when camera moves and rounds measured card bounds outward',()=>{
  const game=arena();game.enemies=[makeEnemy('rifleman',14,10,'e')];game.reveal();
  const attributes=new Map(),link={setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k)};
  const card={hidden:false,style:{},classList:{toggle(){}},getBoundingClientRect:()=>({height:77.4})};
  const renderer=Object.assign(Object.create(Renderer.prototype),{game,w:320,h:320,tile:32,camera:{x:10,y:10},sprites:{complete:true,naturalWidth:128},targetUI:{card,link,path:link,dirty:true}});
  renderer.placeTargetCard();const frame=renderer.targetUI.frame;
  assert.equal(renderer.targetUI.height,78);assert.equal(card.style.visibility,'visible');
  renderer.camera.x=11;renderer.placeTargetCard();assert.notEqual(renderer.targetUI.frame,frame);
  renderer.h=64;renderer.placeTargetCard();assert.equal(card.style.visibility,'hidden');assert.ok(attributes.has('hidden'));
  renderer.h=320;renderer.placeTargetCard();assert.equal(card.style.visibility,'visible');assert.equal(attributes.has('hidden'),false);
});

test('corner choice prioritizes clear target, then fewest enemies, then least enemy overlap',()=>{
  const args={target:{x:160,y:160},player:{x:120,y:160},tile:32,width:320,height:320,cardWidth:100,cardHeight:80};
  assert.equal(targetCardPlacement(args).corner,'top-right');
  const top={x:215,y:5,w:100,h:80},right={x:215,y:235,w:100,h:80},left={x:5,y:235,w:100,h:80};
  assert.equal(targetCardPlacement({...args,blockers:[top]}).corner,'bottom-right');
  assert.equal(targetCardPlacement({...args,blockers:[top,right]}).corner,'bottom-left');
  const crowded=targetCardPlacement({...args,blockers:[top,top,right,left]});assert.equal(crowded.corner,'bottom-right');assert.equal(crowded.rank[0],1);
  assert.equal(targetCardPlacement({...args,blockers:[top,right,{...left,w:10}]}).corner,'bottom-left');
  assert.equal(targetCardPlacement({...args,target:{x:265,y:45},blockers:[right,left]}).corner,'bottom-right','target exclusion outranks avoiding every other enemy');
});
test('equally clear corners retain previous position and bottom candidates leave room for map controls',()=>{
  const args={target:{x:160,y:160},player:{x:120,y:160},tile:32,width:320,height:320,cardWidth:100,cardHeight:80};
  assert.equal(targetCardPlacement({...args,previousCorner:'bottom-left'}).corner,'bottom-left');
  const card=targetCardPlacement({...args,previousCorner:'bottom-left',bottomInset:44});assert.equal(card.y+card.h,271);assert.ok(card.link.x>=card.x&&card.link.x<=card.x+card.w);assert.ok(card.link.y>=card.y&&card.link.y<=card.y+card.h);
});

test('equally unobstructed cards prefer the shortest connector over an old far corner',()=>{
  const args={player:{x:160,y:160},tile:32,width:320,height:400,cardWidth:100,cardHeight:80,bottomInset:44};
  for(const [target,corner]of [[{x:180,y:50},'top-right'],[{x:180,y:325},'bottom-right'],[{x:140,y:325},'bottom-left']]){
    const card=targetCardPlacement({...args,target,previousCorner:corner==='top-right'?'bottom-left':'top-right'});
    assert.equal(card.corner,corner);
  }
  const target={x:140,y:325},near={x:5,y:271,w:100,h:80};
  assert.equal(targetCardPlacement({...args,target,blockers:[near]}).corner,'bottom-right','avoiding an enemy still takes priority over a shorter line');
});
