// Muzzle flashes (3.116.0, user request; proposal in qa/results/2026-09-17-claude-3.115.0-camera-vhs-supply.md section 6).
// Drawn in code as pixel cells, one look per weapon family, at the muzzle instead of the shooter's centre. The cells are
// laid along one of eight directions in whole-pixel steps, so the flash stays on the pixel grid instead of rotating art.
// Cosmetic only: the renderer draws a flash only for a shooter the player can see.
const W='#fff6d8',H='#ffd27a',F='#f39a4a',E='#c8552e',PW='#e8fffb',PH='#8ae9da',PF='#3fb8b0',S='#8b918aa0';
// [along the barrel, across it, colour]; a cell off the axis is mirrored to the other side.
const mirror=cells=>Object.freeze(cells.flatMap(([a,b,c])=>b?[[a,b,c],[a,-b,c]]:[[a,0,c]]));
export const MUZZLE_FLASHES=Object.freeze({
  rifle:{frameMs:30,glow:'#ffc86a',frames:[mirror([[0,0,W],[1,0,W],[2,0,H],[1,1,H],[3,0,F]]),mirror([[0,0,H],[1,0,H],[2,0,F],[1,1,F],[3,0,E]]),mirror([[0,0,F],[1,0,E]])]},
  smg:{frameMs:25,glow:'#ffc86a',frames:[mirror([[0,0,W],[1,0,H],[2,0,F],[1,1,F]]),mirror([[0,0,F],[1,0,E]])]},
  shotgun:{frameMs:35,glow:'#ffb45a',frames:[
    mirror([[0,0,W],[1,0,W],[1,1,H],[2,0,H],[2,1,H],[3,0,F],[3,2,F],[4,1,F],[4,3,E]]),
    mirror([[0,0,H],[1,0,H],[1,1,F],[2,1,F],[3,0,F],[3,2,E],[4,2,E],[5,0,E],[5,3,E],[6,1,E]]),
    mirror([[1,0,F],[2,0,E],[3,2,E],[5,1,E],[6,3,E],[7,0,E]])]},
  sniper:{frameMs:35,glow:'#ffd88a',frames:[
    mirror([[0,0,W],[1,0,W],[2,0,W],[3,0,H],[4,0,H],[5,0,F],[6,0,F],[1,1,H]]),
    mirror([[0,0,H],[1,0,H],[2,0,F],[3,0,F],[4,0,E],[5,0,E]]),
    mirror([[0,0,F],[1,0,E]])]},
  plasma:{frameMs:40,glow:'#6fe6d8',frames:[
    mirror([[0,0,PW],[1,0,PW],[0,1,PH],[1,1,PH],[2,0,PH]]),
    mirror([[1,0,PW],[0,2,PH],[1,2,PH],[2,1,PH],[3,0,PH],[-1,1,PF]]),
    mirror([[0,3,PF],[2,2,PF],[3,1,PF],[4,0,PF]])]},
  launcher:{frameMs:45,glow:'#ffb45a',frames:[
    mirror([[0,0,W],[1,0,H],[1,1,F],[2,0,F]]),
    mirror([[0,0,F],[1,0,E],[2,1,S],[3,0,S]]),
    mirror([[1,1,S],[2,0,S],[3,1,S],[4,0,S],[3,2,S]])]},
});
const DIRECTIONS=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
export function barrelAxes(angle){
  const [dx,dy]=DIRECTIONS[((Math.round(angle/(Math.PI/4))%8)+8)%8];
  return {along:[dx,dy],across:[-dy,dx]};
}
export const flashLength=name=>MUZZLE_FLASHES[name]?MUZZLE_FLASHES[name].frameMs*MUZZLE_FLASHES[name].frames.length:0;
// Reduced motion holds the first frame this long instead of animating.
export const STILL_MS=90;
// Cells for one moment of a flash, relative to the muzzle point, in pixels; empty before it starts and once it is over.
export function flashCells(name,angle,elapsed,{unit=2,still=false}={}){
  const flash=MUZZLE_FLASHES[name];if(!flash||elapsed<0)return [];
  const frame=flash.frames[still?(elapsed<STILL_MS?0:-1):Math.floor(elapsed/flash.frameMs)];if(!frame)return [];
  const {along,across}=barrelAxes(angle);
  return frame.map(([a,b,color])=>({x:(along[0]*a+across[0]*b)*unit||0,y:(along[1]*a+across[1]*b)*unit||0,color}));
}
// The muzzle sits a little under half a tile out from the shooter's centre; a diagonal is shortened to the same reach.
export const flashUnit=tile=>Math.max(2,Math.round(tile/19));
export function muzzlePoint(from,angle,tile){
  const {along}=barrelAxes(angle),reach=tile*.38*(along[0]&&along[1]?Math.SQRT1_2:1);
  return {x:Math.round(from.x+along[0]*reach),y:Math.round(from.y+along[1]*reach)};
}
