import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {createKillhouse} from '../src/engine.js';
import {takeCourseBeats,courseCardClosed,courseDeathSection,courseDeathLines,COURSE_TUNING} from '../src/course.js';
import {COURSE_BEATS,COURSE_CARDS,COURSE_DEATH,COURSE_AFTER_CARD,COURSE_CHART} from '../src/course-script.js';
import {courseCardMarkup,courseImage} from '../src/course-ui.js';
import {lightAt,LIGHT,carriesFlashlight} from '../src/lighting.js';
import {barrierBetween} from '../src/barriers.js';
import TEXT_ZH_TW from '../src/text-zh-tw.js';
import TEXT_EN from '../src/text-en.js';

// The training course (3.198.0; the user's script, src/course-script.js). A scripted player walks it: moves, the
// door, the box, the stunned lock-on, the drone, the grenade, the dark room, the researcher and the elevator.
const id=q=>`${q.x},${q.y}`;
function route(g,to){
 const p=g.player,prev=new Map([[id(p),null]]),queue=[{x:p.x,y:p.y}];
 while(queue.length){const c=queue.shift();if(c.x===to.x&&c.y===to.y)break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy},edge=barrierBetween(g.barriers,c,n);
  if(g.grid[n.y]?.[n.x]===1&&!prev.has(id(n))&&!(edge&&edge.type!=='door')&&!g.props.some(o=>o.type==='cover'&&o.hp>0&&o.x===n.x&&o.y===n.y)&&!g.enemies.some(e=>e.hp>0&&e.x===n.x&&e.y===n.y&&id(n)!==id(to))){prev.set(id(n),c);queue.push(n);}}}
 const path=[];for(let c=to;c&&id(c)!==id(p);c=prev.get(id(c)))path.unshift(c);return path;
}
function walker(g){
 const fired=[],cards=[];
 // Plays like the controller: a closed card can queue the next beat at once.
 const beats=()=>{for(let list=takeCourseBeats(g);list.length;list=takeCourseBeats(g))for(const b of list){fired.push(b.id);for(const i of b.items)if(i.card){cards.push(i.card);courseCardClosed(g,i.card);}}};
 const act=(type,arg)=>{const ok=g.action(type,arg);beats();return ok;};
 const walk=to=>{for(const cell of route(g,to)){for(let n=0;n<3&&!(g.player.x===cell.x&&g.player.y===cell.y);n++)act('move',[cell.x-g.player.x,cell.y-g.player.y]);if(g.status!=='playing')return;}};
 beats();return {fired,cards,act,walk};
}
const course=()=>createKillhouse({mode:'tutorial'});

test('the course floor: six rooms in order, a dim-then-black dark room, lamp-lit riflemen without flashlights, a box the soldier can empty',()=>{
 const g=course(),role=r=>g.enemies.filter(e=>e.course===r);
 assert.ok(g.course);assert.equal(g.rooms.length,6);assert.equal(g.killhouseRecipe,'killhouse-course');assert.equal(g.player.character,'soldier');
 assert.deepEqual(g.tutorialEntrances.map(e=>[e.fromRoom,e.toRoom]),[[0,1],[1,2],[2,3],[3,4],[4,5]]);
 assert.equal(g.tutorialEntrances[4].barrierId,null,'the long room opens straight into the fight');
 assert.equal(role('drone')[0].hp,COURSE_TUNING.droneHp);assert.ok(role('target').every(e=>e.hp===COURSE_TUNING.targetHp&&e.order?.kind==='course_hold'));
 // Dark room: dim by the entrance, black in the middle, the riflemen lit by the far lamp and out of sight of the dim stretch.
 assert.equal(lightAt(g,{x:14,y:13}),LIGHT.dim);assert.equal(lightAt(g,{x:9,y:13}),LIGHT.black);
 for(const e of role('dark')){assert.equal(lightAt(g,e),LIGHT.lit);assert.equal(carriesFlashlight(g,e),false);for(let x=13;x<=16;x++)assert.ok(Math.abs(e.x-x)+Math.abs(e.y-13)>10);}
 const box=g.props.find(o=>o.id==='case-1-0');assert.ok(box&&!box.opened);assert.ok(box.contents.every(i=>g.canTake(i)));
 // The frag lesson: the middle drone's blast reaches both others; a side one's does not.
 const [l,m,r]=role('target'),d=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);assert.ok(d(m,l)<=2&&d(m,r)<=2&&d(l,r)>2);
 const entry=g.tutorialEntrances[1].approach,inside={x:entry.x,y:entry.y+1};assert.ok(d(inside,m)<=5&&d(inside,m)>2,'thrown from the doorway, clear of the blast');
});

test('walking the course: every beat fires in order, the stun, the waiting drone, one magazine, the middle grenade, the dark room, the researcher',()=>{
 const g=course(),p=g.player,{fired,cards,act,walk}=walker(g),drone=g.enemies.find(e=>e.course==='drone');
 assert.deepEqual(fired,['start']);
 walk({x:4,y:5});walk({x:5,y:3});assert.deepEqual(fired.slice(1),['moved','cover','doorGo'],'the cover card leads on to the door');
 walk({x:11,y:5});assert.ok(!fired.includes('door'),'not until the door is within reach');walk({x:12,y:5});assert.ok(fired.includes('door')&&fired.includes('box'));
 assert.ok(act('door',{id:'edge-kh-compartment',open:true}));walk({x:14,y:3});assert.ok(act('openContainer','case-1-0'));walk(g.items.find(i=>i.course==='box'));
 assert.ok(fired.includes('pickup')&&fired.includes('boxDone'));assert.equal(p.meds,3);
 // 2: the lock-on stuns; the drone does nothing until the first shot, then winds up and fires from where it hovers.
 walk(g.tutorialEntrances[0].approach);act('move',[1,0]);
 assert.ok(fired.includes('s2Enter')&&fired.includes('s2Lock'));assert.equal(p.control.disabled,COURSE_TUNING.stun);
 const spot={x:drone.x,y:drone.y};for(let i=0;i<4;i++)act('wait');
 assert.ok(fired.includes('s2Ready'));assert.equal(drone.hp,drone.maxHp);assert.equal(drone.charge,false);assert.equal(p.hp,p.maxHp);
 g.target=drone.id;act('fire');act('fire');assert.ok(fired.includes('s2Windup'),'the first shot arms it');
 act('move',[1,0]);assert.ok(fired.includes('s2Dodge'));
 while(p.ammo[p.weapon]>0){g.target=drone.id;act('fire');}
 assert.ok(drone.hp>0,'a full magazine leaves the training drone standing');assert.ok(fired.includes('s2Reload'));
 act('reload');for(let i=0;i<20&&drone.hp>0;i++){g.target=drone.id;if(!act('fire'))act('reload');}
 assert.ok(fired.includes('s2Down'));assert.deepEqual({x:drone.x,y:drone.y},spot,'it never moved');assert.ok(p.hp>80,'training output');
 // 3: restocked grenades, the card, then one frag on the middle drone clears all three without touching the player.
 p.grenades=0;walk(g.tutorialEntrances[1].approach);assert.ok(fired.includes('s3Before'));assert.equal(p.grenades,COURSE_TUNING.grenades);
 act('move',[0,1]);act('move',[0,1]);assert.ok(fired.includes('s3See')&&fired.includes('s3Aim'));
 const hp=p.hp,mid=g.enemies.find(e=>e.id==='kh-target-1');g.target=mid.id;assert.ok(act('grenade',{x:mid.x,y:mid.y}));
 assert.ok(fired.includes('s3Throw')&&fired.includes('s3All')&&!fired.includes('s3Missed'));assert.equal(p.hp,hp);
 // 4: dim, black, the spot from the dark; the first kill's flash wakes the other.
 walk(g.tutorialEntrances[2].approach);act('move',[-1,0]);assert.ok(fired.includes('s4Enter'));
 walk({x:14,y:13});assert.ok(fired.includes('s4Dim')&&!fired.includes('s4Black'));
 const dark=g.enemies.filter(e=>e.course==='dark');assert.ok(dark.every(e=>!e.alert),'nobody sees you in the dim stretch');
 walk({x:9,y:13});assert.ok(fired.includes('s4Black')&&fired.includes('s4Spot'));assert.ok(dark.every(e=>!e.alert));
 for(let i=0;i<8&&dark[0].hp>0;i++){g.target=dark[0].id;if(!act('fire'))act('reload');}
 assert.ok(fired.includes('s4Kill')&&fired.includes('s4Noticed'));
 p.hp=p.maxHp=9999;for(let i=0;i<20&&dark[1].hp>0;i++){if(g.visibleEnemies.includes(dark[1])){g.target=dark[1].id;if(!act('fire'))act('reload');}else act('wait');}
 assert.ok(fired.includes('s4Clear'));
 // 5: the researcher waits until the player steps in, screams on screen, and only warns the next room once he reaches it.
 const civ=g.enemies.find(e=>e.course==='civilian'),home={x:civ.x,y:civ.y};
 walk(g.tutorialEntrances[3].approach);act('move',[0,1]);act('wait');act('wait');
 assert.deepEqual({x:civ.x,y:civ.y},home,'the door is open but the player is still outside');assert.ok(!fired.includes('s5Scream'));
 act('move',[0,1]);
 assert.ok(fired.includes('s5Enter')&&fired.includes('s5Scream'));assert.ok(Math.abs(civ.x-p.x)<=4&&Math.abs(civ.y-p.y)<=4,'close enough to be on screen');
 assert.ok(g.enemies.filter(e=>e.course==='guard').every(e=>!e.alert),'his first scream does not reach the fight room');
 for(let i=0;i<14&&!g.enemies.some(e=>e.course==='guard'&&e.alert);i++)act('wait');
 assert.ok(g.enemies.some(e=>e.course==='guard'&&e.alert),'he runs to the fight room and warns it');
 assert.deepEqual(cards,['move','cover','door','box','target','windup','reload','throw','light','flash','flashlight','civilian']);
 const order=Object.keys(COURSE_BEATS).filter(k=>fired.includes(k));assert.deepEqual(fired.filter(k=>order.includes(k)),fired,'no beat twice');
});

test('the elevator stays locked until every target is down, then extracts from beside it',()=>{
 const g=course(),p=g.player;
 Object.assign(p,{x:g.end.x-1,y:g.end.y});g.reveal();
 assert.equal(g.action('interact'),false);assert.equal(g.status,'playing');assert.match(g.exitBlocked,/電梯鎖定/);
 for(const e of g.enemies)e.hp=0;g.action('wait');const beats=takeCourseBeats(g).map(b=>b.id);
 assert.ok(beats.includes('s6Clear')&&beats.includes('s6Elevator'));assert.equal(g.exitKind,'extract');
 assert.equal(g.action('interact'),true);assert.equal(g.status,'won');
});

test('death lines follow the section, and a self-inflicted grenade reads by what had been taught',()=>{
 const at=(x,y,grenade=false)=>{const g=course();Object.assign(g.player,{x,y});g.course.death=grenade?'grenade':null;g.action('wait');return g;};
 const section=(x,y,grenade)=>{const g=at(x,y,grenade);return courseDeathSection(g);};
 assert.equal(section(4,5),1);assert.equal(section(20,5),2);assert.equal(section(20,5,true),1);
 assert.equal(section(20,12,true),3);assert.equal(section(10,13),4);assert.equal(section(10,13,true),3);assert.equal(section(10,21),5);assert.equal(section(20,21),5);
 const clear=at(20,21,true);for(const e of clear.enemies)e.hp=0;assert.equal(courseDeathSection(clear),6);
 // A real own-grenade death: throw at your own feet in room 1.
 // The grenade button throws through the prepared slot, as the controller does.
 const g=course();g.player.hp=5;g.player.plates=0;assert.ok(g.action('usePrepared',{category:'grenade',target:{x:g.player.x,y:g.player.y}}));
 assert.equal(g.status,'dead');assert.equal(g.course.death,'grenade');assert.equal(courseDeathSection(g),1);
 assert.deepEqual(courseDeathLines(g),COURSE_DEATH[1].map(b=>b.say));
 for(const lines of Object.values(COURSE_DEATH))assert.ok(lines.length>=2);
});

test('the script is complete in both languages, cards page, and localized pictures come in both',async()=>{
 const keys=new Set();
 for(const items of Object.values(COURSE_BEATS))for(const i of items){if(i.say)keys.add(i.say.line);else assert.ok(COURSE_CARDS[i.card],i.card);}
 for(const c of Object.values(COURSE_CARDS)){keys.add(c.title);for(const pg of c.pages){keys.add(pg.text);if(pg.chart)for(const col of COURSE_CHART[pg.chart].columns){keys.add(col.title);col.rows.forEach(r=>keys.add(r));}}}
 for(const lines of Object.values(COURSE_DEATH))for(const b of lines)keys.add(b.say.line);
 for(const k of ['course.s6.beam','course.s6.result','course.prev','course.next','course.done','course.exitLocked','course.brief','course.log.resupply','course.name.trainingDrone','course.name.target'])keys.add(k);
 for(const k of keys){assert.ok(TEXT_ZH_TW[k],`zh ${k}`);assert.ok(TEXT_EN[k],`en ${k}`);assert.doesNotMatch(TEXT_ZH_TW[k],/[（(][^)）]*圖卡|\(註/,'no notes to Claude in the game');}
 for(const next of Object.values(COURSE_AFTER_CARD))assert.ok(COURSE_BEATS[next]);
 const two=courseCardMarkup('target',0),last=courseCardMarkup('target',1);
 assert.match(two,/data-course-page="1"/);assert.doesNotMatch(two,/data-course-done/);assert.match(last,/data-course-done/);assert.match(last,/course-chart/);assert.match(last,/data-course-page="0"/);
 for(const c of Object.values(COURSE_CARDS))for(const pg of c.pages)if(pg.image)for(const lang of pg.localized?['zh-TW','en']:['zh-TW'])await access(new URL('..'+courseImage(pg,lang).slice(1),import.meta.url));
 const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
 for(const c of Object.values(COURSE_CARDS))for(const pg of c.pages)if(pg.image)assert.ok(sw.includes(courseImage(pg,'zh-TW')),`offline ${pg.image}`);
});

test('the course comes off as a unit: the switch brings back the six-card tutorial, and only the kill house and the controller reach it',async()=>{
 const old=createKillhouse({mode:'tutorial',options:{tutorialCourse:false}});
 assert.equal(old.course,undefined);assert.equal(old.killhouseRecipe,'killhouse-tutorial');assert.ok(old.enemies.every(e=>!e.course&&e.damageScale===undefined&&!e.courseName));
 assert.equal(createKillhouse({mode:'arcade'}).course,undefined);
 const users=[];for(const f of await readdir(new URL('../src/',import.meta.url)))if(f.endsWith('.js')&&!f.startsWith('course')){const body=await readFile(new URL(`../src/${f}`,import.meta.url),'utf8');if(/from '\.\/course[\w-]*\.js'/.test(body))users.push(f);}
 assert.deepEqual(users.sort(),['controller.js','killhouse-maps.js','killhouse.js']);
});

test('each zone door stays shut until its lesson is done, for everyone, and the researcher waits until the player steps in',()=>{
 const g=course(),p=g.player,door=id=>g.barriers.find(b=>b.id===id),has=id=>g.course.fired.push(id);
 // Teleporting past the drone sets off its lock-on stun, and the dark room's riflemen may shoot: neither is this test's.
 p.maxHp=p.hp=9999;
 const tryOpen=(x,y,step,id)=>{Object.assign(p,{x,y});p.control.disabled=0;g.reveal();return g.action('move',step)&&door(id).open;};
 assert.equal(tryOpen(12,5,[1,0],'edge-kh-compartment'),false);assert.match(g.logs[0].text,/門打不開/);
 has('doorGo');has('door');assert.equal(tryOpen(12,5,[1,0],'edge-kh-compartment'),true,'open once the door has been explained');
 for(const [id,x,y,step,lesson] of [['edge-kh-0-1',17,5,[1,0],'boxDone'],['edge-kh-1-2',21,9,[0,1],'s2Down'],['edge-kh-2-3',17,13,[-1,0],'s3Down'],['edge-kh-3-4',4,17,[0,1],'s4Clear']]){
  assert.equal(tryOpen(x,y,step,id),false,`${id} before ${lesson}`);assert.equal(g.action('door',{id,open:true}),false);
  assert.equal(g.setDoor(door(id),true),false,'nobody else opens it either');
  if(id==='edge-kh-3-4'){
   const civ=g.enemies.find(e=>e.course==='civilian'),spot={x:civ.x,y:civ.y};civ.alert=true;
   for(let i=0;i<6;i++)g.action('wait');assert.deepEqual({x:civ.x,y:civ.y},spot,'the researcher waits while his door is shut');
  }
  has(lesson);assert.equal(tryOpen(x,y,step,id),true,`${id} after ${lesson}`);
 }
 const civ=g.enemies.find(e=>e.course==='civilian'),spot={x:civ.x,y:civ.y};
 p.control.disabled=0;for(let i=0;i<3;i++)g.action('wait');assert.deepEqual({x:civ.x,y:civ.y},spot,'an open door alone does not free him');assert.equal(civ.order?.kind,'course_hold');
 p.control.disabled=0;assert.ok(g.action('move',[0,1]));assert.deepEqual({x:p.x,y:p.y},{x:4,y:18});assert.notDeepEqual({x:civ.x,y:civ.y},spot,'he runs the turn the player steps in');assert.equal(civ.order?.kind,'flee');
});

test('the comms bar shows each line once, and its countdown survives moving onto and off a card (3.198.1)',async()=>{
 // A `then` that says the next line itself used to get that line armed twice; the spare timer cleared the line after it.
 const source=await readFile(new URL('../src/controller.js',import.meta.url),'utf8');
 assert.ok(source.includes("if(message===undefined||commsLayer.firstElementChild)return;"),'one box at a time');
 assert.ok(source.includes("if(bar)bar.currentTime=performance.now()-commsShownAt;"),'the countdown resumes after a move');
 assert.ok(source.indexOf("commsShownAt=performance.now();")>source.indexOf('function showNextComms'),'the start time is taken when a line goes up');
});

test('the lock-on lesson starts as the door to zone 2 opens, even with something else locked (3.198.2)',()=>{
 const g=course(),p=g.player,drone=g.enemies.find(e=>e.course==='drone');
 g.course.fired.push('moved','cover','doorGo','door','box','pickup','boxDone');takeCourseBeats(g);
 Object.assign(p,{x:16,y:5});g.reveal();assert.ok(g.action('move',[1,0]));
 g.target='kh-cover-0';   // the player had tapped a crate earlier; auto-lock keeps that target
 assert.ok(g.action('move',[1,0]),'the door opens from the doorway');
 const ids=takeCourseBeats(g).map(b=>b.id);assert.ok(ids.includes('s2Lock'),'no need to step in');
 assert.equal(g.target,drone.id,'the course locks the drone');assert.equal(p.control.disabled,COURSE_TUNING.stun);
 assert.deepEqual({x:p.x,y:p.y},{x:17,y:5});assert.equal(drone.hp,drone.maxHp,'nothing was fired at it');
});
