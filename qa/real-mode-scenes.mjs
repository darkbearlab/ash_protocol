import {Game} from '../src/game.js';
import {affixArena,sceneEnemy} from './enemy-affix-scenes.mjs';
export function realModeScenes(){
 const standard=affixArena();sceneEnemy(standard,'raider',['grenadier','suppressor']);
 const raw=JSON.parse(standard.serialize());raw.data.realMode=true;const real=Game.restore(JSON.stringify(raw));
 const heard=Game.restore(real.serialize());for(let y=0;y<27;y++)heard.grid[y][12]=0;heard.enemies[0].alert=true;heard.enemies[0].lastKnown={x:10,y:10};heard.reveal();
 const distant=Game.restore(real.serialize());distant.enemies[0].x=22;distant.enemies[0].alert=true;distant.enemies[0].lastKnown={x:10,y:10};distant.reveal();
 const settlement=Game.restore(real.serialize());settlement.protocol.earned=29;
 return {standard,real,heard,distant,settlement};
}
