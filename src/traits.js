import {classPerkRank,CLASS_PERK_TUNING} from './class-perks.js';
import {validSuppression} from './suppression.js';
import {ENEMY_TYPES,SIZE} from './data.js';
import {enemyStartingTraitIds} from './enemy-data.js';
// Independent passive rules. Sources persist even when opposite effects cancel.
export const POINT_BLANK=Object.freeze({range:3,accuracy:10});
export const TRAITS={
 suppression_resistance:{name:'壓制抗性',text:'每階使單次所有來源合計的壓制層數 −1，最高 3 階。'},
 rapid_fire:{name:'連射',text:'槍械攻擊多射 1 發，每發命中 −10；消耗實際發數的彈藥。'},
  disruption_resistant:{name:'抗失能',text:'受到的失能次數減半，向上取整。'},
  // 3.158.0 (user decision, NetHack's barbarian): the berserker never poisons. Direct acid and heat damage still land.
  poison_immunity:{name:'毒無效',text:'毒液噴吐、毒霧與污染液都不會讓你中毒，已有的中毒立即清除。污染液與高熱的直接傷害照常。'},
  // 3.160.0 (user decision): the berserker keeps one rank of resistance instead of immunity; 毒無效 stays defined so a
  // 3.158.0 save still loads (the class sync then drops it).
  poison_resistance:{name:'抗毒',text:'中毒每回合傷害 −1；和密封防護的階數疊加。'},
  tactical_supply:{name:'戰術配給',text:'每次升至 2～20 級時獲得 1 顆煙霧彈；共用投擲容量不足時留在腳下。滿級經驗補給不觸發。'},
  extended_burst:{name:'延伸點射',text:'僅衝鋒槍：原射程外再延伸 2 格，延伸區每次只射 1 發、消耗 1 發彈藥。射程詞條先計入原射程，兩發區與單發區一起順延。'},
 difficult_healing:{name:'難以治療',text:'生命回復的基礎量減半，向下取整（醫療包、終端、升級、下樓、嗜血等）；急救訓練給醫療包的加成不減。不影響生命上限與護甲板。'},
  // 3.136.0 (user decision): learning data that widens every pouch.
  extended_carry:{name:'攜行擴充',text:'每種彈藥上限 +50%（四捨五入）、投擲物共用上限 +2、每種道具上限 +2。'},
  night_vision:{name:'夜視',text:'忽略目標暗區的射擊命中懲罰；會受震撼彈失能，不穿煙。'},
  exoskeleton:{name:'外骨骼',text:'射擊命中 +10、近戰傷害 +20%；自帶的護甲板打光時損毀，並被壓制 5 層。'},
  infrared:{name:'紅外線',text:'看穿煙霧，仍受牆與門阻擋；會受震撼彈失能，不抵銷暗區懲罰。'},
  biological:{name:'生物',text:'會受到震撼彈的失能效果；可與機械同時存在。'},
  mechanical:{name:'機械',text:'會受到 EMP 的失能效果，電漿直擊增傷 20%；可與生物同時存在。'},
  heavy_armor:{name:'重裝防護',text:'直接傷害在固定裝甲後再減少 25%，向上取整；不抵擋環境或中毒。'},
  cowering:{name:'躲藏',text:'受傷過半，或在 4 格內親眼看到同伴被擊倒，就躲到最近的掩體後待命；打得到你才反擊。精英與機器不會躲。'},
 payload_toxic:{name:'毒霧囊',text:'爆開時留下一團毒霧：不擋視線，接觸會中毒，槍彈與光束穿過時威力與命中減半，對蟲族無效。'},
 payload_acid:{name:'酸液囊',text:'爆開時在原地留下一格酸液。'},
 payload_spore:{name:'孢子囊',text:'爆開時留下一團孢子煙：擋住你這一方的視線，蟲族看得穿。'},
 underfoot:{name:'矮小',text:'不擋任何直線位移（撲擊、鉤鎖、鉤舌、拉扯都能越過），但仍佔住自己那一格，不能落在牠身上。'},
 lunge:{name:'突進',text:'移動時沿路線一次衝過最多 3 格，只要那段是一條沒有被牆、障礙或其他單位擋住的直線。'},
 detour:{name:'迂迴',text:'接近目標時走牠最後所知你看不到的路線（煙霧也算），最多多走約一個小房間外圍的距離；太遠就直接走最短路。'},
 ready:{name:'已就緒',text:'小隊長下令後的一輪：受到的直接傷害減半、被射擊命中 −15、下一次射擊命中 +15。開火後由小隊長重新下令。'},
 braced:{name:'架槍',text:'自己相對射擊目標受到掩體保護時，命中 +12。'},
  correction:{name:'著彈修正',short:'修正',text:'連續回合射擊同一敵人，後續命中每次 +8，最高 +24；未命中仍累積。'},
  // 3.155.0 (user decision 2026-09-20): the ninja trades the precision rifle for a submachine gun that barely misses up
 // close. Inside POINT_BLANK.range cover and the target's movement stop counting and the aim steadies.
 point_blank:{name:'貼身射擊',text:'3 格內射擊：忽略掩體與目標移動的命中懲罰，命中 +10。'},
 sidestep:{name:'側身',text:'相對攻擊者主要橫向移動時，被射擊命中額外 −20；暴露時移動與側身合計至少 −42。'},
  quick_reload:{name:'快速裝填',short:'快填',text:'使用手槍彈的武器裝填不耗回合，仍消耗備彈。'},
  large:{name:'大型',opposite:'small',text:'被射擊命中率 +15 個百分點。'},
  small:{name:'小型',opposite:'large',text:'被射擊命中率 −15 個百分點。'},
  agile:{name:'敏捷',opposite:'clumsy',text:'移動時，對手射擊命中率 −35（原為 −22）。'},
  clumsy:{name:'笨拙',opposite:'agile',text:'移動時，對手射擊命中率 −9（原為 −22）。'},
  no_cover:{name:'無法利用掩體',short:'無掩體',text:'無法取得牆角／箱體的命中保護與減傷，牆壁仍阻擋視線。'},
  fast:{name:'快速',opposite:'slow',text:'快速階段行動，每回合仍只有一次行動。'},
  slow:{name:'緩速',opposite:'fast',text:'緩速階段行動；與快速同時存在時按普通速度結算。'},
 bloodlust:{name:'嗜血',text:'近戰造成的實際生命傷害，20% 回復為你的生命（不含溢出）。'},
 battle_spirit:{name:'戰意',text:'近戰擊殺 +1 層、最多 5 層，每層受到的直接傷害 −5%；5 回合沒有近戰擊殺後，每 2 回合掉一層。'},
 blade_stash:{name:'刃藏',text:'背包每有一把近戰武器（含斧頭），所有攻擊傷害 +10%、受到的直接傷害 −10%。'},
 ambush:{name:'伏擊',text:'目標失能、目標或你站在煙霧中、目標還沒發現你，或你站在暗處時，近戰傷害 ×1.5；每次觸發讓光學迷彩冷卻 −1（迷彩生效中不減）。'},
  duelist:{name:'單挑',text:'只有一名已發現你的敵人看得到你時，射擊與近戰迴避 +15。'},
  exposed:{name:'標定',text:'被預警標定，暫時削弱對士兵的攻防。'},
};
export function hasTrait(actor,id){return (actor?.traits||[]).some(t=>t.id===id);}
export function activeTrait(actor,id){return hasTrait(actor,id)&&!hasTrait(actor,TRAITS[id]?.opposite);}
export const initiative=actor=>activeTrait(actor,'fast')?-1:activeTrait(actor,'slow')?1:0;
export const sizeModifier=actor=>activeTrait(actor,'large')?15:activeTrait(actor,'small')?-15:0;
export const movementModifier=actor=>activeTrait(actor,'agile')?13:activeTrait(actor,'clumsy')?-13:0;
// Suppression resistance stacks by source, so its label carries the rank (3.75.1).
export function traitLabels(actor){const shown=(actor?.traits||[]).filter(t=>!t.source.startsWith('affix:')||actor.affixes?.some(a=>a.revealed&&t.source===`affix:${a.id}`));return [...new Set(shown.map(t=>t.id))].map(id=>`${TRAITS[id].short||TRAITS[id].name}${id==='suppression_resistance'?` ${Math.min(3,new Set(shown.filter(t=>t.id===id).map(t=>t.source)).size)} 階`:''}${activeTrait(actor,id)?'':'（抵銷）'}`);}
export function tickTraits(actor){actor.traits=(actor.traits||[]).flatMap(t=>t.turns===undefined?[t]:t.turns>1?[{...t,turns:t.turns-1}]:[]);}
// The most traits a save may carry (66 legacy entries plus the two senses the v17 migration adds).
export const TRAIT_CAP=68;
export function validTraits(traits){return Array.isArray(traits)&&traits.length<=TRAIT_CAP&&traits.filter(t=>t?.id==='suppression_resistance').length<=3&&new Set(traits.filter(t=>t?.id==='suppression_resistance').map(t=>t.source)).size===traits.filter(t=>t?.id==='suppression_resistance').length&&traits.every(t=>t&&typeof t==='object'&&!Array.isArray(t)&&typeof t.id==='string'&&Object.hasOwn(TRAITS,t.id)&&typeof t.source==='string'&&/^[a-zA-Z0-9:_-]{1,100}$/.test(t.source)&&(t.turns===undefined||(Number.isInteger(t.turns)&&t.turns>0&&t.turns<=999)));}
export const bodyKeyword=type=>ENEMY_TYPES[type]?.mechanical?'mechanical':'biological';
export function startingTraits(type,floor=1){
  const ids=enemyStartingTraitIds(type,floor);
  return ids.map(id=>({id,source:`enemy:${type}`}));
}
export function initiativeQueue(player,enemies,allies=[]){return [player,...allies.filter(a=>a.hp>0),...enemies.filter(e=>e.hp>0)].map((actor,index)=>({actor,index,speed:initiative(actor)})).sort((a,b)=>a.speed-b.speed||a.index-b.index);}

export function grantTrait(actor,id,source,turns){
  const trait={id,source,...(turns===undefined?{}:{turns})};if(!validTraits([trait]))return false;
  const traits=(actor.traits||[]).filter(t=>t.id!==id||t.source!==source);if(traits.length>=68)return false;
  actor.traits=[...traits,trait];return true;
}
export function removeTraitSource(actor,source){actor.traits=(actor.traits||[]).filter(t=>t.source!==source);}

export function correctionBonus(actor,targetId,turn){
  const c=actor.fireChain;
  return activeTrait(actor,'correction')&&c&&c.targetId===targetId&&(c.turn===turn||c.turn===turn-1)?Math.min(c.count*8,24):0;
}
export const correctionLimit=()=>3;   // 3.159.0: 架槍精通 is gone, the chain caps at three again
export function recordShot(actor,targetId,turn){
  if(!activeTrait(actor,'correction')){actor.fireChain=null;return;}
  const c=actor.fireChain;
  actor.fireChain={targetId,turn,count:c?.targetId===targetId&&c.turn===turn-1?Math.min(correctionLimit(actor),c.count+1):1};
}
export function sidestepPenalty(attacker,target){
  if(!target.moved||!activeTrait(target,'sidestep')||!target.moveDelta)return 0;
  const [mx,my]=target.moveDelta,dx=attacker.x-target.x,dy=attacker.y-target.y;
  return Math.abs(mx*dy-my*dx)>Math.abs(mx*dx+my*dy)?20+classPerkRank(target,'recon_sidestep')*CLASS_PERK_TUNING.sidestep:0;
}
// 3.124.0: a move is not always one step. The swarm tongue pull records the whole displacement (up to five tiles, and
// diagonal), and the old one-step bound rejected every save taken right after a pull, which lost the run on reload.
// Sidestep only reads the direction, so any in-board displacement is valid.
export function validCombatMemory(actor,turn){
  const d=actor.moveDelta,c=actor.fireChain;
  return validSuppression(actor)&&Array.isArray(d)&&d.length===2&&d.every(n=>Number.isInteger(n)&&Math.abs(n)<SIZE)&&
    (c===null||(c&&typeof c==='object'&&!Array.isArray(c)&&typeof c.targetId==='string'&&c.targetId.length>0&&c.targetId.length<=100&&Number.isInteger(c.turn)&&c.turn>=1&&c.turn<=turn&&Number.isInteger(c.count)&&c.count>=1&&c.count<=correctionLimit(actor)));
}

export function reduceDirectDamage(actor,damage){
 const ready=activeTrait(actor,'ready')?.5:1;
 const heavy=activeTrait(actor,'heavy_armor'),plate=actor.plates>0?classPerkRank(actor,'bulwark_plating'):0,anchor=actor.skillState?.anchor?.remaining>0?classPerkRank(actor,'bulwark_anchor'):0;
 if(!heavy&&!plate&&!anchor&&ready===1)return damage;
 return Math.max(1,Math.ceil(damage*ready*(heavy ? .75 : 1)*(1-plate*CLASS_PERK_TUNING.plating)*(1-anchor*CLASS_PERK_TUNING.anchor)));
}

export const healingAmount=(actor,amount)=>activeTrait(actor,'difficult_healing')?Math.floor(amount/2):amount;
// 3.136.0 (user decision): difficult healing halves the base amount only; a bonus (the medic perk's) is added in full.
export function healActor(actor,amount,bonus=0){const before=actor.hp;actor.hp=Math.min(actor.maxHp,actor.hp+healingAmount(actor,amount)+bonus);return actor.hp-before;}
