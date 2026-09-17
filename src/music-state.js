// Which music plays (3.117.0, user decisions; docs/AUDIO.md). Pure state, kept in the controller and never saved.
//  - Before deployment (title, deploy, settings and records opened from the title, the result screen): the menu theme.
//  - In a facility: the floor's faction music, exploring by default.
//  - Combat starts when an enemy calls an engagement line the player sees or hears, and ends after ten turns in a row
//    with no enemy in view. Nothing else starts it, so music never tells the player about an enemy they could not know of.
//  - Kill house counts as a human facility; so does the mixed legacy facility, which has no music of its own.
export const MUSIC_TUNING=Object.freeze({quietTurns:10});
export const MUSIC_FACTIONS=Object.freeze(['loyalist','rebel','swarm']);
// Engagement lines are the danger callouts: attack, aim, grenade and bombard. A civilian's scream is not an engagement,
// and spotting or losing someone is perception, not combat.
export const engagementHeard=(effects=[])=>effects.some(e=>e.type==='callout'&&e.category==='danger'&&e.cue!=='scream');
export const musicFaction=({simulation=false,faction}={})=>simulation?'loyalist':MUSIC_FACTIONS.includes(faction)?faction:'loyalist';
export const freshCombat=()=>({combat:false,quiet:0,lastTurn:null});
// `turn` is the game turn after an action and `enemiesInView` the combatants the player can see then. An action that
// takes several turns counts all of them.
export function stepCombat(state,{engaged=false,turn,enemiesInView=0}={}){
  let {combat,quiet,lastTurn}=state;
  if(engaged){combat=true;quiet=0;}
  if(Number.isInteger(turn)){
    const passed=lastTurn===null?0:Math.max(0,turn-lastTurn);
    quiet=enemiesInView>0?0:engaged?0:quiet+passed;
    if(combat&&quiet>=MUSIC_TUNING.quietTurns){combat=false;quiet=0;}
    lastTurn=turn;
  }
  return {combat,quiet,lastTurn};
}
export function musicTrack({menu,playing,simulation=false,faction,combat=false}){
  if(menu)return 'menu';
  if(!playing)return null;
  return `${musicFaction({simulation,faction})}-${combat?'combat':'explore'}`;
}
