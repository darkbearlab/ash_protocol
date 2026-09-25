import {t} from './i18n.js';
import {SUPPRESSION_TUNING as T,finishSuppression,withShotTargets} from './suppression.js';
import {areaCells} from './throwables.js';
import {distance,key} from './world.js';
import {presentStep} from './presentation.js';
import {spentCase} from './traces.js';
import {bladeMultiplier} from './melee-classes.js';
import {recordShot} from './traits.js';
export const suppressiveArea=(g,point)=>areaCells(g.grid,point,1,g.barriers,g);
export function suppressiveReason(g,point){
 const p=g.player,w=g.weapon;
 if(!p.skills.includes('suppressive_fire')||p.prepared.skill!=='suppressive_fire')return t('suppressive-fire.readyFirst');
 if(w.melee)return t('suppressive-fire.needsGun');
 if(p.ammo[p.weapon]<T.skillRounds)return t('suppressive-fire.magMin',{n:T.skillRounds});
 if(!point||![point.x,point.y].every(Number.isInteger)||g.grid[point.y]?.[point.x]!==1||distance(p,point)>w.range||!g.visible(point))return t('suppressive-fire.pickFloor');
 return '';
}
export function suppressiveFire(g,point){
 const p=g.player,w=g.weapon;
 // Intent is a fixed region. A lost firing line still spends the committed rounds.
 if(w.melee||p.ammo[p.weapon]<T.skillRounds)return g.fail(t('suppressive-fire.magShort'));
 const cells=new Set(suppressiveArea(g,point).map(key)),targets=g.enemies.filter(e=>e.hp>0&&cells.has(key(e))).sort((a,b)=>a.id.localeCompare(b.id));
 const hits=new Set(),shots=Math.min(T.skillRounds+(w.extraRounds||0),p.ammo[p.weapon]);let cursor=0,rounds=0;
 for(let i=0;i<shots&&p.hp>0;i++)presentStep(g,()=>{
  const available=targets.filter(e=>e.hp>0&&distance(p,e)<=w.range&&g.sight(p,e)&&g.shotClear(p,e));
  const target=available.length?available[cursor++%available.length]:null,to=target||point;
  p.facing=[Math.sign(to.x-p.x),Math.sign(to.y-p.y)];g.recordExposure(p,to);p.ammo[p.weapon]--;p.stats.shots++;rounds++;spentCase(g,p,w.ammoType);
  const chance=target?Math.max(10,g.fireChance(target)-T.skillAccuracy):0,hit=Boolean(target&&g.rng()*100<chance);
  g.effects.push({type:'shot',weaponId:w.id,singleShot:true,...(w.noFlash?{suppressed:true}:{}),from:{x:p.x,y:p.y},to:{x:to.x,y:to.y},miss:!hit,damage:0});   // the flash hider still hides it (3.179.0)
  if(!hit)return;
  hits.add(target);const range=g.weaponDamage(p.weapon,target),damage=range.min+Math.floor(g.rng()*(range.max-range.min+1));
  // Even explosive/splash weapons must not damage corner-hidden targets in this skill.
  const before=g.enemies.map(e=>[e,e.hp]),eligible=g.enemies.filter(e=>g.shotClear(p,e));
  if(w.explosive)withShotTargets(g,eligible,()=>g.explode(target,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)),p,eligible));
  else g.hitTarget(target,damage,p,w.pierce||0);
  if(w.splash)for(const other of eligible.filter(e=>e.hp>0&&e!==target&&distance(e,target)<=1&&g.visible(e)))g.hitTarget(other,Math.round(damage*.45),p,w.pierce||0);
  for(const [e,hp] of before)if(e.hp<hp)hits.add(e);
  recordShot(p,target.id,g.turn);
 });
 // 3.185.0: the skill's rounds are a suppressive volley however few, as they were before the five-round threshold.
 finishSuppression(targets,hits,Math.max(rounds,T.weaponRounds),T.skillStacks,g);for(const e of targets){g.noticeAttack(e);e.alert=true;e.lastKnown={x:p.x,y:p.y};}g.log(t('suppressive-fire.fired',{n:rounds}));return true;
}

export const suppressivePreview=(g,point)=>({range:g.weapon.range,minimumRounds:T.skillRounds,rounds:Math.min(T.skillRounds+(g.weapon.extraRounds||0),g.player.ammo[g.player.weapon]),accuracyPenalty:T.skillAccuracy,reason:suppressiveReason(g,point),cells:point&&Number.isInteger(point.x)&&Number.isInteger(point.y)?suppressiveArea(g,point):[]});
