// Presentation observes one synchronous turn. Snapshots never roll back rules or RNG.
const observers=new WeakMap();
export function snapshot(game){
  const {rng,effects,...data}=game;
  return Object.assign(Object.create(Object.getPrototypeOf(game)),structuredClone(data),{effects:[]});
}
export function presentStep(game,action,quietActor=null){
  const steps=observers.get(game);
  if(!steps)return action();
  const before=snapshot(game),start=game.effects.length;
  const state=quietActor?{x:quietActor.x,y:quietActor.y,charge:quietActor.charge,windup:quietActor.windup,visible:game.visible(quietActor)}:null;
  const result=action();
  const changed=state&&(state.visible||game.visible(quietActor))&&(state.x!==quietActor.x||state.y!==quietActor.y||state.charge!==quietActor.charge||state.windup!==quietActor.windup);
  if(game.effects.length>start||changed)steps.push({before,after:snapshot(game),effects:structuredClone(game.effects.slice(start))});
  return result;
}
export function captureAction(game,action){
  const steps=[];observers.set(game,steps);
  try{return {success:action(),steps};}finally{observers.delete(game);}
}
// Cosmetic projectiles per resolved shot; these never affect ammunition or damage.
export const WEAPON_VISUALS={
  thunder:{count:1,flight:100,stagger:0,spread:0,style:'grenade'},
  lmg:{count:2,flight:60,stagger:15,spread:.07,style:'bullet'},
  powerfist:{count:1,flight:100,stagger:0,spread:0,style:'slash'},
  rifle:{count:3,flight:85,stagger:20,spread:.04,style:'bullet'},
  shotgun:{count:6,flight:95,stagger:0,spread:.5,style:'pellet'},
  smg:{count:3,flight:60,stagger:15,spread:.07,style:'bullet'},
  sniper:{count:1,flight:110,stagger:0,spread:0,style:'tracer'},
  plasma:{count:1,flight:130,stagger:0,spread:0,style:'plasma'},
  launcher:{count:1,flight:170,stagger:0,spread:0,style:'grenade'},
  grenade:{count:1,flight:180,stagger:0,spread:0,style:'grenade'},
  melee:{count:1,flight:80,stagger:0,spread:0}
};
const enemyWeapon={rifleman:'rifle',raider:'smg',gunner:'shotgun',sniper:'sniper',drone:'plasma',warden:'plasma',boss:'plasma',crawler:'melee',brute:'melee'};
export const FLIGHT_MS=125,IMPACT_MS=130,DEATH_MS=220;
export function projectileVisuals(effect,reduceMotion=false){
  const id=effect.style==='grenade'?'grenade':effect.weaponId||enemyWeapon[effect.attackerType]||'rifle';
  const spec=WEAPON_VISUALS[id]||WEAPON_VISUALS.rifle;
  return Array.from({length:reduceMotion?1:spec.count},(_,i)=>({...effect,damage:0,miss:false,missPath:effect.miss,
    style:spec.style||effect.style||(id==='melee'?(effect.attackerType==='crawler'?'claw':'slash'):'bullet'),travel:reduceMotion?70:spec.flight,delay:reduceMotion?0:i*spec.stagger,
    spread:reduceMotion?0:spec.spread*(i-(spec.count-1)/2)/Math.max(1,(spec.count-1)/2),quiet:reduceMotion}));
}
export function planPresentation(steps,{reduceMotion=false}={}){
  const events=[];let time=0;
  for(const [index,step]of steps.entries()){
    const flights=step.effects.filter(e=>e.type==='shot'||e.type==='enemyShot');
    const visuals=flights.flatMap(e=>projectileVisuals(e,reduceMotion));
    const impacts=step.effects.filter(e=>e.type!=='shot'&&e.type!=='enemyShot');
    const travel=Math.max(0,...visuals.map(e=>e.delay+e.travel));
    events.push({time,state:step.before,effects:visuals});
    for(const e of flights)if(e.damage>0||e.miss)impacts.push({...e,type:e.miss?'miss':'impact',style:undefined,from:e.to});
    const deaths=step.after.enemies.filter(e=>e.hp<=0&&step.before.enemies.some(b=>b.id===e.id&&b.hp>0));
    if(step.before.player.hp>0&&step.after.player.hp<=0)deaths.push({...step.after.player,type:'player'});
    // A brief impact flash precedes the grey corpse's settling motion.
    for(const dead of deaths)impacts.push({type:'fall',actorType:dead.type,from:{x:dead.x,y:dead.y},to:{x:dead.x,y:dead.y},damage:0});
    time+=travel;
    events.push({time,state:step.after,effects:impacts.map(e=>({...e,quiet:reduceMotion}))});
    const burstContinues=flights.some(e=>['smg','lmg','thunder'].includes(e.weaponId))&&steps[index+1]?.effects.some(e=>e.type==='shot'&&['smg','lmg','thunder'].includes(e.weaponId));
    time+=reduceMotion?120:deaths.length?DEATH_MS:burstContinues?40:IMPACT_MS;
  }
  return {events,duration:time};
}

// Driven by visible animation frames, not wall-clock timers. Hidden/landscape
// pauses cannot skip a death frame and immediately cover it with a modal.
export class Playback {
  constructor(plan,emit){this.plan=plan;this.emit=emit;this.elapsed=0;this.index=0;this.done=false;}
  advance(milliseconds){
    if(this.done)return;
    this.elapsed+=Math.max(0,Math.min(milliseconds,100));
    while(this.index<this.plan.events.length&&this.plan.events[this.index].time<=this.elapsed)this.emit(this.plan.events[this.index++]);
    this.done=this.elapsed>=this.plan.duration;
  }
}
