import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,launchReason} from '../src/game.js';
import {WEAPONS} from '../src/data.js';
import {targetDetails} from '../src/target-card.js';

// A clean lane: flat lit floor, no props or barriers, the player at (5,15).
function lane(base){
 const g=new Game(3,[],0,'soldier',undefined,'extraction'),p=g.player;
 g.grid=g.grid.map(r=>r.map(()=>1));g.props=[];g.barriers=[];g.hazards=[];g.items=[];g.allies=[];g.lighting=g.grid.map(r=>r.map(()=>1));
 p.x=5;p.y=15;
 const slot=p.weaponBases.length;
 p.weaponBases.push(base);p.affixes.push(null);p.upgrades.push(0);p.ammo.push(WEAPONS[base].mag);p.owned=[slot];p.weapon=slot;
 p.reserve=p.ordnance=99;
 return {g,p};
}
const put=(g,x,y,id='t',type='rifleman')=>{const e=g.spawnEnemy(type,x,y,id);g.enemies.push(e);g.reveal();return e;};
const SR07=3,GL03=5,AR09=0;

test('the precision rifle loses accuracy unless the last turn was spent aiming',()=>{
 assert.equal(WEAPONS[SR07].aimPenalty,40);
 const {g,p}=lane(SR07),e=put(g,p.x+6,p.y);g.enemies=[e];g.target=e.id;
 e.moved=true;                                    // a moving target keeps both numbers below the 99 cap
 p.focus=false;const unaimed=g.accuracy(p,e);
 p.focus=true;const aimed=g.accuracy(p,e);
 assert.equal(unaimed.aimPenalty,40);
 assert.equal(aimed.aimPenalty,0);
 assert.equal(aimed.chance-unaimed.chance,40+15,'the wait removes the penalty and adds the usual +15 focus');
 // The card says why.
 p.focus=false;
 assert.match(targetDetails(g).state,/未瞄準 −40/);
});

test('waiting is the aim, and any other action spends it',()=>{
 const {g,p}=lane(SR07),e=put(g,p.x+8,p.y);g.enemies=[e];g.target=e.id;e.moved=true;
 const before=g.accuracy(p,e).chance;
 assert.equal(g.action('wait'),true);
 assert.equal(p.focus,true);
 assert.ok(g.accuracy(p,e).chance>before);
 assert.equal(g.action('reload'),false,'a full magazine refuses, which must not count as aiming either');
 p.ammo[p.weapon]=1;
 assert.equal(g.action('reload'),true);
 assert.equal(p.focus,false,'reloading takes the eye off the scope');
});

test('the penalty is the precision rifle\'s alone',()=>{
 for(const [base,w] of WEAPONS.entries()){
  if(base===SR07||w.melee)continue;
  assert.ok(!w.aimPenalty,`${w.code} has no aim penalty`);
 }
 const {g,p}=lane(AR09),e=put(g,p.x+4,p.y);g.enemies=[e];g.target=e.id;e.moved=true;
 p.focus=false;assert.equal(g.accuracy(p,e).aimPenalty,0);
});

test('the launcher fires at a tile, never rolls to hit, and catches everyone in the blast',()=>{
 assert.equal(WEAPONS[GL03].pointTarget,true);
 const {g,p}=lane(GL03),a=put(g,p.x+4,p.y,'a'),b=put(g,p.x+4,p.y+1,'b');
 g.rng=()=>.9999;                                   // every rolled shot would miss at this value
 const turn=g.turn,hp=[a.hp,b.hp];
 assert.equal(g.action('launch',{x:p.x+4,y:p.y}),true);
 assert.ok(a.hp<hp[0]&&b.hp<hp[1],'both enemies inside radius 1 are hit');
 assert.equal(p.ammo[p.weapon],WEAPONS[GL03].mag-1,'one round');
 assert.equal(g.turn,turn+1,'one turn');
});

test('an empty tile between enemies is a legal and useful target',()=>{
 const {g,p}=lane(GL03),a=put(g,p.x+4,p.y-1,'a'),b=put(g,p.x+4,p.y+1,'b');
 const hp=[a.hp,b.hp];
 assert.equal(g.action('launch',{x:p.x+4,y:p.y}),true,'nobody stands on the aimed tile');
 assert.ok(a.hp<hp[0]&&b.hp<hp[1]);
});

test('the fire command with a launcher lands on the locked enemy\'s tile',()=>{
 const {g,p}=lane(GL03),e=put(g,p.x+5,p.y);g.enemies=[e];g.target=e.id;
 g.rng=()=>.9999;const hp=e.hp;
 assert.equal(g.action('fire'),true);
 assert.ok(e.hp<hp,'what used to be a miss is now a detonation');
});

test('there is no minimum range: the launcher can hit its own user',()=>{
 const {g,p}=lane(GL03);
 const hp=p.hp;
 assert.equal(launchReason(g,{x:p.x,y:p.y}),'');
 assert.equal(g.action('launch',{x:p.x+1,y:p.y}),true);
 assert.ok(p.hp<hp,'the blast reaches the player one tile away');
});

test('the launcher refuses what it cannot reach, and a refusal costs nothing',()=>{
 const {g,p}=lane(GL03),mag=WEAPONS[GL03].mag,turn=g.turn;
 const range=WEAPONS[GL03].range;
 assert.match(launchReason(g,{x:p.x+range+1,y:p.y}),/落點/);
 assert.match(launchReason(g,null),/地板/);
 g.grid[p.y][p.x+2]=0;
 assert.match(launchReason(g,{x:p.x+2,y:p.y}),/地板/);
 for(const bad of [{x:p.x+range+1,y:p.y},null,{x:p.x+2,y:p.y}])assert.equal(g.action('launch',bad),false);
 assert.equal(p.ammo[p.weapon],mag);assert.equal(g.turn,turn);
 p.ammo[p.weapon]=0;
 assert.match(launchReason(g,{x:p.x+3,y:p.y}),/彈匣/);
 // A rifle cannot use the launch action at all.
 const rifle=lane(AR09);
 assert.match(launchReason(rifle.g,{x:rifle.p.x+2,y:rifle.p.y}),/不能/);
});
