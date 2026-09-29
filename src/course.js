import {t} from './i18n.js';
import {ENEMY_TYPES} from './data.js';
import {distance} from './world.js';
import {registerOrder,giveOrder,runOrder} from './orders.js';
import {barrierBetween} from './barriers.js';
import {roomAt} from './map-geometry.js';
import {lightAt,LIGHT} from './lighting.js';
import {COURSE_BEATS,COURSE_AFTER_CARD,COURSE_DEATH} from './course-script.js';

// The training course's rules (3.198.0; script in src/course-script.js, map in src/course-map.js). After every action it
// looks at the floor and queues the beats whose moment has come; the controller plays them. It also holds the few rules
// only the course has: the stun, the drone that waits for your first shot, the target drones that never act, and the
// grenade restock. A simulation is never saved, so `g.course` lives on the game object only.
export const COURSE_TUNING=Object.freeze({
 stun:2,            // actions the player loses when the training drone is first locked
 droneHp:400,       // a full rifle magazine (10 bursts of about 30) leaves it standing, so reloading comes up
 droneDamage:.2,    // "training output": a fifth of a drone's damage
 targetHp:30,       // below a frag's damage two tiles out (35), so one throw on the middle drone clears all three
 grenades:2,        // frag grenades topped up on the way into the throwables room
 hurt:.5            // the medkit reminder in the last fight
});
// Rooms 4 and 5 (the long room and the fight at its end) are both section 5.
const SECTION_OF_ROOM=Object.freeze([1,2,3,4,5,5]);
export const courseActive=g=>Boolean(g?.course);
const role=(g,part)=>g.enemies.filter(e=>e.course===part);

// Target drones never act. The researcher neither moves nor screams until the player has stepped into his room (user,
// 2026-09-27: he used to scream from off screen and bring the next room in first); then he takes his own flight order,
// screams at the player and runs, on the same turn. The training drone hovers in place and fires only once armed.
export const COURSE_ROOMS=Object.freeze({civilian:4});
registerOrder('course_hold',{act:ctx=>{
 const {g,e}=ctx;
 if(e.course==='civilian'){
  if(roomAt(g.rooms,g.player)!==COURSE_ROOMS.civilian)return true;
  e.screamCooldown=0;giveOrder(g,e,{kind:'flee',by:'self',patience:null,breakOn:[]});return runOrder(ctx);   // src/civilians.js
 }
 if(e.course!=='drone'||!g.course?.armed)return true;
 const p=g.player;
 if(!(g.sight(e,p)&&g.shotClear(e,p)&&distance(e,p)<=ENEMY_TYPES[e.type].range))return true;
 e.bandStep=g.turn;return 'fire';   // settled where it is (src/range-band.js), so it never steps to fix its distance
}});

export function startCourse(g){
 g.course={fired:[],beats:[],armed:false,stunned:false,section:1,death:null};
 for(const e of g.enemies){
  if(e.course==='drone')Object.assign(e,{hp:COURSE_TUNING.droneHp,maxHp:COURSE_TUNING.droneHp,damageScale:COURSE_TUNING.droneDamage,courseName:'course.name.trainingDrone'});
  if(e.course==='target')Object.assign(e,{hp:COURSE_TUNING.targetHp,maxHp:COURSE_TUNING.targetHp,courseName:'course.name.target'});
  if(e.course==='drone'||e.course==='target'||e.course==='civilian')giveOrder(g,e,{kind:'course_hold',by:'course',patience:null,breakOn:[]});
  // Seeing the player through the opened door must not make him scream yet (src/civilians.js scream reads the cooldown).
  if(e.course==='civilian')e.screamCooldown=Number.MAX_SAFE_INTEGER;
 }
 fire(g,'start');
}
function fire(g,id){
 const c=g.course;if(!c||c.fired.includes(id))return false;
 c.fired.push(id);c.beats.push({id,items:COURSE_BEATS[id]});return true;
}
export const takeCourseBeats=g=>g.course?g.course.beats.splice(0):[];
export const courseFired=(g,id)=>Boolean(g.course?.fired.includes(id));
// Each zone's way out stays shut until its lesson is done (user, 2026-09-27); the compartment door in zone 1 opens once
// the door has been explained. Everyone's door opening goes through Game.setDoor, which KillhouseGame asks first.
const DOOR_GATES=Object.freeze({
 'edge-kh-compartment':has=>has('door'),
 'edge-kh-0-1':has=>has('boxDone'),
 'edge-kh-1-2':has=>has('s2Down'),
 'edge-kh-2-3':has=>has('s3All')||has('s3Down'),
 'edge-kh-3-4':has=>has('s4Clear')
});
export const courseDoorLocked=(g,b)=>Boolean(g.course&&b&&DOOR_GATES[b.id]&&!DOOR_GATES[b.id](id=>g.course.fired.includes(id)));
// The door the player's action would open, if any: interacting with it, or walking into it.
export function courseDoorFor(g,type,arg){
 const p=g.player;
 if(type==='door'&&arg?.open)return g.barriers.find(b=>b.id===arg.id)||null;
 if(type==='move'&&Array.isArray(arg)){const b=barrierBetween(g.barriers,p,{x:p.x+arg[0],y:p.y+arg[1]});return b?.type==='door'&&!b.open?b:null;}
 return null;
}
// A card the controller closed can set off the next beat.
export function courseCardClosed(g,cardId){const next=COURSE_AFTER_CARD[cardId];if(next)fire(g,next);}
// Read before the action: what the course compares against afterwards.
export function courseBefore(g){const drone=role(g,'drone')[0];return {charged:Boolean(drone?.hp>0&&drone.charge)};}

export function courseAfter(g,type,success,before={},arg=null){
 const c=g.course;if(!c)return;
 const p=g.player,room=roomAt(g.rooms,p),has=id=>c.fired.includes(id);
 // The grenade button throws through the prepared slot (src/controller-aim.js interact); 'grenade' is the direct action.
 const thrown=success&&(type==='grenade'||type==='usePrepared'&&arg?.category==='grenade');
 if(room>=0)c.section=SECTION_OF_ROOM[room];
 if(g.status==='dead'){if(thrown)c.death='grenade';return;}
 if(g.status!=='playing')return;
 const alive=list=>list.filter(e=>e.hp>0),seen=e=>e.hp>0&&g.visibleEnemies.includes(e);
 const at=j=>room===j||Boolean(g.tutorialEntrances?.some(e=>e.toRoom===j&&e.approach.x===p.x&&e.approach.y===p.y));
 // 1 movement and cover
 if(success&&type==='move')fire(g,'moved');
 if(has('moved')&&room===0&&g.cover.length)fire(g,'cover');
 if(has('doorGo')&&g.nearbyDoors.some(b=>b.id==='edge-kh-compartment'))fire(g,'door');
 if(g.props.find(o=>o.id==='case-1-0')?.opened&&!g.items.some(i=>i.course==='box')){fire(g,'pickup');fire(g,'boxDone');}
 // 2 attack: the drone locks, the player is stunned, then the drone waits for the first shot
 const drone=role(g,'drone')[0];
 if(at(1))fire(g,'s2Enter');
 // The lock-on lesson starts the moment the drone comes into view (the door opening), whatever the player had locked
 // before, and locks it for them: no shot at it can come before the card (user, 2026-09-27).
 if(has('s2Enter')&&drone?.hp>0&&(g.target===drone.id||g.visibleEnemies.includes(drone))&&fire(g,'s2Lock')){
  g.target=drone.id;c.stunned=true;p.control.disabled=Math.max(p.control.disabled,COURSE_TUNING.stun);
  g.log(t('game.disabledYou',{n:COURSE_TUNING.stun}),true,t('game.disabledYouReal'));
 }
 if(c.stunned&&!p.control.disabled)fire(g,'s2Ready');
 if(drone&&(has('s2Ready')&&success&&type==='fire'||drone.hp<drone.maxHp))c.armed=true;
 if(drone?.hp>0&&drone.charge)fire(g,'s2Windup');
 if(before.charged&&success&&type==='move')fire(g,'s2Dodge');
 if(has('s2Ready')&&at(1)&&drone?.hp>0&&!g.weapon.melee&&p.ammo[p.weapon]<(g.weapon.shotCost||1))fire(g,'s2Reload');
 if(drone&&drone.hp<=0)fire(g,'s2Down');
 // 3 throwables
 const targets=role(g,'target');
 if(at(2)&&fire(g,'s3Before')&&p.grenades<COURSE_TUNING.grenades){p.grenades=COURSE_TUNING.grenades;g.log(t('course.log.resupply'));}
 if(has('s3Before')&&targets.some(seen))fire(g,'s3See');
 if(has('s3See')&&thrown&&fire(g,'s3Throw'))fire(g,alive(targets).length?'s3Missed':'s3All');
 if(has('s3Before')&&!has('s3All')&&!alive(targets).length)fire(g,'s3Down');
 // 4 the dark room
 const dark=role(g,'dark'),light=lightAt(g,p);
 if(at(3))fire(g,'s4Enter');
 if(has('s4Enter')&&room===3&&light===LIGHT.dim)fire(g,'s4Dim');
 if(has('s4Enter')&&room===3&&light===LIGHT.black)fire(g,'s4Black');
 if(has('s4Black')&&light===LIGHT.black&&dark.some(seen))fire(g,'s4Spot');
 if(alive(dark).length<dark.length)fire(g,'s4Kill');
 if(has('s4Kill')&&alive(dark).some(e=>e.alert))fire(g,'s4Noticed');
 if(dark.length&&!alive(dark).length)fire(g,'s4Clear');
 // 5 the researcher (held by course_hold until the player steps in), then the fight on your own
 const civ=role(g,'civilian')[0],guards=role(g,'guard');
 if(room===4)fire(g,'s5Enter');
 if(has('s5Enter')&&civ?.hp>0&&civ.order?.kind!=='course_hold'&&civ.screamCooldown>0)fire(g,'s5Scream');
 if(has('s5Enter')&&civ&&civ.hp<=0)fire(g,'s5Down');
 if(room===5)fire(g,'s5Combat');
 if(has('s5Enter')&&p.hp<=p.maxHp*COURSE_TUNING.hurt)fire(g,'s5Hurt');
 if(civ&&civ.hp<=0&&!alive(guards).length)fire(g,'s5Clear');
 // 6 extraction
 if(!alive(g.enemies).length)fire(g,'s6Clear');
 if(has('s6Clear')&&g.canTouch(g.exitPoint))fire(g,'s6Elevator');
}
// The elevator stays locked until every target is down.
export const courseExitBlocked=g=>g.enemies.some(e=>e.hp>0)?t('course.exitLocked'):'';
// Which section's death lines play: where the unit fell, or 6 once every target was down. A frag the player threw
// themselves reads by what had been taught: before the grenade lesson (1-2), after it (3-5), or with nothing left (6).
export function courseDeathSection(g){
 const c=g.course;if(!c)return null;
 const section=g.enemies.every(e=>e.hp<=0)?6:c.section;
 return c.death==='grenade'?(section<=2?1:section<=5?3:6):section;
}
export const courseDeathLines=g=>(COURSE_DEATH[courseDeathSection(g)]||[]).map(b=>b.say);
