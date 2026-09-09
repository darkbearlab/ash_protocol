import {activeTrait,startingTraits,validTraits,tickTraits,initiativeQueue} from './traits.js';
import {AFFIXES,weaponStats,rollAffix} from './weapons.js';
import {AMMUNITION,AMMO_IDS,capacity,carryLevels,validCarryLevels,itemAmmo,splitLegacyRounds,TERMINAL_AMMO} from './ammunition.js';
import {presentStep} from './presentation.js';
import {SIZE,SAVE_VERSION,PACK_LIMIT,PLATE_CAPACITY,ENEMY_LOOT,WEAPONS,FLOORS,FLOOR_INFO,ENEMY_TYPES,PERKS,LORE} from './data.js';
import {PROTOCOL_REWARDS,newRunId,weaponUnlocked} from './progression.js';
import {random,distance,lineOfSight,generate,makeEnemy,DIRECTIONS,key} from './world.js';
import {combatSight,wallCover,adjacentWalls,shotChance} from './combat.js';

const freshPlayer=()=>({traits:[],x:0,y:0,hp:100,maxHp:100,meds:2,grenades:2,armor:0,bonus:0,blastBonus:0,healBonus:0,hazmat:0,scavenger:0,scrap:0,level:1,xp:0,kills:0,weapon:0,owned:[0,1],weaponBases:WEAPONS.map((_,i)=>i),affixes:WEAPONS.map(()=>null),ammo:WEAPONS.map((w,i)=>i<2?w.mag:0),upgrades:WEAPONS.map(()=>0),reserve:48,pistol:24,shell:12,energy:18,ordnance:4,facing:[0,1],guard:false,focus:false,evasive:false,poison:0,lore:[],stats:{shots:0,damage:0,grenades:0,salvaged:0}});
export const enemyName=e=>ENEMY_TYPES[e.type]?.name||'未知單位';

export class Game {
  constructor(seed=Date.now()%1000000,unlocks=[],carrying=0) {
    this.carryLevel=carryLevels(carrying);this.seed=seed;this.rng=random(seed);this.floor=1;this.turn=1;this.player=freshPlayer();
    this.player.plates=0;this.runId=newRunId();this.protocol={earned:0,events:[]};this.unlockedWeapons=[...unlocks];
    this.logs=[];this.status='playing';this.pendingPerks=0;this.effects=[];this.loadFloor();
    this.log('已抵達轉運站。上下左右移動，尋找綠色電梯。');
  }
  loadFloor() {
    Object.assign(this,generate(this.seed,this.floor,this.unlockedWeapons));
    for(const item of this.items)if(item.type==='weapon')this.registerWeapon(item,true);
    Object.assign(this.player,this.start);this.player.poison=0;this.player.guard=false;this.player.moved=false;this.player.focus=false;this.player.evasive=false;
    this.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));this.target=null;this.reveal();
  }
  get weapon(){return this.weaponAt(this.player.weapon);}
  weaponAt(slot){return weaponStats(this.player.weaponBases[slot],this.player.affixes[slot]);}
  fireChance(target){return this.enemies.includes(target)?this.accuracy(this.player,target).chance:Math.max(10,Math.min(99,97+(this.player.focus?15:0)+this.weapon.accuracyBonus));}
  get visibleEnemies(){return this.enemies.filter(e=>e.hp>0&&this.visible(e));}
  get targeted(){return [...this.enemies,...this.props].find(e=>e.id===this.target&&e.hp>0&&this.visible(e));}
  get perkChoices(){const start=(this.seed+this.player.level*3)%PERKS.length;return [0,1,3].map(n=>PERKS[(start+n)%PERKS.length]);}
  get bossAlive(){return this.enemies.some(e=>(e.type==='boss'||e.type==='warden')&&e.hp>0);}
  get nearbyTerminal(){return this.props.find(o=>o.type==='terminal'&&!o.used&&distance(o,this.player)<=1);}
  get groundWeapon(){return this.items.find(o=>o.type==='weapon'&&distance(o,this.player)<=1);}
  get cover(){if(activeTrait(this.player,'no_cover'))return [];return [...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,this.player)===1),...adjacentWalls(this.grid,this.player)];}
  visible(e){return distance(this.player,e)<=Math.max(10,this.weapon.range)&&combatSight(this.grid,this.player,e);}
  accuracy(attacker,target){return shotChance(this,attacker,target);}
  solid(x,y){return this.props.find(o=>o.x===x&&o.y===y&&o.hp>0&&(o.type==='cover'||o.type==='barrel'));}
  passable(x,y,actor){return this.grid[y]?.[x]===1&&(!this.solid(x,y)||actor?.type==='drone');}
  reveal() {
    const radius=Math.max(10,this.weapon.range);
    this.visibleTiles=new Set();
    for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(distance(this.player,{x,y})<=radius&&combatSight(this.grid,this.player,{x,y})){this.seen[y][x]=true;this.visibleTiles.add(`${x},${y}`);}
    for(const e of this.enemies)if(this.visible(e))e.alert=true;
    this.autoTarget();
  }
  autoTarget(){if(!this.targeted)this.target=this.visibleEnemies.sort((a,b)=>distance(this.player,a)-distance(this.player,b))[0]?.id??null;}
  log(text,danger=false){this.logs.unshift({turn:this.turn,text,danger});this.logs=this.logs.slice(0,50);}
  reserveKey(weapon=this.weapon){return AMMUNITION[weapon.ammoType].key;}
  ammoCapacity(type){return capacity(type,this.carryLevel);}
  dropAmmo(type,amount,pos=this.player){
    if(amount<=0)return;
    const item=AMMUNITION[type].item,existing=this.items.find(o=>o.type===item&&o.x===pos.x&&o.y===pos.y);
    if(existing)existing.amount=(existing.amount??AMMUNITION[type].pickup)+amount;
    else this.items.push({x:pos.x,y:pos.y,type:item,amount});
  }
  receiveAmmo(type,amount,{spill=true}={}){
    const key=AMMUNITION[type].key,accepted=Math.min(amount,Math.max(0,this.ammoCapacity(type)-this.player[key]));
    this.player[key]+=accepted;if(spill&&amount>accepted){this.dropAmmo(type,amount-accepted);this.log(`${AMMUNITION[type].name}超出容量，${amount-accepted} 留在腳下。`);}return accepted;
  }
  setCarryLevel(level){
    this.carryLevel=carryLevels(level);
    for(const [type,info]of Object.entries(AMMUNITION)){const excess=this.player[info.key]-this.ammoCapacity(type);if(excess>0){this.player[info.key]-=excess;this.dropAmmo(type,excess);}}
  }
  supplyPack(amounts){for(const [type,amount]of Object.entries(amounts))this.receiveAmmo(type,amount);}
  weaponDamage(index=this.player.weapon){const w=this.weaponAt(index),bonus=this.player.bonus+(this.player.upgrades[index]||0)*5;return {min:w.min+bonus,max:w.max+bonus};}
  fail(text){this.log(text);return false;}
  awardProtocol(type,id) {const event=`${type}:${id}`,amount=PROTOCOL_REWARDS[type];if(!amount||this.protocol.events.includes(event))return;this.protocol.events.push(event);this.protocol.earned+=amount;this.log(`協定點數 +${amount}，死亡仍保留。`);}

  // Validate the intent before any actor acts: rejected input cannot scout fast enemies.
  validateAction(type,arg){
    const p=this.player,w=this.weapon;
    if(type==='move'){
      if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
      const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
      if(!this.passable(x,y))return this.fail('前方有牆壁或障礙。');
      const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);if(e){this.target=e.id;return this.fail('敵人擋住去路，先開火。');}return true;
    }
    if(type==='fire'){const e=this.targeted;if(!e)return this.fail('射線內沒有目標。');if(distance(p,e)>w.range)return this.fail('目標超出射程。');return p.ammo[p.weapon]>0||this.fail('彈匣已空，請裝填。');}
    if(type==='reload')return (p.ammo[p.weapon]<w.mag&&p[this.reserveKey()]>0)||this.fail('彈匣已滿或沒有對應備彈。');
    if(type==='heal')return (p.meds>0&&(p.hp<p.maxHp||p.poison>0))||this.fail('無法使用醫療包。');
    if(type==='grenade')return (p.grenades>0&&arg&&Number.isInteger(arg.x)&&Number.isInteger(arg.y)&&distance(p,arg)<=5&&this.grid[arg.y]?.[arg.x]===1&&this.visible(arg))||this.fail('需要手榴彈與視線內 5 格的有效落點。');
    if(type==='weapon')return (p.owned.includes(Number(arg))&&Number(arg)!==p.weapon)||this.fail('無法換裝此武器。');
    if(type==='salvage')return (p.owned.includes(Number(arg))&&p.owned.length>1)||this.fail('無法拆解此武器。');
    if(type==='takeWeapon')return (Boolean(this.nearbyWeapon(Number(arg)))&&p.owned.length<PACK_LIMIT)||this.fail('附近沒有這把武器或背包已滿。');
    if(type==='replaceWeapon')return (Boolean(this.nearbyWeapon(arg?.take))&&p.owned.includes(arg?.leave))||this.fail('要交換的武器已不在原處。');
    if(type==='upgrade'){const level=p.upgrades[p.weapon];return (level<3&&p.scrap>=25+level*15)||this.fail('改裝已滿或廢料不足。');}
    if(type==='terminal'){
      if(!this.nearbyTerminal||!['heal','ammo','grenade',...AMMO_IDS].includes(arg))return this.fail('沒有可用終端或補給選項。');
      const cost=TERMINAL_AMMO[arg]?.cost??(arg==='grenade'?12:15),kind=arg==='grenade'?'grenade':TERMINAL_AMMO[arg]?arg:null;
      return (p.scrap>=cost&&!(arg==='heal'&&p.hp===p.maxHp&&!p.poison)&&!(kind&&p[AMMUNITION[kind].key]>=this.ammoCapacity(kind))&&!(arg==='ammo'&&AMMO_IDS.every(id=>p[AMMUNITION[id].key]>=this.ammoCapacity(id))))||this.fail('廢料不足或補給已滿。');
    }
    if(type==='interact')return (distance(p,this.end)<=1&&!this.bossAlive)||this.fail('需要靠近電梯並擊敗本層頭目。');
    return type==='wait';
  }
  action(type,arg){
    if(type==='guard')type='wait';
    if(this.status!=='playing'||this.pendingPerks)return false;
    this.effects=[];const p=this.player;
    if(type==='weapon'&&arg===undefined)arg=p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length];
    if(type==='grenade'){const pos=arg||this.targeted;arg=pos?{x:pos.x,y:pos.y}:null;}
    if(!this.validateAction(type,arg))return false;
    const fireIntent=type==='fire'?{id:this.target,x:this.targeted.x,y:this.targeted.y}:null,floor=this.floor,queue=initiativeQueue(p,this.enemies),playerSpeed=queue.find(q=>q.actor===p).speed;
    this.turn++;
    for(const {actor,speed}of queue){
      if(p.hp<=0||this.status!=='playing'||this.floor!==floor)break;
      if(actor===p){
        if(type==='fire')this.target=fireIntent.id; // Track identity, never switch to another enemy.
        const success=this.executePlayer(type,fireIntent||arg);
        if(!success)this.log('局勢已改變，行動未能完成；本回合已消耗。');
        p.guard=success&&type==='wait';p.moved=success&&type==='move';p.focus=success&&type==='wait';p.evasive=success&&type==='wait';
        this.reveal();
      }else if(actor.hp>0&&actor.alert)presentStep(this,()=>this.enemyAct(actor),speed!==0||playerSpeed!==0?actor:null);
    }
    if(this.floor===floor&&this.status==='playing'&&p.hp>0){
      const due=this.marks.filter(m=>m.due<=this.turn);this.marks=this.marks.filter(m=>m.due>this.turn);
      for(const m of due){if(p.hp<=0)break;presentStep(this,()=>this.explode(m,1,38));}
      if(p.hp>0)presentStep(this,()=>this.environmentTurn());
    }
    for(const actor of [p,...this.enemies])tickTraits(actor);
    this.reveal();if(p.hp<=0){p.hp=0;this.status='dead';this.log('生命訊號中斷。',true);}
    return true;
  }
  executePlayer(type,arg){
    const p=this.player;
    let success=false;
    p.guard=false;p.moved=false;
    switch(type) {
      case 'move': {
        if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
        const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
        if(!this.passable(x,y))return this.fail(this.solid(x,y)?'掩體或油桶擋住去路。可以繞行或射擊破壞。':'前方是牆壁。');
        const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
        if(e){this.target=e.id;return this.fail('敵人擋住去路，先開火。');}
        p.x=x;p.y=y;p.facing=[dx,dy];this.pickup();success=true;break;
      }
      case 'fire': success=this.fire(arg);break;
      case 'reload': {
        const need=this.weapon.mag-p.ammo[p.weapon],reserve=this.reserveKey();
        if(!need)return this.fail('彈匣已滿。');
        if(p[reserve]<=0)return this.fail('沒有對應備彈。探索補給箱或切換武器。');
        const amount=Math.min(need,p[reserve]);p.ammo[p.weapon]+=amount;p[reserve]-=amount;
        this.log(`裝填完成，補充 ${amount} 發。`);success=true;break;
      }
      case 'heal':
        if(p.meds<=0)return this.fail('醫療包已用盡。');
        if(p.hp===p.maxHp&&p.poison===0)return this.fail('生命值已滿。');
        p.meds--;p.hp=Math.min(p.maxHp,p.hp+45+p.healBonus);p.poison=0;
        this.log(`使用醫療包，回復 ${45+p.healBonus} 生命並清除中毒。`);success=true;break;
      case 'grenade': success=presentStep(this,()=>this.throwGrenade(arg||this.targeted));break;
      case 'weapon': {
        const index=arg===undefined?p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length]:Number(arg);
        if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
        if(index===p.weapon)return this.fail('已裝備此武器。');
        p.weapon=index;this.log(`切換至${this.weapon.name}。`);success=true;break;
      }
      case 'salvage':success=this.salvage(Number(arg));break;
      case 'takeWeapon':success=this.takeWeapon(Number(arg));break;
      case 'replaceWeapon':success=this.replaceWeapon(arg);break;
      case 'upgrade':success=this.upgrade();break;
      case 'terminal':success=this.useTerminal(arg);break;
      case 'wait':this.log('防禦待機：直接傷害減半、被射擊命中率 −15；下次行動射擊命中 +15。');success=true;break;
      case 'interact':success=this.descend(false);return success;
      default:return false;
    }
    return success;
  }
  fire(intent=null) {
    const p=this.player,e=this.targeted,w=this.weapon;
    // A committed shot still fires at the last confirmed tile if its target is lost.
    if(intent&&(!e||distance(p,e)>w.range)){
      p.facing=[Math.sign(intent.x-p.x),Math.sign(intent.y-p.y)];
      const shots=Math.min(w.burst||1,p.ammo[p.weapon]);
      for(let i=0;i<shots;i++)presentStep(this,()=>{
        p.ammo[p.weapon]--;p.stats.shots++;
        this.effects.push({type:'shot',weaponId:w.id,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:intent.x,y:intent.y},damage:0,miss:true,color:w.ammoType==='energy'?'#8ae9da':null});
      });
      this.log(`原目標已失去有效射線，向最後確認位置開火落空，消耗 ${shots} 發。`);
      return true;
    }
    if(!e)return this.fail('射線內沒有目標。');
    if(distance(p,e)>w.range)return this.fail('目標超出射程，靠近再開火。');
    if(p.ammo[p.weapon]<=0)return this.fail('彈匣已空，請裝填。');
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    const shots=Math.min(w.burst||1,p.ammo[p.weapon]);
    for(let i=0;i<shots;i++) {
      if(e.hp<=0)break;
      presentStep(this,()=>{
        p.ammo[p.weapon]--;p.stats.shots++;
        const range=this.weaponDamage(),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
        const chance=this.fireChance(e);
        const hit=this.rng()*100<chance;
        this.effects.push({type:'shot',weaponId:w.id,style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:w.ammoType==='energy'?'#8ae9da':null});
        if(!hit){this.log(`射擊未命中（命中率 ${chance}%）。`);if(w.explosive)this.log('榴彈偏離目標，未在戰場內爆炸。');return;}
        if(w.explosive)this.explode(e,1,damage+p.blastBonus);
        else this.hitTarget(e,damage,p,w.pierce||0);
        if(w.splash)for(const other of this.enemies.filter(o=>o.hp>0&&o!==e&&distance(o,e)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*.45),p,w.pierce||0);
      });
    }
    return true;
  }
  protectingCover(target,attacker) {
    if(activeTrait(target,'no_cover'))return null;
    const dx=attacker.x-target.x,dy=attacker.y-target.y;
    return wallCover(this.grid,target,attacker)||this.props.find(o=>o.type==='cover'&&o.hp>0&&distance(o,target)===1&&((o.x-target.x)*dx+(o.y-target.y)*dy)>0);
  }
  hitTarget(target,raw,attacker,pierce=0) {
    if(this.props.includes(target)){this.damageProp(target,raw);return;}
    const cover=this.protectingCover(target,attacker),armor=ENEMY_TYPES[target.type]?.armor||0;
    let damage=raw;
    if(cover){damage*=1-.45*(1-pierce);if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35));this.log('敵方掩體吸收了部分傷害。');}
    damage=Math.max(1,Math.round(damage-armor*(1-pierce)));
    if(this.weapon.ammoType==='energy'&&ENEMY_TYPES[target.type]?.mechanical)damage=Math.round(damage*1.2);
    this.hurt(target,damage);
  }
  hurt(e,damage) {
    if(e.hp<=0)return;
    e.hp-=damage;this.player.stats.damage+=damage;
    this.effects.push({type:'impact',from:{x:e.x,y:e.y},to:{x:e.x,y:e.y},damage,mechanical:ENEMY_TYPES[e.type]?.mechanical});
    this.log(`命中${enemyName(e)}，造成 ${damage} 傷害。`);
    if(e.hp>0)return;
    this.player.kills++;this.player.xp+=ENEMY_TYPES[e.type]?.xp||1;
    this.player.scrap+=Math.round((e.type==='boss'||e.type==='warden'?35:3)*(1+this.player.scavenger*.5));
    this.log(`${enemyName(e)}已消滅。`);
    while(this.player.xp>=this.player.level+2){this.player.xp-=this.player.level+2;this.player.level++;this.pendingPerks++;}
    if(e.type==='bomber')this.explode(e,1,30);
    if(e.type==='warden'||e.type==='boss')this.awardProtocol(e.type,`${this.floor}:${e.id}`);
    const loot=ENEMY_LOOT[e.type];
    if(loot?.weapon!==undefined&&weaponUnlocked(WEAPONS[loot.weapon],this.unlockedWeapons)&&this.rng()<(loot.chance||0))this.items.push(this.registerWeapon({x:e.x,y:e.y,type:'weapon',weapon:loot.weapon},true));
    if(this.rng()<.35){const type=loot?.ammo||'ammo';this.items.push({x:e.x,y:e.y,type,amount:type==='energy'?6:type==='ordnance'?2:type==='pistol'?18:type==='shell'?4:10});}
    if(this.rng()<.06)this.items.push({x:e.x,y:e.y,type:'med'});
    if((ENEMY_TYPES[e.type]?.armor||0)>0&&this.rng()<.2)this.items.push({x:e.x,y:e.y,type:'armor',amount:10});
  }
  damageProp(prop,damage) {
    if(prop.indestructible)return;
    if(prop.hp<=0)return;
    prop.hp-=damage;
    if(prop.hp>0)return;
    this.log(prop.type==='barrel'?'油桶被引爆！':'掩體已摧毀。');
    if(prop.type==='barrel')this.explode(prop,2,45);
  }
  throwGrenade(pos) {
    const p=this.player;
    if(p.grenades<=0)return this.fail('手榴彈已用盡。');
    if(!pos||!Number.isInteger(pos.x)||!Number.isInteger(pos.y)||this.grid[pos.y]?.[pos.x]!==1)return this.fail('先選擇可見地板或敵人作為投擲位置。');
    if(distance(p,pos)>5||!this.visible(pos))return this.fail('投擲位置需在視線內 5 格以內。');
    p.grenades--;p.stats.grenades++;this.log('投擲破片手榴彈。');
    this.effects.push({type:'shot',style:'grenade',from:{x:p.x,y:p.y},to:{x:pos.x,y:pos.y},damage:0});
    this.explode(pos,2,55+p.blastBonus);return true;
  }
  explode(center,radius,damage) {
    const origin={x:center.x,y:center.y};
    this.effects.push({type:'blast',from:origin,to:origin,damage:0,radius});
    const affected=p=>distance(origin,p)<=radius&&lineOfSight(this.grid,origin,p);
    // Mark barrels as destroyed before recursion, so chain reactions terminate.
    for(const prop of this.props.filter(o=>o.hp>0&&affected(o)))this.damageProp(prop,damage);
    for(const e of this.enemies.filter(e=>e.hp>0&&affected(e)))this.hurt(e,Math.max(1,damage-distance(origin,e)*10));
    if(affected(this.player))this.damagePlayer(Math.max(1,damage-distance(origin,this.player)*10),'爆炸衝擊',null,true);
  }
  damagePlayer(raw,label,attacker=null,blast=false) {
    const p=this.player,cover=!blast&&attacker?this.protectingCover(p,attacker):null;
    let damage=raw;
    if(cover){damage*=.55;if(!cover.indestructible)this.damageProp(cover,Math.ceil(raw*.35));}
    damage=Math.max(1,Math.round(damage-p.armor));if(p.guard)damage=Math.max(1,Math.ceil(damage*.5));
    const absorbed=Math.min(p.plates||0,Math.floor(damage/2));p.plates=(p.plates||0)-absorbed;damage-=absorbed;
    p.hp-=damage;this.log(`${label}${cover?'（掩體減傷）':''}${absorbed?`（護甲板吸收 ${absorbed}）`:''}，生命 −${damage}。`,true);
    if(attacker)this.effects.push({type:'enemyShot',attackerType:attacker.type,style:attacker.type==='crawler'?'claw':attacker.type==='brute'?'slash':ENEMY_TYPES[attacker.type]?.mechanical?'plasma':'bullet',from:{x:attacker.x,y:attacker.y},to:{x:p.x,y:p.y},damage});
    else this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage});
  }
  enemyAct(e) {
    const p=this.player;e.moved=false;
      if(e.hp<=0||!e.alert||p.hp<=0)return;
      const def=ENEMY_TYPES[e.type],d=distance(e,p),los=combatSight(this.grid,e,p);
      if(d>16)return;
      if(def.seekCover&&los&&!e.charge&&!this.protectingCover(e,p)){
        const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>this.passable(n.x,n.y,e)&&distance(n,p)>1&&!this.enemies.some(o=>o!==e&&o.hp>0&&distance(o,n)===0)&&!this.hazards.some(h=>distance(h,n)===0)&&distance(n,p)<=def.range&&combatSight(this.grid,n,p)&&this.protectingCover({...e,...n},p));
        if(spot){e.x=spot.x;e.y=spot.y;e.moved=true;return;}
      }
      if(los&&d<=def.range) {
        if(e.type==='boss'&&(e.attackCount||0)%2===1&&!e.charge) {
          this.marks.push({x:p.x,y:p.y,due:this.turn+2});e.attackCount++;
          this.log('核心守衛標記轟炸區：兩次行動內離開紅色格與鄰格！',true);return;
        }
        if(!e.charge){e.charge=true;e.windup=e.type==='sniper'?2:1;e.aim={x:p.x,y:p.y};return;}
        e.windup=(e.windup||1)-1;if(e.windup>0)return;
        if(e.type==='bomber'){this.hurt(e,e.hp);return;}
        if(e.type==='sniper'&&distance(p,e.aim||p)>0)this.log('狙擊彈擊中你原本的位置。');
        else {
          const chance=def.range>1?this.accuracy(e,p).chance:97;
          if(this.rng()*100<chance)this.damagePlayer(def.damage+this.floor*2,`${enemyName(e)}攻擊`,e);
          else {this.log(`${enemyName(e)}未命中（${chance}%）。`);this.effects.push({type:'enemyShot',attackerType:e.type,from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0,miss:true});}
        }
        e.charge=Boolean(def.rapid);e.windup=1;e.aim=null;e.attackCount=(e.attackCount||0)+1;
      } else {
        e.charge=false;e.aim=null;e.windup=0;
        const step=this.nextStep(e,p);if(step){e.x=step.x;e.y=step.y;e.moved=true;}
      }
      if((e.type==='boss'||e.type==='warden')&&e.hp<e.maxHp*.5&&!e.reinforced) {
        e.reinforced=true;
        for(const [dx,dy]of DIRECTIONS.slice(0,2)){const x=e.x+dx,y=e.y+dy;if(this.passable(x,y)&&distance(p,{x,y})>0&&!this.enemies.some(o=>o.hp>0&&o.x===x&&o.y===y)){const drone=makeEnemy('drone',x,y,`${e.id}-reinforce-${dx}-${dy}`,this.floor);drone.alert=true;this.enemies.push(drone);}}
        this.log(`${enemyName(e)}呼叫了無人機增援！`,true);
      }
  }
  nextStep(e,target) {
    const queue=[{x:e.x,y:e.y,first:null}],visited=new Set([key(e)]);
    const occupied=new Set(this.enemies.filter(o=>o!==e&&o.hp>0).map(key));
    for(let i=0;i<queue.length&&i<SIZE*SIZE;i++)for(const [dx,dy]of DIRECTIONS) {
      const q=queue[i],x=q.x+dx,y=q.y+dy,k=`${x},${y}`;
      if(visited.has(k)||!this.passable(x,y,e))continue;
      if(x===target.x&&y===target.y)return q.first;
      if(occupied.has(k))continue;
      visited.add(k);queue.push({x,y,first:q.first||{x,y}});
    }return null;
  }
  environmentTurn() {
    const p=this.player,hpBefore=p.hp,hazard=this.hazards.find(h=>h.x===p.x&&h.y===p.y);
    if(hazard){const damage=Math.max(0,(hazard.type==='acid'?8:12)-p.hazmat);p.hp-=damage;if(hazard.type==='acid'&&p.hazmat<8)p.poison=3;this.log(`${hazard.type==='acid'?'污染液':'高熱地板'}傷害 −${damage}。`,true);}
    else if(p.poison>0){p.poison--;const damage=Math.max(0,4-p.hazmat);p.hp-=damage;if(damage)this.log(`中毒傷害 −${damage}，剩餘 ${p.poison} 回合。`,true);}
    if(p.hp<hpBefore)this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage:hpBefore-p.hp});
    for(const e of this.enemies.filter(e=>e.hp>0&&e.type!=='drone'))if(this.hazards.some(h=>h.x===e.x&&h.y===e.y))this.hurt(e,6);
  }
  pickup() {
    const p=this.player;
    this.items=this.items.filter(item=>{
      if(distance(item,p)!==0)return true;
      if(item.type==='weapon') {
        this.registerWeapon(item);
        if(p.owned.length>=PACK_LIMIT){this.log('武器欄已滿。打開背包比較並交換，原武器會留在地上。');return true;}
        this.collectWeapon(item);return false;
      }
      const ammo=itemAmmo(item.type);
      if(ammo){const amount=item.amount??AMMUNITION[ammo].pickup,accepted=this.receiveAmmo(ammo,amount,{spill:false});
        if(accepted)this.log(`拾取${AMMUNITION[ammo].name} +${accepted}。`);
        if(accepted<amount){item.amount=amount-accepted;this.log(`${AMMUNITION[ammo].name}容量已滿，剩餘 ${item.amount} 留在原地。`);return true;}
      }      else if(item.type==='med'){p.meds++;this.log('拾取醫療包 +1。');}
      else if(item.type==='armor'){const amount=Math.min(item.amount||20,PLATE_CAPACITY-(p.plates||0));if(amount<=0){this.log('護甲板已滿，補給留在原地。');return true;}p.plates=(p.plates||0)+amount;this.log(`修復護甲板 +${amount}（${p.plates}/${PLATE_CAPACITY}）。`);}
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
    if(!WEAPONS[base]||this.player.owned.length>=PACK_LIMIT)return false;
    const item=this.registerWeapon({weapon:base});this.collectWeapon(item);return item.slot;
  }
  nearbyWeapon(slot){return this.items.find(o=>o.type==='weapon'&&o.slot===slot&&distance(o,this.player)<=1);}
  takeWeapon(slot) {
    const item=this.nearbyWeapon(slot);
    if(!item)return this.fail('附近沒有這把武器。');
    if(this.player.owned.length>=PACK_LIMIT)return this.fail('武器欄已滿（3 格）。可比較並交換武器。');
    this.collectWeapon(item);this.items=this.items.filter(o=>o!==item);return true;
  }
  replaceWeapon(arg) {
    const p=this.player,item=this.nearbyWeapon(arg?.take),old=arg?.leave;
    if(!item||!p.owned.includes(old))return this.fail('要交換的武器已不在原處。');
    p.owned[p.owned.indexOf(old)]=item.slot;if(p.weapon===old)p.weapon=item.slot;
    this.items=this.items.filter(o=>o!==item);
    this.items.push({x:p.x,y:p.y,type:'weapon',weapon:p.weaponBases[old],slot:old});
    this.log(`換入${this.weaponAt(item.slot).name}；${this.weaponAt(old).name}連同彈匣與改裝留在腳下。`);return true;
  }
  salvage(index) {
    const p=this.player;
    if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
    if(p.owned.length<=1)return this.fail('至少保留一把武器。');
    this.receiveAmmo(this.weaponAt(index).ammoType,p.ammo[index]);p.ammo[index]=0;p.owned=p.owned.filter(i=>i!==index);
    p.scrap+=20+(p.upgrades[index]||0)*10;p.upgrades[index]=0;p.stats.salvaged++;
    if(p.weapon===index)p.weapon=p.owned[0];this.log(`拆解${this.weaponAt(index).name}，回收彈匣與廢料。`);return true;
  }
  upgrade() {
    const p=this.player,level=p.upgrades[p.weapon]||0,cost=25+level*15;
    if(level>=3)return this.fail('此武器已達最高改裝等級。');
    if(p.scrap<cost)return this.fail(`改裝需要 ${cost} 廢料。`);
    p.scrap-=cost;p.upgrades[p.weapon]++;this.log(`${this.weapon.name}改裝 +${level+1}，每發傷害 +5。`);return true;
  }
  useTerminal(option) {
    const terminal=this.nearbyTerminal,p=this.player;
    if(!terminal)return this.fail('附近沒有可用補給終端。');
    if(!['heal','ammo','grenade',...AMMO_IDS].includes(option))return false;
    const cost=TERMINAL_AMMO[option]?.cost??(option==='grenade'?12:15);
    const kind=option==='grenade'?'grenade':TERMINAL_AMMO[option]?option:null;
    if(kind&&p[AMMUNITION[kind].key]>=this.ammoCapacity(kind))return this.fail('此彈種已達攜帶上限。');
    if(option==='ammo'&&AMMO_IDS.every(id=>p[AMMUNITION[id].key]>=this.ammoCapacity(id)))return this.fail('各類備彈皆已滿。');
    if(p.scrap<cost)return this.fail(`終端需要 ${cost} 廢料。`);
    if(option==='heal'&&p.hp===p.maxHp&&!p.poison)return this.fail('生命值已滿。');
    p.scrap-=cost;terminal.used=true;
    if(option==='heal'){p.hp=Math.min(p.maxHp,p.hp+60);p.poison=0;}
    if(option==='ammo')this.supplyPack({rifle:24,pistol:24,shell:6,energy:12,ordnance:3});
    if(TERMINAL_AMMO[option])this.receiveAmmo(option,TERMINAL_AMMO[option].amount);
    if(option==='grenade')this.receiveAmmo('grenade',2);
    this.log('終端補給完成。此終端已耗盡。');return true;
  }
  descend(advanceTurn=true) {
    const p=this.player;
    if(distance(p,this.end)>1)return this.fail('需要靠近綠色電梯。');
    if(this.bossAlive)return this.fail('本層頭目仍存活，電梯鎖定。');
    this.awardProtocol('floor',this.floor);
    if(this.floor===FLOORS.length){this.awardProtocol('extraction','win');this.status='won';this.log('訊號已恢復。撤離成功。');return true;}
    this.floor++;if(advanceTurn)this.turn++;p.hp=Math.min(p.maxHp,p.hp+25);
    this.loadFloor();this.supplyPack({rifle:20,pistol:24,shell:6,energy:10,ordnance:2});this.log(`進入${FLOORS[this.floor-1]}。生命 +25，補充各類備彈。`);return true;
  }
  choosePerk(id) {
    if(!this.pendingPerks||!PERKS.some(o=>o.id===id))return false;
    const p=this.player;
    if(id==='damage')p.bonus+=6;
    if(id==='health'){p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+40);}
    if(id==='armor')p.armor+=3;
    if(id==='med'){p.meds+=2;this.supplyPack({grenade:2,rifle:24,pistol:24,shell:6});}
    if(id==='blast')p.blastBonus+=18;
    if(id==='scavenger'){p.scavenger++;p.scrap+=15;}
    if(id==='medic'){p.healBonus+=20;p.meds++;}
    if(id==='hazmat'){p.hazmat+=5;p.poison=0;}
    this.pendingPerks--;this.log(`模組已安裝：${PERKS.find(x=>x.id===id).name}。`);return true;
  }
  serialize(){const {rng,effects,visibleTiles,...data}=this;return JSON.stringify({version:SAVE_VERSION,data,rngState:rng.state()});}
  static restore(raw) {
    try {
      const {version,data,rngState}=JSON.parse(raw);
      if(![1,2,3,4,5,6,SAVE_VERSION].includes(version)||data?.status!=='playing'||!data.player||!Number.isInteger(data.floor)||data.floor<1||data.floor>FLOORS.length)return null;
      if(!Number.isInteger(data.seed)||data.seed<0||!Number.isInteger(data.turn)||data.turn<1)return null;
      if(!Array.isArray(data.grid)||data.grid.length!==SIZE||data.grid.some(row=>!Array.isArray(row)||row.length!==SIZE))return null;
      if(!Array.isArray(data.enemies)||data.enemies.some(e=>!ENEMY_TYPES[e.type]||!Number.isFinite(e.hp)))return null;
      if(!Array.isArray(data.props)||!Array.isArray(data.items))return null;
      const defaults=freshPlayer(),p={...defaults,...data.player};
      if(version<7){p.traits=[];for(const e of data.enemies)e.traits=startingTraits(e.type,data.floor);}
      if((version>=7&&!validTraits(data.player.traits))||!validTraits(p.traits)||data.enemies.some(e=>!validTraits(e.traits)))return null;
      p.plates=data.player.plates??0;if(!Number.isInteger(p.plates)||p.plates<0||p.plates>PLATE_CAPACITY)return null;
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||data.grid[p.y]?.[p.x]!==1||!Number.isFinite(p.hp)||p.hp<=0)return null;
      if(version<5){
        p.weaponBases=WEAPONS.map((_,i)=>i);p.affixes=WEAPONS.map(()=>null);
        p.ammo=WEAPONS.map((_,i)=>data.player.ammo?.[i]??defaults.ammo[i]);
        p.upgrades=WEAPONS.map((_,i)=>data.player.upgrades?.[i]??0);
      }
      if(version>=5&&!'weaponBases affixes ammo upgrades'.split(' ').every(k=>Array.isArray(data.player[k])))return null;
      p.stats={...defaults.stats,...p.stats};
      if(!Array.isArray(p.weaponBases)||p.weaponBases.length<1||p.weaponBases.length>10000||p.weaponBases.some(i=>!Number.isInteger(i)||!WEAPONS[i]))return null;
      if(!Array.isArray(p.affixes)||p.affixes.length!==p.weaponBases.length||p.affixes.some((a,i)=>a!==null&&(!Object.hasOwn(AFFIXES,a)||(a==='piercing'&&WEAPONS[p.weaponBases[i]].explosive))))return null;
      if(!Array.isArray(p.owned)||!p.owned.length||p.owned.length>PACK_LIMIT||new Set(p.owned).size!==p.owned.length||!p.owned.includes(p.weapon)||p.owned.some(i=>!Number.isInteger(i)||p.weaponBases[i]===undefined))return null;
      if(!Array.isArray(p.ammo)||!Array.isArray(p.upgrades)||p.ammo.length!==p.weaponBases.length||p.upgrades.length!==p.weaponBases.length)return null;
      if(p.ammo.some(n=>!Number.isSafeInteger(n)||n<0||n>10000000)||p.upgrades.some(n=>!Number.isInteger(n)||n<0||n>3))return null;
      if(!Array.isArray(p.lore)||p.lore.some(n=>!Number.isInteger(n)||n<1||n>FLOORS.length))return null;
      const g=Object.assign(Object.create(Game.prototype),data,{player:p,effects:[],hazards:data.hazards||[],marks:data.marks||[]});
      g.runId=typeof data.runId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(data.runId)?data.runId:`legacy-${data.seed}`;
      if(['__proto__','constructor','prototype'].includes(g.runId))return null;
      g.protocol=data.protocol??{earned:0,events:[]};g.unlockedWeapons=Array.isArray(data.unlockedWeapons)?data.unlockedWeapons.filter(x=>typeof x==='string'):[];
      if(!Number.isSafeInteger(g.protocol.earned)||g.protocol.earned<0||g.protocol.earned>1000000||!Array.isArray(g.protocol.events)||g.protocol.events.length>128||g.protocol.events.some(x=>typeof x!=='string'))return null;
      g.rng=random(rngState??g.seed+g.turn*13);
      if(version===1){g.props=g.props.map((o,i)=>({...o,id:o.id||`legacy-${i}`,type:o.type==='crate'?'cover':o.type,...(o.type==='crate'?{hp:65,maxHp:65}:{})}));for(const e of g.enemies)if(e.type==='boss'&&g.floor===3)e.type='warden';g.log('存檔已升級：六層設施、背包與手榴彈現已可用。');}
      if(version<3){p.moved=false;for(const e of g.enemies)e.moved=false;g.log('戰術更新：牆角探身、移動閃避與命中率已啟用。新地圖從下一層開始。');}
      const validCount=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000000;
      if(!['reserve','energy','ordnance','grenades'].every(k=>validCount(p[k])))return null;
      if(g.items.some(item=>itemAmmo(item.type)&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      if(version<4){
        const split=amount=>splitLegacyRounds(amount,p.owned.map(i=>WEAPONS[i]),WEAPONS[p.weapon].ammoType);
        const rounds=split(p.reserve);p.reserve=rounds.rifle;p.pistol=rounds.pistol;p.shell=rounds.shell;
        g.items=g.items.flatMap(item=>item.type==='ammo'?Object.entries(split(item.amount??16)).filter(([,n])=>n>0).map(([id,amount])=>({...item,type:AMMUNITION[id].item,amount})):item);
        g.carryLevel=0;g.log('備彈已分類為手槍彈、步槍彈與霰彈；超出上限的補給留在腳下。');
      }else if(!Object.values(AMMUNITION).every(info=>validCount(data.player[info.key]))||(version<6?(!Number.isInteger(g.carryLevel)||g.carryLevel<0||g.carryLevel>3):!validCarryLevels(g.carryLevel)))return null;
      if(g.items.some(item=>itemAmmo(item.type)&&item.amount!==undefined&&(!validCount(item.amount)||item.amount===0)))return null;
      const locations=new Set(p.owned);
      for(const item of g.items){
        if(item.type!=='weapon')continue;
        if(!Number.isInteger(item.weapon)||!WEAPONS[item.weapon])return null;
        if(version<5){delete item.slot;g.registerWeapon(item);}
        if(!Number.isInteger(item.slot)||p.weaponBases[item.slot]!==item.weapon||locations.has(item.slot))return null;
        locations.add(item.slot);
      }
      if(version<5)g.log('武器已升級為獨立個體。既有彈匣與改裝保留，新掉落可能帶有詞條。');
      g.setCarryLevel(g.carryLevel);g.reveal();return g;
    }catch{return null;}
  }
}
