// Keep equal north/east/south/west framing around the player. Zoom intent never
// hides a locked target or grenade landing tile; projection remains cardinal.
export function cameraFrame(player,target,aim,width,height,zoom=1) {
  const reach=Math.max(0,...[target,aim].filter(Boolean).map(p=>Math.max(Math.abs(p.x-player.x),Math.abs(p.y-player.y))));
  const extent=Math.max(4.5,reach+1.25),side=Math.min(width,height);
  const tile=Math.min(38*zoom,side/(extent*2),reach?(side/2-20)/reach:Infinity);
  return {x:player.x,y:player.y,tile};
}
