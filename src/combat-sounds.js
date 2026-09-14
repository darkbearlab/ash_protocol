// Distinct hit, miss and kill cues (3.76.4, Claude), so results stay audible when real mode hides the numbers.
// Reads one planned playback event; kill beats hit beats miss, and only an enemy found dead on that tile is a kill
// (allied summons and the player also fall).
export function impactSound(effects=[],state=null){
 const kill=effects.some(e=>e.type==='fall'&&e.actorType!=='player'&&(!state||state.enemies?.some(x=>x.hp<=0&&x.x===e.from?.x&&x.y===e.from?.y)));
 if(kill)return 'kill';
 if(effects.some(e=>e.type==='impact'))return 'hit';
 if(effects.some(e=>e.type==='miss'))return 'miss';
 return null;
}
