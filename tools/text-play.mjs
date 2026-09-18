#!/usr/bin/env node
// Text client (3.124.0, user request): plays a campaign through the real rules, one shell call at a time, and writes an
// operation log (src/replay.js) that the browser replays with `?test=1` → 設定 → 播放操作紀錄. See docs/TEXT_PLAY.md.
//
//   node tools/text-play.mjs new <log.json> [--seed N] [--class soldier] [--faction rebel] [--mission extraction]
//   node tools/text-play.mjs <log.json> "<command>; <command>; ..."     (no commands = look)
//   node tools/text-play.mjs verify <log.json>
//
// It shows only what the game screen shows: enemies in sight (or on the team's sensors), tiles already seen, hit
// chances and cover as the target card gives them. Container contents stay hidden until opened.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {Game,SIZE,SUPPLY_NAMES,ENEMY_TYPES,PERKS,distance,floorInfo,enemyName,factionDef,TERMINAL_ITEMS,itemUseReason} from '../src/engine.js';
import {createReplay,replayLog,applyOp,makeOp,stateHash,startReplay} from '../src/replay.js';
import {CHARACTERS} from '../src/characters.js';
import {MISSIONS,missionDefinition,missionProgress} from '../src/missions.js';
import {AMMUNITION,AMMO_IDS,TERMINAL_AMMO} from '../src/ammunition.js';
import {GRENADES,grenadeTotal,tacticalSight} from '../src/throwables.js';
import {PREPARED_CATALOG,preparedOptions,preparedEntry,CAPPED_ITEMS} from '../src/prepared.js';
import {UNARMED_SLOT} from '../src/unarmed.js';
import {SKILLS,skillStatus} from '../src/skills.js';
import {isContainer,containerName} from '../src/containers.js';
import {isBarrier,barrierName,barrierBetween,edgeBlocks} from '../src/barriers.js';
import {isDark} from '../src/lighting.js';
import {targetDetails} from '../src/target-card.js';
import {traitLabels,startingTraits} from '../src/traits.js';
import {suppressionStatus} from '../src/suppression-ui.js';
import {grenadeMarkers} from '../src/affix-ui.js';
import {tongueTelegraphs} from '../src/swarm.js';
import {calloutLine,DIRECTION_ARROWS} from '../src/callout-ui.js';
import {TERMINAL_TUNING,TERMINAL_PACK,terminalCost,terminalRemaining,offerReason,tradeHoldings,terminalSells,terminalName} from '../src/terminal.js';
import {levelLabel,levelTitle} from '../src/endless-ui.js';
import {isNoncombatant} from '../src/enemy-data.js';
import {LEARNING_ITEMS} from '../src/learning-data.js';
import {rollFacilityFaction} from '../src/faction-catalog.js';
import {UNIT_BLUEPRINTS,deployedUnits,repairTargets} from '../src/workshop.js';
import {deployLimit,lineLimit} from '../src/allies.js';
import {petFeedingState} from '../src/pet-growth.js';
import {fuelLabel,lineProgress,petStatusLine} from '../src/pet-ui.js';

const DIRS={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const RESERVED='ctoBCTNMWX@&?>*!%~#.,:;',LETTERS=[...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter(c=>!RESERVED.includes(c)).join('');
const out=[];const say=(...lines)=>out.push(...lines);
const fail=message=>{throw new Error(message);};

// ---- log, cache ----------------------------------------------------------------------------------------------------
const cachePath=file=>`${file}.cache`;
function load(file){
 if(!existsSync(file))fail(`找不到操作紀錄 ${file}；先用 new 建立。`);
 const log=JSON.parse(readFileSync(file,'utf8')),last=log.ops.at(-1)?.h??log.startHash;
 if(existsSync(cachePath(file))){
  try{const cache=JSON.parse(readFileSync(cachePath(file),'utf8'));
   if(cache.ops===log.ops.length&&cache.hash===last){const g=Game.restore(cache.save);if(g&&stateHash(g)===last)return {log,g};}}catch{}
 }
 const {game,mismatch}=replayLog(log);
 if(mismatch)fail(`操作紀錄在第 ${mismatch.step} 步與記錄的狀態不同，無法繼續（${JSON.stringify(mismatch.op||{})}）。`);
 return {log,g:game};
}
function save(file,log,g){
 writeFileSync(file,JSON.stringify(log));
 writeFileSync(cachePath(file),JSON.stringify({ops:log.ops.length,hash:log.ops.at(-1)?.h??log.startHash,save:g.serialize()}));
}
// Every call into the rules goes through here, so the log and the game can never disagree.
function perform(log,g,op){const result=applyOp(g,op);op.h=stateHash(g);log.ops.push(op);return result;}

// ---- lookups -------------------------------------------------------------------------------------------------------
const visibleEnemies=g=>g.enemies.filter(e=>e.hp>0&&g.teamVisible(e));
const letterOf=(g,e)=>LETTERS[visibleEnemies(g).indexOf(e)]??'?';
function findEnemy(g,token){
 const list=visibleEnemies(g);if(!token)return null;
 return list.find(e=>e.id===token)||(token.length===1?list[LETTERS.indexOf(token)]:null)||null;
}
function findTarget(g,token){
 const e=findEnemy(g,token);if(e)return e;
 return [...g.props,...g.barriers].find(o=>o.id===token&&(o.hp===undefined||o.hp>0)&&g.teamVisible(o))||null;
}
function point(g,token){
 if(!token)return null;
 const m=/^(-?\d+),(-?\d+)$/.exec(token);if(m)return {x:Number(m[1]),y:Number(m[2])};
 if(token==='@')return {x:g.player.x,y:g.player.y};
 const t=findTarget(g,token);return t&&!isBarrier(t)?{x:t.x,y:t.y}:null;
}
// An edge sits between two tiles; say which two instead of printing a half coordinate.
const edgeAt=b=>b.axis==='x'?`(${b.x-.5},${b.y})|(${b.x+.5},${b.y})`:`(${b.x},${b.y-.5})/(${b.x},${b.y+.5})`;
const hp=o=>`${Math.max(0,o.hp)}/${o.maxHp??o.hp}`;
const at=o=>`(${o.x},${o.y})`;
const itemName=i=>i.type==='weapon'?'武器':i.type==='learning'?(LEARNING_ITEMS[i.learningId]?.name||'學習資料'):SUPPLY_NAMES[i.type]||AMMUNITION[i.type]?.name||i.type;
const amount=i=>i.amount>1?` ×${i.amount}`:'';
const COMPASS={east:'東',southeast:'東南',south:'南',southwest:'西南',west:'西',northwest:'西北',north:'北',northeast:'東北'};

// ---- map -----------------------------------------------------------------------------------------------------------
// Two characters per tile: the tile, then the edge to its east; an edge row under each tile row holds the south edges.
function edgeChar(g,a,b,vertical){
 const seen=g.seen[a.y]?.[a.x]||g.seen[b.y]?.[b.x];
 const edge=seen?barrierBetween(g.barriers,a,b):null;
 if(edge&&edge.hp>0){if(edge.type==='door')return edge.open?"'":'+';if(edge.type==='low_partition')return vertical?'!':'_';return vertical?'|':'-';}
 const wall=q=>g.grid[q.y]?.[q.x]!==1;return wall(a)&&wall(b)&&shown(g,a)&&shown(g,b)?'#':' ';
}
const shown=(g,q)=>g.grid[q.y]?.[q.x]===1?g.seen[q.y][q.x]:[[0,-1],[1,0],[0,1],[-1,0]].some(([dx,dy])=>g.grid[q.y+dy]?.[q.x+dx]===1&&g.seen[q.y+dy]?.[q.x+dx]);
function tileChar(g,x,y,marks){
 const p=g.player,q={x,y};
 if(p.x===x&&p.y===y)return '@';
 const contact=[...(g.sensorContacts||[]),...(g.petSensorContacts||[])].some(c=>c.x===x&&c.y===y);
 if(g.grid[y][x]!==1)return contact?'?':shown(g,q)?'#':' ';
 if(!g.seen[y][x])return contact?'?':' ';
 const enemy=visibleEnemies(g).find(e=>e.x===x&&e.y===y);if(enemy)return letterOf(g,enemy);
 if(g.localAllies?.some(a=>a.hp>0&&a.status==='active'&&a.x===x&&a.y===y))return '&';
 if(contact)return '?';
 if(marks.has(`${x},${y}`))return '!';
 if(g.exitPoint.x===x&&g.exitPoint.y===y)return '>';
 const prop=g.props.find(o=>o.x===x&&o.y===y&&o.type!=='module'&&(o.hp===undefined||o.hp>0||isContainer(o)));
 if(prop){if(isContainer(prop))return prop.opened?'c':'C';if(prop.type==='terminal')return terminalRemaining(prop)?'T':'t';if(prop.type==='barrel')return 'B';if(prop.type==='nest')return 'N';if(prop.type==='cover')return 'o';}
 if(g.missionObjects?.().some?.(t=>!t.done&&t.x===x&&t.y===y))return 'M';
 const items=g.items.filter(i=>i.x===x&&i.y===y);if(items.length)return items.some(i=>i.type==='weapon')?'W':'*';
 if(g.hazards.some(h=>h.x===x&&h.y===y))return 'X';
 // 3.134.0: toxic mist '~' (you can see through it), smoke and spore smoke '%'.
 if((g.smoke||[]).some(s=>s.kind==='toxic'&&s.cells.some(c=>c.x===x&&c.y===y)))return '~';
 if((g.smoke||[]).some(s=>s.cells.some(c=>c.x===x&&c.y===y)))return '%';
 if(!g.passable(x,y))return 'o';
 const lit=g.visibleTiles?.has(`${x},${y}`);
 return isDark(g,q)?(lit?':':';'):(lit?'.':',');
}
function dangerCells(g){
 const cells=new Set(),add=(c,r=1)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)if(Math.abs(dx)+Math.abs(dy)<=r)cells.add(`${c.x+dx},${c.y+dy}`);};
 for(const m of g.marks)if(m.kind!=='grenade')add(m,m.radius??1);
 for(const m of grenadeMarkers(g))add(m,m.radius??1);
 return cells;
}
function drawMap(g,radius){
 const p=g.player,marks=dangerCells(g);
 const x0=radius?Math.max(0,p.x-radius):0,x1=radius?Math.min(SIZE-1,p.x+radius):SIZE-1,y0=radius?Math.max(0,p.y-radius):0,y1=radius?Math.min(SIZE-1,p.y+radius):SIZE-1;
 const tens=[],ones=[];for(let x=x0;x<=x1;x++){tens.push(String(Math.floor(x/10)),' ');ones.push(String(x%10),' ');}
 const lines=['    '+tens.join(''),'    '+ones.join('')];
 for(let y=y0;y<=y1;y++){
  let row=String(y).padStart(3,' ')+' ',edge='    ';
  for(let x=x0;x<=x1;x++){
   row+=tileChar(g,x,y,marks)+(x<x1?edgeChar(g,{x,y},{x:x+1,y},true):'');
   edge+=(y<y1?edgeChar(g,{x,y},{x,y:y+1},false):' ')+' ';
  }
  if(row.slice(4).trim())lines.push(row.trimEnd());if(y<y1&&edge.trim())lines.push(edge.trimEnd());
 }
 return lines;
}
const LEGEND='圖例：@你 a-z敵人(見下表) &友軍 ?感測到的位置 >電梯 C補給箱(c已開) T終端(t額度用完) B油桶 o掩體/障礙 N巢穴 M任務目標 W地上武器 *地上物品 X危險地形 ~毒霧 %煙霧 !即將爆炸｜地板 .視野內 ,記憶中 :暗處(視野內) ;暗處(記憶)｜邊線 +關閉的門 \'開著的門 |或-隔板(擋視線) !或_矮隔板(可翻越)';

// ---- views ---------------------------------------------------------------------------------------------------------
function weaponLine(g,slot){
 const p=g.player,w=g.weaponAt(slot),d=g.weaponDamage(slot);
 const ammo=w.melee?'近戰':`${p.ammo[slot]}/${w.mag} 備彈 ${p[g.reserveKey(w)]??0}/${g.ammoCapacity(w.ammoType)}${AMMUNITION[w.ammoType]?` ${AMMUNITION[w.ammoType].name}`:''}`;
 return `[${slot}]${slot===p.weapon?'*':' '}${w.name}${p.upgrades[slot]?` +${p.upgrades[slot]}`:''} 傷害 ${d.min}-${d.max}${w.hits?` ×${w.hits}`:''} 射程 ${w.range} ${ammo}${w.melee&&g.bumpMeleeSlot()===slot?' 撞擊用':''}${w.affix?` 詞條:${w.affixText}`:''}`;
}
function status(g){
 const p=g.player,def=missionDefinition(g),progress=missionProgress(g),faction=factionDef(g.facilityFaction)?.name||g.facilityFaction;
 const lines=[`== 第 ${g.floor} 層 ${floorInfo(g.floor).name} · 回合 ${g.turn} · ${CHARACTERS[p.character].label} · ${faction} · 任務：${def.name} ${progress.done}/${progress.total}${g.status!=='playing'?` · 狀態：${g.status}`:''}`];
 lines.push(`生命 ${p.hp}/${p.maxHp} 護甲板 ${p.plates||0}/${g.plateCapacity} 裝甲 ${p.armor||0} · ${levelLabel(p.level)}（${levelTitle(p.level,p.xp)}）· 位置 ${at(p)} · 廢料 ${p.scrap||0}`);
 const flags=[g.pursuit?'追擊：下次攻擊不耗回合':'',g.shadowSteps?`免費移動 ${g.shadowSteps}`:'',suppressionStatus(p),isDark(g,p)?'你在暗處':'',p.focus?'穩定瞄準':'',p.guard?'防禦待機':'',p.poison?`中毒 ${p.poison}`:'',p.control?.disabled?`失能 ${p.control.disabled}`:'',p.recovery?'鏈鋸收勢：下次行動跳過':'',...traitLabels(p).filter(Boolean)].filter(Boolean);
 if(flags.length)lines.push(`狀態：${flags.join(' · ')}`);
 lines.push('武器：',...p.owned.map(slot=>'  '+weaponLine(g,slot)));
 const supplies=[`醫療包 ${p.meds||0}`,...Object.entries(GRENADES).map(([,d])=>`${d.name} ${p[d.resource]||0}`),`照明彈 ${p.flares||0}`,`逃命繩索 ${p.escapeLines||0}`,`重部署鉤索 ${p.redeployLines||0}`,`修復噴劑 ${p.sprays||0}`,`腎上腺素 ${p.adrenaline||0}`,`摺疊掩體 ${p.barricades||0}`];
 lines.push(`物資：${supplies.join(' · ')}（投擲物共用上限 ${g.ammoCapacity('grenade')}）${p.wearables?.length?` · 配件 ${p.wearables.join(',')}`:''}`);
 const skill=p.prepared.skill?`${SKILLS[p.prepared.skill]?.name||p.prepared.skill}（${skillStatus(p,p.prepared.skill)}）`:'未預備';
 lines.push(`預備：投擲 ${preparedEntry(p,'grenade')?.name||'未預備'} · 道具 ${preparedEntry(p,'item')?.name||'未預備'} · 技能 ${skill}`);
 return lines;
}
function enemyRows(g){
 const p=g.player,list=visibleEnemies(g);
 if(!list.length)return ['視野內沒有敵人。'];
 return ['敵人（t/f 用字母或 id）：',...list.map(e=>{
  const view=Object.create(g);view.target=e.id;const card=targetDetails(view)||{};
  const enemy=ENEMY_TYPES[e.type],reach=enemy?.range??0,threat=!isNoncombatant(e)&&reach>1&&distance(e,p)<=reach&&g.sight(e,p);
  const cover=threat?(g.protectingCover(p,e)?(g.accuracy(e,p).coverEfficiency===.5?'你對它半效掩護':'你對它有掩護'):'你對它暴露'):'';
  const intent=[e.charge?'蓄力/瞄準中':'',e.windup?`預備 ${e.windup}`:'',e.tongueIntent?'鉤舌預備':'',e.grenadeIntent?'準備投彈':'',e.alert?'':'未察覺',g.target===e.id?'已鎖定':''].filter(Boolean);
  return `  ${letterOf(g,e)} ${e.id} ${enemyName(e)} ${at(e)} 距離 ${distance(p,e)} HP ${hp(e)}${enemy?.armor?` 裝甲 ${enemy.armor}`:''} · ${card.chance||''} · 目標${card.cover||''}${card.state?` · ${card.state}`:''}${card.traits?` · ${card.traits}`:''}${card.order?` · ${card.order}`:''}${cover?` · ${cover}`:''}${intent.length?` · ${intent.join(' · ')}`:''}`.replace(/\n/g,' ');
 })];
}
function nearbyRows(g){
 const p=g.player,rows=[];
 for(const t of g.nearbyObjectives)rows.push(`  obj ${t.id}：回收機密`);
 for(const c of g.nearbyContainers)rows.push(`  open ${c.id}：${g.containerLabel(c)}`);
 for(const b of g.nearbyDoors)rows.push(`  door ${b.id}：${g.doorLabel(b)}`);
 for(const i of g.items.filter(i=>distance(i,p)<=1&&i.type==='weapon'))rows.push(`  地上武器 [${i.slot}] ${weaponLine(g,i.slot).slice(4)} → take ${i.slot} / scrapgun ${i.slot} / replace ${i.slot} <背包槽>`);
 if(g.nearbyTerminal)rows.push(`  終端 ${g.nearbyTerminal.id}：剩餘額度 ${terminalRemaining(g.nearbyTerminal)}（term 看品項，buy 購買）`);
 if(g.canTouch(g.exitPoint))rows.push(`  電梯：${g.exitBlocked||'可以 down 前往下一層'}`);
 if(g.operatorCorpse&&!g.operatorCorpse.recovered&&g.canTouch(g.operatorCorpse))rows.push('  recover：回收人員識別資料');
 return rows.length?['可互動：',...rows]:[];
}
function surroundings(g){
 const p=g.player,rows=[],near=o=>g.seen[o.y]?.[o.x]&&distance(o,p)<=10;
 const items=g.items.filter(i=>near(i)&&i.type!=='weapon');if(items.length)rows.push(`地上物品：${items.map(i=>`${itemName(i)}${amount(i)}${at(i)}`).join('、')}`);
 const weapons=g.items.filter(i=>near(i)&&i.type==='weapon');if(weapons.length)rows.push(`地上武器：${weapons.map(i=>`${g.weaponAt(i.slot).name}[${i.slot}]${at(i)}`).join('、')}`);
 const cases=g.props.filter(o=>isContainer(o)&&!o.opened&&near(o));if(cases.length)rows.push(`未開的箱子：${cases.map(c=>`${c.id} ${containerName(c)}${at(c)}`).join('、')}`);
 const barrels=g.props.filter(o=>o.type==='barrel'&&o.hp>0&&near(o));if(barrels.length)rows.push(`爆裂油桶（可鎖定射擊）：${barrels.map(b=>`${b.id}${at(b)} 耐久 ${hp(b)}`).join('、')}`);
 const terminals=g.props.filter(o=>o.type==='terminal'&&near(o));if(terminals.length)rows.push(`終端：${terminals.map(t=>`${t.id}${at(t)} 額度 ${terminalRemaining(t)}`).join('、')}`);
 const doors=g.barriers.filter(b=>b.type==='door'&&b.hp>0&&(g.seen[Math.floor(b.y)]?.[Math.floor(b.x)]||g.seen[Math.ceil(b.y)]?.[Math.ceil(b.x)])&&distance(b,p)<=8);
 if(doors.length)rows.push(`門：${doors.map(b=>`${b.id} ${edgeAt(b)}${b.open?'開':'關'}`).join('、')}`);
 if(g.seen[g.exitPoint.y]?.[g.exitPoint.x])rows.push(`電梯 ${at(g.exitPoint)}${g.exitBlocked?`：${g.exitBlocked}`:''}`);
 const threats=[...g.marks.filter(m=>m.kind!=='grenade').map(m=>`${m.kind==='ally'?'友軍轟炸':'轟炸'}${at(m)} 半徑 ${m.radius??1} 剩 ${Math.max(1,m.due-g.turn)} 輪`),
  ...grenadeMarkers(g).map(m=>`手榴彈${m.label}${at(m)} 半徑 ${m.radius??1}`),
  ...tongueTelegraphs(g).map(t=>`鉤舌：${t.sourceId} 會把 ${at(t.target)} 的人拉到 ${at(t.landing)}`),
  ...(g.reinforcements||[]).filter(s=>g.visible(s)).map(s=>`增援 ${at(s)} 剩 ${Math.max(1,s.due-g.turn)} 輪`)];
 if(threats.length)rows.push(`預告：${threats.join('；')}`);
 const clouds=[...(g.smoke||[]).map(s=>`${s.kind==='toxic'?'毒霧':s.kind==='spore'?'孢子煙':'煙霧'} 剩 ${Math.max(1,s.expires-g.turn)} 輪`),...(g.flares||[]).filter(f=>g.seen[f.y]?.[f.x]).map(f=>`照明彈${at(f)} 剩 ${Math.max(1,f.expires-g.turn)} 輪`)];
 if(clouds.length)rows.push(clouds.join('；'));
 const allies=(g.localAllies||[]).filter(a=>a.hp>0&&a.status==='active');if(allies.length)rows.push(`友軍：${allies.map(a=>`${a.id}${at(a)} HP ${hp(a)}`).join('、')}`);
 return rows;
}
function perkRows(g){
 if(!g.pendingPerks||g.status!=='playing')return [];
 return [`★ 升級待選（還有 ${g.pendingPerks} 次，選完才能行動）：`,...g.perkChoices.map(o=>`  perk ${o.id}：${o.name}（目前 ${g.player.perks?.[o.id]||0}${o.cap===null?'':`/${o.cap}`}）${o.text}`)];
}
function look(g,{radius=9}={}){
 return [...status(g),...perkRows(g),...drawMap(g,radius),...enemyRows(g),...nearbyRows(g),...surroundings(g)];
}
// After an action the view is shorter, so a long run fits in an agent's context; look prints everything.
function brief(g){
 const p=g.player,def=missionDefinition(g),progress=missionProgress(g),w=g.weapon;
 const head=`== 第 ${g.floor} 層 · 回合 ${g.turn} · 生命 ${p.hp}/${p.maxHp} 護甲板 ${p.plates||0}/${g.plateCapacity} · ${levelLabel(p.level)} · 位置 ${at(p)} · 任務 ${def.name} ${progress.done}/${progress.total}${g.status!=='playing'?` · ${g.status}`:''}`;
 const kit=`${w.name} ${w.melee?'近戰':`${p.ammo[p.weapon]}/${w.mag} 備 ${p[g.reserveKey()]??0}`} · 醫療包 ${p.meds||0} · ${preparedEntry(p,'grenade')?.name||'投擲'} ${p[preparedEntry(p,'grenade')?.resource]||0} · 技能 ${p.prepared.skill?`${SKILLS[p.prepared.skill]?.name} ${skillStatus(p,p.prepared.skill)}`:'無'} · 廢料 ${p.scrap||0}`;
 const flags=[g.pursuit?'追擊就緒':'',g.shadowSteps?`免費移動 ${g.shadowSteps}`:'',suppressionStatus(p),isDark(g,p)?'你在暗處':'',p.focus?'穩定瞄準':'',p.poison?`中毒 ${p.poison}`:'',p.control?.disabled?`失能 ${p.control.disabled}`:'',p.recovery?'鏈鋸收勢':''].filter(Boolean);
 return [head,kit+(flags.length?` · ${flags.join(' · ')}`:''),...perkRows(g),...drawMap(g,7),...enemyRows(g),...nearbyRows(g),...surroundings(g)];
}
function inventory(g){
 const p=g.player,rows=['武器（背包 '+p.owned.length+'/'+g.weaponCapacity+'）：',...p.owned.map(slot=>{const w=g.weaponAt(slot);return `  ${weaponLine(g,slot)} · ${w.desc||''}${w.locked?' · 固定裝備':''}`;})];
 rows.push(`撞擊武器：${g.bumpMeleeSlot()===UNARMED_SLOT?'徒手':`[${g.bumpMeleeSlot()}] ${g.weaponAt(g.bumpMeleeSlot()).name}`}（bump <槽|none> 更換，不耗回合）`);
 rows.push('備彈：'+AMMO_IDS.map(id=>`${AMMUNITION[id].name} ${p[AMMUNITION[id].key]||0}/${g.ammoCapacity(id)}`).join(' · '));
 for(const category of ['grenade','item','skill']){
  const options=preparedOptions(p,category).map(([id,e])=>`${id}${p.prepared[category]===id?'*':''}(${e.name}${e.resource?` ${p[e.resource]||0}${CAPPED_ITEMS.includes(id)?`/${g.itemCapacity()}`:''}`:''}${category==='skill'?` ${skillStatus(p,id)}`:''})`);
  rows.push(`可預備 ${category}：${options.join(' ')||'無'}`);
 }
 const learning=Object.entries(p.learningItems||{}).filter(([,n])=>n>0);if(learning.length)rows.push(`學習資料：${learning.map(([id,n])=>`${id}(${LEARNING_ITEMS[id]?.name||id})×${n}`).join('、')}`);
 const perks=PERKS.filter(o=>(p.perks?.[o.id]||0)>0);if(perks.length)rows.push(`本局強化：${perks.map(o=>`${o.name}×${p.perks[o.id]}`).join('、')}`);
 return rows;
}
function terminalRows(g){
 const t=g.nearbyTerminal;if(!t)return ['附近沒有可用的補給終端。'];
 const p=g.player,offers=['heal','med','ammo',...AMMO_IDS,'grenade','smoke','emp','stun',...Object.keys(TERMINAL_ITEMS).filter(id=>TERMINAL_ITEMS[id].sold!==false),...p.owned.map(slot=>`upgrade:${slot}`)].filter(o=>terminalSells(t,o));
 const label=o=>o==='heal'?`治療 ${TERMINAL_TUNING.healAmount}`:o==='med'?'醫療包':o==='ammo'?`綜合彈藥包(${Object.entries(TERMINAL_PACK).map(([k,v])=>`${AMMUNITION[k]?.name||k}${v}`).join(' ')})`:TERMINAL_AMMO[o]?`${AMMUNITION[o].name} ${TERMINAL_AMMO[o].amount} 發`:GRENADES[o]?GRENADES[o].name:o==='grenade'?GRENADES.frag.name:TERMINAL_ITEMS[o]?PREPARED_CATALOG.item[o]?.name||o:o.startsWith('upgrade:')?`改裝 ${g.weaponAt(Number(o.slice(8))).name}（+5 傷害）`:o;
 const rows=[`${terminalName(t)} ${t.id}：剩餘額度 ${terminalRemaining(t)}，你有廢料 ${p.scrap||0}。一次買一項，耗 1 回合；抵價物以 60% 計價，不足用廢料補，多的作廢。`];
 for(const o of offers){const reason=offerReason(g,o);rows.push(`  buy ${o}：${label(o)} 價格 ${terminalCost(o,g)}${reason?` ✗ ${reason}`:''}`);}
 const holdings=tradeHoldings(g).filter(r=>r.held>0);
 if(holdings.length)rows.push('可抵價（buy <品項> <抵價id>=<數量> ...；數量以單位計）：',...holdings.map(r=>`  ${r.id}：${r.name} 每${r.unit} 抵 ${r.value}，最多 ${r.max}${r.reason?` ✗ ${r.reason}`:''}`));
 return rows;
}
const HELP=`指令（用 ; 分隔可一次下多個；遇到新敵人、受傷、被拒絕、升級、換層時會自動停下）：
移動  n s e w（可加步數 n3）· go X,Y · go <箱子/終端/門/敵人 id> · go exit（只走已探索的格子，走進關著的門會開門）
戰鬥  t <敵人>（鎖定）· f [敵人]（開火，可順便鎖定）· r（裝填）· wait（防禦待機：受傷減半、被射擊 −15，下次射擊 +15）
     swap [槽]（換武器，不給槽就換下一把）· g <X,Y|敵人>（投擲預備的投擲物）· launch <X,Y|敵人>（榴彈類武器對地）
     flare <X,Y|敵人> · skill [X,Y] · cover <n|s|e|w>（架摺疊掩體）· use <medkit|spray|adrenaline>（使用道具）
     rope <escape|redeploy> <X,Y>（繩索：直線拉到 6 格內看得見的地板；escape 不耗回合，redeploy 耗 1 回合）
     bump <背包槽|none>（撞上敵人時用哪一把近戰武器，不耗回合；none＝背包裡第一把）
背包  prep <grenade|item|skill> <id|none>（預備，換配件耗 1 回合）· swap/take/salvage/scrapgun/replace（見下）
     take <地上槽> · salvage <背包槽>（拆背包武器）· scrapgun <地上槽>（就地拆）· replace <地上槽> <背包槽>
互動  open [id] · door <id> · obj <id> · buy <品項> [抵價id=數量 ...] · down（電梯）· perk <id> · recover
     learn <學習資料 id>（背包裡的學習資料，不耗回合；id 看 inv）
職業  class（獵獸與工坊面板）· pet <X,Y|@>（指揮獵獸，需先 prep skill pet_command）· feed <飼料 id|weapon <槽>>
     build <藍圖> [投擲物] [武器槽] · deploy <序列> <X,Y> · repair <機體 id>
資訊  look · map（全圖）· inv · term · class · enemy <敵人>（含圖鑑）· codex [兵種]（敵人圖鑑）· log [n] · help
鎖定  油桶、補給箱、門、隔板都可以 t <id> 鎖定再 f 開火（油桶會爆炸）。
其他  act <type> <json>（直接送出任何規則動作，用於工程師/德魯伊等特殊操作）
座標 X 往東增加、Y 往南增加。`;

// The hostile database the game keeps open in the journal: what a card is, not where it is now.
function codexRows(g,type){
 const e=ENEMY_TYPES[type];if(!e)return [`圖鑑沒有 ${type}。`];
 const name=enemyName({type,faction:g.facilityFaction});
 return [`圖鑑 ${type}：${name} · 生命 ${e.hp} · 射程 ${e.range} · 護甲 ${e.armor||0}${e.damage?` · 傷害 ${e.damage.min??e.damage}-${e.damage.max??e.damage}`:''}${e.revealRange?` · 只在 ${e.revealRange} 格內看得到`:''}`,
  `  ${e.role||''}${startingTraits(type,g.floor).length?` · 被動：${traitLabels({traits:startingTraits(type,g.floor)}).join('、')}`:''}`];
}

// What the class panels show in the game: the pet's stomach and growth, the workshop's lines and chassis.
function classRows(g){
 const p=g.player,rows=[];
 const pet=petFeedingState(g);
 if(pet){
  rows.push(`獵獸 ${pet.actorId}：${petStatusLine(pet)} · ${fuelLabel(pet)}`);
  rows.push(`  成長：${Object.entries(pet.growth).map(([line,v])=>`${line} ${v.rank} 階（${lineProgress(line,v)}）`).join(' · ')}`);
  const feed=pet.options.filter(o=>o.allowed);
  rows.push(`  可餵（feed <id>）：${feed.map(o=>`${o.action.optionId}${o.action.weaponSlot!==undefined?` ${o.action.weaponSlot}`:''}（${o.resource||''} ${o.amount||1}→成長 +${o.gain}）`).join('、')||'目前沒有可餵的東西'}`);
  rows.push('  指揮：先 prep skill pet_command，再 pet <X,Y>；點自己＝召回。');
 }
 if(p.skills?.includes('workshop')){
  rows.push(`工坊：廢料 ${p.scrap||0} · 生產序列 ${p.productionLines.length}/${lineLimit(p)} · 已部署 ${deployedUnits(g).length}/${deployLimit(p)}`);
  rows.push(`  序列：${p.productionLines.map((unit,i)=>`[${i}] ${unit?`${unit.name||unit.blueprint} 完成，deploy ${i} <X,Y>`:'空'}`).join('；')||'（空）'}`);
  const blueprints=Object.entries(UNIT_BLUEPRINTS).filter(([id,def])=>!def.enemy||p.blueprints.includes(id));
  rows.push(`  可生產（build <id> [投擲物] [武器槽]）：${blueprints.map(([id,def])=>`${id}（${def.name} ${def.cost}${def.payload?' 需投擲物':''}${def.mount?' 可掛武器':''}）`).join('、')}`);
  const repairable=repairTargets(g);
  rows.push(`  可修理（repair <id>）：${repairable.map(a=>`${a.id} HP ${a.hp}/${a.maxHp}`).join('、')||'附近沒有相鄰的機體'}`);
 }
 if(!rows.length)rows.push('這個職業沒有額外的面板；技能看 inv。');
 return rows;
}
const ACTION_TYPES=['move','fire','launch','reload','wait','weapon','grenade','flare','rope','meleeChoice','usePrepared','prepare','heal','plate','surge','skill','grapple','suppressiveFire','deployCover','openContainer','door','recoverObjective','takeWeapon','salvage','salvageGround','replaceWeapon','terminal','learn','dismantleLearning','commandPet','setPetOutput','feedPet','buildUnit','deployUnit','repairUnit','interact'];

// ---- commands ------------------------------------------------------------------------------------------------------
function route(g,goal){
 const p=g.player,reached=typeof goal==='function'?goal:q=>q.x===goal.x&&q.y===goal.y;
 const queue=[{x:p.x,y:p.y,first:null}],seen=new Set([`${p.x},${p.y}`]);
 const blocked=q=>g.hazards.some(h=>h.x===q.x&&h.y===q.y)||visibleEnemies(g).some(e=>e.x===q.x&&e.y===q.y);
 for(let i=0;i<queue.length;i++){
  const q=queue[i];if(i&&reached(q))return q.first;
  for(const [dx,dy] of Object.values(DIRS)){
   const n={x:q.x+dx,y:q.y+dy},k=`${n.x},${n.y}`;
   if(seen.has(k)||!g.seen[n.y]?.[n.x]||!g.passable(n.x,n.y)||!g.canRoute(q,n)||blocked(n))continue;
   seen.add(k);queue.push({...n,first:q.first||[dx,dy]});
  }
 }
 return null;
}
function snapshotThreat(g){
 const p=g.player;
 return {hp:p.hp,plates:p.plates||0,floor:g.floor,status:g.status,perks:g.pendingPerks,enemies:new Set(visibleEnemies(g).map(e=>e.id)),marks:dangerCells(g).size+tongueTelegraphs(g).length};
}
function interruption(g,before){
 const now=snapshotThreat(g);
 if(now.status!=='playing')return `任務結束（${now.status}）`;
 if(now.floor!==before.floor)return '已換層';
 if(now.perks>before.perks)return '升級待選';
 if(now.hp<before.hp||now.plates<before.plates)return `受到傷害（生命 ${before.hp}→${now.hp}，護甲板 ${before.plates}→${now.plates}）`;
 const fresh=[...now.enemies].filter(id=>!before.enemies.has(id));if(fresh.length)return `發現新敵人 ${fresh.join(', ')}`;
 if(now.marks>before.marks)return '出現新的攻擊預告';
 return '';
}
function command(file,log,g,text,report){
 const [name,...rest]=text.trim().split(/\s+/),arg=rest[0];
 // A pending level-up refuses every action with no message of its own, so say so instead of reporting a silent success.
 if(g.pendingPerks&&g.status==='playing'&&!['perk','look','map','inv','term','enemy','codex','log','help'].includes(name))fail(`升級待選中：先用 perk <id> 選一個（${g.perkChoices.map(o=>o.id).join('／')}）。`);
 const act=(type,value)=>perform(log,g,makeOp('action',type,value));
 const need=(value,message)=>value??fail(message);
 const walk=(goalTest,label,limit=80)=>{
  let steps=0;const before=snapshotThreat(g);
  while(steps<limit){
   if(goalTest(g.player))return {text:`${label}：抵達（${steps} 步）`,ok:true};
   const step=route(g,goalTest);if(!step)return {text:`${label}：找不到已探索的路線（走了 ${steps} 步）`};
   const from={x:g.player.x,y:g.player.y};
   if(!act('move',step))return {text:`${label}：移動被拒絕（走了 ${steps} 步）：${g.logs[0]?.text||''}`};
   if(g.player.x===from.x&&g.player.y===from.y)return {text:`${label}：前進受阻，停下（走了 ${steps} 步）：${g.logs[0]?.text||''}`};
   steps++;const why=interruption(g,before);if(why)return {text:`${label}：中斷，${why}（走了 ${steps} 步）`};
  }
  return {text:`${label}：超過 ${limit} 步，先停下`};
 };
 const walked=result=>report(result.text,!result.ok);
 const target=token=>{const t=findTarget(g,token);if(!t)fail(`視野內沒有 ${token}。`);if(g.target!==t.id)perform(log,g,makeOp('target',t.id));return t;};
 const where=token=>need(point(g,token),`無法解讀座標或目標 ${token}（用 X,Y 或敵人字母/id）。`);
 if(/^[nsew]\d*$/.test(name)){
  const count=Number(name.slice(1)||1),before=snapshotThreat(g);let done=0;
  for(;done<count;done++){if(!act('move',DIRS[name[0]]))return report(`${name}：被拒絕：${g.logs[0]?.text||''}`,true);const why=interruption(g,before);if(why){done++;return report(`${name}：走了 ${done} 步後中斷，${why}`,true);}}
  return report(`${name}：移動 ${done} 步`);
 }
 switch(name){
  case 'go':{
   const token=need(arg,'go 需要 X,Y、id 或 exit。');
   if(token==='exit'){const e=g.exitPoint;if(!g.seen[e.y]?.[e.x])fail('還沒看到電梯。');return walked(walk(q=>distance(q,e)<=1&&g.canCross(q,e),'前往電梯'));}
   const m=/^(-?\d+),(-?\d+)$/.exec(token);if(m){const goal={x:Number(m[1]),y:Number(m[2])};return walked(walk(q=>q.x===goal.x&&q.y===goal.y,`前往 ${token}`));}
   const thing=[...g.props,...g.barriers,...visibleEnemies(g)].find(o=>o.id===token)||findEnemy(g,token);if(!thing)fail(`找不到 ${token}。`);
   const cells=isBarrier(thing)?[{x:Math.floor(thing.x),y:Math.floor(thing.y)},{x:Math.ceil(thing.x),y:Math.ceil(thing.y)}]:[thing];
   return walked(walk(q=>cells.some(c=>distance(q,c)<=1&&(c.x!==q.x||c.y!==q.y||isBarrier(thing))&&(isBarrier(thing)||g.canCross(q,c))),`前往 ${token}`));
  }
  case 't':case 'target':{const t=target(need(arg,'t 需要敵人。'));return report(`鎖定 ${t.id}`);}
  case 'f':case 'fire':{if(arg)target(arg);const ok=act('fire');return report(`開火：${ok?'完成':'被拒絕'}`,!ok);}
  case 'r':case 'reload':{const ok=act('reload');return report(`裝填：${ok?'完成':'被拒絕'}`,!ok);}
  case 'wait':case 'guard':{const ok=act('wait');return report(`防禦待機：${ok?'完成':'被拒絕'}`,!ok);}
  case 'swap':{const ok=act('weapon',arg===undefined?undefined:Number(arg));return report(`換武器：${ok?g.weapon.name:'被拒絕'}`,!ok);}
  case 'g':case 'grenade':{const ok=act('usePrepared',{category:'grenade',target:where(need(arg,'g 需要落點。'))});return report(`投擲：${ok?'完成':'被拒絕'}`,!ok);}
  case 'launch':{const ok=act('launch',where(need(arg,'launch 需要落點。')));return report(`發射：${ok?'完成':'被拒絕'}`,!ok);}
  case 'flare':{const ok=act('flare',where(need(arg,'flare 需要落點。')));return report(`照明彈：${ok?'完成':'被拒絕'}`,!ok);}
  case 'bump':{const slot=arg==='none'?null:Number(need(arg,'bump 需要背包槽或 none。'));const ok=act('meleeChoice',slot);return report(`撞擊武器：${ok?(slot===null?'背包裡第一把':g.weaponAt(slot).name):'被拒絕'}`,!ok);}
  case 'rope':{const item={escape:'escape_line',redeploy:'redeploy_line'}[arg];if(!item)fail('rope 需要 escape 或 redeploy。');const to=where(need(rest[1],'rope 需要落點。'));const ok=act('rope',{x:to.x,y:to.y,item});return report(`${PREPARED_CATALOG.item[item].name}：${ok?'完成':'被拒絕'}`,!ok);}
  case 'skill':{const ok=act('usePrepared',arg?{category:'skill',target:where(arg)}:{category:'skill'});return report(`技能：${ok?'完成':'被拒絕'}`,!ok);}
  case 'cover':{const d=DIRS[arg];if(!d)fail('cover 需要 n/s/e/w。');const ok=act('deployCover',d);return report(`架設掩體：${ok?'完成':'被拒絕'}`,!ok);}
  case 'use':{
   const id=need(arg,'use 需要道具 id。'),entry=PREPARED_CATALOG.item[id];if(!entry?.action)fail(`${id} 不是可以直接使用的道具。`);
   if(entry.aim)fail(entry.aim==='side'?'摺疊掩體用 cover <方向>。':entry.action==='rope'?'繩索用 rope <escape|redeploy> <落點>。':'照明彈用 flare <落點>。');
   const reason=itemUseReason(g,id);if(reason)return report(`使用 ${entry.name}：${reason}`,true);
   const ok=act(entry.action);return report(`使用 ${entry.name}：${ok?'完成':'被拒絕'}`,!ok);
  }
  case 'prep':{const [category,id]=rest;const ok=act('prepare',{category,id:id==='none'?null:id});return report(`預備 ${category} ${id}：${ok?'完成':'被拒絕'}`,!ok);}
  case 'take':{const ok=act('takeWeapon',Number(arg));return report(`拾取武器：${ok?'完成':'被拒絕'}`,!ok);}
  case 'salvage':{const ok=act('salvage',Number(arg));return report(`拆解武器：${ok?'完成':'被拒絕'}`,!ok);}
  case 'scrapgun':{const ok=act('salvageGround',Number(arg));return report(`就地拆解：${ok?'完成':'被拒絕'}`,!ok);}
  case 'replace':{const ok=act('replaceWeapon',{take:Number(rest[0]),leave:Number(rest[1])});return report(`交換武器：${ok?'完成':'被拒絕'}`,!ok);}
  case 'open':{const id=arg||(g.nearbyContainers.length===1?g.nearbyContainers[0].id:fail('附近有多個或沒有箱子，請給 id。'));const ok=act('openContainer',id);return report(`開箱：${ok?'完成':'被拒絕'}`,!ok);}
  case 'door':{const b=g.nearbyDoors.find(b=>b.id===arg)||(g.nearbyDoors.length===1&&!arg?g.nearbyDoors[0]:null);if(!b)fail('附近沒有這扇門。');const ok=act('door',{id:b.id,open:!b.open});return report(`${b.open?'開門':'關門'}：${ok?'完成':'被拒絕'}`,!ok);}
  case 'obj':{const ok=act('recoverObjective',need(arg,'obj 需要 id。'));return report(`回收機密：${ok?'完成':'被拒絕'}`,!ok);}
  case 'buy':{
   const trade={};for(const pair of rest.slice(1)){const [id,count]=pair.split('=');trade[id]=Number(count);}
   const ok=act('terminal',{buy:need(arg,'buy 需要品項。'),trade});return report(`終端購買 ${arg}：${ok?'完成':'被拒絕'}`,!ok);
  }
  case 'down':{const floor=g.floor,ok=act('interact');return report(ok?(g.floor!==floor?`進入第 ${g.floor} 層`:`電梯：${g.status}`):'電梯：被拒絕',true);}
  case 'pet':{const ok=act('commandPet',where(need(arg,'pet 需要目的地（點自己＝召回）。')));return report(`指揮獵獸：${ok?'完成':'被拒絕（需要預備 pet_command 技能，目的地要在已探索的 6 格內）'}`,!ok);}
  case 'feed':{const value=arg==='weapon'?{optionId:'weapon',weaponSlot:Number(rest[1])}:{optionId:need(arg,'feed 需要飼料 id（看 class）。')};const ok=act('feedPet',value);return report(`餵食：${ok?'完成':'被拒絕'}`,!ok);}
  case 'build':{const ok=act('buildUnit',{blueprint:need(arg,'build 需要藍圖 id（看 class）。'),...(rest[1]?{payload:rest[1]}:{}),...(rest[2]!==undefined?{weapon:Number(rest[2])}:{})});return report(`生產：${ok?'完成':'被拒絕'}`,!ok);}
  case 'deploy':{const spot=where(need(rest[1],'deploy 需要序列與落點：deploy <序列> <X,Y>。'));const ok=act('deployUnit',{line:Number(arg),x:spot.x,y:spot.y});return report(`部署：${ok?'完成':'被拒絕'}`,!ok);}
  case 'repair':{const ok=act('repairUnit',need(arg,'repair 需要機體 id（看 class）。'));return report(`修理：${ok?'完成':'被拒絕'}`,!ok);}
  case 'class':say(...classRows(g));return report(null);
  case 'perk':{const ok=perform(log,g,makeOp('perk',need(arg,'perk 需要 id。')));return report(`選擇強化 ${arg}：${ok?'完成':'被拒絕'}`,!ok);}
  case 'recover':{const ok=perform(log,g,makeOp('recover'));return report(`回收識別資料：${ok?'完成':'被拒絕'}`,!ok);}
  case 'learn':{const ok=act('learn',arg);return report(`學習 ${arg}：${ok?'完成':'被拒絕'}`,!ok);}
  case 'act':{
   if(!arg){say(`act 可用的動作：${ACTION_TYPES.join('、')}。參數是 JSON，例如 act door {"id":"edge-1","open":true}、act repairUnit "ally-3"。`);return report(null);}
   const json=text.trim().slice(4+rest[0].length).trim();const ok=act(rest[0],json?JSON.parse(json):undefined);return report(`act ${rest[0]}：${ok?'完成':'被拒絕'}`,!ok);
  }
  case 'look':say(...look(g));return report(null);
  case 'map':say(...drawMap(g,0),LEGEND);return report(null);
  case 'inv':say(...inventory(g));return report(null);
  case 'term':say(...terminalRows(g));return report(null);
  case 'enemy':{
   const e=findTarget(g,need(arg,'enemy 需要目標。'));if(!e)fail(`視野內沒有 ${arg}。`);
   const view=Object.create(g);view.target=e.id;say(JSON.stringify(targetDetails(view),null,1),`特性：${(e.traits||[]).map(t=>t.id).join(', ')}`,...codexRows(g,e.type));return report(null);
  }
  case 'codex':say(...(arg?codexRows(g,arg):Object.keys(ENEMY_TYPES).filter(id=>!ENEMY_TYPES[id].variantOf).flatMap(id=>codexRows(g,id))));return report(null);
  case 'log':say(...g.logs.slice(0,Number(arg)||15).map(l=>`${String(l.turn).padStart(3,'0')} ${l.text}`));return report(null);
  case 'help':say(HELP,LEGEND);return report(null);
  default:fail(`不認得的指令 ${name}（help 看說明）。`);
 }
}

// ---- entry ---------------------------------------------------------------------------------------------------------
function options(args){const o={};for(let i=0;i<args.length;i++)if(args[i].startsWith('--'))o[args[i].slice(2)]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;return o;}
function main(argv){
 const [first,second,...more]=argv;
 if(!first||first==='help'){console.log(HELP+'\n'+LEGEND);return;}
 if(first==='new'){
  const file=second??fail('new 需要檔名。'),o=options(more);
  if(existsSync(file)&&!o.force)fail(`${file} 已存在；加 --force 覆寫。`);
  const seed=o.seed===undefined?Math.floor(Math.random()*1000000):Number(o.seed),mission=o.mission||'extraction';
  // 'random' everywhere, so a run can be dealt rather than chosen.
  const pick=list=>list[Math.floor(Math.random()*list.length)];
  const character=o.class==='random'?pick(Object.keys(CHARACTERS)):o.class||'soldier';
  if(!CHARACTERS[character])fail(`未知職業 ${character}。`);if(!MISSIONS[mission])fail(`未知任務 ${mission}。`);
  const faction=o.faction||'random',facilityFaction=faction==='random'?rollFacilityFaction(seed):faction;
  if(faction!=='random'&&!factionDef(facilityFaction))fail(`未知派系 ${faction}。`);
  const fresh=new Game(seed,[],0,character,'onyx',mission,{facilityFaction,realMode:false});
  const {log,game}=createReplay(fresh,{seed,character,mission,facilityFaction,tool:'text-play'});
  save(file,log,game);console.log([`已建立 ${file}（種子 ${seed}）。`,...look(game),LEGEND,'輸入 help 看指令。'].join('\n'));return;
 }
 if(first==='verify'){
  const file=second??fail('verify 需要檔名。'),log=JSON.parse(readFileSync(file,'utf8')),started=Date.now();
  const {game,step,mismatch}=replayLog(log);
  console.log(mismatch?`✗ 第 ${mismatch.step} 步不同：預期 ${mismatch.expected}，實際 ${mismatch.actual}（${JSON.stringify(mismatch.op||{})}）`:`✓ ${step} 步全部相同（${Date.now()-started} ms）。最後：第 ${game.floor} 層 回合 ${game.turn} 狀態 ${game.status} 雜湊 ${stateHash(game)}`);
  if(mismatch)process.exitCode=1;return;
 }
 const file=first,{log,g}=load(file),commands=[second,...more].filter(Boolean).join(' ').split(/[;\n]/).map(s=>s.trim()).filter(Boolean);
 const oldLog=g.logs[0],heard=[];g.onEnemyCallout=event=>heard.push(event);
 const results=[];let stopped='',infoOnly=true;
 for(let i=0;i<commands.length;i++){
  const text=commands[i],before=snapshotThreat(g);let halt=false;
  try{
   command(file,log,g,text,(line,stop=false)=>{if(line!==null){results.push(`> ${text}：${line.replace(/^[^：]*：/,'')}`);infoOnly=false;}halt=stop;});
  }catch(error){results.push(`> ${text}：錯誤：${error.message}`);stopped=commands.slice(i+1).join('; ');break;}
  if(g.status!=='playing'&&i<commands.length-1){stopped=commands.slice(i+1).join('; ');break;}
  const why=interruption(g,before);
  if((why||halt)&&i<commands.length-1&&!['look','map','inv','term','enemy','log','help'].includes(text.split(/\s+/)[0])){stopped=commands.slice(i+1).join('; ');if(why&&!results.at(-1)?.includes('中斷'))results.push(`  （中斷：${why}）`);break;}
 }
 save(file,log,g);
 const since=oldLog?g.logs.indexOf(oldLog):-1,fresh=since>=0?g.logs.slice(0,since):g.logs;
 const lines=[...results];
 if(stopped)lines.push(`未執行：${stopped}`);
 if(fresh.length)lines.push(`戰鬥紀錄（舊→新）${since<0&&oldLog?'，這批超過 50 行，只留得下最後 50 行':''}：`,...fresh.slice().reverse().map(l=>`  ${String(l.turn).padStart(3,'0')} ${l.danger?'⚠ ':''}${l.text}`));
 const calls=heard.map(e=>e.visibility==='visible'?`${e.name}${at(e.position)}：「${calloutLine(e)}」`:`${DIRECTION_ARROWS[e.direction]||''}聽到${COMPASS[e.direction]||e.direction}方：「${calloutLine(e)}」`).filter((v,i,a)=>a.indexOf(v)===i);
 if(calls.length)lines.push(`喊話：${calls.join(' ')}`);
 if(!commands.length)lines.push(...look(g));else if(!infoOnly)lines.push('',...brief(g));
 lines.push(...out);
 if(g.status!=='playing')lines.push(`== 任務已結束：${g.status}。操作紀錄共 ${log.ops.length} 步。`);
 console.log(lines.join('\n'));
}
try{main(process.argv.slice(2));}catch(error){console.error(`錯誤：${error.message}`);process.exitCode=1;}
