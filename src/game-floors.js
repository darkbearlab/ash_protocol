// Floors and progress (3.206.3 split): generating and loading a floor, descending, levels and perks, protocol
// points and the fallen operative.
// Methods of Game (src/game.js), which copies them onto Game.prototype (src/mixin.js, 3.206.3): `this` is the game.
import {t} from './i18n.js';
import {endlessFaction,floorCorpseNote,populateRunUnlocks,recoverOperator} from './run-unlocks.js';
import {isSurvival,setupSurvival} from './survival.js';
import {postSquads} from './squad.js';
import {recruitConscripts} from './rebels.js';
import {clearPoison} from './poison.js';
import {activeTrait,healActor,removeTraitSource} from './traits.js';
import {MAX_LEVEL,giveCapSupply,isEndless,perkLimit} from './endless.js';
import {MAP_FIELDS} from './map-geometry.js';
import {clearDesignation} from './loyalist-bosses.js';
import {applyPerk,eligiblePerks,ensurePerks,levelCost,recordPerkOffer} from './perks.js';
import {arriveAllies,departAllies} from './allies.js';
import {archiveFloor,arrivalCell,resumedFloor,scheduleRetreatWave} from './retreat.js';
import {endSkillEffects,skillActive} from './skills.js';
import {missionDefinition,missionDepth,prepareMission,returning} from './missions.js';
import {rigContainers} from './containers.js';
import {controlState} from './throwables.js';
import {floorVaultNote} from './vault.js';
import {notePurgeDeparture,registerPurgeFloor} from './purge-review.js';
import {SIZE,floorInfo} from './data.js';
import {PROTOCOL_REWARDS} from './progression.js';
import {generate} from './world.js';
export class GameFloors {
  generateFloor(){this.facilityFaction=endlessFaction(this);return generate(this.seed,this.floor,this.unlockedWeapons,this.difficultySpec,this.facilityFaction);}
  loadFloor() {
    endSkillEffects(this.player);this.sensorContacts=[];delete this.blindAftermath;this.shadowSteps=0;this.pursuit=0;this.player.vaultExposed=false;
    Object.assign(this,{swarmWaves:undefined,mapStyle:undefined,flares:[],glowsticks:[],gunFlashes:[],lamps:undefined,lightModel:undefined,vents:undefined,fires:undefined},Object.fromEntries(MAP_FIELDS.map(k=>[k,undefined])),this.generateFloor());for(const e of this.enemies)e.faction??=this.facilityFaction;this.mapGenerations=[...new Set([...(this.mapGenerations||[]),this.generation?.version||1])].sort((a,b)=>a-b);this.smoke=[];this.flares=[];this.decoy=null;this.mines=[];this.traces=[];this.reinforcements=[];this.player.control=controlState();
    for(const item of this.items)if(item.type==='weapon')this.registerWeapon(item,true);
    Object.assign(this.player,this.start);clearPoison(this.player);this.player.guard=false;this.player.moved=false;this.player.moveDelta=[0,0];this.player.fireChain=null;this.player.cornerExposure=null;this.player.tactics=null;this.player.focus=false;this.player.evasive=false;
    prepareMission(this);recruitConscripts(this);postSquads(this);rigContainers(this);populateRunUnlocks(this);if(isSurvival(this))setupSurvival(this);registerPurgeFloor(this);
    this.seen=Array.from({length:SIZE},()=>Array(SIZE).fill(false));this.target=null;this.reveal();floorVaultNote(this);floorCorpseNote(this);
  }
  // Experience into levels and picks (moved out of the kill code in 3.194.0 so the survival kit can grant levels too).
  settleLevels(){
    const p=this.player;
    while(p.level<MAX_LEVEL&&p.xp>=levelCost(this,p.level)){p.xp-=levelCost(this,p.level);p.level++;if(activeTrait(p,'tactical_supply')){this.log(t('game.tacticalSupply'));this.receiveGrenade('smoke',1);}if(this.perkPicks+this.pendingPerks<perkLimit(p.level))this.pendingPerks++;}
    while(p.level>=MAX_LEVEL&&p.xp>=MAX_LEVEL+2){p.xp-=MAX_LEVEL+2;giveCapSupply(this);}
  }
  recoverOperator(){return recoverOperator(this);}
  awardProtocol(type,id) {const event=`${type}:${id}`,amount=PROTOCOL_REWARDS[type];if(!amount||this.protocol.events.includes(event))return;this.protocol.events.push(event);this.protocol.earned+=amount;this.log(t('game.protocolEarned',{n:amount}));}
  descend(advanceTurn=true) {
    if(skillActive(this.player,'anchor'))return this.fail(t('game.anchoredNoElevator'),'anchored');
    const p=this.player;
    if(!this.canTouch(this.exitPoint))return this.fail(t('game.needElevator'));
    if(this.exitBlocked)return this.fail(this.exitBlocked);
    const next=this.floor-1,frame=returning(this)&&this.floor>1?this.floorStates[next]:null,arrival=frame&&arrivalCell(frame,this.allies.filter(a=>a.floor===next&&a.status==='active'));
    if(returning(this)&&this.floor>1&&!arrival)return this.fail(t('game.noSafeLanding'));
    this.awardProtocol('floor',this.floor);
    if((returning(this)&&this.floor===1)||(!isEndless(this)&&!missionDefinition(this).returnTrip&&this.floor===missionDepth(this))){this.awardProtocol('extraction','win');this.status='won';this.log(t('game.extracted',{summary:this.missionSummary}));return true;}
    notePurgeDeparture(this);this.shadowSteps=0;this.pursuit=0;this.decoy=null;this.mines=[];this.gunFlashes=[];p.lightLingers=false;for(const e of this.enemies)removeTraitSource(e,'skill:early_warning');clearDesignation(p);const companions=departAllies(this);
    if(returning(this)){
      if(advanceTurn)this.turn++;
      Object.assign(this,resumedFloor(frame,this.turn));delete this.floorStates[next];this.floor=next;
      Object.assign(p,arrival,{guard:false,focus:false,evasive:false,moved:false,moveDelta:[0,0],fireChain:null,cornerExposure:null,tactics:null});
      endSkillEffects(p);this.sensorContacts=[];delete this.blindAftermath;p.vaultExposed=false;this.target=null;arriveAllies(this,companions);scheduleRetreatWave(this);this.reveal();
      this.log(t('game.returnFloor',{floor:floorInfo(this.floor).name}));return true;
    }
    if(missionDefinition(this).returnTrip)this.floorStates[this.floor]=archiveFloor(this);
    this.floor++;if(advanceTurn)this.turn++;const recovered=healActor(p,25);
    this.loadFloor();arriveAllies(this,companions);this.reveal();this.supplyPack({rifle:60,pistol:48,shell:12,energy:15,ordnance:2});this.log(t('game.enterFloor',{floor:floorInfo(this.floor).name,hp:recovered}));return true;
  }
  choosePerk(id) {
    if(this.status!=='playing'||!this.pendingPerks||this.perkPicks>=perkLimit(this.player.level)||this.perkPicks+this.pendingPerks>perkLimit(this.player.level))return false;
    const offer=this.perkChoices.find(o=>o.id===id);
    if(!offer||!eligiblePerks(this).some(o=>o.id===id))return false;
    recordPerkOffer(this);applyPerk(this,offer);this.pendingPerks--;this.perkPicks++;this.perkDraft=null;ensurePerks(this);
    this.log(t('game.perkInstalled',{perk:offer.name}));return true;
  }
}
