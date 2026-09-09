// Persistent cosmetic evidence, independent of simulation RNG and replay frames.
export const TRACE_LIMIT=192,TRACE_CELL_LIMIT=3;
export const TRACE_KINDS=['blood','oil','casing','shell','scorch','chip','debris'];
const hash=text=>{let n=2166136261;for(const ch of text)n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0;};
export function addTrace(game,point,kind){
  const x=Math.round(point.x),y=Math.round(point.y);
  if(!TRACE_KINDS.includes(kind)||game.grid[y]?.[x]!==1)return;
  const n=hash(`${game.seed}:${game.floor}:${game.turn}:${x}:${y}:${kind}`);
  game.traces=game.traces.filter(t=>!(t.x===x&&t.y===y&&t.kind===kind));
  const same=game.traces.filter(t=>t.x===x&&t.y===y);
  if(same.length>=TRACE_CELL_LIMIT)game.traces.splice(game.traces.indexOf(same[0]),1);
  game.traces.push({x,y,kind,variant:n%4,rotation:(n>>>3)%4});
  if(game.traces.length>TRACE_LIMIT)game.traces.splice(0,game.traces.length-TRACE_LIMIT);
}
export function spentCase(game,point,ammo){if(['pistol','rifle','shell'].includes(ammo))addTrace(game,point,ammo==='shell'?'shell':'casing');}
export function validTraces(traces,grid){
  if(!Array.isArray(traces)||traces.length>TRACE_LIMIT)return false;
  const ids=new Set(),cells=new Map();
  return traces.every(t=>{
    if(!t||!TRACE_KINDS.includes(t.kind)||!Number.isInteger(t.x)||!Number.isInteger(t.y)||grid[t.y]?.[t.x]!==1||!Number.isInteger(t.variant)||t.variant<0||t.variant>3||!Number.isInteger(t.rotation)||t.rotation<0||t.rotation>3)return false;
    const cell=`${t.x},${t.y}`,id=`${cell}:${t.kind}`,count=(cells.get(cell)||0)+1;
    if(ids.has(id)||count>TRACE_CELL_LIMIT)return false;ids.add(id);cells.set(cell,count);return true;
  });
}
// Logical 32px patterns drawn on the floor, underneath hazards, loot and actors.
export function drawTrace(ctx,trace,cx,cy,tile){
  const unit=tile/32,oldAlpha=ctx.globalAlpha;
  ctx.save();ctx.translate(Math.round(cx),Math.round(cy));ctx.rotate(trace.rotation*Math.PI/2);ctx.globalAlpha=oldAlpha*.74;
  const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x*unit),Math.round(y*unit),Math.max(1,Math.round(w*unit)),Math.max(1,Math.round(h*unit)));};
  const shift=trace.variant-1;
  if(trace.kind==='blood'||trace.kind==='oil'){
    const color=trace.kind==='blood'?'#54292b':'#172c30',light=trace.kind==='blood'?'#763b37':'#365257';
    rect(-7+shift,1,10,5,color);rect(-4,-2,5,10,color);rect(4,4,3,2,color);rect(-9,-3,2,2,light);rect(-3,2,5,2,light);rect(6,-1+shift,2,2,color);
  }else if(trace.kind==='casing'||trace.kind==='shell'){
    const color=trace.kind==='shell'?'#ae6f49':'#b3a06c';for(let i=0;i<3;i++){const x=-9+i*6,y=5+(i+trace.variant)%3*2;rect(x,y,3,1,color);rect(x,y,1,1,'#e0c592');}
  }else if(trace.kind==='scorch'){
    rect(-8,-5,15,11,'#202822');rect(-5,-8,9,17,'#252a25');rect(-3,-3,6,6,'#14221f');rect(8,shift,2,3,'#30312a');
  }else if(trace.kind==='chip'){
    for(let i=0;i<3;i++){const x=-6+i*5,y=(i+trace.variant)%3*3-4;rect(x,y,2,2,'#15231e');rect(x+1,y+2,2,1,'#68745b');}
  }else{
    for(let i=0;i<4;i++){const x=-9+i*5,y=(i+trace.variant)%3*4-5;rect(x,y,3,2,'#76826b');rect(x+1,y+2,2,2,'#414e42');}
  }
  ctx.restore();
}
