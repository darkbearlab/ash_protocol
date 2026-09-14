// Display helpers for enemy affixes and grenadier telegraphs (3.75.1, Claude). Rules stay in enemy-affixes.js and
// enemy-intents.js; these read only their public queries, so unrevealed affixes never reach the screen.
import {enemyDisplayName,revealedAffixes} from './enemy-affixes.js';
import {grenadeTelegraphs} from './enemy-intents.js';

// The target card is a fixed 104px column: past two fragments it ends in "…", while the log keeps the full name.
export const CARD_AFFIX_FRAGMENTS=2;
export function cardEnemyName(enemy,limit=CARD_AFFIX_FRAGMENTS){
 const full=enemyDisplayName(enemy),shown=revealedAffixes(enemy);if(shown.length<=limit)return full;
 const unknown=full.endsWith('？'),fragments=list=>list.map(d=>`・${d.fragment}`).join('');
 const base=full.slice(0,full.length-fragments(shown).length-(unknown?1:0));
 return `${base}${fragments(shown.slice(0,limit))}…${unknown?'？':''}`;
}

// Prepare marks the landing tile while the throw can still be stopped; flight marks the blast and its countdown.
// Throw lines start only from a seen thrower or tile, so a grenadier out of sight never gives away where it stands.
export function grenadeMarkers(g){
 const seen=new Set(g.visibleEnemies.map(e=>e.id));
 return grenadeTelegraphs(g).map(t=>({phase:t.phase,x:t.x,y:t.y,radius:t.radius,origin:t.origin,
  line:seen.has(t.sourceId)||Boolean(g.visible(t.origin)),
  label:t.phase==='prepare'?'投擲':`爆炸 ${Math.max(1,t.countdown)}`}));
}
