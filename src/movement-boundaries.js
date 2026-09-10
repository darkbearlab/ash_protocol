import {barrierBetween,edgeBlocks} from './barriers.js';
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
const key=(x,y)=>x+','+y;
// Open contour: doors and unknown space are passages, never closing caps.
export function movementBoundaries(game){
  const edges=new Map(),visible=game.visibleTiles||new Set();
  for(const cell of visible){
    const [x,y]=cell.split(',').map(Number);if(!game.passable(x,y))continue;
    for(const [dx,dy]of directions){
      const next={x:x+dx,y:y+dy},barrier=barrierBetween(game.barriers,{x,y},next);
      if(barrier?.type==='door')continue;
      const blocked=edgeBlocks(barrier)&&game.visible(barrier)||
        game.grid[next.y]?.[next.x]!==1||visible.has(key(next.x,next.y))&&Boolean(game.solid(next.x,next.y));
      if(!blocked)continue;
      const mx=x+dx*.5,my=y+dy*.5,tx=dy?1:0,ty=dx?1:0;
      edges.set(key(mx,my),{x1:mx-tx*.5,y1:my-ty*.5,x2:mx+tx*.5,y2:my+ty*.5});
    }
  }
  return [...edges.values()];
}

export function boundaryOpacityPercent(value){
  if(value===null||value===undefined||value===''||!['number','string'].includes(typeof value))return 80;
  const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):80;
}
