// Moving, aiming and acting on the field: the aim modes (throw, place, rope, flare, blind fire, suppression, pet,
// drone, cover), fire, interact and its choices, skill, grenade and item buttons, targeting, zoom and the key actions.
// Part of the browser controller (src/controller.js, split by topic in 3.206.3). Only declarations live here; the
// controller keeps the run's state, the event listeners and everything that runs at start-up. Its state is imported
// (live bindings, read-only); a change to it goes through the setter the controller exports for it.
import {t} from './i18n.js';
import {availableCharacters} from './unlock-catalog.js';
import {profile,write} from './storage.js';
import {operatorRecoveredMarkup} from './unlock-ui.js';
import {isNoncombatant} from './enemy-data.js';
import {droneCells} from './allies.js';
import {suppressivePreview} from './suppressive-fire.js';
import {BLIND_TUNING,blindReason} from './blind-fire.js';
import {LIGHT_TUNING} from './lighting.js';
import {terminalRemaining} from './terminal.js';
import {PREPARED_CATALOG,preparedEntry} from './prepared.js';
import {barrierFace,isBarrier} from './barriers.js';
import {deployCoverReason,distance,isSimulation} from './engine.js';
import {exitStep} from './killhouse-ui.js';
import {courseActive} from './course.js';
import {FLARE_TUNING,flareReason} from './flares.js';
import {DECOY_TUNING,MINE_TUNING,placeStart} from './field-gear.js';
import {LINE_TUNING} from './lines.js';
import {hookBladeFire} from './melee-ui.js';
import {$,act,autoRetarget,game,modal,persist,playback,renderer,sayLine,skipEnabled} from './controller.js';
import {ending} from './controller-comms.js';
import {drawOperatorSprites} from './controller-deploy.js';
import {notify,slotLabel,update} from './controller-hud.js';
import {deployLine,showInventory,showTerminal,showWorkshop} from './controller-pack.js';
import {showMap,showResult} from './controller-screens.js';
export function move(dx,dy){if(renderer.mode==='deploy'){act('deployCover',[dx,dy]);return;}if(renderer.mode==='launch'||renderer.mode==='rope'){const from=renderer.aim||game.player;setAim({x:from.x+dx,y:from.y+dy});return;}if(renderer.mode==='blind'){const from=renderer.aim||game.player;setBlindAim({x:from.x+dx,y:from.y+dy});return;}if(renderer.mode==='pet'){setPetAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='drone'){setDroneAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});return;}if(renderer.mode==='grenade'||renderer.mode==='flare'||renderer.mode==='place'){const pos={x:renderer.aim.x+dx,y:renderer.aim.y+dy};setAim(pos);}else if(renderer.mode==='suppress'){setSuppressAim({x:renderer.aim.x+dx,y:renderer.aim.y+dy});}else act('move',[dx,dy]);}
export function cancelAim(){renderer.mode=null;renderer.aim=null;updateAim();}
// 3.151.0 blind fire (src/blind-fire.js): tapping a tile you cannot see into, in range with a clear shot, aims a blind
// shot like the launcher — 互動 fires, 開火 cancels, the pad moves the aim.
const BLIND_HINT=`${t('controller.blindHint',{penalty:BLIND_TUNING.penalty})}`;
export function startBlindAim(pos){renderer.mode='blind';renderer.aim={x:pos.x,y:pos.y};updateAim();notify(BLIND_HINT);}
export function setBlindAim(pos){const reason=blindReason(game,pos);if(reason){notify(reason+t('controller.period'));return;}renderer.aim={x:pos.x,y:pos.y};updateAim();}
// Suppressive fire aims an area like a grenade, but range comes from the weapon and validity from suppressivePreview (3.74.1).
function startSuppressAim(){const p=game.player,reason=suppressivePreview(game,{x:p.x,y:p.y}).reason;if(reason){notify(reason);return;}const pick=[game.targeted,...game.visibleEnemies].find(e=>e&&game.enemies.includes(e)&&!suppressivePreview(game,{x:e.x,y:e.y}).reason);renderer.mode='suppress';renderer.aim=pick?{x:pick.x,y:pick.y}:{x:p.x,y:p.y};notify(`${t('controller.suppressHint',{range:game.weapon.range})}`);updateAim();}
export function setSuppressAim(pos){const reason=suppressivePreview(game,pos).reason;if(reason){notify(reason);return;}renderer.aim=pos;updateAim();}
export function setAim(pos){const launch=renderer.mode==='launch'||renderer.mode==='rope',placing=renderer.mode==='place',range=renderer.mode==='rope'?LINE_TUNING.range:launch?game.weapon.range:placing?placeRange():5;if(distance(pos,game.player)<=range&&game.grid[pos.y]?.[pos.x]===1&&game.visible(pos)){renderer.aim=pos;updateAim();}else notify(launch||placing?`${t('controller.landingRange',{range})}`:t('controller.throwRange'));}
const placeRange=()=>renderer.placeItem==='mine'?MINE_TUNING.range:renderer.placeItem==='glowstick'?LIGHT_TUNING.glowstickRange:DECOY_TUNING.range;
// 3.111.0 (user request): a point-target launcher is aimed like a thrown grenade — pick a tile, confirm with 互動 —
// so the fire key opens that mode instead of shooting the locked enemy. Pressing fire again cancels.
export function fireWeapon(){
  if(renderer.mode==='launch'||renderer.mode==='blind'){cancelAim();return;}
  if(!game.weapon.pointTarget){act('fire');return;}
  if(game.player.ammo[game.player.weapon]<=0){sayLine(game.emptyCue());return;}
  const p=game.player,locked=game.targeted,face=isBarrier(locked)?barrierFace(locked,p):locked;
  const start=[face,...game.visibleEnemies].find(o=>o&&distance(o,p)<=game.weapon.range&&game.visible(o));
  renderer.mode='launch';renderer.aim=start?{x:start.x,y:start.y}:null;updateAim();
  notify(start?t('controller.launchHintPad'):t('controller.launchHint'));
}
export const operatorReady=view=>!isSimulation(view)&&view.status==='playing'&&!!view.operatorCorpse&&!view.operatorCorpse.recovered&&view.canTouch(view.operatorCorpse);
function interactions(view=renderer.game){return [...view.nearbyObjectives.map(o=>({label:t('controller.act.recover'),action:`objective:${o.id}`})),...view.nearbyContainers.map(c=>({label:`${t('controller.act.open',{v:view.containerLabel(c)})}`,action:`case:${c.id}`})),...view.nearbyDoors.map(b=>({label:view.doorLabel(b),action:`door:${b.id}`})),...(view.groundWeapon?[{label:t('controller.act.pickup'),action:'bag'}]:[]),...(view.nearbyTerminal?[{label:`${t('controller.act.terminal',{v:terminalRemaining(view.nearbyTerminal)})}`,action:'terminal'}]:[]),...(operatorReady(view)?[{label:t('controller.act.recoverId'),action:'operator'}]:[]),...(view.canTouch(view.exitPoint)&&(!isSimulation(view)||courseActive(view)||exitStep(view))?[{label:view.exitBlocked?t('controller.act.elevatorLocked'):view.exitLabel+(view.allyTravelSummary?' · '+view.allyTravelSummary:''),action:isSimulation(view)&&!courseActive(view)?'exitStep':'descend'}]:[])];}
export function updateAim(view=renderer.game){const blinding=renderer.mode==='blind',launching=renderer.mode==='launch'||blinding,deploying=renderer.mode==='deploy',commanding=renderer.mode==='pet'||renderer.mode==='drone',aiming=renderer.mode==='grenade',roping=renderer.mode==='rope',placing=renderer.mode==='place',flaring=renderer.mode==='flare'||roping||placing,suppressing=renderer.mode==='suppress',preview=suppressing&&renderer.aim?suppressivePreview(view,renderer.aim):null,b=$('#interact'),options=interactions(view);
  const entry=preparedEntry(view.player,'grenade');
  $('#grenade-label').textContent=aiming?t('controller.grenade.cancel'):entry?`${entry.short} ${(game?.player||view.player)[entry.resource]}`:t('controller.grenade.notReady');
  $('[data-action="grenade"]').classList.toggle('aiming',aiming);
  b.disabled=(Boolean(playback)&&!skipEnabled())||(view.status==='playing'&&!aiming&&!flaring&&!launching&&!commanding&&!suppressing&&!deploying&&!options.length)||Boolean(preview?.reason);
  b.querySelector('strong').textContent=view.status!=='playing'?t('controller.interact.result'):blinding?t('controller.interact.confirmBlind'):launching?t(view.weapon?.flame?'controller.interact.confirmSpray':'controller.interact.confirmLaunch'):deploying?t('controller.interact.cancelSetup'):commanding?(renderer.mode==='drone'?t('controller.interact.confirmDeploy'):t('controller.interact.confirmCommand')):aiming?t('controller.interact.confirmThrow'):roping?t('controller.interact.confirmLine'):placing?(renderer.placeItem==='mine'?t('controller.interact.confirmMine'):t('controller.interact.confirmThrow')):flaring?t('controller.interact.confirmFlare'):suppressing?`${t('controller.interact.confirmSuppress',{v:preview?.rounds??0})}`:options.length>1?t('controller.interact.label'):options[0]?.label||t('controller.interact.label');
  b.classList.toggle('aiming',aiming||flaring||launching||commanding||suppressing||deploying);
  const fire=$('[data-action="fire"]');
  if(fire){fire.classList.toggle('aiming',launching);fire.querySelector('strong').textContent=blinding?t('controller.fire.cancelBlind'):launching?t('controller.fire.cancelLaunch'):hookBladeFire(view)?t('controller.fire.hook'):view.weapon?.melee?t('controller.fire.punch'):t('controller.fire.label');}$('[data-action="skill"]')?.classList.toggle('aiming',suppressing);b.title=view.allyTravelSummary||'';
  const item=$('[data-action="item"]');
  if(item){item.classList.toggle('aiming',deploying||flaring);item.querySelector('strong').textContent=deploying?t('controller.interact.cancelSetup'):roping?t('controller.item.cancelLine'):placing?t('controller.item.cancel'):flaring?t('controller.item.cancelFlare'):slotLabel(view,'item');}
  for(const key of ['0,-1','0,1','-1,0','1,0'])$(`[data-move="${key}"]`)?.classList.toggle('aiming',deploying);
}
export function interact(){if(renderer.mode==='deploy'){cancelAim();return;}if(renderer.mode==='blind'){const reason=blindReason(game,renderer.aim);if(reason){notify(reason+t('controller.period'));return;}act('blindFire',renderer.aim);return;}if(renderer.mode==='launch'){if(renderer.aim)act('launch',renderer.aim);else notify(t('controller.pickSpotFirst'));return;}if(renderer.mode==='pet'){act('commandPet',renderer.aim);return;}if(renderer.mode==='drone'){act('deployUnit',{line:deployLine,x:renderer.aim.x,y:renderer.aim.y});return;}if(game.status!=='playing'){if(!ending())showResult();return;}if(renderer.mode==='grenade'){act('usePrepared',{category:'grenade',target:renderer.aim});return;}if(renderer.mode==='flare'){act('flare',renderer.aim);return;}if(renderer.mode==='place'){act(renderer.placeItem,renderer.aim);return;}if(renderer.mode==='rope'){act('rope',{...renderer.aim,item:renderer.ropeItem});return;}if(renderer.mode==='suppress'){const turn=game.turn;act('usePrepared',{category:'skill',target:renderer.aim});if(game.turn!==turn)cancelAim();return;}
  const options=interactions();if(options.length>1){modal(t('controller.interact.title')+options.map(o=>`<button class="modal-button secondary" data-context="${o.action}">${o.label}</button>`).join('')+t('controller.interact.back'));return;}
  if(options[0]?.action.startsWith('objective:'))act('recoverObjective',options[0].action.slice(10));
  else if(options[0]?.action.startsWith('case:'))act('openContainer',options[0].action.slice(5));
  else if(options[0]?.action.startsWith('door:')){const b=game.nearbyDoors.find(b=>b.id===options[0].action.slice(5));if(b)act('door',{id:b.id,open:!b.open});}
  else if(options[0]?.action==='bag')showInventory('weapon');else if(options[0]?.action==='terminal')showTerminal();else if(options[0]?.action==='descend')act('interact');else if(options[0]?.action==='exitStep')act('move',exitStep(game));else if(options[0]?.action==='operator')recoverCorpse();
}
export function setPetAim(pos){if(game.seen[pos.y]?.[pos.x]&&game.passable(pos.x,pos.y)&&distance(pos,game.player)<=6){renderer.aim=pos;updateAim();}else notify(t('controller.commandRange'));}
// Drone skills that put a chassis down open a placement cursor; the default tile faces the way the player looks.
export function setDroneAim(pos){if(droneCells(game).some(q=>q.x===pos.x&&q.y===pos.y)){renderer.aim={x:pos.x,y:pos.y};updateAim();}else notify(t('controller.deployRange'));}
export function skill(){if(renderer.mode==='pet'||renderer.mode==='drone'||renderer.mode==='suppress'){cancelAim();return;}const id=game.player.prepared.skill;if(!id){showInventory('skill',t('controller.skill.readyOne'));return;}if(id==='suppressive_fire'){startSuppressAim();return;}if(id==='pet_command'&&game.activeAllies.some(a=>a.kind==='pet')){renderer.mode='pet';renderer.aim={x:game.player.x,y:game.player.y};notify(t('controller.skill.commandHint'));updateAim();}else if(id==='workshop')showWorkshop();else act('usePrepared',{category:'skill'});}
export function grenade(){if(renderer.mode==='grenade'){cancelAim();return;}const entry=preparedEntry(game.player,'grenade');if(!entry){showInventory('grenade',t('controller.grenade.readyOne'));return;}if(game.player[entry.resource]<=0){sayLine('empty',{item:entry.name});return;}renderer.mode='grenade';const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,game.player):locked;renderer.aim=e&&distance(e,game.player)<=5?{x:e.x,y:e.y}:{x:game.player.x,y:game.player.y};updateAim();}
// With nothing prepared, the item button opens the item tab instead of refusing (3.97.0).
// 3.108.0: the slot is a 生效欄 now. Something in it with no action is worn, not held, so the button opens the pack
// instead — and the long press still does, which is why that shortcut had to stay.
export function useItem(){if(renderer.mode==='deploy'||renderer.mode==='flare'||renderer.mode==='rope'||renderer.mode==='place'){cancelAim();return;}
  const entry=preparedEntry(game.player,'item');
  if(!entry){showInventory('item',t('controller.item.readyOne'));return;}
  if(!entry.action){showInventory('item',`${t('controller.item.worn',{entryName:entry.name})}`);return;}
  if(entry.aim==='side'){startDeploy();return;}
  if(entry.aim==='throw'){startThrowAim(game.player.prepared.item);return;}
  act('usePrepared',{category:'item'});}
// 3.135.0: a grapple line is aimed like a flare — pick the landing tile, confirm with 互動, press 道具 again to cancel.
export function startThrowAim(id){const action=PREPARED_CATALOG.item[id]?.action;if(action==='rope')startRopeAim(id);else if(action==='decoy'||action==='mine'||action==='glowstick')startPlaceAim(action);else startFlareAim();}
// 3.144.0 (src/field-gear.js): a decoy or a mine is placed like a flare — pick the tile, confirm with 互動, press 道具 to cancel.
function startPlaceAim(id){
  const p=game.player,entry=PREPARED_CATALOG.item[id];if(!(p[entry.resource]>0)){sayLine('empty',{item:entry.name});return;}
  // 3.148.1 (user report): the pad and swipes move this aim like a flare's, and it starts on a tile that would be accepted.
  renderer.mode='place';renderer.placeItem=id;renderer.aim=placeStart(game,id);updateAim();
  notify(id==='mine'?`${t('controller.item.mineHint',{range:MINE_TUNING.range})}`:id==='glowstick'?t('controller.item.glowstickHint',{range:LIGHT_TUNING.glowstickRange}):`${t('controller.item.decoyHint',{range:DECOY_TUNING.range})}`);
}
function startRopeAim(id){
  const p=game.player,entry=PREPARED_CATALOG.item[id];if(!(p[entry.resource]>0)){sayLine('empty',{item:entry.name});return;}
  renderer.mode='rope';renderer.ropeItem=id;renderer.aim={x:p.x,y:p.y};updateAim();
  notify(`${t('controller.item.lineHint',{range:LINE_TUNING.range,v:entry.action==='rope'&&PREPARED_CATALOG.item[id].resource==='escapeLines'?t('controller.item.free'):''})}`);
}
// 3.109.0 (user request): carried cover picks its side with the direction keys, so putting it behind you costs the
// same one turn as putting it in front — no turning, and no second tap to confirm.
// 3.123.0: a flare is an item aimed like a throwable: pick a floor tile, confirm with 互動, press 道具 again to cancel.
function startFlareAim(){
  const p=game.player;if(!(p.flares>0)){sayLine('empty',{item:t('controller.item.flareName')});return;}
  const locked=game.targeted,e=isBarrier(locked)?barrierFace(locked,p):locked;
  renderer.mode='flare';renderer.aim=e&&!flareReason(game,{x:e.x,y:e.y})?{x:e.x,y:e.y}:{x:p.x,y:p.y};updateAim();
  notify(`${t('controller.item.flareHint',{range:FLARE_TUNING.range})}`);
}
export function startDeploy(){
  // Refuse up front only when no side would work at all; the reason of the first blocked side explains why.
  const sides=[[0,-1],[0,1],[-1,0],[1,0]].map(d=>deployCoverReason(game,d));
  if(sides.every(Boolean)){notify(sides[0]+t('controller.period'));return;}
  renderer.mode='deploy';renderer.aim=null;updateAim();
  notify(t('controller.item.barricadeHint'));
}
export function toggleTargeting(){renderer.targetingEnabled=!renderer.targetingEnabled;write('ash-targeting',renderer.targetingEnabled?'on':'off');update();}
// 3.165.0 auto-retarget: the locked enemy is out of range, so the lock goes to the nearest enemy in range with a clear shot
// (then the nearest in range at all). A partition or barrel you locked on purpose is left alone, and so is an enemy you
// cannot swap for anything better. The lock is presentation state the rules already let you change for free (cycleTarget).
export function retarget(){
  if(!autoRetarget||game.status!=='playing')return;
  const p=game.player,w=game.weapon,locked=game.enemies.find(e=>e.id===game.target&&e.hp>0);if(!locked||w.melee||distance(p,locked)<=w.range)return;
  const inRange=game.visibleEnemies.filter(e=>e.hp>0&&!isNoncombatant(e)&&distance(p,e)<=w.range).sort((a,b)=>distance(p,a)-distance(p,b));
  const pick=inRange.find(e=>game.shotClear(p,e))||inRange[0];if(pick)game.target=pick.id;
}
export function cycleTarget(){const list=game.visibleEnemies;if(!list.length){notify(t('controller.noVisibleEnemies'));return;}game.target=list[(list.findIndex(x=>x.id===game.target)+1)%list.length].id;update();}
// The nine-cell layout moves the two buttons rather than duplicating them, so every [data-action] lookup, handler and
// disabled state keeps working; classic puts reload back after fire and interact last, which is the markup order.
// Keyboard (3.121.0). Every command runs the same function its button does.
export const HOTKEY_RUN={moveUp:()=>move(0,-1),moveLeft:()=>move(-1,0),moveDown:()=>move(0,1),moveRight:()=>move(1,0),wait:()=>act('wait'),
  fire:()=>fireWeapon(),reload:()=>act('reload'),grenade:()=>grenade(),item:()=>useItem(),skill:()=>{if(!$('[data-action="skill"]')?.disabled)skill();},interact:()=>interact(),
  // 3.162.0 (user decision): a button straight to the weapon tab — the bag button opens the last tab, and switching
  // weapons is frequent. No gesture switches weapons directly: that costs a turn, and the tab shows the cost.
  cycleTarget:()=>cycleTarget(),toggleTargeting:()=>toggleTargeting(),flashlight:()=>act('flashlight'),bag:()=>showInventory(),weapons:()=>showInventory('weapon'),map:()=>showMap(),center:()=>centerCamera(),zoomIn:()=>zoomBy(.15),zoomOut:()=>zoomBy(-.15)};
export function zoomBy(step){renderer.zoom=Math.max(.65,Math.min(1.6,renderer.zoom+step));renderer.resize();}
export function centerCamera(){renderer.zoom=1;renderer.resize();renderer.camera={x:game.player.x,y:game.player.y};}
export function recoverCorpse(){if(!operatorReady(game))return;const corpse=game.operatorCorpse,owned=availableCharacters(profile()).includes(corpse.character);
  if(!game.recoverOperator()){update();return;}
  persist();update();modal(operatorRecoveredMarkup(corpse.character,{newly:!owned}),true);drawOperatorSprites();}
