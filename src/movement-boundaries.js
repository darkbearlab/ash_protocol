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
      edges.set(key(mx,my),{x1:mx-tx*.5,y1:my-ty*.5,x2:mx+tx*.5,y2:my+ty*.5,x,y,tx,ty});
    }
  }
  const degree=new Map();for(const e of edges.values())for(const n of [1,2]){const k=key(e['x'+n],e['y'+n]);degree.set(k,(degree.get(k)||0)+1);}
  return [...edges.values()].map(e=>{
    const line={x1:e.x1,y1:e.y1,x2:e.x2,y2:e.y2};
    for(const [n,sign]of [[1,-1],[2,1]]){
      if(degree.get(key(e['x'+n],e['y'+n]))!==1)continue;
      const next={x:e.x+sign*e.tx,y:e.y+sign*e.ty},door=barrierBetween(game.barriers,e,next);
      // A short straight continuation is schematic: never inspect hidden geometry.
      if(!visible.has(key(next.x,next.y))||door?.type==='door'&&game.visible(door)){
        line['x'+n]+=sign*e.tx*.35;line['y'+n]+=sign*e.ty*.35;
      }
    }
    return line;
  });
}
