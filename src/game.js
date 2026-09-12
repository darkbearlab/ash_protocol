import {MAX_LEVEL,perkLimit,floorLimit,isEndless,scaleEnemy,giveCapSupply,PROTOCOL_EVENT_LIMIT} from './endless.js';
import {freshSpirit,validMeleeState,tickSpirit,bladeMultiplier,meleeDefense,ambushReady,shortenCamo,meleeReward,defensiveEvasion,grapplePlan,useGrapple,MELEE_TUNING} from './melee-classes.js';
import {healActor} from './traits.js';
import {ensurePerks,eligiblePerks,applyPerk,migratePerks,validPerks,plateDrop} from './perks.js';
import {droneRepairReason,repairDrone,ALLY_SKILLS,currentAllies,localAllies,connected,allyName,allyWeapon,occupied,addAlly,initializeAllies,canAllySkill,useAllySkill,commandPet,allyAct,carryCandidates,departAllies,arriveAllies,validAllies,swapReason,swapWithPlayer,tickPackedPet,tickSummons,petSkillReason,fitDrone,DRONE_HP,DRONE_BUILD_COST,droneCells,dronePlaces} from './allies.js';
import {archiveFloor,resumedFloor,arrivalCell,scheduleRetreatWave,resolveRetreatWave,validRetreatState} from './retreat.js';
import {toggleAnchor,validAnchor,SKILLS,initialSkillState,skillActive,canUseSkill,tickSkills,endSkillEffects,validSkillState} from './skills.js';
import {actorStat,meleeChance,validCombatModifiers} from './actor-stats.js';
import {fullLighting,validLighting,lightingEffects} from './lighting.js';
import {bestCover,coverEffects} from './cover.js';
import {addTrace,spentCase,validTraces} from './traces.js';
import {missionDefinition,missionDepth,returning,exitPoint,exitLabel,deepestFloor,newMission,prepareMission,validMission,missionObjects,missionTarget,missionSummary,exitBlocked} from './missions.js';
import {validModules} from './modules.js';
import {isContainer,containerName,validContainers} from './containers.js';
import {BARRIER_TYPES,vaultable,isBarrier,barrierName,barrierBetween,blockedBetween,edgeBlocks,edgeAdjacent,edgeCells,edgeCover,barrierFace,firstBarrierOnRay,validBarriers} from './barriers.js';
import {pickPortrait,portraitForLegacy,validPortrait} from './portraits.js';
import {SMOKE_DURATION,GRENADES,grenadeTotal,grenadeByItem,controlState,validControl,applyDisruption,skipDisabled,areaCells,tacticalSight} from './throwables.js';
import {CHARACTERS,validCharacter,grantCharacterTraits,startingSupplies,classCarryBonus} from './characters.js';
import {defaultPrepared,validPrepared,canPrepare,preparedEntry,weaponSwitchTurns} from './prepared.js';
import {grantTrait,activeTrait,bodyKeyword,startingTraits,validTraits,tickTraits,initiativeQueue,recordShot,validCombatMemory,reduceDirectDamage} from './traits.js';
import {AFFIXES,weaponStats,rollAffix} from './weapons.js';
import {AMMUNITION,AMMO_IDS,capacity,carryLevels,validCarryLevels,itemAmmo,splitLegacyRounds,TERMINAL_AMMO} from './ammunition.js';
import {presentStep} from './presentation.js';
import {SIZE,SAVE_VERSION,LEGACY_SAVE_VERSIONS,RARE_ARMORY,ENEMY_LOOT,WEAPONS,FLOORS,floorInfo,ENEMY_TYPES,PERKS,LORE} from './data.js';
import {PROTOCOL_REWARDS,newRunId,weaponUnlocked} from './progression.js';
import {random,distance,lineOfSight,generate,makeEnemy,DIRECTIONS,key} from './world.js';
import {combatSight,wallCover,adjacentWalls,shotChance,bracingBonus} from './combat.js';

const freshPlayer=()=>({battleSpirit:freshSpirit(),perks:{},perkWeaponBonus:0,character:'soldier',vaultExposed:false,smoke:0,emp:0,stun:0,control:controlState(),moveDelta:[0,0],fireChain:null,prepared:defaultPrepared(),skills:[],skillState:{},traits:[],x:0,y:0,hp:100,maxHp:100,meds:2,grenades:2,armor:0,bonus:0,blastBonus:0,healBonus:0,hazmat:0,scavenger:0,scrap:0,level:1,xp:0,kills:0,weapon:0,owned:[0,1],weaponBases:WEAPONS.map((_,i)=>i),affixes:WEAPONS.map(()=>null),ammo:WEAPONS.map((w,i)=>i<2?w.mag:0),upgrades:WEAPONS.map(()=>0),reserve:48,pistol:24,shell:12,energy:18,ordnance:4,facing:[0,1],guard:false,focus:false,evasive:false,poison:0,lore:[],stats:{shots:0,damage:0,grenades:0,salvaged:0}});
export const enemyName=e=>ENEMY_TYPES[e.type]?.name||'未知單位';

export class Game {
  constructor(seed=Date.now()%1000000,unlocks=[],carrying=0,character='soldier',portrait=pickPortrait(),mission='extraction') {
    if(!validCharacter(character))throw new Error('未知角色。');
    if(!validPortrait(portrait))throw new Error('未知頭像。');
    this.mission=newMission(mission);this.carryLevel=carryLevels(carrying);this.seed=seed;this.rng=random(seed);this.floor=1;this.turn=1;this.player=freshPlayer();
    Object.assign(this.player,{hp:CHARACTERS[character].hp||100,maxHp:CHARACTERS[character].hp||100,armor:CHARACTERS[character].armor||0,plates:CHARACTERS[character].plates||0});
    this.player.skills=[...(CHARACTERS[character].skills||[])];this.player.skillState=initialSkillState(this.player.skills);
    Object.assign(this.player,startingSupplies(character));Object.assign(this.player.prepared,CHARACTERS[character].prepared||{});
    this.player.portrait=portrait;this.player.character=character;grantCharacterTraits(this.player);this.player.owned=[...CHARACTERS[character].weapons];this.player.weapon=this.player.owned[0];this.player.ammo=WEAPONS.map((w,i)=>this.player.owned.includes(i)?w.mag:0);
    this.runId=newRunId();this.protocol={earned:0,events:[]};this.unlockedWeapons=[...unlocks];
    this.allies=[];this.allySerial=0;this.floorStates={};this.reinforcements=[];this.logs=[];this.status='playing';this.pendingPerks=0;this.perkPicks=0;this.legacyPerkPicks=0;this.perkDraft=null;this.effects=[];this.loadFloor();initializeAllies(this);this.reveal();
    this.log('已抵達轉運站。上下左右移動，尋找綠色電梯。');
  }
  loadFloor() {
    endSkillEffects(this.player);this.sensorContacts=[];this.player.vaultExposed=false;
    Object.assign(this,generate(this.seed,this.floor,this.unlockedWeapons));this.smoke=[];this.traces=[];this.reinforcements=[];this.player.control=controlState();
    for(const item of this.items)if(item.type==='weapon')this.registerWeapon(item,true);
    Object.assign(this.player,this.start);this.player.poison=0;this.player.guard=false;this.player.moved=false;this.player.moveDelta=[0,0];this.player.fireChain=null;this.player.focus=false;this.player.evasive=false;
    prepareMission(this);
    this.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));this.target=null;this.reveal();
  }
  get activeAllies(){return currentAllies(this);}
  get localAllies(){return localAllies(this);}
  actorWeapon(actor){return actor.kind?allyWeapon(actor):null;}
  meleeAccuracy(a,b,base=97){return meleeChance(a,b,base-this.defensiveEvasion(a,b));}
  defensiveEvasion(a,b){return defensiveEvasion(this,a,b);}
  grapplePlan(id=this.target){return grapplePlan(this,id);}
  get allyTravelSummary(){const near=carryCandidates(this).length,total=this.activeAllies.length;return total?`帶${near} 留${total-near}`:'';}
  get weapon(){return this.weaponAt(this.player.weapon);}
  weaponAt(slot){return weaponStats(this.player.weaponBases[slot],this.player.affixes[slot]);}
  fireChance(target){if(this.weapon.melee)return this.meleeAccuracy(this.player,target,this.weapon.hitChance);return this.enemies.includes(target)?this.accuracy(this.player,target).chance:Math.max(10,Math.min(99,97+(this.weapon.closeRange&&distance(this.player,target)<=this.weapon.closeRange?this.weapon.closeAccuracy:0)+actorStat(this.player,'rangedAccuracy')+(this.player.focus?15:0)+this.weapon.accuracyBonus+bracingBonus(this,this.player,target)-lightingEffects(this,this.player,target).penalty));}
  get visibleEnemies(){return this.enemies.filter(e=>e.hp>0&&this.teamVisible(e));}
  get targeted(){return [...this.enemies,...this.props,...this.barriers].find(e=>e.id===this.target&&e.hp>0&&this.teamVisible(e));}
  get perkChoices(){return ensurePerks(this);}
  get exitPoint(){return exitPoint(this);}
  get exitLabel(){return exitLabel(this);}
  get deepestFloor(){return deepestFloor(this);}
  get exitBlocked(){return exitBlocked(this);}
  get missionSummary(){return missionSummary(this);}
  get nearbyObjectives(){return missionObjects(this).filter(t=>!t.done&&this.canTouch(t));}
  recoverObjective(id){
    const t=this.nearbyObjectives.find(t=>t.id===id);
    if(!t)return this.fail('附近沒有可回收的機密資料。');
    t.done=true;
    if(missionDefinition(this).returnTrip){this.mission.returning=true;scheduleRetreatWave(this);this.log('機密已取得：返回本層入口上樓，沿原路撤離。',true);}
    this.log('機密資料已回收；'+this.missionSummary+'。');return true;
  }
  get bossAlive(){return this.enemies.some(e=>(e.type==='boss'||e.type==='warden')&&e.hp>0);}
  get nearbyTerminal(){return this.props.find(o=>o.type==='terminal'&&!o.used&&this.canTouch(o));}
  get groundWeapon(){return this.items.find(o=>o.type==='weapon'&&this.canTouch(o));}
  get cover(){if(activeTrait(this.player,'no_cover'))return [];return [...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,this.player)===1),...adjacentWalls(this.grid,this.player),...this.barriers.filter(b=>edgeAdjacent(b,this.player)&&edgeBlocks(b,'cover'))];}
  visible(e){return distance(this.player,e)<=Math.max(10,this.weapon.range)&&(isBarrier(e)?edgeCells(e).some(p=>this.sight(this.player,p)):this.sight(this.player,e));}
  teamVisible(e){return this.visible(e)||this.activeAllies.some(a=>connected(this,a)&&distance(a,e)<=8&&this.sight(a,e));}
  sight(a,b){return !(b===this.player&&a!==this.player&&skillActive(this.player))&&tacticalSight(this,a,b);}
  shotClear(a,b){return combatSight(this.grid,a,b,isBarrier(b)?this.barriers.filter(e=>e!==b):this.barriers,'shot');}
  canCross(a,b){return !blockedBetween(this.barriers,a,b);}
  canRoute(a,b){const edge=barrierBetween(this.barriers,a,b);return !edgeBlocks(edge)||edge.type==='door'||vaultable(edge);}
  canTouch(point){return distance(this.player,point)<=1&&this.canCross(this.player,point);}
  get nearbyContainers(){return this.props.filter(c=>isContainer(c)&&!c.opened&&this.canTouch(c));}
  containerLabel(c){const dx=c.x-this.player.x,dy=c.y-this.player.y;return `${dx>0?'東側':dx<0?'西側':dy>0?'南側':dy<0?'北側':'腳下'}${containerName(c)}`;}
  containerDrop(c){
    const p=this.player,steps=DIRECTIONS.map(([dx,dy])=>({x:c.x+dx,y:c.y+dy}));
    const facing={x:p.x+p.facing[0],y:p.y+p.facing[1]};
    const candidates=[...(distance(c,p)===0?[facing]:[]),{x:c.x,y:c.y},...steps];
    const safe=q=>this.grid[q.y]?.[q.x]===1&&(distance(c,q)===0||this.canCross(c,q))&&!this.solid(q.x,q.y)&&!this.enemies.some(e=>e.hp>0&&distance(e,q)===0)&&!this.props.some(o=>o!==c&&distance(o,q)===0)&&!this.hazards.some(h=>distance(h,q)===0)&&distance(p,q)>0;
    return candidates.find(q=>safe(q)&&!this.items.some(i=>distance(i,q)===0))||candidates.find(safe)||{x:p.x,y:p.y};
  }
  openContainer(id){
    const c=this.nearbyContainers.find(c=>c.id===id);if(!c)return this.fail('附近沒有可開啟的補給箱。');
    const pos=this.containerDrop(c),contents=c.contents;c.opened=true;c.contents=[];
    this.items.push(...contents.map(i=>({...i,...pos})));
    this.effects.push({type:'unpack',from:{x:c.x,y:c.y},to:pos,damage:0});
    this.log(`${containerName(c)}已開啟，補給${distance(pos,this.player)===0?'留在腳下，移開再走回拾取':'落在地上，走上去拾取'}。`);return true;
  }
  canOperateDoor(b){
    if(b.type!=='door'||b.hp<=0)return false;
    const p=this.player;if(edgeAdjacent(b,p))return true;
    // Reach from either door-side cell's lateral neighbors, never through another edge or solid tile.
    return edgeCells(b).some(q=>(b.axis==='x'?p.x===q.x&&Math.abs(p.y-q.y)===1:p.y===q.y&&Math.abs(p.x-q.x)===1)&&this.passable(q.x,q.y)&&this.canCross(p,q));
  }
  get nearbyDoors(){return this.barriers.filter(b=>this.canOperateDoor(b));}
  doorLabel(b){const dx=b.x-this.player.x,dy=b.y-this.player.y;return `${dx>0?'東':dx<0?'西':''}${dy>0?'南':dy<0?'北':''}側${b.open?'關門':'開門'}`;}
  setDoor(b,open){
    if(!b||b.type!=='door'||b.hp<=0)return false;
    if(b.open===open)return true;b.open=open;
    this.effects.push({type:'gate',from:{x:b.x,y:b.y},to:{x:b.x,y:b.y},axis:b.axis,open});
    this.log(`${barrierName(b)}已${open?'開啟':'關閉'}。`);this.reveal();return true;
  }
  accuracy(attacker,target){return shotChance(this,attacker,target);}
  solid(x,y){return this.props.find(o=>o.x===x&&o.y===y&&o.hp>0&&(o.type==='cover'||o.type==='barrel'));}
  passable(x,y,actor){return this.grid[y]?.[x]===1&&(!this.solid(x,y)||actor?.type==='drone');}
  reveal() {
    const radius=Math.max(10,this.weapon.range);
    this.visibleTiles=new Set();
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(distance(this.player,{x,y})<=radius&&this.sight(this.player,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const a of this.activeAllies.filter(a=>connected(this,a)))for(let y=Math.max(0,a.y-8);y<=Math.min(SIZE-1,a.y+8);y++)for(let x=Math.max(0,a.x-8);x<=Math.min(SIZE-1,a.x+8);x++)if(distance(a,{x,y})<=8&&this.sight(a,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const e of this.enemies)if(e.hp>0){const target=this.enemyTarget(e);if(distance(e,target)<=Math.max(10,ENEMY_TYPES[e.type].range)&&this.sight(e,target)){e.alert=true;e.lastKnown={x:target.x,y:target.y};}}
    this.autoTarget();
  }
  autoTarget(){if(!this.targeted)this.target=this.visibleEnemies.sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]?.id??null;}
  log(text,danger=false){this.logs.unshift({turn:this.turn,text,danger});this.logs=this.logs.slice(0,50);}
  reserveKey(weapon=this.weapon){return AMMUNITION[weapon.ammoType]?.key??null;}
  get weaponCapacity(){return CHARACTERS[this.player.character].weaponCapacity;}
  get plateCapacity(){return CHARACTERS[this.player.character].plateCapacity;}
  ammoCapacity(type){return capacity(type,this.carryLevel)+classCarryBonus(this.player.character,type);}
  dropAmmo(type,amount,pos=this.player){
    if(amount<=0)return;
    const item=AMMUNITION[type].item,existing=this.items.find(o=>o.type===item&&o.x===pos.x&&o.y===pos.y);
    if(existing)existing.amount=(existing.amount??AMMUNITION[type].pickup)+amount;
    else this.items.push({x:pos.x,y:pos.y,type:item,amount});
  }
  receiveAmmo(type,amount,{spill=true}={}){
    if(type==='grenade')return this.receiveGrenade('frag',amount,{spill});
    const key=AMMUNITION[type].key,accepted=Math.min(amount,Math.max(0,this.ammoCapacity(type)-this.player[key]));
    this.player[key]+=accepted;if(spill&&amount>accepted){this.dropAmmo(type,amount-accepted);this.log(`${AMMUNITION[type].name}超出容量，${amount-accepted} 留在腳下。`);}return accepted;
  }
  setCarryLevel(level){
    this.carryLevel=carryLevels(level);
    for(const [type,info]of Object.entries(AMMUNITION)){if(type==='grenade')continue;const excess=this.player[info.key]-this.ammoCapacity(type);if(excess>0){this.player[info.key]-=excess;this.dropAmmo(type,excess);}}
    this.trimGrenades();
  }
  receiveGrenade(id,amount,{spill=true}={}){
    const def=GRENADES[id],accepted=Math.min(amount,Math.max(0,this.ammoCapacity('grenade')-grenadeTotal(this.player)));
    this.player[def.resource]+=accepted;
    if(spill&&amount>accepted){this.dropGrenade(id,amount-accepted);this.log(`${def.name}超出共用容量，${amount-accepted} 留在腳下。`);}return accepted;
  }
  dropGrenade(id,amount){const def=GRENADES[id],p=this.player,item=this.items.find(o=>o.type===def.item&&distance(o,p)===0);if(item)item.amount=(item.amount??1)+amount;else this.items.push({x:p.x,y:p.y,type:def.item,amount});}
  trimGrenades(){let excess=grenadeTotal(this.player)-this.ammoCapacity('grenade');for(const [id,def]of Object.entries(GRENADES)){const n=Math.min(Math.max(0,excess),this.player[def.resource]);if(n){this.player[def.resource]-=n;this.dropGrenade(id,n);excess-=n;}}}
  supplyPack(amounts){for(const [type,amount]of Object.entries(amounts))this.receiveAmmo(type,amount);}
  weaponDamage(index=this.player.weapon,target=null){const w=this.weaponAt(index),close=target&&w.closeRange&&distance(this.player,target)<=w.closeRange,bonus=this.player.bonus+Math.ceil(this.player.perkWeaponBonus/(w.burst||1))+(this.player.upgrades[index]||0)*5;return {min:(close?w.closeMin:w.min)+bonus,max:(close?w.closeMax:w.max)+bonus};}
  fail(text){this.log(text);return false;}
  awardProtocol(type,id) {const event=`${type}:${id}`,amount=PROTOCOL_REWARDS[type];if(!amount||this.protocol.events.includes(event))return;this.protocol.events.push(event);this.protocol.earned+=amount;this.log(`協定點數 +${amount}，死亡仍保留。`);}

  bumpMeleeSlot(){return this.player.owned.find(slot=>{const w=this.weaponAt(slot);return w.melee&&weaponSwitchTurns(w,this.weapon)===0&&weaponSwitchTurns(this.weapon,w)===0;});}
  actionCost(type,arg){if(type==='commandPet')return 0;if(type==='skill'&&arg==='pet_command'&&this.allies.some(a=>a.kind==='pet'&&['down','packed'].includes(a.status)))return 1;return type==='skill'?(SKILLS[arg]?.cost??1):type==='reload'&&activeTrait(this.player,'quick_reload')&&this.weapon.ammoType==='pistol'?0:type==='prepare'?0:type==='weapon'?weaponSwitchTurns(this.weaponAt(Number(arg)),this.weapon):1;}
  // Validate the intent before any actor acts: rejected input cannot scout fast enemies.
  validateAction(type,arg){
    const p=this.player,w=this.weapon;
    if(type==='repairDrone')return !droneRepairReason(this,arg)||this.fail(droneRepairReason(this,arg));
    if(type==='commandPet')return Boolean(p.prepared.skill==='pet_command'&&this.activeAllies.some(a=>a.kind==='pet')&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&this.seen[arg.y]?.[arg.x]&&this.passable(arg.x,arg.y)&&distance(p,arg)<=6);
    // Deploying or building a drone on a chosen free tile within two route steps; same cost as the skill.
    if(type==='placeDrone')return Boolean(arg&&p.prepared.skill===arg.id&&dronePlaces(this,arg.id)&&canAllySkill(this,arg.id)&&droneCells(this).some(q=>q.x===arg.x&&q.y===arg.y))||this.fail('部署位置需在你 2 步內、走得到的空格。');
    if(type==='skill'&&arg==='grapple'&&canUseSkill(p,arg)){const plan=grapplePlan(this);return !plan.reason||this.fail(plan.reason);}
    if(type==='skill')return (ALLY_SKILLS.includes(arg)?canAllySkill(this,arg):canUseSkill(p,arg))||this.fail((arg==='pet_command'&&p.prepared.skill===arg&&petSkillReason(this))||(arg==='raise_dead'&&p.prepared.skill===arg&&!p.control.disabled&&'目前沒有召喚物可以集結。')||'技能無法啟動：請確認預備欄與冷卻狀態。');
    if(type==='prepare')return Boolean(arg&&canPrepare(p,arg.category,arg.id)&&p.prepared[arg.category]!==arg.id);
    if(type==='heal'&&p.prepared.item!=='medkit')return this.fail('請先在背包預備醫療包。');
    if(type==='grenade'&&!preparedEntry(p,'grenade'))return this.fail('請先在背包預備手榴彈。');
    if(type==='move'){
      if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
      const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
      const edge=barrierBetween(this.barriers,p,{x,y});
      if(edgeBlocks(edge)&&!vaultable(edge)){if(edge.type==='door')return true;this.target=edge.id;return this.fail('隔板阻擋通行，可開火破壞。');}
      if(!this.passable(x,y))return this.fail('前方有牆壁或障礙。');
      const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
      if(ally){if(skillActive(p,'anchor'))return this.fail('下錨中無法移動，請先解除。');const reason=swapReason(this,ally);return !reason||this.fail(reason);}
      const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(e){this.target=e.id;if(!edgeBlocks(edge)&&this.bumpMeleeSlot()!==undefined&&this.visible(e)&&this.shotClear(p,e))return true;return this.fail('敵人擋住去路，先開火。');}return !skillActive(p,'anchor')||this.fail('下錨中無法移動，請先解除。');
    }
    if(type==='recoverObjective')return this.nearbyObjectives.some(t=>t.id===arg)||this.fail('附近沒有可回收的機密資料。');
    if(type==='openContainer')return this.nearbyContainers.some(c=>c.id===arg)||this.fail('附近沒有可開啟的補給箱。');
    if(type==='door')return Boolean(arg&&typeof arg.open==='boolean'&&this.nearbyDoors.some(b=>b.id===arg.id&&b.open!==arg.open));
    if(type==='fire'){const e=this.targeted;if(!e)return this.fail('射線內沒有目標。');if(distance(p,e)>w.range)return this.fail('目標超出射程。');if(!this.shotClear(p,e)||(w.melee&&!isBarrier(e)&&!this.canCross(p,e)))return this.fail('射線或近戰路徑被障礙物擋住。');return w.melee||p.ammo[p.weapon]>0||this.fail('彈匣已空，請裝填。');}
    if(type==='reload')return !w.melee&&(p.ammo[p.weapon]<w.mag&&p[this.reserveKey()]>0)||this.fail('彈匣已滿或沒有對應備彈。');
    if(type==='heal')return (p.meds>0&&(p.hp<p.maxHp||p.poison>0))||this.fail('無法使用醫療包。');
    if(type==='grenade')return (p[preparedEntry(p,'grenade').resource]>0&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&distance(p,arg)<=5&&this.grid[arg.y]?.[arg.x]===1&&this.visible(arg))||this.fail('需要手榴彈與視線內 5 格的有效落點。');
    if(type==='weapon')return (p.owned.includes(Number(arg))&&Number(arg)!==p.weapon)||this.fail('無法換裝此武器。');
    if(type==='salvage')return (p.owned.includes(Number(arg))&&p.owned.length>1&&!this.weaponAt(Number(arg)).locked)||this.fail('無法拆解此武器。');
    if(type==='takeWeapon')return (Boolean(this.nearbyWeapon(Number(arg)))&&p.owned.length<this.weaponCapacity)||this.fail('附近沒有這把武器或背包已滿。');
    if(type==='salvageGround')return (Boolean(this.nearbyWeapon(Number(arg)))&&!this.weaponAt(Number(arg)).locked)||this.fail('附近沒有這把武器，或它不能拆解。');
    if(type==='replaceWeapon')return (Boolean(this.nearbyWeapon(arg?.take))&&p.owned.includes(arg?.leave)&&!this.weaponAt(arg.leave).locked)||this.fail('要交換的武器已不在原處。');
    if(type==='upgrade'){const level=p.upgrades[p.weapon];return (level<3&&p.scrap>=25+level*15)||this.fail('改裝已滿或廢料不足。');}
    if(type==='terminal'){
      if(!this.nearbyTerminal||!['heal','ammo','grenade','smoke','emp','stun',...AMMO_IDS].includes(arg))return this.fail('沒有可用終端或補給選項。');
      const cost=TERMINAL_AMMO[arg]?.cost??(arg==='grenade'?12:GRENADES[arg]?.cost??15),kind=grenadeByItem(arg)?'grenade':TERMINAL_AMMO[arg]?arg:null;
      return (p.scrap>=cost&&!(arg==='heal'&&p.hp===p.maxHp&&!p.poison)&&!(kind&&(kind==='grenade'?grenadeTotal(p):p[AMMUNITION[kind].key])>=this.ammoCapacity(kind))&&!(arg==='ammo'&&AMMO_IDS.every(id=>p[AMMUNITION[id].key]>=this.ammoCapacity(id))))||this.fail('廢料不足或補給已滿。');
    }
    if(type==='interact'&&skillActive(p,'anchor'))return this.fail('下錨中無法換層，請先解除。');
    if(type==='interact')return (this.canTouch(this.exitPoint)&&!this.exitBlocked)||this.fail(this.exitBlocked||'需要靠近綠色電梯。');
    return type==='wait';
  }
  action(type,arg){
    if(type==='guard')type='wait';
    if(this.status!=='playing'||this.pendingPerks)return false;
    this.effects=[];const p=this.player;
    if(type==='usePrepared'){
      const entry=preparedEntry(p,arg?.category);if(!entry?.action)return this.fail('請先在背包預備可用項目。');
      type=entry.action;arg=type==='skill'?p.prepared.skill:arg.target;
    }
    if(type==='weapon'&&arg===undefined)arg=p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length];
    if(type==='grenade'){const pos=arg||this.targeted;arg=pos?{x:pos.x,y:pos.y,grenade:p.prepared.grenade}:null;}
    if(!this.validateAction(type,arg))return false;
    if(p.control.disabled&&type!=='prepare'&&this.actionCost(type,arg)===0)return this.fail('失能中，按中央等待恢復。');
    if(type==='move'){
      const point={x:p.x+arg[0],y:p.y+arg[1]},edge=barrierBetween(this.barriers,p,point);
      if(edgeBlocks(edge)&&edge.type==='door'){type='door';arg={id:edge.id,open:true};}
      else {const enemy=this.enemies.find(e=>e.hp>0&&e.x===point.x&&e.y===point.y),slot=this.bumpMeleeSlot();
        if(enemy&&slot!==undefined){type='bumpMelee';arg={id:enemy.id,x:enemy.x,y:enemy.y,slot};}}
    }
    if(type==='skill'&&arg==='grapple'){type='grapple';arg={id:this.target};}
    // Free preparation/equipment commits outside the turn queue and preserves all timed state.
    if(this.actionCost(type,arg)===0){
      if(type==='prepare')p.prepared[arg.category]=arg.id;
      else if(type==='weapon'){p.weapon=Number(arg);this.log(`切換至${this.weapon.name}，不耗回合。`);}
      else if(type==='reload')return this.reload();
      else if(type==='skill')return this.activateSkill(arg);
      else if(type==='commandPet')return commandPet(this,arg);
      return true;
    }
    const doubleAttack=skillActive(p,'anchor')&&['fire','bumpMelee'].includes(type),previousChain=p.fireChain?{...p.fireChain}:null;
    const fireIntent=type==='fire'?{id:this.target,x:this.targeted.x,y:this.targeted.y}:null,floor=this.floor,queue=initiativeQueue(p,this.enemies,this.activeAllies),playerSpeed=queue.find(q=>q.actor===p).speed;
    if(doubleAttack){
      queue.find(q=>q.actor===p).speed=1;
      queue.push({actor:p,index:0,speed:0,anchorExtra:true});queue.sort((a,b)=>a.speed-b.speed||a.index-b.index);
    }
    let playerStunned=false;
    this.turn++;
    for(const {actor,speed,anchorExtra=false}of queue){
      if(p.hp<=0||this.status!=='playing'||this.floor!==floor)break;
      if(actor.hp<=0||actor.kind&&(actor.status!=='active'||actor.floor!==this.floor))continue;
      if(actor===p&&playerStunned)continue;
      actor.vaultExposed=false;
      if(skipDisabled(actor)){if(actor===p){playerStunned=true;this.log('失能：本次行動跳過，未消耗彈藥或道具。',true);}continue;}
      const immunityBefore=actor.control?.immune||0;
      if(actor===p){
        if(doubleAttack&&!anchorExtra&&type==='fire')p.fireChain=previousChain?{...previousChain}:null;
        if(type==='fire')this.target=fireIntent.id; // Track identity, never switch to another enemy.
        const success=this.executePlayer(type,fireIntent||arg);
        if(!success)this.log('局勢已改變，行動未能完成；本回合已消耗。');
        p.guard=success&&type==='wait';p.moved=success&&(type==='move'||type==='grapple'&&p.moved);p.focus=success&&type==='wait';p.evasive=success&&type==='wait';
        this.reveal();
      }else if(actor.kind)presentStep(this,()=>{allyAct(this,actor);this.reveal();},actor);
      else if(actor.hp>0&&actor.alert)presentStep(this,()=>this.enemyAct(actor),speed!==0||playerSpeed!==0?actor:null);
      if(immunityBefore&&!anchorExtra)actor.control.immune=Math.max(0,actor.control.immune-1);
    }
    if(this.floor===floor&&this.status==='playing'&&p.hp>0){
      const due=this.marks.filter(m=>m.due<=this.turn);this.marks=this.marks.filter(m=>m.due>this.turn);
      for(const m of due){if(p.hp<=0)break;presentStep(this,()=>this.explode(m,1,scaleEnemy(38,this.floor,'damage')));}
      if(p.hp>0)presentStep(this,()=>resolveRetreatWave(this));
      if(p.hp>0)presentStep(this,()=>this.environmentTurn());
    }
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickPackedPet(this))this.reveal();});
    // Summons rise before skills tick, so the interval counts the rising turn like the old cast did.
    if(this.status==='playing'&&p.hp>0)presentStep(this,()=>{if(tickSummons(this))this.reveal();});
    tickSpirit(this);tickSkills(p);if(!skillActive(p,'early_warning'))this.sensorContacts=[];
    this.smoke=this.smoke.filter(s=>s.expires>this.turn);
    for(const actor of [p,...this.enemies,...this.activeAllies])tickTraits(actor);
    this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';this.log('生命訊號中斷。',true);}
    return true;
  }
  activateSkill(id){
    return presentStep(this,()=>{
      if(ALLY_SKILLS.includes(id))return useAllySkill(this,id);
      if(id==='anchor'){
        if(!toggleAnchor(this.player))return false;
        this.effects.push({type:'pulse',from:{x:this.player.x,y:this.player.y},to:{x:this.player.x,y:this.player.y},radius:.6,color:'#e6c281',damage:0});
        this.log(skillActive(this.player,'anchor')?'下錨完成：固定位置，攻擊於普通與緩速各一次。':'下錨已解除，可以移動。');return true;
      }
      const def=SKILLS[id],p=this.player;p.skillState[id]={remaining:def.duration,cooldown:def.cooldownAfterEffect?0:def.cooldown};
      if(id==='early_warning'){this.sensorContacts=this.enemies.filter(e=>e.hp>0&&distance(p,e)<=def.radius).map(e=>{e.alert=true;e.lastKnown={x:p.x,y:p.y};return {x:e.x,y:e.y};});this.log(`預警取得 ${this.sensorContacts.length} 個位置；敵人已得知你的位置。`,true);}
      this.effects.push({type:'pulse',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},radius:.6,color:'#8ae9da',damage:0});
      this.log(`${def.name}啟動：持續 ${def.duration} 回合，冷卻 ${def.cooldown} 回合。`);this.reveal();return true;
    });
  }
  executePlayer(type,arg){
    const p=this.player;
    let success=false;
    p.guard=false;p.moved=false;p.moveDelta=[0,0];if(type!=='fire')p.fireChain=null;
    switch(type) {
      case 'move': {
        if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
        if(skillActive(p,'anchor'))return this.fail('下錨中無法移動。');
        const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
        const edge=barrierBetween(this.barriers,p,{x,y});
        if(!this.canCross(p,{x,y})&&!vaultable(edge))return this.fail('前方障礙物已阻擋移動。');
        if(!this.passable(x,y))return this.fail(this.solid(x,y)?'掩體或油桶擋住去路。可以繞行或射擊破壞。':'前方是牆壁。');
        const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
        if(e){this.target=e.id;return this.fail('敵人擋住去路，先開火。');}
        // Re-check the swap at resolution; a faster enemy may have disabled the ally in the meantime.
        const ally=this.activeAllies.find(a=>a.x===x&&a.y===y);
        if(ally){if(swapReason(this,ally))return false;swapWithPlayer(this,ally);}
        p.vaultExposed=vaultable(edge);if(p.vaultExposed)this.log('翻越矮隔板：至下次自身行動前，被射擊命中 +20。',true);
        p.x=x;p.y=y;p.facing=[dx,dy];p.moveDelta=[dx,dy];this.pickup();success=true;break;
      }
      case 'repairDrone':success=presentStep(this,()=>repairDrone(this,arg));break;
      case 'skill':success=this.activateSkill(arg);break;
      case 'grapple':success=useGrapple(this,arg.id);break;
      case 'placeDrone':success=presentStep(this,()=>useAllySkill(this,arg.id,{x:arg.x,y:arg.y}));break;
      case 'recoverObjective':success=this.recoverObjective(arg);break;
      case 'openContainer':success=presentStep(this,()=>this.openContainer(arg));break;
      case 'door':success=presentStep(this,()=>{const b=this.nearbyDoors.find(b=>b.id===arg.id);return this.setDoor(b,arg.open);});break;
      case 'bumpMelee': this.target=arg.id;success=this.strike(arg,arg.slot);break;
      case 'fire': success=this.fire(arg);break;
      case 'reload': success=this.reload();break;
      case 'heal':
        if(p.meds<=0)return this.fail('醫療包已用盡。');
        if(p.hp===p.maxHp&&p.poison===0)return this.fail('生命值已滿。');
        p.meds--;const recovered=healActor(p,45+p.healBonus);p.poison=0;
        this.log(`使用醫療包，回復 ${recovered} 生命並清除中毒。`);success=true;break;
      case 'grenade': success=presentStep(this,()=>this.throwGrenade(arg||this.targeted));break;
      case 'weapon': {
        const index=arg===undefined?p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length]:Number(arg);
        if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
        if(index===p.weapon)return this.fail('已裝備此武器。');
        p.weapon=index;this.log(`切換至${this.weapon.name}。`);success=true;break;
      }
      case 'salvage':success=this.salvage(Number(arg));break;
      case 'takeWeapon':success=this.takeWeapon(Number(arg));break;
      case 'salvageGround':success=this.salvageGround(Number(arg));break;
      case 'replaceWeapon':success=this.replaceWeapon(arg);break;
      case 'upgrade':success=this.upgrade();break;
      case 'terminal':success=this.useTerminal(arg);break;
      case 'wait':this.log('防禦待機：直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15。');success=true;break;
      case 'interact':success=this.descend(false);return success;
      default:return false;
    }
    return success;
  }
  reload(){
    if(this.weapon.melee)return this.fail('近戰武器無須裝填。');
    const p=this.player,need=this.weapon.mag-p.ammo[p.weapon],reserve=this.reserveKey();
    if(need<=0)return this.fail('彈匣已滿。');
    if(p[reserve]<=0)return this.fail('沒有對應備彈。探索補給箱或切換武器。');
    const amount=Math.min(need,p[reserve]);p.ammo[p.weapon]+=amount;p[reserve]-=amount;
    this.log(`裝填完成，補充 ${amount} 發${this.actionCost('reload')===0?'，不耗回合':''}。`);return true;
  }
  fire(intent=null) {
    const p=this.player,e=this.targeted,w=this.weapon;
    if(w.melee)return this.strike(intent);
    // A committed shot still fires at the last confirmed tile if its target is lost.
    if(intent&&(!e||distance(p,e)>w.range||!this.shotClear(p,e))){
      p.facing=[Math.sign(intent.x-p.x),Math.sign(intent.y-p.y)];
      const shots=Math.min(w.burst||1,p.ammo[p.weapon]);
      for(let i=0;i<shots;i++)presentStep(this,()=>{
        p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
        this.effects.push({type:'shot',weaponId:w.id,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:intent.x,y:intent.y},damage:0,miss:true,color:w.ammoType==='energy'?'#8ae9da':null});
      });
      if(this.enemies.some(e=>e.id===intent.id))recordShot(p,intent.id,this.turn);else p.fireChain=null;
      this.log(`原目標已失去有效射線，向最後確認位置開火落空，消耗 ${shots} 發。`);
      return true;
    }
    if(!e)return this.fail('射線內沒有目標。');
    if(distance(p,e)>w.range)return this.fail('目標超出射程，靠近再開火。');
    if(p.ammo[p.weapon]<=0)return this.fail('彈匣已空，請裝填。');
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    const shots=Math.min(w.burst||1,p.ammo[p.weapon]);
    for(let i=0;i<shots;i++) {
      if(e.hp<=0||p.hp<=0)break;
      presentStep(this,()=>{
        p.ammo[p.weapon]--;p.stats.shots++;spentCase(this,p,w.ammoType);
        const range=this.weaponDamage(p.weapon,e),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
        const chance=this.fireChance(e);
        const hit=this.rng()*100<chance;
        this.effects.push({type:'shot',weaponId:w.id,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:w.ammoType==='energy'?'#8ae9da':null});
        if(!hit){this.log(`射擊未命中（命中率 ${chance}%）。`);if(w.explosive)this.log('榴彈偏離目標，未在戰場內爆炸。');return;}
        if(w.explosive)this.explode(isBarrier(e)?barrierFace(e,p):e,1,Math.round((damage+p.blastBonus)*bladeMultiplier(p)));
        else this.hitTarget(e,damage,p,w.pierce||0);
        if(w.splash)for(const other of this.enemies.filter(o=>o.hp>0&&o!==e&&distance(o,e)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*.45),p,w.pierce||0);
      });
    }
    if(this.enemies.includes(e))recordShot(p,e.id,this.turn);else p.fireChain=null;
    return true;
  }
  strike(intent=null,slot=this.player.weapon) {
    const p=this.player,w=this.weaponAt(slot),target=this.targeted;
    if(!w.melee)return false;
    if(!intent&&(!target||distance(p,target)>1))return this.fail('近戰需要相鄰一格的目標。');
    const valid=target&&distance(p,target)<=1&&this.shotClear(p,target)&&(isBarrier(target)||this.canCross(p,target)),to=valid?target:intent;
    p.fireChain=null;p.facing=[Math.sign(to.x-p.x),Math.sign(to.y-p.y)];
    presentStep(this,()=>{
      const ambush=Boolean(valid)&&ambushReady(this,target);if(ambush)shortenCamo(p);
      const chance=this.meleeAccuracy(p,target,w.hitChance),hit=Boolean(valid)&&this.rng()*100<chance;
      this.effects.push({type:'shot',weaponId:w.id,style:'slash',from:{x:p.x,y:p.y},to:{x:to.x,y:to.y},damage:0,miss:!hit});
      if(!hit){this.log(valid?`近戰揮擊未命中（${chance}%）。`:'原目標已離開近戰範圍，揮擊落空。');return;}
      const d=this.weaponDamage(slot);this.hitTarget(target,Math.round((d.min+Math.floor(this.rng()*(d.max-d.min+1)))*(ambush?MELEE_TUNING.ambush:1)),p,w.pierce||0,w);
    });
    return true;
  }
  protectingCover(target,attacker) {
    if(activeTrait(target,'no_cover'))return null;
    return bestCover([edgeCover(this.barriers,target,attacker),wallCover(this.grid,target,attacker),...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,target)===1)],target,attacker);
  }
  hitTarget(target,raw,attacker,pierce=0,weapon=this.weapon) {
    if(attacker===this.player)raw=Math.round(raw*bladeMultiplier(attacker));
    if(this.props.includes(target)||isBarrier(target)){if(weapon.ammoType==='energy')addTrace(this,target,'scorch');this.damageProp(target,raw);return;}
    const cover=weapon.melee?null:this.protectingCover(target,attacker),armor=ENEMY_TYPES[target.type]?.armor||0;
    let damage=raw;
    if(cover){damage*=1-coverEffects(cover,target,attacker).reduction*(1-pierce);if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35));this.log('敵方掩體吸收了部分傷害。');}
    damage=Math.max(1,Math.round(damage-armor*(1-pierce)));
    if(weapon.ammoType==='energy'&&activeTrait(target,'mechanical'))damage=Math.round(damage*1.2);
    if(weapon.ammoType==='energy')addTrace(this,target,'scorch');
    const before=target.hp;this.hurt(target,reduceDirectDamage(target,damage));
    if(attacker===this.player&&weapon.melee)meleeReward(this,target,before);
  }
  hurt(e,damage) {
    if(e.hp<=0)return;
    e.hp-=damage;this.player.stats.damage+=damage;if(damage>0)addTrace(this,e,activeTrait(e,'mechanical')?'oil':'blood');
    this.effects.push({type:'impact',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},damage,mechanical:ENEMY_TYPES[e.type]?.mechanical});
    this.log(`命中${enemyName(e)}，造成 ${damage} 傷害。`);
    if(e.hp>0)return;
    this.player.kills++;this.player.xp+=ENEMY_TYPES[e.type]?.xp||1;
    this.player.scrap+=Math.round((e.type==='boss'||e.type==='warden'?35:3)*(1+this.player.scavenger*.5));
    this.log(`${enemyName(e)}已消滅。`);if(missionTarget(this,e))this.log(this.missionSummary+'。');
    while(this.player.xp>=this.player.level+2){this.player.xp-=this.player.level+2;this.player.level++;if(this.player.level<=MAX_LEVEL&&this.perkPicks+this.pendingPerks<perkLimit(this.player.level))this.pendingPerks++;else if(this.player.level>MAX_LEVEL)giveCapSupply(this);}
    if(e.type==='bomber')this.explode(e,1,scaleEnemy(30,this.floor,'damage'));
    if(e.type==='warden'||e.type==='boss')this.awardProtocol(e.type,`${this.floor}:${e.id}`);
    if(e.reinforcement)return; // Retreat waves add pressure, not replacement supplies.
    const loot=ENEMY_LOOT[e.type];
    if(loot?.weapon!==undefined&&weaponUnlocked(WEAPONS[loot.weapon],this.unlockedWeapons)&&this.rng()<(loot.chance||0))this.dropEnemyWeapon(e,loot.weapon);
    if(this.floor>=RARE_ARMORY.minFloor&&loot?.rareWeapon!==undefined&&this.rng()<loot.rareChance)this.dropEnemyWeapon(e,loot.rareWeapon);
    if(this.rng()<.35){const type=loot?.ammo||'ammo';this.items.push({x:e.x,y:e.y,type,amount:type==='energy'?6:type==='ordnance'?2:type==='pistol'?18:type==='shell'?4:10});}
    if(this.rng()<.06)this.items.push({x:e.x,y:e.y,type:'med'});
    const plate=plateDrop(this.player,(ENEMY_TYPES[e.type]?.armor||0)>0);
    if(plate.chance>0&&this.rng()<plate.chance)this.items.push({x:e.x,y:e.y,type:'armor',amount:plate.amount});
  }
  dropEnemyWeapon(e,weapon){const item=this.registerWeapon({x:e.x,y:e.y,type:'weapon',weapon},true);this.items.push(item);this.log(`戰利品：${this.weaponAt(item.slot).name}留在屍體旁，靠近後可拾取。`);}
  damageProp(prop,damage) {
    if(prop.indestructible)return;
    if(prop.hp>0&&damage>0)addTrace(this,prop,'chip');
    if(isBarrier(prop)){
      if(prop.hp<=0||!BARRIER_TYPES[prop.type].destructible)return;prop.hp=Math.max(0,prop.hp-Math.ceil(damage));if(!prop.hp)addTrace(this,prop,'debris');
      this.effects.push({type:'impact',from:{x:prop.x,y:prop.y},to:{x:prop.x,y:prop.y},damage:Math.ceil(damage),mechanical:true});
      this.log(`${barrierName(prop)}${prop.hp?`耐久剩 ${prop.hp}。`:'已摧毀，通道打開。'}`);this.reveal();return;
    }
    if(prop.hp<=0)return;
    prop.hp-=damage;
    if(prop.hp>0)return;
    addTrace(this,prop,'debris');
    this.log(prop.type==='barrel'?'油桶被引爆！':'掩體已摧毀。');
    if(prop.type==='barrel')this.explode(prop,2,45);
  }
  throwGrenade(pos) {
    const p=this.player,id=pos?.grenade??p.prepared.grenade,def=GRENADES[id];
    if(!def||p[def.resource]<=0)return this.fail('預備的投擲物已用盡。');
    if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||this.grid[pos.y]?.[pos.x]!==1)return this.fail('先選擇可見地板或敵人作為投擲位置。');
    if(distance(p,pos)>5||!this.visible(pos))return this.fail('投擲位置需在視線內 5 格以內。');
    p[def.resource]--;p.stats.grenades++;this.log(`投擲${def.name}。`);
    this.effects.push({type:'shot',style:'grenade',color:def.color,from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    if(id==='frag')this.explode(pos,2,Math.round((55+p.blastBonus)*bladeMultiplier(p)));
    else {
      const cells=areaCells(this.grid,pos,2,this.barriers),affected=new Set(cells.map(key));
      this.effects.push({type:'pulse',radius:2,color:def.color,from:{x:pos.x,y:pos.y},to:{x:pos.x,y:pos.y}});
      if(id==='smoke'){this.smoke=[...this.smoke,{cells,expires:this.turn+SMOKE_DURATION-1}];this.log('煙霧展開：阻斷無紅外線者的視線，爆炸仍可傷害。');}
      else for(const actor of [p,...this.enemies,...this.activeAllies])if(affected.has(key(actor))&&applyDisruption(actor,def.keyword)){
        if(actor!==p)actor.alert=true;
        this.log(`${actor===p?'你':actor.kind?allyName(actor):enemyName(actor)}失能：跳過 ${actor.control.disabled} 次行動。`,actor===p);
      }
      this.reveal();
    }
    return true;
  }
  explode(center,radius,damage) {
    const origin={x:center.x,y:center.y};
    this.effects.push({type:'blast',from:origin,to:origin,damage:0,radius});
    const affected=p=>distance(origin,p)<=radius&&lineOfSight(this.grid,origin,p,this.barriers,'blast');
    // Freeze shielding for this blast before destroying any of its barriers.
    for(const cell of areaCells(this.grid,origin,radius,this.barriers))addTrace(this,cell,'scorch');
    const hitProps=this.props.filter(o=>o.hp>0&&affected(o)),hitEnemies=this.enemies.filter(e=>e.hp>0&&affected(e)),hitPlayer=affected(this.player),hitAllies=this.activeAllies.filter(affected);
    const hitEdges=this.barriers.filter(b=>b.hp>0&&distance(origin,b)<=radius&&lineOfSight(this.grid,origin,b,this.barriers.filter(e=>e!==b),'blast'));
    for(const b of hitEdges)this.damageProp(b,damage);
    // Mark barrels as destroyed before recursion, so chain reactions terminate.
    for(const prop of hitProps)this.damageProp(prop,damage);
    for(const e of hitEnemies)this.hurt(e,reduceDirectDamage(e,Math.max(1,damage-distance(origin,e)*10)));
    for(const a of hitAllies)this.damageAlly(a,Math.max(1,damage-distance(origin,a)*10),null,true);
    if(hitPlayer)this.damagePlayer(Math.max(1,damage-distance(origin,this.player)*10),'爆炸衝擊',null,true);
  }
  damagePlayer(raw,label,attacker=null,blast=false) {
    const p=this.player,cover=!blast&&attacker?this.protectingCover(p,attacker):null;
    let damage=raw;
    if(cover){damage*=1-coverEffects(cover,p,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35));}
    damage=reduceDirectDamage(p,meleeDefense(p,Math.max(1,Math.round(damage-p.armor))));if(p.guard)damage=Math.max(1,Math.ceil(damage*.5));
    const absorbed=Math.min(p.plates||0,Math.floor(damage/2));p.plates=(p.plates||0)-absorbed;damage-=absorbed;
    p.hp-=damage;if(damage>0)addTrace(this,p,activeTrait(p,'mechanical')?'oil':'blood');this.log(`${label}${cover?'（掩體減傷）':''}${absorbed?`（護甲板吸收 ${absorbed}）`:''}，生命 −${damage}。`,true);
    if(attacker&&ENEMY_TYPES[attacker.type]?.mechanical&&ENEMY_TYPES[attacker.type].range>1)addTrace(this,p,'scorch');
    if(attacker)this.effects.push({type:'enemyShot',attackerType:attacker.type,style:attacker.type==='crawler'?'claw':attacker.type==='brute'?'slash':ENEMY_TYPES[attacker.type]?.mechanical?'plasma':'bullet',from:{x:attacker.x,y:attacker.y},to:{x:p.x,y:p.y},damage});
    else this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage});
  }
  damageAlly(a,raw,attacker=null,blast=false){
    if(a.hp<=0||a.status!=='active')return;const cover=!blast&&attacker?this.protectingCover(a,attacker):null;let damage=raw;
    if(cover){damage*=1-coverEffects(cover,a,attacker).reduction;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35));}
    damage=reduceDirectDamage(a,Math.max(1,Math.round(damage-a.armor)));a.hp=Math.max(0,a.hp-damage);
    addTrace(this,a,activeTrait(a,'mechanical')?'oil':'blood');this.effects.push({type:'impact',from:{x:a.x,y:a.y},to:{x:a.x,y:a.y},damage});this.log(`${allyName(a)}受傷 −${damage}。`,true);
    if(!a.hp){a.status=a.kind==='pet'?'down':'destroyed';a.order=null;this.reveal();this.log(`${allyName(a)}${a.kind==='pet'?'倒地：相鄰用技能回收，收納中會自行回血。':a.kind==='drone'?`已被摧毀：按僚機技能花 ${DRONE_BUILD_COST} 廢料生產新機。`:'已被摧毀。'}`,true);}
  }
  enemyTarget(e){
    const options=[this.player,...this.activeAllies].filter(a=>a.hp>0&&distance(e,a)<=Math.max(10,ENEMY_TYPES[e.type].range)&&this.sight(e,a));
    if(e.type==='sniper'&&e.charge&&e.aim){const occupant=[this.player,...this.activeAllies].find(a=>key(a)===key(e.aim));if(occupant)return occupant;}
    if(e.charge&&e.focusTarget){const old=[this.player,...this.activeAllies].find(a=>(a.id||'player')===e.focusTarget);if(old)return old;}
    return options.sort((a,b)=>distance(e,a)-distance(e,b))[0]||this.player;
  }
  enemyAct(e){
    const x=e.x,y=e.y,fired=this.executeEnemy(e);
    e.moveDelta=e.moved?[e.x-x,e.y-y]:[0,0];
    if(fired)recordShot(e,e.focusTarget||'player',this.turn);else e.fireChain=null;
  }
  executeEnemy(e) {
    const p=this.enemyTarget(e);e.moved=false;e.moveDelta=[0,0];let fired=false;
      if(e.hp<=0||!e.alert||p.hp<=0)return;
      const def=ENEMY_TYPES[e.type],los=this.sight(e,p),known=los?p:e.lastKnown||e.aim,d=skillActive(p)&&!los?(known?distance(e,known):Infinity):distance(e,p);
      if(los)e.lastKnown={x:p.x,y:p.y};
      if(d>16)return;
      if(def.seekCover&&los&&!e.charge&&!this.protectingCover(e,p)){
        const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>this.passable(n.x,n.y,e)&&this.canCross(e,n)&&distance(n,p)>1&&!occupied(this,n,e)&&!this.hazards.some(h=>distance(h,n)===0)&&distance(n,p)<=def.range&&this.sight({...e,...n},p)&&this.protectingCover({...e,...n},p));
        if(spot){e.x=spot.x;e.y=spot.y;e.moved=true;return;}
      }
      if((los&&this.shotClear(e,p)&&d<=def.range&&(def.range>1||this.canCross(e,p)))||(e.type==='sniper'&&e.charge&&e.aim)) {
        if(e.type==='boss'&&(e.attackCount||0)%2===1&&!e.charge) {
          this.marks.push({x:p.x,y:p.y,due:this.turn+2});e.attackCount++;
          this.log('核心守衛標記轟炸區：兩次行動內離開紅色格與鄰格！',true);return;
        }
        if(!e.charge){e.charge=true;e.focusTarget=p.id||'player';e.windup=e.type==='sniper'?2:1;e.aim={x:p.x,y:p.y};return;}
        e.windup=(e.windup||1)-1;if(e.windup>0)return;
        if(e.type==='bomber'){this.hurt(e,e.hp);return;}
        fired=def.range>1;if(fired)spentCase(this,e,{rifleman:'rifle',raider:'pistol',gunner:'shell',sniper:'rifle'}[e.type]);
        if(e.type==='sniper'&&e.aim&&!this.shotClear(e,e.aim)){const edge=firstBarrierOnRay(this.barriers,e,e.aim);this.log('狙擊彈被門或隔板阻擋。');this.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:edge?{x:edge.x,y:edge.y}:{...e.aim},damage:0});if(edge)this.damageProp(edge,scaleEnemy(def.damage+this.floor*2,this.floor,'damage'));}
        else if(e.type==='sniper'&&distance(p,e.aim||p)>0){this.log('狙擊彈擊中你原本的位置。');this.effects.push({type:'enemyShot',attackerType:'sniper',from:{x:e.x,y:e.y},to:{...e.aim},damage:0,miss:true});}
        else {
          const chance=def.range>1?this.accuracy(e,p).chance:this.meleeAccuracy(e,p);
          if(this.rng()*100<chance){if(p===this.player)this.damagePlayer(scaleEnemy(def.damage+this.floor*2,this.floor,'damage'),`${enemyName(e)}攻擊`,e);else{this.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0});this.damageAlly(p,scaleEnemy(def.damage+this.floor*2,this.floor,'damage'),e);}}
          else {this.log(`${enemyName(e)}未命中（${chance}%）。`);this.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0,miss:true});}
        }
        e.charge=Boolean(def.rapid);e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
      } else {
        e.charge=false;e.aim=null;e.windup=0;
        const destination=los?p:e.lastKnown;
        const step=destination&&distance(e,destination)>0?this.nextStep(e,destination):null;if(step){const edge=barrierBetween(this.barriers,e,step);if(vaultable(edge)){if(distance(step,p)>0&&!occupied(this,step,e)){e.x=step.x;e.y=step.y;e.moved=true;e.vaultExposed=true;}else if(distance(step,p)===0)this.damageProp(edge,scaleEnemy(Math.max(15,def.damage),this.floor,'damage'));}else if(edgeBlocks(edge)){if(['crawler','brute','bomber','boss'].includes(e.type))this.damageProp(edge,scaleEnemy(Math.max(15,def.damage),this.floor,'damage'));else this.setDoor(edge,true);}else if(!occupied(this,step,e)){e.x=step.x;e.y=step.y;e.moved=true;}}
      }
      if((e.type==='boss'||e.type==='warden')&&e.hp<e.maxHp*.5&&!e.reinforced) {
        e.reinforced=true;
        for(const [dx,dy]of DIRECTIONS.slice(0,2)){const x=e.x+dx,y=e.y+dy;if(this.passable(x,y)&&this.canCross(e,{x,y})&&distance(p,{x,y})>0&&!occupied(this,{x,y})){const drone=makeEnemy('drone',x,y,`${e.id}-reinforce-${dx}-${dy}`,this.floor);drone.alert=true;drone.lastKnown=e.lastKnown?{...e.lastKnown}:null;this.enemies.push(drone);}}
        this.log(`${enemyName(e)}呼叫了無人機增援！`,true);
      }
    return fired;
  }
  nextStep(e,target) {
    const queue=[{x:e.x,y:e.y,first:null}],visited=new Set([key(e)]);
    const occupied=new Set([...this.enemies.filter(o=>o!==e&&o.hp>0),...this.activeAllies].filter(a=>a!==target).map(key));
    for(let i=0;i<queue.length&&i<SIZE*SIZE;i++)for(const [dx,dy]of DIRECTIONS) {
      const q=queue[i],x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
      if(visited.has(k)||!this.passable(x,y,e))continue;
      const edge=barrierBetween(this.barriers,q,{x,y});if(edgeBlocks(edge)&&edge.type!=='door'&&!vaultable(edge))continue;
      if(skillActive(this.player)&&distance(target,this.player)>0&&x===this.player.x&&y===this.player.y)continue;
      if(x===target.x&&y===target.y)return q.first||(distance(target,this.player)>0||edgeBlocks(edge)?{x,y}:null);
      if(occupied.has(k))continue;
      visited.add(k);queue.push({x,y,first:q.first||{x,y}});
    }return null;
  }
  environmentTurn() {
    const p=this.player,hpBefore=p.hp,hazard=this.hazards.find(h=>h.x===p.x&&h.y===p.y);
    if(hazard){const damage=Math.max(0,(hazard.type==='acid'?8:12)-p.hazmat);p.hp-=damage;if(hazard.type==='acid'&&p.hazmat<8)p.poison=3;this.log(`${hazard.type==='acid'?'污染液':'高熱地板'}傷害 −${damage}。`,true);}
    else if(p.poison>0){p.poison--;const damage=Math.max(0,4-p.hazmat);p.hp-=damage;if(damage)this.log(`中毒傷害 −${damage}，剩餘 ${p.poison} 回合。`,true);}
    if(p.hp<hpBefore)this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:hpBefore-p.hp});
    for(const a of this.activeAllies.filter(a=>a.type!=='drone'))if(this.hazards.some(h=>h.x===a.x&&h.y===a.y))this.damageAlly(a,6,null,true);
    for(const e of this.enemies.filter(e=>e.hp>0&&e.type!=='drone'))if(this.hazards.some(h=>h.x===e.x&&h.y===e.y))this.hurt(e,6);
  }
  pickup() {
    const p=this.player;
    this.items=this.items.filter(item=>{
      if(distance(item,p)!==0)return true;
      if(item.type==='weapon') {
        this.registerWeapon(item);
        if(p.owned.length>=this.weaponCapacity){this.log('武器欄已滿。打開背包比較並交換，原武器會留在地上。');return true;}
        this.collectWeapon(item);return false;
      }
      const utility=grenadeByItem(item.type);
      if(utility){const amount=item.amount??1,accepted=this.receiveGrenade(utility,amount,{spill:false});if(accepted)this.log(`拾取${GRENADES[utility].name} +${accepted}。`);if(accepted<amount){item.amount=amount-accepted;this.log('投擲物共用容量已滿，剩餘留在原地。');return true;}return false;}
      const ammo=itemAmmo(item.type);
      if(ammo){const amount=item.amount??AMMUNITION[ammo].pickup,accepted=this.receiveAmmo(ammo,amount,{spill:false});
        if(accepted)this.log(`拾取${AMMUNITION[ammo].name} +${accepted}。`);
        if(accepted<amount){item.amount=amount-accepted;this.log(`${AMMUNITION[ammo].name}容量已滿，剩餘 ${item.amount} 留在原地。`);return true;}
      }      else if(item.type==='med'){p.meds++;this.log('拾取醫療包 +1。');}
      else if(item.type==='armor'){const amount=Math.min(item.amount||20,this.plateCapacity-(p.plates||0));if(amount<=0){this.log('護甲板已滿，補給留在原地。');return true;}p.plates=(p.plates||0)+amount;this.log(`修復護甲板 +${amount}（${p.plates}/${this.plateCapacity}）。`);}
      else if(item.type==='scrap'){const amount=Math.round((item.amount||15)*(1+p.scavenger*.5));p.scrap+=amount;this.log(`回收廢料 +${amount}。`);}
      else if(item.type==='lore'){if(!p.lore.includes(item.floor)){p.lore.push(item.floor);this.awardProtocol('lore',item.floor);}p.scrap+=10;this.log(`資料已解密：${LORE[item.floor-1]}`);}
      return false;
    });
  }
  registerWeapon(item,roll=false) {
    if(item.slot!==undefined)return item;
    const p=this.player,slot=p.weaponBases.length;
    const affix=roll?rollAffix(item.weapon,`${this.seed}:${this.floor}:${slot}:${item.x}:${item.y}`):null;
    p.weaponBases.push(item.weapon);p.affixes.push(affix);p.ammo.push(weaponStats(item.weapon,affix).mag);p.upgrades.push(0);
    item.slot=slot;return item;
  }
  collectWeapon(item){const p=this.player;p.owned.push(item.slot);this.log(`取得武器：${this.weaponAt(item.slot).name}。在背包中裝備。`);}
  addWeapon(base){
    if(!WEAPONS[base]||this.player.owned.length>=this.weaponCapacity)return false;
    const item=this.registerWeapon({weapon:base});this.collectWeapon(item);return item.slot;
  }
  nearbyWeapon(slot){return this.items.find(o=>o.type==='weapon'&&o.slot===slot&&this.canTouch(o));}
  takeWeapon(slot) {
    const item=this.nearbyWeapon(slot);
    if(!item)return this.fail('附近沒有這把武器。');
    if(this.player.owned.length>=this.weaponCapacity)return this.fail(`武器欄已滿（${this.weaponCapacity} 格）。可比較並交換武器。`);
    this.collectWeapon(item);this.items=this.items.filter(o=>o!==item);return true;
  }
  replaceWeapon(arg) {
    const p=this.player,item=this.nearbyWeapon(arg?.take),old=arg?.leave;
    if(!item||!p.owned.includes(old)||this.weaponAt(old).locked)return this.fail('要交換的武器已不在原處。');
    p.owned[p.owned.indexOf(old)]=item.slot;if(p.weapon===old)p.weapon=item.slot;
    this.items=this.items.filter(o=>o!==item);
    this.items.push({x:p.x,y:p.y,type:'weapon',weapon:p.weaponBases[old],slot:old});
    this.log(`換入${this.weaponAt(item.slot).name}；${this.weaponAt(old).name}連同彈匣與改裝留在腳下。`);return true;
  }
  salvage(index) {
    const p=this.player;
    if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
    if(this.weaponAt(index).locked)return this.fail('固定武器不能拆解或交換，只能升級。');
    if(p.owned.length<=1)return this.fail('至少保留一把武器。');
    this.receiveAmmo(this.weaponAt(index).ammoType,p.ammo[index]);p.ammo[index]=0;p.owned=p.owned.filter(i=>i!==index);
    p.scrap+=20+(p.upgrades[index]||0)*10;p.upgrades[index]=0;p.stats.salvaged++;
    if(p.weapon===index)p.weapon=p.owned[0];this.log(`拆解${this.weaponAt(index).name}，回收彈匣與廢料。`);return true;
  }
  // Salvage a dropped weapon without picking it up (3.50.0, user request): same yield as the pack version,
  // so a full pack can still turn loot into scrap and magazine ammunition.
  salvageGround(slot) {
    const p=this.player,item=this.nearbyWeapon(slot);
    if(!item)return this.fail('附近沒有這把武器。');
    const w=this.weaponAt(slot);
    if(w.locked)return this.fail('固定武器不能拆解。');
    this.receiveAmmo(w.ammoType,p.ammo[slot]);p.ammo[slot]=0;
    const scrap=20+(p.upgrades[slot]||0)*10;p.scrap+=scrap;p.upgrades[slot]=0;p.stats.salvaged++;
    this.items=this.items.filter(o=>o!==item);
    this.log(`就地拆解${w.name}，回收彈匣與 ${scrap} 廢料。`);return true;
  }
  upgrade() {
    const p=this.player,level=p.upgrades[p.weapon]||0,cost=25+level*15;
    if(level>=3)return this.fail('此武器已達最高改裝等級。');
    if(p.scrap<cost)return this.fail(`改裝需要 ${cost} 廢料。`);
    p.scrap-=cost;p.upgrades[p.weapon]++;this.log(`${this.weapon.name}改裝 +${level+1}，單次傷害 +5。`);return true;
  }
  useTerminal(option) {
    const terminal=this.nearbyTerminal,p=this.player;
    if(!terminal)return this.fail('附近沒有可用補給終端。');
    if(!['heal','ammo','grenade','smoke','emp','stun',...AMMO_IDS].includes(option))return false;
    const cost=TERMINAL_AMMO[option]?.cost??(option==='grenade'?12:GRENADES[option]?.cost??15);
    const kind=grenadeByItem(option)?'grenade':TERMINAL_AMMO[option]?option:null;
    if(kind&&(kind==='grenade'?grenadeTotal(p):p[AMMUNITION[kind].key])>=this.ammoCapacity(kind))return this.fail('此彈種已達攜帶上限。');
    if(option==='ammo'&&AMMO_IDS.every(id=>p[AMMUNITION[id].key]>=this.ammoCapacity(id)))return this.fail('各類備彈皆已滿。');
    if(p.scrap<cost)return this.fail(`終端需要 ${cost} 廢料。`);
    if(option==='heal'&&p.hp===p.maxHp&&!p.poison)return this.fail('生命值已滿。');
    p.scrap-=cost;terminal.used=true;
    if(option==='heal'){healActor(p,60);p.poison=0;}
    if(option==='ammo')this.supplyPack({rifle:24,pistol:24,shell:6,energy:12,ordnance:3});
    if(TERMINAL_AMMO[option])this.receiveAmmo(option,TERMINAL_AMMO[option].amount);
    if(grenadeByItem(option)){const id=grenadeByItem(option);this.receiveGrenade(id,GRENADES[id].amount);}
    this.log('終端補給完成。此終端已耗盡。');return true;
  }
  descend(advanceTurn=true) {
    if(skillActive(this.player,'anchor'))return this.fail('下錨中無法換層，請先解除。');
    const p=this.player;
    if(!this.canTouch(this.exitPoint))return this.fail('需要靠近綠色電梯。');
    if(this.exitBlocked)return this.fail(this.exitBlocked);
    const next=this.floor-1,frame=returning(this)&&this.floor>1?this.floorStates[next]:null,arrival=frame&&arrivalCell(frame,this.allies.filter(a=>a.floor===next&&a.status==='active'));
    if(returning(this)&&this.floor>1&&!arrival)return this.fail('上一層入口暫無安全落腳處。');
    this.awardProtocol('floor',this.floor);
    if((returning(this)&&this.floor===1)||(!isEndless(this)&&!missionDefinition(this).returnTrip&&this.floor===missionDepth(this))){this.awardProtocol('extraction','win');this.status='won';this.log(this.missionSummary+'。撤離成功。');return true;}
    const companions=departAllies(this);
    if(returning(this)){
      if(advanceTurn)this.turn++;
      Object.assign(this,resumedFloor(frame,this.turn));delete this.floorStates[next];this.floor=next;
      Object.assign(p,arrival,{guard:false,focus:false,evasive:false,moved:false,moveDelta:[0,0],fireChain:null});
      endSkillEffects(p);this.sensorContacts=[];p.vaultExposed=false;this.target=null;arriveAllies(this,companions);scheduleRetreatWave(this);this.reveal();
      this.log(`返回${floorInfo(this.floor).name}：物資與戰場保持原狀，沒有換層補給。`);return true;
    }
    if(missionDefinition(this).returnTrip)this.floorStates[this.floor]=archiveFloor(this);
    this.floor++;if(advanceTurn)this.turn++;const recovered=healActor(p,25);
    this.loadFloor();arriveAllies(this,companions);this.reveal();this.supplyPack({rifle:20,pistol:24,shell:6,energy:10,ordnance:2});this.log(`進入${floorInfo(this.floor).name}。生命 +${recovered}，補充各類備彈。`);return true;
  }
  choosePerk(id) {
    if(this.status!=='playing'||!this.pendingPerks||this.perkPicks>=perkLimit(this.player.level)||this.perkPicks+this.pendingPerks>perkLimit(this.player.level))return false;
    const offer=this.perkChoices.find(o=>o.id===id);
    if(!offer||!eligiblePerks(this).some(o=>o.id===id))return false;
    applyPerk(this,offer);this.pendingPerks--;this.perkPicks++;this.perkDraft=null;ensurePerks(this);
    this.log(`模組已安裝：${offer.name}。`);return true;
  }
  serialize(){ensurePerks(this);const {rng,effects,visibleTiles,...data}=this;return JSON.stringify({version:SAVE_VERSION,data,rngState:rng.state()});}
  static restore(raw) {
    try {
      const {version,data,rngState}=JSON.parse(raw);
      if(![...LEGACY_SAVE_VERSIONS,SAVE_VERSION].includes(version)||data?.status!=='playing'||!data.player||!Number.isInteger(data.floor)||data.floor<1||data.floor>floorLimit(data))return null;
      if(!Number.isInteger(data.seed)||data.seed<0||!Number.isInteger(data.turn)||data.turn<1)return null;
      if(!Array.isArray(data.grid)||data.grid.length!==SIZE||data.grid.some(row=>!Array.isArray(row)||row.length!==SIZE))return null;
      if(!Array.isArray(data.enemies)||data.enemies.some(e=>!ENEMY_TYPES[e.type]||!Number.isFinite(e.hp)||(e.raised!==undefined&&typeof e.raised!=='boolean')))return null;
      if(!Array.isArray(data.props)||!Array.isArray(data.items))return null;
      if(version<13)data.barriers=[];
      if(!validBarriers(data.barriers,data.grid,[...data.enemies,...data.props].map(o=>o.id)))return null;
      if(!validContainers(data.props,data.grid,[...data.enemies,...data.barriers,...data.props.filter(p=>!isContainer(p))].map(o=>o.id)))return null;
      if(!validModules(data.props,data.grid,[...data.enemies,...data.barriers,...data.props.filter(p=>p.type!=='module')].map(o=>o.id)))return null;
      if(version<18)data.lighting=fullLighting(data.grid);
      if(!validLighting(data.lighting,data.grid))return null;
      if(version<17)data.traces=[];
      if(!validTraces(data.traces,data.grid))return null;
      if(version<16)data.mission=newMission();
      if(version<21){data.floorStates={};data.reinforcements=[];}
      if(!validMission(data.mission,data))return null;
      if(version<23){data.allies=[];data.allySerial=0;}
      const defaults=freshPlayer(),p={...defaults,...data.player};
      if(![p,...data.enemies].every(a=>validCombatModifiers(a.combatModifiers)))return null;
      if(version<12){
        p.smoke=0;p.emp=0;p.stun=0;p.control=controlState();data.smoke=[];
        for(const actor of [p,...data.enemies]){
          actor.control=controlState();if(actor!==p)actor.lastKnown=null;
          const id=bodyKeyword(actor.type);
          if(Array.isArray(actor.traits)&&!actor.traits.some(t=>t.id===id))actor.traits=[...actor.traits,{id,source:'body:migration'}];
        }
      }
      if(![version>=12?data.player:p,...data.enemies].every(a=>validControl(a.control)))return null;
      const point=q=>q&&Number.isInteger(q.x)&&Number.isInteger(q.y)&&data.grid[q.y]?.[q.x]===1;
      if(data.enemies.some(e=>e.lastKnown!==null&&!point(e.lastKnown)))return null;
      if(!Array.isArray(data.smoke)||data.smoke.length>32||data.smoke.some(s=>!Number.isInteger(s.expires)||s.expires<=data.turn||s.expires>data.turn+SMOKE_DURATION-1||!Array.isArray(s.cells)||s.cells.length<1||s.cells.length>13||s.cells.some(q=>!point(q))))return null;
      if(version>=12&&!['smoke','emp','stun'].every(k=>Number.isSafeInteger(data.player[k])&&data.player[k]>=0&&data.player[k]<=10000000))return null;
      if(version<10)p.portrait=portraitForLegacy(data.runId??data.seed);
      if(!validPortrait(p.portrait))return null;
      if(version<8){p.prepared=defaultPrepared();p.skills=[];}
      if(!validPrepared(version>=8?data.player:p))return null;
      if(version<7){p.traits=[];for(const e of data.enemies)e.traits=startingTraits(e.type,data.floor);}
      if((version>=7&&!validTraits(data.player.traits))||!validTraits(p.traits)||data.enemies.some(e=>!validTraits(e.traits)))return null;
      if(version<9){p.character='soldier';p.moveDelta=[0,0];p.fireChain=null;grantCharacterTraits(p);for(const e of data.enemies){e.moveDelta=[0,0];e.fireChain=null;}}
      if(!validCharacter(version>=9?data.player.character:p.character)||!validCombatMemory(version>=9?data.player:p,data.turn)||data.enemies.some(e=>!validCombatMemory(e,data.turn)))return null;
      if(version<18&&p.character==='recon')for(const id of ['night_vision','infrared'])if(!p.traits.some(t=>t.id===id&&t.source==='character:recon'))grantTrait(p,id,'character:recon');
      if(version<20){
        if(p.character==='recon'){
          if(!p.skills.includes('signal_break'))p.skills=[...p.skills,'signal_break'];
          p.prepared={...p.prepared,skill:p.prepared.skill||'signal_break'};
        }
        p.skillState=initialSkillState(p.skills);
      }
      if(version<22){
        if(p.character==='soldier'){if(!p.skills.includes('early_warning'))p.skills=[...p.skills,'early_warning'];p.prepared={...p.prepared,skill:p.prepared.skill||'early_warning'};p.skillState={...p.skillState,early_warning:{remaining:0,cooldown:0}};}
        data.sensorContacts=[];p.vaultExposed=false;for(const e of data.enemies)e.vaultExposed=false;
        for(const frame of Object.values(data.floorStates||{}))for(const e of frame.enemies||[])e.vaultExposed=false;
      }
      if(version<25&&p.character==='bulwark'){
        if(!p.skills.includes('anchor'))p.skills=[...p.skills,'anchor'];
        p.prepared={...p.prepared,skill:p.prepared.skill||'anchor'};
        p.skillState={...p.skillState,anchor:{remaining:0,cooldown:0}};
      }
      // Balance-only passive: existing trait schema, preserve HP/resources and avoid duplicate sources.
      if(['bulwark','necromancer'].includes(p.character)&&!p.traits.some(t=>t.id==='difficult_healing'&&t.source===`character:${p.character}`))grantTrait(p,'difficult_healing',`character:${p.character}`);
      if(version<29)p.battleSpirit=freshSpirit();
      if(!validMeleeState(version>=29?data.player:p,data.turn))return null;
      if(!validAnchor(p))return null;
      if(!validSkillState(p)||![version>=22?data.player:p,...data.enemies].every(a=>typeof a.vaultExposed==='boolean'))return null;
      if(!Array.isArray(data.sensorContacts)||data.sensorContacts.length>256||data.sensorContacts.some(q=>!point(q))||(!skillActive(p,'early_warning')&&data.sensorContacts.length))return null;
      p.plates=data.player.plates??0;if(!Number.isInteger(p.plates)||p.plates<0||p.plates>CHARACTERS[p.character].plateCapacity)return null;
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||data.grid[p.y]?.[p.x]!==1||!Number.isFinite(p.hp)||p.hp<=0)return null;
      if(version<5){
        p.weaponBases=WEAPONS.map((_,i)=>i);p.affixes=WEAPONS.map(()=>null);
        p.ammo=WEAPONS.map((_,i)=>data.player.ammo?.[i]??defaults.ammo[i]);
        p.upgrades=WEAPONS.map((_,i)=>data.player.upgrades?.[i]??0);
      }
      if(version>=5&&!'weaponBases affixes ammo upgrades'.split(' ').every(k=>Array.isArray(data.player[k])))return null;
      p.stats={...defaults.stats,...p.stats};
      if(!Array.isArray(p.weaponBases)||p.weaponBases.length<1||p.weaponBases.length>10000||p.weaponBases.some(i=>!Number.isInteger(i)||!WEAPONS[i]))return null;
      if(!Array.isArray(p.affixes)||p.affixes.length!==p.weaponBases.length||p.affixes.some((a,i)=>a!==null&&(!Object.hasOwn(AFFIXES,a)||(a==='piercing'&&WEAPONS[p.weaponBases[i]].explosive)||WEAPONS[p.weaponBases[i]].locked)))return null;
      if(!Array.isArray(p.owned)||!p.owned.length||p.owned.length>CHARACTERS[p.character].weaponCapacity||new Set(p.owned).size!==p.owned.length||!p.owned.includes(p.weapon)||p.owned.some(i=>!Number.isInteger(i)||p.weaponBases[i]===undefined))return null;
      if(!Array.isArray(p.ammo)||!Array.isArray(p.upgrades)||p.ammo.length!==p.weaponBases.length||p.upgrades.length!==p.weaponBases.length)return null;
      if(p.ammo.some(n=>!Number.isSafeInteger(n)||n<0||n>10000000)||p.upgrades.some(n=>!Number.isInteger(n)||n<0||n>3))return null;
      if(p.weaponBases.some((base,slot)=>WEAPONS[base].melee&&p.ammo[slot]!==0))return null;
      if(p.character==='bulwark'&&p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]].id==='powerfist').length!==1)return null;
      for(const w of WEAPONS.filter(w=>w.boundCharacter)){const slots=p.owned.filter(slot=>WEAPONS[p.weaponBases[slot]].id===w.id);if(p.character===w.boundCharacter?slots.length!==1:slots.length!==0)return null;}
      if(!Array.isArray(p.lore)||p.lore.some(n=>!Number.isInteger(n)||n<1||n>FLOORS.length))return null;
      const g=Object.assign(Object.create(Game.prototype),data,{player:p,effects:[],hazards:data.hazards||[],marks:data.marks||[]});
      g.runId=typeof data.runId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(data.runId)?data.runId:`legacy-${data.seed}`;
      if(['__proto__','constructor','prototype'].includes(g.runId))return null;
      g.protocol=data.protocol??{earned:0,events:[]};g.unlockedWeapons=Array.isArray(data.unlockedWeapons)?data.unlockedWeapons.filter(x=>typeof x==='string'):[];
      if(!Number.isSafeInteger(g.protocol.earned)||g.protocol.earned<0||g.protocol.earned>1000000||!Array.isArray(g.protocol.events)||g.protocol.events.length>PROTOCOL_EVENT_LIMIT||g.protocol.events.some(x=>typeof x!=='string'))return null;
      g.rng=random(rngState??g.seed+g.turn*13);
      if(version===1){g.props=g.props.map((o,i)=>({...o,id:o.id||`legacy-${i}`,type:o.type==='crate'?'cover':o.type,...(o.type==='crate'?{hp:65,maxHp:65}:{})}));for(const e of g.enemies)if(e.type==='boss'&&g.floor===3)e.type='warden';g.log('存檔已升級：六層設施、背包與手榴彈現已可用。');}
      if(version<3){p.moved=false;for(const e of g.enemies)e.moved=false;g.log('戰術更新：牆角探身、移動閃避與命中率已啟用。新地圖從下一層開始。');}
      const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
      if(!['reserve','energy','ordnance','grenades'].every(k=>validCount(p[k])))return null;
      if(g.items.some(item=>(itemAmmo(item.type)||grenadeByItem(item.type))&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      if(version<4){
        const split=amount=>splitLegacyRounds(amount,p.owned.map(i=>WEAPONS[i]),WEAPONS[p.weapon].ammoType);
        const rounds=split(p.reserve);p.reserve=rounds.rifle;p.pistol=rounds.pistol;p.shell=rounds.shell;
        g.items=g.items.flatMap(item=>item.type==='ammo'?Object.entries(split(item.amount??16)).filter(([,n])=>n>0).map(([id,amount])=>({...item,type:AMMUNITION[id].item,amount})):item);
        g.carryLevel=0;g.log('備彈已分類為手槍彈、步槍彈與霰彈；超出上限的補給留在腳下。');
      }else if(!Object.values(AMMUNITION).every(info=>validCount(data.player[info.key]))||(version<6?(!Number.isInteger(g.carryLevel)||g.carryLevel<0||g.carryLevel>3):!validCarryLevels(g.carryLevel)))return null;
      if(g.items.some(item=>(itemAmmo(item.type)||grenadeByItem(item.type))&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      const locations=new Set(p.owned);
      for(const item of g.items){
        if(item.type!=='weapon')continue;
        if(!Number.isInteger(item.weapon)||!WEAPONS[item.weapon]||WEAPONS[item.weapon].locked)return null;
        if(version<5){delete item.slot;g.registerWeapon(item);}
        if(!Number.isInteger(item.slot)||p.weaponBases[item.slot]!==item.weapon||locations.has(item.slot))return null;
        locations.add(item.slot);
      }
      if(version>=28&&(!Object.hasOwn(data.player,'perks')||!Object.hasOwn(data.player,'perkWeaponBonus')))return null;
      if(version<28)migratePerks(g);
      if(version<30){if(![g.pendingPerks,g.perkPicks].every(n=>Number.isSafeInteger(n)&&n>=0))return null;g.legacyPerkPicks=g.perkPicks>perkLimit(p.level)?g.perkPicks:0;const kept=Math.max(0,Math.min(g.pendingPerks,perkLimit(p.level)-g.perkPicks));if(kept!==g.pendingPerks)g.perkDraft=null;g.pendingPerks=kept;}
      if(!validPerks(g))return null;
      if(!validAllies(g))return null;
      if(!validRetreatState(g,(floor,frame)=>Boolean(Game.restore(JSON.stringify({version:SAVE_VERSION,rngState:g.rng.state(),data:{...data,legacyPerkPicks:g.legacyPerkPicks,pendingPerks:g.pendingPerks,perkPicks:g.perkPicks,perkDraft:g.perkDraft,...frame,turn:frame.savedTurn,floor,floorStates:{},allies:[],sensorContacts:[],mission:newMission(),player:{...p,battleSpirit:{...p.battleSpirit,lastKill:p.battleSpirit.lastKill===null?null:Math.min(p.battleSpirit.lastKill,frame.savedTurn)},x:frame.start.x,y:frame.start.y,fireChain:null}}})))))return null;
      // Weapon slots belong to the run, including weapons left on archived floors.
      for(const frame of Object.values(g.floorStates))for(const item of frame.items)if(item.type==='weapon'){
        if(locations.has(item.slot))return null;locations.add(item.slot);
      }
      if(version<5)g.log('武器已升級為獨立個體。既有彈匣與改裝保留，新掉落可能帶有詞條。');
      // v27: the follow drone now fires rifle rounds. Hand back pistol rounds still in an old follow magazine (overflow
      // lands at the player's feet), widen the chassis to the new hit points without healing, and refit to its mode.
      if(version<27){
        let refund=0;for(const a of g.allies)if(a.kind==='drone'){if(a.sourceId==='drone_follow'&&a.ammo>0){refund+=a.ammo;a.ammo=0;}if(a.maxHp===45)a.maxHp=DRONE_HP;fitDrone(a);}
        if(refund){g.receiveAmmo('pistol',refund);g.log(`存檔已升級：追隨無人機改用步槍彈，原彈匣 ${refund} 發手槍彈已退回。`);}
      }
      g.setCarryLevel(g.carryLevel);g.reveal();return g;
    }catch{return null;}
  }
}
