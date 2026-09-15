import {Game} from './game.js';
import {killhouseMap} from './killhouse-maps.js';
import {simulationConfig,simulationDrops,simulationUpgrades} from './killhouse-policy.js';
import {roomAt} from './map-geometry.js';
import {purgeReview,notePurgeDeparture} from './purge-review.js';
import {departAllies,arriveAllies} from './allies.js';
import {pickPortrait} from './portraits.js';
export class KillhouseGame extends Game {
 constructor({mode='tutorial',seed=Date.now()%1000000,character='soldier',portrait=pickPortrait(),options={}}={}){
  const simulation=simulationConfig(mode,options);super(mode==='tutorial'?1:seed,[],0,mode==='tutorial'?'soldier':character,portrait,'extraction',{facilityFaction:'loyalist',simulation});
  if(mode==='tutorial')this.simulation.battleStartTurn=this.turn;
  this.logs=[];this.log('KILL HOUSE 模擬已啟動。');this.observeRoom();
 }
 generateFloor(){return killhouseMap(this.seed,this.simulation.phase,this.player.character,this.simulation.options);}
 registerWeapon(item){return super.registerWeapon(item,false);}
 awardProtocol(){}
 choosePerk(id){return simulationUpgrades(this)&&super.choosePerk(id);}
 get perkChoices(){return simulationUpgrades(this)?super.perkChoices:[];}
 get exitLabel(){return this.simulation.phase==='armory'?'進入訓練場':'撤離';}
 get exitBlocked(){return '';}
 get missionSummary(){return `KILL HOUSE · ${this.simulation.phase}`;}
 openContainer(arg){return simulationDrops(this)?super.openContainer(arg):this.fail('模擬戰場不提供箱內補給。');}
 useTerminal(arg){return simulationDrops(this)?super.useTerminal(arg):this.fail('模擬戰場不提供終端補給。');}
 observeRoom(){const s=this.simulation,index=roomAt(this.rooms,this.player),id=`${this.floor}:${index}`;if(index<0||s.entered.includes(id))return;
  s.entered.push(id);s.roomEvents.push({type:'roomEntered',floor:this.floor,roomId:index,firstRoom:index===this.startRoom,phase:s.phase,recipe:this.killhouseRecipe,turn:this.turn});
 }
 takeRoomEvents(){return this.simulation.roomEvents.splice(0);}
 executePlayer(type,arg){const success=super.executePlayer(type,arg);if(success){this.observeRoom();if(type==='move'&&this.player.x===this.end.x&&this.player.y===this.end.y)this.descend();}return success;}
 action(type,arg){const success=super.action(type,arg);this.observeRoom();if(success&&this.status==='playing'&&this.player.x===this.end.x&&this.player.y===this.end.y)this.descend();return success;}
 descend(){
  if(this.status!=='playing'||this.player.hp<=0)return false;
  if(this.player.x!==this.end.x||this.player.y!==this.end.y)return this.fail('走進電梯格才能離開。');
  if(this.simulation.phase==='armory'){
   notePurgeDeparture(this);const companions=departAllies(this);this.floor=2;this.simulation.phase='combat';this.simulation.battleStartTurn=this.turn;this.loadFloor();arriveAllies(this,companions);this.reveal();this.observeRoom();
  }else {this.status='won';this.log('模擬結束。');}return true;
 }
 get simulationResult(){const review=purgeReview(this);return {...review,turns:Math.max(0,(review?.turns??this.turn)-(this.simulation.battleStartTurn??this.turn)),mode:this.simulation.mode,outcome:this.status,character:this.player.character,recipe:this.killhouseRecipe,deathDestination:this.simulation.options.tutorialDeath,scoreScope:this.simulation.options.scoreScope};}
 // Simulations are deliberately volatile. Never produce a campaign-compatible save.
 serialize(){throw Error('Kill house 不保存中途進度。');}
}
export const createKillhouse=options=>new KillhouseGame(options);
