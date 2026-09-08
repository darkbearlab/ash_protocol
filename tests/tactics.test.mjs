import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,combatSight,lineOfSight,makeEnemy,generate,ENEMY_TYPES,random} from '../src/engine.js';

function arena(seed=7){const g=new Game(seed);g.grid=Array.from({length:SIZE},()=>Array(SIZE).fill(1));g.player.x=10;g.player.y=10;g.props=[];g.items=[];g.hazards=[];g.marks=[];g.enemies=[];g.reveal();return g;}
function elbow(){const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(0));for(let x=1;x<=5;x++)grid[3][x]=1;for(let y=3;y<=8;y++)grid[y][5]=1;return grid;}

test('a corner permits reciprocal leaning and shooting, not movement through walls',()=>{
  const grid=elbow(),a={x:4,y:3},b={x:5,y:6};
  assert.equal(lineOfSight(grid,a,b),false);assert.equal(combatSight(grid,a,b),true);assert.equal(combatSight(grid,b,a),true);
  const g=arena();g.grid=grid;Object.assign(g.player,a);const enemy=makeEnemy('gunner',b.x,b.y,'e');g.enemies=[enemy];g.reveal();
  assert.equal(g.visibleEnemies.length,1);assert.equal(g.protectingCover(g.player,enemy)?.type,'wall');
  assert.equal(g.action('move',[0,1]),false);g.target=enemy.id;assert.equal(g.action('fire'),true);
});
test('thick walls, sealed partitions and diagonally touching walls remain opaque',()=>{
  const g=arena();for(let y=0;y<SIZE;y++){g.grid[y][12]=0;g.grid[y][13]=0;}
  assert.equal(combatSight(g.grid,{x:11,y:10},{x:14,y:10}),false);
  const grid=elbow();grid[3][5]=0;assert.equal(combatSight(grid,{x:4,y:3},{x:5,y:4}),false);
});
test('corner visibility is symmetric across randomized pairs',()=>{
  const r=random(33);for(let seed=1;seed<=10;seed++){const map=generate(seed,1),floor=[];map.grid.forEach((row,y)=>row.forEach((v,x)=>{if(v===1)floor.push({x,y});}));
    for(let i=0;i<150;i++){const a=floor[Math.floor(r()*floor.length)],b=floor[Math.floor(r()*floor.length)];assert.equal(combatSight(map.grid,a,b),combatSight(map.grid,b,a),JSON.stringify({seed,a,b}));}}
});
test('hit chances are shared: 97% exposed, 75% moving, 62% crate, 40% moving behind crate',()=>{
  const g=arena(),a={x:14,y:10},p=g.player;
  assert.equal(g.accuracy(a,p).chance,97);p.moved=true;assert.equal(g.accuracy(a,p).chance,75);
  g.props=[{x:11,y:10,type:'cover',hp:65,maxHp:65}];p.moved=false;assert.equal(g.accuracy(a,p).chance,62);p.moved=true;assert.equal(g.accuracy(a,p).chance,40);
  const enemy=makeEnemy('rifleman',10,10,'mirror');enemy.moved=true;assert.equal(g.accuracy(a,enemy).chance,g.accuracy(a,p).chance);
});
test('wall protection is directional and cannot be damaged',()=>{
  const g=arena();g.grid[10][11]=0;const before=JSON.stringify(g.grid),from={x:14,y:9};
  assert.equal(g.accuracy(from,g.player).chance,55);g.damagePlayer(40,'test',from);assert.equal(g.player.hp,78);
  assert.equal(JSON.stringify(g.grid),before);assert.equal(g.protectingCover(g.player,{x:6,y:10}),undefined);
});
test('a miss consumes a bullet and a turn, creates MISS feedback, and deals no damage',()=>{
  const g=arena(),e=makeEnemy('brute',14,10,'e');g.enemies=[e];g.target=e.id;g.rng=()=>.999;
  assert.equal(g.action('fire'),true);assert.equal(g.player.ammo[0],7);assert.equal(g.turn,2);assert.equal(e.hp,e.maxHp);assert.ok(g.effects.some(e=>e.miss));
});
test('enemy movement lasts until its next action, player movement only during current enemy phase',()=>{
  const g=arena();const enemy=makeEnemy('crawler',15,10,'e');g.enemies=[enemy];g.reveal();g.action('move',[0,-1]);
  assert.equal(g.player.moved,true);assert.equal(enemy.moved,true);assert.equal(g.accuracy(g.player,enemy).movePenalty,22);
  g.action('wait');assert.equal(g.player.moved,false);
});
test('new riflemen are fragile, predominantly ranged, and rapidly sustain fire',()=>{
  const map=generate(10,2),ranged=map.enemies.filter(e=>ENEMY_TYPES[e.type].range>1);
  assert.ok(ranged.length/map.enemies.length>.7);assert.ok(map.enemies.length>=25);
  const g=arena();const enemy=makeEnemy('rifleman',14,10,'e');g.enemies=[enemy];g.reveal();g.rng=()=>0;
  g.action('wait');assert.equal(g.player.hp,100);g.action('wait');const hp=g.player.hp;g.action('wait');assert.ok(g.player.hp<hp);assert.ok(enemy.hp<=22);
});
test('careless exposed squads kill quickly; shelter materially improves survival',()=>{
  const outcomes=[];
  for(const sheltered of[false,true]){let dead=0,hp=0;for(let seed=1;seed<=100;seed++){
    const g=arena(seed);g.rng=random(seed);g.enemies=[makeEnemy('rifleman',14,9,'a'),makeEnemy('rifleman',14,10,'b'),makeEnemy('rifleman',14,11,'c')];
    if(sheltered)g.grid[10][11]=0;g.reveal();for(let turn=0;turn<4&&g.status==='playing';turn++)g.action('wait');
    dead+=Number(g.status==='dead');hp+=g.player.hp;
  }outcomes.push({dead,hp:hp/100});}
  assert.ok(outcomes[0].dead>=90,JSON.stringify(outcomes));assert.ok(outcomes[1].dead<=10,JSON.stringify(outcomes));assert.ok(outcomes[1].hp-outcomes[0].hp>=40,JSON.stringify(outcomes));
});
test('new maps have internal corners and multiple shelters, with six-floor compatibility',()=>{
  const map=generate(3,1);assert.ok(map.props.filter(p=>p.type==='cover').length>=18);
  assert.ok(map.rooms.slice(1).some(r=>map.grid[r.cy-1][r.cx+1]===0));
  const g=new Game(5),save=JSON.parse(g.serialize());save.version=2;delete save.data.player.moved;const restored=Game.restore(JSON.stringify(save));assert.ok(restored);assert.equal(restored.player.moved,false);
});
