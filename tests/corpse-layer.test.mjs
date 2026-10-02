// 3.211.0 (user decisions 2026-10-01, docs/KILL_GORE.md 屍體圖層): bodies on a layer of their own, presentation only.
// A kill throws the body along the blow (a light hit only slumps it; heavy melee, a point-blank shotgun and blasts throw
// it further), stopping short of walls and closed edges, to rest off its tile's centre with a turn; a reload lays it
// down in a fixed pose from its id; a floor with many fades its oldest. Rules and saves never see it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sourceFamily} from './helpers/source.mjs';
import {CORPSE_TUNING,CorpseLayer,corpseRest,corpseThrow,restingPose,throwReach} from '../src/corpse-layer.js';

// An open floor, with walls and closed edges where a test puts them.
function world({walls=[],edges=[]}={}){
 const wall=new Set(walls.map(([x,y])=>x+','+y)),edge=new Set(edges.map(([a,b])=>[a,b].map(String).sort().join('|')));
 return {open:(x,y)=>x>=0&&y>=0&&x<27&&y<27&&!wall.has(x+','+y),edge:(a,b)=>edge.has([[a.x,a.y],[b.x,b.y]].map(String).sort().join('|'))};
}
const fall=(force,{blow={dx:1,dy:0},size=1,id='e1',to={x:10,y:10}}={})=>({type:'fall',actorId:id,enemy:true,to,from:to,blow,force,size});

test('how far a blow throws a body: a light hit slumps, heavy melee, a point-blank shotgun and blasts throw it',()=>{
 const reach=(force,o)=>throwReach(fall(force,o));
 assert.ok(reach({style:'bullet',damage:24})<CORPSE_TUNING.slump,'a rifle round only slumps it');
 assert.ok(reach({style:'melee',cut:'slash',heft:.75,damage:18})<CORPSE_TUNING.slump,'nor does a knife');
 assert.ok(reach({style:'melee',cut:'slash',heft:1.24,damage:49})>CORPSE_TUNING.slump*2,'an axe throws it');
 assert.ok(reach({style:'melee',cut:'slash',heft:1.58,damage:80})>reach({style:'melee',cut:'slash',heft:1.24,damage:49}),'a power fist further');
 assert.ok(reach({style:'pellet',damage:72,range:1})>reach({style:'pellet',damage:40,range:3})*1.8,'point-blank buckshot far more than at three tiles');
 assert.ok(reach({style:'blast',damage:50})>1,'a blast throws it over a tile');
 assert.equal(reach({style:'blast',damage:500},{size:.6}),CORPSE_TUNING.max,'never further than the cap');
 assert.ok(reach({style:'blast',damage:50},{size:2.2})<reach({style:'blast',damage:50},{size:1}),'a big body flies less');
 assert.equal(reach({style:'blast',damage:50},{blow:null}),0,'no direction (poison, fire): no throw');
});

test('a thrown body stops short of walls, closed edges, pits and props, and never leans into a wall',()=>{
 const open=world(),dir={x:1,y:0},R=CORPSE_TUNING.radius;
 assert.ok(Math.abs(corpseRest({x:10,y:10},dir,1.2,open)-1.2)<CORPSE_TUNING.step,'nothing in the way: the full throw');
 const wall=world({walls:[[11,10]]}),d=corpseRest({x:10,y:10},dir,1.2,wall);
 assert.ok(d<=.5-R+1e-9&&d>.5-R-CORPSE_TUNING.step-1e-9,'against the wall: its edge stops at the wall');
 const door=world({edges:[[[10,10],[11,10]]]});assert.ok(corpseRest({x:10,y:10},dir,1.2,door)<=.5-R+1e-9,'a closed door or partition between the tiles stops it too');
 const far=world({walls:[[12,10]]}),e=corpseRest({x:10,y:10},dir,1.6,far);assert.ok(e>1&&e<=1.5-R+1e-9,'into the next tile and up to the wall beyond');
 // Diagonal: a corner with both sides walled stops it; one open side lets it through, as a line of sight.
 const diag={x:Math.SQRT1_2,y:Math.SQRT1_2};
 assert.ok(corpseRest({x:10,y:10},diag,1.4,world({walls:[[11,10],[10,11]]}))<.5,'a closed corner');
 assert.ok(corpseRest({x:10,y:10},diag,1.4,world({walls:[[11,10]]}))<.5,'leaning over the walled side');
 assert.ok(corpseRest({x:10,y:10},diag,1.2,world())>1.1,'an open diagonal');
 // The layer's world (the renderer): floor without a solid prop, and the edges that stop a move.
 const map=sourceFamily('renderer');assert.match(map,/corpseWorld\(\)\{const g=this\.game;return \{open:\(x,y\)=>g\.grid\[y\]\?\.\[x\]===1&&!g\.solid\(x,y\),edge:\(a,b\)=>blockedBetween\(g\.barriers,a,b\)\};\}/);
});

test('the throw: along the blow, a slash shoves it to the kill\'s side, it turns as it flies; a slump keeps its resting pose',()=>{
 const w=world(),axe={style:'melee',cut:'slash',heft:1.24,damage:49};
 const left=corpseThrow(fall(axe),w,{side:-1}),right=corpseThrow(fall(axe),w,{side:1});
 assert.ok(left.dx>.3&&right.dx>.3,'along the blow');assert.ok(left.dy<-.1&&right.dy>.1,'and to the side of the swing');
 assert.deepEqual(corpseThrow(fall(axe),w,{side:1}),right,'the same kill, the same throw');
 assert.ok(right.duration>CORPSE_TUNING.flight.base&&right.hop>0&&right.spin!==0,'a flight with a hop and a turn');
 const blast=corpseThrow(fall({style:'blast',damage:50}),w);assert.ok(Math.abs(blast.dy)<.25*blast.dist,'a blast throws straight out');
 const shot=corpseThrow(fall({style:'bullet',damage:24},{id:'e7'}),w),pose=restingPose('e7');
 assert.equal(shot.dist,0);assert.equal(shot.duration,0);assert.equal(shot.angle,pose.angle);assert.ok(Math.hypot(shot.dx,shot.dy)<.35,'a slump stays near the centre');
 const none=corpseThrow(fall({style:'bullet'},{blow:null,id:'e8'}),w);assert.deepEqual([none.dx,none.dy,none.angle],[restingPose('e8').dx,restingPose('e8').dy,restingPose('e8').angle],'no direction: the resting pose');
});

test('a body the layer never saw fall is laid down from its id: the same every time, off the centre, turned',()=>{
 const poses=['1-3','1-4','2-1','e9','qa-0'].map(restingPose);
 for(const p of poses){const d=Math.hypot(p.dx,p.dy);assert.ok(d>=CORPSE_TUNING.rest[0]-1e-9&&d<=CORPSE_TUNING.rest[1]+1e-9);assert.ok(Math.abs(p.angle)<=CORPSE_TUNING.pose);}
 assert.deepEqual(restingPose('1-3'),restingPose('1-3'));assert.ok(new Set(poses.map(p=>p.angle.toFixed(3))).size===poses.length,'each its own');
 const layer=new CorpseLayer(),w=world(),dead={id:'1-3',x:10,y:10,hp:0};
 const a=layer.pose(dead,0,w),b=new CorpseLayer().pose(dead,99999,w);assert.deepEqual(a,b,'a reload rebuilds the same pose');
 assert.ok(Math.abs(a.x-restingPose('1-3').dx)<1e-9&&a.lift===0&&a.alpha===1);
 // Against a wall the rebuilt pose is kept off it too.
 const walled=new CorpseLayer().pose({id:'1-3',x:10,y:10,hp:0},0,world({walls:[[9,10],[11,10],[10,9],[10,11],[9,9],[11,11],[9,11],[11,9]]}));assert.ok(Math.abs(walled.x)<=.5-CORPSE_TUNING.radius+1e-9&&Math.abs(walled.y)<=.5-CORPSE_TUNING.radius+1e-9);
});

test('the layer plays a throw: from the tile at the kill to its rest, hopping and turning; reduced motion and off',()=>{
 const w=world(),f=fall({style:'blast',damage:50}),layer=new CorpseLayer();
 const body=layer.fall(f,1000,w,{side:1});assert.ok(body.dist>1);
 const start=layer.pose({id:'e1',x:10,y:10},1000,w),mid=layer.pose({id:'e1',x:10,y:10},1000+body.duration/2,w),end=layer.pose({id:'e1',x:10,y:10},1000+body.duration+5,w);
 assert.deepEqual([start.x,start.y],[0,0],'it leaves from the tile');assert.ok(mid.x>0&&mid.x<end.x&&mid.lift>0,'in flight, off the floor');
 assert.ok(Math.abs(end.x-body.dx)<1e-9&&end.lift===0&&Math.abs(end.angle-body.angle)<1e-9,'at rest, turned');
 assert.ok(Math.abs(start.angle-end.angle)>.1,'it turned on the way');
 const still=new CorpseLayer();still.fall(f,1000,w,{still:true});assert.ok(Math.abs(still.pose({id:'e1',x:10,y:10},1000,w).x-body.dx)<1e-9,'reduced motion: at rest at once');
 const flat=new CorpseLayer();flat.fall(f,1000,w,{flat:true});assert.deepEqual(flat.pose({id:'e1',x:10,y:10},5000,w),{x:0,y:0,lift:0,angle:0,alpha:1},'off: the old fall, on the centre');
 assert.deepEqual(new CorpseLayer().pose({id:'e5',x:3,y:3},0,w,{flat:true}),{x:0,y:0,lift:0,angle:0,alpha:1});
 // A record moved to another tile by the rules starts over from its resting pose there.
 const moved=layer.pose({id:'e1',x:12,y:10},9000,w);assert.ok(Math.abs(moved.x-restingPose('e1').dx)<1e-9);
});

test('a raised or revived body leaves the layer; past the cap the oldest fade out; a new floor or run starts empty',()=>{
 const w=world(),layer=new CorpseLayer({...CORPSE_TUNING,keep:3,fadeMs:1000});layer.use('7:1');
 const dead=[0,1,2,3,4].map(i=>({id:'d'+i,x:5+i,y:5,hp:0}));for(const d of dead)layer.pose(d,0,w);
 layer.settle(dead,100);
 assert.equal(layer.pose(dead[0],100,w).alpha,1,'fading starts now');assert.equal(layer.pose(dead[0],600,w).alpha,.5);assert.equal(layer.pose(dead[1],1100,w).alpha,0,'the two oldest gone');
 assert.equal(layer.pose(dead[2],5000,w).alpha,1,'the newest three stay');
 layer.settle(dead.filter(d=>d.id!=='d4'),2000);assert.ok(!layer.bodies.has('d4'),'raised: off the layer');
 layer.use('7:1');assert.equal(layer.bodies.size,4,'the same floor keeps its bodies');layer.use('7:2');assert.equal(layer.bodies.size,0,'another floor starts empty');
 // Drawn on its own pass, before every tile's props and drops (loot shows at the centre), for bodies the rules keep.
 const map=sourceFamily('renderer'),pass=map.indexOf('this.drawCorpses(bodies,time);'),props=map.indexOf("for(const prop of g.props)if(isContainer(prop)&&prop.x===x&&prop.y===y)");
 assert.ok(pass>0&&props>pass,'bodies before props and drops');assert.ok(map.includes('this.drawCorpses(bodies,time);\n    for(const {a,x,y,memo,shown,burning,alpha}of later){'),'one pass for all bodies, before the props of any tile');assert.match(map,/\(dead\.hp<=0\|\|downed\(dead\)\)&&!dead\.raised/);   // 3.219.0: a feigning body lies with the rest
 assert.match(sourceFamily('controller'),/renderer\.corpses\?\.reset\(\)/,'cleared with the blood: new run, load, replay');
});

// Independent review of 3.211.0 (1): the cap counts only bodies that have been drawn, in the order they were first drawn,
// and a body past the cap the moment it is first drawn (the oldest rebuilt after a reload) is hidden at once.
test('review: the cap counts drawn bodies only; after a reload the excess is hidden at once, not faded in view',()=>{
 const w=world(),keep=40,layer=new CorpseLayer();layer.use('k');
 const seen=Array.from({length:keep},(_,i)=>({id:'s'+i,x:i%10+2,y:Math.floor(i/10)+2,hp:0}));
 for(const d of seen)layer.pose(d,0,w);
 // Five kills out of sight: recorded, not drawn, so nothing fades.
 for(let i=0;i<5;i++)layer.fall(fall({style:'bullet',damage:24},{id:'u'+i,to:{x:20,y:20}}),10,w);
 const unseen=Array.from({length:5},(_,i)=>({id:'u'+i,x:20,y:20,hp:0}));
 layer.settle([...seen,...unseen],20);assert.equal(layer.fading.size,0,'unseen falls do not count');
 // Seen later, they are the newest: the oldest drawn bodies fade, over fadeMs, from the moment they became too many.
 for(const d of unseen)layer.pose(d,500,w);layer.settle([...seen,...unseen],520);
 assert.deepEqual([...layer.fading.keys()].sort(),['s0','s1','s2','s3','s4']);assert.equal(layer.pose(seen[0],520,w).alpha,1,'a visible body fades, it does not blink out');
 assert.ok(layer.pose(seen[0],520+CORPSE_TUNING.fadeMs/2,w).alpha>.4);assert.equal(layer.pose(seen[0],520+CORPSE_TUNING.fadeMs,w).alpha,0);assert.equal(layer.pose(unseen[0],9000,w).alpha,1);
 // A reload: every body is rebuilt in the same frame (drawCorpses poses them all before it settles); the excess never shows.
 const fresh=new CorpseLayer(),dead=Array.from({length:50},(_,i)=>({id:'d'+i,x:i%10+2,y:Math.floor(i/10)+2,hp:0}));fresh.use('k');
 for(const d of dead)fresh.pose(d,3000,w);fresh.settle(dead,3000);
 const hidden=dead.filter(d=>fresh.alpha(d.id,3000)===0);assert.equal(hidden.length,10,'hidden on the first frame');
 assert.ok(dead.every(d=>[0,1].includes(fresh.alpha(d.id,3000))),'no body half faded');assert.equal(dead.filter(d=>fresh.alpha(d.id,4000)===1).length,keep);
 const map=sourceFamily('renderer');assert.match(map,/const poses=bodies\.map\(\(\{dead\}\)=>layer\.pose\(dead,time,world,\{flat\}\)\);\n    layer\.settle\(/,'posed, then settled, then drawn');
});

// Independent review of 3.211.0 (2): turning 擊殺血光 to off puts every body back on its tile's centre with the old
// settling nudge, including bodies thrown before the switch; turning it back on lays them down from their ids.
test('review: the gore setting off puts thrown bodies back on the centre with the old fall; back on, they rest from their ids',()=>{
 const w=world(),layer=new CorpseLayer(),dead={id:'e1',x:10,y:10,hp:0};layer.use('k',false);
 layer.fall(fall({style:'melee',cut:'slash',heft:1.24,damage:49}),0,w,{side:1});layer.pose(dead,0,w);
 assert.ok(Math.abs(layer.pose(dead,5000,w).x)>.3,'thrown while on');
 layer.use('k',true);assert.deepEqual(layer.pose(dead,5000,w,{flat:true}),{x:0,y:0,lift:0,angle:0,alpha:1},'off: on the centre, unturned');
 layer.use('k',false);const back=layer.pose(dead,6000,w);assert.ok(Math.abs(back.x-restingPose('e1').dx)<1e-9&&back.angle===restingPose('e1').angle,'on again: its resting pose');
 const map=sourceFamily('renderer');
 assert.match(map,/layer\.use\(`\$\{g\.seed\}:\$\{g\.floor\}`,flat\)/,'the corpse pass follows the setting');assert.match(map,/this\.corpses\.use\(`\$\{g\.seed\}:\$\{g\.floor\}`,this\.goreLevel==='off'\)/,'so does a kill');
 assert.match(map,/dead\.type,undefined,dead,pose\.angle,!flat\);/,'off draws as before 3.211.0, with the settling nudge');
});

test('presentation only: the layer reads no game state, ships offline, and nothing new is saved',()=>{
 const src=readFileSync(new URL('../src/corpse-layer.js',import.meta.url),'utf8');
 assert.deepEqual([...src.matchAll(/^import .* from '(.+)';$/gm)].map(m=>m[1]),['./gore.js'],'its one import (card and weapon data through gore.js, never a game)');
 assert.ok(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes("'./src/corpse-layer.js'"));
 assert.doesNotMatch(sourceFamily('game'),/corpse-layer|corpseThrow|CorpseLayer/,'the rules never see it');
});
