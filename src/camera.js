// Keep equal north/east/south/west framing around the player. Zoom intent never
// hides a locked target or grenade landing tile; projection remains cardinal.
// `extra` (3.115.0) holds points that must stay framed for a moment, such as an enemy that has just been killed.
export function cameraFrame(player,target,aim,width,height,zoom=1,extra=[]) {
  const reach=Math.max(0,...[target,aim,...extra].filter(Boolean).map(p=>Math.max(Math.abs(p.x-player.x),Math.abs(p.y-player.y))));
  const extent=Math.max(4.5,reach+1.25),side=Math.min(width,height);
  const tile=Math.min(38*zoom,side/(extent*2),reach?(side/2-20)/reach:Infinity);
  return {x:player.x,y:player.y,tile};
}

// Zoom easing (3.115.0, user request). Switching targets, a kill and an enemy coming into view ease the zoom instead of
// jumping. `key` names what is being framed (the locked target, an aim mode, a kill being held, the zoom buttons) and
// `want` is the tile size that frames it exactly. For the same key the camera still zooms out whenever the framing no
// longer fits, but only zooms back in for a large change: a target that steps closer every turn must not pump the
// board in and out (user: small repeated zooms hurt the eyes). Zooming out is quicker than zooming in, so a target
// that walks away is not left outside the frame for long.
export const CAMERA_TUNING=Object.freeze({zoomOutMs:90,zoomInMs:170,zoomInRatio:1.4});
export function zoomStep(state,{key,want,dt=0,reduceMotion=false}){
  if(!state)return {key,goal:want,tile:want};
  const goal=key!==state.key||want<state.goal||want>=state.goal*CAMERA_TUNING.zoomInRatio?want:state.goal;
  if(reduceMotion)return {key,goal,tile:goal};
  const ms=goal<state.tile?CAMERA_TUNING.zoomOutMs:CAMERA_TUNING.zoomInMs;
  let tile=state.tile+(goal-state.tile)*(1-Math.exp(-Math.max(0,dt)/ms));
  if(Math.abs(goal-tile)<.02)tile=goal;
  return {key,goal,tile};
}
