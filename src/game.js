import {SIZE,SAVE_VERSION,PACK_LIMIT,PLATE_CAPACITY,ENEMY_LOOT,WEAPONS,FLOORS,FLOOR_INFO,ENEMY_TYPES,PERKS,LORE} from './data.js';
import {PROTOCOL_REWARDS,newRunId,weaponUnlocked} from './progression.js';
import {random,distance,lineOfSight,generate,makeEnemy,DIRECTIONS,key} from './world.js';
import {combatSight,wallCover,adjacentWalls,shotChance} from './combat.js';

const freshPlayer=()=>({x:0,y:0,hp:100,maxHp:100,meds:2,grenades:2,armor:0,bonus:0,blastBonus:0,healBonus:0,hazmat:0,scavenger:0,scrap:0,level:1,xp:0,kills:0,weapon:0,owned:[0,1],ammo:[8,4,0,0,0,0],upgrades:[0,0,0,0,0,0],reserve:48,energy:18,ordnance:4,facing:[0,1],guard:false,focus:false,evasive:false,poison:0,lore:[],stats:{shots:0,damage:0,grenades:0,salvaged:0}});
export const enemyName=e=>ENEMY_TYPES[e.type]?.name||'未知單位';

export class Game {
  constructor(seed=Date.now()%1000000,unlocks=[]) {
    this.seed=seed;this.rng=random(seed);this.floor=1;this.turn=1;this.player=freshPlayer();
    this.player.plates=0;this.runId=newRunId();this.protocol={earned:0,events:[]};this.unlockedWeapons=[...unlocks];
    this.logs=[];this.status='playing';this.pendingPerks=0;this.effects=[];this.loadFloor();
    this.log('已抵達轉運站。上下左右移動，尋找綠色電梯。');
  }
  loadFloor() {
    Object.assign(this,generate(this.seed,this.floor,this.unlockedWeapons));
    Object.assign(this.player,this.start);this.player.poison=0;this.player.guard=false;this.player.moved=false;this.player.focus=false;this.player.evasive=false;
    this.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));this.target=null;this.reveal();
  }
  get weapon(){return WEAPONS[this.player.weapon];}
  get visibleEnemies(){return this.enemies.filter(e=>e.hp>0&&this.visible(e));}
  get targeted(){return [...this.enemies,...this.props].find(e=>e.id===this.target&&e.hp>0&&this.visible(e));}
  get perkChoices(){const start=(this.seed+this.player.level*3)%PERKS.length;return [0,1,3].map(n=>PERKS[(start+n)%PERKS.length]);}
  get bossAlive(){return this.enemies.some(e=>(e.type==='boss'||e.type==='warden')&&e.hp>0);}
  get nearbyTerminal(){return this.props.find(o=>o.type==='terminal'&&!o.used&&distance(o,this.player)<=1);}
  get groundWeapon(){return this.items.find(o=>o.type==='weapon'&&distance(o,this.player)<=1);}
  get cover(){return [...this.props.filter(o=>o.type==='cover'&&o.hp>0&&distance(o,this.player)===1),...adjacentWalls(this.grid,this.player)];}
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
  reserveKey(weapon=this.weapon){return weapon.ammoType==='energy'?'energy':weapon.ammoType==='ordnance'?'ordnance':'reserve';}
  weaponDamage(index=this.player.weapon){const w=WEAPONS[index],bonus=this.player.bonus+(this.player.upgrades[index]||0)*5;return {min:w.min+bonus,max:w.max+bonus};}
  fail(text){this.log(text);return false;}
  awardProtocol(type,id) {const event=`${type}:${id}`,amount=PROTOCOL_REWARDS[type];if(!amount||this.protocol.events.includes(event))return;this.protocol.events.push(event);this.protocol.earned+=amount;this.log(`協定點數 +${amount}，死亡仍保留。`);}

  // Only this gateway advances turns. Invalid actions, aiming and inspecting are free.
  action(type,arg) {
    if(this.status!=='playing'||this.pendingPerks)return false;
    this.effects=[];
    const p=this.player;
    let success=false;
    switch(type) {
      case 'move': {
        if(!Array.isArray(arg)||!Number.isInteger(arg[0])||!Number.isInteger(arg[1])||Math.abs(arg[0])+Math.abs(arg[1])!==1)return false;
        const [dx,dy]=arg,x=p.x+dx,y=p.y+dy;
        if(!this.passable(x,y))return this.fail(this.solid(x,y)?'掩體或油桶擋住去路。可以繞行或射擊破壞。':'前方是牆壁。');
        const e=this.enemies.find(e=>e.hp>0&&e.x===x&&e.y===y);
        if(e){this.target=e.id;return this.fail('敵人擋住去路，先開火。');}
        p.x=x;p.y=y;p.facing=[dx,dy];this.pickup();success=true;break;
      }
      case 'fire': success=this.fire();break;
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
      case 'grenade': success=this.throwGrenade(arg||this.targeted);break;
      case 'weapon': {
        const index=arg===undefined?p.owned[(p.owned.indexOf(p.weapon)+1)%p.owned.length]:Number(arg);
        if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
        if(index===p.weapon)return this.fail('已裝備此武器。');
        p.weapon=index;this.log(`切換至${this.weapon.name}。`);success=true;break;
      }
      case 'salvage':success=this.salvage(Number(arg));break;
      case 'takeWeapon':success=this.takeWeapon(arg);break;
      case 'upgrade':success=this.upgrade();break;
      case 'terminal':success=this.useTerminal(arg);break;
      case 'guard':this.log('架起防禦：本回合直接傷害減半。');success=true;break;
      case 'wait':this.log('觀察架勢：本回合閃避 +15，下次行動射擊命中 +15（最高 99%）。');success=true;break;
      case 'interact':return this.descend();
      default:return false;
    }
    if(!success)return false;
    // The previous focus applies during fire(), then expires on ANY valid action.
    // Waiting renews it without stacking. Evasion covers this enemy phase only.
    p.guard=type==='guard';p.moved=type==='move';p.focus=type==='wait';p.evasive=type==='wait';this.turn++;
    this.reveal();this.enemyTurn();this.environmentTurn();this.reveal();
    if(p.hp<=0){p.hp=0;this.status='dead';this.log('生命訊號中斷。',true);}
    return true;
  }
  fire() {
    const p=this.player,e=this.targeted,w=this.weapon;
    if(!e)return this.fail('射線內沒有目標。');
    if(distance(p,e)>w.range)return this.fail('目標超出射程，靠近再開火。');
    if(p.ammo[p.weapon]<=0)return this.fail('彈匣已空，請裝填。');
    p.facing=[Math.sign(e.x-p.x),Math.sign(e.y-p.y)];
    const shots=Math.min(w.burst||1,p.ammo[p.weapon]);
    for(let i=0;i<shots;i++) {
      if(e.hp<=0)break;
      p.ammo[p.weapon]--;p.stats.shots++;
      const range=this.weaponDamage(),damage=range.min+Math.floor(this.rng()*(range.max-range.min+1));
      const chance=this.props.includes(e)?Math.min(99,97+(p.focus?15:0)):this.accuracy(p,e).chance;
      const hit=this.rng()*100<chance;
      this.effects.push({type:'shot',style:w.ammoType==='energy'?'plasma':'bullet',from:{x:p.x,y:p.y},to:{x:e.x,y:e.y},damage:0,miss:!hit,color:w.ammoType==='energy'?'#8ae9da':null});
      if(!hit){this.log(`射擊未命中（命中率 ${chance}%）。`);if(w.explosive)this.log('榴彈偏離目標，未在戰場內爆炸。');continue;}
      if(w.explosive)this.explode(e,1,damage+p.blastBonus);
      else this.hitTarget(e,damage,p,w.pierce||0);
      if(w.splash)for(const other of this.enemies.filter(o=>o.hp>0&&o!==e&&distance(o,e)<=1&&this.visible(o)))this.hitTarget(other,Math.round(damage*.45),p);
    }
    return true;
  }
  protectingCover(target,attacker) {
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
    if(loot?.weapon!==undefined&&weaponUnlocked(WEAPONS[loot.weapon],this.unlockedWeapons)&&this.rng()<(loot.chance||0))this.items.push({x:e.x,y:e.y,type:'weapon',weapon:loot.weapon});
    if(this.rng()<.35){const type=loot?.ammo||'ammo';this.items.push({x:e.x,y:e.y,type,amount:type==='energy'?6:type==='ordnance'?2:10});}
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
    if(attacker)this.effects.push({type:'enemyShot',style:attacker.type==='crawler'?'claw':attacker.type==='brute'?'slash':ENEMY_TYPES[attacker.type]?.mechanical?'plasma':'bullet',from:{x:attacker.x,y:attacker.y},to:{x:p.x,y:p.y},damage});
    else this.effects.push({type:'impact',from:{x:p.x,y:p.y},to:{x:p.x,y:p.y},damage});
  }
  enemyTurn() {
    const p=this.player;
    const due=this.marks.filter(m=>m.due<=this.turn);this.marks=this.marks.filter(m=>m.due>this.turn);
    for(const m of due)this.explode(m,1,38);
    for(const e of this.enemies)e.moved=false;
    for(const e of [...this.enemies]) {
      if(e.hp<=0||!e.alert||p.hp<=0)continue;
      const def=ENEMY_TYPES[e.type],d=distance(e,p),los=combatSight(this.grid,e,p);
      if(d>16)continue;
      if(def.seekCover&&los&&!e.charge&&!this.protectingCover(e,p)){
        const spot=DIRECTIONS.map(([dx,dy])=>({x:e.x+dx,y:e.y+dy})).find(n=>this.passable(n.x,n.y,e)&&distance(n,p)>1&&!this.enemies.some(o=>o!==e&&o.hp>0&&distance(o,n)===0)&&!this.hazards.some(h=>distance(h,n)===0)&&distance(n,p)<=def.range&&combatSight(this.grid,n,p)&&this.protectingCover(n,p));
        if(spot){e.x=spot.x;e.y=spot.y;e.moved=true;continue;}
      }
      if(los&&d<=def.range) {
        if(e.type==='boss'&&(e.attackCount||0)%2===1&&!e.charge) {
          this.marks.push({x:p.x,y:p.y,due:this.turn+2});e.attackCount++;
          this.log('核心守衛標記轟炸區：兩次行動內離開紅色格與鄰格！',true);continue;
        }
        if(!e.charge){e.charge=true;e.windup=e.type==='sniper'?2:1;e.aim={x:p.x,y:p.y};continue;}
        e.windup=(e.windup||1)-1;if(e.windup>0)continue;
        if(e.type==='bomber'){this.hurt(e,e.hp);continue;}
        if(e.type==='sniper'&&distance(p,e.aim||p)>0)this.log('狙擊彈擊中你原本的位置。');
        else {
          const chance=def.range>1?this.accuracy(e,p).chance:97;
          if(this.rng()*100<chance)this.damagePlayer(def.damage+this.floor*2,`${enemyName(e)}攻擊`,e);
          else {this.log(`${enemyName(e)}未命中（${chance}%）。`);this.effects.push({type:'enemyShot',from:{x:e.x,y:e.y},to:{x:p.x,y:p.y},damage:0,miss:true});}
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
    const p=this.player,hazard=this.hazards.find(h=>h.x===p.x&&h.y===p.y);
    if(hazard){const damage=Math.max(0,(hazard.type==='acid'?8:12)-p.hazmat);p.hp-=damage;if(hazard.type==='acid'&&p.hazmat<8)p.poison=3;this.log(`${hazard.type==='acid'?'污染液':'高熱地板'}傷害 −${damage}。`,true);}
    else if(p.poison>0){p.poison--;const damage=Math.max(0,4-p.hazmat);p.hp-=damage;if(damage)this.log(`中毒傷害 −${damage}，剩餘 ${p.poison} 回合。`,true);}
    for(const e of this.enemies.filter(e=>e.hp>0&&e.type!=='drone'))if(this.hazards.some(h=>h.x===e.x&&h.y===e.y))this.hurt(e,6);
  }
  pickup() {
    const p=this.player;
    this.items=this.items.filter(item=>{
      if(distance(item,p)!==0)return true;
      if(item.type==='weapon') {
        if(p.owned.includes(item.weapon)){p.scrap+=15;this.log('拆解重複武器：廢料 +15。');return false;}
        if(p.owned.length>=PACK_LIMIT){this.log('背包武器欄已滿。打開背包拆解武器，再拾取。');return true;}
        this.addWeapon(item.weapon);return false;
      }
      if(item.type==='ammo'){p.reserve+=item.amount||16;this.log(`拾取子彈 +${item.amount||16}。`);}
      else if(item.type==='energy'){p.energy+=item.amount||12;this.log('拾取能量電池。');}
      else if(item.type==='ordnance'){p.ordnance+=item.amount||4;this.log('拾取榴彈彈藥。');}
      else if(item.type==='med'){p.meds++;this.log('拾取醫療包 +1。');}
      else if(item.type==='armor'){const amount=Math.min(item.amount||20,PLATE_CAPACITY-(p.plates||0));if(amount<=0){this.log('護甲板已滿，補給留在原地。');return true;}p.plates=(p.plates||0)+amount;this.log(`修復護甲板 +${amount}（${p.plates}/${PLATE_CAPACITY}）。`);}
      else if(item.type==='grenade'){p.grenades+=item.amount||1;this.log('拾取手榴彈 +1。');}
      else if(item.type==='scrap'){const amount=Math.round((item.amount||15)*(1+p.scavenger*.5));p.scrap+=amount;this.log(`回收廢料 +${amount}。`);}
      else if(item.type==='lore'){if(!p.lore.includes(item.floor)){p.lore.push(item.floor);this.awardProtocol('lore',item.floor);}p.scrap+=10;this.log(`資料已解密：${LORE[item.floor-1]}`);}
      return false;
    });
  }
  addWeapon(index){const p=this.player;p.owned.push(index);p.ammo[index]=WEAPONS[index].mag;p.upgrades[index]=0;this.log(`取得武器：${WEAPONS[index].name}。在背包中裝備。`);}
  takeWeapon(index) {
    const item=this.items.find(o=>o.type==='weapon'&&o.weapon===Number(index)&&distance(o,this.player)<=1);
    if(!item)return this.fail('附近沒有這把武器。');
    if(this.player.owned.includes(item.weapon))return this.fail('已持有此武器。走上武器箱可拆解為廢料。');
    if(this.player.owned.length>=PACK_LIMIT)return this.fail('武器欄已滿（3 格）。先拆解一把武器。');
    this.addWeapon(item.weapon);this.items=this.items.filter(o=>o!==item);return true;
  }
  salvage(index) {
    const p=this.player;
    if(!p.owned.includes(index))return this.fail('背包裡沒有這把武器。');
    if(p.owned.length<=1)return this.fail('至少保留一把武器。');
    p[this.reserveKey(WEAPONS[index])]+=p.ammo[index];p.ammo[index]=0;p.owned=p.owned.filter(i=>i!==index);
    p.scrap+=20+(p.upgrades[index]||0)*10;p.upgrades[index]=0;p.stats.salvaged++;
    if(p.weapon===index)p.weapon=p.owned[0];this.log(`拆解${WEAPONS[index].name}，回收彈匣與廢料。`);return true;
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
    if(!['heal','ammo','grenade'].includes(option))return false;
    const cost=option==='grenade'?12:15;
    if(p.scrap<cost)return this.fail(`終端需要 ${cost} 廢料。`);
    if(option==='heal'&&p.hp===p.maxHp&&!p.poison)return this.fail('生命值已滿。');
    p.scrap-=cost;terminal.used=true;
    if(option==='heal'){p.hp=Math.min(p.maxHp,p.hp+60);p.poison=0;}
    if(option==='ammo'){p.reserve+=24;p.energy+=12;p.ordnance+=3;}
    if(option==='grenade')p.grenades+=2;
    this.log('終端補給完成。此終端已耗盡。');return true;
  }
  descend() {
    const p=this.player;
    if(distance(p,this.end)>1)return this.fail('需要靠近綠色電梯。');
    if(this.bossAlive)return this.fail('本層頭目仍存活，電梯鎖定。');
    this.awardProtocol('floor',this.floor);
    if(this.floor===FLOORS.length){this.awardProtocol('extraction','win');this.status='won';this.log('訊號已恢復。撤離成功。');return true;}
    this.floor++;this.turn++;p.reserve+=20;p.energy+=10;p.ordnance+=2;p.hp=Math.min(p.maxHp,p.hp+25);
    this.loadFloor();this.log(`進入${FLOORS[this.floor-1]}。生命 +25，補充各類備彈。`);return true;
  }
  choosePerk(id) {
    if(!this.pendingPerks||!PERKS.some(o=>o.id===id))return false;
    const p=this.player;
    if(id==='damage')p.bonus+=6;
    if(id==='health'){p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+40);}
    if(id==='armor')p.armor+=3;
    if(id==='med'){p.meds+=2;p.grenades+=2;p.reserve+=24;}
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
      if(![1,2,SAVE_VERSION].includes(version)||data?.status!=='playing'||!data.player||!Number.isInteger(data.floor)||data.floor<1||data.floor>FLOORS.length)return null;
      if(!Number.isInteger(data.seed)||data.seed<0||!Number.isInteger(data.turn)||data.turn<1)return null;
      if(!Array.isArray(data.grid)||data.grid.length!==SIZE||data.grid.some(row=>!Array.isArray(row)||row.length!==SIZE))return null;
      if(!Array.isArray(data.enemies)||data.enemies.some(e=>!ENEMY_TYPES[e.type]||!Number.isFinite(e.hp)))return null;
      if(!Array.isArray(data.props)||!Array.isArray(data.items))return null;
      const defaults=freshPlayer(),p={...defaults,...data.player};
      p.plates=data.player.plates??0;if(!Number.isInteger(p.plates)||p.plates<0||p.plates>PLATE_CAPACITY)return null;
      if(!Number.isInteger(p.x)||!Number.isInteger(p.y)||data.grid[p.y]?.[p.x]!==1||!Number.isFinite(p.hp)||p.hp<=0)return null;
      p.ammo=WEAPONS.map((_,i)=>data.player.ammo?.[i]??defaults.ammo[i]);
      p.upgrades=WEAPONS.map((_,i)=>data.player.upgrades?.[i]??0);p.stats={...defaults.stats,...p.stats};
      if(!p.owned.includes(p.weapon)||p.owned.some(i=>!WEAPONS[i]))return null;
      if(p.ammo.some(n=>!Number.isInteger(n)||n<0)||p.upgrades.some(n=>!Number.isInteger(n)||n<0||n>3))return null;
      if(!Array.isArray(p.lore)||p.lore.some(n=>!Number.isInteger(n)||n<1||n>FLOORS.length))return null;
      const g=Object.assign(Object.create(Game.prototype),data,{player:p,effects:[],hazards:data.hazards||[],marks:data.marks||[]});
      g.runId=typeof data.runId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(data.runId)?data.runId:`legacy-${data.seed}`;
      if(['__proto__','constructor','prototype'].includes(g.runId))return null;
      g.protocol=data.protocol??{earned:0,events:[]};g.unlockedWeapons=Array.isArray(data.unlockedWeapons)?data.unlockedWeapons.filter(x=>typeof x==='string'):[];
      if(!Number.isSafeInteger(g.protocol.earned)||g.protocol.earned<0||g.protocol.earned>1000000||!Array.isArray(g.protocol.events)||g.protocol.events.length>128||g.protocol.events.some(x=>typeof x!=='string'))return null;
      g.rng=random(rngState??g.seed+g.turn*13);
      if(version===1){g.props=g.props.map((o,i)=>({...o,id:o.id||`legacy-${i}`,type:o.type==='crate'?'cover':o.type,...(o.type==='crate'?{hp:65,maxHp:65}:{})}));for(const e of g.enemies)if(e.type==='boss'&&g.floor===3)e.type='warden';g.log('存檔已升級：六層設施、背包與手榴彈現已可用。');}
      if(version<3){p.moved=false;for(const e of g.enemies)e.moved=false;g.log('戰術更新：牆角探身、移動閃避與命中率已啟用。新地圖從下一層開始。');}
      g.reveal();return g;
    }catch{return null;}
  }
}
