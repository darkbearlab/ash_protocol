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
// Mirrored for left-handed play: each row reversed, so the arrows land under the other thumb.
export const mirrorDeck=layout=>Array.from({length:DECK_ROWS},(_,r)=>layout.slice(r*DECK_COLUMNS,(r+1)*DECK_COLUMNS).reverse()).flat();
// A layout is usable only when every button appears exactly once; a missing direction or fire key would strand the run.
export const validDeckLayout=layout=>Array.isArray(layout)&&layout.length===DECK_SLOTS
 &&layout.every(id=>id===null||Object.hasOwn(DECK_BUTTONS,id))
 &&DECK_IDS.every(id=>layout.filter(slot=>slot===id).length===1);
export const deckPlacement=layout=>layout.flatMap((id,index)=>id?[{id,selector:DECK_BUTTONS[id],row:Math.floor(index/DECK_COLUMNS)+1,column:index%DECK_COLUMNS+1}]:[]);
