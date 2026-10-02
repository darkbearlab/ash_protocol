// Display tuning (3.116.0, user request): whole-screen brightness and how strongly the operator colour covers the grey
// class art. Both are local display preferences, like the boundary lines; neither touches a save or the rules.
export const SCREEN_BRIGHTNESS=Object.freeze({min:70,max:130,step:5,initial:100});
// OPERATOR_TINT: the operator colour strength. Not in the settings since 3.139.1 (the colour picker is being redesigned).
export const OPERATOR_TINT=Object.freeze({min:0,max:100,step:5,initial:100});
function stepped(value,{min,max,step,initial}){
  if(value===null||value===undefined||value===''||!['number','string'].includes(typeof value))return initial;
  const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n/step)*step)):initial;
}
export const screenBrightnessPercent=value=>stepped(value,SCREEN_BRIGHTNESS);
export const operatorTintPercent=value=>stepped(value,OPERATOR_TINT);
// 3.221.0 (user request, 2026-10-02): two spacings fit the battle screen to a device. The top one moves everything down
// from the top edge (a notch, a status bar); the deck one moves the loadout bar and the controls down from the field,
// towards the thumbs, but only into room the field does not need. Local display preferences like the brightness; only
// the top spacing can shrink the field, on a screen too short for it (fitLayout in src/controller.js keeps it square).
export const TOP_SPACING=Object.freeze({min:0,max:80,step:4,initial:0});
export const DECK_SPACING=Object.freeze({min:0,max:200,step:4,initial:0});
export const topSpacingPx=value=>stepped(value,TOP_SPACING);
export const deckSpacingPx=value=>stepped(value,DECK_SPACING);
// The deck spacing is applied by fitLayout, which gives it only the room a full-width field does not need.
export function applySpacing(top){document.documentElement.style.setProperty('--top-spacing',`${top}px`);}
