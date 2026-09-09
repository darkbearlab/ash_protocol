// Presentation observes one synchronous turn. Snapshots never roll back rules or RNG.
const observers=new WeakMap();
export function snapshot(game){
  const {rng,effects,...data}=game;
  return Object.assign(Object.create(Object.getPrototypeOf(game)),structuredClone(data),{effects:[]});
}
export function presentStep(game,action){
  const steps=observers.get(game);
  if(!steps)return action();
  const before=snapshot(game),start=game.effects.length;
  const result=action();
  if(game.effects.length>start)steps.push({before,after:snapshot(game),effects:structuredClone(game.effects.slice(start))});
  return result;
}
export function captureAction(game,action){
  const steps=[];observers.set(game,steps);
  try{return {success:action(),steps};}finally{observers.delete(game);}
}
export const FLIGHT_MS=280,IMPACT_MS=220;
export function planPresentation(steps,{reduceMotion=false}={}){
  const events=[];let time=0;
  for(const step of steps){
    const flights=step.effects.filter(e=>e.type==='shot'||e.type==='enemyShot');
    const impacts=step.effects.filter(e=>e.type!=='shot'&&e.type!=='enemyShot');
    const travel=flights.length?(reduceMotion?90:FLIGHT_MS):0;
    events.push({time,state:step.before,effects:flights.map(e=>({...e,damage:0,miss:false,missPath:e.miss,travel,quiet:reduceMotion}))});
    // Damage and MISS labels belong to arrival, never the muzzle flash.
    for(const e of flights)if(e.damage>0||e.miss)impacts.push({...e,type:e.miss?'miss':'impact',style:undefined,from:e.to});
    time+=travel;
    events.push({time,state:step.after,effects:impacts.map(e=>({...e,quiet:reduceMotion}))});
    time+=reduceMotion?120:IMPACT_MS;
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
