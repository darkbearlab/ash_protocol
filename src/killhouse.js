import {t} from './i18n.js';
import {Game} from './game.js';
import {killhouseMap} from './killhouse-maps.js';
import {simulationConfig,simulationDrops,simulationUpgrades} from './killhouse-policy.js';
import {roomAt} from './map-geometry.js';
import {purgeReview,notePurgeDeparture} from './purge-review.js';
import {departAllies,arriveAllies} from './allies.js';
import {pickPortrait} from './portraits.js';
import {startCourse,courseBefore,courseAfter,courseExitBlocked,courseDoorLocked,courseDoorFor} from './course.js';
export class KillhouseGame extends Game {
 constructor({mode='tutorial',seed=Date.now()%1000000,character='soldier',portrait=pickPortrait(),options={}}={}){
  const simulation=simulationConfig(mode,options);super(mode==='tutorial'?1:seed,[],0,mode==='tutorial'?'soldier':character,portrait,'extraction',{facilityFaction:'loyalist',simulation});
  if(mode==='tutorial')this.simulation.battleStartTurn=this.turn;
  this.logs=[];this.log(t('killhouse.started'));this.observeRoom();
  if(mode==='tutorial'&&simulation.options.tutorialCourse)startCourse(this);
 }
 generateFloor(){return killhouseMap(this.seed,this.simulation.phase,this.player.character,this.simulation.options);}
 registerWeapon(item){return super.registerWeapon(item,false);}
 awardProtocol(){}
 choosePerk(id){return simulationUpgrades(this)&&super.choosePerk(id);}
 get perkChoices(){return simulationUpgrades(this)?super.perkChoices:[];}
 get exitKind(){return this.simulation.phase==='armory'?'enter':'extract';}
 get exitLabel(){return t(`missions.exit.${this.exitKind}`);}
 // The course's elevator stays locked until every target is down; it is used from beside it like a campaign one.
 get exitBlocked(){return this.course?courseExitBlocked(this):'';}
 // The course keeps each zone's door shut until its lesson is done: nobody opens it, and the player is told why.
 setDoor(b,open){return open&&courseDoorLocked(this,b)?false:super.setDoor(b,open);}
 validateAction(type,arg){return this.course&&courseDoorLocked(this,courseDoorFor(this,type,arg))?this.fail(t('course.doorLocked')):super.validateAction(type,arg);}
 get missionSummary(){return `KILL HOUSE · ${this.simulation.phase}`;}
 // The course's one supply box opens like a campaign one (its lesson); other simulation boxes stay shut.
 openContainer(arg){return simulationDrops(this)||this.course?super.openContainer(arg):this.fail(t('killhouse.noCrates'));}
 useTerminal(arg){return simulationDrops(this)?super.useTerminal(arg):this.fail(t('killhouse.noTerminals'));}
 observeRoom(){const s=this.simulation,index=roomAt(this.rooms,this.player),id=`${this.floor}:${index}`;if(index<0||s.entered.includes(id))return;
  s.entered.push(id);s.roomEvents.push({type:'roomEntered',floor:this.floor,roomId:index,firstRoom:index===this.startRoom,phase:s.phase,recipe:this.killhouseRecipe,turn:this.turn});
 }
 takeRoomEvents(){return this.simulation.roomEvents.splice(0);}
 executePlayer(type,arg){const success=super.executePlayer(type,arg);if(success){this.observeRoom();if(!this.course&&type==='move'&&this.player.x===this.end.x&&this.player.y===this.end.y)this.descend();}return success;}
 action(type,arg){
  const before=this.course?courseBefore(this):null,success=super.action(type,arg);this.observeRoom();
  if(this.course)courseAfter(this,type,success,before,arg);
  else if(success&&this.status==='playing'&&this.player.x===this.end.x&&this.player.y===this.end.y)this.descend();return success;
 }
 descend(){
  if(this.status!=='playing'||this.player.hp<=0)return false;
  if(this.course){
   if(!this.canTouch(this.exitPoint))return this.fail(t('game.needElevator'));if(this.exitBlocked)return this.fail(this.exitBlocked);
   this.status='won';this.log(t('killhouse.over'));return true;
  }
  if(this.player.x!==this.end.x||this.player.y!==this.end.y)return this.fail(t('killhouse.stepIn'));
  if(this.simulation.phase==='armory'){
   notePurgeDeparture(this);const companions=departAllies(this);this.floor=2;this.simulation.phase='combat';this.simulation.battleStartTurn=this.turn;this.loadFloor();arriveAllies(this,companions);this.reveal();this.observeRoom();
  }else {this.status='won';this.log(t('killhouse.over'));}return true;
 }
 get simulationResult(){const review=purgeReview(this);return {...review,turns:Math.max(0,(review?.turns??this.turn)-(this.simulation.battleStartTurn??this.turn)),mode:this.simulation.mode,outcome:this.status,character:this.player.character,recipe:this.killhouseRecipe,deathDestination:this.simulation.options.tutorialDeath,scoreScope:this.simulation.options.scoreScope};}
 // Simulations are deliberately volatile. Never produce a campaign-compatible save.
 serialize(){throw Error(t('killhouse.noSave'));}
}
export const createKillhouse=options=>new KillhouseGame(options);
