// Control deck layout (3.101.0, user request): the 格狀 deck is one continuous five-by-three field of identical cells,
// with no split between movement and actions. A layout is just an array of 15 slots, which is also the shape a slot
// editor would edit and store, so the same validator guards both.
export const DECK_COLUMNS=5,DECK_ROWS=3,DECK_SLOTS=DECK_COLUMNS*DECK_ROWS;
// Every button the deck owns, by the selector that finds it. Nothing else may enter a layout.
export const DECK_BUTTONS={
 up:'[data-move="0,-1"]',down:'[data-move="0,1"]',left:'[data-move="-1,0"]',right:'[data-move="1,0"]',
 wait:'[data-action="wait"]',fire:'[data-action="fire"]',reload:'[data-action="reload"]',
 grenade:'[data-action="grenade"]',item:'[data-action="item"]',skill:'[data-action="skill"]',interact:'#interact',
};
export const DECK_IDS=Object.keys(DECK_BUTTONS);
// Reading order, row by row. The three empty slots sit on the bottom row, where a spare column keeps the arrows clear
// of the action side now that there is no divider.
export const DECK_GRID=[
 'reload','up','interact','fire','grenade',
 'left','wait','right','item','skill',
 null,'down',null,null,null,
];
// Mirrored for left-handed play: each row reversed so the cluster lands under the other thumb, and then left and right
// swapped back, because reversing the positions would otherwise put ← on the right of 等待 and invert the compass.
export const mirrorDeck=layout=>Array.from({length:DECK_ROWS},(_,r)=>layout.slice(r*DECK_COLUMNS,(r+1)*DECK_COLUMNS).reverse()).flat()
 .map(id=>id==='left'?'right':id==='right'?'left':id);
// A layout is usable only when every button appears exactly once; a missing direction or fire key would strand the run.
export const validDeckLayout=layout=>Array.isArray(layout)&&layout.length===DECK_SLOTS
 &&layout.every(id=>id===null||Object.hasOwn(DECK_BUTTONS,id))
 &&DECK_IDS.every(id=>layout.filter(slot=>slot===id).length===1);
export const deckPlacement=layout=>layout.flatMap((id,index)=>id?[{id,selector:DECK_BUTTONS[id],row:Math.floor(index/DECK_COLUMNS)+1,column:index%DECK_COLUMNS+1}]:[]);
// Editor metadata and moves (3.102.0, user request). Swapping two slots reaches any arrangement in two taps, so the
// editor needs no function picker; swapping with an empty slot simply moves the button there.
export const DECK_LABELS={up:'向上',down:'向下',left:'向左',right:'向右',wait:'等待',fire:'開火',reload:'裝填',grenade:'手榴彈',item:'道具',skill:'技能',interact:'互動'};
export const DECK_GLYPHS={up:'↑',down:'↓',left:'←',right:'→',wait:'◷',fire:'⌖',reload:'⟳',grenade:'◉',item:'✚',skill:'◇',interact:'⇩'};
export const swapSlots=(layout,a,b)=>{const next=[...layout];[next[a],next[b]]=[next[b],next[a]];return next;};
// Stored layouts are user data: anything that does not validate is discarded rather than repaired.
export const parseDeckLayout=raw=>{try{const value=JSON.parse(raw);return validDeckLayout(value)?value:null;}catch{return null;}};
