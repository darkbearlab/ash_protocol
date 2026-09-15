import test from 'node:test';
import assert from 'node:assert/strict';
import {createKillhouse,isNoncombatant} from '../src/engine.js';
import {tutorialCue,nextPrompt,promptDue,TUTORIAL_PROMPTS} from '../src/killhouse-ui.js';

// Tutorial fixes from play reports (3.88.1): lesson cards before the door, and one researcher who cannot open room 5.
const inRoom=(r,q)=>q.x>=r.x&&q.x<r.x+r.w&&q.y>=r.y&&q.y<r.y+r.h;
function cueTiles(g){
 const p=g.player,home={x:p.x,y:p.y},cues=[];
 for(let y=0;y<g.grid.length;y++)for(let x=0;x<g.grid[y].length;x++)if(g.grid[y][x]===1){Object.assign(p,{x,y});const room=tutorialCue(g);if(room!==null)cues.push({room,x,y});}
 Object.assign(p,home);return cues;
}
function route(g,from,to){
 const id=q=>`${q.x},${q.y}`,prev=new Map([[id(from),null]]),queue=[from];
 while(queue.length){const c=queue.shift();if(c.x===to.x&&c.y===to.y)break;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:c.x+dx,y:c.y+dy};if(g.grid[n.y]?.[n.x]===1&&!prev.has(id(n))){prev.set(id(n),c);queue.push(n);}}}
 const path=[];for(let c=to;c&&id(c)!==id(from);c=prev.get(id(c)))path.unshift(c);return path;
}

test('each lesson card fires once, on the tile before its door, before anyone in that room has noticed the player',()=>{
 const g=createKillhouse({mode:'tutorial'}),p=g.player,shown=new Set(),cues=cueTiles(g);
 assert.deepEqual(cues.map(c=>c.room),[1,2,3,4,5]);
 assert.equal(nextPrompt(g,g.takeRoomEvents(),shown).title,TUTORIAL_PROMPTS[0].title);
 for(const cue of cues){
  const room=g.rooms[cue.room];let card=null;
  for(const e of g.enemies)if(g.rooms.slice(0,cue.room).some(r=>inRoom(r,e)))e.hp=0;
  for(const cell of route(g,{x:p.x,y:p.y},cue)){
   for(let tries=0;tries<3&&!(p.x===cell.x&&p.y===cell.y);tries++){g.action('move',[cell.x-p.x,cell.y-p.y]);card??=nextPrompt(g,g.takeRoomEvents(),shown);}
   if(card)break;
  }
  assert.deepEqual({x:p.x,y:p.y},{x:cue.x,y:cue.y},`room ${cue.room}: card tile`);
  assert.equal(card?.title,TUTORIAL_PROMPTS[cue.room].title);
  assert.equal(p.hp,p.maxHp,`room ${cue.room}: no damage before the card`);
  assert.ok(g.enemies.filter(e=>e.hp>0&&inRoom(room,e)).every(e=>!e.alert),`room ${cue.room}: nobody inside is alerted yet`);
  const door=g.barriers.find(b=>b.id===`edge-kh-${cue.room-1}-${cue.room}`);if(door)assert.equal(door.open,false,`room ${cue.room}: door still shut`);
 }
 // Walking into the room later raises its entry event, which must not repeat the card.
 Object.assign(p,{x:g.rooms[5].x+1,y:g.rooms[5].cy});g.observeRoom();
 assert.equal(promptDue(g,shown),false);assert.equal(nextPrompt(g,g.takeRoomEvents(),shown),null);
});

test('the researcher room keeps one researcher on the left, and room 5 stays shut while the player fights there',()=>{
 const g=createKillhouse({mode:'tutorial'}),r4=g.rooms[4],r5=g.rooms[5],p=g.player,researchers=g.enemies.filter(isNoncombatant);
 assert.equal(researchers.length,1);assert.ok(inRoom(r4,researchers[0])&&researchers[0].x<r4.cx,'left half of room 4');
 for(const e of g.enemies)if(!inRoom(r4,e)&&!inRoom(r5,e))e.hp=0;
 for(const b of g.barriers)if(b.id!=='edge-kh-4-5')b.open=true;
 p.maxHp=p.hp=99999;Object.assign(p,{x:7,y:17});g.reveal();
 const door=g.barriers.find(b=>b.id==='edge-kh-4-5');
 for(let t=0;t<30;t++)t<3?g.action('move',[0,1]):g.action('wait');
 assert.equal(door.open,false,'nobody opened room 5');
 assert.ok(g.enemies.filter(e=>e.hp>0&&!isNoncombatant(e)).every(e=>inRoom(r4,e)||inRoom(r5,e)),'nobody from room 5 came out');
});
