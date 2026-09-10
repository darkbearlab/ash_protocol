import {barrierBetween,edgeBlocks} from './barriers.js';
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
// Visible ground topology, not a flood fill, enemy outline, or cover guarantee.
export function movementBoundaries(game){
  const edges=new Map();
  for(const key of game.visibleTiles||[]){
    const [x,y]=key.split(',').map(Number);if(!game.passable(x,y))continue;
    for(const [dx,dy]of directions){
      const next={x:x+dx,y:y+dy},barrier=barrierBetween(game.barriers,{x,y},next);
      const blocked=edgeBlocks(barrier)&&game.visible(barrier)||game.grid[next.y]?.[next.x]!==1||
        game.visibleTiles.has(next.x+','+next.y)&&Boolean(game.solid(next.x,next.y));
      if(!blocked)continue;
      const mx=x+dx*.5,my=y+dy*.5;
      edges.set(mx+','+my,{x1:mx-(dy?0.5:0),y1:my-(dx?0.5:0),x2:mx+(dy?0.5:0),y2:my+(dx?0.5:0)});
    }
  }
  return [...edges.values()];
}
