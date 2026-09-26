import {combatStep} from '../src/tactics.js';
import {grenadeTotal} from '../src/throwables.js';
import {isContainer} from '../src/containers.js';
import {AMMUNITION,itemAmmo,TERMINAL_AMMO} from '../src/ammunition.js';
// Headless gameplay agent. Uses only legal public actions; no stat/map mutation.
// It knows the floor plan for routing, so win rate is a regression signal, not player telemetry.
import {Game,distance,terminalReason} from '../src/engine.js';
import {terminalRemaining,terminalSells,upgradeCost,TERMINAL_TUNING} from '../src/terminal.js';
import {pathToFileURL} from 'node:url';
import {isBlack} from '../src/lighting.js';

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
function blastSpot(g,priority){
  const p=g.player,r=g.weapon.range;let best=null,score=0;
  for(let y=p.y-r;y<=p.y+r;y++)for(let x=p.x-r;x<=p.x+r;x++){
    const tile={x,y};
    if(distance(tile,p)>r||distance(tile,p)<2||g.grid[y]?.[x]!==1||!g.visible(tile))continue;
    const caught=g.visibleEnemies.filter(e=>e.hp>0&&distance(e,tile)<=1).length;
    const s=caught*10+(distance(priority,tile)===0?1:0);
    if(s>score){score=s;best=tile;}
  }
  return best;
}
// 3.189.0 survival (docs/SURVIVAL.md): until the exit opens the bot answers a point that is held or has a group on its way,
// nearest first, before any supply detour; with nothing threatened it waits by the nearest standing point.
function survivalThreat(g){const s=g.survival;if(!s||s.open)return null;const p=g.player,pts=s.points.filter(pt=>pt.hp>0&&(pt.pressed||g.enemies.some(e=>e.hp>0&&e.survival?.target===pt.id)));return pts.sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;}
function survivalRest(g){const s=g.survival;if(!s||s.open)return null;const p=g.player;return s.points.filter(pt=>pt.hp>0).sort((a,b)=>distance(p,a)-distance(p,b))[0]||null;}
export function play(seed,maxActions=1800,character='soldier',GameType=Game) {
  const g=new GameType(seed,[],0,character),visited=new Set();let invalid=0,actions=0,huntingBossFloor=null,progress='',detourUntil=0,navigation=null;const visits=new Map();
  // A refused action changes nothing, so the bot would ask for it again forever (3.148.0: swapping with a summon across a
  // low partition). After three refusals in a row it waits a turn instead.
  let refused=0;
  const act=(type,arg)=>{actions++;if(g.action(type,arg)){refused=0;return;}invalid++;if(++refused>=3){refused=0;g.action('wait');}};
  for(let i=0;i<maxActions&&g.status==='playing';i++) {
    const p=g.player;navigation={...p,tactics:navigation?.tactics||null};
    const milestone=g.floor+':'+p.kills;if(milestone!==progress){progress=milestone;visits.clear();detourUntil=0;navigation.tactics=null;}
    const position=p.x+','+p.y;visits.set(position,(visits.get(position)||0)+1);
    // Do not oscillate forever between a quiet silhouette and a supply detour. Commit to advancing.
    if(visits.get(position)>4){detourUntil=g.turn+30;visits.clear();navigation.tactics=null;}
    if(g.pendingPerks){const rank={damage:70,armor:60,health:p.hp<70?100:50,med:p.meds<2?85:35,hazmat:15,blast:10,medic:35,scavenger:20,plate_rack:60,mod_mastery:45,skirmish:40,steady:25,plating:30};/* 3.150.0: the 升級 D perks too */g.choosePerk([...g.perkChoices].sort((a,b)=>rank[b.id]-rank[a.id])[0].id);continue;}
    // 3.178.0: in the black nobody is seen, not even next to you, so the bot switches its flashlight on there (free) and
    // off again in the light, as a player would; the light gives it away too.
    // Its own light makes its tile dim, so the tile is judged with the flashlight off.
    const on=p.flashlight,lingers=p.lightLingers;Object.assign(p,{flashlight:false,lightLingers:false});const black=isBlack(g,p);Object.assign(p,{flashlight:on,lightLingers:lingers});
    if(on!==black){act('flashlight');continue;}
    // 3.188.0: a stun grenade reaches the 3×3 around where it lands: step out of it, or brace (wait) with no way out.
    const within=(q,m)=>m.stun?Math.max(Math.abs(q.x-m.x),Math.abs(q.y-m.y))<=1:distance(q,m)<=1;
    const marked=g.marks.find(m=>within(p,m));
    if(marked){const step=safeMove(g,n=>marked.stun?!within(n,marked):distance(n,marked)>distance(p,marked));if(step){act('move',step);continue;}if(marked.stun){act('wait');continue;}}
    const bomber=g.visibleEnemies.find(e=>e.type==='bomber'&&distance(e,p)<=1);
    if(bomber){act('wait');continue;}
    if(p.hp<=p.maxHp-45&&p.meds>0){act('heal');continue;}
    const targets=g.visibleEnemies.filter(e=>distance(p,e)<=g.weapon.range&&g.shotClear(p,e)).sort((a,b)=>Number(b.charge)-Number(a.charge)||distance(a,p)-distance(b,p));
    // A grenade lands on floor only: a drone hovering over a pit (3.164.0) is not a landing spot.
    const grenade=targets.find(e=>g.grid[e.y]?.[e.x]===1&&distance(p,e)>2&&distance(p,e)<=5&&(e.hp>=75||g.visibleEnemies.filter(o=>distance(o,e)<=2).length>=2));
    if(grenade&&p.grenades>0){if(p.prepared.grenade!=='frag')act('prepare',{category:'grenade',id:'frag'});act('grenade',grenade);continue;}
    // 3.141.0: a drop-only affix can spend two rounds a shot; with fewer loaded the gun counts as empty.
    const loaded=p.ammo[p.weapon]>=(g.weapon.shotCost||1);
    if(targets.length&&loaded){g.target=targets[0].id;
      // Darkness makes unaimed fire waste scarce ammo. Brace using the same public wait as a player.
      // 3.111.0: the precision rifle needs that wait too, but not with something close enough to punish it.
      const aim=g.accuracy(p,targets[0]);
      if((aim.darkPenalty||aim.aimPenalty&&!g.visibleEnemies.some(e=>distance(e,p)<=2))&&!p.focus){act('wait');continue;}
      // 3.111.0: a point-target launcher aims at the tile that catches the most enemies without catching the bot.
      if(g.weapon.pointTarget){const spot=blastSpot(g,targets[0]);if(spot){act('launch',spot);continue;}}
      act('fire');continue;}
    if(p.ammo[p.weapon]<g.weapon.mag&&p[g.reserveKey()]>0&&(!targets.length||!loaded)){act('reload');continue;}
    if(!loaded&&p[g.reserveKey()]===0){const other=p.owned.find(index=>index!==p.weapon&&(p.ammo[index]>0||p[g.reserveKey(g.weaponAt(index))]>0));if(other!==undefined){act('weapon',other);continue;}}
    // A visible silhouette may now be protected by a quiet corner. Reposition instead of repeatedly firing.
    const memory=!g.visibleEnemies.length&&navigation.tactics?.until>=g.turn?navigation.tactics.target:null;
    const sheltered=g.visibleEnemies.find(e=>!g.shotClear(p,e))||memory;
    if(sheltered&&loaded&&g.turn>=detourUntil){const plan=combatStep(g,navigation,sheltered,{range:g.weapon.range,melee:g.weapon.melee,investigate:sheltered===memory});if(plan?.step){act('move',[plan.step.x-p.x,plan.step.y-p.y]);continue;}}
    if(g.canTouch(g.end)&&!g.bossAlive&&!(g.survival&&!g.survival.open)){act('interact');continue;}
    // 3.120.0: terminals keep a credit instead of serving once, and weapon modifications are bought there (scrap only; the
    // bot never trades anything in).
    if(g.nearbyTerminal){if(p.hp<p.maxHp-55&&!terminalReason(g,'heal')){act('terminal','heal');continue;}if(!g.visibleEnemies.length&&!terminalReason(g,`upgrade:${p.weapon}`)){act('terminal',`upgrade:${p.weapon}`);continue;}const offer=TERMINAL_AMMO[g.weapon.ammoType];if(offer&&!terminalReason(g,g.weapon.ammoType)&&p[g.reserveKey()]<Math.min(g.ammoCapacity(g.weapon.ammoType),g.weapon.mag*2)){act('terminal',g.weapon.ammoType);continue;}
      // 3.135.0: the next floor may have no medical terminal, so a medical one is where medkits are stocked up.
      if(!g.visibleEnemies.length&&p.meds<3&&!terminalReason(g,'med')){act('terminal','med');continue;}
      visited.add(`${g.floor}:${g.nearbyTerminal.id}`);}   // stood here and bought nothing: not worth another detour
    const needed=item=>{const type=itemAmmo(item.type),weapons=p.owned.map(i=>g.weaponAt(i)).filter(w=>w.ammoType===type);return (type&&weapons.length&&p[AMMUNITION[type].key]<Math.min(g.ammoCapacity(type),Math.max(...weapons.map(w=>w.mag))*2))||(item.type==='med'&&p.meds<1)||(item.type==='grenade'&&p.grenades<1&&grenadeTotal(p)<g.ammoCapacity('grenade'));};
    const crates=g.props.filter(c=>isContainer(c)&&!c.opened&&c.contents.some(needed));
    const nearby=crates.find(c=>g.canTouch(c));if(nearby){act('openContainer',nearby.id);continue;}
    // 3.135.0: terminals stand in supply rooms now, off the main route, so a terminal worth the detour is a need too: a
    // medical one when hurt or short of medkits, an arms one while the weapon can still be modified.
    const worth=t=>!visited.has(`${g.floor}:${t.id}`)&&terminalRemaining(t)>=10&&((terminalSells(t,'med')&&(p.hp<p.maxHp-55||p.meds<3)&&p.scrap>=TERMINAL_TUNING.medPrice)||(terminalSells(t,`upgrade:${p.weapon}`)&&(p.upgrades[p.weapon]||0)<TERMINAL_TUNING.upgradeMax&&p.scrap>=upgradeCost(p.upgrades[p.weapon]||0)));
    const desks=g.props.filter(t=>t.type==='terminal'&&!t.used&&worth(t)).flatMap(t=>[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:t.x+dx,y:t.y+dy})));
    const needs=[...g.items.filter(needed),...crates,...desks].sort((a,b)=>distance(p,a)-distance(p,b));
    const boss=g.enemies.find(e=>(e.type==='boss'||e.type==='warden')&&e.hp>0);
    const threat=survivalThreat(g);
    let goal=g.turn<detourUntil?g.end:threat||needs.find(n=>route(g,n))||survivalRest(g)||g.end;
    // A detour can leave the five-tile trigger radius. Keep pursuing that boss
    // instead of alternating the exit route and boss route on consecutive turns.
    if(boss&&distance(p,g.end)<=5)huntingBossFloor=g.floor;
    if(boss&&huntingBossFloor===g.floor){const adjacent=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:boss.x+dx,y:boss.y+dy}));goal=adjacent.find(n=>route(g,n))||g.end;}
    // Approach an occupied corridor instead of waiting because the entire route is blocked.
    // Still never issue a move into an enemy; a closed door may be opened from here.
    const approach=route(g,goal,{ignoreEnemies:true});
    const next=approach?{x:p.x+approach[0],y:p.y+approach[1]}:null;
    // 3.152.0: while committed to a goal, route around walls only. An enemy pacing in a corridor (a sniper looking for a
    // shot) flips an enemy-avoiding route every turn, and the bot walks back and forth with it until the run runs out.
    const committed=g.turn<detourUntil;
    const step=(committed?null:route(g,goal))||(next&&(!g.canCross(p,next)||!g.enemies.some(e=>e.hp>0&&distance(e,next)===0))?approach:null);
    if(step)act('move',step);
    else if(g.visibleEnemies.length){const e=g.visibleEnemies[0],near=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>route(g,n));if(near)act('move',route(g,near));else act('wait');}
    else act('wait');
  }
  return {seed,status:g.status,floor:g.floor,turn:g.turn,hp:g.player.hp,kills:g.player.kills,actions,invalid,...(g.status==='playing'?{diagnostic:{position:{x:g.player.x,y:g.player.y},ammo:g.player.ammo,reserve:g.player.reserve,enemies:g.enemies.filter(e=>e.hp>0).map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp})),logs:g.logs.slice(0,3)}}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const count=Number(process.argv[2]||24),character=process.argv[3]||'soldier';const rows=Array.from({length:count},(_,i)=>play(i+1,1800,character));console.table(rows);console.log(JSON.stringify({character,wins:rows.filter(r=>r.status==='won').length,total:count,stuck:rows.filter(r=>r.status==='playing').length,invalid:rows.reduce((n,r)=>n+r.invalid,0)}));}
