// The player's weapons (3.206.3 split): hit chance and damage, and firing, launching, the cone, the lance, melee and the
// shadow step.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {sentence,t} from './i18n.js';
import {BLIND_TUNING} from './blind-fire.js';
import {recordShot} from './traits.js';
import {enemyArmor} from './enemy-affixes.js';
import {SUPPRESSION_TUNING,finishSuppression,pinned} from './suppression.js';
import {roundCost,singleShotAt,volleyShots} from './weapons.js';
import {CLASS_PERK_TUNING,classPerkRank} from './class-perks.js';
import {ambushMultiplier,ambushReady,bladeMultiplier,camoActive,camoMultiplier,shortenCamo,useHookBlade} from './melee-classes.js';
import {thrustTargets} from './melee-weapons.js';
import {toxicShot} from './swarm-fields.js';
import {hazeShot} from './vents.js';
import {sprayFlame} from './fire.js';
import {occupied} from './allies.js';
import {skillValues} from './skills.js';
import {actorStat} from './actor-stats.js';
import {LIGHT_TUNING,isLamp,lightingEffects} from './lighting.js';
import {spentCase} from './traces.js';
import {barrierBetween,barrierFace,isBarrier,vaultable} from './barriers.js';
import {coneTargets,pelletChance,pelletsAt,shotgunBand} from './shotgun.js';
import {lancePath} from './lance.js';
import {noticeAttack} from './field-gear.js';
import {OVERPENETRATION} from './ammunition.js';
import {presentStep} from './presentation.js';
import {distance} from './world.js';
import {bracingBonus} from './combat.js';
import {enemyName} from './game.js';
import {launchReason} from './game-actions.js';
import {attackRound} from './pursuit.js';
// 3.179.0: a shot from a gun with the flash hider makes no muzzle flash (src/lighting.js, src/presentation.js).
const flashHidden=w=>w.noFlash?{suppressed:true}:{};
export class GameAttacks {
  fireChance(target){if(this.weapon.melee)return this.meleeAccuracy(this.player,target,this.weapon.hitChance);return this.enemies.includes(target)?this.accuracy(this.player,target).chance:Math.max(10,Math.min(99,97+(this.weapon.closeRange&&distance(this.player,target)<=this.weapon.closeRange?this.weapon.closeAccuracy:0)+actorStat(this.player,'rangedAccuracy')+(this.player.focus?15:0)+this.weapon.accuracyBonus+bracingBonus(this,this.player,target)-lightingEffects(this,this.player,target).penalty-(isLamp(target)?LIGHT_TUNING.lampHitPenalty:0)));}
  // 3.141.0: the shotgun's pellets at this target's distance, each with an even share of the per-attack bonuses (upgrades,
  // the damage perk), rounded up like a burst's.
  pelletDamage(index,target){const w=this.weaponAt(index),count=pelletsAt(w,distance(this.player,target)),raw=Math.ceil((this.player.bonus+this.player.perkWeaponBonus+(this.player.upgrades[index]||0)*5)/(w.burst||1)),bonus=count?Math.ceil(raw/count):0;return {count,min:w.pelletMin+bonus,max:w.pelletMax+bonus};}
  weaponDamage(index=this.player.weapon,target=null){const w=this.weaponAt(index);if(w.unarmed)return {min:w.min,max:w.max};const band=target?shotgunBand(w,distance(this.player,target)):{min:w.min,max:w.max},raw=Math.ceil((this.player.bonus+this.player.perkWeaponBonus+(this.player.upgrades[index]||0)*5)/(w.burst||1)),bonus=w.hits?Math.ceil(raw/w.hits):raw;return {min:band.min+bonus,max:band.max+bonus};}
  // No hit roll: the round lands on the chosen tile and the blast decides who is caught, which is what makes the launcher
  // a crowd weapon rather than a single-target one that loses its whole area effect on a miss.
  launch(pos){
    const reason=launchReason(this,pos);if(reason)return this.fail(sentence(reason),[t('game.launchEmpty'),t('game.tankEmpty')].includes(reason)?this.emptyCue():null);   // tankEmpty: 3.203.0
    const p=this.player,w=this.weapon;
    p.facing=[Math.sign(pos.x-p.x),Math.sign(pos.y-p.y)];
    // 3.203.0 (docs/HAZARDS.md section 4): the flamethrower sprays its cone toward the tile (src/fire.js sprayFlame).
    if(w.flame){
      this.recordExposure(p,pos);p.ammo[p.weapon]--;p.stats.shots++;p.fireChain=null;
      const d=this.weaponDamage(p.weapon),{hits,lit}=sprayFlame(this,p,pos,()=>d.min+Math.floor(this.rng()*(d.max-d.min+1)));
      this.log(hits?(lit?t('flames.sprayHits',{n:hits}):t('flames.sprayHitsNoFire',{n:hits})):lit?t('flames.sprayed'):t('flames.sprayNothing'));return true;
    }
    this.recordExposure(p,pos);p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
    const range=this.weaponDamage(p.weapon),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
    this.effects.push({type:'shot',weaponId:w.id,style:'grenade',...flashHidden(w),from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    const before=this.enemies.map(o=>[o,o.hp]);
    this.explode(pos,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)),p,null,{from:p});   // 3.209.0: it came from your tile
    const hits=new Set(before.filter(([o,hp])=>o.hp<hp).map(([o])=>o));
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    p.fireChain=null;
    this.log(hits.size?t('game.launcherHits',{n:hits.size}):t('game.launcherExploded'));
    return true;
  }
  // 3.112.0 (user request): one shell, every enemy and ally the cone reaches. 3.141.0 (user decisions 2026-09-19): each
  // takes the pellets its distance allows, every pellet rolling a flat chance and its own damage (src/shotgun.js).
  fireCone(aim,blind=false){
    const p=this.player,w=this.weapon;
    if(p.ammo[p.weapon]<=0)return this.fail(t('game.magEmpty'),this.emptyCue());
    p.facing=[Math.sign(aim.x-p.x),Math.sign(aim.y-p.y)];
    const targets=coneTargets(this,p,aim,w,blind),hits=new Set();
    presentStep(this,()=>{
      this.recordExposure(p,aim);p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
      if(!targets.length){
        this.effects.push({type:'shot',weaponId:w.id,style:'bullet',...flashHidden(w),from:{x:p.x,y:p.y},to:{x:aim.x,y:aim.y},damage:0,miss:true});
        this.log(t('game.shellsMissedAll'),false,t('game.shellsMissed'));return;
      }
      for(const o of targets){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const {count,min,max}=this.pelletDamage(p.weapon,o),chance=pelletChance(w,toxicShot(this,p,o,w)||hazeShot(this,p,o,w)),landed=[];
        for(let i=0;i<count;i++)if(this.rng()*100<chance)landed.push(min+Math.floor(this.rng()*(max-min+1)));
        this.effects.push({type:'shot',weaponId:w.id,style:'bullet',...flashHidden(w),from:{x:p.x,y:p.y},to:{x:o.x,y:o.y},damage:0,miss:!landed.length});
        const foe=this.enemies.includes(o),name=foe?enemyName(o):t('common.ally');
        this.log(landed.length?t('game.pelletsHit',{hit:landed.length,count,target:name}):t('game.pelletsMissed',{count}),false,landed.length?t('game.pelletsHitReal',{target:name}):t('game.pelletsMissedReal'));
        if(!landed.length)continue;
        if(foe){const before=o.hp;this.hitTarget(o,landed.reduce((a,b)=>a+b,0),p,w.pierce||0,w,landed);if(o.hp<before)hits.add(o);}
        else this.damageAlly(o,landed.reduce((a,b)=>a+b,0),p);
      }
    });
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    const primary=this.targeted;
    if(primary&&this.enemies.includes(primary))recordShot(p,primary.id,this.turn);else p.fireChain=null;
    return true;
  }
  fire(intent=null) {
    const p=this.player,e=this.targeted,w=this.weapon;
    // 3.210.0: a blade swung at an enemy out of reach while the camouflage is on is the hook blade (src/melee-classes.js).
    if(w.melee&&!w.thrust&&camoActive(p)&&this.enemies.includes(e)&&distance(p,e)>1)return useHookBlade(this,e.id,p.weapon);
    if(w.melee)return w.thrust?this.thrust(intent):this.strike(intent);
    // A committed shot still fires at the last confirmed tile if its target is lost.
    if(intent&&w.cone&&(!e||distance(p,e)>w.range||!this.shotClear(p,e)))return this.fireCone(intent);
    if(intent&&(!e||distance(p,e)>w.range||!this.shotClear(p,e))){
      p.facing=[Math.sign(intent.x-p.x),Math.sign(intent.y-p.y)];
      const cost=w.shotCost||1,singleShot=singleShotAt(w,distance(p,e||intent)),shots=volleyShots(w,distance(p,e||intent),p.ammo[p.weapon]);
      for(let i=0;i<shots;i++)presentStep(this,()=>{
        this.recordExposure(p,intent);p.ammo[p.weapon]-=roundCost(w,i);p.stats.shots++;spentCase(this,p,w.ammoType);
        this.effects.push({type:'shot',weaponId:w.id,singleShot,style:w.ammoType==='energy'?'plasma':'bullet',...flashHidden(w),from:{x:p.x,y:p.y},to:{x:intent.x,y:intent.y},damage:0,miss:true,color:w.ammoType==='energy'?'#8ae9da':null});
      });
      if(this.enemies.some(e=>e.id===intent.id))recordShot(p,intent.id,this.turn);else p.fireChain=null;
      this.log(t('game.lostLine',{n:w.volleyCost?w.volleyCost:shots*cost}));
      return true;
    }
    if(!e)return this.fail(t('game.noTarget'),'no_target');
    if(distance(p,e)>w.range)return this.fail(t('game.outOfRangeCloser'),'out_of_range');
    if(p.ammo[p.weapon]<=0)return this.fail(t('game.magEmpty'),this.emptyCue());
    if(p.ammo[p.weapon]<(w.shotCost||1))return this.fail(t('common.magShort',{n:w.shotCost}),this.emptyCue());
    if(this.enemies.includes(e))noticeAttack(this,e);
    // Doors, cover and barrels are still breached one at a time; an enemy gets the cone.
    if(w.cone&&this.enemies.includes(e))return this.fireCone(e);
    if(w.lance&&this.enemies.includes(e))return this.fireLance(e);
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    const singleShot=singleShotAt(w,distance(p,e||intent)),shots=volleyShots(w,distance(p,e||intent),p.ammo[p.weapon]);
    let rounds=0;const hits=new Set();
    // 3.208.0 (src/pursuit.js): each round is a round of its own; only the first can earn pursuit.
    for(let i=0;i<shots;i++) {
      if(e.hp<=0||p.hp<=0)break;
      presentStep(this,()=>attackRound(this,i,()=>{
        const round=rounds;this.recordExposure(p,e);p.ammo[p.weapon]-=roundCost(w,round);p.stats.shots++;rounds++;spentCase(this,p,w.ammoType);
        const range=this.weaponDamage(p.weapon,e),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
        const chance=this.fireChance(e);
        const hit=this.rng()*100<chance;
        this.effects.push({type:'shot',weaponId:w.id,singleShot,style:w.ammoType==='energy'?'plasma':'bullet',...flashHidden(w),from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:w.ammoType==='energy'?'#8ae9da':null});
        if(!hit){this.log(`${t('game.shotMiss',{chance})}`,false,t('game.shotMissReal'));if(w.explosive)this.log(t('game.grenadeStray'));return;}
        hits.add(e);const before=this.enemies.map(o=>[o,o.hp]);
        if(w.explosive)this.explode(isBarrier(e)?barrierFace(e,p):e,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)),p,null,{from:p});
        else{this.hitTarget(e,damage,p,w.pierce||0);if(w.ammoType==='rifle'&&!(enemyArmor(e)>0)&&this.enemies.includes(e))this.overpenetrate(e,damage,w);}
        if(w.splash)for(const other of this.enemies.filter(o=>o.hp>0&&o!==e&&distance(o,e)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*.45),p,w.pierce||0);
        // 3.141.0 爆裂 (drop-only plasma affix): the hit bursts where it lands. The target already took the hit; everything
        // one tile away, you and your allies too, takes half of it (an explosion loses 10 a tile), plus 爆破專家.
        if(w.blast){this.log(t('game.plasmaBurst'));this.explode(isBarrier(e)?barrierFace(e,p):e,1,Math.round(damage*w.blast)+10+p.blastBonus,p,this.enemies.filter(o=>o!==e),{from:p});}
        for(const [other,hp] of before)if(other.hp<hp)hits.add(other);
      }));
    }
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),w.suppressive?Math.max(rounds,SUPPRESSION_TUNING.weaponRounds):rounds,0,this);   // 3.185.0: 速射 keeps its suppression
    if(this.enemies.includes(e))recordShot(p,e.id,this.turn);else p.fireChain=null;
    return true;
  }
  // 3.141.0 貫穿 (drop-only plasma affix, src/lance.js): one beam, and every visible unit on it rolls its own hit;
  // whatever stopped the beam past it takes the hit. 3.142.1 (user, after the playtest): every unit rolls against the
  // chance of the shot the player aimed, the locked target's, so darkness or cover further down the beam cannot turn the
  // line into misses.
  // 3.185.0 (user, plan C): a rifle round through an armorless target flies on along the line (the lance's path) and
  // may hit the next unit — an ally too — at half damage, rolled at the chance of the shot you aimed.
  overpenetrate(e,damage,w){
    const p=this.player,{units}=lancePath(this,p,e,w.range),next=units[units.indexOf(e)+1];
    if(!next||this.rng()*100>=this.fireChance(e))return;
    const d=Math.round(damage*OVERPENETRATION);
    if(this.activeAllies.includes(next))this.damageAlly(next,d,p);else this.hitTarget(next,d,p,w.pierce||0);
  }
  fireLance(e){
    const p=this.player,w=this.weapon,cost=w.shotCost||1,{units,stop,end}=lancePath(this,p,e,w.range),hits=new Set();
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    presentStep(this,()=>{
      this.recordExposure(p,e);p.ammo[p.weapon]-=cost;p.stats.shots++;spentCase(this,p,w.ammoType);
      this.effects.push({type:'shot',weaponId:w.id,singleShot:true,style:'plasma',from:{x:p.x,y:p.y},to:{x:end.x,y:end.y},damage:0,miss:false,color:'#8ae9da'});
      const roll=o=>{const range=this.weaponDamage(p.weapon,o);return range.min+Math.floor(this.rng()*(range.max-range.min+1));};
      let friends=0;const chance=this.fireChance(e);
      for(const [n,o] of units.entries()){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const damage=roll(o),hit=this.rng()*100<chance;
        if(!hit){this.log(t('game.beamMiss',{index:n+1,target:this.enemies.includes(o)?enemyName(o):t('common.ally'),chance}),false,t('game.beamMissReal'));continue;}
        if(this.activeAllies.includes(o)){this.damageAlly(o,damage,p);friends++;continue;}
        const before=o.hp;this.hitTarget(o,damage,p,w.pierce||0);if(o.hp<before)hits.add(o);
      }
      if(stop)this.hitTarget(stop,roll(stop),p,w.pierce||0);
      this.log(t(friends?'game.beamHitsAllies':'game.beamHits',{n:hits.size,allies:friends}),false,t('game.beamFired'));
    });
    finishSuppression([],new Set([...hits].filter(o=>this.enemies.includes(o))),1,0,this);
    if(this.enemies.includes(e))recordShot(p,e.id,this.turn);else p.fireChain=null;
    return true;
  }
  strike(intent=null,slot=this.player.weapon) {
    // 3.180.0: a bump names its enemy, which may stand unseen; the swing then goes in blind (BLIND_TUNING, as a blind shot).
    const p=this.player,w=this.weaponAt(slot),target=this.targeted||(intent?.id?this.enemies.find(e=>e.id===intent.id&&e.hp>0):undefined);
    if(!w.melee)return false;
    if(!intent&&(!target||distance(p,target)>1))return this.fail(t('game.meleeAdjacent'));
    const valid=target&&distance(p,target)<=1&&this.shotClear(p,target)&&(isBarrier(target)||this.canCross(p,target)),to=valid?target:intent;
    p.fireChain=null;p.facing=[Math.sign(to.x-p.x),Math.sign(to.y-p.y)];if(valid&&this.enemies.includes(target))noticeAttack(this,target);
    let landed=false,ambush=false;const camo=camoMultiplier(p,w);
    presentStep(this,()=>{
      ambush=!w.unarmed&&Boolean(valid)&&ambushReady(this,target);if(ambush&&!this.shadowBonus)shortenCamo(p);
      const blind=Boolean(valid)&&!isBarrier(target)&&!this.teamVisible(target);if(blind)this.log(t('game.blindMelee',{penalty:BLIND_TUNING.penalty}));
      const chance=this.meleeAccuracy(p,target,w.hitChance-(blind?BLIND_TUNING.penalty:0)),hit=Boolean(valid)&&this.rng()*100<chance;
      this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:to.x,y:to.y},damage:0,miss:!hit});
      if(!hit){this.log(valid?t('game.meleeMiss',{chance}):t('game.meleeTargetLeft'),false,valid?t('game.meleeMissReal'):t('game.meleeTargetLeft'));return;}
      landed=true;
      // 3.136.0 (src/melee-weapons.js): claws bite harder on an unarmoured enemy; the sabre's blow splashes onto the
      // target's visible neighbours; the chainsaw costs your next action once it bites.
      const foe=this.enemies.includes(target),bare=w.bareBonus&&foe&&!(enemyArmor(target)>0)?1+w.bareBonus:1;
      // 3.210.0: the camouflage's own ×camoMelee multiplies with the ambush's.
      const d=this.weaponDamage(slot),damage=Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1)*camo*bare);this.hitTarget(target,damage,p,w.pierce||0,w);
      if(w.splash&&foe)for(const other of this.enemies.filter(o=>o.hp>0&&o!==target&&distance(o,target)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*w.splash),p,w.pierce||0,w);
      if(w.recovery){p.recovery=1;this.log(t('game.recovery',{weapon:w.name}));}
      const shadow=classPerkRank(p,'ninja_shadowstep');if(ambush&&shadow&&!this.shadowBonus){this.shadowSteps=shadow>=2?2:1;this.log(t('game.shadowReady',{n:this.shadowSteps}));}
    });
    // 3.136.0 chainsaw: the rest of its cuts, each in a presentation step of its own so every number shows.
    // 3.208.0 (src/pursuit.js): each cut after the first is a follow-up round.
    if(landed&&w.hits>1&&this.enemies.includes(target))for(let i=1;i<w.hits&&target.hp>0&&p.hp>0;i++)presentStep(this,()=>attackRound(this,i,()=>{
      const d=this.weaponDamage(slot);this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:target.x,y:target.y},damage:0,miss:false});
      this.hitTarget(target,Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1)*camo),p,w.pierce||0,w);
    }));
    return true;
  }
  // 3.136.0: the spear in hand (src/melee-weapons.js). One thrust along a straight line out to two tiles; every unit on
  // it, friend or foe, rolls its own hit, like the shotgun's pellets. A locked door, cover or barrel is struck as well.
  thrust(intent=null){
    const p=this.player,w=this.weapon,e=this.targeted,aim=e&&distance(p,e)<=w.range&&this.shotClear(p,e)?e:intent;
    if(!aim)return this.fail(t('game.noTarget'),'no_target');
    p.fireChain=null;p.facing=[Math.sign(aim.x-p.x),Math.sign(aim.y-p.y)];
    const units=thrustTargets(this,p,aim),objects=aim===e&&!this.enemies.includes(e)&&!this.activeAllies.includes(e)?[e]:[];
    presentStep(this,()=>{
      if(!units.length&&!objects.length){this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:aim.x,y:aim.y},damage:0,miss:true});this.log(t('game.thrustWhiff',{weapon:w.name}),false,t('game.thrustWhiffReal',{weapon:w.name}));return;}
      for(const o of [...units,...objects]){
        if(this.enemies.includes(o))noticeAttack(this,o);
        const foe=this.enemies.includes(o),ambush=foe&&ambushReady(this,o),chance=this.meleeAccuracy(p,o,w.hitChance),hit=this.rng()*100<chance;
        if(ambush&&!this.shadowBonus)shortenCamo(p);
        this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:o.x,y:o.y},damage:0,miss:!hit});
        if(!hit){this.log(t('game.thrustMiss',{weapon:w.name,chance}),false,t('game.thrustMissReal',{weapon:w.name}));continue;}
        const d=this.weaponDamage(p.weapon),damage=Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?ambushMultiplier(p):1)*camoMultiplier(p,w));
        if(this.activeAllies.includes(o))this.damageAlly(o,damage,p);else this.hitTarget(o,damage,p,w.pierce||0,w);
      }
    });
    return true;
  }
  shadowMove(delta){
    if(pinned(this.player))return this.fail(t('game.pinnedCannotMove'),'pinned');
    const p=this.player;if(!Array.isArray(delta)||delta.length!==2||!delta.every(Number.isInteger)||Math.abs(delta[0])+Math.abs(delta[1])!==1)return this.fail(t('game.shadowPickDirection'));
    const point={x:p.x+delta[0],y:p.y+delta[1]},edge=barrierBetween(this.barriers,p,point);
    if(!this.passable(point.x,point.y)||!this.canCross(p,point)||vaultable(edge)||occupied(this,point))return this.fail(t('game.shadowNeedsFloor'),'blocked');
    presentStep(this,()=>{Object.assign(p,{x:point.x,y:point.y,facing:[...delta],moved:true,moveDelta:[...delta]});this.shadowSteps--;this.pickup();this.reveal();this.log(this.shadowSteps?t('game.freeStepsLeft',{n:this.shadowSteps}):t('game.freeMovesOver'));});
    if(this.shadowSteps===0&&classPerkRank(p,'ninja_shadowstep')>=3){const target=[this.targeted,...this.enemies].find((e,i,a)=>e&&e.hp>0&&distance(p,e)<=1&&this.canCross(p,e)&&a.indexOf(e)===i);if(target){const slot=this.bumpMeleeSlot();if(slot!==undefined){const before=target.hp;this.target=target.id;this.shadowBonus=true;this.strike({id:target.id,x:target.x,y:target.y},slot);this.shadowBonus=false;if(before>0&&target.hp<=0){const cam=p.skillState?.camouflage;if(cam?.remaining)cam.remaining=Math.min(skillValues(p,'camouflage').duration,cam.remaining+CLASS_PERK_TUNING.shadowDuration);else if(cam)cam.cooldown=Math.max(0,cam.cooldown-CLASS_PERK_TUNING.shadowCooldown);}}}}
    return true;
  }
}
