import {t} from './i18n.js';
import {ballistic,lineCells} from './swarm-fields.js';
import {VENT_TUNING,VENT_KINDS,ventCells} from './vent-map.js';

// Smoke vents and the new clouds (3.202.0, user design 2026-09-29, docs/HAZARDS.md section 3). Placement is in
// src/vent-map.js; this is what a vent does in play.
// - The cycle, the same every time (user took Claude's suggestion): a round of warning (it hisses), two rounds spraying,
//   four rounds quiet. Worked out from the round and the vent's phase, never rolled.
// - It sprays its plus of five floor tiles, as one cloud in g.smoke that lasts the two rounds:
//   濃煙 dense smoke (plain smoke: blocks sight), 淡煙 light smoke `haze`, 蒸氣 steam, 毒氣 toxic gas (the spitter's mist).
// - 淡煙 and 蒸氣 never block sight; a shot or a beam whose line crosses them hits half as often, at full damage, whoever
//   fires it (user: only the hit chance). Steam also scalds whoever ends a round in it (VENT_TUNING.damage), flyers aside,
//   and the routes keep off it (src/hazard-paths.js).
export const HAZE_KINDS=Object.freeze(['haze','steam']);
export const ventStage=(v,turn)=>((turn+v.phase)%VENT_TUNING.period+VENT_TUNING.period)%VENT_TUNING.period;
export const ventWarning=(v,turn)=>ventStage(v,turn)===0;
export const ventSpraying=(v,turn)=>{const s=ventStage(v,turn);return s===1||s===2;};
export const ventName=kind=>t(`vents.kind.${kind}`);
const cloudsOf=(g,kinds)=>new Set((g.smoke||[]).filter(s=>kinds.includes(s.kind)).flatMap(s=>s.cells.map(q=>`${q.x},${q.y}`)));
export const inCloud=(g,kind,pos)=>cloudsOf(g,[kind]).has(`${pos.x},${pos.y}`);
// Steam rises in its first round and scalds in its second (its last): the warning plus the first round leave two actions
// to get out of the plus, where one step off the vent itself would still be inside it.
export const scalding=(g,pos)=>(g.smoke||[]).some(s=>s.kind==='steam'&&s.expires===g.turn&&s.cells.some(q=>q.x===pos.x&&q.y===pos.y));

// Start of a round (Game.action, beside the swarm's own field ticks): warn, or start spraying.
export function tickVents(g){
 for(const v of g.vents||[]){
  const stage=ventStage(v,g.turn);
  if(stage===0&&g.seen?.[v.y]?.[v.x]&&g.sight(g.player,v))g.log(t('vents.warning',{kind:ventName(v.kind)}));
  if(stage!==1)continue;
  const cells=ventCells(g.grid,v);if(!cells.length)continue;
  g.smoke=[...g.smoke,{...(v.kind==='smoke'?{}:{kind:v.kind}),cells,expires:g.turn+1}];
  g.effects.push({type:'pulse',from:{x:v.x,y:v.y},to:{x:v.x,y:v.y},radius:1,color:VENT_COLOR[v.kind]});
 }
}
export const VENT_COLOR=Object.freeze({smoke:'#b8c7d0',haze:'#d7e0e6',steam:'#e8f6fa',toxic:'#a9d24f'});

// A shot or a beam through light smoke or steam: half the hit chance (src/combat.js), damage untouched.
// 3.203.0 (docs/HAZARDS.md section 2): a burning tile smokes like light smoke; the fixed fire of floors 5-6 does not.
export function hazeShot(g,attacker,target,weapon){
 if(!attacker||!target||!ballistic(weapon))return false;
 const haze=cloudsOf(g,HAZE_KINDS);for(const f of g.fires||[])haze.add(`${f.x},${f.y}`);if(!haze.size)return false;
 return lineCells(attacker,target).some(q=>haze.has(`${q.x},${q.y}`));
}

export function validVents(g){
 const frames=[g,...Object.values(g.floorStates||{})];
 for(const f of frames){
  if(f.vents===undefined)continue;
  if(!Array.isArray(f.vents)||f.vents.length>2)return false;
  const ids=new Set();
  for(const v of f.vents){
   if(!v||typeof v.id!=='string'||ids.has(v.id)||!VENT_KINDS.includes(v.kind)||!Number.isInteger(v.phase)||v.phase<0||v.phase>=VENT_TUNING.period||!Number.isInteger(v.x)||!Number.isInteger(v.y)||f.grid?.[v.y]?.[v.x]!==1)return false;
   ids.add(v.id);
  }
 }
 return true;
}
