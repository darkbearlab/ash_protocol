import {grenadeTotal} from '../src/throwables.js';
import {isContainer} from '../src/containers.js';
import {AMMUNITION,itemAmmo,TERMINAL_AMMO} from '../src/ammunition.js';
// Headless gameplay agent. Uses only legal public actions; no stat/map mutation.
// It knows the floor plan for routing, so win rate is a regression signal, not player telemetry.
import {Game,distance,WEAPONS} from '../src/engine.js';
import {pathToFileURL} from 'node:url';

export function route(game,goal,{ignoreEnemies=false}={}) {
  const p=game.player,queue=[{x:p.x,y:p.y,first:null}],seen=new Set([`${p.x},${p.y}`]);
  for(let i=0;i<queue.length;i++) {
    const q=queue[i];if(distance(q,goal)===0)return q.first;
    for(const [dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]) {
      const x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
      if(!game.canRoute(q,{x,y})||!game.passable(x,y)||seen.has(k)||(!ignoreEnemies&&game.enemies.some(e=>e.hp>0&&e.x===x&&e.y===y)))continue;
      if(game.hazards.some(h=>h.x===x&&h.y===y))continue;
      seen.add(k);queue.push({x,y,first:q.first||[dx,dy]});
    }
  }return null;
}
function safeMove(g,predicate) {
  const p=g.player;
  return [[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy,step:[dx,dy]})).filter(n=>g.passable(n.x,n.y)&&g.canCross(p,n)&&!g.hazards.some(h=>distance(h,n)===0)&&!g.enemies.some(e=>e.hp>0&&distance(e,n)===0)&&predicate(n)).sort((a,b)=>g.visibleEnemies.filter(e=>e.charge&&distance(e,a)<=1).length-g.visibleEnemies.filter(e=>e.charge&&distance(e,b)<=1).length)[0]?.step;
}
export function play(seed,maxActions=1800,character='soldier') {
  const g=new Game(seed,[],0,character);let invalid=0,actions=0;
  const act=(type,arg)=>{actions++;if(!g.action(type,arg))invalid++;};
  for(let i=0;i<maxActions&&g.status==='playing';i++) {
    const p=g.player;
    if(g.pendingPerks){const rank={damage:70,armor:60,health:p.hp<70?100:50,med:p.meds<2?85:35,hazmat:15,blast:10,medic:35,scavenger:20};g.choosePerk([...g.perkChoices].sort((a,b)=>rank[b.id]-rank[a.id])[0].id);continue;}
    const marked=g.marks.find(m=>distance(p,m)<=1);
    if(marked){const step=safeMove(g,n=>distance(n,marked)>distance(p,marked));if(step){act('move',step);continue;}}
    const bomber=g.visibleEnemies.find(e=>e.type==='bomber'&&distance(e,p)<=1);
    if(bomber){act('wait');continue;}
    if(p.hp<=p.maxHp-45&&p.meds>0){act('heal');continue;}
    const targets=g.visibleEnemies.filter(e=>distance(p,e)<=g.weapon.range).sort((a,b)=>Number(b.charge)-Number(a.charge)||distance(a,p)-distance(b,p));
    const grenade=targets.find(e=>distance(p,e)>2&&distance(p,e)<=5&&(e.hp>=75||g.visibleEnemies.filter(o=>distance(o,e)<=2).length>=2));
    if(grenade&&p.grenades>0){if(p.prepared.grenade!=='frag')act('prepare',{category:'grenade',id:'frag'});act('grenade',grenade);continue;}
    if(targets.length&&p.ammo[p.weapon]>0){g.target=targets[0].id;
      // Darkness makes unaimed fire waste scarce ammo. Brace using the same public wait as a player.
      if(g.accuracy(p,targets[0]).darkPenalty&&!p.focus){act('wait');continue;}
      act('fire');continue;}
    if(p.ammo[p.weapon]<g.weapon.mag&&p[g.reserveKey()]>0&&(!targets.length||p.ammo[p.weapon]===0)){act('reload');continue;}
    if(p.ammo[p.weapon]===0&&p[g.reserveKey()]===0){const other=p.owned.find(index=>index!==p.weapon&&(p.ammo[index]>0||p[g.reserveKey(g.weaponAt(index))]>0));if(other!==undefined){act('weapon',other);continue;}}
    if(!g.visibleEnemies.length&&p.scrap>=25+p.upgrades[p.weapon]*15&&p.upgrades[p.weapon]<3){act('upgrade');continue;}
    if(g.canTouch(g.end)&&!g.bossAlive){act('interact');continue;}
    if(g.nearbyTerminal){if(p.scrap>=15&&p.hp<p.maxHp-55){act('terminal','heal');continue;}const offer=TERMINAL_AMMO[g.weapon.ammoType];if(p.scrap>=offer.cost&&p[g.reserveKey()]<Math.min(g.ammoCapacity(g.weapon.ammoType),g.weapon.mag*2)){act('terminal',g.weapon.ammoType);continue;}}
    const needed=item=>{const type=itemAmmo(item.type),weapons=p.owned.map(i=>g.weaponAt(i)).filter(w=>w.ammoType===type);return (type&&weapons.length&&p[AMMUNITION[type].key]<Math.min(g.ammoCapacity(type),Math.max(...weapons.map(w=>w.mag))*2))||(item.type==='med'&&p.meds<1)||(item.type==='grenade'&&p.grenades<1&&grenadeTotal(p)<g.ammoCapacity('grenade'));};
    const crates=g.props.filter(c=>isContainer(c)&&!c.opened&&c.contents.some(needed));
    const nearby=crates.find(c=>g.canTouch(c));if(nearby){act('openContainer',nearby.id);continue;}
    const needs=[...g.items.filter(needed),...crates].sort((a,b)=>distance(p,a)-distance(p,b));
    const boss=g.enemies.find(e=>(e.type==='boss'||e.type==='warden')&&e.hp>0);
    let goal=needs.find(n=>route(g,n))||g.end;
    if(boss&&distance(p,g.end)<=5){const adjacent=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:boss.x+dx,y:boss.y+dy}));goal=adjacent.find(n=>route(g,n))||g.end;}
    // Approach an occupied corridor instead of waiting because the entire route is blocked.
    // Still never issue a move into an enemy; a closed door may be opened from here.
    const approach=route(g,goal,{ignoreEnemies:true});
    const next=approach?{x:p.x+approach[0],y:p.y+approach[1]}:null;
    const step=route(g,goal)||(next&&(!g.canCross(p,next)||!g.enemies.some(e=>e.hp>0&&distance(e,next)===0))?approach:null);
    if(step)act('move',step);
    else if(g.visibleEnemies.length){const e=g.visibleEnemies[0],near=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>route(g,n));if(near)act('move',route(g,near));else act('wait');}
    else act('wait');
  }
  return {seed,status:g.status,floor:g.floor,turn:g.turn,hp:g.player.hp,kills:g.player.kills,actions,invalid,...(g.status==='playing'?{diagnostic:{position:{x:g.player.x,y:g.player.y},ammo:g.player.ammo,reserve:g.player.reserve,enemies:g.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp})),logs:g.logs.slice(0,3)}}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const count=Number(process.argv[2]||24),character=process.argv[3]||'soldier';const rows=Array.from({length:count},(_,i)=>play(i+1,1800,character));console.table(rows);console.log(JSON.stringify({character,wins:rows.filter(r=>r.status==='won').length,total:count,stuck:rows.filter(r=>r.status==='playing').length,invalid:rows.reduce((n,r)=>n+r.invalid,0)}));}
