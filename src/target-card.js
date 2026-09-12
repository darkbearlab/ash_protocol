import {lightingEffects} from './lighting.js';
import {missionTarget} from './missions.js';
import {FURNITURE} from './modules.js';
import {isBarrier,barrierName} from './barriers.js';
import {traitLabels,initiative,activeTrait} from './traits.js';
import {ENEMY_TYPES,distance,bracingBonus} from './engine.js';
import {grapplePlan,ambushReady,MELEE_TUNING} from './melee-classes.js';
// Melee-class hints on the card (3.47.1): the hook's pull or dash, and whether an ambush would land.
const meleeHints=(game,target)=>{const p=game.player,hints=[];
  if(p.prepared.skill==='grapple'&&!p.skillState.grapple?.cooldown){const plan=grapplePlan(game,target.id);if(!plan.reason)hints.push(plan.dash?'鉤鎖 · 衝刺':'鉤鎖 · 拉近');}
  if(ambushReady(game,target))hints.push(`伏擊 ×${MELEE_TUNING.ambush}`);return hints;};

export function targetDetails(game){
  const target=game.targeted;if(!target)return null;
  const melee=game.weapon.melee,enemy=ENEMY_TYPES[target.type],aim=enemy?game.accuracy(game.player,target):{chance:game.fireChance(target),bracedBonus:bracingBonus(game,game.player,target)};
  const light=lightingEffects(game,game.player,target);
  const range=distance(game.player,target),withinDistance=range<=game.weapon.range,withinRange=withinDistance&&game.shotClear(game.player,target)&&(!melee||isBarrier(target)||game.canCross(game.player,target));
  return {name:(enemy?(missionTarget(game,target)?'◇ ':'')+enemy.name:null)||(isBarrier(target)?barrierName(target):target.type==='nest'?'裂隙巢穴':target.type==='barrel'?'爆裂油桶':FURNITURE[target.style]?.name||'可破壞掩體'),hp:`${isBarrier(target)?'耐久':'HP'} ${Math.max(0,target.hp)} / ${target.maxHp??target.hp}`,
    chance:withinRange?`命中 ${aim.chance}%`:melee?'無法近戰':'無法射擊',distance:`距離 ${range} 格\n射程 ${game.weapon.range} 格${game.weapon.burstRange!==undefined&&withinDistance?(range>game.weapon.burstRange?' · 單發':' · 兩發'):''}`,
    traits:enemy?traitLabels(target).join(' · '):'',
    order:enemy&&(initiative(target)!==0||initiative(game.player)!==0)?(initiative(target)<initiative(game.player)?'行動在你之前':initiative(target)>initiative(game.player)?'行動在你之後':'同速，你先行動'):'',
    cover:melee?'近戰無視掩體':enemy?(activeTrait(target,'no_cover')?'無法利用掩體':aim.cover?(aim.coverEfficiency===.5?'半效 ':'')+(aim.cover.type==='low_partition'?'矮隔板掩護':isBarrier(aim.cover)?'隔間掩護':aim.cover.type==='wall'?'牆角掩護':aim.cover.style?'家具掩護':'箱體掩護'):'無掩護'):'可破壞物',
    state:[...(enemy?meleeHints(game,target):[]),aim.closeBonus?`近射 +${aim.closeBonus}`:'',aim.vaultBonus?`翻越破綻 +${aim.vaultBonus}`:'',!melee&&light.dark?(light.nightVision?'夜視抵銷暗區':'暗區 −40'):'',isBarrier(target)?target.type==='door'?(target.open?'門已開啟':'門已關閉'):target.type==='low_partition'?'可翻越 · 破綻 +20':'固定隔板':'',withinRange?'':withinDistance?'障礙阻擋':'超出射程',aim.bracedBonus?`架槍 +${aim.bracedBonus}`:'',aim.trackingBonus?`修正 +${aim.trackingBonus}`:'',aim.sidePenalty?`側身 −${aim.sidePenalty}`:'',target.control?.disabled?`失能 ${target.control.disabled}`:'',target.control?.immune?`失能免疫 ${target.control.immune}`:'',target.moved?'移動中':'',target.charge?'即將攻擊':''].filter(Boolean).join(' · '),withinRange};
}

const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
// Sprites follow the tile size (3.50.0). The old 32/16 step made actors jump out of scale when the camera
// zoomed out for a distant target.
export const spriteSize=tile=>Math.max(12,Math.round(tile*.84));
// Include sprite, health bar and charge marker at every rendered zoom.
export function actorObstacle(point,tile,fallback=false){
  const size=spriteSize(tile);
  const extent=fallback?tile*.8:0;
  const rx=Math.max(18,size/2+3,tile*.38+10,extent),top=Math.max(24,size/2+3,tile*.45+5,extent),bottom=Math.max(20,size/2+3,tile*.58+4,extent);
  return {x:point.x-rx,y:point.y-top,w:rx*2,h:top+bottom};
}
// Only three screen corners. The target is a hard exclusion; other enemies are
// a preference so crowds cannot force the card back into the middle of the map.
export function targetCardPlacement({target,player,tile,width,height,cardWidth,cardHeight,obstacles=[],blockers=[],fallbackActors=false,bottomInset=0,previousCorner=null}){
  const pad=5,w=cardWidth,h=cardHeight,bottom=height-h-pad-bottomInset;
  if(w>width-pad*2||h>height-pad*2)return null;
  const targetBox=actorObstacle(target,tile,fallbackActors),playerBox=actorObstacle(player,tile,fallbackActors);
  const candidates=[{corner:'top-right',x:width-w-pad,y:pad},{corner:'bottom-right',x:width-w-pad,y:bottom},{corner:'bottom-left',x:pad,y:bottom}];
  let best=null;
  for(const [index,candidate]of candidates.entries()){
    if(candidate.y<pad)continue;
    const r={...candidate,x:Math.round(candidate.x),y:Math.round(candidate.y),w,h};
    if(overlap(r,targetBox)>0)continue;
    const areas=blockers.map(b=>overlap(r,b));
    const link={x:Math.max(r.x,Math.min(r.x+w,target.x)),y:Math.max(r.y,Math.min(r.y+h,target.y))};
    // Once enemy occlusion is equal, shorten the actual connector before other
    // soft preferences; the previous corner only settles otherwise equal ties.
    const linkDistance=(target.x-link.x)**2+(target.y-link.y)**2;
    const rank=[areas.filter(a=>a>0).length,areas.reduce((a,b)=>a+b,0),linkDistance,overlap(r,playerBox),obstacles.reduce((sum,o)=>sum+overlap(r,o)*(o.weight||25),0),r.corner===previousCorner?0:1,index];
    if(!best||rank.some((n,i)=>n<best.rank[i]&&rank.slice(0,i).every((v,k)=>v===best.rank[k])))best={...r,link,rank};
  }
  return best;
}
